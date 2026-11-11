#!/usr/bin/env python3
"""Explicit-peer plaintext BLE lab bridge for Civweave Pocket.

Install the hardware-only dependency: python -m pip install bleak==3.1.0
Examples (run from the project directory):
  python tools/ble_bridge.py --simulate
  python tools/ble_bridge.py --scan
  python tools/ble_bridge.py --lab-plaintext --peer cami=AA:BB:CC:DD:EE:01 --send cami "hello"
  python tools/ble_bridge.py --lab-plaintext --peer cami=AA:BB:CC:DD:EE:01 --peer crew=AA:BB:CC:DD:EE:02

Open Link on each device, then approve the connected session with Button A.
CH readiness messages are a user-interface hint, not authentication. There is
no automatic reconnect, microphone capture, cloud relay, or private-message
security in this development bridge. A relay ACK always comes from its final
recipient. The desktop ACKs only messages actually accepted by its own core.

Bleak API reference checked against 3.1.0:
https://bleak.readthedocs.io/en/latest/api/client.html
https://bleak.readthedocs.io/en/latest/api/scanner.html
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import json
import math
import re
import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from core import protocol
from core.messenger import Messenger
from transport.ble_frames import Assembler, split_frame

SERVICE_UUID = "bc257ca0-197e-4ba4-8ab7-c70ef45c0020"
RX_UUID = "bc257ca0-197e-4ba4-8ab7-c70ef45c0021"
TX_UUID = "bc257ca0-197e-4ba4-8ab7-c70ef45c0022"
DESKTOP_NODE = "desk"
READY_TTL = 10.0
APPROVAL_TIMEOUT = 90.0
NOTIFICATION_LIMIT = 64
FORWARD_LIMIT = 64
FORWARD_TTL = 120.0


class RouteError(ValueError):
    """A frame cannot be accepted or forwarded under the explicit peer map."""


class Router:
    """Transport-independent source checks and application-ACK routing.

    The peer map is operator configuration, not cryptographic identity. A
    bounded ledger ensures relay ACKs match an observed text in reverse.
    """

    def __init__(self, peers, desktop=None):
        self.peers = frozenset(peers)
        if not self.peers or len(self.peers) > 2 or DESKTOP_NODE in self.peers:
            raise ValueError("configure one or two peripheral nodes, excluding desk")
        self.desktop = desktop if desktop is not None else Messenger(DESKTOP_NODE)
        self.forwarded = {}

    def route(self, source, frame, ready_peers, now):
        """Return [(destination, original_frame_or_local_ACK)] or reject.

        Forwarding never calls Messenger.receive on a third-party message,
        so an unavailable recipient cannot accidentally receive a bridge ACK.
        """
        if source not in self.peers or source not in ready_peers:
            raise RouteError("source link is not configured and ready")
        try:
            packet = protocol.decode(frame)
        except (ValueError, TypeError) as exc:
            raise RouteError("invalid application frame: " + str(exc)) from exc
        if packet["from"] != source:
            raise RouteError("packet source does not match its configured BLE link")
        target = packet["to"]
        if target == DESKTOP_NODE:
            return [(source, ack) for ack in self.desktop.receive(frame, now)]
        if target not in self.peers or target == source:
            raise RouteError("destination is not another configured peer")
        if target not in ready_peers:
            raise RouteError("destination link is not ready; sender must retry")
        self.forwarded = {key: expiry for key, expiry in self.forwarded.items()
                          if expiry > now}
        if packet["kind"] == protocol.TEXT:
            key = (packet["id"], source, target)
            if key not in self.forwarded and len(self.forwarded) >= FORWARD_LIMIT:
                raise RouteError("forwarding ledger is full; sender must retry")
            # Repeated copies do not extend this observation's lifetime.
            self.forwarded.setdefault(key, now + FORWARD_TTL)
        elif packet["kind"] == protocol.ACK:
            key = (packet["id"], target, source)
            if key not in self.forwarded:
                raise RouteError("ACK does not match an observed forwarded message")
        else:
            raise RouteError("unsupported application kind")
        return [(target, bytes(frame))]


def parse_peer(value):
    """Require a node=address/UUID mapping; never resolve by device name."""
    node, separator, address = value.partition("=")
    if not separator or not re.fullmatch(r"[a-z0-9_-]{1,12}", node):
        raise argparse.ArgumentTypeError("peer must be lowercase node=BLE_ADDRESS")
    if node == DESKTOP_NODE:
        raise argparse.ArgumentTypeError("desk is reserved for this computer")
    is_mac = re.fullmatch(r"(?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}", address)
    is_uuid = re.fullmatch(r"[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}", address)
    if not (is_mac or is_uuid):
        raise argparse.ArgumentTypeError("use the exact MAC address or macOS UUID printed by --scan")
    return node, address


def matching_advertisement(device, advertisement):
    services = {str(item).lower() for item in (advertisement.service_uuids or [])}
    label = (advertisement.local_name or device.name or "").lower()
    return SERVICE_UUID in services or label.startswith(("civweave", "cwpocket", "cw-", "pocket"))


class PeerLink:
    """One BLE connection; its whole application frames are serialized."""

    def __init__(self, node, device, client_class, notifications, log):
        self.node = node
        self.device = device
        self.notifications = notifications
        self.log = log
        self.assembler = Assembler()
        self.epoch = 0
        self.ready_at = None
        self.transfer_id = 0
        self.lock = asyncio.Lock()
        self.rx_characteristic = None
        self.client = client_class(device, disconnected_callback=self.disconnected,
                                   services=[SERVICE_UUID], timeout=30.0)

    @property
    def connected(self):
        return bool(self.client.is_connected)

    def ready(self, now):
        return (self.connected and self.ready_at is not None
                and 0 <= now - self.ready_at <= READY_TTL)

    def reset(self):
        self.epoch += 1
        self.ready_at = None
        self.assembler.reset()

    def disconnected(self, _client):
        self.reset()
        self.log(self.node + ": disconnected; partial frame and PTT state cleared, microphone off")

    def notification(self, _characteristic, data):
        chunk = bytes(data)
        if not chunk or len(chunk) > 20:
            self.reset()
            self.log(self.node + ": dropped invalid notification length; waiting for readiness")
            return
        try:
            self.notifications.put_nowait((self.node, self.epoch, chunk, time.monotonic()))
        except asyncio.QueueFull:
            # Invalidate this link's queued fragments; never combine a frame
            # across a known dropped fragment. Other links retain their epochs.
            self.reset()
            self.log(self.node + ": notification queue overflow; partial transfer discarded")

    async def open(self):
        await asyncio.wait_for(self.client.connect(), timeout=35.0)
        service = self.client.services.get_service(SERVICE_UUID)
        if service is None:
            raise RuntimeError(self.node + ": required communicator service is absent")
        rx = service.get_characteristic(RX_UUID)
        tx = service.get_characteristic(TX_UUID)
        if rx is None or tx is None or "write" not in rx.properties or "notify" not in tx.properties:
            raise RuntimeError(self.node + ": expected RX/write and TX/notify characteristics are absent")
        self.rx_characteristic = rx
        await asyncio.wait_for(self.client.start_notify(tx, self.notification), timeout=10.0)
        self.log(self.node + ": BLE connected; use Button A on the device to approve this lab session")

    async def write_frame(self, frame):
        async with self.lock:
            if not self.ready(time.monotonic()):
                raise ConnectionError(self.node + ": destination is no longer ready")
            self.transfer_id = self.transfer_id % 255 + 1
            chunks = split_frame(frame, self.transfer_id)

            async def write_all():
                for chunk in chunks:
                    if not self.ready(time.monotonic()):
                        raise ConnectionError(self.node + ": lost readiness during transfer")
                    await self.client.write_gatt_char(self.rx_characteristic, chunk, response=True)
                    # A small cooperative pause lets the device consume its
                    # characteristic buffer between write requests.
                    await asyncio.sleep(0.015)

            try:
                await asyncio.wait_for(write_all(), timeout=5.0)
            except Exception:
                self.reset()
                raise

    async def close(self):
        self.reset()
        with contextlib.suppress(Exception):
            await asyncio.wait_for(self.client.disconnect(), timeout=5.0)


class Bridge:
    def __init__(self, peer_devices, client_class, log=print):
        self.log = log
        self.notifications = asyncio.Queue(maxsize=NOTIFICATION_LIMIT)
        self.desktop = Messenger(DESKTOP_NODE)
        self.router = Router(peer_devices, self.desktop)
        self.links = {node: PeerLink(node, device, client_class, self.notifications, log)
                      for node, device in peer_devices.items()}
        self.consumer = None

    def ready_nodes(self, now):
        return {node for node, link in self.links.items() if link.ready(now)}

    def desktop_events(self):
        for event in self.desktop.drain_events():
            # repr prevents text from becoming terminal control sequences.
            self.log("desk: " + repr(event))
            if event["event"] == "received":
                record = next((row for row in reversed(self.desktop.inbox)
                               if row["id"] == event["id"] and row["from"] == event["peer"]), None)
                if record is not None:
                    self.log("desk message from " + record["from"] + ": " + repr(record["body"]))

    async def write(self, target, frame):
        try:
            await self.links[target].write_frame(frame)
            return True
        except Exception as exc:
            self.log(target + ": write failed, no delivery acknowledged: " + str(exc))
            return False

    async def consume(self):
        while True:
            node, epoch, chunk, arrived = await self.notifications.get()
            link = self.links[node]
            try:
                if epoch != link.epoch or not link.connected:
                    continue
                now = time.monotonic()
                if chunk.startswith(b"CH"):
                    # A Hello only reports that the device UI approved this
                    # session. It is not a secret, identity proof, or pairing.
                    if chunk != b"CH" + node.encode("ascii"):
                        link.reset()
                        self.log(node + ": Hello identity differs from configured link; ignored")
                        continue
                    was_ready = link.ready(now)
                    link.ready_at = arrived
                    if link.ready(now) and not was_ready:
                        self.log(node + ": device reports approval; plaintext lab ready (not authenticated)")
                    continue
                if not link.ready(now):
                    link.assembler.reset()
                    self.log(node + ": data ignored while awaiting device approval/readiness")
                    continue
                if chunk in (b"CP1", b"CP0"):
                    state = "start" if chunk == b"CP1" else "end"
                    self.log(node + ": PTT " + state + " control received; microphone off, no audio captured")
                    continue
                try:
                    frame = link.assembler.feed(chunk, arrived)
                    if frame is None:
                        continue
                    writes = self.router.route(node, frame, self.ready_nodes(now), now)
                    for target, outgoing in writes:
                        if await self.write(target, outgoing):
                            packet = protocol.decode(outgoing)
                            self.log("forwarded " + str(packet["kind"]) + " " + packet["id"]
                                     + " to " + target + "; awaiting final recipient where applicable")
                    self.desktop_events()
                except (ValueError, TypeError) as exc:
                    link.assembler.reset()
                    self.log(node + ": frame rejected: " + str(exc))
            finally:
                self.notifications.task_done()

    async def run(self, send=None, duration=0):
        try:
            results = await asyncio.gather(*(link.open() for link in self.links.values()),
                                           return_exceptions=True)
            errors = [result for result in results if isinstance(result, BaseException)]
            if errors:
                raise RuntimeError("connection setup failed: " + "; ".join(str(error) for error in errors))
            self.consumer = asyncio.create_task(self.consume())
            deadline = time.monotonic() + APPROVAL_TIMEOUT
            while len(self.ready_nodes(time.monotonic())) < len(self.links):
                if self.consumer.done():
                    await self.consumer
                if not all(link.connected for link in self.links.values()):
                    raise ConnectionError("a device disconnected before approval; restart the bridge to retry")
                if time.monotonic() >= deadline:
                    raise TimeoutError("device approval timed out; reopen Link and approve with Button A")
                await asyncio.sleep(0.1)
            started = time.monotonic()
            sent_id = None
            if send:
                sent_id = self.desktop.queue_text(send[0], send[1], started)
                self.log("desk: queued " + sent_id + "; delivery requires the destination application ACK")
            self.log("Bridge active. Ctrl+C ends this session. No automatic reconnect.")
            while True:
                now = time.monotonic()
                if self.consumer.done():
                    await self.consumer
                if not all(link.connected for link in self.links.values()):
                    raise ConnectionError("a configured peer disconnected; ending this session")
                if duration and now - started >= duration:
                    self.log("Session time limit reached.")
                    return 0 if sent_id is None else 1
                if send:
                    for frame in self.desktop.tick(now, self.links[send[0]].ready(now)):
                        await self.write(send[0], frame)
                    self.desktop_events()
                    message = next(item for item in self.desktop.outbox if item["id"] == sent_id)
                    if message["state"] in ("delivered", "failed", "expired"):
                        self.log("desk: final message state = " + message["state"])
                        return 0 if message["state"] == "delivered" else 1
                await asyncio.sleep(0.1)
        finally:
            if self.consumer is not None:
                self.consumer.cancel()
                # A consumer that already failed must not prevent connection
                # cleanup; its error is raised by the main loop above.
                await asyncio.gather(self.consumer, return_exceptions=True)
            await asyncio.gather(*(link.close() for link in self.links.values()), return_exceptions=True)


def simulate():
    """Deterministic three-node routing/framing demo; imports no BLE library."""
    def ids(start):
        counter = [start]
        def next_id():
            counter[0] += 1
            return counter[0].to_bytes(8, "big")
        return next_id

    cami = Messenger("cami", id_factory=ids(0))
    crew = Messenger("crew", id_factory=ids(100))
    desk = Messenger("desk", id_factory=ids(200))
    router = Router(("cami", "crew"), desk)
    ready = {"cami", "crew"}
    serial = [0]

    def through_fragments(frame, now):
        serial[0] = serial[0] % 255 + 1
        assembler = Assembler()
        completed = None
        for chunk in split_frame(frame, serial[0]):
            completed = assembler.feed(chunk, now)
        if completed != frame:
            raise AssertionError("framing round trip failed")
        return completed

    cami.queue_text("crew", "Meet in Violet Town", 0)
    original = cami.tick(0, True)[0]
    forwarded = router.route("cami", through_fragments(original, 0), ready, 0)
    assert len(forwarded) == 1 and forwarded[0][0] == "crew"
    assert cami.outbox[0]["state"] == "sent"  # A relay is not an ACK.
    for _ in range(2):  # Duplicate delivery must not duplicate the inbox.
        ack = crew.receive(through_fragments(forwarded[0][1], 0.1), 0.1)[0]
        destination, same_ack = router.route("crew", through_fragments(ack, 0.2), ready, 0.2)[0]
        assert destination == "cami" and same_ack == ack
        cami.receive(through_fragments(same_ack, 0.3), 0.3)

    crew.queue_text("desk", "Crew checked in", 1)
    replies = router.route("crew", through_fragments(crew.tick(1, True)[0], 1), ready, 1)
    crew.receive(through_fragments(replies[0][1], 1.1), 1.1)
    desk.queue_text("cami", "Hello from the desktop", 2)
    response = cami.receive(through_fragments(desk.tick(2, True)[0], 2), 2.1)[0]
    assert router.route("cami", through_fragments(response, 2.2), ready, 2.2) == []
    assert cami.outbox[0]["state"] == crew.outbox[0]["state"] == desk.outbox[0]["state"] == "delivered"
    assert len(crew.inbox) == len(cami.inbox) == len(desk.inbox) == 1
    return {"mode": "in-memory simulation", "hardware_used": False,
            "nodes": ["cami", "crew", "desk"], "delivered": 3,
            "duplicate_inbox_entries": 0, "bridge_synthesized_relay_acks": 0,
            "framing": "20-byte BLE fragments; complete application ACK round trips",
            "microphone": "off"}


async def hardware(args):
    try:
        from bleak import BleakClient, BleakScanner
    except ImportError as exc:
        raise RuntimeError("install hardware support with: python -m pip install bleak==3.1.0") from exc
    print("Scanning once; this does not connect to discovered devices.")
    discoveries = await BleakScanner.discover(timeout=args.scan_seconds, return_adv=True)
    if args.scan:
        found = 0
        for device, advertisement in discoveries.values():
            if matching_advertisement(device, advertisement):
                print(device.address + "  " + repr(advertisement.local_name or device.name or "unnamed"))
                found += 1
        if not found:
            print("No matching communicator advertisement. Open Link on the device and scan again.")
        return 0
    by_address = {device.address.casefold(): device for device, _ in discoveries.values()}
    selected = {}
    for node, address in args.peer:
        device = by_address.get(address.casefold())
        if device is None:
            raise RuntimeError(node + ": explicit address was not observed; open Link and rerun --scan")
        selected[node] = device
    print("PLAINTEXT LAB SESSION: messages are not private or cryptographically authenticated.")
    return await Bridge(selected, BleakClient).run(send=args.send, duration=args.duration)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--simulate", action="store_true", help="run a deterministic demo without Bluetooth")
    mode.add_argument("--scan", action="store_true", help="report matching service/name advertisements only")
    parser.add_argument("--peer", action="append", default=[], type=parse_peer, metavar="NODE=ADDRESS")
    parser.add_argument("--lab-plaintext", action="store_true", help="acknowledge the development transport lacks message privacy")
    parser.add_argument("--send", nargs=2, metavar=("NODE", "TEXT"), help="send one message from desk; exit on its final state")
    parser.add_argument("--scan-seconds", type=float, default=8.0)
    parser.add_argument("--duration", type=float, default=0, help="optional session limit in seconds; 0 waits for Ctrl+C")
    args = parser.parse_args(argv)
    if not 1 <= args.scan_seconds <= 30 or not math.isfinite(args.duration) or args.duration < 0 or args.duration > 86400:
        parser.error("scan-seconds must be 1..30; duration must be 0..86400")
    if args.simulate or args.scan:
        if args.peer or args.send:
            parser.error("--simulate and --scan do not accept --peer or --send")
    else:
        if not args.lab_plaintext:
            parser.error("communications require --lab-plaintext; this prototype is not private messaging")
        if not 1 <= len(args.peer) <= 2:
            parser.error("configure one or two explicit --peer NODE=ADDRESS values")
        if len({node for node, _ in args.peer}) != len(args.peer) or len({address.casefold() for _, address in args.peer}) != len(args.peer):
            parser.error("peer nodes and addresses must each be unique")
        if args.send and args.send[0] not in {node for node, _ in args.peer}:
            parser.error("--send destination must be a configured peer")
        if args.send:
            try:
                protocol.encode(protocol.TEXT, "0000000000000001", DESKTOP_NODE, args.send[0], args.send[1])
            except ValueError as exc:
                parser.error(str(exc))
    try:
        if args.simulate:
            print(json.dumps(simulate(), indent=2))
            return 0
        return asyncio.run(hardware(args))
    except KeyboardInterrupt:
        print("Session ended; no microphone was active.")
        return 130
    except Exception as exc:
        print("Bridge stopped: " + str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
