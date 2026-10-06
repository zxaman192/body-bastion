export const GROUND_H = 10;

export function toIso(x, y) {
  return { x: (x - y) * 0.5, y: (x + y) * 0.25 };
}

export function fromIso(ix, iy) {
  return { x: ix + 2 * iy, y: 2 * iy - ix };
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

export function buildGeom(gd) {
  const map = (gd && gd.map) || {};
  const T = map.tile || 100;
  const W = map.width || 24;
  const H = map.height || 15;
  const path = Array.isArray(map.path) && map.path.length >= 2 ? map.path : [[0, 0], [1, 0]];
  const P = path.map((p) => ({ x: p[0] * T, y: p[1] * T }));
  const S = [0];
  for (let i = 0; i < P.length - 1; i++) {
    S.push(S[i] + Math.abs(P[i + 1].x - P[i].x) + Math.abs(P[i + 1].y - P[i].y));
  }
  const len = S[S.length - 1];
  const zones = Array.isArray(map.zones) ? map.zones : [];

  function segIndex(s) {
    for (let i = 0; i < P.length - 1; i++) if (s <= S[i + 1]) return i;
    return P.length - 2;
  }

  function posAt(s) {
    const c = clamp(s, 0, len);
    const i = segIndex(c);
    const a = P[i], b = P[i + 1];
    const off = c - S[i];
    return { x: a.x + Math.sign(b.x - a.x) * off, y: a.y + Math.sign(b.y - a.y) * off };
  }

  function dirAt(s) {
    const i = segIndex(clamp(s, 0, len));
    const a = P[i], b = P[i + 1];
    return { dx: Math.sign(b.x - a.x), dy: Math.sign(b.y - a.y) };
  }

  function nearestS(x, y) {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      const segLen = S[i + 1] - S[i];
      if (segLen <= 0) continue;
      let off;
      if (a.y === b.y) off = (x - a.x) * Math.sign(b.x - a.x);
      else off = (y - a.y) * Math.sign(b.y - a.y);
      off = clamp(off, 0, segLen);
      const px = a.x + Math.sign(b.x - a.x) * off;
      const py = a.y + Math.sign(b.y - a.y) * off;
      const d = (px - x) * (px - x) + (py - y) * (py - y);
      if (d < bestD) { bestD = d; best = S[i] + off; }
    }
    return { s: best, dist: Math.sqrt(bestD) };
  }

  function zoneOf(s) {
    for (const z of zones) if (s >= z.s0 && s < z.s1) return z;
    return zones.length ? zones[zones.length - 1] : { key: 'core', name: 'Core', s0: 0, s1: len + 1, color: '#dccbef' };
  }

  function zoneByKey(k) {
    return zones.find((z) => z.key === k) || null;
  }

  const sites = new Map();
  const siteList = Array.isArray(map.sites) ? map.sites : [];
  siteList.forEach((site, idx) => {
    let x, y, s = null;
    if (typeof site.s === 'number') {
      const p = posAt(site.s);
      x = p.x; y = p.y; s = site.s;
    } else {
      x = (site.x || 0) * T; y = (site.y || 0) * T;
    }
    const inLumen = s !== null;
    sites.set(site.id, { site, idx, id: site.id, kind: site.kind, zone: site.zone, x, y, s, inLumen });
  });

  const pathTiles = [];
  const pathSet = new Map();
  for (let s = 0; s <= len; s += T) {
    const p = posAt(s);
    const i = Math.round(p.x / T), j = Math.round(p.y / T);
    const key = i + ',' + j;
    if (!pathSet.has(key)) {
      const z = zoneOf(Math.min(s, len));
      const t = { i, j, s, zone: z.key, color: z.color };
      pathSet.set(key, t);
      pathTiles.push(t);
    }
  }

  function isPath(i, j) {
    return pathSet.has(i + ',' + j);
  }

  function nearestPathTile(i, j) {
    let best = null, bd = Infinity;
    for (const t of pathTiles) {
      const d = (t.i - i) * (t.i - i) + (t.j - j) * (t.j - j);
      if (d < bd) { bd = d; best = t; }
    }
    return { tile: best, dist: Math.sqrt(bd) };
  }

  function rangeIntervals(px, py, r) {
    const out = [];
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      if (a.y === b.y) {
        const d = a.y - py;
        const rem = r * r - d * d;
        if (rem < 0) continue;
        const w = Math.sqrt(rem);
        const lo = Math.max(px - w, Math.min(a.x, b.x));
        const hi = Math.min(px + w, Math.max(a.x, b.x));
        if (lo > hi) continue;
        const s1 = b.x > a.x ? S[i] + (lo - a.x) : S[i] + (a.x - lo);
        const s2 = b.x > a.x ? S[i] + (hi - a.x) : S[i] + (a.x - hi);
        out.push([Math.min(s1, s2), Math.max(s1, s2)]);
      } else {
        const d = a.x - px;
        const rem = r * r - d * d;
        if (rem < 0) continue;
        const w = Math.sqrt(rem);
        const lo = Math.max(py - w, Math.min(a.y, b.y));
        const hi = Math.min(py + w, Math.max(a.y, b.y));
        if (lo > hi) continue;
        const s1 = b.y > a.y ? S[i] + (lo - a.y) : S[i] + (a.y - lo);
        const s2 = b.y > a.y ? S[i] + (hi - a.y) : S[i] + (a.y - hi);
        out.push([Math.min(s1, s2), Math.max(s1, s2)]);
      }
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

  const contentPts = P.slice();
  for (const v of sites.values()) contentPts.push({ x: v.x, y: v.y });
  contentPts.push({ x: P[0].x - T, y: P[0].y });
  const contentBounds = isoBounds(contentPts, 70, 150, 50);
  const groundBounds = isoBounds(
    [{ x: -T / 2, y: -T / 2 }, { x: W * T - T / 2, y: -T / 2 }, { x: W * T - T / 2, y: H * T - T / 2 }, { x: -T / 2, y: H * T - T / 2 }],
    0, 20, 60,
  );

  function labelAnchors() {
    const out = [];
    for (const z of zones) {
      let s;
      if (z.key === 'core') {
        const core = siteList.find((x) => x.kind === 'core');
        if (core) {
          out.push({ key: z.key, text: z.name, x: core.x * T, y: core.y * T, lift: 150, color: z.color });
          continue;
        }
        s = Math.min(len, (z.s0 + Math.min(z.s1, len)) / 2);
      } else s = (z.s0 + Math.min(z.s1, len)) / 2;
      const p = posAt(s);
      const text = z.key === 'liver' ? 'Liver gate / portal route' : z.name;
      out.push({ key: z.key, text, x: p.x, y: p.y, lift: 70, color: z.color });
    }
    return out;
  }

  return {
    T, W, H, P, S, len, zones, posAt, dirAt, nearestS, zoneOf, zoneByKey, sites, siteList,
    pathTiles, isPath, nearestPathTile, rangeIntervals, contentBounds, groundBounds, labelAnchors,
    mouth: { x: P[0].x - T * 0.62, y: P[0].y },
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

  fit(b, vw, vh, ins = {}) {
    const l = ins.left || 0, r = ins.right || 0, t = ins.top || 0, bo = ins.bottom || 0;
    const aw = Math.max(40, vw - l - r), ah = Math.max(40, vh - t - bo);
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    const s = Math.min(aw / bw, ah / bh);
    this.fitScale = s;
    this.minScale = s * 0.75;
    this.maxScale = Math.max(s * 6, 2.2);
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
