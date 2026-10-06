import { h, icon, setTitle, screenHeader, busy, mount, spinnerBlock, errorBlock, svgFromString, copyText, emptyBlock, fmtDate, chip, confirmDialog } from '../ui.js';
import { get, post, del, download } from '../api.js';
import { loadGameData } from '../store.js';

export async function render(root, params) {
  setTitle('Classroom');
  root.append(spinnerBlock());
  let gd;
  let mine;
  try {
    [gd, mine] = await Promise.all([loadGameData(), get('/api/classroom/mine')]);
  } catch (e) {
    mount(root, errorBlock(e, () => location.reload()));
    return;
  }
  if (!params.isCurrent()) return;
  root.replaceChildren(screenHeader('Classroom mode', { subtitle: 'Create a match, project the QR code, and let groups play on their phones. Results update live on the projector.', back: '#/home' }));

  const modeSel = h('select', { class: 'input', 'aria-label': 'Battle type' },
    h('option', { value: 'campaign' }, 'Campaign case (defence)'),
    h('option', { value: 'trial' }, 'Defence Trial'),
    h('option', { value: 'tournament' }, 'Tournament base (attack)'));
  const refSel = h('select', { class: 'input', 'aria-label': 'Which one' });
  const title = h('input', { class: 'input', placeholder: 'Title shown to students (optional)', maxlength: '120' });
  function fillRefs() {
    refSel.replaceChildren();
    const m = modeSel.value;
    const items = m === 'campaign' ? gd.campaign.map((c) => [String(c.id), `Case ${c.id}: ${c.title}`])
      : m === 'trial' ? (gd.trials || []).map((t) => [t.id, `${t.id}: ${t.name}`])
        : gd.tournament.bases.map((b) => [b.id, `${b.id}: ${b.name} (difficulty ${b.difficulty})`]);
    for (const [v, l] of items) refSel.append(h('option', { value: v }, l));
  }
  modeSel.addEventListener('change', fillRefs);
  fillRefs();
  const create = h('button', { class: 'btn btn-primary', type: 'button' }, icon('qr', { size: 18 }), 'Create session');
  const out = h('div');
  create.addEventListener('click', () => busy(create, async () => {
    try {
      const s = await post('/api/classroom', { mode: modeSel.value, ref: refSel.value, title: title.value });
      showSession(out, s);
      loadMine();
    } catch { /* toast shown */ }
  }));
  root.append(h('div', { class: 'card' }, h('h2', { class: 'mt-0' }, 'New session'), h('div', { class: 'form' }, modeSel, refSel, title, create)), out);

  const mineHost = h('section', { class: 'section' });
  root.append(mineHost);
  function paintMine(rows) {
    mineHost.replaceChildren(h('h2', null, icon('classroom'), ' My sessions'));
    if (!rows.length) { mineHost.append(emptyBlock('No sessions yet.')); return; }
    const ul = h('ul', { class: 'list' });
    for (const s of rows) {
      const controls = h('div', { class: 'btn-group' });
      for (const st of ['open', 'running', 'closed']) {
        const b = h('button', { class: `btn btn-small${s.status === st ? ' btn-primary' : ''}`, type: 'button', 'aria-pressed': s.status === st ? 'true' : 'false' },
          st === 'open' ? 'Lobby' : st === 'running' ? 'Start' : 'Close');
        b.addEventListener('click', () => busy(b, async () => {
          try { await post(`/api/classroom/${s.code}/status`, { status: st }); loadMine(); } catch { /* toast */ }
        }));
        controls.append(b);
      }
      const show = h('button', { class: 'btn btn-small', type: 'button' }, icon('qr', { size: 16 }), 'QR');
      show.addEventListener('click', () => busy(show, async () => { try { showSession(out, await get(`/api/classroom/${s.code}`)); out.scrollIntoView({ behavior: 'smooth' }); } catch { /* toast */ } }));
      const exp = h('button', { class: 'btn btn-small', type: 'button' }, icon('download', { size: 16 }), 'CSV');
      exp.addEventListener('click', () => busy(exp, () => download(`/api/classroom/${s.code}/export.csv`, `classroom_${s.code}.csv`)));
      const rm = h('button', { class: 'btn btn-small btn-ghost', type: 'button', 'aria-label': 'Delete session' }, icon('trash', { size: 16 }));
      rm.addEventListener('click', () => busy(rm, async () => {
        if (!(await confirmDialog(`Delete session ${s.code} and all its results?`, { danger: true, okLabel: 'Delete' }))) return;
        try { await del(`/api/classroom/${s.code}`); loadMine(); } catch { /* toast */ }
      }));
      ul.append(h('li', { class: 'list-item' },
        h('div', { class: 'grow' }, h('strong', null, `${s.code} • ${s.title}`), h('small', { class: 'muted' }, `${s.target_name} • ${s.groups} groups • ${fmtDate(s.created_at)}`),
          h('div', { class: 'mt-1' }, chip(s.status === 'running' ? 'Running' : s.status === 'open' ? 'Lobby open' : 'Closed'))),
        h('div', { class: 'stack' }, controls, h('div', { class: 'btn-group' }, show,
          h('a', { class: 'btn btn-small', href: `#/projector/${s.code}`, target: '_blank', rel: 'noopener' }, icon('fullscreen', { size: 16 }), 'Projector'), exp, rm))));
    }
    mineHost.append(ul);
  }
  async function loadMine() {
    try { paintMine((await get('/api/classroom/mine')).rows); } catch { /* toast */ }
  }
  paintMine(mine.rows);
}

function showSession(host, s) {
  const qr = svgFromString(s.qr_svg);
  host.replaceChildren(h('div', { class: 'card mt-2 center' },
    h('h2', { class: 'mt-0' }, s.title),
    h('p', { class: 'muted' }, `${s.target_name} • groups join with this code`),
    h('div', { class: 'join-code' }, s.code),
    qr ? h('div', { class: 'qr-box' }, qr) : null,
    h('p', { class: 'small' }, s.join_url),
    h('div', { class: 'btn-group' },
      h('button', { class: 'btn btn-small', type: 'button', onclick: () => copyText(s.join_url) }, icon('copy', { size: 16 }), 'Copy join link'),
      h('a', { class: 'btn btn-small btn-primary', href: s.projector_url, target: '_blank', rel: 'noopener' }, icon('fullscreen', { size: 16 }), 'Open projector view')),
    h('p', { class: 'muted small' }, 'Groups can join while the session is in the lobby. Press Start when everyone is ready; Close stops new attempts.')));
}
