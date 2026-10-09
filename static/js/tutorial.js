// Optional guided tours: a spotlight on one part of the screen at a time, with a friendly
// neutrophil ("Dr Neutro") explaining it. Tours can be skipped and replayed from the "?" button.
import { h, icon } from './ui.js';
import { pref, setPref } from './store.js';

const GUIDE_SVG = `<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" focusable="false">
<defs><radialGradient id="tgc" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#eef0ff"/><stop offset="1" stop-color="#b9c2ec"/></radialGradient></defs>
<path d="M32 5c9 0 13 5 18 7s10 7 9 16-2 11 0 16-6 13-15 14-13 2-19-1-15-6-16-15 2-11 0-17 7-13 13-16 6-4 10-4z" fill="url(#tgc)" stroke="#4b3c8f" stroke-width="2.4"/>
<g fill="#7a4cc2" stroke="#4b2a8a" stroke-width="1.2"><circle cx="22" cy="40" r="5"/><circle cx="32" cy="45" r="5.4"/><circle cx="42" cy="40" r="5"/></g>
<path d="M24 41q8 6 16 0" fill="none" stroke="#4b2a8a" stroke-width="1.6"/>
<ellipse cx="23" cy="25" rx="5" ry="6" fill="#fff" stroke="#2a1a3a" stroke-width="1.6"/><ellipse cx="41" cy="25" rx="5" ry="6" fill="#fff" stroke="#2a1a3a" stroke-width="1.6"/>
<circle cx="24.5" cy="26" r="2.6" fill="#2a1a3a"/><circle cx="42.5" cy="26" r="2.6" fill="#2a1a3a"/>
<path d="M26 33q6 5 12 0" fill="none" stroke="#2a1a3a" stroke-width="2.2" stroke-linecap="round"/>
<path d="M15 14l-4-6M49 14l4-6" stroke="#4b3c8f" stroke-width="2.4" stroke-linecap="round"/>
<circle cx="10" cy="7" r="2.4" fill="#ff7aa8"/><circle cx="54" cy="7" r="2.4" fill="#ff7aa8"/></svg>`;

function guideFace() {
  const span = document.createElement('span');
  span.className = 'tour-face';
  span.innerHTML = GUIDE_SVG;
  return span;
}

function gutRoute() {
  const stops = [['Mouth', '#e8577a'], ['Stomach', '#f4c7b0'], ['Small intestine', '#f3dfa2'], ['Colon', '#cfe8c4'], ['Liver gate', '#e9b8b4'], ['Core', '#dccbef']];
  return h('ol', { class: 'tour-route', 'aria-label': 'The route germs take' },
    stops.map(([n, c], i) => h('li', { style: { '--c': c } }, h('span', { class: 'tour-stop' }, String(i + 1)), n)));
}

let active = null;

export function startTour(steps, { id = 'tour', onDone } = {}) {
  if (active) active.close(false);
  let idx = 0;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const spot = h('div', { class: 'tour-spot', 'aria-hidden': 'true' });
  const title = h('h2', { class: 'tour-title', id: `${id}-title` });
  const body = h('div', { class: 'tour-body' });
  const count = h('span', { class: 'tour-count' });
  const back = h('button', { class: 'btn btn-small', type: 'button' }, 'Back');
  const next = h('button', { class: 'btn btn-primary btn-small', type: 'button' }, 'Next', icon('next', { size: 16 }));
  const skip = h('button', { class: 'tour-skip', type: 'button' }, 'Skip tour');
  const card = h('div', { class: 'tour-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': `${id}-title` },
    h('div', { class: 'tour-head' }, guideFace(), h('div', { class: 'grow' }, h('span', { class: 'tour-who' }, 'Dr Neutro, your guide'), title), skip),
    body,
    h('div', { class: 'tour-foot' }, count, h('div', { class: 'row' }, back, next)));
  const layer = h('div', { class: `tour-layer${reduce ? ' reduce' : ''}` }, spot, card);
  const prevFocus = document.activeElement;
  document.body.append(layer);
  document.body.classList.add('touring');

  function targetRect(step) {
    if (!step.target) return null;
    const el = typeof step.target === 'function' ? step.target() : document.querySelector(step.target);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return r;
  }

  function place() {
    const step = steps[idx];
    const r = targetRect(step);
    const vw = window.innerWidth, vh = window.innerHeight;
    const pad = step.pad == null ? 8 : step.pad;
    if (r) {
      spot.hidden = false;
      spot.style.left = `${r.left - pad}px`;
      spot.style.top = `${r.top - pad}px`;
      spot.style.width = `${r.width + pad * 2}px`;
      spot.style.height = `${r.height + pad * 2}px`;
      spot.style.borderRadius = step.round ? '999px' : '18px';
    } else {
      spot.hidden = true;
    }
    layer.classList.toggle('dim', !r);
    const cw = Math.min(380, vw - 24);
    card.style.width = `${cw}px`;
    const ch = card.offsetHeight || 220;
    let left, top;
    if (step.at === 'bottom') {
      left = (vw - cw) / 2;
      top = Math.max(12, vh - ch - 16);
    } else if (!r) {
      left = (vw - cw) / 2;
      top = Math.max(12, (vh - ch) / 2);
    } else {
      const below = vh - r.bottom - pad, above = r.top - pad;
      left = Math.min(vw - cw - 12, Math.max(12, r.left + r.width / 2 - cw / 2));
      if (below >= ch + 20) top = r.bottom + pad + 12;
      else if (above >= ch + 20) top = r.top - pad - 12 - ch;
      else {
        top = Math.max(12, Math.min(vh - ch - 12, r.top + r.height / 2 - ch / 2));
        const right = vw - r.right - pad, leftSpace = r.left - pad;
        if (right >= cw + 20) left = r.right + pad + 12;
        else if (leftSpace >= cw + 20) left = r.left - pad - 12 - cw;
      }
    }
    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
  }

  function show() {
    const step = steps[idx];
    title.textContent = step.title;
    body.replaceChildren(...[].concat(typeof step.body === 'function' ? step.body() : step.body).filter(Boolean).map((b) => (typeof b === 'string' ? h('p', null, b) : b)));
    count.textContent = `${idx + 1} / ${steps.length}`;
    back.disabled = idx === 0;
    next.replaceChildren(idx === steps.length - 1 ? 'Done' : 'Next', idx === steps.length - 1 ? icon('check', { size: 16 }) : icon('next', { size: 16 }));
    card.classList.remove('pop');
    void card.offsetWidth;
    card.classList.add('pop');
    place();
    requestAnimationFrame(place);
    try { next.focus({ preventScroll: true }); } catch { /* ignore */ }
  }

  function close(done) {
    window.removeEventListener('resize', place);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('hashchange', onHash);
    layer.remove();
    document.body.classList.remove('touring');
    if (active === api) active = null;
    if (onDone) onDone(!!done);
    try { if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true }); } catch { /* ignore */ }
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(false); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next.click(); }
    else if (e.key === 'ArrowLeft' && idx > 0) { e.preventDefault(); back.click(); }
    else if (e.key === 'Tab') {
      const f = [...card.querySelectorAll('button:not([disabled])')];
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  }
  function onHash() { close(false); }

  next.addEventListener('click', () => {
    if (idx < steps.length - 1) { idx += 1; show(); } else close(true);
  });
  back.addEventListener('click', () => { if (idx > 0) { idx -= 1; show(); } });
  skip.addEventListener('click', () => close(false));
  window.addEventListener('resize', place);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('hashchange', onHash);
  const api = { close };
  active = api;
  show();
  return api;
}

const HOME_STEPS = [
  {
    title: 'Welcome to Body Bastion!',
    body: () => [
      'You command the defences of a human gut. Germs from contaminated food and water invade it; you hold them off with real physiology, immune cells and the right drugs.',
      h('p', { class: 'tour-note' }, 'Everything here is real pharmacology, simplified for a game.'),
    ],
  },
  {
    title: 'The battlefield is the gut',
    target: '.hud-map',
    pad: -40,
    at: 'bottom',
    body: () => [
      'Germs enter at the mouth (top left) and march along the lumen, the glowing channel through the gut:',
      gutRoute(),
      'If they reach the Bone Marrow Core, or if the patient dehydrates, the base falls.',
    ],
  },
  {
    title: 'ATP and nutrients',
    target: '[data-tour="resources"]',
    body: [
      'ATP (yellow) and nutrients (green) are your resources. Mitochondria and nutrient absorbers produce them every hour, even when you are away.',
      'You spend them on building, upgrades, research and drug shots. The bar shows how full your storage is.',
    ],
  },
  {
    title: 'Your Bone Marrow Core',
    target: '[data-tour="player"]',
    body: [
      'The number in the star is your Bone Marrow Core level: your "town hall". The castle in the gut is the Core itself.',
      'Upgrading it raises storage and unlocks more and stronger defences.',
    ],
  },
  {
    title: 'Build your defences',
    target: '[data-tour="edit"]',
    round: true,
    body: [
      'Tap Build to place defences beside the lumen: stomach acid, mucus and villi walls, Paneth cells, IgA cannons, macrophages, neutrophils, Kupffer cells, ORS stations, IV drips and prescribed drug batteries.',
      h('p', { class: 'tour-note' }, h('strong', null, 'Key lesson: '), 'most diarrhoea kills by dehydration. ORS + zinc and IV fluids keep the hydration meter up; towers alone cannot.'),
    ],
  },
  {
    title: 'Start with the clinical cases',
    target: '[data-tour="campaign"]',
    round: true,
    body: [
      'Cases are guided missions: you defend a patient against scripted waves (rotavirus, ETEC, cholera, Shigella, typhoid, amoebiasis, H. pylori, C. difficile, worms...).',
      'Case 1 teaches the first rule of stewardship: antibiotics do not kill viruses. Stars reward the correct treatment.',
    ],
  },
  {
    title: 'Attack!',
    target: '[data-tour="attack"]',
    round: true,
    body: [
      'Raid other players\' guts with an army of germs. Watch which drugs a base uses: germs resistant to them get through.',
      'Spells such as Quorum Sensing, Immune Evasion and a Biofilm Dome help your germs, and a quick knowledge question can boost them.',
    ],
  },
  {
    title: 'Research drugs and vaccines',
    target: '[data-tour="research"]',
    round: true,
    body: 'Unlock new antimicrobials and vaccines here. Vaccines protect your base, and your clan\'s vaccination rate builds herd immunity.',
  },
  {
    title: 'League, clans and the guide',
    target: '.hud-side',
    body: [
      'League: identical tournament bases, one scored attempt each: pure skill. Clan: team up with your college. Ranks and Defence log show how you are doing.',
      'The Guide has every germ, drug and the drug-bug matrix. Use it whenever you are unsure.',
    ],
  },
  {
    title: 'You are ready',
    target: '[data-tour="help"]',
    round: true,
    body: 'Tap the ? button any time to replay this tour. Good luck, doctor: start with Case 1!',
  },
];

export function startHomeTour() {
  setPref('tour.home.offered', true);
  return startTour(HOME_STEPS, { id: 'home-tour', onDone: (done) => { if (done) setPref('tour.home.done', true); } });
}

export function offerTourOnce() {
  if (pref('tour.home.offered', false) || active || document.querySelector('.tour-offer')) return;
  setPref('tour.home.offered', true);
  const start = h('button', { class: 'btn btn-primary', type: 'button' }, icon('play', { size: 18 }), 'Show me around');
  const later = h('button', { class: 'btn', type: 'button' }, 'Not now');
  const box = h('div', { class: 'tour-offer', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'tour-offer-h' },
    guideFace(),
    h('div', { class: 'grow' },
      h('h2', { id: 'tour-offer-h' }, 'New to Body Bastion?'),
      h('p', null, 'I\'m Dr Neutro. Take a one-minute tour of your gut base? You can always replay it with the ? button.'),
      h('div', { class: 'row' }, start, later)));
  const close = () => { box.classList.add('leaving'); setTimeout(() => box.remove(), 220); window.removeEventListener('hashchange', close); };
  start.addEventListener('click', () => { close(); startHomeTour(); });
  later.addEventListener('click', close);
  window.addEventListener('hashchange', close);
  document.body.append(box);
  try { start.focus({ preventScroll: true }); } catch { /* ignore */ }
}

// Short coaching tips for the first campaign case, shown once inside the battle screen.
export function startCaseOneTips(root) {
  const steps = [
    {
      title: 'Case 1: a child with watery diarrhoea',
      body: [
        'Rotavirus is a virus. Antibiotics do nothing against it, and using them only breeds resistance and harms the gut flora.',
        'Your job is to keep the patient hydrated until the immune system clears the infection.',
      ],
    },
    {
      title: 'Watch the hydration meter',
      target: () => root.querySelector('.bb-hyd'),
      body: 'This is the patient\'s hydration. Diarrhoea drains it; if it hits zero, the case is lost. ORS + zinc and IV fluids refill it.',
    },
    {
      title: 'Place defences, then start',
      target: () => root.querySelector('.bb-bottom'),
      body: 'Tap a glowing empty slot on the map to build (an ORS station near the core is a great first choice), then press Start. During the waves, read the tips that pop up on the left.',
    },
  ];
  return startTour(steps, { id: 'case1-tour', onDone: () => setPref('tour.case1.done', true) });
}
