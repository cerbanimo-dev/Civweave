# Acceptance evidence and remaining device work

## Verified in this build environment

- Portable Python message, game, framing, save, input, radio-adapter and bridge
  unit tests. Fake radio objects exercise approval and disconnect paths.
- Three-node simulation: cami → crew, crew → desk, desk → cami, all with actual
  application ACK round trips through the Python framing implementation.
- Browser lab full-script syntax and deterministic logic checks in Node.js.
- Python syntax compilation; no BLE package is required for simulation/tests.

See the committed test source and the PR's exact result count. These results do
not establish hardware interoperability.

## Not yet verified

- Physical StickS3 execution on the user's installed UIFlow2 image; the exact
  release and import/API behavior must be captured in the device log.
- BLE advertising, characteristic subscription, notification buffering, Windows
  or Android BLE transport, real radio packet delivery, and reconnect behavior.
- Screen/font layout, battery discharge, wake behavior, and power-interrupted
  flash recovery on the actual board.
- Browser rendering and touch operation. Chromium launch in this environment
  failed under a socket restriction; no rendered screenshot or UI pass is claimed.
- Microphone recording, speaker playback, live voice, device-to-device direct
  radio, Android APK integration, authenticated pairing, end-to-end encryption,
  LoRa or multi-hop mesh. These are assigned follow-on threads.

## First device acceptance sequence

1. Record the printed StickS3/K150 label, `os.uname()`, `sys.implementation`, and
   existing working firmware version. Keep the previous working program.
2. Use the installer plan to inspect exact paths; copy into the isolated project
   directory, then run once. Confirm portrait geometry and all three status
   labels: OFFLINE, BLE LAB and MIC OFF.
3. Exercise B menu, A action, B hold, depleted energy/rest and each canned message.
   Verify holding A never triggers its tap action, and the microphone stays off.
4. Save game progress. Restart, restore it, and confirm unsent messages require
   deliberate retry. On a disposable lab save, damage the newest slot and verify
   recovery from the older valid slot.
5. Open Link. Confirm advertising times out after 60 seconds without approval,
   B rejects, and A grants one session. Check that preapproval data has no effect.
6. Send desktop → device, device → desktop, then device → device through the
   explicit bridge. For every message confirm sender state, receiver body, ACK
   correlation, and that a bridge relay never claims receipt for the destination.
7. Disconnect during a fragmented transfer. Verify no partial inbox message,
   no duplicate inbox entry on retry, bounded failure, and a fresh physical
   approval for the next session.
8. Drop a receipt, duplicate a packet, fill queues, and restart. Compare device
   behavior with the deterministic tests. Report exact observed evidence.
9. Confirm 30-second dimming and five-minute idle radio shutdown. Measure battery
   current in idle, game, BLE and dimmed states before stating runtime.
10. Only after these gates pass should a chosen startup launcher be installed.

## Handoff record

Every thread returns: branch and commit; changed paths; the interface consumed;
test commands and actual results; device/OS/runtime versions; observed failure
modes; and remaining limits. Simulations, hardware observations, and proposed
features must remain distinguishable in the report.
