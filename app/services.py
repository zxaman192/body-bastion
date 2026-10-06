import logging

from sqlalchemy import and_, delete, func, or_, select

from app import clock, db, security
from app.config import get_config

log = logging.getLogger("bodybastion")

DELETED_NAME = "Deleted player"


def bootstrap_admin(conn) -> None:
    cfg = get_config()
    if not cfg.admin_username or not cfg.admin_password:
        return
    row = conn.execute(select(db.users).where(db.users.c.username == cfg.admin_username)).first()
    now = clock.now()
    if row is None:
        ph, salt = security.hash_password(cfg.admin_password)
        conn.execute(
            db.users.insert().values(
                username=cfg.admin_username,
                display_name="Organiser",
                college="",
                course="",
                password_hash=ph,
                salt=salt,
                role="admin",
                status="approved",
                is_guest=False,
                is_adult=True,
                created_at=now,
            )
        )
        log.info("Created admin account %r.", cfg.admin_username)
        return
    values = {}
    if row.role != "admin":
        values["role"] = "admin"
    if row.status != "approved":
        values["status"] = "approved"
    if not security.verify_password(cfg.admin_password, row.password_hash, row.salt):
        ph, salt = security.hash_password(cfg.admin_password)
        values.update(password_hash=ph, salt=salt)
    if values:
        conn.execute(db.users.update().where(db.users.c.id == row.id).values(**values))


def cleanup(conn) -> None:
    now = clock.now()
    conn.execute(delete(db.sessions).where(db.sessions.c.expires_at < now))
    old_guests = [
        r.id
        for r in conn.execute(
            select(db.users.c.id).where(
                and_(db.users.c.is_guest.is_(True), db.users.c.created_at < now - 31 * 86400)
            )
        ).all()
    ]
    for uid in old_guests:
        erase_user(conn, uid)
    stale = now - 3600
    conn.execute(
        db.battles.update()
        .where(and_(db.battles.c.status.in_(("started", "verifying")), db.battles.c.created_at < stale))
        .values(status="expired")
    )


def _delete_clan_if_empty(conn, clan_id: int) -> None:
    members = conn.execute(select(func.count()).select_from(db.users).where(db.users.c.clan_id == clan_id)).scalar()
    if members:
        return
    wars = conn.execute(
        select(func.count())
        .select_from(db.clan_wars)
        .where(or_(db.clan_wars.c.clan_a == clan_id, db.clan_wars.c.clan_b == clan_id))
    ).scalar()
    if not wars:
        conn.execute(delete(db.clans).where(db.clans.c.id == clan_id))


def delete_classroom(conn, code: str) -> None:
    conn.execute(delete(db.battles).where(db.battles.c.classroom_code == code))
    conn.execute(delete(db.classroom_groups).where(db.classroom_groups.c.code == code))
    conn.execute(delete(db.classroom_sessions).where(db.classroom_sessions.c.code == code))


def erase_user(conn, user_id: int) -> None:
    row = conn.execute(select(db.users.c.id, db.users.c.clan_id).where(db.users.c.id == user_id)).first()
    if row is None:
        return
    conn.execute(delete(db.sessions).where(db.sessions.c.user_id == user_id))
    conn.execute(delete(db.bases).where(db.bases.c.user_id == user_id))
    conn.execute(delete(db.battles).where(db.battles.c.attacker_id == user_id))
    conn.execute(
        db.battles.update()
        .where(db.battles.c.defender_id == user_id)
        .values(defender_id=None, defender_name=DELETED_NAME)
    )
    for s in conn.execute(
        select(db.classroom_sessions.c.code).where(db.classroom_sessions.c.teacher_id == user_id)
    ).all():
        delete_classroom(conn, s.code)
    conn.execute(db.clans.update().where(db.clans.c.created_by == user_id).values(created_by=None))
    for w in conn.execute(select(db.clan_wars.c.id, db.clan_wars.c.snapshots)).all():
        snaps = w.snapshots or {}
        changed = False
        for side in ("a", "b"):
            entry = (snaps.get(side) or {}).get(str(user_id))
            if entry is not None:
                entry["name"] = DELETED_NAME
                entry["college"] = ""
                changed = True
        if changed:
            conn.execute(db.clan_wars.update().where(db.clan_wars.c.id == w.id).values(snapshots=snaps))
    conn.execute(delete(db.users).where(db.users.c.id == user_id))
    if row.clan_id:
        _delete_clan_if_empty(conn, row.clan_id)


def purge(conn) -> dict:
    counts = {}
    keep = [r.id for r in conn.execute(select(db.users.c.id).where(db.users.c.role == "admin")).all()]
    counts["battles"] = conn.execute(delete(db.battles)).rowcount
    counts["bases"] = conn.execute(delete(db.bases)).rowcount
    counts["clan_wars"] = conn.execute(delete(db.clan_wars)).rowcount
    conn.execute(db.users.update().values(clan_id=None))
    counts["clans"] = conn.execute(delete(db.clans)).rowcount
    counts["classroom_groups"] = conn.execute(delete(db.classroom_groups)).rowcount
    counts["classroom_sessions"] = conn.execute(delete(db.classroom_sessions)).rowcount
    if keep:
        counts["sessions"] = conn.execute(delete(db.sessions).where(db.sessions.c.user_id.not_in(keep))).rowcount
        counts["users"] = conn.execute(delete(db.users).where(db.users.c.id.not_in(keep))).rowcount
    else:
        counts["sessions"] = conn.execute(delete(db.sessions)).rowcount
        counts["users"] = conn.execute(delete(db.users)).rowcount
    return counts
