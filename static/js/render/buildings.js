import { toIso, GROUND_H, hash01 } from './geom.js';
import { shade, rgba, mix } from './color.js';
import {
  TAU, ellipse, circle, roundRect, shadow, isoBox, cylinder, dome, ball, glow, capsule, star, antibody,
  hpBar, pips, waterDrop, textLabel,
} from './shapes.js';

const HEIGHT = {
  core: 150, acid_moat: 18, mucus_wall: 24, villi_wall: 32, flora_garden: 30, paneth_tower: 64,
  iga_cannon: 72, macrophage_tower: 52, neutrophil_barracks: 54, kupffer_gate: 62, peristalsis: 26,
  ors_station: 62, iv_drip: 74, drug_battery: 54, peyers_patch: 32, mitochondria: 42,
  nutrient_absorber: 42, pharmacy_lab: 64, vaccine_lab: 66,
};

const DRUG_ABBR = {
  ceftriaxone: 'CEF', azithromycin: 'AZI', fluoroquinolone: 'CIP', doxycycline: 'DOX', metronidazole: 'MET',
  luminal_agent: 'LUM', vanco_fidaxo: 'VAN', hpylori_combo: 'HPR', albendazole: 'ALB', antifungal: 'AF',
};

export function drugAbbr(key) {
  return DRUG_ABBR[key] || String(key || '').slice(0, 3).toUpperCase();
}

export function buildingHeight(key) {
  return HEIGHT[key] || 46;
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
  const half = geom.T * frac;
  let e1, e2;
  if (d.dx !== 0) {
    e1 = toIso(info.x, info.y - half);
    e2 = toIso(info.x, info.y + half);
  } else {
    e1 = toIso(info.x - half, info.y);
    e2 = toIso(info.x + half, info.y);
  }
  return [e1, e2];
}

function lerpPt(a, b, k) {
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

function hpFrac(b) {
  return b.maxHp > 0 ? Math.max(0, Math.min(1, b.hp / b.maxHp)) : 1;
}

function drawCore(ctx, x, y, b, env) {
  const t = env.t;
  const lv = Math.max(1, b.lv || 1);
  shadow(ctx, x, y + 6, 66, 32, 0.25);
  isoBox(ctx, x, y, 58, 29, 12, '#b49ad6', { top: '#d8c8f0' });
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ellipse(ctx, x, y - 12, 40, 20);
  ctx.stroke();
  const tiers = 2 + Math.ceil(lv / 2);
  for (let i = 0; i < tiers; i++) {
    const rx = 31 - i * 3.2;
    const base = y - 12 - i * 20;
    cylinder(ctx, x, base, rx, rx * 0.5, 20, '#f1e2c4', { top: '#f8eedb' });
    ctx.fillStyle = 'rgba(176,132,92,0.55)';
    for (let k = 0; k < 7; k++) {
      const a = 0.25 + (k / 7) * (Math.PI - 0.5);
      const px = x + Math.cos(a) * rx * 0.86;
      const py = base - 6 - hash01(i, k, 3) * 9 + Math.sin(a) * rx * 0.2;
      ellipse(ctx, px, py, 2 + hash01(i, k) * 1.8, 1.4 + hash01(k, i) * 1.2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(214,60,90,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, base, rx, rx * 0.5, 0, 0.15, Math.PI - 0.15);
    ctx.stroke();
  }
  const topY = y - 12 - tiers * 20 - 20;
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
  glow(ctx, x, topY, 58 + pulse * 8, '#ff7ad9', 0.38 + 0.12 * pulse);
  ctx.strokeStyle = '#c99be8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 10, topY + 18);
  ctx.quadraticCurveTo(x, topY + 8, x + 10, topY + 18);
  ctx.stroke();
  ball(ctx, x, topY, 18, '#c44fe0', 0.6);
  ctx.strokeStyle = 'rgba(255,220,250,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, topY, 10, t * 1.5, t * 1.5 + Math.PI * 1.2);
  ctx.stroke();
  const cells = [['#e8453c', 3.6], ['#ffffff', 3.2], ['#ff9bd2', 2.4], ['#e8453c', 3.6], ['#8fd3ff', 3]];
  for (let k = 0; k < cells.length; k++) {
    const a = t * 1.1 + (k / cells.length) * TAU;
    const px = x + Math.cos(a) * 30, py = topY + Math.sin(a) * 10;
    if (Math.sin(a) < 0) ctx.globalAlpha = 0.7;
    ball(ctx, px, py, cells[k][1], cells[k][0], 0.4);
    ctx.globalAlpha = 1;
  }
}

function drawAcidMoat(ctx, x, y, b, env) {
  const t = env.t;
  const ppi = !!env.ppi;
  shadow(ctx, x, y + 3, 50, 24, 0.2);
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * TAU;
    const r = 1 + Math.sin(a * 12) * 0.04;
    const px = x + Math.cos(a) * 47 * r, py = y + Math.sin(a) * 23.5 * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#e39b93';
  ctx.fill();
  ctx.strokeStyle = '#b8656b';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#9c4b5a';
  ellipse(ctx, x, y + 1, 40, 19.5);
  ctx.fill();
  const liquid = ppi ? '#c9d6a0' : '#cbe848';
  const g = ctx.createRadialGradient(x - 10, y - 4, 4, x, y, 40);
  g.addColorStop(0, shade(liquid, 0.35));
  g.addColorStop(1, shade(liquid, -0.25));
  ctx.fillStyle = g;
  ellipse(ctx, x, y - 1, 38, 17.5);
  ctx.fill();
  const nb = ppi ? 3 : 9;
  for (let k = 0; k < nb; k++) {
    const ph = (t * (0.6 + hash01(k, 7) * 0.5) + hash01(k, 1)) % 1;
    const bx = x + (hash01(k, 2) - 0.5) * 56;
    const by = y - 1 + (hash01(k, 3) - 0.5) * 22 - ph * 12;
    ctx.strokeStyle = `rgba(245,255,190,${(0.9 * (1 - ph)).toFixed(3)})`;
    ctx.lineWidth = 1.3;
    circle(ctx, bx, by, 1.6 + ph * 3.2);
    ctx.stroke();
  }
  ctx.strokeStyle = `rgba(230,250,150,${ppi ? 0.12 : 0.3})`;
  ctx.lineWidth = 2;
  for (let k = 0; k < 2; k++) {
    const sx = x - 12 + k * 22;
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const yy = y - 10 - i * 4;
      const xx = sx + Math.sin(i * 0.9 + t * 2 + k) * 3;
      if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }
  textLabel(ctx, ppi ? 'HCl (PPI)' : 'HCl', x + 30, y - 22, { size: 9, bg: 'rgba(255,255,240,0.85)', color: '#4d5d0a' });
}

function drawPeristalsis(ctx, x, y, b, env) {
  const t = env.t;
  const off = !!env.stopflow;
  const pulse = off ? 0 : Math.sin(t * 4);
  const s = 1 + pulse * 0.07;
  shadow(ctx, x, y + 4, 44, 21, 0.2);
  if (!off) {
    for (let k = 0; k < 2; k++) {
      const p = (t * 0.7 + k * 0.5) % 1;
      ctx.strokeStyle = `rgba(217,87,107,${(0.5 * (1 - p)).toFixed(3)})`;
      ctx.lineWidth = 2;
      ellipse(ctx, x, y, 36 + p * 22, (36 + p * 22) * 0.5);
      ctx.stroke();
    }
  }
  const muscle = off ? '#b9a2a8' : '#d9576b';
  ctx.lineWidth = 14 * s;
  ctx.strokeStyle = shade(muscle, -0.3);
  ellipse(ctx, x, y - 3, 30 * s, 15 * s);
  ctx.stroke();
  ctx.strokeStyle = muscle;
  ellipse(ctx, x, y - 8, 30 * s, 15 * s);
  ctx.stroke();
  ctx.strokeStyle = rgba(shade(muscle, 0.4), 0.9);
  ctx.lineWidth = 1.4;
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * TAU + (off ? 0 : t * 0.5);
    const cx = x + Math.cos(a) * 30 * s, cy = y - 8 + Math.sin(a) * 15 * s;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(a) * 5, cy - Math.sin(a) * 2.5);
    ctx.lineTo(cx + Math.cos(a) * 5, cy + Math.sin(a) * 2.5);
    ctx.stroke();
  }
  ctx.fillStyle = '#e8c97e';
  ellipse(ctx, x, y - 8, 21 * s, 10 * s);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,60,40,0.25)';
  ellipse(ctx, x, y - 6, 15 * s, 6 * s);
  ctx.fill();
  if (off) textLabel(ctx, 'OFF', x, y - 26, { size: 9, bg: 'rgba(60,60,80,0.85)', color: '#fff' });
}

function drawPaneth(ctx, x, y, b, env) {
  const t = env.t;
  shadow(ctx, x, y + 3, 26, 13);
  isoBox(ctx, x, y, 22, 11, 8, '#8fa9d6');
  cylinder(ctx, x, y - 8, 15, 7.5, 28, '#d2e4ff');
  ctx.fillStyle = '#5a63c9';
  ellipse(ctx, x - 2, y - 18, 6, 4);
  ctx.fill();
  dome(ctx, x, y - 36, 17, 8.5, 24, '#e9f1ff');
  const gr = [[-8, -44], [-1, -49], [7, -45], [-5, -52], [4, -54], [0, -41], [10, -50]];
  for (const [gx, gy] of gr) ball(ctx, x + gx, y + gy, 2.6, '#ff5f86', 0.5);
  if (b.firing > 0) {
    ctx.fillStyle = `rgba(255,240,140,${b.firing.toFixed(3)})`;
    star(ctx, x, y - 64, 5, 8, 3, t * 6);
    ctx.fill();
  }
}

function drawIga(ctx, x, y, b, env) {
  const t = env.t;
  shadow(ctx, x, y + 3, 28, 14);
  isoBox(ctx, x, y, 24, 12, 10, '#7f9fd6');
  cylinder(ctx, x, y - 10, 14, 7, 12, '#4f74c4');
  ball(ctx, x, y - 34, 14, '#8cb8ff', 0.55);
  ctx.fillStyle = '#3b4fa8';
  circle(ctx, x + 3, y - 33, 6.5);
  ctx.fill();
  ctx.strokeStyle = '#a9c4ff';
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    ctx.beginPath();
    ctx.moveTo(x + 3, y - 33);
    ctx.lineTo(x + 3 + Math.cos(a) * 5.5, y - 33 + Math.sin(a) * 5.5);
    ctx.stroke();
  }
  const sway = Math.sin(t * 1.8) * 0.12 - (b.firing || 0) * 0.35;
  antibody(ctx, x, y - 60, 22, sway, '#ffffff', '#2f6be0');
}

function drawMacrophage(ctx, x, y, b, env) {
  const t = env.t;
  shadow(ctx, x, y + 3, 30, 15);
  isoBox(ctx, x, y, 26, 13, 6, '#9fb6d3');
  const cy = y - 26;
  ctx.beginPath();
  const n = 30;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const r = 1 + 0.16 * Math.sin(3 * a + t * 1.6) + 0.08 * Math.sin(5 * a - t * 2.1);
    const px = x + Math.cos(a) * 24 * r, py = cy + Math.sin(a) * 18 * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(x - 8, cy - 8, 3, x, cy, 28);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#b7cdef');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#7393c4';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = '#6c74c6';
  ctx.beginPath();
  ctx.ellipse(x + 6, cy - 3, 8, 5, 0.4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#b7cdef';
  ellipse(ctx, x + 9, cy - 5, 3.5, 2.2, 0.4);
  ctx.fill();
  for (const [px, py] of [[-10, 2], [-4, 8], [-13, -6]]) {
    ctx.strokeStyle = 'rgba(115,147,196,0.7)';
    ctx.lineWidth = 1;
    circle(ctx, x + px, cy + py, 3.6);
    ctx.stroke();
    ctx.fillStyle = '#7a4a3a';
    circle(ctx, x + px, cy + py, 1.6);
    ctx.fill();
  }
}

function drawNeutrophil(ctx, x, y, b, env) {
  const t = env.t;
  shadow(ctx, x, y + 3, 32, 16);
  isoBox(ctx, x, y, 28, 14, 18, '#e8e2f6');
  ctx.fillStyle = '#5b3f8c';
  ctx.beginPath();
  ctx.moveTo(x - 18, y - 2);
  ctx.lineTo(x - 18, y - 11);
  ctx.quadraticCurveTo(x - 13, y - 16, x - 8, y - 6);
  ctx.lineTo(x - 8, y + 3);
  ctx.closePath();
  ctx.fill();
  dome(ctx, x, y - 18, 25, 12.5, 24, '#cdbdf0');
  const ny = y - 40;
  for (const [dx, dy] of [[-6, 0], [0, -4], [6, 0]]) ball(ctx, x + dx, ny + dy, 4.6, '#7a4cc2', 0.4);
  ctx.strokeStyle = '#7a4cc2';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 6, ny);
  ctx.lineTo(x, ny - 4);
  ctx.lineTo(x + 6, ny);
  ctx.stroke();
  for (let k = 0; k < 3; k++) {
    const a = t * 0.9 + k * 2.1;
    const px = x + Math.cos(a) * 34, py = y + 2 + Math.sin(a) * 16;
    ball(ctx, px, py - 5, 5, '#f6f2ff', 0.3);
    ctx.fillStyle = '#8a5ad0';
    circle(ctx, px - 1.5, py - 5, 1.4);
    ctx.fill();
    circle(ctx, px + 1.5, py - 5.5, 1.4);
    ctx.fill();
  }
}

function drawBattery(ctx, x, y, b, env) {
  const t = env.t;
  const gd = env.gd;
  const drug = gd && Array.isArray(gd.drugs) ? gd.drugs.find((d) => d.key === b.drug) : null;
  const col = drug ? drug.color : '#9aa3b5';
  shadow(ctx, x, y + 3, 28, 14);
  isoBox(ctx, x, y, 25, 12.5, 14, '#d9dde8');
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x - 25, y - 6);
  ctx.lineTo(x, y + 6.5);
  ctx.lineTo(x + 25, y - 6);
  ctx.lineTo(x + 25, y - 9);
  ctx.lineTo(x, y + 3.5);
  ctx.lineTo(x - 25, y - 9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#9aa0b0';
  ellipse(ctx, x, y - 15, 11, 5.5);
  ctx.fill();
  if (b.firing > 0) glow(ctx, x, y - 34, 26, col, 0.55 * b.firing);
  const ang = -1.05 + Math.sin(t * 1.5 + (b.idx || 0)) * 0.06;
  capsule(ctx, x, y - 33, 36, 9, ang, col, '#ffffff');
  capsule(ctx, x - 15, y - 17, 12, 3.4, 0.4, col, '#ffffff');
  capsule(ctx, x + 14, y - 16, 12, 3.4, -0.3, '#ffffff', col);
  textLabel(ctx, drug ? drugAbbr(drug.key) : '—', x - 12, y + 1, { size: 7.5, bg: 'rgba(255,255,255,0.9)', color: shade(col, -0.45) });
}

function drawOrs(ctx, x, y, b, env) {
  const t = env.t;
  shadow(ctx, x, y + 3, 26, 13);
  isoBox(ctx, x, y, 22, 11, 16, '#e3f1ff');
  ctx.strokeStyle = '#7fb4e8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 12, y - 10);
  ctx.quadraticCurveTo(x - 24, y - 12, x - 26, y - 4);
  ctx.stroke();
  const dp = (t * 1.2) % 1;
  ctx.fillStyle = `rgba(80,160,255,${(1 - dp).toFixed(3)})`;
  waterDrop(ctx, x - 26, y - 2 + dp * 10, 2.2, '#4fa8ff');
  const bob = Math.sin(t * 2) * 2;
  waterDrop(ctx, x, y - 38 + bob, 14, '#3f9cff');
  textLabel(ctx, 'ORS', x, y - 33 + bob, { size: 8.5, color: '#ffffff', weight: 800 });
  const zf = gd_ors_zinc(env.gd);
  if ((b.lv || 1) >= zf) {
    ball(ctx, x + 19, y - 26, 6.5, '#b9c0c9', 0.5);
    textLabel(ctx, 'Zn', x + 19, y - 26, { size: 6.5, color: '#2a3442', weight: 800 });
  }
}

function gd_ors_zinc(gd) {
  const d = gd && Array.isArray(gd.buildings) ? gd.buildings.find((x) => x.key === 'ors_station') : null;
  return d && d.zincFromLevel ? d.zincFromLevel : 99;
}

function drawIv(ctx, x, y, b, env) {
  const t = env.t;
  const active = !!b.ivActive;
  shadow(ctx, x, y + 3, 18, 9);
  isoBox(ctx, x, y, 16, 8, 5, '#c5cbd6');
  ctx.strokeStyle = '#8f98aa';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x, y - 72);
  ctx.moveTo(x - 10, y - 72);
  ctx.lineTo(x + 10, y - 72);
  ctx.stroke();
  if (active) glow(ctx, x, y - 56, 24, '#7cc4ff', 0.5 + 0.2 * Math.sin(t * 6));
  ctx.fillStyle = 'rgba(232,244,255,0.92)';
  roundRect(ctx, x - 9, y - 70, 18, 26, 5);
  ctx.fill();
  ctx.strokeStyle = '#7f9cc7';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  const level = active ? 0.55 + 0.25 * Math.sin(t * 0.8) : 0.82;
  ctx.fillStyle = '#7cc4ff';
  roundRect(ctx, x - 7.5, y - 46 - 22 * level, 15, 22 * level, 3);
  ctx.fill();
  textLabel(ctx, 'RL', x, y - 57, { size: 7, color: '#1f4f8a', weight: 800 });
  ctx.strokeStyle = '#9fb8d8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - 44);
  ctx.lineTo(x, y - 38);
  ctx.bezierCurveTo(x + 4, y - 26, x + 16, y - 24, x + 18, y - 8);
  ctx.stroke();
  ctx.fillStyle = 'rgba(200,225,255,0.95)';
  roundRect(ctx, x - 2.5, y - 42, 5, 7, 1.5);
  ctx.fill();
  if (active) {
    for (let k = 0; k < 2; k++) {
      const p = (t * 2 + k * 0.5) % 1;
      ctx.fillStyle = `rgba(80,160,255,${(1 - p).toFixed(3)})`;
      circle(ctx, x, y - 41 + p * 5, 1.2);
      ctx.fill();
    }
  }
}

function drawPeyers(ctx, x, y, b, env) {
  const t = env.t;
  shadow(ctx, x, y + 3, 34, 17);
  cylinder(ctx, x, y, 32, 16, 6, '#efb3c4');
  for (const [dx, dy, r] of [[-14, -2, 11], [12, -3, 11], [0, 6, 12]]) {
    dome(ctx, x + dx, y - 6 + dy, r, r * 0.5, r * 1.4, '#8e7cc3');
    glow(ctx, x + dx, y - 6 + dy - r * 0.8, r * 0.7, '#e6dcff', 0.6 + 0.15 * Math.sin(t * 2 + dx));
  }
}

function drawMito(ctx, x, y, b, env) {
  const t = env.t;
  shadow(ctx, x, y + 3, 26, 13);
  isoBox(ctx, x, y, 22, 11, 6, '#e3c6a4');
  const cy = y - 22;
  ctx.save();
  ctx.translate(x, cy);
  ctx.rotate(-0.28);
  const g = ctx.createLinearGradient(0, -12, 0, 12);
  g.addColorStop(0, '#ffb066');
  g.addColorStop(1, '#d25a28');
  ctx.fillStyle = g;
  ellipse(ctx, 0, 0, 23, 12.5);
  ctx.fill();
  ctx.strokeStyle = '#9c3e1c';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.strokeStyle = '#ffe0b0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-17, 0);
  for (let k = 0; k < 6; k++) {
    const px = -14 + k * 6;
    ctx.lineTo(px, k % 2 ? 7 : -7);
  }
  ctx.lineTo(17, 0);
  ctx.stroke();
  ctx.restore();
  const fl = 0.6 + 0.4 * Math.sin(t * 7);
  ctx.fillStyle = `rgba(255,230,60,${fl.toFixed(3)})`;
  ctx.beginPath();
  ctx.moveTo(x + 14, cy - 26);
  ctx.lineTo(x + 8, cy - 15);
  ctx.lineTo(x + 13, cy - 15);
  ctx.lineTo(x + 9, cy - 6);
  ctx.lineTo(x + 19, cy - 18);
  ctx.lineTo(x + 14, cy - 18);
  ctx.closePath();
  ctx.fill();
}

function drawNutrient(ctx, x, y, b, env) {
  const t = env.t;
  shadow(ctx, x, y + 3, 26, 13);
  isoBox(ctx, x, y, 22, 11, 8, '#d3e3a8');
  cylinder(ctx, x, y - 8, 18, 9, 14, '#8fc160');
  ctx.fillStyle = '#6d9a45';
  ellipse(ctx, x, y - 22, 14, 7);
  ctx.fill();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    const px = x + Math.cos(a) * 14, py = y - 22 + Math.sin(a) * 7;
    ctx.fillStyle = '#f2b0a0';
    roundRect(ctx, px - 2.4, py - 10, 4.8, 11, 2.4);
    ctx.fill();
  }
  for (let k = 0; k < 4; k++) {
    const p = (t * 0.5 + k * 0.25) % 1;
    ctx.globalAlpha = 1 - p;
    ball(ctx, x + Math.sin(k * 2 + t) * 6, y - 26 - p * 22, 3, '#ffcf3d', 0.5);
    ctx.globalAlpha = 1;
  }
}

function drawPharmacy(ctx, x, y, b, env) {
  const t = env.t;
  shadow(ctx, x, y + 3, 30, 15);
  isoBox(ctx, x, y, 26, 13, 26, '#f4f7fb');
  isoBox(ctx, x, y - 26, 28, 14, 5, '#2f9c84');
  ctx.fillStyle = '#2fb36e';
  const cx = x - 13, cy = y - 10;
  ctx.fillRect(cx - 2.5, cy - 7, 5, 14);
  ctx.fillRect(cx - 7, cy - 2.5, 14, 5);
  const fy = y - 36;
  ctx.fillStyle = 'rgba(230,245,255,0.9)';
  ctx.fillRect(x - 2.5, fy - 18, 5, 8);
  ball(ctx, x, fy - 6, 8, '#b9e6ff', 0.6);
  ctx.fillStyle = '#5fd3a0';
  ctx.beginPath();
  ctx.arc(x, fy - 6, 7, 0.2, Math.PI - 0.2);
  ctx.fill();
  const p = (t * 1.3) % 1;
  ctx.strokeStyle = `rgba(95,211,160,${(1 - p).toFixed(3)})`;
  ctx.lineWidth = 1;
  circle(ctx, x + Math.sin(t * 3) * 2, fy - 20 - p * 10, 1.5 + p * 2);
  ctx.stroke();
}

function drawVaccineLab(ctx, x, y, b, env) {
  const t = env.t;
  shadow(ctx, x, y + 3, 30, 15);
  isoBox(ctx, x, y, 26, 13, 24, '#f3f6ff');
  isoBox(ctx, x, y - 24, 28, 14, 5, '#4a7fe0');
  ctx.fillStyle = '#4a7fe0';
  roundRect(ctx, x - 18, y - 10, 9, 9, 2);
  ctx.fill();
  cylinder(ctx, x - 8, y - 32, 6, 3, 16, '#d8ecff', { top: '#e9f3ff' });
  ctx.fillStyle = '#8fd3ff';
  ctx.fillRect(x - 13.5, y - 40, 11, 7);
  cylinder(ctx, x - 8, y - 48, 6.5, 3.2, 4, '#e0505e');
  ctx.save();
  ctx.translate(x + 8, y - 40);
  ctx.rotate(-0.7 + Math.sin(t * 1.4) * 0.05);
  ctx.fillStyle = 'rgba(235,245,255,0.95)';
  roundRect(ctx, -12, -4, 22, 8, 2);
  ctx.fill();
  ctx.strokeStyle = '#7f9cc7';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#7cc4ff';
  ctx.fillRect(-2, -3, 11, 6);
  ctx.fillStyle = '#9aa3b5';
  ctx.fillRect(-18, -1.2, 6, 2.4);
  ctx.fillRect(-20, -4, 2, 8);
  ctx.strokeStyle = '#9aa3b5';
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(19, 0);
  ctx.stroke();
  ctx.restore();
}

function drawUnknown(ctx, x, y) {
  shadow(ctx, x, y + 3, 24, 12);
  isoBox(ctx, x, y, 20, 10, 20, '#b8b0c8');
  textLabel(ctx, '?', x, y - 24, { size: 12, color: '#333' });
}

function drawMucusWall(ctx, ends, b, env) {
  const f = hpFrac(b);
  const [e1, e2] = ends;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(120,170,200,0.55)';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(e1.x, e1.y);
  ctx.lineTo(e2.x, e2.y);
  ctx.stroke();
  const n = 5;
  for (let k = 0; k < n; k++) {
    const p = lerpPt(e1, e2, (k + 0.5) / n);
    const wob = Math.sin(env.t * 2 + k) * 0.8;
    const h = (14 + 8 * f) * (k % 2 ? 0.92 : 1);
    const r = 11 + wob * 0.4;
    const g = ctx.createRadialGradient(p.x - 4, p.y - h * 0.8, 2, p.x, p.y - h * 0.5, r * 1.4);
    g.addColorStop(0, 'rgba(250,255,255,0.95)');
    g.addColorStop(1, 'rgba(150,205,232,0.85)');
    ctx.fillStyle = g;
    ellipse(ctx, p.x, p.y - h * 0.5, r, h * 0.62 + wob);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,150,190,0.75)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ellipse(ctx, p.x - 3, p.y - h * 0.75, 3, 2);
    ctx.fill();
  }
}

function drawVilliWall(ctx, ends, b, env) {
  const f = hpFrac(b);
  const [e1, e2] = ends;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#c96a7a';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(e1.x, e1.y);
  ctx.lineTo(e2.x, e2.y);
  ctx.stroke();
  const n = 6;
  for (let k = 0; k < n; k++) {
    const p = lerpPt(e1, e2, (k + 0.5) / n);
    const sway = Math.sin(env.t * 1.8 + k * 0.8) * 1.5;
    const h = (20 + 12 * f) * (0.9 + hash01(k, 5) * 0.2);
    const g = ctx.createLinearGradient(p.x - 5, 0, p.x + 5, 0);
    g.addColorStop(0, '#f7b9bd');
    g.addColorStop(1, '#de7d8a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(p.x - 5, p.y);
    ctx.lineTo(p.x - 5 + sway * 0.5, p.y - h + 5);
    ctx.quadraticCurveTo(p.x + sway, p.y - h - 3, p.x + 5 + sway * 0.5, p.y - h + 5);
    ctx.lineTo(p.x + 5, p.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,40,60,0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 2);
    ctx.lineTo(p.x + sway * 0.6, p.y - h + 4);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,240,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x + sway * 0.8, p.y - h + 3, 4, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
}

function drawFloraWall(ctx, ends, b, env) {
  const f = hpFrac(b);
  const [e1, e2] = ends;
  const green = mix('#a08a50', '#5cb85c', f);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#7a5a3a';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(e1.x, e1.y);
  ctx.lineTo(e2.x, e2.y);
  ctx.stroke();
  const n = 4;
  const bugs = ['#7fb2ff', '#c48bff', '#ff9ec7', '#ffd166'];
  for (let k = 0; k < n; k++) {
    const p = lerpPt(e1, e2, (k + 0.5) / n);
    const h = 12 + 10 * f;
    for (const [dx, dy, r] of [[-6, -h * 0.45, 8], [6, -h * 0.5, 8.5], [0, -h * 0.9, 9]]) {
      ball(ctx, p.x + dx, p.y + dy, r * (0.75 + 0.25 * f), green, 0.35);
    }
    const bob = Math.sin(env.t * 3 + k) * 1.2;
    ctx.fillStyle = bugs[k % bugs.length];
    if (k % 2) {
      ctx.save();
      ctx.translate(p.x + 2, p.y - h * 0.8 + bob);
      ctx.rotate(0.6);
      roundRect(ctx, -4, -1.8, 8, 3.6, 1.8);
      ctx.fill();
      ctx.restore();
    } else {
      circle(ctx, p.x - 2, p.y - h * 0.75 + bob, 2.2);
      ctx.fill();
      circle(ctx, p.x + 2.3, p.y - h * 0.75 + bob, 2.2);
      ctx.fill();
    }
    ctx.fillStyle = shade(green, 0.3);
    ctx.beginPath();
    ctx.ellipse(p.x + 7, p.y - h - 2, 4, 1.8, -0.6, 0, TAU);
    ctx.fill();
  }
}

function drawKupffer(ctx, ends, b, env) {
  const t = env.t;
  const f = hpFrac(b);
  const [e1, e2] = ends;
  const H = 50;
  const bars = Math.max(1, Math.ceil(5 * f));
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#b8404f';
  ctx.lineWidth = 3;
  for (let k = 0; k < 5; k++) {
    if (k >= bars && k % 2 === 1) continue;
    if (k >= bars + 2) continue;
    const p = lerpPt(e1, e2, (k + 1) / 6);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - H + 6);
    ctx.lineTo(p.x, p.y - 2);
    ctx.stroke();
  }
  for (const e of [e1, e2]) cylinder(ctx, e.x, e.y, 8, 4, H, '#9b2d3a', { top: '#c2505e' });
  ctx.strokeStyle = '#6e1b28';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(e1.x, e1.y - H);
  ctx.quadraticCurveTo((e1.x + e2.x) / 2, (e1.y + e2.y) / 2 - H - 12, e2.x, e2.y - H);
  ctx.stroke();
  ctx.strokeStyle = '#c95564';
  ctx.lineWidth = 3;
  ctx.stroke();
  for (const [i, e] of [e1, e2].entries()) {
    const bob = Math.sin(t * 2.4 + i * 2) * 1.5;
    ctx.fillStyle = '#f6b2b8';
    star(ctx, e.x, e.y - H - 9 + bob, 7, 10, 5.5, t * 0.5 + i);
    ctx.fill();
    ctx.strokeStyle = '#a63c4c';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#7a3a8a';
    circle(ctx, e.x, e.y - H - 9 + bob, 3);
    ctx.fill();
  }
}

function drawRubble(ctx, x, y, b, env, lumen, ends) {
  const seed = (b.idx || 0) + 1;
  const pts = lumen && ends ? null : null;
  ctx.fillStyle = 'rgba(70,30,40,0.25)';
  if (lumen && ends) {
    const [e1, e2] = ends;
    for (let k = 0; k < 7; k++) {
      const p = lerpPt(e1, e2, (k + 0.5) / 7);
      const s = 3 + hash01(seed, k) * 4;
      ctx.fillStyle = k % 2 ? '#a88a92' : '#8a6d76';
      ctx.beginPath();
      ctx.moveTo(p.x - s, p.y);
      ctx.lineTo(p.x - s * 0.3, p.y - s * 1.2);
      ctx.lineTo(p.x + s, p.y - s * 0.4);
      ctx.lineTo(p.x + s * 0.6, p.y + s * 0.3);
      ctx.closePath();
      ctx.fill();
    }
    return pts;
  }
  ellipse(ctx, x, y + 2, 28, 13);
  ctx.fill();
  for (let k = 0; k < 9; k++) {
    const a = hash01(seed, k, 1) * TAU;
    const d = hash01(seed, k, 2);
    const px = x + Math.cos(a) * d * 20, py = y + Math.sin(a) * d * 9;
    const s = 3 + hash01(seed, k, 3) * 5;
    ctx.fillStyle = ['#a88a92', '#8a6d76', '#c4a7ae'][k % 3];
    ctx.beginPath();
    ctx.moveTo(px - s, py);
    ctx.lineTo(px - s * 0.2, py - s * 1.1);
    ctx.lineTo(px + s, py - s * 0.3);
    ctx.lineTo(px + s * 0.5, py + s * 0.4);
    ctx.closePath();
    ctx.fill();
  }
  if (b.key === 'core') {
    ctx.fillStyle = 'rgba(196,79,224,0.35)';
    ellipse(ctx, x, y - 3, 14, 6);
    ctx.fill();
  }
  return pts;
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
  if (key === 'core') return [58, 29];
  if (key === 'acid_moat') return [47, 23];
  if (key === 'peristalsis') return [36, 18];
  return [26, 13];
}

export function drawSelection(ctx, geom, info, t, color = '#ffd34d', key = null) {
  const a = siteAnchorIso(geom, info);
  const p = 0.5 + 0.5 * Math.sin(t * 5);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.55 + 0.4 * p;
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
    const [hw, hh] = key ? footprint(key) : info.kind === 'core' ? [58, 29] : [32, 16];
    const k = 1.15 + 0.06 * p;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - hh * k);
    ctx.lineTo(a.x + hw * k, a.y);
    ctx.lineTo(a.x, a.y + hh * k);
    ctx.lineTo(a.x - hw * k, a.y);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

export function drawBuildSlotMarker(ctx, geom, info, t, color = '#ffffff') {
  const a = siteAnchorIso(geom, info);
  const p = 0.5 + 0.5 * Math.sin(t * 3 + info.idx);
  ctx.save();
  ctx.globalAlpha = 0.55 + 0.35 * p;
  ctx.fillStyle = rgba(color, 0.18);
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
    const r = info.kind === 'core' ? 40 : info.kind === 'slot' ? 22 : 30;
    ellipse(ctx, a.x, a.y, r, r * 0.5);
    ctx.fill();
    ctx.stroke();
  }
  const cy = info.inLumen ? a.y - 16 : a.y - 6;
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = 'rgba(40,20,60,0.55)';
  circle(ctx, a.x, cy, 7.5);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(a.x - 4, cy);
  ctx.lineTo(a.x + 4, cy);
  ctx.moveTo(a.x, cy - 4);
  ctx.lineTo(a.x, cy + 4);
  ctx.stroke();
  ctx.restore();
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
  if (info.inLumen && LUMEN_DRAW[b.key]) {
    LUMEN_DRAW[b.key](ctx, lumenEnds(geom, info), b, env);
  } else if (SLOT_DRAW[b.key]) {
    SLOT_DRAW[b.key](ctx, x, y, b, env);
  } else if (info.inLumen) {
    drawMucusWall(ctx, lumenEnds(geom, info), b, env);
  } else {
    drawUnknown(ctx, x, y);
  }
  if (b.selected) drawSelection(ctx, geom, info, env.t, '#ffd34d', b.key);
  const lv = Math.max(1, Math.min(5, b.lv || 1));
  if (env.showPips !== false && b.key !== 'core') {
    const py = info.inLumen ? y + 12 : y + footprint(b.key)[1] + 7;
    pips(ctx, x, py, lv, 2.4);
  } else if (b.key === 'core' && env.showPips !== false) {
    pips(ctx, x, y + 36, lv, 3);
  }
  if (env.showHp && b.hp < b.maxHp) {
    const h = buildingHeight(b.key);
    hpBar(ctx, x, y - h - 10, b.key === 'core' ? 60 : 38, 4.5, hpFrac(b));
  }
  ctx.restore();
}
