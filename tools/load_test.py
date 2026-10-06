"""Load test: N simulated guests each play a campaign case and a tournament practice battle.

Usage: python tools/load_test.py --base http://localhost:8000 --players 50 --concurrency 20
Needs httpx (pip install -r requirements-dev.txt). Battles are re-simulated by the server, so this
measures the real cost of verification on your hosting plan.
"""
import argparse
import asyncio
import json
import os
import statistics
import sys
import time

import httpx

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from app import sim  # noqa: E402

GD = json.load(open(os.path.join(ROOT, "shared", "gamedata.json"), encoding="utf-8"))
timings: dict[str, list[float]] = {}
errors: list[str] = []


async def call(client, name, method, url, **kw):
    t0 = time.perf_counter()
    r = await client.request(method, url, **kw)
    timings.setdefault(name, []).append(time.perf_counter() - t0)
    if r.status_code >= 400:
        errors.append(f"{name} {r.status_code} {r.text[:120]}")
        return None
    return r.json()


async def battle(client, H, body, commands):
    start = await call(client, "start", "POST", "/api/battle/start", headers=H, json=body)
    if not start:
        return
    res = sim.simulate(GD, start["setup"], commands)
    await call(client, "finish", "POST", f"/api/battle/{start['battle_id']}/finish", headers=H,
               json={"commands": commands, "claimed": {"hash": res["hash"]}})


async def player(base, sem):
    async with sem:
        async with httpx.AsyncClient(base_url=base, timeout=60) as client:
            g = await call(client, "guest", "POST", "/api/auth/guest", json={})
            if not g:
                return
            H = {"Authorization": "Bearer " + g["token"]}
            await call(client, "state", "GET", "/api/state", headers=H)
            await battle(client, H, {"mode": "campaign", "target": {"level": 1}},
                         [{"t": 0, "c": "build", "site": "E2", "b": "ors_station"}])
            army = GD["tournament"]["army"]
            cmds = []
            t = 0
            for u, n in army.items():
                for _ in range(n):
                    cmds.append({"t": t, "c": "deploy", "u": u})
                    t += 4
            await battle(client, H, {"mode": "practice", "target": {"base_id": "T3"}}, cmds)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000")
    ap.add_argument("--players", type=int, default=30)
    ap.add_argument("--concurrency", type=int, default=15)
    a = ap.parse_args()
    sem = asyncio.Semaphore(a.concurrency)
    t0 = time.perf_counter()
    await asyncio.gather(*(player(a.base, sem) for _ in range(a.players)))
    print(f"{a.players} players in {time.perf_counter() - t0:.1f}s, {len(errors)} errors")
    for name, xs in timings.items():
        xs.sort()
        p95 = xs[min(len(xs) - 1, int(len(xs) * 0.95))]
        print(f"{name:<7} n={len(xs):<4} median={statistics.median(xs) * 1000:7.0f} ms  p95={p95 * 1000:7.0f} ms  max={xs[-1] * 1000:7.0f} ms")
    for e in errors[:10]:
        print("ERROR", e)


if __name__ == "__main__":
    asyncio.run(main())
