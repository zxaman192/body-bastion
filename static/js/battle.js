import { Battle } from './sim.js';
import { Scene, buildingDefs, rangeFor, rangeColor } from './render/scene.js';
import { FX, drawOverlays, domeShimmer } from './render/fx.js';
import { drawUnit, unitColor, drawUnitIcon } from './render/units.js';
import { buildingTop, siteAnchorIso } from './render/buildings.js';
import { toIso, formatTime } from './render/geom.js';
import { audio } from './audio.js';
import { pref, setPref } from './store.js';
import { termify } from './glossary.js';
import { liveObjective, wavePlan, buildingFacts, drugFacts, groupPlain } from './explain.js';
import { createCoach, missionSteps, shouldCoach, markMissionCoached } from './coach.js';

const TICK_MS = 100;
const BOOSTER_ICON = {
  heal: '\u{1F9EC}', quorum: '\u{1F4E2}', evasion: '\u{1F47B}', rehydrate: '\u{1F4A7}', complement: '\u{1F4A5}', neutralise: '\u{1F6E1}',
};
const STATUS_ICON = { ok: '•', done: '✓', fail: '✗', todo: '○' };
const STATUS_TEXT = { ok: 'on track', done: 'done', fail: 'missed', todo: 'not yet' };
const PRIORITY = { bad: 3, warn: 2, good: 1, info: 0 };

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

function shortName(name) {
  return String(name || '').split(' (')[0];
}

function factList(facts) {
  return el('dl', { class: 'bb-facts' }, ...facts.map((f) => [el('dt', null, f.k), el('dd', { class: f.warn ? 'warn' : null }, f.v)]));
}

function learnWhy(text, label = 'Learn why') {
  if (!text) return null;
  const p = el('p', { class: 'bb-small' });
  p.append(termify(text, { inline: false }));
  return el('details', { class: 'bb-why' }, el('summary', null, label), p);
}

function unitIconCanvas(gd, key, size = 44) {
  const cv = el('canvas', { width: size * 2, height: size * 2, class: 'bb-mini-cv', 'aria-hidden': 'true', style: { width: `${size}px`, height: `${size}px` } });
  try { drawUnitIcon(cv.getContext('2d'), gd, key, size * 2, 0.5); } catch { /* decorative */ }
  return cv;
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
  const level = props.level || null;
  const training = !!(level && level.training);
  const showStopflow = !props.mission || !!(level && level.stopflow);
  const quizOn = !(level && level.checkpoints === false) && pref('battle.quiz', true) !== false;
  const drugsAllowed = !!(setup.campaign && (setup.campaign.allowedDrugs || []).length) || !!(setup.defender && setup.defender.layout && Object.values(setup.defender.layout).some((e) => e && e.b === 'drug_battery'));
  const resistance = (setup.defender && setup.defender.resistance) || {};
  const plan = defence && setup.campaign ? wavePlan(gd, setup.campaign.waves, tps) : null;
  const objectives = Array.isArray(props.objectives) ? props.objectives : [];

  const root = el('div', { class: `bb-battle bb-mode-${mode}${training ? ' bb-training' : ''}` });
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
  let previewBuild = null;
  let mouthOpen = 0;
  let flushPulse = 0;
  let lastHydFrac = 1;
  let replayCmds = [];
  let quiz = null;
  let coach = null;
  let hintsShown = 0;
  let panelKind = null;
  let tipsOn = pref('battle.tips', true) !== false;
  const cpAsked = new Set();
  const seenTypes = new Set();
  const boosterDefs = ((gd.boosters || {})[defence ? 'defence' : 'attack']) || [];
  const checkpointDefs = (gd.boosters || {}).checkpoints || [];
  const prevS = new Map();
  const hurtAt = new Map();
  const bviews = new Map();
  const rangeCache = new Map();
  const fx = new FX();
  const history = [];

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

  // Wave announcements: three seconds before each scripted wave.
  const waveTimes = [];
  if (plan) {
    plan.waves.forEach((w, i) => waveTimes.push({ ...w, i, warnAt: Math.max(0, w.t - 3 * tps) }));
  }

  // ---------------------------------------------------------------- HUD
  const hydFill = el('div', { class: 'bb-hyd-fill' });
  const hydText = el('span', { class: 'bb-hyd-text' }, '100%');
  const hydBar = el('div', { class: 'bb-hyd', role: 'meter', 'aria-label': 'Patient hydration', 'aria-valuemin': '0', 'aria-valuemax': '100', title: 'Patient hydration. Germs past the stomach drain it; at zero the patient collapses. Below the white line (25%) only IV fluids can catch up.' },
    hydFill, el('div', { class: 'bb-hyd-mark' }), hydText);
  const coreEl = el('div', { class: 'bb-stat bb-core', title: 'Bone Marrow Core health: if it falls, the mission is lost' });
  const timerEl = el('div', { class: 'bb-stat bb-timer', title: 'Time left' }, '3:00');
  const pctEl = el('div', { class: 'bb-stat', title: 'Share of the base destroyed (walls do not count)' }, '0%');
  const starsEl = el('div', { class: 'bb-stars', 'aria-label': 'Stars' }, el('span', null, '☆'), el('span', null, '☆'), el('span', null, '☆'));
  const budgetEl = el('button', { class: 'bb-stat bb-res bb-res-btn', type: 'button', title: 'What is the budget?', onclick: () => explainResource('budget') });
  const atpEl = el('button', { class: 'bb-stat bb-res bb-res-btn', type: 'button', title: 'What is drug ATP?', onclick: () => explainResource('atp') });
  const soundBtn = el('button', { class: 'bb-icon', type: 'button', title: 'Sound on/off', 'aria-label': 'Toggle sound', onclick: () => {
    audio.setMuted(!audio.muted);
    audio.unlock();
    paintSound();
    if (!audio.muted) audio.music(true);
  } });
  const msgCount = el('span', { class: 'bb-badge', hidden: true });
  const msgBtn = el('button', { class: 'bb-icon bb-msg-btn', type: 'button', title: 'Messages', 'aria-label': 'Messages and tips', onclick: () => togglePanel('msgs') }, '\u{1F4AC}', msgCount);
  const pauseBtn = el('button', { class: 'bb-icon', type: 'button', title: 'Pause', 'aria-label': 'Pause', onclick: () => togglePause() });
  const speedBtn = el('button', { class: 'bb-pill', type: 'button', title: 'Game speed', 'aria-label': 'Game speed', onclick: () => cycleSpeed() }, 'x1');
  const exitBtn = el('button', { class: 'bb-icon bb-exit', type: 'button', title: 'Leave', 'aria-label': 'Leave battle', onclick: () => requestExit() }, '✕');
  const subtitle = mode === 'replay' ? 'Replay'
    : props.missionNumber ? `Mission ${props.missionNumber}${level && level.chapter ? ` · ${level.chapter}` : ''}`
      : defence ? (setup.patient === 'child' ? 'Defend the gut - child patient' : setup.patient === 'adult' ? 'Defend the gut - adult patient' : 'Defend the gut') : 'Raid: break the bastion';
  const titleEl = el('div', { class: 'bb-title' }, el('strong', null, props.title || (level && level.title) || 'Battle'), el('small', null, subtitle));
  const showAttackStats = mode === 'attack' || (mode === 'replay' && !defence);
  const top = el('div', { class: 'bb-top' },
    exitBtn, titleEl,
    el('div', { class: 'bb-top-stats' }, hydBar, defence ? coreEl : null, timerEl, showAttackStats ? pctEl : null,
      showAttackStats ? starsEl : null, defence && setup.campaign ? budgetEl : null, defence && drugsAllowed ? atpEl : null),
    el('div', { class: 'bb-top-ctl' }, mode !== 'attack' && !realtimeOnly && !training ? speedBtn : null, mode !== 'attack' ? pauseBtn : null, msgBtn, soundBtn));
  root.append(top);

  // The goal of the battle, always visible, with live progress on every star.
  const objMain = el('span', { class: 'bb-obj-main' });
  const objList = el('ul', { class: 'bb-obj-list' });
  const objToggle = el('button', { class: 'bb-obj-toggle', type: 'button', 'aria-expanded': 'false', onclick: () => {
    const open = !objBar.classList.contains('open');
    objBar.classList.toggle('open', open);
    objToggle.setAttribute('aria-expanded', String(open));
  } });
  const objBar = el('div', { class: 'bb-objective', role: 'region', 'aria-label': 'Objective' },
    el('div', { class: 'bb-obj-row' }, el('span', { class: 'bb-obj-ico', 'aria-hidden': 'true' }, '\u{1F3AF}'), objMain, objToggle), objList);
  if (mode !== 'replay') root.append(objBar);
  if (window.innerWidth >= 900) objBar.classList.add('open');

  const ticker = el('div', { class: 'bb-ticker', 'aria-live': 'polite' });
  root.append(ticker);
  const tools = el('div', { class: 'bb-tools', role: 'toolbar', 'aria-label': 'Mission information' });
  root.append(tools);
  const bottom = el('div', { class: 'bb-bottom' });
  root.append(bottom);
  const panel = el('div', { class: 'bb-panel', hidden: true, role: 'dialog', 'aria-modal': 'false', 'aria-label': 'Information' });
  root.append(panel);
  const sheet = el('div', { class: 'bb-sheet', hidden: true, role: 'dialog', 'aria-modal': 'false' });
  root.append(sheet);
  const overlay = el('div', { class: 'bb-overlay', hidden: true });
  root.append(overlay);
  const quizLayer = el('div', { class: 'bb-overlay bb-quiz-layer', hidden: true });
  root.append(quizLayer);

  function paintSound() {
    soundBtn.textContent = audio.muted ? '\u{1F507}' : '\u{1F50A}';
  }
  paintSound();

  // ---------------------------------------------------------------- messages
  // At most three messages on screen, the most serious kept longest; everything goes to the history.
  const tickerSeen = new Map();
  let unread = 0;
  function say(text, kind = 'info', key = text, gap = 6000) {
    const now = performance.now();
    if (now - (tickerSeen.get(key) || -1e9) < gap) return;
    tickerSeen.set(key, now);
    history.unshift({ text, kind, tick: battle ? battle.tick : 0 });
    if (history.length > 80) history.pop();
    if (panelKind === 'msgs') renderPanel();
    else if (kind !== 'info') { unread += 1; msgCount.textContent = String(Math.min(unread, 99)); msgCount.hidden = false; }
    if (kind === 'info' && !tipsOn) return;
    const item = el('div', { class: `bb-tick bb-tick-${kind}`, 'data-p': String(PRIORITY[kind] || 0) }, text);
    ticker.prepend(item);
    while (ticker.children.length > 3) {
      const kids = [...ticker.children];
      let victim = kids[kids.length - 1];
      for (const k of kids) if (Number(k.dataset.p) < Number(victim.dataset.p)) victim = k;
      victim.remove();
    }
    const life = kind === 'bad' ? 7000 : kind === 'warn' ? 6000 : 4800;
    setTimeout(() => { item.classList.add('fade'); }, life - 800);
    setTimeout(() => { item.remove(); }, life);
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

  function hasBuilding(key) {
    for (const b of shown().buildings) if (b && b.alive && !b.removed && b.key === key) return true;
    return false;
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
    return { x: q.x, y: q.y, depth: w.y, dir: w.dir, s: w.s };
  }

  // Screen rectangles for coach highlights on the map.
  function isoRect(ix, iy, size) {
    const p = scene.camera.isoToScreen(ix, iy);
    const r = scene.canvas.getBoundingClientRect();
    return { x: r.left + p.x - size / 2, y: r.top + p.y - size / 2, w: size, h: size };
  }
  function siteRect(id) {
    const info = geom.sites.get(id);
    if (!info) return null;
    const a = siteAnchorIso(geom, info);
    return isoRect(a.x, a.y - 14, Math.max(44, 110 * scene.camera.scale));
  }
  function mouthRect() {
    const p = geom.posAt(40);
    const q = toIso(p.x, p.y);
    return isoRect(q.x, q.y, Math.max(56, 180 * scene.camera.scale));
  }

  function emit(ev, data) {
    if (coach && coach.alive) coach.emit(ev, data);
  }

  // ---------------------------------------------------------------- events
  function firstSighting(u) {
    if (seenTypes.has(u.type)) return;
    seenTypes.add(u.type);
    const ud = units.get(u.type);
    if (!ud) return;
    const kind = groupPlain(gd, ud.group);
    const p = unitIso(u);
    fx.text(p.x, p.y - 34, `NEW: ${ud.name}`, '#fff3a6', 2600, 1e9, 14);
    if (defence) say(`${ud.name} (${kind}): ${ud.how || ud.ability}`, 'info', `new:${u.type}`, 1e9);
  }

  function handleEvents(src) {
    const bl = src.buildings;
    for (const ev of src.events || []) {
      switch (ev.type) {
        case 'checkpoint': {
          const cp = checkpointDefs[ev.z] || {};
          if (quizOn && props.checkpoints && mode !== 'replay') say(`Checkpoint: germs have reached the ${cp.name || 'next part of the gut'}`, defence ? 'warn' : 'good', 'cp' + ev.z, 0);
          else say(`Germs have reached the ${(cp.name || 'next part of the gut').toLowerCase()}`, defence ? 'warn' : 'good', 'cp' + ev.z, 0);
          audio.play('alarm');
          if (mode !== 'replay' && quizOn && props.checkpoints && !cpAsked.has(ev.z)) {
            cpAsked.add(ev.z);
            startQuiz(ev.z);
          }
          break;
        }
        case 'boost': {
          const bd = boosterDefs.find((x) => x.key === ev.k);
          say(`Booster: ${bd ? bd.name : ev.k}!`, 'good', 'boost' + ev.z, 0);
          audio.play('spell');
          fx.shake = Math.max(fx.shake || 0, 4);
          break;
        }
        case 'shot': {
          const b = bl[ev.b];
          const u = src.units[ev.u];
          if (!b || !u) break;
          const v = buildingView(b);
          const from = buildingTop(geom, v.info, b.key);
          const to = unitIso(u);
          if (b.cat === 'battery') {
            const dd = drugs.get(b.drug);
            const dn = dd ? shortName(dd.name) : 'Drug';
            const un = units.get(u.type).name;
            const wasted = ev.letter === 'N';
            fx.projectile('drug', from, to, dd ? dd.color : '#ffffff', { wasted });
            if (wasted) {
              fx.text(to.x, to.y - 18, 'no effect', '#e0e0e0', 900, to.depth + 2, 12);
              say(`${dn} cannot kill ${un}: the shot is wasted and breeds resistance`, 'warn', `w:${b.drug}:${u.type}`);
              audio.play('wasted');
            } else {
              if (ev.letter === 'X') say(`${dn} hurts ${un} a little, but it is not the right treatment`, 'warn', `x:${b.drug}:${u.type}`, 9000);
              else if (ev.letter === 'P') {
                fx.text(to.x, to.y - 18, 'resisted', '#ffcf7a', 800, to.depth + 2, 11);
                say(`${dn} does reduced damage to ${un}: many of these germs resist it`, 'warn', `p:${b.drug}:${u.type}`, 12000);
              } else if (units.get(u.type).antibioticsNotNeeded) say(`Antibiotics are not needed for ${un}: ORS is the treatment`, 'warn', `nn:${u.type}`, 9000);
              audio.play('zap');
            }
            emit('shot', { letter: ev.letter, drug: b.drug, unit: u.type });
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
          fx.ring(a.x, a.y, 10, ((defs.get(b.key) || {}).range || 240) * 0.62, '#ffffff', 520, v.info.y + 5);
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
            fx.burst(a.x, a.y - 14, '#e6c3a3', 3, 320, v.info.y + 3, 26);
          }
          if (defence && b.key === 'core') say('Germs are attacking the Bone Marrow Core!', 'bad', 'corehit', 15000);
          break;
        }
        case 'kill': {
          const u = src.units[ev.u];
          if (!u) break;
          const p = unitIso(u);
          fx.burst(p.x, p.y - 10, unitColor(gd, u.type), 9, 560, p.depth + 1);
          audio.play('pop');
          if (u.type === 'amoeba') say('Amoeba Blob died - but it left a cyst behind. A luminal agent clears cysts.', 'info', 'cyst', 15000);
          emit('kill', { type: u.type, kind: ev.kind });
          break;
        }
        case 'bdown': {
          const b = bl[ev.b];
          if (!b) break;
          const v = buildingView(b);
          const a = siteAnchorIso(geom, v.info);
          fx.burst(a.x, a.y - 20, '#b48a6c', 16, 900, v.info.y + 5, 70);
          fx.puff(a.x, a.y - 10, 'rgba(90,60,50,0.9)', 900, v.info.y + 6, 22);
          fx.quake(b.key === 'core' ? 10 : 5);
          audio.play('crumble');
          const name = defs.get(b.key) ? defs.get(b.key).name : 'Building';
          if (b.key === 'core') say('The Bone Marrow Core has fallen!', 'bad', 'core', 1e9);
          else if (b.key === 'flora_garden') say('Gut Flora Garden lost: the good bacteria are gone, so C. difficile and Candida can move in', 'bad', `fl:${b.site}`);
          else if (b.key === 'kupffer_gate') say('Kupffer Cell Gate breached: germs can reach the Core', 'bad', 'kupf');
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
            if (u.type === 'candida') say('Candida overgrew where the good bacteria were lost', 'bad', 'candida', 12000);
          } else if (mode === 'attack') {
            audio.play('deploy');
          }
          if (mode !== 'replay') firstSighting(u);
          emit('spawn', { type: u.type });
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
            fx.bubbles(q.x, q.y, '#d6ff6a', 900, p.y);
          }
          audio.play('acid');
          break;
        }
        case 'collapse':
          fx.flashScreen('#ff2a3a', 0.7);
          fx.quake(12);
          say('The patient collapsed from dehydration: defences cannot save a dried-out body', 'bad', 'collapse', 1e9);
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
          fx.ring(q.x, q.y, 10, (sp && sp.radius ? sp.radius : 300) * 0.7, ev.k === 'biofilm_dome' ? '#8fe3ff' : ev.k === 'quorum_sensing' ? '#d6ff3d' : ev.k === 'immune_evasion' ? '#ffffff' : '#6fb3ff', 900, p.y + 5);
          fx.text(q.x, q.y - 20, sp ? sp.name : ev.k, '#ffffff', 1300, 1e9, 13);
          audio.play('spell');
          break;
        }
        case 'cdiff': {
          const p = geom.posAt(ev.s);
          const q = toIso(p.x, p.y);
          fx.puff(q.x, q.y, 'rgba(204,121,167,0.95)', 1200, p.y + 3, 26);
          say('C. difficile appeared: broad-spectrum antibiotics wiped out the gut flora', 'bad', 'cdiff', 12000);
          audio.play('alarm');
          break;
        }
        case 'iv': {
          const b = bl[ev.b];
          if (b) {
            const v = buildingView(b);
            const a = buildingTop(geom, v.info, b.key);
            fx.drops(a.x, a.y, '#6fc3ff', 1500, v.info.y + 4);
          }
          say("IV Ringer's lactate started: severe dehydration needs IV fluids", 'good', 'iv', 8000);
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
    if (mode !== 'replay') {
      for (const w of waveTimes) {
        if (w.warnAt === battle.tick && w.t > 0) {
          const total = waveTimes.length;
          say(`Wave ${w.i + 1} of ${total}: ${w.n} × ${w.name} ${w.t - battle.tick > 0 ? 'in 3 seconds' : 'now'}`, 'warn', `wave${w.i}`, 0);
        }
      }
    }
    battle.step();
    handleEvents(battle);
    const frac = battle.hydration / hydMax;
    if (lastHydFrac >= 0.25 && frac < 0.25) {
      say('Severe dehydration! ORS alone cannot keep up now: IV fluids are needed', 'bad', 'severe', 15000);
      audio.play('alarm');
    }
    if (battle.tick % 10 === 0) emit('hydration', { pct: Math.round(frac * 100) });
    lastHydFrac = frac;
    if (battle.units.some((u) => u.alive && u.type === 'typhoid' && u.s >= 4000)) say('Typhoid has reached the liver gate', 'bad', 'ty-liver', 20000);
  }

  function liveTick() {
    return phase === 'run' && !paused && !battle.over && !quiz;
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
      while (acc >= TICK_MS && !battle.over && n < 12 && !quiz) {
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

  function siteRange(siteId, r) {
    const k = `${siteId}:${r}`;
    let iv = rangeCache.get(k);
    if (!iv) {
      const info = geom.sites.get(siteId);
      iv = geom.rangeIntervals(info.gx, info.gy, r);
      rangeCache.set(k, iv);
    }
    return iv;
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
    // Scouting a base: every defence's reach is shaded so the attacker can plan a route.
    if (mode === 'attack' && phase === 'intro') {
      const list = [];
      for (const b of src.buildings) {
        if (!b || !b.alive || b.removed) continue;
        const r = rangeFor(gd, b);
        if (r) list.push({ intervals: siteRange(b.site, r), color: rangeColor(gd, b) + '66' });
      }
      ctx.save();
      ctx.globalAlpha = 0.7 + 0.2 * Math.sin(scene.t * 3);
      scene.drawRanges(list);
      ctx.restore();
    }
    if (previewBuild) {
      const r = previewBuild.range;
      if (r) {
        ctx.save();
        ctx.globalAlpha = 0.65 + 0.3 * Math.sin(scene.t * 5);
        scene.drawRanges([{ intervals: siteRange(previewBuild.site, r), color: previewBuild.color, strong: true }]);
        ctx.restore();
      }
    } else if (sheetSite) {
      const b = src.buildings[geom.sites.get(sheetSite).idx];
      if (b && b.alive && !b.removed) {
        const r = rangeFor(gd, b);
        if (r) scene.drawRanges([{ intervals: siteRange(sheetSite, r), color: rangeColor(gd, b) + '99' }]);
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

  let objPaintAt = 0;
  function paintObjectives(src) {
    const now = performance.now();
    if (now - objPaintAt < 250) return;
    objPaintAt = now;
    let main;
    const rows = [];
    if (defence) {
      main = training ? 'Stop the germs before they reach the Bone Marrow Core'
        : 'Protect the Core and keep hydration above zero';
      objectives.forEach((o) => {
        const st = liveObjective(gd, o, src, phase);
        rows.push({ text: o.text || o.key, s: st.s, note: st.note });
      });
    } else {
      main = 'Destroy half the base or the Bone Marrow Core to earn stars';
      const d = destruction(src);
      rows.push({ text: 'Destroy at least 50% of the buildings', s: d.pct >= 50 ? 'done' : 'todo', note: `${d.pct}%` });
      rows.push({ text: 'Destroy the Bone Marrow Core', s: d.coreDown ? 'done' : 'todo' });
      rows.push({ text: 'Destroy everything (100%)', s: d.pct === 100 ? 'done' : 'todo' });
    }
    objMain.textContent = main;
    const met = rows.filter((r) => r.s === 'done' || r.s === 'ok').length;
    objToggle.textContent = rows.length ? `★ ${met}/${rows.length}` : '';
    objToggle.setAttribute('aria-label', `Stars: ${met} of ${rows.length} on track. Show details.`);
    objToggle.hidden = !rows.length;
    const sig = rows.map((r) => r.s + (r.note || '')).join('|');
    if (objList.dataset.sig === sig) return;
    objList.dataset.sig = sig;
    objList.replaceChildren(...rows.map((r) => el('li', { class: `bb-obj s-${r.s}` },
      el('span', { class: 'bb-obj-st', 'aria-label': STATUS_TEXT[r.s] }, STATUS_ICON[r.s]),
      el('span', null, r.text, r.note ? el('small', null, ` (${r.note})`) : null))));
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
    if (defence) {
      const core = src.buildings.find((b) => b && b.key === 'core' && !b.removed);
      const cp = core && core.maxHp ? Math.max(0, Math.round((core.hp * 100) / core.maxHp)) : 0;
      coreEl.textContent = `Core ${cp}%`;
      coreEl.classList.toggle('low', cp < 50);
    }
    if (pctEl.isConnected || starsEl.isConnected) {
      const d = destruction(src);
      pctEl.textContent = `${d.pct}%`;
      [...starsEl.children].forEach((s, i) => { s.textContent = i < d.stars ? '★' : '☆'; s.classList.toggle('on', i < d.stars); });
    }
    if (defence && setup.campaign) budgetEl.textContent = `Budget ${src.budget}`;
    if (defence && drugsAllowed) atpEl.textContent = `Drug ATP ${src.atp}`;
    pauseBtn.textContent = paused ? '▶' : '⏸';
    pauseBtn.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
    speedBtn.textContent = `x${speed}`;
    if (mode !== 'replay') paintObjectives(src);
    paintBottomLive();
  }

  function explainResource(kind) {
    const text = kind === 'budget'
      ? ['Budget is what this mission gives you to build defences. Each defence shows its cost before you build it.', 'Removing a defence gives back half its cost. Budget does not carry over to other missions.']
      : ['Drug ATP is the energy your Drug Batteries spend: every shot costs ATP (1-3 per shot).', 'When it runs out, batteries stop firing. Wasted and unnecessary shots burn it for nothing.'];
    openPanel('info', kind === 'budget' ? 'Budget' : 'Drug ATP', text.map((t) => el('p', { class: 'bb-small' }, t)));
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

  let autoPaused = false;
  let previewFocus = false;
  function closeSheet() {
    sheet.hidden = true;
    sheet.replaceChildren();
    sheetSite = null;
    previewBuild = null;
    unfocusPreview();
    resumeIfAuto();
  }

  // While a defence is being chosen, pan the map so the site and its range show above the sheet.
  function focusPreview(siteId) {
    const info = geom.sites.get(siteId);
    if (!info) return;
    const a = siteAnchorIso(geom, info);
    const cam = scene.camera;
    const zoom = Math.max(cam.scale, cam.fitScale * 1.5);
    const cv = scene.canvas.getBoundingClientRect();
    const sr = sheet.getBoundingClientRect();
    const ins = { ...scene.insets };
    if (sr.left > cv.left + cv.width * 0.45) ins.right = Math.max(ins.right || 0, cv.right - sr.left + 12);
    else ins.bottom = Math.max(ins.bottom || 0, cv.bottom - sr.top + 12);
    const cc = document.querySelector('.coach-card:not([hidden])');
    if (cc) {
      const r = cc.getBoundingClientRect();
      if (r.top < cv.top + cv.height * 0.4) ins.top = Math.max(ins.top || 0, r.bottom - cv.top + 8);
    }
    cam.animateTo(a.x, a.y - 30, zoom, scene.vw, scene.vh, ins);
    scene.userMoved = true;
    previewFocus = true;
  }

  function unfocusPreview() {
    if (!previewFocus) return;
    previewFocus = false;
    const b = geom.contentBounds;
    scene.camera.animateTo((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, scene.camera.fitScale, scene.vw, scene.vh, scene.insets);
    scene.userMoved = false;
  }

  function resumeIfAuto() {
    if (phase === 'run' && mode === 'campaign' && autoPaused && sheet.hidden && panel.hidden) {
      paused = false;
      autoPaused = false;
    }
  }

  function autoPause() {
    if (phase === 'run' && mode === 'campaign' && !paused) {
      paused = true;
      autoPaused = true;
    }
  }

  function sheetHead(text, sub) {
    return el('div', { class: 'bb-sheet-head' }, el('strong', null, text), sub ? el('span', { class: 'bb-muted' }, ` • ${sub}`) : null,
      el('button', { class: 'bb-icon', type: 'button', 'aria-label': 'Close', onclick: () => closeSheet() }, '✕'));
  }

  function openSheet(siteId) {
    const src = shown();
    sheetSite = siteId;
    previewBuild = null;
    closePanel();
    autoPause();
    const info = geom.sites.get(siteId);
    const b = src.buildings[info.idx];
    const zone = (geom.zoneByKey(info.zone) || {}).name || info.zone;
    sheet.replaceChildren();
    if (b && b.alive && !b.removed) {
      const d = defs.get(b.key);
      sheet.append(sheetHead(`${d.name} (level ${b.lv})`, zone));
      const body = el('div', { class: 'bb-sheet-body' },
        el('p', { class: 'bb-muted bb-small' }, `Health ${b.hp} / ${b.maxHp}`),
        b.key === 'drug_battery' ? el('p', { class: 'bb-small' }, `Drug: ${shortName((drugs.get(b.drug) || {}).name || b.drug)}. Prescribed for: ${(b.rx || []).length ? b.rx.map((k) => (units.get(k) || {}).name || k).join(', ') : 'nobody (it stays idle)'}.`) : null,
        factList(buildingFacts(gd, d)),
        learnWhy(d.desc, 'What it does and why'));
      sheet.append(body);
      const actions = el('div', { class: 'bb-sheet-actions' });
      if (b.key === 'drug_battery') actions.append(el('button', { class: 'bb-btn', type: 'button', onclick: () => rxEditor(siteId, b.drug, b.rx, (rx) => { sendCommand({ c: 'rx', site: siteId, rx }); closeSheet(); }) }, 'Change prescription'));
      if (b.key !== 'core' && setup.campaign) {
        const refund = Math.floor((d.cost[0] * ((gd.economy && gd.economy.campaignSellRefundPct) || 50)) / 100);
        actions.append(el('button', { class: 'bb-btn bb-danger', type: 'button', 'data-role': 'remove', onclick: () => {
          if (sendCommand({ c: 'sell', site: siteId })) {
            say(`${d.name} removed (+${refund} budget)`, 'info', 'sell' + siteId + src.tick, 0);
            emit('sold', { key: b.key, site: siteId });
          }
          closeSheet();
        } }, `Remove (+${refund})`));
      }
      sheet.append(actions);
    } else {
      sheet.append(sheetHead(`Build at ${siteId}`, zone));
      const opts = buildOptionsFor(src, siteId);
      const list = el('div', { class: 'bb-build-list' });
      const detail = el('div', { class: 'bb-build-detail' });
      if (!opts.length) list.append(el('p', { class: 'bb-muted' }, 'Nothing in this mission can be built on this site.'));
      for (const o of opts) {
        const disabled = o.full || !o.afford;
        const btn = el('button', { class: 'bb-build', type: 'button', disabled, 'data-build': o.key, 'aria-pressed': 'false', onclick: () => select(o, btn) },
          el('strong', null, o.def.name),
          el('span', { class: 'bb-cost' }, `${o.cost} budget`),
          el('small', null, o.full ? `Limit reached (${o.max})` : !o.afford ? `Not enough budget (you have ${src.budget})` : (o.def.desc || '').split('. ')[0] + '.'));
        list.append(btn);
      }
      const select = (o, btn) => {
        list.querySelectorAll('.bb-build').forEach((x) => { x.classList.toggle('sel', x === btn); x.setAttribute('aria-pressed', String(x === btn)); });
        list.classList.add('picked');
        const change = el('button', { class: 'bb-linkbtn', type: 'button', onclick: () => { list.classList.remove('picked'); change.remove(); } }, 'Show the other choices');
        if (opts.length > 1) list.after(change);
        const r = o.def.range || 0;
        previewBuild = { site: siteId, key: o.key, range: r, color: '#22e4ff' };
        const confirm = el('button', { class: 'bb-btn bb-primary bb-big', type: 'button', 'data-confirm': '1', onclick: () => {
          if (o.key === 'drug_battery') { drugPicker(siteId); return; }
          if (sendCommand({ c: 'build', site: siteId, b: o.key })) {
            say(`${o.def.name} built (-${o.cost} budget)`, 'good', 'built' + siteId + Date.now(), 0);
            emit('built', { key: o.key, site: siteId });
          }
          closeSheet();
        } }, o.key === 'drug_battery' ? 'Next: choose the drug' : `Build · ${o.cost}`);
        const intro = el('p', { class: 'bb-small' });
        intro.append(termify((o.def.desc || '').split('. ').slice(0, 2).join('. ').replace(/\.?$/, '.')));
        detail.replaceChildren(...[
          el('h3', null, o.def.name),
          intro,
          factList(buildingFacts(gd, o.def)),
          r ? el('p', { class: 'bb-small bb-muted' }, 'The bright band on the gut shows where it can hit.') : null,
          learnWhy(o.def.desc),
          el('div', { class: 'bb-sheet-actions bb-flush' }, confirm)].filter(Boolean));
        emit('select', { key: o.key, site: siteId });
        requestAnimationFrame(() => focusPreview(siteId));
        try { confirm.focus({ preventScroll: true }); } catch { /* ignore */ }
      };
      sheet.append(el('div', { class: 'bb-sheet-body' }, el('p', { class: 'bb-muted bb-small' }, `Budget left: ${src.budget}. Tap a defence to see what it does.`), list, detail));
      emit('sheet', { site: siteId });
    }
    sheet.hidden = false;
  }

  function drugPicker(siteId) {
    previewBuild = null;
    sheet.replaceChildren(sheetHead('Choose the drug'));
    const list = el('div', { class: 'bb-build-list' });
    for (const k of setup.campaign.allowedDrugs || []) {
      const d = drugs.get(k);
      if (!d) continue;
      list.append(el('button', { class: 'bb-build bb-drug', type: 'button', 'data-drug': k, style: { borderLeft: `6px solid ${d.color}` }, onclick: () => {
        rxEditor(siteId, k, [], (rx) => {
          if (sendCommand({ c: 'build', site: siteId, b: 'drug_battery', drug: k, rx })) {
            say(`Drug Battery built: ${shortName(d.name)} for ${rx.length ? rx.map((u) => (units.get(u) || {}).name || u).join(', ') : 'nobody yet'}`, 'good', 'bat' + siteId + Date.now(), 0);
            emit('built', { key: 'drug_battery', site: siteId, drug: k, rx });
          }
          closeSheet();
        });
      } }, el('strong', null, shortName(d.name)), el('span', { class: 'bb-cost' }, `${d.atp} ATP/shot`),
      factList(drugFacts(gd, d, resistance[k] || 0).filter((f) => f.k !== 'Cost per shot'))));
    }
    sheet.append(el('div', { class: 'bb-sheet-body' },
      el('p', { class: 'bb-small bb-muted' }, 'Each drug works only on some germs. Think about what kind of germ you are facing.'),
      list,
      level && level.hints ? el('button', { class: 'bb-linkbtn', type: 'button', onclick: () => togglePanel('hint') }, '\u{1F4A1} Need a hint?') : null));
    emit('drugs', { site: siteId });
  }

  function missionGerms() {
    const keys = new Set(plan ? plan.kinds.map((k) => k.key) : []);
    if (keys.has('amoeba')) keys.add('amoeba_cyst');
    return keys;
  }

  function rxEditor(siteId, drugKey, current, done) {
    const d = drugs.get(drugKey) || { name: drugKey };
    const checks = new Map();
    const mine = missionGerms();
    const item = (u) => {
      const cb = el('input', { type: 'checkbox' });
      cb.checked = (current || []).includes(u.key);
      checks.set(u.key, cb);
      return el('label', { class: 'bb-rx-item' }, cb, el('span', { class: 'bb-dot', style: { background: unitColor(gd, u.key) } }),
        el('span', null, u.name, el('small', { class: 'bb-kind' }, groupPlain(gd, u.group))));
    };
    const first = gd.units.filter((u) => mine.has(u.key));
    const rest = gd.units.filter((u) => !mine.has(u.key));
    const grid = el('div', { class: 'bb-rx' }, ...first.map(item));
    const more = el('details', { class: 'bb-why' }, el('summary', null, first.length ? 'Other germs' : 'All germs'), el('div', { class: 'bb-rx' }, ...rest.map(item)));
    if (!first.length) more.open = true;
    sheet.replaceChildren(
      sheetHead(`Prescribe ${shortName(d.name)}`),
      el('div', { class: 'bb-sheet-body' },
        el('p', { class: 'bb-small bb-muted' }, 'Tick the germs this battery may shoot. Each shot costs drug ATP; shooting a germ the drug cannot kill wastes it and breeds resistance.'),
        first.length ? el('p', { class: 'bb-small' }, el('strong', null, 'Germs in this mission')) : null,
        grid, more,
        el('div', { class: 'bb-sheet-actions bb-flush' }, el('button', { class: 'bb-btn bb-primary bb-big', type: 'button', 'data-confirm': '1', onclick: () => {
          done(gd.units.map((u) => u.key).filter((k) => checks.get(k).checked));
        } }, 'Build battery'))));
  }

  // ---------------------------------------------------------------- side panels
  function closePanel() {
    if (panel.hidden) return;
    panel.hidden = true;
    panel.replaceChildren();
    panelKind = null;
    tools.querySelectorAll('[aria-pressed]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    resumeIfAuto();
  }

  function openPanel(kind, title, content) {
    panelKind = kind;
    autoPause();
    panel.replaceChildren(
      el('div', { class: 'bb-sheet-head' }, el('strong', null, title),
        el('button', { class: 'bb-icon', type: 'button', 'aria-label': 'Close', onclick: () => closePanel() }, '✕')),
      el('div', { class: 'bb-sheet-body' }, ...[].concat(content)));
    panel.hidden = false;
    tools.querySelectorAll('[data-panel]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.panel === kind)));
  }

  function togglePanel(kind) {
    if (panelKind === kind) { closePanel(); return; }
    renderPanel(kind);
  }

  function renderPanel(kind = panelKind) {
    if (kind === 'msgs') {
      unread = 0;
      msgCount.hidden = true;
      const tipsToggle = el('label', { class: 'bb-switch' }, el('input', { type: 'checkbox', checked: tipsOn ? true : null, onchange: (e) => { tipsOn = e.target.checked; setPref('battle.tips', tipsOn); } }), ' Show tips on the map');
      openPanel('msgs', 'Messages', [
        tipsToggle,
        history.length ? el('ul', { class: 'bb-history' }, ...history.map((m) => el('li', { class: `bb-tick bb-tick-${m.kind}` }, el('small', null, formatTime(m.tick, tps), ' '), m.text)))
          : el('p', { class: 'bb-small bb-muted' }, 'Nothing yet. Important events will be listed here.'),
      ]);
    } else if (kind === 'case' && level) {
      const kids = [];
      if (props.missionNumber) kids.push(el('p', { class: 'bb-kicker' }, `Mission ${props.missionNumber}${level.chapter ? ` · ${level.chapter}` : ''}`));
      if (level.case) { const p = el('p', { class: 'bb-small' }); p.append(termify(level.case)); kids.push(p); }
      if (level.lo) kids.push(el('div', { class: 'bb-goal' }, el('strong', null, 'What you will learn: '), termify(level.lo)));
      if (level.mechanic) kids.push(el('div', { class: 'bb-mech' }, el('strong', null, `New: ${level.mechanic.name}. `), termify(level.mechanic.text)));
      if (objectives.length) kids.push(el('p', { class: 'bb-small' }, el('strong', null, 'Stars')), el('ol', { class: 'bb-objs' }, ...objectives.map((o) => el('li', null, o.text || o.key))));
      kids.push(learnWhy(level.why));
      openPanel('case', level.title || 'The case', kids);
    } else if (kind === 'germs' && plan) {
      const rows = plan.kinds.map((k) => {
        const how = el('p', { class: 'bb-small' });
        how.append(termify(k.how || ''));
        return el('div', { class: 'bb-germ' }, unitIconCanvas(gd, k.key, 44),
          el('div', null, el('strong', null, k.name), ' ', el('span', { class: 'bb-kind', style: { '--grp': unitColor(gd, k.key) } }, k.kind),
            el('small', { class: 'bb-muted' }, ` ×${k.n} · ${k.real}`), how, learnWhy(k.ability, 'More about it')));
      });
      const waves = el('ol', { class: 'bb-waves' }, ...plan.waves.map((w) => el('li', null, `${formatTime(w.t, tps)} after Start: ${w.n} × ${w.name}`)));
      openPanel('germs', 'Incoming germs', [...rows, el('p', { class: 'bb-small' }, el('strong', null, 'Waves')), waves]);
    } else if (kind === 'hint' && level && level.hints) {
      if (hintsShown === 0) hintsShown = 1;
      const list = el('ol', { class: 'bb-hints' }, ...level.hints.slice(0, hintsShown).map((t) => { const li = el('li', { class: 'bb-small' }); li.append(termify(t)); return li; }));
      const more = hintsShown < level.hints.length
        ? el('button', { class: 'bb-btn', type: 'button', onclick: () => { hintsShown += 1; renderPanel('hint'); } }, 'Show a bigger hint')
        : el('p', { class: 'bb-small bb-muted' }, 'That is every hint. Hints never cost stars.');
      openPanel('hint', 'Hints', [list, more]);
    } else if (kind === 'info') {
      // explainResource() builds this panel itself
    }
  }

  function renderTools() {
    tools.replaceChildren();
    if (!defence || mode === 'replay') return;
    const btn = (kind, ico, label) => el('button', { class: 'bb-tool', type: 'button', 'data-panel': kind, 'aria-pressed': 'false', onclick: () => togglePanel(kind) },
      el('span', { 'aria-hidden': 'true' }, ico), el('small', null, label));
    if (level) tools.append(btn('case', '\u{1F4CB}', 'Case'));
    if (plan && plan.kinds.length) tools.append(btn('germs', '\u{1F9A0}', 'Germs'));
    if (level && level.hints && level.hints.length) tools.append(btn('hint', '\u{1F4A1}', 'Hint'));
  }

  // ---------------------------------------------------------------- input
  function onMapTap(x, y) {
    if (finished) return;
    if (mode === 'attack' && targetingSpell && phase === 'run') {
      const ns = scene.pathSAt(x, y);
      if (ns.dist > 220) {
        say('Tap on the gut to use the tactic', 'info', 'spelltap', 2500);
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
    confirmBox(mode === 'attack' ? 'Leave the battle? It counts as a surrender and nothing is gained.' : 'Leave this mission? Your progress in it will be lost.', 'Leave', () => cleanupAndExit());
  }

  function cleanupAndExit() {
    finished = true;
    if (props.onExit) props.onExit();
  }

  // ---------------------------------------------------------------- checkpoint questions
  // The first germ to cross into each part of the gut pauses the battle for one question.
  // A correct answer (checked by the server) lets the player pick a booster.
  function startQuiz(z) {
    const cp = checkpointDefs[z] || {};
    const state = { z, timer: 0, done: false };
    quiz = state;
    state.close = () => {
      if (state.done) return;
      state.done = true;
      clearInterval(state.timer);
      quizLayer.hidden = true;
      quizLayer.replaceChildren();
      if (quiz === state) quiz = null;
      last = performance.now();
    };
    const head = el('div', { class: 'bb-quiz-head' },
      el('span', { class: 'bb-quiz-flag' }, `Checkpoint ${z + 1} of ${checkpointDefs.length}`),
      el('h2', { id: 'bbq-title' }, `${cp.name || 'New gut zone'} reached!`),
      el('p', { class: 'bb-small bb-muted' }, defence
        ? 'Germs have pushed deeper into your patient. Answer correctly to call in a defence booster. A wrong answer costs nothing.'
        : 'Your germs broke through. Answer correctly to unlock a booster for your army. A wrong answer costs nothing.'));
    const body = el('div', { class: 'bb-quiz-body' }, el('p', { class: 'bb-small' }, 'Loading the question...'));
    const skipBtn = el('button', { class: 'bb-linkbtn', type: 'button', onclick: () => state.close() }, 'Skip this question');
    const box = el('div', { class: 'bb-dialog bb-quiz', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'bbq-title' }, head, body, el('div', { class: 'bb-quiz-skip' }, skipBtn));
    quizLayer.replaceChildren(box);
    quizLayer.hidden = false;
    audio.play('click');
    props.checkpoints.ask(z).then((q) => {
      if (state.done || !alive) return;
      if (!q || !Array.isArray(q.options)) { state.close(); return; }
      showQuestion(state, body, q);
    }).catch(() => state.close());
  }

  function showQuestion(state, body, q) {
    const secs = Math.max(5, q.seconds || 20);
    const fill = el('div', { class: 'bb-quiz-timefill' });
    const timeTxt = el('span', { class: 'bb-quiz-secs' }, String(secs));
    const opts = q.options.map((text, i) => el('button', { class: 'bb-quiz-opt', type: 'button' },
      el('span', { class: 'bb-quiz-letter' }, 'ABCDEFGH'[i] || String(i + 1)), el('span', null, text)));
    const feedback = el('div', { class: 'bb-quiz-feedback', 'aria-live': 'polite' });
    body.replaceChildren(
      el('div', { class: 'bb-quiz-time' }, el('div', { class: 'bb-quiz-timebar' }, fill), timeTxt),
      el('p', { class: 'bb-quiz-q' }, q.text || q.q),
      el('div', { class: 'bb-quiz-opts' }, ...opts),
      feedback);
    const started = performance.now();
    let answered = false;
    const submit = (choice) => {
      if (answered || state.done) return;
      answered = true;
      clearInterval(state.timer);
      for (const b of opts) b.disabled = true;
      if (choice >= 0 && opts[choice]) opts[choice].classList.add('picked');
      feedback.replaceChildren(el('p', { class: 'bb-small' }, 'Checking...'));
      props.checkpoints.answer(state.z, choice).then((res) => {
        if (state.done || !alive) return;
        if (!res) { state.close(); return; }
        if (opts[res.answer]) opts[res.answer].classList.add('right');
        if (!res.correct && choice >= 0 && opts[choice]) opts[choice].classList.add('wrong');
        audio.play(res.correct ? 'correct' : 'wrong');
        const why = res.explanation ? el('p', { class: 'bb-small bb-quiz-why' }, res.explanation) : null;
        if (res.correct) {
          feedback.replaceChildren(el('p', { class: 'bb-quiz-verdict good' }, 'Correct! Choose your booster:'), why, boosterPicker(state));
        } else {
          feedback.replaceChildren(
            el('p', { class: 'bb-quiz-verdict bad' }, res.in_time === false ? 'Time is up.' : 'Not quite.'), why,
            el('div', { class: 'bb-sheet-actions' }, el('button', { class: 'bb-btn bb-primary', type: 'button', onclick: () => state.close() }, 'Continue')));
        }
        const focusTarget = feedback.querySelector('button');
        if (focusTarget) focusTarget.focus();
      }).catch(() => state.close());
    };
    opts.forEach((b, i) => b.addEventListener('click', () => submit(i)));
    state.timer = setInterval(() => {
      const left = secs - (performance.now() - started) / 1000;
      fill.style.width = `${Math.max(0, (left / secs) * 100)}%`;
      fill.classList.toggle('low', left < 6);
      timeTxt.textContent = String(Math.max(0, Math.ceil(left)));
      if (left <= 0) submit(-1);
    }, 100);
    if (opts[0]) opts[0].focus();
  }

  function boosterPicker(state) {
    const wrap = el('div', { class: 'bb-boosters' });
    for (const bd of boosterDefs) {
      const card = el('button', { class: `bb-booster bb-booster-${bd.effect}`, type: 'button' },
        el('span', { class: 'bb-booster-ico', 'aria-hidden': 'true' }, BOOSTER_ICON[bd.effect] || '✨'),
        el('strong', null, bd.name),
        el('small', null, bd.desc));
      card.addEventListener('click', () => {
        if (state.done) return;
        battle.command({ c: 'boost', k: bd.key, z: state.z });
        state.close();
      });
      wrap.append(card);
    }
    return wrap;
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

  function incomingLine() {
    if (!plan || !plan.kinds.length) return null;
    const parts = plan.kinds.map((k) => `${k.n} ${k.name} (${k.kind.toLowerCase()})`);
    return el('button', { class: 'bb-incoming', type: 'button', onclick: () => togglePanel('germs') },
      el('span', { 'aria-hidden': 'true' }, '\u{1F9A0} '), el('strong', null, `Incoming: ${plural(plan.waves.length, 'wave')}`), ` · ${parts.join(', ')}`, el('span', { class: 'bb-more' }, 'Details'));
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
          el('ol', { class: 'bb-steps bb-small' },
            el('li', null, el('strong', null, 'Scout: '), 'shaded bands show where each defence can hit.'),
            el('li', null, el('strong', null, 'Release germs: '), 'tap a germ card (hold for several). They enter at the mouth.'),
            el('li', null, el('strong', null, 'Use tactics: '), 'tap a tactic, then tap the gut.')),
          el('button', { class: 'bb-btn bb-primary bb-big', type: 'button', 'data-role': 'start', onclick: () => { phase = 'run'; last = performance.now(); audio.unlock(); audio.music(!audio.muted); renderBottom(); } }, 'Start raid')));
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
        const card = el('button', { class: 'bb-card', type: 'button', style: { '--grp': unitColor(gd, u.key) }, 'aria-label': `Deploy ${u.name} (${groupPlain(gd, u.group)}): ${u.how || ''}`, title: `${u.name} - ${groupPlain(gd, u.group)}. ${u.how || ''}` },
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
        const btn = el('button', { class: `bb-spell${targetingSpell === sp.key ? ' active' : ''}`, type: 'button', title: sp.desc, 'aria-label': `${sp.name}: ${sp.desc}`, onclick: () => {
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
        vacc.append(el('button', { class: `bb-btn${done ? ' bb-on' : ''}`, type: 'button', disabled: done, 'data-role': 'vaccinate', onclick: () => {
          if (sendCommand({ c: 'vaccinate', u: g })) {
            say(`Vaccinated against ${name}: those germs will arrive weaker`, 'good', 'vacc' + g, 0);
            emit('vaccinated', { germ: g });
          }
          renderBottom();
        } }, done ? `Vaccinated: ${name}` : `Vaccinate: ${name} (${setup.campaign.vaccineCost || 0})`));
      }
      bottom.append(el('div', { class: 'bb-bar bb-intro' },
        el('div', { class: 'bb-prep-text' },
          el('div', { class: 'bb-small' }, el('strong', null, 'Prepare: '), training ? 'tap a glowing site to build, then press Start.' : 'tap a glowing site to build. Waves begin when you press Start.'),
          incomingLine()),
        vacc,
        el('button', { class: 'bb-btn bb-primary bb-big', type: 'button', 'data-role': 'start', onclick: () => startCampaign() }, 'Start')));
      return;
    }
    const row = el('div', { class: 'bb-bar' });
    if (showStopflow) {
      const sfBtn = el('button', { class: 'bb-btn bb-stopflow', type: 'button', title: 'Loperamide slows the gut: less fluid loss, but invasive germs get trapped inside', onclick: () => {
        if (setup.patient === 'child') {
          say('Antimotility drugs such as loperamide are never given to children with acute diarrhoea', 'warn', 'sfchild', 4000);
          return;
        }
        battle.command({ c: 'stopflow' });
      } }, 'Stop-Flow (loperamide)');
      sfBtn.dataset.role = 'stopflow';
      row.append(sfBtn);
    }
    row.append(el('span', { class: 'bb-muted bb-small bb-hint' }, 'Tap a site to build or remove. The game pauses while you choose.'));
    bottom.append(row);
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

  function startCampaign() {
    phase = 'run';
    preview = null;
    closeSheet();
    closePanel();
    last = performance.now();
    audio.unlock();
    audio.music(!audio.muted);
    renderBottom();
    emit('started');
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
    emit('over', { result: r });
    if (coach) { coach.close(); coach = null; }
    let title;
    let sub;
    let good;
    if (defence) {
      good = !!r.survived;
      title = r.collapsed ? 'The patient collapsed from dehydration' : good ? 'The patient survived!' : 'The Bone Marrow Core fell';
      sub = r.collapsed ? 'Hydration reached zero.' : good ? `Lowest hydration ${r.hydrationMinPct}%.` : 'Germs reached the Core and destroyed it.';
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
      actions.append(el('button', { class: 'bb-btn bb-primary bb-big', type: 'button', onclick: () => finish() }, good ? 'See what you learned' : 'See what happened'));
    }
    overlay.replaceChildren(el('div', { class: `bb-dialog bb-over ${good ? 'good' : 'bad'}` }, el('h2', null, title), stars, el('p', null, sub), actions));
    overlay.hidden = false;
    if (mode !== 'replay') setTimeout(() => { if (!finished) finish(); }, 4500);
  }

  function finish() {
    if (finished) return;
    finished = true;
    if (props.onFinish) props.onFinish(battle.commands.slice(), { ...(battle.result || {}), hintsUsed: hintsShown });
  }

  // ---------------------------------------------------------------- go
  if (mode === 'campaign') refreshPreview();
  renderBottom();
  renderTools();
  const fitInsets = () => {
    const th = top.offsetHeight;
    if (objBar.isConnected) objBar.style.top = `${th + 2}px`;
    const oh = objBar.isConnected ? objBar.offsetHeight + 6 : 0;
    const bh = bottom.offsetHeight;
    panel.style.top = `${th + oh + 6}px`;
    root.style.setProperty('--hud-top', `${th + oh + 6}px`);
    root.style.setProperty('--hud-bottom', `${bottom.offsetHeight + 8}px`);
    panel.style.maxHeight = `calc(100% - ${th + oh + bh + 18}px)`;
    ticker.style.bottom = `${bh + 10}px`;
    scene.setInsets({ top: th + oh + 6, bottom: bh + 8 });
  };
  const hudRo = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fitInsets) : null;
  if (hudRo) {
    hudRo.observe(top);
    hudRo.observe(bottom);
    if (objBar.isConnected) hudRo.observe(objBar);
  }
  fitInsets();
  const onKey = (e) => {
    if (e.key === 'Escape') {
      if (!sheet.hidden) closeSheet();
      else if (!panel.hidden) closePanel();
      else if (targetingSpell) { targetingSpell = null; renderBottom(); }
    } else if (e.key === ' ' && mode !== 'attack' && document.activeElement === document.body) {
      e.preventDefault();
      togglePause();
    }
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('pointerup', stopHold);
  raf = requestAnimationFrame(frame);
  paintHud();

  if (mode === 'campaign' && level && props.mission && !props.scored && shouldCoach(level)) {
    setTimeout(() => {
      if (!alive || phase !== 'prep') return;
      const steps = missionSteps(level, {
        q: (sel) => root.querySelector(sel),
        site: (id) => siteRect(id),
        mouth: () => mouthRect(),
        has: (key) => hasBuilding(key),
        sheetOpen: () => !sheet.hidden,
        level,
      });
      if (!steps.length) return;
      coach = createCoach({
        steps,
        id: 'bb-coach',
        label: training ? 'Training' : `Mission ${props.missionNumber || ''}`.trim(),
        onDone: () => markMissionCoached(level),
        onSkip: () => { markMissionCoached(level); say('Tutorial skipped. You can replay it from your profile or the ? button.', 'info', 'skip', 0); },
      }).start();
    }, 600);
  } else if (mode === 'campaign' && plan && plan.kinds.length && !training && window.innerWidth >= 900 && !props.scored) {
    renderPanel('germs');
    paused = false;
    autoPaused = false;
  }

  if (window.__BB_DEBUG || /[?&]bbdebug(?:[=&]|$)/.test(location.search)) {
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
      get coach() { return coach; },
      get scene() { return scene; },
      siteRect,
    };
  }

  return {
    destroy() {
      alive = false;
      if (quiz && quiz.close) quiz.close();
      if (coach) coach.close();
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
