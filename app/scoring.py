import functools

from sqlalchemy import and_, select

from app import db, sim
from app.gamedata import index_of

LEAGUE_MODES = ("tournament", "trial")


def div(a: int, b: int) -> int:
    return a // b


def attack_score(gd: dict, result: dict, boost_correct: bool) -> int:
    return int(sim.attack_score(gd, result, bool(boost_correct)))


def trial_score(gd: dict, result: dict, trial: dict | None = None) -> int:
    return int(sim.trial_score(gd, result, (trial or {}).get("objectives")))


def campaign_objectives(gd: dict, level: dict, result: dict) -> list[bool]:
    return [bool(x) for x in sim.evaluate_objectives(gd, level.get("objectives") or [], result)]


def campaign_stars(objectives: list[bool], result: dict) -> int:
    if not result.get("survived"):
        return 0
    return sum(1 for x in objectives if x)


def campaign_score(stars: int, result: dict) -> int:
    return stars * 1000 + int(result.get("hydrationMinPct", 0))


def campaign_reward(level: dict, old: int, new: int) -> tuple[int, int]:
    if new <= old:
        return 0, 0
    r = level.get("rewards") or [0, 0]
    return div(r[0] * (new - old), 3), div(r[1] * (new - old), 3)


def newly_unlocked(gd: dict, level_id: int, old: int, new: int) -> dict:
    out = {"units": [], "research": []}
    if old >= 1 or new < 1:
        return out
    for u in gd["units"]:
        if u.get("deployable") and u.get("unlock") == level_id:
            out["units"].append(u["key"])
    for r in gd["research"]:
        if (r.get("requiresLevel") or 0) == level_id:
            out["research"].append(r["key"])
    return out


def player_loot(gd: dict, defender_atp: int, defender_nut: int, stars: int, worm_stolen: int) -> tuple[int, int]:
    lt = gd["loot"]
    pct = lt["pctBase"] + lt["pctPerStar"] * stars
    atp = min(lt["cap"], div(max(0, defender_atp) * pct, 100))
    nut = min(lt["cap"], div(max(0, defender_nut) * pct, 100))
    nut = min(max(0, defender_nut), nut + max(0, worm_stolen))
    return atp, nut


def bot_loot(gd: dict, stars: int, worm_stolen: int) -> tuple[int, int]:
    bl = gd["loot"]["botLoot"]
    return div(bl[0] * stars, 3) + 50, div(bl[1] * stars, 3) + 50 + max(0, worm_stolen)


def loot_preview_player(gd: dict, atp: int, nut: int) -> list[int]:
    a, n = player_loot(gd, atp, nut, 3, 0)
    return [a, n]


def loot_preview_bot(gd: dict) -> list[int]:
    a, n = bot_loot(gd, 3, 0)
    return [a, n]


def trophy_delta(gd: dict, stars: int) -> tuple[int, int]:
    tr = gd["trophies"]
    if stars >= 1:
        d = tr["winPerStar"] * stars
        return d, -d
    return -tr["lossOnZero"], tr["lossOnZero"]


def _eligible_users(conn) -> dict[int, dict]:
    rows = conn.execute(
        select(db.users.c.id, db.users.c.display_name, db.users.c.college, db.users.c.clan_id).where(
            and_(
                db.users.c.status == "approved",
                db.users.c.is_guest.is_(False),
                db.users.c.role == "player",
            )
        )
    ).all()
    return {r.id: {"id": r.id, "name": r.display_name, "college": r.college, "clan_id": r.clan_id} for r in rows}


def league_table(gd: dict, conn) -> dict[int, dict]:
    ix = index_of(gd)
    rows = conn.execute(
        select(
            db.battles.c.attacker_id,
            db.battles.c.mode,
            db.battles.c.ref,
            db.battles.c.score,
            db.battles.c.stars,
            db.battles.c.result,
        ).where(
            and_(
                db.battles.c.scored.is_(True),
                db.battles.c.status == "finished",
                db.battles.c.mode.in_(LEAGUE_MODES),
            )
        )
    ).all()
    table: dict[int, dict] = {}
    for r in rows:
        if r.attacker_id is None:
            continue
        t = table.setdefault(
            r.attacker_id, {"total": 0, "bases": {}, "trials": {}, "shots": 0, "trial_survived": set()}
        )
        score = int(r.score or 0)
        if r.mode == "tournament" and r.ref in ix.tbases:
            prev = t["bases"].get(r.ref)
            if prev is None or score > prev["score"]:
                t["bases"][r.ref] = {"score": score, "stars": int(r.stars or 0)}
        elif r.mode == "trial" and r.ref in ix.trials:
            prev = t["trials"].get(r.ref)
            res = r.result or {}
            if prev is None or score > prev["score"]:
                t["trials"][r.ref] = {
                    "score": score,
                    "survived": bool(res.get("survived")),
                    "shots": int((res.get("stats") or {}).get("totalShots", 0)),
                }
    for t in table.values():
        t["total"] = sum(v["score"] for v in t["bases"].values()) + sum(v["score"] for v in t["trials"].values())
    return table


def league_rows(gd: dict, conn) -> list[dict]:
    users = _eligible_users(conn)
    table = league_table(gd, conn)
    rows = []
    for uid, t in table.items():
        u = users.get(uid)
        if u is None:
            continue
        rows.append(
            {
                "user_id": uid,
                "name": u["name"],
                "college": u["college"],
                "value": t["total"],
                "extra": {"bases": len(t["bases"]), "trials": len(t["trials"])},
            }
        )
    rows.sort(key=lambda r: (-r["value"], r["user_id"]))
    return _rank(rows)


def _rank(rows: list[dict]) -> list[dict]:
    prev = None
    rank = 0
    for i, r in enumerate(rows):
        key = (r["value"], r.get("_tie"))
        if key != prev:
            rank = i + 1
            prev = key
        r["rank"] = rank
        r.pop("_tie", None)
    return rows


def steward_rows(gd: dict, conn) -> list[dict]:
    users = _eligible_users(conn)
    table = league_table(gd, conn)
    trial_ids = [t["id"] for t in gd.get("trials", [])]
    rows = []
    if not trial_ids:
        return rows
    for uid, t in table.items():
        u = users.get(uid)
        if u is None:
            continue
        if not all(tid in t["trials"] and t["trials"][tid]["survived"] for tid in trial_ids):
            continue
        total = sum(t["trials"][tid]["score"] for tid in trial_ids)
        shots = sum(t["trials"][tid]["shots"] for tid in trial_ids)
        rows.append(
            {"user_id": uid, "name": u["name"], "college": u["college"], "value": total,
             "extra": {"total_shots": shots}, "_tie": shots}
        )
    rows.sort(key=lambda r: (-r["value"], r["_tie"], r["user_id"]))
    return _rank(rows)


def defender_rows(conn) -> list[dict]:
    rows = conn.execute(
        select(
            db.bases.c.user_id, db.bases.c.defences_total, db.bases.c.stars_conceded, db.bases.c.defences_won
        ).where(db.bases.c.defences_total >= 3)
    ).all()
    if not rows:
        return []
    users = _eligible_users(conn)
    out = []
    for r in rows:
        u = users.get(r.user_id)
        if u is None:
            continue
        out.append(
            {
                "user_id": r.user_id,
                "name": u["name"],
                "college": u["college"],
                "value": round(r.stars_conceded / r.defences_total, 2),
                "extra": {"defences": r.defences_total, "stars_conceded": r.stars_conceded, "won": r.defences_won},
                "_key": (r.stars_conceded, r.defences_total),
            }
        )
    # Exact rational comparison (a/b < c/d  <=>  a*d < c*b), then more defences first.
    def cmp(x, y):
        a, b = x["_key"]
        c, d = y["_key"]
        if a * d != c * b:
            return -1 if a * d < c * b else 1
        if b != d:
            return -1 if b > d else 1
        return -1 if x["user_id"] < y["user_id"] else (1 if x["user_id"] > y["user_id"] else 0)

    out.sort(key=functools.cmp_to_key(cmp))
    rank = 0
    prev = None
    for i, r in enumerate(out):
        a, b = r.pop("_key")
        if prev is None or a * prev[1] != prev[0] * b or b != prev[1]:
            rank = i + 1
        prev = (a, b)
        r["rank"] = rank
    return out


def trophy_rows(conn, limit: int = 100) -> list[dict]:
    rows = conn.execute(
        select(db.users.c.id, db.users.c.display_name, db.users.c.college, db.bases.c.trophies, db.bases.c.core_level)
        .select_from(db.users.join(db.bases, db.bases.c.user_id == db.users.c.id))
        .where(
            and_(
                db.users.c.status == "approved",
                db.users.c.is_guest.is_(False),
                db.users.c.role == "player",
            )
        )
        .order_by(db.bases.c.trophies.desc(), db.users.c.id)
        .limit(limit)
    ).all()
    out = [
        {"user_id": r.id, "name": r.display_name, "college": r.college, "value": r.trophies,
         "extra": {"core_level": r.core_level}}
        for r in rows
    ]
    return _rank(out)


def war_scores(conn, war: dict) -> dict:
    snaps = war.get("snapshots") or {}
    side_of = {}
    for side in ("a", "b"):
        for uid in (snaps.get(side) or {}):
            side_of[int(uid)] = side
    rows = conn.execute(
        select(db.battles.c.attacker_id, db.battles.c.defender_id, db.battles.c.stars, db.battles.c.pct).where(
            and_(db.battles.c.war_id == war["id"], db.battles.c.status == "finished")
        )
    ).all()
    best: dict[str, dict[int, tuple[int, int]]] = {"a": {}, "b": {}}
    attacks = {"a": 0, "b": 0}
    for r in rows:
        side = side_of.get(r.attacker_id or -1)
        if side is None:
            continue
        enemy = "b" if side == "a" else "a"
        if side_of.get(r.defender_id or -1) != enemy:
            continue
        attacks[side] += 1
        cur = best[side].get(r.defender_id)
        val = (int(r.stars or 0), int(r.pct or 0))
        if cur is None or val > cur:
            best[side][r.defender_id] = val
    out = {}
    for side in ("a", "b"):
        out[side] = {
            "stars": sum(v[0] for v in best[side].values()),
            "pct": sum(v[1] for v in best[side].values()),
            "attacks": attacks[side],
            "best": {str(k): {"stars": v[0], "pct": v[1]} for k, v in best[side].items()},
        }
    a, b = out["a"], out["b"]
    if (a["stars"], a["pct"]) > (b["stars"], b["pct"]):
        winner = "a"
    elif (b["stars"], b["pct"]) > (a["stars"], a["pct"]):
        winner = "b"
    else:
        winner = None
    out["winner"] = winner
    return out


def clan_rows(gd: dict, conn) -> list[dict]:
    clans = {r.id: dict(r._mapping) for r in conn.execute(select(db.clans)).all()}
    if not clans:
        return []
    wars = [dict(r._mapping) for r in conn.execute(select(db.clan_wars)).all()]
    stars = {cid: 0 for cid in clans}
    wars_count = {cid: 0 for cid in clans}
    for w in wars:
        sc = w["result"] if (w["status"] == "ended" and w.get("result")) else war_scores(conn, w)
        for side, cid in (("a", w["clan_a"]), ("b", w["clan_b"])):
            if cid in stars:
                stars[cid] += int(sc[side]["stars"])
                wars_count[cid] += 1
    members: dict[int, list[int]] = {cid: [] for cid in clans}
    for r in conn.execute(select(db.users.c.id, db.users.c.clan_id).where(db.users.c.clan_id.is_not(None))).all():
        if r.clan_id in members:
            members[r.clan_id].append(r.id)
    table = league_table(gd, conn)
    rows = []
    for cid, c in clans.items():
        totals = sorted((table.get(uid, {}).get("total", 0) for uid in members[cid]), reverse=True)
        top5 = sum(totals[:5])
        rows.append(
            {
                "clan_id": cid,
                "name": c["name"],
                "college": c["college"],
                "value": stars[cid],
                "extra": {"members": len(members[cid]), "wars": wars_count[cid], "league_top5": top5},
                "_tie": top5,
            }
        )
    rows.sort(key=lambda r: (-r["value"], -r["_tie"], r["clan_id"]))
    return _rank(rows)


def awards(gd: dict, conn) -> dict:
    def top(rows):
        if not rows:
            return None
        r = dict(rows[0])
        return r

    return {
        "champion": top(league_rows(gd, conn)),
        "best_clan": top(clan_rows(gd, conn)),
        "best_steward": top(steward_rows(gd, conn)),
        "best_defender": top(defender_rows(conn)),
    }


def classroom_score(gd: dict, mode: str, target: dict | None, result: dict, boost_correct: bool) -> tuple[int, int | None]:
    if mode == "tournament":
        return attack_score(gd, result, boost_correct), int(result.get("stars", 0))
    if mode == "trial":
        return trial_score(gd, result, target), None
    objs = campaign_objectives(gd, target or {}, result)
    stars = campaign_stars(objs, result)
    return campaign_score(stars, result), stars
