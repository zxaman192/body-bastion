import { h, setTitle, onLeave, fmt, svgFromString } from '../ui.js';
import { get } from '../api.js';

export async function render(root, params) {
  setTitle('Projector');
  const code = String(params.code || '').toUpperCase();
  const head = h('div', { class: 'proj-head' });
  const body = h('div', { class: 'proj-grid' });
  root.append(head, body);
  let qrNode = null;
  let timer = 0;

  async function tick() {
    let r;
    try {
      r = await get(`/api/classroom/${code}/results`, { silent: true });
    } catch (e) {
      head.replaceChildren(h('h1', null, 'Session not found'), h('p', null, e.detail || ''));
      return;
    }
    if (!params.isCurrent()) return;
    head.replaceChildren(h('div', null, h('h1', null, r.title), h('p', null, `${r.target_name} • join at /#/join/${r.code} • ${r.status === 'running' ? 'LIVE' : r.status === 'open' ? 'Lobby open' : 'Closed'}`)),
      h('div', { class: 'join-code' }, r.code));
    const panels = [];
    panels.push(h('div', { class: 'proj-panel' },
      h('h2', null, `Groups (${r.groups})`),
      r.rows.length ? h('table', { class: 'proj-table' },
        h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, 'Group'), h('th', null, 'Score'), h('th', null, r.mode === 'tournament' ? 'Stars' : 'Survived'), h('th', null, 'Tries'))),
        h('tbody', null, r.rows.map((x) => h('tr', { class: x.rank === 1 ? 'top1' : '' },
          h('td', null, String(x.rank)), h('td', null, x.group), h('td', null, fmt(x.score)),
          h('td', null, r.mode === 'tournament' ? '★'.repeat(x.stars || 0) || '-' : x.survived ? 'Yes' : 'No'),
          h('td', null, String(x.attempts)))))) : h('p', null, 'Waiting for the first result...')));
    if (!qrNode && r.status !== 'closed') {
      try {
        const info = await get(`/api/classroom/${code}`, { silent: true });
        qrNode = svgFromString(info.qr_svg);
      } catch { /* optional */ }
    }
    if (qrNode && r.status !== 'closed') {
      panels.push(h('div', { class: 'proj-panel center' }, h('h2', null, 'Scan to join'), h('div', { class: 'qr-box' }, qrNode.cloneNode(true))));
    }
    body.replaceChildren(...panels);
  }
  await tick();
  timer = setInterval(tick, 3000);
  onLeave(root, () => clearInterval(timer));
}
