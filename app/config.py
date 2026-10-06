import logging
import os
import secrets
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

log = logging.getLogger("bodybastion")


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def normalize_database_url(url: str) -> str:
    url = url.strip()
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


@dataclass
class Config:
    database_url: str
    secret_key: str
    secret_generated: bool
    admin_username: str
    admin_password: str
    auto_approve: bool
    shared_dir: Path
    static_dir: Path
    public_base_url: str


_config: Config | None = None


def load_config() -> Config:
    secret = os.environ.get("SECRET_KEY", "").strip()
    generated = False
    if not secret:
        secret = secrets.token_urlsafe(48)
        generated = True
        log.warning("SECRET_KEY is not set: a random key is generated once and stored in the database.")
    return Config(
        database_url=normalize_database_url(os.environ.get("DATABASE_URL", "") or "sqlite:///./bodybastion.db"),
        secret_key=secret,
        secret_generated=generated,
        admin_username=(os.environ.get("ADMIN_USERNAME", "") or "").strip().lower(),
        admin_password=os.environ.get("ADMIN_PASSWORD", "") or "",
        auto_approve=_env_bool("AUTO_APPROVE", True),
        shared_dir=Path(os.environ.get("BB_SHARED_DIR") or (ROOT / "shared")).resolve(),
        static_dir=Path(os.environ.get("BB_STATIC_DIR") or (ROOT / "static")).resolve(),
        public_base_url=(os.environ.get("PUBLIC_BASE_URL", "") or "").strip().rstrip("/"),
    )


def get_config() -> Config:
    global _config
    if _config is None:
        _config = load_config()
    return _config


def reset_config() -> None:
    global _config
    _config = None
