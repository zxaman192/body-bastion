import json
import os

from conftest import guest, login, register

from app import clock, sim

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GD = json.load(open(os.path.join(ROOT, "shared", "gamedata.json"), encoding="utf-8"))


def admin(client):
    return login(client, "admin", "adminpass123")


def play(client, H, body, commands=None, claimed=None, answer=None):
    r = client.post("/api/battle/start", headers=H, json=body)
    assert r.status_code == 200, r.text
    start = r.json()
    setup = start["setup"]
    if answer is not None and start["question"]:
        a = client.post(f"/api/battle/{start['battle_id']}/answer", headers=H, json={"choice": answer})
        assert a.status_code == 200
        setup = a.json()["setup"]
    cmds = commands or []
    if claimed is None:
        claimed = {"hash": sim.simulate(GD, setup, cmds)["hash"]}
    f = client.post(f"/api/battle/{start['battle_id']}/finish", headers=H, json={"commands": cmds, "claimed": claimed})
    return start, f


def test_health_static_and_answer_key_hidden(client):
    assert client.get("/healthz").json() == {"ok": True}
    assert client.get("/").status_code == 200
    assert client.get("/shared/gamedata.json").status_code == 200
    assert client.get("/shared/questions.json").status_code == 404
    assert "DPDP" in client.get("/api/privacy").json()["text"] or client.get("/api/privacy").json()["text"]


def test_registration_rules(client):
    assert register(client, "asha").json()["status"] == "approved"
    assert register(client, "asha").status_code == 409
    r = register(client, "minor1", adult=False)
    assert r.status_code == 422
    r = register(client, "minor1", adult=False, guardian_name="Parent One", guardian_email="parent@example.com")
    assert r.json()["status"] == "pending"
    assert client.post("/api/auth/login", json={"username": "minor1", "password": "password123"}).status_code == 403
    no_consent = client.post("/api/auth/register", json={"username": "x1x", "password": "password123", "display_name": "Xx",
                                                          "college": "MAMC", "is_adult": True, "consent": False})
    assert no_consent.status_code == 422
    H = login(client, "asha", "password123")
    assert client.get("/api/me", headers=H).json()["username"] == "asha"
    assert client.request("DELETE", "/api/me", headers=H, json={"password": "wrong"}).status_code == 401
    assert client.request("DELETE", "/api/me", headers=H, json={"password": "password123"}).json() == {"ok": True}
    assert client.get("/api/me", headers=H).status_code == 401


def test_guest_upgrades_to_account_and_keeps_progress(client):
    H = guest(client)
    r = client.post("/api/base/build", headers=H, json={"site": "A3", "b": "paneth_tower"})
    assert r.status_code == 200
    body = {"username": "ravi", "password": "password123", "display_name": "Ravi", "college": "MAMC",
            "course": "MBBS", "is_adult": True, "consent": True}
    r = client.post("/api/auth/register", headers=H, json=body)
    assert r.status_code == 200 and r.json()["status"] == "approved" and r.json()["upgraded"] is True
    me = client.get("/api/me", headers=H).json()
    assert me["username"] == "ravi" and me["is_guest"] is False
    H2 = login(client, "ravi", "password123")
    assert client.get("/api/state", headers=H2).json()["base"]["layout"]["A3"]["b"] == "paneth_tower"
    # under-18 upgrades wait for approval and the guest session ends
    G = guest(client)
    minor = dict(body, username="kid1", is_adult=False, guardian_name="Parent", guardian_email="p@example.com")
    r = client.post("/api/auth/register", headers=G, json=minor)
    assert r.json()["status"] == "pending" and r.json()["upgraded"] is True
    assert client.get("/api/me", headers=G).status_code == 401


def test_base_editing_and_validation(client):
    H = guest(client)
    s = client.get("/api/state", headers=H).json()
    assert s["base"]["core_level"] == 1 and s["resources"]["atp"] == GD["economy"]["startResources"][0]
    assert client.post("/api/base/build", headers=H, json={"site": "B3", "b": "paneth_tower"}).status_code == 409
    assert client.post("/api/base/build", headers=H, json={"site": "W1", "b": "paneth_tower"}).status_code == 422
    assert client.post("/api/base/build", headers=H, json={"site": "W1", "b": "villi_wall"}).status_code == 422
    r = client.post("/api/base/build", headers=H, json={"site": "A3", "b": "paneth_tower"})
    assert r.status_code == 200 and r.json()["base"]["layout"]["A3"]["b"] == "paneth_tower"
    assert client.post("/api/base/build", headers=H, json={"site": "A4", "b": "paneth_tower"}).status_code == 422
    assert client.post("/api/base/upgrade", headers=H, json={"site": "A3"}).status_code == 409
    r = client.post("/api/base/battery", headers=H, json={"site": "C4", "rx": ["cholera", "shigella"]})
    assert r.json()["base"]["layout"]["C4"]["rx"] == ["cholera", "shigella"]
    assert client.post("/api/base/battery", headers=H, json={"site": "C4", "drug": "ceftriaxone"}).status_code == 422
    assert client.post("/api/base/remove", headers=H, json={"site": "CORE"}).status_code == 409
    assert client.post("/api/research", headers=H, json={"key": "vaccine_rotavirus"}).status_code == 409
    assert client.post("/api/base/policy", headers=H, json={"stopflow_at": 30}).json()["base"]["policy"]["stopflow_at"] == 30


def test_campaign_flow_and_unlocks(client):
    H = guest(client)
    assert client.post("/api/battle/start", headers=H, json={"mode": "campaign", "target": {"level": 2}}).status_code == 403
    cmds = [{"t": 0, "c": "build", "site": "E2", "b": "ors_station"}, {"t": 0, "c": "build", "site": "B4", "b": "iga_cannon"}]
    start, f = play(client, H, {"mode": "campaign", "target": {"level": 1}, "boost": True}, cmds, answer=0)
    body = f.json()
    assert f.status_code == 200 and body["verified"] is True
    assert body["stars_campaign"] == 3 and body["objectives"] == [True, True, True]
    assert "vaccine_rotavirus" in body["unlocked"]["research"]
    s = client.get("/api/state", headers=H).json()
    assert s["campaign"]["1"] == 3
    assert client.post("/api/battle/start", headers=H, json={"mode": "campaign", "target": {"level": 2}}).status_code == 200


def test_multiplayer_vs_bot_and_mismatch_flag(client):
    H = guest(client)
    tok = client.post("/api/battle/find", headers=H).json()["token"]
    army = {"cholera": 8, "shigella": 4}
    cmds = [{"t": i * 6, "c": "deploy", "u": "cholera"} for i in range(8)] + [{"t": 60 + i * 6, "c": "deploy", "u": "shigella"} for i in range(4)]
    start, f = play(client, H, {"mode": "multiplayer", "target": {"token": tok}, "army": army}, cmds, claimed={"hash": 42})
    body = f.json()
    assert body["mismatch"] is True and "mismatch" in body["flags"]
    assert body["rewards"]["atp"] >= 50
    again = client.post(f"/api/battle/{start['battle_id']}/finish", headers=H, json={"commands": []})
    assert again.status_code == 409
    big = {"cholera": 200}
    tok = client.post("/api/battle/find", headers=H).json()["token"]
    assert client.post("/api/battle/start", headers=H, json={"mode": "multiplayer", "target": {"token": tok}, "army": big}).status_code == 422


def test_checkpoint_questions_earn_boosts(client):
    from app.gamedata import questions
    answers = {q["id"]: q["answer"] for q in questions()}
    H = guest(client)
    # practice on a fixed tournament base: free and deterministic
    r = client.post("/api/battle/start", headers=H, json={"mode": "practice", "target": {"base_id": "T1"}})
    assert r.status_code == 200, r.text
    bid, setup = r.json()["battle_id"], r.json()["setup"]
    deploys = [{"t": i * 3, "c": "deploy", "u": "cholera"} for i in range(10)]
    b = sim.Battle(GD, setup)
    b.load_commands(deploys)
    while not b.over and b.cpTick[0] < 0:
        b.step()
    reach = b.cpTick[0]
    assert reach >= 0
    assert client.post(f"/api/battle/{bid}/checkpoint/answer", headers=H, json={"z": 0, "choice": 0}).status_code == 409
    q = client.post(f"/api/battle/{bid}/checkpoint", headers=H, json={"z": 0})
    assert q.status_code == 200
    pub = q.json()["question"]
    assert "answer" not in pub and pub["options"]
    again = client.post(f"/api/battle/{bid}/checkpoint", headers=H, json={"z": 0}).json()["question"]
    assert again["id"] == pub["id"]
    a = client.post(f"/api/battle/{bid}/checkpoint/answer", headers=H, json={"z": 0, "choice": answers[pub["id"]]})
    assert a.status_code == 200 and a.json()["correct"] is True
    assert client.post(f"/api/battle/{bid}/checkpoint/answer", headers=H, json={"z": 0, "choice": 0}).status_code == 409
    # checkpoint 1 is asked but answered wrongly
    q1 = client.post(f"/api/battle/{bid}/checkpoint", headers=H, json={"z": 1}).json()["question"]
    assert q1["id"] != pub["id"]
    wrong = (answers[q1["id"]] + 1) % len(q1["options"])
    assert client.post(f"/api/battle/{bid}/checkpoint/answer", headers=H, json={"z": 1, "choice": wrong}).json()["correct"] is False
    earned = {"t": reach + 1, "c": "boost", "k": "replication", "z": 0}
    forged = {"t": reach + 2, "c": "boost", "k": "quorum_surge", "z": 1}
    honest = sim.simulate(GD, setup, deploys + [earned])
    f = client.post(f"/api/battle/{bid}/finish", headers=H,
                    json={"commands": deploys + [earned, forged], "claimed": {"hash": honest["hash"]}})
    body = f.json()
    assert f.status_code == 200
    assert body["result"]["stats"]["boosters"] == {"replication": 1}
    assert "boost_rejected" in body["flags"] and body["mismatch"] is False
    assert [c["correct"] for c in body["checkpoints"]] == [True, False]


def test_multiplayer_vs_player_updates_defender(client):
    register(client, "defender")
    register(client, "attacker")
    D = login(client, "defender", "password123")
    A = login(client, "attacker", "password123")
    client.get("/api/state", headers=D)
    found = None
    for _ in range(20):
        found = client.post("/api/battle/find", headers=A).json()
        if found["opponent"]["kind"] == "player":
            break
    assert found["opponent"]["kind"] == "player"
    cmds = [{"t": i * 4, "c": "deploy", "u": "cholera"} for i in range(16)]
    start, f = play(client, A, {"mode": "multiplayer", "target": {"token": found["token"]}, "army": {"cholera": 16}}, cmds)
    assert f.status_code == 200
    stars = f.json()["result"]["stars"]
    log = client.get("/api/battles?kind=defences", headers=D).json()["rows"]
    assert len(log) == 1 and log[0]["stars"] == stars
    ds = client.get("/api/state", headers=D).json()
    assert ds["defence"]["total"] == 1
    if stars >= 1:
        assert ds["shield_until"] is not None
    replay = client.get(f"/api/battle/{start['battle_id']}", headers=D).json()
    assert replay["commands"] == cmds


def test_league_single_attempt_and_pacing(client, monkeypatch):
    register(client, "leaguer")
    H = login(client, "leaguer", "password123")
    assert client.post("/api/battle/start", headers=H, json={"mode": "tournament", "target": {"base_id": "T1"}}).status_code == 409
    assert client.post("/api/battle/start", headers=H, json={"mode": "practice", "target": {"base_id": "T1"}}).json()["practice"] is True
    A = admin(client)
    assert client.post("/api/admin/settings", headers=A, json={"league_phase": "league"}).json()["league_phase"] == "league"
    cmds = [{"t": i * 3, "c": "deploy", "u": "shigella"} for i in range(6)]
    start, f = play(client, H, {"mode": "tournament", "target": {"base_id": "T1"}}, cmds)
    body = f.json()
    assert "too_fast" in body["flags"] and body["score"] == 0
    assert client.post("/api/battle/start", headers=H, json={"mode": "tournament", "target": {"base_id": "T1"}}).status_code == 409
    real = clock.now()
    r = client.post("/api/battle/start", headers=H, json={"mode": "tournament", "target": {"base_id": "T2"}})
    bid = r.json()["battle_id"]
    res = sim.simulate(GD, r.json()["setup"], cmds)
    monkeypatch.setattr(clock, "now", lambda: real + res["ticks"] / 10 + 1)
    f = client.post(f"/api/battle/{bid}/finish", headers=H, json={"commands": cmds, "claimed": {"hash": res["hash"]}}).json()
    assert "too_fast" not in f["flags"] and f["score"] == sim.attack_score(GD, res, False)
    lg = client.get("/api/league", headers=H).json()
    assert lg["total"] == f["score"] and lg["rank"] == 1
    assert client.get("/api/leaderboard/league").json()["rows"][0]["value"] == f["score"]


def test_battle_expiry(client, monkeypatch):
    H = guest(client)
    r = client.post("/api/battle/start", headers=H, json={"mode": "practice", "target": {"base_id": "T1"}})
    real = clock.now()
    monkeypatch.setattr(clock, "now", lambda: real + 3600)
    assert client.post(f"/api/battle/{r.json()['battle_id']}/finish", headers=H, json={"commands": []}).status_code == 410


def test_clans_and_clan_war(client):
    for u in ("ra", "rb", "rc"):
        register(client, u + "user")
    Ha = login(client, "rauser", "password123")
    Hb = login(client, "rbuser", "password123")
    Hc = login(client, "rcuser", "password123")
    ca = client.post("/api/clans", headers=Ha, json={"name": "Mucosal Guardians"}).json()
    cb = client.post("/api/clans", headers=Hb, json={"name": "Peyer Patrol"}).json()
    assert client.post("/api/clans", headers=Hc, json={"name": "mucosal  guardians"}).status_code == 409
    assert client.post(f"/api/clans/{ca['id']}/join", headers=Hc).status_code == 200
    detail = client.get(f"/api/clans/{ca['id']}").json()
    assert detail["clan"]["members"] == 2 and "rotavirus" in detail["coverage"]
    A = admin(client)
    war = client.post("/api/admin/clanwar", headers=A, json={"clan_a": ca["id"], "clan_b": cb["id"], "hours": 2}).json()
    assert war["members"] == {"a": 2, "b": 1}
    w = client.get("/api/clanwar", headers=Ha).json()
    assert w["attacks_left"] == 2 and len(w["enemies"]) == 1
    target = w["enemies"][0]["user_id"]
    cmds = [{"t": i * 4, "c": "deploy", "u": "shigella"} for i in range(5)]
    start, f = play(client, Ha, {"mode": "clanwar", "target": {"war_id": war["id"], "user_id": target}, "army": {"shigella": 5}}, cmds)
    assert f.status_code == 200
    assert client.get("/api/clanwar", headers=Ha).json()["attacks_left"] == 1
    assert client.post("/api/clans/leave", headers=Hc).status_code == 409
    ended = client.post(f"/api/admin/clanwar/{war['id']}/end", headers=A).json()
    assert ended["status"] == "ended"


def test_classroom_flow(client):
    A = admin(client)
    s = client.post("/api/classroom", headers=A, json={"mode": "campaign", "ref": "1", "title": "Pharmacology batch"}).json()
    assert s["qr_svg"].startswith("<svg") and s["join_url"].endswith("#/join/" + s["code"])
    j = client.post(f"/api/classroom/{s['code']}/join", json={"group_name": "Team Paneth"}).json()
    G = {"X-Group-Token": j["group_token"]}
    assert client.post(f"/api/classroom/{s['code']}/join", json={"group_name": "team paneth"}).status_code == 409
    assert client.post("/api/battle/start", headers=G, json={"mode": "classroom", "target": {"code": s["code"]}}).status_code == 409
    client.post(f"/api/classroom/{s['code']}/status", headers=A, json={"status": "running"})
    cmds = [{"t": 0, "c": "build", "site": "E2", "b": "ors_station"}]
    start, f = play(client, G, {"mode": "classroom", "target": {"code": s["code"]}}, cmds)
    assert f.status_code == 200 and f.json()["objectives"] is not None
    res = client.get(f"/api/classroom/{s['code']}/results").json()
    assert res["rows"][0]["group"] == "Team Paneth" and res["rows"][0]["attempts"] == 1
    csv = client.get(f"/api/classroom/{s['code']}/export.csv", headers=A)
    assert csv.status_code == 200 and "Team Paneth" in csv.text
    assert client.post("/api/classroom", headers=guest(client), json={"mode": "campaign", "ref": "1"}).status_code == 403


def test_admin_observer_exports_and_purge(client):
    register(client, "minor2", adult=False, guardian_name="Parent", guardian_email="p@example.com")
    A = admin(client)
    pending = client.get("/api/admin/users?status=pending", headers=A).json()["rows"]
    uid = next(u["id"] for u in pending if u["username"] == "minor2")
    assert client.post(f"/api/admin/users/{uid}", headers=A, json={"action": "approve"}).json()["status"] == "approved"
    assert client.post(f"/api/admin/users/{uid}", headers=A, json={"action": "role", "role": "observer"}).json()["role"] == "observer"
    O = login(client, "minor2", "password123")
    H = guest(client)
    start, f = play(client, H, {"mode": "practice", "target": {"base_id": "T1"}}, [], claimed={"hash": 1})
    rows = client.get("/api/observer/battles?flag=mismatch", headers=O).json()["rows"]
    assert rows and rows[0]["id"] == start["battle_id"]
    assert client.post(f"/api/observer/battles/{start['battle_id']}/flag", headers=O, json={"flag": "suspicious", "note": "check"}).json()["review"] == "suspicious"
    assert client.get(f"/api/battle/{start['battle_id']}", headers=O).status_code == 200
    for kind in ("users", "league", "battles", "clanwars", "trials"):
        assert client.get(f"/api/admin/export/{kind}.csv", headers=A).status_code == 200
    assert client.get("/api/admin/awards", headers=A).status_code == 200
    assert client.get("/api/projector").status_code == 200
    assert client.post("/api/admin/purge", headers=A, json={"confirm": "yes"}).status_code == 422
    out = client.post("/api/admin/purge", headers=A, json={"confirm": "DELETE ALL PLAYER DATA"}).json()
    assert out["deleted"]["users"] >= 2
    assert client.get("/api/me", headers=A).status_code == 200


def test_every_predefined_layout_is_valid(client):
    from app import economy

    def check(layout, core):
        errs = economy.validate_layout(GD, layout, core)
        assert not errs, errs

    check(GD["starter"]["layout"], GD["starter"]["coreLevel"])
    for lv in GD["campaign"]:
        check(lv["layout"], lv["coreLevel"])
    for tr in GD["trials"]:
        check(tr["layout"], tr["coreLevel"])
    for tb in GD["tournament"]["bases"]:
        check(tb["layout"], tb["coreLevel"])


def test_secret_key_is_generated_once_and_persisted(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient

    from app import config, db
    from app.main import create_app

    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'secret.db'}")
    monkeypatch.delenv("SECRET_KEY", raising=False)
    keys = []
    for _ in range(2):
        config.reset_config()
        db.dispose_engine()
        with TestClient(create_app()):
            keys.append(config.get_config().secret_key)
    db.dispose_engine()
    config.reset_config()
    assert keys[0] == keys[1] and len(keys[0]) >= 32
