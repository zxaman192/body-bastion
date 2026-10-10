// Procedural tissue textures (tileable), generated once and used as canvas patterns:
// fat lobules (cellular noise with septa), velvety mucosa, colon mucosa with fine vessels,
// liver lobules, serosa, and blood. Built at 2x and scaled down for crisp zoomed-in views.

const cache = new Map();

function rand(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Tileable value noise with a few octaves, values in [0, 1].
function fbm(size, freq, octaves, seed) {
  const out = new Float32Array(size * size);
  let amp = 1, total = 0, f = freq;
  const r = rand(seed);
  for (let o = 0; o < octaves; o++) {
    const grid = new Float32Array(f * f);
    for (let i = 0; i < grid.length; i++) grid[i] = r();
    for (let y = 0; y < size; y++) {
      const gy = (y / size) * f, y0 = Math.floor(gy), ty = gy - y0, y1 = (y0 + 1) % f;
      const sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < size; x++) {
        const gx = (x / size) * f, x0 = Math.floor(gx), tx = gx - x0, x1 = (x0 + 1) % f;
        const sx = tx * tx * (3 - 2 * tx);
        const a = grid[y0 * f + x0], b = grid[y0 * f + x1], c = grid[y1 * f + x0], d = grid[y1 * f + x1];
        out[y * size + x] += amp * ((a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy);
      }
    }
    total += amp;
    amp *= 0.5;
    f *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

// Tileable cellular (Worley) noise: distance to nearest and second-nearest feature point, and cell id.
function worley(size, count, seed) {
  const r = rand(seed);
  const pts = [];
  for (let i = 0; i < count; i++) pts.push([r() * size, r() * size]);
  const f1 = new Float32Array(size * size), f2 = new Float32Array(size * size), id = new Uint16Array(size * size);
  const cx = new Float32Array(size * size), cy = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let d1 = 1e9, d2 = 1e9, best = 0, bx = 0, by = 0;
      for (let i = 0; i < count; i++) {
        let dx = Math.abs(x - pts[i][0]); if (dx > size / 2) dx = size - dx;
        let dy = Math.abs(y - pts[i][1]); if (dy > size / 2) dy = size - dy;
        const d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; d1 = d; best = i; bx = x - pts[i][0]; by = y - pts[i][1]; } else if (d < d2) d2 = d;
      }
      const k = y * size + x;
      f1[k] = Math.sqrt(d1);
      f2[k] = Math.sqrt(d2);
      id[k] = best;
      if (bx > size / 2) bx -= size; else if (bx < -size / 2) bx += size;
      if (by > size / 2) by -= size; else if (by < -size / 2) by += size;
      cx[k] = bx;
      cy[k] = by;
    }
  }
  return { f1, f2, id, cx, cy };
}

function canvasOf(size, paint) {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  paint(img.data);
  ctx.putImageData(img, 0, 0);
  return { cv, ctx };
}

function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

const BUILDERS = {
  // Adipose tissue: densely packed glossy fat globules in a thin pink-orange connective net.
  fat(size) {
    const cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size;
    const ctx = cv.getContext('2d');
    const bg = ctx.createLinearGradient(0, 0, size, size);
    bg.addColorStop(0, '#e6a46c');
    bg.addColorStop(1, '#dc9560');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
    const r = rand(11);
    const blobs = [];
    for (let i = 0; i < 1100; i++) blobs.push({ x: r() * size, y: r() * size, rad: 7 + r() * 11, tone: r() });
    blobs.sort((a, b) => a.y - b.y);
    for (const b of blobs) {
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          const x = b.x + ox, y = b.y + oy;
          if (x < -b.rad || y < -b.rad || x > size + b.rad || y > size + b.rad) continue;
          const g = ctx.createRadialGradient(x - b.rad * 0.35, y - b.rad * 0.4, b.rad * 0.08, x, y, b.rad);
          const mid = b.tone < 0.33 ? '#f6d57c' : b.tone < 0.66 ? '#f2c96a' : '#f8de92';
          g.addColorStop(0, '#fff6d2');
          g.addColorStop(0.45, mid);
          g.addColorStop(0.9, '#d9a24a');
          g.addColorStop(1, 'rgba(200,120,70,0.9)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, b.rad, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.beginPath();
          ctx.ellipse(x - b.rad * 0.38, y - b.rad * 0.45, b.rad * 0.22, b.rad * 0.12, -0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // capillaries threading between the globules
    ctx.lineCap = 'round';
    for (let v = 0; v < 10; v++) {
      let x = r() * size, y = r() * size, a = r() * Math.PI * 2;
      ctx.strokeStyle = `rgba(190,45,55,${0.25 + r() * 0.2})`;
      ctx.lineWidth = 0.8 + r();
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 8; k++) {
        a += (r() - 0.5) * 1.3;
        x += Math.cos(a) * 22;
        y += Math.sin(a) * 22;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    return { cv, ctx };
  },
  // Velvety mucosa: soft colour variation plus fine villus speckle.
  mucosa(size, base, seed, speck = 26) {
    const c = hex(base);
    const n = fbm(size, 6, 4, seed);
    const r = rand(seed + 5);
    return canvasOf(size, (d) => {
      for (let k = 0; k < size * size; k++) {
        const v = 0.82 + n[k] * 0.36 + (r() - 0.5) * (speck / 255);
        d[k * 4] = clamp255(c[0] * v);
        d[k * 4 + 1] = clamp255(c[1] * v);
        d[k * 4 + 2] = clamp255(c[2] * v);
        d[k * 4 + 3] = 255;
      }
    });
  },
  colon(size) {
    const out = BUILDERS.mucosa(size, '#dfa99b', 31, 16);
    // fine submucosal vessels showing through the pale mucosa
    const { ctx } = out;
    const r = rand(77);
    ctx.lineCap = 'round';
    for (let v = 0; v < 14; v++) {
      let x = r() * size, y = r() * size, a = r() * Math.PI * 2;
      ctx.strokeStyle = `rgba(${150 + r() * 40},30,45,${0.25 + r() * 0.25})`;
      ctx.lineWidth = 0.8 + r() * 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 9; k++) {
        a += (r() - 0.5) * 1.2;
        x += Math.cos(a) * 18;
        y += Math.sin(a) * 18;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    return out;
  },
  liver(size) {
    const w = worley(size, 70, 21);
    const n = fbm(size, 10, 3, 22);
    const c = hex('#8f3428');
    return canvasOf(size, (d) => {
      for (let k = 0; k < size * size; k++) {
        const edge = w.f2[k] - w.f1[k];
        const centre = Math.max(0, 1 - w.f1[k] / 3.5);
        let v = 0.86 + n[k] * 0.28 + Math.min(1, edge / 6) * 0.08;
        if (edge < 1.6) v *= 0.82;
        v *= 1 - centre * 0.45;
        d[k * 4] = clamp255(c[0] * v);
        d[k * 4 + 1] = clamp255(c[1] * v);
        d[k * 4 + 2] = clamp255(c[2] * v);
        d[k * 4 + 3] = 255;
      }
    });
  },
  serosa(size) {
    const out = BUILDERS.mucosa(size, '#eeac9d', 41, 10);
    const { ctx } = out;
    const r = rand(43);
    for (let v = 0; v < 22; v++) {
      const x = r() * size, y = r() * size;
      ctx.strokeStyle = `rgba(180,40,60,${0.18 + r() * 0.2})`;
      ctx.lineWidth = 0.7 + r();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 10, y + r() * 30, x - 8, y + 40, x + r() * 16, y + 60);
      ctx.stroke();
    }
    return out;
  },
  blood(size) {
    return BUILDERS.mucosa(size, '#8f1f33', 51, 20);
  },
  vein(size) {
    return BUILDERS.mucosa(size, '#6e2a4c', 61, 18);
  },
};

const SPECS = {
  fat: { size: 512, build: (s) => BUILDERS.fat(s) },
  stomach: { size: 256, build: (s) => BUILDERS.mucosa(s, '#df8276', 3) },
  si: { size: 256, build: (s) => BUILDERS.mucosa(s, '#ea9886', 4, 34) },
  colon: { size: 256, build: (s) => BUILDERS.colon(s) },
  liver: { size: 512, build: (s) => BUILDERS.liver(s) },
  serosa: { size: 256, build: (s) => BUILDERS.serosa(s) },
  core: { size: 128, build: (s) => BUILDERS.blood(s) },
  vein: { size: 128, build: (s) => BUILDERS.vein(s) },
};

// A canvas pattern for `name`, scaled so `worldSize` iso units span one tile of the texture.
export function tissuePattern(ctx, name, worldSize = 256) {
  if (typeof document === 'undefined') return null;
  const spec = SPECS[name];
  if (!spec) return null;
  let tex = cache.get(name);
  if (!tex) {
    tex = spec.build(spec.size).cv;
    cache.set(name, tex);
  }
  const pat = ctx.createPattern(tex, 'repeat');
  if (pat && pat.setTransform && typeof DOMMatrix !== 'undefined') {
    const k = worldSize / spec.size;
    pat.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0]));
  }
  return pat;
}
