import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from starlette.requests import Request

from app import db, services
from app.config import get_config
from app.gamedata import get_gd
from app.routes import admin, auth, battle, clans, classroom, game, league, privacy

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

BLOCKED_SHARED = {"questions.json"}


class SharedFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        if path.strip("/").lower() in BLOCKED_SHARED:
            raise HTTPException(404, "Not found.")
        return await super().get_response(path, scope)


def _ensure_secret(conn) -> None:
    cfg = get_config()
    if not cfg.secret_generated:
        return
    row = conn.execute(select(db.settings.c.value).where(db.settings.c.key == "secret_key")).first()
    if row is not None and isinstance(row.value, str) and len(row.value) >= 32:
        cfg.secret_key = row.value
    else:
        conn.execute(db.settings.insert().values(key="secret_key", value=cfg.secret_key))
    cfg.secret_generated = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_engine()
    get_gd()
    with db.engine().begin() as conn:
        _ensure_secret(conn)
        services.bootstrap_admin(conn)
        services.cleanup(conn)
    yield
    db.dispose_engine()


def create_app() -> FastAPI:
    cfg = get_config()
    app = FastAPI(title="Body Bastion", version="1.2.0", lifespan=lifespan, docs_url="/api/docs",
                  redoc_url=None, openapi_url="/api/openapi.json")
    app.add_middleware(GZipMiddleware, minimum_size=1024)

    @app.middleware("http")
    async def headers(request: Request, call_next):
        response = await call_next(request)
        h = response.headers
        h.setdefault("X-Content-Type-Options", "nosniff")
        h.setdefault("Referrer-Policy", "same-origin")
        h.setdefault("X-Frame-Options", "SAMEORIGIN")
        path = request.url.path
        if path.startswith("/api/"):
            h.setdefault("Cache-Control", "no-store")
        elif path == "/" or path.endswith((".html", ".js", ".css", ".json", ".webmanifest")):
            h["Cache-Control"] = "no-cache"
        return response

    for r in (auth, privacy, game, battle, league, clans, classroom, admin):
        app.include_router(r.router)

    @app.get("/healthz", include_in_schema=False)
    def healthz():
        return {"ok": True}

    app.mount("/shared", SharedFiles(directory=str(cfg.shared_dir)), name="shared")
    app.mount("/", StaticFiles(directory=str(cfg.static_dir), html=True), name="static")
    return app


app = create_app()
