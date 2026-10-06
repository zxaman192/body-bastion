import json
import secrets
import time

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError

from app import cards, clock, db, economy, scoring, security, setups, sim
from app.gamedata import get_gd, index_of, pick_question, public_question
from app.util import as_dict, get_int

router = APIRouter(prefix="/api", tags=["battle"])

MATCH_RANGE = 400
FIND_TOKEN_SECONDS = 300
ATTACK_LOCK_SECONDS = 240
MAX_COMMANDS = 6000
MAX_COMMANDS_BYTES = 400_000
MODES = ("multiplayer", "practice", "tournament", "trial", "campaign", "clanwar", "classroom")
DEFENCE_MODES = ("campaign", "trial")


def _actor(request: Request) -> tuple[dict | None, dict | None]:
    group = security.group_from_request(request)
    if group is not None:
        return None, group
    return security.current_user(request), None


def _player_row(conn, uid: int):
    return conn.execute(
        select(db.users.c.id, db.users.c.display_name, db.users.c.college, db.users.c.clan_id)
        .where(db.users.c.id == uid)
    ).first()


@router.post("/battle/find")
def find(user: dict = Depends(security.current_user)):
    gd = get_gd()
    now = clock.now()
    with db.engine().begin() as conn:
        me = economy.ensure_base(conn, gd, user["id"], now)
        trophies = me["trophies"]
        q = (
            select(db.users.c.id, db.users.c.display_name, db.users.c.college, db.bases.c.trophies,
                   db.bases.c.core_level)
            .select_from(db.users.join(db.bases, db.bases.c.user_id == db.users.c.id))
            .where(
                and_(
                    db.users.c.id != user["id"],
                    db.users.c.status == "approved",
                    db.users.c.role == "player",
                    db.bases.c.trophies.between(trophies - MATCH_RANGE, trophies + MATCH_RANGE),
                    or_(db.bases.c.shield_until.is_(None), db.bases.c.shield_until < now),
                    or_(db.bases.c.under_attack_until.is_(None), db.bases.c.under_attack_until < now),
                )
            )
        )
        if user.get("clan_id"):
            q = q.where(or_(db.users.c.clan_id.is_(None), db.users.c.clan_id != user["clan_id"]))
        rows = conn.execute(q.limit(200)).all()
        if rows:
            r = rows[secrets.randbelow(len(rows))]
            base = economy.load_base(conn, r.id)
            economy.refresh(gd, base, now)
            token = security.sign({"k": "player", "id": r.id, "uid": user["id"], "exp": now + FIND_TOKEN_SECONDS})
            return {
                "token": token,
                "opponent": {"name": r.display_name, "trophies": r.trophies, "kind": "player",
                             "core_level": r.core_level, "college": r.college},
                "layout": base["layout"],
                "core_level": base["core_level"],
                "loot": scoring.loot_preview_player(gd, base["atp"], base["nutrients"]),
            }
    bots = sorted(gd.get("bots", []), key=lambda b: (abs(b["trophies"] - trophies), b["id"]))[:3]
    if not bots:
        raise HTTPException(404, "No opponents are available right now.")
    bot = bots[secrets.randbelow(len(bots))]
    tb = index_of(gd).tbases[bot["base"]]
    token = security.sign({"k": "bot", "id": bot["id"], "uid": user["id"], "exp": now + FIND_TOKEN_SECONDS})
    return {
        "token": token,
        "opponent": {"name": bot["name"], "trophies": bot["trophies"], "kind": "bot",
                     "core_level": tb["coreLevel"], "college": "Training base"},
        "layout": economy.clean_layout(gd, tb["layout"]),
        "core_level": tb["coreLevel"],
        "loot": scoring.loot_preview_bot(gd),
    }


def _defender_snapshot(gd: dict, conn, uid: int, now: float) -> tuple[dict, dict]:
    base = economy.load_base(conn, uid, for_update=True)
    if base is None:
        raise HTTPException(404, "That base no longer exists.")
    economy.refresh(gd, base, now)
    row = _player_row(conn, uid)
    herd = economy.clan_herd(gd, conn, row.clan_id if row else None)
    prot = economy.protection(gd, economy.direct_vaccines(gd, base), herd["indirect"])
    return setups.defender_from_base(gd, base, prot, now), base


def _league_open(conn) -> bool:
    return db.get_settings(conn).get("league_phase") == "league"


def _require_member(user: dict | None) -> dict:
    if user is None:
        raise HTTPException(401, "Please log in.")
    return user


@router.post("/battle/start")
def start(request: Request, payload: dict = Body(default=None)):
    user, group = _actor(request)
    p = as_dict(payload)
    gd = get_gd()
    ix = index_of(gd)
    mode = p.get("mode")
    if mode not in MODES:
        raise HTTPException(422, "Unknown battle mode.")
    target = p.get("target") if isinstance(p.get("target"), dict) else {}
    want_boost = p.get("boost") is True
    now = clock.now()
    seed = setups.new_seed()
    row = {
        "mode": mode, "ref": "", "attacker_id": user["id"] if user else None,
        "group_id": group["id"] if group else None, "classroom_code": None, "defender_id": None,
        "defender_kind": None, "defender_name": "", "war_id": None, "seed": seed, "army": None,
        "practice": False, "scored": False, "league_key": None, "status": "started", "created_at": now,
    }
    opponent = {}
    question_kind = "random"
    question_ident = ""
    question_germ = None

    with db.engine().begin() as conn:
        if group is not None and mode != "classroom":
            raise HTTPException(403, "Classroom groups can only play their session's battle.")
        if mode == "classroom":
            if group is None:
                raise HTTPException(401, "Join the classroom session first.")
            sess = conn.execute(
                select(db.classroom_sessions).where(db.classroom_sessions.c.code == group["code"])
            ).first()
            if sess is None:
                raise HTTPException(404, "That classroom session has ended.")
            if sess.status != "running":
                raise HTTPException(409, "Wait for your teacher to start the session.")
            setup = setups.classroom_setup(gd, seed, sess.mode, sess.ref)
            if setup is None:
                raise HTTPException(404, "The session's battle no longer exists.")
            row.update(ref=f"{sess.mode}:{sess.ref}", classroom_code=sess.code, defender_kind=sess.mode,
                       defender_name=setups.target_name(gd, sess.mode, sess.ref))
            opponent = {"name": row["defender_name"], "kind": sess.mode}
            question_kind, question_ident = "fixed", f"{sess.code}:{sess.ref}"
        elif mode == "multiplayer":
            user = _require_member(user)
            tok = security.unsign(target.get("token") if isinstance(target.get("token"), str) else "")
            if tok is None or tok.get("uid") != user["id"]:
                raise HTTPException(410, "That opponent is no longer available. Search again.")
            base = economy.ensure_base(conn, gd, user["id"], now, for_update=True)
            economy.refresh(gd, base, now)
            army, space = economy.validate_army(
                gd, p.get("army"), economy.units_unlocked(gd, base), base["core_level"]
            )
            cost = space * gd["economy"]["trainingNutrientsPerSpace"]
            if tok.get("k") == "bot":
                bot = ix.bots.get(tok.get("id"))
                if bot is None:
                    raise HTTPException(410, "That opponent is no longer available. Search again.")
                economy.pay(base, 0, cost)
                setup = setups.bot_setup(gd, seed, bot, army)
                row.update(ref=bot["id"], defender_kind="bot", defender_name=bot["name"])
                opponent = {"name": bot["name"], "kind": "bot", "trophies": bot["trophies"]}
            else:
                did = tok.get("id")
                if not isinstance(did, int) or did == user["id"]:
                    raise HTTPException(410, "That opponent is no longer available. Search again.")
                defender, dbase = _defender_snapshot(gd, conn, did, now)
                if (dbase.get("shield_until") or 0) > now or (dbase.get("under_attack_until") or 0) > now:
                    raise HTTPException(409, "That base is shielded or already under attack. Search again.")
                drow = _player_row(conn, did)
                economy.pay(base, 0, cost)
                dbase["under_attack_until"] = now + ATTACK_LOCK_SECONDS
                economy.save_base(conn, dbase)
                setup = setups.attack_setup(gd, seed, defender, army, setups.all_spells(gd))
                row.update(ref=str(did), defender_id=did, defender_kind="player",
                           defender_name=drow.display_name if drow else "Player")
                opponent = {"name": row["defender_name"], "kind": "player", "trophies": dbase["trophies"],
                            "college": drow.college if drow else ""}
            economy.save_base(conn, base)
            row["army"] = army
        elif mode in ("practice", "tournament"):
            user = _require_member(user)
            tb = ix.tbases.get(target.get("base_id"))
            if tb is None:
                raise HTTPException(404, "Unknown tournament base.")
            setup = setups.tournament_setup(gd, seed, tb)
            scored = mode == "tournament" and target.get("practice") is not True and _league_open(conn)
            if mode == "tournament" and not scored and target.get("practice") is not True:
                raise HTTPException(409, "The league is not open for scored attempts. Use practice.")
            if scored and user["is_guest"]:
                raise HTTPException(403, "Register an account to play scored league battles.")
            row.update(mode="tournament" if scored else "practice", ref=tb["id"], defender_kind="tournament",
                       defender_name=tb["name"], practice=not scored, scored=scored)
            if scored:
                row["league_key"] = f"{user['id']}:T:{tb['id']}"
                question_kind, question_ident = "fixed", tb["id"]
            opponent = {"name": tb["name"], "kind": "tournament", "difficulty": tb["difficulty"]}
        elif mode == "trial":
            user = _require_member(user)
            tr = ix.trials.get(target.get("trial_id"))
            if tr is None:
                raise HTTPException(404, "Unknown defence trial.")
            setup = setups.trial_setup(gd, seed, tr)
            scored = target.get("practice") is not True and _league_open(conn)
            if not scored and target.get("practice") is not True:
                raise HTTPException(409, "The league is not open for scored attempts. Use practice.")
            if scored and user["is_guest"]:
                raise HTTPException(403, "Register an account to play scored league battles.")
            row.update(ref=tr["id"], defender_kind="trial", defender_name=tr["name"], practice=not scored,
                       scored=scored)
            if scored:
                row["league_key"] = f"{user['id']}:D:{tr['id']}"
                question_kind, question_ident = "fixed", tr["id"]
            opponent = {"name": tr["name"], "kind": "trial"}
        elif mode == "campaign":
            user = _require_member(user)
            lvl = target.get("level")
            level = ix.campaign.get(lvl) if isinstance(lvl, int) else None
            if level is None:
                raise HTTPException(404, "Unknown campaign level.")
            base = economy.ensure_base(conn, gd, user["id"], now)
            if lvl > 1 and economy.campaign_stars(base, lvl - 1) < 1:
                raise HTTPException(403, f"Finish level {lvl - 1} with at least one star first.")
            setup = setups.campaign_setup(gd, seed, level)
            row.update(ref=str(lvl), defender_kind="campaign", defender_name=level["title"])
            opponent = {"name": level["title"], "kind": "campaign"}
            question_germ = level.get("germ")
        else:
            user = _require_member(user)
            war_id = target.get("war_id")
            did = target.get("user_id")
            war = conn.execute(select(db.clan_wars).where(db.clan_wars.c.id == war_id)).first() if isinstance(war_id, int) else None
            if war is None or war.status != "active" or war.ends_at < now:
                raise HTTPException(409, "That clan war is not active.")
            snaps = war.snapshots or {}
            mine = "a" if str(user["id"]) in (snaps.get("a") or {}) else ("b" if str(user["id"]) in (snaps.get("b") or {}) else None)
            if mine is None:
                raise HTTPException(403, "You are not part of this clan war.")
            enemy = snaps.get("b" if mine == "a" else "a") or {}
            snap = enemy.get(str(did)) if isinstance(did, int) else None
            if snap is None:
                raise HTTPException(404, "That base is not in the enemy clan.")
            used = conn.execute(
                select(func.count()).select_from(db.battles).where(
                    and_(db.battles.c.war_id == war.id, db.battles.c.attacker_id == user["id"],
                         db.battles.c.status != "invalid")
                )
            ).scalar()
            if used >= war.attacks_per_member:
                raise HTTPException(409, "You have used all your attacks in this war.")
            base = economy.ensure_base(conn, gd, user["id"], now)
            army, _ = economy.validate_army(gd, p.get("army"), economy.units_unlocked(gd, base), base["core_level"])
            setup = setups.attack_setup(gd, seed, snap["defender"], army, setups.all_spells(gd))
            row.update(ref=str(did), defender_id=did, defender_kind="clanwar", defender_name=snap.get("name", ""),
                       war_id=war.id, army=army)
            opponent = {"name": snap.get("name", ""), "kind": "clanwar", "college": snap.get("college", "")}

        question = None
        if want_boost:
            q = pick_question(question_kind, question_ident, question_germ)
            if q is not None:
                question = q
                row["question"] = q
                row["question_at"] = now
        row["setup"] = setup
        try:
            with conn.begin_nested():
                res = conn.execute(db.battles.insert().values(**row))
        except IntegrityError:
            raise HTTPException(409, "You have already used your one scored attempt for this league battle.")
        bid = res.inserted_primary_key[0]
    return {
        "battle_id": bid,
        "setup": setup,
        "question": public_question(question, gd["questionSeconds"]) if question else None,
        "opponent": opponent,
        "practice": bool(row["practice"]),
        "scored": bool(row["scored"]),
    }


def _load_battle(conn, bid: int, user: dict | None, group: dict | None, for_update: bool = False) -> dict:
    q = select(db.battles).where(db.battles.c.id == bid)
    if for_update:
        q = q.with_for_update()
    b = db.row_dict(conn.execute(q).first())
    if b is None:
        raise HTTPException(404, "Battle not found.")
    if group is not None:
        if b["group_id"] != group["id"]:
            raise HTTPException(403, "This is not your battle.")
    elif user is None or b["attacker_id"] != user["id"]:
        raise HTTPException(403, "This is not your battle.")
    return b


@router.post("/battle/{bid}/answer")
def answer(bid: int, request: Request, payload: dict = Body(default=None)):
    user, group = _actor(request)
    p = as_dict(payload)
    choice = get_int(p, "choice", lo=-1, hi=20)
    gd = get_gd()
    now = clock.now()
    with db.engine().begin() as conn:
        b = _load_battle(conn, bid, user, group, for_update=True)
        if b["status"] != "started":
            raise HTTPException(409, "This battle is already over.")
        q = b["question"]
        if not q:
            raise HTTPException(409, "This battle has no knowledge question.")
        if b["answered_at"] is not None:
            raise HTTPException(409, "You have already answered.")
        in_time = now - (b["question_at"] or now) <= gd["questionSeconds"] + 5
        correct = bool(in_time and choice == q["answer"])
        setup = b["setup"]
        side = "defender" if setup.get("mode") == "campaign" else "attacker"
        setup[side]["boost"] = correct
        conn.execute(
            db.battles.update().where(db.battles.c.id == bid).values(
                answered_at=now, boost_correct=correct, setup=setup
            )
        )
    return {
        "correct": correct,
        "answer": q["answer"],
        "explanation": q.get("explanation", ""),
        "in_time": in_time,
        "setup": setup,
    }


def _clean_commands(commands) -> list:
    if commands is None:
        return []
    if not isinstance(commands, list):
        raise HTTPException(422, "Commands must be a list.")
    if len(commands) > MAX_COMMANDS:
        raise HTTPException(413, "Too many commands.")
    if len(json.dumps(commands, separators=(",", ":"))) > MAX_COMMANDS_BYTES:
        raise HTTPException(413, "The command log is too large.")
    out = []
    for c in commands:
        if not isinstance(c, dict):
            raise HTTPException(422, "Each command must be an object.")
        out.append(c)
    return out


def _apply_multiplayer(gd: dict, conn, b: dict, result: dict, now: float) -> dict:
    stars = result["stars"]
    worm = int(result["stats"].get("wormStolen", 0))
    att = economy.load_base(conn, b["attacker_id"], for_update=True)
    economy.refresh(gd, att, now)
    da, dd = scoring.trophy_delta(gd, stars)
    if b["defender_kind"] == "bot":
        la, ln = scoring.bot_loot(gd, stars, worm)
    else:
        dbase = economy.load_base(conn, b["defender_id"], for_update=True)
        if dbase is None:
            la, ln = 0, 0
        else:
            economy.refresh(gd, dbase, now)
            la, ln = scoring.player_loot(gd, dbase["atp"], dbase["nutrients"], stars, worm)
            dbase["atp"] = max(0, dbase["atp"] - la - int(result.get("stats", {}).get("atpSpent", 0)))
            dbase["nutrients"] = max(0, dbase["nutrients"] - ln)
            economy.apply_pressure(gd, dbase, result.get("pressure") or {})
            economy.apply_memory(gd, dbase, b["setup"]["defender"]["layout"], result["stats"].get("kills") or {})
            if stars >= 1:
                dbase["shield_until"] = now + gd["shieldMinutes"] * 60
            dbase["under_attack_until"] = None
            dbase["defences_total"] = (dbase.get("defences_total") or 0) + 1
            dbase["defences_won"] = (dbase.get("defences_won") or 0) + (1 if stars <= 1 else 0)
            dbase["stars_conceded"] = (dbase.get("stars_conceded") or 0) + stars
            dbase["trophies"] = max(0, dbase["trophies"] + dd)
            economy.save_base(conn, dbase)
    ga, gn = economy.add_resources(gd, att, la, ln)
    att["trophies"] = max(0, att["trophies"] + da)
    economy.save_base(conn, att)
    return {"atp": ga, "nutrients": gn, "trophies": da}


@router.post("/battle/{bid}/finish")
def finish(bid: int, request: Request, payload: dict = Body(default=None)):
    user, group = _actor(request)
    p = as_dict(payload)
    commands = _clean_commands(p.get("commands"))
    claimed = p.get("claimed") if isinstance(p.get("claimed"), dict) else {}
    gd = get_gd()
    ix = index_of(gd)
    now = clock.now()
    expired = False
    with db.engine().begin() as conn:
        b = _load_battle(conn, bid, user, group)
        if b["status"] != "started":
            raise HTTPException(409, "This battle has already been submitted.")
        if now - b["created_at"] > gd["battleTimeoutMinutes"] * 60:
            expired = True
            conn.execute(db.battles.update().where(db.battles.c.id == bid).values(status="expired", finished_at=now))
            if b["defender_kind"] == "player" and b["defender_id"]:
                conn.execute(
                    db.bases.update().where(db.bases.c.user_id == b["defender_id"]).values(under_attack_until=None)
                )
    if expired:
        raise HTTPException(410, "This battle took too long and has expired.")

    t0 = time.perf_counter()
    result = sim.simulate(gd, b["setup"], commands)
    sim_ms = int((time.perf_counter() - t0) * 1000)

    with db.engine().begin() as conn:
        b = _load_battle(conn, bid, user, group, for_update=True)
        if b["status"] != "started":
            raise HTTPException(409, "This battle has already been submitted.")
        flags = []
        mismatch = False
        verified = None
        if "hash" in claimed:
            verified = claimed.get("hash") == result["hash"]
            mismatch = not verified
            if mismatch:
                flags.append("mismatch")
        realtime = b["mode"] in ("multiplayer", "tournament", "clanwar", "classroom") or (
            b["mode"] == "trial" and b["scored"])
        if realtime:
            tps = gd["tps"]
            ac = gd["antiCheat"]
            start_ref = b["answered_at"] or b["created_at"]
            need = result["ticks"] * ac["realtimeFactorPct"] / (100 * tps) - ac["realtimeSlackSeconds"]
            if now - start_ref < need:
                flags.append("too_fast")

        mode = b["mode"]
        boost = bool(b["boost_correct"])
        rewards = {"atp": 0, "nutrients": 0, "trophies": 0}
        objectives = None
        stars_campaign = None
        unlocked = {"units": [], "research": []}
        stars = result["stars"]
        if mode == "campaign":
            level = ix.campaign[int(b["ref"])]
            objectives = scoring.campaign_objectives(gd, level, result)
            stars_campaign = scoring.campaign_stars(objectives, result)
            stars = stars_campaign
            score = scoring.campaign_score(stars_campaign, result)
            base = economy.load_base(conn, b["attacker_id"], for_update=True)
            economy.refresh(gd, base, now)
            old = economy.campaign_stars(base, level["id"])
            ra, rn = scoring.campaign_reward(level, old, stars_campaign)
            ga, gn = economy.add_resources(gd, base, ra, rn)
            rewards.update(atp=ga, nutrients=gn)
            unlocked = scoring.newly_unlocked(gd, level["id"], old, stars_campaign)
            if stars_campaign > old:
                camp = dict(base["campaign"])
                camp[str(level["id"])] = stars_campaign
                base["campaign"] = camp
            economy.save_base(conn, base)
        elif mode == "trial":
            trial = ix.trials.get(b["ref"])
            score = scoring.trial_score(gd, result, trial)
            objectives = scoring.campaign_objectives(gd, trial or {}, result)
            stars = 1 if result.get("survived") else 0
            if b["scored"]:
                if "too_fast" in flags:
                    score = 0
                base = economy.load_base(conn, b["attacker_id"], for_update=True)
                trials = dict(base["trials"])
                if score > int(trials.get(b["ref"], -1)):
                    trials[b["ref"]] = score
                    base["trials"] = trials
                    economy.save_base(conn, base)
        elif mode == "classroom":
            cmode, cref = b["ref"].split(":", 1)
            score, st = scoring.classroom_score(gd, cmode, setups.classroom_target(gd, cmode, cref), result, boost)
            if st is not None:
                stars = st
            if cmode == "campaign":
                objectives = scoring.campaign_objectives(gd, setups.classroom_target(gd, cmode, cref), result)
                stars_campaign = st
        else:
            score = scoring.attack_score(gd, result, boost)
            if mode == "tournament" and "too_fast" in flags:
                score = 0
            if mode == "multiplayer":
                rewards = _apply_multiplayer(gd, conn, b, result, now)
        card_keys = cards.pick(gd, result)
        conn.execute(
            db.battles.update().where(db.battles.c.id == bid).values(
                status="finished", commands=commands, claimed=claimed, result=result, score=score, stars=stars,
                pct=result["pct"], verified=verified, mismatch=mismatch, flags=flags, rewards=rewards,
                objectives=objectives, sim_ms=sim_ms, finished_at=now,
            )
        )
    return {
        "battle_id": bid,
        "verified": verified,
        "mismatch": mismatch,
        "flags": flags,
        "result": result,
        "score": score,
        "rewards": rewards,
        "objectives": objectives,
        "stars_campaign": stars_campaign,
        "cards": card_keys,
        "unlocked": unlocked,
        "practice": bool(b["practice"]),
        "scored": bool(b["scored"]),
    }


def _can_view(b: dict, user: dict | None, group: dict | None) -> bool:
    if group is not None:
        return b["group_id"] == group["id"]
    if user is None:
        return False
    if user["role"] in ("admin", "observer"):
        return True
    if b["attacker_id"] == user["id"]:
        return True
    if b["defender_kind"] == "player" and b["defender_id"] == user["id"]:
        return True
    return False


@router.get("/battle/{bid}")
def get_battle(bid: int, request: Request):
    group = security.group_from_request(request)
    user = None if group else security.optional_user(request)
    if user is None and group is None:
        raise HTTPException(401, "Please log in.")
    with db.engine().connect() as conn:
        b = db.row_dict(conn.execute(select(db.battles).where(db.battles.c.id == bid)).first())
        if b is None:
            raise HTTPException(404, "Battle not found.")
        if not _can_view(b, user, group):
            raise HTTPException(403, "You cannot view this battle.")
        attacker = "Classroom group"
        if b["attacker_id"]:
            r = _player_row(conn, b["attacker_id"])
            attacker = r.display_name if r else "Deleted player"
        elif b["group_id"]:
            g = conn.execute(select(db.classroom_groups.c.name).where(db.classroom_groups.c.id == b["group_id"])).first()
            attacker = g.name if g else "Classroom group"
    return {
        "id": b["id"], "mode": b["mode"], "ref": b["ref"], "status": b["status"], "setup": b["setup"],
        "commands": b["commands"] or [], "result": b["result"], "score": b["score"], "stars": b["stars"],
        "attacker": {"name": attacker}, "defender": {"name": b["defender_name"] or "", "kind": b["defender_kind"]},
        "created_at": clock.iso(b["created_at"]), "finished_at": clock.iso(b["finished_at"]),
        "verified": b["verified"], "flags": b["flags"] or [], "review": b["review"], "note": b["note"],
        "objectives": b["objectives"],
    }


@router.get("/battles")
def list_battles(kind: str = "attacks", user: dict = Depends(security.current_user)):
    with db.engine().connect() as conn:
        if kind == "defences":
            cond = and_(db.battles.c.defender_id == user["id"], db.battles.c.defender_kind == "player")
        else:
            cond = db.battles.c.attacker_id == user["id"]
        rows = conn.execute(
            select(db.battles).where(and_(cond, db.battles.c.status == "finished"))
            .order_by(db.battles.c.id.desc()).limit(60)
        ).all()
        names = {}
        out = []
        for r in rows:
            if kind == "defences":
                if r.attacker_id not in names:
                    pr = _player_row(conn, r.attacker_id) if r.attacker_id else None
                    names[r.attacker_id] = pr.display_name if pr else "Deleted player"
                opponent = names[r.attacker_id]
            else:
                opponent = r.defender_name or ""
            out.append({
                "id": r.id, "mode": r.mode, "ref": r.ref, "opponent": opponent, "stars": r.stars, "pct": r.pct,
                "score": r.score, "created_at": clock.iso(r.created_at), "verified": r.verified,
                "flags": r.flags or [], "rewards": r.rewards,
            })
    return {"rows": out}
