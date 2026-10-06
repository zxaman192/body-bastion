import {
  h, icon, openModal, showLoader, hideLoader, setLeaveGuard, navigate, clear, confirmDialog, meter, fmt, toast,
} from '../ui.js';
import { post } from '../api.js';
import { store, loadCards, loadGameData, refreshState, pref, setPref } from '../store.js';
import { loadBattle, playSound } from './engine.js';
import {
  questionParts, rendererMode, boostSummary, objectiveText, deployableUnits, armySpaceUsed, armyCost, clampArmy, idx,
} from './logic.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function battleBody(ctx) {
  const target = ctx.target || {};
  const body = { mode: ctx.mode, target, ...target, boost: !!ctx.boost };
  if (ctx.army) body.army = ctx.army;
  return body;
}

export function levelProps(gd, ctx) {
  if (ctx.levelId !== undefined && ctx.levelId !== null) {
    const level = idx(gd).campaign.get(Number(ctx.levelId));
    if (level) {
      return {
        level,
        objectives: (level.objectives || []).map((o) => ({ ...o, text: objectiveText(gd, o, level) })),
      };
    }
  }
  if (ctx.trialId) {
    const trial = idx(gd).trials.get(ctx.trialId);
    if (trial) {
      return {
        level: { ...trial, title: trial.name, case: trial.brief },
        objectives: [{ key: 'survive', text: objectiveText(gd, { key: 'survive' }, trial) }],
      };
    }
  }
  return {};
}

function answerIndex(answer, options) {
  if (typeof answer === 'number') return answer;
  if (typeof answer === 'string') {
    const n = Number(answer);
    if (answer.trim() !== '' && Number.isInteger(n)) return n;
    const i = options.findIndex((o) => o === answer);
    if (i >= 0) return i;
    const li = LETTERS.indexOf(answer.toUpperCase());
    if (li >= 0) return li;
  }
  return -1;
}

export function askQuestion(gd, battleId, question, apiOpts, isDefence) {
  const parts = questionParts(question) || { text: '', options: [] };
  const total = Math.max(5, Number(gd.questionSeconds) || 20);
  return new Promise((resolve) => {
    let done = false;
    let response = null;
    const startedAt = performance.now();
    const secsEl = h('span', { class: 'secs', 'aria-hidden': 'true' }, String(total));
    const bar = meter(100, { kind: 'info' });
    const cd = h('div', { class: 'countdown' }, icon('clock'), bar, secsEl);
    const live = h('p', { class: 'sr-only', 'aria-live': 'polite' }, `You have ${total} seconds.`);
    const feedback = h('div', { class: 'mt-2', 'aria-live': 'assertive' });
    const buttons = parts.options.map((opt, i) => h('button', {
      type: 'button', class: 'answer', onclick: () => choose(i),
    }, h('span', { class: 'letter', 'aria-hidden': 'true' }, LETTERS[i] || String(i + 1)), h('span', null, opt)));
    const body = h('div', null,
      h('p', { class: 'muted small mb-1' }, boostSummary(gd, isDefence)),
      cd, live,
      h('p', { class: 'question-text' }, parts.text),
      h('div', { class: 'answers', role: 'group', 'aria-label': 'Answer options' }, buttons),
      feedback);
    const m = openModal({ title: 'Knowledge boost', body, actions: [], dismissible: false, className: 'question-modal' });
    let announced = false;
    const timer = setInterval(() => {
      const left = Math.max(0, total - (performance.now() - startedAt) / 1000);
      const pct = (left / total) * 100;
      const fill = bar.querySelector('.meter-fill');
      if (fill) fill.style.width = pct + '%';
      const meterEl = bar.querySelector('.meter');
      if (meterEl) meterEl.setAttribute('aria-valuenow', String(Math.round(pct)));
      secsEl.textContent = String(Math.ceil(left));
      cd.classList.toggle('low', left <= 5);
      if (!announced && left <= 5) { announced = true; live.textContent = '5 seconds left.'; }
      if (left <= 0) choose(-1);
    }, 100);

    async function choose(i) {
      if (done) return;
      done = true;
      clearInterval(timer);
      for (const b of buttons) b.disabled = true;
      if (i >= 0 && buttons[i]) buttons[i].setAttribute('aria-pressed', 'true');
      clear(feedback).append(h('p', { class: 'muted' }, 'Checking your answer...'));
      try {
        response = await post(`/api/battle/${battleId}/answer`, { choice: i }, { ...apiOpts, silent: true });
      } catch (e) {
        response = null;
      }
      clear(feedback);
      if (!response) {
        feedback.append(h('div', { class: 'callout callout-warn' }, icon('warn'),
          h('p', null, i < 0 ? 'Time is up. The battle starts without a boost.' : 'Your answer could not be checked. The battle starts without a boost.')));
      } else {
        const correctIdx = answerIndex(response.answer, parts.options);
        if (correctIdx >= 0 && buttons[correctIdx]) buttons[correctIdx].classList.add('correct');
        if (i >= 0 && i !== correctIdx && buttons[i]) buttons[i].classList.add('wrong');
        m.setTitle(response.correct ? 'Correct! Boost active' : i < 0 ? 'Time is up' : 'Not quite');
        feedback.append(h('div', { class: `callout ${response.correct ? 'callout-ok' : 'callout-warn'}` },
          icon(response.correct ? 'check' : 'info'),
          h('div', null,
            h('p', null, h('strong', null, response.correct ? 'Well done. ' : 'The right answer is highlighted. '), response.explanation || ''))));
        playSound(response.correct ? 'correct' : 'wrong');
      }
      m.setActions([{ label: 'Start the battle', kind: 'primary', icon: 'play', value: true }]);
      setTimeout(() => {
        const btn = m.footer.querySelector('.btn');
        if (btn) btn.focus();
      }, 30);
    }

    m.result.then(() => resolve(response));
  });
}

async function submitFinish(run, commands, local) {
  const l = local || {};
  const claimed = { hash: l.hash, stars: l.stars, pct: l.pct, ticks: l.ticks };
  for (;;) {
    showLoader('Checking your battle on the server...');
    let err = null;
    try {
      return await post(`/api/battle/${run.battleId}/finish`, { commands: commands || [], claimed }, { ...run.apiOpts, silent: true });
    } catch (e) {
      err = e;
    } finally {
      hideLoader();
    }
    if (err.status === 401 && !run.apiOpts.groupToken) return null;
    const retryable = !err.status || err.status >= 500 || err.status === 429;
    if (!retryable) {
      await openModal({
        title: err.status === 410 ? 'This battle expired' : 'The battle could not be saved',
        body: h('div', null,
          h('p', null, err.detail || 'The server rejected this battle.'),
          err.status === 410 ? h('p', { class: 'muted' }, `Battles must be finished within ${(store.gd && store.gd.battleTimeoutMinutes) || 10} minutes of starting.`) : null),
        actions: [{ label: 'OK', kind: 'primary', value: true }],
      }).result;
      return null;
    }
    const again = await openModal({
      title: 'Could not reach the server',
      body: h('div', null,
        h('p', null, err.detail || 'The connection failed.'),
        h('p', { class: 'muted' }, 'Your battle is kept on this device. Check your connection and try again.')),
      dismissible: false,
      actions: [
        { label: 'Give up', value: false },
        { label: 'Try again', kind: 'primary', icon: 'refresh', value: true },
      ],
    }).result;
    if (!again) return null;
  }
}

function leaveGuardFor(run) {
  return () => confirmDialog(
    run.mode === 'campaign' || run.mode === 'trial'
      ? 'Leave this case? The battle will be abandoned and nothing will be saved.'
      : run.scored
        ? 'Leave this battle? It will be abandoned, and in the league it still uses your one scored attempt.'
        : 'Leave this battle? It will be abandoned and nothing will be saved.',
    { title: 'Leave the battle?', okLabel: 'Leave', cancelLabel: 'Stay', danger: true },
  );
}

export async function runBattle(root, run) {
  const gd = await loadGameData();
  let mod;
  try {
    mod = await loadBattle();
  } catch (e) {
    console.error(e);
    clear(root).append(h('div', { class: 'card battle-fallback' },
      h('h1', null, 'The battle screen could not load'),
      h('p', { class: 'muted' }, 'Please reload the page and try again.'),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: () => location.reload() }, icon('refresh'), 'Reload')));
    return;
  }
  const cards = await loadCards();
  clear(root);
  document.body.classList.add('in-battle');
  const host = h('div', { class: 'battle-host' });
  root.append(host);
  const rmode = rendererMode(run.setup);
  let finished = false;
  let handle = null;
  if (rmode !== 'replay') setLeaveGuard(leaveGuardFor(run));

  const cleanup = () => {
    setLeaveGuard(null);
    document.body.classList.remove('in-battle');
    if (handle && typeof handle.destroy === 'function') {
      try { handle.destroy(); } catch (e) { console.error(e); }
    }
    handle = null;
  };

  const onFinish = async (commands, localResult) => {
    if (finished) return;
    finished = true;
    setLeaveGuard(null);
    const resp = await submitFinish(run, commands, localResult);
    cleanup();
    if (!resp) {
      navigate(run.back || '#/home');
      return;
    }
    store.lastBattle = { id: resp.battle_id || run.battleId, setup: run.setup, commands: commands || [], mode: run.mode, title: run.title };
    store.lastResult = {
      ...resp,
      battleId: run.battleId,
      local: localResult || null,
      ctx: {
        mode: run.mode, title: run.title, levelId: run.levelId, trialId: run.trialId, baseId: run.baseId,
        code: run.code, again: run.again, back: run.back, practice: !!run.practice, isGroup: !!run.apiOpts.groupToken,
        boostCorrect: !!run.boostCorrect, opponent: run.opponent || null, scored: !!run.scored,
      },
    };
    if (!run.apiOpts.groupToken && store.user) refreshState({ silent: true }).catch(() => {});
    navigate('#/result');
  };

  const onExit = () => {
    if (finished) return;
    finished = true;
    cleanup();
    navigate(run.back || '#/home');
  };

  const props = {
    gd,
    cards,
    setup: run.setup,
    mode: rmode,
    title: run.title || 'Battle',
    scored: !!run.scored || !!run.apiOpts.groupToken,
    onFinish,
    onExit,
    ...levelProps(gd, run),
  };
  try {
    handle = mod.mountBattle(host, props);
  } catch (e) {
    console.error(e);
    cleanup();
    clear(root).append(h('div', { class: 'card battle-fallback' },
      h('h1', null, 'The battle could not start'),
      h('p', { class: 'muted' }, String(e && e.message ? e.message : e)),
      h('a', { class: 'btn btn-primary', href: run.back || '#/home' }, 'Back')));
  }
}

export async function startBattle(root, ctx) {
  const gd = await loadGameData();
  const apiOpts = ctx.groupToken ? { groupToken: ctx.groupToken } : {};
  showLoader('Preparing the battle...');
  let start;
  try {
    start = await post('/api/battle/start', battleBody(ctx), apiOpts);
  } catch {
    return false;
  } finally {
    hideLoader();
  }
  let setup = start.setup;
  let boostCorrect = false;
  if (start.question) {
    const isDefence = setup && setup.mode === 'campaign';
    const ans = await askQuestion(gd, start.battle_id, start.question, apiOpts, isDefence);
    if (ans && ans.setup) setup = ans.setup;
    boostCorrect = !!(ans && ans.correct);
  }
  if (start.practice && (ctx.mode === 'tournament' || ctx.mode === 'trial')) {
    toast('Practice run: this attempt is not scored.', 'info');
  }
  await runBattle(root, {
    ...ctx,
    apiOpts,
    battleId: start.battle_id,
    setup,
    practice: !!start.practice,
    opponent: start.opponent,
    boostCorrect,
    scored: !start.practice && (ctx.mode === 'tournament' || ctx.mode === 'trial'),
  });
  return true;
}

export function boostToggle(gd, isDefence, initial) {
  const input = h('input', { type: 'checkbox', role: 'switch' });
  input.checked = initial === undefined ? !!pref('boost', true) : !!initial;
  input.addEventListener('change', () => setPref('boost', input.checked));
  const el = h('div', { class: 'card soft' },
    h('label', { class: 'switch' }, input, h('span', { class: 'track', 'aria-hidden': 'true' }), h('span', null, 'Knowledge boost?')),
    h('p', { class: 'muted small mb-0 mt-1' },
      `Answer one quick question (${gd.questionSeconds || 20} seconds) before the battle. ${boostSummary(gd, isDefence)} A wrong answer costs nothing.`));
  return { el, get value() { return input.checked; } };
}

function unitGlyph(gd, u) {
  const g = (gd.groups || {})[u.group] || {};
  return h('span', { class: 'unit-glyph', style: { '--grp': g.color || '#888', background: g.color || '#888', color: textOn(g.color) }, 'aria-hidden': 'true' },
    (u.real || u.name || '?').replace(/[^A-Za-z]/g, '').slice(0, 2));
}

export function textOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#fff';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#1a1018' : '#ffffff';
}

export function groupDot(gd, groupKey) {
  const g = (gd.groups || {})[groupKey] || {};
  return h('span', { class: 'chip-dot', style: { background: g.color || '#888' }, 'aria-hidden': 'true' });
}

export function armyBuilder(gd, state, { onChange } = {}) {
  const capacity = Number(state.army_space) || 0;
  const units = deployableUnits(gd, state.units);
  let army = clampArmy(gd, pref('army', {}), capacity, state.units);
  const counts = new Map();
  const cardsByKey = new Map();
  const usedText = h('strong', null);
  const costText = h('span', null);
  const capMeter = h('div', { class: 'meter', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(capacity), 'aria-label': 'Army space used' },
    h('div', { class: 'meter-fill' }));
  const warn = h('p', { class: 'small mb-0', style: 'color:var(--danger)', 'aria-live': 'polite' });

  function update() {
    const used = armySpaceUsed(gd, army);
    const cost = armyCost(gd, army);
    usedText.textContent = `${used} / ${capacity} space`;
    capMeter.setAttribute('aria-valuenow', String(used));
    capMeter.firstChild.style.width = `${capacity ? Math.min(100, (used / capacity) * 100) : 0}%`;
    const nut = (state.resources && state.resources.nutrients) || 0;
    costText.textContent = `Training cost: ${fmt(cost)} nutrients (you have ${fmt(nut)})`;
    warn.textContent = cost > nut ? 'Not enough nutrients to train this army. Remove some germs or collect more nutrients.' : '';
    for (const u of units) {
      const n = army[u.key] || 0;
      counts.get(u.key).textContent = String(n);
      cardsByKey.get(u.key).classList.toggle('has', n > 0);
      const plus = cardsByKey.get(u.key).querySelector('[data-op="plus"]');
      const minus = cardsByKey.get(u.key).querySelector('[data-op="minus"]');
      plus.disabled = used + u.space > capacity;
      minus.disabled = n <= 0;
    }
    setPref('army', army);
    if (onChange) onChange(api);
  }

  function change(key, delta) {
    const u = units.find((x) => x.key === key);
    if (!u) return;
    const n = (army[key] || 0) + delta;
    if (n < 0) return;
    if (delta > 0 && armySpaceUsed(gd, army) + u.space > capacity) return;
    army = { ...army };
    if (n === 0) delete army[key];
    else army[key] = n;
    update();
  }

  const grid = h('div', { class: 'army' });
  for (const u of units) {
    const g = (gd.groups || {})[u.group] || {};
    const count = h('span', { class: 'count', 'aria-live': 'polite' }, '0');
    counts.set(u.key, count);
    const card = h('div', { class: 'unit-card', style: { '--grp': g.color || 'var(--accent)' } },
      unitGlyph(gd, u),
      h('div', { class: 'grow' },
        h('strong', null, u.name),
        h('small', null, `${u.real} - ${g.name || u.group} - ${u.space} space${u.spawnCount > 1 ? `, ${u.spawnCount} per deploy` : ''}`)),
      h('div', { class: 'stepper' },
        h('button', { type: 'button', class: 'icon-btn', 'data-op': 'minus', 'aria-label': `Remove one ${u.name}`, onclick: () => change(u.key, -1) }, icon('minus', { size: 18 })),
        count,
        h('button', { type: 'button', class: 'icon-btn', 'data-op': 'plus', 'aria-label': `Add one ${u.name}`, onclick: () => change(u.key, 1) }, icon('plus', { size: 18 }))));
    cardsByKey.set(u.key, card);
    grid.append(card);
  }

  const spells = (gd.spells || []).map((s) => s.name).join(', ');
  const el = h('div', null,
    units.length ? grid : h('p', { class: 'muted' }, 'You have no deployable germs yet.'),
    h('p', { class: 'muted small mt-1' }, `You also get one of each spell: ${spells}.`),
    h('div', { class: 'capacity' },
      h('div', { class: 'card flat' },
        h('div', { class: 'row between' }, usedText,
          h('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => { army = {}; update(); } }, 'Clear')),
        h('div', { class: 'mt-1' }, capMeter),
        h('p', { class: 'small mb-0 mt-1' }, costText),
        warn)));

  const api = {
    el,
    get army() { return { ...army }; },
    get used() { return armySpaceUsed(gd, army); },
    get cost() { return armyCost(gd, army); },
    get affordable() { return armyCost(gd, army) <= ((state.resources && state.resources.nutrients) || 0); },
    get empty() { return armySpaceUsed(gd, army) === 0; },
  };
  update();
  return api;
}
