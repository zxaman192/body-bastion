# Body Bastion

**Defend the gut. Learn the drugs.** A base-building strategy game about gut infections, immunity
and antibiotics for medical and allied-health students (Department of Pharmacology, Maulana Azad
Medical College, New Delhi, with the MAMC Gaming Society).

**Play it:** https://body-bastion.onrender.com (Render free plan, Singapore: the first visit after
15 minutes of inactivity takes about a minute to wake the server). An Android app is built from
[android/](android/README.md).

New players see an opening animation and are offered a one-minute guided tour of the base (replay
it any time with the **?** button); Case 1 has its own coaching tips.

You build and upgrade a gut base (stomach, small intestine, colon, liver gate, Bone Marrow Core) with
real defences (acid, mucus and villi walls, gut flora, Paneth cells, IgA, macrophages, neutrophils,
Kupffer cells, ORS + zinc, IV fluids, prescribed drug batteries) and attack other players' guts with
real enteric germs. The hydration meter makes dehydration, not tower damage, the main way a base
dies; wrong antibiotics waste ATP, breed resistance and can wipe out the flora and summon
C. difficile.

Current version: **1.4.0 "Laparotomy"**. Every release is named and kept: see [CHANGELOG.md](CHANGELOG.md).

| What | Where |
|---|---|
| Plan analysis and the 53 corrections (v1.1 -> v1.2) | [docs/ANALYSIS.md](docs/ANALYSIS.md) |
| Exact rules, simulation algorithm, API | [docs/SPEC.md](docs/SPEC.md) |
| Balance report | [docs/BALANCE.md](docs/BALANCE.md) |
| All rules data (units, buildings, drug matrix, cases, bases) | [shared/gamedata.json](shared/gamedata.json) |
| Knowledge-boost questions, explanation cards, guide text | `shared/questions.json`, `shared/cards.json`, `shared/guide.json` |

## Game modes

- **Case campaign**: 10 clinical cases (rotavirus, ETEC, cholera, Shigella, typhoid, amoebic liver
  abscess, H. pylori, C. difficile, Ascaris, a mixed hostel outbreak). You defend the patient against
  scripted waves; stars reward the correct treatment.
- **Multiplayer**: attack other players' saved bases (or training bases); your base defends itself.
- **League**: 10 identical tournament bases (one scored attempt each) and 3 Defence Trials.
- **Cohort Challenges**: college cohorts, base snapshots, vaccination-based herd immunity.
- **Classroom**: a teacher creates a session with a QR code; groups play on phones without accounts;
  results update live on a projector page.
- **Organiser tools**: approvals (guardian consent for under-18s), league phases, Cohort Challenges, awards
  (Champion, Best Cohort, Best Steward, Best Defender), CSV exports, fair-play review with replays,
  and one-click deletion of all player data after the event (DPDP Act 2023).

## Run it locally

Requires Python 3.12.

```bash
python -m venv .venv
```
```bash
.venv/Scripts/pip install -r requirements-dev.txt
```
```bash
.venv/Scripts/python tools/dev_server.py --port 8000
```

Open http://localhost:8000. The dev server uses a local SQLite file and a local admin account
(`admin` / `localadmin123`, development only). On macOS/Linux use `.venv/bin/` instead of
`.venv/Scripts/`.

## Tests and checks

```bash
.venv/Scripts/python -m pytest -q
```
```bash
.venv/Scripts/python tools/balance.py
```
```bash
.venv/Scripts/python tools/parity_gen.py
```
```bash
node tools/parity_check.mjs
```

The server's Python simulation is authoritative; the browser runs an exact JavaScript mirror
(`static/js/sim.js`). The parity tools replay 1,500+ random battles through both and must report
0 mismatches. Re-run them after changing any number in `shared/gamedata.json`.

## Deploy on Render

The repository contains a Render Blueprint (`render.yaml`): one Python web service and one
PostgreSQL database, both in the Singapore region (closest to India).

1. Put this folder in a Git repository and push it to GitHub (or GitLab/Bitbucket).
2. In the Render dashboard choose **New > Blueprint**, pick the repository, and apply.
3. When asked, set **ADMIN_PASSWORD** (the organiser account is `admin`). `SECRET_KEY` is generated
   automatically and `DATABASE_URL` is wired to the database.
4. Wait for the build (`pip install -r requirements.txt`) and the health check (`/healthz`). Open the
   service URL; log in as `admin` to reach the organiser console.

Environment variables:

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL URL from Render (SQLite is used if unset) |
| `SECRET_KEY` | Signs find-tokens; keep it secret and stable |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Organiser account created or reset at start-up |
| `AUTO_APPROVE` | `true` lets adult registrations in immediately; under-18s always need approval |
| `PUBLIC_BASE_URL` | Optional; the URL used in classroom QR codes (defaults to the request URL) |

**Free-tier limits.** A free Render web service sleeps after 15 minutes without traffic and takes
about a minute to wake up; it has 512 MB RAM and 0.1 CPU. A free Render PostgreSQL database expires
30 days after it is created. That is fine for trying the game. For the league week and the live
final, switch the web service to **Starter or Standard** (always on, more CPU for battle
verification) and the database to a paid plan; run `tools/load_test.py` against the deployed URL
before the event.

**Local-network fallback for the live final.** On a laptop with Docker:

```bash
docker compose up -d
```

Then players on the same Wi-Fi open `http://<laptop-ip>:8000`. Change the passwords in
`docker-compose.yml` first.

## Organiser workflow

1. Before registration opens: set the grievance contact in the privacy notice (`shared/guide.json`,
   key `privacy`), decide `AUTO_APPROVE`, and have faculty review the matrix, questions and cards.
2. Practice week: League phase = *practice* (Admin > League).
3. League round: phase = *league* (one scored attempt per base and per trial).
4. Cohort Challenges: Admin > Cohort Challenges > pair two cohorts (bases and herd immunity are snapshotted).
5. Live final: open `/#/live` on the projector; classroom sessions have their own `/#/projector/CODE`.
6. Awards and exports: Admin > Awards, Admin > Data (CSV).
7. After results are published: Admin > Data > **Delete all player data**.

## Project layout

```
app/            FastAPI server (routes, economy, scoring, security) and app/sim.py (authoritative simulation)
static/         Browser game: index.html, css/, js/ (sim.js mirror, render/, screens/, intro.js, tutorial.js), PWA files
android/        Android app (WebView shell, splash, icons) and build_apk.sh
shared/         gamedata.json (rules), questions.json, cards.json, guide.json
tests/          pytest suites for the simulation and the API
tools/          dev_server.py, balance.py, parity_gen.py, parity_check.mjs, load_test.py
docs/           ANALYSIS.md, SPEC.md, BALANCE.md
```

Everything visual is drawn in code and all sound is synthesised in the browser; there are no
third-party art, sound or font assets. Medical content is simplified for the game and is not
clinical advice.
