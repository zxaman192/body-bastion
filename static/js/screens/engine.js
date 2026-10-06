import { h } from '../ui.js';

let baseviewP = null;
let battleP = null;
let audioP = null;

export function loadBaseView() {
  if (!baseviewP) baseviewP = import('../baseview.js').catch((e) => { baseviewP = null; throw e; });
  return baseviewP;
}

export function loadBattle() {
  if (!battleP) battleP = import('../battle.js').catch((e) => { battleP = null; throw e; });
  return battleP;
}

export function loadAudio() {
  if (!audioP) {
    audioP = import('../audio.js')
      .then((m) => m.audio || null)
      .catch(() => { audioP = null; return null; });
  }
  return audioP;
}

export async function playSound(name) {
  const audio = await loadAudio();
  if (audio && typeof audio.play === 'function') {
    try { audio.play(name); } catch { /* sound is optional */ }
  }
}

export async function mountBase(container, opts, alive) {
  try {
    const mod = await loadBaseView();
    if (alive && !alive()) return null;
    return mod.mountBaseView(container, opts);
  } catch (e) {
    console.error(e);
    container.append(h('div', { class: 'callout callout-warn' }, 'The base map could not be drawn on this device. You can still use the lists on this page.'));
    return null;
  }
}
