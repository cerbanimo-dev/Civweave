# Civweave Locality Gossip Ledger v1

## Purpose

Civweave should feel geographically local without turning location into a central tracking product. Physical proximity decides **when** devices exchange nearby public knowledge. Hub membership supplies a second path that lets a member virtually pass through nonlocal Hub neighborhoods while online. The same signed ledger then carries that knowledge back into physical encounters with unaffiliated devices.

The result is a reverse-herd-immunity pattern: well-connected Hub members become freshness carriers for people who are not continuously attached to a Hub.

## Roles

- **Hub Node**: a real physical community anchor with a Steward-published site location.
- **Hub member, free or paid**: receives the virtual-pass service in addition to physical foreground gossip.
- **Unaffiliated user**: participates in physical foreground gossip and keeps whatever relevant public/federated records their device has already received. They do not need Hub membership to receive or relay those records.
- **Passerby**: a recently encountered foreground mesh peer. A passerby can contribute signed public/federated locality records without becoming a permanent social graph edge.

## Canonical data placement

| Data | Canonical home | Replication | Location policy |
| --- | --- | --- | --- |
| Steward's live GPS reading during Hub placement | Steward browser memory | None | Used only to create the Hub's public site claim |
| Hub public site | Cloudflare Hub manifest (`civweave.hub-location.v1`) | Core/fabric directory, Hub Map cache, public node gossip | Steward-published physical node data. Current public precision floor is approximately 100 m / three coordinate decimals and is carried with precision metadata. |
| Roaming user's current GPS | Browser memory while Hub Map location is active | None | Never written by locality gossip, never placed in the community ledger |
| Need / Offering / Idea | Signed `civweave.locality-ledger-entry.v1` community object in IndexedDB | Public/federated gateway sync plus foreground phone mesh | Entries may identify relevant Hub IDs, but do not inherit the roaming user's current coordinates |
| Recent peer encounter | Local relevance metadata | None | Peer ID, time, and encounter count only. No roaming coordinates |
| Frequent Hub relationship | Local relevance metadata | None | Hub ID, public origin, visit counts, last seen time |
| Hub selection | Existing `civweave.host-node.selection.v1` device record | Device local | Uses canonical Host Node session infrastructure |
| Hub login/capacity session | Existing Host Node session runtime | Device/tab according to existing session contract | Free and paid members are both eligible for virtual locality refresh |
| Offline map tiles | Existing PMTiles/IndexedDB map package | Existing map peer healing | Separate from social/locality ledger data |

## The locality record

The v1 locality record is a signed community object:

- kind/schema: `civweave.locality-ledger-entry.v1`
- type: `need`, `offering`, or `idea`
- consent: `public` or `federated`
- default hop limit: 8
- default TTL: 30 days
- optional Hub scope: one or more Hub node IDs
- optional source realm and source record ID
- signed revision identity inherited from `CivweaveLocalMeshV146`

The existing community-object mesh remains the only replication/storage protocol. There is no second locality database.

## Physical pass-by

1. The user invokes **Locate me** on the Hub Map.
2. While that map remains foregrounded, Civweave watches location with the browser geolocation API.
3. The current reading is compared in memory against Steward-published Hub pins.
4. Entering a Hub gossip radius triggers a locality pass for that Hub. The default radius is 750 m and expands when the Hub's published precision requires it.
5. Signed public/federated community objects are exchanged using the existing foreground phone mesh and gateway sync pathways.
6. The latest accepted records remain in IndexedDB and are available offline after the devices separate.
7. The roaming coordinates are discarded. Only the fact that a Hub/peer was encountered, and when, can affect local relevance ranking.

The locality layer stops its geolocation watcher when the Hub Map is hidden or unloaded.

## Virtual pass-by for Hub members

Hub members get a second locality path:

1. `host-node-session-v1` identifies active Hub membership. Free and paid sessions are treated equally for this feature.
2. The Hub Map can explicitly **Pass by** any mapped Hub and can refresh frequently visited partner Hubs for active members.
3. The generic `node-ai-mesh-v1` runtime already runs across canonical installed Civweave surfaces and synchronizes the underlying public/federated community-object outbox/gateway on its normal loop. Because replication is kind-agnostic, locality records ride the same route without a special transport.
4. A member device therefore accumulates fresh public locality records while online and later carries those signed records into physical foreground encounters.

Virtual pass-by changes **routing relevance**, not audience rules. Private/direct/group objects never become eligible merely because a device is a Hub member.

## Hub Map behavior

The default `/finder` surface is Hub-node-first.

A Hub pin provides:

- Steward-published physical placement and freshness metadata
- **Join Hub**, using the existing capacity-backed Host Node session API
- **Explore ledger**, showing the most recent relevant offline Need / Offering / Idea records
- **Pass by**, requesting an online locality refresh without physical proximity
- **Open Hub**, when the node advertises a public origin

The broad federation-contact map remains available underneath as the cartographic/data engine, but it is no longer the primary view.

## Relevance rules

For a selected Hub, cached locality records are ranked/included through three primary channels:

1. **Hub**: explicitly scoped to the selected Hub.
2. **Partner**: scoped to a Hub this device frequently visits or exchanges with.
3. **Passerby**: authored by a recently encountered foreground peer.

The relevance index is local to the device. Civweave does not need to publish a user's movement history or a global social graph to decide what their offline neighborhood copy should contain.

## Reverse-herd-immunity behavior

Unaffiliated users benefit from Hub infrastructure indirectly:

- Hub members stay better synchronized through their online Hub relationship.
- Their devices carry signed public/federated locality records into ordinary physical encounters.
- Unaffiliated devices receive, validate, cache, and later relay those records under the same hop/expiry rules.
- Another member can subsequently carry newly encountered records back toward the online mesh.

Connectivity therefore spreads *freshness* outward from well-connected members instead of requiring every participant to maintain a continuous server relationship.

## Privacy and abuse boundaries

- Hub physical placement is public only because a Steward explicitly publishes a node site.
- Roaming user GPS is never a community object and is not stored by the locality-gossip runtime.
- Encounter relevance stores no coordinates.
- Only `public` and `federated` signed objects are ferryable through generic gateways.
- Existing signature validation, object revision hashes, hop limits, expirations, and audience checks remain authoritative.
- A Hub relationship does not grant access to private/direct/group objects.
- Stale locality records naturally fall out through TTL and recency filtering rather than becoming an immortal behavioral archive.

## Implementation anchors

- Hub directory: `functions/api/hub-map-nodes.ts`
- Hub Map entry: `public/app/hub-map-v1.html`
- Hub Map behavior: `public/app/civweave-hub-map-v1.js`
- Locality policy/API: `public/app/civweave-locality-gossip-v1.js`
- Signed store-and-forward ledger: `public/app/local-object-mesh-v146.js`
- Generic always-available installed-app sync loop: `public/app/node-ai-mesh-v1.js`
- Hub membership/session: `public/app/host-node-session-v1.js`
- Steward site setup: `public/host-setup.html`
- Cloudflare Hub location manifest: `cloudflare/node-cloud/src/index.mjs`
