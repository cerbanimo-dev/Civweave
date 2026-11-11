import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pocket_link import LinkState


class Clock:
    def __init__(self): self.now = 0
    def __call__(self): return self.now


def frames(value):
    raw = json.dumps(value, separators=(',', ':')).encode()
    size, checksum = len(raw), sum(raw) & 65535
    return [bytes([1, ord('S'), size >> 8, size & 255, checksum >> 8, checksum & 255])] + [b'\x02' + raw[i:i+19] for i in range(0, size, 19)] + [b'\x03']


def status(**changes):
    value = {'schema': 'civweave.pocket.state.v1', 'source': 'server', 'fresh': True, 'mode': 'generating', 'agent': 'moss', 'task': 'Making a learning journey'}
    value.update(changes)
    return value


class LinkTests(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()
        self.link = LinkState(self.clock)

    def send(self, value):
        replies = []
        for packet in frames(value): replies.extend(self.link.consume(packet))
        return replies

    def test_offline_packets_cannot_make_live_status(self):
        self.send(status())
        self.assertFalse(self.link.snapshot()['fresh'])
        self.assertEqual(self.link.snapshot()['status_label'], 'OFFLINE')

    def test_connection_is_not_a_fresh_server_report(self):
        self.link.connect()
        self.assertTrue(self.link.snapshot()['connected'])
        self.assertFalse(self.link.snapshot()['fresh'])
        self.assertEqual(self.link.snapshot()['status_label'], 'PHONE LINK')

    def test_legacy_state_accepted_then_expires_at_nine_seconds(self):
        self.link.connect()
        self.assertEqual(self.send(status()), [b'K1'])
        self.assertEqual(self.link.snapshot()['mode'], 'generating')
        self.assertEqual(self.link.snapshot()['status_label'], 'PHONE REPORT')
        self.clock.now = 8999
        self.assertTrue(self.link.snapshot()['fresh'])
        self.clock.now = 9000
        self.assertFalse(self.link.snapshot()['fresh'])
        self.assertEqual(self.link.snapshot()['mode'], 'disconnected')

    def test_bad_claims_and_checksum_do_not_refresh_status(self):
        self.link.connect()
        for mutation in ({'source': 'demo'}, {'fresh': 1}, {'agent': 'unknown'}, {'mode': 'paid'}, {'task': ['bad']}):
            self.assertEqual(self.send(status(**mutation)), [b'K0'])
            self.assertFalse(self.link.snapshot()['fresh'])
        packets = frames(status())
        packets[0] = packets[0][:-1] + bytes([packets[0][-1] ^ 1])
        replies = []
        for packet in packets: replies.extend(self.link.consume(packet))
        self.assertEqual(replies[-1:], [b'K0'])
        self.assertFalse(self.link.snapshot()['fresh'])

    def test_fragment_timeout_and_disconnect_clear_partial_frame(self):
        self.link.connect()
        packets = frames(status())
        self.link.consume(packets[0])
        self.link.consume(packets[1])
        self.clock.now = 3000
        for packet in packets[2:]: self.link.consume(packet)
        self.assertFalse(self.link.snapshot()['fresh'])
        self.assertEqual(self.send(status()), [b'K1'])
        self.link.disconnect()
        self.link.connect()
        self.assertFalse(self.link.snapshot()['fresh'])

    def test_bounds_reject_oversized_chunks_images_and_manual_preview(self):
        self.link.connect()
        self.link.consume(bytes([1, ord('S'), 255, 255, 0, 0]))
        self.assertEqual(self.link.buffered_bytes, 0)
        self.link.consume(frames(status())[0])
        self.link.consume(b'\x02' + b'x' * 20)
        self.assertEqual(self.link.buffered_bytes, 0)
        self.assertIn(b'K0', self.link.consume(bytes([1, ord('I'), 1, 0, 0, 0])))
        self.link.consume(b'\x06B')
        self.assertFalse(self.link.snapshot()['fresh'])

    def test_clear_and_control_bytes_match_existing_phone_contract(self):
        self.link.connect()
        self.send(status())
        self.link.consume(b'\x04')
        self.assertFalse(self.link.snapshot()['fresh'])
        self.assertTrue(self.link.snapshot()['connected'])
        self.assertEqual(self.link.query_bytes(), b'Q')
        self.assertEqual(self.link.dismiss_bytes(), b'X')

    def test_injected_wrapping_clock_expires_correctly(self):
        self.clock.now = 65530
        link = LinkState(self.clock, lambda a, b: ((a-b+32768) % 65536)-32768)
        link.connect()
        for p in frames(status()): link.consume(p)
        self.clock.now = (65530 + 8999) % 65536
        self.assertTrue(link.snapshot()['fresh'])
        self.clock.now = (65530 + 9000) % 65536
        self.assertFalse(link.snapshot()['fresh'])


if __name__ == '__main__': unittest.main()
