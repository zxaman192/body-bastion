import { parseHash, canAccess } from './screens/logic.js';
import {
  h, icon, brandMark, mount, clear, runLeave, setTitle, errorBlock, closeAllModals,
  getLeaveGuard, setLeaveGuard, spinnerBlock, navigate, toast,
} from './ui.js';
import { getToken, onUnauthorized, get } from './api.js';
import {
  store, setUser, loadGameData, loadCards, subscribe, clearSession, pref, setPref, applyTheme, rememberLoginTarget,
} from './store.js';
import { loadAudio } from './screens/engine.js';
import { VERSION, VERSION_NAME } from './version.js';

const SCREEN_FILES = {
  login: 'login',
  register: 'register',
  home: 'home',
  edit: 'edit',
  research: 'research',
  attack: 'attack',
  result: 'result',
  campaign: 'campaign',
  league: 'league',
  clan: 'clan',
  leaderboards: 'leaderboards',
  guide: 'guide',
  log: 'log',
  replay: 'replay',
  classroom: 'classroom',
  join: 'join',
  projector: 'projector',
  live: 'live',
  admin: 'admin',
  observer: 'observer',
  profile: 'profile',
};

const view = document.getElementById('view');
const topnav = document.getElementById('topnav');
let currentRoot = null;
let renderSeq = 0;
let lastHash = location.hash || '#/home';
let firstRender = true;

function renderNav() {
  clear(topnav);
  const u = store.user;
  if (u) {
    topnav.append(
      h('a', { class: 'icon-btn', href: '#/home', 'aria-label': 'Home', title: 'Home' }, icon('home')),
      h('a', { class: 'icon-btn', href: '#/guide', 'aria-label': 'Guide', title: 'Guide' }, icon('book')),
      h('a', { class: 'chip user-chip', href: '#/profile', title: 'Your profile', style: 'text-decoration:none;color:inherit;min-height:40px' },
        icon(u.is_guest ? 'user' : 'shieldcheck', { size: 18 }),
        u.is_guest ? 'Guest' : (u.display_name || u.username || 'Profile')),
    );
  } else {
    topnav.append(
      h('a', { class: 'icon-btn', href: '#/guide', 'aria-label': 'Guide', title: 'Guide' }, icon('book')),
      h('a', { class: 'btn btn-small btn-primary', href: '#/login' }, 'Log in'),
    );
  }
}

function notFound(root, path) {
  setTitle('Not found');
  mount(root,
    h('div', { class: 'card center' },
      h('h1', null, 'Page not found'),
      h('p', { class: 'muted' }, `There is nothing at "${path}".`),
      h('a', { class: 'btn btn-primary', href: '#/home' }, icon('home'), 'Go home')));
}

function noAccess(root) {
  setTitle('No access');
  mount(root,
    h('div', { class: 'card center' },
      h('h1', null, 'Not available for your account'),
      h('p', { class: 'muted' }, 'This page is only for organisers, teachers or observers. Ask an admin if you need access.'),
      h('a', { class: 'btn btn-primary', href: '#/home' }, icon('home'), 'Go home')));
}

async function render() {
  const seq = ++renderSeq;
  const hash = location.hash || '#/home';
  const parsed = parseHash(hash);
  const route = parsed.route;

  if (parsed.name !== 'notfound') {
    const access = canAccess(route, store.user);
    if (!access.ok && access.reason === 'login') {
      rememberLoginTarget(hash);
      navigate('#/login', { replace: true });
      return;
    }
    if (route && route.guestOnly && store.user && !store.user.is_guest) {
      navigate('#/home', { replace: true });
      return;
    }
  }

  closeAllModals();
  setLeaveGuard(null);
  if (currentRoot) runLeave(currentRoot);
  document.body.classList.remove('in-battle');
  document.body.classList.toggle('bare', !!(route && route.bare));
  renderNav();

  const root = h('div', { class: `screen screen-${parsed.name}` });
  currentRoot = root;
  mount(view, root);
  lastHash = hash;

  if (parsed.name === 'notfound') { notFound(root, parsed.path); return; }
  const access = canAccess(route, store.user);
  if (!access.ok) { noAccess(root); return; }

  root.append(spinnerBlock());
  try {
    const mod = await import(`./screens/${SCREEN_FILES[parsed.name]}.js`);
    if (seq !== renderSeq) return;
    clear(root);
    setTitle('');
    await mod.render(root, { ...parsed.params, query: parsed.query, route: parsed.name, isCurrent: () => seq === renderSeq && currentRoot === root });
  } catch (e) {
    if (seq !== renderSeq) return;
    console.error(e);
    mount(root, errorBlock(e, () => render()));
  }
  if (seq !== renderSeq) return;
  if (!firstRender) {
    window.scrollTo(0, 0);
    const heading = root.querySelector('h1');
    try { (heading || view).focus({ preventScroll: true }); } catch { /* ignore */ }
    if (heading && !heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
  }
  firstRender = false;
}

let restoring = false;
async function onHashChange() {
  if (restoring) { restoring = false; return; }
  const guard = getLeaveGuard();
  if (guard) {
    let ok = false;
    try { ok = await guard(); } catch { ok = false; }
    if (!ok) {
      history.pushState(null, '', lastHash);
      return;
    }
    setLeaveGuard(null);
  }
  render();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (/[?&]nosw\b/.test(location.search)) {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
    return;
  }
  const go = () => navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((e) => console.warn('Service worker not registered', e));
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}

function unlockAudioOnce() {
  const handler = async () => {
    window.removeEventListener('pointerdown', handler, true);
    window.removeEventListener('keydown', handler, true);
    const audio = await loadAudio();
    if (!audio) return;
    try {
      audio.setMuted(!!pref('muted', false));
      audio.unlock();
    } catch { /* sound is optional */ }
  };
  window.addEventListener('pointerdown', handler, true);
  window.addEventListener('keydown', handler, true);
}

async function bootUser() {
  if (!getToken()) return;
  try {
    const me = await get('/api/me', { silent: true });
    setUser(me && me.user ? me.user : me);
  } catch (e) {
    if (e && e.status === 401) {
      clearSession();
      return;
    }
    if (e && e.status === 0) {
      toast('You seem to be offline. Some screens need a connection.', 'warn');
      return;
    }
    throw e;
  }
}

function startIntro() {
  if (/[?&]nointro(?:[=&]|$)/.test(location.search)) return;
  const parsed = parseHash(location.hash || '#/home');
  if (parsed.route && parsed.route.bare) return;
  const seen = !!pref('intro.seen', false);
  import('./intro.js')
    .then((m) => m.playIntro({ short: seen, version: `v${VERSION} "${VERSION_NAME}"` }))
    .then(async () => {
      setPref('intro.seen', true);
      const audio = await loadAudio();
      if (audio && !pref('muted', false)) {
        try { audio.unlock(); audio.play('victory'); } catch { /* sound is optional */ }
      }
    })
    .catch((e) => console.warn('Intro skipped', e));
}

async function boot() {
  startIntro();
  const slot = document.getElementById('brand-slot');
  if (slot) mount(slot, brandMark(40));
  applyTheme(pref('theme', 'auto'));

  onUnauthorized(() => {
    clearSession();
    const parsed = parseHash(location.hash);
    if (!(parsed.route && parsed.route.public)) {
      setLeaveGuard(null);
      rememberLoginTarget(location.hash);
      navigate('#/login', { replace: true });
    }
  });
  subscribe(() => renderNav());

  try {
    await Promise.all([loadGameData(), bootUser()]);
  } catch (e) {
    console.error(e);
    mount(view, h('div', { class: 'auth-wrap' }, errorBlock(e, () => location.reload())));
    return;
  }
  loadCards();
  window.addEventListener('hashchange', onHashChange);
  window.addEventListener('bb:rerender', () => render());
  if (!location.hash) history.replaceState(null, '', store.user ? '#/home' : '#/login');
  await render();
  registerServiceWorker();
  unlockAudioOnce();
}

boot();
