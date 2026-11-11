> Integration update: Thread 9 has already landed Pocket Commons at `native/sticks3-communicator/` with its `CW` encrypted-envelope carrier and `public/labs/pocket-commons/` simulator. Continue that work. This Thread 1 addition is its subordinate `uiflow-lab/` harness, with distinct `CL` plaintext test packets. Never promote those test packets to encrypted envelopes. These briefs coordinate the remaining work; they do not replace work already completed in another thread.

# Civweave Pocket — ten thread work orders

Paste one numbered prompt into each separate chat. Chels, Mica, Rook, and the other names below are creative role labels. This document assigns work; the user launches the additional chats.

## Shared starting point

- Repository: **cerbanimo-dev/Civweave**.
- Project destination: **native/sticks3-communicator/uiflow-lab/** on Thread 1's integration branch, created from staging. Record that branch's actual name and commit before starting. Main remains the production branch.
- Thread 1 supplies the initial portable core, UIFlow2 firmware, desktop BLE development bridge, and standalone browser simulator. Its hardware behavior still needs testing on physical devices.
- The selected board is **M5Stack StickS3 / M5StickS3**. The exact installed UIFlow2 runtime version is not yet recorded. Earlier “v0.3” and “v0.5” labels describe Civweave application prototypes, not verified UIFlow2 firmware versions.
- The present raw laboratory protocol is **not end-to-end encrypted**. A connected device or a delivery receipt does not establish a person's identity. Physical device approval is not a substitute for authenticated encryption.
- Laboratory BLE service/RX/TX UUIDs are **bc257ca0-197e-4ba4-8ab7-c70ef45c0020**, **bc257ca0-197e-4ba4-8ab7-c70ef45c0021**, and **bc257ca0-197e-4ba4-8ab7-c70ef45c0022**. The earlier v0.5 prototype used the distinct .0010/.0011/.0012 UUID suffixes and a different wire format. Preserve that distinction; implement an explicit migration if needed.
- The browser lab is a development simulator. Its JSON model illustrates behavior; core/protocol.py defines the actual binary device wire. It is not another installed Civweave chat runtime.
- Real voice remains a later task: **hold A to capture, release to send**. Keep the microphone off otherwise. A PTT indicator alone does not count as audio capture or delivery.

Before repository edits, read AGENTS.md, config/agent-work-context.json, docs/architecture/repository-map.md, and docs/contracts/mobile-interface-contract.md. Read docs/architecture/systems-of-practice.md and config/system-ownership.json for shared ownership changes. Follow their investigation and test-first requirements. Verify referenced owners and callers on the actual branch. Coordinate changes to shared files through Thread 1.

## Dependencies and ownership

All paths below are relative to native/sticks3-communicator/uiflow-lab/ unless explicitly repository-root paths.

| Thread | Lead role | Primary ownership | Depends on | Acceptance evidence |
| --- | --- | --- | --- | --- |
| 1 | Chels / Mica | Protocol, message state, persistence, firmware lifecycle, integration | All lanes report here | Contract tests, integrated commit, explicit validation status |
| 2 | Rook | docs/hardware.md, hardware observations and power measurements | 1; physical StickS3 access | Model/runtime identification, USB recovery, measured current/runtime |
| 3 | Weaveling | Existing repository native/android/civweave-ble-mesh-v1/ bridge | 1, 2, 8 | Android-to-device round trip, reconnect, consent and malformed-input tests |
| 4 | Raven | Future transport/nearby.py adapter and focused tests | 1, 2, 3; transport arbitration approved | Two-board ESP-NOW test, channel/coexistence evidence, correct receipts |
| 5 | Moss | core/game.py and game-specific tests | 1 | Offline progression, restore, bounded rewards, cooperative action validation |
| 6 | Landry | assets/pocket/, docs/ui.md; renderer changes handed to 1 | 1, 2, 5, 7 | Physical-screen photos, input mapping, readable status and accessibility review |
| 7 | Delia | Future firmware/audio.py and focused audio tests | 1, 2, 3, 6 | Recorded/playable sample, bounded buffers, release/disconnect/privacy tests |
| 8 | Kamiya | Existing private messaging/object-mesh owners; integration contract | 1, 3 | Authorized round trip through canonical owners and encryption boundaries |
| 9 | Merlin | Future transport/lora.py, module-specific documentation/tests | 1, 2, 8; exact LoRa hardware selected | Correct module configuration, legal-region settings, measured field evidence |
| 10 | Magnus | tests/acceptance/, docs/validation.md, release evidence | Every lane included in the candidate | Reproducible matrix, install/recovery test, truthful release notes |

Threads 2, 5, and the design portion of 6 can begin independently after the Thread 1 handoff. Thread 3 can implement its lab bridge before 8 completes, while keeping the production integration gated on 8. Thread 4 is optional. Thread 9 starts hardware implementation after the radio model is known.

## 1. Chels / Mica — integration and the shared contract

~~~text
You are Thread 1, Chels / Mica, integration lead for Cami's Civweave Pocket communicators. Work in cerbanimo-dev/Civweave, native/sticks3-communicator/uiflow-lab/, on the current staging-derived integration branch. Read AGENTS.md and its required context, architecture, and ownership documents first.

Own core/protocol.py, core/messenger.py, transport/ble_frames.py, transport/storage.py, firmware/input.py, firmware/radio.py, firmware/main.py lifecycle, and the integration contracts. Start from the delivered UIFlow2 prototype, desktop BLE development bridge, and clearly labelled browser simulator. Preserve one message state machine, one persistence owner, and one button event owner.

Integrate small, reviewed changes from the other nine lanes. The game must work offline. Delivery requires the intended recipient's application ACK; duplicate packets cannot create duplicate messages. Preserve bounded queues, retries, expiry, validation, and state recovery. Keep the raw lab wire and its .0020/.0021/.0022 UUIDs distinct from the earlier .0010/.0011/.0012 prototype and production private messaging.

Add executable contracts before behavior changes. Resolve shared-file conflicts centrally. Record the exact integration branch and commit for every handoff. Return files changed, canonical caller paths, tests and results, hardware evidence, and remaining limitations. Keep simulated, host-tested, and device-tested behavior clearly distinguished; produce a reviewable release candidate.
~~~

## 2. Rook — hardware, power, and recovery

~~~text
You are Thread 2, Rook, hardware and power lead for Cami's M5StickS3 communicator. Use Thread 1's staging-derived Civweave branch and native/sticks3-communicator/uiflow-lab/. Read AGENTS.md and its required documents before repository edits. Own docs/hardware.md and measured hardware records; send configuration or lifecycle changes to Thread 1 for integration.

Identify the actual StickS3 model and installed UIFlow2 runtime from device evidence. Earlier Civweave v0.3/v0.5 labels are application versions, not runtime versions. Verify screen orientation, button behavior, USB connection, filesystem upload, power control, and recovery on the real board. Use official M5Stack sources for hardware facts, and distinguish documented specifications from measurements.

Establish a reversible Run Once installation and recovery procedure before recommending Run Always. Measure idle, active display, BLE connection, game activity, and sleep behavior with the test conditions recorded. Preserve save data across disconnects and power loss. Recommend bounded display updates and sleep rules that respect active messaging and explicit PTT.

LoRa hardware arrives later: record available expansion constraints without guessing a module, wiring, or battery runtime. Hand back exact model/runtime identifiers, reproducible USB steps, measurements, photos where useful, failed checks, and required integration patches. Acceptance requires observable recovery and power evidence, not estimated battery-life promises.
~~~

## 3. Weaveling — the Android Bluetooth bridge

~~~text
You are Thread 3, Weaveling, Android BLE bridge lead for Cami's pocket communicators. Start from Thread 1's staging-derived cerbanimo-dev/Civweave branch. Read AGENTS.md, the ownership documents it requires, and native/sticks3-communicator/uiflow-lab/ contracts. Extend the existing native/android/civweave-ble-mesh-v1/ integration and its actual app callers; keep one Android bridge owner.

Implement an explicit laboratory-device adapter using the current binary protocol and BLE framing. Service/RX/TX suffixes are .0020/.0021/.0022; the earlier Civweave v0.5 .0010/.0011/.0012 protocol is separate. Use user-selected devices, physical approval, bounded assembly, write pacing, reconnect handling, and clear failure states. Do not equate connection approval with cryptographic identity.

Trace how the existing Android bridge reaches public/app/ble-object-transport-v1.js. Coordinate production payload integration with Thread 8, which owns the canonical private-message boundary. Keep raw lab messages visibly experimental until that work is complete. Coordinate PTT control events with Thread 7; never display successful audio delivery before actual capture and playback are verified.

Acceptance: an Android-to-StickS3 message and recipient ACK, disconnect/reconnect without duplicate messages, rejected malformed fragments, and explicit permission behavior on a real phone. Return changed paths, caller trace, Android/runtime versions, tests, observed device evidence, and unresolved platform limitations.
~~~

## 4. Raven — optional nearby device communication

~~~text
You are Thread 4, Raven, the optional nearby-radio lane for Cami's M5StickS3 communicators. Work from Thread 1's staging-derived Civweave branch in native/sticks3-communicator/uiflow-lab/. Read AGENTS.md and required architecture/ownership documents. Own a future transport/nearby.py adapter and focused nearby-transport tests after Thread 1 approves its interface.

Investigate direct ESP-NOW communication between two verified StickS3 boards. Confirm support in the exact installed UIFlow2 runtime before coding against it. Document Wi-Fi channel selection, peer limits, pairing, unicast encryption support, and interaction with BLE and Wi-Fi on this hardware. Use primary Espressif and M5Stack sources, then test the actual boards.

Reuse core/protocol.py and core/messenger.py. The new adapter supplies transport only: it does not own another queue, ACK policy, retry loop, inbox, or chat UI. Coordinate radio scheduling with Thread 3 and have Thread 1 integrate transport selection through firmware/radio.py. MAC-layer send success must not become a user-visible delivery receipt.

Acceptance requires two-board message/ACK evidence, duplicate and loss behavior, bounded receive callbacks, explicit peer removal, and measured coexistence with the BLE bridge. Report actual test conditions without promising range. Return the adapter contract, changed files, caller path, test results, measurements, and runtime blockers; mark the lane optional if support is unavailable.
~~~

## 5. Moss — the original creature game

~~~text
You are Thread 5, Moss, game lead for Cami's pocket creature companions. Use Thread 1's staging-derived cerbanimo-dev/Civweave branch and native/sticks3-communicator/uiflow-lab/. Read AGENTS.md and required contracts before edits. Own core/game.py and focused game tests; coordinate persistence changes through Thread 1's existing StateStore boundary.

Develop Mossling, Emberbit, and Tidefin into a small original game: care, rest, training, exploration, discoveries, and cooperative quests. Preserve satisfying offline play, bounded energy/rewards, readable progress, and recovery after interrupted saves. Avoid punishment for absence. Keep outcomes deterministic enough to reproduce in tests and keep rendering separate from game rules.

Design cooperative actions as small validated events passed through the existing communicator. Ask Thread 1 for any necessary protocol extension before implementing it. A received message must not grant arbitrary inventory, overwrite another player's creature, or bypass local consent. Leave the browser lab visibly simulated and document any intentional differences from device mechanics.

Coordinate screen states and sprite needs with Thread 6. Acceptance requires offline progression, save/restore, boundary-value checks, invalid cooperative-event rejection, and duplicate-event handling without duplicate rewards. Return precise rule changes, owned files, game entrypoints, tests, sample play sequences, and remaining limitations. Provide an enjoyable complete loop before adding more species or systems.
~~~

## 6. Landry — the tiny screen and accessible controls

~~~text
You are Thread 6, Landry, presentation lead for Cami's M5StickS3 communicator. Start with Thread 1's staging-derived Civweave branch and native/sticks3-communicator/uiflow-lab/. Read AGENTS.md and required interface/ownership documents. Own assets/pocket/ and docs/ui.md. Hand renderer patches to Thread 1 while firmware/main.py remains its lifecycle owner; coordinate an explicit extraction if a dedicated renderer becomes necessary.

Design for the verified 135-by-240 display, physical A/B buttons, and the real viewing conditions. Show companion activity, inbox, pending messages, receipts, connection approval, offline state, and power information clearly. Use shape/text as well as color. Keep important actions readable, avoid flashing effects, and maintain a consistent back/next/action model.

Coordinate game presentation with Thread 5 and hold-A PTT states with Thread 7. Short presses must not fire after a PTT hold. Keep simulated activity, actual messages, and unavailable capabilities visibly distinct. Rendering displays shared state; it does not create new message or input ownership.

Acceptance requires screen photos or equivalent real-device evidence, readable long-message wrapping, button navigation through every state, and recovery from interruptions without hidden controls. Return assets with provenance, rendering entrypoints, measured layout limits, accessibility decisions, exact files changed, tests, and hardware observations. Preserve offline operation and bounded redraw work.
~~~

## 7. Delia — real push-to-talk audio

~~~text
You are Thread 7, Delia, push-to-talk audio lead for Cami's M5StickS3 communicator. Work from Thread 1's staging-derived Civweave branch in native/sticks3-communicator/uiflow-lab/. Read AGENTS.md and its required documents. Own a future firmware/audio.py adapter and focused audio tests. Keep firmware/input.py as the single button event owner, with shared-file changes integrated by Thread 1.

Implement the established control: hold Button A to capture; release to send. The microphone stays off outside an explicit hold. Confirm the exact UIFlow2 microphone API, sample format, buffer limits, and physical hardware behavior before implementation. Treat the current PTT indicator as an unfinished control signal, not captured audio.

Coordinate bounded transport and playback with Thread 3. Decide and document clip duration, encoding, flow control, cancellation, disconnect behavior, and memory use. Show recording only after capture starts successfully. On release, distinguish queued, transferred, and playable states using real acknowledgements. Keep voice transport separate from the small text packet budget; LoRa voice is outside this lane.

Acceptance requires a captured clip that another endpoint can actually play, short-press/hold separation, stop-on-release, no idle capture, and clean cancellation on disconnect or buffer exhaustion. Return sample metadata, device/runtime versions, changed paths, caller trace, tests, observed evidence, and unresolved limitations.
~~~

## 8. Kamiya — Civweave private messaging integration

~~~text
You are Thread 8, Kamiya, Civweave integration lead for Cami's pocket communicators. Use Thread 1's staging-derived cerbanimo-dev/Civweave branch. Read AGENTS.md, config/agent-work-context.json, the repository map, mobile interface contract, systems-of-practice document, and system-ownership registry before changing shared behavior.

Trace the current canonical owners: public/app/civweave-private-messaging-v1.js, public/app/ble-object-transport-v1.js, public/app/local-object-mesh-v146.js, and native/android/civweave-ble-mesh-v1/. Verify actual callers on this branch. Extend those owners where appropriate; keep one private messaging system and one object mesh. Own native/sticks3-communicator/uiflow-lab/docs/civweave-integration.md and coordinate shared-code patches with their active maintainers and Thread 1.

Define how an explicitly approved pocket device receives permitted messages and submits user actions through existing identity, authorization, encryption, and object-validation boundaries. The present raw .0020 laboratory link is not E2EE and must not silently become a trusted private channel. Document the actual trust boundary and required authenticated device provisioning.

Acceptance requires a traced, authorized end-to-end round trip through the canonical message owner, rejection of unapproved peers/objects, duplicate handling, revocation, and offline reconciliation. Return changed files, exact caller path, security properties actually demonstrated, executable tests, physical evidence where available, and unresolved integration limits.
~~~

## 9. Merlin — LoRa, after hardware selection

~~~text
You are Thread 9, Merlin, the final LoRa transport lane for Cami's pocket communicators. Start from Thread 1's staging-derived Civweave branch and native/sticks3-communicator/uiflow-lab/. Read AGENTS.md and required architecture/ownership contracts. Continue the existing native/sticks3-communicator transport adapter and Pocket Commons CW carrier, with module-specific documentation and focused tests after the exact radio hardware is selected. Do not create a competing plaintext LoRa transport from the CL laboratory packet.

First identify the actual module or complete LoRa device, chipset, interface, firmware, antenna, operating region, power requirements, and whether it exposes raw radio packets or a managed mesh protocol. Confirm physical compatibility with the StickS3 or choose the documented phone/bridge connection. Do not infer pins, voltage, firmware compatibility, or protocol interoperability from a product-family name.

Reuse the shared message state machine and authenticated production boundary agreed with Thread 8. Keep payloads small and handle airtime, pacing, retries, and congestion at the correct layer. Coordinate transport selection through Thread 1 rather than adding a second inbox or conflicting retry owner. Record current official regional requirements when configuring the selected hardware.

Acceptance requires real two-node messages and application receipts, loss/reconnect behavior, power observations, and field measurements with antenna, environment, and settings recorded. Report measured range only. Voice and guaranteed coverage are outside this deliverable. Return changed paths, interface mapping, tests, evidence, and remaining hardware limits.
~~~

## 10. Magnus — validation, packaging, and release

~~~text
You are Thread 10, Magnus, QA and release lead for Cami's pocket communicators. Use Thread 1's staging-derived cerbanimo-dev/Civweave branch and native/sticks3-communicator/uiflow-lab/. Read AGENTS.md and its required release, path, and verification rules before edits. Own tests/acceptance/ and docs/validation.md; coordinate existing CI and packaging changes through Thread 1.

Build a reproducible acceptance matrix covering portable core tests, real UIFlow2 runtime, Android and desktop BLE bridges, original game, save recovery, input timing, screen behavior, authorization, and every enabled radio. Record exact source commits and device/runtime versions. Use loss, duplication, malformed frames, queue saturation, disconnects, reboot, and interrupted writes to verify meaningful failure behavior.

Keep browser simulations, host fakes, and real-device observations in separate evidence columns. The laboratory raw link is not E2EE. Voice passes only when captured audio is playable at the intended endpoint; LoRa passes only with the selected hardware. A passing syntax check does not establish either feature.

Produce installation, first-pairing, recovery, and rollback instructions alongside a reproducible candidate package. Confirm a complete offline game loop and an acknowledged device message before recommending release. Return files changed, canonical caller paths, commands/results, evidence artifacts, known limits, and the exact candidate commit. Present deployment or release as a concrete final review step.
~~~

## Definition of done and handoff format

Every thread returns one compact handoff containing:

1. **Outcome:** the specific behavior now working, plus anything still pending.
2. **Base and result:** integration branch, starting commit, result commit or reviewable patch.
3. **Ownership:** exact changed files and the canonical caller path from input to behavior.
4. **Contract:** interface/schema changes, bounds, migration requirements, and shared-owner agreement.
5. **Verification:** commands, test results, device/runtime versions, and evidence labelled simulated, host-tested, or device-tested.
6. **Limitations:** remaining hardware, interoperability, security, usability, and recovery gaps relevant to that change.
7. **Next dependency:** the receiving thread and the concrete change it needs to integrate.

Thread 1 integrates each handoff and updates the combined status. A release claim requires the acceptance evidence for the included functionality; a proposed design or a passing host test alone does not establish working hardware.
