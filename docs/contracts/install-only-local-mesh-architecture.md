# Civweave install-only and foreground phone mesh architecture

## Product boundary

The public origin is an installer, updater, recovery doorway, and optional exchange rendezvous. It is not a live Civweave application server.

The installed PWA is the application. Its device package contains the complete frontend, realm workbenches, Cabinet Mode and Cabinet Only, local semantic model runtime, application services, offline state machinery, and the foreground phone mesh.

During installation or an explicit update, the release origin may deliver immutable package bytes. After installation, ordinary application and model requests are cache-only. Network access is reserved for explicit release checks and consented object exchange.

## Runtime boundary

### Installed PWA

The PWA owns:

- the Civweave hub, cabinets, realm workbenches, and Lite mode;
- IndexedDB and OPFS application state;
- local model files and workers;
- signed community-object inboxes, outboxes, receipts, and deduplication;
- foreground WebRTC data-channel exchange between phones and other browser-capable devices;
- QR, copy/paste, short-code, or configured rendezvous pairing;
- peer capability manifests and version negotiation;
- resumable chunk transfer with backpressure;
- per-object delivery priority;
- automatic sync whenever paired peers are simultaneously open;
- public/federated store-and-forward relaying within signed hop limits;
- direct/group endpoint delivery without third-party payload relaying;
- deterministic retry, receipts, conflict handling, and expiry.

There is **no Android core, native companion, Wi-Fi Direct dependency, or always-on daemon in v1**.

The first mesh release intentionally targets users whose Civweave PWA is open on their phones. Sleeping-phone/background delivery is a later transport problem, not a prerequisite for the object protocol or foreground mesh.

### Optional community gateway

A public gateway may provide:

- signed release metadata and device-package distribution;
- optional rendezvous and signaling;
- consented envelope relay;
- public presence and federation records;
- community-intended object transfer.

It must not be the canonical store for private local work and must not serve the campus as a live website. Foreground peer exchange must continue to work without a gateway once peers can exchange WebRTC signaling data through any supported pairing path.

## Install-only rule

Top-level Civweave application routes require installed display mode. A browser tab is redirected to the installer unless an explicit localhost developer bypass is active. Embedded realm consoles are allowed when their parent is the installed shell.

The install prompt cannot be forced. Chromium exposes `beforeinstallprompt` only after browser-defined eligibility and engagement checks. Safari installation uses the platform share menu. The installer therefore prepares the complete package first, then exposes the browser-supported installation action or platform instructions.

## Community object contract

Every transferable object uses a versioned signed envelope with:

- immutable object ID and revision hash;
- origin node and author credential;
- object kind and schema;
- intended audience and community purpose;
- consent class: private, direct, group, public, or federated;
- payload hash and signature;
- created, expires, and updated timestamps;
- signed hop limit;
- conflict parent references;
- delivery receipts and rejection reasons.

Signed object fields are immutable in transit. Transport state such as hops used, visited peers, chunk progress, priority, retries, and acknowledgements lives outside the signed object in a transit envelope or local delivery state. A transport must never decrement `hopLimit` or otherwise mutate signed fields before validation.

Local storage is canonical. Publishing means adding a signed object to the local outbox. Delivery transports may include foreground WebRTC peers, removable export/import, or a configured community gateway.

## Foreground phone mesh v1

### Pairing

A foreground session is established with WebRTC. Civweave can exchange offer/answer signaling through QR, copy/paste, a short code, or a configured rendezvous service. The signaling path is replaceable and is not part of the object protocol.

No automatic background discovery is promised in v1. A paired session is useful whenever both users have Civweave open.

### Peer hello and capabilities

After the encrypted WebRTC data channel opens, peers exchange:

- node identity;
- protocol version;
- supported object schema;
- foreground/background capability;
- resumable-chunk support;
- maximum chunk size;
- delivery-priority support;
- relay policy;
- explicitly shared group identifiers when group delivery is enabled.

Unsupported protocol versions fail closed rather than silently downgrading object validation.

### Manifest-first sync

Peers exchange compact manifests before payload bytes. A manifest lists transferable object IDs, revision hashes, revision numbers, object kinds, consent class, payload byte size, chunk count, priority, expiry, signed hop ceiling, and current transit state.

The receiver compares the manifest to local objects and previously stored partial transfers, then requests only missing objects or missing chunks.

### Resumable chunks

Large serialized objects are split into bounded chunks. Partial receive state is kept in IndexedDB while the app remains available, so an interrupted foreground connection can resume missing chunks instead of restarting the object.

The data channel uses buffered-amount backpressure. A complete serialized object is hash-checked, parsed, then passed through the existing signed-object validator before application.

### Priorities

Delivery priority is local transport metadata, not a signed object mutation. Direct objects default above group objects, validation/receipt traffic may be elevated, and public/federated traffic remains lower by default. Callers may explicitly set a bounded priority.

Priority changes scheduling order only. They do not bypass consent, audience, expiry, signature, deduplication, or hop rules.

### Store and forward

Public and federated objects may be relayed by foreground peers while their signed hop limit has not been exhausted. Transit metadata records hops used and visited nodes independently of the signed object.

Direct and group payloads are endpoint-only in v1. They are not stored by unrelated relay peers. This avoids turning ordinary phones into unintended custodians of private payloads before Civweave has a separate end-to-end relay-encryption contract.

### Automatic foreground sync

When a paired channel identifies its peer, Civweave automatically exchanges manifests. New queued objects, newly received relayable objects, app focus, restored visibility, and restored connectivity trigger another foreground manifest pass.

Correctness does not depend on Background Sync, Periodic Background Sync, service-worker wakeups, or an operating-system daemon.

## Sleeping phones later

Sleeping/background delivery is explicitly deferred. A future transport may use whatever browser or operating-system facilities are practical at that time, but it must plug into the same community-object, transit, manifest, chunk, receipt, priority, and consent contracts.

No native Android component is reserved or required by this architecture.

## Delivery phases

1. Install-only route boundary and complete-package readiness reporting.
2. Local community-object database, outbox, inbox, receipts, signatures, and deduplication.
3. Foreground phone WebRTC pairing and automatic open-app sync.
4. Manifest-first exchange, priority scheduling, resumable chunk transfer, and safe public/federated store-and-forward.
5. Optional gateway rendezvous, federation, and consented relay.
6. Sleeping-phone/background transports when the product actually needs them and the platform path is justified.
7. Governed signed package updates through the Anarchadia execution kernel.

## Acceptance

- The public browser experience cannot enter the campus before installation.
- The installed PWA remains fully usable with the release origin unavailable.
- All ordinary application/model requests are satisfied from the installed package.
- Local records never depend on a successful network write.
- Two users with Civweave open can pair and exchange signed objects without a native companion.
- A foreground reconnection can request only missing chunks from an interrupted transfer.
- Priority affects send order but never authorization.
- Signed object fields are unchanged during transit.
- Public/federated relay respects signed hop ceilings and visited-node deduplication.
- Direct/group payloads are not relayed through unrelated peers.
- Peer or gateway delivery can be retried without duplicate application.
- A peer cannot receive an object outside its declared audience and consent policy.
- Cabinet Mode and Cabinet Only use the same install boundary and local exchange runtime.
- Sleeping-phone behavior is not claimed until a future transport actually implements it.
