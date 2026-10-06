import { h, append, icon, setTitle, screenHeader, starsEl, busy, mount, spinnerBlock, errorBlock, chip } from '../ui.js';
import { loadGameData, refreshState, store } from '../store.js';
import { idx, objectiveText, levelUnlocked, unitName } from './logic.js';
import { boostToggle, startBattle } from './battleflow.js';

function patientChip(p) {
  return chip(p === 'child' ? 'Child patient' : 'Adult patient', { className: 'patient' });
}

export async function render(root, params) {
  setTitle('Campaign');
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
    root.append(screenHeader('Case campaign', { subtitle: 'Ten clinical cases. Win each with the best treatment: rehydrate first, the right drug for the right bug, no unnecessary antibiotics.', back: '#/home' }));
    const total = Object.values(stars).reduce((a, b) => a + (Number(b) || 0), 0);
    root.append(h('p', { class: 'muted' }, `Stars earned: ${total} / ${gd.campaign.length * 3}. Winning a case unlocks the next one, and can unlock new germs and research.`));
    const list = h('div', { class: 'grid-cards' });
    for (const lv of gd.campaign) {
      const open = levelUnlocked(lv, stars);
      const s = Number(stars[String(lv.id)] || 0);
      list.append(h(open ? 'a' : 'div', { class: `card case-card${open ? '' : ' locked'}`, href: open ? `#/campaign/${lv.id}` : null, style: open ? null : 'opacity:.6' },
        h('div', { class: 'row between' }, h('strong', null, `Case ${lv.id}`), open ? starsEl(s, 3, `${s} of 3 stars`) : icon('lock')),
        h('h3', { class: 'mt-1 mb-1' }, lv.title),
        h('div', { class: 'row' }, patientChip(lv.patient), lv.germ && lv.germ !== 'mixed' ? chip(unitName(gd, lv.germ)) : chip('Mixed outbreak')),
        !open ? h('p', { class: 'muted small mb-0 mt-1' }, `Earn a star on case ${lv.id - 1} to unlock.`) : null));
    }
    root.append(list);
    return;
  }

  const lv = idx(gd).campaign.get(id);
  if (!lv) {
    root.append(errorBlock(new Error('That case does not exist.')));
    return;
  }
  if (!levelUnlocked(lv, stars)) {
    root.append(screenHeader(`Case ${id}`, { back: '#/campaign' }), h('div', { class: 'callout callout-warn' }, icon('lock'), h('p', null, `Win case ${id - 1} first.`)));
    return;
  }
  const s = Number(stars[String(id)] || 0);
  const boost = boostToggle(gd, true);
  const go = h('button', { class: 'btn btn-primary btn-big btn-block', type: 'button' }, icon('play'), s ? 'Play again' : 'Start the case');
  go.addEventListener('click', () => busy(go, () => startBattle(root, {
    mode: 'campaign', target: { level: id }, boost: boost.value, title: `Case ${id}: ${lv.title}`, levelId: id,
    back: '#/campaign', again: `#/campaign/${id}`,
  })));
  const allowed = (lv.allowed || []).map((k) => (idx(gd).buildings.get(k) || {}).name || k);
  append(root, [
    screenHeader(`Case ${id}: ${lv.title}`, { subtitle: s ? `Best so far: ${s} star${s === 1 ? '' : 's'}` : 'Not yet won', back: '#/campaign' }),
    h('div', { class: 'card vignette' },
      h('div', { class: 'row' }, patientChip(lv.patient), chip(`Budget ${lv.budget}`), chip(`Drug ATP ${lv.atp}`)),
      h('p', { class: 'mt-1' }, lv.case),
      lv.patient === 'child' ? h('p', { class: 'small muted' }, icon('child', { size: 16 }), ' Child patient: Stop-Flow (loperamide) is locked - antimotility drugs are never given to children with acute diarrhoea.') : null),
    h('section', { class: 'section' }, h('h2', null, icon('star'), ' Earn your stars'),
      h('ol', { class: 'objectives' }, (lv.objectives || []).map((o) => h('li', { class: 'plain' }, icon('star'), h('span', null, objectiveText(gd, o, lv)))))),
    h('section', { class: 'section' }, h('h2', null, icon('build'), ' Your tools'),
      h('p', { class: 'muted' }, `You can build: ${allowed.join(', ')}.`),
      h('p', { class: 'muted small' }, 'Drug batteries only fire at the germs you prescribe. You choose the drug and tick the germs - no hints. Wrong choices waste ATP, breed resistance and can wipe out the gut flora.')),
    boost.el,
    h('div', { class: 'mt-2' }, go),
    s ? h('details', { class: 'card mt-2' }, h('summary', null, 'Show best practice'), h('p', { class: 'mb-0 mt-1' }, lv.best)) : null]);
}
