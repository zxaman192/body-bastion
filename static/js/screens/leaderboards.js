import { h, icon, setTitle, screenHeader, tabs, fmt, emptyBlock } from '../ui.js';
import { get } from '../api.js';
import { store } from '../store.js';

const BOARDS = [
  { id: 'trophies', label: 'Trophies', icon: 'trophy', value: 'Trophies', note: 'Multiplayer trophies: win stars to climb, lose them when your base is broken.' },
  { id: 'league', label: 'League', icon: 'star', value: 'League total', note: 'Sum of your best score on every tournament base plus your Defence Trial scores. Decides the Champion.' },
  { id: 'clans', label: 'Clans', icon: 'clan', value: 'War stars', note: 'Clan War stars. Ties are broken by the league totals of the top five members. Decides the Best Clan.' },
  { id: 'steward', label: 'Steward', icon: 'leaf', value: 'Trial total', note: 'Only players who survived all three Defence Trials. Fewer antibiotic shots break ties. Decides Best Steward.' },
  { id: 'defender', label: 'Defender', icon: 'shield', value: 'Stars conceded per defence', note: 'Lowest stars conceded per defence, minimum 3 defences. Decides Best Defender.' },
];

export function render(root, params) {
  setTitle('Leaderboards');
  root.append(screenHeader('Leaderboards', { subtitle: 'Only handles and colleges are shown publicly.', back: '#/home' }));
  const host = h('div');
  root.append(host);
  const me = store.user ? store.user.display_name : null;
  tabs(host, BOARDS.map((b) => ({
    id: b.id, label: b.label, icon: b.icon,
    render: async (panel, alive) => {
      panel.append(h('p', { class: 'muted small' }, b.note));
      const data = await get(`/api/leaderboard/${b.id}`);
      if (!alive()) return;
      if (!data.rows.length) {
        panel.append(emptyBlock('Nobody here yet.'));
        return;
      }
      panel.append(h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
        h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, b.id === 'clans' ? 'Clan' : 'Player'), h('th', null, 'College'), h('th', { class: 'num' }, b.value))),
        h('tbody', null, data.rows.map((r) => h('tr', { class: r.name === me ? 'me' : '' },
          h('td', null, h('span', { class: `rank-pill${r.rank === 1 ? ' top1' : ''}` }, String(r.rank))),
          h('td', null, r.name), h('td', null, r.college || ''),
          h('td', { class: 'num' }, typeof r.value === 'number' && !Number.isInteger(r.value) ? r.value.toFixed(2) : fmt(r.value))))))));
    },
  })), { active: params.kind, onChange: (id) => history.replaceState(null, '', `#/leaderboards/${id}`), label: 'Leaderboards' });
  root.append(h('p', { class: 'mt-2' }, h('a', { class: 'btn btn-ghost', href: '#/live' }, icon('fullscreen', { size: 18 }), 'Projector view')));
}
