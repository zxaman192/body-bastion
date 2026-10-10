import { h, append, icon, setTitle, screenHeader, starsEl, busy, mount, spinnerBlock, errorBlock, fmt, confirmDialog, chip } from '../ui.js';
import { get } from '../api.js';
import { loadGameData, store, isGuest } from '../store.js';
import { phaseText } from './logic.js';
import { boostToggle, startBattle } from './battleflow.js';

export async function render(root, params) {
  setTitle('League');
  root.append(spinnerBlock());
  let gd;
  let lg;
  try {
    [gd, lg] = await Promise.all([loadGameData(), get('/api/league')]);
  } catch (e) {
    mount(root, errorBlock(e, () => location.reload()));
    return;
  }
  if (!params.isCurrent()) return;
  root.replaceChildren();
  const scoredOpen = lg.phase === 'league' && !isGuest();
  const boost = boostToggle(gd, false);
  const t = gd.tournament;
  const armyText = Object.entries(t.army).map(([k, n]) => `${n} ${(gd.units.find((u) => u.key === k) || {}).name || k}`).join(', ');

  append(root, [
    screenHeader('League round', { subtitle: 'Identical bases and armies for everyone: pure skill.', back: '#/home' }),
    h('div', { class: `banner ${lg.phase === 'league' ? 'callout-ok' : ''}` }, icon('trophy'), h('div', { class: 'grow' }, h('p', null, phaseText(lg.phase)))),
    h('div', { class: 'result-stats mt-2' },
      h('div', { class: 'stat' }, h('div', { class: 'v' }, fmt(lg.total || 0)), h('div', { class: 'k' }, 'Your league total')),
      h('div', { class: 'stat' }, h('div', { class: 'v' }, lg.rank ? `#${lg.rank}` : '-'), h('div', { class: 'k' }, `Rank of ${lg.players || 0}`))),
    isGuest() ? h('div', { class: 'callout callout-warn mt-2' }, icon('user'), h('p', { class: 'mb-0' }, 'Guests can practise, but only registered players are scored in the league.')) : null,
    h('p', { class: 'muted small mt-2' }, `Attack score = ${gd.scoring.star} per star + ${gd.scoring.pct} per % destroyed + ${gd.scoring.secLeft} per second left on a 3-star win + ${gd.scoring.boost} for a correct knowledge boost. Every battle is re-checked on the server.`),
    boost.el]);

  async function play(ctx, scored) {
    if (scored && !(await confirmDialog('This is your ONE scored attempt for this battle. Leaving early still uses it. Ready?', { title: 'Scored attempt', okLabel: 'Start' }))) return;
    await startBattle(root, { ...ctx, boost: boost.value, back: '#/league', again: '#/league' });
  }

  const bases = h('div', { class: 'grid-cards' });
  for (const b of lg.bases) {
    const used = b.attempts > 0;
    const playBtn = h('button', { class: 'btn btn-primary', type: 'button', disabled: !scoredOpen || used }, icon('play', { size: 18 }), used ? 'Attempt used' : 'Scored attempt');
    playBtn.addEventListener('click', () => busy(playBtn, () => play({ mode: 'tournament', target: { base_id: b.id }, title: `${b.id}: ${b.name}`, baseId: b.id }, true)));
    const prac = h('button', { class: 'btn', type: 'button' }, icon('replay', { size: 18 }), 'Practice');
    prac.addEventListener('click', () => busy(prac, () => play({ mode: 'practice', target: { base_id: b.id }, title: `${b.id}: ${b.name} (practice)`, baseId: b.id }, false)));
    bases.append(h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('strong', null, `${b.id} • ${b.name}`), chip(`Difficulty ${b.difficulty}`)),
      b.best_score !== null ? h('div', { class: 'row mt-1' }, starsEl(b.best_stars || 0, 3), h('span', { class: 'muted small' }, `Score ${fmt(b.best_score)}`)) : h('p', { class: 'muted small mt-1 mb-0' }, 'Not attempted'),
      b.practice_best !== null ? h('p', { class: 'muted small mb-0' }, `Best practice: ${fmt(b.practice_best)}`) : null,
      h('div', { class: 'btn-group mt-1' }, playBtn, prac)));
  }
  root.append(h('section', { class: 'section' }, h('h2', null, icon('castle'), ' Tournament bases'),
    h('p', { class: 'muted small' }, `Everyone attacks with the same army: ${armyText}, plus one of each tactic.`), bases));

  const trials = h('div', { class: 'grid-cards' });
  for (const tr of lg.trials) {
    const def = (gd.trials || []).find((x) => x.id === tr.id) || {};
    const used = tr.attempts > 0;
    const playBtn = h('button', { class: 'btn btn-primary', type: 'button', disabled: !scoredOpen || used }, icon('play', { size: 18 }), used ? 'Attempt used' : 'Scored attempt');
    playBtn.addEventListener('click', () => busy(playBtn, () => play({ mode: 'trial', target: { trial_id: tr.id }, title: `Trial ${tr.id}: ${tr.name}`, trialId: tr.id }, true)));
    const prac = h('button', { class: 'btn', type: 'button' }, icon('replay', { size: 18 }), 'Practice');
    prac.addEventListener('click', () => busy(prac, () => play({ mode: 'trial', target: { trial_id: tr.id, practice: true }, title: `Trial ${tr.id}: ${tr.name} (practice)`, trialId: tr.id }, false)));
    trials.append(h('div', { class: 'card' },
      h('strong', null, `${tr.id} • ${tr.name}`),
      h('p', { class: 'muted small' }, def.brief || ''),
      h('p', { class: 'small mb-0' }, tr.best_score !== null ? `Best score: ${fmt(tr.best_score)}` : 'Not attempted'),
      h('div', { class: 'btn-group mt-1' }, playBtn, prac)));
  }
  root.append(h('section', { class: 'section' }, h('h2', null, icon('shieldcheck'), ' Defence Trials'),
    h('p', { class: 'muted small' }, 'You defend a standard gut against scripted waves. These trials decide the Best Steward award: survive, keep hydration up, and avoid unnecessary antibiotics.'),
    trials));
  if (!scoredOpen && lg.phase === 'league' && store.user && store.user.is_guest) {
    root.append(h('p', { class: 'muted' }, h('a', { href: '#/profile' }, 'Register an account'), ' to take part.'));
  }
}
