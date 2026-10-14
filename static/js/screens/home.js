import { h, icon, setTitle, fmt, fmtDate, fmtDuration, busy, toast, onLeave, errorBlock, spinnerBlock, mount, navigate, openModal } from '../ui.js';
import { post } from '../api.js';
import { store, refreshState, loadGameData, setState, pref, setPref } from '../store.js';
import { mountBase, loadAudio } from './engine.js';
import { displayResources, missionNumber } from './logic.js';
import {
  OBJECTIVE, nextMission, featureStates, markFeaturesSeen, tutorialSkipped, resetTutorial, coachSeen, markCoachSeen, wonCount,
} from '../progress.js';

const RESOURCE_INFO = {
  atp: {
    title: 'ATP',
    what: 'ATP is the energy molecule every cell runs on. In the game it is your main currency.',
    earn: ['Mitochondria Plants on your base make it every hour, even while you are away.', 'Winning missions for the first time.', 'Raiding other players\' bases.'],
    spend: ['Building and upgrading defences on your base.', 'Upgrading the Bone Marrow Core.', 'Research: new drugs and vaccines.'],
  },
  nutrients: {
    title: 'Nutrients',
    what: 'Nutrients are what the gut absorbs from food. You need them to build and to train germs for raids.',
    earn: ['Nutrient Absorbers on your base make them every hour.', 'Winning missions for the first time.', 'Raiding other players\' bases (worms steal extra).'],
    spend: ['Building and upgrading defences.', 'Training germs for a raid.', 'Research.'],
  },
};

// Explains a resource: what it is, how it is earned and how it is spent.
export function explainResource(kind, state) {
  const info = RESOURCE_INFO[kind];
  if (!info) return;
  const prod = (state && state.production) || {};
  const cap = (state && state.resources && state.resources.cap) || 0;
  const rate = kind === 'atp' ? prod.atp_per_hour : prod.nutrients_per_hour;
  openModal({
    title: info.title,
    body: h('div', { class: 'stack' },
      h('p', { class: 'mb-0' }, info.what),
      h('div', null, h('strong', null, 'How you earn it'), h('ul', { class: 'mt-1' }, info.earn.map((t) => h('li', null, t)))),
      h('div', null, h('strong', null, 'What you spend it on'), h('ul', { class: 'mt-1' }, info.spend.map((t) => h('li', null, t)))),
      state ? h('p', { class: 'muted small mb-0' }, `You make ${fmt(rate || 0)} an hour. Storage holds up to ${fmt(cap)}; upgrading the Bone Marrow Core raises it.`) : null),
    actions: [{ label: 'Got it', kind: 'primary', value: true }],
  });
}

// Resource strip used on the Edit, Attack and Research screens.
export function resourceBar(state, { live = true, onTick } = {}) {
  const atpVal = h('span', { class: 'res-val' });
  const nutVal = h('span', { class: 'res-val' });
  const prod = state.production || {};
  const cap = (state.resources && state.resources.cap) || 0;
  const bar = h('div', { class: 'resbar', role: 'group', 'aria-label': 'Resources' },
    h('button', { class: 'res atp res-btn', type: 'button', title: 'ATP: what it is, how to earn and spend it', onclick: () => explainResource('atp', state) },
      icon('atp'), h('div', { class: 'res-stack' }, atpVal, h('span', { class: 'res-sub' }, `ATP · +${fmt(prod.atp_per_hour)}/h`))),
    h('button', { class: 'res nut res-btn', type: 'button', title: 'Nutrients: what they are, how to earn and spend them', onclick: () => explainResource('nutrients', state) },
      icon('leaf'), h('div', { class: 'res-stack' }, nutVal, h('span', { class: 'res-sub' }, `nutrients · +${fmt(prod.nutrients_per_hour)}/h`))),
    h('div', { class: 'res', title: 'Storage cap (raised by the Bone Marrow Core level)' },
      icon('castle'), h('div', { class: 'res-stack' }, h('span', { class: 'res-val' }, fmt(cap)), h('span', { class: 'res-sub' }, 'storage cap'))));
  const paint = () => {
    const r = displayResources(state.resources, state.production, (Date.now() - store.stateAt) / 1000);
    atpVal.textContent = fmt(r.atp);
    nutVal.textContent = fmt(r.nutrients);
    atpVal.setAttribute('aria-label', `${fmt(r.atp)} ATP`);
    nutVal.setAttribute('aria-label', `${fmt(r.nutrients)} nutrients`);
    if (onTick) onTick(r);
  };
  paint();
  let timer = null;
  if (live) timer = setInterval(paint, 1000);
  return { el: bar, stop: () => clearInterval(timer), paint };
}

function shieldInfo(state) {
  if (!state.shield_until) return null;
  const left = (new Date(state.shield_until).getTime() - Date.now()) / 1000;
  return left > 0 ? left : null;
}

function dewormCard(gd, state, rerender) {
  if (!state.events || !state.events.deworming_active) return null;
  const until = state.dewormed_until ? new Date(state.dewormed_until) : null;
  const active = until && until.getTime() > Date.now();
  const dw = gd.deworming || {};
  const btn = h('button', { class: 'btn btn-primary btn-small', type: 'button', disabled: !!active }, icon('pill', { size: 18 }), active ? 'Albendazole given' : 'Give albendazole');
  btn.addEventListener('click', () => busy(btn, async () => {
    try {
      const s = await post('/api/deworm', {});
      setState(s);
      toast(`Albendazole given: worms are weaker against your base for ${dw.hours || 24} hours.`, 'ok');
      rerender();
    } catch { /* toast shown */ }
  }));
  return h('div', { class: 'hud-event', role: 'region', 'aria-label': 'Deworming day' },
    h('span', { class: 'hud-event-ico' }, icon('worm', { size: 26 })),
    h('div', { class: 'grow' },
      h('strong', null, 'National Deworming Day!'),
      h('p', { class: 'small' },
        active
          ? `Dewormed until ${fmtDate(state.dewormed_until)}: attacking worms are weaker.`
          : `Give single-dose albendazole (400 mg; 200 mg at 1-2 years) for ${fmt(dw.atpCost || 0)} ATP: worms are weakened for ${dw.hours || 24} h and you earn ${fmt(dw.nutrients || 0)} nutrients.`)),
    btn);
}

function hudButton(f, cls = '') {
  return h('a', { class: `hud-btn ${cls}`, href: f.href, 'data-feature': f.key },
    h('span', { class: 'hud-btn-ico' }, icon(f.icon, { size: 26 })),
    h('span', { class: 'hud-btn-label' }, f.name),
    f.isNew ? h('span', { class: 'hud-new' }, 'NEW') : null);
}

function resMeter(kind, iconName, title, onClick) {
  const fill = h('span', { class: 'hud-res-fill' });
  const val = h('span', { class: 'hud-res-val' });
  const sub = h('span', { class: 'hud-res-sub' });
  const el = h('button', { class: `hud-res ${kind}`, type: 'button', title, onclick: onClick },
    h('span', { class: 'hud-res-bar' }, fill, val),
    h('span', { class: 'hud-res-ico' }, icon(iconName, { size: 22 })),
    sub);
  return { el, fill, val, sub };
}

function featureDrawer(gd, features) {
  const rows = Object.values(features).map((f) => h(f.open ? 'a' : 'div', {
    class: `feature-row${f.open ? '' : ' locked'}`, href: f.open ? f.href : null, 'aria-disabled': f.open ? null : 'true',
  },
  h('span', { class: 'feature-ico' }, icon(f.open ? f.icon : 'lock', { size: 22 })),
  h('span', { class: 'grow' }, h('strong', null, f.name), h('small', null, f.open ? f.text : `Opens after Mission ${f.afterNumber}. ${f.text}`))));
  const m = openModal({
    title: 'Everything in Body Bastion',
    body: h('div', { class: 'stack' },
      h('p', { class: 'muted small mb-0' }, 'New parts of the game open as you win missions, so you only learn one thing at a time.'),
      h('div', { class: 'feature-list' }, rows),
      h('p', { class: 'small mb-0' }, 'Already know the game? ', h('a', { href: '#/profile' }, 'Show everything now'), ' in your profile.')),
    actions: [{ label: 'Close', value: null }],
  });
  m.el && m.el.addEventListener && m.el.addEventListener('click', (e) => { if (e.target.closest('a')) m.close(null); });
}

function helpMenu(gd, state) {
  const replay = h('button', { class: 'btn btn-block', type: 'button' }, icon('replay'), 'Replay the tutorial');
  const tour = h('button', { class: 'btn btn-block', type: 'button' }, icon('map'), 'Quick tour of this screen');
  const m = openModal({
    title: 'Help',
    body: h('div', { class: 'stack' },
      h('p', { class: 'mb-0' }, OBJECTIVE),
      replay, tour,
      h('a', { class: 'btn btn-block', href: '#/guide' }, icon('book'), 'Open the guide: every germ, defence and drug')),
    actions: [{ label: 'Close', value: null }],
  });
  replay.addEventListener('click', () => {
    m.close(null);
    resetTutorial();
    const first = (gd.campaign || [])[0];
    navigate(first ? `#/campaign/${first.id}?go=1` : '#/campaign');
  });
  tour.addEventListener('click', () => { m.close(null); setTimeout(() => homeTour(true), 50); });
}

let homeCoach = null;
async function homeTour(force) {
  if (homeCoach && homeCoach.alive) homeCoach.close();
  const { createCoach } = await import('../coach.js');
  const q = (s) => document.querySelector(s);
  const steps = [
    { key: 'body', title: 'Your patient', text: 'This is the body you protect: every organ in its real place. Germs enter at the mouth and travel down the gut towards the Bone Marrow Core.', target: () => q('.hud-map'), pad: -60, wait: 'next', dock: 'top' },
    { key: 'goal', title: 'Your goal', text: OBJECTIVE, target: () => q('.hud-goal'), wait: 'next' },
    { key: 'next', title: 'Start here', text: 'Your next mission is always here. Each one teaches one idea and adds one new tool.', target: () => q('.hud-next'), wait: 'next' },
    { key: 'more', title: 'More opens as you play', text: 'Research, your own base, raids and the league appear as you win missions. Tap the grid to see what is coming.', target: () => q('[data-role="features"]'), wait: 'next', round: true },
    { key: 'help', title: 'Help is always here', text: 'Tap ? to replay the tutorial or open the guide.', target: () => q('[data-tour="help"]'), wait: 'next', round: true },
  ].filter((s) => force || s.key !== 'more' || q('[data-role="features"]'));
  homeCoach = createCoach({ steps, id: 'home-coach', label: 'Quick tour', onDone: () => setPref('home.tour.done', true), onSkip: () => setPref('home.tour.done', true) }).start();
  return homeCoach;
}

async function announceFeatures(newOnes) {
  if (!newOnes.length || (homeCoach && homeCoach.alive)) return;
  const { createCoach } = await import('../coach.js');
  const steps = newOnes.map((f) => ({
    key: `feat-${f.key}`, title: `New: ${f.name}`, text: f.text,
    target: () => document.querySelector(`[data-feature="${f.key}"]`), wait: 'next', round: true,
  }));
  homeCoach = createCoach({ steps, id: 'home-coach', label: 'Unlocked', onDone: () => markFeaturesSeen(newOnes.map((f) => f.key)), onSkip: () => markFeaturesSeen(newOnes.map((f) => f.key)) }).start();
}

export async function render(root, params) {
  setTitle('Home');
  root.append(spinnerBlock());
  let state;
  let gd;
  try {
    [gd, state] = await Promise.all([loadGameData(), refreshState()]);
  } catch (e) {
    mount(root, errorBlock(e, () => render(root, params)));
    return;
  }
  if (!params.isCurrent()) return;
  root.replaceChildren();
  document.body.classList.add('home-hud');
  onLeave(root, () => {
    document.body.classList.remove('home-hud');
    if (homeCoach && homeCoach.alive) homeCoach.close();
  });
  const user = state.user || store.user || {};
  const rerender = () => { if (params.isCurrent()) navigate(location.hash); };

  const stars = state.campaign || {};
  const coreLv = (state.base && state.base.core_level) || 1;
  const next = nextMission(gd, stars);
  const won = wonCount(gd, stars);
  const F = featureStates(gd, stars, user);
  const role = user.role;
  const prod = state.production || {};
  const cap = (state.resources && state.resources.cap) || 0;
  const showResources = F.build.open || F.research.open;

  const atp = resMeter('atp', 'atp', 'ATP: tap to learn how to earn and spend it', () => explainResource('atp', state));
  const nut = resMeter('nut', 'leaf', 'Nutrients: tap to learn how to earn and spend them', () => explainResource('nutrients', state));
  atp.sub.textContent = `ATP +${fmt(prod.atp_per_hour)}/h`;
  nut.sub.textContent = `nutrients +${fmt(prod.nutrients_per_hour)}/h`;
  const paint = () => {
    const r = displayResources(state.resources, state.production, (Date.now() - store.stateAt) / 1000);
    for (const [m, v] of [[atp, r.atp], [nut, r.nutrients]]) {
      m.val.textContent = fmt(v);
      m.fill.style.width = `${cap > 0 ? Math.min(100, (v / cap) * 100) : 0}%`;
    }
    atp.el.setAttribute('aria-label', `${fmt(r.atp)} ATP of ${fmt(cap)}. Tap to learn more.`);
    nut.el.setAttribute('aria-label', `${fmt(r.nutrients)} nutrients of ${fmt(cap)}. Tap to learn more.`);
  };
  paint();
  const timer = setInterval(paint, 1000);
  onLeave(root, () => clearInterval(timer));

  const shield = shieldInfo(state);
  const muted = !!pref('muted', false);
  const soundBtn = h('button', { class: 'hud-round', type: 'button', 'aria-label': muted ? 'Sound off' : 'Sound on', title: 'Sound' }, icon(muted ? 'mute' : 'sound', { size: 22 }));
  soundBtn.addEventListener('click', async () => {
    const m = !pref('muted', false);
    setPref('muted', m);
    soundBtn.replaceChildren(icon(m ? 'mute' : 'sound', { size: 22 }));
    soundBtn.setAttribute('aria-label', m ? 'Sound off' : 'Sound on');
    const audio = await loadAudio();
    if (audio) try { audio.setMuted(m); } catch { /* optional */ }
  });
  const helpBtn = h('button', { class: 'hud-round', type: 'button', 'aria-label': 'Help and tutorial', title: 'Help and tutorial', 'data-tour': 'help', onclick: () => helpMenu(gd, state) }, h('span', { class: 'hud-q' }, '?'));
  const lockedCount = Object.values(F).filter((f) => !f.open).length;
  const featuresBtn = h('button', { class: 'hud-round', type: 'button', 'aria-label': 'Everything in the game', title: 'Everything in the game', 'data-role': 'features', onclick: () => featureDrawer(gd, F) },
    icon('grid', { size: 22 }), lockedCount ? h('span', { class: 'hud-round-badge' }, String(lockedCount)) : null);

  const baseHost = h('div', { class: 'hud-map', role: 'img', 'aria-label': 'Your patient: a human body. Germs enter at the mouth, pass the stomach, small intestine, colon and liver, and try to reach the Bone Marrow Core.' });

  const player = h('a', { class: 'hud-player', href: '#/profile', 'data-tour': 'player', title: 'Your profile' },
    h('span', { class: 'hud-lvl', title: `Bone Marrow Core level ${coreLv}` }, h('span', null, String(coreLv))),
    h('span', { class: 'hud-pinfo' },
      h('span', { class: 'hud-pname' }, user.display_name || user.username || 'Player'),
      h('span', { class: 'hud-psub' }, `${won} of ${gd.campaign.length} missions won`)));
  const trophies = F.league.open || F.attack.open
    ? h('div', { class: 'hud-chip merit', title: 'Merit points: won by raiding and defending' }, icon('trophy', { size: 18 }), h('strong', null, fmt(state.trophies)))
    : null;
  const shieldChip = shield && F.attack.open
    ? h('div', { class: 'hud-chip shield', title: 'Recovery: nobody can attack your base until it ends' }, icon('shield', { size: 18 }), h('strong', null, fmtDuration(shield)))
    : null;

  const sideItems = ['league', 'clan', 'ranks', 'log'].map((k) => F[k]).filter((f) => f.open);
  const side = h('nav', { class: 'hud-side', 'aria-label': 'More' },
    ...sideItems.map((f) => hudButton(f, `c-${f.key === 'clan' ? 'clan' : f.key}`)),
    hudButton(F.guide, 'c-guide'),
    role === 'teacher' || role === 'admin' ? hudButton({ key: 'classroom', name: 'Classroom', href: '#/classroom', icon: 'classroom' }, 'c-class') : null,
    role === 'admin' ? hudButton({ key: 'admin', name: 'Admin', href: '#/admin', icon: 'sliders' }, 'c-admin') : null,
    role === 'observer' || role === 'admin' ? hudButton({ key: 'observer', name: 'Observer', href: '#/observer', icon: 'eye' }, 'c-obs') : null);

  const attack = F.attack.open ? h('a', { class: 'hud-attack', href: '#/attack', 'data-tour': 'attack', 'data-feature': 'attack' },
    h('span', { class: 'hud-attack-ico' }, icon('germ', { size: 40 })),
    h('span', { class: 'hud-attack-label' }, 'Raid!'),
    F.attack.isNew ? h('span', { class: 'hud-new' }, 'NEW') : null) : null;
  const campaign = h('a', { class: 'hud-big c-campaign', href: '#/campaign', 'data-tour': 'campaign' },
    h('span', { class: 'hud-big-ico' }, icon('campaign', { size: 30 })),
    h('span', { class: 'hud-big-label' }, 'Missions'));
  const edit = F.build.open ? h('a', { class: 'hud-big c-edit', href: '#/edit', 'data-tour': 'edit', 'data-feature': 'build' },
    h('span', { class: 'hud-big-ico' }, icon('build', { size: 30 })),
    h('span', { class: 'hud-big-label' }, 'Build'),
    F.build.isNew ? h('span', { class: 'hud-new' }, 'NEW') : null) : null;
  const research = F.research.open ? h('a', { class: 'hud-big c-research', href: '#/research', 'data-tour': 'research', 'data-feature': 'research' },
    h('span', { class: 'hud-big-ico' }, icon('flask', { size: 30 })),
    h('span', { class: 'hud-big-label' }, 'Research'),
    F.research.isNew ? h('span', { class: 'hud-new' }, 'NEW') : null) : null;

  // The one thing to do next, always in the middle of the screen.
  const nextCard = next
    ? h('a', { class: 'hud-next', href: `#/campaign/${next.id}${next.training ? '?go=1' : ''}` },
      h('span', { class: 'hud-next-kicker' }, next.training ? 'Start here' : `Next: Mission ${missionNumber(gd, next.id)}`),
      h('strong', null, next.title),
      next.mechanic ? h('small', null, `New: ${next.mechanic.name}`) : null,
      h('span', { class: 'hud-next-go' }, icon('play', { size: 18 }), next.training ? 'Play' : 'Go'))
    : h('a', { class: 'hud-next done', href: F.league.open ? '#/league' : '#/campaign' },
      h('span', { class: 'hud-next-kicker' }, 'All missions won'),
      h('strong', null, F.league.open ? 'Try the league' : 'Replay for 3 stars'),
      h('span', { class: 'hud-next-go' }, icon('next', { size: 18 }), 'Go'));

  const goal = h('div', { class: 'hud-goal', role: 'note' }, h('span', { 'aria-hidden': 'true' }, '\u{1F3AF} '), OBJECTIVE);
  const guestRibbon = user.is_guest && F.league.open
    ? h('a', { class: 'hud-ribbon', href: '#/register' }, icon('user', { size: 16 }), 'Guest: create an account to keep your progress and join cohorts')
    : null;

  mount(root,
    h('h1', { class: 'sr-only' }, `Your patient, ${user.display_name || user.username || 'player'}`),
    h('div', { class: `hud-home${showResources ? '' : ' hud-simple'}` },
      baseHost,
      h('div', { class: 'hud-layer' },
        h('div', { class: 'hud-tl' }, player, h('div', { class: 'hud-chips' }, trophies, shieldChip)),
        h('div', { class: 'hud-tr', 'data-tour': 'resources' }, showResources ? atp.el : null, showResources ? nut.el : null,
          h('div', { class: 'hud-tools' }, featuresBtn, helpBtn, soundBtn)),
        h('div', { class: 'hud-top-center' }, goal, guestRibbon, dewormCard(gd, state, rerender)),
        side,
        h('div', { class: 'hud-bl' }, attack, campaign),
        h('div', { class: 'hud-bc' }, nextCard),
        h('div', { class: 'hud-br' }, research, edit))));

  const view = await mountBase(baseHost, {
    gd,
    layout: (state.base && state.base.layout) || {},
    coreLevel: coreLv,
    editable: false,
    onSiteTap: () => { if (F.build.open) location.hash = '#/edit'; },
    highlightSites: [],
    showRanges: false,
    insets: hudInsets(),
    fillTall: false,
  }, params.isCurrent);
  if (view) {
    onLeave(root, () => view.destroy && view.destroy());
    const onResize = () => view.setInsets && view.setInsets(hudInsets());
    window.addEventListener('resize', onResize);
    onLeave(root, () => window.removeEventListener('resize', onResize));
  }
  if (!params.isCurrent()) return;
  // First visit: a short interactive tour. Later: point at anything newly unlocked.
  if (!tutorialSkipped() && !pref('home.tour.done', false) && !coachSeen('home.intro')) {
    markCoachSeen('home.intro');
    setTimeout(() => { if (params.isCurrent()) homeTour(false); }, 700);
  } else {
    const fresh = Object.values(F).filter((f) => f.isNew);
    if (fresh.length) setTimeout(() => { if (params.isCurrent()) announceFeatures(fresh); }, 700);
  }
}

function hudInsets() {
  const w = window.innerWidth, hgt = window.innerHeight;
  if (w < 640) return { top: 120, right: 8, bottom: 150, left: 72 };
  if (hgt < 500) return { top: 70, right: 12, bottom: 80, left: 96 };
  return { top: 96, right: 24, bottom: 130, left: 110 };
}
