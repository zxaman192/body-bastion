import { h, icon, setTitle, screenHeader, busy, toast, confirmDialog, promptDialog, navigate } from '../ui.js';
import { post, del, clearToken } from '../api.js';
import { store, loadPrivacy, loadGuide, clearSession, pref, setPref, applyTheme, loadGameData } from '../store.js';
import { loadAudio } from './engine.js';
import { VERSION, VERSION_NAME, RELEASES } from '../version.js';
import { resetTutorial, tutorialSkipped, skipTutorial } from '../progress.js';
import { resetGlossary } from '../glossary.js';


export async function render(root) {
  setTitle('Profile');
  const u = store.user;
  const [privacy, guide] = await Promise.all([loadPrivacy().catch(() => null), loadGuide()]);
  root.append(screenHeader('Your profile', { back: '#/home' }));
  root.append(h('div', { class: 'card' },
    h('dl', { class: 'kv' },
      h('dt', null, 'Handle'), h('dd', null, u.display_name),
      h('dt', null, 'Username'), h('dd', null, u.is_guest ? 'Guest account' : u.username),
      h('dt', null, 'College'), h('dd', null, u.college || '-'),
      h('dt', null, 'Role'), h('dd', null, u.role)),
    u.is_guest ? h('p', { class: 'muted small mt-1' }, 'Guest progress is kept on this device for about 30 days. ', h('a', { href: '#/register' }, 'Register an account'), ' to keep it for good, join the league and cohorts: your base and progress move to the new account.') : null));

  const sound = h('input', { type: 'checkbox', role: 'switch' });
  sound.checked = !pref('muted', false);
  sound.addEventListener('change', async () => {
    setPref('muted', !sound.checked);
    const a = await loadAudio();
    if (a) { a.setMuted(!sound.checked); a.unlock(); a.play('click'); }
  });
  const vol = h('input', { type: 'range', class: 'range', min: '0', max: '100', step: '5', id: 'pref-volume',
    value: String(Math.round(Number(pref('volume', 1)) * 100)) });
  const volText = h('span', { class: 'field-hint' }, `${vol.value}%`);
  vol.addEventListener('input', async () => {
    const v = Number(vol.value) / 100;
    volText.textContent = `${vol.value}%`;
    const a = await loadAudio();
    if (a) { a.setVolume(v); a.unlock(); a.play('click'); }
  });
  const theme = h('select', { class: 'input', 'aria-label': 'Theme' }, ['auto', 'light', 'dark'].map((t) => h('option', { value: t, selected: pref('theme', 'auto') === t ? true : null }, t === 'auto' ? 'Match my device' : t)));
  theme.addEventListener('change', () => { setPref('theme', theme.value); applyTheme(theme.value); });
  root.append(h('div', { class: 'card mt-2 form' }, h('h2', { class: 'mt-0' }, 'Settings'),
    h('label', { class: 'switch' }, sound, h('span', { class: 'track', 'aria-hidden': 'true' }), h('span', null, 'Sound and music')),
    h('label', { class: 'field', for: 'pref-volume' }, h('span', { class: 'field-label' }, 'Volume'), vol, volText),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Theme'), theme)));

  // Learning and help: replay the tutorial, choose how much guidance and how many features to show.
  const toggle = (key, fallback, label, hint, onChange) => {
    const input = h('input', { type: 'checkbox', role: 'switch' });
    input.checked = !!pref(key, fallback);
    input.addEventListener('change', () => { setPref(key, input.checked); if (onChange) onChange(input.checked); });
    return h('div', null, h('label', { class: 'switch' }, input, h('span', { class: 'track', 'aria-hidden': 'true' }), h('span', null, label)),
      hint ? h('p', { class: 'field-hint mt-0' }, hint) : null);
  };
  const replay = h('button', { class: 'btn btn-primary', type: 'button' }, icon('replay', { size: 18 }), 'Replay the tutorial');
  replay.addEventListener('click', async () => {
    resetTutorial();
    resetGlossary();
    const gd = await loadGameData();
    const first = (gd.campaign || [])[0];
    toast('Tutorial reset: coaching tips and plain-language explanations will show again.', 'ok');
    navigate(first ? `#/campaign/${first.id}?go=1` : '#/home');
  });
  const skip = h('button', { class: 'btn', type: 'button', disabled: tutorialSkipped() ? true : null }, 'Skip the tutorial');
  skip.addEventListener('click', () => { skipTutorial(); skip.disabled = true; toast('Tutorial skipped: every part of the game is now on your home screen.', 'ok'); });
  root.append(h('div', { class: 'card mt-2 form' }, h('h2', { class: 'mt-0' }, 'Learning and help'),
    h('div', { class: 'btn-group' }, replay, skip),
    toggle('ui.everything', false, 'Show every feature now', 'Normally research, raids, the league and cohorts appear one by one as you win missions.'),
    toggle('battle.tips', true, 'Tips during battles', 'Short tips about what is happening. Warnings always show; every message is also kept in the battle’s message list.'),
    toggle('battle.quiz', true, 'Checkpoint questions', 'A question when germs reach a new part of the gut; a right answer earns a booster. Never asked in the first training missions.')));

  root.append(h('div', { class: 'card mt-2' },
    h('h2', { class: 'mt-0' }, `Version ${VERSION} "${VERSION_NAME}"`),
    h('ul', { class: 'list' }, RELEASES.map((r) => h('li', { class: 'list-item' },
      h('div', { class: 'grow' }, h('strong', null, `${r.version} "${r.name}"`), h('small', { class: 'muted' }, `${r.date}: ${r.notes}`)))))));

  const logout = h('button', { class: 'btn', type: 'button' }, icon('logout', { size: 18 }), 'Log out');
  logout.addEventListener('click', () => busy(logout, async () => {
    try { await post('/api/auth/logout', {}, { silent: true }); } catch { /* ignore */ }
    clearToken();
    clearSession();
    navigate('#/login');
  }));
  const remove = h('button', { class: 'btn btn-danger', type: 'button' }, icon('trash', { size: 18 }), 'Delete my account');
  remove.addEventListener('click', () => busy(remove, async () => {
    if (!(await confirmDialog('This permanently deletes your account, base, battles and scores. It cannot be undone.', { title: 'Delete my account', danger: true, okLabel: 'Continue' }))) return;
    let body = {};
    if (!u.is_guest) {
      const pw = await promptDialog('Enter your password to confirm.', { title: 'Confirm deletion', type: 'password', required: true });
      if (pw === null) return;
      body = { password: pw };
    }
    try {
      await del('/api/me', body);
      clearToken();
      clearSession();
      toast('Your account and data have been deleted.', 'ok', 6000);
      navigate('#/login');
    } catch { /* toast */ }
  }));
  root.append(h('div', { class: 'card mt-2' }, h('h2', { class: 'mt-0' }, 'Account'), h('div', { class: 'btn-group' }, logout, remove),
    h('p', { class: 'muted small mt-1 mb-0' }, 'Under the DPDP Act 2023 you can withdraw consent and have your data erased at any time.')));

  if (privacy) {
    root.append(h('details', { class: 'card mt-2' }, h('summary', null, `Privacy notice (version ${privacy.version})`),
      h('div', { class: 'scrollbox prose small' }, privacy.text.split('\n').map((line) => (line.trim() ? h('p', null, line) : null)))));
  }
  root.append(h('details', { class: 'card mt-2' }, h('summary', null, 'Credits and licences'),
    h('div', { class: 'prose small' },
      guide && guide.credits ? h('p', null, guide.credits) : null,
      h('p', null, 'The Body Bastion logo is the project’s own artwork. All other game art is drawn in code at run time and all sounds and music are synthesised in the browser: there are no third-party image, sound or font assets.'),
      h('p', null, 'Built with open-source software: FastAPI, Starlette and Uvicorn (BSD), SQLAlchemy (MIT), psycopg (LGPL), segno QR codes (BSD).'))));
}
