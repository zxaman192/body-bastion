import { Battle } from './sim.js';
import { Scene, buildingDefs, rangeFor, rangeColor } from './render/scene.js';
import { FX, drawOverlays, domeShimmer } from './render/fx.js';
import { drawUnit, unitColor, drawUnitIcon } from './render/units.js';
import { buildingTop, siteAnchorIso } from './render/buildings.js';
import { toIso, formatTime } from './render/geom.js';
import { audio } from './audio.js';

const TICK_MS = 100;

function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else e.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const k of kids.flat()) {
    if (k === null || k === undefined || k === false) continue;
    e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return e;
}

function lookup(arr, key = 'key') {
  return new Map((arr || []).map((x) => [x[key], x]));
}

function plural(n, w) {
  return `${n} ${w}${n === 1 ? '' : 's'}`;
}

export function mountBattle(container, props = {}) {
  const gd = props.gd;
  const setup = props.setup;
  const mode = props.mode === 'replay' ? 'replay' : props.mode === 'campaign' ? 'campaign' : 'attack';
  const defence = setup && setup.mode === 'campaign';
  const realtimeOnly = mode === 'attack' || !!props.scored;
  const units = lookup(gd.units);
  const drugs = lookup(gd.drugs);
  const defs = buildingDefs(gd);
  const spells = lookup(gd.spells);
  const hydMax = gd.hydrationMax || 100000;
  const tps = gd.tps || 10;

  const root = el('div', { class: `bb-battle bb-mode-${mode}` });
  const stage = el('div', { class: 'bb-stage' });
  root.append(stage);
  container.append(root);

  let battle = null;
  let preview = null;
  let phase = mode === 'campaign' ? 'prep' : mode === 'attack' ? 'intro' : 'run';
  let paused = false;
  let speed = 1;
  let acc = 0;
  let last = performance.now();
  let raf = 0;
  let alive = true;
  let finished = false;
  let overShown = false;
  let targetingSpell = null;
  let sheetSite = null;
  let mouthOpen = 0;
  let flushPulse = 0;
  let lastHydFrac = 1;
  let replayCmds = [];
  const prevS = new Map();
  const hurtAt = new Map();
  const bviews = new Map();
  const rangeCache = new Map();
  const fx = new FX();

  const scene = new Scene(stage, gd, {
    insets: { top: 76, right: 12, bottom: mode === 'replay' ? 70 : 118, left: 12 },
    onTap: (x, y) => onMapTap(x, y),
  });
  const geom = scene.geom;
  const pathLen = geom.len;

  function newBattle() {
    const b = new Battle(gd, setup);
    if (mode === 'replay') {
      replayCmds = Array.isArray(props.commands) ? props.commands.slice() : [];
      if (typeof b.loadCommands === 'function') b.loadCommands(replayCmds);
    }
    return b;
  }
  battle = newBattle();

  // ---------------------------------------------------------------- HUD
  const hydFill = el('div', { class: 'bb-hyd-fill' });
  const hydText = el('span', { class: 'bb-hyd-text' }, '100%');
  const hydBar = el('div', { class: 'bb-hyd', role: 'meter', 'aria-label': 'Hydration', 'aria-valuemin': '0', 'aria-valuemax': '100' },
    hydFill, el('div', { class: 'bb-hyd-mark', title: 'Below 25% is severe dehydration: ORS cannot keep up, IV fluids are needed' }), hydText);
  const timerEl = el('div', { class: 'bb-stat bb-timer', title: 'Time left' }, '3:00');
  const pctEl = el('div', { class: 'bb-stat', title: 'Base destroyed' }, '0%');
  const starsEl = el('div', { class: 'bb-stars', 'aria-label': 'Stars' }, el('span', null, '☆'), el('span', null, '☆'), el('span', null, '☆'));
  const resEl = el('div', { class: 'bb-stat bb-res' });
  const soundBtn = el('button', { class: 'bb-icon', type: 'button', title: 'Sound on/off', 'aria-label': 'Toggle sound', onclick: () => {
    audio.setMuted(!audio.muted);
    audio.unlock();
    paintSound();
    if (!audio.muted) audio.music(true);
  } });
  const pauseBtn = el('button', { class: 'bb-icon', type: 'button', title: 'Pause', 'aria-label': 'Pause', onclick: () => togglePause() });
  const speedBtn = el('button', { class: 'bb-pill', type: 'button', title: 'Speed', onclick: () => cycleSpeed() }, 'x1');
  const exitBtn = el('button', { class: 'bb-icon bb-exit', type: 'button', title: 'Leave', 'aria-label': 'Leave battle', onclick: () => requestExit() }, '✕');
  const titleEl = el('div', { class: 'bb-title' }, el('strong', null, props.title || (props.level && props.level.title) || 'Battle'),
    el('small', null, mode === 'replay' ? 'Replay' : defence ? (setup.patient === 'child' ? 'Defend the gut - child patient' : setup.patient === 'adult' ? 'Defend the gut - adult patient' : 'Defend the gut') : 'Attack: break the bastion'));
  const top = el('div', { class: 'bb-top' },
    exitBtn, titleEl,
    el('div', { class: 'bb-top-stats' }, hydBar, timerEl, mode === 'attack' || (mode === 'replay' && !defence) ? pctEl : null,
      mode === 'attack' || (mode === 'replay' && !defence) ? starsEl : null, defence ? resEl : null),
    el('div', { class: 'bb-top-ctl' }, mode !== 'attack' && !realtimeOnly ? speedBtn : null, mode !== 'attack' ? pauseBtn : null, soundBtn));
  root.append(top);

  const ticker = el('div', { class: 'bb-ticker', 'aria-live': 'polite' });
  root.append(ticker);
  const bottom = el('div', { class: 'bb-bottom' });
  root.append(bottom);
  const side = el('div', { class: 'bb-side' });
  root.append(side);
  const sheet = el('div', { class: 'bb-sheet', hidden: true, role: 'dialog', 'aria-modal': 'false' });
  root.append(sheet);
  const overlay = el('div', { class: 'bb-overlay', hidden: true });
  root.append(overlay);

  function paintSound() {
    soundBtn.textContent = audio.muted ? '\u{1F507}' : '\u{1F50A}';
  }
  paintSound();

  // ---------------------------------------------------------------- ticker
  const tickerSeen = new Map();
  function say(text, kind = 'info', key = text, gap = 6000) {
    const now = performance.now();
    if (now - (tickerSeen.get(key) || -1e9) < gap) return;
    tickerSeen.set(key, now);
    const item = el('div', { class: `bb-tick bb-tick-${kind}` }, text);
    ticker.prepend(item);
    while (ticker.children.length > 4) ticker.lastChild.remove();
    setTimeout(() => { item.classList.add('fade'); }, 5200);
    setTimeout(() => { item.remove(); }, 6000);
  }

  // ---------------------------------------------------------------- state views
  function shown() {
    return phase === 'prep' && preview ? preview : battle;
  }

  function buildingView(b) {
    let v = bviews.get(b.idx);
    const info = geom.sites.get(b.site);
    if (!v || v.key !== b.key) {
      v = { info, key: b.key, def: defs.get(b.key), shake: 0, selected: false };
      bviews.set(b.idx, v);
    }
    v.lv = b.lv;
    v.hp = b.hp;
    v.maxHp = b.maxHp;
    v.alive = b.alive;
    v.drug = b.drug;
    v.rx = b.rx;
    v.selected = sheetSite === b.site;
    return v;
  }

  function currentBuildings(src) {
    const out = [];
    for (const b of src.buildings) {
      if (!b || b.removed) continue;
      out.push(buildingView(b));
    }
    return out;
  }

  function destruction(src) {
    let total = 0;
    let down = 0;
    let coreDown = false;
    for (const b of src.buildings) {
      if (!b || b.removed) continue;
      const d = defs.get(b.key);
      if (d && d.cat !== 'wall') {
        total++;
        if (!b.alive) down++;
      }
      if (b.key === 'core' && !b.alive) coreDown = true;
    }
    const pct = src.collapsed ? 100 : total ? Math.floor((down * 100) / total) : 0;
    return { pct, coreDown: coreDown || src.collapsed, stars: src.collapsed ? 3 : (pct >= 50) + (coreDown ? 1 : 0) + (pct === 100 ? 1 : 0) };
  }

  function unitWorld(u, alpha) {
    const p0 = prevS.has(u.id) ? prevS.get(u.id) : u.s;
    const s = p0 + (u.s - p0) * alpha;
    if (s >= pathLen) {
      const end = geom.posAt(pathLen);
      const ang = (u.id * 2.399) % (Math.PI * 2);
      const r = 30 + (u.id % 4) * 14;
      return { x: end.x - 40 + Math.cos(ang) * r, y: end.y + Math.sin(ang) * r * 0.8, s, dir: -1 };
    }
    const p = geom.posAt(s);
    const d = geom.dirAt(s);
    const lat = (((u.id * 7919) % 9) - 4) * 7;
    const dir = toIso(d.dx, d.dy).x;
    return { x: p.x - d.dy * lat, y: p.y + d.dx * lat, s, dir: dir === 0 ? 1 : Math.sign(dir) };
  }

  function unitIso(u, alpha = 1) {
    const w = unitWorld(u, alpha);
    const q = toIso(w.x, w.y);
    return { x: q.x, y: q.y, depth: w.x + w.y, dir: w.dir, s: w.s };
  }

  // ---------------------------------------------------------------- events
  function handleEvents(src) {
    const bl = src.buildings;
    for (const ev of src.events || []) {
      switch (ev.type) {
        case 'shot': {
          const b = bl[ev.b];
          const u = src.units[ev.u];
          if (!b || !u) break;
          const v = buildingView(b);
          const from = buildingTop(geom, v.info, b.key);
          const to = unitIso(u);
          if (b.cat === 'battery') {
            const dd = drugs.get(b.drug);
            const wasted = ev.letter === 'N';
            fx.projectile('drug', from, to, dd ? dd.color : '#ffffff', { wasted });
            if (wasted) {
              fx.text(to.x, to.y - 18, 'wasted', '#c9c9c9', 900, to.depth + 2, 11);
              say(`${dd ? dd.name.split(' (')[0] : 'Drug'} wasted on ${units.get(u.type).name} - it cannot kill it`, 'warn', `w:${b.drug}:${u.type}`);
              audio.play('wasted');
            } else {
              if (ev.letter === 'X') say(`${dd ? dd.name.split(' (')[0] : 'Drug'} hits ${units.get(u.type).name} a little, but it is not the right treatment`, 'warn', `x:${b.drug}:${u.type}`, 9000);
              else if (units.get(u.type).antibioticsNotNeeded) say(`Antibiotics are not needed for ${units.get(u.type).name} - ORS is the treatment`, 'warn', `nn:${u.type}`, 9000);
              audio.play('zap');
            }
          } else if (b.key === 'iga_cannon') {
            fx.projectile('antibody', from, to, '#ffffff');
            audio.play('thunk');
          } else if (b.key === 'paneth_tower') {
            fx.projectile('spark', from, to, '#ffe066', { life: 180 });
            audio.play('tick');
          } else {
            fx.projectile('blob', from, to, b.key === 'kupffer_gate' ? '#ff8a7a' : '#9fd0ff');
            audio.play('squish');
          }
          hurtAt.set(u.id, performance.now());
          break;
        }
        case 'splash': {
          const b = bl[ev.b];
          if (!b) break;
          const v = buildingView(b);
          const a = siteAnchorIso(geom, v.info);
          fx.ring(a.x, a.y, 10, ((defs.get(b.key) || {}).range || 240) * 0.62, '#ffffff', 520, v.info.x + v.info.y + 5);
          for (const id of ev.units || []) {
            const u = src.units[id];
            if (!u) continue;
            const p = unitIso(u);
            fx.burst(p.x, p.y - 8, '#ffffff', 4, 360, p.depth + 1, 30);
            hurtAt.set(id, performance.now());
          }
          audio.play('squish');
          break;
        }
        case 'hit': {
          const b = bl[ev.b];
          if (!b) break;
          const v = buildingView(b);
          v.shake = 1;
          if (Math.random() < 0.3) {
            const a = siteAnchorIso(geom, v.info);
            fx.burst(a.x, a.y - 14, '#e6c3a3', 3, 320, v.info.x + v.info.y + 3, 26);
          }
          break;
        }
        case 'kill': {
          const u = src.units[ev.u];
          if (!u) break;
          const p = unitIso(u);
          fx.burst(p.x, p.y - 10, unitColor(gd, u.type), 9, 560, p.depth + 1);
          audio.play('pop');
          if (u.type === 'amoeba') say('Amoeba Blob died - but it left a cyst behind. A luminal agent clears cysts.', 'info', 'cyst', 15000);
          break;
        }
        case 'bdown': {
          const b = bl[ev.b];
          if (!b) break;
          const v = buildingView(b);
          const a = siteAnchorIso(geom, v.info);
          fx.burst(a.x, a.y - 20, '#b48a6c', 16, 900, v.info.x + v.info.y + 5, 70);
          fx.puff(a.x, a.y - 10, 'rgba(90,60,50,0.9)', 900, v.info.x + v.info.y + 6, 22);
          fx.quake(b.key === 'core' ? 10 : 5);
          audio.play('crumble');
          const name = defs.get(b.key) ? defs.get(b.key).name : 'Building';
          if (b.key === 'core') say('The Bone Marrow Core has fallen!', 'bad', 'core', 1e9);
          else if (b.key === 'flora_garden') say('Gut Flora Garden lost - colonisation resistance is gone', 'bad', `fl:${b.site}`);
          else if (b.key === 'kupffer_gate') say('Kupffer Cell Gate breached - germs can reach the core', 'bad', 'kupf');
          else if (defence) say(`${name} destroyed`, 'bad', `bd:${b.site}`);
          break;
        }
        case 'spawn': {
          const u = src.units[ev.u];
          if (!u) break;
          if (u.s <= 0) mouthOpen = 1;
          if (u.type === 'cdiff' || u.type === 'candida' || u.type === 'amoeba_cyst') {
            const p = unitIso(u);
            fx.puff(p.x, p.y - 6, u.type === 'cdiff' ? 'rgba(204,121,167,0.9)' : u.type === 'candida' ? 'rgba(240,228,66,0.9)' : 'rgba(230,159,0,0.9)', 800, p.depth + 1, 16);
            if (u.type === 'candida') say('Candida overgrew where the flora was lost', 'bad', 'candida', 12000);
          } else if (mode === 'attack') {
            audio.play('deploy');
          }
          break;
        }
        case 'flush': {
          const b = bl[ev.b];
          const d = b ? defs.get(b.key) : null;
          if (d) {
            const pts = [];
            for (let s = d.s0; s <= Math.min(d.s1, pathLen); s += 60) {
              const p = geom.posAt(s);
              pts.push(toIso(p.x, p.y));
            }
            fx.wave(pts, '#ff9fb4', 1200);
          }
          flushPulse = 1;
          audio.play('flush');
          break;
        }
        case 'acid': {
          for (let k = 0; k < 2; k++) {
            const p = geom.posAt(Math.random() * 950);
            const q = toIso(p.x, p.y);
            fx.bubbles(q.x, q.y, '#d6ff6a', 900, p.x + p.y);
          }
          audio.play('acid');
          break;
        }
        case 'collapse':
          fx.flashScreen('#ff2a3a', 0.7);
          fx.quake(12);
          say('The base collapsed from dehydration - towers cannot save a dried-out gut', 'bad', 'collapse', 1e9);
          break;
        case 'stopflow': {
          const trapped = src.units.some((u) => u.alive && (units.get(u.type).tags || []).includes('trapped'));
          say(trapped ? 'Stop-Flow (loperamide) on: invasive germs are trapped inside and grow stronger!' : 'Stop-Flow (loperamide) on: stool output falls, but fluid is still lost',
            trapped ? 'bad' : 'info', 'sf' + src.tick, 0);
          audio.play('alarm');
          break;
        }
        case 'spell': {
          const p = geom.posAt(ev.s);
          const q = toIso(p.x, p.y);
          const sp = spells.get(ev.k);
          fx.ring(q.x, q.y, 10, (sp && sp.radius ? sp.radius : 300) * 0.7, ev.k === 'biofilm_dome' ? '#8fe3ff' : ev.k === 'quorum_sensing' ? '#d6ff3d' : ev.k === 'immune_evasion' ? '#ffffff' : '#6fb3ff', 900, p.x + p.y + 5);
          fx.text(q.x, q.y - 20, sp ? sp.name : ev.k, '#ffffff', 1300, 1e9, 13);
          audio.play('spell');
          break;
        }
        case 'cdiff': {
          const p = geom.posAt(ev.s);
          const q = toIso(p.x, p.y);
          fx.puff(q.x, q.y, 'rgba(204,121,167,0.95)', 1200, p.x + p.y + 3, 26);
          say('C. difficile appeared - broad-spectrum antibiotics wiped out the gut flora', 'bad', 'cdiff', 12000);
          audio.play('alarm');
          break;
        }
        case 'iv': {
          const b = bl[ev.b];
          if (b) {
            const v = buildingView(b);
            const a = buildingTop(geom, v.info, b.key);
            fx.drops(a.x, a.y, '#6fc3ff', 1500, v.info.x + v.info.y + 4);
          }
          say("IV Ringer's lactate started - severe dehydration needs IV fluids", 'good', 'iv', 8000);
          audio.play('iv');
          break;
        }
        default:
          break;
      }
    }
  }

  // ---------------------------------------------------------------- stepping
  function stepOnce() {
    if (mode === 'replay' && typeof battle.loadCommands !== 'function') {
      for (const c of replayCmds) if (c.t === battle.tick) battle.command(c);
    }
    prevS.clear();
    for (const u of battle.units) if (u.alive) prevS.set(u.id, u.s);
    battle.step();
    handleEvents(battle);
    const frac = battle.hydration / hydMax;
    if (lastHydFrac >= 0.25 && frac < 0.25) {
      say('Severe dehydration! ORS alone cannot keep up now', 'bad', 'severe', 15000);
      audio.play('alarm');
    }
    lastHydFrac = frac;
    if (battle.units.some((u) => u.alive && u.type === 'typhoid' && u.s >= 4000)) say('Typhoid has reached the liver gate', 'bad', 'ty-liver', 20000);
  }

  function liveTick() {
    return phase === 'run' && !paused && !battle.over;
  }

  // ---------------------------------------------------------------- render
  function frame(now) {
    if (!alive) return;
    let dt = now - last;
    last = now;
    if (dt > 250) dt = 250;
    if (document.hidden) dt = 0;
    if (liveTick()) {
      acc += dt * speed;
      let n = 0;
      while (acc >= TICK_MS && !battle.over && n < 12) {
        stepOnce();
        acc -= TICK_MS;
        n++;
      }
      if (battle.over) acc = 0;
    }
    const alpha = liveTick() ? Math.min(1, acc / TICK_MS) : 1;
    fx.update(dt);
    mouthOpen = Math.max(0, mouthOpen - dt / 600);
    flushPulse = Math.max(0, flushPulse - dt / 900);
    for (const v of bviews.values()) v.shake = Math.max(0, v.shake - dt / 260);
    draw(alpha, dt);
    paintHud();
    if (battle.over && !overShown && phase === 'run') showOver();
    raf = requestAnimationFrame(frame);
  }

  function draw(alpha, dt) {
    const src = shown();
    const ctx = scene.begin(dt);
    if (fx.shake > 0) {
      const s = fx.shake;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    const tick = src.tick;
    const blds = currentBuildings(src);
    const moat = blds.find((b) => b.key === 'acid_moat' && b.alive);
    const peri = blds.find((b) => b.key === 'peristalsis' && b.alive);
    const stopflow = tick < src.stopflowUntil;
    const ppi = tick < src.ppiUntil;
    scene.drawLumenEffects({
      moat: moat ? { s0: moat.def.s0, s1: moat.def.s1, strength: ppi ? 0.3 : 1 } : null,
      peri: peri && !stopflow ? { s0: peri.def.s0, s1: peri.def.s1, period: 2600 } : null,
      flushPulse,
    });
    if (src.dome && tick < src.dome.until) {
      const pts = [];
      for (let s = Math.max(0, src.dome.s0); s <= Math.min(pathLen, src.dome.s1); s += 40) {
        const p = geom.posAt(s);
        pts.push(toIso(p.x, p.y));
      }
      domeShimmer(ctx, pts, scene.t);
    }
    if (sheetSite) {
      const b = src.buildings[geom.sites.get(sheetSite).idx];
      if (b && b.alive && !b.removed) {
        const r = rangeFor(gd, b);
        if (r) {
          const k = `${sheetSite}:${r}`;
          let iv = rangeCache.get(k);
          if (!iv) {
            const info = geom.sites.get(sheetSite);
            iv = geom.rangeIntervals(info.x, info.y, r);
            rangeCache.set(k, iv);
          }
          scene.drawRanges([{ intervals: iv, color: rangeColor(gd, b) + '99' }]);
        }
      }
    }
    if (targetingSpell) {
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(scene.t * 6);
      scene.drawRanges([{ intervals: [[0, pathLen]], color: '#ffffff' }]);
      ctx.restore();
    }
    scene.drawMouth(Math.max(mouthOpen, 0.15));
    const items = scene.buildingItems(blds, { t: scene.t, gd, showPips: true, showHp: true });
    if (defence && mode !== 'replay' && !battle.over) {
      const empty = buildableSites(src);
      items.push(...scene.slotMarkerItems(empty, phase === 'prep' ? '#ffffff' : '#ffd34d'));
    }
    let fever = 0;
    for (const u of src.units) {
      if (!u.alive) continue;
      const ud = units.get(u.type);
      if (u.type === 'typhoid') fever = 1;
      const p = unitIso(u, phase === 'run' ? alpha : 1);
      const tags = ud.tags || [];
      const o = {
        key: u.type, x: p.x, y: p.y, dir: p.dir, id: u.id, t: scene.t, color: unitColor(gd, u.type),
        moving: u.state === 'move', attacking: u.state === 'attack',
        neutralised: tick < u.neutralisedUntil, invisible: tick < u.invisibleUntil, quorum: tick < u.quorumUntil,
        trapped: stopflow && tags.includes('trapped'), vaccinated: u.vaccinated, overgrowth: u.overgrowth,
        hurt: performance.now() - (hurtAt.get(u.id) || -1e9) < 250, fever: u.type === 'typhoid',
        showHp: true, hpFrac: u.maxHp > 0 ? u.hp / u.maxHp : 1,
      };
      if (u.type === 'worm') {
        const segs = [];
        for (let k = 0; k < 7; k++) {
          const w = geom.posAt(Math.max(0, p.s - k * 26));
          const q = toIso(w.x, w.y);
          segs.push({ x: q.x, y: q.y });
        }
        o.segments = segs;
      }
      items.push({ depth: p.depth, order: 2, draw: (c) => drawUnit(c, o) });
    }
    items.push(...fx.depthItems(scene.t));
    scene.drawItems(items);
    scene.drawLabels();
    const c2 = scene.end();
    drawOverlays(c2, scene.vw, scene.vh, { fx, hydrationFrac: src.hydration / hydMax, fever, stopflow, t: scene.t });
  }

  function paintHud() {
    const src = shown();
    const frac = Math.max(0, src.hydration / hydMax);
    const pct = Math.round(frac * 100);
    hydFill.style.width = pct + '%';
    hydFill.className = 'bb-hyd-fill' + (frac < 0.25 ? ' bad' : frac < 0.5 ? ' warn' : '');
    hydText.textContent = `Hydration ${pct}%`;
    hydBar.setAttribute('aria-valuenow', String(pct));
    timerEl.textContent = formatTime(Math.max(0, (battle.maxTicks || gd.maxTicks) - src.tick), tps);
    if (pctEl.isConnected || starsEl.isConnected) {
      const d = destruction(src);
      pctEl.textContent = `${d.pct}%`;
      [...starsEl.children].forEach((s, i) => { s.textContent = i < d.stars ? '★' : '☆'; s.classList.toggle('on', i < d.stars); });
    }
    if (defence) resEl.textContent = `ATP ${src.atp}` + (setup.campaign ? `  •  Budget ${src.budget}` : '');
    pauseBtn.textContent = paused ? '▶' : '⏸';
    pauseBtn.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
    speedBtn.textContent = `x${speed}`;
    paintBottomLive();
  }

  // ---------------------------------------------------------------- campaign building
  function aliveCount(src, key) {
    let n = 0;
    for (const b of src.buildings) if (b && b.alive && !b.removed && b.key === key) n++;
    return n;
  }

  function buildOptionsFor(src, siteId) {
    const info = geom.sites.get(siteId);
    if (!info || !setup.campaign) return [];
    const lv = (setup.defender && setup.defender.coreLevel) || 1;
    const out = [];
    for (const key of setup.campaign.allowed || []) {
      const d = defs.get(key);
      if (!d) continue;
      if (!(d.sites || []).includes(info.kind)) continue;
      if (d.zones && !d.zones.includes(info.zone)) continue;
      const max = (d.maxCount || [])[lv - 1] || 0;
      const have = aliveCount(src, key);
      out.push({ key, def: d, cost: d.cost[0], full: have >= max, max, have, afford: d.cost[0] <= src.budget });
    }
    return out;
  }

  function buildableSites(src) {
    if (!setup.campaign) return [];
    const out = [];
    for (const site of geom.siteList) {
      const b = src.buildings[geom.sites.get(site.id).idx];
      if (b && b.alive && !b.removed) continue;
      if (buildOptionsFor(src, site.id).length) out.push(geom.sites.get(site.id));
    }
    return out;
  }

  function refreshPreview() {
    if (phase !== 'prep') return;
    preview = new Battle(gd, setup);
    for (const c of battle.commands) preview.command({ ...c });
    preview.step();
    preview.events = [];
  }

  function sendCommand(cmd) {
    const ok = battle.command(cmd);
    if (ok) {
      audio.play('build');
      if (phase === 'prep') refreshPreview();
    }
    return ok;
  }

  function closeSheet() {
    sheet.hidden = true;
    sheet.replaceChildren();
    sheetSite = null;
    if (phase === 'run' && mode === 'campaign' && autoPaused) {
      paused = false;
      autoPaused = false;
    }
  }
  let autoPaused = false;

  function openSheet(siteId) {
    const src = shown();
    sheetSite = siteId;
    if (phase === 'run' && !paused) {
      paused = true;
      autoPaused = true;
    }
    const info = geom.sites.get(siteId);
    const b = src.buildings[info.idx];
    const zone = (geom.zoneByKey(info.zone) || {}).name || info.zone;
    sheet.replaceChildren();
    const head = el('div', { class: 'bb-sheet-head' }, el('strong', null, `Site ${siteId}`), el('span', { class: 'bb-muted' }, ` • ${zone}`),
      el('button', { class: 'bb-icon', type: 'button', 'aria-label': 'Close', onclick: () => closeSheet() }, '✕'));
    sheet.append(head);
    if (b && b.alive && !b.removed) {
      const d = defs.get(b.key);
      sheet.append(el('div', { class: 'bb-sheet-body' },
        el('h3', null, `${d.name} (level ${b.lv})`),
        el('p', { class: 'bb-muted' }, `Health ${b.hp} / ${b.maxHp}`),
        b.key === 'drug_battery' ? el('p', null, `Drug: ${(drugs.get(b.drug) || {}).name || b.drug}`) : null,
        el('p', { class: 'bb-small' }, d.desc || '')));
      const actions = el('div', { class: 'bb-sheet-actions' });
      if (b.key === 'drug_battery') actions.append(el('button', { class: 'bb-btn', type: 'button', onclick: () => rxEditor(siteId, b.drug, b.rx, (rx) => { sendCommand({ c: 'rx', site: siteId, rx }); closeSheet(); }) }, 'Change prescription'));
      if (b.key !== 'core') {
        const refund = Math.floor((d.cost[0] * ((gd.economy && gd.economy.campaignSellRefundPct) || 50)) / 100);
        actions.append(el('button', { class: 'bb-btn bb-danger', type: 'button', onclick: () => { sendCommand({ c: 'sell', site: siteId }); say(`${d.name} removed (+${refund} budget)`, 'info', 'sell' + siteId + src.tick, 0); closeSheet(); } }, `Remove (+${refund})`));
      }
      sheet.append(actions);
    } else {
      const opts = buildOptionsFor(src, siteId);
      const list = el('div', { class: 'bb-build-list' });
      if (!opts.length) list.append(el('p', { class: 'bb-muted' }, 'Nothing in this case can be built on this site.'));
      for (const o of opts) {
        const disabled = o.full || !o.afford;
        list.append(el('button', { class: 'bb-build', type: 'button', disabled, onclick: () => {
          if (o.key === 'drug_battery') {
            drugPicker(siteId);
          } else {
            sendCommand({ c: 'build', site: siteId, b: o.key });
            closeSheet();
          }
        } },
        el('strong', null, o.def.name),
        el('span', { class: 'bb-cost' }, `${o.cost} budget`),
        el('small', null, o.full ? `Limit reached (${o.max})` : !o.afford ? 'Not enough budget' : (o.def.desc || '').split('. ')[0] + '.')));
      }
      sheet.append(el('div', { class: 'bb-sheet-body' }, el('p', { class: 'bb-muted bb-small' }, `Budget left: ${src.budget}`), list));
    }
    sheet.hidden = false;
  }

  function drugPicker(siteId) {
    sheet.replaceChildren(el('div', { class: 'bb-sheet-head' }, el('strong', null, 'Choose the drug'),
      el('button', { class: 'bb-icon', type: 'button', 'aria-label': 'Close', onclick: () => closeSheet() }, '✕')));
    const list = el('div', { class: 'bb-build-list' });
    for (const k of setup.campaign.allowedDrugs || []) {
      const d = drugs.get(k);
      if (!d) continue;
      list.append(el('button', { class: 'bb-build', type: 'button', style: { borderLeft: `6px solid ${d.color}` }, onclick: () => {
        rxEditor(siteId, k, [], (rx) => {
          sendCommand({ c: 'build', site: siteId, b: 'drug_battery', drug: k, rx });
          closeSheet();
        });
      } }, el('strong', null, d.name), el('small', null, d.cls)));
    }
    sheet.append(el('div', { class: 'bb-sheet-body' }, list));
  }

  function rxEditor(siteId, drugKey, current, done) {
    const d = drugs.get(drugKey) || { name: drugKey };
    const checks = new Map();
    const grid = el('div', { class: 'bb-rx' });
    for (const u of gd.units) {
      const cb = el('input', { type: 'checkbox' });
      cb.checked = (current || []).includes(u.key);
      checks.set(u.key, cb);
      grid.append(el('label', { class: 'bb-rx-item' }, cb, el('span', { class: 'bb-dot', style: { background: unitColor(gd, u.key) } }), u.name));
    }
    sheet.replaceChildren(
      el('div', { class: 'bb-sheet-head' }, el('strong', null, `Prescribe ${d.name.split(' (')[0]}`),
        el('button', { class: 'bb-icon', type: 'button', 'aria-label': 'Close', onclick: () => closeSheet() }, '✕')),
      el('div', { class: 'bb-sheet-body' },
        el('p', { class: 'bb-small bb-muted' }, 'Tick the germs this battery may fire at. Each shot costs ATP; the wrong germ wastes it and breeds resistance.'),
        grid,
        el('div', { class: 'bb-sheet-actions' }, el('button', { class: 'bb-btn bb-primary', type: 'button', onclick: () => {
          done(gd.units.map((u) => u.key).filter((k) => checks.get(k).checked));
        } }, 'Confirm'))));
  }

  // ---------------------------------------------------------------- input
  function onMapTap(x, y) {
    if (finished) return;
    if (mode === 'attack' && targetingSpell && phase === 'run') {
      const ns = scene.pathSAt(x, y);
      if (ns.dist > 220) {
        say('Tap on the gut to cast the spell', 'info', 'spelltap', 2500);
        return;
      }
      const s = Math.max(0, Math.min(pathLen, Math.round(ns.s)));
      if (battle.command({ c: 'spell', k: targetingSpell, s })) audio.play('click');
      targetingSpell = null;
      renderBottom();
      return;
    }
    if (defence && mode === 'campaign' && !battle.over) {
      const id = scene.siteAt(x, y);
      if (id) openSheet(id);
      else closeSheet();
    }
  }

  function togglePause() {
    if (mode === 'attack') return;
    paused = !paused;
    autoPaused = false;
    audio.play('click');
  }

  function cycleSpeed() {
    if (realtimeOnly) return;
    const steps = mode === 'replay' ? [1, 2, 4, 8] : [1, 2, 4];
    speed = steps[(steps.indexOf(speed) + 1) % steps.length];
  }

  function requestExit() {
    if (finished) return;
    if (mode === 'replay' || battle.over) {
      cleanupAndExit();
      return;
    }
    confirmBox(mode === 'attack' ? 'Leave the battle? It counts as a surrender and nothing is gained.' : 'Leave this case? Your progress in it will be lost.', 'Leave', () => cleanupAndExit());
  }

  function cleanupAndExit() {
    finished = true;
    if (props.onExit) props.onExit();
  }

  function confirmBox(text, okLabel, onOk) {
    overlay.replaceChildren(el('div', { class: 'bb-dialog' }, el('p', null, text),
      el('div', { class: 'bb-sheet-actions' },
        el('button', { class: 'bb-btn', type: 'button', onclick: () => { overlay.hidden = true; } }, 'Cancel'),
        el('button', { class: 'bb-btn bb-danger', type: 'button', onclick: () => { overlay.hidden = true; onOk(); } }, okLabel))));
    overlay.hidden = false;
  }

  // ---------------------------------------------------------------- bottom bars
  const deployCards = new Map();
  let holdTimer = 0;
  let holdKey = null;

  function deployOne(key) {
    if (phase !== 'run' || battle.over) return false;
    const ok = battle.command({ c: 'deploy', u: key });
    if (!ok) return false;
    mouthOpen = 1;
    return true;
  }

  function stopHold() {
    clearTimeout(holdTimer);
    holdTimer = 0;
    holdKey = null;
  }

  function startHold(key) {
    stopHold();
    holdKey = key;
    const rep = () => {
      if (holdKey !== key) return;
      if (!deployOne(key)) { stopHold(); return; }
      holdTimer = setTimeout(rep, 220);
    };
    if (deployOne(key)) holdTimer = setTimeout(rep, 450);
  }

  function queuedCount(c, field, value) {
    let n = 0;
    for (const q of battle.commands) if (q.c === c && q[field] === value && q.t >= battle.tick) n++;
    return n;
  }

  function renderBottom() {
    bottom.replaceChildren();
    deployCards.clear();
    if (mode === 'replay') {
      bottom.append(el('div', { class: 'bb-bar' },
        el('button', { class: 'bb-btn', type: 'button', onclick: () => togglePause() }, 'Play / pause'),
        el('button', { class: 'bb-btn', type: 'button', onclick: () => restartReplay() }, 'Restart'),
        el('span', { class: 'bb-muted bb-small' }, 'Replays use the same deterministic simulation the server used to check the battle.')));
      return;
    }
    if (mode === 'attack') {
      if (phase === 'intro') {
        bottom.append(el('div', { class: 'bb-bar bb-intro' },
          el('div', { class: 'bb-small' }, el('strong', null, 'Scout the base. '), 'Germs enter at the mouth (top left). Tap a germ card to release it; hold to release several. Spells: tap the spell, then tap the gut.'),
          el('button', { class: 'bb-btn bb-primary bb-big', type: 'button', onclick: () => { phase = 'run'; last = performance.now(); audio.unlock(); audio.music(!audio.muted); renderBottom(); } }, 'Start battle')));
        return;
      }
      const bar = el('div', { class: 'bb-deploy', role: 'toolbar', 'aria-label': 'Your germ army' });
      const army = (setup.attacker && setup.attacker.army) || {};
      for (const u of gd.units) {
        if (!army[u.key]) continue;
        const cv = el('canvas', { width: 64, height: 64, class: 'bb-unit-cv', 'aria-hidden': 'true' });
        try {
          const c = cv.getContext('2d');
          drawUnitIcon(c, gd, u.key, 64, 0.5);
        } catch { /* icon is decorative */ }
        const count = el('span', { class: 'bb-count' }, '0');
        const card = el('button', { class: 'bb-card', type: 'button', style: { '--grp': unitColor(gd, u.key) }, 'aria-label': `Deploy ${u.name}` },
          cv, el('span', { class: 'bb-card-name' }, u.name.replace(/ (Wave|Swarm|Flood|Raider|Stalker|Blob|Driller|Titan)$/, '')), count);
        card.addEventListener('pointerdown', (e) => { e.preventDefault(); startHold(u.key); });
        card.addEventListener('pointerup', stopHold);
        card.addEventListener('pointerleave', stopHold);
        card.addEventListener('pointercancel', stopHold);
        card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); deployOne(u.key); } });
        deployCards.set(u.key, { card, count });
        bar.append(card);
      }
      const spellBar = el('div', { class: 'bb-spells' });
      for (const sp of gd.spells) {
        const n = ((setup.attacker && setup.attacker.spells) || {})[sp.key] || 0;
        if (!n) continue;
        const btn = el('button', { class: `bb-spell${targetingSpell === sp.key ? ' active' : ''}`, type: 'button', title: sp.desc, onclick: () => {
          if (sp.key === 'contaminated_water') {
            if (battle.command({ c: 'spell', k: sp.key, s: 0 })) audio.play('click');
            targetingSpell = null;
          } else {
            targetingSpell = targetingSpell === sp.key ? null : sp.key;
            if (targetingSpell) say(`${sp.name}: tap the gut where you want it`, 'info', 'sp' + sp.key, 3000);
          }
          renderBottom();
        } }, sp.name, el('span', { class: 'bb-count', 'data-spell': sp.key }, String(n)));
        spellBar.append(btn);
      }
      const end = el('button', { class: 'bb-btn bb-danger', type: 'button', onclick: () => confirmBox('End the battle now? Your score counts what you have achieved so far.', 'End battle', () => battle.command({ c: 'end' })) }, 'End');
      bottom.append(bar, el('div', { class: 'bb-bar' }, spellBar, end));
      return;
    }
    if (phase === 'prep') {
      const vacc = el('div', { class: 'bb-vacc' });
      for (const g of (setup.campaign && setup.campaign.allowedVaccines) || []) {
        const done = (preview ? preview.stats.vaccinated : []).includes(g);
        const name = (units.get(g) || {}).name || g;
        vacc.append(el('button', { class: `bb-btn${done ? ' bb-on' : ''}`, type: 'button', disabled: done, onclick: () => {
          if (sendCommand({ c: 'vaccinate', u: g })) say(`Vaccinated against ${name}`, 'good', 'vacc' + g, 0);
          renderBottom();
        } }, done ? `Vaccinated: ${name}` : `Vaccinate: ${name} (${setup.campaign.vaccineCost || 0})`));
      }
      bottom.append(el('div', { class: 'bb-bar bb-intro' },
        el('div', { class: 'bb-small' }, el('strong', null, 'Prepare your defence. '), 'Tap a glowing site to build. Batteries fire only at the germs you prescribe. Waves begin when you press Start.'),
        vacc,
        el('button', { class: 'bb-btn bb-primary bb-big', type: 'button', onclick: () => startCampaign() }, 'Start')));
      return;
    }
    const sfBtn = el('button', { class: 'bb-btn bb-stopflow', type: 'button', onclick: () => {
      if (setup.patient === 'child') {
        say('Antimotility drugs such as loperamide are never given to children with acute diarrhoea', 'warn', 'sfchild', 4000);
        return;
      }
      battle.command({ c: 'stopflow' });
    } }, 'Stop-Flow (loperamide)');
    sfBtn.dataset.role = 'stopflow';
    bottom.append(el('div', { class: 'bb-bar' }, sfBtn,
      el('span', { class: 'bb-muted bb-small bb-hint' }, 'Tap a site to build or remove; tap a battery to change its prescription.')));
  }

  function paintBottomLive() {
    if (mode === 'attack' && phase === 'run') {
      for (const [k, v] of deployCards) {
        const n = Math.max(0, (battle.armyLeft[k] || 0) - queuedCount('deploy', 'u', k));
        v.count.textContent = String(n);
        v.card.disabled = n <= 0 || battle.over;
      }
      bottom.querySelectorAll('[data-spell]').forEach((s) => {
        const k = s.dataset.spell;
        const n = Math.max(0, (battle.spellsLeft[k] || 0) - queuedCount('spell', 'k', k));
        s.textContent = String(n);
        s.parentElement.disabled = n <= 0 || battle.over;
      });
    } else if (mode === 'campaign' && phase === 'run') {
      const btn = bottom.querySelector('[data-role="stopflow"]');
      if (btn) {
        const t = battle.tick;
        if (setup.patient === 'child') {
          btn.textContent = 'Stop-Flow: never in children';
          btn.classList.add('bb-locked');
        } else if (t < battle.stopflowUntil) {
          btn.textContent = `Stop-Flow active ${Math.ceil((battle.stopflowUntil - t) / tps)}s`;
          btn.disabled = true;
        } else if (t < battle.stopflowReadyAt) {
          btn.textContent = `Stop-Flow ready in ${Math.ceil((battle.stopflowReadyAt - t) / tps)}s`;
          btn.disabled = true;
        } else {
          btn.textContent = 'Stop-Flow (loperamide)';
          btn.disabled = battle.over;
        }
      }
    }
  }

  function renderSide() {
    side.replaceChildren();
    if (!defence) return;
    const lv = props.level || {};
    const objs = Array.isArray(props.objectives) ? props.objectives : [];
    const details = el('details', { class: 'bb-brief', open: phase === 'prep' && window.innerWidth >= 640 ? true : null });
    details.append(el('summary', null, lv.title || 'The case'));
    if (lv.case) details.append(el('p', { class: 'bb-small' }, lv.case));
    if (objs.length) {
      details.append(el('p', { class: 'bb-small' }, el('strong', null, 'Stars:')));
      details.append(el('ol', { class: 'bb-objs' }, ...objs.map((o) => el('li', null, o.text || o.key))));
    }
    side.append(details);
  }

  function startCampaign() {
    phase = 'run';
    preview = null;
    closeSheet();
    last = performance.now();
    audio.unlock();
    audio.music(!audio.muted);
    renderBottom();
    renderSide();
  }

  function restartReplay() {
    battle = newBattle();
    bviews.clear();
    fx.clear();
    prevS.clear();
    overShown = false;
    overlay.hidden = true;
    phase = 'run';
    paused = false;
  }

  function showOver() {
    overShown = true;
    const r = battle.result || {};
    audio.music(false);
    let title;
    let sub;
    let good;
    if (defence) {
      good = !!r.survived;
      title = r.collapsed ? 'Collapsed from dehydration' : good ? 'The patient survived' : 'The Bone Marrow Core fell';
      sub = `Lowest hydration ${r.hydrationMinPct}%  •  ${plural(r.stats ? r.stats.unnecessary || 0 : 0, 'unnecessary antibiotic shot')}`;
    } else {
      good = (r.stars || 0) > 0;
      title = r.collapsed ? 'The base collapsed from dehydration!' : `${r.stars || 0} star${r.stars === 1 ? '' : 's'}`;
      sub = `${r.pct || 0}% destroyed`;
    }
    audio.play(good ? 'victory' : 'defeat');
    const stars = !defence ? el('div', { class: 'bb-big-stars' }, ...[0, 1, 2].map((i) => el('span', { class: i < (r.stars || 0) ? 'on' : '' }, '★'))) : null;
    const actions = el('div', { class: 'bb-sheet-actions' });
    if (mode === 'replay') {
      actions.append(el('button', { class: 'bb-btn', type: 'button', onclick: () => restartReplay() }, 'Watch again'),
        el('button', { class: 'bb-btn bb-primary', type: 'button', onclick: () => cleanupAndExit() }, 'Done'));
    } else {
      actions.append(el('button', { class: 'bb-btn bb-primary bb-big', type: 'button', onclick: () => finish() }, 'See results'));
    }
    overlay.replaceChildren(el('div', { class: `bb-dialog bb-over ${good ? 'good' : 'bad'}` }, el('h2', null, title), stars, el('p', null, sub), actions));
    overlay.hidden = false;
    if (mode !== 'replay') setTimeout(() => { if (!finished) finish(); }, 4500);
  }

  function finish() {
    if (finished) return;
    finished = true;
    if (props.onFinish) props.onFinish(battle.commands.slice(), battle.result);
  }

  // ---------------------------------------------------------------- go
  if (mode === 'campaign') refreshPreview();
  renderBottom();
  renderSide();
  const fitInsets = () => scene.setInsets({ top: top.offsetHeight + 6, bottom: bottom.offsetHeight + 8 });
  const hudRo = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fitInsets) : null;
  if (hudRo) {
    hudRo.observe(top);
    hudRo.observe(bottom);
  }
  fitInsets();
  const onKey = (e) => {
    if (e.key === 'Escape') {
      if (!sheet.hidden) closeSheet();
      else if (targetingSpell) { targetingSpell = null; renderBottom(); }
    } else if (e.key === ' ' && mode !== 'attack' && document.activeElement === document.body) {
      e.preventDefault();
      togglePause();
    }
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('pointerup', stopHold);
  raf = requestAnimationFrame(frame);
  if (window.__BB_DEBUG) {
    window.__bbBattle = {
      advance(n) {
        if (phase === 'intro') phase = 'run';
        if (phase === 'prep') startCampaign();
        for (let i = 0; i < n && !battle.over; i++) stepOnce();
        fx.update(16);
        draw(1, 16);
        paintHud();
        if (battle.over && !overShown) showOver();
        return battle.tick;
      },
      deploy(u) { return deployOne(u); },
      get battle() { return battle; },
      get phase() { return phase; },
    };
  }

  return {
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      if (hudRo) hudRo.disconnect();
      stopHold();
      audio.music(false);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerup', stopHold);
      scene.destroy();
      root.remove();
    },
    get battle() { return battle; },
  };
}
