# Body Bastion — Implementation Spec (v1.2)

This is the single source of truth for building the game. Data lives in `shared/gamedata.json`
(numbers may be tuned; shapes may not change without updating this spec). The plan document
`Body_Bastion_Development_Plan.docx` (v1.1) is the design brief; v1.2 corrections are listed in
`docs/ANALYSIS.md`.

Stack: Python 3.12 + FastAPI + SQLAlchemy Core (SQLite locally, PostgreSQL on Render) serving a
vanilla-JS ES-module single-page app (HTML5 canvas, no build step). Deployed on Render.com.

---------------------------------------------------------------------------------------------------
## 0. Repository layout and ownership

```
body-bastion/
  render.yaml  requirements.txt  .python-version  Dockerfile  package.json  README.md
  shared/gamedata.json      rules + numbers (SIM agent may tune numbers)
  shared/questions.json     knowledge-boost MCQs        (CONTENT)
  shared/cards.json         "Why did this happen?" cards (CONTENT)
  shared/guide.json         guide / encyclopedia text   (CONTENT)
  app/                      FastAPI server               (SERVER) except app/sim.py (SIM)
  app/sim.py                authoritative deterministic simulation (SIM)
  static/js/sim.js          exact JS mirror of app/sim.py (SIM)
  static/js/render/*, static/js/battle.js, static/js/baseview.js, static/js/audio.js,
  static/css/battle.css     canvas renderer + battle UI (RENDER)
  static/index.html, static/css/app.css, static/js/app.js, static/js/api.js, static/js/ui.js,
  static/js/store.js, static/js/screens/*, static/manifest.webmanifest, static/sw.js,
  static/icons/*            app shell + all non-battle screens (SHELL)
  tests/                    pytest (SIM: test_sim*.py, SERVER: test_api*.py)
  tools/                    parity + balance + load tools (SIM: parity/balance, SERVER: load_test)
  docs/                     SPEC.md, ANALYSIS.md, GUIDE.md
```
Never edit a file owned by another agent. If you need something from another area, code against
the interface in this spec.

---------------------------------------------------------------------------------------------------
## 1. Determinism rules (sim.py and sim.js MUST be bit-identical)

1. Integers only. No floats anywhere in game state. `div(a, b)` = floor division of non-negative
   integers (Python `a // b`; JS `Math.floor(a / b)`). Never divide a negative number. Never use
   `round()`, `Math.round`, `%` on negatives, `**`, `Math.pow`, trig, `Math.random`, `Date`.
2. `mulpct(v, p) = div(v * p, 100)` for v, p >= 0. Multipliers are applied **in the exact order
   listed** in this spec.
3. Iterate only over arrays in a defined order: units by id ascending (creation order), buildings
   by site order (`gd.map.sites` order), commands by (t, original index), waves in list order.
   Never iterate over object keys for game logic (JS reorders integer-like keys).
4. `isqrt(n)` (n >= 0): Python `math.isqrt`; JS `r = Math.floor(Math.sqrt(n)); while (r*r > n) r--;
   while ((r+1)*(r+1) <= n) r++;`.
5. RNG: Park–Miller. `state = seed` (if seed < 1 or seed >= 2147483647 then state = 1);
   `next() { state = (state * 48271) % 2147483647; return state; }`. Used ONLY for building cooldowns:
   initial cooldowns (section 4.2) and the reload after every shot (section 4.5b).
6. Units: 1 tile = 100 path units (pu). 10 ticks per second. Hydration 0..100000.
7. Stats maps (`{key: count}`) only gain a key when first incremented. Results are compared by deep
   equality, so key order does not matter, but presence does.

---------------------------------------------------------------------------------------------------
## 2. Geometry

* `P[i] = (path[i][0]*100, path[i][1]*100)`; segments are axis-aligned. `S[0]=0`,
  `S[i+1] = S[i] + |dx| + |dy|`. `pathLen = S[last]` (= 5200).
* `posAt(s)`: clamp s to [0, pathLen]; take the first segment i with `s <= S[i+1]`;
  `off = s - S[i]`; `x = P[i].x + sign(dx)*off`, `y = P[i].y + sign(dy)*off`.
* Site position (pu): sites with `x,y` → `(x*100, y*100)`; sites with `s` (kinds `wall`, `kupffer`)
  → `posAt(s)`, and they also have that `s` (blocking position).
* `zoneOf(s)`: the zone with `s0 <= s < s1`. A building's zone is its **site.zone**.
* Range intervals `rangeIntervals(px, py, r)`: for each segment i, if horizontal (y = y0):
  `d = y0 - py; rem = r*r - d*d`; skip if rem < 0; `w = isqrt(rem)`; x-interval
  `[px-w, px+w] ∩ [min(xa,xb), max(xa,xb)]`; skip if empty; convert both x ends to s
  (`dx>0: s = S[i] + (x - xa)`, else `s = S[i] + (xa - x)`), order them low/high. Vertical
  segments likewise with y. Sort intervals by low, merge when `next.lo <= cur.hi + 1`.
  `inIntervals(list, s)` = any `lo <= s <= hi`. Cache per (building, r).
* `endOrder`: buildings whose site.zone == "core", sorted by squared distance from `posAt(pathLen)`
  to the site position, ties by site order (recomputed lazily is fine; positions never move).
* Blockers: buildings with cat `wall` or key `kupffer_gate`, ordered by s ascending.

---------------------------------------------------------------------------------------------------
## 3. Setup (sim input)

```jsonc
{
  "mode": "attack" | "campaign",
  "seed": 123456789,
  "maxTicks": 1800,
  "patient": "child" | "adult" | null,       // null in multiplayer/tournament
  "defender": {
    "layout": { "SITE": { "b": "drug_battery", "lv": 2, "drug": "ceftriaxone", "rx": ["typhoid"] } },
    "coreLevel": 3,
    "research": { "tcells": false },
    "vaccines": { "cholera": 65 },          // final efficacy % incl. herd immunity (server computes)
    "resistance": { "fluoroquinolone": 40 },// R 0..90 per drug
    "memory": { "shigella": 2 },            // stacks 0..3
    "policy": { "stopflow_at": 0 },         // auto Stop-Flow when hydration% <= this (0 = off), once per battle
    "dewormed": false,
    "boost": false,                         // defender knowledge boost (campaign/trial only)
    "atp": 800                              // ATP pool batteries spend per shot
  },
  "attacker": { "army": { "cholera": 8 }, "spells": { "biofilm_dome": 1 }, "boost": false },
  "campaign": {                             // only when mode == "campaign" (campaign levels, trials)
    "budget": 900, "allowed": ["ors_station"], "allowedDrugs": ["azithromycin"],
    "allowedVaccines": ["cholera"], "vaccineCost": 300,
    "waves": [ { "t": 30, "u": "rotavirus", "n": 4, "gap": 12 } ]
  }
}
```
`rx` lists unit keys the battery is prescribed for (missing = `[]` = battery idle). Unknown keys are
ignored.

## 3.1 Commands (sim input), each `{ "t": int, "c": str, ... }`

| c | fields | who | rule |
|---|---|---|---|
| deploy | u | attacker (mode attack) | needs `armyLeft[u] > 0` and unit deployable. Spawns `spawnCount (+1 if t < contaminatedUntil)` units at s=0 this tick. |
| spell | k, s | attacker | needs `spellsLeft[k] > 0`, `0 <= s <= pathLen` |
| end | – | attacker | surrender → battle ends after this tick |
| build | site, b, drug?, rx? | defender (campaign) | see 4.8 |
| sell | site | defender (campaign) | see 4.8 |
| rx | site, rx | defender (campaign) | set prescription of an alive drug_battery |
| stopflow | – | defender (campaign) | see 4.7 |
| vaccinate | u | defender (campaign), **t must be 0** | see 4.8 |

Commands are stably sorted by t. Commands with `t < 0` or `t >= maxTicks` or failing validation
are ignored silently (no state change, nothing counted).

---------------------------------------------------------------------------------------------------
## 4. Simulation

### 4.1 State
* `units[]` in creation order; `id` = index. Fields: `type, s, hp, maxHp, cd (0), alive, state
  ('move'|'attack'|'idle'), neutralisedUntil (-1), invisibleUntil (-1), quorumUntil (-1),
  vaccinated, overgrowth, reachedLiver (false), scripted (bool)`.
* `buildings[]`: one slot per site in site order (`null` when empty). Fields: `idx (site index),
  site, key, def, cat, lv, hp, maxHp, x, y, s (wall/kupffer or null), zone, alive, removed, cd, drug,
  rx (list), collateralTaken (0), lastCollateralTick (-1000000), ivUntil (-1), ivReadyAt (0)`.
  maxHp = `hpByLevel[lv-1]` for core, else `mulpct(def.hp, levelPct[lv-1])`.
* Globals: `tick (0)`, `hydration = hydrationMax`, `hydrationMin`, `armyLeft`, `spellsLeft`,
  `atp = defender.atp`, `budget`, `vaccines` (copy), `stopflowUntil (-1)`, `stopflowReadyAt (0)`,
  `autoStopflowUsed`, `ppiUntil (-1)`, `contaminatedUntil (-1)`, `dome (null | {s0,s1,until})`,
  `dysbiosis (0)`, `pending[]` (spawn queue `{tick, type, s}` in insertion order), `pressure{}`,
  `stats{}`, `collapsed`, `coreDestroyed`, `surrendered`, `over`, `reason`, `hash (0)`,
  `lastWaveTick` (max wave spawn tick, -1 if none).
* `stopflowActive(t) = t < stopflowUntil`; `ppiActive(t) = t < ppiUntil`;
  `inDome(u,t) = dome && t < dome.until && dome.s0 <= u.s <= dome.s1`.
* `healthyFlora` = exists alive flora_garden. `peyersAlive` = exists alive peyers_patch.
* `zincActive` = patient != "adult" AND exists alive ors_station with lv >= zincFromLevel.

### 4.2 Initialisation
Place every layout entry (site order) whose building key exists and whose `sites` list contains the
site's kind (others are ignored). RNG from seed; then for each building in site order whose
def attacks (cat `tower`, key `kupffer_gate`, cat `battery`): `cd = next() % interval` where
interval = drug.interval for batteries, def.interval otherwise. `armyLeft`/`spellsLeft` copied from
attacker (mode attack only; campaign: empty). Campaign `budget` from setup.campaign.budget.

### 4.3 Tick t (one `step()`)
1. **Waves** (campaign): for each wave in order, for i in 0..n-1: if `wave.t + i*gap == t` → spawn
   (scripted). (Unit type must exist; deployable not required.)
2. **Commands** with this t, in order.
3. **Pending spawns** whose tick == t, in queue order (then remove them).
4. **Units act** — every unit alive at the moment its turn comes, by id.
5. **Buildings act** — every alive building, site order (4.5).
6. **Hydration** (4.6).
7. **Auto Stop-Flow**: mode attack, `policy.stopflow_at > 0`, not `autoStopflowUsed`, patient !=
   child, `hydration*100 <= stopflow_at*hydrationMax`, `t >= stopflowReadyAt` → activate (4.7),
   `autoStopflowUsed = true`.
8. **Hash** if `(t+1) % 50 == 0` (section 6).
9. `tick = t + 1`; evaluate end conditions (4.9).

### 4.4 Spawning `spawn(type, s, scripted)`
hp = unit.hp, then in order: attacker boost (mode attack and attacker.boost and not a
flora/cyst spawn) → ×attackBoostHpPct; vaccinated (`vaccines[type] > 0`) → ×(100 − div(eff,2)),
`vaccinated = true`, stats.vaccinatedSpawns[type]++; candida with no alive flora_garden →
×overgrowthPct, `overgrowth = true`, stats.overgrowth++; worm and defender.dewormed →
×dewormedWormHpPct. `maxHp = hp`. Deploy counts stats.deployed[type] += 1 per unit spawned by a
deploy or wave. Flora spawns add stats.cdiffSpawned / candidaSpawned; cysts stats.cystsSpawned.

### 4.5a Unit turn (u, def d)
1. If `'trapped' in d.tags` and stopflowActive(t): `hp = min(maxHp, hp + trappedRegen)`;
   stats.trapTicks++.
2. If `cd > 0`: `cd -= 1`.
3. **At end** (`s >= pathLen`): target = first alive building in endOrder. If none → state idle.
   Else state attack; hit if `cd == 0`. Return.
4. **Side target** (behaviours `raider`, `driller`; and `slipper` but only buildings whose zone is
   `liver`): the lowest-index alive building with cat != `wall` and key != `kupffer_gate` whose
   `rangeIntervals(r = d.reach)` contain `s`. If found → state attack; hit if cd == 0. Return.
5. **Move**: `pct = 100`; if `t < quorumUntil` pct = mulpct(pct, quorumSpeedPct); passers
   (`stalker`, `slipper`): if any alive wall (cat wall) with `|w.s - s| <= passWallWindow` →
   pct = mulpct(pct, passWallSpeedPct). `move = max(1, mulpct(d.speed, pct))`.
   Blocker = first alive blocker (non-passers: walls + kupffer; passers: kupffer only) with
   `b.s >= s`. If blocker and `s + move >= b.s - contact`: `s = max(s, b.s - contact)`, state
   attack, hit blocker if cd == 0, return. Else `s = min(s + move, pathLen)`, state move.
6. After moving: worm with zoneOf(s) in {si, colon} and `t % wormStealEvery == 0` →
   stats.wormStolen++. First time `s >= 4000` → reachedLiver, stats.reachedLiver[type]++.

`hit(u, b)`: `cd = d.interval - 1`; dmg = d.dmg then, in order:
wall (cat wall): ×(d.zoneWallPct[b.zone] if present else d.vsWallPct); mucus_wall:
×attackerDmgPct; d.vsBuildingPct[b.key] if present; driller: ×drillerStomachPct if b.zone ==
stomach else ×drillerElsewherePct; stalker and (cat core or kupffer_gate): ×stalkerCorePct;
slipper and b.zone == liver: ×slipperLiverPct (add final dmg to stats.liverDamage); quorum
(t < quorumUntil): ×quorumDmgPct; trapped tag and stopflowActive: ×trappedDmgPct; overgrowth:
×overgrowthPct. `dmg = max(1, dmg)`. `b.hp -= dmg`; if `b.hp <= 0` → destroy(b).

`destroy(b)`: hp 0, alive false. If cat != wall → stats.buildingsDestroyed++. core →
coreDestroyed. flora_garden → stats.floraLost++; if `collateralTaken > 0` → queue at t+1, s = b.s:
`cdiffPerCollapse` × cdiff then `candidaPerCollapse` × candida.

### 4.5b Building turn (alive b)
* **Attacking buildings** (cat tower, kupffer_gate, cat battery): if `cd > 0` → `cd -= 1`, done.
  Candidates: alive units with `inIntervals(rangeIntervals(def.range or drug.range), u.s)`;
  immune buildings (cat tower, kupffer) skip `t < u.invisibleUntil`; batteries skip types not in
  rx, and do not fire at all if `atp < drug.atp` (stats.outOfAtp++ once per blocked attempt).
  Single-target: pick max s, tie min id. `splash: true` (neutrophil): every candidate in id order.
  If no candidate: done (cd stays 0). Else fire, then reload: if interval >= 3,
  `cd = interval - 2 + next() % 3` (seeded jitter, same average rate), else `cd = interval - 1`.
* **Immune damage** (paneth, iga, macrophage, neutrophil, kupffer) to u (type T, group G):
  `dmg = mulpct(def.dmg, levelPct[lv-1])`; ×factors[G]; ×unitPct[T] if present (macrophage &
  T = typhoid & research.tcells → use tcellTyphoidPct instead; count stats.macrophageTyphoidHits
  when macrophage hits typhoid without tcells); iga and u.vaccinated → ×vaccinatedPct;
  driller → ×drillerImmunePct; peyersAlive and memory[T] > 0 → ×(100 + memoryPctPerStack*stacks)
  (stats.memoryHits++); inDome → ×biofilmImmunePct; defender.boost → ×defenceBoostDmgPct.
  Apply (4.5c). iga additionally: `u.neutralisedUntil = t + neutraliseTicks`, stats.neutralised++.
* **Drug damage** (battery with drug D, letter L = matrix[T][D] or "N"):
  `pct = matrixPct[T][D] if present else effectPct[L]`; `dmg = mulpct(mulpct(D.dmg,
  levelPct[lv-1]), pct)`; R = resistance[D] (hpylori_combo with lv >= quadrupleFromLevel → div(R,2));
  ×(100 − R); inDome → before = dmg; ×biofilmDrugPct; stats.biofilmBlocked += before − dmg;
  defender.boost → ×defenceBoostDmgPct. Bookkeeping: `atp -= D.atp`, stats.atpSpent += D.atp,
  stats.totalShots++, stats.shots[D][L]++, stats.shotsOn[T][L]++; L in {N, X} or
  unit.antibioticsNotNeeded → stats.unnecessary++; L == N → stats.wasted++;
  pressure[D] += gd.pressure[L]; if T == hpylori and D != hpylori_combo → stats.hpyloriSingleDrugHits++
  and pressure.hpylori_combo += hpyloriSingleDrugPressure[D] (if listed). Collateral
  `c = D.collateral`; if c > 0: if ppiActive → c = mulpct(c, ppiCollateralPct); collateral(c).
  D == hpylori_combo → `ppiUntil = t + D.ppiTicks`. Apply dmg (4.5c) with source battery.
* `collateral(c)`: stats.collateral += c. If any alive flora_garden: for each (site order):
  `hp -= c * collateralHp`, `collateralTaken += c`, `lastCollateralTick = t`, destroy if hp <= 0.
  Else `dysbiosis += c`; while `dysbiosis >= noGardenEvery`: subtract, queue one cdiff at t+1,
  s = 2700.
* **acid_moat**: if `t % interval == 0`: base = mulpct(dmg, levelPct); for each alive unit
  (id order) with `s0 <= s < s1`: d = mulpct(base, unit.acid); ppiActive → ×ppiAcidPct; if d > 0
  apply (source "acid"), stats.acidDamage[T] += d.
* **peristalsis**: if not stopflowActive, `t > 0` and `t % intervalByLevel[lv-1] == 0`: for each
  alive unit with `s0 <= s < s1` and state == move: d = flushByLevel[lv-1]; worm → ×wormFlushPct,
  else 'invasive' tag → ×invasiveFlushPct; apply (source "flush"); stats.flushes++.
* **flora_garden**: regen if `t - lastCollateralTick >= regenQuietTicks`:
  `hp = min(maxHp, hp + regen)`. Colonisation: if `t % colonisationEvery == 0` and `hp*2 >= maxHp`:
  for each alive unit of a colonisationTargets type with 2700 <= s < 4000: apply
  `mulpct(colonisationDmg, levelPct[lv-1])` (source "colonisation").
* Others (walls, core, labs, resources, ORS, IV, peyers): nothing here.

### 4.5c Damage to a unit
If dmg <= 0 nothing happens (a 0-damage shot still counts as a shot). `hp -= dmg`; if hp <= 0:
hp = 0, alive false, stats.kills[T]++; source battery → stats.drugKills[D][T]++; source building →
stats.towerKills[key][T]++. If T == amoeba → queue `amoebaCyst.perDeath` amoeba_cyst at t+1 at
the unit's s.

### 4.6 Hydration
```
drain = 0
for u alive (id order) with unit.drain > 0 and u.s >= 1000:
    d = unit.drain
    if t < u.neutralisedUntil: d = mulpct(d, iga.neutralisedDrainPct)
    if u.vaccinated: d = mulpct(d, 100 - vaccines[T])
    drain += d
for each alive villi_wall (site order):
    if any alive unit with 'toxin' tag and |u.s - w.s| <= leakRange: drain += leak; stats.leakDrain += leak
if drain > 0:
    if zincActive: drain = mulpct(drain, zincDrainPct); stats.zincTicks++
    if stopflowActive(t): drain = mulpct(drain, stopflow.drainPct)
severe = hydration*100 < severeBelowPct*hydrationMax
ors = 0; for each alive ors_station: r = refillByLevel[lv-1]; if severe: r = mulpct(r, severeOrsPct); ors += r
iv = 0; for each alive iv_drip (site order):
    if t < b.ivUntil:
        if hydration*100 >= stopAbovePct*hydrationMax: b.ivUntil = t
        else iv += refillByLevel[lv-1]
    elif t >= b.ivReadyAt and hydration*100 < triggerBelowPct*hydrationMax:
        b.ivUntil = t + maxActiveTicks; b.ivReadyAt = t + maxActiveTicks + cooldown
        stats.ivUsed++; iv += refillByLevel[lv-1]
stats.orsRefill += ors; stats.ivRefill += iv
hydration = clamp(hydration - drain + ors + iv, 0, hydrationMax)
hydrationMin = min(hydrationMin, hydration)
if hydration == 0 and drain > 0: collapsed = true
```

### 4.7 Stop-Flow (loperamide)
Allowed iff patient != "child" and `t >= stopflowReadyAt`. Activate: `stopflowUntil = t +
duration`, `stopflowReadyAt = t + duration + cooldown`, stats.stopflowUses++, and if any alive
unit has the 'trapped' tag → stats.stopflowWithTrapped++. Effects while active: drain ×drainPct,
peristalsis off, trapped germs regen + ×trappedDmgPct.

### 4.8 Campaign defender commands
* build: site exists; its building slot is null, removed, or destroyed; `b` in campaign.allowed;
  site.kind in def.sites; def.zones null or site.zone in def.zones; count of alive same key <
  `maxCount[coreLevel-1]`; `cost = def.cost[0] <= budget`; drug_battery needs `drug` in allowedDrugs.
  Place lv 1, full hp, cd 0, rx filtered. `budget -= cost`; stats.built++.
* sell: alive building, key != core → `budget += mulpct(def.cost[0], campaignSellRefundPct)`,
  alive false, removed true; stats.sold++.
* rx: alive drug_battery → rx = filtered list.
* vaccinate (t == 0): u in allowedVaccines, not yet vaccinated, vaccineCost <= budget →
  `vaccines[u] = gd.vaccines[u].efficacy`, budget -= cost, stats.vaccinated.push(u).
* stopflow: 4.7.

### 4.9 End conditions (checked after tick++ in this order)
collapsed → "collapse"; mode attack and no alive destructible building → "destroyed"; mode
campaign and coreDestroyed → "core"; surrendered → "surrender"; tick >= maxTicks → "time";
no alive units and no pending spawns and (attack: every armyLeft == 0; campaign: tick >
lastWaveTick) → "exhausted". When over: final hash mix (section 6) then build the result.

Destructible = existing, not removed, cat != wall.

### 4.10 Result
```jsonc
{
  "ticks": 1234, "reason": "time", "stars": 2, "pct": 63, "coreDestroyed": true, "collapsed": false,
  "survived": false, "timeLeft": 0, "hydrationEnd": 52000, "hydrationMin": 31000, "hydrationMinPct": 31,
  "destroyedSites": ["B3", "CORE"], "standingSites": ["MOAT", "W1"], "pressure": { "ceftriaxone": 12 },
  "atpLeft": 412, "budgetLeft": 0,
  "stats": { ... }, "hash": 123456
}
```
`pct = 100 if collapsed else div(destroyed*100, total)` (0 if total 0). `coreDestroyed` true if
collapsed. `stars = 3 if collapsed else (pct>=50) + coreDestroyed + (pct==100)`.
`survived = !collapsed && core alive`. `timeLeft = div(maxTicks - ticks, tps)` if stars == 3 else 0.
destroyedSites in site order (non-removed buildings not alive, including walls). `standingSites` in
site order (existing, non-removed, alive at the end).

Stats keys (scalars start at 0 and are always present; maps start empty `{}`):
scalars `wasted unnecessary totalShots atpSpent outOfAtp collateral cdiffSpawned candidaSpawned
cystsSpawned floraLost overgrowth stopflowUses stopflowWithTrapped trapTicks hpyloriSingleDrugHits
neutralised memoryHits biofilmBlocked flushes leakDrain orsRefill ivUsed ivRefill zincTicks
liverDamage wormStolen macrophageTyphoidHits built sold buildingsDestroyed`;
maps `deployed kills shots{D:{L:n}} shotsOn{T:{L:n}} drugKills{D:{T:n}} towerKills{B:{T:n}}
acidDamage vaccinatedSpawns reachedLiver spellsUsed`; list `vaccinated`.

### 4.11 Spells (attack)
contaminated_water: `contaminatedUntil = t + duration`. quorum_sensing / immune_evasion: every
alive unit with `|u.s - s| <= radius` gets quorumUntil / invisibleUntil = t + duration.
biofilm_dome: `dome = {s0: s - radius, s1: s + radius, until: t + duration}` (replaces).
stats.spellsUsed[k]++.

### 4.12 Helpers exported by both implementations
* `simulate(gd, setup, commands) -> result` (runs to the end).
* `Battle` class: `new Battle(gd, setup)`, `.command(cmd)` (queues `{...cmd, t: tick}`, returns
  bool = passes cheap pre-validation), `.step()`, fields `tick over result hydration units
  buildings armyLeft spellsLeft budget atp stats dome stopflowUntil ppiUntil commands`, and
  `.events` = list of events produced by the last step (JS only; for rendering):
  `{type:'shot', b, u, dmg, letter?} {type:'splash', b, units:[ids]} {type:'hit', u, b, dmg}
  {type:'kill', u, by} {type:'bdown', b} {type:'spawn', u} {type:'flush'} {type:'acid'}
  {type:'collapse'} {type:'stopflow'} {type:'spell', k, s} {type:'cdiff', s} {type:'iv', b}`.
  Events must not influence state.
* `evaluateObjectives(gd, objectives, result) -> [bool]`: survive → survived; max_unnecessary n;
  max_wasted n; max_shots n (totalShots); min_hydration pct (hydrationMinPct >= pct); no_stopflow;
  killed_with {drugs, n} (sum drugKills over those drugs >= n); building_standing {site} (site not
  in destroyedSites and was present — the sim adds `result.standingSites`); vaccinated {germ};
  max_stat {stat, n}. If not survived, every objective is false.
* `attackScore(gd, result, boostCorrect)` = star*stars + pct*pct + secLeft*timeLeft + boost.
* `trialScore(gd, result)` = (survived ? survive : 0) + perHydrationPct*hydrationMinPct +
  max(0, steward − perUnnecessary*unnecessary − perResistancePoint*Σ div(pressure[D], pointsPerR)).

---------------------------------------------------------------------------------------------------
## 5. Server rules (economy, modes) — app/

* **Resources**: lazily accrued on every state read/write: elapsed seconds since `accrued_at`;
  ATP/h = Σ alive mitochondria perHourByLevel; nutrients/h = Σ nutrient_absorber ×(100 +
  nutrientBonusPct × #flora_garden)/100; add `floor(rate*elapsed/3600)`, cap at
  `core.storage[core-1]`, set accrued_at = now.
* **Layout validation** (every edit; also used by tests on all predefined layouts): site exists;
  site.kind ∈ def.sites; zone allowed; count per key ≤ maxCount[core-1]; lv ≤ core level (core lv
  = core level); battery drug researched/unlocked; rx ⊆ unit keys; exactly one core at CORE.
* **Costs**: build = def.cost; upgrade to lv L = mulpct(cost, upgradeCostPct[L-1]); core upgrade =
  core.upgradeCost[L-1]. Remove refunds sellRefundPct of def.cost. Instant build (no timers).
* **Research**: lab building of that key exists with lv ≥ labLevel; requiresLevel campaign level
  has ≥1 star (0 = none); pay cost. Drugs unlocked = starter.drugs ∪ researched drugs. Units
  unlocked = starter.units ∪ units whose `unlock` level has ≥1 campaign star.
* **Vaccines** (multiplayer/clan): researched vaccines give efficacy; herd: for each vaccine, clan
  coverage c100 = div(vaccinated members*100, members); frac = min(100, div(c100*100,
  coverageFullPct)); indirect = div(eff*frac*indirectSharePct, 10000); vaccinated member:
  100 − div((100−eff)*(100−indirect), 100); unvaccinated: indirect; cap herd.cap.
* **Resistance**: stored per base; on read R −= floor(hours * decayPerHour); after a defence
  R[D] = min(cap, R + div(pressure[D], pointsPerR)).
* **Memory**: after a multiplayer/clan defence, if the base has a peyers_patch, every type with
  kills ≥ memoryKillsNeeded gains a stack (max memoryMaxStacks).
* **Army**: attacker picks counts of unlocked deployable units with Σ space ≤ armySpace[core-1];
  costs trainingNutrientsPerSpace × space nutrients at battle start. Spells: one of each.
* **Matchmaking** `POST /api/battle/find`: random approved non-guest-or-guest player with a base,
  not self, not same clan, not shielded, not under attack, trophies within ±400; else one of the 3
  bots nearest in trophies. Returns a signed find-token (HMAC, 5-min expiry).
* **Battle start** stores the immutable setup (defender snapshot), seed (secrets.randbelow),
  marks defender `under_attack_until = now + 4 min`.
* **Finish**: re-simulate with app/sim.py, compare hash. Server result is authoritative.
  mismatch → flag. Wall-clock check: `finished_at - start_ref >= div(ticks*realtimeFactorPct,
  100*tps) - realtimeSlackSeconds` else flag `too_fast` (league: score 0). start_ref = answered_at
  or created_at. Expired (> battleTimeoutMinutes) → 410.
* **Multiplayer rewards**: loot each resource = min(loot.cap, div(defender_res*(pctBase +
  pctPerStar*stars), 100)) (+ wormStolen nutrients); bots: div(botLoot*stars,3) + 50. Trophies:
  stars ≥ 1 → attacker +winPerStar*stars, defender −same (floor 0); stars 0 → attacker −lossOnZero,
  defender +lossOnZero. Defender: −loot, −atpSpent, resistance, memory, shield (if stars ≥ 1),
  defences_total++, defences_won += (stars ≤ 1), stars_conceded += stars.
* **Campaign**: level N playable if N == 1 or level N−1 has ≥ 1 star. Stars = objectives met
  (0 if not survived). Rewards = div(rewards*(new−old), 3) when improving. Setup from level data.
* **Tournament / league**: settings.league_phase ∈ closed | practice | league | finished. In
  `league`, each player gets ONE scored attempt per tournament base and per trial (counted at
  start). Practice is unscored. Tournament setups use the fixed base + fixed army; knowledge
  question for base/trial i is the same for everyone (`index = (Σ char codes of id * 7) % len`).
  League total = Σ best attack score per base + Σ trial scores.
* **Awards**: Champion = highest league total. Best Clan = highest clan-war stars total (tie:
  league total of top 5 members). Best Steward = highest Σ trial score among players who survived
  all trials (tie: fewer totalShots). Best Defender = lowest stars_conceded / defences_total with
  ≥ 3 defences (tie: more defences).
* **Clan wars**: admin pairs two clans; members' bases are snapshotted at creation (herd immunity
  included). Each member gets attacks_per_member attacks (default 2) on enemy snapshots with their
  own army. War stars = Σ over enemy bases of best stars; tie → Σ best pct.
* **Classroom**: teacher creates a session (campaign level / tournament base / trial) → 6-char
  code, QR (segno SVG) to `<base_url>/#/join/<code>`. Groups join without accounts (group token).
  Results ranked by best score per group (attack score or trial score or campaign stars*1000 +
  hydrationMinPct).
* **Cards** (`app/cards.py`): up to 3 keys from shared/cards.json chosen by the first matching
  triggers in this priority order: dehydration_collapse (collapsed), iv_fluids (ivUsed),
  severe_ors (hydrationMinPct < 25 and ivUsed == 0), cdiff_after_antibiotics (cdiffSpawned),
  stopflow_trap (stopflowWithTrapped), no_antibiotic_virus (shotsOn.rotavirus any),
  antibiotic_unneeded_etec (shotsOn.etec any), hpylori_combo_needed (hpyloriSingleDrugHits),
  amoeba_cysts (cystsSpawned and no luminal kills), fq_resistant_typhoid (shots on typhoid by
  fluoroquinolone), wrong_drug (wasted > 0), resistance_rising (any pressure ≥ 40),
  candida_overgrowth (candidaSpawned or overgrowth), typhoid_macrophage (macrophageTyphoidHits),
  kupffer_liver (reachedLiver typhoid/amoeba), amoeba_abscess (liverDamage), shigella_acid
  (acidDamage.shigella small vs deployed shigella), acid_kills_cholera (acidDamage.cholera),
  hpylori_urease (deployed hpylori), iga_neutralise (neutralised), vaccine_protects
  (vaccinatedSpawns), memory_response (memoryHits), worm_nutrients (wormStolen), biofilm_tolerance
  (biofilmBlocked), peristalsis_flush (flushes), villi_leak (leakDrain), zinc_children (zincTicks),
  immune_evasion / quorum_sensing / contaminated_water (spellsUsed), ors_saved (orsRefill > 0),
  stewardship_win (unnecessary == 0 and totalShots > 0), general_hydration (fallback).

---------------------------------------------------------------------------------------------------
## 6. Hash
`mix(v)`: `h = (h * 1000003 + v) % 1000000007` (v non-negative int). At hash points: mix(t),
mix(hydration), then for every unit (id order): mix(id), mix(s), mix(max(hp,0)), mix(alive?1:0);
then every existing building entry (site order): mix(max(hp,0)), mix(alive?1:0). Final mix uses
`t = ticks` (the tick count at the end).

---------------------------------------------------------------------------------------------------
## 7. HTTP API (all JSON; errors `{"detail": "..."}` with 4xx)

Auth: `Authorization: Bearer <token>`. Classroom battles may instead send `X-Group-Token`.
Roles: player, teacher, observer, admin (+ guest flag).

| Method & path | Body → Response |
|---|---|
| POST /api/auth/register | {username, password, display_name, college, course, email?, is_adult, guardian_name?, guardian_email?, consent: true, consent_version} → {status: "pending"\|"approved", message} |
| POST /api/auth/login | {username, password} → {token, user}; 403 if pending/rejected |
| POST /api/auth/guest | {} → {token, user} |
| POST /api/auth/logout | {} → {ok} |
| GET /api/me | → user |
| DELETE /api/me | {password?} → {ok} (erases account and data) |
| GET /api/privacy | → {version, text} |
| GET /api/state | → State (below) |
| POST /api/base/build | {site, b, drug?, rx?} → State |
| POST /api/base/upgrade | {site} → State (site CORE upgrades the core) |
| POST /api/base/remove | {site} → State |
| POST /api/base/battery | {site, drug?, rx?} → State |
| POST /api/base/policy | {stopflow_at} → State |
| POST /api/research | {key} → State |
| POST /api/deworm | {} → State |
| POST /api/battle/find | {} → {token, opponent:{name, trophies, kind, core_level, college}, layout, core_level, loot:[atp,n]} |
| POST /api/battle/start | {mode, target, army?, boost} → {battle_id, setup, question\|null, opponent, practice:bool} |
| POST /api/battle/{id}/answer | {choice} → {correct, answer, explanation, setup} |
| POST /api/battle/{id}/finish | {commands, claimed:{hash, stars, pct, ticks}} → {verified, mismatch, flags, result, score, rewards:{atp, nutrients, trophies}, objectives\|null, stars_campaign\|null, cards:[keys], unlocked:{units:[], research:[]}} |
| GET /api/battle/{id} | → {id, mode, setup, commands, result, score, attacker, defender, created_at, verified, flags, note} |
| GET /api/battles?kind=attacks\|defences | → {rows:[{id, mode, opponent, stars, pct, score, created_at, verified}]} |
| GET /api/league | → {phase, bases:[{id, name, difficulty, best_score, best_stars, attempts}], trials:[{id, name, best_score, attempts}], total, rank} |
| GET /api/leaderboard/{kind} | kind trophies\|league\|clans\|steward\|defender → {rows:[{rank, name, college, value, extra}]} |
| GET /api/clans | → {rows:[{id, name, college, members}]} |
| POST /api/clans | {name, college} → clan |
| POST /api/clans/{id}/join, POST /api/clans/leave | → State |
| GET /api/clans/{id} | → {clan, members:[{id, name, trophies, vaccines:[germs]}], coverage:{germ:pct}, herd:{germ:pct}, wars:[...]} |
| GET /api/clanwar | → {war\|null, enemies:[{user_id, name, best_stars, core_level}], attacks_left, stars:{mine, theirs}} |
| POST /api/classroom | {mode: campaign\|tournament\|trial, ref, title} → {code, join_url, qr_svg, projector_url} |
| GET /api/classroom/mine | → {rows:[session]} |
| GET /api/classroom/{code} | → {code, title, mode, ref, status, groups} |
| POST /api/classroom/{code}/join | {group_name} → {group_token, group_id} |
| POST /api/classroom/{code}/status | {status: open\|running\|closed} → session |
| GET /api/classroom/{code}/results | → {title, mode, ref, status, rows:[{rank, group, score, stars, pct, survived, unnecessary, attempts}]} |
| GET /api/classroom/{code}/export.csv | (teacher) CSV |
| GET /api/admin/users?status= | → {rows:[user + created_at, is_adult, guardian_name]} |
| POST /api/admin/users/{id} | {action: approve\|reject\|role, role?} → user |
| DELETE /api/admin/users/{id} | → {ok} |
| GET, POST /api/admin/settings | {auto_approve, league_phase, deworming_active} |
| POST /api/admin/clanwar | {clan_a, clan_b, hours, attacks_per_member} → war |
| POST /api/admin/clanwar/{id}/end | → war |
| GET /api/admin/awards | → {champion, best_clan, best_steward, best_defender} |
| GET /api/admin/export/{kind}.csv | kind users\|league\|battles\|clanwars\|trials |
| POST /api/admin/purge | {confirm: "DELETE ALL PLAYER DATA"} → {deleted} |
| GET /api/observer/battles?flag=&mode=&limit= | (observer/admin) → {rows} |
| POST /api/observer/battles/{id}/flag | {flag: suspicious\|cleared, note} |
| POST /api/admin/battles/{id}/invalidate | → {ok} |
| GET /api/projector | public → {league_top, clans_top, recent, war, phase} |
| GET /healthz | → {ok: true} |

`battle/start` modes and targets: `multiplayer` {token}; `tournament` {base_id}; `trial`
{trial_id}; `campaign` {level}; `clanwar` {war_id, user_id}; `classroom` {code} (+X-Group-Token);
`practice` {base_id} (tournament base, never scored).

State:
```jsonc
{ "user": {...}, "resources": {"atp": 0, "nutrients": 0, "cap": 3000},
  "production": {"atp_per_hour": 0, "nutrients_per_hour": 0},
  "base": {"layout": {}, "core_level": 1, "policy": {"stopflow_at": 0}},
  "research": ["ceftriaxone"], "drugs": ["azithromycin"], "units": ["cholera"],
  "vaccines": {"rotavirus": 55}, "herd": {"rotavirus": 10}, "resistance": {"azithromycin": 3},
  "memory": {}, "trophies": 0, "shield_until": null, "dewormed_until": null, "army_space": 20,
  "campaign": {"1": 3}, "trials": {"D1": 1450}, "clan": null,
  "events": {"deworming_active": false}, "league": {"phase": "practice"} }
```
User: `{id, username, display_name, college, role, status, is_guest, clan_id}`.

Static: `/` → static/ (index.html), `/shared/*` → shared/ (questions.json is NOT served raw: the
server exposes questions only through battle/start without answers).

---------------------------------------------------------------------------------------------------
## 8. Client interfaces (RENDER ↔ SHELL)

```js
// static/js/baseview.js (RENDER)
export function mountBaseView(container, { gd, layout, coreLevel, editable, onSiteTap, highlightSites, showRanges })
  // → { update(layout, opts), focusSite(id), destroy() }
// static/js/battle.js (RENDER)
export function mountBattle(container, { gd, cards, setup, mode /* 'attack'|'campaign'|'replay' */,
                                         commands /* replay only */, title, onFinish, onExit })
  // attack: deploy bar (unit cards with counts), spell bar (tap spell then tap path), end button,
  //   hydration meter, timer, destruction %, stars preview. onFinish(commands, localResult)
  // campaign: prep phase at tick 0 (tap empty site → build menu within budget, battery drug + rx,
  //   vaccinate if allowed, sell), then live: pause, speed x1/x2, Stop-Flow button (locked for
  //   child), build/sell/rx during battle. onFinish(commands, localResult)
  // replay: plays setup+commands with play/pause/speed/seek-restart; no onFinish
// static/js/audio.js (RENDER)
export const audio = { unlock(), play(name), music(on), setMuted(b), get muted() }
// static/js/sim.js (SIM)
export { Battle, simulate, evaluateObjectives, attackScore, trialScore, posAt, PATH_LEN }
```
SHELL loads gamedata from `/shared/gamedata.json`, cards from `/shared/cards.json`, guide from
`/shared/guide.json`, and passes them in. SHELL owns everything before `mountBattle` (opponent
preview, army builder, question modal) and after `onFinish` (POST finish, result + cards screen).
