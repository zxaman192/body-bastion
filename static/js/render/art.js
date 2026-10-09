// Isometric drawing kit for buildings: lit prisms, cylinders, roofs, banners and level materials.
// Light comes from the upper left: top faces are brightest, left-front faces mid, right-front faces darkest.
import { shade, rgba, mix } from './color.js';

export const OUTLINE = 'rgba(46,18,34,0.55)';

const LEVEL_MATERIALS = [
  { stone: '#d8c3ae', stoneDark: '#9c826c', trim: '#8a5a3c', metal: '#a9774f', glow: '#ffb3c1', banner: '#c2185b' },
  { stone: '#e2d6c8', stoneDark: '#a8957f', trim: '#b5652b', metal: '#c98545', glow: '#ffc9a3', banner: '#d84315' },
  { stone: '#d3dbe6', stoneDark: '#8f9cad', trim: '#6f88a8', metal: '#b9c7d8', glow: '#bfe3ff', banner: '#1e5bb8' },
  { stone: '#efe2c2', stoneDark: '#b49d6c', trim: '#d9a520', metal: '#f2c94c', glow: '#fff1a8', banner: '#7b1fa2' },
  { stone: '#5c4a78', stoneDark: '#33284a', trim: '#f2c94c', metal: '#ffd966', glow: '#8ef7ff', banner: '#00a3a3' },
];

export function material(lv) {
  return LEVEL_MATERIALS[Math.max(1, Math.min(5, lv || 1)) - 1];
}

export function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function fillStroke(ctx, fill, stroke = OUTLINE, lw = 1) {
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

export function groundShadow(ctx, x, y, rx, ry, a = 0.32) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, `rgba(40,10,25,${a})`);
  g.addColorStop(1, 'rgba(40,10,25,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Diamond prism standing on (x, y). hw/hh = half width/height of the footprint diamond.
export function prism(ctx, x, y, hw, hh, h, color, opt = {}) {
  const top = opt.top || shade(color, 0.14);
  const left = opt.left || shade(color, -0.04);
  const right = opt.right || shade(color, -0.24);
  const sw = opt.outline === false ? null : OUTLINE;
  poly(ctx, [[x - hw, y], [x, y + hh], [x, y + hh - h], [x - hw, y - h]]);
  fillStroke(ctx, left, sw);
  poly(ctx, [[x, y + hh], [x + hw, y], [x + hw, y - h], [x, y + hh - h]]);
  fillStroke(ctx, right, sw);
  poly(ctx, [[x, y - hh - h], [x + hw, y - h], [x, y + hh - h], [x - hw, y - h]]);
  fillStroke(ctx, top, sw);
  if (opt.bricks) bricks(ctx, x, y, hw, hh, h, color);
  return { top: y - h };
}

function bricks(ctx, x, y, hw, hh, h, color) {
  ctx.save();
  ctx.strokeStyle = rgba(shade(color, -0.45), 0.35);
  ctx.lineWidth = 0.8;
  const rows = Math.max(1, Math.floor(h / 7));
  for (let r = 1; r < rows; r++) {
    const dy = (h * r) / rows;
    ctx.beginPath();
    ctx.moveTo(x - hw, y - dy);
    ctx.lineTo(x, y + hh - dy);
    ctx.lineTo(x + hw, y - dy);
    ctx.stroke();
    const off = r % 2 ? 0.25 : 0.55;
    for (const side of [-1, 1]) {
      for (const f of [off, off + 0.5]) {
        if (f >= 1) continue;
        const px = x + side * hw * (1 - f);
        const py = y + hh * f - dy;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py + h / rows);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

export function cylinder(ctx, x, y, rx, ry, h, color, opt = {}) {
  const g = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
  g.addColorStop(0, shade(color, 0.08));
  g.addColorStop(0.35, shade(color, 0.16));
  g.addColorStop(1, shade(color, -0.3));
  ctx.beginPath();
  ctx.moveTo(x - rx, y - h);
  ctx.lineTo(x - rx, y);
  ctx.ellipse(x, y, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(x + rx, y - h);
  ctx.closePath();
  fillStroke(ctx, g, opt.outline === false ? null : OUTLINE);
  ctx.beginPath();
  ctx.ellipse(x, y - h, rx, ry, 0, 0, Math.PI * 2);
  fillStroke(ctx, opt.top || shade(color, 0.22), opt.outline === false ? null : OUTLINE);
  if (opt.bands) {
    ctx.save();
    ctx.strokeStyle = opt.bandColor || rgba(shade(color, -0.4), 0.55);
    ctx.lineWidth = opt.bandWidth || 1.6;
    for (const f of opt.bands) {
      ctx.beginPath();
      ctx.ellipse(x, y - h * f, rx, ry, 0, 0, Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  }
  return { top: y - h };
}

export function cone(ctx, x, y, rx, ry, h, color) {
  const g = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
  g.addColorStop(0, shade(color, 0.2));
  g.addColorStop(0.45, shade(color, 0.05));
  g.addColorStop(1, shade(color, -0.3));
  ctx.beginPath();
  ctx.moveTo(x - rx, y);
  ctx.ellipse(x, y, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(x, y - h);
  ctx.closePath();
  fillStroke(ctx, g);
}

export function pyramid(ctx, x, y, hw, hh, h, color) {
  poly(ctx, [[x - hw, y], [x, y + hh], [x, y - h]]);
  fillStroke(ctx, shade(color, 0.06));
  poly(ctx, [[x, y + hh], [x + hw, y], [x, y - h]]);
  fillStroke(ctx, shade(color, -0.22));
}

export function dome(ctx, x, y, rx, ry, h, color) {
  const g = ctx.createRadialGradient(x - rx * 0.35, y - h * 0.75, rx * 0.1, x, y - h * 0.3, rx * 1.3);
  g.addColorStop(0, shade(color, 0.45));
  g.addColorStop(0.5, color);
  g.addColorStop(1, shade(color, -0.35));
  ctx.beginPath();
  ctx.moveTo(x - rx, y);
  ctx.bezierCurveTo(x - rx, y - h * 1.33, x + rx, y - h * 1.33, x + rx, y);
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI);
  ctx.closePath();
  fillStroke(ctx, g);
}

export function sphere(ctx, x, y, r, color, alpha = 1) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, rgba(shade(color, 0.55), alpha));
  g.addColorStop(0.55, rgba(color, alpha));
  g.addColorStop(1, rgba(shade(color, -0.35), alpha));
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  fillStroke(ctx, g, OUTLINE, 0.9);
}

export function glow(ctx, x, y, r, color, a = 0.55) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// Crenellated parapet on top of a prism.
export function crenels(ctx, x, y, hw, hh, color, n = 3, size = 5) {
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const f = k / n;
    pts.push([x - hw + hw * f, y + hh * f]);
    pts.push([x + hw * f, y + hh - hh * f]);
  }
  for (let k = 0; k <= n; k++) {
    const f = k / n;
    pts.push([x + hw - hw * f, y - hh * f]);
    pts.push([x - hw * f, y - hh + hh * f]);
  }
  const seen = new Set();
  const blocks = pts.filter(([px, py]) => {
    const key = Math.round(px) + ',' + Math.round(py);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a[1] - b[1]);
  for (const [px, py] of blocks) prism(ctx, px, py, size * 0.7, size * 0.35, size, color);
}

export function banner(ctx, x, y, h, color, t = 0, w = 12) {
  ctx.strokeStyle = '#5a3a28';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - h);
  ctx.stroke();
  const wave = Math.sin(t * 4 + x * 0.1) * 2;
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.quadraticCurveTo(x + w * 0.5, y - h - 2 + wave, x + w, y - h + 1 + wave);
  ctx.lineTo(x + w - 2, y - h + 5 + wave * 0.6);
  ctx.lineTo(x + w, y - h + 9 + wave);
  ctx.quadraticCurveTo(x + w * 0.5, y - h + 7 + wave, x, y - h + 8);
  ctx.closePath();
  fillStroke(ctx, color, OUTLINE, 0.8);
  sphere(ctx, x, y - h - 1.5, 1.8, '#f2c94c');
}

export function archWindow(ctx, x, y, w, h, lit = '#ffe9a8', t = 0) {
  ctx.fillStyle = '#3b2230';
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x - w / 2, y - h + w / 2);
  ctx.arc(x, y - h + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(x + w / 2, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba(lit, 0.75 + 0.25 * Math.sin(t * 2 + x));
  ctx.beginPath();
  ctx.moveTo(x - w / 2 + 1, y - 1);
  ctx.lineTo(x - w / 2 + 1, y - h + w / 2);
  ctx.arc(x, y - h + w / 2, w / 2 - 1, Math.PI, 0);
  ctx.lineTo(x + w / 2 - 1, y - 1);
  ctx.closePath();
  ctx.fill();
}

// Stone pad that every slot building stands on.
export function pad(ctx, x, y, hw, hh, lv, h = 6) {
  const m = material(lv);
  groundShadow(ctx, x + 4, y + 4, hw * 1.25, hh * 1.25, 0.35);
  prism(ctx, x, y, hw, hh, h, m.stoneDark, { top: shade(m.stone, -0.05), bricks: false });
  ctx.save();
  ctx.strokeStyle = rgba(m.trim, 0.85);
  ctx.lineWidth = 1.4;
  poly(ctx, [[x, y - hh - h + 3], [x + hw - 6, y - h], [x, y + hh - h - 3], [x - hw + 6, y - h]]);
  ctx.stroke();
  ctx.restore();
  return y - h;
}

export function levelGems(ctx, x, y, lv, color) {
  const n = Math.max(1, Math.min(5, lv || 1));
  const w = 7;
  const start = x - ((n - 1) * w) / 2;
  for (let k = 0; k < n; k++) {
    const gx = start + k * w;
    poly(ctx, [[gx, y - 3.2], [gx + 2.6, y], [gx, y + 3.2], [gx - 2.6, y]]);
    fillStroke(ctx, color || '#ffd54a', 'rgba(60,30,10,0.7)', 0.8);
  }
}

export function plate(ctx, x, y, text, bg, fg = '#ffffff', size = 9) {
  ctx.font = `800 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 8;
  ctx.fillStyle = bg;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - size * 0.7, w, size * 1.4, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.fillText(text, x, y + 0.5);
}

export function metalTint(base, lv) {
  return mix(base, material(lv).metal, 0.18 + 0.07 * (lv - 1));
}
