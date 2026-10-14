// Body Bastion deterministic battle simulation: exact mirror of app/sim.py (SPEC sections 1-6, 4.12).
// Integer-only and dependency-free; runs unchanged in browsers and Node. Gamedata is passed in.
// tools/parity_check.mjs proves bit-identical results against the Python implementation.

const HASH_MUL = 1000003;
const HASH_MOD = 1000000007;
const RNG_MOD = 2147483647;
const RNG_MUL = 48271;
export const PATH_LEN = 5200;

const SCALAR_STATS = [
  'wasted', 'unnecessary', 'totalShots', 'atpSpent', 'outOfAtp', 'collateral', 'cdiffSpawned',
  'candidaSpawned', 'cystsSpawned', 'floraLost', 'overgrowth', 'stopflowUses',
  'stopflowWithTrapped', 'trapTicks', 'hpyloriSingleDrugHits', 'neutralised', 'memoryHits',
  'biofilmBlocked', 'flushes', 'leakDrain', 'orsRefill', 'ivUsed', 'ivRefill', 'zincTicks',
  'liverDamage', 'wormStolen', 'macrophageTyphoidHits', 'built', 'sold', 'buildingsDestroyed',
];
const MAP_STATS = [
  'deployed', 'kills', 'shots', 'shotsOn', 'drugKills', 'towerKills', 'acidDamage',
  'vaccinatedSpawns', 'reachedLiver', 'spellsUsed', 'boosters',
];
const COMMANDS = ['deploy', 'spell', 'end', 'build', 'sell', 'rx', 'stopflow', 'vaccinate', 'boost'];

function div(a, b) {
  return Math.floor(a / b);
}

function mulpct(v, p) {
  return Math.floor((v * p) / 100);
}

function isqrt(n) {
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r--;
  while ((r + 1) * (r + 1) <= n) r++;
  return r;
}

function asInt(x) {
  return typeof x === 'number' && Number.isInteger(x) ? x : null;
}

function isObj(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function obj(x) {
  return isObj(x) ? x : {};
}

function own(o, k) {
  return Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function inc(m, k, v = 1) {
  m[k] = (Object.prototype.hasOwnProperty.call(m, k) ? m[k] : 0) + v;
}

function inc2(m, k1, k2) {
  let sub = Object.prototype.hasOwnProperty.call(m, k1) ? m[k1] : undefined;
  if (sub === undefined) {
    sub = {};
    m[k1] = sub;
  }
  sub[k2] = (Object.prototype.hasOwnProperty.call(sub, k2) ? sub[k2] : 0) + 1;
}

function mapGet(m, k, dflt) {
  const v = m.get(k);
  return v === undefined ? dflt : v;
}

class UnitDef {
  constructor(ud) {
    this.key = ud.key;
    this.group = ud.group;
    this.deployable = ud.deployable === true;
    this.spawnCount = ud.spawnCount !== undefined ? ud.spawnCount : 1;
    this.hp = ud.hp;
    this.speed = ud.speed;
    this.dmg = ud.dmg;
    this.interval = ud.interval;
    this.reach = ud.reach;
    const beh = ud.behaviour !== undefined ? ud.behaviour : 'march';
    this.drain = ud.drain !== undefined ? ud.drain : 0;
    this.acid = ud.acid !== undefined ? ud.acid : 0;
    this.vsWall = ud.vsWallPct !== undefined ? ud.vsWallPct : 100;
    this.zoneWall = obj(ud.zoneWallPct);
    this.vsBld = obj(ud.vsBuildingPct);
    const tags = Array.isArray(ud.tags) ? ud.tags : [];
    this.trapped = tags.includes('trapped');
    this.toxin = tags.includes('toxin');
    this.invasive = tags.includes('invasive');
    this.abxNotNeeded = ud.antibioticsNotNeeded === true;
    this.driller = beh === 'driller';
    this.slipper = beh === 'slipper';
    this.stalker = beh === 'stalker';
    this.side = beh === 'raider' || beh === 'driller' || beh === 'slipper';
    this.passer = beh === 'stalker' || beh === 'slipper';
    this.worm = this.key === 'worm';
  }
}

class Static {
  constructor(gd) {
    this.gd = gd;
    const m = gd.map;
    this.P = m.path.map((p) => [p[0] * 100, p[1] * 100]);
    const S = [0];
    for (let i = 0; i < this.P.length - 1; i++) {
      const [ax, ay] = this.P[i];
      const [bx, by] = this.P[i + 1];
      S.push(S[i] + Math.abs(bx - ax) + Math.abs(by - ay));
    }
    this.S = S;
    this.pathLen = S[S.length - 1];
    this.zones = m.zones;
    this.sites = m.sites;
    this.siteIndex = new Map();
    this.sitePos = [];
    this.siteS = [];
    this.sites.forEach((st, i) => {
      this.siteIndex.set(st.id, i);
      if (st.s !== undefined) {
        this.sitePos.push(this.posAt(st.s));
        this.siteS.push(st.s);
      } else {
        this.sitePos.push([st.x * 100, st.y * 100]);
        this.siteS.push(null);
      }
    });
    const [ex, ey] = this.posAt(this.pathLen);
    const coreSites = [];
    this.sites.forEach((st, i) => {
      if (st.zone === 'core') {
        const [px, py] = this.sitePos[i];
        coreSites.push([(px - ex) * (px - ex) + (py - ey) * (py - ey), i]);
      }
    });
    coreSites.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
    this.endOrder = coreSites.map((p) => p[1]);
    const blk = [];
    for (let i = 0; i < this.sites.length; i++) {
      if (this.siteS[i] !== null) blk.push([this.siteS[i], i]);
    }
    blk.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
    this.blockers = blk.map((p) => p[1]);
    this.covCache = new Map();
    this.sideCache = new Map();
    this.udefs = new Map();
    this.unitKeys = [];
    for (const ud of gd.units) {
      this.udefs.set(ud.key, new UnitDef(ud));
      this.unitKeys.push(ud.key);
    }
    this.bdefs = new Map();
    for (const bd of gd.buildings) this.bdefs.set(bd.key, bd);
    this.ddefs = new Map();
    this.drugKeys = [];
    for (const dd of gd.drugs) {
      this.ddefs.set(dd.key, dd);
      this.drugKeys.push(dd.key);
    }
    this.spells = new Map();
    this.spellKeys = [];
    for (const sp of gd.spells) {
      this.spells.set(sp.key, sp);
      this.spellKeys.push(sp.key);
    }
    const matrix = obj(gd.matrix);
    const mpct = obj(gd.matrixPct);
    const eff = obj(gd.effectPct);
    this.letter = new Map();
    this.dpct = new Map();
    for (const tk of this.unitKeys) {
      const row = obj(own(matrix, tk));
      const prow = obj(own(mpct, tk));
      const lrow = new Map();
      const prow2 = new Map();
      for (const dk of this.drugKeys) {
        let L = own(row, dk);
        if (typeof L !== 'string') L = 'N';
        lrow.set(dk, L);
        const p = own(prow, dk);
        prow2.set(dk, p !== undefined && p !== null ? p : (own(eff, L) !== undefined ? own(eff, L) : 0));
      }
      this.letter.set(tk, lrow);
      this.dpct.set(tk, prow2);
    }
  }

  posAt(s) {
    const L = this.pathLen;
    s = clamp(s, 0, L);
    const P = this.P;
    const S = this.S;
    const n = P.length - 1;
    for (let i = 0; i < n; i++) {
      if (s <= S[i + 1] || i === n - 1) {
        const off = s - S[i];
        const [ax, ay] = P[i];
        const [bx, by] = P[i + 1];
        const sx = Math.sign(bx - ax);
        const sy = Math.sign(by - ay);
        return [ax + sx * off, ay + sy * off];
      }
    }
    return P[0];
  }

  zoneOf(s) {
    for (const z of this.zones) {
      if (z.s0 <= s && s < z.s1) return z.key;
    }
    return null;
  }

  rangeIntervals(px, py, r) {
    const out = [];
    const P = this.P;
    const S = this.S;
    const rr = r * r;
    for (let i = 0; i < P.length - 1; i++) {
      const [xa, ya] = P[i];
      const [xb, yb] = P[i + 1];
      let s1;
      let s2;
      if (ya === yb) {
        const d = ya - py;
        const rem = rr - d * d;
        if (rem < 0) continue;
        const w = isqrt(rem);
        const lo = Math.max(px - w, Math.min(xa, xb));
        const hi = Math.min(px + w, Math.max(xa, xb));
        if (lo > hi) continue;
        if (xb > xa) {
          s1 = S[i] + (lo - xa);
          s2 = S[i] + (hi - xa);
        } else {
          s1 = S[i] + (xa - lo);
          s2 = S[i] + (xa - hi);
        }
      } else {
        const d = xa - px;
        const rem = rr - d * d;
        if (rem < 0) continue;
        const w = isqrt(rem);
        const lo = Math.max(py - w, Math.min(ya, yb));
        const hi = Math.min(py + w, Math.max(ya, yb));
        if (lo > hi) continue;
        if (yb > ya) {
          s1 = S[i] + (lo - ya);
          s2 = S[i] + (hi - ya);
        } else {
          s1 = S[i] + (ya - lo);
          s2 = S[i] + (ya - hi);
        }
      }
      if (s1 <= s2) out.push([s1, s2]);
      else out.push([s2, s1]);
    }
    out.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const iv of out) {
      if (merged.length && iv[0] <= merged[merged.length - 1][1] + 1) {
        if (iv[1] > merged[merged.length - 1][1]) merged[merged.length - 1][1] = iv[1];
      } else {
        merged.push([iv[0], iv[1]]);
      }
    }
    return merged;
  }

  coverage(idx, r) {
    const key = idx * 100000 + r;
    let cov = this.covCache.get(key);
    if (cov === undefined) {
      cov = new Uint8Array(this.pathLen + 1);
      const [px, py] = this.sitePos[idx];
      for (let [lo, hi] of this.rangeIntervals(px, py, r)) {
        lo = clamp(lo, 0, this.pathLen);
        hi = clamp(hi, 0, this.pathLen);
        if (lo <= hi) cov.fill(1, lo, hi + 1);
      }
      this.covCache.set(key, cov);
    }
    return cov;
  }

  sideTable(r) {
    let tab = this.sideCache.get(r);
    if (tab === undefined) {
      tab = new Array(this.pathLen + 1);
      for (let s = 0; s <= this.pathLen; s++) tab[s] = [];
      for (let idx = 0; idx < this.sites.length; idx++) {
        const [px, py] = this.sitePos[idx];
        for (const [lo, hi] of this.rangeIntervals(px, py, r)) {
          const a = clamp(lo, 0, this.pathLen);
          const b = clamp(hi, 0, this.pathLen);
          for (let s = a; s <= b; s++) tab[s].push(idx);
        }
      }
      this.sideCache.set(r, tab);
    }
    return tab;
  }
}

const STATIC_CACHE = new WeakMap();

function getStatic(gd) {
  let st = STATIC_CACHE.get(gd);
  if (st === undefined) {
    st = new Static(gd);
    STATIC_CACHE.set(gd, st);
  }
  return st;
}

export function pathLength(gd) {
  return getStatic(gd).pathLen;
}

export function posAt(gd, s) {
  const [x, y] = getStatic(gd).posAt(s);
  return { x, y };
}

export function rangeIntervals(gd, px, py, r) {
  return getStatic(gd).rangeIntervals(px, py, r);
}

export function zoneOf(gd, s) {
  return getStatic(gd).zoneOf(s);
}

export class Battle {
  constructor(gd, setup) {
    const st = getStatic(gd);
    this.gd = gd;
    this.st = st;
    setup = obj(setup);
    this.setup = setup;
    const um = gd.unitMods;
    this.um = um;
    this.events = [];
    this.mode = setup.mode === 'campaign' ? 'campaign' : 'attack';
    const mt = asInt(setup.maxTicks);
    this.maxTicks = mt !== null ? clamp(mt, 1, 100000) : gd.maxTicks;
    const p = setup.patient;
    this.patient = p === 'child' || p === 'adult' ? p : null;
    const de = obj(setup.defender);
    const at = obj(setup.attacker);
    const camp = this.mode === 'campaign' ? obj(setup.campaign) : {};
    this.campaign = camp;
    this.levelPct = gd.levelPct;
    this.maxLv = this.levelPct.length;
    const cl = asInt(de.coreLevel);
    this.coreLevel = cl !== null ? clamp(cl, 1, this.maxLv) : 1;
    this.tcells = obj(de.research).tcells === true;
    this.dewormed = de.dewormed === true;
    this.defBoost = de.boost === true;
    this.attBoost = at.boost === true;
    const atp = asInt(de.atp);
    this.atp = atp !== null ? clamp(atp, 0, 1000000000) : gd.defenderAtp.default;
    const pol = obj(de.policy);
    const sa = asInt(pol.stopflow_at);
    this.stopflowAt = sa !== null ? clamp(sa, 0, 100) : 0;
    const peyers = st.bdefs.get('peyers_patch') || {};
    this.memPct = peyers.memoryPctPerStack !== undefined ? peyers.memoryPctPerStack : 0;
    const memMax = peyers.memoryMaxStacks !== undefined ? peyers.memoryMaxStacks : 3;
    this.vaccines = {};
    this.memory = {};
    const vsrc = obj(de.vaccines);
    const msrc = obj(de.memory);
    for (const k of st.unitKeys) {
      let v = asInt(own(vsrc, k));
      if (v !== null && v > 0) this.vaccines[k] = clamp(v, 0, 100);
      v = asInt(own(msrc, k));
      if (v !== null && v > 0) this.memory[k] = clamp(v, 0, memMax);
    }
    this.resistance = {};
    const rsrc = obj(de.resistance);
    for (const k of st.drugKeys) {
      const v = asInt(own(rsrc, k));
      if (v !== null && v > 0) this.resistance[k] = clamp(v, 0, 100);
    }
    this.armyLeft = {};
    this.spellsLeft = {};
    if (this.mode === 'attack') {
      const asrc = obj(at.army);
      for (const k of st.unitKeys) {
        const v = asInt(own(asrc, k));
        if (v !== null && v > 0 && st.udefs.get(k).deployable) this.armyLeft[k] = clamp(v, 0, 10000);
      }
      const ssrc = obj(at.spells);
      for (const k of st.spellKeys) {
        const v = asInt(own(ssrc, k));
        if (v !== null && v > 0) this.spellsLeft[k] = clamp(v, 0, 10000);
      }
    }
    const bud = asInt(camp.budget);
    this.budget = bud !== null ? clamp(bud, 0, 1000000000) : 0;
    this.allowed = Array.isArray(camp.allowed) ? camp.allowed.filter((x) => typeof x === 'string') : [];
    this.allowedDrugs = Array.isArray(camp.allowedDrugs) ? camp.allowedDrugs.filter((x) => typeof x === 'string') : [];
    this.allowedVaccines = Array.isArray(camp.allowedVaccines) ? camp.allowedVaccines.filter((x) => typeof x === 'string') : [];
    const vc = asInt(camp.vaccineCost);
    this.vaccineCost = vc !== null ? clamp(vc, 0, 1000000000) : 0;

    // Checkpoints: the first germ to cross into each listed zone earns the player a knowledge
    // question; a correct answer (checked by the server) allows one 'boost' command there.
    const bst = obj(gd.boosters);
    const zstart = new Map();
    for (const z of gd.map.zones) zstart.set(z.key, z.s0);
    this.cpBounds = [];
    for (const cp of bst.checkpoints || []) {
      if (isObj(cp) && zstart.has(cp.zone)) this.cpBounds.push(zstart.get(cp.zone));
    }
    this.cpTick = this.cpBounds.map(() => -1);
    this.boostUsed = this.cpBounds.map(() => false);
    this.boostDefs = new Map();
    for (const bd of bst[this.mode === 'attack' ? 'attack' : 'defence'] || []) {
      if (isObj(bd) && typeof bd.key === 'string') this.boostDefs.set(bd.key, bd);
    }

    this.hydrationMax = gd.hydrationMax;
    this.tick = 0;
    this.hydration = this.hydrationMax;
    this.hydrationMin = this.hydrationMax;
    this.units = [];
    this.buildings = new Array(st.sites.length).fill(null);
    this.aliveCount = new Map();
    this.stopflowUntil = -1;
    this.stopflowReadyAt = 0;
    this.autoStopflowUsed = false;
    this.ppiUntil = -1;
    this.contaminatedUntil = -1;
    this.dome = null;
    this.dysbiosis = 0;
    this.pending = [];
    this.pressure = {};
    const stats = {};
    for (const k of SCALAR_STATS) stats[k] = 0;
    for (const k of MAP_STATS) stats[k] = {};
    stats.vaccinated = [];
    this.stats = stats;
    this.collapsed = false;
    this.coreDestroyed = false;
    this.surrendered = false;
    this.over = false;
    this.reason = null;
    this.result = null;
    this.hash = 0;
    this.commands = [];
    this.queue = [];
    this.qi = 0;

    this.waveAt = new Map();
    this.lastWaveTick = -1;
    const waves = Array.isArray(camp.waves) ? camp.waves : [];
    for (let w of waves) {
      w = obj(w);
      const u = w.u;
      if (typeof u !== 'string' || !st.udefs.has(u)) continue;
      const wt = asInt(w.t);
      let n = asInt(w.n);
      let gap = asInt(w.gap);
      if (wt === null || n === null || n < 1) continue;
      n = clamp(n, 0, 1000);
      if (gap === null) gap = 0;
      for (let i = 0; i < n; i++) {
        const tk = wt + i * gap;
        if (tk > this.lastWaveTick) this.lastWaveTick = tk;
        if (tk >= 0 && tk < this.maxTicks) {
          const lst = this.waveAt.get(tk);
          if (lst === undefined) this.waveAt.set(tk, [u]);
          else lst.push(u);
        }
      }
    }

    const layout = obj(de.layout);
    st.sites.forEach((site, idx) => {
      const e = own(layout, site.id);
      if (!isObj(e)) return;
      const key = e.b;
      if (typeof key !== 'string' || !st.bdefs.has(key)) return;
      if (!st.bdefs.get(key).sites.includes(site.kind)) return;
      let lv = asInt(e.lv);
      lv = lv !== null ? clamp(lv, 1, this.maxLv) : 1;
      this._place(idx, key, lv, e.drug, e.rx);
    });

    const seed = asInt(setup.seed);
    let state = seed !== null && seed >= 1 && seed < RNG_MOD ? seed : 1;
    for (const b of this.buildings) {
      if (b !== null && b.role === 'attack') {
        state = (state * RNG_MUL) % RNG_MOD;
        b.cd = state % b.interval;
      }
    }
    this.rng = state;
  }

  _reload(b) {
    const iv = b.interval;
    if (iv >= 3) {
      this.rng = (this.rng * RNG_MUL) % RNG_MOD;
      b.cd = iv - 2 + (this.rng % 3);
    } else {
      b.cd = iv - 1;
    }
  }

  _filterRx(rx) {
    if (!Array.isArray(rx)) return [];
    return rx.filter((k) => typeof k === 'string' && this.st.udefs.has(k));
  }

  _place(idx, key, lv, drug, rx) {
    const st = this.st;
    const site = st.sites[idx];
    const d = st.bdefs.get(key);
    const b = {};
    b.idx = idx;
    b.site = site.id;
    b.key = key;
    b.def = d;
    b.cat = d.cat;
    b.lv = lv;
    if (b.cat === 'core') {
      const hb = d.hpByLevel;
      b.maxHp = hb[clamp(lv, 1, hb.length) - 1];
    } else {
      b.maxHp = mulpct(d.hp, this.levelPct[lv - 1]);
    }
    b.hp = b.maxHp;
    [b.x, b.y] = st.sitePos[idx];
    b.s = st.siteS[idx];
    b.zone = site.zone;
    b.alive = true;
    b.removed = false;
    b.cd = 0;
    b.drug = null;
    b.dd = null;
    b.rx = [];
    b.collateralTaken = 0;
    b.lastCollateralTick = -1000000;
    b.ivUntil = -1;
    b.ivReadyAt = 0;
    b.role = null;
    b.cov = null;
    b.interval = 0;
    b.splash = d.splash === true;
    b.immune = false;
    b.factors = obj(d.factors);
    b.unitPct = obj(d.unitPct);
    if (b.cat === 'battery') {
      if (typeof drug === 'string' && st.ddefs.has(drug)) {
        b.drug = drug;
        b.dd = st.ddefs.get(drug);
        b.rx = this._filterRx(rx);
        b.role = 'attack';
        b.interval = b.dd.interval;
        b.cov = st.coverage(idx, b.dd.range);
      }
    } else if (b.cat === 'tower' || key === 'kupffer_gate') {
      b.role = 'attack';
      b.immune = true;
      b.interval = d.interval;
      b.cov = st.coverage(idx, d.range);
    } else if (key === 'acid_moat') {
      b.role = 'moat';
    } else if (key === 'peristalsis') {
      b.role = 'peri';
    } else if (key === 'flora_garden') {
      b.role = 'flora';
    }
    this.buildings[idx] = b;
    this.aliveCount.set(key, mapGet(this.aliveCount, key, 0) + 1);
    return b;
  }

  // ------------------------------------------------------------------ commands
  _queuedCount(c, field, value) {
    let n = 0;
    for (let i = this.qi; i < this.queue.length; i++) {
      const q = this.queue[i];
      if (q.c === c && q[field] === value) n += 1;
    }
    return n;
  }

  command(cmd) {
    if (this.over || !isObj(cmd)) return false;
    const c = cmd.c;
    if (!COMMANDS.includes(c)) return false;
    const st = this.st;
    const t = this.tick;
    if (c === 'deploy') {
      const u = cmd.u;
      if (this.mode !== 'attack' || typeof u !== 'string' || !st.udefs.has(u) || !st.udefs.get(u).deployable) return false;
      if (mapGetObj(this.armyLeft, u) - this._queuedCount('deploy', 'u', u) <= 0) return false;
    } else if (c === 'spell') {
      const k = cmd.k;
      const s = asInt(cmd.s);
      if (this.mode !== 'attack' || typeof k !== 'string' || !st.spells.has(k) || s === null) return false;
      if (s < 0 || s > st.pathLen) return false;
      if (mapGetObj(this.spellsLeft, k) - this._queuedCount('spell', 'k', k) <= 0) return false;
    } else if (c === 'end') {
      if (this.mode !== 'attack') return false;
    } else if (c === 'boost') {
      const k = cmd.k;
      const z = asInt(cmd.z);
      if (typeof k !== 'string' || !this.boostDefs.has(k) || z === null || z < 0 || z >= this.cpTick.length) return false;
      if (this.cpTick[z] < 0 || this.boostUsed[z] || this._queuedCount('boost', 'z', cmd.z) > 0) return false;
    } else {
      if (this.mode !== 'campaign') return false;
      if (c === 'build') {
        const b = cmd.b;
        const site = cmd.site;
        if (typeof site !== 'string' || !st.siteIndex.has(site)) return false;
        if (typeof b !== 'string' || !st.bdefs.has(b) || !this.allowed.includes(b)) return false;
        if (b === 'drug_battery' && !this.allowedDrugs.includes(cmd.drug)) return false;
      } else if (c === 'sell' || c === 'rx') {
        const site = cmd.site;
        if (typeof site !== 'string' || !st.siteIndex.has(site)) return false;
      } else if (c === 'stopflow') {
        if (this.patient === 'child' || t < this.stopflowReadyAt) return false;
      } else if (c === 'vaccinate') {
        const u = cmd.u;
        if (t !== 0 || typeof u !== 'string' || !this.allowedVaccines.includes(u)) return false;
      }
    }
    const q = Object.assign({}, cmd);
    q.t = t;
    this.commands.push(q);
    let pos = this.queue.length;
    while (pos > this.qi && this.queue[pos - 1].t > t) pos -= 1;
    this.queue.splice(pos, 0, q);
    return true;
  }

  loadCommands(commands) {
    if (!Array.isArray(commands)) commands = [];
    const keep = [];
    for (const cmd of commands) {
      if (!isObj(cmd)) continue;
      const t = asInt(cmd.t);
      if (t === null || t < 0 || t >= this.maxTicks) continue;
      keep.push([t, cmd]);
    }
    keep.sort((a, b) => a[0] - b[0]);
    this.commands = commands.slice();
    this.queue = [];
    for (const [t, cmd] of keep) {
      const q = Object.assign({}, cmd);
      q.t = t;
      this.queue.push(q);
    }
    this.qi = 0;
  }

  _apply(cmd, t) {
    const c = cmd.c;
    const st = this.st;
    if (c === 'deploy') {
      const u = cmd.u;
      if (this.mode !== 'attack' || typeof u !== 'string' || !st.udefs.has(u)) return;
      const ud = st.udefs.get(u);
      if (!ud.deployable || mapGetObj(this.armyLeft, u) <= 0) return;
      this.armyLeft[u] -= 1;
      const n = ud.spawnCount + (t < this.contaminatedUntil ? 1 : 0);
      for (let i = 0; i < n; i++) this._spawn(u, 0, false, 'deploy', t);
    } else if (c === 'spell') {
      const k = cmd.k;
      const s = asInt(cmd.s);
      if (this.mode !== 'attack' || typeof k !== 'string' || !st.spells.has(k) || s === null) return;
      if (s < 0 || s > st.pathLen || mapGetObj(this.spellsLeft, k) <= 0) return;
      this.spellsLeft[k] -= 1;
      const sp = st.spells.get(k);
      const dur = sp.duration !== undefined ? sp.duration : 0;
      const rad = sp.radius !== undefined ? sp.radius : 0;
      if (k === 'contaminated_water') {
        this.contaminatedUntil = t + dur;
      } else if (k === 'quorum_sensing') {
        for (const u of this.units) {
          if (u.alive && Math.abs(u.s - s) <= rad) u.quorumUntil = t + dur;
        }
      } else if (k === 'immune_evasion') {
        for (const u of this.units) {
          if (u.alive && Math.abs(u.s - s) <= rad) u.invisibleUntil = t + dur;
        }
      } else if (k === 'biofilm_dome') {
        this.dome = { s0: s - rad, s1: s + rad, until: t + dur };
      }
      inc(this.stats.spellsUsed, k);
      this.events.push({ type: 'spell', k, s });
    } else if (c === 'end') {
      if (this.mode === 'attack') this.surrendered = true;
    } else if (c === 'boost') {
      this._boost(cmd, t);
    } else if (this.mode !== 'campaign') {
      return;
    } else if (c === 'build') {
      this._cmdBuild(cmd, t);
    } else if (c === 'sell') {
      const site = cmd.site;
      if (typeof site !== 'string' || !st.siteIndex.has(site)) return;
      const b = this.buildings[st.siteIndex.get(site)];
      if (b === null || !b.alive || b.key === 'core') return;
      this.budget += mulpct(b.def.cost[0], this.gd.economy.campaignSellRefundPct);
      b.alive = false;
      b.removed = true;
      this.aliveCount.set(b.key, this.aliveCount.get(b.key) - 1);
      this.stats.sold += 1;
    } else if (c === 'rx') {
      const site = cmd.site;
      if (typeof site !== 'string' || !st.siteIndex.has(site)) return;
      const b = this.buildings[st.siteIndex.get(site)];
      const rx = cmd.rx;
      if (b === null || !b.alive || b.cat !== 'battery' || !Array.isArray(rx)) return;
      b.rx = this._filterRx(rx);
    } else if (c === 'stopflow') {
      this._stopflow(t);
    } else if (c === 'vaccinate') {
      const u = cmd.u;
      if (t !== 0 || typeof u !== 'string' || !this.allowedVaccines.includes(u)) return;
      const vd = own(obj(this.gd.vaccines), u);
      if (!isObj(vd) || !st.udefs.has(u)) return;
      if (this.stats.vaccinated.includes(u) || this.vaccineCost > this.budget) return;
      this.vaccines[u] = clamp(vd.efficacy, 0, 100);
      this.budget -= this.vaccineCost;
      this.stats.vaccinated.push(u);
    }
  }

  _boost(cmd, t) {
    const k = cmd.k;
    const z = asInt(cmd.z);
    if (typeof k !== 'string' || !this.boostDefs.has(k) || z === null || z < 0 || z >= this.cpTick.length) return;
    if (this.cpTick[z] < 0 || this.boostUsed[z]) return;
    this.boostUsed[z] = true;
    const bd = this.boostDefs.get(k);
    const eff = bd.effect;
    let pct = asInt(bd.pct);
    if (pct === null) pct = 0;
    let ticks = asInt(bd.ticks);
    if (ticks === null) ticks = 0;
    const until = t + ticks;
    if (eff === 'heal') {
      for (const u of this.units) {
        if (u.alive) u.hp = Math.min(u.maxHp, u.hp + mulpct(u.maxHp, pct));
      }
    } else if (eff === 'quorum') {
      for (const u of this.units) {
        if (u.alive && u.quorumUntil < until) u.quorumUntil = until;
      }
    } else if (eff === 'evasion') {
      for (const u of this.units) {
        if (u.alive && u.invisibleUntil < until) u.invisibleUntil = until;
      }
    } else if (eff === 'neutralise') {
      for (const u of this.units) {
        if (u.alive && u.neutralisedUntil < until) u.neutralisedUntil = until;
      }
    } else if (eff === 'rehydrate') {
      const h = this.hydration + mulpct(this.hydrationMax, pct);
      this.hydration = h < this.hydrationMax ? h : this.hydrationMax;
    } else if (eff === 'complement') {
      for (const u of this.units) {
        if (u.alive) {
          const dmg = mulpct(u.maxHp, pct);
          this._damageUnit(u, dmg > 0 ? dmg : 1, t, 'booster', null);
        }
      }
    }
    inc(this.stats.boosters, k);
    this.events.push({ type: 'boost', k, z, effect: eff });
  }

  _cross(prev, s, t) {
    const cb = this.cpBounds;
    for (let i = 0; i < cb.length; i++) {
      if (this.cpTick[i] < 0 && prev < cb[i] && cb[i] <= s) {
        this.cpTick[i] = t;
        this.events.push({ type: 'checkpoint', z: i });
      }
    }
  }

  _cmdBuild(cmd, t) {
    const st = this.st;
    const site = cmd.site;
    const key = cmd.b;
    if (typeof site !== 'string' || !st.siteIndex.has(site)) return;
    if (typeof key !== 'string' || !st.bdefs.has(key) || !this.allowed.includes(key)) return;
    const idx = st.siteIndex.get(site);
    const old = this.buildings[idx];
    if (old !== null && old.alive) return;
    const d = st.bdefs.get(key);
    const sdef = st.sites[idx];
    if (!d.sites.includes(sdef.kind)) return;
    const zones = d.zones;
    if (zones !== null && zones !== undefined && !zones.includes(sdef.zone)) return;
    const mc = d.maxCount;
    if (mapGet(this.aliveCount, key, 0) >= mc[this.coreLevel - 1]) return;
    const cost = d.cost[0];
    if (cost > this.budget) return;
    const drug = cmd.drug;
    if (key === 'drug_battery' && (typeof drug !== 'string' || !this.allowedDrugs.includes(drug) || !st.ddefs.has(drug))) return;
    this.budget -= cost;
    this._place(idx, key, 1, drug, cmd.rx);
    this.stats.built += 1;
  }

  _stopflow(t) {
    if (this.patient === 'child' || t < this.stopflowReadyAt) return false;
    const sf = this.gd.stopflow;
    this.stopflowUntil = t + sf.duration;
    this.stopflowReadyAt = t + sf.duration + sf.cooldown;
    this.stats.stopflowUses += 1;
    for (const u of this.units) {
      if (u.alive && u.d.trapped) {
        this.stats.stopflowWithTrapped += 1;
        break;
      }
    }
    this.events.push({ type: 'stopflow' });
    return true;
  }

  // ------------------------------------------------------------------ spawning
  _spawn(utype, s, scripted, origin, t) {
    const d = this.st.udefs.get(utype);
    const um = this.um;
    const stats = this.stats;
    let hp = d.hp;
    if (this.mode === 'attack' && this.attBoost && (origin === 'deploy' || origin === 'wave')) {
      hp = mulpct(hp, um.attackBoostHpPct);
    }
    let vacc = false;
    const eff = own(this.vaccines, utype) !== undefined ? this.vaccines[utype] : 0;
    if (eff > 0) {
      hp = mulpct(hp, 100 - div(eff, 2));
      vacc = true;
      inc(stats.vaccinatedSpawns, utype);
    }
    let over = false;
    if (utype === 'candida' && mapGet(this.aliveCount, 'flora_garden', 0) <= 0) {
      hp = mulpct(hp, um.overgrowthPct);
      over = true;
      stats.overgrowth += 1;
    }
    if (utype === 'worm' && this.dewormed) hp = mulpct(hp, um.dewormedWormHpPct);
    const u = {
      id: this.units.length,
      type: utype,
      d,
      s,
      hp,
      maxHp: hp,
      cd: 0,
      alive: true,
      state: 'move',
      neutralisedUntil: -1,
      invisibleUntil: -1,
      quorumUntil: -1,
      vaccinated: vacc,
      overgrowth: over,
      reachedLiver: false,
      scripted,
    };
    this.units.push(u);
    if (origin === 'deploy' || origin === 'wave') {
      inc(stats.deployed, utype);
    } else if (origin === 'flora') {
      if (utype === 'cdiff') stats.cdiffSpawned += 1;
      else if (utype === 'candida') stats.candidaSpawned += 1;
    } else if (origin === 'cyst') {
      stats.cystsSpawned += 1;
    }
    this.events.push({ type: 'spawn', u: u.id });
    return u;
  }

  // ------------------------------------------------------------------ step
  step() {
    if (this.over) return;
    this.events = [];
    const t = this.tick;
    const wl = this.waveAt.get(t);
    if (wl !== undefined) {
      for (const ut of wl) this._spawn(ut, 0, true, 'wave', t);
    }
    const q = this.queue;
    while (this.qi < q.length && q[this.qi].t < t) this.qi += 1;
    while (this.qi < q.length && q[this.qi].t === t) {
      const cmd = q[this.qi];
      this.qi += 1;
      this._apply(cmd, t);
    }
    if (this.pending.length) {
      const keep = [];
      for (const p of this.pending) {
        if (p[0] === t) this._spawn(p[1], p[2], false, p[3], t);
        else if (p[0] > t) keep.push(p);
      }
      this.pending = keep;
    }
    const units = this.units;
    const nu = units.length;
    for (let i = 0; i < nu; i++) {
      const u = units[i];
      if (u.alive) this._unitTurn(u, t);
    }
    const live = units.filter((u) => u.alive);
    for (const b of this.buildings) {
      if (b !== null && b.alive) {
        const role = b.role;
        if (role === 'attack') this._attackTurn(b, t, live);
        else if (role === 'moat') this._moatTurn(b, t, live);
        else if (role === 'peri') this._periTurn(b, t, live);
        else if (role === 'flora') this._floraTurn(b, t, live);
      }
    }
    this._hydration(t);
    if (this.mode === 'attack' && this.stopflowAt > 0 && !this.autoStopflowUsed &&
        this.patient !== 'child' &&
        this.hydration * 100 <= this.stopflowAt * this.hydrationMax &&
        t >= this.stopflowReadyAt) {
      this._stopflow(t);
      this.autoStopflowUsed = true;
    }
    if ((t + 1) % 50 === 0) this._hashPoint(t);
    this.tick = t + 1;
    this._checkEnd();
  }

  run() {
    while (!this.over) this.step();
    return this.result;
  }

  // ------------------------------------------------------------------ units
  _unitTurn(u, t) {
    const d = u.d;
    const st = this.st;
    if (d.trapped && t < this.stopflowUntil) {
      u.hp = Math.min(u.maxHp, u.hp + this.um.trappedRegen);
      this.stats.trapTicks += 1;
    }
    if (u.cd > 0) u.cd -= 1;
    const L = st.pathLen;
    const bl = this.buildings;
    if (u.s >= L) {
      let tgt = null;
      for (const i of st.endOrder) {
        const b = bl[i];
        if (b !== null && b.alive) {
          tgt = b;
          break;
        }
      }
      if (tgt === null) {
        u.state = 'idle';
        return;
      }
      u.state = 'attack';
      if (u.cd === 0) this._hit(u, tgt, t);
      return;
    }
    if (d.side) {
      for (const i of st.sideTable(d.reach)[u.s]) {
        const b = bl[i];
        if (b !== null && b.alive && b.cat !== 'wall' && b.key !== 'kupffer_gate' &&
            (!d.slipper || b.zone === 'liver')) {
          u.state = 'attack';
          if (u.cd === 0) this._hit(u, b, t);
          return;
        }
      }
    }
    const um = this.um;
    let pct = 100;
    if (t < u.quorumUntil) pct = mulpct(pct, um.quorumSpeedPct);
    if (d.passer) {
      const win = um.passWallWindow;
      for (const i of st.blockers) {
        const b = bl[i];
        if (b !== null && b.alive && b.cat === 'wall' && Math.abs(b.s - u.s) <= win) {
          pct = mulpct(pct, um.passWallSpeedPct);
          break;
        }
      }
    }
    const move = Math.max(1, mulpct(d.speed, pct));
    let blk = null;
    for (const i of st.blockers) {
      const b = bl[i];
      if (b !== null && b.alive && b.s >= u.s) {
        if (b.key === 'kupffer_gate' || (b.cat === 'wall' && !d.passer)) {
          blk = b;
          break;
        }
      }
    }
    if (blk !== null && u.s + move >= blk.s - this.gd.contact) {
      const prev = u.s;
      u.s = Math.max(u.s, blk.s - this.gd.contact);
      this._cross(prev, u.s, t);
      u.state = 'attack';
      if (u.cd === 0) this._hit(u, blk, t);
      return;
    }
    const prev = u.s;
    u.s = Math.min(u.s + move, L);
    this._cross(prev, u.s, t);
    u.state = 'move';
    if (d.worm && t % um.wormStealEvery === 0) {
      const z = st.zoneOf(u.s);
      if (z === 'si' || z === 'colon') this.stats.wormStolen += 1;
    }
    if (!u.reachedLiver && u.s >= 4000) {
      u.reachedLiver = true;
      inc(this.stats.reachedLiver, u.type);
    }
  }

  _hit(u, b, t) {
    const d = u.d;
    const um = this.um;
    u.cd = d.interval - 1;
    let dmg = d.dmg;
    if (b.cat === 'wall') {
      const zp = own(d.zoneWall, b.zone);
      dmg = mulpct(dmg, zp !== undefined && zp !== null ? zp : d.vsWall);
    }
    const adp = b.def.attackerDmgPct;
    if (adp !== undefined && adp !== null) dmg = mulpct(dmg, adp);
    const vb = own(d.vsBld, b.key);
    if (vb !== undefined && vb !== null) dmg = mulpct(dmg, vb);
    if (d.driller) dmg = mulpct(dmg, b.zone === 'stomach' ? um.drillerStomachPct : um.drillerElsewherePct);
    if (d.stalker && (b.cat === 'core' || b.key === 'kupffer_gate')) dmg = mulpct(dmg, um.stalkerCorePct);
    const liver = d.slipper && b.zone === 'liver';
    if (liver) dmg = mulpct(dmg, um.slipperLiverPct);
    if (t < u.quorumUntil) dmg = mulpct(dmg, um.quorumDmgPct);
    if (d.trapped && t < this.stopflowUntil) dmg = mulpct(dmg, um.trappedDmgPct);
    if (u.overgrowth) dmg = mulpct(dmg, um.overgrowthPct);
    if (dmg < 1) dmg = 1;
    if (liver) this.stats.liverDamage += dmg;
    b.hp -= dmg;
    this.events.push({ type: 'hit', u: u.id, b: b.idx, dmg });
    if (b.hp <= 0) this._destroy(b, t);
  }

  _destroy(b, t) {
    b.hp = 0;
    b.alive = false;
    this.aliveCount.set(b.key, this.aliveCount.get(b.key) - 1);
    const stats = this.stats;
    if (b.cat !== 'wall') stats.buildingsDestroyed += 1;
    if (b.cat === 'core') this.coreDestroyed = true;
    this.events.push({ type: 'bdown', b: b.idx });
    if (b.key === 'flora_garden') {
      stats.floraLost += 1;
      if (b.collateralTaken > 0) {
        const fl = this.gd.flora;
        const s = b.s !== null ? b.s : 2700;
        for (let i = 0; i < fl.cdiffPerCollapse; i++) this.pending.push([t + 1, 'cdiff', s, 'flora']);
        for (let i = 0; i < fl.candidaPerCollapse; i++) this.pending.push([t + 1, 'candida', s, 'flora']);
        if (fl.cdiffPerCollapse > 0) this.events.push({ type: 'cdiff', s });
      }
    }
  }

  // ------------------------------------------------------------------ buildings
  _attackTurn(b, t, live) {
    if (b.cd > 0) {
      b.cd -= 1;
      return;
    }
    const cov = b.cov;
    if (b.immune) {
      if (b.splash) {
        const cands = live.filter((u) => u.alive && cov[u.s] && u.invisibleUntil <= t);
        if (!cands.length) return;
        this.events.push({ type: 'splash', b: b.idx, units: cands.map((u) => u.id) });
        for (const u of cands) this._immuneDamage(b, u, t);
      } else {
        let best = null;
        for (const u of live) {
          if (u.alive && cov[u.s] && u.invisibleUntil <= t && (best === null || u.s > best.s)) best = u;
        }
        if (best === null) return;
        this._immuneDamage(b, best, t);
      }
    } else {
      const rx = b.rx;
      if (!rx.length) return;
      let best = null;
      for (const u of live) {
        if (u.alive && cov[u.s] && rx.includes(u.type) && (best === null || u.s > best.s)) best = u;
      }
      if (best === null) return;
      if (this.atp < b.dd.atp) {
        this.stats.outOfAtp += 1;
        return;
      }
      this._drugDamage(b, best, t);
    }
    this._reload(b);
  }

  _inDome(u, t) {
    const dm = this.dome;
    return dm !== null && t < dm.until && dm.s0 <= u.s && u.s <= dm.s1;
  }

  _immuneDamage(b, u, t) {
    const d = u.d;
    const T = u.type;
    const um = this.um;
    const def = b.def;
    let dmg = mulpct(def.dmg, this.levelPct[b.lv - 1]);
    const f = own(b.factors, d.group);
    dmg = mulpct(dmg, f !== undefined && f !== null ? f : 100);
    let up = own(b.unitPct, T);
    const macTyphoid = b.key === 'macrophage_tower' && T === 'typhoid';
    if (macTyphoid && this.tcells) {
      const tp = def.tcellTyphoidPct;
      if (tp !== undefined && tp !== null) up = tp;
    }
    if (up !== undefined && up !== null) dmg = mulpct(dmg, up);
    if (macTyphoid && !this.tcells) this.stats.macrophageTyphoidHits += 1;
    if (b.key === 'iga_cannon' && u.vaccinated) dmg = mulpct(dmg, def.vaccinatedPct);
    if (d.driller) dmg = mulpct(dmg, um.drillerImmunePct);
    const stacks = own(this.memory, T) !== undefined ? this.memory[T] : 0;
    if (stacks > 0 && mapGet(this.aliveCount, 'peyers_patch', 0) > 0) {
      dmg = mulpct(dmg, 100 + this.memPct * stacks);
      this.stats.memoryHits += 1;
    }
    if (this._inDome(u, t)) dmg = mulpct(dmg, um.biofilmImmunePct);
    if (this.defBoost) dmg = mulpct(dmg, um.defenceBoostDmgPct);
    if (!b.splash) this.events.push({ type: 'shot', b: b.idx, u: u.id, dmg });
    this._damageUnit(u, dmg, t, 'building', b);
    if (b.key === 'iga_cannon') {
      u.neutralisedUntil = t + def.neutraliseTicks;
      this.stats.neutralised += 1;
    }
  }

  _drugDamage(b, u, t) {
    const st = this.st;
    const stats = this.stats;
    const um = this.um;
    const D = b.drug;
    const dd = b.dd;
    const T = u.type;
    const L = st.letter.get(T).get(D);
    const pct = st.dpct.get(T).get(D);
    let dmg = mulpct(mulpct(dd.dmg, this.levelPct[b.lv - 1]), pct);
    let R = own(this.resistance, D) !== undefined ? this.resistance[D] : 0;
    const qf = dd.quadrupleFromLevel;
    if (qf !== undefined && qf !== null && b.lv >= qf) R = div(R, 2);
    dmg = mulpct(dmg, 100 - R);
    if (this._inDome(u, t)) {
      const before = dmg;
      dmg = mulpct(dmg, um.biofilmDrugPct);
      stats.biofilmBlocked += before - dmg;
    }
    if (this.defBoost) dmg = mulpct(dmg, um.defenceBoostDmgPct);
    const cost = dd.atp;
    this.atp -= cost;
    stats.atpSpent += cost;
    stats.totalShots += 1;
    inc2(stats.shots, D, L);
    inc2(stats.shotsOn, T, L);
    if (L === 'N' || L === 'X' || u.d.abxNotNeeded) stats.unnecessary += 1;
    if (L === 'N') stats.wasted += 1;
    const pl = own(this.gd.pressure, L);
    inc(this.pressure, D, pl !== undefined ? pl : 0);
    if (T === 'hpylori' && D !== 'hpylori_combo') {
      stats.hpyloriSingleDrugHits += 1;
      const hp = own(this.gd.hpyloriSingleDrugPressure, D);
      if (hp !== undefined && hp !== null) inc(this.pressure, 'hpylori_combo', hp);
    }
    let c = dd.collateral !== undefined ? dd.collateral : 0;
    if (c > 0) {
      if (t < this.ppiUntil) c = mulpct(c, um.ppiCollateralPct);
      this._collateral(c, t);
    }
    const pt = dd.ppiTicks;
    if (pt !== undefined && pt !== null) this.ppiUntil = t + pt;
    this.events.push({ type: 'shot', b: b.idx, u: u.id, dmg, letter: L });
    this._damageUnit(u, dmg, t, 'battery', b);
  }

  _collateral(c, t) {
    this.stats.collateral += c;
    const fl = this.gd.flora;
    if (mapGet(this.aliveCount, 'flora_garden', 0) > 0) {
      const per = c * fl.collateralHp;
      for (const b of this.buildings) {
        if (b !== null && b.alive && b.key === 'flora_garden') {
          b.hp -= per;
          b.collateralTaken += c;
          b.lastCollateralTick = t;
          if (b.hp <= 0) this._destroy(b, t);
        }
      }
    } else {
      this.dysbiosis += c;
      const every = fl.noGardenEvery;
      if (every > 0) {
        while (this.dysbiosis >= every) {
          this.dysbiosis -= every;
          this.pending.push([t + 1, 'cdiff', 2700, 'flora']);
          this.events.push({ type: 'cdiff', s: 2700 });
        }
      }
    }
  }

  _damageUnit(u, dmg, t, kind, b) {
    if (dmg <= 0) return;
    u.hp -= dmg;
    if (u.hp <= 0) {
      u.hp = 0;
      u.alive = false;
      const T = u.type;
      const stats = this.stats;
      inc(stats.kills, T);
      if (kind === 'battery') inc2(stats.drugKills, b.drug, T);
      else if (kind === 'building') inc2(stats.towerKills, b.key, T);
      this.events.push({ type: 'kill', u: u.id, by: b ? b.idx : -1, kind });
      if (T === 'amoeba') {
        for (let i = 0; i < this.gd.amoebaCyst.perDeath; i++) this.pending.push([t + 1, 'amoeba_cyst', u.s, 'cyst']);
      }
    }
  }

  _moatTurn(b, t, live) {
    const def = b.def;
    if (t % def.interval !== 0) return;
    const base = mulpct(def.dmg, this.levelPct[b.lv - 1]);
    const s0 = def.s0;
    const s1 = def.s1;
    const ppi = t < this.ppiUntil;
    const ppiPct = this.um.ppiAcidPct;
    const acid = this.stats.acidDamage;
    this.events.push({ type: 'acid', b: b.idx });
    for (const u of live) {
      if (u.alive && s0 <= u.s && u.s < s1) {
        let dd = mulpct(base, u.d.acid);
        if (ppi) dd = mulpct(dd, ppiPct);
        if (dd > 0) {
          this._damageUnit(u, dd, t, 'acid', b);
          inc(acid, u.type, dd);
        }
      }
    }
  }

  _periTurn(b, t, live) {
    if (t < this.stopflowUntil || t <= 0) return;
    const def = b.def;
    if (t % def.intervalByLevel[b.lv - 1] !== 0) return;
    const s0 = def.s0;
    const s1 = def.s1;
    const base = def.flushByLevel[b.lv - 1];
    this.events.push({ type: 'flush', b: b.idx });
    for (const u of live) {
      if (u.alive && s0 <= u.s && u.s < s1 && u.state === 'move') {
        let dd = base;
        if (u.d.worm) dd = mulpct(dd, def.wormFlushPct);
        else if (u.d.invasive) dd = mulpct(dd, def.invasiveFlushPct);
        this._damageUnit(u, dd, t, 'flush', b);
        this.stats.flushes += 1;
      }
    }
  }

  _floraTurn(b, t, live) {
    const def = b.def;
    if (t - b.lastCollateralTick >= def.regenQuietTicks) b.hp = Math.min(b.maxHp, b.hp + def.regen);
    if (t % def.colonisationEvery === 0 && b.hp * 2 >= b.maxHp) {
      const dmg = mulpct(def.colonisationDmg, this.levelPct[b.lv - 1]);
      const targets = def.colonisationTargets;
      for (const u of live) {
        if (u.alive && targets.includes(u.type) && u.s >= 2700 && u.s < 4000) {
          this._damageUnit(u, dmg, t, 'colonisation', b);
        }
      }
    }
  }

  // ------------------------------------------------------------------ hydration
  _hydration(t) {
    const st = this.st;
    const gd = this.gd;
    const hmax = this.hydrationMax;
    const stats = this.stats;
    let drain = 0;
    const iga = st.bdefs.get('iga_cannon') || {};
    const ndp = iga.neutralisedDrainPct !== undefined ? iga.neutralisedDrainPct : 100;
    const units = this.units;
    for (const u of units) {
      if (u.alive && u.d.drain > 0 && u.s >= 1000) {
        let d = u.d.drain;
        if (t < u.neutralisedUntil) d = mulpct(d, ndp);
        if (u.vaccinated) d = mulpct(d, 100 - (own(this.vaccines, u.type) !== undefined ? this.vaccines[u.type] : 0));
        drain += d;
      }
    }
    const orsDef = st.bdefs.get('ors_station');
    const zincFrom = orsDef.zincFromLevel;
    let zinc = false;
    for (const b of this.buildings) {
      if (b === null || !b.alive) continue;
      if (b.key === 'villi_wall') {
        const lr = b.def.leakRange;
        for (const u of units) {
          if (u.alive && u.d.toxin && Math.abs(u.s - b.s) <= lr) {
            drain += b.def.leak;
            stats.leakDrain += b.def.leak;
            break;
          }
        }
      } else if (b.key === 'ors_station' && b.lv >= zincFrom) {
        zinc = true;
      }
    }
    if (drain > 0) {
      if (zinc && this.patient !== 'adult') {
        drain = mulpct(drain, orsDef.zincDrainPct);
        stats.zincTicks += 1;
      }
      if (t < this.stopflowUntil) drain = mulpct(drain, gd.stopflow.drainPct);
    }
    let h = this.hydration;
    const severe = h * 100 < orsDef.severeBelowPct * hmax;
    let ors = 0;
    let iv = 0;
    for (const b of this.buildings) {
      if (b === null || !b.alive) continue;
      if (b.key === 'ors_station') {
        let r = b.def.refillByLevel[b.lv - 1];
        if (severe) r = mulpct(r, orsDef.severeOrsPct);
        ors += r;
      } else if (b.key === 'iv_drip') {
        const dv = b.def;
        if (t < b.ivUntil) {
          if (h * 100 >= dv.stopAbovePct * hmax) b.ivUntil = t;
          else iv += dv.refillByLevel[b.lv - 1];
        } else if (t >= b.ivReadyAt && h * 100 < dv.triggerBelowPct * hmax) {
          b.ivUntil = t + dv.maxActiveTicks;
          b.ivReadyAt = t + dv.maxActiveTicks + dv.cooldown;
          stats.ivUsed += 1;
          iv += dv.refillByLevel[b.lv - 1];
          this.events.push({ type: 'iv', b: b.idx });
        }
      }
    }
    stats.orsRefill += ors;
    stats.ivRefill += iv;
    h = h - drain + ors + iv;
    if (h < 0) h = 0;
    else if (h > hmax) h = hmax;
    this.hydration = h;
    if (h < this.hydrationMin) this.hydrationMin = h;
    if (h === 0 && drain > 0) {
      if (!this.collapsed) this.events.push({ type: 'collapse' });
      this.collapsed = true;
    }
  }

  // ------------------------------------------------------------------ hash / end
  _hashPoint(t) {
    let h = this.hash;
    h = (h * HASH_MUL + t) % HASH_MOD;
    h = (h * HASH_MUL + this.hydration) % HASH_MOD;
    for (const u of this.units) {
      h = (h * HASH_MUL + u.id) % HASH_MOD;
      h = (h * HASH_MUL + u.s) % HASH_MOD;
      h = (h * HASH_MUL + (u.hp > 0 ? u.hp : 0)) % HASH_MOD;
      h = (h * HASH_MUL + (u.alive ? 1 : 0)) % HASH_MOD;
    }
    for (const b of this.buildings) {
      if (b !== null) {
        h = (h * HASH_MUL + (b.hp > 0 ? b.hp : 0)) % HASH_MOD;
        h = (h * HASH_MUL + (b.alive ? 1 : 0)) % HASH_MOD;
      }
    }
    this.hash = h;
  }

  _checkEnd() {
    let reason = null;
    if (this.collapsed) {
      reason = 'collapse';
    } else if (this.mode === 'attack' && !this._anyDestructibleAlive()) {
      reason = 'destroyed';
    } else if (this.mode === 'campaign' && this.coreDestroyed) {
      reason = 'core';
    } else if (this.surrendered) {
      reason = 'surrender';
    } else if (this.tick >= this.maxTicks) {
      reason = 'time';
    } else if (!this.pending.length && !this._anyUnitAlive()) {
      let done;
      if (this.mode === 'attack') {
        done = true;
        for (const k of this.st.unitKeys) {
          if (mapGetObj(this.armyLeft, k) !== 0) {
            done = false;
            break;
          }
        }
      } else {
        done = this.tick > this.lastWaveTick;
      }
      if (done) reason = 'exhausted';
    }
    if (reason !== null) {
      this.over = true;
      this.reason = reason;
      this._hashPoint(this.tick);
      this.result = this._buildResult();
    }
  }

  _anyUnitAlive() {
    for (const u of this.units) if (u.alive) return true;
    return false;
  }

  _anyDestructibleAlive() {
    for (const b of this.buildings) {
      if (b !== null && !b.removed && b.cat !== 'wall' && b.alive) return true;
    }
    return false;
  }

  _buildResult() {
    let total = 0;
    let destroyed = 0;
    let coreAlive = false;
    const destroyedSites = [];
    const standingSites = [];
    for (const b of this.buildings) {
      if (b === null || b.removed) continue;
      if (b.alive) standingSites.push(b.site);
      else destroyedSites.push(b.site);
      if (b.cat !== 'wall') {
        total += 1;
        if (!b.alive) destroyed += 1;
      }
      if (b.cat === 'core' && b.alive) coreAlive = true;
    }
    const collapsed = this.collapsed;
    const pct = collapsed ? 100 : (total > 0 ? div(destroyed * 100, total) : 0);
    const coreDestroyed = this.coreDestroyed || collapsed;
    const stars = collapsed ? 3 : (pct >= 50 ? 1 : 0) + (coreDestroyed ? 1 : 0) + (pct === 100 ? 1 : 0);
    const ticks = this.tick;
    const timeLeft = stars === 3 && ticks <= this.maxTicks ? div(this.maxTicks - ticks, this.gd.tps) : 0;
    return {
      ticks,
      reason: this.reason,
      stars,
      pct,
      coreDestroyed,
      collapsed,
      survived: !collapsed && coreAlive,
      timeLeft,
      hydrationEnd: this.hydration,
      hydrationMin: this.hydrationMin,
      hydrationMinPct: div(this.hydrationMin * 100, this.hydrationMax),
      destroyedSites,
      standingSites,
      pressure: Object.assign({}, this.pressure),
      atpLeft: this.atp,
      budgetLeft: this.budget,
      stats: this.stats,
      checkpointTicks: this.cpTick.slice(),
      hash: this.hash,
    };
  }
}

function mapGetObj(o, k) {
  const v = own(o, k);
  return v === undefined ? 0 : v;
}

export function simulate(gd, setup, commands) {
  const b = new Battle(gd, setup);
  b.loadCommands(commands);
  return b.run();
}

function num(v) {
  const n = asInt(v);
  return n !== null ? n : 0;
}

export function evaluateObjectives(gd, objectives, result) {
  const out = [];
  result = obj(result);
  const survived = result.survived === true;
  const stats = obj(result.stats);
  const standing = Array.isArray(result.standingSites) ? result.standingSites : [];
  const destroyed = Array.isArray(result.destroyedSites) ? result.destroyedSites : [];
  for (let ob of Array.isArray(objectives) ? objectives : []) {
    ob = obj(ob);
    const k = ob.key;
    let ok = false;
    if (survived) {
      if (k === 'survive') {
        ok = true;
      } else if (k === 'max_unnecessary') {
        ok = num(stats.unnecessary) <= num(ob.n);
      } else if (k === 'max_wasted') {
        ok = num(stats.wasted) <= num(ob.n);
      } else if (k === 'max_shots') {
        ok = num(stats.totalShots) <= num(ob.n);
      } else if (k === 'min_hydration') {
        ok = num(result.hydrationMinPct) >= num(ob.pct);
      } else if (k === 'no_stopflow') {
        ok = num(stats.stopflowUses) === 0;
      } else if (k === 'killed_with') {
        const dk = obj(stats.drugKills);
        let n = 0;
        const drugs = Array.isArray(ob.drugs) ? ob.drugs : [];
        for (const d of drugs) {
          if (typeof d !== 'string') continue;
          const row = obj(own(dk, d));
          for (const v of Object.values(row)) n += num(v);
        }
        ok = n >= num(ob.n);
      } else if (k === 'building_standing') {
        const site = ob.site;
        ok = typeof site === 'string' && standing.includes(site) && !destroyed.includes(site);
      } else if (k === 'vaccinated') {
        const vl = Array.isArray(stats.vaccinated) ? stats.vaccinated : [];
        const germ = ob.germ;
        ok = typeof germ === 'string' && vl.includes(germ);
      } else if (k === 'max_stat') {
        const stat = ob.stat;
        const v = typeof stat === 'string' ? asInt(own(stats, stat)) : null;
        ok = v !== null && v <= num(ob.n);
      }
    }
    out.push(ok);
  }
  return out;
}

export function attackScore(gd, result, boostCorrect) {
  const sc = gd.scoring;
  result = obj(result);
  return sc.star * num(result.stars) + sc.pct * num(result.pct) + sc.secLeft * num(result.timeLeft) +
    (boostCorrect === true ? sc.boost : 0);
}

export function trialScore(gd, result, objectives) {
  const sc = gd.scoring.trial;
  const ppr = gd.resistance.pointsPerR;
  result = obj(result);
  const stats = obj(result.stats);
  let rpts = 0;
  for (const v of Object.values(obj(result.pressure))) rpts += div(Math.max(num(v), 0), ppr);
  const steward = sc.steward - sc.perUnnecessary * num(stats.unnecessary) - sc.perResistancePoint * rpts;
  let met = 0;
  if (Array.isArray(objectives)) {
    const evs = evaluateObjectives(gd, objectives, result);
    objectives.forEach((ob, i) => { if (evs[i] && obj(ob).key !== 'survive') met += 1; });
  }
  return (result.survived === true ? sc.survive : 0) + sc.perHydrationPct * num(result.hydrationMinPct) +
    (sc.perObjective || 0) * met + (steward > 0 && result.survived === true ? steward : 0);
}

export const evaluate_objectives = evaluateObjectives;
