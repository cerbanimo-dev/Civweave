#!/usr/bin/env python3
"""Cerbanimo Field Server.

Serves Cerbanimo from a stable localhost origin, exposes narrowly configured
same-origin provider routes, and manages an optional packaged GGUF runtime via
llama.cpp's ``llama-server``. The model-administration endpoints are loopback
only even when the normal provider relay is deliberately exposed elsewhere.
"""
from __future__ import annotations

import hashlib
import base64
import ipaddress
import json
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

from invite_portal import InvitePortalManager

SERVER_VERSION = "1.5.0"
DEFAULT_CONFIG_PATH = Path.home() / ".config" / "pocket-constellary" / "config.json"
CONFIG_PATH = Path(os.environ.get("FIELD_KIT_CONFIG", DEFAULT_CONFIG_PATH)).expanduser()
DEFAULT_ROOT = Path(__file__).resolve().parents[1] / "pwa"
ROOT = Path(os.environ.get("CERBANIMO_PWA_ROOT", DEFAULT_ROOT)).expanduser().resolve()
DEFAULT_MODEL_DIR = Path.home() / ".local" / "share" / "pocket-constellary" / "models"

DEFAULT_CONFIG = {
    "host": "127.0.0.1",
    "port": 8787,
    "request_timeout_seconds": 420,
    "party_relay_port": 8790,
    "invite_portal_port": 8792,
    "routes": {
        "/ollama": "http://127.0.0.1:11434",
        "/compatible": "",
        "/bigmoe": "http://127.0.0.1:39281",
        "/gemini": "https://generativelanguage.googleapis.com",
        "/party": "http://127.0.0.1:8790",
        "/packaged": "http://127.0.0.1:8788",
    },
    "model_runner": {
        "binary": "llama-server",
        "host": "127.0.0.1",
        "port": 8788,
        "models_dir": str(DEFAULT_MODEL_DIR),
        "startup_timeout_seconds": 300,
        "auto_start": True,
        "default_model_id": None,
        "extra_args": [],
    },
}


def load_config() -> dict:
    config = json.loads(json.dumps(DEFAULT_CONFIG))
    if CONFIG_PATH.exists():
        supplied = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        config.update({k: v for k, v in supplied.items() if k not in {"routes", "model_runner"}})
        config["routes"].update(supplied.get("routes") or {})
        config["model_runner"].update(supplied.get("model_runner") or {})
    env_routes = {
        "/ollama": os.environ.get("OLLAMA_UPSTREAM"),
        "/compatible": os.environ.get("COMPATIBLE_UPSTREAM"),
        "/bigmoe": os.environ.get("BIGMOE_UPSTREAM"),
        "/gemini": os.environ.get("GEMINI_UPSTREAM"),
        "/party": os.environ.get("PARTY_RELAY_UPSTREAM"),
        "/packaged": os.environ.get("PACKAGED_UPSTREAM"),
    }
    for prefix, upstream in env_routes.items():
        if upstream is not None:
            config["routes"][prefix] = upstream
    if os.environ.get("CERBANIMO_HOST"):
        config["host"] = os.environ["CERBANIMO_HOST"]
    if os.environ.get("CERBANIMO_PORT"):
        config["port"] = int(os.environ["CERBANIMO_PORT"])
    if os.environ.get("LLAMA_SERVER_BIN"):
        config["model_runner"]["binary"] = os.environ["LLAMA_SERVER_BIN"]
    return config


CONFIG = load_config()
HOST = str(CONFIG.get("host") or "127.0.0.1")
PORT = int(CONFIG.get("port") or 8787)
TIMEOUT = int(CONFIG.get("request_timeout_seconds") or 180)
MAX_JSON_BYTES = 2 * 1024 * 1024
MAX_PROXY_REQUEST_BYTES = 16 * 1024 * 1024
MAX_PROXY_RESPONSE_BYTES = 32 * 1024 * 1024
MAX_MODEL_BYTES = int(os.environ.get("CERBANIMO_MAX_MODEL_BYTES", 64 * 1024 * 1024 * 1024))


class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


NO_REDIRECT_OPENER = urllib.request.build_opener(NoRedirectHandler)
RUNNER_CONFIG = CONFIG.get("model_runner") or {}
RUNNER_HOST = str(RUNNER_CONFIG.get("host") or "127.0.0.1")
RUNNER_PORT = int(RUNNER_CONFIG.get("port") or 8788)
RUNNER_TIMEOUT = int(RUNNER_CONFIG.get("startup_timeout_seconds") or 300)
MODEL_DIR = Path(RUNNER_CONFIG.get("models_dir") or DEFAULT_MODEL_DIR).expanduser().resolve()
MODEL_DIR.mkdir(parents=True, exist_ok=True)
RUNNER_LOG = MODEL_DIR / "llama-server.log"


def validate_provider_upstream(value: str) -> str:
    value = str(value or "").strip().rstrip("/")
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise RuntimeError("Provider routes must use HTTP(S)")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise RuntimeError("Provider routes cannot contain credentials, query parameters, or fragments")
    if parsed.scheme == "http":
        host = parsed.hostname.lower()
        try:
            address = ipaddress.ip_address(host)
            local = address.is_loopback or address.is_private
        except ValueError:
            local = host == "localhost"
        if not local:
            raise RuntimeError("Plain HTTP provider routes are limited to local network addresses")
    return value


ROUTES = {
    str(prefix).rstrip("/"): validate_provider_upstream(str(upstream))
    for prefix, upstream in (CONFIG.get("routes") or {}).items()
    if upstream
}

_RUNNER_LOCK = threading.RLock()
_RUNNER_PROCESS: subprocess.Popen | None = None
_RUNNER_MODEL_ID: str | None = None
_RUNNER_COMMAND: list[str] = []
_RUNNER_STAGE = "idle"
_RUNNER_STARTED_AT: float | None = None
_RUNNER_READY_AT: float | None = None
_RUNNER_LAST_ERROR: str | None = None

PARTY_RELAY_SCRIPT = Path(os.environ.get("CERBANIMO_PARTY_RELAY_SCRIPT", Path(__file__).with_name("party_relay.py"))).expanduser().resolve()
PARTY_RELAY_PID = Path(os.environ.get("CERBANIMO_PARTY_RELAY_PID", Path(__file__).with_name("party-relay.pid"))).expanduser()
PARTY_RELAY_LOG = Path(os.environ.get("CERBANIMO_PARTY_RELAY_LOG", Path(__file__).with_name("party-relay.log"))).expanduser()
PARTY_RELAY_META = Path(os.environ.get("CERBANIMO_PARTY_RELAY_META", Path(__file__).with_name("party-relay-manager.json"))).expanduser()
PARTY_RELAY_PORT = int(CONFIG.get("party_relay_port") or 8790)
PARTY_RELAY_DATA = Path(CONFIG.get("party_relay_data") or (Path.home() / ".local/share/pocket-constellary/party-relay.json")).expanduser()
_PARTY_LOCK = threading.RLock()

INVITE_PWA_ROOT = Path(os.environ.get("CERBANIMO_INVITE_PWA_ROOT", ROOT)).expanduser().resolve()
INVITE_MANAGER = InvitePortalManager(SERVER_VERSION, INVITE_PWA_ROOT, Path(__file__).resolve().parent, int(CONFIG.get("invite_portal_port") or 8792))


def _atomic_write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    temp.replace(path)


def save_runtime_config() -> None:
    CONFIG["routes"] = dict(ROUTES)
    _atomic_write_json(CONFIG_PATH, CONFIG)


def set_runtime_route(prefix: str, upstream: str | None) -> None:
    prefix = str(prefix).rstrip("/")
    if upstream:
        ROUTES[prefix] = validate_provider_upstream(str(upstream))
    else:
        ROUTES.pop(prefix, None)
    save_runtime_config()


def relay_health_url() -> str:
    return f"http://127.0.0.1:{PARTY_RELAY_PORT}/health"


def _relay_pid() -> int | None:
    try:
        value = int(PARTY_RELAY_PID.read_text(encoding="utf-8").strip())
        os.kill(value, 0)
        command = Path(f"/proc/{value}/cmdline").read_bytes().replace(b"\0", b" ").decode("utf-8", "replace")
        if str(PARTY_RELAY_SCRIPT) not in command:
            raise RuntimeError("Recorded PID does not belong to the bundled relay")
        return value
    except Exception:
        PARTY_RELAY_PID.unlink(missing_ok=True)
        return None


def _fetch_json(url: str, timeout: float = 2.0) -> dict | None:
    try:
        request = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            if not 200 <= response.status < 300:
                return None
            return json.loads(response.read().decode("utf-8"))
    except Exception:
        return None


def detect_lan_ip() -> str | None:
    # Prefer the Wi-Fi interface on Android. A cellular address may look local but
    # is normally not reachable by another phone, so do not advertise it as a
    # trusted-LAN relay address.
    try:
        output = subprocess.check_output(["ip", "-4", "addr", "show", "wlan0"], text=True, timeout=2)
        match = re.search(r"\binet\s+([0-9.]+)", output)
        if match:
            return match.group(1)
    except Exception:
        pass
    if os.environ.get("ANDROID_ROOT") or os.environ.get("TERMUX_VERSION"):
        return None
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.settimeout(0.4)
        sock.connect(("8.8.8.8", 80))
        value = sock.getsockname()[0]
        return value if value and not value.startswith("127.") else None
    except Exception:
        return None
    finally:
        sock.close()


def validate_relay_upstream(value: str) -> str:
    value = validate_provider_upstream(value)
    parsed = urlsplit(value)
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise RuntimeError("Relay address cannot contain credentials, query parameters, or fragments")
    if parsed.path not in {"", "/"}:
        raise RuntimeError("Use the relay base address without an API path")
    return value


def stop_managed_party_relay() -> dict:
    with _PARTY_LOCK:
        pid = _relay_pid()
        if pid:
            try:
                os.killpg(pid, signal.SIGTERM)
            except Exception:
                try:
                    os.kill(pid, signal.SIGTERM)
                except Exception:
                    pass
            deadline = time.monotonic() + 2.0
            while time.monotonic() < deadline:
                try:
                    os.kill(pid, 0)
                    time.sleep(0.1)
                except Exception:
                    break
        PARTY_RELAY_PID.unlink(missing_ok=True)
        meta = {}
        if PARTY_RELAY_META.exists():
            try:
                meta = json.loads(PARTY_RELAY_META.read_text(encoding="utf-8"))
            except Exception:
                meta = {}
        meta.update({"running": False, "stoppedAt": time.time()})
        _atomic_write_json(PARTY_RELAY_META, meta)
    return party_manager_status()


def party_manager_status() -> dict:
    pid = _relay_pid()
    local_health = _fetch_json(relay_health_url(), 0.8) if pid else None
    route = ROUTES.get("/party", "")
    local_upstream = f"http://127.0.0.1:{PARTY_RELAY_PORT}"
    meta = {}
    if PARTY_RELAY_META.exists():
        try:
            meta = json.loads(PARTY_RELAY_META.read_text(encoding="utf-8"))
        except Exception:
            meta = {}
    host_mode = bool(pid and local_health and route == local_upstream)
    joined_mode = bool(route and route != local_upstream)
    lan = bool(meta.get("lan"))
    lan_ip = detect_lan_ip() if host_mode and lan else None
    if host_mode:
        # A loopback URL is useful for local-only operation, but it must never be
        # advertised as a cross-device invitation when LAN hosting was requested.
        share_url = (
            f"http://{lan_ip}:{PARTY_RELAY_PORT}"
            if lan and lan_ip
            else local_upstream if not lan
            else None
        )
    elif joined_mode:
        share_url = route
    else:
        share_url = None
    remote_health = None
    if joined_mode:
        remote_health = _fetch_json(route + "/health", 1.5)
    mode = "hosting" if host_mode else "joined" if joined_mode else "stopped"
    healthy = bool(local_health) if host_mode else bool(remote_health) if joined_mode else False
    return {
        "ok": True,
        "service": "pocket-constellary-party-manager",
        "version": SERVER_VERSION,
        "available": PARTY_RELAY_SCRIPT.is_file(),
        "mode": mode,
        "healthy": healthy,
        "managed": host_mode,
        "lan": lan if host_mode else False,
        "pid": pid,
        "route": "/party" if route else None,
        "upstream": route or None,
        "shareUrl": share_url,
        "localHealth": local_health,
        "remoteHealth": remote_health,
        "log": str(PARTY_RELAY_LOG),
    }


def start_managed_party_relay(lan: bool = True) -> dict:
    if not PARTY_RELAY_SCRIPT.is_file():
        raise RuntimeError("The bundled party relay is missing from the Field Kit")
    with _PARTY_LOCK:
        desired = bool(lan)
        current = party_manager_status()
        if current.get("mode") == "hosting" and bool(current.get("lan")) == desired and current.get("healthy"):
            return current
        if _relay_pid():
            stop_managed_party_relay()
        PARTY_RELAY_LOG.parent.mkdir(parents=True, exist_ok=True)
        env = os.environ.copy()
        env.update({
            "CERBANIMO_RELAY_HOST": "0.0.0.0" if desired else "127.0.0.1",
            "CERBANIMO_RELAY_PORT": str(PARTY_RELAY_PORT),
            "CERBANIMO_RELAY_DATA": str(PARTY_RELAY_DATA),
        })
        log = PARTY_RELAY_LOG.open("ab", buffering=0)
        process = subprocess.Popen([sys.executable, str(PARTY_RELAY_SCRIPT)], stdout=log, stderr=subprocess.STDOUT, env=env, start_new_session=True)
        PARTY_RELAY_PID.write_text(str(process.pid), encoding="utf-8")
        _atomic_write_json(PARTY_RELAY_META, {"running": True, "lan": desired, "pid": process.pid, "startedAt": time.time()})
        deadline = time.monotonic() + 12
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise RuntimeError(f"Party relay exited with code {process.returncode}; inspect {PARTY_RELAY_LOG}")
            if _fetch_json(relay_health_url(), 0.8):
                break
            time.sleep(0.2)
        else:
            raise RuntimeError(f"Party relay did not become ready; inspect {PARTY_RELAY_LOG}")
        set_runtime_route("/party", f"http://127.0.0.1:{PARTY_RELAY_PORT}")
    return party_manager_status()


def join_party_relay(upstream: str) -> dict:
    upstream = validate_relay_upstream(upstream)
    health = _fetch_json(upstream + "/health", 4.0)
    if not health or health.get("service") != "cerbanimo-party-relay":
        raise RuntimeError("The address did not answer as a Cerbanimo Living Party Relay")
    if _relay_pid():
        stop_managed_party_relay()
    set_runtime_route("/party", upstream)
    return party_manager_status()


def disconnect_party_relay(stop_local: bool = True) -> dict:
    if stop_local and _relay_pid():
        stop_managed_party_relay()
    set_runtime_route("/party", None)
    return party_manager_status()


def b64url_decode(value: str) -> bytes:
    value = (value or "").replace("-", "+").replace("_", "/")
    value += "=" * ((4 - len(value) % 4) % 4)
    return base64.b64decode(value)


def b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def safe_token(value: str, fallback: str = "model") -> str:
    value = unquote(value or "")
    value = re.sub(r"[^a-zA-Z0-9._-]+", "_", value).strip("._-")
    return (value[:180] or fallback)


def normalize_chat_payload(payload: dict, *, fold_system: bool = False, drop_response_format: bool = False) -> dict:
    """Normalize OpenAI-style chat history for strict GGUF Jinja templates.

    Many instruction-tuned templates require user/assistant alternation and reject
    leading assistant messages or repeated roles. Pocket Constellary may retain
    adjacent assistant artifacts such as a normal reply followed by a proposal.
    Merge those artifacts before proxying them to llama.cpp.
    """
    result = dict(payload or {})
    system_parts: list[str] = []
    conversation: list[dict] = []
    for item in result.get("messages") or []:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "user").lower()
        role = "assistant" if role == "assistant" else "system" if role == "system" else "user"
        content = item.get("content")
        if isinstance(content, list):
            content = "\n".join(str(part.get("text") or part.get("content") or "") if isinstance(part, dict) else str(part) for part in content)
        content = str(content or "").strip()
        if not content:
            continue
        if role == "system":
            system_parts.append(content)
            continue
        if conversation and conversation[-1]["role"] == role:
            conversation[-1]["content"] += "\n\n" + content
        else:
            conversation.append({"role": role, "content": content})
    while conversation and conversation[0]["role"] == "assistant":
        system_parts.append("Earlier assistant context:\n" + conversation.pop(0)["content"])
    if not conversation:
        conversation.append({"role": "user", "content": "Continue."})
    if conversation[-1]["role"] == "assistant":
        conversation.append({"role": "user", "content": "Continue from the preceding context."})
    system = "\n\n".join(system_parts)
    if fold_system and system:
        conversation[0]["content"] = f"System instructions:\n{system}\n\nUser request:\n{conversation[0]['content']}"
    elif system:
        conversation.insert(0, {"role": "system", "content": system})
    result["messages"] = conversation
    if drop_response_format:
        result.pop("response_format", None)
    return result


def chat_template_error(status: int, payload: bytes) -> bool:
    if status != 400:
        return False
    text = payload.decode("utf-8", errors="replace")
    return bool(re.search(r"chat template|jinja|roles? must alternate|system role|parser generation|conversation roles", text, re.I))


def model_metadata_path(model_id: str) -> Path:
    return MODEL_DIR / f"{safe_token(model_id)}.model.json"


def scan_models() -> list[dict]:
    models: list[dict] = []
    seen: set[str] = set()
    for meta_path in MODEL_DIR.glob("*.model.json"):
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            file_path = MODEL_DIR / str(meta.get("fileName") or "")
            if not file_path.is_file():
                continue
            meta["size"] = file_path.stat().st_size
            meta["path"] = str(file_path)
            models.append(meta)
            seen.add(str(file_path.resolve()))
        except Exception:
            continue
    for file_path in MODEL_DIR.glob("*.gguf"):
        if str(file_path.resolve()) in seen:
            continue
        model_id = safe_token(file_path.stem)
        models.append(
            {
                "id": model_id,
                "name": file_path.stem,
                "alias": model_id,
                "fileName": file_path.name,
                "format": "gguf",
                "size": file_path.stat().st_size,
                "path": str(file_path),
                "storage": "field-kit",
            }
        )
    return sorted(models, key=lambda item: str(item.get("name") or item.get("id") or "").lower())


def find_model(model_id: str) -> dict | None:
    return next((item for item in scan_models() if item.get("id") == model_id or item.get("alias") == model_id), None)


def configured_default_model(models: list[dict] | None = None) -> str | None:
    models = models if models is not None else scan_models()
    configured = safe_token(str(RUNNER_CONFIG.get("default_model_id") or ""), "")
    if configured and any(item.get("id") == configured or item.get("alias") == configured for item in models):
        return configured
    return str(models[0].get("id")) if models else None


def runner_binary() -> str | None:
    configured = str(RUNNER_CONFIG.get("binary") or "llama-server")
    if os.path.isabs(configured) and os.access(configured, os.X_OK):
        return configured
    return shutil.which(configured)


def runner_endpoint(path: str = "/health") -> str:
    return f"http://{RUNNER_HOST}:{RUNNER_PORT}{path}"


def runner_http_ready() -> bool:
    """Return true only when llama-server reports a fully loaded model.

    llama-server uses HTTP 503 while weights are loading. Older builds fell back to
    /v1/models after *any* health error, which could report 200 before inference was
    genuinely ready. That race produced browser requests that sat until timeout.
    """
    request = urllib.request.Request(runner_endpoint("/health"), headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=3) as response:
            if response.status != 200:
                return False
            try:
                payload = json.loads(response.read().decode("utf-8") or "{}")
            except Exception:
                payload = {}
            status = str(payload.get("status") or payload.get("state") or "ok").lower()
            return status not in {"loading", "starting", "unavailable", "error"}
    except urllib.error.HTTPError as error:
        # Some older llama-server builds do not expose /health. Only a true 404
        # permits the compatibility fallback; 503 explicitly means still loading.
        if error.code != 404:
            return False
    except Exception:
        return False
    try:
        with urllib.request.urlopen(runner_endpoint("/v1/models"), timeout=3) as response:
            if response.status != 200:
                return False
            payload = json.loads(response.read().decode("utf-8") or "{}")
            return bool(payload.get("data"))
    except Exception:
        return False


def runner_log_tail(lines: int = 36) -> list[str]:
    if not RUNNER_LOG.exists():
        return []
    try:
        return RUNNER_LOG.read_text(encoding="utf-8", errors="replace").splitlines()[-max(1, min(200, lines)):]
    except Exception:
        return []


def runner_status() -> dict:
    global _RUNNER_PROCESS, _RUNNER_STAGE, _RUNNER_LAST_ERROR, _RUNNER_READY_AT
    with _RUNNER_LOCK:
        if _RUNNER_PROCESS is not None and _RUNNER_PROCESS.poll() is not None:
            code = _RUNNER_PROCESS.returncode
            _RUNNER_PROCESS = None
            if code not in (None, 0):
                _RUNNER_STAGE = "error"
                _RUNNER_LAST_ERROR = _RUNNER_LAST_ERROR or f"llama-server exited with code {code}"
        process_running = _RUNNER_PROCESS is not None
        ready = runner_http_ready() if process_running or _RUNNER_MODEL_ID else False
        if ready:
            _RUNNER_STAGE = "ready"
            _RUNNER_READY_AT = _RUNNER_READY_AT or time.time()
        elif process_running and _RUNNER_STAGE not in {"launching", "error"}:
            _RUNNER_STAGE = "loading"
        elif not process_running and _RUNNER_STAGE not in {"error"}:
            _RUNNER_STAGE = "idle"
        elapsed = max(0.0, time.time() - _RUNNER_STARTED_AT) if _RUNNER_STARTED_AT else 0.0
        model = find_model(_RUNNER_MODEL_ID) if _RUNNER_MODEL_ID else None
        return {
            "ok": True,
            "binary": str(RUNNER_CONFIG.get("binary") or "llama-server"),
            "binaryPath": runner_binary(),
            "binaryAvailable": bool(runner_binary()),
            "running": process_running,
            "ready": ready,
            "stage": _RUNNER_STAGE,
            "pid": _RUNNER_PROCESS.pid if _RUNNER_PROCESS else None,
            "modelId": _RUNNER_MODEL_ID,
            "modelName": model.get("name") if model else None,
            "modelBytes": int(model.get("size") or 0) if model else 0,
            "startedAtEpoch": _RUNNER_STARTED_AT,
            "readyAtEpoch": _RUNNER_READY_AT,
            "elapsedSeconds": round(elapsed, 1),
            "startupTimeoutSeconds": RUNNER_TIMEOUT,
            "lastError": _RUNNER_LAST_ERROR,
            "endpoint": f"http://{RUNNER_HOST}:{RUNNER_PORT}/v1",
            "route": "/packaged/v1",
            "modelsDir": str(MODEL_DIR),
            "log": str(RUNNER_LOG),
            "logTail": runner_log_tail(24),
            "command": _RUNNER_COMMAND,
        }


def stop_runner() -> dict:
    global _RUNNER_PROCESS, _RUNNER_MODEL_ID, _RUNNER_COMMAND, _RUNNER_STAGE, _RUNNER_STARTED_AT, _RUNNER_READY_AT
    with _RUNNER_LOCK:
        proc = _RUNNER_PROCESS
        if proc is not None and proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=8)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=3)
        _RUNNER_PROCESS = None
        _RUNNER_MODEL_ID = None
        _RUNNER_COMMAND = []
        _RUNNER_STAGE = "idle"
        _RUNNER_STARTED_AT = None
        _RUNNER_READY_AT = None
    return runner_status()


def start_runner(model_id: str, context: int = 4096, alias: str | None = None, wait_seconds: int | None = None) -> dict:
    global _RUNNER_PROCESS, _RUNNER_MODEL_ID, _RUNNER_COMMAND, _RUNNER_STAGE, _RUNNER_STARTED_AT, _RUNNER_READY_AT, _RUNNER_LAST_ERROR
    binary = runner_binary()
    if not binary:
        raise RuntimeError("llama-server is not installed. In Termux run: pkg install llama-cpp")
    model = find_model(model_id)
    if not model:
        raise RuntimeError(f"Packaged model {model_id!r} is not in the Field Kit model store")
    path = Path(str(model["path"])).resolve()
    if path.suffix.lower() != ".gguf":
        raise RuntimeError("The managed Field runner currently accepts GGUF files")
    context = max(512, min(131072, int(context or 4096)))
    alias = safe_token(alias or model_id, model_id)
    current = runner_status()
    if current.get("ready") and current.get("modelId") == model_id:
        current["started"] = False
        current["reused"] = True
        return current
    stop_runner()
    command = [
        binary,
        "-m",
        str(path),
        "--host",
        RUNNER_HOST,
        "--port",
        str(RUNNER_PORT),
        "-c",
        str(context),
        "--alias",
        alias,
    ]
    extra_args = RUNNER_CONFIG.get("extra_args") or []
    if isinstance(extra_args, list):
        command.extend(str(item) for item in extra_args)
    RUNNER_LOG.parent.mkdir(parents=True, exist_ok=True)
    with RUNNER_LOG.open("ab") as marker:
        marker.write(("\n\n=== Pocket Constellary model launch " + time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()) + " ===\n").encode("utf-8"))
        marker.write(("COMMAND " + " ".join(command) + "\n").encode("utf-8"))
    log_handle = RUNNER_LOG.open("ab", buffering=0)
    with _RUNNER_LOCK:
        _RUNNER_STAGE = "launching"
        _RUNNER_STARTED_AT = time.time()
        _RUNNER_READY_AT = None
        _RUNNER_LAST_ERROR = None
        _RUNNER_PROCESS = subprocess.Popen(
            command,
            stdout=log_handle,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        _RUNNER_MODEL_ID = model_id
        _RUNNER_COMMAND = command
    wait_seconds = max(0, min(900, int(RUNNER_TIMEOUT if wait_seconds is None else wait_seconds)))
    deadline = time.monotonic() + wait_seconds
    while time.monotonic() < deadline:
        with _RUNNER_LOCK:
            proc = _RUNNER_PROCESS
            if proc is None:
                break
            code = proc.poll()
        if code is not None:
            _RUNNER_STAGE = "error"
            _RUNNER_LAST_ERROR = f"llama-server exited with code {code}"
            raise RuntimeError(f"llama-server exited with code {code}; inspect {RUNNER_LOG}")
        if runner_http_ready():
            _RUNNER_STAGE = "ready"
            _RUNNER_READY_AT = time.time()
            status = runner_status()
            status["started"] = True
            return status
        _RUNNER_STAGE = "loading"
        time.sleep(0.75)
    status = runner_status()
    status["started"] = True
    status["detail"] = f"Runner is still loading after {wait_seconds} seconds"
    return status


def ensure_runner(model_id: str, context: int = 4096, alias: str | None = None, wait_seconds: int = 300) -> dict:
    status = runner_status()
    if status.get("ready") and status.get("modelId") == model_id:
        status["ensured"] = True
        return status
    if not status.get("running") or status.get("modelId") != model_id:
        status = start_runner(model_id, context, alias, wait_seconds)
    else:
        deadline = time.monotonic() + max(0, min(900, int(wait_seconds)))
        while time.monotonic() < deadline:
            status = runner_status()
            if status.get("ready"):
                break
            if not status.get("running"):
                break
            time.sleep(0.75)
    status["ensured"] = bool(status.get("ready"))
    return status


class FieldHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = f"CerbanimoField/{SERVER_VERSION}"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("Content-Security-Policy", "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https: http: blob:")
        super().end_headers()

    @staticmethod
    def _local_host(value: str) -> bool:
        host = str(value or "").strip("[]").lower()
        if host == "localhost":
            return True
        try:
            address = ipaddress.ip_address(host)
            return address.is_loopback or address.is_private
        except ValueError:
            return False

    def _require_local_origin(self, mutation: bool = False) -> bool:
        host_header = str(self.headers.get("Host") or "")
        parsed_host = urlsplit(f"//{host_header}")
        if not parsed_host.hostname or not self._local_host(parsed_host.hostname):
            self.send_error(421, "Unrecognized local Host header")
            return False
        origin = str(self.headers.get("Origin") or "")
        if origin:
            parsed_origin = urlsplit(origin)
            origin_port = parsed_origin.port or (443 if parsed_origin.scheme == "https" else 80)
            host_port = parsed_host.port or PORT
            if (
                parsed_origin.scheme not in {"http", "https"}
                or not self._local_host(parsed_origin.hostname or "")
                or parsed_origin.hostname.lower() != parsed_host.hostname.lower()
                or origin_port != host_port
            ):
                self.send_error(403, "Cross-origin field requests are not accepted")
                return False
        if mutation and self.headers.get("Sec-Fetch-Site") == "cross-site":
            self.send_error(403, "Cross-site field mutations are not accepted")
            return False
        return True

    def do_OPTIONS(self) -> None:
        if not self._require_local_origin(mutation=True):
            return
        self.send_response(204)
        origin = self.headers.get("Origin")
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization, X-Goog-Api-Key, Accept, "
            "X-Cerbanimo-Model-Id, X-Cerbanimo-Model-Name, "
            "X-Cerbanimo-File-Name, X-Cerbanimo-Root-Hash",
        )
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:
        if not self._require_local_origin():
            return
        path = self.path.split("?", 1)[0]
        if path == "/field/health":
            self._health()
            return
        if path == "/field/civweave/status":
            if self._require_loopback_admin():
                seed = ROOT / "civweave-pocket-campus.cwseed"
                self._json(200, {"ok": seed.is_file(), "available": seed.is_file(), "filename": seed.name, "bytes": seed.stat().st_size if seed.is_file() else 0, "downloadUrl": "/field/civweave/seed" if seed.is_file() else None})
            return
        if path == "/field/civweave/seed":
            if self._require_loopback_admin():
                seed = ROOT / "civweave-pocket-campus.cwseed"
                if not seed.is_file():
                    self._json(404, {"ok": False, "error": "The installed Pocket Campus seed is missing. Re-run the mobile installer to restore it."})
                else:
                    self._file(200, seed, "application/zip", "civweave-pocket-campus.cwseed")
            return
        if path == "/field/invite/status":
            if self._require_loopback_admin():
                self._json(200, INVITE_MANAGER.status())
            return
        if path == "/field/invite/pending":
            if self._require_loopback_admin():
                pending = INVITE_MANAGER.pending()
                if pending is None:
                    self._json(404, {"ok": False, "error": "No pending invitation"})
                else:
                    self._json(200, {"ok": True, "capsule": pending})
            return
        if path == "/field/invite/release.cerb":
            if self._require_loopback_admin():
                try:
                    package = INVITE_MANAGER.release_capsule()
                    self._file(200, package, "application/octet-stream", package.name)
                except Exception as error:
                    self._json(404, {"error": str(error)})
            return
        if path.startswith("/field/invite/capsule/") and path.endswith(".json"):
            if self._require_loopback_admin():
                try:
                    token = path.rsplit("/", 1)[-1][:-5]
                    capsule = INVITE_MANAGER.get_invite(token)
                    self._json(200, capsule)
                except Exception as error:
                    self._json(404, {"error": str(error)})
            return
        if path.startswith("/field/invite/starter-pack/") and path.endswith(".zip"):
            if self._require_loopback_admin():
                try:
                    token = path.rsplit("/", 1)[-1][:-4]
                    package = INVITE_MANAGER.starter_pack_zip(token)
                    self._file(200, package, "application/zip", package.name)
                except Exception as error:
                    self._json(500, {"error": str(error)})
            return
        if path.startswith("/field/invite/qr/") and path.endswith(".svg"):
            if self._require_loopback_admin():
                try:
                    token = path.rsplit("/", 1)[-1][:-4]
                    self._bytes(200, INVITE_MANAGER.qr_svg(token), "image/svg+xml; charset=utf-8")
                except Exception as error:
                    self._json(500, {"error": str(error)})
            return
        if path == "/field/party/status":
            if self._require_loopback_admin():
                self._json(200, party_manager_status())
            return
        if path == "/field/party/log":
            if self._require_loopback_admin():
                lines = PARTY_RELAY_LOG.read_text(encoding="utf-8", errors="replace").splitlines()[-120:] if PARTY_RELAY_LOG.exists() else []
                self._json(200, {"ok": True, "lines": lines, "status": party_manager_status()})
            return
        if path == "/field/models/status":
            if self._require_loopback_admin():
                self._json(200, runner_status())
            return
        if path == "/field/models/list":
            if self._require_loopback_admin():
                models = scan_models()
                self._json(200, {"ok": True, "models": models, "defaultModelId": configured_default_model(models), "runner": runner_status()})
            return
        if path == "/field/models/log":
            if self._require_loopback_admin():
                self._json(200, {"ok": True, "log": str(RUNNER_LOG), "lines": runner_log_tail(120), "runner": runner_status()})
            return
        route = self._matched_route()
        if route:
            self._proxy("GET", *route)
            return
        super().do_GET()

    def do_POST(self) -> None:
        if not self._require_local_origin(mutation=True):
            return
        path = self.path.split("?", 1)[0]
        if path == "/field/vault/kdf":
            if self._require_loopback_admin():
                self._vault_kdf()
            return
        if path.startswith("/field/invite/"):
            if not self._require_loopback_admin():
                return
            try:
                payload = self._read_json_body()
                if path == "/field/invite/publish":
                    self._json(200, INVITE_MANAGER.publish(payload.get("capsule") or {}))
                    return
                if path == "/field/invite/consume":
                    INVITE_MANAGER.consume_pending()
                    self._json(200, {"ok": True})
                    return
                if path == "/field/invite/pending":
                    capsule = payload.get("capsule") or {}
                    INVITE_MANAGER.set_pending(capsule)
                    self._json(200, {"ok": True})
                    return
                if path == "/field/invite/stop":
                    self._json(200, INVITE_MANAGER.stop())
                    return
                self._json(404, {"error": "Unknown invitation operation"})
            except Exception as error:
                self._json(500, {"error": str(error), "status": INVITE_MANAGER.status()})
            return
        if path.startswith("/field/party/"):
            if not self._require_loopback_admin():
                return
            try:
                payload = self._read_json_body()
                if path == "/field/party/start":
                    self._json(200, start_managed_party_relay(bool(payload.get("lan", True))))
                    return
                if path == "/field/party/join":
                    self._json(200, join_party_relay(str(payload.get("upstream") or "")))
                    return
                if path == "/field/party/disconnect":
                    self._json(200, disconnect_party_relay(bool(payload.get("stopLocal", True))))
                    return
                if path == "/field/party/test":
                    status = party_manager_status()
                    self._json(200 if status.get("healthy") else 503, status)
                    return
                self._json(404, {"error": "Unknown party relay operation"})
            except Exception as error:
                self._json(500, {"error": str(error), "status": party_manager_status()})
            return
        if path.startswith("/field/models/"):
            if not self._require_loopback_admin():
                return
            if path == "/field/models/import":
                self._import_model()
                return
            if path == "/field/models/start":
                self._start_model()
                return
            if path == "/field/models/ensure":
                self._ensure_model()
                return
            if path == "/field/models/stop":
                self._json(200, stop_runner())
                return
            self._json(404, {"error": "Unknown packaged model operation"})
            return
        route = self._matched_route()
        if route:
            self._proxy("POST", *route)
            return
        self.send_error(404, "No configured field route matches this path")

    def _require_loopback_admin(self) -> bool:
        client = str(self.client_address[0])
        allowed = client in {"127.0.0.1", "::1"} or client.startswith("127.")
        if not allowed:
            self._json(403, {"error": "Field administration is loopback-only"})
        return allowed

    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0:
            return {}
        if length > MAX_JSON_BYTES:
            raise RuntimeError("JSON request exceeds the 2 MB limit")
        content_type = str(self.headers.get("Content-Type") or "").split(";", 1)[0].lower()
        if content_type != "application/json" and not content_type.endswith("+json"):
            raise RuntimeError("JSON endpoints require application/json")
        value = json.loads(self.rfile.read(length).decode("utf-8"))
        if not isinstance(value, dict):
            raise RuntimeError("JSON request must be an object")
        return value

    def _vault_kdf(self) -> None:
        try:
            payload = self._read_json_body()
            passphrase = str(payload.get("passphrase") or "")
            if len(passphrase) < 10:
                raise RuntimeError("Passphrase must contain at least ten characters")
            salt = b64url_decode(str(payload.get("salt") or ""))
            if len(salt) < 16:
                raise RuntimeError("Vault salt is malformed")
            memory_kib = max(8192, min(262144, int(payload.get("memoryKiB") or 65536)))
            iterations = max(2, min(8, int(payload.get("iterations") or 3)))
            parallelism = max(1, min(4, int(payload.get("parallelism") or 1)))
            length = max(16, min(64, int(payload.get("length") or 32)))
            try:
                from argon2.low_level import Type, hash_secret_raw
            except Exception as error:
                raise RuntimeError("Argon2id support is not installed in the Field Kit. Run: python -m pip install argon2-cffi") from error
            key = hash_secret_raw(passphrase.encode("utf-8"), salt, time_cost=iterations, memory_cost=memory_kib, parallelism=parallelism, hash_len=length, type=Type.ID)
            self._json(200, {"ok": True, "algorithm": "Argon2id", "memoryKiB": memory_kib, "iterations": iterations, "parallelism": parallelism, "key": b64url_encode(key)})
        except Exception as error:
            self._json(503, {"error": str(error)})

    def _import_model(self) -> None:
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0:
            self._json(400, {"error": "Model upload body is empty"})
            return
        if length > MAX_MODEL_BYTES:
            self._json(413, {"error": "Model upload exceeds the configured size limit"})
            return
        if shutil.disk_usage(MODEL_DIR).free < length + 512 * 1024 * 1024:
            self._json(507, {"error": "Not enough free storage for this model upload"})
            return
        model_id = safe_token(self.headers.get("X-Cerbanimo-Model-Id", ""))
        model_name = unquote(self.headers.get("X-Cerbanimo-Model-Name", "")) or model_id
        original_name = safe_token(self.headers.get("X-Cerbanimo-File-Name", ""), f"{model_id}.gguf")
        if not original_name.lower().endswith(".gguf"):
            self._json(400, {"error": "The managed Field runner currently accepts GGUF files"})
            return
        file_name = f"{model_id}.gguf"
        target = MODEL_DIR / file_name
        partial = MODEL_DIR / f".{file_name}.partial"
        digest = hashlib.sha256()
        remaining = length
        try:
            with partial.open("wb") as handle:
                while remaining:
                    chunk = self.rfile.read(min(4 * 1024 * 1024, remaining))
                    if not chunk:
                        raise RuntimeError("Upload ended before Content-Length bytes were received")
                    handle.write(chunk)
                    digest.update(chunk)
                    remaining -= len(chunk)
            partial.replace(target)
            meta = {
                "id": model_id,
                "name": model_name[:240],
                "alias": model_id,
                "fileName": file_name,
                "sourceFileName": original_name,
                "format": "gguf",
                "size": target.stat().st_size,
                "sha256": digest.hexdigest(),
                "rootHash": self.headers.get("X-Cerbanimo-Root-Hash", ""),
                "storage": "field-kit",
                "importedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            model_metadata_path(model_id).write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
            self._json(201, {"ok": True, **meta, "path": str(target)})
        except Exception as error:
            partial.unlink(missing_ok=True)
            self._json(500, {"error": "Could not store packaged model", "detail": str(error)})

    def _start_model(self) -> None:
        try:
            payload = self._read_json_body()
            model_id = safe_token(str(payload.get("modelId") or ""), "")
            if not model_id:
                raise RuntimeError("modelId is required")
            result = start_runner(
                model_id,
                int(payload.get("context") or 4096),
                str(payload.get("alias") or model_id),
                int(payload.get("waitSeconds") or RUNNER_TIMEOUT),
            )
            self._json(200, result)
        except Exception as error:
            self._json(500, {"error": str(error), "runner": runner_status()})

    def _ensure_model(self) -> None:
        try:
            payload = self._read_json_body()
            model_id = safe_token(str(payload.get("modelId") or configured_default_model() or ""), "")
            if not model_id:
                raise RuntimeError("No packaged GGUF model is available")
            result = ensure_runner(
                model_id,
                int(payload.get("context") or RUNNER_CONFIG.get("context") or 4096),
                str(payload.get("alias") or model_id),
                int(payload.get("waitSeconds") or RUNNER_TIMEOUT),
            )
            self._json(200 if result.get("ready") else 202, result)
        except Exception as error:
            self._json(500, {"error": str(error), "runner": runner_status()})

    def _matched_route(self):
        request_path = self.path.split("?", 1)[0]
        for prefix in sorted(ROUTES, key=len, reverse=True):
            if request_path == prefix or request_path.startswith(prefix + "/"):
                return prefix, ROUTES[prefix]
        return None

    def _health(self) -> None:
        self._json(
            200,
            {
                "ok": True,
                "service": "cerbanimo-field-server",
                "version": SERVER_VERSION,
                "root": str(ROOT),
                "config": str(CONFIG_PATH),
                "origin": f"http://{HOST}:{PORT}",
                "routes": {
                    prefix: {
                        "configured": True,
                        "upstreamHost": urlsplit(upstream).hostname,
                        "upstreamScheme": urlsplit(upstream).scheme,
                    }
                    for prefix, upstream in ROUTES.items()
                },
                "packagedModel": runner_status(),
                "partyLink": party_manager_status(),
                "invitePortal": INVITE_MANAGER.status(),
            },
        )

    def _bytes(self, status: int, payload: bytes, content_type: str, filename: str | None = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        if filename:
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _file(self, status: int, path: Path, content_type: str, filename: str | None = None) -> None:
        size = path.stat().st_size
        if size > MAX_PROXY_RESPONSE_BYTES:
            raise RuntimeError("Requested artifact exceeds the response limit")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        safe_filename = re.sub(r"[^A-Za-z0-9._-]+", "-", filename or path.name)[:160] or "download"
        self.send_header("Content-Disposition", f'attachment; filename="{safe_filename}"')
        self.send_header("Content-Length", str(size))
        self.end_headers()
        with path.open("rb") as source:
            shutil.copyfileobj(source, self.wfile, length=1024 * 1024)

    def _json(self, status: int, value: dict) -> None:
        payload = json.dumps(value, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _proxy(self, method: str, prefix: str, upstream: str) -> None:
        if prefix == "/packaged":
            status = runner_status()
            if not status.get("ready"):
                self._json(503, {
                    "error": "Packaged model is still loading",
                    "code": "PACKAGED_MODEL_LOADING",
                    "retryable": True,
                    "runner": status,
                })
                return
        suffix = self.path[len(prefix) :]
        if not suffix:
            suffix = "/"
        url = f"{upstream}{suffix}"
        body = None
        packaged_chat = prefix == "/packaged" and suffix.rstrip("/").endswith("/v1/chat/completions")
        if method == "POST":
            length = int(self.headers.get("Content-Length", "0") or 0)
            if length > MAX_PROXY_REQUEST_BYTES:
                self._json(413, {"error": "Provider request exceeds the 16 MB limit"})
                return
            body = self.rfile.read(length) if length else b""
            if packaged_chat and body:
                try:
                    payload = json.loads(body.decode("utf-8"))
                    purpose = str(self.headers.get("X-Cerbanimo-Purpose") or "").lower()
                    payload = normalize_chat_payload(payload)
                    if purpose.startswith("kamiya"):
                        payload.pop("response_format", None)
                        payload["max_tokens"] = min(160, max(24, int(payload.get("max_tokens") or 160)))
                    elif purpose == "onboarding":
                        payload.pop("response_format", None)
                        payload["max_tokens"] = min(320, max(48, int(payload.get("max_tokens") or 320)))
                    elif purpose == "review":
                        payload["max_tokens"] = min(240, max(48, int(payload.get("max_tokens") or 240)))
                    body = json.dumps(payload).encode("utf-8")
                except Exception:
                    pass
        headers = {}
        for name in ("Content-Type", "Authorization", "X-Goog-Api-Key", "Accept"):
            value = self.headers.get(name)
            if value:
                headers[name] = value

        def upstream_request(request_body: bytes | None):
            request = urllib.request.Request(url, data=request_body, headers=headers, method=method)
            return NO_REDIRECT_OPENER.open(request, timeout=TIMEOUT)

        try:
            with upstream_request(body) as response:
                payload = response.read(MAX_PROXY_RESPONSE_BYTES + 1)
                if len(payload) > MAX_PROXY_RESPONSE_BYTES:
                    raise RuntimeError("Provider response exceeds the 32 MB limit")
                self.send_response(response.status)
                self.send_header("Content-Type", response.headers.get("Content-Type", "application/json"))
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
        except urllib.error.HTTPError as error:
            payload = error.read(MAX_PROXY_RESPONSE_BYTES + 1)
            if len(payload) > MAX_PROXY_RESPONSE_BYTES:
                payload = b'{"error":"Provider error response exceeded the 32 MB limit"}'
            if packaged_chat and chat_template_error(error.code, payload) and body:
                try:
                    request_payload = json.loads(body.decode("utf-8"))
                    retry_body = json.dumps(normalize_chat_payload(request_payload, fold_system=True, drop_response_format=True)).encode("utf-8")
                    with upstream_request(retry_body) as response:
                        retry_payload = response.read(MAX_PROXY_RESPONSE_BYTES + 1)
                        if len(retry_payload) > MAX_PROXY_RESPONSE_BYTES:
                            raise RuntimeError("Provider response exceeds the 32 MB limit")
                        self.send_response(response.status)
                        self.send_header("Content-Type", response.headers.get("Content-Type", "application/json"))
                        self.send_header("Cache-Control", "no-store")
                        self.send_header("X-Cerbanimo-Chat-Normalized", "system-folded")
                        self.send_header("Content-Length", str(len(retry_payload)))
                        self.end_headers()
                        self.wfile.write(retry_payload)
                        return
                except urllib.error.HTTPError as retry_error:
                    payload = retry_error.read(MAX_PROXY_RESPONSE_BYTES + 1)
                    if len(payload) > MAX_PROXY_RESPONSE_BYTES:
                        payload = b'{"error":"Provider error response exceeded the 32 MB limit"}'
                    error = retry_error
                except Exception as retry_exception:
                    self._json(502, {
                        "error": "Packaged chat-template recovery failed",
                        "code": "PACKAGED_CHAT_TEMPLATE_FAILED",
                        "detail": str(retry_exception),
                    })
                    return
            self.send_response(error.code)
            self.send_header("Content-Type", error.headers.get("Content-Type", "application/json"))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except Exception as error:  # noqa: BLE001
            self._json(
                502,
                {
                    "error": "Field relay could not reach the configured provider",
                    "route": prefix,
                    "detail": str(error),
                },
            )

    def log_message(self, fmt: str, *args) -> None:
        sys.stdout.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))
        sys.stdout.flush()


def main() -> None:
    if not ROOT.joinpath("index.html").exists():
        raise SystemExit(f"PWA index not found at {ROOT / 'index.html'}")
    server = ThreadingHTTPServer((HOST, PORT), FieldHandler)

    def stop(_signum, _frame):
        print("Stopping Cerbanimo Field Server…", flush=True)
        stop_runner()
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    print(f"Cerbanimo Field Server {SERVER_VERSION}", flush=True)
    print(f"PWA: http://{HOST}:{PORT}", flush=True)
    for prefix, upstream in ROUTES.items():
        print(f"Relay: {prefix} → {upstream}", flush=True)
    binary = runner_binary()
    models = scan_models()
    default_model_id = configured_default_model(models)
    print(f"Packaged model runtime: {binary or 'not installed'}", flush=True)
    print(f"Packaged model store: {MODEL_DIR}", flush=True)
    if models:
        print(f"Embedded model default: {default_model_id}", flush=True)
    if binary and default_model_id and bool(RUNNER_CONFIG.get("auto_start", True)):
        def _auto_start():
            try:
                status = start_runner(default_model_id, int(RUNNER_CONFIG.get("context") or 4096), default_model_id, RUNNER_TIMEOUT)
                print(f"Embedded model ready: {status.get('modelId')} ({'ready' if status.get('ready') else 'loading'})", flush=True)
            except Exception as error:
                print(f"Embedded model auto-start failed: {error}", flush=True)
        threading.Thread(target=_auto_start, daemon=True).start()
    server.serve_forever()


if __name__ == "__main__":
    main()
