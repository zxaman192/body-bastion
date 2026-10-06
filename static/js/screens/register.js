import { h, icon, setTitle, busy, toast, mount, spinnerBlock } from '../ui.js';
import { post } from '../api.js';
import { loadPrivacy } from '../store.js';
import { authHero, completeLogin } from './login.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function field(id, label, input, hint) {
  input.id = id;
  return h('label', { class: 'field', for: id },
    h('span', { class: 'field-label' }, label),
    input,
    hint ? h('span', { class: 'field-hint', id: id + '-hint' }, hint) : null);
}

export async function render(root) {
  setTitle('Create account');
  const card = h('div', { class: 'card' }, spinnerBlock('Loading the privacy notice...'));
  root.append(h('div', { class: 'auth-wrap', style: 'max-width:640px' }, authHero('Create your player account'), card));

  let privacy = null;
  try { privacy = await loadPrivacy(); } catch { privacy = null; }

  const inputs = {
    username: h('input', { class: 'input', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', required: true, minlength: '3', maxlength: '32', pattern: '[A-Za-z0-9_.-]+' }),
    password: h('input', { class: 'input', type: 'password', autocomplete: 'new-password', required: true, minlength: '8' }),
    password2: h('input', { class: 'input', type: 'password', autocomplete: 'new-password', required: true }),
    display_name: h('input', { class: 'input', autocomplete: 'nickname', required: true, maxlength: '40' }),
    college: h('input', { class: 'input', autocomplete: 'organization', required: true, maxlength: '120', placeholder: 'e.g. Maulana Azad Medical College' }),
    course: h('input', { class: 'input', required: true, maxlength: '60', placeholder: 'e.g. MBBS 2nd year' }),
    email: h('input', { class: 'input', type: 'email', autocomplete: 'email', maxlength: '120' }),
    guardian_name: h('input', { class: 'input', maxlength: '80' }),
    guardian_email: h('input', { class: 'input', type: 'email', maxlength: '120' }),
  };
  const adult = h('input', { type: 'checkbox', id: 'reg-adult' });
  const consent = h('input', { type: 'checkbox', id: 'reg-consent' });
  const guardianBox = h('div', { class: 'card soft stack' },
    h('p', { class: 'mb-0' }, h('strong', null, 'Under 18? '), 'We need the name and email of a parent or guardian who agrees to you playing.'),
    field('reg-gname', 'Parent or guardian name', inputs.guardian_name),
    field('reg-gemail', 'Parent or guardian email', inputs.guardian_email));
  const syncGuardian = () => { guardianBox.hidden = adult.checked; };
  adult.addEventListener('change', syncGuardian);
  syncGuardian();

  const notice = privacy && privacy.text
    ? h('div', { class: 'scrollbox', tabindex: '0', role: 'region', 'aria-label': 'Privacy notice' }, privacy.text)
    : h('div', { class: 'callout callout-warn' }, icon('warn'), h('p', null, 'The privacy notice could not be loaded. Please reload the page before registering.'));

  const msg = h('div', { 'aria-live': 'polite' });
  const submit = h('button', { class: 'btn btn-primary btn-big btn-block', type: 'submit' }, icon('check'), 'Create account');

  const form = h('form', { class: 'form', novalidate: true },
    h('div', { class: 'form-row' },
      field('reg-user', 'Username (for logging in)', inputs.username, 'Letters, numbers, dot, dash or underscore.'),
      field('reg-display', 'Display name (shown on leaderboards)', inputs.display_name, 'A nickname is fine. Do not use your full name if you prefer privacy.')),
    h('div', { class: 'form-row' },
      field('reg-pass', 'Password', inputs.password, 'At least 8 characters.'),
      field('reg-pass2', 'Repeat password', inputs.password2)),
    h('div', { class: 'form-row' },
      field('reg-college', 'College or school', inputs.college),
      field('reg-course', 'Course and year', inputs.course)),
    field('reg-email', 'Email (optional)', inputs.email, 'Only used by organisers to contact you about the event.'),
    h('label', { class: 'check', for: 'reg-adult' }, adult, h('span', null, h('strong', null, 'I am 18 or older'))),
    guardianBox,
    h('div', { class: 'field' },
      h('span', { class: 'field-label' }, `Privacy notice${privacy && privacy.version ? ` (version ${privacy.version})` : ''}`),
      notice),
    h('label', { class: 'check', for: 'reg-consent' }, consent,
      h('span', null, 'I have read the privacy notice and consent to Body Bastion processing my data as described (Digital Personal Data Protection Act, 2023). I can delete my account at any time from my profile.')),
    h('div', { class: 'callout' }, icon('info'),
      h('p', null, 'Organisers check new accounts before they can play, unless automatic approval is switched on for your event. You can play as a guest while you wait.')),
    msg,
    submit);

  function invalid(input, text) {
    input.setAttribute('aria-invalid', 'true');
    input.focus();
    toast(text, 'warn');
    return false;
  }

  function validate() {
    for (const i of Object.values(inputs)) i.removeAttribute('aria-invalid');
    const u = inputs.username.value.trim();
    if (u.length < 3 || !/^[A-Za-z0-9_.-]+$/.test(u)) return invalid(inputs.username, 'Choose a username of at least 3 letters or numbers (dot, dash and underscore are allowed).');
    if (!inputs.display_name.value.trim()) return invalid(inputs.display_name, 'Enter a display name.');
    if (inputs.password.value.length < 8) return invalid(inputs.password, 'The password must have at least 8 characters.');
    if (inputs.password.value !== inputs.password2.value) return invalid(inputs.password2, 'The two passwords do not match.');
    if (!inputs.college.value.trim()) return invalid(inputs.college, 'Enter your college or school.');
    if (!inputs.course.value.trim()) return invalid(inputs.course, 'Enter your course and year.');
    if (inputs.email.value.trim() && !EMAIL_RE.test(inputs.email.value.trim())) return invalid(inputs.email, 'The email address does not look right.');
    if (!adult.checked) {
      if (!inputs.guardian_name.value.trim()) return invalid(inputs.guardian_name, 'Players under 18 need a parent or guardian name.');
      if (!EMAIL_RE.test(inputs.guardian_email.value.trim())) return invalid(inputs.guardian_email, 'Players under 18 need a valid parent or guardian email.');
    }
    if (!privacy) { toast('The privacy notice is missing. Reload the page and try again.', 'error'); return false; }
    if (!consent.checked) { consent.focus(); toast('Please read the privacy notice and tick the consent box.', 'warn'); return false; }
    return true;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate()) return;
    const body = {
      username: inputs.username.value.trim(),
      password: inputs.password.value,
      display_name: inputs.display_name.value.trim(),
      college: inputs.college.value.trim(),
      course: inputs.course.value.trim(),
      is_adult: adult.checked,
      consent: true,
      consent_version: privacy.version,
    };
    if (inputs.email.value.trim()) body.email = inputs.email.value.trim();
    if (!adult.checked) {
      body.guardian_name = inputs.guardian_name.value.trim();
      body.guardian_email = inputs.guardian_email.value.trim();
    }
    busy(submit, async () => {
      let resp;
      try {
        resp = await post('/api/auth/register', body);
      } catch {
        return;
      }
      if (resp && resp.status === 'approved') {
        toast(resp.message || 'Account created. Welcome!', 'ok');
        try {
          const login = await post('/api/auth/login', { username: body.username, password: body.password });
          await completeLogin(login);
          return;
        } catch { /* fall through to the pending message */ }
      }
      mount(card,
        h('div', { class: 'center stack' },
          icon('clock', { size: 48 }),
          h('h2', null, 'Thanks for registering!'),
          h('p', null, (resp && resp.message) || 'Your account is waiting for approval by the organisers. You will be able to log in once it is approved.'),
          h('div', { class: 'row', style: 'justify-content:center' },
            h('a', { class: 'btn btn-primary', href: '#/login' }, 'Go to log in'),
            h('a', { class: 'btn', href: '#/guide' }, icon('book'), 'Read the guide meanwhile'))));
    });
  });

  mount(card,
    h('h2', null, 'Create an account'),
    form,
    h('p', { class: 'center mt-2 mb-0' }, 'Already registered? ', h('a', { href: '#/login' }, 'Log in')));
}
