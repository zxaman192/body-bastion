import { Scene, buildingView, rangeFor, rangeColor } from './render/scene.js';
import { siteAnchorIso } from './render/buildings.js';
import { textLabel } from './render/shapes.js';

export function mountBaseView(container, opts = {}) {
  const gd = opts.gd;
  let layout = opts.layout || {};
  let coreLevel = opts.coreLevel || 1;
  let editable = !!opts.editable;
  let highlight = new Set(opts.highlightSites || []);
  let showRanges = !!opts.showRanges;
  const onSiteTap = opts.onSiteTap || null;

  container.classList.add('bb-baseview');
  const scene = new Scene(container, gd, {
    insets: { top: 10, right: 10, bottom: 10, left: 10 },
    onTap: (x, y) => {
      if (!onSiteTap) return;
      const id = scene.siteAt(x, y);
      if (id) onSiteTap(id);
    },
  });
  const geom = scene.geom;
  let buildings = [];
  let rangeCache = new Map();

  function rebuild() {
    buildings = [];
    for (const site of geom.siteList) {
      const e = layout[site.id];
      if (!e || typeof e !== 'object') continue;
      const v = buildingView(geom, gd, e, site.id);
      if (v) buildings.push(v);
    }
    for (const b of buildings) b.selected = highlight.has(b.info.id);
    rangeCache = new Map();
  }

  function ranges() {
    const out = [];
    const focus = highlight.size ? buildings.filter((b) => highlight.has(b.info.id)) : buildings;
    for (const b of focus) {
      const r = rangeFor(gd, b);
      if (!r) continue;
      const key = b.info.id + ':' + r;
      let iv = rangeCache.get(key);
      if (!iv) {
        iv = geom.rangeIntervals(b.info.x, b.info.y, r);
        rangeCache.set(key, iv);
      }
      const col = rangeColor(gd, b);
      out.push({ intervals: iv, color: highlight.size ? col + 'aa' : col + '33' });
    }
    return out;
  }

  rebuild();
  let raf = 0;
  let last = performance.now();
  let alive = true;

  function frame(now) {
    if (!alive) return;
    const dt = Math.min(100, now - last);
    last = now;
    if (document.hidden) {
      raf = requestAnimationFrame(frame);
      return;
    }
    scene.begin(dt);
    const moat = buildings.find((b) => b.key === 'acid_moat');
    const peri = buildings.find((b) => b.key === 'peristalsis');
    scene.drawLumenEffects({
      moat: moat ? { s0: moat.def.s0, s1: moat.def.s1, strength: 0.7 } : null,
      peri: peri ? { s0: peri.def.s0, s1: peri.def.s1, period: 3200 } : null,
    });
    if (showRanges) scene.drawRanges(ranges());
    scene.drawMouth(0.2);
    const items = scene.buildingItems(buildings, { t: scene.t, gd, showPips: true, showHp: false });
    if (editable) {
      const empty = geom.siteList.filter((s) => !layout[s.id]).map((s) => geom.sites.get(s.id));
      items.push(...scene.slotMarkerItems(empty, '#ffffff'));
      for (const id of highlight) {
        const info = geom.sites.get(id);
        if (info && !layout[id]) {
          items.push({ depth: info.x + info.y + 1, order: 3, draw: (ctx) => {
            const a = siteAnchorIso(geom, info);
            textLabel(ctx, 'Selected', a.x, a.y - 40, { size: 12, color: '#2a0f1f', bg: '#ffd34d' });
          } });
        }
      }
    }
    scene.drawItems(items);
    scene.drawLabels();
    scene.end();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    update(newLayout, o = {}) {
      if (newLayout) layout = newLayout;
      if (o.coreLevel) coreLevel = o.coreLevel;
      if (o.highlightSites) highlight = new Set(o.highlightSites);
      if (o.showRanges !== undefined) showRanges = !!o.showRanges;
      if (o.editable !== undefined) editable = !!o.editable;
      rebuild();
    },
    focusSite(id) { scene.focusSite(id); },
    fit() { scene.fit(); },
    get coreLevel() { return coreLevel; },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      scene.destroy();
      container.classList.remove('bb-baseview');
    },
  };
}
