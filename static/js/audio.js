const KEY = 'bb.pref.muted';

function readMuted() {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? false : JSON.parse(v) === true;
  } catch {
    return false;
  }
}

function writeMuted(v) {
  try { localStorage.setItem(KEY, JSON.stringify(!!v)); } catch { /* storage blocked */ }
}

let ctx = null;
let master = null;
let musicGain = null;
let muted = readMuted();
let musicOn = false;
let musicTimer = 0;
let musicStep = 0;
let noiseBuf = null;
const lastPlayed = new Map();

function ensure() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.55;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.18;
  musicGain.connect(master);
  const len = ctx.sampleRate * 0.5;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

function tone(freq, dur, { type = 'sine', gain = 0.25, slide = 0, delay = 0, dest } = {}) {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(dest || master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur, { gain = 0.2, freq = 1200, q = 1, delay = 0, type = 'bandpass' } = {}) {
  const c = ensure();
  if (!c || !noiseBuf) return;
  const t0 = c.currentTime + delay;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f);
  f.connect(g);
  g.connect(master);
  s.start(t0);
  s.stop(t0 + dur + 0.02);
}

const SOUNDS = {
  deploy: () => { tone(320, 0.12, { type: 'triangle', gain: 0.18, slide: 2.2 }); noise(0.06, { gain: 0.06, freq: 2400 }); },
  pop: () => { tone(620, 0.09, { type: 'sine', gain: 0.18, slide: 0.4 }); noise(0.05, { gain: 0.05, freq: 3000 }); },
  squish: () => { noise(0.12, { gain: 0.12, freq: 500, q: 3 }); tone(140, 0.1, { type: 'sine', gain: 0.08, slide: 0.6 }); },
  zap: () => { tone(980, 0.09, { type: 'square', gain: 0.05, slide: 0.5 }); },
  thunk: () => { tone(210, 0.1, { type: 'triangle', gain: 0.12, slide: 0.7 }); },
  tick: () => { tone(1500, 0.03, { type: 'sine', gain: 0.03 }); },
  wasted: () => { tone(260, 0.16, { type: 'sawtooth', gain: 0.04, slide: 0.7 }); },
  crumble: () => { noise(0.45, { gain: 0.22, freq: 260, q: 0.7, type: 'lowpass' }); tone(90, 0.35, { type: 'triangle', gain: 0.12, slide: 0.5 }); },
  alarm: () => { tone(880, 0.18, { type: 'square', gain: 0.06 }); tone(660, 0.18, { type: 'square', gain: 0.06, delay: 0.2 }); },
  flush: () => { noise(0.5, { gain: 0.08, freq: 700, q: 0.6 }); },
  acid: () => { noise(0.2, { gain: 0.04, freq: 4000, q: 2 }); },
  iv: () => { tone(1200, 0.08, { type: 'sine', gain: 0.06 }); tone(1500, 0.08, { type: 'sine', gain: 0.05, delay: 0.1 }); },
  spell: () => { tone(500, 0.35, { type: 'sine', gain: 0.1, slide: 2.5 }); noise(0.3, { gain: 0.04, freq: 5000 }); },
  build: () => { tone(400, 0.08, { type: 'triangle', gain: 0.12 }); tone(600, 0.1, { type: 'triangle', gain: 0.12, delay: 0.08 }); },
  correct: () => { [523, 659, 784].forEach((f, i) => tone(f, 0.18, { type: 'triangle', gain: 0.14, delay: i * 0.09 })); },
  wrong: () => { tone(300, 0.22, { type: 'sawtooth', gain: 0.07, slide: 0.6 }); },
  victory: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.28, { type: 'triangle', gain: 0.15, delay: i * 0.13 })); },
  defeat: () => { [392, 330, 262].forEach((f, i) => tone(f, 0.35, { type: 'triangle', gain: 0.13, delay: i * 0.18 })); },
  click: () => { tone(900, 0.03, { type: 'sine', gain: 0.05 }); },
};

const MIN_GAP = { zap: 60, thunk: 70, tick: 45, pop: 50, squish: 60, wasted: 300, acid: 400, flush: 600, alarm: 1500 };

const MELODY = [0, 4, 7, 4, 9, 7, 4, 2, 0, 4, 7, 12, 9, 7, 4, 7];
const BASS = [0, 0, 5, 5, 7, 7, 5, 5];

function musicTick() {
  if (!musicOn || !ctx) return;
  const base = 261.63;
  const step = musicStep++;
  const n = MELODY[step % MELODY.length];
  tone(base * Math.pow(2, n / 12), 0.22, { type: 'triangle', gain: 0.12, dest: musicGain });
  if (step % 2 === 0) {
    const b = BASS[(step / 2) % BASS.length];
    tone((base / 2) * Math.pow(2, b / 12), 0.4, { type: 'sine', gain: 0.16, dest: musicGain });
  }
  if (step % 4 === 2) noise(0.05, { gain: 0.03, freq: 6000, q: 1 });
}

export const audio = {
  unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  },
  play(name) {
    if (muted) return;
    const fn = SOUNDS[name];
    if (!fn) return;
    const c = ensure();
    if (!c || c.state !== 'running') return;
    const now = performance.now();
    const gap = MIN_GAP[name] || 30;
    if (now - (lastPlayed.get(name) || 0) < gap) return;
    lastPlayed.set(name, now);
    try { fn(); } catch { /* audio is optional */ }
  },
  music(on) {
    musicOn = !!on;
    clearInterval(musicTimer);
    if (musicOn && ensure()) musicTimer = setInterval(musicTick, 230);
  },
  setMuted(v) {
    muted = !!v;
    writeMuted(muted);
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.05);
  },
  get muted() { return muted; },
};
