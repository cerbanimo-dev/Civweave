# StickS3 hardware and UIFlow2 bring-up

Research checked 11 November 2026 against manufacturer documentation. **The selected hardware is M5StickS3, and the primary software target is the existing UIFlow2/MicroPython environment with Bluetooth.** The new application has not been run on the user's device in this workspace. Prior prototype revision labels such as v0.3/v0.5 are not manufacturer firmware version numbers.

## Hardware identity

| Item | M5Stack StickS3 (SKU K150) | M5StickC Plus2, for identification only |
| --- | --- | --- |
| Processor | ESP32-S3-PICO-1-N8R8 | ESP32-PICO-V3-02 |
| Flash / PSRAM | 8 MB / 8 MB octal | 8 MB / 2 MB quad |
| Screen | 135 × 240, ST7789P3 | 135 × 240, ST7789V2 |
| Battery | 250 mAh | 200 mAh |
| User controls | Two keys plus power/reset | A/B plus C/power |
| Audio output | Codec, amplifier, speaker | Buzzer |

Sources: [StickS3 hardware](https://docs.m5stack.com/en/core/StickS3), [StickC Plus2 hardware](https://docs.m5stack.com/en/core/StickC-Plus2).

The StickS3 specifications do not list an onboard LoRa transceiver. Treat LoRa as an external add-on. Its Hat2 connector and power behavior differ from earlier StickC products; the manufacturer documents mechanical incompatibility with several older hats. Do not assume an accessory fits solely because its name includes “Stick.” [Hardware and compatibility notes](https://docs.m5stack.com/en/core/StickS3)

## Preserve the UIFlow2 starting point

The manufacturer's StickS3 instructions offer USB connection through the UiFlow2 WebTerminal. “Run Once” tests a program, while “Run Always” downloads it for continued use. Keep the existing working application and record the installed runtime before replacing the startup file. Installing this Python project does not require switching the board to native Arduino firmware. [StickS3 UIFlow2 guide](https://docs.m5stack.com/en/uiflow2/sticks3/program)

Required runtime interfaces for the first build:

- `M5`, including `M5.begin()`, `M5.update()`, `M5.Lcd`, `M5.BtnA`, and `M5.BtnB`.
- `m5ble.M5BLE` for the documented BLE server API.
- Standard MicroPython JSON, byte buffers, timing, and filesystem operations used by the core.

Record `os.uname()` and `sys.implementation` in the hardware test report. No exact manufacturer UIFlow2 release has been certified for this application here. If a required import is absent, keep the prior program available and use a StickS3-specific UIFlow2 image from M5Burner only after reviewing the manufacturer's recovery procedure. [Runtime identification](https://docs.micropython.org/en/latest/library/os.html), [firmware installation](https://docs.m5stack.com/en/uiflow2/sticks3/program)

## Verified display and buttons

`M5.begin()` belongs in startup and `M5.update()` in the main loop. Button methods include `isPressed()`, `wasPressed()`, `wasReleased()`, `wasClicked()`, and `wasHold()`. StickS3-specific examples use both BtnA and BtnB. [Button API](https://uiflow-micropython.readthedocs.io/en/latest/hardware/button.html), [StickS3 UIFlow2 examples](https://uiflow-micropython.readthedocs.io/en/develop/controllers/sticks3.html)

Graphics use camelCase methods on `M5.Lcd`: `fillRect(x,y,w,h,color)`, `drawString(text,x,y)`, `setTextColor(fg,bg)`, `width()`, `height()`, and `setRotation(rotation)`. Do not substitute Widgets drawing calls or snake_case method names. Read logical dimensions after selecting rotation instead of assuming the same rotation number always means landscape. Update small regions or a canvas rather than clearing the display every loop. [Display API](https://uiflow-micropython.readthedocs.io/en/develop/hardware/display.html)

### Push-to-talk boundary

The interaction requirement is **hold Button A to request talk/capture, release to submit, with no automatic microphone listening**. The first software release must identify which of these steps it actually implements. Sending PTT control events does not itself record audio, transcribe speech, or send a voice message.

The documented microphone object is `M5.Mic`, with `begin()`, `end()`, `record(buffer, rate, stereo)`, and `isRecording()`. Record uses a supplied buffer; asynchronous completion and actual sample format need physical verification. StickS3-specific documentation includes an audio example. A later audio adapter must stop on release, disconnect, error, or a bounded maximum duration and keep buttons/UI responsive. Do not repurpose a blocking five-second demonstration into the production PTT loop. [Microphone API](https://uiflow-micropython.readthedocs.io/en/latest/hardware/mic.html), [StickS3 audio example](https://uiflow-micropython.readthedocs.io/en/develop/controllers/sticks3.html)

## BLE is the first transport

The documented wrapper imports with `from m5ble import M5BLE`. Create a device, add RX/write and TX/notify characteristics to a service, register callbacks, and start advertising. Receive, connect, and disconnect callbacks receive `(server, connected_client_handle)`. The connected handle exposes `any(uuid)`, `read(uuid, sz=None)`, `write(data, uuid)`, and `close()`. `server.get_clients()` returns connected handles. [Current M5 BLE API](https://uiflow-micropython.readthedocs.io/en/latest/system/m5ble.html)

Use the BLE link as a byte transport. The project should keep bounded receive buffers, assemble complete frames before decoding text, reject malformed frames, and reset a partial frame on disconnect. Keep application acknowledgements separate from GATT write completion. A connection and a nickname do not establish user identity or authenticated pairing. These are project implementation requirements, not features automatically supplied by the wrapper.

A conservative initial fragment size is 20 bytes. The M5 wrapper exposes `get_mtu()` and client-side MTU negotiation, but its documentation warns that larger MTUs are not universal. Increase fragmentation size only after testing both endpoints. MicroPython also documents characteristic buffering and optional security flags; those low-level capabilities should not be assumed to be configured by a high-level M5BLE connection. [M5 BLE MTU methods](https://uiflow-micropython.readthedocs.io/en/latest/system/m5ble.html), [MicroPython Bluetooth API](https://docs.micropython.org/en/latest/library/bluetooth.html)

The desktop bridge is a BLE central. Routing a message from one StickS3 to a second through that bridge is an additional forwarding function. Do not label a one-device text console as a complete mesh or promise standalone phone interoperability before implementing the mobile bridge.

## Timing and persistence

`time.ticks_ms()` wraps. Use `time.ticks_diff(now, previous)` or `ticks_add()` for deadlines; direct subtraction and comparisons can fail across wraparound. Time since boot is not an authenticated wall clock. [MicroPython timing](https://docs.micropython.org/en/latest/library/time.html)

MicroPython documents `os.rename(old,new)` and, on supporting ports, `os.sync()`. The documentation does not establish that replacing a save file is power-loss atomic on every installed filesystem. Write a validated temporary save, retain a recovery copy or use versioned slots, and test interrupted writes on the actual device before claiming crash-safe persistence. [Filesystem operations](https://docs.micropython.org/en/latest/library/os.html)

## Optional later lane: ESP-NOW / native Arduino

This is research for a later adapter, not the primary firmware build. M5Unified lists StickS3 support. M5Stack's native PlatformIO example uses `espressif32@6.12.0`, `esp32-s3-devkitc-1`, 8 MB partitions, and octal PSRAM configuration. That platform's Arduino framework is 2.0.17 / ESP-IDF 4.4.7. [M5Unified](https://github.com/m5stack/M5Unified), [board configuration](https://docs.m5stack.com/en/core/StickS3), [PlatformIO release](https://github.com/platformio/platform-espressif32/releases/tag/v6.12.0)

M5Unified 0.3.0 and M5GFX 0.3.0 must be updated together; rotation and board identification changed. Pin and compile a coherent pair if this lane is opened. [Release notes](https://github.com/m5stack/M5Unified/releases)

ESP-NOW requires a shared Wi-Fi channel, peer configuration, and matching LMKs for encrypted unicast. Broadcast encryption is unsupported. Keep a 250-byte application-frame ceiling for compatibility. Receive callbacks should enqueue work; application acknowledgements establish acceptance, while a radio send callback only describes MAC-layer delivery. SDK callback signatures differ between IDF 4 and IDF 5, so this adapter needs its own pinned build. [ESP-IDF 4.4.7 ESP-NOW](https://docs.espressif.com/projects/esp-idf/en/v4.4.7/esp32/api-reference/network/esp_now.html), [ESP-IDF 5.1.6 ESP-NOW](https://docs.espressif.com/projects/esp-idf/en/v5.1.6/esp32/api-reference/network/esp_now.html)

## External LoRa integration boundary

No external radio pin map is selected. After hardware selection, record exact module SKU/chip, regional variant, antenna, actual interface, supply/logic voltage, peak current, and verified connector wiring. A raw SPI radio, UART modem, and device running another mesh firmware expose different interfaces.

The adapter must account for its payload budget, framing overhead, airtime, retries, acknowledgements, and end-to-end confidentiality/authentication. It must retain application message IDs and delivery states. Writing bytes to a radio is insufficient evidence of remote application receipt. Multihop routing, automatic cloud relay, and voice transport require separate implementations.

## Physical acceptance checks still required

1. Record actual StickS3 firmware/runtime details and back up its existing application.
2. Run once over USB and verify screen orientation, both buttons, and recovery access.
3. Connect the desktop BLE bridge; test each direction with actual application acknowledgements.
4. Disconnect during a partial frame and during PTT. Ensure partial bytes and capture state are cleared.
5. Send malformed, duplicate, oversized, and non-ASCII messages; verify no crash or duplicate effects.
6. Restart and check companion state. Exercise corrupted and interrupted save recovery.
7. For any later microphone adapter, verify release/disconnect/timeout stops recording and that no recording happens at startup.
8. Measure battery use with the intended display/radio settings. Capacity alone does not establish runtime.

Until these checks happen, describe the release as a software prototype with physical BLE and device validation outstanding.
