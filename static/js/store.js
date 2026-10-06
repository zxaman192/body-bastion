import { get, fetchJsonFile } from './api.js';
import { normalizeCards } from './screens/logic.js';

const listeners = new Set();

export const store = {
  gd: null,
  cards: {},
  guide: null,
  state: null,
  stateAt: 0,
  user: null,
  lastResult: null,
  lastBattle: null,
  privacy: null,
};

let gdPromise = null;
let cardsPromise = null;
let guidePromise = null;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of [...listeners]) {
    try { fn(store); } catch (e) { console.error(e); }
  }
}

export function loadGameData() {
  if (store.gd) return Promise.resolve(store.gd);
  if (!gdPromise) {
    gdPromise = fetchJsonFile('/shared/gamedata.json').then((gd) => {
      store.gd = gd;
      return gd;
    }).catch((e) => {
      gdPromise = null;
      throw e;
    });
  }
  return gdPromise;
}

export function loadCards() {
  if (!cardsPromise) {
    cardsPromise = fetchJsonFile('/shared/cards.json')
      .then((raw) => { store.cards = normalizeCards(raw); return store.cards; })
      .catch(() => { cardsPromise = null; store.cards = store.cards || {}; return store.cards; });
  }
  return cardsPromise;
}

export function loadGuide() {
  if (!guidePromise) {
    guidePromise = fetchJsonFile('/shared/guide.json')
      .then((g) => { store.guide = g; return g; })
      .catch(() => { guidePromise = null; return null; });
  }
  return guidePromise;
}

export function setUser(user) {
  store.user = user || null;
  emit();
}

export function setState(state) {
  if (!state || typeof state !== 'object') return store.state;
  store.state = state;
  store.stateAt = Date.now();
  if (state.user) store.user = state.user;
  emit();
  return state;
}

export async function refreshState(opts) {
  const s = await get('/api/state', opts);
  return setState(s);
}

export async function ensureState(maxAgeMs = 15000) {
  if (store.state && Date.now() - store.stateAt < maxAgeMs) return store.state;
  return refreshState();
}

export function clearSession() {
  store.state = null;
  store.stateAt = 0;
  store.user = null;
  store.lastResult = null;
  store.lastBattle = null;
  emit();
}

export async function loadPrivacy() {
  if (store.privacy) return store.privacy;
  const p = await get('/api/privacy', { silent: true });
  store.privacy = p;
  return p;
}

export function role() {
  return store.user ? store.user.role : null;
}

export function isGuest() {
  return !!(store.user && store.user.is_guest);
}

export function myClanId(state = store.state) {
  if (state && state.clan) {
    if (typeof state.clan === 'object') return state.clan.id !== undefined ? state.clan.id : null;
    return state.clan;
  }
  if (state && state.user && state.user.clan_id) return state.user.clan_id;
  return store.user && store.user.clan_id ? store.user.clan_id : null;
}

export function pref(key, fallback) {
  try {
    const v = localStorage.getItem('bb.pref.' + key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function setPref(key, value) {
  try { localStorage.setItem('bb.pref.' + key, JSON.stringify(value)); } catch { /* storage blocked */ }
}

export function groupSession(code) {
  try {
    const raw = sessionStorage.getItem('bb.group.' + String(code).toUpperCase());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return store['group_' + code] || null;
  }
}

export function setGroupSession(code, value) {
  const key = 'bb.group.' + String(code).toUpperCase();
  store['group_' + code] = value;
  try {
    if (value) sessionStorage.setItem(key, JSON.stringify(value));
    else sessionStorage.removeItem(key);
  } catch { /* storage blocked */ }
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
}

export function rememberLoginTarget(hash) {
  try { sessionStorage.setItem('bb.after-login', hash); } catch { /* storage blocked */ }
}

export function takeLoginTarget() {
  try {
    const t = sessionStorage.getItem('bb.after-login');
    sessionStorage.removeItem('bb.after-login');
    if (t && !/^#\/(login|register)/.test(t)) return t;
  } catch { /* storage blocked */ }
  return '#/home';
}
