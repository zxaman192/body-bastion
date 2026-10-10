import { h, icon, setTitle, screenHeader, tabs, fmt, fmtDate, emptyBlock, starsEl, navigate, chip } from '../ui.js';
import { get } from '../api.js';

const MODE_LABEL = {
  multiplayer: 'Multiplayer', practice: 'Practice', tournament: 'League', trial: 'Defence Trial', campaign: 'Campaign',
  clanwar: 'Cohort Challenge', classroom: 'Classroom',
};

export function render(root, params) {
  setTitle('Battle log');
  root.append(screenHeader('Battle log', { subtitle: 'Every battle is stored as commands, so you can replay it exactly as the server checked it.', back: '#/home' }));
  const host = h('div');
  root.append(host);
  tabs(host, [
    { id: 'defences', label: 'Defences', icon: 'shield', render: (p, alive) => list(p, alive, 'defences') },
    { id: 'attacks', label: 'My battles', icon: 'germ', render: (p, alive) => list(p, alive, 'attacks') },
  ], { active: params.kind === 'attacks' ? 'attacks' : 'defences', onChange: (id) => history.replaceState(null, '', `#/log/${id}`), label: 'Battle log' });
}

async function list(panel, alive, kind) {
  const data = await get(`/api/battles?kind=${kind}`);
  if (!alive()) return;
  if (!data.rows.length) {
    panel.append(emptyBlock(kind === 'defences' ? 'Nobody has attacked your base yet.' : 'You have not finished a battle yet.'));
    return;
  }
  if (kind === 'defences') {
    panel.append(h('p', { class: 'muted small' }, 'Your base defends itself while you are away. Watch the replays to see which drugs were wasted and which germs got through, then improve your prescriptions.'));
  }
  const ul = h('ul', { class: 'list' });
  for (const r of data.rows) {
    const flags = (r.flags || []).filter((f) => f !== 'too_fast' || kind === 'attacks');
    ul.append(h('li', { class: 'list-item' },
      h('div', { class: 'grow' },
        h('strong', null, kind === 'defences' ? `Attacked by ${r.opponent}` : r.opponent || MODE_LABEL[r.mode] || r.mode),
        h('small', { class: 'muted' }, `${MODE_LABEL[r.mode] || r.mode} • ${fmtDate(r.created_at)} • ${r.pct}% destroyed • score ${fmt(r.score || 0)}`),
        flags.length ? h('div', null, flags.map((f) => chip(f))) : null),
      r.mode === 'campaign' || r.mode === 'trial' ? null : starsEl(r.stars || 0, 3),
      h('button', { class: 'btn btn-small', type: 'button', onclick: () => navigate(`#/replay/${r.id}`) }, icon('replay', { size: 16 }), 'Replay')));
  }
  panel.append(ul);
}
