import os
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("SECRET_KEY", "test-secret")
    monkeypatch.setenv("ADMIN_USERNAME", "admin")
    monkeypatch.setenv("ADMIN_PASSWORD", "adminpass123")
    monkeypatch.setenv("AUTO_APPROVE", "true")
    from app import config, db, security

    config.reset_config()
    db.dispose_engine()
    security.limiter.clear()
    from fastapi.testclient import TestClient

    from app.main import create_app

    with TestClient(create_app()) as c:
        yield c
    db.dispose_engine()
    config.reset_config()


def login(client, username, password):
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["token"]}


def register(client, username, college="MAMC", adult=True, **extra):
    body = {"username": username, "password": "password123", "display_name": username.title(), "college": college,
            "course": "MBBS", "is_adult": adult, "consent": True, **extra}
    return client.post("/api/auth/register", json=body)


def guest(client):
    r = client.post("/api/auth/guest", json={})
    assert r.status_code == 200
    return {"Authorization": "Bearer " + r.json()["token"]}
