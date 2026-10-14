import copy
import secrets

from app import economy
from app.gamedata import index_of

SEED_MAX = 2147483646


def new_seed() -> int:
    return secrets.randbelow(SEED_MAX - 1) + 1


def all_spells(gd: dict) -> dict:
    return {s["key"]: 1 for s in gd["spells"]}


def defender_from_tbase(gd: dict, tb: dict) -> dict:
    return {
        "layout": economy.clean_layout(gd, copy.deepcopy(tb["layout"])),
        "coreLevel": tb["coreLevel"],
        "research": {"tcells": bool((tb.get("research") or {}).get("tcells"))},
        "vaccines": dict(tb.get("vaccines") or {}),
        "resistance": dict(tb.get("resistance") or {}),
        "memory": dict(tb.get("memory") or {}),
        "policy": {"stopflow_at": int((tb.get("policy") or {}).get("stopflow_at", 0) or 0)},
        "dewormed": False,
        "boost": False,
        "atp": tb.get("atp", gd["defenderAtp"]["default"]),
    }


def defender_from_base(gd: dict, base: dict, protection: dict, now: float) -> dict:
    return {
        "layout": economy.clean_layout(gd, base["layout"]),
        "coreLevel": base["core_level"],
        "research": {"tcells": "tcells" in (base.get("research") or [])},
        "vaccines": dict(protection),
        "resistance": dict(base.get("resistance") or {}),
        "memory": dict(base.get("memory") or {}),
        "policy": {"stopflow_at": int((base.get("policy") or {}).get("stopflow_at", 0) or 0)},
        "dewormed": (base.get("dewormed_until") or 0) > now,
        "boost": False,
        "atp": max(0, min(base["atp"], gd["defenderAtp"]["multiplayerCap"])),
    }


def attack_setup(gd: dict, seed: int, defender: dict, army: dict, spells: dict) -> dict:
    return {
        "mode": "attack",
        "seed": seed,
        "maxTicks": gd["maxTicks"],
        "patient": None,
        "defender": defender,
        "attacker": {"army": dict(army), "spells": dict(spells), "boost": False},
    }


def tournament_setup(gd: dict, seed: int, tb: dict) -> dict:
    t = gd["tournament"]
    return attack_setup(gd, seed, defender_from_tbase(gd, tb), t["army"], t["spells"])


def bot_setup(gd: dict, seed: int, bot: dict, army: dict) -> dict:
    tb = index_of(gd).tbases[bot["base"]]
    return attack_setup(gd, seed, defender_from_tbase(gd, tb), army, all_spells(gd))


def defence_setup(gd: dict, seed: int, spec: dict) -> dict:
    return {
        "mode": "campaign",
        "seed": seed,
        "maxTicks": spec.get("maxTicks", gd["maxTicks"]),
        "patient": spec.get("patient"),
        "defender": {
            "layout": economy.clean_layout(gd, copy.deepcopy(spec["layout"])),
            "coreLevel": spec["coreLevel"],
            "research": {"tcells": bool((spec.get("research") or {}).get("tcells"))},
            "vaccines": {},
            "resistance": dict(spec.get("resistance") or {}),
            "memory": dict(spec.get("memory") or {}),
            "policy": {"stopflow_at": 0},
            "dewormed": False,
            "boost": False,
            "atp": spec.get("atp", gd["defenderAtp"]["default"]),
        },
        "attacker": {"army": {}, "spells": {}, "boost": False},
        "campaign": {
            "budget": spec.get("budget", 0),
            "allowed": list(spec.get("allowed") or []),
            "allowedDrugs": list(spec.get("allowedDrugs") or []),
            "allowedVaccines": list(spec.get("allowedVaccines") or []),
            "vaccineCost": spec.get("vaccineCost", 0),
            "waves": copy.deepcopy(spec.get("waves") or []),
        },
    }


def campaign_setup(gd: dict, seed: int, level: dict) -> dict:
    return defence_setup(gd, seed, level)


def trial_setup(gd: dict, seed: int, trial: dict) -> dict:
    return defence_setup(gd, seed, trial)


def classroom_target(gd: dict, mode: str, ref: str) -> dict | None:
    ix = index_of(gd)
    if mode == "campaign":
        try:
            lvl = int(ref)
        except (TypeError, ValueError):
            return None
        return ix.campaign.get(lvl)
    if mode == "tournament":
        return ix.tbases.get(ref)
    if mode == "trial":
        return ix.trials.get(ref)
    return None


def classroom_setup(gd: dict, seed: int, mode: str, ref: str) -> dict | None:
    target = classroom_target(gd, mode, ref)
    if target is None:
        return None
    if mode == "tournament":
        return tournament_setup(gd, seed, target)
    return defence_setup(gd, seed, target)


def target_name(gd: dict, mode: str, ref: str) -> str:
    target = classroom_target(gd, mode, ref)
    if target is None:
        return str(ref)
    if mode == "campaign":
        return f"Level {target['id']}: {target.get('title', target.get('germ', ''))}"
    return target.get("name", str(ref))
