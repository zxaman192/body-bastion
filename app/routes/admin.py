from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import and_, or_, select

from app import clock, db, scoring, security, services
from app.gamedata import get_gd, index_of
from app.routes.clans import close_expired_wars, end_war, snapshot_clan
from app.util import as_dict, csv_response, get_int, get_str

router = APIRouter(prefix="/api", tags=["admin"])

admin_dep = security.require_role("admin")
observer_dep = security.require_role("observer", "admin")
PURGE_PHRASE = "DELETE ALL PLAYER DATA"


def _user_admin_view(u: dict) -> dict:
    return {
        "id": u["id"], "username": u["username"], "display_name": u["display_name"], "college": u["college"],
        "course": u["course"], "email": u["email"], "role": u["role"], "status": u["status"],
        "is_guest": bool(u["is_guest"]), "is_adult": bool(u["is_adult"]), "guardian_name": u["guardian_name"],
        "guardian_email": u["guardian_email"], "consent_version": u["consent_version"],
        "consent_at": clock.iso(u["consent_at"]), "created_at": clock.iso(u["created_at"]), "clan_id": u["clan_id"],
    }


@router.get("/admin/users")
def users(status: str | None = None, guests: bool = False, admin: dict = Depends(admin_dep)):
    q = select(db.users).order_by(db.users.c.created_at.desc()).limit(2000)
    if status:
        q = q.where(db.users.c.status == status)
    if not guests:
        q = q.where(db.users.c.is_guest.is_(False))
    with db.engine().connect() as conn:
        rows = [_user_admin_view(dict(r._mapping)) for r in conn.execute(q).all()]
    return {"rows": rows}


@router.post("/admin/users/{uid}")
def user_action(uid: int, payload: dict = Body(default=None), admin: dict = Depends(admin_dep)):
    p = as_dict(payload)
    action = p.get("action")
    with db.engine().begin() as conn:
        u = db.row_dict(conn.execute(select(db.users).where(db.users.c.id == uid)).first())
        if u is None:
            raise HTTPException(404, "User not found.")
        if action == "approve":
            values = {"status": "approved"}
        elif action == "reject":
            if uid == admin["id"]:
                raise HTTPException(409, "You cannot reject yourself.")
            values = {"status": "rejected"}
            conn.execute(db.sessions.delete().where(db.sessions.c.user_id == uid))
        elif action == "role":
            role = p.get("role")
            if role not in security.ROLES:
                raise HTTPException(422, "Unknown role.")
            if uid == admin["id"] and role != "admin":
                raise HTTPException(409, "You cannot remove your own admin role.")
            if u["is_guest"] and role != "player":
                raise HTTPException(409, "Guest accounts can only be players.")
            values = {"role": role}
        else:
            raise HTTPException(422, "Unknown action.")
        conn.execute(db.users.update().where(db.users.c.id == uid).values(**values))
        u.update(values)
    return _user_admin_view(u)


@router.delete("/admin/users/{uid}")
def delete_user(uid: int, admin: dict = Depends(admin_dep)):
    if uid == admin["id"]:
        raise HTTPException(409, "You cannot delete your own account here.")
    with db.engine().begin() as conn:
        services.erase_user(conn, uid)
    return {"ok": True}


@router.get("/admin/settings")
def get_settings(admin: dict = Depends(admin_dep)):
    with db.engine().connect() as conn:
        return db.get_settings(conn)


@router.post("/admin/settings")
def put_settings(payload: dict = Body(default=None), admin: dict = Depends(admin_dep)):
    p = as_dict(payload)
    values = {}
    for key in ("auto_approve", "deworming_active"):
        if key in p:
            if not isinstance(p[key], bool):
                raise HTTPException(422, f"{key} must be true or false.")
            values[key] = p[key]
    if "league_phase" in p:
        if p["league_phase"] not in db.LEAGUE_PHASES:
            raise HTTPException(422, "League phase must be closed, practice, league or finished.")
        values["league_phase"] = p["league_phase"]
    if "clan_max_members" in p:
        values["clan_max_members"] = get_int(p, "clan_max_members", lo=2, hi=50)
    with db.engine().begin() as conn:
        return db.put_settings(conn, values)


@router.get("/admin/clanwars")
def list_wars(admin: dict = Depends(admin_dep)):
    now = clock.now()
    with db.engine().begin() as conn:
        close_expired_wars(conn, now)
        names = {c.id: c.name for c in conn.execute(select(db.clans.c.id, db.clans.c.name)).all()}
        out = []
        for w in conn.execute(select(db.clan_wars).order_by(db.clan_wars.c.id.desc()).limit(50)).all():
            wd = dict(w._mapping)
            sc = wd["result"] if (wd["status"] == "ended" and wd.get("result")) else scoring.war_scores(conn, wd)
            out.append({"id": w.id, "clan_a": names.get(w.clan_a, "?"), "clan_b": names.get(w.clan_b, "?"),
                        "status": w.status, "ends_at": clock.iso(w.ends_at), "stars_a": sc["a"]["stars"],
                        "stars_b": sc["b"]["stars"], "winner": sc.get("winner")})
    return {"rows": out}


@router.post("/admin/clanwar")
def create_war(payload: dict = Body(default=None), admin: dict = Depends(admin_dep)):
    p = as_dict(payload)
    a = get_int(p, "clan_a", lo=1, label="first cohort")
    b = get_int(p, "clan_b", lo=1, label="second cohort")
    hours = get_int(p, "hours", required=False, lo=1, hi=24 * 14, default=48)
    apm = get_int(p, "attacks_per_member", required=False, lo=1, hi=10, default=2)
    if a == b:
        raise HTTPException(422, "Choose two different cohorts.")
    gd = get_gd()
    now = clock.now()
    with db.engine().begin() as conn:
        close_expired_wars(conn, now)
        for cid in (a, b):
            if conn.execute(select(db.clans.c.id).where(db.clans.c.id == cid)).first() is None:
                raise HTTPException(404, f"Cohort {cid} not found.")
            busy = conn.execute(select(db.clan_wars.c.id).where(and_(
                db.clan_wars.c.status == "active", or_(db.clan_wars.c.clan_a == cid, db.clan_wars.c.clan_b == cid)))).first()
            if busy is not None:
                raise HTTPException(409, f"Cohort {cid} is already in a challenge.")
        snaps = {"a": snapshot_clan(gd, conn, a, now), "b": snapshot_clan(gd, conn, b, now)}
        if not snaps["a"] or not snaps["b"]:
            raise HTTPException(409, "Both cohorts need at least one member.")
        res = conn.execute(db.clan_wars.insert().values(
            clan_a=a, clan_b=b, status="active", attacks_per_member=apm, starts_at=now,
            ends_at=now + hours * 3600, snapshots=snaps, created_at=now))
        wid = res.inserted_primary_key[0]
    return {"id": wid, "clan_a": a, "clan_b": b, "ends_at": clock.iso(now + hours * 3600),
            "attacks_per_member": apm, "members": {"a": len(snaps["a"]), "b": len(snaps["b"])}}


@router.post("/admin/clanwar/{wid}/end")
def stop_war(wid: int, admin: dict = Depends(admin_dep)):
    with db.engine().begin() as conn:
        w = conn.execute(select(db.clan_wars).where(db.clan_wars.c.id == wid)).first()
        if w is None:
            raise HTTPException(404, "Challenge not found.")
        wd = dict(w._mapping)
        if wd["status"] != "ended":
            wd = end_war(conn, wd)
    return {"id": wid, "status": "ended", "result": wd["result"]}


@router.get("/admin/awards")
def get_awards(admin: dict = Depends(admin_dep)):
    gd = get_gd()
    with db.engine().connect() as conn:
        aw = scoring.awards(gd, conn)
    for v in aw.values():
        if isinstance(v, dict):
            v.pop("user_id", None)
    return aw


def _names(conn) -> dict:
    return {u.id: u.display_name for u in conn.execute(select(db.users.c.id, db.users.c.display_name)).all()}


@router.get("/admin/export/{kind}.csv")
def export(kind: str, admin: dict = Depends(admin_dep)):
    gd = get_gd()
    ix = index_of(gd)
    with db.engine().connect() as conn:
        if kind == "users":
            rows = [[u.id, u.username, u.display_name, u.college, u.course, u.email or "", u.role, u.status,
                     u.is_adult, u.guardian_name or "", u.guardian_email or "", u.consent_version or "",
                     clock.iso(u.consent_at), clock.iso(u.created_at)]
                    for u in conn.execute(select(db.users).where(db.users.c.is_guest.is_(False))
                                          .order_by(db.users.c.id)).all()]
            return csv_response("users.csv", ["id", "username", "handle", "college", "course", "email", "role", "status",
                                              "adult", "guardian_name", "guardian_email", "consent_version",
                                              "consent_at_utc", "created_at_utc"], rows)
        if kind == "league":
            table = scoring.league_table(gd, conn)
            ranked = {r["user_id"]: r for r in scoring.league_rows(gd, conn)}
            base_ids = [b["id"] for b in gd["tournament"]["bases"]]
            trial_ids = [t["id"] for t in gd.get("trials", [])]
            users = {u.id: u for u in conn.execute(select(db.users.c.id, db.users.c.display_name, db.users.c.college)).all()}
            rows = []
            for uid, r in sorted(ranked.items(), key=lambda kv: kv[1]["rank"]):
                t = table.get(uid, {"bases": {}, "trials": {}})
                u = users.get(uid)
                rows.append([r["rank"], u.display_name if u else "", u.college if u else "", r["value"]]
                            + [t["bases"].get(b, {}).get("score", "") for b in base_ids]
                            + [t["trials"].get(d, {}).get("score", "") for d in trial_ids])
            return csv_response("league.csv", ["rank", "handle", "college", "total"] + base_ids + trial_ids, rows)
        if kind == "trials":
            names = _names(conn)
            rows = [[r.id, names.get(r.attacker_id, ""), r.ref, r.score, (r.result or {}).get("survived"),
                     ((r.result or {}).get("stats") or {}).get("unnecessary"), (r.result or {}).get("hydrationMinPct"),
                     r.scored, clock.iso(r.finished_at)]
                    for r in conn.execute(select(db.battles).where(and_(db.battles.c.mode == "trial",
                                                                        db.battles.c.status == "finished"))
                                          .order_by(db.battles.c.id)).all()]
            return csv_response("trials.csv", ["battle_id", "player", "trial", "score", "survived", "unnecessary_shots",
                                               "min_hydration_pct", "scored", "finished_at_utc"], rows)
        if kind == "battles":
            names = _names(conn)
            rows = [[r.id, r.mode, r.ref, names.get(r.attacker_id, "") if r.attacker_id else f"group {r.group_id}",
                     r.defender_name or "", r.status, r.stars, r.pct, r.score, r.verified, " ".join(r.flags or []),
                     r.review or "", r.sim_ms, clock.iso(r.created_at), clock.iso(r.finished_at)]
                    for r in conn.execute(select(db.battles).order_by(db.battles.c.id)).all()]
            return csv_response("battles.csv", ["id", "mode", "ref", "attacker", "defender", "status", "stars", "pct",
                                                "score", "verified", "flags", "review", "sim_ms", "created_at_utc",
                                                "finished_at_utc"], rows)
        if kind == "learning":
            rows = []
            for m in learning_report(gd, conn):
                met = [o["met_pct"] for o in m["objectives"]] + [None] * (3 - len(m["objectives"]))
                rows.append([m["number"], m["id"], m["title"], m["players"], m["attempts"], m["win_pct"],
                             m["first_try_win_pct"], m["three_star_pct"], m["avg_tries"], *met[:3], m["lo"]])
            return csv_response("learning.csv", ["mission", "id", "title", "players", "attempts", "win_pct",
                                                 "first_try_win_pct", "three_star_players_pct", "avg_tries_per_player",
                                                 "star1_met_pct", "star2_met_pct", "star3_met_pct", "learning_objective"], rows)
        if kind == "clanwars":
            names = {c.id: c.name for c in conn.execute(select(db.clans.c.id, db.clans.c.name)).all()}
            rows = []
            for w in conn.execute(select(db.clan_wars).order_by(db.clan_wars.c.id)).all():
                wd = dict(w._mapping)
                sc = wd["result"] if (wd["status"] == "ended" and wd.get("result")) else scoring.war_scores(conn, wd)
                rows.append([w.id, names.get(w.clan_a, ""), names.get(w.clan_b, ""), w.status, sc["a"]["stars"],
                             sc["b"]["stars"], sc["a"]["pct"], sc["b"]["pct"], sc.get("winner") or "",
                             clock.iso(w.starts_at), clock.iso(w.ends_at)])
            return csv_response("clanwars.csv", ["id", "clan_a", "clan_b", "status", "stars_a", "stars_b", "pct_a",
                                                 "pct_b", "winner", "starts_utc", "ends_utc"], rows)
    raise HTTPException(404, "Unknown export.")


def learning_report(gd: dict, conn) -> list[dict]:
    """Per mission, in play order: how many players tried it, how many won at the first attempt, and how
    often each star objective (each one a learning goal) was met. Measures learning outcomes from play."""
    ix = index_of(gd)
    rows = conn.execute(
        select(db.battles.c.attacker_id, db.battles.c.ref, db.battles.c.result, db.battles.c.objectives, db.battles.c.stars)
        .where(and_(db.battles.c.mode == "campaign", db.battles.c.status == "finished"))
        .order_by(db.battles.c.id)
    ).all()
    per: dict[int, dict] = {}
    for r in rows:
        try:
            lid = int(r.ref)
        except (TypeError, ValueError):
            continue
        if lid not in ix.campaign:
            continue
        m = per.setdefault(lid, {"attempts": 0, "wins": 0, "players": {}, "met": []})
        survived = bool((r.result or {}).get("survived"))
        objs = r.objectives if isinstance(r.objectives, list) else []
        m["attempts"] += 1
        m["wins"] += 1 if survived else 0
        while len(m["met"]) < len(objs):
            m["met"].append(0)
        for i, ok in enumerate(objs):
            m["met"][i] += 1 if ok else 0
        if r.attacker_id is not None:
            p = m["players"].setdefault(r.attacker_id, {"first": survived, "best": 0, "tries": 0})
            p["tries"] += 1
            p["best"] = max(p["best"], int(r.stars or 0))
    out = []
    for lv in gd["campaign"]:
        lid = int(lv["id"])
        m = per.get(lid, {"attempts": 0, "wins": 0, "players": {}, "met": []})
        players = m["players"].values()
        n = len(m["players"])
        out.append({
            "id": lid,
            "number": ix.campaign_number[lid],
            "title": lv.get("title", ""),
            "lo": lv.get("lo", ""),
            "attempts": m["attempts"],
            "players": n,
            "win_pct": round(100 * m["wins"] / m["attempts"]) if m["attempts"] else None,
            "first_try_win_pct": round(100 * sum(1 for p in players if p["first"]) / n) if n else None,
            "three_star_pct": round(100 * sum(1 for p in players if p["best"] >= 3) / n) if n else None,
            "avg_tries": round(sum(p["tries"] for p in players) / n, 1) if n else None,
            "objectives": [
                {"objective": o, "met_pct": round(100 * m["met"][i] / m["attempts"]) if m["attempts"] and i < len(m["met"]) else None}
                for i, o in enumerate(lv.get("objectives") or [])
            ],
        })
    return out


@router.get("/admin/learning")
def learning(user: dict = Depends(observer_dep)):
    gd = get_gd()
    with db.engine().connect() as conn:
        return {"missions": learning_report(gd, conn)}


@router.post("/admin/purge")
def purge(payload: dict = Body(default=None), admin: dict = Depends(admin_dep)):
    p = as_dict(payload)
    if p.get("confirm") != PURGE_PHRASE:
        raise HTTPException(422, f'Type "{PURGE_PHRASE}" to confirm.')
    with db.engine().begin() as conn:
        deleted = services.purge(conn)
    return {"deleted": deleted}


@router.post("/admin/battles/{bid}/invalidate")
def invalidate(bid: int, admin: dict = Depends(admin_dep)):
    with db.engine().begin() as conn:
        row = conn.execute(select(db.battles.c.id).where(db.battles.c.id == bid)).first()
        if row is None:
            raise HTTPException(404, "Battle not found.")
        conn.execute(db.battles.update().where(db.battles.c.id == bid).values(
            status="invalid", league_key=None, review="invalid"))
    return {"ok": True}


@router.get("/observer/battles")
def observer_battles(flag: str | None = None, mode: str | None = None, limit: int = 100,
                     user: dict = Depends(observer_dep)):
    limit = max(1, min(limit, 500))
    q = select(db.battles).where(db.battles.c.status.in_(("finished", "invalid"))).order_by(db.battles.c.id.desc())
    if mode:
        q = q.where(db.battles.c.mode == mode)
    with db.engine().connect() as conn:
        names = _names(conn)
        out = []
        for r in conn.execute(q.limit(2000)).all():
            flags = r.flags or []
            if flag == "suspicious" and r.review != "suspicious":
                continue
            if flag in ("mismatch", "too_fast") and flag not in flags:
                continue
            if flag == "any" and not flags and r.review != "suspicious":
                continue
            out.append({
                "id": r.id, "mode": r.mode, "ref": r.ref, "status": r.status,
                "attacker": names.get(r.attacker_id, "") if r.attacker_id else f"Classroom group {r.group_id}",
                "defender": r.defender_name or "", "stars": r.stars, "pct": r.pct, "score": r.score,
                "verified": r.verified, "flags": flags, "review": r.review, "note": r.note, "sim_ms": r.sim_ms,
                "duration_s": round((r.finished_at or r.created_at) - (r.answered_at or r.created_at), 1),
                "ticks": (r.result or {}).get("ticks"), "finished_at": clock.iso(r.finished_at),
            })
            if len(out) >= limit:
                break
    return {"rows": out}


@router.post("/observer/battles/{bid}/flag")
def flag_battle(bid: int, payload: dict = Body(default=None), user: dict = Depends(observer_dep)):
    p = as_dict(payload)
    flag = p.get("flag")
    if flag not in ("suspicious", "cleared"):
        raise HTTPException(422, "Flag must be suspicious or cleared.")
    note = get_str(p, "note", required=False, max_len=1000, default="")
    with db.engine().begin() as conn:
        row = conn.execute(select(db.battles.c.id, db.battles.c.status).where(db.battles.c.id == bid)).first()
        if row is None:
            raise HTTPException(404, "Battle not found.")
        if row.status == "invalid":
            raise HTTPException(409, "This battle has been invalidated by an admin.")
        conn.execute(db.battles.update().where(db.battles.c.id == bid).values(
            review=flag, note=f"{user['display_name']}: {note}" if note else None))
    return {"ok": True, "review": flag}
