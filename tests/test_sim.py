import copy
import json
import os

import pytest

from app import sim

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GD = json.load(open(os.path.join(ROOT, "shared", "gamedata.json"), encoding="utf-8"))


def attack(layout, army, commands, **kw):
    setup = {
        "mode": "attack", "seed": kw.get("seed", 7), "maxTicks": kw.get("maxTicks", 1800), "patient": kw.get("patient"),
        "defender": {"layout": layout, "coreLevel": kw.get("coreLevel", 5), "research": kw.get("research", {}),
                     "vaccines": kw.get("vaccines", {}), "resistance": kw.get("resistance", {}), "memory": {},
                     "policy": kw.get("policy", {"stopflow_at": 0}), "dewormed": False, "boost": False, "atp": kw.get("atp", 800)},
        "attacker": {"army": army, "spells": kw.get("spells", {}), "boost": False},
    }
    b = sim.Battle(GD, setup)
    b.load_commands(commands)
    return b, b.run()


def campaign(level_id, commands):
    lv = next(c for c in GD["campaign"] if c["id"] == level_id)
    setup = {
        "mode": "campaign", "seed": 3, "maxTicks": lv["maxTicks"], "patient": lv["patient"],
        "defender": {"layout": copy.deepcopy(lv["layout"]), "coreLevel": lv["coreLevel"], "research": lv["research"],
                     "vaccines": {}, "resistance": lv["resistance"], "memory": {}, "policy": {"stopflow_at": 0},
                     "dewormed": False, "boost": False, "atp": lv["atp"]},
        "attacker": {"army": {}, "spells": {}, "boost": False},
        "campaign": {"budget": lv["budget"], "allowed": lv["allowed"], "allowedDrugs": lv["allowedDrugs"],
                     "allowedVaccines": lv.get("allowedVaccines", []), "vaccineCost": lv.get("vaccineCost", 0), "waves": lv["waves"]},
    }
    b = sim.Battle(GD, setup)
    b.load_commands(commands)
    return b, b.run(), lv


CORE = {"CORE": {"b": "core", "lv": 5}}


def deploy(u, n, start=0, gap=5):
    return [{"t": start + i * gap, "c": "deploy", "u": u} for i in range(n)]


def test_geometry():
    assert sim.path_length(GD) == 5200
    assert sim.pos_at(GD, 0) == (100, 200)
    assert sim.pos_at(GD, 400) == (500, 200)
    assert sim.pos_at(GD, 5200) == (1300, 1200)
    assert sim.pos_at(GD, 99999) == (1300, 1200)


def test_determinism_and_seed_jitter():
    tb = next(b for b in GD["tournament"]["bases"] if b["id"] == "T5")
    cmds = deploy("shigella", 6) + deploy("cholera", 8, 60)
    _, r1 = attack(copy.deepcopy(tb["layout"]), {"shigella": 6, "cholera": 8}, cmds, coreLevel=tb["coreLevel"])
    _, r2 = attack(copy.deepcopy(tb["layout"]), {"shigella": 6, "cholera": 8}, cmds, coreLevel=tb["coreLevel"])
    _, r3 = attack(copy.deepcopy(tb["layout"]), {"shigella": 6, "cholera": 8}, cmds, coreLevel=tb["coreLevel"], seed=999)
    assert r1 == r2
    assert r1["hash"] != r3["hash"]


def test_dehydration_collapse_is_three_stars():
    _, r = attack(dict(CORE), {"cholera": 30}, deploy("cholera", 30, 0, 2))
    assert r["collapsed"] and r["stars"] == 3 and r["pct"] == 100 and r["reason"] == "collapse"


def test_acid_spares_hpylori_but_hurts_cholera():
    layout = dict(CORE, MOAT={"b": "acid_moat", "lv": 1})
    _, r = attack(layout, {"hpylori": 1, "cholera": 1}, deploy("hpylori", 1) + deploy("cholera", 1, 1), maxTicks=200)
    assert r["stats"]["acidDamage"].get("hpylori", 0) == 0
    assert r["stats"]["acidDamage"].get("cholera", 0) > 0


def test_battery_without_prescription_never_fires():
    layout = dict(CORE, B3={"b": "drug_battery", "lv": 1, "drug": "doxycycline", "rx": []})
    _, r = attack(layout, {"cholera": 5}, deploy("cholera", 5), maxTicks=600)
    assert r["stats"]["totalShots"] == 0


def test_wrong_and_unindicated_drugs_count_as_unnecessary():
    layout = dict(CORE, B3={"b": "drug_battery", "lv": 1, "drug": "ceftriaxone", "rx": ["rotavirus", "etec"]})
    _, r = attack(layout, {"rotavirus": 4, "etec": 4}, deploy("rotavirus", 4) + deploy("etec", 4, 40), maxTicks=900)
    shots = r["stats"]["shots"]["ceftriaxone"]
    assert shots.get("N", 0) > 0 and shots.get("X", 0) > 0
    assert r["stats"]["unnecessary"] == r["stats"]["totalShots"]
    assert r["stats"]["wasted"] == shots.get("N", 0)


def test_stopflow_locked_for_children():
    b, r, lv = campaign(1, [{"t": 100, "c": "stopflow"}])
    assert lv["patient"] == "child"
    assert r["stats"]["stopflowUses"] == 0


def test_amoeba_death_leaves_cyst_and_luminal_agent_clears_it():
    b, r, _ = campaign(6, [{"t": 0, "c": "build", "site": "C5", "b": "drug_battery", "drug": "metronidazole", "rx": ["amoeba"]},
                           {"t": 0, "c": "build", "site": "D3", "b": "drug_battery", "drug": "luminal_agent", "rx": ["amoeba_cyst"]}])
    assert r["stats"]["cystsSpawned"] == r["stats"]["kills"].get("amoeba", 0) > 0
    assert r["stats"]["drugKills"].get("luminal_agent", {}).get("amoeba_cyst", 0) > 0


def test_broad_spectrum_collateral_kills_flora_and_spawns_cdiff():
    layout = dict(CORE, W7={"b": "flora_garden", "lv": 1},
                  C4={"b": "drug_battery", "lv": 5, "drug": "ceftriaxone", "rx": ["worm"]},
                  C5={"b": "drug_battery", "lv": 5, "drug": "fluoroquinolone", "rx": ["worm"]})
    _, r = attack(layout, {"worm": 3}, deploy("worm", 3, 0, 40), atp=5000)
    assert r["stats"]["floraLost"] >= 1
    assert r["stats"]["cdiffSpawned"] >= 1 and r["stats"]["candidaSpawned"] >= 1


def test_campaign_build_spends_budget_and_rejects_overspend():
    b, r, lv = campaign(1, [{"t": 0, "c": "build", "site": "E2", "b": "ors_station"},
                            {"t": 0, "c": "build", "site": "B4", "b": "iga_cannon"},
                            {"t": 0, "c": "build", "site": "A3", "b": "iga_cannon"}])
    assert r["stats"]["built"] == 2
    assert r["budgetLeft"] == lv["budget"] - 300 - 450


def test_vaccination_reduces_spawn_hp():
    b, _ = attack(dict(CORE), {"typhoid": 1}, deploy("typhoid", 1), vaccines={"typhoid": 80}, maxTicks=5)
    hp = next(u for u in GD["units"] if u["key"] == "typhoid")["hp"]
    assert b.units[0].maxHp == hp * 60 // 100


def test_objectives_and_scores():
    b, r, lv = campaign(1, [{"t": 0, "c": "build", "site": "E2", "b": "ors_station"}, {"t": 0, "c": "build", "site": "B4", "b": "iga_cannon"}])
    objs = sim.evaluate_objectives(GD, lv["objectives"], r)
    assert objs == [True, True, True]
    _, r0, _ = campaign(1, [])
    assert sim.evaluate_objectives(GD, lv["objectives"], r0) == [False, False, False]
    sc = GD["scoring"]
    res = {"stars": 2, "pct": 70, "timeLeft": 0}
    assert sim.attack_score(GD, res, True) == 2 * sc["star"] + 70 * sc["pct"] + sc["boost"]


def test_trial_score_rewards_objectives():
    tr = GD["trials"][0]
    res = {"survived": True, "hydrationMinPct": 50, "stats": {"unnecessary": 0, "drugKills": {}}, "pressure": {}, "standingSites": [], "destroyedSites": []}
    base = sim.trial_score(GD, res)
    with_objs = sim.trial_score(GD, res, tr["objectives"])
    assert with_objs >= base


@pytest.mark.parametrize("tb", GD["tournament"]["bases"], ids=lambda b: b["id"])
def test_full_battle_is_fast(tb):
    import time
    army = GD["tournament"]["army"]
    cmds = []
    t = 0
    for u, n in army.items():
        for _ in range(n):
            cmds.append({"t": t, "c": "deploy", "u": u})
            t += 3
    t0 = time.perf_counter()
    attack(copy.deepcopy(tb["layout"]), dict(army), cmds, coreLevel=tb["coreLevel"])
    assert time.perf_counter() - t0 < 2.0


def _first_checkpoint(layout, army, cmds):
    b = sim.Battle(GD, {"mode": "attack", "seed": 7, "defender": {"layout": layout, "coreLevel": 5},
                        "attacker": {"army": army}})
    b.load_commands(cmds)
    while not b.over and b.cpTick[0] < 0:
        b.step()
    return b.cpTick[0]


def test_checkpoints_and_attack_boosts():
    layout = {"CORE": {"b": "core", "lv": 5}}
    cmds = deploy("cholera", 6)
    reach = _first_checkpoint(layout, {"cholera": 6}, cmds)
    assert reach > 0
    early = {"t": reach - 1, "c": "boost", "k": "replication", "z": 0}
    _, r = attack(layout, {"cholera": 6}, cmds + [early])
    assert r["stats"]["boosters"] == {} and r["checkpointTicks"][0] == reach
    good = [{"t": reach + 1, "c": "boost", "k": "quorum_surge", "z": 0},
            {"t": reach + 2, "c": "boost", "k": "replication", "z": 0},
            {"t": reach + 3, "c": "boost", "k": "ors_bolus", "z": 0}]
    _, r = attack(layout, {"cholera": 6}, cmds + good)
    assert r["stats"]["boosters"] == {"quorum_surge": 1}


def test_defence_boosts_help_the_patient():
    _, r0, lv = campaign(3, [])
    reach = r0["checkpointTicks"][0]
    assert reach >= 0 and lv["germ"]
    _, r1, _ = campaign(3, [{"t": reach + 1, "c": "boost", "k": "complement", "z": 0}])
    assert r1["stats"]["boosters"] == {"complement": 1}
    assert sum(r1["stats"]["kills"].values()) >= sum(r0["stats"]["kills"].values())
    _, r2, _ = campaign(3, [{"t": reach + 1, "c": "boost", "k": "ors_bolus", "z": 0}])
    assert r2["hydrationMin"] >= r0["hydrationMin"]
    _, r3, _ = campaign(3, [{"t": reach + 1, "c": "boost", "k": "replication", "z": 0}])
    assert r3["stats"]["boosters"] == {}
