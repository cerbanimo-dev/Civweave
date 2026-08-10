# Civweave Open Learning Media Service v1

## Purpose

Open Learning Media gives Civweave a local-first, rights-aware media layer for Living School and Cerbanimo. It discovers openly licensed instructional media, filters it for topical and pedagogical relevance, caches approved files on user devices, computes SHA-256 while streaming, and permits paired Civweave nodes to exchange only media whose license is explicitly approved for redistribution.

The service complements the existing YouTube Video Learning Atlas. Selection order is:

1. rights-cleared media already cached on the device;
2. rights-cleared media advertised by a connected Civweave peer when the device is offline;
3. a rights-cleared direct origin file when online, with bounded opportunistic caching;
4. the existing current/embeddable YouTube atlas;
5. the required deterministic fallback URL.

## Rights boundary

Default mesh redistribution is allowed only for:

- Public Domain
- CC0
- CC BY
- CC BY-SA

The default mesh cache rejects NC, ND, unknown, custom, and all-rights-reserved material. A record must also carry `cache_policy: MESH_REDISTRIBUTABLE`, a supported direct media file, and attribution/license evidence from the harvester.

The runtime fails closed for new origin downloads when the harvested catalog is older than 30 days. Already cached, previously verified copies remain playable. Weekly harvesting refreshes the catalog after merge.

## Storage profiles

| Profile | Nominal budget | Automatic caching |
|---|---:|---|
| Minimal | 96 MiB | Off |
| Learning Path | 448 MiB | On, compact items only |
| Outage Ready | 1 GiB | On |
| Archive | 3 GiB | On, larger items allowed |

The nominal Learning Path budget is 448 MiB so the launch Focus Pack can contain one smallest-known approved item from each of the five required launch topics. This is a ceiling, not a reservation: constrained devices still use the smaller browser-quota-derived limit and may report skipped pack items.

The effective budget is additionally bounded by browser storage quota. The media cache will use no more than roughly 45% of the reported quota and evicts least-recently-used unpinned media before exceeding its budget.

Optional media storage is independent of the required campus, model downloads, and knowledge-school bundles.

## Download integrity

Origin downloads use `ReadableStream.tee()`:

- one branch flows directly into Cache Storage;
- one branch is processed by the incremental SHA-256 implementation.

This avoids loading a complete large video into JavaScript memory. Each cached record stores its SHA-256, byte count, MIME type, attribution, license, source record key, topic, and access timestamps.

## Mesh protocol

Open Learning Media reuses the existing `CivweaveLocalMeshV146` WebRTC sessions. It does not create a parallel pairing or trust system.

A connected media-capable node sends a `cw-media-manifest` containing only redistributable cached objects. Peers may request an advertised SHA-256 and record key. Transfer messages are:

- `cw-media-manifest`
- `cw-media-request`
- `cw-media-start`
- `cw-media-chunk`
- binary chunk payload
- `cw-media-end`
- `cw-media-reject`

Chunks are 32 KiB and respect RTCDataChannel backpressure. Incoming media is streamed into Cache Storage through a `TransformStream` while SHA-256 is recomputed. A hash mismatch deletes the received bytes and rejects the transfer.

A node never serves a cached record to the mesh unless the stored license remains on the conservative allowlist and its cache policy remains `MESH_REDISTRIBUTABLE`.

## Focus seed

The launch seed explicitly covers:

- vibe coding;
- prompt engineering;
- pseudocoding and algorithm design;
- critical thinking and media literacy;
- logical frameworks and systems thinking.

The harvester uses three deterministic post-discovery gates: topical relevance, pedagogical intent, and high-confidence automatic selection. Provider search rank is discovery evidence only.

## Living School and Cerbanimo

The shared video contract now resolves an Open Learning Media item before falling back to the YouTube atlas. Rights-cleared direct or cached files render with an HTML5 `video` element and source/license attribution. YouTube media continues to render with the privacy-enhanced `youtube-nocookie.com` embed.

Generating or opening a module/task can opportunistically cache a compact relevant open-media item when the selected storage profile permits it. The existing requirement of at least one video companion per module/task remains intact.

## Installer behavior

The Civweave installer exposes an Outage Media Cache panel with:

- Minimal, Learning Path, Outage Ready, and Archive storage profiles;
- Focus Pack: one item per launch focus topic;
- Outage Pack: up to two items per focus topic within the current budget;
- cache status and catalog freshness;
- connected peer inventory count;
- a cache-only clear action that does not remove the campus or knowledge schools.

The open-media lookup, rights policy, and summary are explicit offline-campus assets so the service can still explain its policy and resolve cached references after connectivity disappears.

## Refresh and operations

`.github/workflows/harvest-open-learning-media-v1.yml` runs weekly and can also be triggered manually. A refresh:

1. re-harvests providers;
2. reruns relevance, pedagogy, and selection gates;
3. validates the seed contract;
4. commits catalog-only changes when output changed.

A refresh that fails a required topic or license invariant must fail instead of publishing a partial catalog.

## Health signals

`CivweaveOpenLearningMediaCacheV1.status()` reports:

- cache revision;
- record and byte counts;
- selected and effective storage budget;
- browser quota/usage when available;
- catalog build time and freshness;
- connected media peer count;
- advertised peer item count.

The runtime emits `civweave:open-learning-media` events for downloads, evictions, mesh manifests, mesh transfers, cache-policy changes, startup failures, and origin-cache skips.

## Launch verification

Before merge/release, the Open Learning Media workflow must verify:

- Python harvester/filter syntax;
- harvested seed contracts;
- JavaScript runtime syntax;
- a known-answer SHA-256 vector;
- conservative license allow/deny behavior;
- storage-tier ordering;
- playable-file selection;
- mesh protocol markers and hash-rejection behavior;
- offline-package metadata assets;
- installer wiring;
- Living School, Cerbanimo, and Working Campus runtime wiring;
- existing required-video behavior and exact YouTube fallback.

## Failure behavior

- **Catalog unavailable:** use cached open media if available, otherwise continue to YouTube resolution.
- **Catalog stale:** play existing cache, but refuse new origin downloads until refresh.
- **Origin CORS/network failure:** leave the item uncached and continue normally.
- **Insufficient storage:** evict least-recently-used unpinned optional media; if still insufficient, refuse the download.
- **Peer hash mismatch:** delete the incoming cache entry and reject the transfer.
- **Peer disconnect:** the transfer fails without corrupting existing cached entries.
- **No relevant open media:** retain the existing YouTube atlas and deterministic fallback contract.

## Rollback

The service is additive. A release can disable the open-media runtime by removing the `open-learning-media-cache-v1.mjs` surface loads and reverting the shared video contract to its prior YouTube-only resolver. Cached optional media can be cleared independently; no canonical ledger, task, curriculum, or knowledge-school data is stored in the media cache.
