"""Bridge routing and BLE lifecycle tests; no Bluetooth hardware required."""
import argparse
import asyncio
import contextlib
import time
import unittest
from types import SimpleNamespace

from core import protocol
from core.messenger import Messenger
from tools.ble_bridge import (
    Bridge, PeerLink, Router, RouteError, NOTIFICATION_LIMIT, SERVICE_UUID,
    RX_UUID, TX_UUID, matching_advertisement, parse_peer, simulate,
)
from transport.ble_frames import split_frame


class RouterTests(unittest.TestCase):
    def setUp(self):
        self.desktop = Messenger("desk")
        self.router = Router(("cami", "crew"), self.desktop)
        self.ready = {"cami", "crew"}
        self.ident = "123456789abcdef0"
        self.text = protocol.encode(protocol.TEXT, self.ident, "cami", "crew", "hello")

    def test_forward_does_not_synthesize_application_ack(self):
        writes = self.router.route("cami", self.text, self.ready, 0)
        self.assertEqual(writes, [("crew", self.text)])
        self.assertEqual(self.desktop.inbox, [])
        self.assertEqual(protocol.decode(writes[0][1])["kind"], protocol.TEXT)

    def test_spoofed_source_and_unready_source_are_rejected(self):
        for source, ready in (("crew", self.ready), ("intruder", self.ready), ("cami", {"crew"})):
            with self.subTest(source=source, ready=ready), self.assertRaises(RouteError):
                self.router.route(source, self.text, ready, 0)
        self.assertEqual(self.router.forwarded, {})

    def test_unknown_or_unready_destination_is_not_acknowledged(self):
        other = protocol.encode(protocol.TEXT, self.ident, "cami", "missing", "hello")
        for frame, ready in ((other, self.ready), (self.text, {"cami"})):
            with self.subTest(ready=ready), self.assertRaises(RouteError):
                self.router.route("cami", frame, ready, 0)
        self.assertEqual(self.desktop.inbox, [])
        self.assertEqual(self.router.forwarded, {})

    def test_relay_ack_must_match_reverse_path_and_message_id(self):
        ack = protocol.encode(protocol.ACK, self.ident, "crew", "cami")
        with self.assertRaises(RouteError):
            self.router.route("crew", ack, self.ready, 0)
        self.router.route("cami", self.text, self.ready, 1)
        self.assertEqual(self.router.route("crew", ack, self.ready, 2), [("cami", ack)])
        wrong = protocol.encode(protocol.ACK, "0000000000000002", "crew", "cami")
        with self.assertRaises(RouteError):
            self.router.route("crew", wrong, self.ready, 2)
        with self.assertRaises(RouteError):
            self.router.route("cami", ack, self.ready, 2)
        with self.assertRaises(RouteError):
            self.router.route("crew", ack, self.ready, 122)

    def test_desktop_ack_requires_actual_desktop_acceptance(self):
        frame = protocol.encode(protocol.TEXT, self.ident, "crew", "desk", "hello desk")
        writes = self.router.route("crew", frame, self.ready, 0)
        self.assertEqual(self.desktop.inbox[0]["body"], "hello desk")
        self.assertEqual(writes[0][0], "crew")
        ack = protocol.decode(writes[0][1])
        self.assertEqual((ack["kind"], ack["from"], ack["to"], ack["id"]),
                         (protocol.ACK, "desk", "crew", self.ident))
        self.router.route("crew", frame, self.ready, 1)
        self.assertEqual(len(self.desktop.inbox), 1)

    def test_operator_addresses_are_explicit_and_scan_names_are_only_hints(self):
        self.assertEqual(parse_peer("cami=AA:BB:CC:DD:EE:01"), ("cami", "AA:BB:CC:DD:EE:01"))
        for value in ("cami=Civweave", "desk=AA:BB:CC:DD:EE:01", "Cami=AA:BB:CC:DD:EE:01"):
            with self.subTest(value=value), self.assertRaises(argparse.ArgumentTypeError):
                parse_peer(value)
        device = SimpleNamespace(name="Unrelated")
        adv = SimpleNamespace(local_name="Unrelated", service_uuids=[SERVICE_UUID])
        self.assertTrue(matching_advertisement(device, adv))
        adv.service_uuids = []
        self.assertFalse(matching_advertisement(device, adv))

    def test_three_node_simulation(self):
        result = simulate()
        self.assertEqual(result["delivered"], 3)
        self.assertFalse(result["hardware_used"])
        self.assertEqual(result["bridge_synthesized_relay_acks"], 0)
        self.assertEqual(result["duplicate_inbox_entries"], 0)


class FakeClient:
    def __init__(self, device, disconnected_callback=None, **kwargs):
        self.device = device
        self.is_connected = True
        self.callback = disconnected_callback
        self.writes = []

    async def write_gatt_char(self, characteristic, data, response):
        self.writes.append((characteristic, bytes(data), response))
        await asyncio.sleep(0)

    async def disconnect(self):
        self.is_connected = False
        if self.callback:
            self.callback(self)


class LinkTests(unittest.IsolatedAsyncioTestCase):
    async def test_writes_are_whole_frame_serialized(self):
        link = PeerLink("cami", object(), FakeClient, asyncio.Queue(maxsize=64), lambda _message: None)
        link.ready_at = time.monotonic()
        link.rx_characteristic = RX_UUID
        frame = protocol.encode(protocol.TEXT, "0000000000000001", "desk", "cami", "x" * 50)
        await asyncio.gather(link.write_frame(frame), link.write_frame(frame))
        chunks = [entry[1] for entry in link.client.writes]
        ids = [chunk[1] for chunk in chunks]
        changes = sum(before != after for before, after in zip(ids, ids[1:]))
        self.assertEqual(changes, 1)
        self.assertTrue(all(len(chunk) == 20 for chunk in chunks))
        self.assertTrue(all(entry[2] is True for entry in link.client.writes))

    async def test_overflow_invalidates_queued_partial_transfer(self):
        logs = []
        queue = asyncio.Queue(maxsize=NOTIFICATION_LIMIT)
        link = PeerLink("cami", object(), FakeClient, queue, logs.append)
        link.ready_at = time.monotonic()
        for _ in range(NOTIFICATION_LIMIT):
            link.notification(TX_UUID, b"CHcami")
        old_epoch = link.epoch
        link.notification(TX_UUID, b"CHcami")
        self.assertEqual(queue.qsize(), NOTIFICATION_LIMIT)
        self.assertGreater(link.epoch, old_epoch)
        self.assertFalse(link.ready(time.monotonic()))
        self.assertIn("overflow", logs[-1])
        self.assertNotEqual(queue.get_nowait()[1], link.epoch)

    async def test_approval_is_required_and_disconnect_resets_it(self):
        logs = []
        bridge = Bridge({"cami": object()}, FakeClient, logs.append)
        link = bridge.links["cami"]
        # Receiving a text before the device consent heartbeat is ignored.
        frame = protocol.encode(protocol.TEXT, "0000000000000001", "cami", "desk", "hello")
        consumer = asyncio.create_task(bridge.consume())
        try:
            for chunk in split_frame(frame, 1):
                link.notification(TX_UUID, chunk)
            await bridge.notifications.join()
            self.assertEqual(bridge.desktop.inbox, [])
            link.notification(TX_UUID, b"CHcrew")  # Wrong configured node.
            await bridge.notifications.join()
            self.assertFalse(link.ready(time.monotonic()))
            link.notification(TX_UUID, b"CHcami")
            await bridge.notifications.join()
            self.assertTrue(link.ready(time.monotonic()))
            for chunk in split_frame(frame, 2):
                link.notification(TX_UUID, chunk)
            await bridge.notifications.join()
            self.assertEqual(len(bridge.desktop.inbox), 1)
            self.assertTrue(link.client.writes)
            await link.close()
            self.assertFalse(link.ready(time.monotonic()))
        finally:
            consumer.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await consumer


if __name__ == "__main__":
    unittest.main()
