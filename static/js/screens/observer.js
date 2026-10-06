import { h, icon, setTitle, screenHeader, busy, toast, emptyBlock, fmt, fmtDate, chip, promptDialog, confirmDialog, navigate } from '../ui.js';
import { get, post } from '../api.js';
import { store } from '../store.js';

export function render(root) {
  setTitle('Observer');
  root.append(screenHeader('Fair-play review', { subtitle: 'Every battle is re-simulated on the server. Review mismatches, battles faster than real time, and anything that looks odd.', back: '#/home' }));
  const flag = h('select', { class: 'input', 'aria-label': 'Filter' },
    h('option', { value: 'any' }, 'Flagged or suspicious'), h('option', { value: 'mismatch' }, 'Client/server mismatch'),
    h('option', { value: 'too_fast' }, 'Faster than real time'), h('option', { value: 'suspicious' }, 'Marked suspicious'), h('option', { value: '' }, 'All battles'));
  const mode = h('select', { class: 'input', 'aria-label': 'Mode' }, h('option', { value: '' }, 'All modes'),
    ['tournament', 'trial', 'multiplayer', 'clanwar', 'classroom', 'campaign', 'practice'].map((m) => h('option', { value: m }, m)));
  const host = h('div', { class: 'mt-2' });
  root.append(h('div', { class: 'row' }, flag, mode), host);

  async function load() {
    host.replaceChildren();
    const q = new URLSearchParams();
    if (flag.value) q.set('flag', flag.value);
    if (mode.value) q.set('mode', mode.value);
    let d;
    try { d = await get(`/api/observer/battles?${q}`); } catch { return; }
    if (!d.rows.length) { host.append(emptyBlock('Nothing to review.')); return; }
    const body = h('tbody');
    for (const r of d.rows) {
      const mark = h('button', { class: 'btn btn-small', type: 'button' }, r.review === 'suspicious' ? 'Clear' : 'Suspicious');
      mark.addEventListener('click', () => busy(mark, async () => {
        const next = r.review === 'suspicious' ? 'cleared' : 'suspicious';
        const note = await promptDialog('Note for the organisers (optional)', { title: next === 'suspicious' ? 'Mark suspicious' : 'Clear this battle', multiline: true });
        if (note === null) return;
        try { await post(`/api/observer/battles/${r.id}/flag`, { flag: next, note }); toast('Saved', 'ok'); load(); } catch { /* toast */ }
      }));
      const tools = h('div', { class: 'btn-group' },
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => navigate(`#/replay/${r.id}`) }, icon('replay', { size: 16 }), 'Replay'), mark);
      if (store.user && store.user.role === 'admin' && r.status !== 'invalid') {
        const inv = h('button', { class: 'btn btn-small btn-danger', type: 'button' }, 'Invalidate');
        inv.addEventListener('click', () => busy(inv, async () => {
          if (!(await confirmDialog('Invalidate this battle? It stops counting, and a league attempt is given back.', { danger: true, okLabel: 'Invalidate' }))) return;
          try { await post(`/api/admin/battles/${r.id}/invalidate`, {}); load(); } catch { /* toast */ }
        }));
        tools.append(inv);
      }
      body.append(h('tr', { class: (r.flags || []).length || r.review === 'suspicious' ? 'flagged' : '' },
        h('td', null, `#${r.id}`), h('td', null, r.mode), h('td', null, r.attacker), h('td', null, r.defender),
        h('td', { class: 'num' }, `${r.stars ?? '-'} ★ ${r.pct ?? 0}%`), h('td', { class: 'num' }, fmt(r.score || 0)),
        h('td', { class: 'num' }, `${r.duration_s}s / ${r.ticks ? (r.ticks / 10).toFixed(0) : '-'}s`),
        h('td', null, (r.flags || []).map((f) => chip(f)), r.review ? chip(r.review) : null, r.status === 'invalid' ? chip('invalid') : null, r.note ? h('div', { class: 'small muted' }, r.note) : null),
        h('td', null, fmtDate(r.finished_at)), h('td', null, tools)));
    }
    host.append(h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('thead', null, h('tr', null, ['Battle', 'Mode', 'Player', 'Opponent', 'Result', 'Score', 'Played / game time', 'Flags', 'Finished', ''].map((t) => h('th', null, t)))), body)));
  }
  flag.addEventListener('change', load);
  mode.addEventListener('change', load);
  load();
}
