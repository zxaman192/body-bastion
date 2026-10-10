from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, select

from app import clock, db, scoring, security
from app.gamedata import get_gd, index_of

router = APIRouter(prefix="/api", tags=["league"])

BOARDS = ("trophies", "league", "clans", "steward", "defender")


def _public(rows: list[dict], limit: int = 100) -> list[dict]:
    return [
        {"rank": r["rank"], "name": r["name"], "college": r.get("college", ""), "value": r["value"],
         "extra": r.get("extra") or {}}
        for r in rows[:limit]
    ]


@router.get("/league")
def league(user: dict = Depends(security.current_user)):
    gd = get_gd()
    with db.engine().connect() as conn:
        phase = db.get_settings(conn).get("league_phase", "practice")
        rows = conn.execute(
            select(db.battles.c.mode, db.battles.c.ref, db.battles.c.score, db.battles.c.stars,
                   db.battles.c.status, db.battles.c.scored)
            .where(and_(db.battles.c.attacker_id == user["id"],
                        db.battles.c.mode.in_(("tournament", "trial", "practice"))))
        ).all()
        table = scoring.league_rows(gd, conn)
    best: dict[tuple, dict] = {}
    for r in rows:
        kind = "trial" if r.mode == "trial" else "tournament"
        key = (kind, r.ref, bool(r.scored))
        e = best.setdefault(key, {"best_score": None, "best_stars": None, "attempts": 0})
        e["attempts"] += 1
        if r.status == "finished" and r.score is not None:
            if e["best_score"] is None or r.score > e["best_score"]:
                e["best_score"] = r.score
                e["best_stars"] = r.stars

    def entry(kind: str, ref: str) -> dict:
        s = best.get((kind, ref, True), {"best_score": None, "best_stars": None, "attempts": 0})
        pr = best.get((kind, ref, False), {"best_score": None, "attempts": 0})
        return {"best_score": s["best_score"], "best_stars": s["best_stars"], "attempts": s["attempts"],
                "practice_best": pr["best_score"], "practice_attempts": pr["attempts"]}

    bases = [{"id": b["id"], "name": b["name"], "difficulty": b["difficulty"], **entry("tournament", b["id"])}
             for b in gd["tournament"]["bases"]]
    trials = [{"id": t["id"], "name": t["name"], **entry("trial", t["id"])} for t in gd.get("trials", [])]
    mine = next((r for r in table if r["user_id"] == user["id"]), None)
    return {
        "phase": phase,
        "bases": bases,
        "trials": trials,
        "total": mine["value"] if mine else 0,
        "rank": mine["rank"] if mine else None,
        "players": len(table),
    }


@router.get("/leaderboard/{kind}")
def leaderboard(kind: str):
    if kind not in BOARDS:
        raise HTTPException(404, "Unknown leaderboard.")
    gd = get_gd()
    with db.engine().connect() as conn:
        if kind == "trophies":
            rows = scoring.trophy_rows(conn)
        elif kind == "league":
            rows = scoring.league_rows(gd, conn)
        elif kind == "clans":
            rows = scoring.clan_rows(gd, conn)
        elif kind == "steward":
            rows = scoring.steward_rows(gd, conn)
        else:
            rows = scoring.defender_rows(conn)
    return {"kind": kind, "rows": _public(rows)}


def active_war(conn, now: float):
    from app.routes.clans import close_expired_wars

    close_expired_wars(conn, now)
    return conn.execute(
        select(db.clan_wars).where(db.clan_wars.c.status == "active").order_by(db.clan_wars.c.id.desc())
    ).first()


@router.get("/projector")
def projector():
    gd = get_gd()
    ix = index_of(gd)
    now = clock.now()
    with db.engine().begin() as conn:
        phase = db.get_settings(conn).get("league_phase", "practice")
        league_top = _public(scoring.league_rows(gd, conn), 10)
        clans_top = _public(scoring.clan_rows(gd, conn), 10)
        recent_rows = conn.execute(
            select(db.battles.c.id, db.battles.c.mode, db.battles.c.ref, db.battles.c.attacker_id,
                   db.battles.c.group_id, db.battles.c.defender_name, db.battles.c.stars, db.battles.c.pct,
                   db.battles.c.score, db.battles.c.finished_at)
            .where(and_(db.battles.c.status == "finished",
                        db.battles.c.mode.in_(("multiplayer", "tournament", "trial", "clanwar"))))
            .order_by(db.battles.c.finished_at.desc()).limit(10)
        ).all()
        names = {}
        uids = {r.attacker_id for r in recent_rows if r.attacker_id}
        if uids:
            for u in conn.execute(select(db.users.c.id, db.users.c.display_name).where(db.users.c.id.in_(uids))).all():
                names[u.id] = u.display_name
        recent = [
            {"id": r.id, "mode": r.mode, "attacker": names.get(r.attacker_id, "Player"),
             "defender": r.defender_name or (ix.tbases.get(r.ref, {}).get("name", "")), "stars": r.stars,
             "pct": r.pct, "score": r.score, "at": clock.iso(r.finished_at)}
            for r in recent_rows
        ]
        war = None
        w = active_war(conn, now)
        if w is not None:
            wd = dict(w._mapping)
            sc = scoring.war_scores(conn, wd)
            cn = {c.id: c.name for c in conn.execute(
                select(db.clans.c.id, db.clans.c.name).where(db.clans.c.id.in_((w.clan_a, w.clan_b)))).all()}
            war = {"id": w.id, "clan_a": cn.get(w.clan_a, "Cohort A"), "clan_b": cn.get(w.clan_b, "Cohort B"),
                   "stars_a": sc["a"]["stars"], "stars_b": sc["b"]["stars"], "pct_a": sc["a"]["pct"],
                   "pct_b": sc["b"]["pct"], "ends_at": clock.iso(w.ends_at)}
    return {"phase": phase, "league_top": league_top, "clans_top": clans_top, "recent": recent, "war": war,
            "server_time": clock.iso(now)}
