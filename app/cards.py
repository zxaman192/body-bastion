from app.gamedata import cards as load_cards
from app.gamedata import index_of

MAX_CARDS = 3


def _total(v) -> int:
    if isinstance(v, bool):
        return 0
    if isinstance(v, int):
        return v
    if isinstance(v, dict):
        return sum(_total(x) for x in v.values())
    return 0


def triggered(gd: dict, result: dict) -> list[str]:
    st = result.get("stats") or {}

    def n(key) -> int:
        return _total(st.get(key, 0))

    def sub(key, k) -> int:
        m = st.get(key) or {}
        return _total(m.get(k, 0)) if isinstance(m, dict) else 0

    pressure = result.get("pressure") or {}
    deployed_shigella = sub("deployed", "shigella")
    shigella_hp = index_of(gd).units.get("shigella", {}).get("hp", 0)
    spells = st.get("spellsUsed") or {}
    checks = [
        ("dehydration_collapse", bool(result.get("collapsed"))),
        ("iv_fluids", n("ivUsed") > 0),
        ("severe_ors", result.get("hydrationMinPct", 100) < 25 and n("ivUsed") == 0),
        ("cdiff_after_antibiotics", n("cdiffSpawned") > 0),
        ("stopflow_trap", n("stopflowWithTrapped") > 0),
        ("no_antibiotic_virus", sub("shotsOn", "rotavirus") > 0),
        ("antibiotic_unneeded_etec", sub("shotsOn", "etec") > 0),
        ("hpylori_combo_needed", n("hpyloriSingleDrugHits") > 0),
        ("amoeba_cysts", n("cystsSpawned") > 0 and sub("drugKills", "luminal_agent") == 0),
        ("fq_resistant_typhoid", sub("shotsOn", "typhoid") > 0 and sub("shots", "fluoroquinolone") > 0),
        ("wrong_drug", n("wasted") > 0),
        ("resistance_rising", any(isinstance(v, int) and v >= 40 for v in pressure.values())),
        ("candida_overgrowth", n("candidaSpawned") > 0 or n("overgrowth") > 0),
        ("typhoid_macrophage", n("macrophageTyphoidHits") > 0),
        ("kupffer_liver", sub("reachedLiver", "typhoid") > 0 or sub("reachedLiver", "amoeba") > 0),
        ("amoeba_abscess", n("liverDamage") > 0),
        (
            "shigella_acid",
            deployed_shigella > 0 and sub("acidDamage", "shigella") * 10 < deployed_shigella * shigella_hp,
        ),
        ("acid_kills_cholera", sub("acidDamage", "cholera") > 0),
        ("hpylori_urease", sub("deployed", "hpylori") > 0),
        ("iga_neutralise", n("neutralised") > 0),
        ("vaccine_protects", n("vaccinatedSpawns") > 0),
        ("memory_response", n("memoryHits") > 0),
        ("worm_nutrients", n("wormStolen") > 0),
        ("biofilm_tolerance", n("biofilmBlocked") > 0),
        ("peristalsis_flush", n("flushes") > 0),
        ("villi_leak", n("leakDrain") > 0),
        ("zinc_children", n("zincTicks") > 0),
        ("immune_evasion", _total(spells.get("immune_evasion", 0)) > 0),
        ("quorum_sensing", _total(spells.get("quorum_sensing", 0)) > 0),
        ("contaminated_water", _total(spells.get("contaminated_water", 0)) > 0),
        ("ors_saved", n("orsRefill") > 0),
        ("stewardship_win", n("unnecessary") == 0 and n("totalShots") > 0),
    ]
    return [k for k, ok in checks if ok]


def pick(gd: dict, result: dict) -> list[str]:
    available = load_cards()
    out = []
    for key in triggered(gd, result):
        if available and key not in available:
            continue
        out.append(key)
        if len(out) >= MAX_CARDS:
            break
    if not out and (not available or "general_hydration" in available):
        out.append("general_hydration")
    return out
