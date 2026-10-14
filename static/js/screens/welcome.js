import { h, icon, setTitle, busy, navigate, toast } from '../ui.js';
import { post, setToken } from '../api.js';
import { store, setUser, refreshState, loadGameData, setPref } from '../store.js';
import { OBJECTIVE, tutorialSkipped } from '../progress.js';
import { VERSION, VERSION_NAME } from '../version.js';

const PILLARS = [
  ['shield', 'Defend', 'Place immune cells, fluids and drugs along the gut.'],
  ['book', 'Learn', 'Real medicine, explained in plain words as you play.'],
  ['drop', 'Survive', 'Keep the patient hydrated until the germs are gone.'],
];

async function firstMission() {
  const gd = await loadGameData();
  const first = (gd.campaign || [])[0];
  return first && !tutorialSkipped() ? `#/campaign/${first.id}?go=1` : '#/home';
}

export function render(root) {
  setTitle('Welcome');
  setPref('welcome.seen', true);
  const user = store.user;
  const play = h('button', { class: 'btn btn-primary btn-big btn-block', type: 'button' }, icon('play'), user ? 'Continue' : 'Play now');
  play.addEventListener('click', () => busy(play, async () => {
    if (user) { navigate('#/home'); return; }
    try {
      const resp = await post('/api/auth/guest', {});
      setToken(resp.token);
      setUser(resp.user);
      try { await refreshState({ silent: true }); } catch { /* the next screen retries */ }
      navigate(await firstMission());
    } catch { toast('Could not start a game. Check your connection and try again.', 'warn'); }
  }));
  const secondary = user
    ? h('a', { class: 'btn btn-block', href: '#/campaign' }, icon('campaign'), 'Missions')
    : h('a', { class: 'btn btn-block', href: '#/login' }, icon('user'), 'I have an account');

  root.append(h('div', { class: 'welcome' },
    h('div', { class: 'welcome-card' },
      h('img', { class: 'welcome-logo', src: '/icons/logo-512.webp', width: '220', height: '220', alt: 'Body Bastion: Defend, Learn, Survive' }),
      h('h1', { class: 'sr-only' }, 'Body Bastion'),
      h('p', { class: 'welcome-goal' }, OBJECTIVE),
      h('ul', { class: 'welcome-pillars' }, PILLARS.map(([ic, t, d]) => h('li', null, h('span', { class: 'welcome-ico' }, icon(ic, { size: 22 })), h('strong', null, t), h('small', null, d)))),
      h('div', { class: 'welcome-actions' }, play, secondary),
      h('p', { class: 'welcome-note' }, user
        ? 'Welcome back.'
        : 'No sign-up needed: a guided first mission teaches you everything in about five minutes. You can skip it at any time.'),
      h('p', { class: 'welcome-links' },
        h('a', { href: '#/join' }, 'Join a class with a code'), ' · ', h('a', { href: '#/guide' }, 'Read the guide'), ' · ', h('a', { href: '#/live' }, 'Live scores')),
      h('p', { class: 'welcome-version' }, `v${VERSION} "${VERSION_NAME}" · Maulana Azad Medical College, New Delhi`))));
  setTimeout(() => { try { play.focus({ preventScroll: true }); } catch { /* ignore */ } }, 60);
}
