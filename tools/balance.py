"""Balance report for Body Bastion.

For every campaign level and Defence Trial it plays a scripted "best practice" defence (what the
level's teaching point says to do) and one or more "naive" defences, and checks that best practice
earns every objective while naive play does not. For the ten tournament bases it plays several
scripted attacker strategies and checks that difficulty rises from T1 to T10.

Usage: python tools/balance.py [--quiet]      (exit code 1 if any expectation fails)
"""
import argparse
import copy
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from app import sim  # noqa: E402

GD = json.load(open(os.path.join(ROOT, "shared", "gamedata.json"), encoding="utf-8"))
SEED = 12345


def defence_setup(spec):
    return {
        "mode": "campaign", "seed": SEED, "maxTicks": spec.get("maxTicks", GD["maxTicks"]), "patient": spec.get("patient"),
        "defender": {"layout": copy.deepcopy(spec["layout"]), "coreLevel": spec["coreLevel"], "research": spec.get("research", {}),
                     "vaccines": {}, "resistance": dict(spec.get("resistance") or {}), "memory": {}, "policy": {"stopflow_at": 0},
                     "dewormed": False, "boost": False, "atp": spec.get("atp", 800)},
        "attacker": {"army": {}, "spells": {}, "boost": False},
        "campaign": {"budget": spec["budget"], "allowed": spec["allowed"], "allowedDrugs": spec["allowedDrugs"],
                     "allowedVaccines": spec.get("allowedVaccines", []), "vaccineCost": spec.get("vaccineCost", 0),
                     "waves": spec["waves"]},
    }


def B(site, b, drug=None, rx=None, t=0):
    c = {"t": t, "c": "build", "site": site, "b": b}
    if drug:
        c["drug"] = drug
        c["rx"] = rx or []
    return c


def SELL(site, t=0):
    return {"t": t, "c": "sell", "site": site}


def VAX(u):
    return {"t": 0, "c": "vaccinate", "u": u}


def STOP(t):
    return {"t": t, "c": "stopflow"}


ALL = [u["key"] for u in GD["units"]]

# Strategies: level id -> {name: commands}. "best" must win all stars; others are expected to lose stars.
# Cases have no drug batteries: when each wave attacks, the doctor chooses one treatment (ORS or a drug).


def TREAT(level_id, drugs):
    """One treatment per wave, chosen a tick after the wave starts (as a player would)."""
    lv = next(c for c in GD["campaign"] if c["id"] == level_id)
    starts = sorted({w["t"] for w in lv["waves"]})
    if isinstance(drugs, str):
        drugs = [drugs] * len(starts)
    return [{"t": t + 1, "c": "treat", "d": d} for t, d in zip(starts, drugs) if d]


CAMPAIGN = {
    1: {"best": [B("E2", "ors_station"), B("B4", "iga_cannon")] + TREAT(1, "ors"),
        "antibiotic": [B("E2", "ors_station"), B("B4", "iga_cannon")] + TREAT(1, "azithromycin"),
        "no_treatment": [B("E2", "ors_station"), B("B4", "iga_cannon")]},
    2: {"best": [B("E2", "ors_station"), B("B4", "iga_cannon")] + TREAT(2, "ors"),
        "antibiotic": [B("E2", "ors_station"), B("B4", "iga_cannon")] + TREAT(2, "azithromycin")},
    3: {"best": [B("E2", "iv_drip"), VAX("cholera")] + TREAT(3, "doxycycline"),
        "wrong_drug": [B("E2", "iv_drip"), VAX("cholera")] + TREAT(3, "ceftriaxone")},
    4: {"best": [B("C5", "neutrophil_barracks")] + TREAT(4, "azithromycin"),
        "ciprofloxacin": [B("C5", "neutrophil_barracks")] + TREAT(4, "fluoroquinolone"),
        "stopflow": [B("C5", "neutrophil_barracks"), STOP(300), STOP(700), STOP(1100)] + TREAT(4, "azithromycin")},
    5: {"best": [VAX("typhoid")] + TREAT(5, "ceftriaxone"),
        "ciprofloxacin": [VAX("typhoid")] + TREAT(5, "fluoroquinolone")},
    6: {"best": [B("D1", "macrophage_tower")] + TREAT(6, ["metronidazole", "luminal_agent", "metronidazole"]),
        "metro_only": [B("D1", "macrophage_tower")] + TREAT(6, "metronidazole")},
    7: {"best": [B("A3", "iga_cannon")] + TREAT(7, "hpylori_combo"),
        "single_drug": [B("A3", "iga_cannon")] + TREAT(7, "azithromycin")},
    8: {"best": [SELL("B3"), SELL("C4"), B("E2", "neutrophil_barracks")] + TREAT(8, ["vanco_fidaxo", "ors", "vanco_fidaxo", "vanco_fidaxo"]),
        "metronidazole": [SELL("B3"), SELL("C4"), B("E2", "neutrophil_barracks")] + TREAT(8, "metronidazole")},
    9: {"best": [B("A3", "macrophage_tower")] + TREAT(9, "albendazole"),
        "wrong_drug": [B("A3", "macrophage_tower")] + TREAT(9, "metronidazole")},
    10: {"best": [B("E2", "iv_drip"), B("A4", "iga_cannon"), B("E3", "ors_station")]
                 + TREAT(10, ["ors", "doxycycline", "azithromycin", "ors", "ceftriaxone", "metronidazole", "doxycycline"]),
         "broad_everything": [B("E2", "iv_drip"), B("A4", "iga_cannon"), B("E3", "ors_station")] + TREAT(10, "ceftriaxone")},
}

TRIALS = {
    "D1": {"best": [B("E2", "iv_drip"), B("B4", "drug_battery", "doxycycline", ["cholera"]), B("A3", "iga_cannon")],
           "sloppy": [B("B4", "drug_battery", "ceftriaxone", ALL), B("C5", "drug_battery", "fluoroquinolone", ALL)]},
    "D2": {"best": [{"t": 0, "c": "rx", "site": "C4", "rx": ["shigella"]}, B("D1", "drug_battery", "metronidazole", ["amoeba"]),
                    B("D3", "drug_battery", "luminal_agent", ["amoeba_cyst"]), B("B4", "neutrophil_barracks")],
           "sloppy": [B("B4", "drug_battery", "fluoroquinolone", ALL), STOP(200), STOP(600)]},
    "D3": {"best": [B("D3", "drug_battery", "ceftriaxone", ["typhoid"]), B("A4", "drug_battery", "hpylori_combo", ["hpylori"]),
                    B("B4", "drug_battery", "albendazole", ["worm"]), VAX("typhoid")],
           "sloppy": [B("D3", "drug_battery", "fluoroquinolone", ALL), B("A4", "drug_battery", "azithromycin", ALL)]},
}


def run_defence(spec, cmds):
    res = sim.simulate(GD, defence_setup(spec), cmds)
    return res


def objective_summary(spec, res):
    objs = sim.evaluate_objectives(GD, spec.get("objectives") or [], res)
    return objs, sum(1 for x in objs if x) if res["survived"] else 0


# ----------------------------------------------------------------------------- attackers
ARMY = GD["tournament"]["army"]
PATH_LEN = sim.path_length(GD)


def attack_setup(tb):
    return {
        "mode": "attack", "seed": SEED, "maxTicks": GD["maxTicks"], "patient": None,
        "defender": {"layout": copy.deepcopy(tb["layout"]), "coreLevel": tb["coreLevel"], "research": tb.get("research", {}),
                     "vaccines": dict(tb.get("vaccines") or {}), "resistance": dict(tb.get("resistance") or {}),
                     "memory": dict(tb.get("memory") or {}), "policy": tb.get("policy", {"stopflow_at": 0}), "dewormed": False,
                     "boost": False, "atp": tb.get("atp", 800)},
        "attacker": {"army": dict(ARMY), "spells": dict(GD["tournament"]["spells"]), "boost": False},
    }


def seq(order, start=0, gap=6):
    cmds = []
    t = start
    for u, n in order:
        for _ in range(n):
            cmds.append({"t": t, "c": "deploy", "u": u})
            t += gap
    return cmds, t


def att_toxin_flood():
    a, t = seq([("rotavirus", ARMY.get("rotavirus", 0)), ("etec", ARMY.get("etec", 0)), ("cholera", ARMY.get("cholera", 0))], 0, 5)
    b, t2 = seq([("worm", 1), ("shigella", ARMY.get("shigella", 0)), ("typhoid", 2), ("amoeba", 1), ("hpylori", 1)], t + 40, 12)
    sp = [{"t": 10, "c": "spell", "k": "contaminated_water", "s": 0}, {"t": 140, "c": "spell", "k": "quorum_sensing", "s": 1100},
          {"t": 260, "c": "spell", "k": "biofilm_dome", "s": 1500}, {"t": t + 160, "c": "spell", "k": "immune_evasion", "s": 2600}]
    return sorted(a + b + sp, key=lambda c: c["t"])


def att_tank_first():
    a, t = seq([("worm", 1), ("amoeba", 1), ("shigella", ARMY.get("shigella", 0))], 0, 10)
    b, t2 = seq([("typhoid", 2), ("cholera", ARMY.get("cholera", 0)), ("rotavirus", 3), ("etec", 3), ("hpylori", 1)], t + 60, 6)
    sp = [{"t": 30, "c": "spell", "k": "biofilm_dome", "s": 700}, {"t": t + 70, "c": "spell", "k": "contaminated_water", "s": 0},
          {"t": t + 150, "c": "spell", "k": "quorum_sensing", "s": 1300}, {"t": t + 260, "c": "spell", "k": "immune_evasion", "s": 2400}]
    return sorted(a + b + sp, key=lambda c: c["t"])


def att_waves():
    order = [("shigella", 3), ("cholera", 4), ("worm", 1), ("shigella", 3), ("cholera", 4), ("typhoid", 2), ("amoeba", 1),
             ("rotavirus", 3), ("etec", 3), ("hpylori", 1)]
    cmds = []
    t = 0
    for u, n in order:
        part, t = seq([(u, n)], t, 7)
        cmds += part
        t += 70
    sp = [{"t": 80, "c": "spell", "k": "quorum_sensing", "s": 900}, {"t": 320, "c": "spell", "k": "biofilm_dome", "s": 1600},
          {"t": 500, "c": "spell", "k": "contaminated_water", "s": 0}, {"t": 700, "c": "spell", "k": "immune_evasion", "s": 3000}]
    return sorted(cmds + sp, key=lambda c: c["t"])


def att_rush():
    a, _ = seq([(u, n) for u, n in ARMY.items()], 0, 2)
    return a


def att_naive():
    a, _ = seq([("rotavirus", 3), ("etec", 3)], 0, 30)
    return a


ATTACKERS = {"toxin_flood": att_toxin_flood, "tank_first": att_tank_first, "waves": att_waves, "rush": att_rush}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()
    failures = []
    lines = []

    def out(s=""):
        lines.append(s)
        if not args.quiet:
            print(s)

    out("== Campaign (stars = objectives met; best must be 3, others < 3) ==")
    for lv in GD["campaign"]:
        strat = CAMPAIGN.get(lv["id"], {})
        for name, cmds in strat.items():
            res = run_defence(lv, cmds)
            objs, stars = objective_summary(lv, res)
            st = res["stats"]
            out(f"L{lv['id']:<2} {name:<18} stars={stars} survived={res['survived']!s:<5} reason={res['reason']:<9} minHyd={res['hydrationMinPct']:>3}% "
                f"unnec={st['unnecessary']:>3} shots={st['totalShots']:>3} cdiff={st['cdiffSpawned']} objs={['Y' if o else '-' for o in objs]}")
            if name == "best" and stars < 3:
                failures.append(f"L{lv['id']} best={stars}")
            if name != "best" and stars >= 3:
                failures.append(f"L{lv['id']} {name}={stars}")
        res = run_defence(lv, [])
        objs, stars = objective_summary(lv, res)
        out(f"L{lv['id']:<2} {'do_nothing':<18} stars={stars} survived={res['survived']!s:<5} reason={res['reason']:<9} minHyd={res['hydrationMinPct']:>3}%")
        if stars >= 3:
            failures.append(f"L{lv['id']} do_nothing={stars}")

    out("\n== Defence Trials (score) ==")
    for tr in GD.get("trials", []):
        scores = {}
        for name, cmds in TRIALS.get(tr["id"], {}).items():
            res = run_defence(tr, cmds)
            scores[name] = sim.trial_score(GD, res, tr.get("objectives"))
            out(f"{tr['id']} {name:<10} score={scores[name]:>5} survived={res['survived']} minHyd={res['hydrationMinPct']}% unnec={res['stats']['unnecessary']}")
        res = run_defence(tr, [])
        out(f"{tr['id']} {'nothing':<10} score={sim.trial_score(GD, res, tr.get('objectives')):>5} survived={res['survived']} minHyd={res['hydrationMinPct']}%")
        if not run_defence(tr, TRIALS[tr["id"]]["best"])["survived"]:
            failures.append(f"{tr['id']} best did not survive")
        if scores.get("best", 0) <= scores.get("sloppy", 0):
            failures.append(f"{tr['id']} best<=sloppy")
        if scores.get("best", 0) <= sim.trial_score(GD, res, tr.get("objectives")):
            failures.append(f"{tr['id']} best<=nothing")

    out("\n== Tournament bases (stars / pct per attacker) ==")
    best_by_base = []
    for tb in GD["tournament"]["bases"]:
        row = []
        best = (-1, -1)
        for name, fn in ATTACKERS.items():
            res = sim.simulate(GD, attack_setup(tb), fn())
            row.append(f"{name}={res['stars']}*{res['pct']:>3}%")
            best = max(best, (res["stars"], res["pct"]))
        naive = sim.simulate(GD, attack_setup(tb), att_naive())
        best_by_base.append(best)
        out(f"{tb['id']:<4} {tb['name']:<22} " + "  ".join(row) + f"  naive={naive['stars']}*{naive['pct']}%")
        if naive["stars"] >= 3:
            failures.append(f"{tb['id']} naive 3 stars")
    if best_by_base[0][0] < 3:
        failures.append("T1 best heuristic < 3 stars")
    if best_by_base[-1][0] < 1:
        failures.append("T10 best heuristic 0 stars")
    if best_by_base[-1][0] >= 3:
        failures.append("T10 best heuristic 3 stars")
    for i in range(1, len(best_by_base)):
        if best_by_base[i][0] > best_by_base[i - 1][0] + 1:
            failures.append(f"difficulty not monotonic at {GD['tournament']['bases'][i]['id']}")

    out("\n== Multiplayer: starter army vs starter base ==")
    starter = {"layout": GD["starter"]["layout"], "coreLevel": 1, "research": {}, "vaccines": {}, "resistance": {}, "memory": {},
               "policy": {"stopflow_at": 0}, "atp": 800}
    army = {"cholera": 8, "shigella": 4, "rotavirus": 2, "etec": 2}
    st = {"mode": "attack", "seed": SEED, "maxTicks": GD["maxTicks"], "patient": None, "defender": dict(starter, dewormed=False, boost=False),
          "attacker": {"army": army, "spells": {s["key"]: 1 for s in GD["spells"]}, "boost": False}}
    cmds, _ = seq([("shigella", 4), ("cholera", 8), ("rotavirus", 2), ("etec", 2)], 0, 8)
    res = sim.simulate(GD, st, cmds)
    out(f"starter vs starter: stars={res['stars']} pct={res['pct']} reason={res['reason']}")
    if res["stars"] < 1:
        failures.append("starter army cannot beat the starter base")

    out("\nFAILURES: " + (", ".join(failures) if failures else "none"))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
