import io
import secrets

import segno
from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError

from app import clock, db, security, services, setups
from app.config import get_config
from app.gamedata import get_gd
from app.util import as_dict, csv_response, get_str

router = APIRouter(prefix="/api", tags=["classroom"])

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
STATUSES = ("open", "running", "closed")
teacher_dep = security.require_role("teacher", "admin")


def _base_url(request: Request) -> str:
    cfg = get_config().public_base_url
    if cfg:
        return cfg
    return str(request.base_url).rstrip("/")


def _qr_svg(text: str) -> str:
    buf = io.BytesIO()
    segno.make(text, error="m").save(buf, kind="svg", scale=6, border=2, xmldecl=False, dark="#1b1b2f", light="#ffffff")
    return buf.getvalue().decode("utf-8")


def _session(conn, code: str):
    row = conn.execute(select(db.classroom_sessions).where(db.classroom_sessions.c.code == code.upper())).first()
    if row is None:
        raise HTTPException(404, "No classroom session with that code.")
    return row


def _owner(sess, user: dict) -> None:
    if user["role"] != "admin" and sess.teacher_id != user["id"]:
        raise HTTPException(403, "Only the teacher who created this session can do that.")


def _links(request: Request, code: str) -> dict:
    base = _base_url(request)
    join = f"{base}/#/join/{code}"
    return {"join_url": join, "projector_url": f"{base}/#/projector/{code}", "qr_svg": _qr_svg(join)}


def _info(gd: dict, conn, sess) -> dict:
    groups = conn.execute(
        select(func.count()).select_from(db.classroom_groups).where(db.classroom_groups.c.code == sess.code)
    ).scalar()
    return {"code": sess.code, "title": sess.title, "mode": sess.mode, "ref": sess.ref,
            "target_name": setups.target_name(gd, sess.mode, sess.ref), "status": sess.status,
            "groups": int(groups or 0), "created_at": clock.iso(sess.created_at)}


@router.post("/classroom")
def create(request: Request, payload: dict = Body(default=None), user: dict = Depends(teacher_dep)):
    p = as_dict(payload)
    gd = get_gd()
    mode = p.get("mode")
    if mode not in ("campaign", "tournament", "trial"):
        raise HTTPException(422, "Choose a campaign level, a tournament base or a defence trial.")
    ref = str(p.get("ref", "")).strip()
    if setups.classroom_target(gd, mode, ref) is None:
        raise HTTPException(422, "That level, base or trial does not exist.")
    title = get_str(p, "title", required=False, max_len=120) or setups.target_name(gd, mode, ref)
    now = clock.now()
    with db.engine().begin() as conn:
        for _ in range(20):
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))
            try:
                with conn.begin_nested():
                    conn.execute(db.classroom_sessions.insert().values(
                        code=code, teacher_id=user["id"], title=title, mode=mode, ref=ref, status="open",
                        created_at=now))
                break
            except IntegrityError:
                continue
        else:
            raise HTTPException(503, "Could not create a session code. Please try again.")
        sess = _session(conn, code)
        info = _info(gd, conn, sess)
    return {**info, **_links(request, code)}


@router.get("/classroom/mine")
def mine(request: Request, user: dict = Depends(teacher_dep)):
    gd = get_gd()
    with db.engine().connect() as conn:
        q = select(db.classroom_sessions).order_by(db.classroom_sessions.c.created_at.desc()).limit(50)
        if user["role"] != "admin":
            q = q.where(db.classroom_sessions.c.teacher_id == user["id"])
        rows = [{**_info(gd, conn, s), **{k: v for k, v in _links(request, s.code).items() if k != "qr_svg"}}
                for s in conn.execute(q).all()]
    return {"rows": rows}


@router.get("/classroom/{code}")
def info(code: str, request: Request):
    gd = get_gd()
    with db.engine().connect() as conn:
        sess = _session(conn, code)
        data = _info(gd, conn, sess)
    return {**data, **_links(request, sess.code)}


@router.post("/classroom/{code}/join")
def join(code: str, request: Request, payload: dict = Body(default=None)):
    p = as_dict(payload)
    name = get_str(p, "group_name", min_len=2, max_len=30, label="group name")
    ip = security.client_ip(request)
    if security.limiter.blocked(f"join:{ip}", 120, 600):
        raise HTTPException(429, "Too many joins from this network. Please wait a little.")
    security.limiter.hit(f"join:{ip}")
    now = clock.now()
    with db.engine().begin() as conn:
        sess = _session(conn, code)
        if sess.status == "closed":
            raise HTTPException(409, "This session is closed.")
        taken = conn.execute(
            select(func.count()).select_from(db.classroom_groups).where(
                and_(db.classroom_groups.c.code == sess.code,
                     func.lower(db.classroom_groups.c.name) == name.lower()))
        ).scalar()
        if taken:
            raise HTTPException(409, "That group name is already taken in this session.")
        token = security.new_token()
        res = conn.execute(db.classroom_groups.insert().values(
            code=sess.code, name=name, token_hash=security.token_hash(token), created_at=now))
        gid = res.inserted_primary_key[0]
    return {"group_token": token, "group_id": gid, "group_name": name, "code": sess.code}


@router.post("/classroom/{code}/status")
def set_status(code: str, payload: dict = Body(default=None), user: dict = Depends(teacher_dep)):
    p = as_dict(payload)
    status = p.get("status")
    if status not in STATUSES:
        raise HTTPException(422, "Status must be open, running or closed.")
    gd = get_gd()
    with db.engine().begin() as conn:
        sess = _session(conn, code)
        _owner(sess, user)
        conn.execute(db.classroom_sessions.update().where(db.classroom_sessions.c.code == sess.code)
                     .values(status=status))
        return _info(gd, conn, _session(conn, code))


@router.delete("/classroom/{code}")
def delete(code: str, user: dict = Depends(teacher_dep)):
    with db.engine().begin() as conn:
        sess = _session(conn, code)
        _owner(sess, user)
        services.delete_classroom(conn, sess.code)
    return {"ok": True}


def _attempts(conn, code: str) -> list[dict]:
    groups = {g.id: g.name for g in conn.execute(
        select(db.classroom_groups.c.id, db.classroom_groups.c.name).where(db.classroom_groups.c.code == code)).all()}
    rows = conn.execute(
        select(db.battles.c.id, db.battles.c.group_id, db.battles.c.score, db.battles.c.stars, db.battles.c.pct,
               db.battles.c.result, db.battles.c.finished_at, db.battles.c.flags)
        .where(and_(db.battles.c.classroom_code == code, db.battles.c.status == "finished"))
        .order_by(db.battles.c.finished_at)
    ).all()
    out = []
    for r in rows:
        res = r.result or {}
        st = res.get("stats") or {}
        out.append({"battle_id": r.id, "group_id": r.group_id, "group": groups.get(r.group_id, "Group"),
                    "score": r.score or 0, "stars": r.stars, "pct": r.pct, "survived": bool(res.get("survived")),
                    "unnecessary": int(st.get("unnecessary", 0)), "hydration_min": res.get("hydrationMinPct"),
                    "finished_at": r.finished_at, "flags": r.flags or []})
    return out


@router.get("/classroom/{code}/results")
def results(code: str):
    gd = get_gd()
    with db.engine().connect() as conn:
        sess = _session(conn, code)
        attempts = _attempts(conn, sess.code)
        info_ = _info(gd, conn, sess)
    best: dict[int, dict] = {}
    count: dict[int, int] = {}
    for a in attempts:
        gid = a["group_id"]
        count[gid] = count.get(gid, 0) + 1
        if gid not in best or a["score"] > best[gid]["score"]:
            best[gid] = a
    rows = sorted(best.values(), key=lambda a: (-a["score"], a["finished_at"]))
    out = []
    rank = 0
    prev = None
    for i, a in enumerate(rows):
        if a["score"] != prev:
            rank = i + 1
            prev = a["score"]
        out.append({"rank": rank, "group": a["group"], "score": a["score"], "stars": a["stars"], "pct": a["pct"],
                    "survived": a["survived"], "unnecessary": a["unnecessary"], "attempts": count[a["group_id"]]})
    return {**info_, "rows": out, "server_time": clock.iso(clock.now())}


@router.get("/classroom/{code}/export.csv")
def export(code: str, user: dict = Depends(teacher_dep)):
    with db.engine().connect() as conn:
        sess = _session(conn, code)
        _owner(sess, user)
        attempts = _attempts(conn, sess.code)
    rows = [[a["group"], a["battle_id"], a["score"], a["stars"], a["pct"], a["survived"], a["unnecessary"],
             a["hydration_min"], clock.iso(a["finished_at"]), " ".join(a["flags"])] for a in attempts]
    return csv_response(f"classroom_{sess.code}.csv",
                        ["group", "battle_id", "score", "stars", "pct_destroyed", "survived", "unnecessary_shots",
                         "min_hydration_pct", "finished_at_utc", "flags"], rows)
