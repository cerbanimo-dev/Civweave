# Civweave private messaging and mail relay v1

## Purpose

Civweave uses the mail infrastructure as an online store-and-forward transport without turning free member identities into public email accounts.

## Identity namespaces

### Free member private messaging

A member chooses a unique Civweave username such as `riverfox`.

The online relay derives an internal transport slot:

`riverfox_pm@civweave.cc`

That address is implementation detail only. It is never presented as the member's email address, never advertised through SMTP, and cannot receive external internet email. The user-facing identity is `@riverfox`.

The `_pm` slot stores only encrypted private-message envelopes and delivery metadata. The relay is not the canonical conversation database.

### Paid email

Human-visible `name@civweave.cc` mail is a separate paid entitlement and must use a separate claim path. Possessing a free private-messaging username does not create, reserve, expose, or authorize a public mailbox.

### Guide mailboxes

`weaveling@civweave.cc`, `moss@civweave.cc`, `kamiya@civweave.cc`, `rook@civweave.cc`, and `merlin@civweave.cc` are public system intake identities. They may receive external email and are not member PM transport slots.

## One encrypted envelope, multiple transports

Private messaging is offline first. A message is encrypted on the sender's device before any transport sees it. The same `civweave.pm.envelope.v1` object may travel through:

1. direct nearby mesh exchange;
2. Hub/local-object gossip and opportunistic pass-by exchange;
3. the hidden `_pm` online relay when internet is available.

Transport convergence uses the envelope UUID. Receiving the same envelope through mesh and relay is harmless and deduplicated locally.

The server sees routing username, key fingerprints, ciphertext size, timing, and relay metadata, but not plaintext message content.

## Crypto boundary

v1 uses per-device P-256 ECDH keys, HKDF-SHA-256 key derivation, and AES-256-GCM message encryption. Private keys remain non-exportable after local import and are stored in the browser's IndexedDB structured-clone storage. Contacts are identified by public-key fingerprints.

The relay verifies that an authenticated sender username uses its registered public key and that the recipient fingerprint matches the current directory key before accepting an envelope.

This v1 key agreement is a baseline transport privacy layer, not a Signal-protocol replacement. Forward secrecy, multi-device key fanout, safety-number UX, key transparency, and pre-key rotation belong to the next protocol revision before Civweave should market the system as a mature high-assurance messenger.

## External-email firewall

Any inbound SMTP message whose recipient local-part ends in `_pm` is rejected before storage. Hidden PM slots also cannot call the public mail inbox/send API.

## Catch-up and low traffic

Inbound mail/relay delivery is event-driven. Clients gossip locally whenever nearby connectivity exists and run online catch-up opportunistically on app foreground, network return, and an adaptive 30-second to 2-hour backoff ladder. A successful transfer snaps the interval back toward active mode.

The goal is convergence without constant polling: mesh carries what it can, the relay holds what mesh cannot currently reach, and each receiving device republishes useful encrypted envelopes to its local mesh after successful relay retrieval.

## Feedback and bug-report intake

Public guide email is deliberately separate from private messaging. Users may submit feature requests and bug reports to the five guide addresses. Those messages enter the feedback automation queue, not another member's private conversation.

The daily feedback pipeline is:

1. collect new guide-mail intake;
2. redact obvious secrets and sender contact data from automation artifacts;
3. deduplicate related reports;
4. classify bug, feature, question, abuse/spam, or unsafe/high-stakes request;
5. assess evidence, severity, affected surface, reproducibility, privacy/security impact, implementation scope, and confidence;
6. group candidates into a daily discernment batch;
7. open a human veto window;
8. after the window closes with no veto, prioritize bounded safe candidates;
9. dispatch implementation branches from the current `dev` integration branch;
10. require focused tests, repository policy checks, and validation receipts;
11. merge passing automation work only to `dev`;
12. require the repository's normal human approval boundary before `dev` work can ever reach `main`.

Security/privacy incidents, destructive migrations, payments/economic changes, governance changes, legal-policy changes, credential changes, and low-confidence proposals are never auto-implemented. They may be triaged and summarized but must remain human-gated.
