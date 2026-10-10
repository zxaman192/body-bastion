import { toIso, GROUND_H, hash01 } from './geom.js';
import { shade, rgba, mix } from './color.js';
import {
  TAU, ellipse, circle, roundRect, capsule, star, antibody, hpBar, waterDrop, textLabel,
} from './shapes.js';
import {
  OUTLINE, material, poly, groundShadow, prism, cylinder, cone, pyramid, dome, sphere, glow, banner,
  archWindow, pad, metalTint,
} from './art.js';

// Approximate drawn height of each building above its anchor (used for HP bars and projectile origins).
const HEIGHT = {
  core: 150, acid_moat: 26, mucus_wall: 34, villi_wall: 42, flora_garden: 36, paneth_tower: 96,
  iga_cannon: 64, macrophage_tower: 66, neutrophil_barracks: 70, kupffer_gate: 70, peristalsis: 34,
  ors_station: 92, iv_drip: 96, drug_battery: 84, peyers_patch: 44, mitochondria: 58,
  nutrient_absorber: 70, pharmacy_lab: 82, vaccine_lab: 84,
};

const DRUG_ABBR = {
  ceftriaxone: 'CEF', azithromycin: 'AZI', fluoroquinolone: 'CIP', doxycycline: 'DOX', metronidazole: 'MET',
  luminal_agent: 'LUM', vanco_fidaxo: 'VAN', hpylori_combo: 'HPR', albendazole: 'ALB', antifungal: 'AF',
};

export function drugAbbr(key) {
  return DRUG_ABBR[key] || String(key || '').slice(0, 3).toUpperCase();
}

export function buildingHeight(key) {
  return HEIGHT[key] || 60;
}

export function siteAnchorIso(geom, info) {
  const q = toIso(info.x, info.y);
  return info.inLumen ? { x: q.x, y: q.y } : { x: q.x, y: q.y - GROUND_H };
}

export function buildingTop(geom, info, key) {
  const a = siteAnchorIso(geom, info);
  return { x: a.x, y: a.y - buildingHeight(key) * 0.75 };
}

function lumenEnds(geom, info, frac = 0.46) {
  const d = geom.dirAt(info.s);
  const half = (geom.lumenHalf ? geom.lumenHalf(info.s) + 4 : geom.T * 0.46) * (frac / 0.46);
  let e1, e2;
  if (d.dx !== 0) {
    e1 = toIso(info.x, info.y - half);
    e2 = toIso(info.x, info.y + half);
  } else {
    e1 = toIso(info.x - half, info.y);
    e2 = toIso(info.x + half, info.y);
  }
  return e1.y <= e2.y ? [e1, e2] : [e2, e1];
}

function lerpPt(a, b, k) {
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

function hpFrac(b) {
  return b.maxHp > 0 ? Math.max(0, Math.min(1, b.hp / b.maxHp)) : 1;
}

function lvOf(b) {
  return Math.max(1, Math.min(5, b.lv || 1));
}

// Level 5 buildings shimmer with a crystal aura, like a maxed-out building.
function aura(ctx, x, y, lv, t, hw = 40) {
  if (lv < 5) return;
  const m = material(lv);
  glow(ctx, x, y - 4, hw * 1.3, m.glow, 0.22 + 0.08 * Math.sin(t * 2));
  for (let k = 0; k < 5; k++) {
    const p = (t * 0.35 + k / 5) % 1;
    const a = k * 1.7 + t * 0.3;
    ctx.fillStyle = rgba(m.glow, (1 - p) * 0.9);
    star(ctx, x + Math.cos(a) * hw * 0.8, y - 6 - p * 60 + Math.sin(a) * hw * 0.2, 4, 3, 1.1, t);
    ctx.fill();
  }
}

function stonePad(ctx, x, y, b, env, hw = 38, h = 7) {
  aura(ctx, x, y, lvOf(b), env.t, hw);
  return pad(ctx, x, y, hw, hw / 2, lvOf(b), h);
}

// ---------------------------------------------------------------- Bone Marrow Core (the citadel)

function turret(ctx, x, y, h, bone, m, lv, t, flag) {
  cylinder(ctx, x, y, 13, 6.5, h, bone, { bands: [0.35, 0.72], bandColor: rgba(m.trim, 0.85), bandWidth: 1.8 });
  archWindow(ctx, x - 3, y - h * 0.45, 5, 9, '#ffe9a8', t);
  const ring = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    ring.push([x + Math.cos(a) * 11.5, y - h + Math.sin(a) * 5.8]);
  }
  ring.sort((p, q) => p[1] - q[1]);
  for (const [px, py] of ring) prism(ctx, px, py, 3.4, 1.7, 5, bone);
  cone(ctx, x, y - h - 4, 15, 7.5, 22 + lv * 2.5, m.banner);
  sphere(ctx, x, y - h - 4 - 22 - lv * 2.5, 2.6, '#f2c94c');
  if (flag) banner(ctx, x, y - h - 26 - lv * 2.5, 14, m.banner === '#00a3a3' ? '#ffd966' : '#ffffff', t, 11);
}

function drawCore(ctx, x, y, b, env) {
  const t = env.t;
  const lv = lvOf(b);
  const m = material(lv);
  const bone = mix('#f6ecd6', m.stone, lv >= 5 ? 0.55 : 0.22);
  aura(ctx, x, y, lv, t, 70);
  groundShadow(ctx, x + 10, y + 8, 96, 46, 0.42);
  prism(ctx, x, y, 74, 37, 14, m.stoneDark, { top: shade(m.stone, -0.04), bricks: true });
  const py = y - 14;
  // inner courtyard ring in trim colour
  ctx.strokeStyle = rgba(m.trim, 0.8);
  ctx.lineWidth = 2;
  poly(ctx, [[x, py - 31], [x + 62, py], [x, py + 31], [x - 62, py]]);
  ctx.stroke();

  const th = 36 + lv * 4;
  turret(ctx, x, py - 27, th + 6, bone, m, lv, t, lv >= 2);
  turret(ctx, x - 52, py, th, bone, m, lv, t, lv >= 3);
  turret(ctx, x + 52, py, th, bone, m, lv, t, lv >= 3);

  // keep
  const kh = 42 + lv * 5;
  prism(ctx, x, py, 40, 20, kh, bone, { bricks: true });
  // gate on the left face
  archWindow(ctx, x - 20, py + 9, 13, 21, lv >= 4 ? '#ffd27a' : '#c98a5a', t * 0.2);
  ctx.strokeStyle = 'rgba(60,30,20,0.75)';
  ctx.lineWidth = 1;
  for (let k = -1; k <= 1; k++) {
    ctx.beginPath();
    ctx.moveTo(x - 20 + k * 3.5, py + 8);
    ctx.lineTo(x - 20 + k * 3.5, py - 7);
    ctx.stroke();
  }
  prism(ctx, x - 22, py + 22, 10, 5, 4, m.stoneDark);
  // windows
  for (const [wx, wy] of [[-30, -kh * 0.62], [-12, -kh * 0.5], [14, -kh * 0.52], [30, -kh * 0.64]]) {
    archWindow(ctx, x + wx, py + (wx < 0 ? (wx + 40) * 0.5 : 20 - wx * 0.5) + wy, 6, 11, '#ffe9a8', t);
  }
  // blood-drop crest on the right face
  const cx = x + 21, cy = py + 10 - kh * 0.3;
  ctx.fillStyle = m.trim;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 9, cy - 9);
  ctx.lineTo(cx + 9, cy - 13);
  ctx.lineTo(cx + 9, cy + 3);
  ctx.quadraticCurveTo(cx, cy + 12, cx - 9, cy + 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  waterDrop(ctx, cx, cy - 2, 4.4, '#d61f3c');

  // crenellated roof terrace
  const ty = py - kh;
  for (let k = 0; k <= 4; k++) {
    const f = k / 4;
    prism(ctx, x - 40 + 40 * f, ty - 20 * f, 4, 2, 6, bone);
    prism(ctx, x + 40 * f, ty - 20 + 20 * f, 4, 2, 6, bone);
  }

  // marrow chamber: stem-cell orb under a glass dome
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
  const oy = ty - 16;
  glow(ctx, x, oy, 54 + pulse * 10, '#ff7ad9', 0.3 + 0.12 * pulse);
  cylinder(ctx, x, ty, 22, 11, 5, shade(m.metal, -0.1));
  const cells = [['#e8453c', 4], ['#ffffff', 3.6], ['#ff9bd2', 2.8], ['#e8453c', 4], ['#8fd3ff', 3.4], ['#e8453c', 4]];
  const orbit = (front) => {
    for (let k = 0; k < cells.length; k++) {
      const a = t * 1.1 + (k / cells.length) * TAU;
      if ((Math.sin(a) >= 0) !== front) continue;
      sphere(ctx, x + Math.cos(a) * 34, oy + Math.sin(a) * 12, cells[k][1], cells[k][0]);
    }
  };
  orbit(false);
  sphere(ctx, x, oy, 12 + pulse * 1.5, '#c44fe0');
  ctx.strokeStyle = 'rgba(255,220,250,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, oy, 7, t * 1.5, t * 1.5 + Math.PI * 1.2);
  ctx.stroke();
  ctx.save();
  ctx.globalAlpha = 0.3;
  dome(ctx, x, ty - 4, 21, 10.5, 30, '#e9dcff');
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ellipse(ctx, x - 8, ty - 24, 4, 7, 0.4);
  ctx.fill();
  orbit(true);
  if (lv >= 4) banner(ctx, x, ty - 34, 16, m.banner, t, 14);
}

// ---------------------------------------------------------------- slot buildings

function drawAcidMoat(ctx, x, y, b, env) {
  const t = env.t;
  const ppi = !!env.ppi;
  const lv = lvOf(b);
  const m = material(lv);
  aura(ctx, x, y, lv, t, 50);
  groundShadow(ctx, x + 5, y + 5, 62, 30, 0.35);
  ctx.fillStyle = m.stoneDark;
  ellipse(ctx, x, y + 2, 54, 27);
  ctx.fill();
  const blocks = [];
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * TAU;
    blocks.push({ x: x + Math.cos(a) * 47, y: y + Math.sin(a) * 23.5, back: Math.sin(a) < 0.05 });
  }
  const drawBlocks = (back) => {
    for (const bl of blocks.filter((q) => q.back === back).sort((p, q) => p.y - q.y)) {
      prism(ctx, bl.x, bl.y, 8, 4, 9, m.stone, { top: shade(m.stone, 0.12) });
    }
  };
  drawBlocks(true);
  ctx.fillStyle = '#5d2a33';
  ellipse(ctx, x, y - 2, 42, 20);
  ctx.fill();
  const liquid = ppi ? '#c9d6a0' : '#c6ec3a';
  const g = ctx.createRadialGradient(x - 12, y - 8, 4, x, y - 2, 42);
  g.addColorStop(0, shade(liquid, 0.45));
  g.addColorStop(0.7, liquid);
  g.addColorStop(1, shade(liquid, -0.35));
  ctx.fillStyle = g;
  ellipse(ctx, x, y - 1, 39, 17.5);
  ctx.fill();
  ctx.strokeStyle = rgba(shade(liquid, 0.5), 0.7);
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 2; k++) {
    const p = (t * 0.4 + k * 0.5) % 1;
    ellipse(ctx, x, y - 1, 10 + p * 28, (10 + p * 28) * 0.45);
    ctx.globalAlpha = 1 - p;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  const nb = ppi ? 3 : 10;
  for (let k = 0; k < nb; k++) {
    const ph = (t * (0.6 + hash01(k, 7) * 0.5) + hash01(k, 1)) % 1;
    const bx = x + (hash01(k, 2) - 0.5) * 58;
    const by = y - 1 + (hash01(k, 3) - 0.5) * 22 - ph * 14;
    ctx.strokeStyle = `rgba(245,255,190,${(0.9 * (1 - ph)).toFixed(2)})`;
    ctx.lineWidth = 1.3;
    circle(ctx, bx, by, 1.8 + ph * 3.4);
    ctx.stroke();
  }
  ctx.strokeStyle = `rgba(230,250,150,${ppi ? 0.12 : 0.3})`;
  ctx.lineWidth = 2.4;
  for (let k = 0; k < 3; k++) {
    const sx = x - 18 + k * 18;
    ctx.beginPath();
    for (let i = 0; i <= 9; i++) {
      const yy = y - 10 - i * 4.5;
      const xx = sx + Math.sin(i * 0.9 + t * 2 + k) * 3.5;
      if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }
  drawBlocks(false);
  // parietal-cell proton pumps
  for (let k = 0; k < Math.min(4, lv - 1); k++) {
    const a = [Math.PI * 0.85, Math.PI * 0.15, Math.PI * 1.15, Math.PI * 1.85][k];
    const px = x + Math.cos(a) * 52, py = y + Math.sin(a) * 26;
    cylinder(ctx, px, py, 5, 2.5, 16, metalTint('#9fb0c0', lv));
    sphere(ctx, px, py - 19, 4.2, '#c6ec3a');
    textLabel(ctx, 'H+', px, py - 19, { size: 5.5, color: '#2c3a05', weight: 900 });
  }
  textLabel(ctx, ppi ? 'HCl (PPI)' : 'HCl', x + 34, y - 26, { size: 9, bg: 'rgba(255,255,240,0.9)', color: '#4d5d0a', border: OUTLINE });
}

function drawPeristalsis(ctx, x, y, b, env) {
  const t = env.t;
  const off = !!env.stopflow;
  const top = stonePad(ctx, x, y, b, env, 44, 6);
  const pulse = off ? 0 : Math.sin(t * 4);
  const s = 1 + pulse * 0.07;
  if (!off) {
    for (let k = 0; k < 2; k++) {
      const p = (t * 0.7 + k * 0.5) % 1;
      ctx.strokeStyle = `rgba(217,87,107,${(0.5 * (1 - p)).toFixed(2)})`;
      ctx.lineWidth = 2;
      ellipse(ctx, x, top, 40 + p * 24, (40 + p * 24) * 0.5);
      ctx.stroke();
    }
  }
  const muscle = off ? '#b9a2a8' : '#d9576b';
  ctx.lineWidth = 16 * s;
  ctx.strokeStyle = shade(muscle, -0.35);
  ellipse(ctx, x, top - 4, 31 * s, 15.5 * s);
  ctx.stroke();
  ctx.strokeStyle = muscle;
  ellipse(ctx, x, top - 10, 31 * s, 15.5 * s);
  ctx.stroke();
  ctx.strokeStyle = rgba(shade(muscle, 0.45), 0.9);
  ctx.lineWidth = 1.4;
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * TAU + (off ? 0 : t * 0.5);
    const cx = x + Math.cos(a) * 31 * s, cy = top - 10 + Math.sin(a) * 15.5 * s;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(a) * 6, cy - Math.sin(a) * 3);
    ctx.lineTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 3);
    ctx.stroke();
  }
  ctx.fillStyle = '#e8c97e';
  ellipse(ctx, x, top - 10, 22 * s, 10.5 * s);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,60,40,0.3)';
  ellipse(ctx, x, top - 8, 15 * s, 6 * s);
  ctx.fill();
  if (!off) {
    const sp = 0.5 + 0.5 * Math.sin(t * 8);
    glow(ctx, x + 28, top - 22, 8, '#fff59a', 0.5 * sp);
  }
  if (off) textLabel(ctx, 'OFF', x, top - 30, { size: 9, bg: 'rgba(60,60,80,0.9)', color: '#fff' });
}

function drawPaneth(ctx, x, y, b, env) {
  const t = env.t;
  const lv = lvOf(b);
  const m = material(lv);
  const top = stonePad(ctx, x, y, b, env, 34);
  const h = 44 + lv * 3;
  cylinder(ctx, x, top, 17, 8.5, h, m.stone, { bands: [0.3, 0.62], bandColor: rgba(m.trim, 0.9), bandWidth: 2 });
  archWindow(ctx, x - 5, top - h * 0.3, 6, 11, '#ffd0dc', t);
  archWindow(ctx, x + 7, top - h * 0.62, 5, 9, '#ffd0dc', t + 1);
  const ty = top - h;
  const ring = [];
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * TAU;
    ring.push([x + Math.cos(a) * 16, ty + Math.sin(a) * 8]);
  }
  ring.sort((p, q) => p[1] - q[1]);
  for (const [px, py] of ring.filter((p) => p[1] <= ty)) prism(ctx, px, py, 3.6, 1.8, 6, m.stone);
  dome(ctx, x, ty - 1, 17, 8.5, 26, '#eef4ff');
  const gr = [[-8, -9], [-1, -15], [7, -10], [-5, -19], [4, -21], [0, -6], [10, -16], [-10, -15]];
  for (const [gx, gy] of gr) sphere(ctx, x + gx, ty + gy, 2.8, '#ff4f7b');
  for (const [px, py] of ring.filter((p) => p[1] > ty)) prism(ctx, px, py, 3.6, 1.8, 6, m.stone);
  if (lv >= 3) banner(ctx, x + 14, ty - 2, 20, m.banner, t, 10);
  if (b.firing > 0) {
    ctx.fillStyle = `rgba(255,240,140,${b.firing.toFixed(2)})`;
    star(ctx, x, ty - 32, 5, 10, 4, t * 6);
    ctx.fill();
  }
}

function drawIga(ctx, x, y, b, env) {
  const t = env.t;
  const lv = lvOf(b);
  const m = material(lv);
  const top = stonePad(ctx, x, y, b, env, 36);
  const metal = metalTint('#5f7fc4', lv);
  cylinder(ctx, x, top, 24, 12, 12, shade(metal, -0.1), { bands: [0.5], bandColor: rgba(m.trim, 0.9) });
  // bolts round the drum
  for (let k = 0; k < 8; k++) {
    const a = 0.2 + (k / 7) * (Math.PI - 0.4);
    sphere(ctx, x + Math.cos(a) * 22, top - 6 + Math.sin(a) * 11, 1.4, m.metal);
  }
  const aim = -0.45 + Math.sin(t * 0.6 + (b.idx || 0)) * 0.55;
  const recoil = (b.firing || 0) * 5;
  const bx = x, by = top - 20;
  const drawBarrel = () => {
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(aim);
    const len = 38 - recoil;
    const g = ctx.createLinearGradient(0, -8, 0, 8);
    g.addColorStop(0, shade(metal, 0.35));
    g.addColorStop(0.5, metal);
    g.addColorStop(1, shade(metal, -0.4));
    ctx.fillStyle = g;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    roundRect(ctx, 0, -7, len, 14, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = m.trim;
    for (const f of [0.35, 0.7]) {
      roundRect(ctx, len * f, -8, 4, 16, 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = shade(metal, -0.2);
    roundRect(ctx, len - 5, -9, 8, 18, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1d2240';
    ellipse(ctx, len + 3, 0, 2.5, 5.5);
    ctx.fill();
    ctx.restore();
  };
  const barrelBack = Math.sin(aim) < 0;
  if (barrelBack) drawBarrel();
  dome(ctx, x, top - 12, 19, 9.5, 16, metal);
  if (!barrelBack) drawBarrel();
  // IgA dimer crest
  const sway = Math.sin(t * 1.8) * 0.1 - (b.firing || 0) * 0.35;
  antibody(ctx, x - 6, top - 42, 15, sway - 0.3, '#ffffff', '#2f6be0');
  antibody(ctx, x + 6, top - 42, 15, sway + 0.3, '#ffffff', '#2f6be0');
  sphere(ctx, x, top - 36, 2.4, '#ffd54a');
  if (b.firing > 0) glow(ctx, bx + Math.cos(aim) * 44, by + Math.sin(aim) * 44, 16, '#bfe3ff', 0.7 * b.firing);
}

function drawMacrophage(ctx, x, y, b, env) {
  const t = env.t;
  const lv = lvOf(b);
  const m = material(lv);
  const top = stonePad(ctx, x, y, b, env, 38);
  cylinder(ctx, x, top, 30, 15, 6, shade(m.stone, -0.08), { top: shade(m.stone, 0.05) });
  const sc = 1 + (lv - 1) * 0.05;
  const cy = top - 30;
  ctx.beginPath();
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const r = 1 + 0.18 * Math.sin(3 * a + t * 1.6) + 0.1 * Math.sin(5 * a - t * 2.1) + 0.06 * Math.sin(8 * a + t);
    const px = x + Math.cos(a) * 30 * sc * r, py = cy + Math.sin(a) * 22 * sc * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(x - 10, cy - 10, 3, x, cy, 36 * sc);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.6, '#cfdcf5');
  g.addColorStop(1, '#93acd8');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#5f7fb8';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  // kidney-shaped nucleus
  ctx.fillStyle = '#6c63c0';
  ctx.beginPath();
  ctx.ellipse(x + 8, cy - 4, 10, 6.5, 0.4, 0.5, TAU - 0.5);
  ctx.quadraticCurveTo(x + 6, cy - 4, x + 8 + Math.cos(0.5) * 9, cy - 4 + Math.sin(0.5) * 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ellipse(ctx, x + 5, cy - 7, 3.5, 2, 0.4);
  ctx.fill();
  // phagosomes with digested bacteria
  for (const [px, py, r] of [[-13, 3, 4.6], [-5, 10, 4], [-17, -7, 3.6], [4, 9, 3.2]]) {
    ctx.fillStyle = 'rgba(255,240,200,0.7)';
    circle(ctx, x + px, cy + py, r);
    ctx.fill();
    ctx.strokeStyle = 'rgba(95,127,184,0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#8a4f3a';
    roundRect(ctx, x + px - r * 0.5, cy + py - 1, r, 2, 1);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ellipse(ctx, x - 12, cy - 13, 7, 3.5, -0.3);
  ctx.fill();
  if (lv >= 3) banner(ctx, x - 26, top - 2, 26, m.banner, t, 10);
}

function drawNeutrophil(ctx, x, y, b, env) {
  const t = env.t;
  const lv = lvOf(b);
  const m = material(lv);
  const top = stonePad(ctx, x, y, b, env, 40);
  const patrol = (front) => {
    for (let k = 0; k < 3; k++) {
      const a = t * 0.9 + k * 2.1;
      if ((Math.sin(a) >= 0) !== front) continue;
      const px = x + Math.cos(a) * 42, py = top + 6 + Math.sin(a) * 20;
      sphere(ctx, px, py - 6, 6, '#f6f2ff');
      ctx.fillStyle = '#7a4cc2';
      circle(ctx, px - 2, py - 6, 1.6);
      ctx.fill();
      circle(ctx, px + 0.5, py - 8, 1.6);
      ctx.fill();
      circle(ctx, px + 2.5, py - 5.5, 1.6);
      ctx.fill();
    }
  };
  patrol(false);
  const wall = mix('#efe6f8', m.stone, 0.45);
  const h = 24 + lv * 2;
  prism(ctx, x, top, 28, 14, h, wall, { bricks: true });
  archWindow(ctx, x - 14, top + 6, 11, 17, '#ffe2b0', t * 0.2);
  archWindow(ctx, x + 10, top + 1 - h * 0.35, 5, 9, '#ffe9a8', t);
  archWindow(ctx, x + 20, top - 4 - h * 0.35, 5, 9, '#ffe9a8', t + 1);
  pyramid(ctx, x, top - h, 32, 16, 26, m.banner);
  poly(ctx, [[x - 32, top - h], [x, top - h + 16], [x + 32, top - h], [x, top - h - 16]]);
  ctx.strokeStyle = rgba(m.trim, 0.9);
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // multilobed-nucleus crest
  const cx = x + 15, cy = top - h - 2;
  sphere(ctx, cx, cy, 6.5, '#f6f2ff');
  for (const [dx, dy] of [[-2.5, 0.5], [0, -2], [2.5, 0.5]]) {
    ctx.fillStyle = '#7a4cc2';
    circle(ctx, cx + dx, cy + dy, 1.8);
    ctx.fill();
  }
  banner(ctx, x, top - h - 26, 14, lv >= 4 ? m.trim : '#ffffff', t, 12);
  patrol(true);
}

function drawBattery(ctx, x, y, b, env) {
  const t = env.t;
  const gd = env.gd;
  const lv = lvOf(b);
  const m = material(lv);
  const drug = gd && Array.isArray(gd.drugs) ? gd.drugs.find((d) => d.key === b.drug) : null;
  const col = drug ? drug.color : '#9aa3b5';
  const top = stonePad(ctx, x, y, b, env, 36);
  const h = 30 + lv * 3;
  const frame = metalTint('#dfe3ec', lv);
  // lattice tower
  prism(ctx, x, top, 18, 9, h, frame, { bricks: false });
  ctx.strokeStyle = rgba(shade(frame, -0.45), 0.6);
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 3; k++) {
    const y0 = top - (h * k) / 3, y1 = top - (h * (k + 1)) / 3;
    ctx.beginPath();
    ctx.moveTo(x - 18, y0);
    ctx.lineTo(x, y1 + 9);
    ctx.moveTo(x, y0 + 9);
    ctx.lineTo(x - 18, y1);
    ctx.moveTo(x, y0 + 9);
    ctx.lineTo(x + 18, y1);
    ctx.moveTo(x + 18, y0);
    ctx.lineTo(x, y1 + 9);
    ctx.stroke();
  }
  // drug-coloured band
  poly(ctx, [[x - 18, top - h * 0.55], [x, top - h * 0.55 + 9], [x + 18, top - h * 0.55], [x + 18, top - h * 0.55 - 6], [x, top - h * 0.55 + 3], [x - 18, top - h * 0.55 - 6]]);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  const ty = top - h;
  prism(ctx, x, ty, 26, 13, 6, shade(m.stone, -0.05), { top: m.stone });
  for (const [px, py] of [[x - 26, ty - 6], [x, ty - 19], [x + 26, ty - 6]]) prism(ctx, px, py + 1, 3, 1.5, 5, m.trim);
  if (b.firing > 0) glow(ctx, x, ty - 24, 30, col, 0.6 * b.firing);
  const ang = -1.0 + Math.sin(t * 1.5 + (b.idx || 0)) * 0.08 + (b.firing || 0) * 0.15;
  capsule(ctx, x, ty - 22, 40, 10, ang, col, '#ffffff');
  capsule(ctx, x - 18, ty - 9, 12, 3.4, 0.4, col, '#ffffff');
  textLabel(ctx, drug ? drugAbbr(drug.key) : '—', x - 9, top - h * 0.3 + 4, { size: 8, bg: 'rgba(255,255,255,0.95)', color: shade(col, -0.5), weight: 900, border: OUTLINE });
}

function zincLevel(gd) {
  const d = gd && Array.isArray(gd.buildings) ? gd.buildings.find((q) => q.key === 'ors_station') : null;
  return d && d.zincFromLevel ? d.zincFromLevel : 99;
}

function drawOrs(ctx, x, y, b, env) {
  const t = env.t;
  const lv = lvOf(b);
  const m = material(lv);
  const top = stonePad(ctx, x, y, b, env, 34);
  const legH = 26;
  ctx.strokeStyle = shade(m.metal, -0.25);
  ctx.lineWidth = 3.4;
  for (const [dx, dy] of [[-15, -2], [15, -2], [-9, 5], [9, 5]]) {
    ctx.beginPath();
    ctx.moveTo(x + dx, top + dy);
    ctx.lineTo(x + dx * 0.8, top + dy - legH);
    ctx.stroke();
  }
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x - 15, top - 2);
  ctx.lineTo(x + 9, top + 5 - legH);
  ctx.moveTo(x + 15, top - 2);
  ctx.lineTo(x - 9, top + 5 - legH);
  ctx.stroke();
  const tb = top - legH;
  const th = 30 + lv * 2;
  // glass tank with oral rehydration solution
  ctx.save();
  ctx.globalAlpha = 0.9;
  cylinder(ctx, x, tb, 19, 9.5, th, '#d8ecff', { top: '#eef7ff' });
  ctx.restore();
  const level = 0.72 + 0.05 * Math.sin(t * 1.4);
  const lg = ctx.createLinearGradient(x - 18, 0, x + 18, 0);
  lg.addColorStop(0, '#7cc4ff');
  lg.addColorStop(1, '#2f7fd6');
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.moveTo(x - 17, tb - 1);
  ctx.lineTo(x - 17, tb - th * level);
  ctx.ellipse(x, tb - th * level, 17, 8.5, 0, Math.PI, 0, false);
  ctx.lineTo(x + 17, tb - 1);
  ctx.ellipse(x, tb - 1, 17, 8.5, 0, 0, Math.PI, false);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(200,235,255,0.75)';
  ellipse(ctx, x, tb - th * level, 17, 8.5);
  ctx.fill();
  for (let k = 0; k < 3; k++) {
    const p = (t * 0.5 + k / 3) % 1;
    ctx.fillStyle = `rgba(255,255,255,${(0.8 * (1 - p)).toFixed(2)})`;
    circle(ctx, x - 8 + k * 7, tb - 4 - p * th * level * 0.9, 1.6);
    ctx.fill();
  }
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1;
  ellipse(ctx, x, tb - th, 19, 9.5);
  ctx.stroke();
  ctx.strokeStyle = rgba(m.trim, 0.95);
  ctx.lineWidth = 2.2;
  for (const f of [0.15, 0.85]) {
    ctx.beginPath();
    ctx.ellipse(x, tb - th * f, 19, 9.5, 0, 0, Math.PI);
    ctx.stroke();
  }
  // roof cap
  cone(ctx, x, tb - th - 1, 21, 10.5, 12, m.banner);
  textLabel(ctx, 'ORS', x - 1, tb - th * 0.45, { size: 9, color: '#ffffff', weight: 900, stroke: '#1f4f8a', strokeWidth: 3 });
  // drip
  const dp = (t * 1.2) % 1;
  ctx.globalAlpha = 1 - dp;
  waterDrop(ctx, x - 20, tb + 4 + dp * 14, 2.6, '#4fa8ff');
  ctx.globalAlpha = 1;
  if (lv >= zincLevel(env.gd)) {
    sphere(ctx, x + 22, tb - th * 0.6, 7, '#b9c0c9');
    textLabel(ctx, 'Zn', x + 22, tb - th * 0.6, { size: 6.5, color: '#2a3442', weight: 900 });
  }
}

function drawIv(ctx, x, y, b, env) {
  const t = env.t;
  const lv = lvOf(b);
  const m = material(lv);
  const active = !!b.ivActive;
  const top = stonePad(ctx, x, y, b, env, 28, 6);
  cylinder(ctx, x, top, 10, 5, 5, shade(m.metal, -0.2));
  for (const a of [0.4, 2.1, 3.8, 5.4]) {
    ctx.strokeStyle = shade(m.metal, -0.35);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x, top - 3);
    ctx.lineTo(x + Math.cos(a) * 16, top + Math.sin(a) * 8);
    ctx.stroke();
    sphere(ctx, x + Math.cos(a) * 16, top + Math.sin(a) * 8, 2, '#333a48');
  }
  const ph = top - 84;
  ctx.strokeStyle = metalTint('#a7b0c2', lv);
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(x, top - 4);
  ctx.lineTo(x, ph);
  ctx.moveTo(x - 13, ph + 2);
  ctx.quadraticCurveTo(x, ph - 4, x + 13, ph + 2);
  ctx.stroke();
  if (active) glow(ctx, x, ph + 22, 30, '#7cc4ff', 0.5 + 0.2 * Math.sin(t * 6));
  ctx.fillStyle = 'rgba(232,244,255,0.95)';
  ctx.strokeStyle = '#6f8fbf';
  ctx.lineWidth = 1.3;
  roundRect(ctx, x - 12, ph + 4, 24, 34, 7);
  ctx.fill();
  ctx.stroke();
  const level = active ? 0.55 + 0.25 * Math.sin(t * 0.8) : 0.85;
  ctx.fillStyle = '#7cc4ff';
  roundRect(ctx, x - 10, ph + 36 - 30 * level, 20, 30 * level, 5);
  ctx.fill();
  textLabel(ctx, 'RL', x, ph + 22, { size: 8, color: '#163e72', weight: 900 });
  ctx.fillStyle = 'rgba(200,225,255,0.95)';
  roundRect(ctx, x - 3, ph + 38, 6, 9, 2);
  ctx.fill();
  ctx.strokeStyle = '#9fb8d8';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x, ph + 47);
  ctx.bezierCurveTo(x + 6, ph + 62, x + 20, ph + 64, x + 22, top - 2);
  ctx.stroke();
  if (active) {
    for (let k = 0; k < 2; k++) {
      const p = (t * 2 + k * 0.5) % 1;
      ctx.fillStyle = `rgba(80,160,255,${(1 - p).toFixed(2)})`;
      circle(ctx, x, ph + 40 + p * 6, 1.4);
      ctx.fill();
    }
  }
}

function drawPeyers(ctx, x, y, b, env) {
  const t = env.t;
  const lv = lvOf(b);
  const top = stonePad(ctx, x, y, b, env, 38, 5);
  cylinder(ctx, x, top, 32, 16, 6, '#efb3c4');
  const domes = [[-14, -3, 12], [13, -4, 12], [0, 7, 13], [-22, 6, 9], [22, 5, 9]].slice(0, 2 + Math.min(3, lv));
  domes.sort((p, q) => p[1] - q[1]);
  for (const [dx, dy, r] of domes) {
    dome(ctx, x + dx, top - 6 + dy, r, r * 0.5, r * 1.5, '#8e7cc3');
    glow(ctx, x + dx, top - 6 + dy - r * 0.8, r * 0.75, '#efe6ff', 0.55 + 0.2 * Math.sin(t * 2 + dx));
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ellipse(ctx, x + dx - r * 0.3, top - 6 + dy - r * 1.05, r * 0.25, r * 0.14, -0.4);
    ctx.fill();
  }
  // M cell sampling arrow
  const p = (t * 0.8) % 1;
  sphere(ctx, x + 30 - p * 20, top - 30 + p * 12, 2.2, '#ff9bd2');
}

function drawMito(ctx, x, y, b, env) {
  const t = env.t;
  const lv = lvOf(b);
  const m = material(lv);
  const top = stonePad(ctx, x, y, b, env, 36);
  prism(ctx, x, top, 26, 13, 8, metalTint('#c9b49a', lv));
  // coils
  for (const dx of [-17, 17]) {
    cylinder(ctx, x + dx, top - 8, 5, 2.5, 18, '#b87333', { bands: [0.2, 0.4, 0.6, 0.8], bandColor: 'rgba(90,40,10,0.6)', bandWidth: 1.2 });
    sphere(ctx, x + dx, top - 28, 3.4, '#ffe066');
  }
  const cy = top - 30;
  ctx.save();
  ctx.translate(x, cy);
  ctx.rotate(-0.28);
  const g = ctx.createLinearGradient(0, -14, 0, 14);
  g.addColorStop(0, '#ffc07a');
  g.addColorStop(1, '#cf5424');
  ctx.fillStyle = g;
  ellipse(ctx, 0, 0, 26 + lv, 14);
  ctx.fill();
  ctx.strokeStyle = '#8a3414';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.fillStyle = '#ffd9a8';
  ellipse(ctx, 0, 0, 21 + lv, 10);
  ctx.fill();
  ctx.strokeStyle = '#d0682d';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-19, 0);
  for (let k = 0; k < 7; k++) ctx.lineTo(-16 + k * 5.4, k % 2 ? 8 : -8);
  ctx.lineTo(20, 0);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ellipse(ctx, -9, -9, 8, 2.4, 0.1);
  ctx.fill();
  ctx.restore();
  const fl = 0.6 + 0.4 * Math.sin(t * 7);
  ctx.strokeStyle = `rgba(255,240,120,${fl.toFixed(2)})`;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x - 17, top - 28);
  ctx.lineTo(x - 6, top - 44 + Math.sin(t * 20) * 3);
  ctx.lineTo(x + 4, top - 40);
  ctx.lineTo(x + 17, top - 28);
  ctx.stroke();
  ctx.fillStyle = `rgba(255,230,60,${fl.toFixed(2)})`;
  ctx.beginPath();
  ctx.moveTo(x + 18, cy - 30);
  ctx.lineTo(x + 11, cy - 17);
  ctx.lineTo(x + 17, cy - 17);
  ctx.lineTo(x + 12, cy - 6);
  ctx.lineTo(x + 24, cy - 20);
  ctx.lineTo(x + 18, cy - 20);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  textLabel(ctx, 'ATP', x - 14, top + 4, { size: 7, bg: rgba(m.trim, 0.95), color: '#fff', weight: 900 });
}

function drawNutrient(ctx, x, y, b, env) {
  const t = env.t;
  const lv = lvOf(b);
  const m = material(lv);
  const top = stonePad(ctx, x, y, b, env, 36);
  const h = 30 + lv * 3;
  // villus-shaped silo with a brush border
  const g = ctx.createLinearGradient(x - 16, 0, x + 16, 0);
  g.addColorStop(0, '#ffc2c8');
  g.addColorStop(0.4, '#f497a4');
  g.addColorStop(1, '#c95d72');
  ctx.fillStyle = g;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 16, top);
  ctx.lineTo(x - 16, top - h);
  ctx.bezierCurveTo(x - 16, top - h - 22, x + 16, top - h - 22, x + 16, top - h);
  ctx.lineTo(x + 16, top);
  ctx.ellipse(x, top, 16, 8, 0, 0, Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,240,0.9)';
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 9; k++) {
    const a = Math.PI + (k / 8) * Math.PI;
    const px = x + Math.cos(a) * 14, py = top - h - 8 + Math.sin(a) * 9;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(a) * 3, py + Math.sin(a) * 4);
    ctx.stroke();
  }
  // lacteal and capillary loop
  ctx.strokeStyle = 'rgba(255,250,220,0.95)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, top + 2);
  ctx.lineTo(x, top - h - 4);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(200,30,55,0.7)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - 8, top + 3);
  ctx.quadraticCurveTo(x - 10, top - h - 10, x, top - h - 10);
  ctx.quadraticCurveTo(x + 10, top - h - 10, x + 8, top + 3);
  ctx.stroke();
  for (let k = 0; k < 5; k++) {
    const p = (t * 0.5 + k * 0.2) % 1;
    ctx.globalAlpha = 1 - p;
    sphere(ctx, x + Math.sin(k * 2 + t) * 4, top - 4 - p * (h + 8), 2.6, '#ffcf3d');
    ctx.globalAlpha = 1;
  }
  // storage barrel
  cylinder(ctx, x + 24, top + 2, 8, 4, 16, metalTint('#7fb86a', lv), { bands: [0.3, 0.7], bandColor: rgba(m.trim, 0.9) });
}

function drawPharmacy(ctx, x, y, b, env) {
  const t = env.t;
  const lv = lvOf(b);
  const m = material(lv);
  const top = stonePad(ctx, x, y, b, env, 38);
  const h = 30 + lv * 2;
  prism(ctx, x, top, 30, 15, h, mix('#f6f8fb', m.stone, 0.25), { bricks: true });
  archWindow(ctx, x - 16, top + 6, 10, 16, '#c8ffe6', t * 0.3);
  archWindow(ctx, x + 10, top + 2 - h * 0.4, 6, 10, '#ffe9a8', t);
  archWindow(ctx, x + 21, top - 3 - h * 0.4, 6, 10, '#ffe9a8', t + 1);
  prism(ctx, x, top - h, 33, 16.5, 6, '#2f9c84', { top: '#3fbf9f' });
  // green cross sign on the left face
  ctx.save();
  ctx.translate(x - 22, top - h * 0.55);
  ctx.transform(1, 0.5, 0, 1, 0, 0);
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, -8, -8, 16, 16, 3);
  ctx.fill();
  ctx.fillStyle = '#21b36a';
  ctx.fillRect(-2.6, -6.5, 5.2, 13);
  ctx.fillRect(-6.5, -2.6, 13, 5.2);
  ctx.restore();
  const fy = top - h - 6;
  // flask on the roof
  ctx.fillStyle = 'rgba(230,245,255,0.95)';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1;
  roundRect(ctx, x - 3, fy - 26, 6, 10, 1.5);
  ctx.fill();
  ctx.stroke();
  sphere(ctx, x, fy - 10, 10, '#c9ecff');
  ctx.fillStyle = '#4fd39a';
  ctx.beginPath();
  ctx.arc(x, fy - 10, 8.6, 0.25, Math.PI - 0.25);
  ctx.fill();
  const p = (t * 1.3) % 1;
  ctx.strokeStyle = `rgba(95,211,160,${(1 - p).toFixed(2)})`;
  ctx.lineWidth = 1.2;
  circle(ctx, x + Math.sin(t * 3) * 2, fy - 30 - p * 12, 1.8 + p * 2.5);
  ctx.stroke();
  if (lv >= 3) banner(ctx, x + 26, top - h - 6, 18, m.banner, t, 10);
}

function drawVaccineLab(ctx, x, y, b, env) {
  const t = env.t;
  const lv = lvOf(b);
  const m = material(lv);
  const top = stonePad(ctx, x, y, b, env, 38);
  const h = 30 + lv * 2;
  prism(ctx, x, top, 30, 15, h, mix('#f3f6ff', m.stone, 0.25), { bricks: true });
  archWindow(ctx, x - 16, top + 6, 10, 16, '#cfe4ff', t * 0.3);
  archWindow(ctx, x + 12, top + 1 - h * 0.45, 6, 10, '#ffe9a8', t);
  pyramid(ctx, x, top - h, 33, 16.5, 18, '#3d6fd6');
  // vial
  cylinder(ctx, x - 14, top - h - 2, 6, 3, 16, '#e3f1ff', { top: '#f2f8ff' });
  ctx.fillStyle = '#8fd3ff';
  ctx.fillRect(x - 19.5, top - h - 12, 11, 8);
  cylinder(ctx, x - 14, top - h - 18, 6.5, 3.2, 4, '#e0505e');
  // syringe crane
  ctx.save();
  ctx.translate(x + 12, top - h - 14);
  ctx.rotate(-0.7 + Math.sin(t * 1.4) * 0.06);
  ctx.fillStyle = 'rgba(235,245,255,0.97)';
  ctx.strokeStyle = '#6f8fbf';
  ctx.lineWidth = 1;
  roundRect(ctx, -14, -5, 26, 10, 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#7cc4ff';
  ctx.fillRect(-2, -4, 13, 8);
  ctx.fillStyle = '#9aa3b5';
  ctx.fillRect(-21, -1.4, 7, 2.8);
  ctx.fillRect(-23, -5, 2.4, 10);
  ctx.strokeStyle = '#9aa3b5';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(23, 0);
  ctx.stroke();
  ctx.restore();
  if (lv >= 3) banner(ctx, x + 28, top - h + 2, 18, m.banner, t, 10);
}

function drawUnknown(ctx, x, y, b, env) {
  const top = stonePad(ctx, x, y, b, env, 32);
  prism(ctx, x, top, 22, 11, 24, '#b8b0c8');
  textLabel(ctx, '?', x, top - 34, { size: 12, color: '#333' });
}

// ---------------------------------------------------------------- lumen walls

function wallPost(ctx, e, lv, h) {
  const m = material(lv);
  groundShadow(ctx, e.x + 2, e.y + 2, 11, 5, 0.3);
  prism(ctx, e.x, e.y, 8, 4, h, m.stone, { bricks: true });
  prism(ctx, e.x, e.y - h, 9.5, 4.75, 3, m.trim);
  sphere(ctx, e.x, e.y - h - 6, 3.4, lv >= 4 ? '#f2c94c' : m.metal);
}

function drawMucusWall(ctx, ends, b, env) {
  const f = hpFrac(b);
  const lv = lvOf(b);
  const [e1, e2] = ends;
  wallPost(ctx, e1, lv, 22 + lv * 2);
  const n = 6;
  for (let k = 0; k < n; k++) {
    const p = lerpPt(e1, e2, (k + 0.5) / n);
    const wob = Math.sin(env.t * 2 + k) * 0.9;
    const h = (16 + 10 * f + lv * 1.5) * (k % 2 ? 0.92 : 1);
    const r = 10 + wob * 0.4;
    const g = ctx.createRadialGradient(p.x - 4, p.y - h * 0.85, 2, p.x, p.y - h * 0.5, r * 1.5);
    g.addColorStop(0, 'rgba(250,255,255,0.97)');
    g.addColorStop(1, 'rgba(130,195,228,0.88)');
    ctx.fillStyle = g;
    ellipse(ctx, p.x, p.y - h * 0.5, r, h * 0.62 + wob);
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,130,175,0.8)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ellipse(ctx, p.x - 3, p.y - h * 0.78, 3, 2);
    ctx.fill();
    if (k % 2 === 0) {
      ctx.strokeStyle = 'rgba(40,110,160,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x + 2, p.y - h * 0.45, 3, 0, TAU);
      ctx.stroke();
    }
  }
  wallPost(ctx, e2, lv, 22 + lv * 2);
}

function drawVilliWall(ctx, ends, b, env) {
  const f = hpFrac(b);
  const lv = lvOf(b);
  const [e1, e2] = ends;
  wallPost(ctx, e1, lv, 26 + lv * 2);
  const n = 7;
  for (let row = 0; row < 2; row++) {
    for (let k = 0; k < n; k++) {
      const p = lerpPt(e1, e2, (k + 0.5 + row * 0.5) / (n + 0.5));
      const py = p.y + (row ? 4 : -3);
      const px = p.x + (row ? -3 : 3);
      const sway = Math.sin(env.t * 1.8 + k * 0.8 + row) * 1.6;
      const h = (22 + 12 * f + lv * 2) * (0.88 + hash01(k, 5 + row) * 0.24) * (row ? 0.85 : 1);
      const g = ctx.createLinearGradient(px - 5, 0, px + 5, 0);
      g.addColorStop(0, '#ffc6cc');
      g.addColorStop(1, '#d9707f');
      ctx.fillStyle = g;
      ctx.strokeStyle = 'rgba(120,30,50,0.55)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(px - 5, py);
      ctx.lineTo(px - 5 + sway * 0.5, py - h + 5);
      ctx.quadraticCurveTo(px + sway, py - h - 4, px + 5 + sway * 0.5, py - h + 5);
      ctx.lineTo(px + 5, py);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(200,30,55,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px - 2, py - 1);
      ctx.lineTo(px - 2 + sway * 0.6, py - h + 5);
      ctx.lineTo(px + 2 + sway * 0.6, py - h + 5);
      ctx.lineTo(px + 2, py - 1);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,245,245,0.95)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px + sway * 0.8, py - h + 3, 4, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
  }
  wallPost(ctx, e2, lv, 26 + lv * 2);
}

function drawFloraWall(ctx, ends, b, env) {
  const f = hpFrac(b);
  const lv = lvOf(b);
  const [e1, e2] = ends;
  const green = mix('#a08a50', '#4fb04f', f);
  wallPost(ctx, e1, lv, 18 + lv * 2);
  const n = 5;
  const bugs = ['#7fb2ff', '#c48bff', '#ff9ec7', '#ffd166', '#8ee6c4'];
  for (let k = 0; k < n; k++) {
    const p = lerpPt(e1, e2, (k + 0.5) / n);
    const h = 13 + 11 * f + lv;
    for (const [dx, dy, r] of [[-6, -h * 0.4, 8], [6, -h * 0.45, 8.5], [0, -h * 0.85, 9]]) {
      sphere(ctx, p.x + dx, p.y + dy, r * (0.75 + 0.25 * f), green);
    }
    const bob = Math.sin(env.t * 3 + k) * 1.2;
    ctx.fillStyle = bugs[k % bugs.length];
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.7;
    if (k % 2) {
      ctx.save();
      ctx.translate(p.x + 2, p.y - h * 0.8 + bob);
      ctx.rotate(0.6);
      roundRect(ctx, -4.5, -2, 9, 4, 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else {
      circle(ctx, p.x - 2.2, p.y - h * 0.75 + bob, 2.4);
      ctx.fill();
      ctx.stroke();
      circle(ctx, p.x + 2.5, p.y - h * 0.75 + bob, 2.4);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    circle(ctx, p.x + 6, p.y - h - 3, 2);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    circle(ctx, p.x + 6, p.y - h - 3, 0.9);
    ctx.fill();
  }
  wallPost(ctx, e2, lv, 18 + lv * 2);
}

function drawKupffer(ctx, ends, b, env) {
  const t = env.t;
  const f = hpFrac(b);
  const lv = lvOf(b);
  const m = material(lv);
  const [e1, e2] = ends;
  const H = 52 + lv * 3;
  const bars = Math.max(1, Math.ceil(6 * f));
  const pillar = (e) => {
    groundShadow(ctx, e.x + 3, e.y + 3, 14, 6, 0.32);
    prism(ctx, e.x, e.y, 10, 5, H, mix('#9b2d3a', m.stone, 0.25), { bricks: true });
    prism(ctx, e.x, e.y - H, 12, 6, 4, m.trim);
  };
  pillar(e1);
  // portcullis
  ctx.lineCap = 'round';
  for (let k = 0; k < 6; k++) {
    if (k >= bars && k % 2 === 1) continue;
    if (k >= bars + 2) continue;
    const p = lerpPt(e1, e2, (k + 1) / 7);
    ctx.strokeStyle = '#3a2a2e';
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - H + 8);
    ctx.lineTo(p.x, p.y - 2);
    ctx.stroke();
    ctx.strokeStyle = metalTint('#8a8f99', lv);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  for (const fy of [0.35, 0.7]) {
    const a = lerpPt(e1, e2, 1 / 7), c = lerpPt(e1, e2, 6 / 7);
    ctx.strokeStyle = '#3a2a2e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - H * fy);
    ctx.lineTo(c.x, c.y - H * fy);
    ctx.stroke();
  }
  // arch
  ctx.strokeStyle = shade('#9b2d3a', -0.35);
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(e1.x, e1.y - H);
  ctx.quadraticCurveTo((e1.x + e2.x) / 2, (e1.y + e2.y) / 2 - H - 16, e2.x, e2.y - H);
  ctx.stroke();
  ctx.strokeStyle = '#c95564';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.strokeStyle = rgba(m.trim, 0.9);
  ctx.lineWidth = 1.6;
  ctx.stroke();
  pillar(e2);
  for (const [i, e] of [e1, e2].entries()) {
    const bob = Math.sin(t * 2.4 + i * 2) * 1.5;
    ctx.fillStyle = '#f6b2b8';
    star(ctx, e.x, e.y - H - 12 + bob, 7, 11, 6, t * 0.5 + i);
    ctx.fill();
    ctx.strokeStyle = '#a63c4c';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#7a3a8a';
    circle(ctx, e.x, e.y - H - 12 + bob, 3.2);
    ctx.fill();
  }
}

function drawRubble(ctx, x, y, b, env, lumen, ends) {
  const seed = (b.idx || 0) + 1;
  const m = material(lvOf(b));
  const stones = [m.stone, m.stoneDark, shade(m.stone, 0.15)];
  if (lumen && ends) {
    const [e1, e2] = ends;
    for (let k = 0; k < 8; k++) {
      const p = lerpPt(e1, e2, (k + 0.5) / 8);
      const s = 3 + hash01(seed, k) * 4;
      prism(ctx, p.x + (hash01(seed, k, 4) - 0.5) * 6, p.y, s, s * 0.5, s * 0.7, stones[k % 3]);
    }
    return;
  }
  const big = b.key === 'core';
  const R = big ? 52 : 28;
  ctx.fillStyle = 'rgba(40,15,20,0.35)';
  ellipse(ctx, x, y + 2, R * 1.1, R * 0.5);
  ctx.fill();
  const n = big ? 18 : 10;
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = hash01(seed, k, 1) * TAU;
    const d = Math.sqrt(hash01(seed, k, 2));
    pts.push({ x: x + Math.cos(a) * d * R * 0.85, y: y + Math.sin(a) * d * R * 0.4, s: 3 + hash01(seed, k, 3) * (big ? 8 : 5), c: stones[k % 3] });
  }
  pts.sort((p, q) => p.y - q.y);
  for (const p of pts) prism(ctx, p.x, p.y, p.s, p.s * 0.5, p.s * 0.8, p.c);
  const sm = (env.t * 0.25 + seed * 0.1) % 1;
  ctx.fillStyle = `rgba(90,80,90,${(0.25 * (1 - sm)).toFixed(2)})`;
  circle(ctx, x + Math.sin(seed) * 6, y - 8 - sm * 26, 5 + sm * 9);
  ctx.fill();
  if (big) {
    ctx.fillStyle = 'rgba(196,79,224,0.4)';
    ellipse(ctx, x, y - 3, 16, 7);
    ctx.fill();
  }
}

const SLOT_DRAW = {
  core: drawCore, acid_moat: drawAcidMoat, peristalsis: drawPeristalsis, paneth_tower: drawPaneth,
  iga_cannon: drawIga, macrophage_tower: drawMacrophage, neutrophil_barracks: drawNeutrophil,
  drug_battery: drawBattery, ors_station: drawOrs, iv_drip: drawIv, peyers_patch: drawPeyers,
  mitochondria: drawMito, nutrient_absorber: drawNutrient, pharmacy_lab: drawPharmacy, vaccine_lab: drawVaccineLab,
};

const LUMEN_DRAW = {
  mucus_wall: drawMucusWall, villi_wall: drawVilliWall, flora_garden: drawFloraWall, kupffer_gate: drawKupffer,
};

function footprint(key) {
  if (key === 'core') return [76, 38];
  if (key === 'acid_moat') return [56, 28];
  if (key === 'peristalsis') return [46, 23];
  return [40, 20];
}

export function drawSelection(ctx, geom, info, t, color = '#ffd34d', key = null) {
  const a = siteAnchorIso(geom, info);
  const p = 0.5 + 0.5 * Math.sin(t * 5);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.6 + 0.4 * p;
  ctx.lineWidth = 3;
  if (info.inLumen) {
    const [e1, e2] = lumenEnds(geom, info, 0.52);
    ctx.lineCap = 'round';
    ctx.setLineDash([6, 5]);
    ctx.lineDashOffset = -t * 20;
    ctx.beginPath();
    ctx.moveTo(e1.x, e1.y + 4);
    ctx.lineTo(e2.x, e2.y + 4);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    const [hw, hh] = key ? footprint(key) : info.kind === 'core' ? [76, 38] : [42, 21];
    const k = 1.08 + 0.05 * p;
    ctx.fillStyle = rgba(color, 0.12);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - hh * k);
    ctx.lineTo(a.x + hw * k, a.y);
    ctx.lineTo(a.x, a.y + hh * k);
    ctx.lineTo(a.x - hw * k, a.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // corner brackets like a placement grid
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    for (const [cx, cy] of [[0, -hh], [hw, 0], [0, hh], [-hw, 0]]) {
      ctx.beginPath();
      ctx.arc(a.x + cx * k, a.y + cy * k, 2.6, 0, TAU);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawBuildSlotMarker(ctx, geom, info, t, color = '#ffffff') {
  const a = siteAnchorIso(geom, info);
  const p = 0.5 + 0.5 * Math.sin(t * 3 + info.idx);
  ctx.save();
  ctx.globalAlpha = 0.6 + 0.35 * p;
  ctx.fillStyle = rgba(color, 0.16);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  if (info.inLumen) {
    const [e1, e2] = lumenEnds(geom, info, 0.44);
    ctx.lineCap = 'round';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(e1.x, e1.y);
    ctx.lineTo(e2.x, e2.y);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    const hw = info.kind === 'core' ? 60 : info.kind === 'slot' ? 34 : 44;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -t * 12;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - hw / 2);
    ctx.lineTo(a.x + hw, a.y);
    ctx.lineTo(a.x, a.y + hw / 2);
    ctx.lineTo(a.x - hw, a.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const cy = info.inLumen ? a.y - 18 : a.y - 8;
  ctx.globalAlpha = 0.95;
  const g = ctx.createLinearGradient(0, cy - 9, 0, cy + 9);
  g.addColorStop(0, '#7ee36b');
  g.addColorStop(1, '#2f9a2a');
  ctx.fillStyle = g;
  circle(ctx, a.x, cy, 9);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,50,10,0.8)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(a.x - 4.5, cy);
  ctx.lineTo(a.x + 4.5, cy);
  ctx.moveTo(a.x, cy - 4.5);
  ctx.lineTo(a.x, cy + 4.5);
  ctx.stroke();
  ctx.restore();
}

function levelBadge(ctx, x, y, lv) {
  const m = material(lv);
  ctx.fillStyle = 'rgba(30,10,20,0.55)';
  circle(ctx, x + 0.8, y + 1.2, 6.6);
  ctx.fill();
  const g = ctx.createLinearGradient(0, y - 6, 0, y + 6);
  g.addColorStop(0, shade(m.trim, 0.35));
  g.addColorStop(1, shade(m.trim, -0.2));
  ctx.fillStyle = g;
  circle(ctx, x, y, 6.4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,15,10,0.85)';
  ctx.lineWidth = 1.1;
  ctx.stroke();
  textLabel(ctx, String(lv), x, y + 0.2, { size: 8, color: '#ffffff', weight: 900, stroke: 'rgba(40,15,10,0.85)', strokeWidth: 2.2 });
}

export function drawBuilding(ctx, geom, b, env) {
  const info = b.info;
  if (!info) return;
  const a = siteAnchorIso(geom, info);
  const shake = b.shake > 0 ? Math.sin(env.t * 70) * 1.6 * b.shake : 0;
  const x = a.x + shake, y = a.y;
  ctx.save();
  if (!b.alive) {
    const ends = info.inLumen ? lumenEnds(geom, info) : null;
    drawRubble(ctx, x, y, b, env, info.inLumen, ends);
    ctx.restore();
    return;
  }
  if (b.selected) drawSelection(ctx, geom, info, env.t, '#ffd34d', b.key);
  if (info.inLumen && LUMEN_DRAW[b.key]) {
    LUMEN_DRAW[b.key](ctx, lumenEnds(geom, info), b, env);
  } else if (SLOT_DRAW[b.key]) {
    SLOT_DRAW[b.key](ctx, x, y, b, env);
  } else if (info.inLumen) {
    drawMucusWall(ctx, lumenEnds(geom, info), b, env);
  } else {
    drawUnknown(ctx, x, y, b, env);
  }
  const lv = lvOf(b);
  if (env.showPips !== false) {
    if (info.inLumen) levelBadge(ctx, x, y + 12, lv);
    else levelBadge(ctx, x, y + footprint(b.key)[1] + 4, lv);
  }
  if (env.showHp && b.hp < b.maxHp) {
    const h = buildingHeight(b.key);
    hpBar(ctx, x, y - h - 10, b.key === 'core' ? 64 : 40, 5, hpFrac(b));
  }
  ctx.restore();
}
