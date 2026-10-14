import { h, icon, setTitle, starsEl, fmt, mount, navigate, chip } from '../ui.js';
import { store, loadGameData, loadCards } from '../store.js';
import { idx, objectiveText, unitName, drugName, resultKind } from './logic.js';

function stat(k, v) {
  return h('div', { class: 'stat' }, h('div', { class: 'v' }, v), h('div', { class: 'k' }, k));
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

  const verify = r.mismatch
    ? h('div', { class: 'callout callout-warn' }, icon('warn'), h('p', { class: 'mb-0' }, 'Your device and the server disagreed about this battle. The server result below is the official one, and an observer may review it.'))
    : r.verified === true ? chip('Verified by the server', { className: 'ok' }) : chip('Scored by the server');

  const hero = h('div', { class: 'result-hero' },
    h('p', { class: 'muted mb-0' }, ctx.title || ''),
    h('h1', null, title),
    shownStars !== null ? starsEl(shownStars, 3, `${shownStars} of 3 stars`) : null,
    h('div', { class: 'mt-1' }, verify),
    r.practice ? h('p', { class: 'muted small' }, 'Practice run: not scored.') : null,
    (r.flags || []).includes('too_fast') ? h('p', { class: 'small', style: 'color:var(--warn)' }, 'This battle finished faster than real time and was flagged for review.') : null,
    h('div', { class: 'result-stats' },
      defence ? stat('Lowest hydration', `${res.hydrationMinPct}%`) : stat('Destroyed', `${res.pct}%`),
      stat('Score', fmt(r.score || 0)),
      defence ? stat('Unnecessary shots', fmt(st.unnecessary || 0)) : stat('Time left', `${res.timeLeft || 0}s`),
      defence ? stat('Drug shots', fmt(st.totalShots || 0)) : stat('Germs sent', fmt(Object.values(st.deployed || {}).reduce((a, b) => a + b, 0))),
      r.rewards && (r.rewards.atp || r.rewards.nutrients) ? stat('Loot', `${fmt(r.rewards.atp)} ATP / ${fmt(r.rewards.nutrients)} N`) : null,
      r.rewards && r.rewards.trophies ? stat('Merit points', `${r.rewards.trophies > 0 ? '+' : ''}${r.rewards.trophies}`) : null));
  root.append(hero);

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

  if (Array.isArray(r.objectives) && (level || ctx.mode === 'classroom')) {
    const objs = (level ? level.objectives : []) || [];
    root.append(h('section', { class: 'section' }, h('h2', null, icon('star'), ' Stars for this case'),
      h('ul', { class: 'objectives' }, objs.map((o, i) => h('li', { class: r.objectives[i] ? 'met' : 'unmet' },
        icon(r.objectives[i] ? 'check' : 'close'), h('span', null, objectiveText(gd, o, level)))))));
  }
  if (level && level.best) {
    root.append(h('section', { class: 'section' }, h('div', { class: 'callout callout-ok' }, icon('book'),
      h('div', null, h('strong', null, 'Best practice: '), level.best))));
  }
  if (trial) {
    root.append(h('p', { class: 'muted' }, `Defence Trial score = ${gd.scoring.trial.survive} if the patient survives + ${gd.scoring.trial.perHydrationPct} x lowest hydration % + up to ${gd.scoring.trial.steward} stewardship points (minus ${gd.scoring.trial.perUnnecessary} per unnecessary antibiotic shot and ${gd.scoring.trial.perResistancePoint} per resistance point).`));
  }

  const keys = Array.isArray(r.cards) ? r.cards : [];
  if (keys.length) {
    const sec = h('section', { class: 'section' }, h('h2', null, icon('info'), ' Why did this happen?'));
    for (const k of keys) {
      const c = cards[k];
      if (!c) continue;
      sec.append(h('div', { class: 'card why-card mt-1' }, h('h3', null, c.title),
        h('p', null, c.text), c.lesson ? h('p', null, h('strong', null, 'Lesson: '), c.lesson) : null,
        c.ref ? h('p', { class: 'muted small mb-0' }, c.ref) : null));
    }
    root.append(sec);
  }

  const un = r.unlocked || {};
  if ((un.units && un.units.length) || (un.research && un.research.length)) {
    root.append(h('div', { class: 'callout callout-ok mt-2' }, icon('star'), h('div', null,
      h('strong', null, 'Unlocked: '),
      [...(un.units || []).map((u) => `${unitName(gd, u)} (new attack germ)`),
        ...(un.research || []).map((k) => {
          const it = idx(gd).research.get(k);
          return it ? `${it.name} (research)` : drugName(gd, k);
        })].join(', '))));
  }

  const actions = h('div', { class: 'btn-group mt-2' });
  if (store.lastBattle && !ctx.isGroup) {
    actions.append(h('button', { class: 'btn', type: 'button', onclick: () => navigate(`#/replay/${store.lastBattle.id}`) }, icon('replay'), 'Watch replay'));
  }
  if (ctx.again) actions.append(h('a', { class: 'btn btn-primary', href: ctx.again }, icon('play'), ctx.isGroup ? 'Back to the session' : 'Play again'));
  if (level && good && idx(gd).campaign.get(level.id + 1)) {
    actions.append(h('a', { class: 'btn btn-primary', href: `#/campaign/${level.id + 1}` }, icon('next'), 'Next case'));
  }
  if (!ctx.isGroup) actions.append(h('a', { class: 'btn btn-ghost', href: ctx.back || '#/home' }, icon('home'), 'Done'));
  root.append(actions);
}
