// The base as a real human body on the operating table (anterior view, patient's right on the left):
// drapes, a prepped skin window, the opened chest and abdomen with every organ in its true place,
// shape and colour, and the germs' route along the opened digestive tract, the portal vein and a
// vein to the red marrow of the ribs. Static layers are cached; a few effects are drawn each frame.
import { toIso, hash01, GROUND_H, WALL_W } from './geom.js';
import { shade, rgba } from './color.js';
import { tissuePattern } from './textures.js';
import {
  CAVITY, HEAD, MOUTH, ORGANS, COLON_REST, APPENDIX, CLAVICLES, PELVIS, LABELS, spline,
} from './anatomy.js';

const TAU = Math.PI * 2;

const ZONE_STYLE = {
  stomach: { floor: 'stomach', wall: '#dc9a88', edge: '#a85d4c', fold: '#a8443d', glint: '#ffd3c9' },
  si: { floor: 'si', wall: '#e8a99a', edge: '#b56a5c', fold: '#b45a4b', glint: '#ffdcd0' },
  colon: { floor: 'colon', wall: '#d9b39d', edge: '#a87c66', fold: '#9c6352', glint: '#fbe3d8' },
  liver: { floor: 'vein', wall: '#6d4f97', edge: '#3f2c63', fold: '#3a1430', glint: '#cbb2ef' },
  core: { floor: 'core', wall: '#5c63ad', edge: '#2f3576', fold: '#5a0f1a', glint: '#c9cdf5' },
};

function q(x, y, lift = 0) {
  const p = toIso(x, y);
  return { x: p.x, y: p.y - lift };
}

function shapeOf(ctrl, step = 12) {
  return spline(ctrl, step, true).map((p) => q(p[0], p[1]));
}

function pathOf(ctrl, step = 8) {
  return spline(ctrl, step, false).map((p) => q(p[0], p[1]));
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

function bbox(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// A solid organ with volume: shadow, tissue fill, rounded shading, rim, outline and wet highlights.
function organ(ctx, pts, o) {
  const b = bbox(pts);
  ctx.save();
  poly(ctx, pts.map((p) => ({ x: p.x + (o.sx || 3), y: p.y + (o.sy || 4) })));
  ctx.fillStyle = 'rgba(30,5,10,0.35)';
  ctx.fill();
  poly(ctx, pts);
  ctx.fillStyle = (o.pattern && tissuePattern(ctx, o.pattern, o.scale || 160)) || o.color;
  ctx.fill();
  if (o.tint) {
    ctx.fillStyle = o.tint;
    ctx.fill();
  }
  ctx.clip();
  const g = ctx.createRadialGradient(b.x0 + b.w * 0.36, b.y0 + b.h * 0.3, 2, b.cx, b.cy, Math.max(b.w, b.h) * 0.72);
  g.addColorStop(0, `rgba(255,240,235,${o.light == null ? 0.28 : o.light})`);
  g.addColorStop(0.55, 'rgba(255,255,255,0)');
  g.addColorStop(1, `rgba(20,0,5,${o.dark == null ? 0.38 : o.dark})`);
  ctx.fillStyle = g;
  ctx.fillRect(b.x0 - 2, b.y0 - 2, b.w + 4, b.h + 4);
  poly(ctx, pts);
  ctx.strokeStyle = 'rgba(30,0,8,0.28)';
  ctx.lineWidth = o.rim || 7;
  ctx.stroke();
  if (o.details) o.details(b);
  const rnd = seeded(o.seed || 7);
  ctx.lineCap = 'round';
  for (let k = 0; k < (o.gloss == null ? 4 : o.gloss); k++) {
    const x = b.x0 + b.w * (0.18 + rnd() * 0.45), y = b.y0 + b.h * (0.12 + rnd() * 0.4);
    const w = Math.min(b.w * 0.3, 8 + rnd() * 20);
    ctx.strokeStyle = `rgba(255,255,255,${(0.3 + rnd() * 0.25).toFixed(2)})`;
    ctx.lineWidth = 0.8 + rnd() * 1.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w * 0.5, y - 3, x + w, y + 1);
    ctx.stroke();
  }
  ctx.restore();
  poly(ctx, pts);
  ctx.strokeStyle = o.edge || 'rgba(40,5,10,0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
  return b;
}

// A closed tube (vessel or bowel) along a spline of [x, y, w] points.
function tube(ctx, ctrl, o) {
  const dense = spline(ctrl, 6, false);
  const n = dense.length;
  const left = [], right = [], mid = [];
  for (let i = 0; i < n; i++) {
    const a = dense[Math.max(0, i - 1)], b = dense[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    const w = (dense[i][2] || o.w || 20);
    left.push(q(dense[i][0] - ty * w, dense[i][1] + tx * w));
    right.push(q(dense[i][0] + ty * w, dense[i][1] - tx * w));
    mid.push(q(dense[i][0], dense[i][1]));
  }
  const outline = left.concat(right.slice().reverse());
  ctx.save();
  poly(ctx, outline.map((p) => ({ x: p.x + 2.5, y: p.y + 3.5 })));
  ctx.fillStyle = 'rgba(30,5,10,0.3)';
  ctx.fill();
  poly(ctx, outline);
  ctx.fillStyle = (o.pattern && tissuePattern(ctx, o.pattern, o.scale || 140)) || o.color;
  ctx.fill();
  if (o.tint) {
    ctx.fillStyle = o.tint;
    ctx.fill();
  }
  ctx.clip();
  // cylindrical shading: dark edges, bright ridge towards the light
  for (const [pts, col, lw] of [[left, 'rgba(20,0,5,0.35)', 7], [right, 'rgba(20,0,5,0.4)', 8]]) {
    line(ctx, pts);
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  line(ctx, mid.map((p, i) => ({ x: (p.x * 2 + right[i].x) / 3, y: (p.y * 2 + right[i].y) / 3 })));
  ctx.strokeStyle = 'rgba(255,245,240,0.32)';
  ctx.lineWidth = Math.max(1.5, (o.w || 20) * 0.22);
  ctx.stroke();
  if (o.details) o.details({ left, right, mid, dense });
  ctx.restore();
  poly(ctx, outline);
  ctx.strokeStyle = o.edge || 'rgba(60,15,20,0.6)';
  ctx.lineWidth = 0.9;
  ctx.stroke();
  return { left, right, mid };
}

// ---------------------------------------------------------------- table, drapes and incision

function drawTable(ctx) {
  const a = q(-60, -20), b = q(2260, 4120);
  ctx.fillStyle = tissuePattern(ctx, 'drape', 160) || '#2c7b72';
  ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
  // soft folds in the drape
  const rnd = seeded(3);
  ctx.lineCap = 'round';
  for (let k = 0; k < 26; k++) {
    const x = a.x + rnd() * (b.x - a.x), y = a.y + rnd() * (b.y - a.y);
    const len = 60 + rnd() * 160, ang = (rnd() - 0.5) * 0.9 + (rnd() < 0.5 ? 0 : Math.PI / 2);
    for (const [col, lw, off] of [['rgba(0,30,25,0.18)', 9, 3], ['rgba(200,255,240,0.1)', 5, -2]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x + off, y + off);
      ctx.quadraticCurveTo(x + Math.cos(ang) * len * 0.5 + 12, y + Math.sin(ang) * len * 0.5 - 10, x + Math.cos(ang) * len + off, y + Math.sin(ang) * len + off);
      ctx.stroke();
    }
  }
  const vg = ctx.createRadialGradient(q(1100, 2300).x, q(1100, 2300).y, 200, q(1100, 2300).x, q(1100, 2300).y, 1250);
  vg.addColorStop(0, 'rgba(255,255,240,0.06)');
  vg.addColorStop(1, 'rgba(0,10,10,0.35)');
  ctx.fillStyle = vg;
  ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
}

function drawHead(ctx) {
  // the head under a drape, with an opening at the mouth
  const c = q(HEAD.x, HEAD.y);
  const rx = HEAD.rx * 0.5, ry = HEAD.ry * 0.5;
  ctx.save();
  ctx.fillStyle = 'rgba(0,20,15,0.35)';
  ctx.beginPath();
  ctx.ellipse(c.x + 6, c.y + 10, rx * 1.05, ry * 1.02, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = tissuePattern(ctx, 'drape', 160) || '#2c7b72';
  ctx.fill();
  ctx.clip();
  const g = ctx.createRadialGradient(c.x - rx * 0.35, c.y - ry * 0.4, 10, c.x, c.y, ry * 1.1);
  g.addColorStop(0, 'rgba(220,255,245,0.32)');
  g.addColorStop(0.6, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,25,20,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(c.x - rx, c.y - ry, rx * 2, ry * 2);
  // drape folds over the brow, nose and chin
  ctx.strokeStyle = 'rgba(0,30,25,0.3)';
  ctx.lineWidth = 3;
  for (const [y0, k] of [[-0.45, 0.6], [-0.1, 0.3], [0.2, 0.5]]) {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + ry * y0, rx * k, ry * 0.12, 0, 0.1, Math.PI - 0.1);
    ctx.stroke();
  }
  ctx.restore();
  // perioral skin in the drape window
  const m = q(MOUTH.x, MOUTH.y);
  ctx.fillStyle = tissuePattern(ctx, 'skin', 140) || '#c98d6d';
  ctx.beginPath();
  ctx.ellipse(m.x, m.y - 9, 58, 32, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,30,25,0.6)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawIncision(ctx) {
  const cav = shapeOf(CAVITY, 14);
  // povidone-iodine prepped skin around the incision
  ctx.save();
  poly(ctx, cav);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = tissuePattern(ctx, 'skin', 140) || '#c98d6d';
  ctx.lineWidth = 110;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(165,85,25,0.28)';
  ctx.lineWidth = 104;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,25,20,0.35)';
  ctx.lineWidth = 112;
  ctx.globalCompositeOperation = 'destination-over';
  ctx.stroke();
  ctx.restore();
  // the posterior wall seen through the opening
  poly(ctx, cav);
  ctx.fillStyle = tissuePattern(ctx, 'muscle', 140) || '#7b2a30';
  ctx.fill();
  ctx.fillStyle = 'rgba(40,0,10,0.45)';
  ctx.fill();
  return cav;
}

function drawWoundEdges(ctx, cav) {
  // cut edges, outside in: skin, subcutaneous fat, muscle, parietal peritoneum
  ctx.save();
  poly(ctx, cav);
  ctx.clip();
  ctx.lineJoin = 'round';
  const layers = [
    [56, 'rgba(240,200,205,0.95)'], [50, tissuePattern(ctx, 'muscle', 90) || '#a3343f'],
    [28, tissuePattern(ctx, 'fat', 120) || '#efc66f'], [8, '#b77a5d'],
  ];
  for (const [w, s] of layers) {
    poly(ctx, cav);
    ctx.strokeStyle = s;
    ctx.lineWidth = w;
    ctx.stroke();
  }
  poly(ctx, cav);
  ctx.strokeStyle = 'rgba(30,0,8,0.4)';
  ctx.lineWidth = 64;
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = 0.25;
  ctx.stroke();
  ctx.restore();
  poly(ctx, cav);
  ctx.strokeStyle = 'rgba(255,240,230,0.5)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

// ---------------------------------------------------------------- chest

function drawChest(ctx) {
  // great vessels behind the heart, then the lungs, trachea, thyroid and heart
  tube(ctx, [[1040, 1440, 20], [1042, 1560, 22], [1046, 1670, 24]], { color: '#4a56a8', pattern: null, w: 22 }); // SVC
  tube(ctx, [[1236, 1600, 22], [1240, 1500, 24], [1200, 1440, 26], [1120, 1440, 26], [1082, 1520, 26], [1084, 1640, 28]],
    { color: '#c3464f', w: 26 }); // aortic arch
  for (const [x0, x1] of [[1110, 1080], [1160, 1170], [1200, 1250]]) {
    tube(ctx, [[x0, 1450, 10], [x1, 1330, 9], [x1 + (x1 - x0) * 0.4, 1200, 8]], { color: '#c3464f', w: 9 });
  }
  const rl = shapeOf(ORGANS.rightLung);
  organ(ctx, rl, {
    pattern: 'lung', scale: 150, light: 0.32, dark: 0.32, seed: 11, details(b) {
      // horizontal and oblique fissures
      ctx.strokeStyle = 'rgba(90,30,45,0.55)';
      ctx.lineWidth = 1.6;
      line(ctx, pathOf([[500, 1700], [700, 1690], [990, 1720]]));
      ctx.stroke();
      line(ctx, pathOf([[880, 1350], [760, 1700], [620, 2080]]));
      ctx.stroke();
    },
  });
  const ll = shapeOf(ORGANS.leftLung);
  organ(ctx, ll, {
    pattern: 'lung', scale: 150, light: 0.32, dark: 0.32, seed: 12, details() {
      ctx.strokeStyle = 'rgba(90,30,45,0.55)';
      ctx.lineWidth = 1.6;
      line(ctx, pathOf([[1300, 1380], [1460, 1720], [1640, 2120]]));
      ctx.stroke();
    },
  });
  // trachea with cartilage rings, and the main bronchi
  tube(ctx, [[1080, 880, 30], [1080, 1200, 30], [1080, 1500, 30]], {
    color: '#e8d9c6', w: 30, details({ dense }) {
      ctx.strokeStyle = 'rgba(150,120,100,0.55)';
      ctx.lineWidth = 2;
      for (let y = 900; y < 1490; y += 26) {
        const a = q(1052, y), b = q(1108, y);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo((a.x + b.x) / 2, a.y + 4, b.x, b.y);
        ctx.stroke();
      }
      return dense;
    },
  });
  tube(ctx, [[1080, 1500, 22], [1010, 1570, 20], [960, 1640, 16]], { color: '#e3d2bd', w: 20 });
  tube(ctx, [[1080, 1500, 22], [1150, 1580, 20], [1210, 1650, 16]], { color: '#e3d2bd', w: 20 });
  organ(ctx, shapeOf(ORGANS.thyroid, 8), { color: '#a6463e', light: 0.3, dark: 0.35, rim: 4, gloss: 2, seed: 5 });
  // pulmonary trunk
  tube(ctx, [[1200, 1700, 26], [1214, 1610, 26], [1250, 1560, 22]], { color: '#7c5aa6', w: 24 });
  const heart = shapeOf(ORGANS.heart);
  organ(ctx, heart, {
    pattern: 'heart', scale: 120, light: 0.25, dark: 0.45, seed: 21, details() {
      // epicardial fat in the grooves and the coronary vessels
      ctx.lineCap = 'round';
      for (const [pts, fat] of [
        [[[1030, 1730], [1080, 1840], [1150, 1960], [1240, 2060]], 9],
        [[[1200, 1660], [1270, 1800], [1340, 1940], [1400, 2040]], 8],
      ]) {
        const p = pathOf(pts);
        line(ctx, p);
        ctx.strokeStyle = 'rgba(245,205,110,0.9)';
        ctx.lineWidth = fat;
        ctx.stroke();
        ctx.strokeStyle = '#c0283b';
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(70,80,170,0.8)';
        ctx.lineWidth = 1.2;
        line(ctx, p.map((pt) => ({ x: pt.x + 3, y: pt.y + 1 })));
        ctx.stroke();
      }
      // right atrial appendage hint
      ctx.strokeStyle = 'rgba(60,5,10,0.4)';
      ctx.lineWidth = 1.4;
      line(ctx, pathOf([[1000, 1700], [1040, 1760], [1030, 1840]]));
      ctx.stroke();
    },
  });
  // diaphragm under the lungs (right dome higher)
  const dia = [[436, 2142, 26], [560, 2060, 26], [740, 2010, 24], [960, 2000, 22], [1140, 2060, 22], [1340, 2110, 24],
    [1540, 2140, 26], [1760, 2160, 26]];
  tube(ctx, dia, {
    pattern: 'muscle', scale: 90, w: 24, details({ mid }) {
      ctx.strokeStyle = 'rgba(245,240,230,0.55)';
      ctx.lineWidth = 6;
      line(ctx, mid.slice(Math.floor(mid.length * 0.4), Math.floor(mid.length * 0.62)));
      ctx.stroke();
    },
  });
  // clavicles across the top of the chest
  for (const c of CLAVICLES) {
    tube(ctx, c.map((p) => [p[0], p[1], 15]), { color: '#efe4cc', w: 15, edge: 'rgba(110,90,60,0.7)' });
  }
}

function drawRibEnds(ctx) {
  // cut ends of the ribs in the chest wall
  for (let y = 1250; y < 2140; y += 118) {
    for (const side of [-1, 1]) {
      const edgeX = side < 0 ? 470 - (y - 1700) * (y - 1700) / 26000 : 1730 + (y - 1700) * (y - 1700) / 26000;
      const a = q(edgeX, y), b = q(edgeX - side * 64, y + 26);
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(90,70,50,0.6)';
      ctx.lineWidth = 12;
      line(ctx, [a, b]);
      ctx.stroke();
      ctx.strokeStyle = '#efe4cc';
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.fillStyle = '#c64a55';
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, 3, 2.2, 0, 0, TAU);
      ctx.fill();
    }
  }
}

// ---------------------------------------------------------------- abdomen

function drawRetroperitoneum(ctx) {
  organ(ctx, shapeOf(ORGANS.rightKidney, 8), { color: '#8b3a2f', light: 0.22, dark: 0.45, gloss: 2, seed: 31 });
  organ(ctx, shapeOf(ORGANS.leftKidney, 8), { color: '#8b3a2f', light: 0.22, dark: 0.45, gloss: 2, seed: 32 });
  tube(ctx, [[1030, 2150, 22], [1030, 2800, 22], [1010, 3330, 20]], { color: '#4a56a8', w: 22 }); // IVC
  tube(ctx, [[1136, 2150, 20], [1140, 2800, 18], [1130, 3300, 16]], { color: '#c3464f', w: 18 }); // aorta
  tube(ctx, [[1130, 3300, 14], [1000, 3420, 12], [880, 3520, 10]], { color: '#c3464f', w: 12 });
  tube(ctx, [[1130, 3300, 14], [1260, 3420, 12], [1380, 3520, 10]], { color: '#c3464f', w: 12 });
  // pelvic brim
  for (const p of PELVIS) tube(ctx, p.map((pt) => [pt[0], pt[1], 26]), { color: '#ece0c6', w: 26, edge: 'rgba(110,90,60,0.7)' });
}

function drawMesentery(ctx) {
  const pts = shapeOf([[700, 2790], [900, 2720], [1300, 2770], [1660, 2780], [1690, 3120], [1600, 3420], [1200, 3500],
    [820, 3480], [690, 3300], [670, 3000]], 14);
  organ(ctx, pts, { pattern: 'fat', scale: 120, light: 0.22, dark: 0.3, rim: 10, gloss: 8, seed: 41 });
}

function drawUpperAbdomen(ctx) {
  organ(ctx, shapeOf(ORGANS.spleen, 10), { color: '#7a2c4c', pattern: null, light: 0.3, dark: 0.45, seed: 51 });
  organ(ctx, shapeOf(ORGANS.pancreas, 10), {
    pattern: 'fat', scale: 70, tint: 'rgba(220,140,120,0.45)', light: 0.2, dark: 0.35, rim: 5, gloss: 2, seed: 52,
  });
  const liver = shapeOf(ORGANS.liver, 12);
  organ(ctx, liver, {
    pattern: 'liver', scale: 200, light: 0.24, dark: 0.45, rim: 10, gloss: 7, seed: 53, details() {
      // falciform ligament and ligamentum teres
      ctx.strokeStyle = 'rgba(255,220,205,0.45)';
      ctx.lineWidth = 2.4;
      line(ctx, pathOf([[1080, 2020], [1050, 2150], [990, 2300]]));
      ctx.stroke();
    },
  });
  organ(ctx, shapeOf(ORGANS.gallbladder, 8), { color: '#5f8f3a', light: 0.4, dark: 0.4, rim: 4, gloss: 2, seed: 54 });
}

function drawLowerAbdomen(ctx) {
  organ(ctx, shapeOf(ORGANS.bladder, 8), { color: '#e6c4b2', light: 0.35, dark: 0.3, seed: 61 });
  // transverse, descending and sigmoid colon with haustra, taeniae and fat tags
  for (const c of COLON_REST) {
    tube(ctx, c, {
      pattern: 'serosa', scale: 140, tint: 'rgba(220,180,150,0.35)', w: 50, details({ left, right, mid }) {
        for (let i = 4; i < mid.length - 2; i += 7) {
          ctx.strokeStyle = 'rgba(110,60,40,0.45)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(left[i].x, left[i].y);
          ctx.quadraticCurveTo(mid[i].x + 3, mid[i].y + 2, right[i].x, right[i].y);
          ctx.stroke();
        }
        line(ctx, mid);
        ctx.strokeStyle = 'rgba(250,236,220,0.7)';
        ctx.lineWidth = 3;
        ctx.stroke();
        for (let i = 5; i < right.length; i += 11) {
          const p = right[i];
          ctx.fillStyle = '#f2cb68';
          ctx.beginPath();
          ctx.ellipse(p.x + 2, p.y + 2, 5, 3.4, 0.4, 0, TAU);
          ctx.fill();
        }
      },
    });
  }
  tube(ctx, APPENDIX.map((p) => [p[0], p[1], 11]), { pattern: 'serosa', scale: 100, w: 11 });
}

// ---------------------------------------------------------------- the germs' route

const normCache = new WeakMap();

function routeNormals(geom) {
  let n = normCache.get(geom);
  if (n) return n;
  const sm = geom.samples;
  n = sm.map((p, i) => {
    const a = sm[Math.max(0, i - 2)], b = sm[Math.min(sm.length - 1, i + 2)];
    let tx = b.x - a.x, ty = b.y - a.y;
    const l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    return { x: p.x, y: p.y, w: p.w, s: p.s, zone: p.zone, tx, ty, nx: -ty, ny: tx };
  });
  normCache.set(geom, n);
  return n;
}

function off(p, d) {
  return q(p.x + p.nx * d, p.y + p.ny * d);
}

function band(pts, w) {
  return pts.map((p) => off(p, w(p))).concat(pts.map((p) => off(p, -w(p))).reverse());
}

function zoneRuns(pts) {
  const out = [];
  let start = 0;
  for (let i = 1; i <= pts.length; i++) {
    if (i === pts.length || pts[i].zone !== pts[start].zone) {
      out.push(pts.slice(Math.max(0, start - 1), Math.min(pts.length, i + 1)));
      start = i;
    }
  }
  return out;
}

function drawRouteVessels(ctx, geom) {
  // superior mesenteric arcades fanning from the mesenteric root to the small bowel
  const pts = routeNormals(geom).filter((p) => p.zone === 'si');
  const root = q(1150, 2960);
  ctx.lineCap = 'round';
  for (let i = 10; i < pts.length; i += 34) {
    const p = pts[i];
    const side = ((p.x - 1150) * p.nx + (p.y - 2960) * p.ny) > 0 ? -1 : 1;
    const end = off(p, side * (p.w + WALL_W + 4));
    const midp = { x: (root.x + end.x) / 2 + (hash01(i, 1) - 0.5) * 20, y: (root.y + end.y) / 2 + (hash01(i, 2) - 0.5) * 20 };
    for (const [col, w, dx] of [['#3f4c9c', 2.6, 2], ['#b8202f', 2, 0]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(root.x + dx, root.y);
      ctx.quadraticCurveTo(midp.x + dx, midp.y, end.x + dx, end.y);
      ctx.stroke();
    }
  }
}

function drawRoute(ctx, geom) {
  const all = routeNormals(geom);
  for (const run of zoneRuns(all)) {
    const zs = ZONE_STYLE[run[run.length >> 1].zone] || ZONE_STYLE.si;
    const outer = band(run, (p) => p.w + WALL_W);
    const floor = band(run, (p) => p.w);
    ctx.save();
    poly(ctx, outer.map((p) => ({ x: p.x + 3, y: p.y + 4 })));
    ctx.fillStyle = 'rgba(30,5,10,0.35)';
    ctx.fill();
    // outer wall (serosa, or vessel wall)
    poly(ctx, outer);
    const vessel = zs.floor === 'vein' || zs.floor === 'core';
    ctx.fillStyle = vessel ? zs.wall : (tissuePattern(ctx, 'serosa', 140) || zs.wall);
    ctx.fill();
    if (!vessel) {
      ctx.fillStyle = rgba(zs.wall, 0.35);
      ctx.fill();
    }
    ctx.restore();
    ctx.save();
    poly(ctx, outer);
    ctx.clip();
    for (const sgn of [1, -1]) {
      line(ctx, run.map((p) => off(p, sgn * (p.w + WALL_W))));
      ctx.strokeStyle = 'rgba(25,0,8,0.4)';
      ctx.lineWidth = 6;
      ctx.stroke();
    }
    ctx.restore();
    // opened lumen: mucosa (or blood in the vessels)
    ctx.save();
    poly(ctx, floor);
    ctx.fillStyle = tissuePattern(ctx, zs.floor, 120) || zs.wall;
    ctx.fill();
    ctx.clip();
    drawFolds(ctx, run, zs);
    for (const sgn of [1, -1]) {
      line(ctx, run.map((p) => off(p, sgn * p.w)));
      ctx.strokeStyle = 'rgba(40,0,12,0.3)';
      ctx.lineWidth = 9;
      ctx.stroke();
    }
    ctx.restore();
    // cut edge of the wall: muscle, submucosa, mucosa
    for (const sgn of [1, -1]) {
      const edge = run.map((p) => off(p, sgn * p.w));
      line(ctx, edge);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = vessel ? shade(zs.edge, -0.1) : '#a63a44';
      ctx.lineWidth = 3.4;
      ctx.stroke();
      ctx.strokeStyle = vessel ? zs.glint : '#f2dccb';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    line(ctx, run.map((p) => off(p, p.w + WALL_W)));
    ctx.strokeStyle = rgba(zs.edge, 0.8);
    ctx.lineWidth = 0.9;
    ctx.stroke();
    line(ctx, run.map((p) => off(p, -(p.w + WALL_W))));
    ctx.stroke();
  }
}

function drawFolds(ctx, run, zs) {
  const z = run[run.length >> 1].zone;
  ctx.lineCap = 'round';
  if (z === 'stomach') {
    // rugae run along the stomach; the oesophagus has fine longitudinal folds
    for (const f of [-0.6, -0.3, 0, 0.3, 0.6]) {
      const path = run.map((p) => off(p, (f + Math.sin(p.s * 0.03 + f * 9) * 0.06) * p.w));
      line(ctx, path);
      ctx.strokeStyle = rgba(zs.fold, 0.45);
      ctx.lineWidth = 3.4;
      ctx.stroke();
      line(ctx, path.map((p) => ({ x: p.x - 0.8, y: p.y - 0.8 })));
      ctx.strokeStyle = rgba(zs.glint, 0.55);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  } else if (z === 'si' || z === 'colon') {
    const every = z === 'si' ? 2 : 6;
    for (let i = 1; i < run.length - 1; i += every) {
      const p = run[i];
      const a = off(p, -0.95 * p.w), b = off(p, 0.95 * p.w);
      const m = q(p.x + p.tx * (z === 'si' ? 3 : 8), p.y + p.ty * (z === 'si' ? 3 : 8));
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(m.x, m.y, b.x, b.y);
      ctx.strokeStyle = rgba(zs.fold, z === 'si' ? 0.4 : 0.55);
      ctx.lineWidth = z === 'si' ? 1.6 : 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(a.x - 0.6, a.y - 0.8);
      ctx.quadraticCurveTo(m.x - 0.6, m.y - 0.8, b.x - 0.6, b.y - 0.8);
      ctx.strokeStyle = rgba(zs.glint, 0.5);
      ctx.lineWidth = z === 'si' ? 0.8 : 1.5;
      ctx.stroke();
    }
  } else {
    for (let i = 0; i < run.length; i += 3) {
      const p = run[i];
      const c = off(p, (hash01(i, 7) - 0.5) * 1.5 * p.w);
      ctx.fillStyle = hash01(i, 8) < 0.8 ? 'rgba(220,50,70,0.75)' : 'rgba(250,245,255,0.8)';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 2.4, 1.5, 0, 0, TAU);
      ctx.fill();
    }
  }
  // wet sheen
  for (let i = 0; i < run.length - 4; i += 5) {
    if (hash01(i, 5, 5) < 0.4) continue;
    const a = off(run[i], -0.45 * run[i].w), b = off(run[i + 3], -0.45 * run[i + 3].w);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.6;
    line(ctx, [a, b]);
    ctx.stroke();
  }
}

function drawLabels(ctx) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'italic 600 11px system-ui, "Segoe UI", sans-serif';
  ctx.lineJoin = 'round';
  for (const l of LABELS) {
    const p = q(l.x, l.y);
    ctx.strokeStyle = 'rgba(20,5,10,0.75)';
    ctx.lineWidth = 3;
    ctx.strokeText(l.text, p.x, p.y);
    ctx.fillStyle = 'rgba(255,248,240,0.92)';
    ctx.fillText(l.text, p.x, p.y);
  }
}

function drawPlinth(ctx, geom, info) {
  if (info.inLumen) return;
  const p = q(info.x, info.y, GROUND_H);
  const r = info.kind === 'core' ? 62 : 36;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r, r * 0.6, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,250,235,0.6)';
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawGround(ctx, geom) {
  drawTable(ctx);
  drawHead(ctx);
  const cav = drawIncision(ctx);
  ctx.save();
  poly(ctx, cav);
  ctx.clip();
  drawRetroperitoneum(ctx);
  drawChest(ctx);
  drawRibEnds(ctx);
  drawMesentery(ctx);
  drawLowerAbdomen(ctx);
  drawUpperAbdomen(ctx);
  ctx.restore();
  drawWoundEdges(ctx, cav);
  drawRouteVessels(ctx, geom);
  drawRoute(ctx, geom);
  drawLabels(ctx);
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
}));

// Screen-space backdrop: the dim operating theatre around the lit table.
export function drawBackdrop(ctx, vw, vh, t) {
  const g = ctx.createRadialGradient(vw * 0.5, vh * 0.45, Math.min(vw, vh) * 0.1, vw * 0.5, vh * 0.5, Math.max(vw, vh) * 0.8);
  g.addColorStop(0, '#1f4a46');
  g.addColorStop(0.55, '#12302e');
  g.addColorStop(1, '#071514');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vw, vh);
  for (const c of BACKDROP_CELLS) {
    const x = ((c.u + t * c.sp) % 1.2 - 0.1) * vw;
    const y = c.v * vh + Math.sin(t * 0.4 + c.u * 9) * 12;
    ctx.fillStyle = 'rgba(200,255,240,0.03)';
    ctx.beginPath();
    ctx.arc(x, y, c.r, 0, TAU);
    ctx.fill();
  }
}

const FLOW = Array.from({ length: 50 }, (_, k) => ({
  f: hash01(k, 11, 3), off: hash01(k, 12, 3) - 0.5, sp: 26 + hash01(k, 13, 3) * 30, kind: k % 4,
}));

// Chyme, bubbles and (in the veins) blood cells drifting along the route.
export function drawLumenFlow(ctx, geom, t, speed = 1) {
  ctx.save();
  for (const p of FLOW) {
    const s = (p.f * geom.len + t * p.sp * speed) % geom.len;
    const pos = geom.posAt(s);
    const d = geom.dirAt(s);
    const lat = p.off * 1.4 * geom.lumenHalf(s);
    const c = q(pos.x - d.dy * lat, pos.y + d.dx * lat);
    const z = geom.zoneOf(s).key;
    const fade = Math.min(1, s / 120, (geom.len - s) / 160);
    if (z === 'liver' || z === 'core') {
      ctx.fillStyle = `rgba(225,55,75,${(0.75 * fade).toFixed(2)})`;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 2.6, 1.6, 0, 0, TAU);
      ctx.fill();
    } else if (p.kind === 0) {
      ctx.strokeStyle = `rgba(255,255,255,${(0.6 * fade).toFixed(2)})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 2, 0, TAU);
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(150,105,40,${(0.5 * fade).toFixed(2)})`;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 2.4 + p.kind * 0.5, 1.4, 0, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

function floorBetween(geom, s0, s1) {
  const pts = routeNormals(geom).filter((p) => p.s >= s0 && p.s <= s1);
  return pts.length >= 2 ? pts : null;
}

export function drawAcidSheen(ctx, geom, s0, s1, t, strength) {
  const pts = floorBetween(geom, s0, s1);
  if (!pts) return;
  ctx.save();
  poly(ctx, band(pts, (p) => p.w));
  const a = (0.16 + 0.05 * Math.sin(t * 2)) * strength;
  ctx.fillStyle = `rgba(190,230,60,${a.toFixed(3)})`;
  ctx.fill();
  ctx.clip();
  for (let k = 0; k < 24; k++) {
    const p = pts[Math.floor(hash01(k, 3, 7) * pts.length)];
    const ph = (t * 0.7 + hash01(k, 1, 7)) % 1;
    const c = off(p, (hash01(k, 2, 7) - 0.5) * 1.6 * p.w);
    ctx.strokeStyle = `rgba(230,255,140,${(0.8 * (1 - ph) * strength).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(c.x, c.y - ph * 5, 1.6 + ph * 2.4, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPeristalsisBands(ctx, geom, s0, s1, t, period) {
  const span = s1 - s0;
  if (span <= 0) return;
  ctx.save();
  const phase = ((t * 1000) % period) / period;
  ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const s = s0 + ((phase + k / 3) % 1) * span;
    const p = geom.posAt(s);
    const d = geom.dirAt(s);
    const half = geom.lumenHalf(s) + WALL_W * 0.6;
    const a = q(p.x - d.dy * half, p.y + d.dx * half), b = q(p.x + d.dy * half, p.y - d.dx * half);
    ctx.strokeStyle = 'rgba(190,50,80,0.3)';
    ctx.lineWidth = 9;
    line(ctx, [a, b]);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,150,170,0.4)';
    ctx.lineWidth = 2.4;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPathSpan(ctx, geom, s0, s1, fill, stroke) {
  const pts = floorBetween(geom, Math.max(0, s0), Math.min(geom.len, s1));
  if (!pts) return;
  ctx.save();
  poly(ctx, band(pts, (p) => p.w));
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
  ctx.lineWidth = 12;
  for (const [a, b] of intervals) {
    ctx.beginPath();
    const steps = Math.max(2, Math.ceil((b - a) / 25));
    for (let k = 0; k <= steps; k++) {
      const p = geom.posAt(a + ((b - a) * k) / steps);
      const c = q(p.x, p.y);
      if (k === 0) ctx.moveTo(c.x, c.y); else ctx.lineTo(c.x, c.y);
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
  ctx.arc(ix, iy, r * 0.5, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

export function drawMouth(ctx, geom, t, open) {
  const m = q(geom.mouth.x, geom.mouth.y);
  const x = m.x, y = m.y - 9;
  const o = 3 + open * 9 + Math.sin(t * 3) * 0.7;
  ctx.save();
  const cav = ctx.createRadialGradient(x, y, 2, x, y, 24);
  cav.addColorStop(0, '#2a0614');
  cav.addColorStop(1, '#6a1832');
  ctx.fillStyle = cav;
  ctx.beginPath();
  ctx.ellipse(x, y, 22, o + 1, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#e46a86';
  ctx.beginPath();
  ctx.ellipse(x + 2, y + o * 0.45, 13, Math.max(1.5, o * 0.45), 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#fffaf2';
  ctx.strokeStyle = 'rgba(120,90,70,0.5)';
  ctx.lineWidth = 0.6;
  for (let k = -3; k <= 3; k++) {
    const tw = 4.6, th = Math.min(5, o * 0.7);
    ctx.beginPath();
    ctx.roundRect(x + k * 5.6 - tw / 2, y - o + 0.5, tw, th, [0, 0, 2, 2]);
    ctx.fill();
    ctx.stroke();
  }
  const lip = ctx.createLinearGradient(0, y - o - 14, 0, y + o + 14);
  lip.addColorStop(0, '#c97a74');
  lip.addColorStop(0.5, '#b0504f');
  lip.addColorStop(1, '#93403f');
  ctx.fillStyle = lip;
  ctx.strokeStyle = 'rgba(80,20,20,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 27, y);
  ctx.quadraticCurveTo(x - 12, y - o - 14, x, y - o - 5);
  ctx.quadraticCurveTo(x + 12, y - o - 14, x + 27, y);
  ctx.quadraticCurveTo(x, y - o + 1, x - 27, y);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 27, y);
  ctx.quadraticCurveTo(x, y + o + 1, x + 27, y);
  ctx.quadraticCurveTo(x, y + o + 15, x - 27, y);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(x - 8, y + o + 6, 7, 2, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  return { x, y: y - 20 };
}
