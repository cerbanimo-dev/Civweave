#!/usr/bin/env python3
"""Cerbanimo invitation and local installation portal.

The portal is deliberately narrow. It publishes signed invitation capsules and
an installable Field Kit to trusted devices on the same Wi-Fi network. It does
not expose Passport authority, provider routes, model administration, or relay
secrets.
"""
from __future__ import annotations

import base64
import html
import io
import json
import os
import re
import shlex
import shutil
import socket
import subprocess
import sys
import threading
import time
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit

MODULE_DIR = Path(__file__).resolve().parent
VENDOR_DIR = MODULE_DIR / "vendor"
if VENDOR_DIR.exists():
    sys.path.insert(0, str(VENDOR_DIR))


def safe_token(value: str, fallback: str = "invite") -> str:
    value = re.sub(r"[^A-Za-z0-9._-]+", "-", str(value or "")).strip("-._")
    return value[:96] or fallback


def detect_share_addresses() -> list[dict]:
    """Return locally reachable invitation addresses without requiring internet.

    Android hotspot interfaces vary by vendor. Prefer Wi-Fi and SoftAP-style
    interfaces, reject loopback and cellular/VPN interfaces, and allow an
    explicit override for unusual cyberdecks.
    """
    override = str(os.environ.get("CERBANIMO_SHARE_HOST") or "").strip()
    if override:
        return [{"ip": override, "interface": "override", "kind": "manual"}]
    candidates: list[dict] = []
    preferred = ("wlan0", "wlan1", "ap0", "softap0", "swlan0", "wifi0", "eth0", "usb0")
    blocked_prefixes = ("lo", "rmnet", "ccmni", "pdp", "tun", "tap", "wg", "vpn", "dummy")
    try:
        output = subprocess.check_output(["ip", "-o", "-4", "addr", "show"], text=True, timeout=3)
        for line in output.splitlines():
            match = re.search(r"^\d+:\s+([^\s:]+).*?\binet\s+([0-9.]+)", line)
            if not match:
                continue
            interface, ip = match.groups()
            if interface.startswith(blocked_prefixes) or ip.startswith("127.") or ip.startswith("169.254."):
                continue
            try:
                octets = [int(part) for part in ip.split(".")]
            except Exception:
                continue
            private = octets[0] == 10 or (octets[0] == 172 and 16 <= octets[1] <= 31) or (octets[0] == 192 and octets[1] == 168)
            if not private:
                continue
            kind = "hotspot" if interface in {"ap0", "softap0", "swlan0", "wlan1"} else "wifi"
            candidates.append({"ip": ip, "interface": interface, "kind": kind})
    except Exception:
        pass
    if not candidates and not (os.environ.get("ANDROID_ROOT") or os.environ.get("TERMUX_VERSION")):
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            sock.settimeout(0.4)
            sock.connect(("8.8.8.8", 80))
            value = sock.getsockname()[0]
            if value and not value.startswith("127."):
                candidates.append({"ip": value, "interface": "default", "kind": "wifi"})
        except Exception:
            pass
        finally:
            sock.close()
    order = {name: index for index, name in enumerate(preferred)}
    candidates.sort(key=lambda item: (0 if item["kind"] == "hotspot" else 1, order.get(item["interface"], 99), item["ip"]))
    unique = []
    seen = set()
    for item in candidates:
        if item["ip"] in seen:
            continue
        seen.add(item["ip"])
        unique.append(item)
    return unique


def detect_lan_ip() -> str | None:
    addresses = detect_share_addresses()
    return addresses[0]["ip"] if addresses else None


def atomic_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    temp.replace(path)


class InvitePortalManager:
    def __init__(self, version: str, pwa_root: Path, field_root: Path, port: int = 8792):
        self.version = version
        self.pwa_root = Path(pwa_root).resolve()
        self.field_root = Path(field_root).resolve()
        self.port = int(port)
        self.data_root = Path.home() / ".local" / "share" / "pocket-constellary" / "invite-portal"
        self.invites_dir = self.data_root / "invites"
        self.cache_dir = self.data_root / "cache"
        self.pending_path = Path.home() / ".config" / "pocket-constellary" / "pending-invite.json"
        self.invites_dir.mkdir(parents=True, exist_ok=True)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._server: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None
        self._lock = threading.RLock()
        self._last_error: str | None = None
        self._request_windows: dict[str, tuple[int, int]] = {}
        self.seed_release_candidates = [
            self.field_root / "seed" / f"cerbanimo-release-v{self.version}.cerb",
            self.field_root.parent / "seed" / f"cerbanimo-release-v{self.version}.cerb",
            self.pwa_root.parent / "seed" / f"cerbanimo-release-v{self.version}.cerb",
        ]


    def release_capsule(self) -> Path:
        for candidate in self.seed_release_candidates:
            if candidate.exists():
                return candidate
        raise FileNotFoundError("Signed Cerbanimo Seed release capsule is not available")

    def seed_apk(self) -> Path | None:
        candidates = [
            self.field_root / "seed" / "cerbanimo-seed.apk",
            self.field_root.parent / "seed" / "cerbanimo-seed.apk",
            self.pwa_root.parent / "seed" / "cerbanimo-seed.apk",
        ]
        return next((path for path in candidates if path.exists()), None)

    def share_addresses(self) -> list[dict]:
        return [
            {**item, "baseUrl": f"http://{item['ip']}:{self.port}"}
            for item in detect_share_addresses()
        ]

    def token_for(self, capsule: dict) -> str:
        return safe_token(str(capsule.get("id") or ""), f"invite-{int(time.time())}")[:48]

    def invite_path(self, token: str) -> Path:
        return self.invites_dir / f"{safe_token(token)}.json"

    def save_invite(self, capsule: dict) -> str:
        if not isinstance(capsule, dict) or not capsule.get("id") or not capsule.get("payload"):
            raise RuntimeError("Signed invitation capsule is malformed")
        token = self.token_for(capsule)
        atomic_json(self.invite_path(token), capsule)
        return token

    def get_invite(self, token: str) -> dict:
        path = self.invite_path(token)
        if not path.exists():
            raise FileNotFoundError("Invitation not found")
        return json.loads(path.read_text(encoding="utf-8"))

    def set_pending(self, capsule: dict) -> None:
        atomic_json(self.pending_path, capsule)

    def pending(self) -> dict | None:
        if not self.pending_path.exists():
            return None
        try:
            return json.loads(self.pending_path.read_text(encoding="utf-8"))
        except Exception:
            return None

    def consume_pending(self) -> None:
        self.pending_path.unlink(missing_ok=True)

    def start(self) -> dict:
        with self._lock:
            if self._server:
                return self.status()
            lan_ip = detect_lan_ip()
            if not lan_ip:
                return self.status()
            manager = self

            class Handler(BaseHTTPRequestHandler):
                protocol_version = "HTTP/1.1"
                server_version = f"CerbanimoWelcome/{manager.version}"

                def log_message(self, fmt: str, *args) -> None:
                    return

                def end_headers(self) -> None:
                    self.send_header("X-Content-Type-Options", "nosniff")
                    self.send_header("Referrer-Policy", "no-referrer")
                    self.send_header("X-Frame-Options", "DENY")
                    self.send_header(
                        "Content-Security-Policy",
                        "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; "
                        "script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; "
                        "form-action 'none'; frame-ancestors 'none'",
                    )
                    self.send_header("Cache-Control", "no-store")
                    super().end_headers()

                def rate_limited(self) -> bool:
                    client = str(self.client_address[0] or "unknown")
                    window = int(time.time() // 60)
                    with manager._lock:
                        current_window, count = manager._request_windows.get(client, (window, 0))
                        if current_window != window:
                            current_window, count = window, 0
                        count += 1
                        manager._request_windows[client] = (current_window, count)
                        if len(manager._request_windows) > 512:
                            manager._request_windows = {
                                key: value for key, value in manager._request_windows.items()
                                if value[0] >= window - 1
                            }
                    return count > 120

                def send_bytes(self, status: int, payload: bytes, content_type: str, filename: str | None = None) -> None:
                    self.send_response(status)
                    self.send_header("Content-Type", content_type)
                    if filename:
                        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
                    self.send_header("Content-Length", str(len(payload)))
                    self.end_headers()
                    self.wfile.write(payload)

                def send_file(self, path: Path, content_type: str, filename: str | None = None) -> None:
                    size = path.stat().st_size
                    if size > 2 * 1024 * 1024 * 1024:
                        raise RuntimeError("Requested artifact is too large")
                    self.send_response(200)
                    self.send_header("Content-Type", content_type)
                    self.send_header("Content-Disposition", f'attachment; filename="{safe_token(filename or path.name)}"')
                    self.send_header("Content-Length", str(size))
                    self.end_headers()
                    with path.open("rb") as source:
                        shutil.copyfileobj(source, self.wfile, length=1024 * 1024)

                def do_GET(self) -> None:
                    path = self.path.split("?", 1)[0]
                    try:
                        if self.rate_limited():
                            self.send_bytes(429, b'{"error":"Too many requests"}', "application/json")
                            return
                        if path == "/health":
                            body = json.dumps(manager.status(), indent=2).encode()
                            self.send_bytes(200, body, "application/json; charset=utf-8")
                            return
                        if path == "/logo.png":
                            logo = manager.pwa_root / "assets" / "cerbanimo-logo.png"
                            self.send_file(logo, "image/png")
                            return
                        match = re.fullmatch(r"/join/([A-Za-z0-9._-]+)", path)
                        if match:
                            token = match.group(1)
                            self.send_bytes(200, manager.join_page(token).encode(), "text/html; charset=utf-8")
                            return
                        match = re.fullmatch(r"/invite/([A-Za-z0-9._-]+)\.json", path)
                        if match:
                            capsule = manager.get_invite(match.group(1))
                            self.send_bytes(200, json.dumps(capsule, indent=2).encode(), "application/json; charset=utf-8", f"cerbanimo-invite-{match.group(1)[:12]}.json")
                            return
                        if path == "/download/field-kit.zip":
                            package = manager.field_kit_zip()
                            self.send_file(package, "application/zip", package.name)
                            return
                        if path == "/download/release.cerb":
                            package = manager.release_capsule()
                            self.send_file(package, "application/octet-stream", package.name)
                            return
                        if path == "/download/seed.apk":
                            package = manager.seed_apk()
                            if package is None:
                                self.send_error(404, "Cerbanimo Seed APK is not bundled in this Field Kit")
                                return
                            self.send_file(package, "application/vnd.android.package-archive", package.name)
                            return
                        match = re.fullmatch(r"/download/starter-pack/([A-Za-z0-9._-]+)\.zip", path)
                        if match:
                            package = manager.starter_pack_zip(match.group(1))
                            self.send_file(package, "application/zip", package.name)
                            return
                        match = re.fullmatch(r"/bootstrap/([A-Za-z0-9._-]+)\.sh", path)
                        if match:
                            base = manager.public_base_url()
                            script = manager.bootstrap_script(base, match.group(1)).encode()
                            self.send_bytes(200, script, "text/x-shellscript; charset=utf-8", "install-cerbanimo.sh")
                            return
                        self.send_error(404, "Cerbanimo invitation route not found")
                    except FileNotFoundError:
                        self.send_error(404, "Invitation not found")
                    except Exception:
                        self.send_bytes(500, b'{"error":"The invitation portal could not complete the request"}', "application/json")

            try:
                self._server = ThreadingHTTPServer(("0.0.0.0", self.port), Handler)
                self._thread = threading.Thread(target=self._server.serve_forever, daemon=True, name="cerbanimo-welcome")
                self._thread.start()
                self._last_error = None
            except Exception as error:
                self._server = None
                self._thread = None
                self._last_error = str(error)
            return self.status()

    def stop(self) -> dict:
        with self._lock:
            if self._server:
                self._server.shutdown()
                self._server.server_close()
            self._server = None
            self._thread = None
        return self.status()

    def public_base_url(self) -> str | None:
        addresses = self.share_addresses()
        return addresses[0]["baseUrl"] if addresses else None

    def status(self) -> dict:
        addresses = self.share_addresses()
        base = addresses[0]["baseUrl"] if addresses else None
        release_available = False
        try:
            release_available = self.release_capsule().exists()
        except Exception:
            pass
        return {
            "ok": True,
            "service": "cerbanimo-welcome-portal",
            "version": self.version,
            "running": bool(self._server),
            "lanAvailable": bool(base),
            "shareBaseUrl": base,
            "shareAddresses": addresses,
            "hotspotAvailable": any(item.get("kind") == "hotspot" for item in addresses),
            "seedReleaseAvailable": release_available,
            "seedApkAvailable": bool(self.seed_apk()),
            "port": self.port,
            "lastError": self._last_error,
        }

    def publish(self, capsule: dict) -> dict:
        token = self.save_invite(capsule)
        status = self.start()
        base = status.get("shareBaseUrl") if status.get("running") else None
        public_invite = f"{base}/invite/{token}.json" if base else None
        share_url = f"{base}/join/{token}" if base else None
        quest = (capsule.get("payload") or {}).get("quest") or {}
        inviter = (capsule.get("payload") or {}).get("inviter") or {}
        seed_release = "http://127.0.0.1:8787/field/invite/release.cerb"
        seed_invite = f"http://127.0.0.1:8787/field/invite/capsule/{token}.json"
        seed_launch = (
            "cerbanimo-seed://send?release=" + quote(seed_release, safe="")
            + "&invite=" + quote(seed_invite, safe="")
            + "&title=" + quote(str(quest.get("title") or "Cerbanimo Quest"), safe="")
            + "&inviter=" + quote(str(inviter.get("alias") or "Cerbanimo user"), safe="")
        )
        receive_launch = "cerbanimo-seed://receive?title=" + quote(str(quest.get("title") or "Cerbanimo Quest"), safe="")
        release_available = bool(status.get("seedReleaseAvailable"))
        return {
            **status,
            "token": token,
            "shareUrl": share_url,
            "inviteUrl": public_invite,
            "localOpenUrl": f"http://127.0.0.1:8787/?join={quote(public_invite, safe='')}" if public_invite else None,
            "starterPackUrl": f"/field/invite/starter-pack/{token}.zip",
            "releaseCapsuleUrl": f"/field/invite/release.cerb" if release_available else None,
            "seedLaunchUrl": seed_launch if release_available else None,
            "seedReceiveUrl": receive_launch if release_available else None,
            "seedApkUrl": f"{base}/download/seed.apk" if base and status.get("seedApkAvailable") else None,
            "qrUrl": f"/field/invite/qr/{token}.svg" if share_url else None,
            "fieldKitUrl": f"{base}/download/field-kit.zip" if base else None,
            "bootstrapUrl": f"{base}/bootstrap/{token}.sh" if base else None,
            "transportPriority": ["installed", *(["seed"] if release_available else []), "wifi-or-hotspot", "system-share"],
        }

    def _find_installer(self) -> Path:
        candidates = [
            self.field_root / "install-cerbanimo.sh",
            self.field_root / "install-pocket-constellary.sh",
            self.field_root.parent / "install-cerbanimo.sh",
            self.field_root.parent / "install-pocket-constellary.sh",
        ]
        for candidate in candidates:
            if candidate.exists():
                return candidate
        raise RuntimeError("Cerbanimo installer is missing from the Field Kit")

    def _find_command(self) -> Path:
        for name in ("cerbanimo", "constellary"):
            candidate = self.field_root / name
            if candidate.exists():
                return candidate
        raise RuntimeError("Cerbanimo lifecycle command is missing")

    def field_kit_zip(self) -> Path:
        target = self.cache_dir / f"cerbanimo-field-kit-v{self.version}.zip"
        source_files = [path for path in self.pwa_root.rglob("*") if path.is_file()]
        source_files += [Path(__file__), self._find_installer(), self.field_root / "field_server.py", self.field_root / "party_relay.py", self._find_command()]
        try:
            source_files.append(self.release_capsule())
        except Exception:
            pass
        if self.seed_apk():
            source_files.append(self.seed_apk())
        vendor_root = self.field_root / "vendor"
        if vendor_root.exists():
            source_files += [path for path in vendor_root.rglob("*") if path.is_file() and "__pycache__" not in path.parts and "tests" not in path.parts]
        newest = max(path.stat().st_mtime for path in source_files if path.exists())
        if target.exists() and target.stat().st_mtime >= newest:
            return target
        root_name = f"cerbanimo-field-kit-v{self.version}"
        installer = self._find_installer()
        command = self._find_command()
        with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
            for file in sorted(self.pwa_root.rglob("*")):
                if file.is_file():
                    archive.write(file, f"{root_name}/pwa/{file.relative_to(self.pwa_root)}")
            scripts = {
                Path(__file__): "invite_portal.py",
                self.field_root / "field_server.py": "field_server.py",
                self.field_root / "party_relay.py": "party_relay.py",
                command: "cerbanimo",
            }
            for file, name in scripts.items():
                if file.exists():
                    archive.write(file, f"{root_name}/tools/{name}")
            vendor = self.field_root / "vendor"
            if vendor.exists():
                for file in sorted(vendor.rglob("*")):
                    if file.is_file() and "__pycache__" not in file.parts and "tests" not in file.parts:
                        archive.write(file, f"{root_name}/tools/vendor/{file.relative_to(vendor)}")
            archive.write(installer, f"{root_name}/install-cerbanimo.sh")
            archive.writestr(f"{root_name}/install-pocket-constellary.sh", installer.read_text(encoding="utf-8"))
            try:
                release = self.release_capsule()
                archive.write(release, f"{root_name}/seed/{release.name}")
            except Exception:
                pass
            apk = self.seed_apk()
            if apk:
                archive.write(apk, f"{root_name}/seed/cerbanimo-seed.apk")
            archive.writestr(f"{root_name}/README.txt", self.field_kit_readme())
        return target

    def field_kit_readme(self) -> str:
        try:
            self.release_capsule()
            seed_path = """OPTIONAL CERBANIMO SEED PATH
1. Open Cerbanimo Seed and choose Receive Cerbanimo.
2. Confirm the matching code shown on both devices.
3. Seed verifies the signed release, starts Cerbanimo locally, and opens the invitation.

"""
        except FileNotFoundError:
            seed_path = """SECURITY NOTE
This build intentionally omits an obsolete signed Seed release capsule. Use the verified Field Kit path below until a matching release is signed.

"""
        return f"""CERBANIMO FIELD KIT {self.version}

{seed_path}VERIFIED FIELD KIT / NO INTERNET
1. Install Termux once.
2. Open Termux and paste: termux-setup-storage
3. In the extracted Field Kit folder, tap or copy: bash install-cerbanimo.sh
4. Cerbanimo opens at http://127.0.0.1:8787 with future upgrades enabled.

The installer creates cerbanimo-open, cerbanimo-update, cerbanimo-doctor, and compatible constellary-* aliases.
"""

    def starter_pack_zip(self, token: str) -> Path:
        capsule = self.get_invite(token)
        target = self.cache_dir / f"cerbanimo-starter-{safe_token(token)[:12]}-v{self.version}.zip"
        field_kit = self.field_kit_zip()
        invite_file = self.invite_path(token)
        try:
            release = self.release_capsule()
        except FileNotFoundError:
            release = None
        newest = max(path.stat().st_mtime for path in (field_kit, invite_file, release) if path)
        if target.exists() and target.stat().st_mtime >= newest:
            return target
        root_name = "CERBANIMO-START-HERE"
        join_script = f"""#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
HERE="$(cd "$(dirname "${{BASH_SOURCE[0]}}")" && pwd)"
termux-setup-storage || true
pkg install -y python curl
UNPACKED="$(mktemp -d "${{TMPDIR:-/data/data/com.termux/files/usr/tmp}}/cerbanimo-starter.XXXXXX")"
trap 'rm -rf "$UNPACKED"' EXIT
python - "$HERE/{field_kit.name}" "$UNPACKED" <<'PY'
import pathlib, stat, sys, zipfile
source=pathlib.Path(sys.argv[1]); target=pathlib.Path(sys.argv[2]).resolve(); total=0
with zipfile.ZipFile(source) as archive:
    members=archive.infolist()
    if len(members)>20000: raise SystemExit("Archive has too many entries")
    for item in members:
        name=item.filename.replace("\\\\","/")
        mode=(item.external_attr>>16)&0o170000
        dest=(target/name).resolve()
        if not name or name.startswith("/") or (dest != target and target not in dest.parents):
            raise SystemExit("Unsafe archive path")
        if mode==stat.S_IFLNK or item.file_size>512*1024*1024:
            raise SystemExit("Unsafe archive entry")
        total+=item.file_size
        if total>2*1024*1024*1024: raise SystemExit("Archive is too large")
    archive.extractall(target)
PY
ROOT="$(find "$UNPACKED" -type f -path '*/pwa/index.html' -print -quit | sed 's#/pwa/index.html##')"
[[ -n "$ROOT" && -f "$ROOT/install-cerbanimo.sh" ]] || {{ echo "Invalid Field Kit archive" >&2; exit 1; }}
CERBANIMO_PENDING_INVITE="$HERE/invite.json" bash "$ROOT/install-cerbanimo.sh"
"""
        with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.write(field_kit, f"{root_name}/{field_kit.name}")
            if release:
                archive.write(release, f"{root_name}/{release.name}")
            archive.writestr(f"{root_name}/invite.json", json.dumps(capsule, indent=2))
            archive.writestr(f"{root_name}/install-and-join.sh", join_script)
            archive.writestr(f"{root_name}/START-HERE.html", self.offline_start_page(capsule))
            archive.writestr(f"{root_name}/README.txt", "Open START-HERE.html. Install the verified Field Kit in Termux; the signed invitation opens automatically. Seed is offered only when a matching signed release is bundled.\n")
        return target

    def bootstrap_script(self, base_url: str | None, token: str) -> str:
        if not base_url:
            raise RuntimeError("The local welcome site has no Wi-Fi address")
        token = safe_token(token)
        kit_name = f"cerbanimo-field-kit-v{self.version}.zip"
        return f"""#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
termux-setup-storage || true
pkg install -y python curl
WORK=\"$(mktemp -d \"${{TMPDIR:-$PREFIX/tmp}}/cerbanimo-install.XXXXXX\")\"
trap 'rm -rf \"$WORK\"' EXIT
curl -fL {shlex.quote(base_url + '/download/field-kit.zip')} -o \"$WORK/{kit_name}\"
curl -fL {shlex.quote(base_url + '/invite/' + token + '.json')} -o \"$WORK/invite.json\"
mkdir -p \"$WORK/unpacked\"
python - \"$WORK/{kit_name}\" \"$WORK/unpacked\" <<'PY'
import pathlib, stat, sys, zipfile
source=pathlib.Path(sys.argv[1]); target=pathlib.Path(sys.argv[2]).resolve(); total=0
with zipfile.ZipFile(source) as archive:
    members=archive.infolist()
    if len(members)>20000: raise SystemExit("Archive has too many entries")
    for item in members:
        name=item.filename.replace("\\\\","/")
        mode=(item.external_attr>>16)&0o170000
        dest=(target/name).resolve()
        if not name or name.startswith("/") or (dest != target and target not in dest.parents):
            raise SystemExit("Unsafe archive path")
        if mode==stat.S_IFLNK or item.file_size>512*1024*1024:
            raise SystemExit("Unsafe archive entry")
        total+=item.file_size
        if total>2*1024*1024*1024: raise SystemExit("Archive is too large")
    archive.extractall(target)
PY
ROOT=\"$(find \"$WORK/unpacked\" -type f -path '*/pwa/index.html' -print -quit | sed 's#/pwa/index.html##')\"
[[ -n \"$ROOT\" && -f \"$ROOT/install-cerbanimo.sh\" ]] || {{ echo 'Invalid Field Kit archive' >&2; exit 1; }}
CERBANIMO_PENDING_INVITE=\"$WORK/invite.json\" bash \"$ROOT/install-cerbanimo.sh\"
"""

    def join_page(self, token: str) -> str:
        capsule = self.get_invite(token)
        payload = capsule.get("payload") or {}
        quest = payload.get("quest") or {}
        role = payload.get("role") or {}
        inviter = payload.get("inviter") or {}
        base = self.public_base_url()
        invite_url = f"{base}/invite/{safe_token(token)}.json"
        local_open = f"http://127.0.0.1:8787/?join={quote(invite_url, safe='')}"
        seed_receive = "cerbanimo-seed://receive?source=" + quote(invite_url, safe="") + "&title=" + quote(str(quest.get("title") or "Cerbanimo Quest"), safe="")
        command = f"curl -fsSL {base}/bootstrap/{safe_token(token)}.sh | bash"
        release_available = bool(self.status().get("seedReleaseAvailable"))
        apk_link = "<a class='secondary' href='/download/seed.apk'>DOWNLOAD SEED APK</a>" if release_available and self.seed_apk() else ""
        seed_route = (
            "<section class='route'><span class='route-tag'>GUIDED NEARBY</span><h2>Use Cerbanimo Seed</h2>"
            "<p>Seed pairs the two phones, verifies the release, starts the local client, and opens this invitation.</p>"
            f"<div class='actions'><a class='primary' href='{html.escape(seed_receive)}'>OPEN SEED</a>{apk_link}"
            "<a class='secondary' href='/download/release.cerb'>DOWNLOAD SIGNED RELEASE</a></div></section>"
            if release_available else ""
        )
        addresses = self.share_addresses()
        route_label = "hotspot" if any(item.get("kind") == "hotspot" for item in addresses) else "same Wi-Fi"
        return f"""<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><meta name='theme-color' content='#050505'><title>Join {html.escape(str(quest.get('title') or 'Cerbanimo'))}</title><style>{self.portal_css()}</style></head><body><main><img class='logo' src='/logo.png' alt='Cerbanimo'><p class='eyebrow'>SIGNED QUEST INVITATION</p><h1>{html.escape(str(quest.get('title') or 'Join Cerbanimo'))}</h1><p class='lead'>{html.escape(str(quest.get('description') or 'A local-first quest is waiting for you.'))}</p><section class='role'><span>YOUR ROLE</span><strong>{html.escape(str(role.get('name') or 'Contributor'))}</strong><p>{html.escape(str(role.get('blurb') or 'Help the party advance the quest.'))}</p></section><p class='from'>Invited by {html.escape(str(inviter.get('alias') or 'a Cerbanimo user'))}</p><div class='route-stack'><section class='route recommended'><span class='route-tag'>FASTEST</span><h2>Already have Cerbanimo?</h2><p>Open this signed invitation in your existing local client.</p><a class='primary' href='{html.escape(local_open)}'>OPEN CERBANIMO</a></section><section class='route'><span class='route-tag'>GUIDED NEARBY</span><h2>Use Cerbanimo Seed</h2><p>Seed pairs the two phones, verifies the release, starts the local client, and opens this invitation without terminal commands or internet access.</p><div class='actions'><a class='primary' href='{html.escape(seed_receive)}'>OPEN SEED</a>{apk_link}<a class='secondary' href='/download/release.cerb'>DOWNLOAD SIGNED RELEASE</a></div></section><section class='route'><span class='route-tag'>NO SEED · NO INTERNET</span><h2>Install over {html.escape(route_label)}</h2><p>This welcome site and the files below are served directly from the inviter’s phone. A personal hotspot works even when it has no internet connection.</p><ol><li>Install Termux once.</li><li>Open Termux and paste the setup line below.</li><li>Cerbanimo starts locally and opens this invitation automatically.</li></ol><button id='copy'>COPY SETUP LINE</button><pre id='command'>{html.escape(command)}</pre><div class='actions'><a class='primary' href='/download/starter-pack/{safe_token(token)}.zip'>DOWNLOAD COMPLETE STARTER PACK</a><a class='secondary' href='/download/field-kit.zip'>DOWNLOAD FIELD KIT</a></div></section></div><footer>This welcome site is served by the inviter’s Cerbanimo client. Release and invitation signatures are verified separately; the transport cannot sign for either Passport.</footer></main><script>document.querySelector('#copy').onclick=async()=>{{await navigator.clipboard.writeText(document.querySelector('#command').textContent);document.querySelector('#copy').textContent='COPIED';}};</script></body></html>"""

    def offline_start_page(self, capsule: dict) -> str:
        payload = capsule.get("payload") or {}
        quest = payload.get("quest") or {}
        return f"""<!doctype html><html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Cerbanimo starter pack</title><style>{self.portal_css()}</style><body><main><img class='logo' src='data:image/png;base64,{self.logo_base64()}' alt='Cerbanimo'><p class='eyebrow'>OFFLINE CERBANIMO STARTER</p><h1>{html.escape(str(quest.get('title') or 'Join Cerbanimo'))}</h1><p class='lead'>This pack contains a signed Cerbanimo release and the signed quest invitation.</p><section class='route recommended'><span class='route-tag'>CERBANIMO SEED</span><h2>Guided installation</h2><p>Open Seed, choose Receive Cerbanimo, and select the signed <code>.cerb</code> release in this folder when prompted. Seed verifies and launches it.</p></section><section class='route'><span class='route-tag'>NO SEED</span><h2>One-time Termux setup</h2><ol><li>Install and open Termux.</li><li>Allow storage when Android asks.</li><li>Open this extracted <code>CERBANIMO-START-HERE</code> folder.</li><li>Paste <code>bash install-and-join.sh</code>.</li></ol><p>Cerbanimo opens at <code>http://127.0.0.1:8787</code>, imports the invitation automatically, and remains upgradeable.</p></section></main></body></html>"""

    # This definition intentionally supersedes the legacy page above so an old
    # signed release is never advertised after its bundled PWA is superseded.
    def join_page(self, token: str) -> str:
        capsule = self.get_invite(token)
        payload = capsule.get("payload") or {}
        quest = payload.get("quest") or {}
        role = payload.get("role") or {}
        inviter = payload.get("inviter") or {}
        base = self.public_base_url()
        invite_url = f"{base}/invite/{safe_token(token)}.json"
        local_open = f"http://127.0.0.1:8787/?join={quote(invite_url, safe='')}"
        command = f"curl -fsSL {base}/bootstrap/{safe_token(token)}.sh | bash"
        title = html.escape(str(quest.get("title") or "Join Cerbanimo"))
        description = html.escape(str(quest.get("description") or "A local-first quest is waiting for you."))
        role_name = html.escape(str(role.get("name") or "Contributor"))
        role_blurb = html.escape(str(role.get("blurb") or "Help the party advance the quest."))
        inviter_name = html.escape(str(inviter.get("alias") or "a Cerbanimo user"))
        return f"""<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><meta name='theme-color' content='#050505'><title>{title}</title><style>{self.portal_css()}</style></head><body><main><img class='logo' src='/logo.png' alt='Cerbanimo'><p class='eyebrow'>SIGNED QUEST INVITATION</p><h1>{title}</h1><p class='lead'>{description}</p><section class='role'><span>YOUR ROLE</span><strong>{role_name}</strong><p>{role_blurb}</p></section><p class='from'>Invited by {inviter_name}</p><div class='route-stack'><section class='route recommended'><span class='route-tag'>FASTEST</span><h2>Already have Cerbanimo?</h2><p>Open this signed invitation in your existing local client.</p><a class='primary' href='{html.escape(local_open)}'>OPEN CERBANIMO</a></section><section class='route'><span class='route-tag'>LOCAL FIELD KIT</span><h2>Install from the inviter</h2><p>These files are served directly from the inviter's device. The installer rejects unsafe archive entries and stages the signed invitation.</p><button id='copy'>COPY SETUP LINE</button><pre id='command'>{html.escape(command)}</pre><div class='actions'><a class='primary' href='/download/starter-pack/{safe_token(token)}.zip'>DOWNLOAD STARTER PACK</a><a class='secondary' href='/download/field-kit.zip'>DOWNLOAD FIELD KIT</a></div></section></div><footer>Invitation signatures are verified separately. Seed is offered only when a current matching signed release is bundled.</footer></main><script>document.querySelector('#copy').onclick=async()=>{{await navigator.clipboard.writeText(document.querySelector('#command').textContent);document.querySelector('#copy').textContent='COPIED';}};</script></body></html>"""

    def offline_start_page(self, capsule: dict) -> str:
        quest = ((capsule.get("payload") or {}).get("quest") or {})
        title = html.escape(str(quest.get("title") or "Join Cerbanimo"))
        return f"""<!doctype html><html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Cerbanimo starter pack</title><style>{self.portal_css()}</style><body><main><img class='logo' src='data:image/png;base64,{self.logo_base64()}' alt='Cerbanimo'><p class='eyebrow'>OFFLINE CERBANIMO STARTER</p><h1>{title}</h1><p class='lead'>This pack contains the verified Field Kit and signed quest invitation.</p><section class='route recommended'><span class='route-tag'>TERMUX</span><h2>One-time local setup</h2><ol><li>Install and open Termux.</li><li>Allow storage when Android asks.</li><li>Open this extracted <code>CERBANIMO-START-HERE</code> folder.</li><li>Run <code>bash install-and-join.sh</code>.</li></ol><p>The installer validates the archive structure, opens Cerbanimo at <code>http://127.0.0.1:8787</code>, and stages the invitation.</p></section></main></body></html>"""

    def logo_base64(self) -> str:
        logo = self.pwa_root / "assets" / "cerbanimo-logo.png"
        return base64.b64encode(logo.read_bytes()).decode("ascii") if logo.exists() else ""

    def portal_css(self) -> str:
        return """*{box-sizing:border-box}html{background:#030205;color-scheme:dark}body{margin:0;min-height:100vh;background:linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px),#030205;background-size:96px 96px;color:#f7f4fb;font-family:Inter,system-ui,-apple-system,sans-serif}main{width:min(780px,100%);margin:auto;padding:28px 20px 64px}.logo{display:block;width:min(460px,90vw);margin:0 auto 6px}.eyebrow{color:#ff6b68;font:750 10px system-ui,sans-serif;letter-spacing:.15em;text-transform:uppercase}.lead{color:#aaa3b6;font-size:17px;line-height:1.6;max-width:62ch}h1{font:850 clamp(40px,9vw,74px)/.9 Arial Narrow,Roboto Condensed,system-ui,sans-serif;letter-spacing:-.045em;margin:10px 0 18px}h2{font:800 26px/1 Arial Narrow,Roboto Condensed,system-ui,sans-serif;letter-spacing:-.025em;margin:7px 0 11px}.role,section{margin:14px 0;padding:18px;border:1px solid rgba(255,255,255,.13);border-radius:10px;background:#09070e}.role{border-left:3px solid #ff6b68}.role span{display:block;color:#ff6b68;font:700 9px ui-monospace,monospace;letter-spacing:.1em}.role strong{display:block;font:800 28px Arial Narrow,Roboto Condensed,system-ui,sans-serif;margin-top:6px}.route-stack{display:grid;gap:2px}.route{position:relative}.route.recommended{border-left:3px solid #f12a83}.route-tag{display:inline-block;color:#ff7884;font:700 9px system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase}.actions{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}a,button{display:inline-flex;justify-content:center;align-items:center;min-height:44px;padding:0 16px;border-radius:7px;border:1px solid rgba(255,255,255,.16);background:#0b0810;color:#fff;text-decoration:none;font-weight:750;letter-spacing:.02em}.primary{background:#ff6571;color:#13050a;border-color:#ff6571}.secondary{background:#0b0810}pre{white-space:pre-wrap;word-break:break-all;padding:13px;border-radius:7px;background:#030205;border:1px solid rgba(255,255,255,.13);color:#79d9b4}code{color:#ff858c}li{margin:9px 0;color:#aaa3b6}footer{margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,.10);color:#7e7787;font-size:12px;line-height:1.55}.from{color:#8f8898}@media(max-width:560px){main{padding-inline:14px}.actions{display:grid}.actions>*{width:100%}}"""

    def qr_svg(self, token: str) -> bytes:
        status = self.publish(self.get_invite(token))
        share_url = status.get("shareUrl")
        if not share_url:
            raise RuntimeError("No Wi-Fi invitation URL is available")
        try:
            import qrcode
            from qrcode.image.svg import SvgPathImage
        except Exception as error:
            raise RuntimeError("QR renderer is unavailable") from error
        output = io.BytesIO()
        image = qrcode.make(share_url, image_factory=SvgPathImage, box_size=8, border=3)
        image.save(output)
        return output.getvalue()
