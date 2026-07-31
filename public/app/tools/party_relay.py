#!/usr/bin/env python3
"""Cerbanimo Living Party Relay.

A small append-only transport for signed party-event capsules. It stores no
canonical quest state and cannot authorize mutations. Rooms are protected by a
random room key carried in signed party invitations.

Optional Web Push support is enabled when pywebpush is installed and these
variables are set:
  CERBANIMO_VAPID_PRIVATE_KEY=/path/to/private.pem
  CERBANIMO_VAPID_PUBLIC_KEY=<base64url uncompressed P-256 public key>
  CERBANIMO_VAPID_SUBJECT=mailto:admin@example.org
"""
from __future__ import annotations

import hashlib
import hmac
import ipaddress
import json
import os
import re
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

VERSION = "1.3.0"
HOST = os.environ.get("CERBANIMO_RELAY_HOST", "127.0.0.1")
PORT = int(os.environ.get("CERBANIMO_RELAY_PORT", "8790"))
DATA_PATH = Path(os.environ.get("CERBANIMO_RELAY_DATA", Path.home() / ".local/share/pocket-constellary/party-relay.json")).expanduser()
MAX_EVENTS_PER_ROOM = int(os.environ.get("CERBANIMO_RELAY_MAX_EVENTS", "5000"))
MAX_REQUEST_BYTES = int(os.environ.get("CERBANIMO_RELAY_MAX_REQUEST_BYTES", str(2 * 1024 * 1024)))
MAX_ROOMS = int(os.environ.get("CERBANIMO_RELAY_MAX_ROOMS", "500"))
MAX_SUBSCRIPTIONS_PER_ROOM = int(os.environ.get("CERBANIMO_RELAY_MAX_SUBSCRIPTIONS", "64"))
VAPID_PRIVATE_KEY = os.environ.get("CERBANIMO_VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC_KEY = os.environ.get("CERBANIMO_VAPID_PUBLIC_KEY", "")
VAPID_SUBJECT = os.environ.get("CERBANIMO_VAPID_SUBJECT", "mailto:admin@example.org")

try:
    from pywebpush import WebPushException, webpush  # type: ignore
except Exception:  # pragma: no cover
    WebPushException = Exception
    webpush = None

LOCK = threading.RLock()
CONDITION = threading.Condition(LOCK)
STATE = {"version": 1, "rooms": {}}
RATE_BUCKETS: dict[tuple[str, int], int] = {}


def key_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def load_state() -> None:
    global STATE
    if DATA_PATH.exists():
        try:
            loaded = json.loads(DATA_PATH.read_text(encoding="utf-8"))
            if isinstance(loaded, dict) and isinstance(loaded.get("rooms"), dict):
                STATE = loaded
        except Exception:
            pass


def persist() -> None:
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    temp = DATA_PATH.with_suffix(DATA_PATH.suffix + ".tmp")
    temp.write_text(json.dumps(STATE, indent=2) + "\n", encoding="utf-8")
    temp.chmod(0o600)
    temp.replace(DATA_PATH)


def room_for(room_id: str, room_key: str, create: bool = False) -> dict:
    if not re.fullmatch(r"[A-Za-z0-9_.:-]{8,200}", room_id or ""):
        raise ValueError("roomId is malformed")
    if not re.fullmatch(r"[A-Za-z0-9_-]{40,128}", room_key or ""):
        raise ValueError("roomKey is malformed")
    rooms = STATE["rooms"]
    room = rooms.get(room_id)
    digest = key_hash(room_key)
    if room is None:
        if not create:
            raise KeyError("unknown room")
        if len(rooms) >= MAX_ROOMS:
            raise RuntimeError("relay room capacity reached")
        room = {"keyHash": digest, "cursor": 0, "events": [], "subscriptions": [], "createdAt": time.time(), "updatedAt": time.time()}
        rooms[room_id] = room
    if not hmac.compare_digest(str(room.get("keyHash") or ""), digest):
        raise PermissionError("room key rejected")
    room["updatedAt"] = time.time()
    return room


def valid_push_endpoint(value: str) -> bool:
    parsed = urlparse(str(value or ""))
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.fragment:
        return False
    host = parsed.hostname.lower()
    if host == "localhost" or host.endswith(".local"):
        return False
    try:
        addresses = socket.getaddrinfo(host, parsed.port or 443, type=socket.SOCK_STREAM)
        return bool(addresses) and all(
            not (ipaddress.ip_address(item[4][0]).is_private or ipaddress.ip_address(item[4][0]).is_loopback or ipaddress.ip_address(item[4][0]).is_link_local)
            for item in addresses
        )
    except Exception:
        return False


def rate_allowed(client: str, limit: int = 120) -> bool:
    window = int(time.time() // 60)
    key = (client, window)
    with LOCK:
        RATE_BUCKETS[key] = RATE_BUCKETS.get(key, 0) + 1
        for stale in [item for item in RATE_BUCKETS if item[1] < window - 1]:
            RATE_BUCKETS.pop(stale, None)
        return RATE_BUCKETS[key] <= limit


def push_update(room: dict, capsule: dict) -> None:
    if not webpush or not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        return
    payload = capsule.get("payload") or {}
    data = json.dumps({
        "title": "Your shared quest moved",
        "body": payload.get("publicSummary") or "A party member updated the quest.",
        "tag": f"party-{payload.get('partyId', 'update')}",
        "url": "./?sync=1",
    })
    alive = []
    for subscription in list(room.get("subscriptions") or []):
        try:
            webpush(
                subscription_info=subscription,
                data=data,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_SUBJECT},
                ttl=60,
            )
            alive.append(subscription)
        except WebPushException as error:
            status = getattr(getattr(error, "response", None), "status_code", None)
            if status not in (404, 410):
                alive.append(subscription)
        except Exception:
            alive.append(subscription)
    with LOCK:
        room["subscriptions"] = alive
        persist()


class Handler(BaseHTTPRequestHandler):
    server_version = f"CerbanimoPartyRelay/{VERSION}"
    protocol_version = "HTTP/1.1"

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.reply({"error": "cross-origin access is disabled"}, status=403)

    def do_GET(self) -> None:
        if not rate_allowed(str(self.client_address[0]), 120):
            self.reply({"error": "rate limit exceeded"}, status=429)
            return
        parsed = urlparse(self.path)
        if parsed.path in ("/", "/health"):
            with LOCK:
                room_count = len(STATE["rooms"])
                event_count = sum(len(room.get("events") or []) for room in STATE["rooms"].values())
            self.reply({"ok": True, "service": "cerbanimo-party-relay", "version": VERSION, "rooms": room_count, "events": event_count, "pushSupported": bool(webpush and VAPID_PRIVATE_KEY and VAPID_PUBLIC_KEY)})
            return
        if parsed.path == "/v1/config":
            self.reply({"ok": True, "version": VERSION, "pushSupported": bool(webpush and VAPID_PRIVATE_KEY and VAPID_PUBLIC_KEY), "vapidPublicKey": VAPID_PUBLIC_KEY or None})
            return
        self.reply({"error": "not found"}, status=404)

    def do_POST(self) -> None:
        if not rate_allowed(str(self.client_address[0]), 120):
            self.reply({"error": "rate limit exceeded"}, status=429)
            return
        if self.headers.get("Sec-Fetch-Site") == "cross-site":
            self.reply({"error": "cross-site relay mutations are disabled"}, status=403)
            return
        parsed = urlparse(self.path)
        try:
            body = self.read_json()
        except ValueError as error:
            self.reply({"error": str(error)}, status=413)
            return
        if parsed.path == "/v1/events/pull":
            try:
                room_id = str(body.get("roomId") or "")
                room_key = str(body.get("roomKey") or "")
                after = max(0, int(body.get("after") or 0))
                wait = max(0, min(25, int(body.get("wait") or 0)))
                with CONDITION:
                    room = room_for(room_id, room_key, create=False)
                    if wait and not any(int(item["cursor"]) > after for item in room.get("events") or []):
                        CONDITION.wait(timeout=wait)
                    events = [item for item in room.get("events") or [] if int(item["cursor"]) > after]
                    cursor = int(room.get("cursor") or 0)
                self.reply({"ok": True, "roomId": room_id, "cursor": cursor, "events": events})
            except KeyError:
                self.reply({"error": "unknown room"}, status=404)
            except PermissionError:
                self.reply({"error": "room key rejected"}, status=403)
            except Exception as error:
                self.reply({"error": str(error)}, status=400)
            return
        if parsed.path == "/v1/events":
            try:
                room_id = str(body.get("roomId") or "")
                room_key = str(body.get("roomKey") or "")
                capsule = body.get("capsule")
                if not isinstance(capsule, dict) or not capsule.get("id") or capsule.get("kind") != "party-event":
                    raise ValueError("a signed party-event capsule is required")
                payload = capsule.get("payload") or {}
                if payload.get("roomId") != room_id or payload.get("partyId") != room_id:
                    raise ValueError("capsule room does not match request room")
                with CONDITION:
                    room = room_for(room_id, room_key, create=True)
                    existing = next((item for item in room.get("events") or [] if item.get("capsule", {}).get("id") == capsule.get("id")), None)
                    if existing:
                        cursor = existing["cursor"]
                    else:
                        room["cursor"] = int(room.get("cursor") or 0) + 1
                        cursor = room["cursor"]
                        room.setdefault("events", []).append({"cursor": cursor, "receivedAt": time.time(), "capsule": capsule})
                        room["events"] = room["events"][-MAX_EVENTS_PER_ROOM:]
                        persist()
                        CONDITION.notify_all()
                if not existing:
                    threading.Thread(target=push_update, args=(room, capsule), daemon=True).start()
                self.reply({"ok": True, "cursor": cursor, "duplicate": bool(existing)}, status=201 if not existing else 200)
            except PermissionError:
                self.reply({"error": "room key rejected"}, status=403)
            except Exception as error:
                self.reply({"error": str(error)}, status=400)
            return
        if parsed.path == "/v1/subscriptions":
            try:
                room_id = str(body.get("roomId") or "")
                room_key = str(body.get("roomKey") or "")
                subscription = body.get("subscription")
                if not isinstance(subscription, dict) or not valid_push_endpoint(str(subscription.get("endpoint") or "")):
                    raise ValueError("valid push subscription required")
                with LOCK:
                    room = room_for(room_id, room_key, create=True)
                    existing = {item.get("endpoint"): item for item in room.get("subscriptions") or []}
                    existing[subscription["endpoint"]] = subscription
                    room["subscriptions"] = list(existing.values())[-MAX_SUBSCRIPTIONS_PER_ROOM:]
                    persist()
                self.reply({"ok": True, "subscriptions": len(room["subscriptions"])}, status=201)
            except PermissionError:
                self.reply({"error": "room key rejected"}, status=403)
            except Exception as error:
                self.reply({"error": str(error)}, status=400)
            return
        self.reply({"error": "not found"}, status=404)

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length > MAX_REQUEST_BYTES:
            raise ValueError("request exceeds relay size limit")
        if str(self.headers.get("Content-Type") or "").split(";", 1)[0].lower() != "application/json":
            raise ValueError("relay POST requests require application/json")
        raw = self.rfile.read(length) if length else b"{}"
        try:
            value = json.loads(raw)
            return value if isinstance(value, dict) else {}
        except Exception:
            return {}

    def reply(self, value: dict, status: int = 200) -> None:
        payload = b"" if status == 204 else json.dumps(value).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        if payload:
            self.wfile.write(payload)

    def log_message(self, fmt: str, *args) -> None:
        print(f"[{self.log_date_time_string()}] {fmt % args}", flush=True)


def main() -> None:
    load_state()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Cerbanimo Living Party Relay {VERSION}", flush=True)
    print(f"Listening on http://{HOST}:{PORT}", flush=True)
    print(f"Data: {DATA_PATH}", flush=True)
    print(f"Web Push: {'ready' if webpush and VAPID_PRIVATE_KEY and VAPID_PUBLIC_KEY else 'not configured'}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
