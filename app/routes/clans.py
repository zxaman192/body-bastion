from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError

from app import clock, db, economy, scoring, security, services, setups
from app.gamedata import get_gd, index_of
from app.util import as_dict, get_str

router = APIRouter(prefix="/api", tags=["clans"])


def close_expired_wars(conn, now: float) -> None:
    for w in conn.execute(
        select(db.clan_wars).where(and_(db.clan_wars.c.status == "active", db.clan_wars.c.ends_at < now))
    ).all():
        end_war(conn, dict(w._mapping))


def end_war(conn, war: dict) -> dict:
    sc = scoring.war_scores(conn, war)
    conn.execute(db.clan_wars.update().where(db.clan_wars.c.id == war["id"]).values(status="ended", result=sc))
    war = dict(war)
    war["status"] = "ended"
    war["result"] = sc
    return war


def snapshot_clan(gd: dict, conn, clan_id: int, now: float) -> dict:
    herd = economy.clan_herd(gd, conn, clan_id)
    out = {}
    rows = conn.execute(
        select(db.users.c.id, db.users.c.display_name, db.users.c.college).where(db.users.c.clan_id == clan_id)
    ).all()
    for r in rows:
        base = economy.ensure_base(conn, gd, r.id, now)
        economy.refresh(gd, base, now)
        economy.save_base(conn, base)
        prot = economy.protection(gd, economy.direct_vaccines(gd, base), herd["indirect"])
        out[str(r.id)] = {
            "name": r.display_name,
            "college": r.college,
            "core_level": base["core_level"],
            "defender": setups.defender_from_base(gd, base, prot, now),
        }
    return out


def _member_user(user: dict) -> dict:
    if user["is_guest"]:
        raise HTTPException(403, "Register an account to join a cohort.")
    return user


def _state(conn, gd, user_id: int, now: float) -> dict:
    user = db.row_dict(conn.execute(select(db.users).where(db.users.c.id == user_id)).first())
    base = economy.ensure_base(conn, gd, user_id, now)
    economy.refresh(gd, base, now)
    return economy.build_state(gd, conn, user, base, db.get_settings(conn), now)


def _clan_in_active_war(conn, clan_id: int) -> bool:
    return conn.execute(
        select(func.count()).select_from(db.clan_wars).where(
            and_(db.clan_wars.c.status == "active",
                 or_(db.clan_wars.c.clan_a == clan_id, db.clan_wars.c.clan_b == clan_id))
        )
    ).scalar() > 0


@router.get("/clans")
def list_clans():
    with db.engine().connect() as conn:
        counts = dict(
            conn.execute(
                select(db.users.c.clan_id, func.count()).where(db.users.c.clan_id.is_not(None))
                .group_by(db.users.c.clan_id)
            ).all()
        )
        rows = conn.execute(select(db.clans).order_by(db.clans.c.name)).all()
        limit = db.get_settings(conn).get("clan_max_members", 10)
    return {
        "max_members": limit,
        "rows": [{"id": r.id, "name": r.name, "college": r.college, "members": int(counts.get(r.id, 0))}
                 for r in rows],
    }


@router.post("/clans")
def create_clan(payload: dict = Body(default=None), user: dict = Depends(security.current_user)):
    _member_user(user)
    p = as_dict(payload)
    name = get_str(p, "name", min_len=3, max_len=40, label="cohort name")
    college = get_str(p, "college", required=False, max_len=120) or user.get("college") or ""
    gd = get_gd()
    now = clock.now()
    with db.engine().begin() as conn:
        me = conn.execute(select(db.users.c.clan_id).where(db.users.c.id == user["id"])).first()
        if me and me.clan_id:
            raise HTTPException(409, "Leave your current cohort first.")
        try:
            with conn.begin_nested():
                res = conn.execute(db.clans.insert().values(
                    name=name, name_key=" ".join(name.lower().split()), college=college,
                    created_by=user["id"], created_at=now))
        except IntegrityError:
            raise HTTPException(409, "A cohort with that name already exists.")
        cid = res.inserted_primary_key[0]
        conn.execute(db.users.update().where(db.users.c.id == user["id"]).values(clan_id=cid))
        state = _state(conn, gd, user["id"], now)
    return {"id": cid, "name": name, "college": college, "state": state}


@router.post("/clans/{cid}/join")
def join_clan(cid: int, user: dict = Depends(security.current_user)):
    _member_user(user)
    gd = get_gd()
    now = clock.now()
    with db.engine().begin() as conn:
        clan = conn.execute(select(db.clans).where(db.clans.c.id == cid)).first()
        if clan is None:
            raise HTTPException(404, "Cohort not found.")
        me = conn.execute(select(db.users.c.clan_id).where(db.users.c.id == user["id"])).first()
        if me and me.clan_id:
            raise HTTPException(409, "Leave your current cohort first.")
        limit = db.get_settings(conn).get("clan_max_members", 10)
        n = conn.execute(select(func.count()).select_from(db.users).where(db.users.c.clan_id == cid)).scalar()
        if n >= limit:
            raise HTTPException(409, f"That cohort is full ({limit} members).")
        conn.execute(db.users.update().where(db.users.c.id == user["id"]).values(clan_id=cid))
        return _state(conn, gd, user["id"], now)


@router.post("/clans/leave")
def leave_clan(user: dict = Depends(security.current_user)):
    gd = get_gd()
    now = clock.now()
    with db.engine().begin() as conn:
        me = conn.execute(select(db.users.c.clan_id).where(db.users.c.id == user["id"])).first()
        if not me or not me.clan_id:
            raise HTTPException(409, "You are not in a cohort.")
        if _clan_in_active_war(conn, me.clan_id):
            raise HTTPException(409, "You cannot leave while your cohort is in a challenge.")
        conn.execute(db.users.update().where(db.users.c.id == user["id"]).values(clan_id=None))
        services._delete_clan_if_empty(conn, me.clan_id)
        return _state(conn, gd, user["id"], now)


@router.get("/clans/{cid}")
def clan_detail(cid: int):
    gd = get_gd()
    ix = index_of(gd)
    now = clock.now()
    with db.engine().begin() as conn:
        close_expired_wars(conn, now)
        clan = conn.execute(select(db.clans).where(db.clans.c.id == cid)).first()
        if clan is None:
            raise HTTPException(404, "Cohort not found.")
        rows = conn.execute(
            select(db.users.c.id, db.users.c.display_name, db.bases.c.trophies, db.bases.c.research,
                   db.bases.c.core_level)
            .select_from(db.users.outerjoin(db.bases, db.bases.c.user_id == db.users.c.id))
            .where(db.users.c.clan_id == cid).order_by(db.bases.c.trophies.desc())
        ).all()
        members = []
        for r in rows:
            research = r.research or []
            vacc = [germ for germ, rk in ix.vaccine_research.items() if rk in research]
            members.append({"id": r.id, "name": r.display_name, "trophies": r.trophies or 0,
                            "core_level": r.core_level or 1, "vaccines": vacc})
        herd = economy.clan_herd(gd, conn, cid)
        wars = []
        for w in conn.execute(
            select(db.clan_wars).where(or_(db.clan_wars.c.clan_a == cid, db.clan_wars.c.clan_b == cid))
            .order_by(db.clan_wars.c.id.desc()).limit(10)
        ).all():
            wd = dict(w._mapping)
            sc = wd["result"] if (wd["status"] == "ended" and wd.get("result")) else scoring.war_scores(conn, wd)
            mine, theirs = ("a", "b") if w.clan_a == cid else ("b", "a")
            other_id = w.clan_b if mine == "a" else w.clan_a
            other = conn.execute(select(db.clans.c.name).where(db.clans.c.id == other_id)).first()
            wars.append({"id": w.id, "opponent": other.name if other else "Disbanded cohort", "status": w.status,
                         "ends_at": clock.iso(w.ends_at), "stars": {"mine": sc[mine]["stars"], "theirs": sc[theirs]["stars"]},
                         "winner": (None if sc.get("winner") is None else ("mine" if sc["winner"] == mine else "theirs"))})
    return {
        "clan": {"id": clan.id, "name": clan.name, "college": clan.college, "members": len(members)},
        "members": members,
        "coverage": herd["coverage"],
        "herd": herd["indirect"],
        "vaccine_efficacy": {g: v["efficacy"] for g, v in gd["vaccines"].items()},
        "wars": wars,
    }


@router.get("/clanwar")
def my_war(user: dict = Depends(security.current_user)):
    now = clock.now()
    with db.engine().begin() as conn:
        close_expired_wars(conn, now)
        me = conn.execute(select(db.users.c.clan_id).where(db.users.c.id == user["id"])).first()
        cid = me.clan_id if me else None
        empty = {"war": None, "enemies": [], "attacks_left": 0, "stars": {"mine": 0, "theirs": 0}}
        if not cid:
            return empty
        w = conn.execute(
            select(db.clan_wars).where(and_(db.clan_wars.c.status == "active",
                                            or_(db.clan_wars.c.clan_a == cid, db.clan_wars.c.clan_b == cid)))
            .order_by(db.clan_wars.c.id.desc())
        ).first()
        if w is None:
            return empty
        wd = dict(w._mapping)
        snaps = wd["snapshots"] or {}
        uid = str(user["id"])
        side = "a" if uid in (snaps.get("a") or {}) else ("b" if uid in (snaps.get("b") or {}) else None)
        clan_side = "a" if w.clan_a == cid else "b"
        mine = side or clan_side
        theirs = "b" if mine == "a" else "a"
        sc = scoring.war_scores(conn, wd)
        used = conn.execute(
            select(func.count()).select_from(db.battles).where(
                and_(db.battles.c.war_id == w.id, db.battles.c.attacker_id == user["id"],
                     db.battles.c.status != "invalid"))
        ).scalar()
        names = {c.id: c.name for c in conn.execute(
            select(db.clans.c.id, db.clans.c.name).where(db.clans.c.id.in_((w.clan_a, w.clan_b)))).all()}
        enemies = []
        for did, snap in (snaps.get(theirs) or {}).items():
            b = sc[mine]["best"].get(did)
            enemies.append({"user_id": int(did), "name": snap.get("name", ""), "college": snap.get("college", ""),
                            "core_level": snap.get("core_level", 1), "best_stars": b["stars"] if b else 0,
                            "best_pct": b["pct"] if b else 0})
        enemies.sort(key=lambda e: -e["core_level"])
        return {
            "war": {"id": w.id, "clan_mine": names.get(w.clan_a if mine == "a" else w.clan_b, ""),
                    "clan_theirs": names.get(w.clan_b if mine == "a" else w.clan_a, ""),
                    "ends_at": clock.iso(w.ends_at), "status": w.status, "attacks_per_member": w.attacks_per_member},
            "in_war": side is not None,
            "enemies": enemies,
            "attacks_left": max(0, w.attacks_per_member - used) if side else 0,
            "stars": {"mine": sc[mine]["stars"], "theirs": sc[theirs]["stars"],
                      "pct_mine": sc[mine]["pct"], "pct_theirs": sc[theirs]["pct"]},
        }
