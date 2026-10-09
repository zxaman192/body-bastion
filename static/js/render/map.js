import { toIso, hash01, GROUND_H } from './geom.js';
import { mix, shade, rgba } from './color.js';

const TAU = Math.PI * 2;
const TISSUE = '#e9a0ab';

// The sides of the diorama show a real cross-section of the gut wall, top to bottom.
const WALL_LAYERS = [
  { h: 10, a: '#e48496', b: '#c9687d' }, // mucosa
  { h: 17, a: '#f6dcc8', b: '#dfbfa6' }, // submucosa (vessels)
  { h: 18, a: '#c24a58', b: '#a13a48' }, // circular muscle
  { h: 12, a: '#9c3342', b: '#7f2735' }, // longitudinal muscle
  { h: 5, a: '#f4cdd5', b: '#d9aab6' },  // serosa
];
const SLAB_DEPTH = WALL_LAYERS.reduce((n, l) => n + l.h, 0);

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

function groundTint(geom, i, j) {
  const { tile, dist } = geom.nearestPathTile(i, j);
  const base = tile ? mix(TISSUE, tile.color, Math.max(0, 0.34 - dist * 0.06)) : TISSUE;
  return shade(base, (i + j) % 2 ? -0.025 : 0.015);
}

// ---------------------------------------------------------------- slab sides

function drawSlab(ctx, geom) {
  const { T, W, H } = geom;
  const h = T / 2;
  const L = toIso(-h, H * T - h);
  const B = toIso(W * T - h, H * T - h);
  const R = toIso(W * T - h, -h);
  const at = (p, d) => ({ x: p.x, y: p.y - GROUND_H + d });

  const fade = ctx.createLinearGradient(0, B.y, 0, B.y + SLAB_DEPTH + 40);
  fade.addColorStop(0, 'rgba(10,2,8,0.5)');
  fade.addColorStop(1, 'rgba(10,2,8,0)');
  ctx.fillStyle = fade;
  quad(ctx, at(L, SLAB_DEPTH), at(B, SLAB_DEPTH), at(B, SLAB_DEPTH + 34), at(L, SLAB_DEPTH + 14));
  ctx.fill();
  quad(ctx, at(B, SLAB_DEPTH), at(R, SLAB_DEPTH), at(R, SLAB_DEPTH + 14), at(B, SLAB_DEPTH + 34));
  ctx.fill();

  let d0 = 0;
  WALL_LAYERS.forEach((layer, li) => {
    const d1 = d0 + layer.h;
    for (const [p, q, col, dark] of [[L, B, layer.a, 0], [B, R, layer.b, 1]]) {
      const g = ctx.createLinearGradient(0, at(p, d0).y, 0, at(p, d1).y);
      g.addColorStop(0, shade(col, 0.06));
      g.addColorStop(1, shade(col, -0.08));
      ctx.fillStyle = g;
      quad(ctx, at(p, d0), at(q, d0), at(q, d1), at(p, d1));
      ctx.fill();
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      ctx.save();
      quad(ctx, at(p, d0), at(q, d0), at(q, d1), at(p, d1));
      ctx.clip();
      if (li === 0) {
        ctx.strokeStyle = rgba(shade(col, -0.35), 0.45);
        ctx.lineWidth = 1.2;
        for (let u = 6; u < len; u += 9) {
          const a = lerp(at(p, d0), at(q, d0), u / len);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y + 1);
          ctx.lineTo(a.x, a.y + layer.h * 0.7);
          ctx.stroke();
        }
      } else if (li === 1) {
        const rnd = seeded(77 + dark);
        for (let u = 24; u < len - 10; u += 46 + rnd() * 30) {
          const c = lerp(at(p, d0 + layer.h * 0.5), at(q, d0 + layer.h * 0.5), u / len);
          const artery = rnd() < 0.5;
          if (artery) {
            ctx.fillStyle = '#b52437';
            ctx.beginPath();
            ctx.ellipse(c.x, c.y, 4.6, 4.2, 0, 0, TAU);
            ctx.fill();
            ctx.fillStyle = '#ffd6dc';
            ctx.beginPath();
            ctx.ellipse(c.x, c.y, 1.8, 1.6, 0, 0, TAU);
            ctx.fill();
          } else {
            ctx.fillStyle = '#5868b8';
            ctx.beginPath();
            ctx.ellipse(c.x + 2, c.y + 0.5, 6, 4.4, 0.3, 0, TAU);
            ctx.fill();
            ctx.fillStyle = '#c9cff2';
            ctx.beginPath();
            ctx.ellipse(c.x + 2, c.y + 0.5, 4.4, 3, 0.3, 0, TAU);
            ctx.fill();
          }
          ctx.fillStyle = 'rgba(255,240,170,0.75)';
          ctx.beginPath();
          ctx.ellipse(c.x + 11, c.y - 2, 2.2, 1.8, 0, 0, TAU);
          ctx.fill();
        }
      } else if (li === 2) {
        ctx.strokeStyle = rgba(shade(col, -0.4), 0.35);
        ctx.lineWidth = 1;
        for (let k = 1; k < 5; k++) {
          const dd = d0 + (layer.h * k) / 5;
          ctx.beginPath();
          ctx.moveTo(at(p, dd).x, at(p, dd).y);
          ctx.lineTo(at(q, dd).x, at(q, dd).y);
          ctx.stroke();
        }
      } else if (li === 3) {
        ctx.fillStyle = rgba(shade(col, -0.45), 0.5);
        for (let u = 4; u < len; u += 7) {
          for (const f of [0.3, 0.72]) {
            const c = lerp(at(p, d0 + layer.h * f), at(q, d0 + layer.h * f), (u + (f > 0.5 ? 3.5 : 0)) / len);
            ctx.beginPath();
            ctx.ellipse(c.x, c.y, 1.6, 1.3, 0, 0, TAU);
            ctx.fill();
          }
        }
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(at(p, d0 + 1.5).x, at(p, d0 + 1.5).y);
        ctx.lineTo(at(q, d0 + 1.5).x, at(q, d0 + 1.5).y);
        ctx.stroke();
      }
      ctx.restore();
    }
    d0 = d1;
  });

  ctx.strokeStyle = 'rgba(255,225,232,0.55)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(at(B, 0).x, at(B, 0).y);
  ctx.lineTo(at(B, SLAB_DEPTH).x, at(B, SLAB_DEPTH).y);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(60,10,30,0.45)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(at(L, SLAB_DEPTH).x, at(L, SLAB_DEPTH).y);
  ctx.lineTo(at(B, SLAB_DEPTH).x, at(B, SLAB_DEPTH).y);
  ctx.lineTo(at(R, SLAB_DEPTH).x, at(R, SLAB_DEPTH).y);
  ctx.stroke();
}

// ---------------------------------------------------------------- lumen floor

function lumenTexture(ctx, c, t, i, j) {
  const cx = (c.top.x + c.bottom.x) / 2, cy = (c.top.y + c.bottom.y) / 2;
  const base = t.color;
  if (t.zone === 'stomach') {
    // gastric rugae: thick wavy folds
    for (let k = -2; k <= 2; k++) {
      ctx.strokeStyle = rgba(shade(base, -0.28), 0.6);
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      for (let q = -40; q <= 40; q += 4) {
        const x = cx + q, y = cy + k * 9 + Math.sin((q + i * 31 + k * 17) * 0.11) * 3.2;
        if (q === -40) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = rgba(shade(base, 0.35), 0.55);
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  } else if (t.zone === 'si') {
    // villus carpet
    for (let k = 0; k < 16; k++) {
      const u = (k % 4) / 4 + 0.12 + (hash01(i, j, k) - 0.5) * 0.08;
      const v = Math.floor(k / 4) / 4 + 0.12 + (hash01(j, i, k) - 0.5) * 0.08;
      const x = c.top.x + (c.right.x - c.top.x) * u + (c.left.x - c.top.x) * v;
      const y = c.top.y + (c.right.y - c.top.y) * u + (c.left.y - c.top.y) * v;
      ctx.fillStyle = rgba(shade(base, -0.25), 0.7);
      ctx.beginPath();
      ctx.ellipse(x + 0.6, y + 1.6, 3.6, 2.2, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgba(shade(base, 0.3), 0.95);
      ctx.beginPath();
      ctx.ellipse(x - 0.4, y - 0.3, 2.8, 1.8, 0, 0, TAU);
      ctx.fill();
    }
  } else if (t.zone === 'colon') {
    // haustral folds and resident flora
    ctx.strokeStyle = rgba(shade(base, -0.3), 0.6);
    ctx.lineWidth = 3;
    for (let k = -1; k <= 1; k += 2) {
      ctx.beginPath();
      ctx.ellipse(cx + k * 15, cy, 13, 18, 0.5, -1.2, 1.2);
      ctx.stroke();
    }
    for (let k = 0; k < 9; k++) {
      const x = cx + (hash01(i, j, 40 + k) - 0.5) * 60;
      const y = cy + (hash01(i, j, 50 + k) - 0.5) * 26;
      ctx.fillStyle = ['rgba(70,150,80,0.6)', 'rgba(150,110,200,0.5)', 'rgba(230,170,60,0.55)'][k % 3];
      ctx.beginPath();
      ctx.ellipse(x, y, 2.8, 1.4, hash01(i, j, k) * 3, 0, TAU);
      ctx.fill();
    }
  } else if (t.zone === 'liver') {
    // hexagonal hepatic lobules with central veins
    for (let k = 0; k < 3; k++) {
      const x = cx + [-18, 16, 0][k], y = cy + [-4, 5, -12][k];
      ctx.fillStyle = rgba(shade(base, -0.08), 0.6);
      ctx.strokeStyle = rgba(shade(base, -0.32), 0.7);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let a = 0; a <= 6; a++) {
        const ang = (a / 6) * TAU;
        const px = x + Math.cos(ang) * 12, py = y + Math.sin(ang) * 6.5;
        if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(90,40,90,0.6)';
      ctx.beginPath();
      ctx.ellipse(x, y, 2.4, 1.5, 0, 0, TAU);
      ctx.fill();
    }
  } else {
    // marrow route: blood cells drifting toward the core
    for (let k = 0; k < 9; k++) {
      const x = cx + (hash01(i, j, 60 + k) - 0.5) * 60;
      const y = cy + (hash01(i, j, 70 + k) - 0.5) * 28;
      const red = k % 3 !== 0;
      ctx.fillStyle = red ? 'rgba(206,52,72,0.7)' : 'rgba(250,245,255,0.8)';
      ctx.beginPath();
      ctx.ellipse(x, y, 3.4, 2, 0, 0, TAU);
      ctx.fill();
      if (red) {
        ctx.fillStyle = 'rgba(140,20,40,0.6)';
        ctx.beginPath();
        ctx.ellipse(x, y, 1.4, 0.8, 0, 0, TAU);
        ctx.fill();
      }
    }
  }
}

function drawLumenTile(ctx, geom, pt) {
  const { T } = geom;
  const c = tileCorners(T, pt.i, pt.j, 0);
  ctx.save();
  tileFill(ctx, c);
  ctx.clip();
  const g = ctx.createLinearGradient(c.top.x, c.top.y, c.bottom.x, c.bottom.y);
  g.addColorStop(0, shade(pt.color, -0.3));
  g.addColorStop(0.5, shade(pt.color, -0.13));
  g.addColorStop(1, shade(pt.color, -0.06));
  ctx.fillStyle = g;
  ctx.fillRect(c.left.x - 2, c.top.y - 2, c.right.x - c.left.x + 4, c.bottom.y - c.top.y + 4);
  lumenTexture(ctx, c, pt, pt.i, pt.j);

  // wet sheen along the lumen's centre line
  const pts = [];
  for (let s = pt.s - 60; s <= pt.s + 60; s += 15) {
    const p = geom.posAt(Math.max(0, Math.min(geom.len, s)));
    pts.push(toIso(p.x, p.y));
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [w, a] of [[22, 0.07], [10, 0.12], [3, 0.22]]) {
    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    pts.forEach((q, k) => (k ? ctx.lineTo(q.x, q.y - 2) : ctx.moveTo(q.x, q.y - 2)));
    ctx.stroke();
  }

  // ambient occlusion where the raised mucosa walls meet the floor
  const backs = [];
  if (!geom.isPath(pt.i - 1, pt.j)) backs.push([c.top, c.left]);
  if (!geom.isPath(pt.i, pt.j - 1)) backs.push([c.top, c.right]);
  for (const [a, b] of backs) {
    for (const [w, al] of [[34, 0.1], [18, 0.14], [7, 0.18]]) {
      ctx.strokeStyle = `rgba(70,10,35,${al})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- tissue tiles

function drawTissueTile(ctx, geom, i, j) {
  const { T, W, H } = geom;
  const base = groundTint(geom, i, j);
  const c = tileCorners(T, i, j, GROUND_H);
  const b = tileCorners(T, i, j, 0);
  if (i + 1 < W && geom.isPath(i + 1, j)) {
    const g = ctx.createLinearGradient(0, c.right.y, 0, b.bottom.y);
    g.addColorStop(0, shade(base, -0.16));
    g.addColorStop(1, shade(base, -0.42));
    ctx.fillStyle = g;
    quad(ctx, c.right, c.bottom, b.bottom, b.right);
    ctx.fill();
    ctx.strokeStyle = rgba(shade(base, -0.5), 0.35);
    ctx.lineWidth = 1;
    for (let k = 1; k < 6; k++) {
      const a = lerp(c.right, c.bottom, k / 6);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y + 2);
      ctx.quadraticCurveTo(a.x + 1.5, a.y + GROUND_H * 0.5, a.x, a.y + GROUND_H - 2);
      ctx.stroke();
    }
  }
  if (j + 1 < H && geom.isPath(i, j + 1)) {
    const g = ctx.createLinearGradient(0, c.left.y, 0, b.bottom.y);
    g.addColorStop(0, shade(base, -0.04));
    g.addColorStop(1, shade(base, -0.3));
    ctx.fillStyle = g;
    quad(ctx, c.bottom, c.left, b.left, b.bottom);
    ctx.fill();
    ctx.strokeStyle = rgba(shade(base, -0.45), 0.3);
    ctx.lineWidth = 1;
    for (let k = 1; k < 6; k++) {
      const a = lerp(c.bottom, c.left, k / 6);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y + 2);
      ctx.quadraticCurveTo(a.x - 1.5, a.y + GROUND_H * 0.5, a.x, a.y + GROUND_H - 2);
      ctx.stroke();
    }
  }
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.moveTo(c.top.x, c.top.y - 0.6);
  ctx.lineTo(c.right.x + 1.2, c.right.y);
  ctx.lineTo(c.bottom.x, c.bottom.y + 0.6);
  ctx.lineTo(c.left.x - 1.2, c.left.y);
  ctx.closePath();
  ctx.fill();

  // glossy lips where the mucosa drops into the lumen
  ctx.lineCap = 'round';
  const lip = (p, q) => {
    ctx.strokeStyle = 'rgba(255,226,232,0.55)';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
  };
  if (i + 1 < W && geom.isPath(i + 1, j)) lip(c.right, c.bottom);
  if (j + 1 < H && geom.isPath(i, j + 1)) lip(c.bottom, c.left);
  if (geom.isPath(i - 1, j)) lip(c.top, c.left);
  if (geom.isPath(i, j - 1)) lip(c.top, c.right);
}

function tissueClip(ctx, geom) {
  const { T, W, H } = geom;
  ctx.beginPath();
  for (let i = 0; i < W; i++) {
    for (let j = 0; j < H; j++) {
      if (geom.isPath(i, j)) continue;
      const c = tileCorners(T, i, j, GROUND_H);
      ctx.moveTo(c.top.x, c.top.y - 0.6);
      ctx.lineTo(c.right.x + 1, c.right.y);
      ctx.lineTo(c.bottom.x, c.bottom.y + 0.6);
      ctx.lineTo(c.left.x - 1, c.left.y);
      ctx.closePath();
    }
  }
  ctx.clip();
}

function drawSurfaceDetail(ctx, geom) {
  const { T, W, H } = geom;
  ctx.save();
  tissueClip(ctx, geom);

  // soft key light from the upper left
  const b = geom.groundBounds;
  const lg = ctx.createLinearGradient(b.x0, b.y0, b.x1, b.y1);
  lg.addColorStop(0, 'rgba(255,240,245,0.16)');
  lg.addColorStop(0.55, 'rgba(255,240,245,0)');
  lg.addColorStop(1, 'rgba(60,10,30,0.16)');
  ctx.fillStyle = lg;
  ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);

  // epithelial cobblestones and crypt openings
  for (let i = 0; i < W; i++) {
    for (let j = 0; j < H; j++) {
      if (geom.isPath(i, j)) continue;
      const c = tileCorners(T, i, j, GROUND_H);
      for (let k = 0; k < 6; k++) {
        const u = hash01(i, j, 10 + k) * 0.8 + 0.1;
        const v = hash01(i, j, 20 + k) * 0.8 + 0.1;
        const x = c.top.x + (c.right.x - c.top.x) * u + (c.left.x - c.top.x) * v;
        const y = c.top.y + (c.right.y - c.top.y) * u + (c.left.y - c.top.y) * v;
        const r = 5 + hash01(i, j, 30 + k) * 5;
        ctx.fillStyle = 'rgba(255,236,240,0.2)';
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.5, 0, 0, TAU);
        ctx.fill();
        if (k < 2) {
          ctx.fillStyle = 'rgba(150,40,70,0.28)';
          ctx.beginPath();
          ctx.ellipse(x + 1, y + 0.5, 1.8, 1, 0, 0, TAU);
          ctx.fill();
        }
      }
    }
  }

  // capillary network (arterioles red, venules blue)
  const rnd = seeded(20251);
  const lifted = (x, y) => {
    const q = toIso(x, y);
    return { x: q.x, y: q.y - GROUND_H };
  };
  const trace = (pts, width, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const q0 = lifted(pts[0][0], pts[0][1]);
    ctx.moveTo(q0.x, q0.y);
    for (let k = 1; k < pts.length - 1; k++) {
      const a = lifted(pts[k][0], pts[k][1]);
      const n = lifted((pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2);
      ctx.quadraticCurveTo(a.x, a.y, n.x, n.y);
    }
    const ql = lifted(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    ctx.lineTo(ql.x, ql.y);
    ctx.stroke();
  };
  for (let v = 0; v < 18; v++) {
    let x = (rnd() * W - 0.5) * T, y = (rnd() * H - 0.5) * T;
    let ang = rnd() * TAU;
    const vein = v % 3 === 0;
    const pts = [[x, y]];
    const twigs = [];
    for (let k = 0; k < 9; k++) {
      ang += (rnd() - 0.5) * 1.1;
      const step = 45 + rnd() * 40;
      x += Math.cos(ang) * step;
      y += Math.sin(ang) * step;
      pts.push([x, y]);
      if (rnd() < 0.45) {
        let tx = x, ty = y, ta = ang + (rnd() < 0.5 ? 1 : -1) * (0.7 + rnd() * 0.6);
        const tw = [[tx, ty]];
        for (let q = 0; q < 3; q++) {
          ta += (rnd() - 0.5) * 0.8;
          tx += Math.cos(ta) * (22 + rnd() * 18);
          ty += Math.sin(ta) * (22 + rnd() * 18);
          tw.push([tx, ty]);
        }
        twigs.push(tw);
      }
    }
    const col = vein ? 'rgba(88,92,190,' : 'rgba(196,36,60,';
    trace(pts, vein ? 4.2 : 3.4, col + '0.16)');
    trace(pts, vein ? 2.2 : 1.8, col + '0.42)');
    for (const tw of twigs) trace(tw, 1.1, col + '0.34)');
  }
  ctx.restore();
}

// ---------------------------------------------------------------- props

function villusFrond(ctx, x, y, h, w, sway, tint) {
  const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
  g.addColorStop(0, shade(tint, 0.18));
  g.addColorStop(0.45, tint);
  g.addColorStop(1, shade(tint, -0.25));
  ctx.fillStyle = g;
  ctx.strokeStyle = 'rgba(90,20,45,0.45)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.bezierCurveTo(x - w * 1.05, y - h * 0.6, x - w * 0.7 + sway, y - h, x + sway, y - h);
  ctx.bezierCurveTo(x + w * 0.7 + sway, y - h, x + w * 1.05, y - h * 0.6, x + w, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(200,30,55,0.55)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.35, y - 1);
  ctx.quadraticCurveTo(x - w * 0.4 + sway * 0.6, y - h * 0.85, x + sway * 0.8, y - h * 0.86);
  ctx.quadraticCurveTo(x + w * 0.4 + sway * 0.6, y - h * 0.85, x + w * 0.35, y - 1);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(x - w * 0.3 + sway * 0.8, y - h * 0.82, w * 0.25, h * 0.08, -0.3, 0, TAU);
  ctx.fill();
}

function glossyBall(ctx, x, y, r, color, edge) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, shade(color, 0.6));
  g.addColorStop(0.5, color);
  g.addColorStop(1, shade(color, -0.3));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 0.9;
  ctx.stroke();
}

function propShadow(ctx, x, y, rx, ry) {
  ctx.fillStyle = 'rgba(80,15,40,0.22)';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 2, rx, ry, 0, 0, TAU);
  ctx.fill();
}

function drawProp(ctx, kind, x, y, seed, big) {
  const r = (k) => hash01(seed, k, 91);
  if (kind === 'villi') {
    const n = big ? 6 : 3 + Math.floor(r(1) * 3);
    const fr = [];
    for (let k = 0; k < n; k++) {
      fr.push({ dx: (r(10 + k) - 0.5) * 46, dy: (r(20 + k) - 0.5) * 20, h: (big ? 26 : 16) + r(30 + k) * (big ? 16 : 10) });
    }
    fr.sort((a, b) => a.dy - b.dy);
    propShadow(ctx, x, y + 2, big ? 30 : 22, big ? 13 : 9);
    for (const f of fr) villusFrond(ctx, x + f.dx, y + f.dy, f.h, big ? 6 : 4.6, (r(40) - 0.5) * 4, '#f0a3b2');
  } else if (kind === 'fat') {
    const n = 2 + Math.floor(r(1) * 3);
    propShadow(ctx, x, y + 2, 20, 8);
    const bs = [];
    for (let k = 0; k < n; k++) bs.push({ dx: (r(10 + k) - 0.5) * 28, dy: (r(20 + k) - 0.5) * 12, s: 6 + r(30 + k) * 5 });
    bs.sort((a, b) => a.dy - b.dy);
    for (const b of bs) glossyBall(ctx, x + b.dx, y + b.dy - b.s * 0.8, b.s, '#ffd67a', 'rgba(150,100,30,0.6)');
  } else if (kind === 'lymph') {
    propShadow(ctx, x, y + 2, 20, 9);
    ctx.strokeStyle = 'rgba(160,190,90,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 26, y + 6);
    ctx.quadraticCurveTo(x - 14, y - 2, x - 6, y - 2);
    ctx.moveTo(x + 6, y - 1);
    ctx.quadraticCurveTo(x + 18, y + 4, x + 28, y - 4);
    ctx.stroke();
    const g = ctx.createRadialGradient(x - 4, y - 12, 2, x, y - 6, 18);
    g.addColorStop(0, '#e6d6ff');
    g.addColorStop(0.6, '#a985d8');
    g.addColorStop(1, '#7552a8');
    ctx.fillStyle = g;
    ctx.strokeStyle = 'rgba(60,30,90,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 15, y);
    ctx.bezierCurveTo(x - 15, y - 18, x + 15, y - 18, x + 15, y);
    ctx.ellipse(x, y, 15, 6, 0, 0, Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(x - 5, y - 10, 4, 2, -0.3, 0, TAU);
    ctx.fill();
  } else if (kind === 'mucus') {
    const g = ctx.createRadialGradient(x - 6, y - 2, 2, x, y, 22);
    g.addColorStop(0, 'rgba(235,252,255,0.85)');
    g.addColorStop(1, 'rgba(150,215,235,0.35)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, 20, 8, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,180,210,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
    for (let k = 0; k < 2; k++) glossyBall(ctx, x - 8 + k * 14, y - 5 - k * 2, 3.4 - k, '#bfe9f7', 'rgba(80,150,190,0.6)');
  } else if (kind === 'crypt') {
    for (let k = 0; k < 3; k++) {
      const px = x + (r(10 + k) - 0.5) * 40, py = y + (r(20 + k) - 0.5) * 16;
      ctx.fillStyle = 'rgba(255,215,222,0.8)';
      ctx.beginPath();
      ctx.ellipse(px, py, 7, 3.6, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(120,25,55,0.75)';
      ctx.beginPath();
      ctx.ellipse(px, py + 0.4, 3.8, 1.8, 0, 0, TAU);
      ctx.fill();
    }
  } else if (kind === 'vessel') {
    // a raised vessel loop arching over the mucosa
    for (const [col, off] of [['#b52437', -5], ['#5462b6', 5]]) {
      ctx.strokeStyle = shade(col, -0.25);
      ctx.lineWidth = 5.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - 28, y + off * 0.5);
      ctx.bezierCurveTo(x - 14, y - 22 + off, x + 14, y - 22 + off, x + 28, y + off * 0.5);
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.lineWidth = 3.6;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 18, y - 8 + off);
      ctx.bezierCurveTo(x - 10, y - 16 + off, x + 4, y - 17 + off, x + 10, y - 15 + off);
      ctx.stroke();
    }
  }
}

function propPlan(geom) {
  const { W, H, T } = geom;
  const blocked = new Set();
  const core = geom.siteList.find((s) => s.kind === 'core');
  for (const info of geom.sites.values()) {
    if (info.inLumen) continue;
    const i = Math.round(info.x / T), j = Math.round(info.y / T);
    blocked.add(i + ',' + j);
  }
  if (core) {
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) blocked.add((core.x + di) + ',' + (core.y + dj));
  }
  const mouth = { i: Math.round(geom.mouth.x / T), j: Math.round(geom.mouth.y / T) };
  for (let dj = -1; dj <= 1; dj++) blocked.add(mouth.i + ',' + (mouth.j + dj));
  const out = [];
  for (let i = 0; i < W; i++) {
    for (let j = 0; j < H; j++) {
      if (geom.isPath(i, j) || blocked.has(i + ',' + j)) continue;
      const nearLumen = geom.isPath(i + 1, j) || geom.isPath(i - 1, j) || geom.isPath(i, j + 1) || geom.isPath(i, j - 1);
      const edge = i === 0 || j === 0 || i === W - 1 || j === H - 1;
      const roll = hash01(i, j, 777);
      let kind = null;
      let big = false;
      if (nearLumen) {
        if (roll < 0.2) kind = roll < 0.12 ? 'crypt' : 'mucus';
      } else if (edge) {
        if (roll < 0.75) { kind = roll < 0.5 ? 'villi' : roll < 0.62 ? 'fat' : 'lymph'; big = kind === 'villi'; }
      } else if (roll < 0.42) {
        kind = ['villi', 'fat', 'lymph', 'crypt', 'villi', 'fat', 'mucus'][Math.floor(hash01(i, j, 778) * 7)];
      }
      if (kind) out.push({ i, j, kind, big });
    }
  }
  out.sort((a, b) => a.i + a.j - (b.i + b.j));
  return out;
}

function drawPlinth(ctx, geom, info) {
  const T = geom.T;
  const q = toIso(info.x, info.y);
  const y = q.y - GROUND_H;
  if (info.kind === 'slot' || info.kind === 'core' || info.kind === 'moat' || info.kind === 'peristalsis') {
    const hw = info.kind === 'core' ? 70 : 40, hh = hw / 2;
    ctx.fillStyle = 'rgba(120,40,70,0.16)';
    ctx.beginPath();
    ctx.moveTo(q.x, y - hh);
    ctx.lineTo(q.x + hw, y);
    ctx.lineTo(q.x, y + hh);
    ctx.lineTo(q.x - hw, y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,244,0.45)';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (info.kind === 'wall' || info.kind === 'kupffer') {
    const d = geom.dirAt(info.s);
    const half = T * 0.46;
    const ends = d.dx !== 0
      ? [toIso(info.x, info.y - half), toIso(info.x, info.y + half)]
      : [toIso(info.x - half, info.y), toIso(info.x + half, info.y)];
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(ends[0].x, ends[0].y);
    ctx.lineTo(ends[1].x, ends[1].y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

export function drawGround(ctx, geom) {
  const { T, W, H } = geom;
  drawSlab(ctx, geom);
  const order = [];
  for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) order.push([i, j]);
  order.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]) || a[0] - b[0]);
  const pathTileMap = new Map(geom.pathTiles.map((t) => [t.i + ',' + t.j, t]));
  for (const [i, j] of order) {
    const pt = pathTileMap.get(i + ',' + j);
    if (pt) drawLumenTile(ctx, geom, pt);
    else drawTissueTile(ctx, geom, i, j);
  }
  drawSurfaceDetail(ctx, geom);
  for (const p of propPlan(geom)) {
    const q = toIso(p.i * T, p.j * T);
    drawProp(ctx, p.kind, q.x, q.y - GROUND_H, p.i * 131 + p.j * 17, p.big);
  }
  for (const info of geom.sites.values()) drawPlinth(ctx, geom, info);
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

// Screen-space backdrop: the body cavity behind the floating gut diorama.
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
  f: hash01(k, 11, 3), off: (hash01(k, 12, 3) - 0.5) * 64, sp: 26 + hash01(k, 13, 3) * 30, kind: k % 4,
}));

// Chyme and bubbles drifting along the lumen, mouth to core.
export function drawLumenFlow(ctx, geom, t, speed = 1) {
  ctx.save();
  for (const p of FLOW) {
    const s = (p.f * geom.len + t * p.sp * speed) % geom.len;
    const pos = geom.posAt(s);
    const d = geom.dirAt(s);
    const q = toIso(pos.x - d.dy * p.off, pos.y + d.dx * p.off);
    const z = geom.zoneOf(s);
    const fadeIn = Math.min(1, s / 120, (geom.len - s) / 160);
    if (p.kind === 0) {
      ctx.strokeStyle = `rgba(255,255,255,${(0.55 * fadeIn).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(q.x, q.y - 3, 2.6, 0, TAU);
      ctx.stroke();
    } else {
      ctx.fillStyle = rgba(shade(z.color, -0.35), (0.45 * fadeIn).toFixed(2));
      ctx.beginPath();
      ctx.ellipse(q.x, q.y - 1, 3 + p.kind * 0.6, 1.7, 0, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
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
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.7 + hash01(tile.i, tile.j, k)) % 1;
      const cx = (c.top.x + c.bottom.x) / 2 + (hash01(tile.i, tile.j, k + 5) - 0.5) * 44;
      const cy = (c.top.y + c.bottom.y) / 2 + (hash01(tile.i, tile.j, k + 9) - 0.5) * 18 - ph * 12;
      ctx.strokeStyle = `rgba(230,255,140,${(0.8 * (1 - ph) * strength).toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, 2 + ph * 3, 0, TAU);
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
  ctx.ellipse(ix, iy, r * Math.SQRT1_2, r * Math.SQRT1_2 * 0.5, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

export function drawMouth(ctx, geom, t, open) {
  const q = toIso(geom.mouth.x, geom.mouth.y);
  const x = q.x, y = q.y - GROUND_H - 18;
  const o = 4 + open * 11 + Math.sin(t * 3) * 0.9;
  ctx.save();
  ctx.fillStyle = 'rgba(60,10,30,0.3)';
  ctx.beginPath();
  ctx.ellipse(x + 3, q.y - GROUND_H + 6, 36, 13, 0, 0, TAU);
  ctx.fill();
  // oral cavity
  const cav = ctx.createRadialGradient(x, y, 2, x, y, 28);
  cav.addColorStop(0, '#2a0614');
  cav.addColorStop(1, '#6a1832');
  ctx.fillStyle = cav;
  ctx.beginPath();
  ctx.ellipse(x, y, 25, o + 1, 0, 0, TAU);
  ctx.fill();
  // tongue
  ctx.fillStyle = '#e46a86';
  ctx.beginPath();
  ctx.ellipse(x + 2, y + o * 0.45, 15, Math.max(1.5, o * 0.45), 0, Math.PI, 0);
  ctx.fill();
  // teeth
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
  // lips
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
