// The base as an anatomical dissection: the opened gut tube (stomach rugae, small-intestine folds,
// colon haustra, then the portal vein and a vessel to the marrow) lying on yellow mesenteric fat with
// its vessel arcades, beside the liver, gallbladder, spleen, coils of bowel and a marrow-filled bone.
import { toIso, hash01, GROUND_H, RIM_H, WALL_W } from './geom.js';
import { mix, shade, rgba } from './color.js';
import { tissuePattern } from './textures.js';

const TAU = Math.PI * 2;
const G = GROUND_H;

const FLOOR_TEX = { stomach: 'stomach', si: 'si', colon: 'colon', liver: 'vein', core: 'core' };

const LOOK = {
  stomach: { floor: '#e3877e', fold: '#a8443d', glint: '#ffd3c9', serosa: '#e7a08f', serosaDark: '#b0614f' },
  si: { floor: '#eb9a88', fold: '#b45a4b', glint: '#ffdcd0', serosa: '#efae9f', serosaDark: '#bd7465' },
  colon: { floor: '#dba595', fold: '#9c6352', glint: '#fbe3d8', serosa: '#e8c3ae', serosaDark: '#b28772' },
  liver: { floor: '#7b2a4c', fold: '#4a1430', glint: '#d7a3c8', serosa: '#7b5aa0', serosaDark: '#46306e' },
  core: { floor: '#a5212f', fold: '#62101a', glint: '#ffb3bc', serosa: '#c63a4b', serosaDark: '#82202d' },
};

// Abdominal wall cross-section shown on the diorama's sides, top to bottom.
const WALL_LAYERS = [
  { h: 5, a: '#f6dcdc', b: '#dcbdbd' },   // parietal peritoneum
  { h: 20, a: '#b9404a', b: '#97303b' },  // muscle
  { h: 24, a: '#f3d17a', b: '#d8b15c' },  // subcutaneous fat
  { h: 9, a: '#e6b393', b: '#c89676' },   // skin
];
const SLAB_DEPTH = WALL_LAYERS.reduce((n, l) => n + l.h, 0);

function lerp(a, b, k) {
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function iso(x, y, lift = 0) {
  const q = toIso(x, y);
  return { x: q.x, y: q.y - lift };
}

function poly(ctx, pts) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

function line(ctx, pts) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
}

function smoothLine(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let k = 1; k < pts.length - 1; k++) {
    const m = lerp(pts[k], pts[k + 1], 0.5);
    ctx.quadraticCurveTo(pts[k].x, pts[k].y, m.x, m.y);
  }
  const l = pts[pts.length - 1];
  ctx.lineTo(l.x, l.y);
}

function topCorners(geom) {
  const { T, W, H } = geom;
  const h = T / 2;
  return {
    top: iso(-h, -h, G), right: iso(W * T - h, -h, G), bottom: iso(W * T - h, H * T - h, G), left: iso(-h, H * T - h, G),
  };
}

function clipTop(ctx, geom) {
  const c = topCorners(geom);
  poly(ctx, [c.top, c.right, c.bottom, c.left]);
  ctx.clip();
}

// Closed smooth shape through world control points (in tiles), as iso points at a lift.
function blob(geom, ctrl, lift, steps = 10) {
  const T = geom.T;
  const n = ctrl.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
    for (let k = 0; k < steps; k++) {
      const t = k / steps, t2 = t * t, t3 = t2 * t;
      const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push(iso(x * T, y * T, lift));
    }
  }
  return out;
}

function openSpline(geom, ctrl, step = 8) {
  const T = geom.T;
  const out = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let k = 0; k < step; k++) {
      const t = k / step, t2 = t * t, t3 = t2 * t;
      const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push({ x: x * T, y: y * T });
    }
  }
  const l = ctrl[ctrl.length - 1];
  out.push({ x: l[0] * T, y: l[1] * T });
  return out;
}

// ---------------------------------------------------------------- the gut tube (centre line)

const tubeCache = new WeakMap();

function tube(geom) {
  let t = tubeCache.get(geom);
  if (t) return t;
  const step = 6;
  const raw = [];
  for (let s = 0; s < geom.len; s += step) raw.push({ s, ...geom.posAt(s) });
  raw.push({ s: geom.len, ...geom.posAt(geom.len) });
  const n = raw.length;
  const k = Math.round(42 / step);
  const pts = raw.map((r, i) => {
    const m = Math.min(k, i, n - 1 - i);
    let x = 0, y = 0;
    for (let j = i - m; j <= i + m; j++) { x += raw[j].x; y += raw[j].y; }
    return { s: r.s, x: x / (2 * m + 1), y: y / (2 * m + 1) };
  });
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y;
    const l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    const p = pts[i];
    p.tx = tx; p.ty = ty; p.nx = -ty; p.ny = tx;
    p.h = geom.lumenHalf(p.s);
    p.zone = geom.zoneOf(Math.min(p.s, geom.len - 1)).key;
  }
  t = { pts };
  tubeCache.set(geom, t);
  return t;
}

function off(p, d, lift) {
  return iso(p.x + p.nx * d, p.y + p.ny * d, lift);
}

function floorPoly(pts) {
  const left = pts.map((p) => off(p, p.h, 0));
  const right = pts.map((p) => off(p, -p.h, 0)).reverse();
  return left.concat(right);
}

// Split [i0, i1) into runs where `key(i)` is constant.
function runs(n, key) {
  const out = [];
  let start = 0;
  let cur = key(0);
  for (let i = 1; i < n; i++) {
    const k = key(i);
    if (k !== cur) {
      out.push({ i0: start, i1: i, key: cur });
      start = i - 1;
      cur = k;
    }
  }
  out.push({ i0: start, i1: n - 1, key: cur });
  return out;
}

// ---------------------------------------------------------------- slab sides

function drawSlab(ctx, geom) {
  const c = topCorners(geom);
  const L = c.left, B = c.bottom, R = c.right;
  const at = (p, d) => ({ x: p.x, y: p.y + d });
  const fade = ctx.createLinearGradient(0, B.y, 0, B.y + SLAB_DEPTH + 40);
  fade.addColorStop(0, 'rgba(10,2,8,0.5)');
  fade.addColorStop(1, 'rgba(10,2,8,0)');
  ctx.fillStyle = fade;
  poly(ctx, [at(L, SLAB_DEPTH), at(B, SLAB_DEPTH), at(B, SLAB_DEPTH + 34), at(L, SLAB_DEPTH + 14)]);
  ctx.fill();
  poly(ctx, [at(B, SLAB_DEPTH), at(R, SLAB_DEPTH), at(R, SLAB_DEPTH + 14), at(B, SLAB_DEPTH + 34)]);
  ctx.fill();
  let d0 = 0;
  WALL_LAYERS.forEach((layer, li) => {
    const d1 = d0 + layer.h;
    for (const [p, q, col] of [[L, B, layer.a], [B, R, layer.b]]) {
      const g = ctx.createLinearGradient(0, at(p, d0).y, 0, at(p, d1).y);
      g.addColorStop(0, shade(col, 0.06));
      g.addColorStop(1, shade(col, -0.1));
      ctx.fillStyle = g;
      poly(ctx, [at(p, d0), at(q, d0), at(q, d1), at(p, d1)]);
      ctx.fill();
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      ctx.save();
      poly(ctx, [at(p, d0), at(q, d0), at(q, d1), at(p, d1)]);
      ctx.clip();
      if (li === 1) {
        // striated muscle fibres
        ctx.strokeStyle = rgba(shade(col, -0.45), 0.35);
        ctx.lineWidth = 0.9;
        for (let k = 1; k < 7; k++) {
          const dd = d0 + (layer.h * k) / 7;
          line(ctx, [at(p, dd), at(q, dd)]);
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255,190,190,0.25)';
        for (let u = 9; u < len; u += 14) {
          const a = lerp(at(p, d0), at(q, d0), u / len);
          line(ctx, [{ x: a.x, y: a.y + 2 }, { x: a.x + 2, y: a.y + layer.h - 2 }]);
          ctx.stroke();
        }
      } else if (li === 2) {
        // fat lobules
        const rnd = seeded(91 + li);
        for (let u = 4; u < len; u += 9) {
          for (let r = 0; r < 2; r++) {
            const a = lerp(at(p, d0 + 5 + r * 11 + rnd() * 4), at(q, d0 + 5 + r * 11 + rnd() * 4), (u + r * 4) / len);
            ctx.fillStyle = rgba(shade(col, 0.22), 0.7);
            ctx.beginPath();
            ctx.ellipse(a.x, a.y, 4.2, 3.4, 0, 0, TAU);
            ctx.fill();
            ctx.strokeStyle = rgba(shade(col, -0.3), 0.4);
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      } else if (li === 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1;
        line(ctx, [at(p, d0 + 1.2), at(q, d0 + 1.2)]);
        ctx.stroke();
      }
      ctx.restore();
    }
    d0 = d1;
  });
  ctx.strokeStyle = 'rgba(255,225,232,0.55)';
  ctx.lineWidth = 1.4;
  line(ctx, [B, at(B, SLAB_DEPTH)]);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(60,10,30,0.45)';
  ctx.lineWidth = 1.2;
  line(ctx, [at(L, SLAB_DEPTH), at(B, SLAB_DEPTH), at(R, SLAB_DEPTH)]);
  ctx.stroke();
}

// ---------------------------------------------------------------- mesenteric fat and vessels

function drawFat(ctx, geom) {
  const { T, W, H } = geom;
  const c = topCorners(geom);
  poly(ctx, [c.top, c.right, c.bottom, c.left]);
  ctx.fillStyle = tissuePattern(ctx, 'fat', 200) || '#ecc173';
  ctx.fill();
  // broad tonal variation so the fat does not look like wallpaper
  const rnd = seeded(5150);
  for (let k = 0; k < 30; k++) {
    const q = iso(rnd() * W * T, rnd() * H * T, G);
    const r = 70 + rnd() * 150;
    const warm = rnd() < 0.5;
    const gl = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
    gl.addColorStop(0, warm ? 'rgba(230,140,90,0.16)' : 'rgba(255,250,215,0.18)');
    gl.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.ellipse(q.x, q.y, r, r * 0.55, 0, 0, TAU);
    ctx.fill();
  }
  // glistening peritoneum: wet highlights
  ctx.lineCap = 'round';
  for (let k = 0; k < 90; k++) {
    const q = iso(rnd() * W * T, rnd() * H * T, G);
    ctx.strokeStyle = `rgba(255,255,255,${(0.18 + rnd() * 0.25).toFixed(2)})`;
    ctx.lineWidth = 0.8 + rnd() * 1.6;
    ctx.beginPath();
    ctx.moveTo(q.x, q.y);
    ctx.quadraticCurveTo(q.x + 6, q.y - 2, q.x + 10 + rnd() * 12, q.y);
    ctx.stroke();
  }
}

function vessel(ctx, pts, w = 1) {
  // a vein (blue) running beside its artery (red), both glossy
  const shifted = pts.map((p) => ({ x: p.x + 2.4 * w, y: p.y + 1.2 * w }));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [path, col, lw] of [[shifted, '#3f4c9c', 3.4 * w], [pts, '#b8202f', 2.6 * w]]) {
    smoothLine(ctx, path);
    ctx.strokeStyle = shade(col, -0.35);
    ctx.lineWidth = lw + 1.2;
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = Math.max(0.6, lw * 0.25);
    ctx.stroke();
  }
}

function drawVessels(ctx, geom) {
  const { pts } = tube(geom);
  const rnd = seeded(777);
  let prevEnd = { 1: null, '-1': null };
  for (let i = 10; i < pts.length - 10; i += 23) {
    const p = pts[i];
    if (p.zone === 'core' || p.zone === 'liver') continue;
    const side = (Math.floor(i / 23) % 2) ? 1 : -1;
    const base = p.h + WALL_W + 2;
    const len = 70 + rnd() * 80;
    const bend = (rnd() - 0.5) * 0.6;
    const path = [];
    for (let k = 0; k <= 6; k++) {
      const d = base + (len * k) / 6;
      const along = Math.sin((k / 6) * Math.PI) * bend * 40;
      path.push(iso(p.x + p.nx * side * d + p.tx * along, p.y + p.ny * side * d + p.ty * along, G));
    }
    vessel(ctx, path, 0.85);
    // arcade joining neighbouring vessels on the same side
    const end = path[4];
    const key = String(side);
    if (prevEnd[key] && Math.hypot(prevEnd[key].x - end.x, prevEnd[key].y - end.y) < 220) {
      const mid = lerp(prevEnd[key], end, 0.5);
      vessel(ctx, [prevEnd[key], { x: mid.x, y: mid.y + 6 }, end], 0.6);
    }
    prevEnd[key] = end;
    // lymph node at the branch
    if (rnd() < 0.35) {
      const q = path[5];
      ctx.fillStyle = '#e9d7bd';
      ctx.strokeStyle = 'rgba(120,90,60,0.6)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(q.x + 6, q.y - 2, 6, 3.4, 0.3, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
  }
  // vasa recta: short straight vessels into the bowel wall
  ctx.lineCap = 'round';
  for (let i = 4; i < pts.length - 4; i += 3) {
    const p = pts[i];
    if (p.zone !== 'si' && p.zone !== 'colon') continue;
    for (const side of [1, -1]) {
      const d0 = p.h + WALL_W, d1 = d0 + 9 + hash01(i, side + 3) * 9;
      const a = off(p, side * d0, G), b = off(p, side * d1, G);
      ctx.strokeStyle = i % 2 ? 'rgba(184,32,47,0.8)' : 'rgba(63,76,156,0.75)';
      ctx.lineWidth = 1.1;
      line(ctx, [a, b]);
      ctx.stroke();
    }
  }
}

// ---------------------------------------------------------------- organs

const LIVER = [[17.4, 9.1], [18.5, 8.15], [20.2, 7.95], [22.1, 8.2], [23.35, 9.0], [23.42, 11.2], [23.4, 13.6], [22.5, 14.38],
  [20.1, 14.42], [17.9, 14.38], [17.15, 13.2], [17.5, 11.7], [18.45, 10.8], [17.55, 10.1]];
const BONE = [[9.85, 11.0], [10.6, 9.75], [12.2, 9.55], [13.9, 9.75], [14.75, 11.0], [14.7, 12.9], [13.9, 14.2], [12.2, 14.42],
  [10.5, 14.2], [9.8, 12.9]];
const SPLEEN = [[21.7, 0.25], [22.6, -0.05], [23.38, 0.35], [23.3, 1.15], [22.5, 1.35], [21.8, 0.95]];
const GALL = [[22.5, 13.05], [23.15, 12.95], [23.4, 13.6], [23.2, 14.3], [22.75, 14.35], [22.45, 13.8]];
const LOOPS = [
  [[0.7, 8.2], [3.0, 7.7], [5.8, 7.8], [8.0, 8.3], [8.6, 9.4], [7.2, 10.1], [4.2, 9.9], [1.7, 10.0], [0.8, 11.1], [1.6, 12.1],
    [4.4, 11.8], [7.4, 11.6], [8.7, 12.4], [8.2, 13.6], [5.5, 14.0], [2.6, 13.9], [0.7, 13.7]],
];

function organ(ctx, outline, opt) {
  const thick = opt.thick || 7;
  // side thickness, then the glossy top surface
  ctx.fillStyle = opt.side;
  poly(ctx, outline.map((p) => ({ x: p.x, y: p.y + thick })));
  ctx.fill();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of outline) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  const g = ctx.createRadialGradient(x0 + (x1 - x0) * 0.35, y0 + (y1 - y0) * 0.3, 4, x0 + (x1 - x0) * 0.5, y0 + (y1 - y0) * 0.55, Math.max(x1 - x0, y1 - y0) * 0.75);
  g.addColorStop(0, opt.light);
  g.addColorStop(0.55, opt.base);
  g.addColorStop(1, opt.dark);
  ctx.fillStyle = g;
  poly(ctx, outline);
  ctx.fill();
  ctx.strokeStyle = opt.edge;
  ctx.lineWidth = 1.3;
  ctx.stroke();
  return { x0, y0, x1, y1 };
}

function gloss(ctx, box, n, seed, a = 0.3) {
  const rnd = seeded(seed);
  ctx.strokeStyle = `rgba(255,255,255,${a})`;
  ctx.lineCap = 'round';
  for (let k = 0; k < n; k++) {
    const x = box.x0 + (box.x1 - box.x0) * (0.15 + rnd() * 0.5);
    const y = box.y0 + (box.y1 - box.y0) * (0.12 + rnd() * 0.45);
    const w = 10 + rnd() * 26;
    ctx.lineWidth = 1.2 + rnd() * 2.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w * 0.5, y - 4, x + w, y + 1);
    ctx.stroke();
  }
}

function drawLiver(ctx, geom) {
  const out = blob(geom, LIVER, G + 1);
  const box = organ(ctx, out, { side: '#4c140f', light: '#b4483a', base: '#8a2f25', dark: '#5e1a14', edge: 'rgba(50,10,8,0.7)', thick: 9 });
  ctx.save();
  poly(ctx, out);
  ctx.clip();
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = tissuePattern(ctx, 'liver', 200) || '#8a2f25';
  ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  ctx.globalAlpha = 1;
  const shadeL = ctx.createRadialGradient(box.x0 + (box.x1 - box.x0) * 0.35, box.y0 + (box.y1 - box.y0) * 0.3, 4,
    box.x0 + (box.x1 - box.x0) * 0.5, box.y0 + (box.y1 - box.y0) * 0.55, Math.max(box.x1 - box.x0, box.y1 - box.y0) * 0.75);
  shadeL.addColorStop(0, 'rgba(255,170,150,0.18)');
  shadeL.addColorStop(0.6, 'rgba(0,0,0,0)');
  shadeL.addColorStop(1, 'rgba(40,5,5,0.4)');
  ctx.fillStyle = shadeL;
  ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  // falciform ligament and a lobe fissure
  const f = openSpline(geom, [[19.2, 8.0], [19.6, 10.0], [19.3, 12.2], [19.8, 14.4]], 10).map((p) => iso(p.x, p.y, G + 1));
  smoothLine(ctx, f);
  ctx.strokeStyle = 'rgba(255,220,200,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  gloss(ctx, box, 9, 31, 0.28);
  ctx.restore();
  // gallbladder peeking from under the edge
  const gb = blob(geom, GALL, G + 3, 8);
  const gbox = organ(ctx, gb, { side: '#2f4a16', light: '#a7c86a', base: '#6f9a3b', dark: '#3f5f1d', edge: 'rgba(30,50,10,0.7)', thick: 5 });
  gloss(ctx, gbox, 2, 77, 0.45);
}

function drawSpleen(ctx, geom) {
  const sp = blob(geom, SPLEEN, G + 1, 8);
  const box = organ(ctx, sp, { side: '#3a0f26', light: '#a3466e', base: '#7a2a4f', dark: '#4e1733', edge: 'rgba(40,6,24,0.7)', thick: 6 });
  gloss(ctx, box, 3, 12, 0.3);
}

function drawBone(ctx, geom) {
  const outer = blob(geom, BONE, G + 2, 10);
  const box = organ(ctx, outer, { side: '#8f8068', light: '#fffaf0', base: '#efe5cf', dark: '#cdbf9f', edge: 'rgba(90,70,40,0.7)', thick: 10 });
  // marrow cavity: red marrow in a lattice of trabeculae
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  const inner = outer.map((p) => ({ x: cx + (p.x - cx) * 0.82, y: cy + (p.y - cy) * 0.8 }));
  ctx.save();
  poly(ctx, inner);
  const mg = ctx.createRadialGradient(cx - 20, cy - 12, 6, cx, cy, (box.x1 - box.x0) * 0.5);
  mg.addColorStop(0, '#d9505c');
  mg.addColorStop(0.7, '#b3303e');
  mg.addColorStop(1, '#8a1f2c');
  ctx.fillStyle = mg;
  ctx.fill();
  ctx.clip();
  const rnd = seeded(4242);
  ctx.strokeStyle = 'rgba(250,238,214,0.85)';
  ctx.lineCap = 'round';
  for (let k = 0; k < 70; k++) {
    const x = box.x0 + rnd() * (box.x1 - box.x0), y = box.y0 + rnd() * (box.y1 - box.y0);
    const a = rnd() * TAU, l = 8 + rnd() * 16;
    ctx.lineWidth = 1 + rnd() * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.3, x + Math.cos(a) * l, y + Math.sin(a) * l * 0.55);
    ctx.stroke();
  }
  for (let k = 0; k < 26; k++) {
    const x = box.x0 + rnd() * (box.x1 - box.x0), y = box.y0 + rnd() * (box.y1 - box.y0);
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,214,120,0.75)' : 'rgba(120,10,25,0.5)';
    ctx.beginPath();
    ctx.ellipse(x, y, 2 + rnd() * 3, 1.3 + rnd() * 1.6, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(120,95,60,0.55)';
  ctx.lineWidth = 1.2;
  poly(ctx, inner);
  ctx.stroke();
  gloss(ctx, box, 4, 9, 0.3);
}

// closed coils of small bowel lying on the mesentery
function drawLoops(ctx, geom) {
  for (const ctrl of LOOPS) {
    const pts = openSpline(geom, ctrl, 9);
    const r = 32;
    const top = pts.map((p) => iso(p.x, p.y, G + r * 0.55));
    const ground = pts.map((p) => iso(p.x, p.y, G));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    smoothLine(ctx, ground.map((p) => ({ x: p.x + 4, y: p.y + 4 })));
    ctx.strokeStyle = 'rgba(70,20,10,0.28)';
    ctx.lineWidth = r * 1.25;
    ctx.stroke();
    smoothLine(ctx, top);
    ctx.strokeStyle = '#9c4f45';
    ctx.lineWidth = r * 1.2;
    ctx.stroke();
    ctx.strokeStyle = tissuePattern(ctx, 'serosa', 140) || '#d98a7e';
    ctx.lineWidth = r * 1.05;
    ctx.stroke();
    smoothLine(ctx, top.map((p) => ({ x: p.x, y: p.y + r * 0.22 })));
    ctx.strokeStyle = 'rgba(120,40,30,0.35)';
    ctx.lineWidth = r * 0.5;
    ctx.stroke();
    smoothLine(ctx, top.map((p) => ({ x: p.x, y: p.y - r * 0.12 })));
    ctx.strokeStyle = 'rgba(255,215,200,0.4)';
    ctx.lineWidth = r * 0.62;
    ctx.stroke();
    // circular folds faintly visible through the thin wall
    for (let k = 1; k < top.length - 1; k += 2) {
      const a = top[k - 1], b = top[k + 1], p = top[k];
      const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l, ny = dx / l;
      ctx.strokeStyle = 'rgba(150,60,50,0.22)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(p.x + nx * r * 0.5, p.y + ny * r * 0.5);
      ctx.quadraticCurveTo(p.x + dx / l * 3, p.y + dy / l * 3, p.x - nx * r * 0.5, p.y - ny * r * 0.5);
      ctx.stroke();
    }
    smoothLine(ctx, top.map((p) => ({ x: p.x - 1, y: p.y - r * 0.3 })));
    ctx.strokeStyle = 'rgba(255,225,215,0.75)';
    ctx.lineWidth = r * 0.22;
    ctx.stroke();
    smoothLine(ctx, top.map((p) => ({ x: p.x - 2, y: p.y - r * 0.38 })));
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // little vessels running over the serosa
    for (let k = 3; k < top.length - 3; k += 5) {
      const p = top[k];
      ctx.strokeStyle = k % 2 ? 'rgba(170,30,45,0.55)' : 'rgba(70,80,160,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x - 3, p.y + r * 0.42);
      ctx.quadraticCurveTo(p.x + 2, p.y, p.x - 2, p.y - r * 0.4);
      ctx.stroke();
    }
  }
}

function drawEsophagus(ctx, geom) {
  const a = geom.mouth, b = geom.posAt(0);
  const r = 26;
  const pa = iso(a.x, a.y, G + r * 0.5), pb = iso(b.x + 10, b.y, G + r * 0.5);
  ctx.lineCap = 'round';
  line(ctx, [pa, pb]);
  ctx.strokeStyle = '#9c4f45';
  ctx.lineWidth = r * 1.2;
  ctx.stroke();
  ctx.strokeStyle = '#df9284';
  ctx.lineWidth = r;
  ctx.stroke();
  line(ctx, [{ x: pa.x, y: pa.y - r * 0.3 }, { x: pb.x, y: pb.y - r * 0.3 }]);
  ctx.strokeStyle = 'rgba(255,230,220,0.7)';
  ctx.lineWidth = r * 0.25;
  ctx.stroke();
}

// ---------------------------------------------------------------- the opened gut tube

function drawTube(ctx, geom) {
  const { pts } = tube(geom);
  const n = pts.length;

  // shadow on the fat
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const rz of runs(n, (i) => pts[i].zone)) {
    const seg = pts.slice(rz.i0, rz.i1 + 1);
    const outline = seg.map((p) => off(p, p.h + WALL_W + 6, G)).concat(seg.map((p) => off(p, -(p.h + WALL_W + 6), G)).reverse());
    ctx.fillStyle = 'rgba(70,25,10,0.22)';
    poly(ctx, outline.map((p) => ({ x: p.x + 3, y: p.y + 4 })));
    ctx.fill();
  }
  ctx.restore();

  // lumen floor (mucosa), zone by zone
  for (const rz of runs(n, (i) => pts[i].zone)) {
    const seg = pts.slice(rz.i0, rz.i1 + 1);
    const lk = LOOK[rz.key] || LOOK.si;
    poly(ctx, floorPoly(seg));
    ctx.fillStyle = tissuePattern(ctx, FLOOR_TEX[rz.key] || 'si', 120) || lk.floor;
    ctx.fill();
    ctx.strokeStyle = rgba(lk.floor, 0.8);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.save();
  poly(ctx, floorPoly(pts));
  ctx.clip();
  drawMucosa(ctx, pts);
  ctx.restore();

  // inner wall on the far side, outer wall (serosa) on the near side
  for (const side of [1, -1]) {
    const back = (i) => side * (pts[i].nx + pts[i].ny + pts[Math.min(n - 1, i + 1)].nx + pts[Math.min(n - 1, i + 1)].ny) < 0;
    for (const r of runs(n, (i) => `${back(i) ? 'b' : 'f'}|${pts[i].zone}`)) {
      const seg = pts.slice(r.i0, r.i1 + 1);
      if (seg.length < 2) continue;
      const lk = LOOK[r.key.split('|')[1]] || LOOK.si;
      if (r.key[0] === 'b') {
        const top = seg.map((p) => off(p, side * p.h, RIM_H));
        const bot = seg.map((p) => off(p, side * p.h, 0)).reverse();
        const pts2 = top.concat(bot);
        let y0 = Infinity, y1 = -Infinity;
        for (const p of pts2) { y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
        poly(ctx, pts2);
        ctx.fillStyle = tissuePattern(ctx, FLOOR_TEX[r.key.split('|')[1]] || 'si', 120) || lk.floor;
        ctx.fill();
        const g = ctx.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, 'rgba(255,235,230,0.18)');
        g.addColorStop(1, 'rgba(60,8,18,0.45)');
        ctx.fillStyle = g;
        ctx.fill();
        // fold creases on the far wall
        ctx.strokeStyle = rgba(lk.fold, 0.35);
        ctx.lineWidth = 1;
        for (let k = 0; k < seg.length; k += 2) {
          const a = off(seg[k], side * seg[k].h, RIM_H - 1), b = off(seg[k], side * seg[k].h, 1);
          line(ctx, [a, b]);
          ctx.stroke();
        }
      }
    }
  }
  for (const side of [1, -1]) {
    const back = (i) => side * (pts[i].nx + pts[i].ny + pts[Math.min(n - 1, i + 1)].nx + pts[Math.min(n - 1, i + 1)].ny) < 0;
    for (const r of runs(n, (i) => `${back(i) ? 'b' : 'f'}|${pts[i].zone}`)) {
      if (r.key[0] !== 'f') continue;
      const seg = pts.slice(r.i0, r.i1 + 1);
      if (seg.length < 2) continue;
      const zone = r.key.split('|')[1];
      const lk = LOOK[zone] || LOOK.si;
      const top = seg.map((p) => off(p, side * p.h, RIM_H));
      const bot = seg.map((p) => off(p, side * (p.h + WALL_W), G));
      const pts2 = top.concat(bot.slice().reverse());
      let y0 = Infinity, y1 = -Infinity;
      for (const p of pts2) { y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
      poly(ctx, pts2);
      ctx.fillStyle = zone === 'liver' || zone === 'core' ? lk.serosa : (tissuePattern(ctx, 'serosa', 140) || lk.serosa);
      ctx.fill();
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, 'rgba(255,240,235,0.35)');
      g.addColorStop(0.35, 'rgba(255,240,235,0.05)');
      g.addColorStop(1, rgba(lk.serosaDark, 0.75));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = rgba(shade(lk.serosaDark, -0.3), 0.6);
      ctx.lineWidth = 1;
      line(ctx, bot);
      ctx.stroke();
      decorateWall(ctx, seg, side, zone, top, bot);
    }
  }

  // cut edge of the wall: muscle, submucosa and mucosa layers
  for (const side of [1, -1]) {
    for (const rz of runs(n, (i) => pts[i].zone)) {
      const seg = pts.slice(rz.i0, rz.i1 + 1);
      const lk = LOOK[rz.key] || LOOK.si;
      const rim = seg.map((p) => off(p, side * p.h, RIM_H));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      line(ctx, rim);
      ctx.strokeStyle = rz.key === 'liver' || rz.key === 'core' ? shade(lk.serosaDark, -0.2) : '#a63a44';
      ctx.lineWidth = 5.5;
      ctx.stroke();
      ctx.strokeStyle = rz.key === 'liver' || rz.key === 'core' ? lk.serosa : '#f2dccb';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = lk.glint;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }
}

function drawMucosa(ctx, pts) {
  const n = pts.length;
  // stomach rugae: thick longitudinal folds
  const stomach = pts.filter((p) => p.zone === 'stomach');
  if (stomach.length > 2) {
    for (const f of [-0.68, -0.34, 0, 0.34, 0.68]) {
      const path = stomach.map((p) => off(p, (f + Math.sin(p.s * 0.035 + f * 9) * 0.07) * p.h, 0));
      smoothLine(ctx, path);
      ctx.strokeStyle = rgba(LOOK.stomach.fold, 0.5);
      ctx.lineWidth = 5.5;
      ctx.stroke();
      smoothLine(ctx, path.map((p) => ({ x: p.x, y: p.y - 1.6 })));
      ctx.strokeStyle = rgba(LOOK.stomach.glint, 0.6);
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
  }
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    if (p.zone === 'si' && i % 2 === 0) {
      // plicae circulares: close transverse folds
      const a = off(p, -0.94 * p.h, 0), b = off(p, 0.94 * p.h, 0);
      const m = iso(p.x + p.tx * 3, p.y + p.ty * 3, 0);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(m.x, m.y, b.x, b.y);
      ctx.strokeStyle = rgba(LOOK.si.fold, 0.45);
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - 1.2);
      ctx.quadraticCurveTo(m.x, m.y - 1.2, b.x, b.y - 1.2);
      ctx.strokeStyle = rgba(LOOK.si.glint, 0.55);
      ctx.lineWidth = 1.1;
      ctx.stroke();
    } else if (p.zone === 'colon' && i % 5 === 0) {
      // haustra: deep semilunar folds with puckered sacs between
      const a = off(p, -0.96 * p.h, 0), b = off(p, 0.96 * p.h, 0);
      const m = iso(p.x + p.tx * 7, p.y + p.ty * 7, 0);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(m.x, m.y, b.x, b.y);
      ctx.strokeStyle = rgba(LOOK.colon.fold, 0.55);
      ctx.lineWidth = 4.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - 1.8);
      ctx.quadraticCurveTo(m.x, m.y - 1.8, b.x, b.y - 1.8);
      ctx.strokeStyle = rgba(LOOK.colon.glint, 0.6);
      ctx.lineWidth = 2;
      ctx.stroke();
      const c = iso(p.x + p.tx * 15, p.y + p.ty * 15, 0);
      ctx.fillStyle = 'rgba(255,240,232,0.18)';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, p.h * 0.45, p.h * 0.18, 0, 0, TAU);
      ctx.fill();
    } else if ((p.zone === 'liver' || p.zone === 'core') && i % 3 === 0) {
      // blood inside the portal vein and the vessel to the marrow
      for (let k = 0; k < 2; k++) {
        const d = (hash01(i, k, 3) - 0.5) * 1.6 * p.h;
        const q = off(p, d, 0);
        const red = hash01(i, k, 9) < 0.8;
        ctx.fillStyle = red ? 'rgba(220,50,70,0.75)' : 'rgba(250,245,255,0.8)';
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, 3.2, 1.9, 0, 0, TAU);
        ctx.fill();
        if (red) {
          ctx.fillStyle = 'rgba(120,10,30,0.55)';
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, 1.3, 0.8, 0, 0, TAU);
          ctx.fill();
        }
      }
    }
    // villi velvet in the small intestine
    if (p.zone === 'si' && i % 3 === 1) {
      for (let k = 0; k < 4; k++) {
        const q = off(p, (hash01(i, k, 21) - 0.5) * 1.8 * p.h, 0);
        ctx.fillStyle = 'rgba(255,215,200,0.4)';
        ctx.fillRect(q.x, q.y, 1.4, 1.4);
      }
    }
  }
  // wet sheen along the lumen
  ctx.lineCap = 'round';
  for (let i = 0; i < n - 4; i += 4) {
    if (hash01(i, 5, 5) < 0.35) continue;
    const p = pts[i], q = pts[i + 3];
    const side = (p.nx + p.ny) > 0 ? -1 : 1;
    const a = off(p, side * p.h * 0.45, 0), b = off(q, side * q.h * 0.45, 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2.2;
    line(ctx, [a, b]);
    ctx.stroke();
  }
  // soft shading towards the walls
  for (const side of [1, -1]) {
    const edge = pts.map((p) => off(p, side * p.h * 0.92, 0));
    line(ctx, edge);
    ctx.strokeStyle = 'rgba(70,10,20,0.18)';
    ctx.lineWidth = 9;
    ctx.stroke();
  }
}

function decorateWall(ctx, seg, side, zone, top, bot) {
  if (zone === 'stomach') {
    // gastro-epiploic arcade along the greater curvature
    const mid = seg.map((p) => off(p, side * (p.h + WALL_W * 0.5), (RIM_H + G) / 2));
    smoothLine(ctx, mid);
    ctx.strokeStyle = '#a81f2e';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let k = 2; k < seg.length; k += 6) {
      line(ctx, [mid[k], top[k]]);
      ctx.stroke();
    }
  } else if (zone === 'colon') {
    // taenia coli and epiploic appendages
    const mid = seg.map((p) => off(p, side * (p.h + WALL_W * 0.45), (RIM_H + G) / 2 + 1));
    line(ctx, mid);
    ctx.strokeStyle = 'rgba(250,236,220,0.85)';
    ctx.lineWidth = 2.6;
    ctx.stroke();
    for (let k = 3; k < seg.length; k += 9) {
      const b = bot[k];
      const gr = ctx.createRadialGradient(b.x - 2, b.y - 1, 1, b.x, b.y + 2, 8);
      gr.addColorStop(0, '#fff2b8');
      gr.addColorStop(1, '#e2b04c');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y + 3, 5.5, 4, 0.3, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,100,30,0.6)';
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  } else if (zone === 'si') {
    ctx.strokeStyle = 'rgba(170,30,45,0.45)';
    ctx.lineWidth = 0.9;
    for (let k = 1; k < seg.length; k += 3) {
      line(ctx, [bot[k], lerp(bot[k], top[k], 0.85)]);
      ctx.stroke();
    }
  } else {
    // vessel walls: a sheen along the near side
    line(ctx, top.map((p, k) => lerp(p, bot[k], 0.35)));
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawPlinth(ctx, geom, info) {
  if (info.inLumen) return;
  const q = toIso(info.x, info.y);
  const y = q.y - G;
  const hw = info.kind === 'core' ? 70 : 40, hh = hw / 2;
  ctx.fillStyle = 'rgba(120,60,20,0.14)';
  ctx.beginPath();
  ctx.moveTo(q.x, y - hh);
  ctx.lineTo(q.x + hw, y);
  ctx.lineTo(q.x, y + hh);
  ctx.lineTo(q.x - hw, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,248,230,0.55)';
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawLight(ctx, geom) {
  const c = topCorners(geom);
  ctx.save();
  poly(ctx, [c.top, c.right, c.bottom, c.left]);
  ctx.clip();
  const lg = ctx.createLinearGradient(c.left.x, c.top.y, c.right.x, c.bottom.y);
  lg.addColorStop(0, 'rgba(255,245,235,0.14)');
  lg.addColorStop(0.5, 'rgba(255,245,235,0)');
  lg.addColorStop(1, 'rgba(50,10,20,0.18)');
  ctx.fillStyle = lg;
  ctx.fillRect(c.left.x, c.top.y, c.right.x - c.left.x, c.bottom.y - c.top.y);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,240,220,0.5)';
  ctx.lineWidth = 1.4;
  line(ctx, [c.left, c.top, c.right]);
  ctx.stroke();
}

export function drawGround(ctx, geom) {
  drawSlab(ctx, geom);
  ctx.save();
  clipTop(ctx, geom);
  drawFat(ctx, geom);
  drawVessels(ctx, geom);
  drawSpleen(ctx, geom);
  drawLiver(ctx, geom);
  drawBone(ctx, geom);
  drawLoops(ctx, geom);
  ctx.restore();
  drawEsophagus(ctx, geom);
  drawTube(ctx, geom);
  for (const info of geom.sites.values()) drawPlinth(ctx, geom, info);
  drawLight(ctx, geom);
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

// ---------------------------------------------------------------- per-frame layers

const BACKDROP_CELLS = Array.from({ length: 16 }, (_, k) => ({
  u: hash01(k, 1, 5), v: hash01(k, 2, 5), r: 18 + hash01(k, 3, 5) * 46, sp: 0.004 + hash01(k, 4, 5) * 0.01,
  red: hash01(k, 6, 5) < 0.7,
}));

// Screen-space backdrop: the body cavity behind the floating dissection.
export function drawBackdrop(ctx, vw, vh, t) {
  const g = ctx.createRadialGradient(vw * 0.5, vh * 0.42, Math.min(vw, vh) * 0.1, vw * 0.5, vh * 0.5, Math.max(vw, vh) * 0.75);
  g.addColorStop(0, '#5b2038');
  g.addColorStop(0.55, '#341224');
  g.addColorStop(1, '#170610');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vw, vh);
  for (const c of BACKDROP_CELLS) {
    const x = ((c.u + t * c.sp) % 1.2 - 0.1) * vw;
    const y = c.v * vh + Math.sin(t * 0.4 + c.u * 9) * 12;
    ctx.fillStyle = c.red ? 'rgba(220,60,90,0.07)' : 'rgba(255,230,245,0.05)';
    ctx.beginPath();
    ctx.ellipse(x, y, c.r, c.r * 0.82, 0.4, 0, TAU);
    ctx.fill();
    if (c.red) {
      ctx.fillStyle = 'rgba(120,20,45,0.06)';
      ctx.beginPath();
      ctx.ellipse(x, y, c.r * 0.45, c.r * 0.36, 0.4, 0, TAU);
      ctx.fill();
    }
  }
}

const FLOW = Array.from({ length: 46 }, (_, k) => ({
  f: hash01(k, 11, 3), off: hash01(k, 12, 3) - 0.5, sp: 26 + hash01(k, 13, 3) * 30, kind: k % 4,
}));

// Chyme, bubbles and (in the vessels) blood drifting along the lumen, mouth to core.
export function drawLumenFlow(ctx, geom, t, speed = 1) {
  ctx.save();
  for (const p of FLOW) {
    const s = (p.f * geom.len + t * p.sp * speed) % geom.len;
    const pos = geom.posAt(s);
    const d = geom.dirAt(s);
    const lat = p.off * 1.5 * geom.lumenHalf(s);
    const q = toIso(pos.x - d.dy * lat, pos.y + d.dx * lat);
    const z = geom.zoneOf(s).key;
    const fadeIn = Math.min(1, s / 120, (geom.len - s) / 160);
    if (z === 'liver' || z === 'core') {
      ctx.fillStyle = `rgba(225,55,75,${(0.7 * fadeIn).toFixed(2)})`;
      ctx.beginPath();
      ctx.ellipse(q.x, q.y - 1, 3.2, 1.9, 0, 0, TAU);
      ctx.fill();
    } else if (p.kind === 0) {
      ctx.strokeStyle = `rgba(255,255,255,${(0.6 * fadeIn).toFixed(2)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(q.x, q.y - 3, 2.6, 0, TAU);
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(150,105,40,${(0.45 * fadeIn).toFixed(2)})`;
      ctx.beginPath();
      ctx.ellipse(q.x, q.y - 1, 3 + p.kind * 0.6, 1.7, 0, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

function floorBetween(geom, s0, s1) {
  const pts = tube(geom).pts.filter((p) => p.s >= s0 && p.s <= s1);
  return pts.length >= 2 ? pts : null;
}

export function drawAcidSheen(ctx, geom, s0, s1, t, strength) {
  const pts = floorBetween(geom, s0, s1);
  if (!pts) return;
  ctx.save();
  poly(ctx, floorPoly(pts));
  const a = (0.16 + 0.05 * Math.sin(t * 2)) * strength;
  ctx.fillStyle = `rgba(190,230,60,${a.toFixed(3)})`;
  ctx.fill();
  ctx.clip();
  for (let k = 0; k < 24; k++) {
    const p = pts[Math.floor(hash01(k, 3, 7) * pts.length)];
    const ph = (t * 0.7 + hash01(k, 1, 7)) % 1;
    const q = off(p, (hash01(k, 2, 7) - 0.5) * 1.6 * p.h, ph * 10);
    ctx.strokeStyle = `rgba(230,255,140,${(0.8 * (1 - ph) * strength).toFixed(3)})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(q.x, q.y, 2 + ph * 3, 0, TAU);
    ctx.stroke();
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
    const half = geom.lumenHalf(s) + WALL_W * 0.5;
    const a = d.dx !== 0 ? toIso(p.x, p.y - half) : toIso(p.x - half, p.y);
    const b = d.dx !== 0 ? toIso(p.x, p.y + half) : toIso(p.x + half, p.y);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(190,50,80,0.28)';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,150,170,0.35)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPathSpan(ctx, geom, s0, s1, fill, stroke) {
  const pts = floorBetween(geom, Math.max(0, s0), Math.min(geom.len, s1));
  if (!pts) return;
  ctx.save();
  poly(ctx, floorPoly(pts));
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.stroke();
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
  ctx.ellipse(ix, iy, r * Math.SQRT1_2, r * Math.SQRT1_2 * 0.5, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

export function drawMouth(ctx, geom, t, open) {
  const q = toIso(geom.mouth.x, geom.mouth.y);
  const x = q.x, y = q.y - G - 18;
  const o = 4 + open * 11 + Math.sin(t * 3) * 0.9;
  ctx.save();
  ctx.fillStyle = 'rgba(60,10,30,0.3)';
  ctx.beginPath();
  ctx.ellipse(x + 3, q.y - G + 6, 36, 13, 0, 0, TAU);
  ctx.fill();
  const cav = ctx.createRadialGradient(x, y, 2, x, y, 28);
  cav.addColorStop(0, '#2a0614');
  cav.addColorStop(1, '#6a1832');
  ctx.fillStyle = cav;
  ctx.beginPath();
  ctx.ellipse(x, y, 25, o + 1, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#e46a86';
  ctx.beginPath();
  ctx.ellipse(x + 2, y + o * 0.45, 15, Math.max(1.5, o * 0.45), 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#fffaf2';
  ctx.strokeStyle = 'rgba(120,90,70,0.5)';
  ctx.lineWidth = 0.6;
  for (let k = -3; k <= 3; k++) {
    const tw = 5.2, th = Math.min(6, o * 0.7);
    ctx.beginPath();
    ctx.roundRect(x + k * 6.4 - tw / 2, y - o + 0.5, tw, th, [0, 0, 2, 2]);
    ctx.fill();
    ctx.stroke();
    if (Math.abs(k) < 3) {
      ctx.beginPath();
      ctx.roundRect(x + k * 6.4 - tw / 2 + 3.2, y + o - th - 0.5, tw, th, [2, 2, 0, 0]);
      ctx.fill();
      ctx.stroke();
    }
  }
  const lip = ctx.createLinearGradient(0, y - o - 16, 0, y + o + 16);
  lip.addColorStop(0, '#f48aa2');
  lip.addColorStop(0.5, '#d94a6c');
  lip.addColorStop(1, '#b7334f');
  ctx.fillStyle = lip;
  ctx.strokeStyle = 'rgba(90,10,35,0.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - 31, y);
  ctx.quadraticCurveTo(x - 14, y - o - 17, x, y - o - 6);
  ctx.quadraticCurveTo(x + 14, y - o - 17, x + 31, y);
  ctx.quadraticCurveTo(x, y - o + 1, x - 31, y);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 31, y);
  ctx.quadraticCurveTo(x, y + o + 1, x + 31, y);
  ctx.quadraticCurveTo(x, y + o + 18, x - 31, y);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(x - 9, y + o + 7, 8, 2.4, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - 12, y - o - 9, 5, 1.6, -0.3, 0, TAU);
  ctx.fill();
  ctx.restore();
  return { x, y: y - 24 };
}
