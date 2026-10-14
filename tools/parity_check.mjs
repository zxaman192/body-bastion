// Replays every scenario in tools/parity_fixtures.json through static/js/sim.js and deep-compares
// the full result (stats and hash included) with the Python result. Scenarios flagged `live` are
// also replayed step by step through the Battle API (command() + step()) and must match too.
// Usage: node tools/parity_check.mjs [fixtures.json]
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { simulate, Battle } from '../static/js/sim.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const gdRaw = readFileSync(join(root, 'shared', 'gamedata.json'));
const gd = JSON.parse(gdRaw.toString('utf-8'));
const fixturesPath = process.argv[2] || join(here, 'parity_fixtures.json');
const doc = JSON.parse(readFileSync(fixturesPath, 'utf-8'));

const digest = createHash('sha256').update(gdRaw).digest('hex');
if (doc.gamedataSha256 && doc.gamedataSha256 !== digest) {
  console.error('parity_check: fixtures were generated from a different shared/gamedata.json; re-run tools/parity_gen.py');
  process.exit(2);
}

function diff(a, b, path) {
  if (a === b) return null;
  if (typeof a !== typeof b || a === null || b === null) return `${path}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return `${path}: array vs non-array`;
    if (a.length !== b.length) return `${path}: length ${a.length} != ${b.length} (${JSON.stringify(a)} vs ${JSON.stringify(b)})`;
    for (let i = 0; i < a.length; i++) {
      const d = diff(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  if (typeof a === 'object') {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    if (ka.join('\u0000') !== kb.join('\u0000')) {
      return `${path}: keys ${JSON.stringify(ka)} != ${JSON.stringify(kb)}`;
    }
    for (const k of ka) {
      const d = diff(a[k], b[k], `${path}.${k}`);
      if (d) return d;
    }
    return null;
  }
  return `${path}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`;
}

function validCommands(commands, maxTicks) {
  const keep = [];
  if (!Array.isArray(commands)) return keep;
  for (const c of commands) {
    if (c === null || typeof c !== 'object' || Array.isArray(c)) continue;
    if (typeof c.t !== 'number' || !Number.isInteger(c.t) || c.t < 0 || c.t >= maxTicks) continue;
    keep.push(c);
  }
  keep.sort((x, y) => x.t - y.t);
  return keep;
}

function runLive(setup, commands) {
  const b = new Battle(gd, setup);
  const cmds = validCommands(commands, b.maxTicks);
  let i = 0;
  let events = 0;
  while (!b.over) {
    while (i < cmds.length && cmds[i].t < b.tick) i++;
    while (i < cmds.length && cmds[i].t === b.tick) {
      const c = Object.assign({}, cmds[i]);
      delete c.t;
      b.command(c);
      i++;
    }
    b.step();
    events += b.events.length;
  }
  return { result: b.result, events };
}

const t0 = performance.now();
let mismatches = 0;
let liveRuns = 0;
let totalEvents = 0;
const scenarios = doc.scenarios;
for (const sc of scenarios) {
  const got = simulate(gd, sc.setup, sc.commands);
  const json = JSON.parse(JSON.stringify(got));
  const d = diff(json, sc.result, 'result');
  if (d) {
    mismatches++;
    if (mismatches <= 15) console.log(`MISMATCH ${sc.name}: ${d}`);
    continue;
  }
  if (sc.live) {
    liveRuns++;
    const live = runLive(sc.setup, sc.commands);
    totalEvents += live.events;
    const dl = diff(JSON.parse(JSON.stringify(live.result)), sc.result, 'live');
    if (dl) {
      mismatches++;
      if (mismatches <= 15) console.log(`LIVE MISMATCH ${sc.name}: ${dl}`);
    }
  }
}
const dt = performance.now() - t0;
console.log(`parity_check: ${scenarios.length} scenarios (+${liveRuns} live step-by-step replays, ${totalEvents} events), ` +
  `${mismatches} mismatches, ${(dt / 1000).toFixed(1)}s`);
process.exit(mismatches === 0 ? 0 : 1);
