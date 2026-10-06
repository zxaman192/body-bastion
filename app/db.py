from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Column,
    Float,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    event,
    select,
)
from sqlalchemy.engine import Engine

from app.config import get_config

metadata = MetaData()

users = Table(
    "users",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("username", String(40), nullable=False, unique=True),
    Column("display_name", String(40), nullable=False),
    Column("college", String(120), nullable=False, default=""),
    Column("course", String(80), nullable=False, default=""),
    Column("email", String(160)),
    Column("password_hash", String(128)),
    Column("salt", String(64)),
    Column("role", String(16), nullable=False, default="player"),
    Column("status", String(16), nullable=False, default="pending", index=True),
    Column("is_guest", Boolean, nullable=False, default=False),
    Column("is_adult", Boolean, nullable=False, default=True),
    Column("guardian_name", String(120)),
    Column("guardian_email", String(160)),
    Column("consent_version", String(40)),
    Column("consent_at", Float),
    Column("clan_id", Integer, index=True),
    Column("created_at", Float, nullable=False),
)

sessions = Table(
    "sessions",
    metadata,
    Column("token_hash", String(64), primary_key=True),
    Column("user_id", Integer, nullable=False, index=True),
    Column("created_at", Float, nullable=False),
    Column("expires_at", Float, nullable=False),
)

bases = Table(
    "bases",
    metadata,
    Column("user_id", Integer, primary_key=True, autoincrement=False),
    Column("layout", JSON, nullable=False),
    Column("core_level", Integer, nullable=False),
    Column("policy", JSON, nullable=False),
    Column("research", JSON, nullable=False),
    Column("resistance", JSON, nullable=False),
    Column("resistance_at", Float, nullable=False),
    Column("memory", JSON, nullable=False),
    Column("campaign", JSON, nullable=False),
    Column("trials", JSON, nullable=False),
    Column("atp", Integer, nullable=False),
    Column("nutrients", Integer, nullable=False),
    Column("atp_rem", Integer, nullable=False, default=0),
    Column("nut_rem", Integer, nullable=False, default=0),
    Column("accrued_at", Float, nullable=False),
    Column("trophies", Integer, nullable=False, default=0, index=True),
    Column("shield_until", Float),
    Column("under_attack_until", Float),
    Column("dewormed_until", Float),
    Column("defences_total", Integer, nullable=False, default=0),
    Column("defences_won", Integer, nullable=False, default=0),
    Column("stars_conceded", Integer, nullable=False, default=0),
    Column("updated_at", Float),
)

battles = Table(
    "battles",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("mode", String(16), nullable=False, index=True),
    Column("ref", String(40), nullable=False, default=""),
    Column("attacker_id", Integer, index=True),
    Column("group_id", Integer, index=True),
    Column("classroom_code", String(8), index=True),
    Column("defender_id", Integer, index=True),
    Column("defender_kind", String(12)),
    Column("defender_name", String(80)),
    Column("war_id", Integer, index=True),
    Column("setup", JSON, nullable=False),
    Column("seed", BigInteger),
    Column("army", JSON),
    Column("question", JSON),
    Column("question_at", Float),
    Column("answered_at", Float),
    Column("boost_correct", Boolean, nullable=False, default=False),
    Column("practice", Boolean, nullable=False, default=False),
    Column("scored", Boolean, nullable=False, default=False),
    Column("league_key", String(80), unique=True),
    Column("status", String(12), nullable=False, default="started", index=True),
    Column("commands", JSON),
    Column("claimed", JSON),
    Column("result", JSON),
    Column("score", Integer),
    Column("stars", Integer),
    Column("pct", Integer),
    Column("verified", Boolean),
    Column("mismatch", Boolean),
    Column("flags", JSON),
    Column("review", String(16)),
    Column("note", Text),
    Column("rewards", JSON),
    Column("objectives", JSON),
    Column("sim_ms", Integer),
    Column("created_at", Float, nullable=False, index=True),
    Column("finished_at", Float),
)

clans = Table(
    "clans",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("name", String(40), nullable=False),
    Column("name_key", String(40), nullable=False, unique=True),
    Column("college", String(120), nullable=False, default=""),
    Column("created_by", Integer),
    Column("created_at", Float, nullable=False),
)

clan_wars = Table(
    "clan_wars",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("clan_a", Integer, nullable=False, index=True),
    Column("clan_b", Integer, nullable=False, index=True),
    Column("status", String(12), nullable=False, default="active", index=True),
    Column("attacks_per_member", Integer, nullable=False, default=2),
    Column("starts_at", Float, nullable=False),
    Column("ends_at", Float, nullable=False),
    Column("snapshots", JSON, nullable=False),
    Column("result", JSON),
    Column("created_at", Float, nullable=False),
)

classroom_sessions = Table(
    "classroom_sessions",
    metadata,
    Column("code", String(8), primary_key=True),
    Column("teacher_id", Integer, nullable=False, index=True),
    Column("title", String(120), nullable=False, default=""),
    Column("mode", String(12), nullable=False),
    Column("ref", String(40), nullable=False),
    Column("status", String(12), nullable=False, default="open"),
    Column("created_at", Float, nullable=False),
)

classroom_groups = Table(
    "classroom_groups",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("code", String(8), nullable=False, index=True),
    Column("name", String(40), nullable=False),
    Column("token_hash", String(64), nullable=False, unique=True),
    Column("created_at", Float, nullable=False),
)

settings = Table(
    "settings",
    metadata,
    Column("key", String(40), primary_key=True),
    Column("value", JSON),
)

LEAGUE_PHASES = ("closed", "practice", "league", "finished")

_engine: Engine | None = None


def init_engine(url: str | None = None) -> Engine:
    global _engine
    if _engine is not None:
        _engine.dispose()
    url = url or get_config().database_url
    kwargs: dict = {"pool_pre_ping": True}
    is_sqlite = url.startswith("sqlite")
    if is_sqlite:
        kwargs["connect_args"] = {"check_same_thread": False, "timeout": 30}
    else:
        kwargs.update(pool_size=5, max_overflow=10, pool_recycle=1800)
    eng = create_engine(url, **kwargs)
    if is_sqlite:
        @event.listens_for(eng, "connect")
        def _sqlite_pragmas(dbapi_conn, _record):
            dbapi_conn.isolation_level = None
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA journal_mode=WAL")
            cur.execute("PRAGMA busy_timeout=30000")
            cur.execute("PRAGMA synchronous=NORMAL")
            cur.close()

        # Take the write lock up front so read-modify-write transactions cannot deadlock.
        @event.listens_for(eng, "begin")
        def _sqlite_begin(conn):
            conn.exec_driver_sql("BEGIN IMMEDIATE")
    metadata.create_all(eng)
    _engine = eng
    return eng


def engine() -> Engine:
    if _engine is None:
        return init_engine()
    return _engine


def dispose_engine() -> None:
    global _engine
    if _engine is not None:
        _engine.dispose()
        _engine = None


def default_settings() -> dict:
    return {
        "auto_approve": get_config().auto_approve,
        "league_phase": "practice",
        "deworming_active": False,
        "clan_max_members": 10,
    }


def get_settings(conn) -> dict:
    out = default_settings()
    for row in conn.execute(select(settings.c.key, settings.c.value)).all():
        if row.key in out:
            out[row.key] = row.value
    return out


def put_settings(conn, values: dict) -> dict:
    current = {r.key for r in conn.execute(select(settings.c.key)).all()}
    for key, value in values.items():
        if key in current:
            conn.execute(settings.update().where(settings.c.key == key).values(value=value))
        else:
            conn.execute(settings.insert().values(key=key, value=value))
    return get_settings(conn)


def row_dict(row) -> dict | None:
    if row is None:
        return None
    return dict(row._mapping)
