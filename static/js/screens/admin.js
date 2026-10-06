import { h, icon, setTitle, screenHeader, tabs, busy, toast, confirmDialog, emptyBlock, fmtDate, chip } from '../ui.js';
import { get, post, del, download } from '../api.js';
import { phaseText } from './logic.js';

export function render(root, params) {
  setTitle('Admin');
  root.append(screenHeader('Organiser console', { subtitle: 'Approve players, run the league and Clan Wars, export results, and delete data after the event.', back: '#/home' }));
  const host = h('div');
  root.append(host);
  tabs(host, [
    { id: 'users', label: 'Players', icon: 'user', render: users },
    { id: 'settings', label: 'League', icon: 'sliders', render: settings },
    { id: 'wars', label: 'Clan Wars', icon: 'flag', render: wars },
    { id: 'awards', label: 'Awards', icon: 'trophy', render: awards },
    { id: 'data', label: 'Data', icon: 'download', render: data },
  ], { active: params.tab, onChange: (id) => history.replaceState(null, '', `#/admin/${id}`), label: 'Admin sections' });
}

async function users(panel, alive) {
  const filter = h('select', { class: 'input', 'aria-label': 'Filter' }, h('option', { value: 'pending' }, 'Pending approval'), h('option', { value: '' }, 'All registered'), h('option', { value: 'rejected' }, 'Rejected'));
  const list = h('div');
  panel.append(h('div', { class: 'row' }, filter), list);
  async function load() {
    list.replaceChildren();
    const d = await get(`/api/admin/users${filter.value ? `?status=${filter.value}` : ''}`);
    if (!alive()) return;
    if (!d.rows.length) { list.append(emptyBlock(filter.value === 'pending' ? 'No one is waiting for approval.' : 'No players.')); return; }
    const ul = h('ul', { class: 'list mt-1' });
    for (const u of d.rows) {
      const act = (body, msg) => async () => {
        try { await post(`/api/admin/users/${u.id}`, body); toast(msg, 'ok'); load(); } catch { /* toast */ }
      };
      const approve = h('button', { class: 'btn btn-small btn-ok', type: 'button' }, 'Approve');
      approve.addEventListener('click', () => busy(approve, act({ action: 'approve' }, `${u.display_name} approved`)));
      const reject = h('button', { class: 'btn btn-small', type: 'button' }, 'Reject');
      reject.addEventListener('click', () => busy(reject, act({ action: 'reject' }, `${u.display_name} rejected`)));
      const role = h('select', { class: 'input input-small', 'aria-label': 'Role' }, ['player', 'teacher', 'observer', 'admin'].map((r) => h('option', { value: r, selected: u.role === r ? true : null }, r)));
      role.addEventListener('change', () => act({ action: 'role', role: role.value }, `Role set to ${role.value}`)());
      const rm = h('button', { class: 'btn btn-small btn-ghost', type: 'button', 'aria-label': 'Delete player' }, icon('trash', { size: 16 }));
      rm.addEventListener('click', () => busy(rm, async () => {
        if (!(await confirmDialog(`Delete ${u.display_name} (${u.username}) and all their data?`, { danger: true, okLabel: 'Delete' }))) return;
        try { await del(`/api/admin/users/${u.id}`); toast('Deleted', 'ok'); load(); } catch { /* toast */ }
      }));
      ul.append(h('li', { class: 'list-item' },
        h('div', { class: 'grow' },
          h('strong', null, `${u.display_name} `, h('span', { class: 'muted' }, `(${u.username})`)),
          h('small', { class: 'muted' }, `${u.college} • ${u.course || ''} • ${u.email || 'no email'} • registered ${fmtDate(u.created_at)}`),
          !u.is_adult ? h('div', { class: 'callout callout-warn mt-1' }, icon('child', { size: 16 }), h('span', null, `Under 18: check consent from guardian ${u.guardian_name} <${u.guardian_email}> before approving.`)) : null,
          h('div', null, chip(u.status), chip(`consent ${u.consent_version || '-'}`))),
        h('div', { class: 'stack' }, u.status !== 'approved' ? approve : null, u.status === 'pending' ? reject : null, role, rm)));
    }
    list.append(ul);
  }
  filter.addEventListener('change', load);
  await load();
}

async function settings(panel, alive) {
  const s = await get('/api/admin/settings');
  if (!alive()) return;
  const phase = h('select', { class: 'input', 'aria-label': 'League phase' }, ['closed', 'practice', 'league', 'finished'].map((p) => h('option', { value: p, selected: s.league_phase === p ? true : null }, p)));
  const help = h('p', { class: 'muted small' }, phaseText(s.league_phase));
  phase.addEventListener('change', () => { help.textContent = phaseText(phase.value); });
  const auto = h('input', { type: 'checkbox', role: 'switch' });
  auto.checked = !!s.auto_approve;
  const worm = h('input', { type: 'checkbox', role: 'switch' });
  worm.checked = !!s.deworming_active;
  const size = h('input', { class: 'input', type: 'number', min: '2', max: '50', value: String(s.clan_max_members || 10) });
  const save = h('button', { class: 'btn btn-primary', type: 'button' }, 'Save settings');
  save.addEventListener('click', () => busy(save, async () => {
    try {
      await post('/api/admin/settings', { league_phase: phase.value, auto_approve: auto.checked, deworming_active: worm.checked, clan_max_members: Number(size.value) });
      toast('Settings saved', 'ok');
    } catch { /* toast */ }
  }));
  panel.append(h('div', { class: 'card form' },
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'League phase'), phase, help),
    h('label', { class: 'switch' }, auto, h('span', { class: 'track', 'aria-hidden': 'true' }), h('span', null, 'Approve adult registrations automatically (under-18s always need manual approval)')),
    h('label', { class: 'switch' }, worm, h('span', { class: 'track', 'aria-hidden': 'true' }), h('span', null, 'Deworming Day is running (players can give albendazole for a nutrient bonus)')),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Maximum clan size'), size),
    save));
}

async function wars(panel, alive) {
  const [clans, list] = await Promise.all([get('/api/clans'), get('/api/admin/clanwars')]);
  if (!alive()) return;
  const opts = () => clans.rows.map((c) => h('option', { value: String(c.id) }, `${c.name} (${c.members})`));
  const a = h('select', { class: 'input', 'aria-label': 'First clan' }, opts());
  const b = h('select', { class: 'input', 'aria-label': 'Second clan' }, opts());
  if (b.options.length > 1) b.selectedIndex = 1;
  const hours = h('input', { class: 'input', type: 'number', min: '1', max: '336', value: '48', 'aria-label': 'Hours' });
  const apm = h('input', { class: 'input', type: 'number', min: '1', max: '10', value: '2', 'aria-label': 'Attacks per member' });
  const create = h('button', { class: 'btn btn-primary', type: 'button', disabled: clans.rows.length < 2 }, icon('flag', { size: 18 }), 'Start war');
  create.addEventListener('click', () => busy(create, async () => {
    try {
      const w = await post('/api/admin/clanwar', { clan_a: Number(a.value), clan_b: Number(b.value), hours: Number(hours.value), attacks_per_member: Number(apm.value) });
      toast(`War ${w.id} started: ${w.members.a} vs ${w.members.b} bases snapshotted.`, 'ok');
      panel.replaceChildren();
      wars(panel, alive);
    } catch { /* toast */ }
  }));
  panel.append(h('div', { class: 'card form' }, h('h3', { class: 'mt-0' }, 'Pair two clans'),
    h('p', { class: 'muted small' }, "Each member's base and vaccination (herd immunity) are snapshotted now; members attack the enemy snapshots with their own armies."),
    a, b, h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Duration (hours)'), hours),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Attacks per member'), apm), create));
  const ul = h('ul', { class: 'list mt-2' });
  for (const w of list.rows) {
    const end = h('button', { class: 'btn btn-small', type: 'button', disabled: w.status !== 'active' }, 'End now');
    end.addEventListener('click', () => busy(end, async () => {
      try { await post(`/api/admin/clanwar/${w.id}/end`, {}); panel.replaceChildren(); wars(panel, alive); } catch { /* toast */ }
    }));
    ul.append(h('li', { class: 'list-item' }, h('div', { class: 'grow' }, h('strong', null, `${w.clan_a} ${w.stars_a} ★ vs ${w.stars_b} ★ ${w.clan_b}`),
      h('small', { class: 'muted' }, `${w.status} • ends ${fmtDate(w.ends_at)}${w.winner ? ` • winner: ${w.winner === 'a' ? w.clan_a : w.clan_b}` : ''}`)), end));
  }
  panel.append(list.rows.length ? ul : emptyBlock('No wars yet.'));
}

async function awards(panel, alive) {
  const a = await get('/api/admin/awards');
  if (!alive()) return;
  const card = (title, w, unit) => h('div', { class: 'card center' }, h('h3', { class: 'mt-0' }, title),
    w ? h('div', null, h('p', { class: 'mb-0' }, h('strong', null, w.name)), h('p', { class: 'muted small' }, `${w.college || ''} • ${unit}: ${w.value}`)) : h('p', { class: 'muted' }, 'Not decided yet'));
  panel.append(h('div', { class: 'grid-cards' },
    card('Champion', a.champion, 'league total'),
    card('Best Clan', a.best_clan, 'war stars'),
    card('Best Steward', a.best_steward, 'trial total'),
    card('Best Defender', a.best_defender, 'stars conceded per defence')));
}

function data(panel) {
  const btn = (kind, label) => {
    const b = h('button', { class: 'btn', type: 'button' }, icon('download', { size: 18 }), label);
    b.addEventListener('click', () => busy(b, () => download(`/api/admin/export/${kind}.csv`, `${kind}.csv`)));
    return b;
  };
  const purge = h('button', { class: 'btn btn-danger', type: 'button' }, icon('trash', { size: 18 }), 'Delete all player data');
  purge.addEventListener('click', () => busy(purge, async () => {
    const phrase = 'DELETE ALL PLAYER DATA';
    const ok = await confirmDialog(`This permanently deletes every player account, base, battle, clan and classroom session (admins are kept). Export the results first. Type "${phrase}" to confirm.`,
      { title: 'Delete all player data', okLabel: 'Delete everything', danger: true, typed: phrase });
    if (!ok) return;
    try {
      const r = await post('/api/admin/purge', { confirm: phrase });
      toast(`Deleted: ${Object.entries(r.deleted).map(([k, v]) => `${v} ${k}`).join(', ')}`, 'ok', 8000);
    } catch { /* toast */ }
  }));
  panel.append(h('div', { class: 'card' }, h('h3', { class: 'mt-0' }, 'Exports (CSV)'),
    h('div', { class: 'btn-group' }, btn('league', 'League results'), btn('trials', 'Defence Trials'), btn('clanwars', 'Clan Wars'), btn('battles', 'All battles'), btn('users', 'Registrations'))),
  h('div', { class: 'card mt-2' }, h('h3', { class: 'mt-0' }, 'After the event (DPDP Act)'),
    h('p', { class: 'muted small' }, 'Personal data is kept only until the competition and its results are finished. Then delete it.'), purge));
}
