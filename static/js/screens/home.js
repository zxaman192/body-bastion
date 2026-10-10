import { h, icon, setTitle, fmt, fmtDate, fmtDuration, busy, toast, onLeave, errorBlock, spinnerBlock, mount, navigate } from '../ui.js';
import { post } from '../api.js';
import { store, refreshState, loadGameData, setState, pref, setPref } from '../store.js';
import { mountBase, loadAudio } from './engine.js';
import { displayResources, levelUnlocked } from './logic.js';

// Resource strip used on the Edit, Attack and Research screens.
export function resourceBar(state, { live = true, onTick } = {}) {
  const atpVal = h('span', { class: 'res-val' });
  const nutVal = h('span', { class: 'res-val' });
  const prod = state.production || {};
  const cap = (state.resources && state.resources.cap) || 0;
  const bar = h('div', { class: 'resbar', role: 'group', 'aria-label': 'Resources' },
    h('div', { class: 'res atp', title: 'ATP: energy for building, upgrading, research and drug shots' },
      icon('atp'), h('div', { class: 'res-stack' }, atpVal, h('span', { class: 'res-sub' }, `ATP - +${fmt(prod.atp_per_hour)}/h`))),
    h('div', { class: 'res nut', title: 'Nutrients: for building and training germs' },
      icon('leaf'), h('div', { class: 'res-stack' }, nutVal, h('span', { class: 'res-sub' }, `nutrients - +${fmt(prod.nutrients_per_hour)}/h`))),
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

function nextCase(gd, state) {
  const camp = state.campaign || {};
  for (const lv of gd.campaign || []) {
    if (!levelUnlocked(lv, camp)) return null;
    if (!Number(camp[String(lv.id)] || 0)) return lv;
  }
  return null;
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

function hudButton(href, iconName, label, cls = '', extra = {}) {
  return h('a', { class: `hud-btn ${cls}`, href, ...extra },
    h('span', { class: 'hud-btn-ico' }, icon(iconName, { size: 26 })),
    h('span', { class: 'hud-btn-label' }, label));
}

function resMeter(kind, iconName, title) {
  const fill = h('span', { class: 'hud-res-fill' });
  const val = h('span', { class: 'hud-res-val' });
  const sub = h('span', { class: 'hud-res-sub' });
  const el = h('div', { class: `hud-res ${kind}`, title },
    h('span', { class: 'hud-res-bar' }, fill, val),
    h('span', { class: 'hud-res-ico' }, icon(iconName, { size: 22 })),
    sub);
  return { el, fill, val, sub };
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
  onLeave(root, () => document.body.classList.remove('home-hud'));
  const user = state.user || store.user || {};
  const rerender = () => { if (params.isCurrent()) navigate(location.hash); };

  const coreLv = (state.base && state.base.core_level) || 1;
  const next = nextCase(gd, state);
  const role = user.role;
  const prod = state.production || {};
  const cap = (state.resources && state.resources.cap) || 0;

  const atp = resMeter('atp', 'atp', 'ATP: energy for building, upgrading, research and drug shots');
  const nut = resMeter('nut', 'leaf', 'Nutrients: for building and training germs');
  atp.sub.textContent = `+${fmt(prod.atp_per_hour)}/h - max ${fmt(cap)}`;
  nut.sub.textContent = `+${fmt(prod.nutrients_per_hour)}/h - max ${fmt(cap)}`;
  const paint = () => {
    const r = displayResources(state.resources, state.production, (Date.now() - store.stateAt) / 1000);
    for (const [m, v] of [[atp, r.atp], [nut, r.nutrients]]) {
      m.val.textContent = fmt(v);
      m.fill.style.width = `${cap > 0 ? Math.min(100, (v / cap) * 100) : 0}%`;
    }
    atp.el.setAttribute('aria-label', `${fmt(r.atp)} ATP of ${fmt(cap)}`);
    nut.el.setAttribute('aria-label', `${fmt(r.nutrients)} nutrients of ${fmt(cap)}`);
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
  const tourBtn = h('button', { class: 'hud-round', type: 'button', 'aria-label': 'Tutorial', title: 'Tutorial', 'data-tour': 'help' }, h('span', { class: 'hud-q' }, '?'));
  tourBtn.addEventListener('click', () => startTour());

  const baseHost = h('div', { class: 'hud-map', role: 'img', 'aria-label': 'Map of your gut base. Germs enter at the mouth, pass the stomach, small intestine, colon and liver gate, and try to reach the Bone Marrow Core.' });

  const player = h('a', { class: 'hud-player', href: '#/profile', 'data-tour': 'player', title: 'Your profile' },
    h('span', { class: 'hud-lvl', title: `Bone Marrow Core level ${coreLv}` }, h('span', null, String(coreLv))),
    h('span', { class: 'hud-pinfo' },
      h('span', { class: 'hud-pname' }, user.display_name || user.username || 'Player'),
      h('span', { class: 'hud-psub' }, user.is_guest ? 'Guest player' : (user.college || 'Body Bastion'))));
  const trophies = h('div', { class: 'hud-chip merit', title: 'Merit points', 'data-tour': 'trophies' }, icon('trophy', { size: 18 }), h('strong', null, fmt(state.trophies)));
  const shieldChip = shield
    ? h('div', { class: 'hud-chip shield', title: 'Recovery: nobody can attack your base until it ends' }, icon('shield', { size: 18 }), h('strong', null, fmtDuration(shield)))
    : null;

  const side = h('nav', { class: 'hud-side', 'aria-label': 'More' },
    hudButton('#/league', 'trophy', 'League', 'c-league', { 'data-tour': 'league' }),
    hudButton('#/cohort', 'clan', 'Cohort', 'c-clan'),
    hudButton('#/leaderboards', 'bars', 'Ranks', 'c-ranks'),
    hudButton('#/log', 'shieldcheck', 'Defence log', 'c-log'),
    hudButton('#/guide', 'book', 'Guide', 'c-guide', { 'data-tour': 'guide' }),
    role === 'teacher' || role === 'admin' ? hudButton('#/classroom', 'classroom', 'Classroom', 'c-class') : null,
    role === 'admin' ? hudButton('#/admin', 'sliders', 'Admin', 'c-admin') : null,
    role === 'observer' || role === 'admin' ? hudButton('#/observer', 'eye', 'Observer', 'c-obs') : null);

  const attack = h('a', { class: 'hud-attack', href: '#/attack', 'data-tour': 'attack' },
    h('span', { class: 'hud-attack-ico' }, icon('germ', { size: 40 })),
    h('span', { class: 'hud-attack-label' }, 'Attack!'));
  const campaign = h('a', { class: 'hud-big c-campaign', href: next ? `#/campaign/${next.id}` : '#/campaign', 'data-tour': 'campaign' },
    h('span', { class: 'hud-big-ico' }, icon('campaign', { size: 30 })),
    h('span', { class: 'hud-big-label' }, 'Cases'),
    next ? h('span', { class: 'hud-badge' }, String(next.id)) : null);
  const edit = h('a', { class: 'hud-big c-edit', href: '#/edit', 'data-tour': 'edit' },
    h('span', { class: 'hud-big-ico' }, icon('build', { size: 30 })),
    h('span', { class: 'hud-big-label' }, 'Build'));
  const research = h('a', { class: 'hud-big c-research', href: '#/research', 'data-tour': 'research' },
    h('span', { class: 'hud-big-ico' }, icon('flask', { size: 30 })),
    h('span', { class: 'hud-big-label' }, 'Research'));

  const guestRibbon = user.is_guest
    ? h('a', { class: 'hud-ribbon', href: '#/register' }, icon('user', { size: 16 }), 'Guest: create an account to join cohorts and the league')
    : null;

  mount(root,
    h('h1', { class: 'sr-only' }, `Your gut base, ${user.display_name || user.username || 'player'}`),
    h('div', { class: 'hud-home' },
      baseHost,
      h('div', { class: 'hud-layer' },
        h('div', { class: 'hud-tl' }, player, h('div', { class: 'hud-chips' }, trophies, shieldChip)),
        h('div', { class: 'hud-tr', 'data-tour': 'resources' }, atp.el, nut.el,
          h('div', { class: 'hud-tools' }, tourBtn, soundBtn)),
        h('div', { class: 'hud-top-center' }, guestRibbon, dewormCard(gd, state, rerender)),
        side,
        h('div', { class: 'hud-bl' }, attack, campaign),
        h('div', { class: 'hud-br' }, research, edit))));

  const view = await mountBase(baseHost, {
    gd,
    layout: (state.base && state.base.layout) || {},
    coreLevel: coreLv,
    editable: false,
    onSiteTap: () => { location.hash = '#/edit'; },
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
  maybeOfferTour();
}

function hudInsets() {
  const w = window.innerWidth, hgt = window.innerHeight;
  if (w < 640) return { top: 96, right: 8, bottom: 120, left: 72 };
  if (hgt < 500) return { top: 64, right: 12, bottom: 70, left: 96 };
  return { top: 84, right: 24, bottom: 120, left: 110 };
}

async function startTour() {
  const { startHomeTour } = await import('../tutorial.js');
  startHomeTour();
}

async function maybeOfferTour() {
  const { offerTourOnce } = await import('../tutorial.js');
  offerTourOnce();
}
