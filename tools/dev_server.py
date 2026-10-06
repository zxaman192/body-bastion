"""Run Body Bastion locally: python tools/dev_server.py [--port 8000]

Uses a local SQLite file and, unless ADMIN_USERNAME/ADMIN_PASSWORD are set, a local-only admin
account (admin / localadmin123) so the organiser screens can be tried. Binds to 127.0.0.1 only.
"""
import argparse
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8000")))
    ap.add_argument("--host", default="127.0.0.1")
    args = ap.parse_args()
    os.chdir(ROOT)
    os.environ.setdefault("DATABASE_URL", "sqlite:///./bodybastion-dev.db")
    os.environ.setdefault("SECRET_KEY", "local-development-only-secret")
    if not os.environ.get("ADMIN_USERNAME"):
        os.environ["ADMIN_USERNAME"] = "admin"
        os.environ["ADMIN_PASSWORD"] = "localadmin123"
        print("Local admin account: admin / localadmin123 (development only)")
    import uvicorn

    uvicorn.run("app.main:app", host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
