import { h, icon, setTitle, screenHeader, starsEl, busy, mount, spinnerBlock, errorBlock, chip, navigate } from '../ui.js';
import { loadGameData, refreshState, store } from '../store.js';
import { idx, objectiveText, missionOpen, missionNumber, prerequisite, unitName } from './logic.js';
import { boostToggle, startBattle } from './battleflow.js';
import { termify } from '../glossary.js';
import { buildingFacts, groupPlain } from '../explain.js';

function patientChip(p) {
  return chip(p === 'child' ? 'Child patient' : 'Adult patient', { className: 'patient' });
}

function para(text, cls) {
  const p = h('p', { class: cls || null });
  p.append(termify(text));
  return p;
}

function learnWhy(text, label = 'Learn why') {
  if (!text) return null;
  const p = h('p', { class: 'mb-0 mt-1' });
  p.append(termify(text, { inline: false }));
  return h('details', { class: 'card learn-why mt-2' }, h('summary', null, icon('book', { size: 18 }), ` ${label}`), p);
}

function germLine(gd, lv) {
  if (!lv.germ || lv.germ === 'mixed') return chip('Mixed outbreak');
  const u = idx(gd).units.get(lv.germ);
  return chip(`${unitName(gd, lv.germ)}${u ? ` · ${groupPlain(gd, u.group)}` : ''}`);
}

export async function render(root, params) {
  setTitle('Missions');
  root.append(spinnerBlock());
  let gd;
  try {
    [gd] = await Promise.all([loadGameData(), refreshState()]);
  } catch (e) {
    mount(root, errorBlock(e, () => location.reload()));
    return;
  }
  if (!params.isCurrent()) return;
  root.replaceChildren();
  const stars = (store.state && store.state.campaign) || {};
  const id = params.id ? Number(params.id) : null;

  if (!id) {
    root.append(screenHeader('Missions', { subtitle: 'Each mission teaches one idea and adds one new tool. Win a mission to open the next.', back: '#/home' }));
    const total = Object.values(stars).reduce((a, b) => a + (Number(b) || 0), 0);
    root.append(h('p', { class: 'muted' }, `Stars earned: ${total} / ${gd.campaign.length * 3}. Hints never cost stars, and you can retry as often as you like.`));
    let chapter = null;
    let list = null;
    for (const lv of gd.campaign) {
      if (lv.chapter !== chapter) {
        chapter = lv.chapter;
        list = h('div', { class: 'grid-cards' });
        root.append(h('h2', { class: 'chapter-h' }, chapter || 'Missions'), list);
      }
      const n = missionNumber(gd, lv.id);
      const open = missionOpen(gd, lv, stars);
      const s = Number(stars[String(lv.id)] || 0);
      const prev = prerequisite(gd, lv.id);
      list.append(h(open ? 'a' : 'div', { class: `card case-card${open ? '' : ' locked'}${s ? ' won' : ''}`, href: open ? `#/campaign/${lv.id}` : null, 'aria-disabled': open ? null : 'true' },
        h('div', { class: 'row between' }, h('strong', null, lv.training ? `Mission ${n} · Training` : `Mission ${n}`), open ? starsEl(s, 3, `${s} of 3 stars`) : icon('lock')),
        h('h3', { class: 'mt-1 mb-1' }, lv.title),
        lv.lo ? h('p', { class: 'small mb-1' }, lv.lo) : null,
        h('div', { class: 'row' }, lv.mechanic ? chip(`New: ${lv.mechanic.name}`, { className: 'new' }) : null, germLine(gd, lv)),
        !open && prev ? h('p', { class: 'muted small mb-0 mt-1' }, `Win Mission ${missionNumber(gd, prev.id)} to unlock.`) : null));
    }
    return;
  }

  const lv = idx(gd).campaign.get(id);
  if (!lv) {
    root.append(errorBlock(new Error('That mission does not exist.')));
    return;
  }
  const n = missionNumber(gd, id);
  if (!missionOpen(gd, lv, stars)) {
    const prev = prerequisite(gd, id);
    root.append(screenHeader(`Mission ${n}`, { back: '#/campaign' }), h('div', { class: 'callout callout-warn' }, icon('lock'), h('p', null, `Win Mission ${prev ? missionNumber(gd, prev.id) : n - 1} first.`)));
    return;
  }
  const s = Number(stars[String(id)] || 0);
  const quizAllowed = lv.boost !== false;
  const boost = quizAllowed ? boostToggle(gd, true) : null;
  const ctx = () => ({
    mode: 'campaign', target: { level: id }, boost: boost ? boost.value : false, title: lv.title, levelId: id,
    back: '#/campaign', again: `#/campaign/${id}?go=1`,
  });
  const play = (btn) => busy(btn, () => startBattle(root, ctx()));
  if (params.query && params.query.go) {
    // "Try again" and "Start training" go straight into the battle.
    root.append(spinnerBlock('Starting the mission...'));
    const ok = await startBattle(root, ctx());
    if (!ok && params.isCurrent()) navigate(`#/campaign/${id}`, { replace: true });
    return;
  }
  const go = h('button', { class: 'btn btn-primary btn-big btn-block', type: 'button' }, icon('play'), s ? 'Play again' : lv.training ? 'Start training' : 'Start the mission');
  go.addEventListener('click', () => play(go));
  const tools = (lv.allowed || []).map((k) => idx(gd).buildings.get(k)).filter(Boolean);
  const hintBox = h('div');
  let shownHints = 0;
  const hintBtn = h('button', { class: 'btn btn-small', type: 'button' }, icon('info', { size: 16 }), 'Show a hint');
  hintBtn.addEventListener('click', () => {
    shownHints += 1;
    hintBox.replaceChildren(h('ol', { class: 'hint-list' }, (lv.hints || []).slice(0, shownHints).map((t) => { const li = h('li'); li.append(termify(t)); return li; })));
    if (shownHints >= (lv.hints || []).length) hintBtn.remove();
    else hintBtn.lastChild.textContent = 'Show a bigger hint';
  });

  root.append(...[
    screenHeader(`Mission ${n}: ${lv.title}`, { subtitle: `${lv.chapter || ''}${s ? ` · best so far: ${s} star${s === 1 ? '' : 's'}` : ''}`, back: '#/campaign' }),
    h('div', { class: 'card goal-card' },
      h('p', { class: 'kicker' }, 'What you will learn'),
      para(lv.lo || lv.best, 'goal-text mb-0')),
    lv.mechanic ? h('div', { class: 'card mechanic-card mt-2' },
      h('p', { class: 'kicker' }, `New in this mission: ${lv.mechanic.name}`),
      para(lv.mechanic.text, 'mb-0')) : null,
    h('div', { class: 'card vignette mt-2' },
      h('div', { class: 'row' }, patientChip(lv.patient), germLine(gd, lv), chip(`Budget ${lv.budget}`)),
      para(lv.case, 'mt-1'),
      lv.patient === 'child' ? h('p', { class: 'small muted mb-0' }, icon('child', { size: 16 }), ' Child patient: Stop-Flow (loperamide) is locked. Antimotility drugs are never given to children with acute diarrhoea.') : null),
    h('section', { class: 'section' }, h('h2', null, icon('star'), ' Earn your stars'),
      h('ol', { class: 'objectives' }, (lv.objectives || []).map((o) => h('li', { class: 'plain' }, icon('star'), h('span', null, objectiveText(gd, o, lv)))))),
    h('section', { class: 'section' }, h('h2', null, icon('build'), ` Your tools (${tools.length})`),
      h('div', { class: 'tool-grid' }, tools.map((d) => h('div', { class: 'card tool-card' },
        h('div', { class: 'row between' }, h('strong', null, d.name), h('span', { class: 'cost' }, `${d.cost[0]} budget`)),
        h('dl', { class: 'facts' }, buildingFacts(gd, d).map((f) => [h('dt', null, f.k), h('dd', null, f.v)])))))),
    (lv.hints || []).length ? h('section', { class: 'section' }, h('h2', null, icon('info'), ' Stuck?'),
      h('p', { class: 'muted small' }, 'Hints never cost stars. Each one is a little more specific.'), hintBox, hintBtn) : null,
    learnWhy(lv.why),
    boost ? h('div', { class: 'mt-2' }, boost.el) : null,
    h('div', { class: 'mt-2' }, go),
    s ? h('details', { class: 'card mt-2' }, h('summary', null, 'Show best practice'), para(lv.best, 'mb-0 mt-1')) : null].filter(Boolean));
}
