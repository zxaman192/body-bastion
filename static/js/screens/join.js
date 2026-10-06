import { h, icon, setTitle, screenHeader, busy, mount, spinnerBlock, errorBlock, toast, chip } from '../ui.js';
import { get, post } from '../api.js';
import { loadGameData, groupSession, setGroupSession } from '../store.js';
import { boostToggle, startBattle } from './battleflow.js';

export async function render(root, params) {
  setTitle('Join a class');
  if (!params.code) {
    const code = h('input', { class: 'input join-code-input', placeholder: 'ABC123', maxlength: '6', autocapitalize: 'characters', 'aria-label': 'Session code' });
    const go = h('button', { class: 'btn btn-primary', type: 'button' }, 'Join');
    go.addEventListener('click', () => { if (code.value.trim()) location.hash = `#/join/${code.value.trim().toUpperCase()}`; });
    root.append(screenHeader('Join a class session', { subtitle: 'Enter the code on the projector, or scan its QR code.' }), h('div', { class: 'card' }, h('div', { class: 'form' }, code, go)));
    return;
  }
  const codeU = String(params.code).toUpperCase();
  root.append(spinnerBlock());
  let gd;
  let sess;
  try {
    [gd, sess] = await Promise.all([loadGameData(), get(`/api/classroom/${codeU}`)]);
  } catch (e) {
    mount(root, errorBlock(e, () => location.reload()));
    return;
  }
  if (!params.isCurrent()) return;
  root.replaceChildren(screenHeader(sess.title, { subtitle: `${sess.target_name} • code ${sess.code}` }));
  let group = groupSession(codeU);
  const status = h('div');
  root.append(status);

  function paintStatus() {
    status.replaceChildren(h('p', null, chip(sess.status === 'running' ? 'Session running' : sess.status === 'open' ? 'Waiting for the teacher to start' : 'Session closed')));
  }
  paintStatus();

  if (!group) {
    const name = h('input', { class: 'input', placeholder: 'Group name, e.g. Team Paneth', maxlength: '30', 'aria-label': 'Group name' });
    const join = h('button', { class: 'btn btn-primary', type: 'button', disabled: sess.status === 'closed' }, icon('classroom', { size: 18 }), 'Join');
    join.addEventListener('click', () => busy(join, async () => {
      try {
        const r = await post(`/api/classroom/${codeU}/join`, { group_name: name.value });
        group = { token: r.group_token, id: r.group_id, name: r.group_name };
        setGroupSession(codeU, group);
        toast(`Joined as ${r.group_name}.`, 'ok');
        window.dispatchEvent(new Event('bb:rerender'));
      } catch { /* toast shown */ }
    }));
    root.append(h('div', { class: 'card' }, h('h2', { class: 'mt-0' }, 'Join with a group name'),
      h('p', { class: 'muted small' }, 'No account or personal data is needed. Use a team name, not your real names.'),
      h('div', { class: 'form' }, name, join)));
    return;
  }

  const isDefence = sess.mode !== 'tournament';
  const boost = boostToggle(gd, isDefence);
  const play = h('button', { class: 'btn btn-primary btn-big btn-block', type: 'button' }, icon('play'), 'Play');
  play.addEventListener('click', () => busy(play, async () => {
    try { sess = await get(`/api/classroom/${codeU}`); } catch { return; }
    paintStatus();
    if (sess.status !== 'running') { toast('Wait for your teacher to press Start.', 'warn'); return; }
    const ctx = { mode: 'classroom', target: { code: codeU }, boost: boost.value, groupToken: group.token, title: sess.title,
      code: codeU, back: `#/join/${codeU}`, again: `#/join/${codeU}` };
    if (sess.mode === 'campaign') ctx.levelId = Number(sess.ref);
    if (sess.mode === 'trial') ctx.trialId = sess.ref;
    await startBattle(root, ctx);
  }));
  const leave = h('button', { class: 'btn btn-ghost btn-small', type: 'button', onclick: () => { setGroupSession(codeU, null); window.dispatchEvent(new Event('bb:rerender')); } }, 'Use a different group name');
  root.append(h('div', { class: 'card' }, h('p', null, 'Playing as ', h('strong', null, group.name)), boost.el, h('div', { class: 'mt-2' }, play), h('div', { class: 'mt-1' }, leave)),
    h('p', { class: 'mt-2' }, h('a', { href: `#/projector/${codeU}` }, 'See the live results')));
}
