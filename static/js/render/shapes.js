import { shade, rgba, hpColor } from './color.js';

export const TAU = Math.PI * 2;

export function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
}

export function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.01, r), 0, TAU);
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

export function shadow(ctx, x, y, rx, ry, a = 0.22) {
  ctx.fillStyle = `rgba(70,20,50,${a})`;
  ellipse(ctx, x, y, rx, ry);
  ctx.fill();
}

export function isoBox(ctx, x, y, hw, hh, h, color, opt = {}) {
  const top = opt.top || shade(color, 0.12);
  const left = opt.left || shade(color, -0.08);
  const right = opt.right || shade(color, -0.25);
  ctx.fillStyle = left;
  ctx.beginPath();
  ctx.moveTo(x - hw, y);
  ctx.lineTo(x, y + hh);
  ctx.lineTo(x, y + hh - h);
  ctx.lineTo(x - hw, y - h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = right;
  ctx.beginPath();
  ctx.moveTo(x, y + hh);
  ctx.lineTo(x + hw, y);
  ctx.lineTo(x + hw, y - h);
  ctx.lineTo(x, y + hh - h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(x, y - hh - h);
  ctx.lineTo(x + hw, y - h);
  ctx.lineTo(x, y + hh - h);
  ctx.lineTo(x - hw, y - h);
  ctx.closePath();
  ctx.fill();
  if (opt.outline) {
    ctx.strokeStyle = opt.outline;
    ctx.lineWidth = opt.lw || 1;
    ctx.stroke();
  }
}

export function cylinder(ctx, x, y, rx, ry, h, color, opt = {}) {
  const g = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
  g.addColorStop(0, shade(color, -0.06));
  g.addColorStop(0.35, shade(color, 0.14));
  g.addColorStop(1, shade(color, -0.32));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - rx, y - h);
  ctx.lineTo(x - rx, y);
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, Math.PI, 0, true);
  ctx.lineTo(x + rx, y - h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = opt.top || shade(color, 0.2);
  ellipse(ctx, x, y - h, rx, ry);
  ctx.fill();
  if (opt.rim) {
    ctx.strokeStyle = opt.rim;
    ctx.lineWidth = opt.lw || 1.2;
    ctx.stroke();
  }
}

export function dome(ctx, x, y, rx, ry, h, color) {
  const g = ctx.createRadialGradient(x - rx * 0.35, y - h * 0.65, rx * 0.08, x, y - h * 0.4, rx * 1.35);
  g.addColorStop(0, shade(color, 0.5));
  g.addColorStop(0.5, color);
  g.addColorStop(1, shade(color, -0.35));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - rx, y);
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, Math.PI, 0, true);
  ctx.bezierCurveTo(x + rx, y - h * 0.75, x + rx * 0.55, y - h, x, y - h);
  ctx.bezierCurveTo(x - rx * 0.55, y - h, x - rx, y - h * 0.75, x - rx, y);
  ctx.closePath();
  ctx.fill();
}

export function ball(ctx, x, y, r, color, hi = 0.5) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, shade(color, hi));
  g.addColorStop(0.6, color);
  g.addColorStop(1, shade(color, -0.3));
  ctx.fillStyle = g;
  circle(ctx, x, y, r);
  ctx.fill();
}

export function glow(ctx, x, y, r, color, a = 0.5) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(0.01, r));
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  circle(ctx, x, y, r);
  ctx.fill();
}

export function capsulePath(ctx, len, r) {
  const hl = Math.max(r, len / 2);
  ctx.beginPath();
  ctx.moveTo(-hl + r, -r);
  ctx.lineTo(hl - r, -r);
  ctx.arc(hl - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  ctx.lineTo(-hl + r, r);
  ctx.arc(-hl + r, 0, r, Math.PI / 2, -Math.PI / 2, false);
  ctx.closePath();
}

export function capsule(ctx, x, y, len, r, ang, colA, colB) {
  const hl = Math.max(r, len / 2);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = colA;
  ctx.beginPath();
  ctx.moveTo(0.5, -r);
  ctx.lineTo(-hl + r, -r);
  ctx.arc(-hl + r, 0, r, -Math.PI / 2, Math.PI / 2, true);
  ctx.lineTo(0.5, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = colB;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(hl - r, -r);
  ctx.arc(hl - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  ctx.lineTo(0, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  roundRect(ctx, -hl + r * 0.6, -r * 0.7, Math.max(0.1, 2 * hl - r * 1.2), r * 0.38, r * 0.19);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,20,40,0.35)';
  ctx.lineWidth = Math.max(0.6, r * 0.12);
  capsulePath(ctx, 2 * hl, r);
  ctx.stroke();
  ctx.restore();
}

export function star(ctx, x, y, n, r1, r2, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n;
    const r = i % 2 === 0 ? r1 : r2;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function antibody(ctx, x, y, size, ang, color = '#ffffff', edge = '#3a6fd8') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const draw = () => {
    ctx.beginPath();
    ctx.moveTo(0, size * 0.55);
    ctx.lineTo(0, 0);
    ctx.lineTo(-size * 0.42, -size * 0.5);
    ctx.moveTo(0, 0);
    ctx.lineTo(size * 0.42, -size * 0.5);
    ctx.stroke();
  };
  ctx.strokeStyle = edge;
  ctx.lineWidth = size * 0.34;
  draw();
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.17;
  draw();
  ctx.restore();
}

export function face(ctx, x, y, s, mood = 'happy', look = 0, blink = false) {
  const ex = s * 0.36, ey = -s * 0.12, er = s * 0.27;
  for (const sx of [-1, 1]) {
    const cx = x + sx * ex, cy = y + ey;
    if (blink || mood === 'sleep') {
      ctx.strokeStyle = '#2a1430';
      ctx.lineWidth = Math.max(0.6, s * 0.1);
      ctx.beginPath();
      ctx.moveTo(cx - er * 0.8, cy);
      ctx.quadraticCurveTo(cx, cy + er * 0.5, cx + er * 0.8, cy);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#ffffff';
    ellipse(ctx, cx, cy, er, er * 1.1);
    ctx.fill();
    ctx.fillStyle = '#21102a';
    circle(ctx, cx + look * er * 0.35, cy + er * 0.12, er * 0.55);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    circle(ctx, cx + look * er * 0.35 - er * 0.18, cy - er * 0.12, er * 0.18);
    ctx.fill();
  }
  ctx.strokeStyle = '#2a1430';
  ctx.lineWidth = Math.max(0.6, s * 0.1);
  ctx.lineCap = 'round';
  if (mood === 'angry' || mood === 'sly') {
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      const bx = x + sx * ex;
      const lift = mood === 'angry' ? 0.25 : 0.05;
      ctx.moveTo(bx - sx * er * 1.1, y + ey - er * (1.15 + lift));
      ctx.lineTo(bx + sx * er * 0.9, y + ey - er * (1.15 - lift));
      ctx.stroke();
    }
  }
  const my = y + s * 0.32;
  ctx.beginPath();
  if (mood === 'grin' || mood === 'angry') {
    ctx.fillStyle = '#5a1630';
    ctx.moveTo(x - s * 0.3, my - s * 0.04);
    ctx.quadraticCurveTo(x, my + s * 0.34, x + s * 0.3, my - s * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - s * 0.16, my - s * 0.03, s * 0.12, s * 0.08);
    ctx.fillRect(x + s * 0.04, my - s * 0.03, s * 0.12, s * 0.08);
  } else if (mood === 'hurt' || mood === 'spooky') {
    ctx.fillStyle = '#5a1630';
    ellipse(ctx, x, my + s * 0.04, s * 0.11, s * 0.13);
    ctx.fill();
  } else {
    ctx.moveTo(x - s * 0.24, my);
    ctx.quadraticCurveTo(x, my + s * 0.22, x + s * 0.24, my);
    ctx.stroke();
  }
}

export function hpBar(ctx, x, y, w, h, frac) {
  const f = Math.max(0, Math.min(1, frac));
  ctx.fillStyle = 'rgba(30,12,30,0.7)';
  roundRect(ctx, x - w / 2 - 1, y - 1, w + 2, h + 2, (h + 2) / 2);
  ctx.fill();
  if (f > 0) {
    ctx.fillStyle = hpColor(f);
    roundRect(ctx, x - w / 2, y, Math.max(h, w * f), h, h / 2);
    ctx.fill();
  }
}

export function pips(ctx, x, y, n, r = 2.6) {
  const gap = r * 2.7;
  const x0 = x - ((n - 1) * gap) / 2;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = '#5a3a10';
    circle(ctx, x0 + i * gap, y, r + 0.9);
    ctx.fill();
    ctx.fillStyle = '#ffd34d';
    circle(ctx, x0 + i * gap, y, r);
    ctx.fill();
  }
}

export function shield(ctx, x, y, s, color = '#3e7bfa') {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s * 0.8, y - s * 0.65);
  ctx.quadraticCurveTo(x + s * 0.75, y + s * 0.5, x, y + s);
  ctx.quadraticCurveTo(x - s * 0.75, y + s * 0.5, x - s * 0.8, y - s * 0.65);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(0.6, s * 0.18);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - s * 0.35, y);
  ctx.lineTo(x - s * 0.05, y + s * 0.3);
  ctx.lineTo(x + s * 0.4, y - s * 0.3);
  ctx.stroke();
}

export function waterDrop(ctx, x, y, s, color = '#4fa8ff') {
  const g = ctx.createRadialGradient(x - s * 0.3, y - s * 0.1, s * 0.1, x, y + s * 0.2, s * 1.1);
  g.addColorStop(0, shade(color, 0.55));
  g.addColorStop(0.6, color);
  g.addColorStop(1, shade(color, -0.3));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x, y - s * 1.3);
  ctx.bezierCurveTo(x + s * 0.35, y - s * 0.7, x + s, y - s * 0.1, x + s, y + s * 0.35);
  ctx.arc(x, y + s * 0.35, s, 0, Math.PI, false);
  ctx.bezierCurveTo(x - s, y - s * 0.1, x - s * 0.35, y - s * 0.7, x, y - s * 1.3);
  ctx.closePath();
  ctx.fill();
}

export function textLabel(ctx, text, x, y, opt = {}) {
  const size = opt.size || 11;
  ctx.font = `${opt.weight || 700} ${size}px ${opt.font || 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width;
  const ph = size * 0.5, pv = size * 0.32;
  if (opt.bg) {
    ctx.fillStyle = opt.bg;
    roundRect(ctx, x - w / 2 - ph, y - size / 2 - pv, w + ph * 2, size + pv * 2, (size + pv * 2) / 2);
    ctx.fill();
    if (opt.border) {
      ctx.strokeStyle = opt.border;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  if (opt.stroke) {
    ctx.strokeStyle = opt.stroke;
    ctx.lineWidth = opt.strokeWidth || 3;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y + 0.5);
  }
  ctx.fillStyle = opt.color || '#ffffff';
  ctx.fillText(text, x, y + 0.5);
  return w;
}
