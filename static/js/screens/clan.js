import { h, icon, setTitle, screenHeader, busy, mount, spinnerBlock, errorBlock, fmt, fmtDate, toast, confirmDialog, meter, openModal, starsEl, emptyBlock } from '../ui.js';
import { get, post } from '../api.js';
import { loadGameData, refreshState, setState, store, isGuest } from '../store.js';
import { unitName } from './logic.js';
import { armyBuilder, boostToggle, startBattle } from './battleflow.js';

export async function render(root, params) {
  setTitle('Cohort');
  root.append(spinnerBlock());
  let gd;
  try {
    [gd] = await Promise.all([loadGameData(), refreshState()]);
  } catch (e) {
    mount(root, errorBlock(e, () => location.reload()));
    return;
  }
  if (!params.isCurrent()) return;
  root.replaceChildren(screenHeader('Cohort', { subtitle: 'One cohort per college. Vaccinate together for herd immunity, then fight Cohort Challenges.', back: '#/home' }));
  if (isGuest()) {
    root.append(h('div', { class: 'callout callout-warn' }, icon('user'), h('p', { class: 'mb-0' }, 'Guests cannot join cohorts. Register an account from your profile to play Cohort Challenges.')));
    return;
  }
  const clan = store.state.clan;
  if (!clan) {
    await renderNoClan(root, gd, params);
    return;
  }
  await renderClan(root, gd, clan, params);
}

async function renderNoClan(root, gd, params) {
  let list;
  try {
    list = await get('/api/clans');
  } catch (e) {
    root.append(errorBlock(e));
    return;
  }
  if (!params.isCurrent()) return;
  const name = h('input', { class: 'input', placeholder: 'e.g. MAMC Mucosal Guardians', maxlength: '40', 'aria-label': 'Cohort name' });
  const college = h('input', { class: 'input', placeholder: 'College', value: (store.user && store.user.college) || '', maxlength: '120', 'aria-label': 'College' });
  const create = h('button', { class: 'btn btn-primary', type: 'button' }, icon('plus', { size: 18 }), 'Create cohort');
  create.addEventListener('click', () => busy(create, async () => {
    try {
      const r = await post('/api/clans', { name: name.value, college: college.value });
      if (r.state) setState(r.state);
      toast(`Cohort "${r.name}" created.`, 'ok');
      window.dispatchEvent(new Event('bb:rerender'));
    } catch { /* toast shown */ }
  }));
  root.append(h('div', { class: 'card' }, h('h2', { class: 'mt-0' }, 'Start a cohort'),
    h('div', { class: 'form' }, name, college, create)));
  const rows = h('ul', { class: 'list mt-2' });
  for (const c of list.rows) {
    const full = c.members >= list.max_members;
    const join = h('button', { class: 'btn', type: 'button', disabled: full }, full ? 'Full' : 'Join');
    join.addEventListener('click', () => busy(join, async () => {
      try {
        setState(await post(`/api/clans/${c.id}/join`, {}));
        toast(`You joined ${c.name}.`, 'ok');
        window.dispatchEvent(new Event('bb:rerender'));
      } catch { /* toast shown */ }
    }));
    rows.append(h('li', { class: 'list-item' }, icon('clan'), h('div', { class: 'grow' }, h('strong', null, c.name), h('small', { class: 'muted' }, `${c.college || 'No college'} • ${c.members}/${list.max_members} members`)), join));
  }
  root.append(h('section', { class: 'section' }, h('h2', null, 'Join a cohort'), list.rows.length ? rows : emptyBlock('No cohorts yet. Start the first one for your college!')));
}

async function renderClan(root, gd, clan, params) {
  let detail;
  let war;
  try {
    [detail, war] = await Promise.all([get(`/api/clans/${clan.id}`), get('/api/clanwar')]);
  } catch (e) {
    root.append(errorBlock(e));
    return;
  }
  if (!params.isCurrent()) return;
  const leave = h('button', { class: 'btn btn-ghost', type: 'button' }, icon('logout', { size: 18 }), 'Leave cohort');
  leave.addEventListener('click', () => busy(leave, async () => {
    if (!(await confirmDialog(`Leave ${detail.clan.name}?`, { title: 'Leave cohort', okLabel: 'Leave', danger: true }))) return;
    try {
      setState(await post('/api/clans/leave', {}));
      window.dispatchEvent(new Event('bb:rerender'));
    } catch { /* toast shown */ }
  }));
  root.append(h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('div', null, h('h2', { class: 'mt-0 mb-0' }, detail.clan.name), h('p', { class: 'muted small mb-0' }, `${detail.clan.college || ''} • ${detail.clan.members} members`)), leave)));

  const herd = h('section', { class: 'section' }, h('h2', null, icon('syringe'), ' Vaccination and herd immunity'),
    h('p', { class: 'muted small' }, `When at least ${gd.herd.coverageFullPct}% of the cohort is vaccinated, every cohort base - even unvaccinated ones - gets indirect protection (up to ${gd.herd.indirectSharePct}% of the vaccine's effect). Research vaccines in the Vaccine Lab.`));
  for (const [germ, eff] of Object.entries(detail.vaccine_efficacy || {})) {
    const cov = (detail.coverage || {})[germ] || 0;
    const ind = (detail.herd || {})[germ] || 0;
    herd.append(h('div', { class: 'card flat mt-1' },
      meter(cov, { label: `${unitName(gd, germ)} vaccine coverage`, kind: cov >= gd.herd.coverageFullPct ? 'ok' : '' }),
      h('p', { class: 'small muted mb-0 mt-1' }, `Direct protection ${eff}% • herd protection for every member ${ind}%`)));
  }
  root.append(herd);

  const members = h('table', { class: 'table' }, h('thead', null, h('tr', null, h('th', null, 'Member'), h('th', { class: 'num' }, 'Core'), h('th', { class: 'num' }, 'Merit points'), h('th', null, 'Vaccines'))),
    h('tbody', null, detail.members.map((m) => h('tr', { class: store.user && m.id === store.user.id ? 'me' : '' },
      h('td', null, m.name), h('td', { class: 'num' }, m.core_level), h('td', { class: 'num' }, fmt(m.trophies)),
      h('td', null, m.vaccines.map((g) => unitName(gd, g).split(' ')[0]).join(', ') || '-')))));
  root.append(h('section', { class: 'section' }, h('h2', null, icon('clan'), ' Members'), h('div', { class: 'table-wrap' }, members)));

  const ws = h('section', { class: 'section' }, h('h2', null, icon('flag'), ' Cohort Challenge'));
  if (!war.war) {
    ws.append(emptyBlock('No challenge right now. Organisers pair cohorts for Cohort Challenges.'));
  } else {
    const w = war.war;
    ws.append(h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('strong', null, `${w.clan_mine} vs ${w.clan_theirs}`), h('span', { class: 'muted small' }, `Ends ${fmtDate(w.ends_at)}`)),
      h('div', { class: 'result-stats' },
        h('div', { class: 'stat' }, h('div', { class: 'v' }, String(war.stars.mine)), h('div', { class: 'k' }, 'Our stars')),
        h('div', { class: 'stat' }, h('div', { class: 'v' }, String(war.stars.theirs)), h('div', { class: 'k' }, 'Their stars')),
        h('div', { class: 'stat' }, h('div', { class: 'v' }, String(war.attacks_left)), h('div', { class: 'k' }, 'Your attacks left'))),
      !war.in_war ? h('p', { class: 'muted small' }, 'You joined after the war started, so you are not in this war.') : null));
    const list = h('ul', { class: 'list mt-1' });
    for (const e of war.enemies) {
      const btn = h('button', { class: 'btn btn-primary', type: 'button', disabled: !war.attacks_left }, icon('germ', { size: 18 }), 'Attack');
      btn.addEventListener('click', () => warAttack(root, gd, w, e));
      list.append(h('li', { class: 'list-item' }, h('div', { class: 'grow' }, h('strong', null, e.name), h('small', { class: 'muted' }, `Core ${e.core_level} • best so far ${e.best_pct}%`)), starsEl(e.best_stars, 3), btn));
    }
    ws.append(list);
  }
  root.append(ws);
}

function warAttack(root, gd, war, enemy) {
  const army = armyBuilder(gd, store.state);
  const boost = boostToggle(gd, false);
  const m = openModal({
    title: `Attack ${enemy.name}`,
    body: h('div', null, h('p', { class: 'muted small' }, 'Cohort Challenge attacks use your own army and cost no nutrients. Your best stars on each enemy base count for the cohort.'), army.el, boost.el),
    actions: [{ label: 'Cancel', value: false }, { label: 'Attack!', kind: 'primary', icon: 'germ', value: true }],
  });
  m.result.then(async (ok) => {
    if (!ok) return;
    if (army.empty) { toast('Choose some germs first.', 'warn'); return; }
    await startBattle(root, {
      mode: 'clanwar', target: { war_id: war.id, user_id: enemy.user_id }, army: army.army, boost: boost.value,
      title: `Cohort Challenge: ${enemy.name}`, back: '#/cohort', again: '#/cohort',
    });
  });
}
