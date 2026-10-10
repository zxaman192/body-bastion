import { h, setTitle, onLeave, fmt, fmtDate } from '../ui.js';
import { get } from '../api.js';
import { phaseText } from './logic.js';

const MODE = { multiplayer: 'Attack', tournament: 'League', trial: 'Trial', clanwar: 'Cohort Challenge' };

export async function render(root, params) {
  setTitle('Live');
  const head = h('div', { class: 'proj-head' });
  const body = h('div', { class: 'proj-grid' });
  root.append(head, body);

  function table(title, rows, valueLabel) {
    return h('div', { class: 'proj-panel' }, h('h2', null, title),
      rows.length ? h('table', { class: 'proj-table' },
        h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, 'Name'), h('th', null, 'College'), h('th', null, valueLabel))),
        h('tbody', null, rows.map((r) => h('tr', { class: r.rank === 1 ? 'top1' : '' },
          h('td', null, String(r.rank)), h('td', null, r.name), h('td', null, r.college || ''), h('td', null, fmt(r.value)))))) : h('p', null, 'No scores yet.'));
  }

  async function tick() {
    let d;
    try {
      d = await get('/api/projector', { silent: true });
    } catch {
      return;
    }
    if (!params.isCurrent()) return;
    head.replaceChildren(h('div', null, h('h1', null, 'Body Bastion - Live'), h('p', null, phaseText(d.phase))));
    const panels = [table('League top 10', d.league_top, 'Score'), table('Cohorts', d.clans_top, 'Challenge stars')];
    if (d.war) {
      panels.push(h('div', { class: 'proj-panel center' }, h('h2', null, 'Cohort Challenge'),
        h('p', { class: 'proj-war' }, h('strong', null, d.war.clan_a), ` ${d.war.stars_a} ★  vs  ${d.war.stars_b} ★ `, h('strong', null, d.war.clan_b)),
        h('p', null, `Ends ${fmtDate(d.war.ends_at)}`)));
    }
    panels.push(h('div', { class: 'proj-panel' }, h('h2', null, 'Latest battles'),
      d.recent.length ? h('table', { class: 'proj-table' }, h('tbody', null, d.recent.map((r) => h('tr', null,
        h('td', null, MODE[r.mode] || r.mode), h('td', null, `${r.attacker} vs ${r.defender}`), h('td', null, '★'.repeat(r.stars || 0) || '-'), h('td', null, `${r.pct}%`))))) : h('p', null, 'No battles yet.')));
    body.replaceChildren(...panels);
  }
  await tick();
  const timer = setInterval(tick, 5000);
  onLeave(root, () => clearInterval(timer));
}
