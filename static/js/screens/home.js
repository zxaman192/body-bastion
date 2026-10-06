import { h, icon, setTitle, fmt, fmtDate, fmtDuration, busy, toast, onLeave, errorBlock, spinnerBlock, mount, navigate } from '../ui.js';
import { post } from '../api.js';
import { store, refreshState, loadGameData, setState } from '../store.js';
import { mountBase } from './engine.js';
import { displayResources, levelUnlocked } from './logic.js';

const TILE_COLORS = {
  edit: '#c2185b', attack: '#d84315', campaign: '#6a1b9a', league: '#1565c0', clan: '#00796b', research: '#5d4037',
  guide: '#2e7d32', log: '#455a64', leaderboards: '#ad6800', classroom: '#283593', admin: '#4e342e', observer: '#37474f', profile: '#7b1fa2',
};

function tile(key, href, iconName, label, sub, big) {
  return h('a', { class: `tile${big ? ' big' : ''}`, href, style: { '--tile-c': TILE_COLORS[key] } },
    h('span', { class: 'tile-icon', style: { background: TILE_COLORS[key] } }, icon(iconName, { size: 26 })),
    h('span', { class: 'tile-label' }, label),
    sub ? h('span', { class: 'tile-sub' }, sub) : null);
}

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

function dewormBanner(gd, state, rerender) {
  if (!state.events || !state.events.deworming_active) return null;
  const until = state.dewormed_until ? new Date(state.dewormed_until) : null;
  const active = until && until.getTime() > Date.now();
  const dw = gd.deworming || {};
  const btn = h('button', { class: 'btn btn-primary', type: 'button', disabled: !!active }, icon('pill'), active ? 'Albendazole given' : 'Give albendazole');
  btn.addEventListener('click', () => busy(btn, async () => {
    try {
      const s = await post('/api/deworm', {});
      setState(s);
      toast(`Albendazole given: worms are weaker against your base for ${dw.hours || 24} hours.`, 'ok');
      rerender();
    } catch { /* toast shown */ }
  }));
  return h('div', { class: 'banner', role: 'region', 'aria-label': 'Deworming day' },
    h('span', { class: 'tile-icon', style: { background: '#8B5A2B', width: '52px', height: '52px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' } }, icon('worm', { size: 30 })),
    h('div', { class: 'grow' },
      h('p', null, h('strong', null, 'National Deworming Day is on!')),
      h('p', { class: 'small' },
        active
          ? `Your base is dewormed until ${fmtDate(state.dewormed_until)}. Attacking worms have less health.`
          : `Give the single-dose albendazole (400 mg; 200 mg for children aged 1-2) on time, as India does for everyone aged 1-19 on 10 February and 10 August. Costs ${fmt(dw.atpCost || 0)} ATP; worms attacking your base are weakened for ${dw.hours || 24} hours and you earn a ${fmt(dw.nutrients || 0)}-nutrient bonus.`)),
    btn);
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
  const user = state.user || store.user || {};
  const rerender = () => { if (params.isCurrent()) navigate(location.hash); };

  const res = resourceBar(state);
  onLeave(root, res.stop);
  const shield = shieldInfo(state);
  const trophies = h('div', { class: 'res tro', title: 'Trophies' }, icon('trophy'),
    h('div', { class: 'res-stack' }, h('span', { class: 'res-val' }, fmt(state.trophies)), h('span', { class: 'res-sub' }, 'trophies')));
  const shieldEl = shield
    ? h('div', { class: 'res shield', title: 'Shield: nobody can attack you until it ends' }, icon('shield'),
      h('div', { class: 'res-stack' }, h('span', { class: 'res-val' }, fmtDuration(shield)), h('span', { class: 'res-sub' }, 'shield left')))
    : null;
  res.el.append(trophies);
  if (shieldEl) res.el.append(shieldEl);

  const coreLv = (state.base && state.base.core_level) || 1;
  const next = nextCase(gd, state);
  const role = user.role;
  const tiles = h('nav', { class: 'tiles', 'aria-label': 'Game menu' },
    tile('edit', '#/edit', 'build', 'Edit base', `Bone Marrow Core level ${coreLv}`),
    tile('attack', '#/attack', 'germ', 'Attack', `Army space ${state.army_space || 0}`),
    tile('campaign', next ? `#/campaign/${next.id}` : '#/campaign', 'campaign', 'Campaign', next ? `Next: case ${next.id}, ${next.title}` : 'Clinical cases'),
    tile('league', '#/league', 'trophy', 'League', state.league && state.league.phase ? `Phase: ${state.league.phase}` : 'Tournament'),
    tile('clan', '#/clan', 'clan', 'Clan', state.clan && state.clan.name ? state.clan.name : 'Team up, herd immunity'),
    tile('research', '#/research', 'flask', 'Research', 'Drugs and vaccines'),
    tile('guide', '#/guide', 'book', 'Guide', 'Germs, drugs, the matrix'),
    tile('log', '#/log', 'shieldcheck', 'Defence log', 'Who attacked you'),
    tile('leaderboards', '#/leaderboards', 'bars', 'Leaderboards', null),
    role === 'teacher' || role === 'admin' ? tile('classroom', '#/classroom', 'classroom', 'Classroom', 'Run a class game') : null,
    role === 'admin' ? tile('admin', '#/admin', 'sliders', 'Admin', 'Approvals, settings') : null,
    role === 'observer' || role === 'admin' ? tile('observer', '#/observer', 'eye', 'Observer', 'Review flagged battles') : null,
    tile('profile', '#/profile', 'user', 'Profile', user.is_guest ? 'Guest account' : user.display_name || user.username));

  const baseHost = h('div', { class: 'baseview-host', role: 'img', 'aria-label': 'Map of your gut base' });
  const guestNote = user.is_guest
    ? h('div', { class: 'callout callout-warn' }, icon('info'),
      h('p', null, 'You are playing as a guest. ', h('a', { href: '#/register' }, 'Create an account'), ' to keep your progress, join a clan and play in the league.'))
    : null;

  mount(root,
    h('div', { class: 'screen-head' },
      h('div', { class: 'screen-head-text' },
        h('h1', null, `Welcome, ${user.display_name || user.username || 'player'}!`),
        h('p', { class: 'muted' }, user.college || 'Defend the gut. Learn the drugs.'))),
    res.el,
    guestNote ? h('div', { class: 'mt-2' }, guestNote) : null,
    (() => { const b = dewormBanner(gd, state, rerender); return b ? h('div', { class: 'mt-2' }, b) : null; })(),
    h('section', { class: 'section', 'aria-labelledby': 'home-base-h' },
      h('div', { class: 'card-head' },
        h('h2', { id: 'home-base-h' }, icon('castle'), 'Your gut base'),
        h('a', { class: 'btn btn-small', href: '#/edit' }, icon('build', { size: 18 }), 'Edit')),
      baseHost),
    h('section', { class: 'section', 'aria-label': 'Menu' }, tiles),
    h('p', { class: 'footer-note' }, 'Body Bastion - Maulana Azad Medical College, New Delhi. Simplified for the game; not clinical advice.'));

  const view = await mountBase(baseHost, {
    gd,
    layout: (state.base && state.base.layout) || {},
    coreLevel: coreLv,
    editable: false,
    onSiteTap: () => { location.hash = '#/edit'; },
    highlightSites: [],
    showRanges: false,
  }, params.isCurrent);
  if (view) onLeave(root, () => view.destroy && view.destroy());
}

