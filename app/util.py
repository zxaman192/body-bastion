import csv
import io
import re

from fastapi import HTTPException
from fastapi.responses import Response


def bad(detail: str, code: int = 400):
    raise HTTPException(code, detail)


def as_dict(payload) -> dict:
    if payload is None:
        return {}
    if not isinstance(payload, dict):
        bad("The request body must be a JSON object.", 422)
    return payload


def get_str(p: dict, key: str, *, required: bool = True, min_len: int = 0, max_len: int = 200,
            label: str | None = None, default: str | None = None) -> str | None:
    label = label or key.replace("_", " ")
    v = p.get(key)
    if v is None or (isinstance(v, str) and v.strip() == ""):
        if required:
            bad(f"Please fill in {label}.", 422)
        return default
    if not isinstance(v, (str, int)) or isinstance(v, bool):
        bad(f"{label.capitalize()} must be text.", 422)
    v = str(v).strip()
    if len(v) < min_len:
        bad(f"{label.capitalize()} must be at least {min_len} characters.", 422)
    if len(v) > max_len:
        bad(f"{label.capitalize()} must be at most {max_len} characters.", 422)
    return v


def get_int(p: dict, key: str, *, required: bool = True, lo: int | None = None, hi: int | None = None,
            default: int | None = None, label: str | None = None) -> int | None:
    label = label or key.replace("_", " ")
    v = p.get(key)
    if v is None or v == "":
        if required:
            bad(f"Missing {label}.", 422)
        return default
    if isinstance(v, bool):
        bad(f"{label.capitalize()} must be a whole number.", 422)
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    if isinstance(v, str) and re.fullmatch(r"-?\d{1,12}", v.strip()):
        v = int(v.strip())
    if not isinstance(v, int):
        bad(f"{label.capitalize()} must be a whole number.", 422)
    if lo is not None and v < lo:
        bad(f"{label.capitalize()} must be at least {lo}.", 422)
    if hi is not None and v > hi:
        bad(f"{label.capitalize()} must be at most {hi}.", 422)
    return v


def get_bool(p: dict, key: str, default: bool = False) -> bool:
    v = p.get(key)
    if v is None:
        return default
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return v != 0
    if isinstance(v, str):
        return v.strip().lower() in ("1", "true", "yes", "on")
    return default


def _safe_cell(v):
    if v is None:
        return ""
    if isinstance(v, bool):
        return "yes" if v else "no"
    if isinstance(v, (dict, list)):
        import json

        v = json.dumps(v, separators=(",", ":"), sort_keys=True)
    s = str(v)
    if s and s[0] in "=+-@\t\r" and not re.fullmatch(r"-?\d+(\.\d+)?", s):
        s = "'" + s
    return s


def csv_response(filename: str, header: list[str], rows: list[list]) -> Response:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(header)
    for r in rows:
        w.writerow([_safe_cell(c) for c in r])
    data = "﻿" + buf.getvalue()
    return Response(
        content=data.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"},
    )
