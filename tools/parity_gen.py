"""Generate Python/JS simulation parity fixtures.

Writes tools/parity_fixtures.json: a list of {name, setup, commands, result, live} scenarios whose
`result` comes from app/sim.py. tools/parity_check.mjs replays each one through static/js/sim.js
and deep-compares the full result (stats and hash included).

Usage: python tools/parity_gen.py [--count-scale N] [--out PATH]
"""
import argparse
import hashlib
import json
import os
import random
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from app import sim  # noqa: E402

GD_PATH = os.path.join(ROOT, 'shared', 'gamedata.json')
OUT_PATH = os.path.join(ROOT, 'tools', 'parity_fixtures.json')


def load_gd():
    with open(GD_PATH, encoding='utf-8') as f:
        return json.load(f)


def gd_digest():
    with open(GD_PATH, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def tournament_setup(gd, base, seed, army=None, spells=None, boost=False, max_ticks=None):
    return {
        'mode': 'attack',
        'seed': seed,
        'maxTicks': max_ticks if max_ticks is not None else gd['maxTicks'],
        'patient': None,
        'defender': {
            'layout': base['layout'],
            'coreLevel': base['coreLevel'],
            'research': base.get('research', {}),
            'vaccines': base.get('vaccines', {}),
            'resistance': base.get('resistance', {}),
            'memory': base.get('memory', {}),
            'policy': base.get('policy', {'stopflow_at': 0}),
            'dewormed': False,
            'boost': False,
            'atp': base.get('atp', gd['defenderAtp']['default']),
        },
        'attacker': {
            'army': dict(gd['tournament']['army']) if army is None else army,
            'spells': dict(gd['tournament']['spells']) if spells is None else spells,
            'boost': boost,
        },
    }


def campaign_setup(gd, level, seed, defender_boost=False, dewormed=False, patient=None):
    return {
        'mode': 'campaign',
        'seed': seed,
        'maxTicks': level.get('maxTicks', gd['maxTicks']),
        'patient': level.get('patient') if patient is None else patient,
        'defender': {
            'layout': level['layout'],
            'coreLevel': level['coreLevel'],
            'research': level.get('research', {}),
            'vaccines': {},
            'resistance': level.get('resistance', {}),
            'memory': level.get('memory', {}),
            'policy': {'stopflow_at': 0},
            'dewormed': dewormed,
            'boost': defender_boost,
            'atp': level.get('atp', gd['defenderAtp']['default']),
        },
        'attacker': {'army': {}, 'spells': {}, 'boost': False},
        'campaign': {
            'budget': level['budget'],
            'allowed': level['allowed'],
            'allowedDrugs': level['allowedDrugs'],
            'allowedVaccines': level.get('allowedVaccines', []),
            'vaccineCost': level.get('vaccineCost', 0),
            'waves': level['waves'],
        },
    }


class Gen:
    def __init__(self, gd, rnd):
        self.gd = gd
        self.r = rnd
        self.units = [u['key'] for u in gd['units']]
        self.deployable = [u['key'] for u in gd['units'] if u.get('deployable')]
        self.drugs = [d['key'] for d in gd['drugs']]
        self.spells = [s['key'] for s in gd['spells']]
        self.bdefs = {b['key']: b for b in gd['buildings']}
        self.sites = gd['map']['sites']
        self.vacc_germs = list(gd['vaccines'].keys())
        bst = gd.get('boosters', {})
        self.boosts = {'attack': [b['key'] for b in bst.get('attack', [])],
                       'defence': [b['key'] for b in bst.get('defence', [])]}

    def boost_commands(self, side, horizon):
        r = self.r
        other = 'defence' if side == 'attack' else 'attack'
        keys = self.boosts[side] * 3 + self.boosts[other][:1] + ['bogus_boost']
        out = []
        if r.random() < 0.65:
            for _ in range(r.randint(1, 7)):
                out.append({'t': r.randint(0, horizon), 'c': 'boost', 'k': r.choice(keys),
                            'z': r.choice([0, 1, 2, 3, 0, 1, 2, 3, -1, 4, 1.0, '1', None])})
        return out

    def rx(self):
        r = self.r
        k = r.choice([0, 1, 1, 2, 3, 5, len(self.units)])
        out = r.sample(self.units, min(k, len(self.units)))
        if r.random() < 0.06:
            out.append('bogus_germ')
        if r.random() < 0.03:
            out.append(7)
        return out

    def layout(self, core_level, chaos=False):
        r = self.r
        lay = {}
        for st in self.sites:
            kind = st['kind']
            zone = st['zone']
            if kind == 'core':
                if chaos and r.random() < 0.1:
                    continue
                lay[st['id']] = {'b': 'core', 'lv': core_level}
                continue
            opts = []
            for key, d in self.bdefs.items():
                if key == 'core':
                    continue
                if kind not in d['sites'] and not (chaos and r.random() < 0.05):
                    continue
                zones = d.get('zones')
                if zones is not None and zone not in zones and not chaos:
                    continue
                opts.append(key)
            if not opts:
                continue
            p = {'moat': 0.75, 'wall': 0.55, 'kupffer': 0.5, 'peristalsis': 0.6}.get(kind, 0.55)
            if r.random() > p:
                continue
            key = r.choice(opts)
            lv = r.randint(1, core_level) if not chaos else r.randint(0, 6)
            e = {'b': key, 'lv': lv}
            if key == 'drug_battery':
                e['drug'] = r.choice(self.drugs) if not (chaos and r.random() < 0.1) else 'placebo'
                e['rx'] = self.rx()
            lay[st['id']] = e
        if chaos and r.random() < 0.3:
            lay['NOWHERE'] = {'b': 'paneth_tower', 'lv': 1}
        return lay

    def defender_extras(self, de):
        r = self.r
        if r.random() < 0.4:
            de['vaccines'] = {g: r.choice([0, 30, 55, 65, 80, 95]) for g in r.sample(self.vacc_germs, r.randint(1, 3))}
        if r.random() < 0.4:
            de['resistance'] = {d: r.choice([0, 10, 40, 60, 90]) for d in r.sample(self.drugs, r.randint(1, 4))}
        if r.random() < 0.4:
            de['memory'] = {u: r.choice([1, 2, 3, 5]) for u in r.sample(self.units, r.randint(1, 4))}
        if r.random() < 0.3:
            de['research'] = {'tcells': r.random() < 0.6}
        if r.random() < 0.35:
            de['policy'] = {'stopflow_at': r.choice([0, 20, 40, 60, 80, 95])}
        de['dewormed'] = r.random() < 0.2
        de['boost'] = r.random() < 0.2

    def attack_commands(self, army, spells, horizon):
        r = self.r
        cmds = []
        for u, n in army.items():
            extra = r.choice([0, 0, 0, 1, 3])
            style = r.random()
            base_t = r.randint(0, max(0, horizon // 3))
            for i in range(n + extra):
                if style < 0.3:
                    t = base_t + i * r.randint(0, 4)
                elif style < 0.6:
                    t = r.randint(0, horizon)
                else:
                    t = base_t + (i // 4) * r.randint(20, 120)
                cmds.append({'t': t, 'c': 'deploy', 'u': u})
        for k, n in spells.items():
            for _ in range(n + (1 if r.random() < 0.15 else 0)):
                cmds.append({'t': r.randint(0, horizon), 'c': 'spell', 'k': k,
                             's': r.choice([r.randint(0, 5200), r.randint(0, 2000), r.randint(-50, 5300)])})
        if r.random() < 0.1:
            cmds.append({'t': r.randint(0, horizon + 200), 'c': 'end'})
        cmds.extend(self.boost_commands('attack', horizon + 900))
        if r.random() < 0.15:
            cmds.extend(self.junk_commands(horizon))
        r.shuffle(cmds)
        return cmds

    def junk_commands(self, horizon):
        r = self.r
        junk = [
            {'t': -1, 'c': 'deploy', 'u': 'cholera'},
            {'t': 99999, 'c': 'deploy', 'u': 'cholera'},
            {'t': 3, 'c': 'deploy', 'u': 'candida'},
            {'t': 4, 'c': 'deploy', 'u': 'cdiff'},
            {'t': 5, 'c': 'deploy', 'u': 'nonsense'},
            {'t': 6, 'c': 'spell', 'k': 'meteor', 's': 100},
            {'t': 7, 'c': 'spell', 'k': 'biofilm_dome'},
            {'t': 8.0, 'c': 'deploy', 'u': 'etec'},
            {'t': 9.5, 'c': 'deploy', 'u': 'etec'},
            {'t': '10', 'c': 'deploy', 'u': 'etec'},
            {'t': 11, 'c': 'build', 'site': 'A1', 'b': 'paneth_tower'},
            {'t': 12, 'c': 'stopflow'},
            {'t': 13, 'c': 'warp'},
            {'t': 14},
            {'c': 'deploy', 'u': 'cholera'},
            {'t': True, 'c': 'deploy', 'u': 'cholera'},
            {'t': 15, 'c': 'spell', 'k': 'quorum_sensing', 's': 1500.0},
            {'t': 16, 'c': 'spell', 'k': 'quorum_sensing', 's': [1]},
            {'t': 17, 'c': 'deploy', 'u': ['cholera']},
            7,
            None,
        ]
        return r.sample(junk, r.randint(1, 6))

    def random_attack(self, idx):
        r = self.r
        chaos = r.random() < 0.06
        core_level = r.randint(1, 5)
        de = {
            'layout': self.layout(core_level, chaos),
            'coreLevel': core_level,
            'research': {'tcells': False},
            'vaccines': {},
            'resistance': {},
            'memory': {},
            'policy': {'stopflow_at': 0},
            'atp': r.choice([0, 3, 40, 300, 800, 1500, 4000]),
        }
        self.defender_extras(de)
        army = {}
        for u in r.sample(self.deployable, r.randint(1, len(self.deployable))):
            army[u] = r.randint(1, 10)
        if r.random() < 0.05:
            army['candida'] = 3
            army['bogus'] = 2
        spells = {}
        for k in self.spells:
            if r.random() < 0.6:
                spells[k] = r.choice([1, 1, 2])
        mt = r.choice([None, 1800, 1800, 1800, 900, 400, 120])
        setup = {
            'mode': 'attack',
            'seed': r.choice([r.randint(1, 2147483646), 0, -5, 2147483647, r.randint(1, 1000)]),
            'patient': r.choice([None, None, 'child', 'adult', 'elder']),
            'defender': de,
            'attacker': {'army': army, 'spells': spells, 'boost': r.random() < 0.3},
        }
        if mt is not None:
            setup['maxTicks'] = mt
        horizon = r.choice([30, 200, 600, 1500])
        cmds = self.attack_commands(army, spells, horizon)
        return 'attack_%d' % idx, setup, cmds

    def tournament(self, base, idx):
        r = self.r
        gd = self.gd
        army = dict(gd['tournament']['army'])
        if r.random() < 0.3:
            army = {u: max(0, n + r.randint(-3, 3)) for u, n in army.items()}
        spells = dict(gd['tournament']['spells'])
        setup = tournament_setup(gd, base, r.randint(1, 2147483646), army, spells, boost=r.random() < 0.3)
        if r.random() < 0.2:
            self.defender_extras(setup['defender'])
        horizon = r.choice([20, 150, 500, 1200])
        cmds = self.attack_commands(army, spells, horizon)
        return 'tournament_%s_%d' % (base['id'], idx), setup, cmds

    def campaign(self, level, tag, idx):
        r = self.r
        gd = self.gd
        patient = None
        if r.random() < 0.15:
            patient = r.choice(['child', 'adult'])
        setup = campaign_setup(gd, level, r.randint(1, 2147483646), defender_boost=r.random() < 0.2,
                               dewormed=r.random() < 0.2, patient=patient)
        if r.random() < 0.15:
            setup['campaign'] = dict(setup['campaign'])
            setup['campaign']['budget'] = r.choice([0, 200, 5000])
        if r.random() < 0.15:
            setup['defender'] = dict(setup['defender'])
            setup['defender']['atp'] = r.choice([0, 20, 100])
        mt = setup['maxTicks']
        allowed = level['allowed']
        drugs = level['allowedDrugs']
        all_b = [b for b in self.bdefs if b != 'core']
        site_ids = [s['id'] for s in self.sites]
        cmds = []
        n_build = r.randint(0, 9)
        for _ in range(n_build):
            b = r.choice(allowed) if r.random() < 0.85 else r.choice(all_b)
            c = {'t': r.choice([0, 0, 0, r.randint(0, mt)]), 'c': 'build', 'site': r.choice(site_ids), 'b': b}
            if b == 'drug_battery' or r.random() < 0.05:
                c['drug'] = r.choice(drugs) if r.random() < 0.85 else r.choice(self.drugs)
                c['rx'] = self.rx()
            cmds.append(c)
        for _ in range(r.randint(0, 3)):
            cmds.append({'t': r.choice([0, r.randint(0, mt)]), 'c': 'sell', 'site': r.choice(site_ids)})
        for _ in range(r.randint(0, 4)):
            cmds.append({'t': r.randint(0, mt), 'c': 'rx', 'site': r.choice(site_ids), 'rx': self.rx()})
        for _ in range(r.choice([0, 0, 1, 2, 4])):
            cmds.append({'t': r.randint(0, mt), 'c': 'stopflow'})
        for g in self.vacc_germs:
            if r.random() < 0.3:
                cmds.append({'t': 0 if r.random() < 0.85 else r.randint(1, 50), 'c': 'vaccinate', 'u': g})
        if r.random() < 0.1:
            cmds.append({'t': r.randint(0, mt), 'c': 'deploy', 'u': 'cholera'})
            cmds.append({'t': r.randint(0, mt), 'c': 'end'})
        cmds.extend(self.boost_commands('defence', mt))
        if r.random() < 0.1:
            cmds.extend(self.junk_commands(mt))
        return 'campaign_%s_%d' % (tag, idx), setup, cmds


def edge_cases(gd):
    out = []
    out.append(('edge_empty_setup', {}, []))
    out.append(('edge_none_commands', {'mode': 'attack', 'seed': 1}, None))
    out.append(('edge_garbage_types', {'mode': 7, 'seed': 'x', 'maxTicks': 'long', 'patient': 3,
                                       'defender': [], 'attacker': 'army'}, [{'t': 0, 'c': 'end'}]))
    starter = gd['starter']
    out.append(('edge_starter_no_army', {
        'mode': 'attack', 'seed': 42, 'patient': None,
        'defender': {'layout': starter['layout'], 'coreLevel': starter['coreLevel']},
        'attacker': {'army': {}, 'spells': {}}}, []))
    out.append(('edge_campaign_no_waves', {
        'mode': 'campaign', 'seed': 42, 'maxTicks': 300,
        'defender': {'layout': starter['layout'], 'coreLevel': 1},
        'campaign': {'budget': 1000, 'allowed': ['ors_station'], 'waves': []}},
        [{'t': 0, 'c': 'build', 'site': 'E2', 'b': 'ors_station'}]))
    out.append(('edge_wave_gap0', {
        'mode': 'campaign', 'seed': 9, 'maxTicks': 600,
        'defender': {'layout': {'CORE': {'b': 'core', 'lv': 1}}, 'coreLevel': 1},
        'campaign': {'budget': 0, 'waves': [{'t': 5, 'u': 'shigella', 'n': 6, 'gap': 0},
                                            {'t': 5, 'u': 'amoeba', 'n': 2},
                                            {'t': 700, 'u': 'cholera', 'n': 2, 'gap': 5},
                                            {'t': 10, 'u': 'ghost', 'n': 2, 'gap': 5}]}}, []))
    return out


def run_scenario(gd, setup, commands):
    setup_rt = json.loads(json.dumps(setup))
    cmds_rt = json.loads(json.dumps(commands))
    return sim.simulate(gd, setup_rt, cmds_rt)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--count-scale', type=float, default=1.0)
    ap.add_argument('--out', default=OUT_PATH)
    ap.add_argument('--seed', type=int, default=20261005)
    args = ap.parse_args()
    gd = load_gd()
    rnd = random.Random(args.seed)
    g = Gen(gd, rnd)
    scen = []
    n_attack = int(720 * args.count_scale)
    for i in range(n_attack):
        scen.append(g.random_attack(i))
    for base in gd['tournament']['bases']:
        for i in range(int(32 * args.count_scale)):
            scen.append(g.tournament(base, i))
    for level in gd['campaign']:
        for i in range(int(36 * args.count_scale)):
            scen.append(g.campaign(level, 'L%d' % level['id'], i))
    for trial in gd['trials']:
        for i in range(int(40 * args.count_scale)):
            scen.append(g.campaign(trial, trial['id'], i))
    scen.extend(edge_cases(gd))
    t0 = time.perf_counter()
    out = []
    for i, (name, setup, cmds) in enumerate(scen):
        res = run_scenario(gd, setup, cmds)
        out.append({'name': name, 'setup': setup, 'commands': cmds, 'result': res, 'live': i % 4 == 0})
    dt = time.perf_counter() - t0
    doc = {'gamedataSha256': gd_digest(), 'count': len(out), 'scenarios': out}
    with open(args.out, 'w', encoding='utf-8') as f:
        json.dump(doc, f, separators=(',', ':'))
    size = os.path.getsize(args.out)
    reasons = {}
    for s in out:
        reasons[s['result']['reason']] = reasons.get(s['result']['reason'], 0) + 1
    print('parity_gen: %d scenarios, python sim %.1fs (%.1f ms avg), fixtures %.1f MB -> %s'
          % (len(out), dt, dt * 1000 / max(1, len(out)), size / 1e6, args.out))
    print('end reasons:', json.dumps(reasons, sort_keys=True))


if __name__ == '__main__':
    main()
