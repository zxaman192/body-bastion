// Plain-language facts and cause-and-effect explanations shared by the battle, mission and result screens.
// Pure functions: no DOM access.

const GROUP_PLURAL = {
  gneg: 'bacteria', gpos: 'bacteria', virus: 'viruses', fungus: 'fungi', protozoa: 'single-celled parasites', helminth: 'worms',
};

function byKey(arr) {
  return new Map((arr || []).map((x) => [x.key, x]));
}

export function groupPlain(gd, groupKey) {
  const g = (gd.groups || {})[groupKey] || {};
  return g.plain || g.name || groupKey;
}

export function unitKind(gd, unitKey) {
  const u = (gd.units || []).find((x) => x.key === unitKey);
  return u ? groupPlain(gd, u.group) : '';
}

function rangeWord(r) {
  if (!r) return null;
  if (r <= 220) return 'short';
  if (r <= 320) return 'medium';
  return 'long';
}

function groupsByFactor(def) {
  const f = def.factors || {};
  const strong = new Set();
  const weak = new Set();
  for (const [g, pct] of Object.entries(f)) {
    const name = GROUP_PLURAL[g] || g;
    if (pct >= 100) strong.add(name);
    else if (pct <= 30) weak.add(name);
  }
  for (const n of strong) weak.delete(n);
  return { strong: [...strong], weak: [...weak] };
}

function list(arr) {
  if (arr.length <= 1) return arr.join('');
  return `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`;
}

// Short labelled facts about a building: what it does, range, strengths and weaknesses.
export function buildingFacts(gd, def) {
  const out = [];
  const tps = gd.tps || 10;
  if (def.cat === 'tower' || def.key === 'kupffer_gate') {
    if (def.dmg && def.interval) out.push({ k: 'Attack', v: `${def.dmg} damage every ${(def.interval / tps).toFixed(1)} s${def.splash ? ', hits every germ in range' : ''}` });
    if (def.range) out.push({ k: 'Range', v: `${rangeWord(def.range)} (${def.range})` });
    const g = groupsByFactor(def);
    if (g.strong.length) out.push({ k: 'Strong against', v: list(g.strong) });
    if (g.weak.length) out.push({ k: 'Weak against', v: list(g.weak) });
  } else if (def.cat === 'wall') {
    out.push({ k: 'Job', v: def.key === 'flora_garden' ? 'Living wall of good bacteria; fights C. difficile and Candida' : 'Blocks germs that walk the gut until they break through' });
    if (def.hp) out.push({ k: 'Health', v: String(def.hp) });
  } else if (def.key === 'ors_station') {
    out.push({ k: 'Job', v: `Refills hydration by ${(def.refillByLevel[0] * tps / 1000).toFixed(1)}% a second` });
    out.push({ k: 'Limit', v: `Below ${def.severeBelowPct}% hydration it works at only ${def.severeOrsPct}% speed` });
  } else if (def.key === 'iv_drip') {
    out.push({ k: 'Job', v: `Switches on below ${def.triggerBelowPct}% hydration and refills fast until ${def.stopAbovePct}%` });
  } else if (def.cat === 'battery') {
    out.push({ k: 'Job', v: 'Fires one antibiotic, only at the germs you prescribe' });
    out.push({ k: 'Cost per shot', v: 'drug ATP (shown on each drug)' });
  } else if (def.key === 'acid_moat') {
    out.push({ k: 'Job', v: 'Damages every germ in the stomach' });
  } else if (def.key === 'peristalsis') {
    out.push({ k: 'Job', v: 'Regularly flushes germs out of the small intestine' });
  }
  return out;
}

export function drugFacts(gd, drug, resistancePct) {
  const out = [{ k: 'Class', v: drug.cls }];
  out.push({ k: 'Cost per shot', v: `${drug.atp} drug ATP` });
  const c = drug.collateral || 0;
  const harm = c === 0 ? 'none' : c <= 1 ? 'low' : c <= 3 ? 'moderate' : 'high';
  out.push({ k: 'Harm to good gut bacteria', v: harm + (c >= 4 ? ' (C. difficile risk)' : ''), warn: c >= 4 });
  if (resistancePct) out.push({ k: 'Local resistance', v: `${resistancePct}%: each shot does ${resistancePct}% less damage`, warn: true });
  return out;
}

// What a germ looks like to the player: kind, behaviour and how many are coming.
export function wavePlan(gd, waves, tps = 10) {
  const units = byKey(gd.units);
  const out = [];
  const totals = new Map();
  (waves || []).slice().sort((a, b) => a.t - b.t).forEach((w, i) => {
    const u = units.get(w.u);
    if (!u) return;
    out.push({ i, t: w.t, u: w.u, n: w.n, name: u.name, secs: Math.round(w.t / tps) });
    totals.set(w.u, (totals.get(w.u) || 0) + (w.n || 0) * (u.spawnCount || 1));
  });
  const kinds = [...totals.entries()].map(([k, n]) => {
    const u = units.get(k);
    return { key: k, n, name: u.name, real: u.real, kind: groupPlain(gd, u.group), group: u.group, how: u.how || u.ability, ability: u.ability, weak: u.weak };
  });
  return { waves: out, kinds };
}

// ------------------------------------------------------------------ live objective status
function siteBuilding(b, site) {
  for (const x of b.buildings) if (x && x.site === site && !x.removed) return x;
  return null;
}

// Status of one star objective during a battle: 'ok' (on track), 'fail', 'done' or 'todo'.
export function liveObjective(gd, o, b, phase) {
  const st = b.stats || {};
  const n = o.n || 0;
  switch (o.key) {
    case 'survive':
      if (b.collapsed || b.coreDestroyed) return { s: 'fail' };
      return { s: b.over ? 'done' : 'ok' };
    case 'min_hydration': {
      const pct = Math.floor((b.hydrationMin * 100) / b.hydrationMax);
      return pct < o.pct ? { s: 'fail', note: `fell to ${pct}%` } : { s: b.over ? 'done' : 'ok', note: `lowest ${pct}%` };
    }
    case 'max_unnecessary': return (st.unnecessary || 0) > n ? { s: 'fail', note: `${st.unnecessary} so far` } : { s: 'ok', note: `${st.unnecessary || 0} of ${n} allowed` };
    case 'max_wasted': return (st.wasted || 0) > n ? { s: 'fail', note: `${st.wasted} wasted` } : { s: 'ok' };
    case 'max_shots': return (st.totalShots || 0) > n ? { s: 'fail', note: `${st.totalShots} shots fired` } : { s: 'ok' };
    case 'no_stopflow': return (st.stopflowUses || 0) > 0 ? { s: 'fail' } : { s: 'ok' };
    case 'killed_with': {
      let k = 0;
      for (const d of o.drugs || []) for (const v of Object.values((st.drugKills || {})[d] || {})) k += v;
      return k >= n ? { s: 'done', note: `${k}/${n}` } : { s: 'todo', note: `${k}/${n}` };
    }
    case 'building_standing': {
      const x = siteBuilding(b, o.site);
      return x && x.alive ? { s: b.over ? 'done' : 'ok' } : { s: 'fail' };
    }
    case 'vaccinated':
      if ((st.vaccinated || []).includes(o.germ)) return { s: 'done' };
      return { s: phase === 'prep' ? 'todo' : 'fail', note: phase === 'prep' ? 'before Start' : null };
    case 'max_stat': {
      const v = st[o.stat] || 0;
      return v > n ? { s: 'fail', note: `${v}` } : { s: 'ok' };
    }
    case 'min_stat': {
      const v = st[o.stat] || 0;
      return v >= n ? { s: 'done' } : { s: 'todo' };
    }
    default:
      return { s: 'ok' };
  }
}

// ------------------------------------------------------------------ after-battle analysis
function sumObj(o) {
  return Object.values(o || {}).reduce((a, v) => a + (typeof v === 'number' ? v : 0), 0);
}

function topEntry(o) {
  let best = null;
  for (const [k, v] of Object.entries(o || {})) {
    const n = typeof v === 'number' ? v : sumObj(v);
    if (!best || n > best[1]) best = [k, n];
  }
  return best;
}

function name(map, k) {
  const x = map.get(k);
  return x ? x.name.split(' (')[0] : k;
}

// Cause -> effect -> what to try, for a campaign mission or Defence Trial.
export function analyseDefence(gd, level, result, objectivesMet) {
  const units = byKey(gd.units);
  const drugs = byKey(gd.drugs);
  const blds = byKey(gd.buildings);
  const st = (result && result.stats) || {};
  const out = [];
  const add = (kind, what, tip) => out.push({ kind, what, tip });

  if (result.collapsed) {
    add('bad', `Hydration reached 0%, so the patient collapsed even though defences were still standing.`,
      st.ivUsed ? 'Fluids could not keep up. Kill the toxin germs sooner (they drain water while alive), or add another ORS station.'
        : 'Build an ORS + Zinc Station before you press Start; below 25% hydration only IV fluids can catch up.');
  } else if (result.coreDestroyed) {
    const left = [];
    for (const [k, n] of Object.entries(st.deployed || {})) {
      const alive = n - ((st.kills || {})[k] || 0);
      if (alive > 0) left.push(`${alive} ${name(units, k)}`);
    }
    add('bad', `Germs reached the Bone Marrow Core and destroyed it${left.length ? ` (${left.slice(0, 3).join(', ')} were never stopped)` : ''}.`,
      'Build defences that are strong against these germs where the gut passes close by, and walls in front of them to hold germs in range.');
  }

  const objs = (level && level.objectives) || [];
  objs.forEach((o, i) => {
    if (!objectivesMet || objectivesMet[i] !== false || !result.survived) return;
    if (o.key === 'min_hydration') add('warn', `Hydration fell to ${result.hydrationMinPct}% (the target was ${o.pct}%).`, 'Rehydration is the first treatment: more ORS early, and kill the germs that drain water before they reach the small intestine.');
    else if (o.key === 'min_stat' && o.stat === 'orsRefill') add('warn', 'No ORS was given.', 'An ORS + Zinc Station is the main treatment for watery diarrhoea. Build one before you press Start.');
    else if (o.key === 'killed_with') {
      const names = (o.drugs || []).map((d) => name(drugs, d)).join(' or ');
      add('warn', `Too few germs were killed with ${names}.`, `Build a Drug Battery with ${names} and tick the germ it should treat on its prescription.`);
    } else if (o.key === 'vaccinated') add('warn', 'The patient was not vaccinated.', 'Vaccinate in the preparation phase, before you press Start.');
    else if (o.key === 'building_standing') add('warn', `The ${name(blds, (level.layout[o.site] || {}).b || '')} at ${o.site} fell.`, 'Put towers near it and walls in front of it.');
    else if (o.key === 'no_stopflow') add('warn', 'Stop-Flow (loperamide) was used.', 'Never slow the gut in dysentery: it traps invasive germs inside.');
    else if (o.key === 'max_shots') add('warn', `${st.totalShots} antibiotic shots were fired, but this patient did not need any.`, 'Remove the Drug Battery: ORS and the immune defences are enough here.');
    else if (o.key === 'max_unnecessary') add('warn', `${st.unnecessary} antibiotic shots were unnecessary.`, 'Prescribe each battery only for germs its drug is meant to treat.');
  });

  const wasted = Object.entries(st.shots || {}).map(([d, by]) => [d, (by || {}).N || 0]).filter(([, n]) => n > 0);
  if (wasted.length) {
    add('warn', `Wasted shots: ${wasted.map(([d, n]) => `${name(drugs, d)} fired ${n} time${n === 1 ? '' : 's'} at germs it cannot kill`).join('; ')}.`,
      'A drug only works on germs inside its spectrum. Every wasted shot costs ATP and breeds resistance.');
  }
  const partial = Object.entries(st.shots || {}).map(([d, by]) => [d, (by || {}).P || 0]).filter(([, n]) => n > 0);
  if (partial.length && result.survived !== undefined) {
    add('info', `${partial.map(([d]) => name(drugs, d)).join(' and ')} did reduced damage because of resistance.`, 'Choose a drug the local germs are still sensitive to.');
  }
  if ((st.stopflowWithTrapped || 0) > 0) add('warn', 'Stop-Flow was used while invasive germs were inside: they were trapped and grew stronger.', 'Avoid antimotility drugs in bloody or febrile diarrhoea.');
  if ((st.cdiffSpawned || 0) > 0 || (st.floraLost || 0) > 0) add('warn', `Antibiotic damage to the gut flora let ${st.cdiffSpawned || 0} C. difficile and ${st.candidaSpawned || 0} Candida appear.`, 'Use narrow, targeted drugs and remove batteries you do not need.');
  if ((st.cystsSpawned || 0) > 0) {
    const cleared = ((st.drugKills || {}).luminal_agent || {}).amoeba_cyst || 0;
    if (cleared < st.cystsSpawned) add('info', `${st.cystsSpawned - cleared} amoeba cysts were left in the gut: the infection can relapse.`, 'A luminal agent clears the cysts that metronidazole misses.');
  }
  if ((st.hpyloriSingleDrugHits || 0) > 0) add('warn', `H. pylori was hit ${st.hpyloriSingleDrugHits} times with a single antibiotic.`, 'Only the full combination regimen cures H. pylori.');

  const kills = sumObj(st.kills);
  const tower = topEntry(st.towerKills);
  const drug = topEntry(st.drugKills);
  if (kills > 0) {
    const parts = [];
    if (tower) parts.push(`${name(blds, tower[0])} (${tower[1]})`);
    if (drug) parts.push(`${name(drugs, drug[0])} (${drug[1]})`);
    const acid = sumObj(st.acidDamage);
    add('good', `Your defences killed ${kills} germs.${parts.length ? ` Most kills: ${parts.join(', ')}.` : ''}${acid ? ` Stomach acid did ${acid} damage.` : ''}`, null);
  }
  if (result.survived && !out.some((x) => x.kind === 'bad' || x.kind === 'warn')) {
    add('good', `The patient survived with hydration never below ${result.hydrationMinPct}%.`, null);
  }
  return out;
}

// Why an attack worked or failed.
export function analyseAttack(gd, setup, result) {
  const units = byKey(gd.units);
  const drugs = byKey(gd.drugs);
  const blds = byKey(gd.buildings);
  const st = (result && result.stats) || {};
  const out = [];
  const add = (kind, what, tip) => out.push({ kind, what, tip });
  const army = (setup && setup.attacker && setup.attacker.army) || {};
  const deployed = st.deployed || {};
  const unused = Object.entries(army).map(([k, n]) => [k, n - (deployed[k] || 0)]).filter(([, n]) => n > 0);

  if (result.collapsed) add('good', 'Their hydration reached zero and the base collapsed: toxin germs win by dehydration.', null);
  else if ((result.stars || 0) === 0) add('bad', `The defence held: only ${result.pct || 0}% of the base was destroyed (50% earns the first star).`, 'Scout first: send germs that the base\'s drugs and towers are weak against.');
  if (unused.length) add('warn', `${unused.reduce((a, [, n]) => a + n, 0)} germs were never deployed (${unused.map(([k, n]) => `${n} ${name(units, k)}`).join(', ')}).`, 'Send every germ before time runs out: unused germs do nothing.');
  const tower = topEntry(st.towerKills);
  const drug = topEntry(st.drugKills);
  if (tower && tower[1] > 0) add('info', `${name(blds, tower[0])} killed ${tower[1]} of your germs.`, 'Biofilm Dome and Immune Evasion protect germs passing a strong tower.');
  if (drug && drug[1] > 0) add('info', `${name(drugs, drug[0])} killed ${drug[1]} of your germs.`, 'Germs outside that drug\'s spectrum walk straight past its battery.');
  const acid = Object.entries(st.acidDamage || {}).sort((a, b) => b[1] - a[1])[0];
  if (acid && acid[1] > 0) add('info', `Stomach acid did ${acid[1]} damage to your ${name(units, acid[0])}.`, 'Acid-sensitive germs (cholera) suffer most in the stomach; H. pylori ignores acid.');
  return out;
}
