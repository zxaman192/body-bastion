import copy

from fastapi import APIRouter, Body, Depends, HTTPException

from app import clock, db, economy, security
from app.gamedata import get_gd, index_of
from app.util import as_dict, get_int, get_str

router = APIRouter(prefix="/api", tags=["game"])


def _state(conn, gd: dict, user: dict, base: dict, now: float) -> dict:
    return economy.build_state(gd, conn, user, base, db.get_settings(conn), now)


def _open_base(conn, gd: dict, user: dict, now: float) -> dict:
    base = economy.ensure_base(conn, gd, user["id"], now, for_update=True)
    economy.refresh(gd, base, now)
    return base


def _check_layout(gd: dict, base: dict, layout: dict, core_level: int) -> None:
    errors = economy.validate_layout(gd, layout, core_level, economy.drugs_unlocked(gd, base))
    if errors:
        raise HTTPException(422, errors[0])


def _site(gd: dict, p: dict) -> str:
    site = get_str(p, "site", max_len=12)
    if site not in index_of(gd).sites:
        raise HTTPException(422, "Unknown site.")
    return site


@router.get("/state")
def get_state(user: dict = Depends(security.current_user)):
    gd = get_gd()
    now = clock.now()
    with db.engine().begin() as conn:
        base = _open_base(conn, gd, user, now)
        economy.save_base(conn, base)
        return _state(conn, gd, user, base, now)


@router.post("/base/build")
def build(payload: dict = Body(default=None), user: dict = Depends(security.current_user)):
    p = as_dict(payload)
    gd = get_gd()
    ix = index_of(gd)
    site = _site(gd, p)
    key = get_str(p, "b", max_len=40, label="building")
    d = ix.buildings.get(key)
    if d is None or d["cat"] == "core":
        raise HTTPException(422, "Unknown building.")
    now = clock.now()
    with db.engine().begin() as conn:
        base = _open_base(conn, gd, user, now)
        layout = copy.deepcopy(base["layout"])
        if site in layout:
            raise HTTPException(409, "That site is already occupied.")
        entry = {"b": key, "lv": 1}
        if d["cat"] == "battery":
            entry["drug"] = p.get("drug")
            entry["rx"] = economy.clean_rx(gd, p.get("rx"))
        layout[site] = entry
        _check_layout(gd, base, layout, base["core_level"])
        economy.pay(base, d["cost"][0], d["cost"][1])
        base["layout"] = economy.clean_layout(gd, layout)
        economy.save_base(conn, base)
        return _state(conn, gd, user, base, now)


@router.post("/base/upgrade")
def upgrade(payload: dict = Body(default=None), user: dict = Depends(security.current_user)):
    p = as_dict(payload)
    gd = get_gd()
    ix = index_of(gd)
    site = _site(gd, p)
    mx = economy.max_level(gd)
    now = clock.now()
    with db.engine().begin() as conn:
        base = _open_base(conn, gd, user, now)
        layout = copy.deepcopy(base["layout"])
        entry = layout.get(site)
        if entry is None:
            raise HTTPException(404, "There is no building on that site.")
        d = ix.buildings[entry["b"]]
        if d["cat"] == "core":
            new = base["core_level"] + 1
            if new > mx:
                raise HTTPException(409, "Your Bone Marrow Core is already at the highest level.")
            cost = gd["core"]["upgradeCost"][new - 1]
            layout[site]["lv"] = new
            _check_layout(gd, base, layout, new)
            economy.pay(base, cost[0], cost[1])
            base["core_level"] = new
        else:
            new = entry["lv"] + 1
            if new > mx:
                raise HTTPException(409, f"{d['name']} is already at the highest level.")
            if new > base["core_level"]:
                raise HTTPException(409, f"Upgrade your Bone Marrow Core first (buildings cannot exceed core level {base['core_level']}).")
            pct = gd["upgradeCostPct"][new - 1]
            layout[site]["lv"] = new
            _check_layout(gd, base, layout, base["core_level"])
            economy.pay(base, economy.mulpct(d["cost"][0], pct), economy.mulpct(d["cost"][1], pct))
        base["layout"] = economy.clean_layout(gd, layout)
        economy.save_base(conn, base)
        return _state(conn, gd, user, base, now)


@router.post("/base/remove")
def remove(payload: dict = Body(default=None), user: dict = Depends(security.current_user)):
    p = as_dict(payload)
    gd = get_gd()
    ix = index_of(gd)
    site = _site(gd, p)
    now = clock.now()
    with db.engine().begin() as conn:
        base = _open_base(conn, gd, user, now)
        entry = base["layout"].get(site)
        if entry is None:
            raise HTTPException(404, "There is no building on that site.")
        d = ix.buildings[entry["b"]]
        if d["cat"] == "core":
            raise HTTPException(409, "The Bone Marrow Core cannot be removed.")
        pct = gd["economy"]["sellRefundPct"]
        layout = copy.deepcopy(base["layout"])
        del layout[site]
        base["layout"] = economy.clean_layout(gd, layout)
        economy.add_resources(gd, base, economy.mulpct(d["cost"][0], pct), economy.mulpct(d["cost"][1], pct))
        economy.save_base(conn, base)
        return _state(conn, gd, user, base, now)


@router.post("/base/battery")
def battery(payload: dict = Body(default=None), user: dict = Depends(security.current_user)):
    p = as_dict(payload)
    gd = get_gd()
    site = _site(gd, p)
    now = clock.now()
    with db.engine().begin() as conn:
        base = _open_base(conn, gd, user, now)
        layout = copy.deepcopy(base["layout"])
        entry = layout.get(site)
        if entry is None or entry.get("b") != "drug_battery":
            raise HTTPException(404, "There is no drug battery on that site.")
        if p.get("drug") is not None:
            entry["drug"] = p.get("drug")
        if p.get("rx") is not None:
            if not isinstance(p.get("rx"), list):
                raise HTTPException(422, "The prescription must be a list of germs.")
            entry["rx"] = economy.clean_rx(gd, p.get("rx"))
        _check_layout(gd, base, layout, base["core_level"])
        base["layout"] = economy.clean_layout(gd, layout)
        economy.save_base(conn, base)
        return _state(conn, gd, user, base, now)


@router.post("/base/policy")
def policy(payload: dict = Body(default=None), user: dict = Depends(security.current_user)):
    p = as_dict(payload)
    gd = get_gd()
    at = get_int(p, "stopflow_at", lo=0, hi=60, label="Stop-Flow threshold")
    now = clock.now()
    with db.engine().begin() as conn:
        base = _open_base(conn, gd, user, now)
        base["policy"] = {"stopflow_at": at}
        economy.save_base(conn, base)
        return _state(conn, gd, user, base, now)


@router.post("/research")
def research(payload: dict = Body(default=None), user: dict = Depends(security.current_user)):
    p = as_dict(payload)
    gd = get_gd()
    key = get_str(p, "key", max_len=40, label="research")
    now = clock.now()
    with db.engine().begin() as conn:
        base = _open_base(conn, gd, user, now)
        r, err = economy.research_status(gd, base, key)
        if err:
            raise HTTPException(404 if r is None else 409, err)
        economy.pay(base, r["cost"][0], r["cost"][1])
        base["research"] = list(base["research"]) + [key]
        economy.save_base(conn, base)
        return _state(conn, gd, user, base, now)


@router.post("/deworm")
def deworm(user: dict = Depends(security.current_user)):
    gd = get_gd()
    cfg = gd["deworming"]
    now = clock.now()
    with db.engine().begin() as conn:
        if not db.get_settings(conn).get("deworming_active"):
            raise HTTPException(409, "Deworming Day is not running right now.")
        base = _open_base(conn, gd, user, now)
        if (base.get("dewormed_until") or 0) > now:
            raise HTTPException(409, "Your base has already been dewormed for this event.")
        if "albendazole" not in economy.drugs_unlocked(gd, base):
            raise HTTPException(409, "You need albendazole in your formulary.")
        economy.pay(base, cfg["atpCost"], 0)
        economy.add_resources(gd, base, 0, cfg["nutrients"])
        base["dewormed_until"] = now + cfg["hours"] * 3600
        economy.save_base(conn, base)
        return _state(conn, gd, user, base, now)
