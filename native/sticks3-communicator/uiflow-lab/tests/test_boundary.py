"""The plaintext lab must never masquerade as Pocket Commons' CW carrier."""
import unittest
import json
from pathlib import Path
from core import protocol


class FormatBoundaryTests(unittest.TestCase):
    def test_independent_wire_fixtures(self):
        fixtures = json.loads(Path(__file__).with_name('wire-fixtures.json').read_text())
        decoded = protocol.decode(bytes.fromhex(fixtures['labTextHex']))
        self.assertEqual((decoded['from'], decoded['to'], decoded['body']), ('cami', 'crew', 'hello'))
        with self.assertRaises(ValueError):
            protocol.decode(bytes.fromhex(fixtures['carrierBeaconHex']))

    def test_lab_uses_separate_magic(self):
        frame = protocol.encode(protocol.TEXT, '0123456789abcdef', 'cami', 'crew', 'hello')
        self.assertEqual(frame[:3], b'CL\x01')

    def test_cw_magic_is_rejected_even_with_valid_lab_crc(self):
        frame = bytearray(protocol.encode(protocol.TEXT, '0123456789abcdef', 'cami', 'crew', 'hello'))
        frame[1] = ord('W')
        # Independent CCITT calculation keeps this a format check, not a test
        # that merely fails on a deliberately broken checksum.
        crc = 0xffff
        for byte in frame[:-2]:
            crc ^= byte << 8
            for _ in range(8):
                crc = ((crc << 1) ^ 0x1021) & 0xffff if crc & 0x8000 else (crc << 1) & 0xffff
        frame[-2:] = bytes((crc >> 8, crc & 255))
        with self.assertRaises(ValueError):
            protocol.decode(frame)


if __name__ == '__main__':
    unittest.main()
