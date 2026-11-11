# Civweave Pocket Communicators

**Thread 1 · 0.6.0 hardware lab · November 11, 2026**

A first usable development slice for Cami's **M5Stack StickS3** pocket communicators: an original offline creature game, a bounded short-message protocol, a UIFlow2 device application, a desktop Bluetooth bridge, and an interactive browser simulator. This UIFlow2/Bluetooth laboratory is part of Thread 9's existing Pocket Commons communicator project; LoRa work extends that project's existing encrypted-envelope carrier.

The current hardware route is **StickS3 → Bluetooth → your computer → Bluetooth → another StickS3**. One StickS3 can also exchange messages with the computer. The browser lab simulates two devices entirely on one computer; it is independent of the real BLE link.

## Try the game and communicator now

Open **`web/pocket-lab.html`** in a browser. It is a single offline file and needs no account, dependencies, or server.

1. Choose Mossling, Emberbit, or Tidefin for Cami and Crew.
2. Care, train, rest, and explore. Your companion pauses safely when you leave.
3. Type a short message. Watch it remain in flight until its application receipt arrives.
4. Pause the simulated link, queue a message, and reconnect.
5. Drop a receipt or duplicate a packet to see retries and duplicate suppression.

The page states **LOCAL SIMULATOR — no radio connection**. It never requests the microphone. Browser progress uses localStorage; if storage is unavailable, it visibly runs as a temporary session. Core logic is tested; browser rendering still needs visual verification on user devices.

## What is implemented

| Part | Current behavior |
| --- | --- |
| Portable message core | 120 UTF-8 byte messages; bounded outbox/inbox; application ACKs; duplicate suppression; four attempts; expiry; validated save/restore |
| Original companion game | Mossling, Emberbit, Tidefin; care, train, explore, rest; level progression and discoverable treasures; no neglect damage |
| StickS3 application | Portrait screen; A action, B menu, hold B home/save; offline game; canned messages; inbox/outbox; explicit Bluetooth start and physical connection approval |
| Desktop BLE bridge | Explicit device address mapping; one/two peripherals; text relay; recipient-generated ACKs; terminal messages; readiness and disconnect handling |
| PTT control | Hold A starts a control indication; release ends it. **Microphone remains off; captured/transmitted audio is not implemented.** |
| Persistence | Two bounded snapshot slots with SHA-256 checksums; a damaged slot can recover from the other; unfinished messages require a deliberate new retry after restart |
| Power behavior | Display dims after 30 seconds without local interaction; Bluetooth stops after five minutes; no measured battery-life claim |
| LoRa | Adapter contract and assigned work; no driver, radio choice, pin mapping, or over-air test yet |

This is a **plaintext hardware lab**, with a visible label and a required `--lab-plaintext` flag. Physical approval limits accidental connections; it does not establish cryptographic identity. CRC detects damaged frames, and ACK correlation checks delivery state; neither provides encryption or protection against a correctly forged packet. Private communications need the later authenticated transport integration.

## Run the checks without hardware

Requires Python 3.10+ and Node.js 20+ on the development computer. No Python packages are needed for these checks.

```bash
python -m unittest discover -s tests -p "test_*.py"
node tests/browser-smoke.mjs
python tools/ble_bridge.py --simulate
```

The simulator exercises actual Python framing and message-core ACK round trips among `cami`, `crew`, and `desk`. It does not use Bluetooth. Optional real-browser checks are documented in `tests/browser-smoke.mjs`; they require Playwright and Chromium.

## Load one StickS3 for a first device test

Keep the already working **StickS3 UIFlow2** environment. The earlier pocket app's v0.3/v0.5 labels are application revisions, not certified manufacturer firmware versions. The exact installed UIFlow2 version must be recorded during the device check. This project has not been run on physical hardware in this build environment.

1. Confirm the device is **StickS3 / K150**. StickC Plus2 is a different board. Close other programs using its USB serial port.
2. From this directory install the desktop tools:

   ```bash
   python -m pip install mpremote
   python -m pip install -r requirements-bridge.txt
   python -m mpremote connect list
   ```

3. Substitute the actual port for `COM5`. Preview the copy, then copy the modules:

   ```bash
   python tools/install_device.py --port COM5 --node cami --peer desk --plan
   python tools/install_device.py --port COM5 --node cami --peer desk
   ```

   The installer checks for `/flash`, `M5`, and `m5ble`, then copies only into `/flash/civweave_pocket`. It does not flash a manufacturer image or replace `boot.py`/the existing startup program. A failed prerequisite stops the copy; preserve the existing firmware and inspect the device rather than guessing another board target.

4. Run the installed application once:

   ```bash
   python -m mpremote connect COM5 run firmware/uiflow_launcher.py
   ```

   Alternatively, after the files are copied, paste `firmware/uiflow_launcher.py` into UIFlow2 Python Custom Edit and choose **Run Once**. Use **Run Always** only after device acceptance checks pass. The standard manufacturer's [StickS3 UIFlow2 guide](https://docs.m5stack.com/en/uiflow2/sticks3/program) explains USB WebTerminal and those two actions.

5. Press **B** to reach **Link**, then **A** to open its 60-second connection window. From a second computer terminal:

   ```bash
   python tools/ble_bridge.py --scan
   python tools/ble_bridge.py --lab-plaintext --peer cami=ACTUAL_ADDRESS --send cami "Hello from the desktop"
   ```

   Replace `ACTUAL_ADDRESS` with the address or macOS UUID printed by the scan. Approve with **A on the StickS3**. B rejects. The terminal and device show a development link. Use the device's Say hello / On my way / Meet up pages to send back to `desk`.

For two devices, install one as `--node cami --peer crew` and the other as `--node crew --peer cami`. Run both, open Link on both, scan, then:

```bash
python tools/ble_bridge.py --lab-plaintext --peer cami=FIRST_ADDRESS --peer crew=SECOND_ADDRESS
```

Approve each physical device. The computer must remain connected; this release does not provide direct Stick-to-Stick radio or phone forwarding. Exact Bluetooth connection limits depend on the computer adapter. Reconnection is a deliberate fresh session. Node IDs are local lab labels, not accounts or verified people.

## Controls

| Input | Result |
| --- | --- |
| A tap | Act on selected menu page; approve a pending link request |
| B tap | Next page; reject a pending link request |
| B hold, 0.8 seconds | Return to Companion and save dirty progress |
| A hold, 0.4 seconds | PTT control indication, clearly marked microphone off |
| Release A | End PTT control indication |
| Link → A | Start a 60-second BLE window, or close the current link |
| Retry last → A | Enqueue a new ID for the latest failed/expired message |

Messages use a tiny-screen-compatible font; non-Latin glyph coverage depends on the installed font. The wire accepts valid UTF-8. In this firmware build, companion choice and canned-message recipient are set through `config.json`; the browser lab provides the more convenient companion picker.

## Repository integration

Source location: **`native/sticks3-communicator/uiflow-lab/`** in `cerbanimo-dev/Civweave`, on a feature branch from `staging`.

This module owns the small device game and its laboratory transport. It is not an installed Civweave chat surface, production private-message envelope, guild identity system, or replacement object mesh. Future phone integration must extend the existing owners:

- `public/app/civweave-private-messaging-v1.js`
- `public/app/local-object-mesh-v146.js`
- `public/app/ble-object-transport-v1.js`
- `native/android/civweave-ble-mesh-v1/`

Thread 9's Arduino firmware and Threadling simulator remain at `native/sticks3-communicator/` and `public/labs/pocket-commons/`. This subordinate UIFlow2 lab preserves the user's working runtime and adds host-tested failure/ACK exercises. Its `CL1` packet magic deliberately differs from the native carrier's `CW1`, and its plaintext payloads must never be labelled encrypted or automatically passed to LoRa. See `docs/integration.md`.

The previous v0.5 Pocket bridge uses service UUID ending `0010`, RX `0011`, TX `0012`. This lab uses `0020`, `0021`, `0022` and does not claim wire compatibility with that APK or with Civweave's existing object-mesh BLE service. The older saved package remains a separate existing artifact; no device is silently upgraded.

Read **`docs/ten-threads.md`** for all ten ready-to-copy work orders, **`docs/protocol.md`** for the shared interface, **`docs/hardware.md`** for verified hardware sources, and **`docs/acceptance.md`** for the remaining on-device evidence.
