import { h, setTitle, mount, spinnerBlock, errorBlock, clear, navigate, icon, onLeave } from '../ui.js';
import { get } from '../api.js';
import { loadGameData, loadCards, store, groupSession } from '../store.js';
import { loadBattle } from './engine.js';
import { levelProps } from './battleflow.js';

export async function render(root, params) {
  setTitle('Replay');
  root.append(spinnerBlock('Loading the replay...'));
  let gd;
  let b;
  let mod;
  try {
    const opts = {};
    if (!store.user) {
      const g = params.query && params.query.code ? groupSession(params.query.code) : null;
      if (g && g.token) opts.groupToken = g.token;
    }
    [gd, b, mod] = await Promise.all([loadGameData(), get(`/api/battle/${params.id}`, opts), loadBattle()]);
  } catch (e) {
    mount(root, errorBlock(e), h('a', { class: 'btn mt-2', href: '#/log' }, icon('back'), 'Back'));
    return;
  }
  if (!params.isCurrent()) return;
  if (b.status !== 'finished' && b.status !== 'invalid') {
    mount(root, h('div', { class: 'card center' }, h('h1', null, 'No replay yet'), h('p', { class: 'muted' }, 'This battle was never finished.'), h('a', { class: 'btn', href: '#/log' }, 'Back')));
    return;
  }
  const cards = await loadCards();
  clear(root);
  document.body.classList.add('in-battle');
  const host = h('div', { class: 'battle-host' });
  root.append(host);
  const ctx = {};
  if (b.mode === 'campaign') ctx.levelId = Number(b.ref);
  if (b.mode === 'trial') ctx.trialId = b.ref;
  const back = store.user ? (store.user.role === 'observer' || store.user.role === 'admin') && b.attacker.name !== store.user.display_name ? '#/observer' : '#/log' : '#/home';
  let handle = null;
  const cleanup = () => {
    if (handle) handle.destroy();
    handle = null;
    document.body.classList.remove('in-battle');
  };
  onLeave(root, cleanup);
  handle = mod.mountBattle(host, {
    gd, cards, setup: b.setup, mode: 'replay', commands: b.commands, title: `Replay: ${b.attacker.name} vs ${b.defender.name}`,
    ...levelProps(gd, ctx),
    onExit: () => {
      cleanup();
      navigate(back);
    },
  });
}
