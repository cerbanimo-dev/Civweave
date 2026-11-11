# Pocket laboratory protocol and transport contract

CL1. This is an endpoint/application-ACK protocol for a small device lab.
It is not the existing Civweave signed-object mesh protocol or Thread 9's `CW`
Pocket Commons carrier. The distinct `CL` magic prevents either decoder from
mistaking lab plaintext for an encrypted-envelope carrier. All byte counts,
queue bounds, and state transitions below are executable in `tests/`.

## Application packet

| Offset | Bytes | Meaning |
| --- | --- | --- |
| 0 | 2 | ASCII `CL` (Civweave Lab) |
| 2 | 1 | Version `1` |
| 3 | 1 | Kind: `1` text; `2` acknowledgement |
| 4 | 8 | Random nonzero message ID; hexadecimal string at the API boundary |
| 12 | 1 | Sender byte count, 1–12 |
| 13 | 1 | Recipient byte count, 1–12 |
| 14 | 1 | Body byte count, 0–120 |
| 15 | variable | Sender, recipient, then UTF-8 body |
| last 2 | 2 | CRC-16/CCITT-FALSE, big endian, over all preceding bytes |

Node IDs use lowercase ASCII letters, digits, `_` and `-`. Text must be nonblank.
Text allows newline but rejects control characters. ACK body is empty; its ID is
the original text ID and its endpoints are reversed. Maximum packet is **161
bytes**. CRC parameters: polynomial `0x1021`, initial value `0xFFFF`, no reflection,
no final XOR. The standard `123456789` check is `0x29B1`.

CRC and ID matching do not authenticate a sender. A production adapter must
provide its own verified security boundary and account-to-device binding.

## BLE fragmentation

Service: `bc257ca0-197e-4ba4-8ab7-c70ef45c0020`.
RX/central writes with response: `bc257ca0-197e-4ba4-8ab7-c70ef45c0021`.
TX/peripheral notifies: `bc257ca0-197e-4ba4-8ab7-c70ef45c0022`.

Every data characteristic write/notification is **exactly 20 bytes**:

| Byte | Meaning |
| --- | --- |
| 0 | `0xC1` |
| 1 | Transfer ID, 1–255; local framing counter, not identity |
| 2 | Zero-based fragment index |
| 3 | Total fragments, 1–11 |
| 4 | Useful payload count, 1–15 |
| 5–19 | Payload followed by zero padding |

All non-final fragments carry 15 payload bytes. Reassembly accepts matching
duplicate fragments but discards out-of-order, conflicting, malformed, oversized,
or older-than-three-second partial transfers. Disconnect clears partial state.
Fixed-size framing also handles a UIFlow2 read buffer that concatenates writes.
The outer adapter never decodes partial UTF-8 strings.

Control notifications have separate short lengths:

- `CH` plus local node ID: emitted after physical approval, repeated every two
  seconds. It signals readiness only and is not authentication.
- `CP1` / `CP0`: push-to-talk start/end control indication. This release captures
  no audio and keeps its microphone off.

The peripheral starts advertising only after the local Link action. A connection
requires A approval within the original 60-second window. B rejects. Data written
before approval is discarded. One active client is accepted. The bridge requires
explicit node/address mappings and refuses to route a packet whose claimed source
differs from its configured incoming link. Neither check makes this plaintext lab
safe against a determined radio attacker.

## Delivery state

`queued → sent → delivered`, or `failed` / `expired`.

A write success is only an attempt. A matching application ACK from the expected
endpoint after a real send changes the state to delivered. Delivered means the
recipient application accepted the message; it is not proof that a human read it.
The device attempts to persist its inbox before emitting an ACK; desktop receipt
storage is in memory for this lab session.

With a continuously available link, attempts occur at **0, 2, 6, 14 seconds**, and
failure at 30 seconds without an ACK. Local expiry is 120 seconds from enqueue,
including offline time. There is no wall-clock expiry field, hop counter, route
discovery, mesh forwarding, or range promise in this packet. Extending it to a
store-and-forward mesh requires a new reviewed contract.

Limits: 16 outbox records (pending records cannot be evicted to make room), 32
inbox records, 64 dedupe keys, 64 events. Inbox IDs are pinned in dedupe history.
An already seen text receives another ACK without a second inbox entry. After
records leave bounded history, indefinite replay suppression is not guaranteed.

Snapshot reloads mark unfinished messages `failed / restart_requires_retry`.
They do not silently replay or reinterpret old process uptime. Explicit Retry
last creates a new ID and may produce a second recipient message if the original
arrived but its ACK was lost; this is a deliberate resend, not exactly-once
delivery. Automatic retries keep the same ID.

## Adapter responsibilities

The core returns frames; adapters move them. All adapters must preserve packet
bytes, bound queues, report unavailable links, clear partial state on disconnect,
and leave ACK creation to the receiving application. A relay must never invent
a final-recipient ACK.

The desktop bridge's bounded forwarding ledger correlates relayed ACKs with an
observed message and reversed endpoints. It does not enqueue third-party text as
a local message. Current operation supports at most two peripherals plus `desk`.

For LoRa, extend the existing Pocket Commons carrier in
`native/sticks3-communicator/include/protocol.hpp` and
`public/labs/pocket-commons/core.mjs`. Never mark CL1 plaintext as an encrypted
envelope. Actual private-message envelope creation/validation remains with the
canonical Civweave owner. This lab is an application-ACK test harness, not a
competing production inbox or LoRa wire standard.

Select hardware and region before choosing pins, payload framing,
airtime budget, legal radio settings, or retransmission timing. The 161-byte
application size is a software limit, not a promise that it fits every LoRa
configuration or network payload budget. No LoRa, Meshtastic, MeshCore or LoRaWAN
interoperability is claimed. Keep images, voice and model weights off this
short-message channel until a separate tested transport supports them.
