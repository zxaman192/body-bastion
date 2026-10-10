// Anatomy of the display world: an adult human torso in anterior view (patient's right on the
// viewer's left), about 40 world units per centimetre, head at the top. The battle route follows the
// real digestive tract: mouth, oesophagus, stomach, duodenum and small-bowel coils, caecum and
// ascending colon, then the portal vein into the liver and a vein through the diaphragm to the red
// marrow of the right lower ribs, where the Bone Marrow Core stands.
// The simulation never sees these coordinates: game positions along the gut are mapped onto them.

// Route key points per game zone, with the lumen half-width at each point (world units).
export const ROUTE = {
  stomach: [
    [1100, 800, 22], [1108, 880, 24], [1128, 1000, 26], [1136, 1300, 26], [1142, 1600, 27], [1158, 1900, 28],
    [1200, 2080, 32], [1268, 2168, 46], [1330, 2196, 82], [1440, 2172, 132], [1530, 2252, 166], [1552, 2400, 176],
    [1500, 2540, 160], [1370, 2622, 118], [1220, 2660, 76], [1110, 2652, 44], [1060, 2640, 34],
  ],
  si: [
    [1060, 2640, 34], [962, 2660, 40], [892, 2770, 40], [886, 2902, 40], [962, 2990, 40], [1112, 3002, 40],
    [1242, 2952, 40], [1322, 2862, 42], [1462, 2822, 42], [1600, 2884, 42], [1622, 3024, 42], [1502, 3104, 40],
    [1342, 3160, 40], [1182, 3200, 40], [1022, 3232, 40], [902, 3272, 40], [842, 3362, 40], [752, 3402, 42],
    [690, 3402, 50],
  ],
  colon: [
    [690, 3402, 50], [640, 3462, 70], [596, 3330, 66], [574, 3080, 62], [580, 2840, 60], [622, 2712, 56],
    [700, 2652, 50],
  ],
  liver: [
    [700, 2652, 50], [760, 2560, 34], [722, 2440, 32], [646, 2322, 30], [604, 2200, 30], [610, 2080, 28],
  ],
  core: [
    [610, 2080, 28], [590, 1990, 26], [572, 1890, 26], [562, 1800, 28],
  ],
};

// Exposed operative field (neck to pubis), inside the drapes.
export const CAVITY = [
  [1020, 860], [1180, 860], [1232, 980], [1262, 1110], [1462, 1150], [1662, 1262], [1762, 1482], [1792, 1802],
  [1772, 2152], [1742, 2552], [1722, 2952], [1652, 3282], [1522, 3542], [1302, 3682], [1100, 3712], [900, 3682],
  [680, 3542], [552, 3282], [482, 2952], [462, 2552], [432, 2152], [412, 1802], [442, 1482], [542, 1262],
  [742, 1150], [940, 1110], [970, 980],
];

export const BODY = [
  [840, 900], [1360, 900], [1420, 1090], [1700, 1150], [1900, 1300], [1980, 1700], [1960, 2300], [1900, 2900],
  [1820, 3350], [1660, 3700], [1460, 3880], [1100, 3940], [740, 3880], [540, 3700], [380, 3350], [300, 2900],
  [240, 2300], [220, 1700], [300, 1300], [500, 1150], [780, 1090],
];

export const HEAD = { x: 1100, y: 540, rx: 300, ry: 380 };
export const MOUTH = { x: 1100, y: 800 };

// Organ outlines (closed smooth curves through these points).
export const ORGANS = {
  rightLung: [[958, 1190], [880, 1232], [700, 1332], [560, 1522], [490, 1802], [478, 2082], [560, 2140], [700, 2062],
    [860, 2002], [958, 1962], [998, 1702], [990, 1402]],
  leftLung: [[1240, 1190], [1330, 1232], [1520, 1332], [1660, 1522], [1722, 1802], [1732, 2122], [1622, 2170],
    [1500, 2130], [1430, 2082], [1406, 1902], [1336, 1822], [1262, 1652], [1232, 1402]],
  heart: [[1010, 1640], [1120, 1602], [1262, 1622], [1382, 1702], [1452, 1832], [1440, 1962], [1382, 2062],
    [1290, 2100], [1152, 2072], [1032, 1992], [972, 1862], [976, 1732]],
  thyroid: [[1030, 960], [1080, 990], [1120, 990], [1170, 960], [1200, 1010], [1180, 1080], [1120, 1062],
    [1080, 1062], [1020, 1080], [1000, 1010]],
  liver: [[460, 2062], [600, 1990], [800, 1980], [1000, 2010], [1180, 2052], [1300, 2092], [1322, 2142],
    [1222, 2200], [1080, 2280], [940, 2370], [820, 2462], [660, 2552], [522, 2602], [462, 2402]],
  gallbladder: [[800, 2402], [880, 2390], [932, 2470], [912, 2560], [852, 2592], [800, 2532]],
  spleen: [[1640, 2080], [1740, 2112], [1792, 2240], [1762, 2390], [1690, 2422], [1640, 2332], [1626, 2200]],
  pancreas: [[960, 2762], [1040, 2702], [1200, 2690], [1400, 2640], [1580, 2560], [1650, 2590], [1580, 2662],
    [1400, 2722], [1222, 2772], [1080, 2832], [982, 2852]],
  rightKidney: [[640, 2622], [722, 2602], [762, 2702], [752, 2862], [682, 2902], [622, 2822], [616, 2702]],
  leftKidney: [[1480, 2652], [1562, 2622], [1612, 2702], [1602, 2862], [1532, 2902], [1482, 2822], [1466, 2732]],
  bladder: [[1000, 3542], [1100, 3502], [1200, 3542], [1222, 3622], [1100, 3682], [980, 3622]],
};

// Decorative (closed) bowel: transverse, descending and sigmoid colon, rectum, appendix.
export const COLON_REST = [
  [[700, 2652, 50], [820, 2700, 52], [980, 2742, 54], [1160, 2752, 54], [1340, 2722, 54], [1520, 2652, 54],
    [1660, 2582, 52], [1720, 2700, 50], [1722, 2900, 50], [1712, 3120, 50], [1652, 3320, 52], [1500, 3440, 50],
    [1320, 3452, 46], [1180, 3500, 42], [1110, 3600, 40]],
];
export const APPENDIX = [[640, 3470], [690, 3540], [760, 3590], [810, 3600]];

// Bones: clavicles, cut rib ends and the pelvic brim.
export const CLAVICLES = [
  [[1060, 1132], [900, 1120], [740, 1150], [600, 1200]],
  [[1140, 1132], [1300, 1120], [1460, 1150], [1600, 1200]],
];
export const PELVIS = [
  [[560, 3200], [620, 3360], [700, 3520], [820, 3640], [960, 3700], [1060, 3712]],
  [[1640, 3200], [1580, 3360], [1500, 3520], [1380, 3640], [1240, 3700], [1140, 3712]],
];

export const LABELS = [
  { text: 'Right lung', x: 700, y: 1600 }, { text: 'Left lung', x: 1560, y: 1560 }, { text: 'Heart', x: 1290, y: 1960 },
  { text: 'Trachea', x: 1020, y: 1260 }, { text: 'Thyroid', x: 1220, y: 1040 }, { text: 'Liver', x: 860, y: 2160 },
  { text: 'Gallbladder', x: 940, y: 2560 }, { text: 'Spleen', x: 1730, y: 2440 }, { text: 'Pancreas', x: 1380, y: 2760 },
  { text: 'Transverse colon', x: 1010, y: 2800 }, { text: 'Descending colon', x: 1640, y: 3060 },
  { text: 'Sigmoid colon', x: 1420, y: 3520 }, { text: 'Appendix', x: 800, y: 3640 }, { text: 'Bladder', x: 1100, y: 3560 },
  { text: 'Diaphragm', x: 1000, y: 2120 },
];

// Where a zone's name is shown, as a fraction of the zone's route.
export const ZONE_LABELS = [
  { zone: 'stomach', at: 0.22, text: 'Oesophagus' }, { zone: 'stomach', at: 0.78, text: 'Stomach' },
  { zone: 'si', at: 0.55, text: 'Small intestine' }, { zone: 'colon', at: 0.5, text: 'Caecum and ascending colon' },
  { zone: 'liver', at: 0.55, text: 'Liver (portal vein)' }, { zone: 'core', at: 0.4, text: 'Rib marrow' },
];

export function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Catmull-Rom spline through points [x, y, (w)], sampled every ~step world units.
export function spline(pts, step = 8, closed = false) {
  const n = pts.length;
  const out = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[closed ? (i + 2) % n : Math.min(n - 1, i + 2)];
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const k = Math.max(2, Math.ceil(len / step));
    for (let j = 0; j < k; j++) {
      const t = j / k, t2 = t * t, t3 = t2 * t;
      const c = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t2 + (-a + 3 * b - 3 * c2 + d) * t3);
      const q = [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])];
      if (p1.length > 2) q.push(p1[2] + (p2[2] - p1[2]) * t);
      out.push(q);
    }
  }
  if (!closed) out.push(pts[n - 1].slice());
  return out;
}
