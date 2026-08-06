# QR pairing and shared-node discovery

Commonweave's first multi-user networking slice combines the existing signed local object mesh with a visible Network Commons panel.

## User flow

1. Open **People** from the Commonweave campus header.
2. One person creates a 20-minute QR invitation.
3. The other person scans or pastes it and accepts.
4. The inviter completes the pending handshake.
5. Both devices retain each other's public identity and the rendezvous node locally.
6. After discovery is enabled, the devices announce short-lived signed presence records and find one another on nodes they share.

The invitation contains a random one-time rendezvous secret. It never contains a host-node bearer token, API key, private signing key, passport, ledger, task list, or trade history.

## Privacy defaults

- Discovery is off until the user enables it.
- The default visibility is **paired people only**.
- Paired-only presence records omit the display name and capability tags.
- Paired presence envelopes are addressed separately to each trusted peer.
- Public discovery is a separate explicit setting.
- Presence records expire after twelve minutes and are refreshed while Commonweave is open.
- Remote nodes must use HTTPS. Plain HTTP is accepted only for localhost development.
- Shared node cards contain only the node origin and label. Node access tokens are never shared.

A host operator can still observe relay metadata held by that host. End-to-end encrypted task, trade, and validation payloads are a later transport layer, not something this first slice pretends to provide.

## Runtime modules

- `public/extensions/commonweave-qr-v156.js`: local QR renderer.
- `public/extensions/commonweave-mesh-tools-v156.js`: signed object mesh, QR rendezvous, WebRTC pairing, and relay envelopes.
- `public/app/shared/commonweave-peer-discovery-core-v219.mjs`: pure normalization and merge rules.
- `public/extensions/commonweave-peer-discovery-v219.js`: signed presence, node catalog, scanning, and node-card exchange.
- `public/app/network-commons-v219.js`: user interface and pairing workflow.
- `public/app/network-commons-v219.css`: responsive Network Commons surface.

The campus loader starts networking independently from the rest of the campus. A networking failure is logged without preventing the local campus from opening.

## Browser behavior

A browser PWA cannot promise continuous background discovery. Commonweave announces and scans:

- when discovery is enabled;
- while the app remains open;
- when the window regains focus;
- when connectivity returns; and
- when a pairing completes.

A future Android/iOS proximity bridge can feed nearby radio discoveries into the same peer and node-card protocol without replacing this layer.

## Test

```sh
node --test scripts/test-peer-discovery-v219.mjs
node --check public/extensions/commonweave-peer-discovery-v219.js
node --check public/app/network-commons-v219.js
node --check public/app/working-campus-v156.js
```
