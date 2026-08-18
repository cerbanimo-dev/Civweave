# Civweave Locality Gossip Ledger v1

## Purpose

Civweave should feel geographically local without turning location into a central tracking product. Physical proximity decides **when** devices exchange nearby public knowledge. Hub membership supplies a second path: a connected member periodically downloads a geographic **Region** made from their home Hub plus the six nearest mapped Hubs. The same signed ledger then carries that knowledge back into physical encounters with unaffiliated devices.

Members can still travel anywhere on the Hub Map and manually pass by any Hub. Region membership controls the automatic periodic download, not where a person is allowed to browse or exchange gossip.

The result is a reverse-herd-immunity pattern: well-connected Hub members become freshness carriers for people who are not continuously attached to a Hub.

## Roles

- **Hub Node**: a real physical community anchor with a Steward-published site location.
- **Hub member, free or paid**: receives automatic Region gossip in addition to physical foreground gossip and manual map pass-by.
- **Region**: the member's selected home Hub plus the six geographically nearest Hubs in the current Steward-published Hub directory. If fewer than six neighbors exist, the Region contains every available neighbor.
- **Unaffiliated user**: participates in physical foreground gossip and keeps whatever relevant public/federated records their device has already received. They do not need Hub membership to receive or relay those records.
- **Passerby**: a recently encountered foreground mesh peer. A passerby can contribute signed public/federated locality records without becoming a permanent social graph edge.

## Canonical data placement

| Data | Canonical home | Replication | Location policy |
| --- | --- | --- | --- |
| Steward's live GPS reading during Hub placement | Steward browser memory | None by default | Used only to create the Hub's public site claim. It leaves the browser at full coordinate precision only when the Steward explicitly enables the precise public pin. |
| Hub public site | Cloudflare Hub manifest (`civweave.hub-location.v1`) | Core/fabric directory, Hub Map cache, public node gossip | Rounded is the default: three coordinate decimals and an approximately 100 m or wider accuracy band. A Steward may explicitly publish a six-decimal public pin; its measured device accuracy is carried with it. |
| Roaming user's current GPS | Browser memory while Hub Map location is active | None | Never written by locality gossip, never placed in the community ledger, and never used to calculate automatic Region membership. |
| Need / Offering / Idea | Signed `civweave.locality-ledger-entry.v1` community object in IndexedDB | Public/federated gateway sync plus foreground phone mesh | Entries may identify relevant Hub IDs, but do not inherit the roaming user's current coordinates. |
| Recent peer encounter | Local relevance metadata | None | Peer ID, time, and encounter count only. No roaming coordinates. |
| Frequent Hub relationship | Local relevance metadata | None | Hub ID, public origin, visit counts, last seen time. This can assist local relevance but does not define the automatic download set. |
| Region membership | Device-local `civweave.locality-region.v1` record | None | Derived from the selected home Hub's public map pin and the six nearest Steward-published Hub pins. |
| Hub selection | Existing `civweave.host-node.selection.v1` device record | Device local | Uses canonical Host Node session infrastructure and supplies the Region anchor. |
| Hub login/capacity session | Existing Host Node session runtime | Device/tab according to existing session contract | Free and paid members are both eligible for automatic Region refresh. |
| Offline map tiles | Existing PMTiles/IndexedDB map package | Existing map peer healing | Separate from social/locality ledger data. |

## Steward physical placement

The Steward setup deliberately separates **capture precision** from **publication precision**:

1. The Steward stands at the Hub site and requests a fresh high-accuracy browser reading.
2. The default publication mode is **rounded**. The client sends three decimal coordinates and the Cloudflare node manifest enforces a public accuracy band of at least 100 m.
3. For a public venue or another site people should be able to walk directly to, the Steward can explicitly enable **Publish a precise public Hub pin**.
4. Precise mode sends six decimal coordinates. Cloudflare preserves the device's measured accuracy rather than inflating it to 100 m, and rejects precise publication when the reading is broader than 250 m.
5. Both modes use the existing Steward location-claim key and canonical `civweave.hub-location.v1` manifest. The same manifest is synchronized into Core and then consumed by the Hub Map directory.

There is no hidden upgrade from rounded to precise. Precision changes only through an explicit Steward choice on the location setup surface.

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

## Conflict and convergence policy

The community-object mesh carries heterogeneous signed payloads, so Civweave does **not** apply a generic field-by-field CRDT merge to arbitrary records. The signed revision envelope is the convergence boundary:

1. An incoming object with the same object ID and the same `revisionHash` is a duplicate.
2. A lower numeric revision never replaces a higher local revision.
3. A higher valid signed revision replaces a lower local revision.
4. If two valid objects have the same object ID and numeric revision but different `revisionHash` values, they are a **fork**, not permission for last-arrival-wins overwrite.
5. Both fork variants are preserved in the local `conflicts` store as `civweave.community-conflict.v1` evidence.
6. The lexicographically smaller signed `revisionHash` is selected as the temporary canonical revision. Because every peer applies the same tie-break, peers converge independent of arrival order while retaining the alternate branch for inspection.
7. The tie-break is transport convergence, not semantic approval. A capability that understands the record may resolve the fork by publishing a new, valid, higher signed revision. The generic mesh never invents a field-level merge.

This prevents silent data loss and nondeterministic arrival-order state without pretending every Civweave object has CRDT-compatible semantics.

## Region chunks for connected Hub members

A Region is the automatic gossip unit for a Hub-connected member.

1. Civweave reads the selected home Hub from `civweave.host-node.selection.v1`.
2. Automatic Region download requires an active Host Node session for that selected home Hub. Free and paid member sessions are treated equally.
3. Civweave loads the current Hub directory, finds the home Hub's Steward-published public map pin, calculates geographic distance from that pin to every other mapped Hub, and selects the six nearest Hubs.
4. The resulting `civweave.locality-region.v1` record contains the home Hub plus those six neighbors. Region calculation never requires the roaming phone's current GPS position.
5. The locality runtime sweeps those Region Hub gateways as one logical chunk, then flushes the shared signed object mesh after the sweep.
6. Automatic refresh runs about every 15 minutes while an installed Civweave surface is active and online. Connectivity return and Hub-session activation can trigger an earlier refresh.
7. A local cross-surface lease prevents multiple open Civweave surfaces from performing the same Region sweep concurrently.
8. The latest accepted public/federated records remain in IndexedDB and are available offline.

The canonical install boundary already loads `host-node-session-v1.js` before `node-ai-mesh-v1.js`. The approved node mesh runtime then lazily loads `civweave-locality-gossip-v1.js`, so Region refresh is available across installed Civweave surfaces without expanding the canonical startup-script contract.

If the Hub directory changes, the next Region calculation can change the six neighbors naturally. The home Hub remains the stable anchor until the user selects a different home Hub.

## Physical pass-by

1. The user invokes **Locate me** on the Hub Map.
2. While that map remains foregrounded, Civweave watches location with the browser geolocation API.
3. The current reading is compared in memory against Steward-published Hub pins.
4. Entering a Hub gossip radius triggers a locality pass for that Hub. The default radius is 750 m and expands when the Hub's published precision requires it.
5. Signed public/federated community objects are exchanged using the existing foreground phone mesh and gateway sync pathways.
6. The latest accepted records remain in IndexedDB and are available offline after the devices separate.
7. The roaming coordinates are discarded. Only the fact that a Hub/peer was encountered, and when, can affect local relevance ranking.

The locality layer stops its geolocation watcher when the Hub Map is hidden or unloaded.

## Manual virtual pass-by

The Region is not a travel fence.

1. The Hub Map can explicitly **Pass by** any mapped Hub, whether or not that Hub belongs to the member's current Region.
2. Manual pass-by synchronizes that Hub's public/federated gossip through the same signed community-object mesh.
3. Visiting an out-of-Region Hub does not silently enlarge the automatic Region. The next periodic automatic sweep still uses home Hub plus the six nearest mapped Hubs.
4. The generic `node-ai-mesh-v1` runtime continues to synchronize underlying public/federated community objects on its normal loop. Locality records remain kind-agnostic passengers on the shared mesh.

Virtual pass-by changes **routing relevance**, not audience rules. Private/direct/group objects never become eligible merely because a device is a Hub member.

## Hub Map behavior

The default `/finder` surface is Hub-node-first.

A Hub pin provides:

- Steward-published physical placement and freshness/precision metadata
- **Join Hub**, using the existing capacity-backed Host Node session API
- **Explore ledger**, showing the most recent relevant offline Need / Offering / Idea records
- **Pass by**, requesting an online locality refresh for any selected Hub without physical proximity
- **Open Hub**, when the node advertises a public origin

The Hub Map also explains that connected members automatically carry a Region consisting of their home Hub plus the six nearest mapped Hubs.

The broad federation-contact map remains available underneath as the cartographic/data engine, but it is no longer the primary view.

## Relevance rules

For a selected Hub, cached locality records can be ranked/included through three primary channels:

1. **Hub**: explicitly scoped to the selected Hub.
2. **Partner**: scoped to a Hub this device has a known local relationship with, including Region and manual visit history.
3. **Passerby**: authored by a recently encountered foreground peer.

The relevance index is local to the device. Civweave does not need to publish a user's movement history or a global social graph to decide what their offline neighborhood copy should contain.

Automatic download membership is stricter than relevance: only the current Region is periodically swept without an explicit pass-by.

## Reverse-herd-immunity behavior

Unaffiliated users benefit from Hub infrastructure indirectly:

- Hub members keep their seven-Hub Region fresher through periodic online synchronization.
- Their devices carry signed public/federated locality records into ordinary physical encounters.
- Unaffiliated devices receive, validate, cache, and later relay those records under the same hop/expiry rules.
- Another member can subsequently carry newly encountered records back toward the online mesh.

Connectivity therefore spreads *freshness* outward from well-connected members instead of requiring every participant to maintain a continuous server relationship.

## Privacy and abuse boundaries

- Hub physical placement is public only because a Steward explicitly publishes a node site.
- Rounded placement remains the default; precise public placement requires an explicit Steward opt-in and is intended for sites that are safe to make directly findable.
- Roaming user GPS is never a community object and is not stored by the locality-gossip runtime.
- Automatic Region membership uses the home Hub's public pin, not the roaming user's live position.
- Encounter relevance stores no coordinates.
- Only `public` and `federated` signed objects are ferryable through generic gateways.
- Existing signature validation, object revision hashes, deterministic fork handling, hop limits, expirations, and audience checks remain authoritative.
- A Hub relationship does not grant access to private/direct/group objects.
- Stale locality records naturally fall out through TTL and recency filtering rather than becoming an immortal behavioral archive.

## Implementation anchors

- Hub directory: `functions/api/hub-map-nodes.ts`
- Hub Map entry: `public/app/hub-map-v1.html`
- Hub Map behavior: `public/app/civweave-hub-map-v1.js`
- Locality policy, Region scheduler, and API: `public/app/civweave-locality-gossip-v1.js`
- Installed-surface Region loader: `public/app/node-ai-mesh-v1.js`
- Canonical Host-session-before-node-mesh ordering: `public/app/install-boundary-v146.js`
- Signed store-and-forward ledger: `public/app/local-object-mesh-v146.js`
- Hub membership/session: `public/app/host-node-session-v1.js`
- Steward site setup: `public/host-setup.html`
- Cloudflare Hub location manifest: `cloudflare/node-cloud/src/index.mjs`
- Location regression: `scripts/test-hub-location-onboarding-v1.mjs`
- Region/locality regression: `scripts/verify-hub-map-locality-ledger-v1.mjs`
- Fork convergence regression: `scripts/test-local-object-mesh-conflicts-v1.mjs`
- Fork convergence CI: `.github/workflows/verify-local-object-mesh-conflicts.yml`
