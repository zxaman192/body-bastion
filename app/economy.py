import copy

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app import clock, db
from app.gamedata import index_of

MS_PER_HOUR = 3_600_000


def div(a: int, b: int) -> int:
    return a // b


def mulpct(v: int, p: int) -> int:
    return (v * p) // 100


def max_level(gd: dict) -> int:
    return len(gd["levelPct"])


def storage_cap(gd: dict, core_level: int) -> int:
    st = gd["core"]["storage"]
    return st[max(1, min(core_level, len(st))) - 1]


def army_space(gd: dict, core_level: int) -> int:
    sp = gd["core"]["armySpace"]
    return sp[max(1, min(core_level, len(sp))) - 1]


def production(gd: dict, layout: dict) -> tuple[int, int]:
    ix = index_of(gd)
    atp = 0
    nut = 0
    flora = 0
    for site_id in ix.site_order:
        e = layout.get(site_id)
        if not isinstance(e, dict):
            continue
        d = ix.buildings.get(e.get("b"))
        if d is None:
            continue
        lv = _level(e)
        if d["key"] == "mitochondria":
            atp += d["perHourByLevel"][lv - 1]
        elif d["key"] == "nutrient_absorber":
            nut += d["perHourByLevel"][lv - 1]
        elif d["key"] == "flora_garden":
            flora += 1
    bonus = ix.buildings.get("flora_garden", {}).get("nutrientBonusPct", 0)
    nut = div(nut * (100 + bonus * flora), 100)
    return atp, nut


def _level(entry: dict) -> int:
    lv = entry.get("lv", 1)
    return lv if isinstance(lv, int) and not isinstance(lv, bool) and lv >= 1 else 1


def accrue(gd: dict, base: dict, now: float) -> None:
    elapsed_ms = int(max(0.0, now - (base["accrued_at"] or now)) * 1000)
    atp_h, nut_h = production(gd, base["layout"])
    cap = storage_cap(gd, base["core_level"])
    for res, rem, rate in (("atp", "atp_rem", atp_h), ("nutrients", "nut_rem", nut_h)):
        cur = base[res]
        if cur >= cap or rate <= 0:
            base[rem] = 0
            continue
        numer = rate * elapsed_ms + (base[rem] or 0)
        gain = numer // MS_PER_HOUR
        r = numer % MS_PER_HOUR
        new = cur + gain
        if new >= cap:
            new = cap
            r = 0
        base[res] = new
        base[rem] = r
    base["accrued_at"] = now


def add_resources(gd: dict, base: dict, atp: int, nutrients: int) -> tuple[int, int]:
    cap = storage_cap(gd, base["core_level"])
    added = []
    for res, amount in (("atp", atp), ("nutrients", nutrients)):
        cur = base[res]
        if amount <= 0:
            added.append(0)
            continue
        new = cur + amount
        limit = max(cur, cap)
        if new > limit:
            new = limit
        added.append(new - cur)
        base[res] = new
    return added[0], added[1]


def pay(base: dict, atp: int, nutrients: int) -> None:
    if base["atp"] < atp and base["nutrients"] < nutrients:
        raise HTTPException(400, f"Not enough ATP and nutrients (needs {atp} ATP and {nutrients} nutrients).")
    if base["atp"] < atp:
        raise HTTPException(400, f"Not enough ATP (needs {atp}, you have {base['atp']}).")
    if base["nutrients"] < nutrients:
        raise HTTPException(400, f"Not enough nutrients (needs {nutrients}, you have {base['nutrients']}).")
    base["atp"] -= atp
    base["nutrients"] -= nutrients


def decay_resistance(gd: dict, base: dict, now: float) -> None:
    rate = gd["resistance"]["decayPerHour"]
    res = {k: int(v) for k, v in (base.get("resistance") or {}).items() if isinstance(v, int) and v > 0}
    at = base.get("resistance_at") or now
    if not res or rate <= 0:
        base["resistance"] = res
        base["resistance_at"] = now
        return
    elapsed = max(0.0, now - at)
    dec = int(elapsed * rate // 3600)
    if dec > 0:
        res = {k: v - dec for k, v in res.items() if v - dec > 0}
        at = at + dec * 3600 / rate
        if not res:
            at = now
    base["resistance"] = res
    base["resistance_at"] = at


def apply_pressure(gd: dict, base: dict, pressure: dict) -> dict:
    ppr = gd["resistance"]["pointsPerR"]
    cap = gd["resistance"]["cap"]
    drugs = {d["key"] for d in gd["drugs"]}
    res = dict(base.get("resistance") or {})
    gained = {}
    for d, p in (pressure or {}).items():
        if d not in drugs or not isinstance(p, int) or p <= 0:
            continue
        inc = div(p, ppr)
        if inc <= 0:
            continue
        old = res.get(d, 0)
        new = min(cap, old + inc)
        if new > old:
            res[d] = new
            gained[d] = new - old
    base["resistance"] = res
    return gained


def apply_memory(gd: dict, base: dict, defended_layout: dict, kills: dict) -> list[str]:
    ix = index_of(gd)
    peyers = ix.buildings.get("peyers_patch")
    if not peyers:
        return []
    if not any(isinstance(e, dict) and e.get("b") == "peyers_patch" for e in (defended_layout or {}).values()):
        return []
    need = peyers.get("memoryKillsNeeded", 5)
    mx = peyers.get("memoryMaxStacks", 3)
    mem = dict(base.get("memory") or {})
    gained = []
    for u in gd["units"]:
        k = u["key"]
        n = (kills or {}).get(k, 0)
        if isinstance(n, int) and n >= need and mem.get(k, 0) < mx:
            mem[k] = mem.get(k, 0) + 1
            gained.append(k)
    base["memory"] = mem
    return gained


def campaign_stars(base: dict, level) -> int:
    v = (base.get("campaign") or {}).get(str(level), 0)
    return v if isinstance(v, int) else 0


def drugs_unlocked(gd: dict, base: dict) -> list[str]:
    ix = index_of(gd)
    have = set(gd["starter"]["drugs"])
    for key in base.get("research") or []:
        r = ix.research.get(key)
        if r and r.get("kind") == "drug":
            have.add(key)
    return [d["key"] for d in gd["drugs"] if d["key"] in have]


def units_unlocked(gd: dict, base: dict) -> list[str]:
    have = set(gd["starter"]["units"])
    for u in gd["units"]:
        lvl = u.get("unlock", 0)
        if u.get("deployable") and isinstance(lvl, int) and lvl > 0 and campaign_stars(base, lvl) >= 1:
            have.add(u["key"])
    return [u["key"] for u in gd["units"] if u["key"] in have and u.get("deployable")]


def direct_vaccines(gd: dict, base: dict) -> dict:
    ix = index_of(gd)
    out = {}
    researched = set(base.get("research") or [])
    for germ, v in gd["vaccines"].items():
        rkey = ix.vaccine_research.get(germ)
        if rkey and rkey in researched:
            out[germ] = v["efficacy"]
    return out


def clan_herd(gd: dict, conn, clan_id: int | None) -> dict:
    out = {"members": 0, "vaccinated": {}, "coverage": {}, "indirect": {}}
    if not clan_id:
        return out
    rows = conn.execute(
        select(db.users.c.id, db.bases.c.research)
        .select_from(db.users.outerjoin(db.bases, db.bases.c.user_id == db.users.c.id))
        .where(db.users.c.clan_id == clan_id)
    ).all()
    members = len(rows)
    out["members"] = members
    if members == 0:
        return out
    ix = index_of(gd)
    herd = gd["herd"]
    for germ, v in gd["vaccines"].items():
        rkey = ix.vaccine_research.get(germ)
        n = sum(1 for r in rows if rkey and rkey in (r.research or []))
        c100 = div(n * 100, members)
        frac = min(100, div(c100 * 100, herd["coverageFullPct"]))
        indirect = div(v["efficacy"] * frac * herd["indirectSharePct"], 10000)
        out["vaccinated"][germ] = n
        out["coverage"][germ] = c100
        out["indirect"][germ] = min(indirect, herd["cap"])
    return out


def protection(gd: dict, direct: dict, indirect: dict) -> dict:
    cap = gd["herd"]["cap"]
    out = {}
    for germ, v in gd["vaccines"].items():
        ind = indirect.get(germ, 0)
        if germ in direct:
            eff = direct[germ]
            val = 100 - div((100 - eff) * (100 - ind), 100)
        else:
            val = ind
        val = min(val, cap)
        if val > 0:
            out[germ] = val
    return out


def clean_rx(gd: dict, rx) -> list[str]:
    if not isinstance(rx, list):
        return []
    keys = {u["key"] for u in gd["units"]}
    out = []
    for k in rx:
        if isinstance(k, str) and k in keys and k not in out:
            out.append(k)
    return out


def clean_layout(gd: dict, layout: dict) -> dict:
    ix = index_of(gd)
    out = {}
    for site_id in ix.site_order:
        e = layout.get(site_id)
        if not isinstance(e, dict) or e.get("b") not in ix.buildings:
            continue
        item = {"b": e["b"], "lv": _level(e)}
        if e["b"] == "drug_battery":
            item["drug"] = e.get("drug")
            item["rx"] = clean_rx(gd, e.get("rx"))
        out[site_id] = item
    return out


def validate_layout(gd: dict, layout, core_level, drugs: list[str] | None = None) -> list[str]:
    ix = index_of(gd)
    errors: list[str] = []
    mx = max_level(gd)
    if not isinstance(core_level, int) or isinstance(core_level, bool) or not 1 <= core_level <= mx:
        return [f"Core level must be between 1 and {mx}."]
    if not isinstance(layout, dict):
        return ["The layout must be an object of site -> building."]
    unit_keys = {u["key"] for u in gd["units"]}
    drug_keys = {d["key"] for d in gd["drugs"]}
    counts: dict[str, int] = {}
    for site_id, e in layout.items():
        site = ix.sites.get(site_id)
        if site is None:
            errors.append(f"{site_id}: unknown site.")
            continue
        if not isinstance(e, dict) or e.get("b") not in ix.buildings:
            errors.append(f"{site_id}: unknown building.")
            continue
        d = ix.buildings[e["b"]]
        name = d.get("name", d["key"])
        if site["kind"] not in d["sites"]:
            errors.append(f"{site_id}: {name} cannot be placed on a {site['kind']} site.")
        if d.get("zones") and site["zone"] not in d["zones"]:
            errors.append(f"{site_id}: {name} is only allowed in: {', '.join(d['zones'])}.")
        lv = e.get("lv", 1)
        if not isinstance(lv, int) or isinstance(lv, bool) or not 1 <= lv <= mx:
            errors.append(f"{site_id}: level must be between 1 and {mx}.")
        elif d["key"] == "core":
            if lv != core_level:
                errors.append(f"{site_id}: core level {lv} does not match core level {core_level}.")
        elif lv > core_level:
            errors.append(f"{site_id}: {name} level {lv} is above the core level {core_level}.")
        if d["cat"] == "battery":
            drug = e.get("drug")
            if drug not in drug_keys:
                errors.append(f"{site_id}: the drug battery needs a valid drug.")
            elif drugs is not None and drug not in drugs:
                errors.append(f"{site_id}: {drug} has not been researched yet.")
            rx = e.get("rx", [])
            if not isinstance(rx, list) or any(not isinstance(k, str) or k not in unit_keys for k in rx):
                errors.append(f"{site_id}: the prescription list contains unknown germs.")
        counts[d["key"]] = counts.get(d["key"], 0) + 1
    for key, n in counts.items():
        d = ix.buildings[key]
        allowed = d["maxCount"][core_level - 1]
        if n > allowed:
            errors.append(
                f"Too many {d.get('name', key)}: {n} placed, {allowed} allowed at core level {core_level}."
            )
    core = layout.get("CORE")
    if counts.get("core", 0) != 1 or not isinstance(core, dict) or core.get("b") != "core":
        errors.append("The base needs exactly one core, on the CORE site.")
    return errors


def new_base(gd: dict, user_id: int, now: float) -> dict:
    st = gd["starter"]
    start = gd["economy"]["startResources"]
    return {
        "user_id": user_id,
        "layout": clean_layout(gd, copy.deepcopy(st["layout"])),
        "core_level": st["coreLevel"],
        "policy": {"stopflow_at": 0},
        "research": [],
        "resistance": {},
        "resistance_at": now,
        "memory": {},
        "campaign": {},
        "trials": {},
        "atp": start[0],
        "nutrients": start[1],
        "atp_rem": 0,
        "nut_rem": 0,
        "accrued_at": now,
        "trophies": gd["trophies"].get("start", 0),
        "shield_until": None,
        "under_attack_until": None,
        "dewormed_until": None,
        "defences_total": 0,
        "defences_won": 0,
        "stars_conceded": 0,
        "updated_at": now,
    }


def load_base(conn, user_id: int, for_update: bool = False) -> dict | None:
    q = select(db.bases).where(db.bases.c.user_id == user_id)
    if for_update:
        q = q.with_for_update()
    row = conn.execute(q).first()
    if row is None:
        return None
    b = dict(row._mapping)
    for k in ("layout", "policy", "resistance", "memory", "campaign", "trials"):
        b[k] = copy.deepcopy(b[k]) if isinstance(b[k], dict) else {}
    b["research"] = list(b["research"]) if isinstance(b["research"], list) else []
    return b


def ensure_base(conn, gd: dict, user_id: int, now: float, for_update: bool = False) -> dict:
    b = load_base(conn, user_id, for_update)
    if b is not None:
        return b
    nb = new_base(gd, user_id, now)
    try:
        with conn.begin_nested():
            conn.execute(db.bases.insert().values(**nb))
    except IntegrityError:
        pass
    b = load_base(conn, user_id, for_update)
    if b is None:
        raise HTTPException(503, "Could not create your base. Please try again.")
    return b


def save_base(conn, base: dict) -> None:
    values = {k: v for k, v in base.items() if k != "user_id"}
    values["updated_at"] = clock.now()
    conn.execute(db.bases.update().where(db.bases.c.user_id == base["user_id"]).values(**values))


def refresh(gd: dict, base: dict, now: float) -> None:
    accrue(gd, base, now)
    decay_resistance(gd, base, now)


def research_status(gd: dict, base: dict, key: str) -> tuple[dict | None, str | None]:
    ix = index_of(gd)
    r = ix.research.get(key)
    if r is None:
        return None, "Unknown research."
    if key in (base.get("research") or []):
        return r, "Already researched."
    lab = ix.buildings.get(r["lab"], {})
    lab_name = lab.get("name", r["lab"])
    ok = any(
        isinstance(e, dict) and e.get("b") == r["lab"] and _level(e) >= r.get("labLevel", 1)
        for e in base["layout"].values()
    )
    if not ok:
        return r, f"Needs a {lab_name} at level {r.get('labLevel', 1)} or higher."
    req = r.get("requiresLevel", 0) or 0
    if req > 0 and campaign_stars(base, req) < 1:
        return r, f"Earn at least one star on campaign level {req} first."
    return r, None


def validate_army(gd: dict, army, unlocked: list[str], core_level: int) -> tuple[dict, int]:
    if not isinstance(army, dict) or not army:
        raise HTTPException(422, "Choose at least one germ for your army.")
    ix = index_of(gd)
    clean = {}
    space = 0
    for k in army:
        if k not in ix.units:
            raise HTTPException(422, f"Unknown germ: {k}.")
    for u in gd["units"]:
        k = u["key"]
        if k not in army:
            continue
        v = army[k]
        if isinstance(v, bool) or not isinstance(v, int) or v < 0 or v > 500:
            raise HTTPException(422, f"Invalid count for {u.get('name', k)}.")
        if v == 0:
            continue
        if not u.get("deployable") or k not in unlocked:
            raise HTTPException(403, f"{u.get('name', k)} is not unlocked yet.")
        clean[k] = v
        space += v * u["space"]
    if not clean:
        raise HTTPException(422, "Choose at least one germ for your army.")
    cap = army_space(gd, core_level)
    if space > cap:
        raise HTTPException(422, f"Your army needs {space} space but your core allows {cap}.")
    return clean, space


def clan_brief(conn, clan_id: int | None) -> dict | None:
    if not clan_id:
        return None
    row = conn.execute(select(db.clans).where(db.clans.c.id == clan_id)).first()
    if row is None:
        return None
    members = conn.execute(select(func.count()).select_from(db.users).where(db.users.c.clan_id == clan_id)).scalar()
    return {"id": row.id, "name": row.name, "college": row.college, "members": int(members or 0)}


def build_state(gd: dict, conn, user: dict, base: dict, settings: dict, now: float) -> dict:
    from app.security import user_public

    direct = direct_vaccines(gd, base)
    herd = clan_herd(gd, conn, user.get("clan_id"))
    indirect = {k: v for k, v in herd["indirect"].items() if v > 0}
    atp_h, nut_h = production(gd, base["layout"])
    dewormed = base.get("dewormed_until")
    return {
        "user": user_public(user),
        "server_time": clock.iso(now),
        "resources": {
            "atp": base["atp"],
            "nutrients": base["nutrients"],
            "cap": storage_cap(gd, base["core_level"]),
        },
        "production": {"atp_per_hour": atp_h, "nutrients_per_hour": nut_h},
        "base": {
            "layout": base["layout"],
            "core_level": base["core_level"],
            "policy": {"stopflow_at": int((base.get("policy") or {}).get("stopflow_at", 0) or 0)},
        },
        "research": list(base.get("research") or []),
        "drugs": drugs_unlocked(gd, base),
        "units": units_unlocked(gd, base),
        "vaccines": direct,
        "herd": indirect,
        "protection": protection(gd, direct, herd["indirect"]),
        "resistance": dict(base.get("resistance") or {}),
        "memory": dict(base.get("memory") or {}),
        "trophies": base["trophies"],
        "shield_until": clock.iso(base["shield_until"]) if (base.get("shield_until") or 0) > now else None,
        "under_attack_until": (
            clock.iso(base["under_attack_until"]) if (base.get("under_attack_until") or 0) > now else None
        ),
        "dewormed_until": clock.iso(dewormed) if (dewormed or 0) > now else None,
        "army_space": army_space(gd, base["core_level"]),
        "army_nutrients_per_space": gd["economy"]["trainingNutrientsPerSpace"],
        "campaign": dict(base.get("campaign") or {}),
        "trials": dict(base.get("trials") or {}),
        "defence": {
            "total": base.get("defences_total", 0),
            "won": base.get("defences_won", 0),
            "stars_conceded": base.get("stars_conceded", 0),
        },
        "clan": clan_brief(conn, user.get("clan_id")),
        "events": {"deworming_active": bool(settings.get("deworming_active"))},
        "league": {"phase": settings.get("league_phase", "practice")},
    }
