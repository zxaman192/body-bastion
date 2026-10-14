"""Body Bastion authoritative deterministic battle simulation (SPEC sections 1-6, 4.12).

Integer-only and dependency-free. static/js/sim.js is a line-by-line mirror; both must
produce bit-identical results (checked by tools/parity_check.mjs).
"""
import math

HASH_MUL = 1000003
HASH_MOD = 1000000007
RNG_MOD = 2147483647
RNG_MUL = 48271
PATH_LEN = 5200

SCALAR_STATS = (
    'wasted', 'unnecessary', 'totalShots', 'atpSpent', 'outOfAtp', 'collateral', 'cdiffSpawned',
    'candidaSpawned', 'cystsSpawned', 'floraLost', 'overgrowth', 'stopflowUses',
    'stopflowWithTrapped', 'trapTicks', 'hpyloriSingleDrugHits', 'neutralised', 'memoryHits',
    'biofilmBlocked', 'flushes', 'leakDrain', 'orsRefill', 'ivUsed', 'ivRefill', 'zincTicks',
    'liverDamage', 'wormStolen', 'macrophageTyphoidHits', 'built', 'sold', 'buildingsDestroyed',
)
MAP_STATS = (
    'deployed', 'kills', 'shots', 'shotsOn', 'drugKills', 'towerKills', 'acidDamage',
    'vaccinatedSpawns', 'reachedLiver', 'spellsUsed', 'boosters',
)
COMMANDS = ('deploy', 'spell', 'end', 'build', 'sell', 'rx', 'stopflow', 'vaccinate', 'boost')


def div(a, b):
    return a // b


def mulpct(v, p):
    return v * p // 100


def isqrt(n):
    return math.isqrt(n)


def as_int(x):
    if type(x) is int:
        return x
    if type(x) is float and x.is_integer():
        return int(x)
    return None


def _obj(x):
    return x if isinstance(x, dict) else {}


def _clamp(v, lo, hi):
    return lo if v < lo else (hi if v > hi else v)


def _inc(m, k, v=1):
    m[k] = m.get(k, 0) + v


def _inc2(m, k1, k2):
    sub = m.get(k1)
    if sub is None:
        sub = {}
        m[k1] = sub
    sub[k2] = sub.get(k2, 0) + 1


class UnitDef:
    def __init__(self, ud):
        self.key = ud['key']
        self.group = ud['group']
        self.deployable = ud.get('deployable') is True
        self.spawn_count = ud.get('spawnCount', 1)
        self.hp = ud['hp']
        self.speed = ud['speed']
        self.dmg = ud['dmg']
        self.interval = ud['interval']
        self.reach = ud['reach']
        beh = ud.get('behaviour', 'march')
        self.drain = ud.get('drain', 0)
        self.acid = ud.get('acid', 0)
        self.vs_wall = ud.get('vsWallPct', 100)
        self.zone_wall = _obj(ud.get('zoneWallPct'))
        self.vs_bld = _obj(ud.get('vsBuildingPct'))
        tags = ud.get('tags') or []
        self.trapped = 'trapped' in tags
        self.toxin = 'toxin' in tags
        self.invasive = 'invasive' in tags
        self.abx_not_needed = ud.get('antibioticsNotNeeded') is True
        self.driller = beh == 'driller'
        self.slipper = beh == 'slipper'
        self.stalker = beh == 'stalker'
        self.side = beh == 'raider' or beh == 'driller' or beh == 'slipper'
        self.passer = beh == 'stalker' or beh == 'slipper'
        self.worm = self.key == 'worm'


class Static:
    """Per-gamedata precomputation: geometry, range coverage tables, definition lookups."""

    def __init__(self, gd):
        self.gd = gd
        m = gd['map']
        self.P = [(p[0] * 100, p[1] * 100) for p in m['path']]
        S = [0]
        for i in range(len(self.P) - 1):
            ax, ay = self.P[i]
            bx, by = self.P[i + 1]
            S.append(S[i] + abs(bx - ax) + abs(by - ay))
        self.S = S
        self.path_len = S[-1]
        self.zones = m['zones']
        self.sites = m['sites']
        self.site_index = {}
        self.site_pos = []
        self.site_s = []
        for i, st in enumerate(self.sites):
            self.site_index[st['id']] = i
            if 's' in st:
                self.site_pos.append(self.pos_at(st['s']))
                self.site_s.append(st['s'])
            else:
                self.site_pos.append((st['x'] * 100, st['y'] * 100))
                self.site_s.append(None)
        ex, ey = self.pos_at(self.path_len)
        core_sites = []
        for i, st in enumerate(self.sites):
            if st['zone'] == 'core':
                px, py = self.site_pos[i]
                core_sites.append(((px - ex) * (px - ex) + (py - ey) * (py - ey), i))
        core_sites.sort()
        self.end_order = [i for _, i in core_sites]
        blk = [(self.site_s[i], i) for i in range(len(self.sites)) if self.site_s[i] is not None]
        blk.sort()
        self.blockers = [i for _, i in blk]
        self.cov_cache = {}
        self.side_cache = {}
        self.udefs = {}
        self.unit_keys = []
        for ud in gd['units']:
            self.udefs[ud['key']] = UnitDef(ud)
            self.unit_keys.append(ud['key'])
        self.bdefs = {}
        for bd in gd['buildings']:
            self.bdefs[bd['key']] = bd
        self.ddefs = {}
        self.drug_keys = []
        for dd in gd['drugs']:
            self.ddefs[dd['key']] = dd
            self.drug_keys.append(dd['key'])
        self.spells = {}
        self.spell_keys = []
        for sp in gd['spells']:
            self.spells[sp['key']] = sp
            self.spell_keys.append(sp['key'])
        matrix = _obj(gd.get('matrix'))
        mpct = _obj(gd.get('matrixPct'))
        eff = _obj(gd.get('effectPct'))
        self.letter = {}
        self.dpct = {}
        for tk in self.unit_keys:
            row = _obj(matrix.get(tk))
            prow = _obj(mpct.get(tk))
            lrow = {}
            prow2 = {}
            for dk in self.drug_keys:
                L = row.get(dk)
                if not isinstance(L, str):
                    L = 'N'
                lrow[dk] = L
                p = prow.get(dk)
                prow2[dk] = p if p is not None else eff.get(L, 0)
            self.letter[tk] = lrow
            self.dpct[tk] = prow2

    def pos_at(self, s):
        L = self.path_len
        s = _clamp(s, 0, L)
        P = self.P
        S = self.S
        n = len(P) - 1
        for i in range(n):
            if s <= S[i + 1] or i == n - 1:
                off = s - S[i]
                ax, ay = P[i]
                bx, by = P[i + 1]
                sx = (bx > ax) - (bx < ax)
                sy = (by > ay) - (by < ay)
                return (ax + sx * off, ay + sy * off)
        return P[0]

    def zone_of(self, s):
        for z in self.zones:
            if z['s0'] <= s < z['s1']:
                return z['key']
        return None

    def range_intervals(self, px, py, r):
        out = []
        P = self.P
        S = self.S
        rr = r * r
        for i in range(len(P) - 1):
            xa, ya = P[i]
            xb, yb = P[i + 1]
            if ya == yb:
                d = ya - py
                rem = rr - d * d
                if rem < 0:
                    continue
                w = isqrt(rem)
                lo = max(px - w, min(xa, xb))
                hi = min(px + w, max(xa, xb))
                if lo > hi:
                    continue
                if xb > xa:
                    s1 = S[i] + (lo - xa)
                    s2 = S[i] + (hi - xa)
                else:
                    s1 = S[i] + (xa - lo)
                    s2 = S[i] + (xa - hi)
            else:
                d = xa - px
                rem = rr - d * d
                if rem < 0:
                    continue
                w = isqrt(rem)
                lo = max(py - w, min(ya, yb))
                hi = min(py + w, max(ya, yb))
                if lo > hi:
                    continue
                if yb > ya:
                    s1 = S[i] + (lo - ya)
                    s2 = S[i] + (hi - ya)
                else:
                    s1 = S[i] + (ya - lo)
                    s2 = S[i] + (ya - hi)
            if s1 <= s2:
                out.append([s1, s2])
            else:
                out.append([s2, s1])
        out.sort(key=lambda iv: iv[0])
        merged = []
        for iv in out:
            if merged and iv[0] <= merged[-1][1] + 1:
                if iv[1] > merged[-1][1]:
                    merged[-1][1] = iv[1]
            else:
                merged.append([iv[0], iv[1]])
        return merged

    def coverage(self, idx, r):
        key = idx * 100000 + r
        cov = self.cov_cache.get(key)
        if cov is None:
            cov = bytearray(self.path_len + 1)
            px, py = self.site_pos[idx]
            for lo, hi in self.range_intervals(px, py, r):
                lo = _clamp(lo, 0, self.path_len)
                hi = _clamp(hi, 0, self.path_len)
                if lo <= hi:
                    cov[lo:hi + 1] = b'\x01' * (hi - lo + 1)
            self.cov_cache[key] = cov
        return cov

    def side_table(self, r):
        tab = self.side_cache.get(r)
        if tab is None:
            tab = [()] * (self.path_len + 1)
            acc = {}
            for idx in range(len(self.sites)):
                px, py = self.site_pos[idx]
                for lo, hi in self.range_intervals(px, py, r):
                    for s in range(_clamp(lo, 0, self.path_len), _clamp(hi, 0, self.path_len) + 1):
                        lst = acc.get(s)
                        if lst is None:
                            acc[s] = [idx]
                        else:
                            lst.append(idx)
            for s, lst in acc.items():
                tab[s] = tuple(lst)
            self.side_cache[r] = tab
        return tab


_STATIC_CACHE = []


def get_static(gd):
    for g, st in _STATIC_CACHE:
        if g is gd:
            return st
    st = Static(gd)
    _STATIC_CACHE.append((gd, st))
    if len(_STATIC_CACHE) > 8:
        _STATIC_CACHE.pop(0)
    return st


def path_length(gd):
    return get_static(gd).path_len


def pos_at(gd, s):
    return get_static(gd).pos_at(s)


posAt = pos_at
pathLength = path_length


class Unit:
    __slots__ = ('id', 'type', 'd', 's', 'hp', 'maxHp', 'cd', 'alive', 'state', 'neutralisedUntil',
                 'invisibleUntil', 'quorumUntil', 'vaccinated', 'overgrowth', 'reachedLiver',
                 'scripted')


class Building:
    __slots__ = ('idx', 'site', 'key', 'defn', 'cat', 'lv', 'hp', 'maxHp', 'x', 'y', 's', 'zone',
                 'alive', 'removed', 'cd', 'drug', 'dd', 'rx', 'collateralTaken',
                 'lastCollateralTick', 'ivUntil', 'ivReadyAt', 'role', 'cov', 'interval', 'splash',
                 'immune', 'factors', 'unitPct')


class Battle:
    def __init__(self, gd, setup):
        st = get_static(gd)
        self.gd = gd
        self.st = st
        setup = _obj(setup)
        self.setup = setup
        um = gd['unitMods']
        self.um = um
        self.mode = 'campaign' if setup.get('mode') == 'campaign' else 'attack'
        mt = as_int(setup.get('maxTicks'))
        self.maxTicks = _clamp(mt, 1, 100000) if mt is not None else gd['maxTicks']
        p = setup.get('patient')
        self.patient = p if p == 'child' or p == 'adult' else None
        de = _obj(setup.get('defender'))
        at = _obj(setup.get('attacker'))
        camp = _obj(setup.get('campaign')) if self.mode == 'campaign' else {}
        self.campaign = camp
        self.level_pct = gd['levelPct']
        self.max_lv = len(self.level_pct)
        cl = as_int(de.get('coreLevel'))
        self.coreLevel = _clamp(cl, 1, self.max_lv) if cl is not None else 1
        self.tcells = _obj(de.get('research')).get('tcells') is True
        self.dewormed = de.get('dewormed') is True
        self.defBoost = de.get('boost') is True
        self.attBoost = at.get('boost') is True
        atp = as_int(de.get('atp'))
        self.atp = _clamp(atp, 0, 1000000000) if atp is not None else gd['defenderAtp']['default']
        pol = _obj(de.get('policy'))
        sa = as_int(pol.get('stopflow_at'))
        self.stopflowAt = _clamp(sa, 0, 100) if sa is not None else 0
        peyers = st.bdefs.get('peyers_patch', {})
        self.memPct = peyers.get('memoryPctPerStack', 0)
        mem_max = peyers.get('memoryMaxStacks', 3)
        self.vaccines = {}
        self.memory = {}
        vsrc = _obj(de.get('vaccines'))
        msrc = _obj(de.get('memory'))
        for k in st.unit_keys:
            v = as_int(vsrc.get(k))
            if v is not None and v > 0:
                self.vaccines[k] = _clamp(v, 0, 100)
            v = as_int(msrc.get(k))
            if v is not None and v > 0:
                self.memory[k] = _clamp(v, 0, mem_max)
        self.resistance = {}
        rsrc = _obj(de.get('resistance'))
        for k in st.drug_keys:
            v = as_int(rsrc.get(k))
            if v is not None and v > 0:
                self.resistance[k] = _clamp(v, 0, 100)
        self.armyLeft = {}
        self.spellsLeft = {}
        if self.mode == 'attack':
            asrc = _obj(at.get('army'))
            for k in st.unit_keys:
                v = as_int(asrc.get(k))
                if v is not None and v > 0 and st.udefs[k].deployable:
                    self.armyLeft[k] = _clamp(v, 0, 10000)
            ssrc = _obj(at.get('spells'))
            for k in st.spell_keys:
                v = as_int(ssrc.get(k))
                if v is not None and v > 0:
                    self.spellsLeft[k] = _clamp(v, 0, 10000)
        bud = as_int(camp.get('budget'))
        self.budget = _clamp(bud, 0, 1000000000) if bud is not None else 0
        self.allowed = [x for x in (camp.get('allowed') or []) if isinstance(x, str)] if isinstance(camp.get('allowed'), list) else []
        self.allowedDrugs = [x for x in camp.get('allowedDrugs') if isinstance(x, str)] if isinstance(camp.get('allowedDrugs'), list) else []
        self.allowedVaccines = [x for x in camp.get('allowedVaccines') if isinstance(x, str)] if isinstance(camp.get('allowedVaccines'), list) else []
        vc = as_int(camp.get('vaccineCost'))
        self.vaccineCost = _clamp(vc, 0, 1000000000) if vc is not None else 0

        # Checkpoints: the first germ to cross into each listed zone earns the player a knowledge
        # question; a correct answer (checked by the server) allows one 'boost' command there.
        bst = _obj(gd.get('boosters'))
        zstart = {}
        for z in gd['map']['zones']:
            zstart[z['key']] = z['s0']
        self.cpBounds = []
        for cp in bst.get('checkpoints') or []:
            if isinstance(cp, dict) and cp.get('zone') in zstart:
                self.cpBounds.append(zstart[cp['zone']])
        self.cpTick = [-1] * len(self.cpBounds)
        self.boostUsed = [False] * len(self.cpBounds)
        self.boostDefs = {}
        for bd in bst.get('attack' if self.mode == 'attack' else 'defence') or []:
            if isinstance(bd, dict) and isinstance(bd.get('key'), str):
                self.boostDefs[bd['key']] = bd

        self.hydrationMax = gd['hydrationMax']
        self.tick = 0
        self.hydration = self.hydrationMax
        self.hydrationMin = self.hydrationMax
        self.units = []
        self.buildings = [None] * len(st.sites)
        self.aliveCount = {}
        self.stopflowUntil = -1
        self.stopflowReadyAt = 0
        self.autoStopflowUsed = False
        self.ppiUntil = -1
        self.contaminatedUntil = -1
        self.dome = None
        self.dysbiosis = 0
        self.pending = []
        self.pressure = {}
        stats = {}
        for k in SCALAR_STATS:
            stats[k] = 0
        for k in MAP_STATS:
            stats[k] = {}
        stats['vaccinated'] = []
        self.stats = stats
        self.collapsed = False
        self.coreDestroyed = False
        self.surrendered = False
        self.over = False
        self.reason = None
        self.result = None
        self.hash = 0
        self.commands = []
        self.queue = []
        self.qi = 0

        self.waveAt = {}
        self.lastWaveTick = -1
        waves = camp.get('waves') if isinstance(camp.get('waves'), list) else []
        for w in waves:
            w = _obj(w)
            u = w.get('u')
            if not isinstance(u, str) or u not in st.udefs:
                continue
            wt = as_int(w.get('t'))
            n = as_int(w.get('n'))
            gap = as_int(w.get('gap'))
            if wt is None or n is None or n < 1:
                continue
            n = _clamp(n, 0, 1000)
            if gap is None:
                gap = 0
            for i in range(n):
                tk = wt + i * gap
                if tk > self.lastWaveTick:
                    self.lastWaveTick = tk
                if 0 <= tk < self.maxTicks:
                    lst = self.waveAt.get(tk)
                    if lst is None:
                        self.waveAt[tk] = [u]
                    else:
                        lst.append(u)

        layout = _obj(de.get('layout'))
        for idx, site in enumerate(st.sites):
            e = layout.get(site['id'])
            if not isinstance(e, dict):
                continue
            key = e.get('b')
            if not isinstance(key, str) or key not in st.bdefs:
                continue
            if site['kind'] not in st.bdefs[key]['sites']:
                continue
            lv = as_int(e.get('lv'))
            lv = _clamp(lv, 1, self.max_lv) if lv is not None else 1
            drug = e.get('drug')
            self._place(idx, key, lv, drug, e.get('rx'))

        seed = as_int(setup.get('seed'))
        state = seed if seed is not None and 1 <= seed < RNG_MOD else 1
        for b in self.buildings:
            if b is not None and b.role == 'attack':
                state = (state * RNG_MUL) % RNG_MOD
                b.cd = state % b.interval
        self.rng = state

    def _reload(self, b):
        iv = b.interval
        if iv >= 3:
            self.rng = (self.rng * RNG_MUL) % RNG_MOD
            b.cd = iv - 2 + self.rng % 3
        else:
            b.cd = iv - 1

    def _filter_rx(self, rx):
        if not isinstance(rx, list):
            return []
        return [k for k in rx if isinstance(k, str) and k in self.st.udefs]

    def _place(self, idx, key, lv, drug, rx):
        st = self.st
        site = st.sites[idx]
        d = st.bdefs[key]
        b = Building()
        b.idx = idx
        b.site = site['id']
        b.key = key
        b.defn = d
        b.cat = d['cat']
        b.lv = lv
        if b.cat == 'core':
            hb = d['hpByLevel']
            b.maxHp = hb[_clamp(lv, 1, len(hb)) - 1]
        else:
            b.maxHp = mulpct(d['hp'], self.level_pct[lv - 1])
        b.hp = b.maxHp
        b.x, b.y = st.site_pos[idx]
        b.s = st.site_s[idx]
        b.zone = site['zone']
        b.alive = True
        b.removed = False
        b.cd = 0
        b.drug = None
        b.dd = None
        b.rx = []
        b.collateralTaken = 0
        b.lastCollateralTick = -1000000
        b.ivUntil = -1
        b.ivReadyAt = 0
        b.role = None
        b.cov = None
        b.interval = 0
        b.splash = d.get('splash') is True
        b.immune = False
        b.factors = _obj(d.get('factors'))
        b.unitPct = _obj(d.get('unitPct'))
        if b.cat == 'battery':
            if isinstance(drug, str) and drug in st.ddefs:
                b.drug = drug
                b.dd = st.ddefs[drug]
                b.rx = self._filter_rx(rx)
                b.role = 'attack'
                b.interval = b.dd['interval']
                b.cov = st.coverage(idx, b.dd['range'])
        elif b.cat == 'tower' or key == 'kupffer_gate':
            b.role = 'attack'
            b.immune = True
            b.interval = d['interval']
            b.cov = st.coverage(idx, d['range'])
        elif key == 'acid_moat':
            b.role = 'moat'
        elif key == 'peristalsis':
            b.role = 'peri'
        elif key == 'flora_garden':
            b.role = 'flora'
        self.buildings[idx] = b
        self.aliveCount[key] = self.aliveCount.get(key, 0) + 1
        return b

    # ------------------------------------------------------------------ commands
    def _queued_count(self, c, field, value):
        n = 0
        for i in range(self.qi, len(self.queue)):
            q = self.queue[i]
            if q.get('c') == c and q.get(field) == value:
                n += 1
        return n

    def command(self, cmd):
        if self.over or not isinstance(cmd, dict):
            return False
        c = cmd.get('c')
        if c not in COMMANDS:
            return False
        st = self.st
        t = self.tick
        if c == 'deploy':
            u = cmd.get('u')
            if self.mode != 'attack' or not isinstance(u, str) or u not in st.udefs or not st.udefs[u].deployable:
                return False
            if self.armyLeft.get(u, 0) - self._queued_count('deploy', 'u', u) <= 0:
                return False
        elif c == 'spell':
            k = cmd.get('k')
            s = as_int(cmd.get('s'))
            if self.mode != 'attack' or not isinstance(k, str) or k not in st.spells or s is None:
                return False
            if s < 0 or s > st.path_len:
                return False
            if self.spellsLeft.get(k, 0) - self._queued_count('spell', 'k', k) <= 0:
                return False
        elif c == 'end':
            if self.mode != 'attack':
                return False
        elif c == 'boost':
            k = cmd.get('k')
            z = as_int(cmd.get('z'))
            if not isinstance(k, str) or k not in self.boostDefs or z is None or z < 0 or z >= len(self.cpTick):
                return False
            if self.cpTick[z] < 0 or self.boostUsed[z] or self._queued_count('boost', 'z', cmd.get('z')) > 0:
                return False
        else:
            if self.mode != 'campaign':
                return False
            if c == 'build':
                b = cmd.get('b')
                site = cmd.get('site')
                if not isinstance(site, str) or site not in st.site_index:
                    return False
                if not isinstance(b, str) or b not in st.bdefs or b not in self.allowed:
                    return False
                if b == 'drug_battery' and cmd.get('drug') not in self.allowedDrugs:
                    return False
            elif c == 'sell' or c == 'rx':
                site = cmd.get('site')
                if not isinstance(site, str) or site not in st.site_index:
                    return False
            elif c == 'stopflow':
                if self.patient == 'child' or t < self.stopflowReadyAt:
                    return False
            elif c == 'vaccinate':
                u = cmd.get('u')
                if t != 0 or not isinstance(u, str) or u not in self.allowedVaccines:
                    return False
        q = dict(cmd)
        q['t'] = t
        self.commands.append(q)
        pos = len(self.queue)
        while pos > self.qi and self.queue[pos - 1]['t'] > t:
            pos -= 1
        self.queue.insert(pos, q)
        return True

    def load_commands(self, commands):
        """Queue a full command list (used by simulate). Invalid t are dropped."""
        if not isinstance(commands, list):
            commands = []
        keep = []
        for cmd in commands:
            if not isinstance(cmd, dict):
                continue
            t = as_int(cmd.get('t'))
            if t is None or t < 0 or t >= self.maxTicks:
                continue
            keep.append((t, cmd))
        keep.sort(key=lambda p: p[0])
        self.commands = list(commands)
        self.queue = []
        for t, cmd in keep:
            q = dict(cmd)
            q['t'] = t
            self.queue.append(q)
        self.qi = 0

    def _apply(self, cmd, t):
        c = cmd.get('c')
        st = self.st
        if c == 'deploy':
            u = cmd.get('u')
            if self.mode != 'attack' or not isinstance(u, str) or u not in st.udefs:
                return
            ud = st.udefs[u]
            if not ud.deployable or self.armyLeft.get(u, 0) <= 0:
                return
            self.armyLeft[u] -= 1
            n = ud.spawn_count + (1 if t < self.contaminatedUntil else 0)
            for _ in range(n):
                self._spawn(u, 0, False, 'deploy', t)
        elif c == 'spell':
            k = cmd.get('k')
            s = as_int(cmd.get('s'))
            if self.mode != 'attack' or not isinstance(k, str) or k not in st.spells or s is None:
                return
            if s < 0 or s > st.path_len or self.spellsLeft.get(k, 0) <= 0:
                return
            self.spellsLeft[k] -= 1
            sp = st.spells[k]
            dur = sp.get('duration', 0)
            rad = sp.get('radius', 0)
            if k == 'contaminated_water':
                self.contaminatedUntil = t + dur
            elif k == 'quorum_sensing':
                for u in self.units:
                    if u.alive and abs(u.s - s) <= rad:
                        u.quorumUntil = t + dur
            elif k == 'immune_evasion':
                for u in self.units:
                    if u.alive and abs(u.s - s) <= rad:
                        u.invisibleUntil = t + dur
            elif k == 'biofilm_dome':
                self.dome = {'s0': s - rad, 's1': s + rad, 'until': t + dur}
            _inc(self.stats['spellsUsed'], k)
        elif c == 'end':
            if self.mode == 'attack':
                self.surrendered = True
        elif c == 'boost':
            self._boost(cmd, t)
        elif self.mode != 'campaign':
            return
        elif c == 'build':
            self._cmd_build(cmd, t)
        elif c == 'sell':
            site = cmd.get('site')
            if not isinstance(site, str) or site not in st.site_index:
                return
            b = self.buildings[st.site_index[site]]
            if b is None or not b.alive or b.key == 'core':
                return
            self.budget += mulpct(b.defn['cost'][0], self.gd['economy']['campaignSellRefundPct'])
            b.alive = False
            b.removed = True
            self.aliveCount[b.key] -= 1
            self.stats['sold'] += 1
        elif c == 'rx':
            site = cmd.get('site')
            if not isinstance(site, str) or site not in st.site_index:
                return
            b = self.buildings[st.site_index[site]]
            rx = cmd.get('rx')
            if b is None or not b.alive or b.cat != 'battery' or not isinstance(rx, list):
                return
            b.rx = self._filter_rx(rx)
        elif c == 'stopflow':
            self._stopflow(t)
        elif c == 'vaccinate':
            u = cmd.get('u')
            if t != 0 or not isinstance(u, str) or u not in self.allowedVaccines:
                return
            vd = _obj(self.gd.get('vaccines')).get(u)
            if not isinstance(vd, dict) or u not in st.udefs:
                return
            if u in self.stats['vaccinated'] or self.vaccineCost > self.budget:
                return
            self.vaccines[u] = _clamp(vd['efficacy'], 0, 100)
            self.budget -= self.vaccineCost
            self.stats['vaccinated'].append(u)

    def _boost(self, cmd, t):
        k = cmd.get('k')
        z = as_int(cmd.get('z'))
        if not isinstance(k, str) or k not in self.boostDefs or z is None or z < 0 or z >= len(self.cpTick):
            return
        if self.cpTick[z] < 0 or self.boostUsed[z]:
            return
        self.boostUsed[z] = True
        bd = self.boostDefs[k]
        eff = bd.get('effect')
        pct = as_int(bd.get('pct'))
        if pct is None:
            pct = 0
        ticks = as_int(bd.get('ticks'))
        if ticks is None:
            ticks = 0
        until = t + ticks
        if eff == 'heal':
            for u in self.units:
                if u.alive:
                    u.hp = min(u.maxHp, u.hp + mulpct(u.maxHp, pct))
        elif eff == 'quorum':
            for u in self.units:
                if u.alive and u.quorumUntil < until:
                    u.quorumUntil = until
        elif eff == 'evasion':
            for u in self.units:
                if u.alive and u.invisibleUntil < until:
                    u.invisibleUntil = until
        elif eff == 'neutralise':
            for u in self.units:
                if u.alive and u.neutralisedUntil < until:
                    u.neutralisedUntil = until
        elif eff == 'rehydrate':
            h = self.hydration + mulpct(self.hydrationMax, pct)
            self.hydration = h if h < self.hydrationMax else self.hydrationMax
        elif eff == 'complement':
            for u in self.units:
                if u.alive:
                    dmg = mulpct(u.maxHp, pct)
                    self._damage_unit(u, dmg if dmg > 0 else 1, t, 'booster', None)
        _inc(self.stats['boosters'], k)

    def _cross(self, prev, s, t):
        cb = self.cpBounds
        for i in range(len(cb)):
            if self.cpTick[i] < 0 and prev < cb[i] <= s:
                self.cpTick[i] = t

    def _cmd_build(self, cmd, t):
        st = self.st
        site = cmd.get('site')
        key = cmd.get('b')
        if not isinstance(site, str) or site not in st.site_index:
            return
        if not isinstance(key, str) or key not in st.bdefs or key not in self.allowed:
            return
        idx = st.site_index[site]
        old = self.buildings[idx]
        if old is not None and old.alive:
            return
        d = st.bdefs[key]
        sdef = st.sites[idx]
        if sdef['kind'] not in d['sites']:
            return
        zones = d.get('zones')
        if zones is not None and sdef['zone'] not in zones:
            return
        mc = d['maxCount']
        if self.aliveCount.get(key, 0) >= mc[self.coreLevel - 1]:
            return
        cost = d['cost'][0]
        if cost > self.budget:
            return
        drug = cmd.get('drug')
        if key == 'drug_battery' and (not isinstance(drug, str) or drug not in self.allowedDrugs or drug not in st.ddefs):
            return
        self.budget -= cost
        self._place(idx, key, 1, drug, cmd.get('rx'))
        self.stats['built'] += 1

    def _stopflow(self, t):
        if self.patient == 'child' or t < self.stopflowReadyAt:
            return False
        sf = self.gd['stopflow']
        self.stopflowUntil = t + sf['duration']
        self.stopflowReadyAt = t + sf['duration'] + sf['cooldown']
        self.stats['stopflowUses'] += 1
        for u in self.units:
            if u.alive and u.d.trapped:
                self.stats['stopflowWithTrapped'] += 1
                break
        return True

    # ------------------------------------------------------------------ spawning
    def _spawn(self, utype, s, scripted, origin, t):
        d = self.st.udefs[utype]
        um = self.um
        stats = self.stats
        hp = d.hp
        if self.mode == 'attack' and self.attBoost and (origin == 'deploy' or origin == 'wave'):
            hp = mulpct(hp, um['attackBoostHpPct'])
        vacc = False
        eff = self.vaccines.get(utype, 0)
        if eff > 0:
            hp = mulpct(hp, 100 - div(eff, 2))
            vacc = True
            _inc(stats['vaccinatedSpawns'], utype)
        over = False
        if utype == 'candida' and self.aliveCount.get('flora_garden', 0) <= 0:
            hp = mulpct(hp, um['overgrowthPct'])
            over = True
            stats['overgrowth'] += 1
        if utype == 'worm' and self.dewormed:
            hp = mulpct(hp, um['dewormedWormHpPct'])
        u = Unit()
        u.id = len(self.units)
        u.type = utype
        u.d = d
        u.s = s
        u.hp = hp
        u.maxHp = hp
        u.cd = 0
        u.alive = True
        u.state = 'move'
        u.neutralisedUntil = -1
        u.invisibleUntil = -1
        u.quorumUntil = -1
        u.vaccinated = vacc
        u.overgrowth = over
        u.reachedLiver = False
        u.scripted = scripted
        self.units.append(u)
        if origin == 'deploy' or origin == 'wave':
            _inc(stats['deployed'], utype)
        elif origin == 'flora':
            if utype == 'cdiff':
                stats['cdiffSpawned'] += 1
            elif utype == 'candida':
                stats['candidaSpawned'] += 1
        elif origin == 'cyst':
            stats['cystsSpawned'] += 1
        return u

    # ------------------------------------------------------------------ step
    def step(self):
        if self.over:
            return
        t = self.tick
        wl = self.waveAt.get(t)
        if wl is not None:
            for ut in wl:
                self._spawn(ut, 0, True, 'wave', t)
        q = self.queue
        while self.qi < len(q) and q[self.qi]['t'] < t:
            self.qi += 1
        while self.qi < len(q) and q[self.qi]['t'] == t:
            cmd = q[self.qi]
            self.qi += 1
            self._apply(cmd, t)
        if self.pending:
            keep = []
            for p in self.pending:
                if p[0] == t:
                    self._spawn(p[1], p[2], False, p[3], t)
                elif p[0] > t:
                    keep.append(p)
            self.pending = keep
        units = self.units
        for i in range(len(units)):
            u = units[i]
            if u.alive:
                self._unit_turn(u, t)
        live = [u for u in units if u.alive]
        for b in self.buildings:
            if b is not None and b.alive:
                role = b.role
                if role == 'attack':
                    self._attack_turn(b, t, live)
                elif role == 'moat':
                    self._moat_turn(b, t, live)
                elif role == 'peri':
                    self._peri_turn(b, t, live)
                elif role == 'flora':
                    self._flora_turn(b, t, live)
        self._hydration(t)
        if (self.mode == 'attack' and self.stopflowAt > 0 and not self.autoStopflowUsed
                and self.patient != 'child'
                and self.hydration * 100 <= self.stopflowAt * self.hydrationMax
                and t >= self.stopflowReadyAt):
            self._stopflow(t)
            self.autoStopflowUsed = True
        if (t + 1) % 50 == 0:
            self._hash_point(t)
        self.tick = t + 1
        self._check_end()

    def run(self):
        while not self.over:
            self.step()
        return self.result

    # ------------------------------------------------------------------ units
    def _unit_turn(self, u, t):
        d = u.d
        st = self.st
        if d.trapped and t < self.stopflowUntil:
            u.hp = min(u.maxHp, u.hp + self.um['trappedRegen'])
            self.stats['trapTicks'] += 1
        if u.cd > 0:
            u.cd -= 1
        L = st.path_len
        bl = self.buildings
        if u.s >= L:
            tgt = None
            for i in st.end_order:
                b = bl[i]
                if b is not None and b.alive:
                    tgt = b
                    break
            if tgt is None:
                u.state = 'idle'
                return
            u.state = 'attack'
            if u.cd == 0:
                self._hit(u, tgt, t)
            return
        if d.side:
            for i in st.side_table(d.reach)[u.s]:
                b = bl[i]
                if (b is not None and b.alive and b.cat != 'wall' and b.key != 'kupffer_gate'
                        and (not d.slipper or b.zone == 'liver')):
                    u.state = 'attack'
                    if u.cd == 0:
                        self._hit(u, b, t)
                    return
        um = self.um
        pct = 100
        if t < u.quorumUntil:
            pct = mulpct(pct, um['quorumSpeedPct'])
        if d.passer:
            win = um['passWallWindow']
            for i in st.blockers:
                b = bl[i]
                if b is not None and b.alive and b.cat == 'wall' and abs(b.s - u.s) <= win:
                    pct = mulpct(pct, um['passWallSpeedPct'])
                    break
        move = max(1, mulpct(d.speed, pct))
        blk = None
        for i in st.blockers:
            b = bl[i]
            if b is not None and b.alive and b.s >= u.s:
                if b.key == 'kupffer_gate' or (b.cat == 'wall' and not d.passer):
                    blk = b
                    break
        if blk is not None and u.s + move >= blk.s - self.gd['contact']:
            prev = u.s
            u.s = max(u.s, blk.s - self.gd['contact'])
            self._cross(prev, u.s, t)
            u.state = 'attack'
            if u.cd == 0:
                self._hit(u, blk, t)
            return
        prev = u.s
        u.s = min(u.s + move, L)
        self._cross(prev, u.s, t)
        u.state = 'move'
        if d.worm and t % um['wormStealEvery'] == 0:
            z = st.zone_of(u.s)
            if z == 'si' or z == 'colon':
                self.stats['wormStolen'] += 1
        if not u.reachedLiver and u.s >= 4000:
            u.reachedLiver = True
            _inc(self.stats['reachedLiver'], u.type)

    def _hit(self, u, b, t):
        d = u.d
        um = self.um
        u.cd = d.interval - 1
        dmg = d.dmg
        if b.cat == 'wall':
            zp = d.zone_wall.get(b.zone)
            dmg = mulpct(dmg, zp if zp is not None else d.vs_wall)
        adp = b.defn.get('attackerDmgPct')
        if adp is not None:
            dmg = mulpct(dmg, adp)
        vb = d.vs_bld.get(b.key)
        if vb is not None:
            dmg = mulpct(dmg, vb)
        if d.driller:
            dmg = mulpct(dmg, um['drillerStomachPct'] if b.zone == 'stomach' else um['drillerElsewherePct'])
        if d.stalker and (b.cat == 'core' or b.key == 'kupffer_gate'):
            dmg = mulpct(dmg, um['stalkerCorePct'])
        liver = d.slipper and b.zone == 'liver'
        if liver:
            dmg = mulpct(dmg, um['slipperLiverPct'])
        if t < u.quorumUntil:
            dmg = mulpct(dmg, um['quorumDmgPct'])
        if d.trapped and t < self.stopflowUntil:
            dmg = mulpct(dmg, um['trappedDmgPct'])
        if u.overgrowth:
            dmg = mulpct(dmg, um['overgrowthPct'])
        if dmg < 1:
            dmg = 1
        if liver:
            self.stats['liverDamage'] += dmg
        b.hp -= dmg
        if b.hp <= 0:
            self._destroy(b, t)

    def _destroy(self, b, t):
        b.hp = 0
        b.alive = False
        self.aliveCount[b.key] -= 1
        stats = self.stats
        if b.cat != 'wall':
            stats['buildingsDestroyed'] += 1
        if b.cat == 'core':
            self.coreDestroyed = True
        if b.key == 'flora_garden':
            stats['floraLost'] += 1
            if b.collateralTaken > 0:
                fl = self.gd['flora']
                s = b.s if b.s is not None else 2700
                for _ in range(fl['cdiffPerCollapse']):
                    self.pending.append((t + 1, 'cdiff', s, 'flora'))
                for _ in range(fl['candidaPerCollapse']):
                    self.pending.append((t + 1, 'candida', s, 'flora'))

    # ------------------------------------------------------------------ buildings
    def _attack_turn(self, b, t, live):
        if b.cd > 0:
            b.cd -= 1
            return
        cov = b.cov
        if b.immune:
            if b.splash:
                cands = [u for u in live if u.alive and cov[u.s] and u.invisibleUntil <= t]
                if not cands:
                    return
                for u in cands:
                    self._immune_damage(b, u, t)
            else:
                best = None
                for u in live:
                    if u.alive and cov[u.s] and u.invisibleUntil <= t and (best is None or u.s > best.s):
                        best = u
                if best is None:
                    return
                self._immune_damage(b, best, t)
        else:
            rx = b.rx
            if not rx:
                return
            best = None
            for u in live:
                if u.alive and cov[u.s] and u.type in rx and (best is None or u.s > best.s):
                    best = u
            if best is None:
                return
            if self.atp < b.dd['atp']:
                self.stats['outOfAtp'] += 1
                return
            self._drug_damage(b, best, t)
        self._reload(b)

    def _in_dome(self, u, t):
        dm = self.dome
        return dm is not None and t < dm['until'] and dm['s0'] <= u.s <= dm['s1']

    def _immune_damage(self, b, u, t):
        d = u.d
        T = u.type
        um = self.um
        defn = b.defn
        dmg = mulpct(defn['dmg'], self.level_pct[b.lv - 1])
        f = b.factors.get(d.group)
        dmg = mulpct(dmg, f if f is not None else 100)
        up = b.unitPct.get(T)
        mac_typhoid = b.key == 'macrophage_tower' and T == 'typhoid'
        if mac_typhoid and self.tcells:
            tp = defn.get('tcellTyphoidPct')
            if tp is not None:
                up = tp
        if up is not None:
            dmg = mulpct(dmg, up)
        if mac_typhoid and not self.tcells:
            self.stats['macrophageTyphoidHits'] += 1
        if b.key == 'iga_cannon' and u.vaccinated:
            dmg = mulpct(dmg, defn['vaccinatedPct'])
        if d.driller:
            dmg = mulpct(dmg, um['drillerImmunePct'])
        stacks = self.memory.get(T, 0)
        if stacks > 0 and self.aliveCount.get('peyers_patch', 0) > 0:
            dmg = mulpct(dmg, 100 + self.memPct * stacks)
            self.stats['memoryHits'] += 1
        if self._in_dome(u, t):
            dmg = mulpct(dmg, um['biofilmImmunePct'])
        if self.defBoost:
            dmg = mulpct(dmg, um['defenceBoostDmgPct'])
        self._damage_unit(u, dmg, t, 'building', b)
        if b.key == 'iga_cannon':
            u.neutralisedUntil = t + defn['neutraliseTicks']
            self.stats['neutralised'] += 1

    def _drug_damage(self, b, u, t):
        st = self.st
        stats = self.stats
        um = self.um
        D = b.drug
        dd = b.dd
        T = u.type
        L = st.letter[T][D]
        pct = st.dpct[T][D]
        dmg = mulpct(mulpct(dd['dmg'], self.level_pct[b.lv - 1]), pct)
        R = self.resistance.get(D, 0)
        qf = dd.get('quadrupleFromLevel')
        if qf is not None and b.lv >= qf:
            R = div(R, 2)
        dmg = mulpct(dmg, 100 - R)
        if self._in_dome(u, t):
            before = dmg
            dmg = mulpct(dmg, um['biofilmDrugPct'])
            stats['biofilmBlocked'] += before - dmg
        if self.defBoost:
            dmg = mulpct(dmg, um['defenceBoostDmgPct'])
        cost = dd['atp']
        self.atp -= cost
        stats['atpSpent'] += cost
        stats['totalShots'] += 1
        _inc2(stats['shots'], D, L)
        _inc2(stats['shotsOn'], T, L)
        if L == 'N' or L == 'X' or u.d.abx_not_needed:
            stats['unnecessary'] += 1
        if L == 'N':
            stats['wasted'] += 1
        _inc(self.pressure, D, self.gd['pressure'].get(L, 0))
        if T == 'hpylori' and D != 'hpylori_combo':
            stats['hpyloriSingleDrugHits'] += 1
            hp = self.gd['hpyloriSingleDrugPressure'].get(D)
            if hp is not None:
                _inc(self.pressure, 'hpylori_combo', hp)
        c = dd.get('collateral', 0)
        if c > 0:
            if t < self.ppiUntil:
                c = mulpct(c, um['ppiCollateralPct'])
            self._collateral(c, t)
        pt = dd.get('ppiTicks')
        if pt is not None:
            self.ppiUntil = t + pt
        self._damage_unit(u, dmg, t, 'battery', b)

    def _collateral(self, c, t):
        self.stats['collateral'] += c
        fl = self.gd['flora']
        if self.aliveCount.get('flora_garden', 0) > 0:
            per = c * fl['collateralHp']
            for b in self.buildings:
                if b is not None and b.alive and b.key == 'flora_garden':
                    b.hp -= per
                    b.collateralTaken += c
                    b.lastCollateralTick = t
                    if b.hp <= 0:
                        self._destroy(b, t)
        else:
            self.dysbiosis += c
            every = fl['noGardenEvery']
            if every > 0:
                while self.dysbiosis >= every:
                    self.dysbiosis -= every
                    self.pending.append((t + 1, 'cdiff', 2700, 'flora'))

    def _damage_unit(self, u, dmg, t, kind, b):
        if dmg <= 0:
            return
        u.hp -= dmg
        if u.hp <= 0:
            u.hp = 0
            u.alive = False
            T = u.type
            stats = self.stats
            _inc(stats['kills'], T)
            if kind == 'battery':
                _inc2(stats['drugKills'], b.drug, T)
            elif kind == 'building':
                _inc2(stats['towerKills'], b.key, T)
            if T == 'amoeba':
                for _ in range(self.gd['amoebaCyst']['perDeath']):
                    self.pending.append((t + 1, 'amoeba_cyst', u.s, 'cyst'))

    def _moat_turn(self, b, t, live):
        defn = b.defn
        if t % defn['interval'] != 0:
            return
        base = mulpct(defn['dmg'], self.level_pct[b.lv - 1])
        s0 = defn['s0']
        s1 = defn['s1']
        ppi = t < self.ppiUntil
        ppi_pct = self.um['ppiAcidPct']
        acid = self.stats['acidDamage']
        for u in live:
            if u.alive and s0 <= u.s < s1:
                dd = mulpct(base, u.d.acid)
                if ppi:
                    dd = mulpct(dd, ppi_pct)
                if dd > 0:
                    self._damage_unit(u, dd, t, 'acid', b)
                    _inc(acid, u.type, dd)

    def _peri_turn(self, b, t, live):
        if t < self.stopflowUntil or t <= 0:
            return
        defn = b.defn
        if t % defn['intervalByLevel'][b.lv - 1] != 0:
            return
        s0 = defn['s0']
        s1 = defn['s1']
        base = defn['flushByLevel'][b.lv - 1]
        for u in live:
            if u.alive and s0 <= u.s < s1 and u.state == 'move':
                dd = base
                if u.d.worm:
                    dd = mulpct(dd, defn['wormFlushPct'])
                elif u.d.invasive:
                    dd = mulpct(dd, defn['invasiveFlushPct'])
                self._damage_unit(u, dd, t, 'flush', b)
                self.stats['flushes'] += 1

    def _flora_turn(self, b, t, live):
        defn = b.defn
        if t - b.lastCollateralTick >= defn['regenQuietTicks']:
            b.hp = min(b.maxHp, b.hp + defn['regen'])
        if t % defn['colonisationEvery'] == 0 and b.hp * 2 >= b.maxHp:
            dmg = mulpct(defn['colonisationDmg'], self.level_pct[b.lv - 1])
            targets = defn['colonisationTargets']
            for u in live:
                if u.alive and u.type in targets and 2700 <= u.s < 4000:
                    self._damage_unit(u, dmg, t, 'colonisation', b)

    # ------------------------------------------------------------------ hydration
    def _hydration(self, t):
        st = self.st
        gd = self.gd
        hmax = self.hydrationMax
        stats = self.stats
        drain = 0
        iga = st.bdefs.get('iga_cannon', {})
        ndp = iga.get('neutralisedDrainPct', 100)
        units = self.units
        for u in units:
            if u.alive and u.d.drain > 0 and u.s >= 1000:
                d = u.d.drain
                if t < u.neutralisedUntil:
                    d = mulpct(d, ndp)
                if u.vaccinated:
                    d = mulpct(d, 100 - self.vaccines.get(u.type, 0))
                drain += d
        ors_def = st.bdefs['ors_station']
        zinc_from = ors_def['zincFromLevel']
        zinc = False
        for b in self.buildings:
            if b is None or not b.alive:
                continue
            if b.key == 'villi_wall':
                lr = b.defn['leakRange']
                for u in units:
                    if u.alive and u.d.toxin and abs(u.s - b.s) <= lr:
                        drain += b.defn['leak']
                        stats['leakDrain'] += b.defn['leak']
                        break
            elif b.key == 'ors_station' and b.lv >= zinc_from:
                zinc = True
        if drain > 0:
            if zinc and self.patient != 'adult':
                drain = mulpct(drain, ors_def['zincDrainPct'])
                stats['zincTicks'] += 1
            if t < self.stopflowUntil:
                drain = mulpct(drain, gd['stopflow']['drainPct'])
        h = self.hydration
        severe = h * 100 < ors_def['severeBelowPct'] * hmax
        ors = 0
        iv = 0
        for b in self.buildings:
            if b is None or not b.alive:
                continue
            if b.key == 'ors_station':
                r = b.defn['refillByLevel'][b.lv - 1]
                if severe:
                    r = mulpct(r, ors_def['severeOrsPct'])
                ors += r
            elif b.key == 'iv_drip':
                dv = b.defn
                if t < b.ivUntil:
                    if h * 100 >= dv['stopAbovePct'] * hmax:
                        b.ivUntil = t
                    else:
                        iv += dv['refillByLevel'][b.lv - 1]
                elif t >= b.ivReadyAt and h * 100 < dv['triggerBelowPct'] * hmax:
                    b.ivUntil = t + dv['maxActiveTicks']
                    b.ivReadyAt = t + dv['maxActiveTicks'] + dv['cooldown']
                    stats['ivUsed'] += 1
                    iv += dv['refillByLevel'][b.lv - 1]
        stats['orsRefill'] += ors
        stats['ivRefill'] += iv
        h = h - drain + ors + iv
        if h < 0:
            h = 0
        elif h > hmax:
            h = hmax
        self.hydration = h
        if h < self.hydrationMin:
            self.hydrationMin = h
        if h == 0 and drain > 0:
            self.collapsed = True

    # ------------------------------------------------------------------ hash / end
    def _hash_point(self, t):
        h = self.hash
        h = (h * HASH_MUL + t) % HASH_MOD
        h = (h * HASH_MUL + self.hydration) % HASH_MOD
        for u in self.units:
            h = (h * HASH_MUL + u.id) % HASH_MOD
            h = (h * HASH_MUL + u.s) % HASH_MOD
            h = (h * HASH_MUL + (u.hp if u.hp > 0 else 0)) % HASH_MOD
            h = (h * HASH_MUL + (1 if u.alive else 0)) % HASH_MOD
        for b in self.buildings:
            if b is not None:
                h = (h * HASH_MUL + (b.hp if b.hp > 0 else 0)) % HASH_MOD
                h = (h * HASH_MUL + (1 if b.alive else 0)) % HASH_MOD
        self.hash = h

    def _check_end(self):
        reason = None
        if self.collapsed:
            reason = 'collapse'
        elif self.mode == 'attack' and not self._any_destructible_alive():
            reason = 'destroyed'
        elif self.mode == 'campaign' and self.coreDestroyed:
            reason = 'core'
        elif self.surrendered:
            reason = 'surrender'
        elif self.tick >= self.maxTicks:
            reason = 'time'
        elif not self.pending and not self._any_unit_alive():
            if self.mode == 'attack':
                done = True
                for k in self.st.unit_keys:
                    if self.armyLeft.get(k, 0) != 0:
                        done = False
                        break
            else:
                done = self.tick > self.lastWaveTick
            if done:
                reason = 'exhausted'
        if reason is not None:
            self.over = True
            self.reason = reason
            self._hash_point(self.tick)
            self.result = self._build_result()

    def _any_unit_alive(self):
        for u in self.units:
            if u.alive:
                return True
        return False

    def _any_destructible_alive(self):
        for b in self.buildings:
            if b is not None and not b.removed and b.cat != 'wall' and b.alive:
                return True
        return False

    def _build_result(self):
        total = 0
        destroyed = 0
        core_alive = False
        destroyed_sites = []
        standing_sites = []
        for b in self.buildings:
            if b is None or b.removed:
                continue
            if b.alive:
                standing_sites.append(b.site)
            else:
                destroyed_sites.append(b.site)
            if b.cat != 'wall':
                total += 1
                if not b.alive:
                    destroyed += 1
            if b.cat == 'core' and b.alive:
                core_alive = True
        collapsed = self.collapsed
        if collapsed:
            pct = 100
        else:
            pct = div(destroyed * 100, total) if total > 0 else 0
        core_destroyed = self.coreDestroyed or collapsed
        if collapsed:
            stars = 3
        else:
            stars = (1 if pct >= 50 else 0) + (1 if core_destroyed else 0) + (1 if pct == 100 else 0)
        ticks = self.tick
        time_left = div(self.maxTicks - ticks, self.gd['tps']) if stars == 3 and ticks <= self.maxTicks else 0
        return {
            'ticks': ticks,
            'reason': self.reason,
            'stars': stars,
            'pct': pct,
            'coreDestroyed': core_destroyed,
            'collapsed': collapsed,
            'survived': (not collapsed) and core_alive,
            'timeLeft': time_left,
            'hydrationEnd': self.hydration,
            'hydrationMin': self.hydrationMin,
            'hydrationMinPct': div(self.hydrationMin * 100, self.hydrationMax),
            'destroyedSites': destroyed_sites,
            'standingSites': standing_sites,
            'pressure': dict(self.pressure),
            'atpLeft': self.atp,
            'budgetLeft': self.budget,
            'stats': self.stats,
            'checkpointTicks': list(self.cpTick),
            'hash': self.hash,
        }


def simulate(gd, setup, commands):
    b = Battle(gd, setup)
    b.load_commands(commands)
    return b.run()


def _num(v):
    n = as_int(v)
    return n if n is not None else 0


def evaluate_objectives(gd, objectives, result):
    out = []
    result = _obj(result)
    survived = result.get('survived') is True
    stats = _obj(result.get('stats'))
    standing = result.get('standingSites') if isinstance(result.get('standingSites'), list) else []
    destroyed = result.get('destroyedSites') if isinstance(result.get('destroyedSites'), list) else []
    for ob in objectives if isinstance(objectives, list) else []:
        ob = _obj(ob)
        k = ob.get('key')
        ok = False
        if survived:
            if k == 'survive':
                ok = True
            elif k == 'max_unnecessary':
                ok = _num(stats.get('unnecessary')) <= _num(ob.get('n'))
            elif k == 'max_wasted':
                ok = _num(stats.get('wasted')) <= _num(ob.get('n'))
            elif k == 'max_shots':
                ok = _num(stats.get('totalShots')) <= _num(ob.get('n'))
            elif k == 'min_hydration':
                ok = _num(result.get('hydrationMinPct')) >= _num(ob.get('pct'))
            elif k == 'no_stopflow':
                ok = _num(stats.get('stopflowUses')) == 0
            elif k == 'killed_with':
                dk = _obj(stats.get('drugKills'))
                n = 0
                drugs = ob.get('drugs') if isinstance(ob.get('drugs'), list) else []
                for d in drugs:
                    if not isinstance(d, str):
                        continue
                    row = _obj(dk.get(d))
                    for v in row.values():
                        n += _num(v)
                ok = n >= _num(ob.get('n'))
            elif k == 'building_standing':
                site = ob.get('site')
                ok = isinstance(site, str) and site in standing and site not in destroyed
            elif k == 'vaccinated':
                vl = stats.get('vaccinated') if isinstance(stats.get('vaccinated'), list) else []
                germ = ob.get('germ')
                ok = isinstance(germ, str) and germ in vl
            elif k == 'max_stat':
                stat = ob.get('stat')
                v = as_int(stats.get(stat)) if isinstance(stat, str) else None
                ok = v is not None and v <= _num(ob.get('n'))
        out.append(ok)
    return out


def attack_score(gd, result, boost_correct):
    sc = gd['scoring']
    result = _obj(result)
    return (sc['star'] * _num(result.get('stars')) + sc['pct'] * _num(result.get('pct'))
            + sc['secLeft'] * _num(result.get('timeLeft')) + (sc['boost'] if boost_correct is True else 0))


def trial_score(gd, result, objectives=None):
    sc = gd['scoring']['trial']
    ppr = gd['resistance']['pointsPerR']
    result = _obj(result)
    stats = _obj(result.get('stats'))
    rpts = 0
    for v in _obj(result.get('pressure')).values():
        rpts += div(max(_num(v), 0), ppr)
    steward = sc['steward'] - sc['perUnnecessary'] * _num(stats.get('unnecessary')) - sc['perResistancePoint'] * rpts
    met = 0
    if isinstance(objectives, list):
        for ob, ok in zip(objectives, evaluate_objectives(gd, objectives, result)):
            if ok and _obj(ob).get('key') != 'survive':
                met += 1
    return ((sc['survive'] if result.get('survived') is True else 0)
            + sc['perHydrationPct'] * _num(result.get('hydrationMinPct')) + sc.get('perObjective', 0) * met
            + (steward if steward > 0 and result.get('survived') is True else 0))


evaluateObjectives = evaluate_objectives
attackScore = attack_score
trialScore = trial_score
