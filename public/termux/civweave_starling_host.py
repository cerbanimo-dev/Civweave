#!/usr/bin/env python3
"""Optional Civweave Starling Termux job host, bound to 127.0.0.1:8767.

Uses the EXISTING paired Companion on 8766 for durable llama.cpp generations,
and its private pairing token. No second model server, arbitrary code execution,
Guild task claims, network scraping, filesystem or payment commands.
Run independently with python civweave_starling_host.py.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

SCHEMA = "civweave.starling-host-job.v1"
SCHEDULE_SCHEMA = "civweave.starling-host-schedule.v1"
ORIGINS = frozenset(("https://civweave-staging.pages.dev", "https://civweave.cc"))
GUILD = re.compile(r"^[A-Za-z0-9:_-]{1,160}$")
JOB = re.compile(r"^[0-9a-f]{32}$")
PERSONAS = ("kami", "aphra", "jae", "anthony", "rosa", "sana", "kit", "farah")
MODELS = ("qwen35-4b-native", "qwen35-2b-native")
TERMINAL = ("completed", "failed", "cancelled", "interrupted")


def checked_job(body):
    if not isinstance(body, dict) or body.get("schema") != SCHEMA or body.get("action") != "draft-only":
        raise ValueError("A draft-only Starling job is required.")
    job_id, guild = body.get("jobId"), body.get("guildId")
    if not isinstance(job_id, str) or not JOB.fullmatch(job_id) or not isinstance(guild, str) or not GUILD.fullmatch(guild):
        raise ValueError("Invalid job or Guild identifier.")
    if body.get("personaId") not in PERSONAS or body.get("model") not in MODELS:
        raise ValueError("Unapproved persona or local model.")
    goal, brief = body.get("intention"), body.get("brief", "")
    if not isinstance(goal, str) or not 12 <= len(goal.strip()) <= 3000 or not isinstance(brief, str) or len(brief) > 1200:
        raise ValueError("Invalid or oversized Guild intention or task brief.")
    tokens = body.get("maxTokens", 440)
    if type(tokens) is not int or not 64 <= tokens <= 1000:
        raise ValueError("Token limit out of bounds.")
    return {"schema": SCHEMA, "jobId": job_id, "guildId": guild, "personaId": body["personaId"],
            "model": body["model"], "intention": goal.strip(), "brief": brief.strip(),
            "maxTokens": tokens, "action": "draft-only"}


def checked_schedule(body):
    if not isinstance(body, dict) or body.get("schema") != SCHEDULE_SCHEMA:
        raise ValueError("Invalid scheduler envelope.")
    guild, enabled = body.get("guildId"), body.get("enabled")
    if not isinstance(guild, str) or not GUILD.fullmatch(guild) or type(enabled) is not bool:
        raise ValueError("Valid Guild and explicit enabled status required.")
    if not enabled:
        return {"schema": SCHEDULE_SCHEMA, "guildId": guild, "enabled": False}
    intent, model = body.get("intention"), body.get("model")
    interval, daily = body.get("intervalMinutes", 60), body.get("dailyLimit", 4)
    if (not isinstance(intent, str) or not 12 <= len(intent.strip()) <= 3000
            or model not in MODELS or type(interval) is not int or not 15 <= interval <= 1440
            or type(daily) is not int or not 1 <= daily <= 12 or body.get("action") != "draft-only"):
        raise ValueError("A bounded local-only Guild scheduler policy is required.")
    return {"schema": SCHEDULE_SCHEMA, "guildId": guild, "enabled": True, "intention": intent.strip(),
            "model": model, "intervalMinutes": interval, "dailyLimit": daily, "action": "draft-only"}


def companion_http(token, method, path, body=None):
    if not (path == "/v1/generations" or re.fullmatch(r"/v1/generations/[0-9a-f]{32}(?:/cancel)?", path)):
        raise ValueError("Unapproved Companion path.")
    data = json.dumps(body, separators=(",", ":")).encode() if body is not None else None
    req = urllib.request.Request("http://127.0.0.1:8766" + path, data=data, method=method,
        headers={"X-Civweave-Token": token, **({"Content-Type": "application/json"} if data else {})})
    with urllib.request.urlopen(req, timeout=15) as response:
        return json.load(response)


def atomically_save(path, value):
    temp = path.parent / ("." + path.name + "." + secrets.token_hex(4))
    fd = os.open(str(temp), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(value, stream, separators=(",", ":"), ensure_ascii=False)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, path)
        os.chmod(path, 0o600)
    finally:
        temp.unlink(missing_ok=True)


class StarlingHost:
    def __init__(self, home=None, companion_request=None, clock=time.time):
        self.home = Path(home or os.environ["HOME"]).expanduser().resolve()
        self.root = self.home / ".civweave-companion"
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(self.root, 0o700)
        self.tokenfile = self.root / "pairing-token"
        if not self.tokenfile.is_file() or self.tokenfile.is_symlink():
            raise RuntimeError("Run and pair the existing Civweave Termux Companion first.")
        self.token = self.tokenfile.read_text().strip()
        if not re.fullmatch(r"[0-9a-f]{64}", self.token):
            raise RuntimeError("Companion pairing token is invalid.")
        self.path = self.root / "starling-host-v1.json"
        self.lock = threading.RLock()
        self.clock = clock
        self.companion = companion_request or (lambda method, path, body=None: companion_http(self.token, method, path, body))
        self.stop_event = threading.Event()
        self.jobs = {}
        self.schedules = {}
        if self.path.exists():
            if self.path.is_symlink():
                raise RuntimeError("Refusing symlinked host journal.")
            saved = json.loads(self.path.read_text(encoding="utf-8"))
            if saved.get("version") != 1 or not isinstance(saved.get("jobs"), dict) or not isinstance(saved.get("schedules"), dict):
                raise RuntimeError("Unrecognized journal; refusing to discard it.")
            self.jobs = saved["jobs"]
            self.schedules = saved["schedules"]
            for job in self.jobs.values():
                if job["state"] in ("queued", "running"):
                    job["state"] = "interrupted"
                    job["error"] = "Host restarted during this request. Review before submitting another job."
                    self._pause_for_failure(job.get("guildId"))
            self._save()

    def _save(self):
        atomically_save(self.path, {"version": 1, "jobs": self.jobs, "schedules": self.schedules})

    def _pause_for_failure(self, guild):
        if guild in self.schedules:
            self.schedules[guild]["paused"] = True

    def status(self):
        with self.lock:
            return {"schema": "civweave.starling-host-status.v1", "backend": "termux",
                    "mode": "local-only", "online": True, "jobs": len(self.jobs),
                    "running": any(j["state"] in ("queued", "running") for j in self.jobs.values()),
                    "schedules": [{k: v for k, v in p.items() if k not in ("intention",)}
                                  for p in self.schedules.values()],
                    "capabilities": ["draft-only", "durable-local-inference", "scheduled-offers"],
                    "taskClaims": False, "toolExecution": False}

    def submit(self, body):
        proposal = checked_job(body)
        with self.lock:
            jid = proposal["jobId"]
            existing = self.jobs.get(jid)
            if existing:
                existing_hash = existing["requestHash"]
                if existing_hash != self._digest(proposal):
                    raise RuntimeError("Idempotency key reused for a different request.")
                return self.public(existing)
            if any(job["state"] in ("queued", "running") for job in self.jobs.values()):
                raise RuntimeError("Another local generation is active.")
            if len(self.jobs) >= 200:
                raise RuntimeError("Host journal is full. Export or prune reviewed history manually.")
            ts = self.clock()
            record = {**proposal, "requestHash": self._digest(proposal), "state": "queued",
                      "createdAt": ts, "updatedAt": ts, "text": "", "error": "",
                      "companionId": "", "reviewRequired": True, "claimVerified": False}
            self.jobs[jid] = record
            self._save()
            return self.public(record)

    @staticmethod
    def _digest(value):
        return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

    @staticmethod
    def public(job):
        return {"schema": SCHEMA, "jobId": job["jobId"], "guildId": job["guildId"],
                "personaId": job["personaId"], "state": job["state"],
                "text": job.get("text", "")[:6000], "error": job.get("error", "")[:300],
                "createdAt": job["createdAt"], "updatedAt": job["updatedAt"],
                "reviewRequired": True, "claimVerified": False, "backend": "termux"}

    def list_jobs(self):
        with self.lock:
            jobs = sorted(self.jobs.values(), key=lambda x: x.get('createdAt', 0), reverse=True)
            return {'schema': 'civweave.starling-host-job-list.v1', 'jobs': [self.public(j) for j in jobs[:30]]}

    def get_job(self, jid):
        if not JOB.fullmatch(jid):
            raise ValueError("Invalid job ID.")
        with self.lock:
            if jid not in self.jobs:
                raise LookupError("Job not found.")
            return self.public(self.jobs[jid])

    def cancel(self, jid):
        with self.lock:
            if jid not in self.jobs:
                raise LookupError("Job not found.")
            job = self.jobs[jid]
            if job["state"] == "queued":
                job["state"] = "cancelled"
            elif job["state"] == "running":
                job["cancelRequested"] = True
                if job["companionId"]:
                    self.companion("POST", "/v1/generations/" + job["companionId"] + "/cancel")
            job["updatedAt"] = self.clock()
            self._save()
            return self.public(job)

    def configure(self, body):
        policy = checked_schedule(body)
        with self.lock:
            guild = policy["guildId"]
            if not policy["enabled"]:
                self.schedules.pop(guild, None)
            else:
                prior = self.schedules.get(guild, {})
                policy.update({"paused": False, "lastAttempt": prior.get("lastAttempt", 0),
                               "dayKey": prior.get("dayKey", ""), "usedToday": prior.get("usedToday", 0),
                               "nextAt": self.clock()})
                self.schedules[guild] = policy
            self._save()
            return {"schema": SCHEDULE_SCHEMA, "guildId": guild, "enabled": bool(policy["enabled"]),
                    "mode": "local-only", "reviewRequired": True}

    def _select_scheduled(self):
        with self.lock:
            if any(j["state"] in ("queued", "running") for j in self.jobs.values()):
                return
            for guild, schedule in sorted(self.schedules.items()):
                if not schedule["enabled"] or schedule["paused"] or schedule["nextAt"] > self.clock():
                    continue
                day = time.strftime("%Y-%m-%d", time.gmtime(self.clock()))
                if schedule["dayKey"] != day:
                    schedule["dayKey"], schedule["usedToday"] = day, 0
                if schedule["usedToday"] >= schedule["dailyLimit"]:
                    continue
                idx = schedule["usedToday"] % len(PERSONAS)
                job = checked_job({"schema": SCHEMA, "jobId": secrets.token_hex(16), "guildId": guild,
                                  "personaId": PERSONAS[idx], "model": schedule["model"], "intention": schedule["intention"],
                                  "brief": "Draft one reviewable, nonbinding action aligned with the Guild Intention.",
                                  "maxTokens": 440, "action": "draft-only"})
                schedule["lastAttempt"] = self.clock()
                schedule["nextAt"] = self.clock() + schedule["intervalMinutes"] * 60
                schedule["usedToday"] += 1
                self.submit(job)
                break

    def tick(self):
        self._select_scheduled()
        with self.lock:
            pending = next((j for j in self.jobs.values() if j["state"] == "queued"), None)
            if not pending:
                return
            pending["state"], pending["updatedAt"] = "running", self.clock()
            self._save()
            job_id = pending["jobId"]
            system = ("You are " + pending["personaId"] + " in the fictional Civweave Starling Collective. "
                "Guild Intention: " + pending["intention"] + ". "
                "Produce a concise, reviewable draft only. No web research, tool access, task claims, "
                "Guild governance votes, spending, fabricated evidence, or assertion of completed work.")
            prompt = pending["brief"] or "Provide one useful, testable next step."
            submission = {"model": pending["model"], "messages": [
                {"role": "system", "content": system}, {"role": "user", "content": prompt}],
                "max_tokens": pending["maxTokens"], "temperature": 0.2, "client_key": job_id}
        try:
            accepted = self.companion("POST", "/v1/generations", submission)
            gid = accepted["job_id"]
            if not re.fullmatch(r"[0-9a-f]{32}", gid):
                raise RuntimeError("Companion returned an invalid generation identifier.")
            with self.lock:
                pending["companionId"] = gid
                self._save()
            while not self.stop_event.is_set():
                result = self.companion("GET", "/v1/generations/" + gid)
                if result.get("state") in TERMINAL:
                    with self.lock:
                        pending["state"] = result["state"]
                        pending["text"] = str(result.get("text") or "")[:6000]
                        pending["error"] = str(result.get("error") or "")[:300]
                        pending["updatedAt"] = self.clock()
                        if pending["state"] != "completed":
                            self._pause_for_failure(pending["guildId"])
                        self._save()
                    return
                if pending.get("cancelRequested"):
                    self.companion("POST", "/v1/generations/" + gid + "/cancel")
                self.stop_event.wait(1.5)
            # Shutdown leaves an interrupted receipt for review after restart.
        except Exception as error:
            with self.lock:
                pending["state"], pending["error"] = "failed", str(error)[:300]
                pending["updatedAt"] = self.clock()
                self._pause_for_failure(pending["guildId"])
                self._save()

    def serve_loop(self):
        while not self.stop_event.is_set():
            self.tick()
            self.stop_event.wait(3)

    def stop(self):
        self.stop_event.set()


def make_handler(host):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            return

        def allowed(self):
            origin = self.headers.get("Origin")
            authority = self.headers.get("Host", "")
            return authority in ("127.0.0.1:8767", "localhost:8767") and (not origin or origin in ORIGINS)

        def reply(self, code, data):
            raw = json.dumps(data, separators=(",", ":")).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            if self.headers.get("Origin") in ORIGINS:
                self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin"))
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Civweave-Token")
                self.send_header("Vary", "Origin")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def authorized(self):
            if not self.allowed():
                self.reply(403, {"error": "Origin or host denied."})
                return False
            if not hmac.compare_digest(self.headers.get("X-Civweave-Token", ""), host.token):
                self.reply(401, {"error": "Termux pairing required."})
                return False
            return True

        def do_OPTIONS(self):
            if not self.allowed() or self.headers.get("Origin") not in ORIGINS:
                return self.reply(403, {"error": "Origin denied."})
            self.reply(204, {})

        def do_GET(self):
            if not self.authorized():
                return
            try:
                if self.path == "/v1/starling/status":
                    return self.reply(200, host.status())
                if self.path == "/v1/starling/jobs":
                    return self.reply(200, host.list_jobs())
                match = re.fullmatch(r"/v1/starling/jobs/([0-9a-f]{32})", self.path)
                if match:
                    return self.reply(200, host.get_job(match.group(1)))
                self.reply(404, {"error": "Unknown operation."})
            except LookupError as error:
                self.reply(404, {"error": str(error)})

        def do_POST(self):
            if not self.authorized():
                return
            path = self.path
            if path not in ("/v1/starling/jobs", "/v1/starling/schedule") and not re.fullmatch(r"/v1/starling/jobs/[0-9a-f]{32}/cancel", path):
                return self.reply(404, {"error": "Unknown operation."})
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if size <= 0 or size > 8192:
                    raise ValueError("Expected bounded JSON request.")
                data = json.loads(self.rfile.read(size))
                if path == "/v1/starling/jobs":
                    return self.reply(202, host.submit(data))
                if path == "/v1/starling/schedule":
                    return self.reply(200, host.configure(data))
                jid = path.split("/")[4]
                return self.reply(200, host.cancel(jid))
            except (TypeError, ValueError, json.JSONDecodeError) as error:
                self.reply(400, {"error": str(error)[:200]})
            except LookupError as error:
                self.reply(404, {"error": str(error)[:200]})
            except RuntimeError as error:
                self.reply(409, {"error": str(error)[:200]})
    return Handler


def main():
    host = StarlingHost()
    server = ThreadingHTTPServer(("127.0.0.1", 8767), make_handler(host))
    loop = threading.Thread(target=host.serve_loop, name="starling-termux-local-worker", daemon=True)
    loop.start()
    print("Starling local job host: http://127.0.0.1:8767 (existing Companion pairing token).", flush=True)
    print("Termux must remain running; Android may suspend this process. No Guild claims or external tool execution.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        host.stop()
        server.server_close()
        loop.join(timeout=2)


if __name__ == "__main__":
    main()
