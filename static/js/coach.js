// Interactive coach: one short instruction at a time, a pulsing ring on the control to use, and the
// next step only once the player has done it. The game stays fully playable underneath.
// Every coach bubble offers "Skip tutorial"; the profile and the ? menu offer "Replay tutorial".
import { termify } from './glossary.js';
import { skipTutorial, coachSeen, markCoachSeen, tutorialSkipped } from './progress.js';

const FACE = `<svg viewBox="0 0 64 64" width="44" height="44" aria-hidden="true" focusable="false">
<defs><radialGradient id="cfc" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#eef0ff"/><stop offset="1" stop-color="#b9c2ec"/></radialGradient></defs>
<path d="M32 5c9 0 13 5 18 7s10 7 9 16-2 11 0 16-6 13-15 14-13 2-19-1-15-6-16-15 2-11 0-17 7-13 13-16 6-4 10-4z" fill="url(#cfc)" stroke="#4b3c8f" stroke-width="2.4"/>
<g fill="#7a4cc2" stroke="#4b2a8a" stroke-width="1.2"><circle cx="22" cy="40" r="5"/><circle cx="32" cy="45" r="5.4"/><circle cx="42" cy="40" r="5"/></g>
<ellipse cx="23" cy="25" rx="5" ry="6" fill="#fff" stroke="#2a1a3a" stroke-width="1.6"/><ellipse cx="41" cy="25" rx="5" ry="6" fill="#fff" stroke="#2a1a3a" stroke-width="1.6"/>
<circle cx="24.5" cy="26" r="2.6" fill="#2a1a3a"/><circle cx="42.5" cy="26" r="2.6" fill="#2a1a3a"/>
<path d="M26 33q6 5 12 0" fill="none" stroke="#2a1a3a" stroke-width="2.2" stroke-linecap="round"/></svg>`;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

function rectOf(t) {
  if (!t) return null;
  if (t instanceof Element) {
    if (!t.isConnected) return null;
    const r = t.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    const cs = getComputedStyle(t);
    if (cs.visibility === 'hidden' || cs.display === 'none') return null;
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }
  if (typeof t.x === 'number' && typeof t.y === 'number') return { x: t.x, y: t.y, w: t.w || 0, h: t.h || 0 };
  return null;
}

// steps: [{ key, title, text, target(), wait: 'next' | (ev, data) => bool, skipIf(), backIf(), timeout, onEnter() }]
export function createCoach({ steps, id = 'coach', host = document.body, onDone, onSkip, label = 'Tutorial' } = {}) {
  let idx = -1;
  let alive = true;
  let timer = 0;
  let raf = 0;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ring = el('div', `coach-ring${reduce ? ' reduce' : ''}`);
  ring.setAttribute('aria-hidden', 'true');
  ring.hidden = true;
  const face = el('span', 'coach-face');
  face.innerHTML = FACE;
  const kicker = el('span', 'coach-kicker', label);
  const title = el('strong', 'coach-title');
  const body = el('div', 'coach-text');
  body.setAttribute('aria-live', 'polite');
  const dots = el('span', 'coach-dots');
  const next = el('button', 'coach-next', 'Next');
  next.type = 'button';
  const skip = el('button', 'coach-skip', 'Skip tutorial');
  skip.type = 'button';
  const head = el('div', 'coach-head');
  const ht = el('div', 'coach-headtext');
  ht.append(kicker, title);
  head.append(face, ht);
  const foot = el('div', 'coach-foot');
  foot.append(skip, dots, next);
  const card = el('div', `coach-card${reduce ? ' reduce' : ''}`);
  card.setAttribute('role', 'region');
  card.setAttribute('aria-label', label);
  card.id = id;
  card.append(head, body, foot);
  card.hidden = true;
  host.append(ring, card);

  function step() { return steps[idx] || null; }

  function place() {
    if (!alive) return;
    const s = step();
    const r = s && s.target ? rectOf(s.target()) : null;
    const vw = window.innerWidth, vh = window.innerHeight;
    if (r) {
      const pad = s.pad == null ? 8 : s.pad;
      ring.hidden = false;
      ring.style.left = `${Math.round(r.x - pad)}px`;
      ring.style.top = `${Math.round(r.y - pad)}px`;
      ring.style.width = `${Math.round(r.w + pad * 2)}px`;
      ring.style.height = `${Math.round(r.h + pad * 2)}px`;
      ring.classList.toggle('round', !!s.round || (r.w < 70 && r.h < 70));
    } else {
      ring.hidden = true;
    }
    // keep the card away from the highlighted control
    const cw = Math.min(400, vw - 20);
    card.style.width = `${cw}px`;
    let left = (vw - cw) / 2;
    if (r && vw >= 760) {
      // on wide screens sit beside the highlighted control rather than over the map's centre
      const cx = r.x + r.w / 2;
      if (cx > vw * 0.55) left = Math.max(10, Math.min(r.x - cw - 16, 76));
      else if (cx < vw * 0.45) left = Math.min(vw - cw - 10, Math.max(r.x + r.w + 16, vw - cw - 76));
    }
    card.style.left = `${Math.round(left)}px`;
    const sideBySide = r && (left + cw <= r.x - 4 || left >= r.x + r.w + 4);
    const ch = card.offsetHeight || 150;
    const topSafe = s && s.topSafe != null ? s.topSafe : 70;
    const bottomSafe = s && s.bottomSafe != null ? s.bottomSafe : 120;
    let top;
    const wantTop = s && s.dock === 'top' ? true : s && s.dock === 'bottom' ? false : r ? (r.y + r.h / 2) > vh * 0.5 : false;
    if (wantTop) top = topSafe;
    else top = vh - bottomSafe - ch;
    if (r && !sideBySide) {
      const overlaps = top < r.y + r.h + 10 && top + ch > r.y - 10;
      if (overlaps) top = (r.y - 10 - ch >= topSafe) ? r.y - 10 - ch : Math.min(vh - ch - 8, r.y + r.h + 14);
    }
    card.style.top = `${Math.round(Math.max(8, Math.min(vh - ch - 8, top)))}px`;
  }

  function loop() {
    if (!alive) return;
    const s = step();
    if (s && s.backIf && idx > 0 && s.backIf()) { go(idx - 1, true); }
    place();
    raf = requestAnimationFrame(loop);
  }

  function render() {
    const s = step();
    if (!s) return;
    title.textContent = s.title || '';
    body.replaceChildren();
    const parts = [].concat(typeof s.text === 'function' ? s.text() : s.text).filter(Boolean);
    for (const p of parts) {
      if (typeof p === 'string') {
        const para = el('p');
        para.append(termify(p));
        body.append(para);
      } else body.append(p);
    }
    const manual = s.wait === 'next' || !s.wait;
    next.hidden = !manual;
    next.textContent = s.nextLabel || (idx === steps.length - 1 ? 'Got it' : 'Next');
    dots.textContent = steps.length > 1 ? `${idx + 1} / ${steps.length}` : '';
    card.hidden = false;
    card.classList.remove('pop');
    void card.offsetWidth;
    card.classList.add('pop');
    place();
    if (manual && !s.noFocus) {
      try { next.focus({ preventScroll: true }); } catch { /* ignore */ }
    }
  }

  function go(i, backwards = false) {
    clearTimeout(timer);
    idx = i;
    while (idx < steps.length && steps[idx].skipIf && steps[idx].skipIf()) idx += backwards ? -1 : 1;
    if (idx < 0) idx = 0;
    if (idx >= steps.length) { finish(true); return; }
    const s = step();
    if (s.onEnter) { try { s.onEnter(); } catch (e) { console.error(e); } }
    if (s.hidden) {
      card.hidden = true;
      ring.hidden = true;
    } else render();
    if (s.timeout) timer = setTimeout(() => advance(), s.timeout);
  }

  function advance() {
    if (!alive) return;
    go(idx + 1);
  }

  function finish(done) {
    if (!alive) return;
    alive = false;
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', place);
    ring.remove();
    card.remove();
    if (done && onDone) onDone();
  }

  next.addEventListener('click', () => advance());
  skip.addEventListener('click', () => {
    skipTutorial();
    finish(false);
    if (onSkip) onSkip();
  });
  window.addEventListener('resize', place);

  const api = {
    start() { go(0); raf = requestAnimationFrame(loop); return api; },
    // Battle and screens report what the player did; a waiting step advances when its test passes.
    emit(ev, data) {
      if (!alive) return;
      const s = step();
      if (!s) return;
      if (typeof s.wait === 'function' && s.wait(ev, data || {})) advance();
      else if (s.on && s.on[ev]) s.on[ev](data || {}, api);
    },
    next: advance,
    close() { finish(false); },
    get alive() { return alive; },
    get key() { const s = step(); return s ? s.key : null; },
  };
  return api;
}

// ------------------------------------------------------------------ mission scripts
// env: { q(sel), site(id), mouth(), has(key), sheetOpen(), level }
export function missionSteps(level, env) {
  const id = Number(level.id);
  const startStep = {
    key: 'start', title: 'Ready?', text: 'Press Start to send in the germs. You can pause at any time.',
    target: () => env.q('[data-role="start"]'), wait: (ev) => ev === 'started', round: false,
  };
  const pick = (key, site) => () => (env.sheetOpen() ? (env.q('[data-confirm]') || env.q(`[data-build="${key}"]`)) : env.site(site));

  if (id === 11) {
    return [
      { key: 'goal', title: 'Your first patient', text: 'Germs are coming. Your goal is always at the top of the screen: stop the germs before they reach the Bone Marrow Core.', target: () => env.q('.bb-objective'), wait: 'next', dock: 'bottom' },
      { key: 'mouth', title: 'Where germs come from', text: 'Germs enter at the mouth and walk down the gut. Stomach acid (the Acid Moat) already hurts them on the way.', target: () => env.mouth(), wait: 'next' },
      { key: 'site', title: 'Build a defence', text: 'Tap the glowing site beside the small intestine.', target: () => env.site('B3'), wait: (ev) => ev === 'sheet', skipIf: () => env.has('paneth_tower') },
      { key: 'choose', dock: 'top', title: 'Choose a Paneth Cell Tower', text: 'Paneth cells are part of your own gut lining: they release germ-killing proteins. Tap it to see where it can reach.', target: () => env.q('[data-build="paneth_tower"]'), wait: (ev, d) => (ev === 'select' && d.key === 'paneth_tower') || (ev === 'built' && d.key === 'paneth_tower'), skipIf: () => env.has('paneth_tower'), backIf: () => !env.sheetOpen() && !env.has('paneth_tower') },
      { key: 'confirm', dock: 'top', title: 'Check its range, then build', text: 'The bright band on the gut is its range: it can only hit germs inside it. Tap Build to place it.', target: () => env.q('[data-confirm]'), wait: (ev, d) => ev === 'built', skipIf: () => env.has('paneth_tower'), backIf: () => !env.sheetOpen() && !env.has('paneth_tower') },
      { ...startStep, title: 'Well placed!', text: 'Press Start to send in the germs. Watch your tower work.' },
      { key: 'watch', title: 'Here they come', text: 'Watch the stomach acid and your tower hit them.', target: () => env.mouth(), wait: (ev) => ev === 'kill', timeout: 12000, dock: 'bottom' },
      { key: 'hyd', title: 'Every kill counts', text: 'Germs that get past the stomach drain the patient\'s hydration: the blue bar. Each one your tower kills stops draining it.', target: () => env.q('.bb-hyd'), wait: 'next', timeout: 9000, dock: 'bottom', noFocus: true },
      { key: 'end', hidden: true, wait: (ev) => ev === 'over' },
    ];
  }
  if (id === 1) {
    return [
      { key: 'hyd', title: 'New: hydration', text: 'This child is losing fluid fast. If the blue hydration bar reaches zero, the child collapses, even with every defence standing.', target: () => env.q('.bb-hyd'), wait: 'next', dock: 'bottom' },
      { key: 'iga', title: 'The immune system is already working', text: 'An IgA Antibody Cannon guards the small intestine: antibodies are how the body fights a virus.', target: () => env.site('B5'), wait: 'next' },
      { key: 'ors', title: 'Build an ORS + Zinc Station', text: 'Tap a site near the Core and build an ORS + Zinc Station. It refills hydration every second.', target: pick('ors_station', 'E2'), wait: (ev, d) => ev === 'built' && d.key === 'ors_station', skipIf: () => env.has('ors_station') },
      startStep,
      { key: 'drop', hidden: true, wait: (ev, d) => ev === 'hydration' && d.pct < 95 },
      { key: 'refill', title: 'Fluid in, fluid out', text: 'The virus makes the gut pour out water; your ORS station puts it back. That is why ORS saves children\'s lives.', target: () => env.q('.bb-hyd'), wait: 'next', timeout: 9000, dock: 'bottom', noFocus: true },
    ];
  }
  if (id === 3) {
    return [
      { key: 'fluids', title: 'Fluids first', text: 'An ORS station and an IV drip already stand by the Core. The IV drip switches on by itself when dehydration becomes severe.', target: () => env.site('E2'), wait: 'next' },
      { key: 'battery', title: 'New: Drug Battery', text: 'Cholera is a bacterium, so an antibiotic can help. Tap a site beside the small intestine and choose Drug Battery.', target: pick('drug_battery', 'B4'), wait: (ev, d) => ev === 'drugs' || (ev === 'built' && d.key === 'drug_battery'), skipIf: () => env.has('drug_battery') },
      { key: 'rx', title: 'Choose the drug, then prescribe', text: 'Pick a drug, then tick only the germ it should shoot. A drug the germ is not sensitive to wastes every shot.', target: () => env.q('.bb-sheet'), wait: (ev, d) => ev === 'built' && d.key === 'drug_battery', skipIf: () => env.has('drug_battery'), backIf: () => !env.sheetOpen() && !env.has('drug_battery'), pad: 2 },
      startStep,
    ];
  }
  const target = {
    5: () => env.q('[data-role="vaccinate"]'),
    8: () => env.site('B3'),
    4: () => env.q('.bb-objective'),
  }[id];
  const m = level.mechanic || {};
  if (!m.name) return [];
  return [{ key: 'mechanic', title: `New: ${m.name}`, text: m.text, target: target || null, wait: 'next', dock: target ? undefined : 'bottom' }];
}

export function shouldCoach(level) {
  return !tutorialSkipped() && !coachSeen(`mission.${level.id}`);
}

export function markMissionCoached(level) {
  markCoachSeen(`mission.${level.id}`);
}
