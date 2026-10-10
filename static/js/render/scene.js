import { toIso, fromIso, GROUND_H, buildGeom, Camera, clamp } from './geom.js';
import {
  GroundCache, drawAcidSheen, drawPeristalsisBands, drawRangeIntervals, drawMouth, drawBackdrop, drawLumenFlow,
} from './map.js';
import { drawBuilding, drawBuildSlotMarker, siteAnchorIso, buildingHeight } from './buildings.js';
import { textLabel } from './shapes.js';
import { rgba } from './color.js';

const TAP_MOVE = 9;
const TAP_MS = 450;

export class Scene {
  constructor(container, gd, { insets, onTap, background, fillTall = false } = {}) {
    this.gd = gd;
    this.geom = buildGeom(gd);
    this.camera = new Camera();
    this.ground = new GroundCache(this.geom);
    this.insets = insets || { top: 8, right: 8, bottom: 8, left: 8 };
    this.onTap = onTap || null;
    this.background = background || null;
    this.fillTall = !!fillTall;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'bb-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d');
    container.append(this.canvas);
    this.container = container;
    this.dpr = 1;
    this.vw = 1;
    this.vh = 1;
    this.fitted = false;
    this.userMoved = false;
    this.pointers = new Map();
    this.pinch = null;
    this.drag = null;
    this.t = 0;
    this.destroyed = false;
    this._bind();
    this.resize();
    this.ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.resize()) : null;
    if (this.ro) this.ro.observe(container);
    else window.addEventListener('resize', this._onWinResize = () => this.resize());
  }

  setInsets(ins) {
    this.insets = { ...this.insets, ...ins };
    if (!this.userMoved) this.fit();
  }

  resize() {
    if (this.destroyed) return;
    const r = this.container.getBoundingClientRect();
    const vw = Math.max(1, Math.round(r.width));
    const vh = Math.max(1, Math.round(r.height));
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    if (vw === this.vw && vh === this.vh && dpr === this.dpr && this.fitted) return;
    this.vw = vw;
    this.vh = vh;
    this.dpr = dpr;
    this.canvas.width = Math.round(vw * dpr);
    this.canvas.height = Math.round(vh * dpr);
    this.canvas.style.width = vw + 'px';
    this.canvas.style.height = vh + 'px';
    if (!this.fitted || !this.userMoved) this.fit();
  }

  fit() {
    const ins = this.insets;
    const aw = this.vw - (ins.left || 0) - (ins.right || 0), ah = this.vh - (ins.top || 0) - (ins.bottom || 0);
    const fill = this.fillTall && ah > aw * 1.15 ? Math.min(2.3, (ah / aw) * 1.05) : 1;
    this.camera.fit(this.geom.contentBounds, this.vw, this.vh, this.insets, fill);
    if (fill > 1) {
      // centre the zoomed view on the Bone Marrow Core, keeping the map edge-to-edge
      const core = [...this.geom.sites.values()].find((v) => v.kind === 'core');
      const b = this.geom.contentBounds, c = this.camera, l = ins.left || 0;
      if (core) {
        const q = toIso(core.x, core.y);
        const want = l + aw / 2 - q.x * c.scale;
        const lo = l + aw - b.x1 * c.scale, hi = l - b.x0 * c.scale;
        c.ox = lo <= hi ? clamp(want, lo, hi) : want;
      }
    }
    this.fitted = true;
    this.userMoved = false;
  }

  focusIso(ix, iy, zoom = 1.8) {
    this.camera.animateTo(ix, iy, this.camera.fitScale * zoom, this.vw, this.vh, this.insets);
    this.userMoved = true;
  }

  focusSite(siteId, zoom = 1.8) {
    const info = this.geom.sites.get(siteId);
    if (!info) return;
    const a = siteAnchorIso(this.geom, info);
    this.focusIso(a.x, a.y - 20, zoom);
  }

  localPoint(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  worldAt(sx, sy) {
    const iso = this.camera.screenToIso(sx, sy);
    const w = fromIso(iso.x, iso.y + GROUND_H * 0.5);
    return { x: w.x, y: w.y, iso };
  }

  pathSAt(sx, sy) {
    const w = this.worldAt(sx, sy);
    return this.geom.nearestS(w.x, w.y);
  }

  siteAt(sx, sy, filter) {
    let best = null;
    let bestD = Infinity;
    const sc = this.camera.scale;
    for (const info of this.geom.sites.values()) {
      if (filter && !filter(info)) continue;
      const a = siteAnchorIso(this.geom, info);
      const p = this.camera.isoToScreen(a.x, a.y);
      const top = this.camera.isoToScreen(a.x, a.y - buildingHeight('drug_battery') * 0.6);
      const cx = p.x;
      const cy = (p.y + top.y) / 2;
      const rx = Math.max(20, 46 * sc);
      const ry = Math.max(22, (p.y - top.y) / 2 + 26 * sc);
      const dx = (sx - cx) / rx;
      const dy = (sy - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d < 1 && d < bestD) {
        bestD = d;
        best = info.id;
      }
    }
    return best;
  }

  _bind() {
    const cv = this.canvas;
    cv.style.touchAction = 'none';
    this._down = (e) => {
      cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
      const p = this.localPoint(e);
      this.pointers.set(e.pointerId, p);
      if (this.pointers.size === 1) {
        this.drag = { x: p.x, y: p.y, sx: p.x, sy: p.y, at: performance.now(), moved: false };
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
        if (this.drag) this.drag.moved = true;
      }
    };
    this._move = (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      const p = this.localPoint(e);
      this.pointers.set(e.pointerId, p);
      if (this.pointers.size >= 2 && this.pinch) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        if (this.pinch.d > 0) this.camera.zoomAt(d / this.pinch.d, cx, cy);
        this.camera.pan(cx - this.pinch.cx, cy - this.pinch.cy);
        this.pinch = { d, cx, cy };
        this.userMoved = true;
        return;
      }
      const dr = this.drag;
      if (!dr) return;
      if (!dr.moved && Math.hypot(p.x - dr.sx, p.y - dr.sy) > TAP_MOVE) dr.moved = true;
      if (dr.moved) {
        this.camera.pan(p.x - dr.x, p.y - dr.y);
        this.camera.clampTo(this.geom.contentBounds, this.vw, this.vh);
        this.userMoved = true;
      }
      dr.x = p.x;
      dr.y = p.y;
    };
    this._up = (e) => {
      const had = this.pointers.has(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (!had) return;
      const dr = this.drag;
      if (this.pointers.size === 0) this.drag = null;
      if (e.type === 'pointerup' && dr && !dr.moved && performance.now() - dr.at < TAP_MS && this.onTap) {
        const p = this.localPoint(e);
        this.onTap(p.x, p.y, e);
      }
    };
    this._wheel = (e) => {
      e.preventDefault();
      const p = this.localPoint(e);
      const f = Math.exp(-clamp(e.deltaY, -120, 120) * 0.0018);
      this.camera.zoomAt(f, p.x, p.y);
      this.camera.clampTo(this.geom.contentBounds, this.vw, this.vh);
      this.userMoved = true;
    };
    this._dbl = () => this.fit();
    cv.addEventListener('pointerdown', this._down);
    cv.addEventListener('pointermove', this._move);
    cv.addEventListener('pointerup', this._up);
    cv.addEventListener('pointercancel', this._up);
    cv.addEventListener('wheel', this._wheel, { passive: false });
    cv.addEventListener('dblclick', this._dbl);
  }

  begin(dtMs) {
    this.t += dtMs / 1000;
    this.camera.update(dtMs);
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.background) {
      ctx.fillStyle = this.background;
      ctx.fillRect(0, 0, this.vw, this.vh);
    } else {
      drawBackdrop(ctx, this.vw, this.vh, this.t);
    }
    const c = this.camera;
    this.ground.ensure(c.scale, this.dpr);
    ctx.setTransform(this.dpr * c.scale, 0, 0, this.dpr * c.scale, this.dpr * c.ox, this.dpr * c.oy);
    this.ground.draw(ctx);
    if (this.flow !== false) drawLumenFlow(ctx, this.geom, this.t, this.flowSpeed || 1);
    return ctx;
  }

  drawLumenEffects({ moat, peri, flushPulse = 0 }) {
    const ctx = this.ctx;
    if (moat) drawAcidSheen(ctx, this.geom, moat.s0, moat.s1, this.t, moat.strength);
    if (peri) drawPeristalsisBands(ctx, this.geom, peri.s0, peri.s1, this.t * (1 + flushPulse * 3), peri.period || 2600);
  }

  drawMouth(open) {
    return drawMouth(this.ctx, this.geom, this.t, open);
  }

  drawRanges(list) {
    for (const r of list) drawRangeIntervals(this.ctx, this.geom, r.intervals, r.color);
  }

  drawLabels() {
    const ctx = this.ctx;
    const size = Math.min(40, Math.max(12, 12.5 / this.camera.scale));
    for (const a of this.geom.labelAnchors()) {
      const q = toIso(a.x, a.y);
      textLabel(ctx, a.text, q.x, q.y - GROUND_H - a.lift * 0.6, { size, color: '#ffffff', bg: rgba('#2a0f1f', 0.7) });
    }
  }

  drawItems(items) {
    items.sort((a, b) => a.depth - b.depth || (a.order || 0) - (b.order || 0));
    for (const it of items) it.draw(this.ctx);
  }

  buildingItems(buildings, env) {
    const out = [];
    for (const b of buildings) {
      const info = b.info;
      if (!info) continue;
      out.push({ depth: info.y + (info.inLumen ? -20 : 0), order: 0, draw: (ctx) => drawBuilding(ctx, this.geom, b, env) });
    }
    return out;
  }

  slotMarkerItems(sites, color) {
    return sites.map((info) => ({
      depth: info.y - 30,
      order: -1,
      draw: (ctx) => drawBuildSlotMarker(ctx, this.geom, info, this.t, color),
    }));
  }

  end() {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    return this.ctx;
  }

  destroy() {
    this.destroyed = true;
    const cv = this.canvas;
    cv.removeEventListener('pointerdown', this._down);
    cv.removeEventListener('pointermove', this._move);
    cv.removeEventListener('pointerup', this._up);
    cv.removeEventListener('pointercancel', this._up);
    cv.removeEventListener('wheel', this._wheel);
    cv.removeEventListener('dblclick', this._dbl);
    if (this.ro) this.ro.disconnect();
    if (this._onWinResize) window.removeEventListener('resize', this._onWinResize);
    cv.remove();
  }
}

export function buildingView(geom, gd, entry, siteId, extra = {}) {
  const info = geom.sites.get(siteId);
  const defs = buildingDefs(gd);
  const d = defs.get(entry.b || entry.key);
  if (!info || !d) return null;
  const lv = entry.lv || 1;
  const levelPct = gd.levelPct || [100];
  const maxHp = d.cat === 'core' ? (d.hpByLevel || [1])[Math.min(lv, (d.hpByLevel || [1]).length) - 1] : Math.floor((d.hp * levelPct[lv - 1]) / 100);
  return {
    info, key: d.key, def: d, lv, hp: maxHp, maxHp, alive: true, drug: entry.drug || null, rx: entry.rx || [],
    shake: 0, selected: false, ...extra,
  };
}

const defCache = new WeakMap();
export function buildingDefs(gd) {
  let m = defCache.get(gd);
  if (!m) {
    m = new Map((gd.buildings || []).map((b) => [b.key, b]));
    defCache.set(gd, m);
  }
  return m;
}

export function rangeFor(gd, b) {
  const d = buildingDefs(gd).get(b.key);
  if (!d) return 0;
  if (d.cat === 'battery') {
    const drug = (gd.drugs || []).find((x) => x.key === b.drug);
    return drug ? drug.range : 0;
  }
  return d.range || 0;
}

export function rangeColor(gd, b) {
  if (b.key === 'drug_battery') {
    const drug = (gd.drugs || []).find((x) => x.key === b.drug);
    return drug ? drug.color : '#ffffff';
  }
  if (b.key === 'kupffer_gate') return '#ff8a7a';
  return '#9cc8ff';
}
