// Pure helpers shared by the shell screens. No DOM access here.

export const ROUTES = [
  { name: 'login', path: 'login', public: true, guestOnly: true },
  { name: 'register', path: 'register', public: true, guestOnly: true },
  { name: 'home', path: 'home' },
  { name: 'edit', path: 'edit' },
  { name: 'research', path: 'research' },
  { name: 'attack', path: 'attack' },
  { name: 'result', path: 'result', public: true },
  { name: 'campaign', path: 'campaign/:id?' },
  { name: 'league', path: 'league' },
  { name: 'clan', path: 'clan' },
  { name: 'leaderboards', path: 'leaderboards/:kind?' },
  { name: 'guide', path: 'guide/:tab?', public: true },
  { name: 'log', path: 'log/:kind?' },
  { name: 'replay', path: 'replay/:id', public: true },
  { name: 'classroom', path: 'classroom', roles: ['teacher', 'admin'] },
  { name: 'join', path: 'join/:code?', public: true },
  { name: 'projector', path: 'projector/:code', public: true, bare: true },
  { name: 'live', path: 'live', public: true, bare: true },
  { name: 'admin', path: 'admin/:tab?', roles: ['admin'] },
  { name: 'observer', path: 'observer', roles: ['observer', 'admin'] },
  { name: 'profile', path: 'profile' },
];

export function parseQuery(qs) {
  const out = {};
  if (!qs) return out;
  for (const part of qs.split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    const k = i < 0 ? part : part.slice(0, i);
    const v = i < 0 ? '' : part.slice(i + 1);
    try {
      out[decodeURIComponent(k.replace(/\+/g, ' '))] = decodeURIComponent(v.replace(/\+/g, ' '));
    } catch {
      out[k] = v;
    }
  }
  return out;
}

export function parseHash(hash, routes = ROUTES) {
  let raw = String(hash || '').replace(/^#/, '');
  let query = '';
  const qi = raw.indexOf('?');
  if (qi >= 0) {
    query = raw.slice(qi + 1);
    raw = raw.slice(0, qi);
  }
  const segs = raw.split('/').filter(Boolean);
  const q = parseQuery(query);
  if (!segs.length) return { name: 'home', route: routes.find((r) => r.name === 'home'), params: {}, query: q, path: '' };
  for (const route of routes) {
    const pat = route.path.split('/');
    if (pat[0] !== segs[0]) continue;
    const params = {};
    let ok = true;
    const required = pat.filter((p) => !p.endsWith('?')).length;
    if (segs.length < required || segs.length > pat.length) continue;
    for (let i = 1; i < pat.length; i++) {
      const p = pat[i];
      const seg = segs[i];
      if (p.startsWith(':')) {
        const key = p.replace(/^:/, '').replace(/\?$/, '');
        if (seg === undefined) {
          if (!p.endsWith('?')) { ok = false; break; }
        } else {
          try { params[key] = decodeURIComponent(seg); } catch { params[key] = seg; }
        }
      } else if (p !== seg) {
        ok = false;
        break;
      }
    }
    if (ok) return { name: route.name, route, params, query: q, path: segs.join('/') };
  }
  return { name: 'notfound', route: null, params: {}, query: q, path: segs.join('/') };
}

export function canAccess(route, user) {
  if (!route) return { ok: false, reason: 'notfound' };
  if (route.public) return { ok: true };
  if (!user) return { ok: false, reason: 'login' };
  if (route.roles && !route.roles.includes(user.role)) return { ok: false, reason: 'role' };
  return { ok: true };
}

export function mulpct(v, p) {
  return Math.floor((v * p) / 100);
}

export function indexGd(gd) {
  const by = (arr) => {
    const m = new Map();
    for (const x of arr || []) m.set(x.key !== undefined ? x.key : x.id, x);
    return m;
  };
  return {
    units: by(gd.units),
    drugs: by(gd.drugs),
    buildings: by(gd.buildings),
    research: by(gd.research),
    spells: by(gd.spells),
    sites: new Map((gd.map && gd.map.sites || []).map((s) => [s.id, s])),
    zones: new Map((gd.map && gd.map.zones || []).map((z) => [z.key, z])),
    campaign: new Map((gd.campaign || []).map((c) => [Number(c.id), c])),
    trials: new Map((gd.trials || []).map((t) => [t.id, t])),
    bases: new Map(((gd.tournament && gd.tournament.bases) || []).map((b) => [b.id, b])),
  };
}

const idxCache = new WeakMap();
export function idx(gd) {
  let v = idxCache.get(gd);
  if (!v) {
    v = indexGd(gd);
    idxCache.set(gd, v);
  }
  return v;
}

export function unitName(gd, key) {
  const u = idx(gd).units.get(key);
  return u ? u.name : key;
}

export function drugName(gd, key) {
  if (key === 'ors') return 'ORS + zinc';
  const d = idx(gd).drugs.get(key);
  return d ? d.name : key;
}

const SHORT_DRUG = {
  ors: 'ORS + zinc',
  ceftriaxone: 'Ceftriaxone',
  azithromycin: 'Azithromycin',
  fluoroquinolone: 'Ciprofloxacin',
  doxycycline: 'Doxycycline',
  metronidazole: 'Metronidazole',
  luminal_agent: 'Luminal agent',
  vanco_fidaxo: 'Oral vanco / fidaxo',
  hpylori_combo: 'H. pylori regimen',
  albendazole: 'Albendazole',
  antifungal: 'Antifungal',
};

export function shortDrugName(gd, key) {
  if (SHORT_DRUG[key]) return SHORT_DRUG[key];
  return drugName(gd, key);
}

export function buildingName(gd, key) {
  const b = idx(gd).buildings.get(key);
  return b ? b.name : key;
}

export function joinOr(list) {
  if (list.length <= 1) return list.join('');
  if (list.length === 2) return `${list[0]} or ${list[1]}`;
  return `${list.slice(0, -1).join(', ')} or ${list[list.length - 1]}`;
}

const STAT_SENTENCES = {
  hpyloriSingleDrugHits: (n) => (n === 0
    ? 'Never hit H. pylori with a single antibiotic (only the full regimen works).'
    : `Hit H. pylori with a single antibiotic no more than ${n} times.`),
  wormStolen: (n) => `Do not let the worms steal more than ${n} nutrients.`,
  collateral: (n) => `Keep antibiotic damage to the gut flora at or below ${n}.`,
  cdiffSpawned: (n) => (n === 0 ? 'Do not let C. difficile appear.' : `No more than ${n} C. difficile may appear.`),
  candidaSpawned: (n) => (n === 0 ? 'Do not let Candida overgrow.' : `No more than ${n} Candida may appear.`),
  floraLost: (n) => (n === 0 ? 'Do not lose any Gut Flora Garden.' : `Lose no more than ${n} Gut Flora Gardens.`),
  leakDrain: (n) => `Keep fluid leaking through the villi wall at or below ${n}.`,
  buildingsDestroyed: (n) => (n === 0 ? 'Do not lose a single building.' : `Lose no more than ${n} buildings.`),
  stopflowUses: (n) => (n === 0 ? 'Never use Stop-Flow (loperamide).' : `Use Stop-Flow no more than ${n} times.`),
  liverDamage: (n) => (n === 0 ? 'Do not let the liver gate take any abscess damage.' : `Keep liver damage at or below ${n}.`),
};

const STAT_LABELS = {
  wasted: 'wasted shots', unnecessary: 'unnecessary antibiotic shots', totalShots: 'drug shots', atpSpent: 'ATP spent',
  outOfAtp: 'shots missed for lack of ATP', collateral: 'flora damage', cdiffSpawned: 'C. difficile spawned',
  candidaSpawned: 'Candida spawned', cystsSpawned: 'amoeba cysts', floraLost: 'flora gardens lost',
  overgrowth: 'overgrown Candida', stopflowUses: 'Stop-Flow uses', trapTicks: 'ticks germs were trapped',
  hpyloriSingleDrugHits: 'single-drug hits on H. pylori', neutralised: 'germs neutralised by IgA', memoryHits: 'memory hits',
  biofilmBlocked: 'drug damage blocked by biofilm', flushes: 'peristalsis flushes', leakDrain: 'villi leak',
  orsRefill: 'ORS refill', ivUsed: 'IV drips started', ivRefill: 'IV refill', zincTicks: 'zinc ticks',
  liverDamage: 'liver damage', wormStolen: 'nutrients stolen by worms', macrophageTyphoidHits: 'macrophage hits on Typhoid',
  built: 'buildings built', sold: 'buildings sold', buildingsDestroyed: 'buildings destroyed',
};

export function statLabel(key) {
  return STAT_LABELS[key] || key.replace(/([A-Z])/g, ' $1').toLowerCase();
}

function siteBuildingName(gd, site, level) {
  const layout = level && (level.layout || (level.defender && level.defender.layout));
  const entry = layout && layout[site];
  if (entry) return buildingName(gd, entry.b);
  if (site === 'KUPF') return buildingName(gd, 'kupffer_gate');
  if (site === 'CORE') return buildingName(gd, 'core');
  if (site === 'MOAT') return buildingName(gd, 'acid_moat');
  if (site === 'PERI') return buildingName(gd, 'peristalsis');
  return 'building';
}

export function objectiveText(gd, obj, level) {
  if (!obj) return '';
  const n = obj.n;
  switch (obj.key) {
    case 'survive':
      return 'Keep the patient alive: the Bone Marrow Core must stand and hydration must never reach zero.';
    case 'max_unnecessary':
      return n === 0 ? 'Give no unnecessary antibiotic shots.' : `Fire no more than ${n} unnecessary antibiotic shots.`;
    case 'max_wasted':
      return n === 0 ? 'Waste no shots: never fire a drug at a germ it cannot treat.' : `Waste no more than ${n} shots on germs the drug cannot treat.`;
    case 'max_shots':
      return n === 0 ? 'Fire no drug shots at all: this patient needs no antibiotic.' : `Fire no more than ${n} drug shots in total.`;
    case 'min_hydration':
      return `Keep hydration at or above ${obj.pct}% the whole time.`;
    case 'no_stopflow':
      return 'Never use Stop-Flow (loperamide).';
    case 'killed_with': {
      const names = (obj.drugs || []).map((d) => shortDrugName(gd, d));
      return `Kill at least ${n} germ${n === 1 ? '' : 's'} with ${joinOr(names)}.`;
    }
    case 'building_standing':
      return `Keep the ${siteBuildingName(gd, obj.site, level)} (${obj.site}) standing.`;
    case 'vaccinated': {
      const r = (gd.research || []).find((x) => x.kind === 'vaccine' && x.germ === obj.germ);
      const vname = r ? r.name.replace(/\s*\(.*\)\s*$/, '') : `${unitName(gd, obj.germ)} vaccine`;
      return `Vaccinate against ${unitName(gd, obj.germ).replace(/ (Wave|Swarm|Flood|Raider|Stalker|Blob|Driller|Creeper|Titan|Phantom)$/, '')} (${vname}) before the waves arrive.`;
    }
    case 'max_stat': {
      const f = STAT_SENTENCES[obj.stat];
      if (f) return f(n);
      return n === 0 ? `Keep ${statLabel(obj.stat)} at zero.` : `Keep ${statLabel(obj.stat)} at or below ${n}.`;
    }
    default:
      return obj.key;
  }
}

export function levelUnlocked(level, campaignStars) {
  const id = Number(level.id !== undefined ? level.id : level);
  if (id === 1) return true;
  const prev = campaignStars ? campaignStars[String(id - 1)] : 0;
  return Number(prev || 0) >= 1;
}

export function armySpaceUsed(gd, army) {
  const units = idx(gd).units;
  let total = 0;
  for (const [k, n] of Object.entries(army || {})) {
    const u = units.get(k);
    if (u && n > 0) total += (u.space || 0) * n;
  }
  return total;
}

export function armyCost(gd, army) {
  return armySpaceUsed(gd, army) * ((gd.economy && gd.economy.trainingNutrientsPerSpace) || 0);
}

export function deployableUnits(gd, unlocked) {
  const set = unlocked ? new Set(unlocked) : null;
  return (gd.units || []).filter((u) => u.deployable && (!set || set.has(u.key)));
}

export function canAddUnit(gd, army, key, capacity) {
  const u = idx(gd).units.get(key);
  if (!u || !u.deployable) return false;
  return armySpaceUsed(gd, army) + u.space <= capacity;
}

export function clampArmy(gd, army, capacity, unlocked) {
  const out = {};
  let used = 0;
  for (const u of deployableUnits(gd, unlocked)) {
    let n = Math.max(0, Math.floor(Number((army || {})[u.key]) || 0));
    while (n > 0 && used + n * u.space > capacity) n--;
    if (n > 0) {
      out[u.key] = n;
      used += n * u.space;
    }
  }
  return out;
}

export function countBuildings(layout, key) {
  let n = 0;
  for (const e of Object.values(layout || {})) if (e && e.b === key) n++;
  return n;
}

export function firstLevelAllowing(def) {
  const mc = def.maxCount || [];
  for (let i = 0; i < mc.length; i++) if (mc[i] > 0) return i + 1;
  return null;
}

export function costText(cost) {
  return `${cost[0]} ATP + ${cost[1]} nutrients`;
}

export function affordable(resources, cost) {
  if (!resources) return false;
  return (resources.atp || 0) >= cost[0] && (resources.nutrients || 0) >= cost[1];
}

export function buildOptions(gd, state, siteId) {
  const site = idx(gd).sites.get(siteId);
  if (!site) return [];
  const coreLevel = (state.base && state.base.core_level) || 1;
  const layout = (state.base && state.base.layout) || {};
  const out = [];
  for (const def of gd.buildings || []) {
    if (def.key === 'core') continue;
    if (!(def.sites || []).includes(site.kind)) continue;
    if (def.zones && !def.zones.includes(site.zone)) continue;
    const max = (def.maxCount || [])[coreLevel - 1] || 0;
    const count = countBuildings(layout, def.key);
    const cost = def.cost || [0, 0];
    let reason = null;
    if (max === 0) {
      const lv = firstLevelAllowing(def);
      reason = lv ? `Needs Bone Marrow Core level ${lv}` : 'Not available';
    } else if (count >= max) {
      reason = `Limit reached (${count}/${max} at core level ${coreLevel})`;
    } else if (!affordable(state.resources, cost)) {
      reason = 'Not enough resources';
    }
    out.push({ def, count, max, cost, ok: !reason, reason });
  }
  return out;
}

export function maxLevel(gd) {
  return (gd.levelPct || []).length || 5;
}

export function upgradeInfo(gd, state, siteId) {
  const layout = (state.base && state.base.layout) || {};
  const coreLevel = (state.base && state.base.core_level) || 1;
  const entry = layout[siteId];
  if (!entry) return null;
  const def = idx(gd).buildings.get(entry.b);
  if (!def) return null;
  if (def.key === 'core') {
    const maxCore = ((gd.core && gd.core.upgradeCost) || []).length || 5;
    if (coreLevel >= maxCore) return { maxed: true, nextLv: null, cost: null, ok: false, reason: 'Maximum level' };
    const cost = gd.core.upgradeCost[coreLevel];
    const ok = affordable(state.resources, cost);
    return { maxed: false, nextLv: coreLevel + 1, cost, ok, reason: ok ? null : 'Not enough resources' };
  }
  const lv = entry.lv || 1;
  if (lv >= maxLevel(gd)) return { maxed: true, nextLv: null, cost: null, ok: false, reason: 'Maximum level' };
  const nextLv = lv + 1;
  const pct = gd.upgradeCostPct[nextLv - 1];
  const cost = [mulpct(def.cost[0], pct), mulpct(def.cost[1], pct)];
  if (nextLv > coreLevel) return { maxed: false, nextLv, cost, ok: false, reason: `Upgrade the Bone Marrow Core to level ${nextLv} first` };
  const ok = affordable(state.resources, cost);
  return { maxed: false, nextLv, cost, ok, reason: ok ? null : 'Not enough resources' };
}

export function refundFor(gd, def) {
  const pct = (gd.economy && gd.economy.sellRefundPct) || 0;
  return [mulpct(def.cost[0], pct), mulpct(def.cost[1], pct)];
}

export function buildingHp(gd, def, lv) {
  if (def.key === 'core') return (def.hpByLevel || [])[lv - 1] || 0;
  return mulpct(def.hp || 0, (gd.levelPct || [])[lv - 1] || 100);
}

export function researchStatus(gd, state, item) {
  const owned = (state.research || []).includes(item.key);
  if (owned) return { owned: true, ok: false, reason: 'Researched' };
  const layout = (state.base && state.base.layout) || {};
  let labLv = 0;
  for (const e of Object.values(layout)) if (e && e.b === item.lab) labLv = Math.max(labLv, e.lv || 1);
  if (labLv === 0) return { owned: false, ok: false, reason: `Build a ${buildingName(gd, item.lab)} first`, labLv };
  if (labLv < (item.labLevel || 1)) return { owned: false, ok: false, reason: `Needs ${buildingName(gd, item.lab)} level ${item.labLevel}`, labLv };
  if (item.requiresLevel && Number((state.campaign || {})[String(item.requiresLevel)] || 0) < 1) {
    return { owned: false, ok: false, reason: `Win campaign case ${item.requiresLevel} first`, labLv };
  }
  if (!affordable(state.resources, item.cost)) return { owned: false, ok: false, reason: 'Not enough resources', labLv };
  return { owned: false, ok: true, reason: null, labLv };
}

export function normalizeCards(raw) {
  const out = {};
  if (!raw) return out;
  let src = raw;
  if (!Array.isArray(src) && typeof src === 'object' && src.cards) src = src.cards;
  const add = (key, c) => {
    if (!key) return;
    if (typeof c === 'string') { out[key] = { key, title: key, text: c }; return; }
    if (!c || typeof c !== 'object') return;
    out[key] = {
      ...c,
      key,
      title: c.title || c.name || c.heading || key,
      text: c.text || c.body || c.why || c.explanation || c.summary || '',
      lesson: c.lesson || c.takeaway || c.teaching || c.point || c.learn || '',
      ref: c.ref || c.reference || c.source || '',
    };
  };
  if (Array.isArray(src)) for (const c of src) add(c && (c.key || c.id), c);
  else for (const [k, v] of Object.entries(src)) {
    if (k === 'version' || k === '_meta' || k === 'meta') continue;
    add(k, v);
  }
  return out;
}

export function boostSummary(gd, isDefence) {
  const um = gd.unitMods || {};
  if (isDefence) {
    return `A correct answer makes your towers and drugs hit ${Math.max(0, (um.defenceBoostDmgPct || 110) - 100)}% harder.`;
  }
  return `A correct answer gives your germs +${Math.max(0, (um.attackBoostHpPct || 110) - 100)}% health and +${(gd.scoring && gd.scoring.boost) || 0} score points.`;
}

export function rendererMode(setup) {
  return setup && setup.mode === 'campaign' ? 'campaign' : 'attack';
}

export function resultKind(mode) {
  if (mode === 'campaign' || mode === 'trial') return 'defence';
  return 'attack';
}

export function phaseText(phase) {
  switch (phase) {
    case 'closed': return 'The league is closed. Campaign and multiplayer are open as usual.';
    case 'practice': return 'Practice week: try the tournament bases and trials as often as you like. Nothing is scored yet.';
    case 'league': return 'League round: you get ONE scored attempt per tournament base and per Defence Trial. Practice runs are never scored.';
    case 'finished': return 'The league has finished. Final scores are frozen; practice runs are still open.';
    default: return '';
  }
}

export function questionParts(q) {
  if (!q) return null;
  const text = q.text || q.question || q.q || q.prompt || q.stem || '';
  let options = q.options || q.choices || q.answers || [];
  options = options.map((o) => (typeof o === 'string' ? o : (o && (o.text || o.label || o.option)) || String(o)));
  return { text, options };
}

export function stopflowOptions() {
  return [
    { value: 0, label: 'Off (never use loperamide)' },
    { value: 20, label: 'When hydration falls to 20%' },
    { value: 30, label: 'When hydration falls to 30%' },
    { value: 40, label: 'When hydration falls to 40%' },
  ];
}

export function displayResources(resources, production, elapsedSeconds) {
  if (!resources) return { atp: 0, nutrients: 0, cap: 0 };
  const cap = resources.cap || Infinity;
  const e = Math.max(0, elapsedSeconds || 0);
  const add = (base, perHour) => Math.min(cap, Math.max(base, base + Math.floor(((perHour || 0) * e) / 3600)));
  const p = production || {};
  return {
    atp: resources.atp >= cap ? resources.atp : add(resources.atp || 0, p.atp_per_hour),
    nutrients: resources.nutrients >= cap ? resources.nutrients : add(resources.nutrients || 0, p.nutrients_per_hour),
    cap: resources.cap,
  };
}
