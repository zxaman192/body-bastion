import base64
import hashlib
import hmac
import json
import secrets
import threading
from collections import deque

from fastapi import Depends, HTTPException, Request
from sqlalchemy import delete, select

from app import clock, db
from app.config import get_config

PBKDF2_ITERATIONS = 120000
TOKEN_DAYS = 30
ROLES = ("player", "teacher", "observer", "admin")


def hash_password(password: str, salt_hex: str | None = None) -> tuple[str, str]:
    if salt_hex is None:
        salt_hex = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), PBKDF2_ITERATIONS)
    return digest.hex(), salt_hex


def verify_password(password: str, hash_hex: str | None, salt_hex: str | None) -> bool:
    if not hash_hex or not salt_hex:
        hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), b"0" * 16, PBKDF2_ITERATIONS)
        return False
    candidate, _ = hash_password(password, salt_hex)
    return hmac.compare_digest(candidate, hash_hex)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_token() -> str:
    return secrets.token_urlsafe(32)


def create_session(conn, user_id: int) -> str:
    token = new_token()
    now = clock.now()
    conn.execute(
        db.sessions.insert().values(
            token_hash=token_hash(token), user_id=user_id, created_at=now, expires_at=now + TOKEN_DAYS * 86400
        )
    )
    return token


def user_public(u: dict) -> dict:
    return {
        "id": u["id"],
        "username": u["username"],
        "display_name": u["display_name"],
        "college": u["college"],
        "role": u["role"],
        "status": u["status"],
        "is_guest": bool(u["is_guest"]),
        "clan_id": u["clan_id"],
    }


def bearer_token(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if auth[:7].lower() == "bearer ":
        tok = auth[7:].strip()
        return tok or None
    return None


def _user_for_token(token: str) -> dict | None:
    th = token_hash(token)
    with db.engine().connect() as conn:
        row = conn.execute(
            select(db.users, db.sessions.c.expires_at)
            .select_from(db.sessions.join(db.users, db.users.c.id == db.sessions.c.user_id))
            .where(db.sessions.c.token_hash == th)
        ).first()
    if row is None:
        return None
    data = dict(row._mapping)
    if data.pop("expires_at") < clock.now():
        with db.engine().begin() as conn:
            conn.execute(delete(db.sessions).where(db.sessions.c.token_hash == th))
        return None
    return data


def optional_user(request: Request) -> dict | None:
    token = bearer_token(request)
    if not token:
        return None
    user = _user_for_token(token)
    if user is None or user["status"] != "approved":
        return None
    return user


def current_user(request: Request) -> dict:
    token = bearer_token(request)
    if not token:
        raise HTTPException(401, "Please log in.")
    user = _user_for_token(token)
    if user is None:
        raise HTTPException(401, "Your session has expired. Please log in again.")
    if user["status"] != "approved":
        raise HTTPException(403, "Your account is not approved.")
    return user


def require_role(*roles: str):
    def dep(user: dict = Depends(current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(403, "You do not have permission to do this.")
        return user

    return dep


def group_from_request(request: Request) -> dict | None:
    token = request.headers.get("x-group-token", "").strip()
    if not token:
        return None
    with db.engine().connect() as conn:
        row = conn.execute(
            select(db.classroom_groups).where(db.classroom_groups.c.token_hash == token_hash(token))
        ).first()
    return db.row_dict(row)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def sign(payload: dict) -> str:
    body = _b64(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    sig = hmac.new(get_config().secret_key.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest()
    return body + "." + _b64(sig)


def unsign(token: str) -> dict | None:
    if not isinstance(token, str) or token.count(".") != 1:
        return None
    body, sig = token.split(".")
    expected = _b64(hmac.new(get_config().secret_key.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest())
    if not hmac.compare_digest(expected, sig):
        return None
    try:
        payload = json.loads(_unb64(body))
    except (ValueError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict):
        return None
    if payload.get("exp", 0) < clock.now():
        return None
    return payload


class RateLimiter:
    def __init__(self):
        self._lock = threading.Lock()
        self._hits: dict[str, deque] = {}

    def blocked(self, key: str, limit: int, window: float) -> bool:
        now = clock.now()
        with self._lock:
            q = self._hits.get(key)
            if not q:
                return False
            while q and q[0] <= now - window:
                q.popleft()
            if not q:
                self._hits.pop(key, None)
                return False
            return len(q) >= limit

    def hit(self, key: str) -> None:
        now = clock.now()
        with self._lock:
            q = self._hits.setdefault(key, deque())
            q.append(now)
            if len(q) > 1000:
                q.popleft()
            if len(self._hits) > 50000:
                self._hits.clear()

    def reset(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = RateLimiter()


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"
