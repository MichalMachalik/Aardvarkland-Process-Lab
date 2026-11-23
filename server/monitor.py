import json
import os
import sqlite3
from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


RUN_ID = "RUN-DEMO-17"
DB = Path(os.environ.get("TRACE_DB", "artifacts/runs.sqlite"))


def result(db):
    events = [{"attempt": attempt, "status": status, "code": code} for attempt, status, code in
              db.execute("SELECT attempt, status, code FROM attempts ORDER BY attempt")]
    return {"id": RUN_ID, "status": events[-1]["status"] if events else "new", "events": events}


def prepare_database(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(path)) as db:
        db.execute("CREATE TABLE IF NOT EXISTS attempts (attempt INTEGER PRIMARY KEY, status TEXT NOT NULL, code TEXT NOT NULL)")


def attempt(path, available):
    with closing(sqlite3.connect(path, timeout=5)) as db, db:
        db.execute("BEGIN IMMEDIATE")
        previous = result(db)
        if previous["status"] == "completed":
            return previous, False
        status = "completed" if available else "failed"
        code = "PROVIDER_OK" if available else "PROVIDER_UNAVAILABLE"
        db.execute("INSERT INTO attempts VALUES (?, ?, ?)", (len(previous["events"]) + 1, status, code))
        return result(db), True


class Handler(BaseHTTPRequestHandler):
    def reply(self, status, body):
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if self.path == "/health":
            return self.reply(200, {"status": "ok"})
        if self.path != "/api/run":
            return self.reply(404, {"error": "Route not found"})
        with closing(sqlite3.connect(DB)) as db:
            return self.reply(200, result(db))

    def do_POST(self):
        if self.path != "/api/run":
            return self.reply(404, {"error": "Route not found"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 1024:
                raise ValueError()
            values = json.loads(self.rfile.read(length))
            if not isinstance(values, dict) or type(values.get("available")) is not bool:
                raise ValueError()
        except (ValueError, UnicodeError):
            return self.reply(400, {"error": "Send JSON with a boolean available field."})
        try:
            updated, changed = attempt(DB, values["available"])
        except sqlite3.OperationalError:
            return self.reply(503, {"error": "Run storage could not be updated."})
        if changed:
            print(json.dumps({"run": RUN_ID, **updated["events"][-1]}), flush=True)
        return self.reply(200, updated)

    def log_message(self, *_args):
        pass


if __name__ == "__main__":
    prepare_database(DB)
    host = os.environ.get("TRACE_HOST", "127.0.0.1")
    port = int(os.environ.get("TRACE_PORT", "4188"))
    with ThreadingHTTPServer((host, port), Handler) as app:
        print(f"Process monitor listening on {app.server_address[0]}:{app.server_port}", flush=True)
        app.serve_forever()
