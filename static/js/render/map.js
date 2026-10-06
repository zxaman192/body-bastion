import { toIso, hash01, GROUND_H } from './geom.js';
import { mix, shade, rgba } from './color.js';

const TISSUE = '#eaa3ab';
const TISSUE_SIDE_A = '#cf7d8b';
const TISSUE_SIDE_B = '#b9667a';
const BASE_DEPTH = 46;
const BASE_A = '#a4506a';
const BASE_B = '#7c3550';

function diamond(ctx, cx, cy, hw, hh) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
}

function tileCorners(T, i, j, lift) {
  const h = T / 2;
  const top = toIso(i * T - h, j * T - h);
  const right = toIso(i * T + h, j * T - h);
  const bottom = toIso(i * T + h, j * T + h);
  const left = toIso(i * T - h, j * T + h);
  return {
    top: { x: top.x, y: top.y - lift }, right: { x: right.x, y: right.y - lift },
    bottom: { x: bottom.x, y: bottom.y - lift }, left: { x: left.x, y: left.y - lift },
  };
}

function quad(ctx, a, b, c, d) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
}

function tileFill(ctx, c) {
  quad(ctx, c.top, c.right, c.bottom, c.left);
}

function groundTint(geom, i, j) {
  const { tile, dist } = geom.nearestPathTile(i, j);
  if (!tile) return TISSUE;
  const w = Math.max(0, 0.42 - dist * 0.07);
  return mix(TISSUE, tile.color, w);
}

function drawTissueTexture(ctx, c, i, j, base) {
  const n = 2 + Math.floor(hash01(i, j, 3) * 2);
  for (let k = 0; k < n; k++) {
    const u = hash01(i, j, 10 + k) * 0.6 + 0.2;
    const v = hash01(i, j, 20 + k) * 0.6 + 0.2;
    const x = c.top.x + (c.right.x - c.top.x) * u + (c.left.x - c.top.x) * v;
    const y = c.top.y + (c.right.y - c.top.y) * u + (c.left.y - c.top.y) * v;
    const r = 4 + hash01(i, j, 30 + k) * 4;
    ctx.fillStyle = rgba(shade(base, 0.25), 0.55);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba(shade(base, -0.28), 0.5);
    ctx.beginPath();
    ctx.ellipse(x + 0.6, y, r * 0.32, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function lumenTexture(ctx, c, t, i, j) {
  const cx = (c.top.x + c.bottom.x) / 2, cy = (c.top.y + c.bottom.y) / 2;
  const base = t.color;
  ctx.save();
  tileFill(ctx, c);
  ctx.clip();
  if (t.zone === 'stomach') {
    ctx.strokeStyle = rgba(shade(base, -0.22), 0.7);
    ctx.lineWidth = 2.2;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      for (let q = -30; q <= 30; q += 5) {
        const x = cx + q, y = cy + k * 9 + Math.sin((q + i * 13) * 0.25) * 2.5;
        if (q === -30) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (t.zone === 'si') {
    for (let k = 0; k < 9; k++) {
      const u = (k % 3) / 3 + 0.17 + (hash01(i, j, k) - 0.5) * 0.1;
      const v = Math.floor(k / 3) / 3 + 0.17 + (hash01(j, i, k) - 0.5) * 0.1;
      const x = c.top.x + (c.right.x - c.top.x) * u + (c.left.x - c.top.x) * v;
      const y = c.top.y + (c.right.y - c.top.y) * u + (c.left.y - c.top.y) * v;
      ctx.fillStyle = rgba(shade(base, -0.18), 0.8);
      ctx.beginPath();
      ctx.ellipse(x, y + 1.2, 4.2, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba(shade(base, 0.35), 0.95);
      ctx.beginPath();
      ctx.ellipse(x - 0.6, y - 0.4, 3, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (t.zone === 'colon') {
    ctx.strokeStyle = rgba(shade(base, -0.25), 0.75);
    ctx.lineWidth = 2;
    for (let k = -1; k <= 1; k += 2) {
      ctx.beginPath();
      ctx.ellipse(cx + k * 14, cy, 12, 16, 0.5, -1.2, 1.2);
      ctx.stroke();
    }
    for (let k = 0; k < 5; k++) {
      const x = cx + (hash01(i, j, 40 + k) - 0.5) * 50;
      const y = cy + (hash01(i, j, 50 + k) - 0.5) * 22;
      ctx.fillStyle = k % 2 ? 'rgba(80,150,70,0.55)' : 'rgba(150,110,190,0.45)';
      ctx.beginPath();
      ctx.ellipse(x, y, 2.4, 1.3, hash01(i, j, k) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (t.zone === 'liver') {
    ctx.strokeStyle = rgba(shade(base, -0.25), 0.7);
    ctx.lineWidth = 1.6;
    for (let k = 0; k < 2; k++) {
      const x = cx + (k ? 16 : -14), y = cy + (k ? 4 : -3);
      ctx.beginPath();
      for (let a = 0; a <= 6; a++) {
        const ang = (a / 6) * Math.PI * 2;
        const px = x + Math.cos(ang) * 11, py = y + Math.sin(ang) * 6;
        if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.fillStyle = rgba(shade(base, -0.35), 0.7);
      ctx.beginPath();
      ctx.ellipse(x, y, 2.2, 1.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    for (let k = 0; k < 7; k++) {
      const x = cx + (hash01(i, j, 60 + k) - 0.5) * 56;
      const y = cy + (hash01(i, j, 70 + k) - 0.5) * 26;
      ctx.fillStyle = k % 3 === 0 ? 'rgba(200,60,80,0.55)' : 'rgba(150,100,200,0.45)';
      ctx.beginPath();
      ctx.ellipse(x, y, 2.6, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawPlinth(ctx, geom, info) {
  const T = geom.T;
  const q = toIso(info.x, info.y);
  const y = q.y - GROUND_H;
  if (info.kind === 'slot') {
    ctx.fillStyle = 'rgba(255,240,244,0.30)';
    diamond(ctx, q.x, y, 30, 15);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (info.kind === 'wall' || info.kind === 'kupffer') {
    const d = geom.dirAt(info.s);
    const half = T * 0.46;
    const ends = d.dx !== 0
      ? [toIso(info.x, info.y - half), toIso(info.x, info.y + half)]
      : [toIso(info.x - half, info.y), toIso(info.x + half, info.y)];
    for (const e of ends) {
      ctx.fillStyle = info.kind === 'kupffer' ? 'rgba(140,40,50,0.55)' : 'rgba(110,50,80,0.45)';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, 5, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(ends[0].x, ends[0].y);
    ctx.lineTo(ends[1].x, ends[1].y);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (info.kind === 'core') {
    ctx.fillStyle = 'rgba(220,203,239,0.55)';
    ctx.beginPath();
    ctx.ellipse(q.x, y, 62, 31, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(255,240,244,0.22)';
    ctx.beginPath();
    ctx.ellipse(q.x, y, 42, 21, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

export function drawGround(ctx, geom) {
  const { T, W, H } = geom;
  const order = [];
  for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) order.push([i, j]);
  order.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]) || a[0] - b[0]);
  const pathTileMap = new Map(geom.pathTiles.map((t) => [t.i + ',' + t.j, t]));

  for (const [i, j] of order) {
    const pt = pathTileMap.get(i + ',' + j);
    if (pt) {
      const c = tileCorners(T, i, j, 0);
      ctx.fillStyle = shade(pt.color, -0.04);
      tileFill(ctx, c);
      ctx.fill();
      lumenTexture(ctx, c, pt, i, j);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(120,40,70,0.28)';
      if (!geom.isPath(i - 1, j)) { ctx.beginPath(); ctx.moveTo(c.top.x, c.top.y); ctx.lineTo(c.left.x, c.left.y); ctx.stroke(); }
      if (!geom.isPath(i, j - 1)) { ctx.beginPath(); ctx.moveTo(c.top.x, c.top.y); ctx.lineTo(c.right.x, c.right.y); ctx.stroke(); }
      if (i === W - 1 || j === H - 1) drawEdgeSides(ctx, T, i, j, W, H, 0, pt.color);
      continue;
    }
    const base = groundTint(geom, i, j);
    const c = tileCorners(T, i, j, GROUND_H);
    const raisedRight = i + 1 < W && !geom.isPath(i + 1, j);
    const raisedFront = j + 1 < H && !geom.isPath(i, j + 1);
    if (!raisedRight && i + 1 < W) {
      const b = tileCorners(T, i, j, 0);
      ctx.fillStyle = TISSUE_SIDE_A;
      quad(ctx, c.right, c.bottom, b.bottom, b.right);
      ctx.fill();
    }
    if (!raisedFront && j + 1 < H) {
      const b = tileCorners(T, i, j, 0);
      ctx.fillStyle = TISSUE_SIDE_B;
      quad(ctx, c.bottom, c.left, b.left, b.bottom);
      ctx.fill();
    }
    if (i === W - 1 || j === H - 1) drawEdgeSides(ctx, T, i, j, W, H, GROUND_H, base);
    ctx.fillStyle = base;
    tileFill(ctx, c);
    ctx.fill();
    ctx.strokeStyle = rgba(shade(base, -0.12), 0.45);
    ctx.lineWidth = 1;
    ctx.stroke();
    drawTissueTexture(ctx, c, i, j, base);
  }

  for (const info of geom.sites.values()) drawPlinth(ctx, geom, info);
}

function drawEdgeSides(ctx, T, i, j, W, H, lift, base) {
  const top = tileCorners(T, i, j, lift);
  const bot = tileCorners(T, i, j, -BASE_DEPTH);
  if (i === W - 1) {
    const g = ctx.createLinearGradient(0, top.right.y, 0, bot.bottom.y);
    g.addColorStop(0, shade(base, -0.25));
    g.addColorStop(0.25, BASE_A);
    g.addColorStop(1, BASE_B);
    ctx.fillStyle = g;
    quad(ctx, top.right, top.bottom, bot.bottom, bot.right);
    ctx.fill();
  }
  if (j === H - 1) {
    const g = ctx.createLinearGradient(0, top.left.y, 0, bot.bottom.y);
    g.addColorStop(0, shade(base, -0.32));
    g.addColorStop(0.25, shade(BASE_A, -0.08));
    g.addColorStop(1, shade(BASE_B, -0.1));
    ctx.fillStyle = g;
    quad(ctx, top.bottom, top.left, bot.left, bot.bottom);
    ctx.fill();
  }
}

export class GroundCache {
  constructor(geom) {
    this.geom = geom;
    this.canvas = null;
    this.res = 0;
    this.pending = 0;
  }

  wanted(scale, dpr) {
    const b = this.geom.groundBounds;
    const w = b.x1 - b.x0, h = b.y1 - b.y0;
    const maxRes = Math.min(4096 / w, 4096 / h);
    const r = Math.min(maxRes, Math.max(0.25, scale * dpr));
    return Math.round(r * 8) / 8;
  }

  ensure(scale, dpr, force) {
    const r = this.wanted(scale, dpr);
    if (this.canvas && !force && r <= this.res * 1.3 && r >= this.res * 0.6) return;
    if (typeof document === 'undefined') return;
    const b = this.geom.groundBounds;
    const w = Math.max(1, Math.ceil((b.x1 - b.x0) * r));
    const h = Math.max(1, Math.ceil((b.y1 - b.y0) * r));
    const cv = this.canvas && this.canvas.width === w && this.canvas.height === h ? this.canvas : document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(r, 0, 0, r, -b.x0 * r, -b.y0 * r);
    drawGround(ctx, this.geom);
    this.canvas = cv;
    this.res = r;
  }

  draw(ctx) {
    if (!this.canvas) return;
    const b = this.geom.groundBounds;
    ctx.drawImage(this.canvas, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  }
}

function pathTilesBetween(geom, s0, s1) {
  return geom.pathTiles.filter((t) => t.s >= s0 - 1 && t.s < s1);
}

export function drawAcidSheen(ctx, geom, s0, s1, t, strength) {
  const tiles = pathTilesBetween(geom, s0, s1);
  ctx.save();
  for (const tile of tiles) {
    const c = tileCorners(geom.T, tile.i, tile.j, 0);
    const a = 0.16 + 0.06 * Math.sin(t * 2 + tile.i * 0.7 + tile.j) * strength;
    ctx.fillStyle = `rgba(190,230,60,${(a * strength).toFixed(3)})`;
    tileFill(ctx, c);
    ctx.fill();
    for (let k = 0; k < 2; k++) {
      const ph = (t * 0.7 + hash01(tile.i, tile.j, k)) % 1;
      const cx = (c.top.x + c.bottom.x) / 2 + (hash01(tile.i, tile.j, k + 5) - 0.5) * 40;
      const cy = (c.top.y + c.bottom.y) / 2 + (hash01(tile.i, tile.j, k + 9) - 0.5) * 16 - ph * 10;
      ctx.strokeStyle = `rgba(230,255,140,${(0.8 * (1 - ph) * strength).toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, 2 + ph * 2.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawPeristalsisBands(ctx, geom, s0, s1, t, period) {
  const span = s1 - s0;
  if (span <= 0) return;
  ctx.save();
  const phase = ((t * 1000) % period) / period;
  for (let k = 0; k < 3; k++) {
    const s = s0 + ((phase + k / 3) % 1) * span;
    const p = geom.posAt(s);
    const d = geom.dirAt(s);
    const half = geom.T * 0.45;
    const a = d.dx !== 0 ? toIso(p.x, p.y - half) : toIso(p.x - half, p.y);
    const b = d.dx !== 0 ? toIso(p.x, p.y + half) : toIso(p.x + half, p.y);
    ctx.strokeStyle = 'rgba(200,70,90,0.35)';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPathSpan(ctx, geom, s0, s1, fill, stroke) {
  const tiles = pathTilesBetween(geom, Math.max(0, s0 - geom.T / 2), Math.min(geom.len + 1, s1 + geom.T / 2));
  ctx.save();
  ctx.fillStyle = fill;
  for (const tile of tiles) {
    const c = tileCorners(geom.T, tile.i, tile.j, 0);
    tileFill(ctx, c);
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    for (const tile of tiles) {
      const c = tileCorners(geom.T, tile.i, tile.j, 0);
      tileFill(ctx, c);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  ctx.restore();
}

export function drawRangeIntervals(ctx, geom, intervals, color) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = 16;
  for (const [a, b] of intervals) {
    ctx.beginPath();
    const steps = Math.max(2, Math.ceil((b - a) / 50));
    for (let k = 0; k <= steps; k++) {
      const p = geom.posAt(a + ((b - a) * k) / steps);
      const q = toIso(p.x, p.y);
      if (k === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function drawRangeRing(ctx, ix, iy, r, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = rgba('#ffffff', 0.06);
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.ellipse(ix, iy, r * Math.SQRT1_2, r * Math.SQRT1_2 * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

export function drawMouth(ctx, geom, t, open) {
  const q = toIso(geom.mouth.x, geom.mouth.y);
  const x = q.x, y = q.y - GROUND_H - 14;
  const o = 3 + open * 9 + Math.sin(t * 3) * 0.8;
  ctx.save();
  ctx.fillStyle = 'rgba(60,20,40,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, q.y - GROUND_H + 4, 26, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a1630';
  ctx.beginPath();
  ctx.ellipse(x, y, 19, o, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  for (let k = -2; k <= 2; k++) {
    ctx.fillRect(x + k * 6 - 2.2, y - o + 0.5, 4.4, Math.min(5, o * 0.6));
  }
  ctx.fillStyle = '#e8577a';
  ctx.beginPath();
  ctx.moveTo(x - 24, y);
  ctx.quadraticCurveTo(x - 10, y - o - 12, x, y - o - 4);
  ctx.quadraticCurveTo(x + 10, y - o - 12, x + 24, y);
  ctx.quadraticCurveTo(x, y - o + 1, x - 24, y);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 24, y);
  ctx.quadraticCurveTo(x, y + o + 1, x + 24, y);
  ctx.quadraticCurveTo(x, y + o + 13, x - 24, y);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(x - 8, y + o + 6, 6, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return { x, y: y - 20 };
}
