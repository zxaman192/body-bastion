import { circle, ellipse, antibody, capsule, star, glow, textLabel, TAU } from './shapes.js';
import { rgba, shade } from './color.js';

const MAX_FX = 420;

export class FX {
  constructor() {
    this.items = [];
    this.shake = 0;
    this.flash = 0;
    this.flashColor = '#ff2a3a';
  }

  add(it) {
    if (this.items.length >= MAX_FX) this.items.shift();
    it.age = 0;
    this.items.push(it);
  }

  projectile(kind, from, to, color, opts = {}) {
    this.add({ type: 'proj', kind, from, to, color, life: opts.life || 260, depth: (to.depth || 0) + 1, wasted: !!opts.wasted });
  }

  ring(x, y, r0, r1, color, life = 420, depth = 0) {
    this.add({ type: 'ring', x, y, r0, r1, color, life, depth });
  }

  burst(x, y, color, n = 8, life = 520, depth = 0, speed = 46) {
    const parts = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + Math.random() * 0.6;
      const v = speed * (0.55 + Math.random() * 0.8);
      parts.push({ vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.55 - 30 * Math.random(), r: 2 + Math.random() * 3 });
    }
    this.add({ type: 'burst', x, y, color, parts, life, depth });
  }

  puff(x, y, color, life = 700, depth = 0, size = 18) {
    this.add({ type: 'puff', x, y, color, life, depth, size });
  }

  bubbles(x, y, color, life = 900, depth = 0) {
    const parts = [];
    for (let k = 0; k < 5; k++) parts.push({ dx: (Math.random() - 0.5) * 40, dy: (Math.random() - 0.5) * 16, r: 2 + Math.random() * 3.5, d: Math.random() * 0.4 });
    this.add({ type: 'bubbles', x, y, color, parts, life, depth });
  }

  drops(x, y, color = '#4fa8ff', life = 900, depth = 0) {
    this.add({ type: 'drops', x, y, color, life, depth });
  }

  text(x, y, text, color = '#ffffff', life = 1100, depth = 1e9, size = 12) {
    this.add({ type: 'text', x, y, text, color, life, depth, size });
  }

  wave(points, color, life = 900) {
    this.add({ type: 'wave', points, color, life, depth: -1e9 });
  }

  quake(amount) {
    this.shake = Math.max(this.shake, amount);
  }

  flashScreen(color, amount = 0.5) {
    this.flashColor = color;
    this.flash = Math.max(this.flash, amount);
  }

  update(dt) {
    for (const it of this.items) it.age += dt;
    this.items = this.items.filter((it) => it.age < it.life);
    this.shake = Math.max(0, this.shake - dt * 0.004);
    this.flash = Math.max(0, this.flash - dt * 0.0015);
  }

  depthItems(t) {
    return this.items.map((it) => ({ depth: it.depth, order: 5, draw: (ctx) => drawFx(ctx, it, t) }));
  }

  clear() {
    this.items = [];
    this.shake = 0;
    this.flash = 0;
  }
}

function drawFx(ctx, it, t) {
  const k = Math.min(1, it.age / it.life);
  ctx.save();
  switch (it.type) {
    case 'proj': {
      const x = it.from.x + (it.to.x - it.from.x) * k;
      const arc = Math.sin(k * Math.PI) * 26;
      const y = it.from.y + (it.to.y - it.from.y) * k - arc;
      const ang = Math.atan2(it.to.y - it.from.y, it.to.x - it.from.x);
      ctx.globalAlpha = 1 - Math.max(0, k - 0.85) / 0.15;
      if (it.kind === 'drug') {
        if (it.wasted) ctx.globalAlpha *= 0.55;
        capsule(ctx, x, y, 13, 4.2, ang, it.color, shade(it.color, 0.45));
      } else if (it.kind === 'antibody') {
        antibody(ctx, x, y, 9, ang + Math.PI / 2, '#ffffff', '#3a6fd8');
      } else if (it.kind === 'spark') {
        ctx.fillStyle = it.color;
        star(ctx, x, y, 4, 5, 2, t * 12);
        ctx.fill();
      } else {
        glow(ctx, x, y, 10, it.color, 0.6);
        ctx.fillStyle = it.color;
        circle(ctx, x, y, 4.5);
        ctx.fill();
      }
      break;
    }
    case 'ring': {
      const r = it.r0 + (it.r1 - it.r0) * k;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = it.color;
      ctx.lineWidth = 4 * (1 - k) + 1;
      ellipse(ctx, it.x, it.y, r, r * 0.8);
      ctx.stroke();
      break;
    }
    case 'burst': {
      const s = it.age / 1000;
      for (const p of it.parts) {
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = it.color;
        circle(ctx, it.x + p.vx * s, it.y + p.vy * s + 60 * s * s, p.r * (1 - k * 0.5));
        ctx.fill();
      }
      break;
    }
    case 'puff': {
      ctx.globalAlpha = 0.55 * (1 - k);
      ctx.fillStyle = it.color;
      for (let j = 0; j < 4; j++) {
        circle(ctx, it.x + Math.cos(j * 1.7) * it.size * 0.6 * k, it.y - it.size * k - j * 3, it.size * (0.4 + k * 0.6));
        ctx.fill();
      }
      break;
    }
    case 'bubbles': {
      for (const p of it.parts) {
        const kk = Math.max(0, Math.min(1, (k - p.d) / (1 - p.d)));
        ctx.globalAlpha = (1 - kk) * 0.8;
        ctx.strokeStyle = it.color;
        ctx.lineWidth = 1.5;
        circle(ctx, it.x + p.dx, it.y + p.dy - kk * 22, p.r * (0.6 + kk));
        ctx.stroke();
      }
      break;
    }
    case 'drops': {
      for (let j = 0; j < 3; j++) {
        const kk = (k * 3 + j / 3) % 1;
        ctx.globalAlpha = 1 - kk;
        ctx.fillStyle = it.color;
        ellipse(ctx, it.x + (j - 1) * 6, it.y - 30 + kk * 30, 2.5, 4);
        ctx.fill();
      }
      break;
    }
    case 'text': {
      ctx.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      textLabel(ctx, it.text, it.x, it.y - 34 * k, { size: it.size, color: it.color, stroke: 'rgba(30,10,25,0.85)', strokeWidth: 3.5 });
      break;
    }
    case 'wave': {
      ctx.globalAlpha = 0.5 * (1 - k);
      ctx.strokeStyle = it.color;
      ctx.lineWidth = 18;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const n = it.points.length;
      const upto = Math.max(1, Math.floor(n * Math.min(1, k * 1.6)));
      for (let j = Math.max(0, upto - 6); j < upto; j++) {
        const p = it.points[j];
        if (j === Math.max(0, upto - 6)) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

export function drawOverlays(ctx, vw, vh, { fx, hydrationFrac = 1, fever = 0, stopflow = false, t = 0 }) {
  if (fever > 0) {
    ctx.save();
    ctx.globalAlpha = 0.1 + 0.05 * Math.sin(t * 2);
    ctx.fillStyle = '#ff7a2a';
    ctx.fillRect(0, 0, vw, vh);
    ctx.restore();
  }
  if (hydrationFrac < 0.35) {
    const a = Math.min(0.55, (0.35 - hydrationFrac) * 1.8) * (0.75 + 0.25 * Math.sin(t * 4));
    const g = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.3, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
    g.addColorStop(0, 'rgba(120,0,20,0)');
    g.addColorStop(1, `rgba(150,10,30,${a.toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);
  }
  if (stopflow) {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#7a5cff';
    ctx.fillRect(0, 0, vw, vh);
    ctx.restore();
  }
  if (fx && fx.flash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.6, fx.flash);
    ctx.fillStyle = fx.flashColor;
    ctx.fillRect(0, 0, vw, vh);
    ctx.restore();
  }
}

export function domeShimmer(ctx, points, t) {
  if (!points.length) return;
  ctx.save();
  ctx.globalAlpha = 0.28 + 0.08 * Math.sin(t * 4);
  ctx.strokeStyle = '#b6f0ff';
  ctx.fillStyle = rgba('#7fd8ff', 0.18);
  ctx.lineWidth = 26;
  ctx.lineCap = 'round';
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y - 8) : ctx.moveTo(p.x, p.y - 8)));
  ctx.stroke();
  ctx.restore();
}
