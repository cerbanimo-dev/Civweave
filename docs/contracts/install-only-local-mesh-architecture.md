# Civweave install-only and local mesh architecture

## Product boundary

The public origin is an installer, updater, recovery doorway, and optional exchange rendezvous. It is not a live Civweave application server.

The installed PWA is the application. Its device package contains the complete frontend, realm workbenches, Cabinet Mode and Cabinet Only, local semantic model runtime, application services, and offline state machinery.

During installation or an explicit update, the release origin may deliver immutable package bytes. After installation, ordinary application and model requests are cache-only. Network access is reserved for explicit release checks and consented object exchange.

## Runtime rings

### Ring 1: installed PWA

The PWA owns:

- the Civweave hub, cabinets, realm workbenches, and Lite mode;
- IndexedDB and OPFS application state;
- local model files and workers;
- a signed community-object inbox and outbox;
- foreground WebRTC data-channel exchange;
- QR, copy/paste, or short-code pairing;
- optional HTTP exchange with a local companion or community gateway;
- deterministic retry, deduplication, receipts, and expiry.

### Ring 2: optional local node companion

A local node is required for capabilities browsers cannot provide reliably:

- persistent background operation while the PWA is closed;
- LAN listening ports and WebSocket services;
- automatic peer discovery;
- scheduled transfers independent of browser background-sync support;
- durable relay for several devices in one household or community;
- larger local models and native integrations.

The companion is optional for ordinary offline Civweave use. It is required only for an always-on mesh.

### Ring 3: community gateway

A public gateway may provide:

- signed release metadata and device-package distribution;
- optional rendezvous and signaling;
- consented envelope relay;
- public presence and federation records;
- community-intended object transfer.

It must not be the canonical store for private local work and must not serve the campus as a live website.

## Install-only rule

Top-level Civweave application routes require installed display mode. A browser tab is redirected to the installer unless an explicit localhost developer bypass is active. Embedded realm consoles are allowed when their parent is the installed shell.

The install prompt cannot be forced. Chromium exposes `beforeinstallprompt` only after browser-defined eligibility and engagement checks. Safari installation uses the platform share menu. The installer therefore prepares the complete package first, then exposes the browser-supported installation action or platform instructions.

## Community object contract

Every transferable object uses a versioned envelope with:

- immutable object ID and revision hash;
- origin node and author credential;
- object kind and schema;
- intended audience and community purpose;
- consent class: private, direct, group, public, or federated;
- payload hash and optional signature;
- created, expires, and last-forwarded timestamps;
- hop limit and visited-node list;
- conflict parent references;
- delivery receipts and rejection reasons.

Local storage is canonical. Publishing means adding a signed object to the local outbox. Delivery transports may include WebRTC peers, a local companion, removable export, or a configured gateway.

## Mesh limitations and policy

WebRTC data channels support direct encrypted peer exchange, but browsers do not provide universal automatic discovery or a persistent background daemon. Pure-PWA mesh sessions therefore require the app to be open and peers to be paired or introduced. Background Sync and Periodic Background Sync are optional accelerators, not correctness dependencies.

No object leaves a device merely because connectivity exists. Transfer requires an object-level sharing intention and a destination policy match.

## Delivery phases

1. Install-only route boundary and complete-package readiness reporting.
2. Local community-object database, outbox, inbox, receipts, and deduplication.
3. Manual WebRTC pairing and foreground mesh transfer.
4. Local companion discovery and persistent relay.
5. Optional gateway rendezvous, federation, and scheduled community exchange.
6. Governed signed package updates through the Anarchadia execution kernel.

## Acceptance

- The public browser experience cannot enter the campus before installation.
- The installed PWA remains fully usable with the release origin unavailable.
- All ordinary application/model requests are satisfied from the installed package.
- Local records never depend on a successful network write.
- Peer or gateway delivery can be retried without duplicate application.
- A peer cannot receive an object outside its declared audience and consent policy.
- Cabinet Mode and Cabinet Only use the same install boundary and local exchange runtime.
- Always-on mesh behavior is delegated to the optional local companion rather than falsely promised by browser APIs.
