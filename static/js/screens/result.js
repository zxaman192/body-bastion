import { h, icon, setTitle, starsEl, fmt, mount, navigate, chip } from '../ui.js';
import { store, loadGameData, loadCards } from '../store.js';
import { idx, objectiveText, unitName, drugName, resultKind, missionNumber } from './logic.js';
import { analyseDefence, analyseAttack } from '../explain.js';
import { termify } from '../glossary.js';
import { FEATURES, featureStates } from '../progress.js';

const KIND_ICON = { bad: 'warn', warn: 'info', info: 'info', good: 'check' };

function stat(k, v) {
  return h('div', { class: 'stat' }, h('div', { class: 'v' }, v), h('div', { class: 'k' }, k));
}

function tp(text, cls) {
  const p = h('p', { class: cls || null });
  p.append(termify(text));
  return p;
}

function nextInOrder(gd, id) {
  const list = gd.campaign || [];
  const i = list.findIndex((m) => Number(m.id) === Number(id));
  return i >= 0 && i + 1 < list.length ? list[i + 1] : null;
}

export async function render(root) {
  setTitle('Result');
  const r = store.lastResult;
  if (!r) {
    mount(root, h('div', { class: 'card center' }, h('h1', null, 'No battle result yet'),
      h('a', { class: 'btn btn-primary', href: '#/home' }, icon('home'), 'Go home')));
    return;
  }
  const [gd, cards] = await Promise.all([loadGameData(), loadCards()]);
  const ctx = r.ctx || {};
  const res = r.result || {};
  const st = res.stats || {};
  const kind = resultKind(ctx.mode);
  const defence = kind === 'defence';
  const level = ctx.levelId ? idx(gd).campaign.get(Number(ctx.levelId)) : null;
  const trial = ctx.trialId ? idx(gd).trials.get(ctx.trialId) : null;
  const target = level || trial;

  let title;
  let good;
  if (defence) {
    good = !!res.survived;
    title = res.collapsed ? 'The patient collapsed from dehydration' : good ? 'The patient survived!' : 'The Bone Marrow Core fell';
  } else {
    good = (res.stars || 0) > 0;
    title = res.collapsed ? 'Their base collapsed from dehydration!' : good ? `${res.stars} star victory` : 'The defence held';
  }
  const shownStars = ctx.mode === 'campaign' ? (r.stars_campaign || 0) : defence ? null : res.stars || 0;
  const perfect = shownStars === 3;

  const verify = r.mismatch
    ? h('div', { class: 'callout callout-warn' }, icon('warn'), h('p', { class: 'mb-0' }, 'Your device and the server disagreed about this battle. The server result below is the official one, and an observer may review it.'))
    : r.verified === true ? chip('Verified by the server', { className: 'ok' }) : chip('Scored by the server');

  root.append(h('div', { class: `result-hero ${good ? 'is-good' : 'is-bad'}` },
    h('p', { class: 'muted mb-0' }, level ? `Mission ${missionNumber(gd, level.id)}: ${level.title}` : ctx.title || ''),
    h('h1', null, title),
    shownStars !== null ? starsEl(shownStars, 3, `${shownStars} of 3 stars`) : null,
    h('div', { class: 'mt-1' }, verify),
    r.practice ? h('p', { class: 'muted small' }, 'Practice run: not scored.') : null,
    (r.flags || []).includes('too_fast') ? h('p', { class: 'small', style: 'color:var(--warn)' }, 'This battle finished faster than real time and was flagged for review.') : null));

  // ------------------------------------------------ actions first, so retrying is one tap away
  const actions = h('div', { class: 'btn-group result-actions' });
  const next = level && good ? nextInOrder(gd, level.id) : null;
  if (ctx.again) {
    actions.append(h('a', { class: `btn ${good && next ? '' : 'btn-primary'}`, href: ctx.again }, icon('refresh'),
      ctx.isGroup ? 'Back to the session' : good ? (perfect ? 'Play again' : 'Try for 3 stars') : 'Try again'));
  }
  if (next) actions.append(h('a', { class: 'btn btn-primary', href: `#/campaign/${next.id}` }, icon('next'), `Next: Mission ${missionNumber(gd, next.id)}`));
  if (!ctx.isGroup) actions.append(h('a', { class: 'btn btn-ghost', href: level ? '#/home' : (ctx.back || '#/home') }, icon('home'), 'Home'));
  root.append(actions);

  // ------------------------------------------------ cause and effect
  const findings = defence ? analyseDefence(gd, target, res, r.objectives) : analyseAttack(gd, store.lastBattle && store.lastBattle.setup, res);
  if (findings.length) {
    root.append(h('section', { class: 'section' }, h('h2', null, icon('info'), good ? ' What happened' : ' Why it went wrong'),
      h('ul', { class: 'findings' }, findings.map((f) => h('li', { class: `finding f-${f.kind}` },
        icon(KIND_ICON[f.kind] || 'info', { size: 18 }),
        h('div', null, tp(f.what, 'mb-0'), f.tip ? h('p', { class: 'small mb-0 tip' }, h('strong', null, 'Try: '), termify(f.tip)) : null))))));
  }

  // ------------------------------------------------ learning summary
  if (level) {
    const sec = h('section', { class: 'section learn-summary' }, h('h2', null, icon('book'), ' What you learned'));
    if (level.lo) sec.append(h('div', { class: 'card goal-card' }, h('p', { class: 'kicker' }, 'The big idea'), tp(level.lo, 'goal-text mb-0')));
    if (level.summary && level.summary.length) sec.append(h('ul', { class: 'summary-list' }, level.summary.map((s) => { const li = h('li'); li.append(termify(s)); return li; })));
    root.append(sec);
  }

  if (Array.isArray(r.objectives) && (level || ctx.mode === 'classroom' || trial)) {
    const objs = (target ? target.objectives : []) || [];
    if (objs.length) {
      root.append(h('section', { class: 'section' }, h('h2', null, icon('star'), ' Stars'),
        h('ul', { class: 'objectives' }, objs.map((o, i) => h('li', { class: r.objectives[i] ? 'met' : 'unmet' },
          icon(r.objectives[i] ? 'check' : 'close'), h('span', null, objectiveText(gd, o, target)))))));
    }
  }

  // Newly opened parts of the game.
  const un = r.unlocked || {};
  const newFeatures = level && r.stars_campaign >= 1 ? FEATURES.filter((f) => f.after === level.id) : [];
  const starsNow = { ...((store.state && store.state.campaign) || {}) };
  if (level && r.stars_campaign) starsNow[String(level.id)] = Math.max(Number(starsNow[String(level.id)] || 0), r.stars_campaign);
  const researchF = featureStates(gd, starsNow, store.user).research;
  const researchNote = researchF.open ? 'research' : `research; Research opens after Mission ${researchF.afterNumber}`;
  if ((un.units && un.units.length) || (un.research && un.research.length) || newFeatures.length) {
    root.append(h('div', { class: 'callout callout-ok mt-2 unlock-callout' }, icon('star'), h('div', null,
      h('strong', null, 'Unlocked: '),
      [...newFeatures.map((f) => `${f.name} (on your home screen)`),
        ...(un.units || []).map((u) => `${unitName(gd, u)} (new raid germ)`),
        ...(un.research || []).map((k) => {
          const it = idx(gd).research.get(k);
          return it ? `${it.name} (${researchNote})` : drugName(gd, k);
        })].join(', '))));
  }

  const cps = Array.isArray(r.checkpoints) ? r.checkpoints.filter((c) => c.answered) : [];
  if (cps.length) {
    const right = cps.filter((c) => c.correct).length;
    const used = (res.stats && res.stats.boosters) || {};
    const boostNames = Object.keys(used).map((k) => {
      const all = [...((gd.boosters || {}).attack || []), ...((gd.boosters || {}).defence || [])];
      const d = all.find((x) => x.key === k);
      return d ? d.name : k;
    });
    root.append(h('section', { class: 'section' }, h('h2', null, icon('flask'), ' Checkpoint questions'),
      h('p', null, `You answered ${right} of ${cps.length} correctly.`, boostNames.length ? ` Boosters used: ${boostNames.join(', ')}.` : ''),
      h('ul', { class: 'objectives' }, cps.map((c) => h('li', { class: c.correct ? 'met' : 'unmet' },
        icon(c.correct ? 'check' : 'close'), h('span', null, `${c.name}: ${c.correct ? 'correct, booster earned' : 'missed'}`))))));
  }

  // ------------------------------------------------ deeper explanations, folded away
  const keys = Array.isArray(r.cards) ? r.cards : [];
  const whyCards = keys.map((k) => cards[k]).filter(Boolean);
  if ((level && level.why) || whyCards.length) {
    const box = h('details', { class: 'card learn-why mt-2' }, h('summary', null, icon('book', { size: 18 }), ' Learn why: the biology behind this battle'));
    if (level && level.why) { const p = h('p'); p.append(termify(level.why, { inline: false })); box.append(p); }
    for (const c of whyCards) {
      box.append(h('div', { class: 'why-card mt-1' }, h('h3', null, c.title),
        h('p', null, c.text), c.lesson ? h('p', null, h('strong', null, 'Lesson: '), c.lesson) : null,
        c.ref ? h('p', { class: 'muted small mb-0' }, c.ref) : null));
    }
    root.append(box);
  }
  if (level && level.best && good) {
    root.append(h('details', { class: 'card mt-2' }, h('summary', null, 'Best practice for this case'), tp(level.best, 'mb-0 mt-1')));
  }

  const stats = h('div', { class: 'result-stats' },
    defence ? stat('Lowest hydration', `${res.hydrationMinPct}%`) : stat('Destroyed', `${res.pct}%`),
    stat('Score', fmt(r.score || 0)),
    defence ? stat('Unnecessary shots', fmt(st.unnecessary || 0)) : stat('Time left', `${res.timeLeft || 0}s`),
    defence ? stat('Drug shots', fmt(st.totalShots || 0)) : stat('Germs sent', fmt(Object.values(st.deployed || {}).reduce((a, b) => a + b, 0))),
    ctx.hintsUsed ? stat('Hints used', String(ctx.hintsUsed)) : null,
    r.rewards && (r.rewards.atp || r.rewards.nutrients) ? stat('Reward', `${fmt(r.rewards.atp)} ATP / ${fmt(r.rewards.nutrients)} nutrients`) : null,
    r.rewards && r.rewards.trophies ? stat('Merit points', `${r.rewards.trophies > 0 ? '+' : ''}${r.rewards.trophies}`) : null);
  root.append(h('details', { class: 'card mt-2', open: level && level.training ? null : true }, h('summary', null, 'Numbers'), stats,
    trial ? h('p', { class: 'muted small' }, `Defence Trial score = ${gd.scoring.trial.survive} if the patient survives + ${gd.scoring.trial.perHydrationPct} x lowest hydration % + up to ${gd.scoring.trial.steward} stewardship points (minus ${gd.scoring.trial.perUnnecessary} per unnecessary antibiotic shot and ${gd.scoring.trial.perResistancePoint} per resistance point).`) : null));

  if (store.lastBattle && !ctx.isGroup) {
    root.append(h('div', { class: 'btn-group mt-2' }, h('button', { class: 'btn', type: 'button', onclick: () => navigate(`#/replay/${store.lastBattle.id}`) }, icon('replay'), 'Watch the replay')));
  }
}
