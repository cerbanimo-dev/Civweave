"""Recovery and bounded-storage contracts for MicroPython game save slots."""

import builtins
import json
import os
import sys
import tempfile
import unittest
from unittest.mock import patch
import zlib

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from pocket_game import Game
from pocket_save import SaveStore, MAX_SAVE_BYTES, MAX_SEQUENCE


def sign_record(record):
    """Independent stdlib reference for the documented Adler-32 record checksum."""
    body = "%s:%s:%s" % (record["version"], record["sequence"], record["payload"])
    record["checksum"] = "%08x" % (zlib.adler32(body.encode("utf-8")) & 0xffffffff)
    return json.dumps(record).encode("utf-8")


class SaveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = os.path.join(self.temp.name, "pocket")
        self.store = SaveStore(self.base)
        self.first = Game().export()
        self.second = dict(self.first, steps=1, cursor=1, energy=7, berries=4)

    def read_bytes(self, slot):
        with open(self.base + "." + str(slot), "rb") as handle:
            return handle.read()

    def write_bytes(self, slot, data):
        with open(self.base + "." + str(slot), "wb") as handle:
            handle.write(data)

    def test_missing_files_load_none_without_creating_files(self):
        self.assertIsNone(self.store.load())
        self.assertEqual(os.listdir(self.temp.name), [])

    def test_roundtrip_and_alternating_slots(self):
        self.assertIs(self.store.save(self.first), True)
        original_slot = self.read_bytes(0)
        self.assertEqual(self.store.load(), self.first)
        self.assertIs(self.store.save(self.second), True)
        self.assertEqual(self.read_bytes(0), original_slot)
        self.assertEqual(SaveStore(self.base).load(), self.second)
        third = dict(self.second, steps=2, cursor=2)
        second_slot = self.read_bytes(1)
        self.assertIs(self.store.save(third), True)
        self.assertEqual(self.read_bytes(1), second_slot)
        self.assertEqual(SaveStore(self.base).load(), third)
        self.assertLessEqual(len(self.read_bytes(0)), MAX_SAVE_BYTES)
        self.assertLessEqual(len(self.read_bytes(1)), MAX_SAVE_BYTES)

    def test_unchanged_progress_does_not_write_flash_again(self):
        self.store.save(self.first)
        actual_open = builtins.open

        def read_only_open(path, mode="r", *args, **kwargs):
            if "w" in mode or "a" in mode:
                self.fail("Unchanged save wrote flash")
            return actual_open(path, mode, *args, **kwargs)

        with patch("pocket_save.open", read_only_open, create=True):
            self.assertIs(self.store.save(self.first), True)

    def test_corrupt_or_torn_newest_slot_recovers_previous_progress(self):
        self.store.save(self.first)
        self.store.save(self.second)
        newest = self.read_bytes(1)
        record = json.loads(newest)
        record["payload"] = record["payload"].replace('"steps": 1', '"steps": 9')
        # Whitespace-independent payload mutation, deliberately without re-signing.
        state = json.loads(record["payload"])
        state["steps"] = 9
        record["payload"] = json.dumps(state)
        for corrupt in [b"{", newest[:len(newest) // 2], b"\xff\xfe", json.dumps(record).encode()]:
            with self.subTest(corrupt=corrupt[:50]):
                self.write_bytes(1, corrupt)
                self.assertEqual(SaveStore(self.base).load(), self.first)
        # A new save repairs the broken alternate slot without touching the good one.
        old = self.read_bytes(0)
        self.assertTrue(self.store.save(self.second))
        self.assertEqual(self.read_bytes(0), old)
        self.assertEqual(self.store.load(), self.second)

    def test_missing_older_slot_does_not_hide_latest_valid_save(self):
        self.store.save(self.first)
        self.store.save(self.second)
        os.remove(self.base + ".0")
        self.assertEqual(self.store.load(), self.second)

    def test_both_corrupt_and_oversized_slots_return_none(self):
        self.write_bytes(0, b"{" * (MAX_SAVE_BYTES + 1))
        self.write_bytes(1, b"not json")
        self.assertIsNone(self.store.load())

    def test_invalid_saves_do_not_overwrite_valid_progress(self):
        self.store.save(self.first)
        original = self.read_bytes(0)
        invalid_states = [None, {}, [], dict(self.first, version=2), dict(self.first, berries=10 ** 100)]
        for state in invalid_states:
            self.assertIs(self.store.save(state), False)
            self.assertEqual(self.store.load(), self.first)
            self.assertEqual(self.read_bytes(0), original)
        self.assertFalse(os.path.exists(self.base + ".1"))

    def test_valid_checksum_cannot_admit_invalid_schema_or_sequence(self):
        self.store.save(self.first)
        self.store.save(self.second)
        record = json.loads(self.read_bytes(1))
        variants = []
        for key, value in [("version", 2), ("version", True), ("sequence", -1),
                           ("sequence", True), ("sequence", MAX_SEQUENCE + 1)]:
            variant = dict(record)
            variant[key] = value
            variants.append(sign_record(variant))
        state = dict(self.second, energy=-100)
        variants.append(sign_record(dict(record, payload=json.dumps(state))))
        variants.append(sign_record(dict(record, payload=json.dumps(dict(self.second, extra="data")))))
        for raw in variants:
            self.write_bytes(1, raw)
            self.assertEqual(self.store.load(), self.first)

    def test_sequence_rollover_keeps_newest_and_fallback_order(self):
        self.store.save(self.first)
        record = json.loads(self.read_bytes(0))
        record["sequence"] = MAX_SEQUENCE - 1
        self.write_bytes(0, sign_record(record))
        self.assertTrue(self.store.save(self.second))
        self.assertEqual(json.loads(self.read_bytes(1))["sequence"], MAX_SEQUENCE)
        third = dict(self.second, steps=2, cursor=2)
        self.assertTrue(self.store.save(third))
        self.assertEqual(json.loads(self.read_bytes(0))["sequence"], 0)
        self.assertEqual(self.store.load(), third)
        self.write_bytes(0, b"torn")
        self.assertEqual(self.store.load(), self.second)

    def test_io_failure_raises_and_preserves_previous_slot(self):
        self.store.save(self.first)
        actual_open = builtins.open

        def failing_open(path, mode="r", *args, **kwargs):
            if "w" in mode:
                raise OSError("simulated storage full")
            return actual_open(path, mode, *args, **kwargs)

        with patch("pocket_save.open", failing_open, create=True):
            with self.assertRaises(OSError):
                self.store.save(self.second)
        self.assertEqual(self.store.load(), self.first)

    def test_short_write_is_reported_and_previous_slot_survives(self):
        self.store.save(self.first)
        actual_open = builtins.open

        class ShortWriter:
            def __init__(self, path):
                self.handle = actual_open(path, "wb")

            def __enter__(self):
                return self

            def __exit__(self, *args):
                self.handle.close()

            def write(self, data):
                return self.handle.write(data[:len(data) // 2])

            def flush(self):
                self.handle.flush()

        def short_open(path, mode="r", *args, **kwargs):
            if "w" in mode:
                return ShortWriter(path)
            return actual_open(path, mode, *args, **kwargs)

        with patch("pocket_save.open", short_open, create=True):
            with self.assertRaises(OSError):
                self.store.save(self.second)
        self.assertEqual(self.store.load(), self.first)

    def test_load_returns_a_fresh_game_dict(self):
        self.store.save(self.first)
        returned = self.store.load()
        returned["collection"].append("unknown")
        self.assertEqual(self.store.load(), self.first)


if __name__ == "__main__":
    unittest.main()
