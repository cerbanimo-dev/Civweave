# Thread 1 integration with Thread 9's Pocket Commons

While Thread 1 was building the UIFlow2 Bluetooth lab, Thread 9 added the native
Pocket Commons firmware and simulator to staging. The communicator boundary was inspected at commit
`c9ad776ea85858e4cc2c19b5c0be9dac85ea0585`; the integration branch is based on
`31ab1021d5214245c6350ffafba7944a1de573ee` (November 11, 2026), including Thread 9's subsequent PlatformIO target correction.

Thread 1 therefore nests its source under
`native/sticks3-communicator/uiflow-lab/`, rather than establishing another
top-level device project. The installed UIFlow2 environment and the native
Arduino build remain distinct execution targets. This change does not flash or
replace either target on a device.

| Responsibility | Owner and boundary |
| --- | --- |
| Production private messages and encryption | Existing `public/app/civweave-private-messaging-v1.js`; the small-device lab cannot create a production account, inbox or encrypted-message claim |
| Signed/offline object mesh | Existing `public/app/local-object-mesh-v146.js` |
| Existing application BLE mesh | `public/app/ble-object-transport-v1.js` and `native/android/civweave-ble-mesh-v1/` |
| Pocket Commons radio carrier | `native/sticks3-communicator/include/protocol.hpp` and its browser contract `public/labs/pocket-commons/core.mjs`; `CW` magic, 13-byte header, up to 180 payload bytes |
| Native Threadling presentation | `native/sticks3-communicator/src/main.cpp` and `include/pet.hpp`; transport remains radio-silent |
| UIFlow2 development exercises | This `uiflow-lab/` package: original game, device button/transport tests, plaintext development packets and application ACKs |

## Deliberate protocol separation

The existing native carrier has an `EncryptedEnvelope` flag. Merely setting that
flag does not encrypt or validate a payload. Its caller must supply an already
validated canonical encrypted envelope.

This lab uses **`CL`** magic and a separate BLE service (`...0020`) so its plaintext
test messages cannot be decoded as native `CW` carrier frames. It does not set
the encrypted flag or emit production objects. The protocol boundary tests
reject packets with the other format's magic, even with a fresh checksum.

The browser lab is a developer exercise, not an installed app route. Thread 9's
existing `/labs/pocket-commons/` route remains available. The new lab's creature
progress and simulated inbox stay local to its own development file.

## Next merge points

1. Thread 2 verifies the user's actual StickS3/UIFlow2 image and measures the
   device; compare that route with the native firmware without blindly flashing.
2. Thread 3 extends the existing Android bridge for the selected target.
3. Thread 8 connects canonical private-message envelopes, pairing, authorization
   and recipient receipts. A radio link receipt must not become a human read
   receipt. The plaintext development message core is not promoted to a product
   messaging owner.
4. Thread 9 carries those approved envelopes through the existing `CW` carrier
   once the actual LoRa hardware and region are known. It must not transmit the
   `CL` laboratory payloads as encrypted data.
5. Thread 10 records hardware/phone evidence and the remaining publication gates.

These are defined handoffs, not claims that production integration, voice or
LoRa transmission has already passed.
