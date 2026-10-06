import { h, icon, brandMark, setTitle, busy, navigate, toast } from '../ui.js';
import { post, setToken } from '../api.js';
import { setUser, takeLoginTarget, refreshState } from '../store.js';

export function authHero(sub) {
  return h('div', { class: 'auth-hero' },
    brandMark(96),
    h('h1', null, 'Body Bastion'),
    h('p', { class: 'tagline' }, 'Defend the gut. Learn the drugs.'),
    sub ? h('p', { class: 'muted mt-1' }, sub) : null);
}

export async function completeLogin(resp) {
  setToken(resp.token);
  setUser(resp.user);
  try { await refreshState({ silent: true }); } catch { /* home will retry */ }
  navigate(takeLoginTarget(), { replace: true });
}

export function render(root, params) {
  setTitle('Log in');
  const user = h('input', { class: 'input', id: 'login-user', name: 'username', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', required: true });
  const pass = h('input', { class: 'input', id: 'login-pass', name: 'password', type: 'password', autocomplete: 'current-password', required: true });
  const msg = h('div', { 'aria-live': 'polite' });
  if (params.query && params.query.registered) {
    msg.append(h('div', { class: 'callout callout-ok' }, icon('check'), h('p', null, 'Registration received. You can log in once an organiser approves your account.')));
  }
  const submit = h('button', { class: 'btn btn-primary btn-big btn-block', type: 'submit' }, icon('play'), 'Log in');
  const form = h('form', { class: 'form', novalidate: true },
    h('label', { class: 'field', for: 'login-user' }, h('span', { class: 'field-label' }, 'Username'), user),
    h('label', { class: 'field', for: 'login-pass' }, h('span', { class: 'field-label' }, 'Password'), pass),
    msg,
    submit);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!user.value.trim() || !pass.value) {
      toast('Enter your username and password.', 'warn');
      (user.value.trim() ? pass : user).focus();
      return;
    }
    busy(submit, async () => {
      try {
        const resp = await post('/api/auth/login', { username: user.value.trim(), password: pass.value });
        await completeLogin(resp);
      } catch (err) {
        if (err && err.status === 403) {
          msg.replaceChildren(h('div', { class: 'callout callout-warn' }, icon('clock'), h('p', null, err.detail)));
        }
      }
    });
  });

  const guestBtn = h('button', { class: 'btn btn-block', type: 'button' }, icon('user'), 'Play as guest');
  guestBtn.addEventListener('click', () => busy(guestBtn, async () => {
    try {
      const resp = await post('/api/auth/guest', {});
      toast('Playing as a guest. Guest progress is kept only while this browser keeps you logged in.', 'info', 5000);
      await completeLogin(resp);
    } catch { /* toast shown */ }
  }));

  root.append(h('div', { class: 'auth-wrap' },
    authHero('A strategy game about gut infections, immunity and antibiotics.'),
    h('div', { class: 'card' },
      h('h2', null, 'Log in'),
      form,
      h('div', { class: 'divider-text' }, 'or'),
      guestBtn,
      h('p', { class: 'center mt-2 mb-0' }, 'New here? ', h('a', { href: '#/register' }, 'Create an account')),
      h('p', { class: 'center small muted mt-1 mb-0' }, 'Have a classroom code? ', h('a', { href: '#/join' }, 'Join a class game'))),
    h('p', { class: 'footer-note' },
      'Maulana Azad Medical College, New Delhi. ',
      h('a', { href: '#/guide' }, 'Read the guide'), ' - ', h('a', { href: '#/live' }, 'Live scores'))));
  setTimeout(() => user.focus(), 50);
}
