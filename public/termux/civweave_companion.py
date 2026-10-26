#!/usr/bin/env python3
"""Civweave Termux Companion v1: loopback-only, token-paired fixed operations.

Run explicitly inside Termux with python. This service never accepts shell
commands, arbitrary URLs, arbitrary file paths, or remote network clients.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

SCHEMA = "civweave.termux-companion.v1"
PORT = 8766
ORIGINS = frozenset({
    "https://civweave-staging.pages.dev",
    "https://civweave.cc",
})
MODELS = {
    "qwen35-4b-native": {
        "file": "Qwen3.5-4B-Q4_K_M.gguf",
        "url": "https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q4_K_M.gguf",
        "sha256": "00fe7986ff5f6b463e62455821146049db6f9313603938a70800d1fb69ef11a4",
        "bytes_approx": 2740000000,
    },
    "qwen35-2b-native": {
        "file": "Qwen3.5-2B-Q4_K_M.gguf",
        "url": "https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf",
        "sha256": "aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223",
        "bytes_approx": 1280000000,
    },
}


ALLOWED_CONTEXTS = (1024, 2048, 4096, 8192, 16384, 32768, 65536)
DEFAULT_CONTEXT = 32768


def model_options(body):
    name = body.get("model", "qwen35-4b-native")
    if type(name) is not str or name not in MODELS:
        raise ValueError("Choose one of the two approved Qwen models.")
    raw = body.get("context", DEFAULT_CONTEXT)
    if type(raw) is not int or raw not in ALLOWED_CONTEXTS:
        raise ValueError("Context must be one of the approved sizes: 1024, 2048, 4096, 8192, 16384, 32768, or 65536.")
    return name, raw


def digest_file(path, progress=None):
    sha = hashlib.sha256()
    done = 0
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            sha.update(block)
            done += len(block)
            if progress:
                progress(done)
    return sha.hexdigest()


class Controller:
    def __init__(self, home=None):
        self.home = Path(home or os.environ.get("HOME", "~")).expanduser().resolve()
        self.root = self.home / ".civweave-companion"
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(self.root, 0o700)
        self.model_dir = self.home / "models"
        self.model_dir.mkdir(parents=True, exist_ok=True)
        self.keyfile = self.root / "pairing-token"
        if not self.keyfile.exists():
            fd = os.open(str(self.keyfile), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "w") as f:
                f.write(secrets.token_hex(32) + "\n")
        os.chmod(self.keyfile, 0o600)
        self.token = self.keyfile.read_text().strip()
        self.lock = threading.RLock()
        self.proc = None
        self.job = {"state": "idle", "action": "", "message": "", "progress": None}
        self.model = ""
        self.context = DEFAULT_CONTEXT
        self.generations = {}
        self.generation_root = self.root / 'generations'
        self.generation_root.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(self.generation_root, 0o700)
        self._restore_generations()

    # Browser windows are observers, never the owner of a model request.
    # Job status and partial output are atomically checkpointed on-device.
    def _generation_path(self, job_id):
        if not re.fullmatch(r"[0-9a-f]{32}", str(job_id)):
            raise ValueError("Invalid generation ID.")
        return self.generation_root / (job_id + ".json")

    def _checkpoint_generation(self, job):
        public = {key: value for key, value in job.items() if key != "cancel_requested"}
        path = self._generation_path(job["id"])
        temp = path.with_suffix(".tmp-" + secrets.token_hex(4))
        fd = os.open(str(temp), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as file:
                json.dump(public, file, ensure_ascii=False, separators=(",", ":"))
            os.replace(temp, path)
        finally:
            try:
                temp.unlink(missing_ok=True)
            except OSError:
                pass

    def _restore_generations(self):
        files = sorted(self.generation_root.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
        for path in files[:20]:
            try:
                if not re.fullmatch(r"[0-9a-f]{32}\\.json", path.name):
                    continue
                job = json.loads(path.read_text(encoding="utf-8"))
                if job.get("id") != path.stem:
                    continue
                if job.get("state") in ("queued", "running"):
                    job["state"] = "interrupted"
                    job["error"] = "Companion restarted while inference was active. Partial text is recoverable, but generation must be started again explicitly."
                    job["updated_at"] = time.time()
                    self._checkpoint_generation(job)
                self.generations[job["id"]] = job
            except (OSError, ValueError, TypeError):
                continue
        # Only retain a bounded number of results, no arbitrary filesystem paths.
        for old in files[20:]:
            try:
                old.unlink()
            except OSError:
                pass

    def generation(self, job_id):
        with self.lock:
            job = self.generations.get(job_id)
            if job is None:
                try:
                    job = json.loads(self._generation_path(job_id).read_text(encoding="utf-8"))
                except (OSError, ValueError):
                    raise LookupError("Generation job not found.")
                self.generations[job_id] = job
            return {key: value for key, value in job.items() if key != "cancel_requested"}

    def submit_generation(self, body):
        if type(body) is not dict:
            raise ValueError("Generation requires an object.")
        model = body.get("model")
        if type(model) is not str or model not in MODELS:
            raise ValueError("Unapproved local model.")
        messages = body.get("messages")
        if not isinstance(messages, list) or not (1 <= len(messages) <= 16):
            raise ValueError("Messages must be a bounded array.")
        validated = []
        for message in messages:
            if not isinstance(message, dict) or message.get("role") not in ("system", "user", "assistant"):
                raise ValueError("Unsupported message role.")
            text = message.get("content")
            if type(text) is not str or not text or len(text) > 18000:
                raise ValueError("Invalid or oversized model message.")
            validated.append({"role": message["role"], "content": text})
        if sum(len(item["content"]) for item in validated) > 32000:
            raise ValueError("Model prompt is too large for Companion.")
        max_tokens = body.get("max_tokens", 4096)
        if type(max_tokens) is not int or not (1 <= max_tokens <= 16384):
            raise ValueError("max_tokens must be between 1 and 16384.")
        temperature = body.get("temperature", 0.2)
        if type(temperature) not in (int, float) or not (0 <= temperature <= 1.5):
            raise ValueError("Invalid sampling temperature.")
        client_key = body.get("client_key", "")
        if not isinstance(client_key, str) or not re.fullmatch(r"[0-9a-f]{32}", client_key):
            raise ValueError("A random 32-character idempotency key is required.")
        with self.lock:
            for job in self.generations.values():
                if job.get("client_key") == client_key:
                    return {"accepted": True, "job_id": job["id"], "reused": True}
            if any(job["state"] in ("queued", "running") for job in self.generations.values()):
                raise RuntimeError("Another Companion generation is active. Reconnect to it rather than starting a second job.")
            if not self.server_responding():
                raise RuntimeError("llama-server on 127.0.0.1:8080 is not responding.")
            job_id = secrets.token_hex(16)
            created = time.time()
            job = {"id": job_id, "client_key": client_key, "state": "queued",
                   "model": model, "created_at": created, "updated_at": created,
                   "text": "", "characters": 0, "finish_reason": "", "usage": {},
                   "error": "", "cancel_requested": False}
            self.generations[job_id] = job
            self._checkpoint_generation(job)
            threading.Thread(target=self._run_generation,
                             args=(job_id, model, validated, max_tokens, float(temperature)),
                             daemon=True, name="civweave-generation-" + job_id[:8]).start()
            return {"accepted": True, "job_id": job_id, "reused": False}

    def _run_generation(self, job_id, model, messages, max_tokens, temperature):
        payload = json.dumps({"model": model, "messages": messages,
                              "max_tokens": max_tokens, "temperature": temperature,
                              "stream": True, "stream_options": {"include_usage": True}},
                             separators=(",", ":")).encode("utf-8")
        request = urllib.request.Request(
            "http://127.0.0.1:8080/v1/chat/completions", data=payload, method="POST",
            headers={"Content-Type": "application/json", "Accept": "text/event-stream"})
        with self.lock:
            job = self.generations[job_id]
            job["state"] = "running"
            job["updated_at"] = time.time()
            self._checkpoint_generation(job)
        try:
            last_save = time.monotonic()
            event_parts = []
            completed = False
            with urllib.request.urlopen(request, timeout=1800) as response:
                for line in response:
                    with self.lock:
                        if job.get("cancel_requested"):
                            break
                    line = line.decode("utf-8", errors="replace").strip()
                    if line.startswith("data:"):
                        event_parts.append(line[5:].strip())
                        continue
                    if line or not event_parts:
                        continue
                    data = "\\n".join(event_parts)
                    event_parts = []
                    if data == "[DONE]":
                        completed = True
                        break
                    try:
                        frame = json.loads(data)
                    except ValueError:
                        continue
                    if frame.get("error"):
                        raise RuntimeError(str(frame["error"])[:300])
                    choices = frame.get("choices") or []
                    choice = choices[0] if choices else {}
                    delta = (choice.get("delta") or {}).get("content") or ""
                    if not isinstance(delta, str):
                        delta = ""
                    reason = choice.get("finish_reason")
                    with self.lock:
                        if delta:
                            if len(job["text"]) + len(delta) > 160000:
                                raise RuntimeError("Output exceeded the 160K-character safety limit.")
                            job["text"] += delta
                            job["characters"] = len(job["text"])
                        if reason:
                            job["finish_reason"] = str(reason)[:30]
                        if isinstance(frame.get("usage"), dict):
                            job["usage"] = frame["usage"]
                        job["updated_at"] = time.time()
                        if delta and (time.monotonic() - last_save >= 2 or job["characters"] < 150):
                            self._checkpoint_generation(job)
                            last_save = time.monotonic()
            with self.lock:
                if job.get("cancel_requested"):
                    job["state"] = "cancelled"
                    job["error"] = "Cancelled explicitly by the paired user."
                elif completed or job["finish_reason"]:
                    job["state"] = "completed"
                else:
                    job["state"] = "interrupted"
                    job["error"] = "The llama.cpp stream ended without completion."
                job["updated_at"] = time.time()
                self._checkpoint_generation(job)
        except Exception as exc:
            with self.lock:
                job["state"] = "cancelled" if job.get("cancel_requested") else "failed"
                job["error"] = str(exc)[:350]
                job["updated_at"] = time.time()
                self._checkpoint_generation(job)

    def cancel_generation(self, job_id):
        with self.lock:
            job = self.generations.get(job_id)
            if not job:
                raise LookupError("Generation not found.")
            if job["state"] in ("queued", "running"):
                job["cancel_requested"] = True
                self._checkpoint_generation(job)
            return {"id": job_id, "cancel_requested": bool(job.get("cancel_requested"))}

    def candidate_model_paths(self, name):
        """Fixed, local model directories only; never accept a path from HTTP."""
        filename = MODELS[name]["file"]
        return (
            ("Termux ~/models", self.model_dir / filename),
            ("Android Downloads", self.home / "storage" / "downloads" / filename),
            ("Termux llama.cpp/models", self.home / "llama.cpp" / "models" / filename),
            ("Termux ~/Downloads", self.home / "Downloads" / filename),
        )

    def find_existing_model(self, name):
        for _, candidate in self.candidate_model_paths(name):
            if candidate.is_file() and not candidate.is_symlink():
                return candidate
        return None

    def model_receipt(self, path):
        # Receipts are internal even when the GGUF lives in Android Downloads.
        digest = hashlib.sha256(str(path.resolve()).encode()).hexdigest()[:20]
        return self.root / ("verified-" + digest + ".sha256")

    def is_verified(self, name, path):
        if path is None:
            return False
        markers = (self.model_receipt(path), path.with_name(path.name + ".sha256"))
        for receipt in markers:
            try:
                if (receipt.is_file() and not receipt.is_symlink()
                    and receipt.read_text().strip() == MODELS[name]["sha256"]
                    and receipt.stat().st_mtime_ns >= path.stat().st_mtime_ns):
                    return True
            except OSError:
                continue
        return False

    def server_running(self):
        with self.lock:
            return self.proc is not None and self.proc.poll() is None

    @staticmethod
    def server_responding():
        try:
            with urllib.request.urlopen("http://127.0.0.1:8080/health", timeout=0.8):
                return True
        except urllib.error.HTTPError as e:
            return e.code in (500, 503)
        except (OSError, TimeoutError):
            return False

    def status(self):
        with self.lock:
            job = self.job.copy()
            owned = self.server_running()
            names = {}
            for key, info in MODELS.items():
                model_path = self.find_existing_model(key)
                location = next((label for label, candidate
                                 in self.candidate_model_paths(key)
                                 if model_path is not None and candidate == model_path), "")
                names[key] = {
                    "present": model_path is not None,
                    "verified": self.is_verified(key, model_path),
                    "location": location,
                    "bytes_approx": info["bytes_approx"],
                }
            chosen = self.model
            context = self.context
        reachable = self.server_responding()
        return {
            "schema": SCHEMA, "paired": True, "managed_running": owned,
            "server_reachable": reachable, "unmanaged_running": reachable and not owned,
            "selected_model": chosen, "context": context,
            "llama_installed": bool(shutil.which("llama-server")),
            "models": names, "job": job,
        }

    def update_job(self, **fields):
        with self.lock:
            self.job.update(fields)

    def run_action(self, action, body):
        if type(body) is not dict:
            raise ValueError("JSON object required.")
        if action not in ("setup", "start", "stop", "restart", "download", "verify"):
            raise LookupError("Unknown action.")
        name, context = model_options(body)
        with self.lock:
            if self.job["state"] == "running":
                raise RuntimeError("Another installation or server operation is already in progress.")
            job_id = secrets.token_hex(8)
            self.job = {"id": job_id, "state": "running", "action": action,
                        "message": "Starting " + action, "progress": None}
            threading.Thread(target=self._perform, args=(action, name, context),
                             daemon=True).start()
            return {"accepted": True, "job_id": job_id}

    def _perform(self, action, name, context):
        try:
            if action == "setup":
                self._setup()
            elif action == "download":
                self._download(name)
            elif action == "verify":
                self._verify(name)
            elif action == "start":
                self._start(name, context)
            elif action == "stop":
                self._stop()
            elif action == "restart":
                self._stop()
                self._start(name, context)
            self.update_job(state="success", message=action + " completed",
                            progress=100)
        except Exception as exc:
            self.update_job(state="failed", message=str(exc)[:280], progress=None)

    def _setup(self):
        pkg = shutil.which("pkg")
        if not pkg:
            raise RuntimeError("This companion must run inside Termux (pkg not found).")
        self.update_job(message="Installing llama-cpp from Termux packages")
        with (self.root / "setup.log").open("ab") as log:
            result = subprocess.run([pkg, "install", "-y", "llama-cpp"],
                                    stdin=subprocess.DEVNULL, stdout=log,
                                    stderr=subprocess.STDOUT, timeout=900,
                                    check=False)
        if result.returncode:
            raise RuntimeError("Package setup failed; inspect ~/.civweave-companion/setup.log.")

    def _verify(self, name):
        info = MODELS[name]
        path = self.find_existing_model(name)
        if path is None:
            raise RuntimeError("Model missing in approved Termux or Android Downloads directories.")
        size = path.stat().st_size
        self.update_job(message="Verifying " + info["file"], progress=0)
        actual = digest_file(path, lambda done: self.update_job(progress=min(99, int(100*done/size))))
        if not hmac.compare_digest(actual, info["sha256"]):
            raise RuntimeError("Model SHA-256 differs from the pinned source. Existing file was not changed.")
        self.model_receipt(path).write_text(actual + "\n")
        self.update_job(message="SHA-256 verified", progress=100)

    def _download(self, name):
        info = MODELS[name]
        final = self.model_dir / info["file"]
        if self.find_existing_model(name) is not None or final.exists():
            raise RuntimeError("An existing model is already found. Use Verify; no automatic overwrite.")
        part = self.model_dir / (info["file"] + ".part")
        if part.is_symlink():
            raise RuntimeError("Unsafe partial-download path.")
        offset = part.stat().st_size if part.exists() else 0
        if shutil.disk_usage(self.model_dir).free < max(250000000, info["bytes_approx"] - offset + 200000000):
            raise RuntimeError("Insufficient free storage for this model.")
        headers = {"User-Agent": "Civweave-Termux-Companion/1"}
        if offset:
            headers["Range"] = "bytes=" + str(offset) + "-"
        self.update_job(message="Downloading verified " + info["file"], progress=0)
        request = urllib.request.Request(info["url"], headers=headers)
        with urllib.request.urlopen(request, timeout=90) as response:
            append = offset and response.status == 206
            done = offset if append else 0
            total = max(info["bytes_approx"], done + int(response.headers.get("Content-Length") or 0))
            with part.open("ab" if append else "wb") as stream:
                while True:
                    block = response.read(1024 * 1024)
                    if not block:
                        break
                    stream.write(block)
                    done += len(block)
                    self.update_job(progress=min(99, int(100*done/total)),
                                    message="Downloading " + info["file"])
        self.update_job(message="Checking model SHA-256", progress=99)
        if digest_file(part) != info["sha256"]:
            raise RuntimeError("Downloaded file failed SHA-256 verification; partial file retained for inspection.")
        os.replace(part, final)
        (self.model_dir / (info["file"] + ".sha256")).write_text(info["sha256"] + "\n")

    def _stop(self):
        with self.lock:
            proc = self.proc
        if proc is None or proc.poll() is not None:
            if self.server_responding():
                raise RuntimeError("Port 8080 is occupied by a server started outside Companion. Stop that Termux session with Ctrl+C first.")
            return
        proc.terminate()
        try:
            proc.wait(timeout=12)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)
        with self.lock:
            self.proc = None
        self.update_job(message="Companion-managed server stopped")

    def _start(self, name, context):
        if self.server_running():
            raise RuntimeError("Server already managed and running. Use Restart.")
        if self.server_responding():
            raise RuntimeError("Port 8080 is already occupied. Stop the manually started Termux server before starting Companion.")
        info = MODELS[name]
        model_path = self.find_existing_model(name)
        executable = shutil.which("llama-server")
        if not executable:
            raise RuntimeError("llama-cpp is not installed. Run Setup first.")
        if model_path is None:
            raise RuntimeError("No GGUF found in ~/models, Android Downloads or llama.cpp/models. Use Download if needed.")
        wake_lock = shutil.which("termux-wake-lock")
        if wake_lock:
            subprocess.run([wake_lock], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL, timeout=8, check=False)
        cmd = [executable, "-m", str(model_path), "--alias", name, "--host", "127.0.0.1",
               "--port", "8080", "--ctx-size", str(context), "--threads", "2",
               "--gpu-layers", "0", "--parallel", "1", "--jinja", "--reasoning", "off",
               "--no-webui"]
        log = (self.root / "llama-server.log").open("ab")
        try:
            proc = subprocess.Popen(cmd, stdin=subprocess.DEVNULL,
                                    stdout=log, stderr=subprocess.STDOUT,
                                    start_new_session=True, cwd=str(self.home))
        finally:
            log.close()
        time.sleep(1.2)
        if proc.poll() is not None:
            raise RuntimeError("llama-server exited during startup; inspect ~/.civweave-companion/llama-server.log")
        with self.lock:
            self.proc = proc
            self.model = name
            self.context = context
        self.update_job(message="Model loading in server process")


def make_handler(controller):
    class Handler(BaseHTTPRequestHandler):
        server_version = "CivweaveCompanion/1"
        sys_version = ""

        def log_message(self, *_):
            return

        def allowed(self):
            origin = self.headers.get("Origin")
            host = self.headers.get("Host", "").split(":")[0].lower()
            return (not origin or origin in ORIGINS) and host in ("127.0.0.1", "localhost")

        def headers_json(self, status, origin=None):
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Vary", "Origin")
            if origin in ORIGINS:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Civweave-Token")
                self.send_header("Access-Control-Max-Age", "300")
            self.end_headers()

        def json(self, status, body):
            self.headers_json(status, self.headers.get("Origin"))
            self.wfile.write(json.dumps(body, separators=(",", ":")).encode())

        def guard(self):
            if not self.allowed():
                self.json(403, {"error": "Origin or host not allowed."})
                return False
            if not hmac.compare_digest(self.headers.get("X-Civweave-Token", ""), controller.token):
                self.json(401, {"error": "Companion pairing required."})
                return False
            return True

        def do_OPTIONS(self):
            if not self.allowed() or self.headers.get("Origin") not in ORIGINS:
                self.json(403, {"error": "Origin not allowed."})
                return
            self.headers_json(204, self.headers.get("Origin"))

        def do_GET(self):
            if not self.guard():
                return
            if self.path == "/v1/status":
                self.json(200, controller.status())
            elif re.fullmatch(r"/v1/generations/[0-9a-f]{32}", self.path):
                try:
                    self.json(200, controller.generation(self.path.rsplit("/", 1)[-1]))
                except LookupError as exc:
                    self.json(404, {"error": str(exc)})
            else:
                self.json(404, {"error": "Unknown endpoint."})

        def do_POST(self):
            if not self.guard():
                return
            if self.path == "/v1/generations" or re.fullmatch(r"/v1/generations/[0-9a-f]{32}/cancel", self.path):
                try:
                    size = int(self.headers.get("Content-Length", "0"))
                    if size < 0 or size > 65536:
                        raise ValueError("Generation request exceeds 64 KiB.")
                    raw = self.rfile.read(size) if size else b"{}"
                    body = json.loads(raw)
                    if self.path == "/v1/generations":
                        result = controller.submit_generation(body)
                        self.json(202, result)
                    else:
                        result = controller.cancel_generation(self.path.split("/")[3])
                        self.json(200, result)
                except (ValueError, TypeError) as exc:
                    self.json(400, {"error": str(exc)[:250]})
                except LookupError as exc:
                    self.json(404, {"error": str(exc)[:250]})
                except RuntimeError as exc:
                    self.json(409, {"error": str(exc)[:250]})
                return
            prefix = "/v1/actions/"
            if not self.path.startswith(prefix):
                self.json(404, {"error": "Unknown endpoint."})
                return
            action = self.path[len(prefix):]
            if action not in ("setup", "start", "stop", "restart", "download", "verify"):
                self.json(404, {"error": "Unknown action."})
                return
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if size < 0 or size > 2048:
                    raise ValueError("Request body too large.")
                raw = self.rfile.read(size) if size else b"{}"
                body = json.loads(raw)
                result = controller.run_action(action, body)
                self.json(202, result)
            except (ValueError, json.JSONDecodeError) as exc:
                self.json(400, {"error": str(exc)[:250]})
            except RuntimeError as exc:
                self.json(409, {"error": str(exc)[:250]})
    return Handler


def main():
    controller = Controller()
    print("Civweave Termux Companion on http://127.0.0.1:" + str(PORT), flush=True)
    print("Pairing token (private; enter in Civweave only): " + controller.token, flush=True)
    print("Install Termux:Boot separately if you want automatic companion startup.", flush=True)
    server = ThreadingHTTPServer(("127.0.0.1", PORT), make_handler(controller))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        # Do not orphan a model server when the Companion is stopped manually.
        if controller.server_running():
            controller._stop()


if __name__ == "__main__":
    main()
