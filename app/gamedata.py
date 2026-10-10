import json
import logging
import os
import secrets
import threading

from app.config import get_config

log = logging.getLogger("bodybastion")

_lock = threading.Lock()
_files: dict[str, tuple] = {}
_index_cache: dict[int, "Index"] = {}


def _load(name: str, required: bool):
    path = os.path.join(str(get_config().shared_dir), name)
    try:
        st = os.stat(path)
    except FileNotFoundError:
        if required:
            raise
        return None
    sig = (st.st_mtime_ns, st.st_size)
    cached = _files.get(path)
    if cached and cached[0] == sig:
        return cached[1]
    with _lock:
        cached = _files.get(path)
        if cached and cached[0] == sig:
            return cached[1]
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, ValueError) as exc:
            if required and not cached:
                raise
            log.error("Could not read %s: %s", path, exc)
            return cached[1] if cached else None
        _files[path] = (sig, data)
        return data


def get_gd() -> dict:
    return _load("gamedata.json", required=True)


def clear_cache() -> None:
    with _lock:
        _files.clear()
        _index_cache.clear()


class Index:
    def __init__(self, gd: dict):
        self.gd = gd
        self.units = {u["key"]: u for u in gd["units"]}
        self.buildings = {b["key"]: b for b in gd["buildings"]}
        self.drugs = {d["key"]: d for d in gd["drugs"]}
        self.sites = {s["id"]: s for s in gd["map"]["sites"]}
        self.site_order = [s["id"] for s in gd["map"]["sites"]]
        self.research = {r["key"]: r for r in gd["research"]}
        self.campaign = {int(c["id"]): c for c in gd["campaign"]}
        self.trials = {t["id"]: t for t in gd.get("trials", [])}
        self.tbases = {b["id"]: b for b in gd["tournament"]["bases"]}
        self.bots = {b["id"]: b for b in gd.get("bots", [])}
        self.spells = {s["key"]: s for s in gd["spells"]}
        self.vaccine_research = {r["germ"]: r["key"] for r in gd["research"] if r.get("kind") == "vaccine"}


def index_of(gd: dict) -> Index:
    key = id(gd)
    ix = _index_cache.get(key)
    if ix is None or ix.gd is not gd:
        ix = Index(gd)
        if len(_index_cache) > 4:
            _index_cache.clear()
        _index_cache[key] = ix
    return ix


def idx() -> Index:
    return index_of(get_gd())


def _option_text(opt) -> str:
    if isinstance(opt, dict):
        for k in ("text", "label", "option", "value"):
            if isinstance(opt.get(k), str):
                return opt[k]
        return ""
    return str(opt)


def _normalize_question(raw, fallback_id: str) -> dict | None:
    if not isinstance(raw, dict):
        return None
    text = None
    for k in ("q", "question", "text", "stem", "prompt"):
        if isinstance(raw.get(k), str) and raw[k].strip():
            text = raw[k].strip()
            break
    options = None
    for k in ("options", "choices", "answers"):
        if isinstance(raw.get(k), list) and len(raw[k]) >= 2:
            options = [_option_text(o) for o in raw[k]]
            break
    if not text or not options:
        return None
    answer = None
    for k in ("answer", "correct", "answerIndex", "answer_index", "correctIndex", "correct_index", "key"):
        if k in raw and raw[k] is not None:
            answer = raw[k]
            break
    if answer is None and isinstance(raw.get("options"), list):
        for i, o in enumerate(raw["options"]):
            if isinstance(o, dict) and o.get("correct"):
                answer = i
                break
    idx_answer = None
    if isinstance(answer, bool):
        idx_answer = None
    elif isinstance(answer, int):
        idx_answer = answer
    elif isinstance(answer, str):
        a = answer.strip()
        if len(a) == 1 and a.upper() in "ABCDEFGH":
            idx_answer = "ABCDEFGH".index(a.upper())
        elif a.isdigit():
            idx_answer = int(a)
        else:
            for i, o in enumerate(options):
                if o.strip().lower() == a.lower():
                    idx_answer = i
                    break
    if idx_answer is None or not (0 <= idx_answer < len(options)):
        return None
    explanation = ""
    for k in ("explanation", "why", "explain", "rationale", "feedback"):
        if isinstance(raw.get(k), str):
            explanation = raw[k]
            break
    germ = None
    for k in ("germ", "unit", "topic"):
        if isinstance(raw.get(k), str):
            germ = raw[k]
            break
    tags = raw.get("tags") if isinstance(raw.get("tags"), list) else []
    return {
        "id": str(raw.get("id", fallback_id)),
        "text": text,
        "options": options,
        "answer": idx_answer,
        "explanation": explanation,
        "germ": germ,
        "tags": [str(t) for t in tags],
    }


_q_cache: dict = {"src": None, "list": []}


def questions() -> list[dict]:
    raw = _load("questions.json", required=False)
    if raw is None:
        return []
    if _q_cache["src"] is raw:
        return _q_cache["list"]
    items = raw
    if isinstance(raw, dict):
        if isinstance(raw.get("questions"), list):
            items = raw["questions"]
        else:
            items = []
            for k, v in raw.items():
                if isinstance(v, dict):
                    items.append({"id": k, **v})
    out = []
    if isinstance(items, list):
        for i, q in enumerate(items):
            nq = _normalize_question(q, f"q{i + 1}")
            if nq:
                out.append(nq)
    _q_cache["src"] = raw
    _q_cache["list"] = out
    return out


def fixed_index(ident: str, n: int) -> int:
    return (sum(ord(ch) for ch in ident) * 7) % n


def pick_question(kind: str, ident: str, germ: str | None = None) -> dict | None:
    qs = questions()
    if not qs:
        return None
    if kind == "fixed":
        return qs[fixed_index(ident, len(qs))]
    pool = qs
    if germ:
        matching = [q for q in qs if q.get("germ") == germ or germ in q.get("tags", [])]
        if matching:
            pool = matching
    if kind == "fixed_germ":
        return pool[fixed_index(ident, len(pool))]
    return pool[secrets.randbelow(len(pool))]


def pick_checkpoint_question(topics: list, ident: str, exclude: set, fixed: bool) -> dict | None:
    """A question about germs typical of the gut part just reached, not already asked in this battle."""
    qs = questions()
    if not qs:
        return None
    fresh = [q for q in qs if q["id"] not in exclude]
    pool = [q for q in fresh if q.get("germ") in topics or any(t in topics for t in q.get("tags", []))]
    pool = pool or fresh or qs
    if fixed:
        return pool[fixed_index(ident, len(pool))]
    return pool[secrets.randbelow(len(pool))]


def public_question(q: dict, seconds: int) -> dict:
    return {
        "id": q["id"],
        "text": q["text"],
        "q": q["text"],
        "options": list(q["options"]),
        "seconds": seconds,
    }


def cards() -> dict:
    raw = _load("cards.json", required=False)
    if raw is None:
        return {}
    items = raw
    if isinstance(raw, dict) and isinstance(raw.get("cards"), list):
        items = raw["cards"]
    out = {}
    if isinstance(items, list):
        for c in items:
            if isinstance(c, dict) and isinstance(c.get("key"), str):
                out[c["key"]] = c
    elif isinstance(items, dict):
        for k, v in items.items():
            out[k] = v
    return out


def guide():
    return _load("guide.json", required=False)
