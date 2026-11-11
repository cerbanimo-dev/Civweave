# Pocket Commons · Thread 9 communicator

Pocket Commons is the first Civweave pocket-communicator firmware target for **M5Stack StickS3**.

The first build is intentionally useful before a radio is attached:

- an original creature, the **Threadling**, lives on the 135×240 display;
- encounters, carried packets, successful deliveries, rest, energy, curiosity, trust and XP form the game loop;
- state persists in ESP32 NVS;
- the binary carrier frame is already defined for bounded LoRa fragmentation;
- the normal firmware build is **radio-silent by default** (`CW_ENABLE_LORA=0`);
- LoRa becomes a transport adapter after the exact board/pinout and operating region are chosen.

## Why the creature is the UI

The pet is a status instrument rather than a cosmetic layer.

| Game event | Communicator meaning |
| --- | --- |
| encounter | another peer/device is discovered |
| carry | an outbound encrypted envelope is queued |
| deliver | a queued envelope reaches its destination |
| receive | useful inbound activity arrives |
| sleepy | energy budget is low |
| trust | successful consensual exchanges accumulate |
| curiosity | nearby activity encourages exploration |

This deliberately does **not** create another Civweave messaging owner. Human private messaging remains owned by `public/app/civweave-private-messaging-v1.js`. Pocket Commons frames are a carrier for already-encrypted Civweave envelopes; they are not a competing identity, inbox, key registry or plaintext mesh protocol.

## Current controls

- **A**: encounter
- **B**: if no mail is carried, pick up one demo packet; otherwise deliver one
- idle recovery: the Threadling rests after prolonged inactivity when energy is low

## Build

Install PlatformIO, connect the StickS3 over USB-C, then from this directory:

```bash
pio run
pio run -t upload
pio device monitor
```

Run the firmware unit tests with:

```bash
pio test -e sticks3
```

The browser-side transport/state contract can also be exercised from the repository root:

```bash
node scripts/test-pocket-commons-v1.mjs
```

## Radio boundary

Do not enable RF by guessing pins, frequency, antenna or power.

The StickS3 exposes a Hat2 expansion bus and Grove interface. M5Stack's current StickS3 documentation lists an ESP32-S3-PICO-1-N8R8, 8 MB flash, 8 MB PSRAM, 135×240 ST7789P3 display, audio, IMU and a 250 mAh battery.

M5Stack's current LoRa Cap line uses an SX1262; some variants cover 868–923 MHz. For U.S. operation, 902–928 MHz is among the Part 15 unlicensed bands, but the actual radio product, antenna, firmware parameters and device authorization still determine lawful operation. Thread 9 therefore leaves transmission disabled until the hardware is physically identified.

Official references:

- https://docs.m5stack.com/en/core/StickS3
- https://docs.m5stack.com/en/cap/Cap_LoRa868

## Transport frame v1

Each frame is at most 193 bytes:

- 2 bytes magic (`CW`)
- 1 byte version
- 1 byte flags
- 4 byte little-endian message ID
- 1 byte fragment index
- 1 byte fragment count
- 1 byte payload length
- 2 byte CRC-16/CCITT
- up to 180 bytes payload

Flags reserve explicit lanes for encrypted Civweave envelopes, discovery beacons and acknowledgements. Radio adapters must carry these bytes without becoming a second message owner.

## Staging simulator

The same state machine and transport framing are visible at:

`/labs/pocket-commons/`

It is a simulation only. It never transmits RF or sends a real private message.

## Thread 10 · opt-in nearby beacons before LoRa

The separate `sticks3_espnow` build enables **ESP-NOW** between nearby ESP32-S3 devices without Wi-Fi infrastructure, internet service, a phone, or any LoRa module. This is a strictly limited cooperative-game demonstration, not private messaging.

From this directory:

```bash
pio run -e sticks3_espnow
pio run -e sticks3_espnow -t upload
pio device monitor
```

Flash the **same** build to two StickS3 units and power them within short-range 2.4 GHz reach. Both use fixed Wi-Fi channel 1. On this build, Button A creates a local encounter; Button B packs a virtual game envelope, then Button B again queues one of four public beacons: `HELLO`, `PLAY?`, `READY`, `GG!`. The next beacon rotates after each queued send. Receiving a valid new beacon makes the Threadling react with an audio cue and increases its local XP/trust.

**Security and delivery limitations:**
- All ESP-NOW demo beacons are **broadcast and unencrypted**. They are not private, authenticated, end-to-end encrypted, guaranteed to arrive, or reliable emergency communications.
- The transport refuses arbitrary payloads and encrypted-message flags; only those four public preset strings can be sent/accepted.
- A CRC detects accidental corruption but **does not authenticate peers**. Another radio can spoof a demo beacon. Duplicate suppression is bounded and lasts only until reboot.
- A successful send return means **queued to the radio**, not recipient delivery. Do not advance delivery/trust milestones on send; future ACK frames and verified recipients are separate work.
- Never put names, location, passwords, personal messages, GPS coordinates, or private Civweave envelopes in this demo channel.
- When building `sticks3` (the default), the original radio-silent Thread 9 creature loop remains unchanged.
- LoRa hardware, frequencies, pins, antennas, and regional transmission settings are **not** selected, enabled, or inferred by this target.

Future work: route already-encrypted envelopes through the one canonical Civweave private-messaging owner via an authenticated phone bridge, add pairing and peer verification, authenticated acknowledgments, bounded retry and fragmentation, then integrate the exact LoRa module selected by the hardware owner.

A host-only contract for the frame/pet foundation can be run without any ESP32 toolchain:

```bash
g++ -std=c++17 -Wall -Wextra -Werror \
  -Itest/host -Iinclude \
  test/host/test_protocol_pet.cpp -o /tmp/civweave-pocket-contract
/tmp/civweave-pocket-contract
```

Hardware compilation, USB flashing, battery-life checks, and two-device radio verification remain manual gates before this should be marked device-tested.
