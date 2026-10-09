import re
import secrets

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from app import clock, db, security, services
from app.routes.privacy import privacy_notice
from app.util import as_dict, get_bool, get_str

router = APIRouter(prefix="/api", tags=["auth"])

USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9_.-]{2,29}$")
EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$")

LOGIN_FAILS_PER_USER = 8
LOGIN_FAILS_PER_IP = 40
LOGIN_WINDOW = 300
REGISTER_PER_IP = 30
GUEST_PER_IP = 300


def _email(p: dict, key: str, label: str, required: bool) -> str | None:
    v = get_str(p, key, required=required, max_len=160, label=label)
    if v is None:
        return None
    if not EMAIL_RE.match(v):
        raise HTTPException(422, f"Please enter a valid {label}.")
    return v.lower()


@router.post("/auth/register")
def register(request: Request, payload: dict = Body(default=None)):
    p = as_dict(payload)
    ip = security.client_ip(request)
    if security.limiter.blocked(f"register:{ip}", REGISTER_PER_IP, 3600):
        raise HTTPException(429, "Too many registrations from this network. Please try again later.")
    username = get_str(p, "username", min_len=3, max_len=30).lower()
    if not USERNAME_RE.match(username) or username.startswith("guest"):
        raise HTTPException(
            422, "Username must be 3-30 characters: lowercase letters, digits, dot, dash or underscore."
        )
    password = p.get("password")
    if not isinstance(password, str) or len(password) < 8:
        raise HTTPException(422, "Password must be at least 8 characters.")
    if len(password) > 200:
        raise HTTPException(422, "Password is too long.")
    display = get_str(p, "display_name", min_len=2, max_len=30, label="display name")
    if "@" in display:
        raise HTTPException(422, "Your display name is public: please use a handle, not an email address.")
    college = get_str(p, "college", min_len=2, max_len=120)
    course = get_str(p, "course", required=False, max_len=80, default="")
    email = _email(p, "email", "email address", required=False)
    if p.get("is_adult") is None:
        raise HTTPException(422, "Please confirm whether you are 18 or older.")
    is_adult = get_bool(p, "is_adult")
    guardian_name = guardian_email = None
    if not is_adult:
        guardian_name = get_str(p, "guardian_name", min_len=2, max_len=120, label="parent or guardian's name")
        guardian_email = _email(p, "guardian_email", "parent or guardian's email", required=True)
    if p.get("consent") is not True:
        raise HTTPException(422, "You must read and accept the privacy notice to register.")
    version = get_str(p, "consent_version", required=False, max_len=40) or privacy_notice()["version"]

    security.limiter.hit(f"register:{ip}")
    ph, salt = security.hash_password(password)
    now = clock.now()
    # A guest who registers keeps their base, resources and progress: the guest row is upgraded in place.
    current = security.optional_user(request)
    guest_id = current["id"] if current and current["is_guest"] else None
    values = dict(
        username=username,
        display_name=display,
        college=college,
        course=course or "",
        email=email,
        password_hash=ph,
        salt=salt,
        is_guest=False,
        is_adult=is_adult,
        guardian_name=guardian_name,
        guardian_email=guardian_email,
        consent_version=version,
        consent_at=now,
    )
    with db.engine().begin() as conn:
        settings = db.get_settings(conn)
        status = "approved" if (settings.get("auto_approve") and is_adult) else "pending"
        try:
            with conn.begin_nested():
                if guest_id is not None:
                    conn.execute(
                        db.users.update().where(db.users.c.id == guest_id).values(status=status, **values)
                    )
                    if status != "approved":
                        conn.execute(delete(db.sessions).where(db.sessions.c.user_id == guest_id))
                else:
                    conn.execute(
                        db.users.insert().values(role="player", status=status, created_at=now, **values)
                    )
        except IntegrityError:
            raise HTTPException(409, "That username is taken. Please choose another.")
    if status == "approved":
        msg = "Your account is ready. You can log in now."
    elif not is_adult:
        msg = ("Thank you. Because you are under 18, an organiser will check your guardian's consent "
               "before approving your account.")
    else:
        msg = "Thank you. An organiser will approve your account soon."
    if guest_id is not None:
        msg += " Your guest base and progress have been moved to this account."
    return {"status": status, "message": msg, "upgraded": guest_id is not None}


@router.post("/auth/login")
def login(request: Request, payload: dict = Body(default=None)):
    p = as_dict(payload)
    username = (p.get("username") or "")
    password = p.get("password") or ""
    if not isinstance(username, str) or not isinstance(password, str) or not username or not password:
        raise HTTPException(422, "Please enter your username and password.")
    username = username.strip().lower()[:60]
    ip = security.client_ip(request)
    ukey = f"login:{ip}:{username}"
    ikey = f"loginip:{ip}"
    if security.limiter.blocked(ukey, LOGIN_FAILS_PER_USER, LOGIN_WINDOW) or security.limiter.blocked(
        ikey, LOGIN_FAILS_PER_IP, LOGIN_WINDOW
    ):
        raise HTTPException(429, "Too many failed attempts. Please wait a few minutes and try again.")
    with db.engine().connect() as conn:
        row = conn.execute(select(db.users).where(db.users.c.username == username)).first()
    user = db.row_dict(row)
    ok = security.verify_password(password, user and user["password_hash"], user and user["salt"])
    if not ok or user is None or user["is_guest"]:
        security.limiter.hit(ukey)
        security.limiter.hit(ikey)
        raise HTTPException(401, "Wrong username or password.")
    if user["status"] == "pending":
        raise HTTPException(403, "Your account is waiting for approval by the organisers.")
    if user["status"] != "approved":
        raise HTTPException(403, "Your registration was not approved. Please contact the organisers.")
    security.limiter.reset(ukey)
    with db.engine().begin() as conn:
        token = security.create_session(conn, user["id"])
    return {"token": token, "user": security.user_public(user)}


@router.post("/auth/guest")
def guest(request: Request, payload: dict = Body(default=None)):
    ip = security.client_ip(request)
    if security.limiter.blocked(f"guest:{ip}", GUEST_PER_IP, 600):
        raise HTTPException(429, "Too many guest accounts from this network. Please try again later.")
    security.limiter.hit(f"guest:{ip}")
    now = clock.now()
    with db.engine().begin() as conn:
        for _ in range(5):
            tag = secrets.token_hex(4)
            try:
                with conn.begin_nested():
                    res = conn.execute(
                        db.users.insert().values(
                            username=f"guest_{tag}",
                            display_name=f"Guest {tag[:4].upper()}",
                            college="",
                            course="",
                            role="player",
                            status="approved",
                            is_guest=True,
                            is_adult=True,
                            created_at=now,
                        )
                    )
                break
            except IntegrityError:
                continue
        else:
            raise HTTPException(503, "Could not create a guest account. Please try again.")
        uid = res.inserted_primary_key[0]
        user = db.row_dict(conn.execute(select(db.users).where(db.users.c.id == uid)).first())
        token = security.create_session(conn, uid)
    return {"token": token, "user": security.user_public(user)}


@router.post("/auth/logout")
def logout(request: Request):
    token = security.bearer_token(request)
    if token:
        with db.engine().begin() as conn:
            conn.execute(delete(db.sessions).where(db.sessions.c.token_hash == security.token_hash(token)))
    return {"ok": True}


@router.get("/me")
def me(user: dict = Depends(security.current_user)):
    return security.user_public(user)


@router.delete("/me")
def delete_me(request: Request, payload: dict = Body(default=None), user: dict = Depends(security.current_user)):
    p = as_dict(payload)
    if not user["is_guest"]:
        password = p.get("password")
        if not isinstance(password, str) or not password:
            raise HTTPException(422, "Please enter your password to delete your account.")
        ip = security.client_ip(request)
        key = f"delete:{ip}:{user['id']}"
        if security.limiter.blocked(key, LOGIN_FAILS_PER_USER, LOGIN_WINDOW):
            raise HTTPException(429, "Too many failed attempts. Please wait a few minutes and try again.")
        if not security.verify_password(password, user["password_hash"], user["salt"]):
            security.limiter.hit(key)
            raise HTTPException(401, "Wrong password.")
    with db.engine().begin() as conn:
        services.erase_user(conn, user["id"])
    return {"ok": True}
