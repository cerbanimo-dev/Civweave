"""Bounded presentation adapter for the existing Pocket BLE status protocol.

This is not an authentication, private-messaging, radio, or inference owner.
An Android bridge verifies the upstream source; the device reports what the
phone supplied. No frame can authorize a purchase, job, reward, or message send.
"""
try:
    import ujson as json
except ImportError:
    import json

SERVICE = 'bc257ca0-197e-4ba4-8ab7-c70ef45c0010'
RX = 'bc257ca0-197e-4ba4-8ab7-c70ef45c0011'
TX = 'bc257ca0-197e-4ba4-8ab7-c70ef45c0012'
MAX_STATE_BYTES = 768
MAX_FRAGMENT_BYTES = 19
STATUS_TTL_MS = 9000
FRAME_TTL_MS = 3000
AGENTS = ('weaveling', 'moss', 'kamiya', 'rook', 'merlin')
MODES = ('idle', 'generating', 'completed', 'blocked', 'needs_human')


def _display_text(value, limit):
    return ''.join(c if 32 <= ord(c) <= 126 else '?' for c in value[:limit])


class LinkState:
    def __init__(self, clock_ms, ticks_diff=None):
        self._clock = clock_ms
        self._diff = ticks_diff or (lambda a, b: a - b)
        self.connected = False
        self._report = None
        self._reported_at = None
        self._reset_frame()

    @property
    def buffered_bytes(self):
        return len(self._buffer) if self._buffer is not None else 0

    def _reset_frame(self):
        self._buffer = None
        self._expected = 0
        self._checksum = 0
        self._started_at = None

    def _clear_report(self):
        self._report = None
        self._reported_at = None

    def connect(self):
        self._reset_frame()
        self._clear_report()
        self.connected = True

    def disconnect(self):
        self.connected = False
        self._reset_frame()
        self._clear_report()

    def _expire_frame(self):
        if self._started_at is not None:
            elapsed = self._diff(self._clock(), self._started_at)
            if elapsed < 0 or elapsed >= FRAME_TTL_MS:
                self._reset_frame()

    def snapshot(self):
        self._expire_frame()
        age = self._diff(self._clock(), self._reported_at) if self._reported_at is not None else -1
        fresh = bool(self.connected and self._report is not None and 0 <= age < STATUS_TTL_MS)
        report = self._report if fresh else {}
        return {
            'connected': self.connected,
            'transport': 'ble' if self.connected else 'offline',
            'fresh': fresh,
            'mode': report.get('mode', 'disconnected'),
            'agent': report.get('agent', ''),
            'task': report.get('task', ''),
            'source': 'phone' if fresh else 'offline',
            'status_label': 'PHONE REPORT' if fresh else ('PHONE LINK' if self.connected else 'OFFLINE'),
        }

    def _accept(self, raw):
        try:
            value = json.loads(bytes(raw).decode('utf-8'))
        except (ValueError, TypeError, UnicodeError):
            return False
        if not isinstance(value, dict):
            return False
        if value.get('schema') != 'civweave.pocket.state.v1':
            return False
        if value.get('source') != 'server' or value.get('fresh') is not True:
            return False
        if value.get('mode') not in MODES or value.get('agent') not in AGENTS:
            return False
        if not isinstance(value.get('task', ''), str):
            return False
        self._report = {
            'mode': value['mode'],
            'agent': value['agent'],
            'task': _display_text(value.get('task', ''), 100),
        }
        self._reported_at = self._clock()
        return True

    def consume(self, packet):
        """Consume one ATT write (<=20 bytes); return zero or more legacy ACKs.

        I/JPEG and manual-preview messages are deliberately declined: the local
        game draws its own original art. Only validated S/status is presented.
        The 16-bit sum detects damaged framing; it is not cryptographic proof.
        """
        self._expire_frame()
        if not self.connected or not isinstance(packet, (bytes, bytearray)) or not packet:
            return []
        code = packet[0]
        if code == 1:
            self._reset_frame()
            if len(packet) != 6 or packet[1] != ord('S'):
                return [b'K0']
            count = (packet[2] << 8) | packet[3]
            if not 0 < count <= MAX_STATE_BYTES:
                return [b'K0']
            self._expected = count
            self._checksum = (packet[4] << 8) | packet[5]
            self._buffer = bytearray()
            self._started_at = self._clock()
            return []
        if code == 2:
            if self._buffer is None:
                return []
            size = len(packet) - 1
            if not 0 < size <= MAX_FRAGMENT_BYTES or len(self._buffer) + size > self._expected:
                self._reset_frame()
                return [b'K0']
            self._buffer.extend(packet[1:])
            return []
        if code == 3:
            if self._buffer is None:
                return []
            valid = (len(packet) == 1 and len(self._buffer) == self._expected
                     and (sum(self._buffer) & 65535) == self._checksum)
            accepted = valid and self._accept(self._buffer)
            self._reset_frame()
            return [b'K1' if accepted else b'K0']
        if code == 4 and len(packet) == 1:
            self._reset_frame()
            self._clear_report()
            return []
        self._reset_frame()
        return [b'K0']

    def query_bytes(self):
        return b'Q'

    def dismiss_bytes(self):
        return b'X'
