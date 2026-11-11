"""Behavior contracts for the device-independent Pocket engine."""
import unittest

from core import protocol
from core.messenger import Messenger
from core.game import Game


class IDs:
    def __init__(self):
        self.value = 0

    def __call__(self):
        self.value += 1
        return self.value.to_bytes(8, "big")


class ProtocolTests(unittest.TestCase):
    def setUp(self):
        self.ident = "0123456789abcdef"

    def test_known_crc_vector(self):
        self.assertEqual(protocol.crc16(b"123456789"), 0x29B1)

    def test_utf8_round_trip_and_maximum_frame(self):
        frame = protocol.encode(protocol.TEXT, self.ident, "a" * 12, "b" * 12, "\U0001f331" * 30)
        self.assertEqual(len(frame), 161)
        self.assertEqual(protocol.decode(frame)["body"], "\U0001f331" * 30)

    def test_byte_limit_not_character_limit(self):
        with self.assertRaises(ValueError):
            protocol.encode(protocol.TEXT, self.ident, "cami", "crew", "\U0001f331" * 31)

    def test_empty_controls_and_bad_identity_rejected(self):
        for body in ("", " \n ", "bad\x00text", "bad\x7ftext", "bad\x85text"):
            with self.subTest(body=body), self.assertRaises(ValueError):
                protocol.encode(protocol.TEXT, self.ident, "cami", "crew", body)
        for node in ("", "Cami", "a" * 13, "a b", "c\u00e4mi"):
            with self.subTest(node=node), self.assertRaises(ValueError):
                protocol.encode(protocol.TEXT, self.ident, node, "crew", "hi")
        with self.assertRaises(ValueError):
            protocol.encode(protocol.TEXT, "0" * 16, "cami", "crew", "hi")

    def test_corrupt_truncated_extended_and_version_rejected(self):
        frame = protocol.encode(protocol.TEXT, self.ident, "cami", "crew", "hello")
        corrupt = bytearray(frame)
        corrupt[-3] ^= 1
        version = bytearray(frame)
        version[2] = 2
        for bad in (bytes(corrupt), frame[:-1], frame + b"x", bytes(version), b""):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                protocol.decode(bad)

    def test_valid_crc_cannot_hide_invalid_utf8_or_kind(self):
        frame = bytearray(protocol.encode(protocol.TEXT, self.ident, "cami", "crew", "x"))
        frame[-3] = 0xFF
        crc = protocol.crc16(frame[:-2])
        frame[-2:] = bytes((crc >> 8, crc & 255))
        with self.assertRaises(ValueError):
            protocol.decode(frame)
        frame[3] = 17
        crc = protocol.crc16(frame[:-2])
        frame[-2:] = bytes((crc >> 8, crc & 255))
        with self.assertRaises(ValueError):
            protocol.decode(frame)

    def test_ack_has_empty_body(self):
        frame = protocol.encode(protocol.ACK, self.ident, "crew", "cami")
        self.assertEqual(protocol.decode(frame)["body"], "")
        with self.assertRaises(ValueError):
            protocol.encode(protocol.ACK, self.ident, "crew", "cami", "pretend")


class MessengerTests(unittest.TestCase):
    def setUp(self):
        self.a = Messenger("cami", id_factory=IDs())
        self.b = Messenger("crew", id_factory=IDs())

    def test_delivered_only_after_peer_application_ack(self):
        ident = self.a.queue_text("crew", "Meet at the Y", 0)
        self.assertEqual(self.a.outbox[0]["state"], "queued")
        frames = self.a.tick(0, True)
        self.assertEqual(self.a.outbox[0]["state"], "sent")
        replies = self.b.receive(frames[0], 0.1)
        self.assertEqual(self.b.inbox[0]["body"], "Meet at the Y")
        self.a.receive(replies[0], 0.2)
        self.assertEqual(self.a.outbox[0]["id"], ident)
        self.assertEqual(self.a.outbox[0]["state"], "delivered")
        self.assertEqual(self.a.tick(40, True), [])

    def test_ack_for_wrong_peer_id_destination_or_unsent_ignored(self):
        ident = self.a.queue_text("crew", "hello", 0)
        unsent_ack = protocol.encode(protocol.ACK, ident, "crew", "cami")
        self.a.receive(unsent_ack, 0)
        self.assertEqual(self.a.outbox[0]["state"], "queued")
        self.a.tick(0, True)
        for ident2, sender, recipient in ((ident, "intruder", "cami"),
                                           ("ffffffffffffffff", "crew", "cami"),
                                           (ident, "crew", "someone")):
            self.a.receive(protocol.encode(protocol.ACK, ident2, sender, recipient), 1)
            self.assertEqual(self.a.outbox[0]["state"], "sent")

    def test_duplicate_delivery_reacks_without_duplicate_inbox(self):
        self.a.queue_text("crew", "hello", 0)
        frame = self.a.tick(0, True)[0]
        ack1 = self.b.receive(frame, 0)
        ack2 = self.b.receive(frame, 1)
        self.assertEqual(ack1, ack2)
        self.assertEqual(len(self.b.inbox), 1)

    def test_retries_are_bounded_and_backed_off(self):
        self.a.queue_text("crew", "hello", 0)
        attempts = []
        for t in range(31):
            if self.a.tick(t, True):
                attempts.append(t)
        self.assertEqual(attempts, [0, 2, 6, 14])
        self.assertEqual(self.a.outbox[0]["attempts"], 4)
        self.assertEqual(self.a.outbox[0]["state"], "failed")
        self.assertEqual(self.a.tick(31, True), [])

    def test_offline_queues_reconnect_and_expiry(self):
        self.a.queue_text("crew", "hello", 0)
        self.assertEqual(self.a.tick(10, False), [])
        self.assertEqual(self.a.outbox[0]["state"], "queued")
        self.assertEqual(len(self.a.tick(20, True)), 1)
        other = Messenger("cami", id_factory=IDs())
        other.queue_text("crew", "expires offline", 0)
        self.assertEqual(other.tick(120, False), [])
        self.assertEqual(other.outbox[0]["state"], "expired")
        self.assertEqual(other.tick(121, True), [])

    def test_pending_queue_is_never_evicted(self):
        for i in range(16):
            self.a.queue_text("crew", str(i), 0)
        with self.assertRaises(OverflowError):
            self.a.queue_text("crew", "overflow", 0)
        self.assertEqual(len(self.a.outbox), 16)
        self.assertEqual(self.a.outbox[0]["body"], "0")
        self.a.tick(121, False)
        self.a.queue_text("crew", "new", 122)
        self.assertEqual(len(self.a.outbox), 16)
        self.assertEqual(self.a.outbox[-1]["body"], "new")

    def test_saved_pending_does_not_reuse_uptime_or_extend_deadline(self):
        self.a.queue_text("crew", "hello", 1000)
        self.a.tick(1001, True)
        saved = self.a.export_state()
        self.assertNotIn("expires_at", saved["outbox"][0])
        restored = Messenger.from_state(saved, now=0, id_factory=IDs())
        self.assertEqual(restored.outbox[0]["state"], "failed")
        self.assertEqual(restored.outbox[0]["reason"], "restart_requires_retry")
        self.assertEqual(restored.tick(10000, True), [])

    def test_saved_duplicate_window_survives_restart(self):
        self.a.queue_text("crew", "hello", 0)
        frame = self.a.tick(0, True)[0]
        self.b.receive(frame, 0)
        restored = Messenger.from_state(self.b.export_state(), 0, id_factory=IDs())
        self.assertEqual(len(restored.receive(frame, 1)), 1)
        self.assertEqual(len(restored.inbox), 1)

    def test_duplicate_lru_cannot_evict_a_retained_inbox_id(self):
        frames = [protocol.encode(protocol.TEXT, "%016x" % (i + 1), "other", "cami", str(i))
                  for i in range(65)]
        for frame in frames[:64]:
            self.a.receive(frame, 0)
        self.a.receive(frames[32], 1)
        for frame in frames[:32]:
            self.a.receive(frame, 2)
        self.a.receive(frames[64], 3)
        restored = Messenger.from_state(self.a.export_state(), 0)
        self.assertEqual(len(restored.inbox), 32)
        restored.receive(frames[33], 1)
        self.assertEqual(len(restored.inbox), 32)
        self.assertEqual(restored.inbox[0]["body"], "33")

    def test_late_ack_cannot_bypass_expiry_or_retry_timeout(self):
        ident = self.a.queue_text("crew", "hello", 0)
        for now in (0, 2, 6, 14):
            self.a.tick(now, True)
        self.a.receive(protocol.encode(protocol.ACK, ident, "crew", "cami"), 30)
        self.assertEqual(self.a.outbox[0]["state"], "failed")
        other = Messenger("cami", id_factory=IDs())
        ident = other.queue_text("crew", "late", 0)
        other.tick(119, True)
        other.receive(protocol.encode(protocol.ACK, ident, "crew", "cami"), 120)
        self.assertEqual(other.outbox[0]["state"], "expired")

    def test_malformed_save_is_rejected_and_limits_are_bounded(self):
        for saved in (None, {}, {"v": 1, "node_id": "Cami"}):
            with self.assertRaises(ValueError):
                Messenger.from_state(saved, 0)
        for i in range(90):
            frame = protocol.encode(protocol.TEXT, "%016x" % (i + 1), "other", "cami", str(i))
            self.a.receive(frame, i)
        self.assertEqual(len(self.a.inbox), 32)
        self.assertEqual(len(self.a.export_state()["seen"]), 64)
        self.assertLessEqual(len(self.a.drain_events()), 64)
        saved = self.a.export_state()
        saved["inbox"] = saved["inbox"] * 2
        with self.assertRaises(ValueError):
            Messenger.from_state(saved, 0)

    def test_id_collision_cannot_reuse_pending_id(self):
        fixed = lambda: b"\x01" * 8
        m = Messenger("cami", id_factory=fixed)
        m.queue_text("crew", "first", 0)
        with self.assertRaises(ValueError):
            m.queue_text("crew", "second", 0)
        self.assertEqual(len(m.outbox), 1)


class GameTests(unittest.TestCase):
    def test_original_companions_and_deterministic_exploration(self):
        for name in ("Mossling", "Emberbit", "Tidefin"):
            game = Game(name)
            self.assertEqual(game.export_state()["companion"], name)
        a, b = Game(), Game()
        self.assertEqual(a.act("explore"), b.act("explore"))
        self.assertEqual(a.export_state(), b.export_state())

    def test_rest_recovers_without_neglect_penalty(self):
        game = Game()
        initial = game.export_state()
        self.assertEqual(Game.from_state(initial).export_state(), initial)
        for _ in range(10):
            game.act("train")
        self.assertGreaterEqual(game.energy, 0)
        game.act("rest")
        self.assertGreater(game.energy, 0)

    def test_game_bounds_and_save_validation(self):
        game = Game()
        for _ in range(200):
            game.act("care")
            game.act("rest")
            game.act("train")
            game.act("explore")
        self.assertLessEqual(game.bond, 100)
        self.assertLessEqual(game.energy, 100)
        self.assertLessEqual(game.xp, 9999)
        saved = game.export_state()
        self.assertEqual(Game.from_state(saved).export_state(), saved)
        saved["energy"] = -1
        with self.assertRaises(ValueError):
            Game.from_state(saved)
        with self.assertRaises(ValueError):
            game.act("buy")


if __name__ == "__main__":
    unittest.main()
