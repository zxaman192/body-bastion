import { h, icon, setTitle, screenHeader, busy, mount, spinnerBlock, errorBlock, fmt, onLeave, toast } from '../ui.js';
import { post } from '../api.js';
import { loadGameData, refreshState, store } from '../store.js';
import { mountBase } from './engine.js';
import { armyBuilder, boostToggle, startBattle } from './battleflow.js';
import { resourceBar } from './home.js';

export async function render(root, params) {
  setTitle('Attack');
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
  let res = resourceBar(store.state);
  const resHost = h('div', null, res.el);
  onLeave(root, () => res.stop());
  const oppHost = h('div', { class: 'card mt-2' });
  const mapHost = h('div', { class: 'baseview-host mt-1' });
  const armyHost = h('div', { class: 'mt-2' });
  let view = null;
  let found = null;

  root.append(
    screenHeader('Attack another gut', { subtitle: 'Find a base, choose your germ army, then break through to the Bone Marrow Core.', back: '#/home' }),
    resHost, oppHost, mapHost, armyHost);
  onLeave(root, () => { if (view) view.destroy(); });

  const goBtn = h('button', { class: 'btn btn-primary btn-big btn-block mt-2', type: 'button', disabled: true }, icon('germ'), 'Attack!');
  let army = null;
  function paintGo() {
    goBtn.disabled = !found || !army || army.empty || !army.affordable;
  }
  army = armyBuilder(gd, store.state, { onChange: () => paintGo() });
  const boost = boostToggle(gd, false);
  armyHost.append(h('h2', null, icon('germ'), ' Your army'), army.el, boost.el, goBtn);

  async function find() {
    oppHost.replaceChildren(spinnerBlock('Searching for an opponent...'));
    try {
      found = await post('/api/battle/find', {});
    } catch (e) {
      oppHost.replaceChildren(errorBlock(e, () => find()));
      return;
    }
    if (!params.isCurrent()) return;
    const o = found.opponent;
    const next = h('button', { class: 'btn', type: 'button' }, icon('refresh', { size: 18 }), 'Next opponent');
    next.addEventListener('click', () => busy(next, find));
    oppHost.replaceChildren(
      h('div', { class: 'row between' },
        h('div', null,
          h('h2', { class: 'mt-0 mb-0' }, o.name),
          h('p', { class: 'muted small mb-0' }, `${o.kind === 'bot' ? 'Training base' : o.college || 'Player'} • Core level ${o.core_level} • ${fmt(o.trophies)} merit points`)),
        next),
      h('p', { class: 'small mb-0 mt-1' }, icon('atp', { size: 16 }), ` Up to ${fmt(found.loot[0])} ATP and `, icon('leaf', { size: 16 }), ` ${fmt(found.loot[1])} nutrients to win.`));
    if (view) view.update(found.layout, { coreLevel: found.core_level, highlightSites: [], showRanges: false });
    else view = await mountBase(mapHost, { gd, layout: found.layout, coreLevel: found.core_level, editable: false, highlightSites: [], showRanges: false }, params.isCurrent);
    paintGo();
  }

  goBtn.addEventListener('click', () => busy(goBtn, async () => {
    if (!found) return;
    if (army.empty) { toast('Add some germs to your army first.', 'warn'); return; }
    if (view) { view.destroy(); view = null; }
    res.stop();
    const ok = await startBattle(root, {
      mode: 'multiplayer', target: { token: found.token }, army: army.army, boost: boost.value,
      title: `Attack: ${found.opponent.name}`, back: '#/attack', again: '#/attack',
    });
    if (!ok) {
      res = resourceBar(store.state);
      mount(resHost, res.el);
      find();
    }
  }));

  await find();
}
