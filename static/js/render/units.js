import { shade, rgba, mix } from './color.js';
import { TAU, ellipse, circle, face, capsulePath, antibody, hpBar, shield, glow } from './shapes.js';

const SIZE = {
  rotavirus: 12, etec: 8, cholera: 10, shigella: 11, typhoid: 12, amoeba: 16, amoeba_cyst: 8,
  hpylori: 12, candida: 12, worm: 10, cdiff: 12,
};

const FALLBACK_GROUP_COLOR = '#999999';

export function unitRadius(key) {
  return SIZE[key] || 11;
}

export function unitColor(gd, key) {
  const def = unitDef(gd, key);
  const g = def && gd && gd.groups ? gd.groups[def.group] : null;
  return (g && g.color) || FALLBACK_GROUP_COLOR;
}

const defCache = new WeakMap();
export function unitDef(gd, key) {
  if (!gd || !Array.isArray(gd.units)) return null;
  let m = defCache.get(gd);
  if (!m) {
    m = new Map(gd.units.map((u) => [u.key, u]));
    defCache.set(gd, m);
  }
  return m.get(key) || null;
}

function outline(ctx, color, w) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}

function bodyGradient(ctx, r, color) {
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.1, 0, 0, r * 1.4);
  g.addColorStop(0, shade(color, 0.55));
  g.addColorStop(0.55, shade(color, 0.12));
  g.addColorStop(1, shade(color, -0.25));
  return g;
}

function drawRotavirus(ctx, r, c, t, moving) {
  const spin = moving ? t * 3 : t * 0.6;
  ctx.fillStyle = shade(c, -0.2);
  for (let i = 0; i < 14; i++) {
    const a = spin * 0.3 + (i / 14) * TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - 0.14) * r * 0.95, Math.sin(a - 0.14) * r * 0.95);
    ctx.lineTo(Math.cos(a) * r * 1.38, Math.sin(a) * r * 1.38);
    ctx.lineTo(Math.cos(a + 0.14) * r * 0.95, Math.sin(a + 0.14) * r * 0.95);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade(c, 0.35);
    circle(ctx, Math.cos(a) * r * 1.38, Math.sin(a) * r * 1.38, r * 0.1);
    ctx.fill();
    ctx.fillStyle = shade(c, -0.2);
  }
  ctx.fillStyle = bodyGradient(ctx, r, c);
  circle(ctx, 0, 0, r);
  ctx.fill();
  outline(ctx, shade(c, -0.4), r * 0.1);
  ctx.strokeStyle = rgba(shade(c, 0.5), 0.7);
  ctx.lineWidth = r * 0.09;
  circle(ctx, 0, 0, r * 0.78);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = spin + (i / 6) * TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62);
    ctx.lineTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78);
    ctx.stroke();
  }
}

function drawRod(ctx, r, c, len, rad, opts = {}) {
  if (opts.pili) {
    ctx.strokeStyle = rgba(shade(c, -0.3), 0.8);
    ctx.lineWidth = Math.max(0.5, r * 0.08);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      const px = Math.cos(a) * len * 0.5, py = Math.sin(a) * rad;
      ctx.beginPath();
      ctx.moveTo(px * 0.9, py * 0.9);
      ctx.lineTo(px * 0.9 + Math.cos(a) * r * 0.35, py * 0.9 + Math.sin(a) * r * 0.35);
      ctx.stroke();
    }
  }
  ctx.fillStyle = bodyGradient(ctx, r, c);
  capsulePath(ctx, len, rad);
  ctx.fill();
  outline(ctx, shade(c, -0.42), Math.max(0.7, r * 0.1));
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-len * 0.12, -rad * 0.5, len * 0.28, rad * 0.2, 0, 0, TAU);
  ctx.fill();
}

function wavyLine(ctx, x0, y0, ang, len, amp, waves, phase) {
  ctx.beginPath();
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const along = k * len;
    const off = Math.sin(k * waves * TAU + phase) * amp * Math.min(1, k * 3);
    const x = x0 + Math.cos(ang) * along - Math.sin(ang) * off;
    const y = y0 + Math.sin(ang) * along + Math.cos(ang) * off;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawCholera(ctx, r, c, t) {
  ctx.strokeStyle = shade(c, -0.35);
  ctx.lineWidth = Math.max(0.6, r * 0.13);
  ctx.lineCap = 'round';
  wavyLine(ctx, -r * 1.05, r * 0.15, Math.PI + 0.15, r * 1.9, r * 0.28, 2, -t * 14);
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, r * 1.25, r * 1.55, -Math.PI * 0.79, -Math.PI * 0.21);
  ctx.lineCap = 'round';
  ctx.lineWidth = r * 1.2;
  ctx.strokeStyle = shade(c, -0.42);
  ctx.stroke();
  ctx.lineWidth = r * 1.0;
  ctx.strokeStyle = shade(c, 0.12);
  ctx.stroke();
  ctx.lineWidth = r * 0.3;
  ctx.strokeStyle = rgba(shade(c, 0.6), 0.7);
  ctx.beginPath();
  ctx.arc(0, r * 1.25, r * 1.75, -Math.PI * 0.68, -Math.PI * 0.42);
  ctx.stroke();
  ctx.restore();
}

function drawTyphoid(ctx, r, c, t) {
  ctx.strokeStyle = shade(c, -0.3);
  ctx.lineWidth = Math.max(0.5, r * 0.08);
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    const sx = Math.cos(a) * r * 1.05, sy = Math.sin(a) * r * 0.62;
    wavyLine(ctx, sx, sy, a, r * 1.1, r * 0.16, 1.5, -t * 12 + i);
  }
  drawRod(ctx, r, c, r * 2.5, r * 0.72);
}

function drawAmoeba(ctx, r, c, t, id) {
  const body = mix(c, '#ffffff', 0.25);
  ctx.beginPath();
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (1 + 0.2 * Math.sin(3 * a + t * 1.7 + id) + 0.1 * Math.sin(5 * a - t * 2.6) + (Math.cos(a) > 0.6 ? 0.12 : 0));
    const x = Math.cos(a) * rr * 1.1, y = Math.sin(a) * rr * 0.8;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 1.3);
  g.addColorStop(0, rgba(shade(body, 0.4), 0.95));
  g.addColorStop(1, rgba(shade(body, -0.1), 0.9));
  ctx.fillStyle = g;
  ctx.fill();
  outline(ctx, shade(c, -0.35), r * 0.08);
  ctx.fillStyle = '#d8434f';
  circle(ctx, r * 0.45, r * 0.35, r * 0.13);
  ctx.fill();
  circle(ctx, -r * 0.55, r * 0.3, r * 0.11);
  ctx.fill();
  ctx.strokeStyle = shade(c, -0.4);
  ctx.lineWidth = r * 0.06;
  circle(ctx, -r * 0.5, -r * 0.05, r * 0.2);
  ctx.stroke();
  ctx.fillStyle = shade(c, -0.45);
  circle(ctx, -r * 0.5, -r * 0.05, r * 0.06);
  ctx.fill();
}

function drawCyst(ctx, r, c) {
  ctx.fillStyle = bodyGradient(ctx, r, mix(c, '#fff4d6', 0.4));
  circle(ctx, 0, 0, r);
  ctx.fill();
  outline(ctx, shade(c, -0.45), r * 0.24);
  ctx.strokeStyle = rgba(shade(c, 0.5), 0.8);
  ctx.lineWidth = r * 0.08;
  circle(ctx, 0, 0, r * 0.84);
  ctx.stroke();
  ctx.fillStyle = shade(c, -0.5);
  for (const [x, y] of [[-0.35, -0.35], [0.38, -0.3], [-0.3, 0.38], [0.35, 0.35]]) {
    circle(ctx, x * r, y * r, r * 0.12);
    ctx.fill();
  }
}

function drawHpylori(ctx, r, c, t, moving) {
  const ph = moving ? -t * 9 : -t * 2;
  ctx.strokeStyle = shade(c, -0.3);
  ctx.lineWidth = Math.max(0.5, r * 0.08);
  for (let i = 0; i < 5; i++) {
    wavyLine(ctx, -r * 1.35, 0, Math.PI + (i - 2) * 0.28, r * 1.1, r * 0.12, 1.5, ph * 1.4 + i);
  }
  ctx.lineCap = 'round';
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const k = i / 24;
    const x = -r * 1.4 + k * r * 2.8;
    const y = Math.sin(k * 2.2 * TAU + ph) * r * 0.42;
    pts.push([x, y]);
  }
  const layers = [[r * 0.78, shade(c, -0.42), 0], [r * 0.6, shade(c, 0.1), 0], [r * 0.18, rgba(shade(c, 0.6), 0.75), r * 0.12]];
  for (const [w, col, dy] of layers) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y - dy) : ctx.moveTo(x, y - dy)));
    ctx.lineWidth = w;
    ctx.strokeStyle = col;
    ctx.stroke();
  }
}

function drawCandida(ctx, r, c, t) {
  const bud = 0.55 + 0.05 * Math.sin(t * 2);
  ctx.save();
  ctx.translate(r * 0.95, -r * 0.6);
  ctx.fillStyle = bodyGradient(ctx, r * bud, c);
  ellipse(ctx, 0, 0, r * bud, r * bud * 0.9, -0.5);
  ctx.fill();
  outline(ctx, shade(c, -0.45), r * 0.08);
  ctx.restore();
  ctx.fillStyle = bodyGradient(ctx, r, c);
  ellipse(ctx, 0, 0, r * 1.05, r * 0.9);
  ctx.fill();
  outline(ctx, shade(c, -0.45), r * 0.1);
  ctx.fillStyle = rgba(shade(c, -0.25), 0.5);
  circle(ctx, -r * 0.55, r * 0.45, r * 0.12);
  ctx.fill();
}

function drawCdiff(ctx, r, c, t) {
  const body = mix(c, '#ffffff', 0.3);
  ctx.globalAlpha *= 0.85;
  ctx.fillStyle = rgba(body, 0.75);
  ctx.beginPath();
  ctx.moveTo(-r * 1.2, -r * 0.1);
  ctx.quadraticCurveTo(-r * 1.2, -r * 0.85, 0, -r * 0.85);
  ctx.quadraticCurveTo(r * 1.25, -r * 0.85, r * 1.25, -r * 0.1);
  ctx.lineTo(r * 1.25, r * 0.55);
  for (let i = 0; i <= 6; i++) {
    const x = r * 1.25 - (i / 6) * r * 2.45;
    const y = r * 0.55 + Math.sin(i * 1.7 + t * 6) * r * 0.22 + (i % 2 ? r * 0.18 : 0);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  outline(ctx, rgba(shade(c, -0.4), 0.8), r * 0.08);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ellipse(ctx, -r * 0.95, -r * 0.2, r * 0.42, r * 0.5);
  ctx.fill();
  ctx.strokeStyle = rgba(shade(c, -0.3), 0.8);
  ctx.lineWidth = r * 0.07;
  ctx.stroke();
}

function drawShigella(ctx, r, c) {
  drawRod(ctx, r, c, r * 2.7, r * 0.8);
}

function drawEtec(ctx, r, c) {
  drawRod(ctx, r, c, r * 2.6, r * 0.78, { pili: true });
}

const MOODS = {
  rotavirus: 'grin', etec: 'happy', cholera: 'grin', shigella: 'angry', typhoid: 'sly', amoeba: 'happy',
  amoeba_cyst: 'sleep', hpylori: 'grin', candida: 'happy', worm: 'happy', cdiff: 'spooky',
};

const FACE = {
  rotavirus: [0, 0, 0.62], etec: [0.25, 0, 0.6], cholera: [0.15, -0.05, 0.62], shigella: [0.35, 0, 0.62],
  typhoid: [0.35, 0, 0.6], amoeba: [0.2, -0.05, 0.55], amoeba_cyst: [0, 0, 0.55], hpylori: [0.75, -0.1, 0.5],
  candida: [0, 0, 0.62], cdiff: [0.3, -0.25, 0.55],
};

function statusUnder(ctx, o, r) {
  const t = o.t;
  if (o.quorum) {
    glow(ctx, 0, 0, r * 2.1, '#d6ff3d', 0.55 + 0.15 * Math.sin(t * 8));
    ctx.strokeStyle = 'rgba(214,255,61,0.75)';
    ctx.lineWidth = r * 0.1;
    for (let k = 0; k < 2; k++) {
      const p = (t * 1.6 + k * 0.5) % 1;
      circle(ctx, 0, 0, r * (1.2 + p * 1.1));
      ctx.globalAlpha = (1 - p) * 0.8;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  if (o.fever) glow(ctx, 0, 0, r * 2.2, '#ff6a2a', 0.38 + 0.12 * Math.sin(t * 5 + o.id));
}

function statusOver(ctx, o, r) {
  const t = o.t;
  if (o.trapped) {
    const p = 0.5 + 0.5 * Math.sin(t * 9);
    ctx.strokeStyle = `rgba(240,40,60,${(0.45 + 0.45 * p).toFixed(3)})`;
    ctx.lineWidth = r * 0.16;
    circle(ctx, 0, 0, r * (1.35 + 0.15 * p));
    ctx.stroke();
  }
  if (o.neutralised) {
    for (let k = 0; k < 3; k++) {
      const a = -Math.PI / 2 + (k - 1) * 0.9;
      antibody(ctx, Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.85, r * 0.62, a + Math.PI / 2, '#ffffff', '#3a6fd8');
    }
  }
  if (o.vaccinated) shield(ctx, -r * 1.05, -r * 0.95, r * 0.42, '#3e7bfa');
}

export function drawUnit(ctx, o) {
  const key = o.key;
  let r = unitRadius(key) * (o.overgrowth ? 1.3 : 1) * (o.scale || 1);
  const c = o.color || FALLBACK_GROUP_COLOR;
  const t = o.t || 0;
  const id = o.id || 0;
  if (key === 'worm' && Array.isArray(o.segments) && o.segments.length) {
    drawWorm(ctx, o, r, c);
    return;
  }
  const bob = o.moving ? Math.abs(Math.sin(t * 9 + id * 1.3)) * r * 0.25 : Math.sin(t * 3 + id) * r * 0.06;
  const lunge = o.attacking ? Math.max(0, Math.sin(t * 14 + id)) * r * 0.35 : 0;
  const x = o.x + lunge * (o.dir || 1), y = o.y - r * 0.95 - bob;
  ctx.save();
  if (o.invisible) ctx.globalAlpha *= 0.38;
  ctx.fillStyle = 'rgba(60,20,40,0.22)';
  ellipse(ctx, o.x, o.y, r * 0.95, r * 0.42);
  ctx.fill();
  ctx.translate(x, y);
  statusUnder(ctx, o, r);
  ctx.save();
  if ((o.dir || 1) < 0) ctx.scale(-1, 1);
  switch (key) {
    case 'rotavirus': drawRotavirus(ctx, r, c, t, o.moving); break;
    case 'etec': drawEtec(ctx, r, c); break;
    case 'cholera': drawCholera(ctx, r, c, t); break;
    case 'shigella': drawShigella(ctx, r, c); break;
    case 'typhoid': drawTyphoid(ctx, r, c, t); break;
    case 'amoeba': drawAmoeba(ctx, r, c, t, id); break;
    case 'amoeba_cyst': drawCyst(ctx, r, c); break;
    case 'hpylori': drawHpylori(ctx, r, c, t, o.moving); break;
    case 'candida': drawCandida(ctx, r, c, t); break;
    case 'cdiff': drawCdiff(ctx, r, c, t); break;
    default: drawRod(ctx, r, c, r * 2.4, r * 0.8);
  }
  const f = FACE[key] || [0.2, 0, 0.6];
  const blink = ((t * 0.7 + id * 0.37) % 4) < 0.12;
  face(ctx, f[0] * r, f[1] * r, f[2] * r * 1.25, o.hurt ? 'hurt' : (MOODS[key] || 'happy'), 0.6, blink);
  ctx.restore();
  if (o.invisible) {
    ctx.setLineDash([r * 0.3, r * 0.25]);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = r * 0.1;
    circle(ctx, 0, 0, r * 1.25);
    ctx.lineDashOffset = -t * 20;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  statusOver(ctx, o, r);
  ctx.restore();
  if (o.showHp && o.hpFrac < 1) hpBar(ctx, o.x, y - r * 1.75 - 4, Math.max(18, r * 2.2), 3.2, o.hpFrac);
}

function drawWorm(ctx, o, r, c) {
  const t = o.t || 0;
  const body = mix(c, '#f3d2b3', 0.55);
  const segs = o.segments;
  ctx.save();
  if (o.invisible) ctx.globalAlpha *= 0.38;
  for (let i = segs.length - 1; i >= 0; i--) {
    const p = segs[i];
    const k = 1 - (i / segs.length) * 0.45;
    const sr = r * k;
    const wig = Math.sin(t * 6 - i * 0.9) * r * 0.25;
    ctx.fillStyle = 'rgba(60,20,40,0.18)';
    ellipse(ctx, p.x, p.y, sr, sr * 0.45);
    ctx.fill();
    const y = p.y - sr * 0.9 + wig * 0.3;
    ctx.fillStyle = shade(body, i % 2 ? -0.06 : 0.04);
    circle(ctx, p.x, y, sr);
    ctx.fill();
    ctx.strokeStyle = shade(c, -0.15);
    ctx.lineWidth = sr * 0.14;
    ctx.stroke();
  }
  const head = segs[0];
  const hy = head.y - r * 0.95;
  ctx.translate(head.x, hy);
  if (o.fever) glow(ctx, 0, 0, r * 2, '#ff6a2a', 0.3);
  statusUnder(ctx, o, r);
  ctx.save();
  if ((o.dir || 1) < 0) ctx.scale(-1, 1);
  ctx.fillStyle = body;
  circle(ctx, 0, 0, r * 1.12);
  ctx.fill();
  ctx.strokeStyle = shade(c, -0.25);
  ctx.lineWidth = r * 0.14;
  ctx.stroke();
  const blink = ((t * 0.6 + (o.id || 0) * 0.3) % 5) < 0.12;
  face(ctx, r * 0.15, 0, r * 0.8, o.hurt ? 'hurt' : 'happy', 0.6, blink);
  ctx.restore();
  statusOver(ctx, o, r);
  ctx.restore();
  if (o.showHp && o.hpFrac < 1) hpBar(ctx, head.x, hy - r * 2 - 4, 34, 3.4, o.hpFrac);
}

export function drawUnitIcon(ctx, gd, key, size, t = 0) {
  const c = unitColor(gd, key);
  const r = unitRadius(key);
  const scale = (size * 0.36) / (key === 'worm' ? r * 1.4 : key === 'etec' ? r * 1.5 : r * 1.25);
  ctx.save();
  ctx.translate(size / 2, size / 2 + size * 0.14);
  ctx.scale(scale, scale);
  if (key === 'worm') {
    const segs = [];
    for (let i = 0; i < 6; i++) segs.push({ x: 18 - i * 7.5, y: Math.sin(i * 0.9) * 3 });
    drawWorm(ctx, { key, t, id: 1, segments: segs, dir: 1 }, r, c);
  } else {
    drawUnit(ctx, { key, x: 0, y: r * 0.95, t, id: 1, color: c, dir: 1 });
  }
  ctx.restore();
}
