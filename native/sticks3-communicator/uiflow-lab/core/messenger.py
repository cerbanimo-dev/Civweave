"""Bounded direct-peer message queue with explicit application receipts.

Caller supplies monotonic seconds and moves returned bytes through a transport.
A returned transmit frame is only an attempt; only a correlated application ACK
changes its state to delivered. Correlation is NOT cryptographic authentication:
an attacker able to inject frames with the expected peer ID and message ID can
forge an ACK. The BLE lab has no privacy or authenticated-identity guarantee.

Retry timing after enqueue at t=0 with a working link: attempts at 0, 2, 6, 14;
fail at 30 without an ACK. Offline unsent records expire after 120 seconds.
Persisted unfinished records are interrupted and require explicit user retry;
wall time cannot be reconstructed from the previous process's monotonic clock.
"""

from . import protocol

MAX_OUTBOX = 16
MAX_INBOX = 32
MAX_SEEN = 64
MAX_EVENTS = 64
MAX_ATTEMPTS = 4
TTL_SECONDS = 120
_RETRY_DELAYS = (2, 4, 8, 16)
_PENDING = ("queued", "sent")
_STATES = ("queued", "sent", "delivered", "failed", "expired")
_REASONS = ("", "acknowledgement_timeout", "ttl_elapsed", "restart_requires_retry")


def _random_id():
    import os
    return os.urandom(8)


def _time(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("Time must be monotonic seconds")
    if value < 0 or value != value or value == float("inf"):
        raise ValueError("Time must be finite and nonnegative")
    return value


def _integer(value, minimum, maximum):
    return type(value) is int and minimum <= value <= maximum


class Messenger:
    def __init__(self, node_id, id_factory=None):
        self.node_id = protocol.validate_node_id(node_id)
        self.id_factory = id_factory if id_factory is not None else _random_id
        self.outbox = []
        self.inbox = []
        self._seen = []
        self._events = []

    def _event(self, event, message_id="", peer="", reason=""):
        self._events.append({"event": event, "id": message_id, "peer": peer, "reason": reason})
        if len(self._events) > MAX_EVENTS:
            self._events.pop(0)

    def drain_events(self):
        result = self._events
        self._events = []
        return result

    def queue_text(self, recipient, body, now):
        now = _time(now)
        protocol.validate_node_id(recipient)
        if recipient == self.node_id:
            raise ValueError("Choose another node as recipient")
        ident = protocol.id_hex(self.id_factory())
        protocol.encode(protocol.TEXT, ident, self.node_id, recipient, body)
        if any(record["id"] == ident for record in self.outbox):
            raise ValueError("Message ID collision; retry with a fresh random ID")
        if len(self.outbox) >= MAX_OUTBOX:
            for index in range(len(self.outbox)):
                if self.outbox[index]["state"] not in _PENDING:
                    self.outbox.pop(index)
                    break
            else:
                raise OverflowError("Outbox full; pending messages are preserved")
        self.outbox.append({"id": ident, "to": recipient, "body": body,
                            "state": "queued", "attempts": 0, "reason": "",
                            "created_at": now, "expires_at": now + TTL_SECONDS,
                            "next_try": now})
        self._event("queued", ident, recipient)
        return ident

    def tick(self, now, connected):
        now = _time(now)
        outgoing = []
        for record in self.outbox:
            if record["state"] not in _PENDING:
                continue
            if now >= record["expires_at"]:
                record["state"] = "expired"
                record["reason"] = "ttl_elapsed"
                self._event("expired", record["id"], record["to"], record["reason"])
                continue
            if now < record["next_try"]:
                continue
            if record["attempts"] >= MAX_ATTEMPTS:
                record["state"] = "failed"
                record["reason"] = "acknowledgement_timeout"
                self._event("failed", record["id"], record["to"], record["reason"])
                continue
            if not connected:
                continue
            outgoing.append(protocol.encode(protocol.TEXT, record["id"], self.node_id,
                                            record["to"], record["body"]))
            record["state"] = "sent"
            record["next_try"] = now + _RETRY_DELAYS[record["attempts"]]
            record["attempts"] += 1
            self._event("transmit", record["id"], record["to"])
        return outgoing

    def receive(self, frame, now):
        now = _time(now)
        packet = protocol.decode(frame)
        ident, sender = packet["id"], packet["from"]
        if packet["to"] != self.node_id or sender == self.node_id:
            self._event("ignored", ident, sender, "wrong_destination_or_self")
            return []
        if packet["kind"] == protocol.ACK:
            for record in self.outbox:
                if (record["id"] == ident and record["to"] == sender
                        and record["state"] == "sent" and record["attempts"] > 0):
                    if now >= record["expires_at"]:
                        record["state"] = "expired"
                        record["reason"] = "ttl_elapsed"
                        self._event("expired", ident, sender, "ttl_elapsed")
                    elif record["attempts"] == MAX_ATTEMPTS and now >= record["next_try"]:
                        record["state"] = "failed"
                        record["reason"] = "acknowledgement_timeout"
                        self._event("failed", ident, sender, "acknowledgement_timeout")
                    else:
                        record["state"] = "delivered"
                        self._event("delivered", ident, sender)
                    return []
            self._event("ignored", ident, sender, "unmatched_ack")
            return []
        key = sender + ":" + ident
        if key in self._seen:
            self._seen.remove(key)
            self._seen.append(key)
            self._event("duplicate", ident, sender)
        else:
            self.inbox.append({"id": ident, "from": sender, "body": packet["body"],
                               "received_at": now})
            if len(self.inbox) > MAX_INBOX:
                self.inbox.pop(0)
            self._seen.append(key)
            if len(self._seen) > MAX_SEEN:
                # Replayed old IDs can move ahead of newer inbox IDs in the
                # LRU. Pin the 32 retained inbox IDs so duplicate suppression
                # and export/import stay consistent; evict the oldest other
                # entry. MAX_SEEN > MAX_INBOX guarantees a candidate exists.
                pinned = [item["from"] + ":" + item["id"] for item in self.inbox]
                for index in range(len(self._seen)):
                    if self._seen[index] not in pinned:
                        self._seen.pop(index)
                        break
            self._event("received", ident, sender)
        return [protocol.encode(protocol.ACK, ident, self.node_id, sender)]

    def export_state(self):
        """No process-uptime values are persisted. No file IO happens here."""
        outgoing = []
        for record in self.outbox:
            outgoing.append({key: record[key] for key in
                             ("id", "to", "body", "state", "attempts", "reason")})
        incoming = []
        for record in self.inbox:
            incoming.append({key: record[key] for key in ("id", "from", "body")})
        return {"v": 1, "node_id": self.node_id, "outbox": outgoing,
                "inbox": incoming, "seen": self._seen[:]}

    @classmethod
    def from_state(cls, state, now, id_factory=None):
        now = _time(now)
        if not isinstance(state, dict) or type(state.get("v")) is not int or state["v"] != 1:
            raise ValueError("Unsupported messenger save")
        instance = cls(state.get("node_id"), id_factory)
        for name, maximum in (("outbox", MAX_OUTBOX), ("inbox", MAX_INBOX), ("seen", MAX_SEEN)):
            value = state.get(name)
            if not isinstance(value, list) or len(value) > maximum:
                raise ValueError("Invalid or oversized saved " + name)
        outgoing_ids = []
        for record in state["outbox"]:
            if not isinstance(record, dict):
                raise ValueError("Invalid outbox record")
            ident = protocol.id_hex(record.get("id"))
            target = protocol.validate_node_id(record.get("to"))
            body = record.get("body")
            protocol.encode(protocol.TEXT, ident, instance.node_id, target, body)
            status, attempts = record.get("state"), record.get("attempts")
            reason = record.get("reason", "")
            if target == instance.node_id or ident in outgoing_ids:
                raise ValueError("Invalid or repeated saved message ID")
            if (status not in _STATES or not _integer(attempts, 0, MAX_ATTEMPTS)
                    or reason not in _REASONS
                    or (status == "queued" and attempts != 0)
                    or (status in ("sent", "delivered") and attempts < 1)):
                raise ValueError("Invalid saved delivery state")
            outgoing_ids.append(ident)
            if status in _PENDING:
                status, reason = "failed", "restart_requires_retry"
            instance.outbox.append({"id": ident, "to": target, "body": body,
                                    "state": status, "attempts": attempts, "reason": reason,
                                    "created_at": now, "expires_at": now, "next_try": now})
        incoming_keys = []
        for record in state["inbox"]:
            if not isinstance(record, dict):
                raise ValueError("Invalid inbox record")
            ident = protocol.id_hex(record.get("id"))
            sender = protocol.validate_node_id(record.get("from"))
            body = record.get("body")
            protocol.encode(protocol.TEXT, ident, sender, instance.node_id, body)
            key = sender + ":" + ident
            if sender == instance.node_id or key in incoming_keys:
                raise ValueError("Invalid or repeated saved inbox record")
            incoming_keys.append(key)
            instance.inbox.append({"id": ident, "from": sender, "body": body, "received_at": now})
        for key in state["seen"]:
            if not isinstance(key, str) or len(key) > 29 or key.count(":") != 1:
                raise ValueError("Invalid deduplication record")
            sender, ident = key.split(":")
            protocol.validate_node_id(sender)
            protocol.id_bytes(ident)
            if sender == instance.node_id or key in instance._seen:
                raise ValueError("Invalid or repeated deduplication record")
            instance._seen.append(key)
        # A partially copied save must not allow inbox entries to be redelivered.
        for key in incoming_keys:
            if key not in instance._seen:
                raise ValueError("Saved inbox missing deduplication history")
        return instance
