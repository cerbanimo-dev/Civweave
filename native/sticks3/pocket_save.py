"""Bounded alternating game saves for MicroPython and desktop simulation.

base_path is a file prefix in an existing directory. Only its .0 and .1 slots
are used. Writing the older slot leaves the newest verified slot intact if a
write is interrupted. Adler-32 detects accidental damage; it is not an identity,
signature, remote authority, or protection against deliberate file modification.
"""

try:
    import ujson as json
except ImportError:
    import json

try:
    import uos as os
except ImportError:
    import os

from pocket_game import validate_saved

MAX_SAVE_BYTES = 1024
# A bounded power-of-two counter supports wrap-aware comparison of the two slots.
MAX_SEQUENCE = (1 << 30) - 1
_HALF_SEQUENCE_RANGE = (MAX_SEQUENCE + 1) // 2
_RECORD_VERSION = 1


def _checksum(version, sequence, payload):
    """Adler-32 over metadata and the exact UTF-8 payload; no optional C module."""
    raw = ("%s:%s:%s" % (version, sequence, payload)).encode("utf-8")
    first, second = 1, 0
    for byte in raw:
        first = (first + byte) % 65521
        second = (second + first) % 65521
    return "%08x" % ((second << 16) | first)


class SaveStore:
    """Load verified progress; save returns bool and raises OSError on I/O errors."""

    def __init__(self, base_path):
        if type(base_path) is not str or not base_path or len(base_path) > 240:
            raise ValueError("base_path must be a short file prefix")
        self._paths = (base_path + ".0", base_path + ".1")

    def _read_slot(self, index):
        try:
            with open(self._paths[index], "rb") as handle:
                raw = handle.read(MAX_SAVE_BYTES + 1)
        except OSError:
            return None
        if not raw or len(raw) > MAX_SAVE_BYTES:
            return None
        try:
            record = json.loads(raw.decode("utf-8"))
            if type(record) is not dict or len(record) != 4:
                return None
            for key in ("version", "sequence", "payload", "checksum"):
                if key not in record:
                    return None
            version, sequence = record["version"], record["sequence"]
            if type(version) is not int or version != _RECORD_VERSION:
                return None
            if type(sequence) is not int or not 0 <= sequence <= MAX_SEQUENCE:
                return None
            payload, checksum = record["payload"], record["checksum"]
            if type(payload) is not str or type(checksum) is not str or len(checksum) != 8:
                return None
            if _checksum(version, sequence, payload) != checksum:
                return None
            state = validate_saved(json.loads(payload))
            if state is None:
                return None
            return (sequence, state)
        except (ValueError, TypeError, RuntimeError, MemoryError):
            # Corrupt/nested JSON must not prevent the other slot from recovering.
            return None

    def _latest(self):
        left, right = self._read_slot(0), self._read_slot(1)
        if left is None:
            return (1, right[0], right[1]) if right else None
        if right is None:
            return (0, left[0], left[1])
        distance = (right[0] - left[0]) & MAX_SEQUENCE
        # Adjacent writes stay within half the sequence range, including rollover.
        if 0 < distance < _HALF_SEQUENCE_RANGE:
            return (1, right[0], right[1])
        return (0, left[0], left[1])

    def load(self):
        """Return the newest valid independent game dict, or None if neither works."""
        latest = self._latest()
        return latest[2] if latest else None

    def save(self, state):
        """Persist valid progress, avoiding duplicate flash writes.

        False means invalid input and leaves both slots untouched. True includes
        already-durable unchanged progress. Storage errors propagate as OSError
        so the device can show a save warning while play remains available.
        """
        normalized = validate_saved(state)
        if normalized is None:
            return False
        latest = self._latest()
        if latest and latest[2] == normalized:
            return True
        index = 1 - latest[0] if latest else 0
        sequence = ((latest[1] + 1) & MAX_SEQUENCE) if latest else 0
        payload = json.dumps(normalized)
        record = {
            "version": _RECORD_VERSION,
            "sequence": sequence,
            "payload": payload,
            "checksum": _checksum(_RECORD_VERSION, sequence, payload),
        }
        raw = json.dumps(record).encode("utf-8")
        if len(raw) > MAX_SAVE_BYTES:
            return False
        with open(self._paths[index], "wb") as handle:
            if handle.write(raw) != len(raw):
                raise OSError("Incomplete game save")
            handle.flush()
        sync = getattr(os, "sync", None)
        if sync is not None:
            sync()
        verified = self._read_slot(index)
        if verified is None or verified[0] != sequence or verified[1] != normalized:
            raise OSError("Game save verification failed")
        return True
