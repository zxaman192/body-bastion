// Display geometry. The simulation runs on an abstract route (gamedata map.path, in "game space");
// the renderer shows it on a real human torso (anatomy.js, "display space"). Positions along the gut
// map 1:1 by zone, building sites are placed beside their organ, and range checks stay in game space.
import { ROUTE, CAVITY, MOUTH, ZONE_LABELS, BODY, pointInPoly, spline } from './anatomy.js';

// Height of standing objects' base above the drawn surface.
export const GROUND_H = 2;
export const RIM_H = 0;
export const WALL_W = 14;

// Top-down (anterior) view: the body is drawn like an anatomy atlas plate; buildings stand up off it.
export function toIso(x, y) {
  return { x: x * 0.5, y: y * 0.5 };
}

export function fromIso(ix, iy) {
  return { x: ix * 2, y: iy * 2 };
}

export function hash01(a, b = 0, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

const geomCache = new WeakMap();

export function buildGeom(gd) {
  if (gd && geomCache.has(gd)) return geomCache.get(gd);
  const g = makeGeom(gd);
  if (gd) geomCache.set(gd, g);
  return g;
}

function makeGeom(gd) {
  const map = (gd && gd.map) || {};
  const T = map.tile || 100;
  const path = Array.isArray(map.path) && map.path.length >= 2 ? map.path : [[0, 0], [1, 0]];
  // ---------------------------------------------------------------- game space (simulation geometry)
  const P = path.map((p) => ({ x: p[0] * T, y: p[1] * T }));
  const S = [0];
  for (let i = 0; i < P.length - 1; i++) S.push(S[i] + Math.abs(P[i + 1].x - P[i].x) + Math.abs(P[i + 1].y - P[i].y));
  const len = S[S.length - 1];
  const zones = Array.isArray(map.zones) && map.zones.length ? map.zones
    : [{ key: 'core', name: 'Core', s0: 0, s1: len + 1, color: '#dccbef' }];

  function segIndex(s) {
    for (let i = 0; i < P.length - 1; i++) if (s <= S[i + 1]) return i;
    return P.length - 2;
  }
  function gamePosAt(s) {
    const c = clamp(s, 0, len);
    const i = segIndex(c);
    const a = P[i], b = P[i + 1];
    const off = c - S[i];
    return { x: a.x + Math.sign(b.x - a.x) * off, y: a.y + Math.sign(b.y - a.y) * off };
  }
  function gameNearestS(x, y) {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      const segLen = S[i + 1] - S[i];
      if (segLen <= 0) continue;
      let off = a.y === b.y ? (x - a.x) * Math.sign(b.x - a.x) : (y - a.y) * Math.sign(b.y - a.y);
      off = clamp(off, 0, segLen);
      const px = a.x + Math.sign(b.x - a.x) * off, py = a.y + Math.sign(b.y - a.y) * off;
      const d = (px - x) ** 2 + (py - y) ** 2;
      if (d < bestD) { bestD = d; best = S[i] + off; }
    }
    return best;
  }
  // Path intervals within r of a game-space point: identical to the simulation's coverage.
  function rangeIntervals(px, py, r) {
    const out = [];
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      const horiz = a.y === b.y;
      const d = horiz ? a.y - py : a.x - px;
      const rem = r * r - d * d;
      if (rem < 0) continue;
      const w = Math.sqrt(rem);
      const c = horiz ? px : py;
      const ac = horiz ? a.x : a.y, bc = horiz ? b.x : b.y;
      const lo = Math.max(c - w, Math.min(ac, bc));
      const hi = Math.min(c + w, Math.max(ac, bc));
      if (lo > hi) continue;
      const s1 = bc > ac ? S[i] + (lo - ac) : S[i] + (ac - lo);
      const s2 = bc > ac ? S[i] + (hi - ac) : S[i] + (ac - hi);
      out.push([Math.min(s1, s2), Math.max(s1, s2)]);
    }
    out.sort((p, q) => p[0] - q[0]);
    const merged = [];
    for (const iv of out) {
      const last = merged[merged.length - 1];
      if (last && iv[0] <= last[1] + 1) last[1] = Math.max(last[1], iv[1]);
      else merged.push([iv[0], iv[1]]);
    }
    return merged;
  }

  function zoneOf(s) {
    for (const z of zones) if (s >= z.s0 && s < z.s1) return z;
    return zones[zones.length - 1];
  }
  function zoneByKey(k) {
    return zones.find((z) => z.key === k) || null;
  }

  // ---------------------------------------------------------------- display route along the body
  const samples = [];
  for (const z of zones) {
    const pts = ROUTE[z.key];
    if (!pts) continue;
    const dense = spline(pts, 6);
    let L = 0;
    const cum = [0];
    for (let i = 1; i < dense.length; i++) {
      L += Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]);
      cum.push(L);
    }
    const s0 = z.s0, s1 = Math.min(z.s1, len);
    for (let i = 0; i < dense.length; i++) {
      samples.push({ x: dense[i][0], y: dense[i][1], w: dense[i][2] || 36, s: s0 + (L > 0 ? (cum[i] / L) * (s1 - s0) : 0), zone: z.key });
    }
  }
  if (samples.length < 2) samples.push({ x: 0, y: 0, w: 30, s: 0, zone: 'core' }, { x: 100, y: 0, w: 30, s: len, zone: 'core' });

  function sampleIndex(s) {
    let lo = 0, hi = samples.length - 1;
    if (s <= samples[0].s) return 0;
    if (s >= samples[hi].s) return hi - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (samples[mid].s <= s) lo = mid; else hi = mid;
    }
    return lo;
  }
  function interp(s) {
    const c = clamp(s, 0, len);
    const i = sampleIndex(c);
    const a = samples[i], b = samples[Math.min(samples.length - 1, i + 1)];
    const k = b.s > a.s ? (c - a.s) / (b.s - a.s) : 0;
    return { a, b, k };
  }
  function posAt(s) {
    const { a, b, k } = interp(s);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  }
  function dirAt(s) {
    const p = posAt(Math.max(0, s - 4)), q = posAt(Math.min(len, s + 4));
    const dx = q.x - p.x, dy = q.y - p.y;
    const l = Math.hypot(dx, dy) || 1;
    return { dx: dx / l, dy: dy / l };
  }
  function lumenHalf(s) {
    const { a, b, k } = interp(s);
    return a.w + (b.w - a.w) * k;
  }
  function nearestS(x, y) {
    let best = 0, bestD = Infinity;
    for (const p of samples) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) { bestD = d; best = p.s; }
    }
    return { s: best, dist: Math.sqrt(bestD) };
  }

  // ---------------------------------------------------------------- building sites beside their organs
  const siteList = Array.isArray(map.sites) ? map.sites : [];
  const sites = new Map();
  const placed = [];
  const inside = (x, y, m) => pointInPoly(x, y, CAVITY) && pointInPoly(x - m, y, CAVITY) && pointInPoly(x + m, y, CAVITY)
    && pointInPoly(x, y - m, CAVITY) && pointInPoly(x, y + m, CAVITY);
  const coarse = samples.filter((_, i) => i % 4 === 0);
  function clearOfRoute(x, y, gap) {
    for (const p of coarse) {
      const need = p.w + WALL_W + gap;
      if ((p.x - x) ** 2 + (p.y - y) ** 2 < need * need) return false;
    }
    return true;
  }
  function nearestZone(x, y) {
    let best = null, bestD = Infinity;
    for (const p of coarse) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) { bestD = d; best = p.zone; }
    }
    return best;
  }
  function clearOfSites(x, y, gap) {
    for (const q of placed) if ((q.x - x) ** 2 + (q.y - y) ** 2 < (gap + q.extra) ** 2) return false;
    return true;
  }
  // Grid search around the target point: close to it, beside the right organ, clear of the gut and
  // of other sites, inside the operative field.
  function place(target, zoneKey, extra) {
    const t = posAt(target);
    for (const [routeGap, siteGap, radius] of [[60, 178, 760], [40, 160, 900], [22, 140, 1100], [8, 118, 1400]]) {
      let best = null, bestScore = Infinity;
      for (let gx = -radius; gx <= radius; gx += 32) {
        for (let gy = -radius; gy <= radius; gy += 32) {
          const dd = Math.hypot(gx, gy);
          if (dd > radius) continue;
          const x = t.x + gx, y = t.y + gy;
          const score = dd;
          if (score >= bestScore) continue;
          if (!inside(x, y, 64) || !clearOfSites(x, y, siteGap + extra) || !clearOfRoute(x, y, routeGap)) continue;
          const zonePenalty = nearestZone(x, y) === zoneKey ? 0 : 260;
          if (score + zonePenalty < bestScore) { bestScore = score + zonePenalty; best = { x, y }; }
        }
      }
      if (best) return best;
    }
    return { x: t.x + 140, y: t.y + placed.length * 7 };
  }
  // the Core sits where the route ends; everything else is placed in route order around it
  const order = siteList.map((site, idx) => ({ site, idx })).sort((a, b) => {
    const ka = a.site.kind === 'core' ? -1 : 0, kb = b.site.kind === 'core' ? -1 : 0;
    return ka - kb || a.idx - b.idx;
  });
  for (const { site, idx } of order) {
    const lumen = typeof site.s === 'number';
    let x, y, s = null, gx, gy;
    if (lumen) {
      s = site.s;
      const p = posAt(s);
      x = p.x; y = p.y;
      const gp = gamePosAt(s);
      gx = gp.x; gy = gp.y;
    } else {
      gx = (site.x || 0) * T;
      gy = (site.y || 0) * T;
      if (site.kind === 'core') {
        const e = posAt(len);
        x = e.x + 10; y = e.y - 30;
        placed.push({ x, y, extra: 60 });
      } else {
        let target = gameNearestS(gx, gy);
        if (site.kind === 'moat') target = 650;
        if (site.kind === 'peristalsis') target = 1900;
        const zk = site.zone || zoneOf(target).key;
        const zz = zoneByKey(zk);
        if (zz) target = clamp(target, zz.s0 + 40, Math.min(zz.s1, len) - 40);
        const p = place(target, zk, site.kind === 'moat' || site.kind === 'peristalsis' ? 25 : 0);
        x = p.x; y = p.y;
        placed.push({ x, y, extra: site.kind === 'moat' || site.kind === 'peristalsis' ? 25 : 0 });
      }
    }
    sites.set(site.id, { site, idx, id: site.id, kind: site.kind, zone: site.zone, x, y, s, inLumen: lumen, gx, gy });
  }

  function isoBounds(points, padX, padTop, padBottom) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of points) {
      const q = toIso(p.x, p.y);
      if (q.x < x0) x0 = q.x;
      if (q.x > x1) x1 = q.x;
      if (q.y < y0) y0 = q.y;
      if (q.y > y1) y1 = q.y;
    }
    return { x0: x0 - padX, y0: y0 - padTop, x1: x1 + padX, y1: y1 + padBottom };
  }
  const contentPts = samples.filter((_, i) => i % 6 === 0).map((p) => ({ x: p.x, y: p.y }));
  for (const v of sites.values()) contentPts.push({ x: v.x, y: v.y });
  contentPts.push({ x: MOUTH.x, y: MOUTH.y - 60 });
  const contentBounds = isoBounds(contentPts, 60, 90, 50);
  const groundBounds = isoBounds(BODY.map((p) => ({ x: p[0], y: p[1] })).concat([{ x: 0, y: 0 }, { x: 2200, y: 4100 }]), 60, 20, 40);

  function labelAnchors() {
    const out = [];
    for (const l of ZONE_LABELS) {
      const z = zoneByKey(l.zone);
      if (!z) continue;
      const s = z.s0 + (Math.min(z.s1, len) - z.s0) * l.at;
      const p = posAt(s);
      const d = dirAt(s);
      const w = lumenHalf(s) + WALL_W + 34;
      out.push({ key: l.zone, text: l.text, x: p.x - d.dy * w, y: p.y + d.dx * w, lift: 0, color: z.color });
    }
    return out;
  }

  return {
    T, P, S, len, zones, posAt, dirAt, nearestS, zoneOf, zoneByKey, lumenHalf, sites, siteList, samples,
    rangeIntervals, gamePosAt, contentBounds, groundBounds, labelAnchors, mouth: { x: MOUTH.x, y: MOUTH.y },
  };
}

export function siteAnchor(geom, siteId) {
  const v = geom.sites.get(siteId);
  if (!v) return null;
  const q = toIso(v.x, v.y);
  return { x: q.x, y: q.y - (v.inLumen ? 0 : GROUND_H), lumen: v.inLumen, info: v };
}

export class Camera {
  constructor() {
    this.scale = 0.3;
    this.ox = 0;
    this.oy = 0;
    this.minScale = 0.05;
    this.maxScale = 4;
    this.fitScale = 0.3;
    this.anim = null;
  }

  isoToScreen(ix, iy) {
    return { x: ix * this.scale + this.ox, y: iy * this.scale + this.oy };
  }

  screenToIso(sx, sy) {
    return { x: (sx - this.ox) / this.scale, y: (sy - this.oy) / this.scale };
  }

  fit(b, vw, vh, ins = {}, fill = 1) {
    const l = ins.left || 0, r = ins.right || 0, t = ins.top || 0, bo = ins.bottom || 0;
    const aw = Math.max(40, vw - l - r), ah = Math.max(40, vh - t - bo);
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    const s0 = Math.min(aw / bw, ah / bh);
    // fill > 1 zooms in past "contain" (tall phone screens), never past "cover"
    const s = fill > 1 ? Math.min(s0 * fill, Math.max(aw / bw, ah / bh)) : s0;
    this.fitScale = s0;
    this.minScale = s0 * 0.6;
    this.maxScale = Math.max(s0 * 7, 2.4);
    this.scale = s;
    this.ox = l + aw / 2 - ((b.x0 + b.x1) / 2) * s;
    this.oy = t + ah / 2 - ((b.y0 + b.y1) / 2) * s;
    this.anim = null;
  }

  zoomAt(f, sx, sy) {
    const ns = clamp(this.scale * f, this.minScale, this.maxScale);
    const p = this.screenToIso(sx, sy);
    this.scale = ns;
    this.ox = sx - p.x * ns;
    this.oy = sy - p.y * ns;
    this.anim = null;
  }

  pan(dx, dy) {
    this.ox += dx;
    this.oy += dy;
    this.anim = null;
  }

  clampTo(b, vw, vh) {
    const cx0 = b.x0 * this.scale + this.ox, cx1 = b.x1 * this.scale + this.ox;
    const cy0 = b.y0 * this.scale + this.oy, cy1 = b.y1 * this.scale + this.oy;
    const mx = Math.min(vw * 0.5, (cx1 - cx0) * 0.5);
    const my = Math.min(vh * 0.5, (cy1 - cy0) * 0.5);
    if (cx1 < mx) this.ox += mx - cx1;
    if (cx0 > vw - mx) this.ox -= cx0 - (vw - mx);
    if (cy1 < my) this.oy += my - cy1;
    if (cy0 > vh - my) this.oy -= cy0 - (vh - my);
  }

  animateTo(ix, iy, scale, vw, vh, ins = {}) {
    const l = ins.left || 0, r = ins.right || 0, t = ins.top || 0, bo = ins.bottom || 0;
    const s = clamp(scale, this.minScale, this.maxScale);
    const ox = l + (vw - l - r) / 2 - ix * s;
    const oy = t + (vh - t - bo) / 2 - iy * s;
    this.anim = { from: { scale: this.scale, ox: this.ox, oy: this.oy }, to: { scale: s, ox, oy }, t: 0, dur: 450 };
  }

  update(dt) {
    if (!this.anim) return;
    const a = this.anim;
    a.t += dt;
    const k = clamp(a.t / a.dur, 0, 1);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    this.scale = a.from.scale + (a.to.scale - a.from.scale) * e;
    this.ox = a.from.ox + (a.to.ox - a.from.ox) * e;
    this.oy = a.from.oy + (a.to.oy - a.from.oy) * e;
    if (k >= 1) this.anim = null;
  }
}

export function formatTime(ticks, tps = 10) {
  const sec = Math.max(0, Math.ceil(ticks / tps));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}
