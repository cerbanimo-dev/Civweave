# Native World 3D Client v1 — Thread 3

Provider-neutral canvas renderer for the **Civweave-owned** universe.

- Entry point: `public/app/shared/worldweaver-native-3d-client-v1.mjs`.
- Schema: `civweave.native-scene.v1` with `roomId`, `revision`, and bounded box objects (`id`, `position`, `size`, optional `label`/`color`).
- `createNativeWorld3DClient({canvas,onSelect})` returns `update(snapshot)`, `render()`, `roomId`, `close()`.
- `onSelect({roomId,objectId,revision})` is a **request/proposal** to the World Runtime; no authoritative mutation happens in this module.
- Rejects malformed geometry, duplicate IDs, oversized scenes, and stale revisions within the same room.
- No external fetching, executable world media, DreamGrid dependency, or WebSocket credential handling.

Integration contract: Thread 2 supplies validated, authorized, committed scene snapshots.
Thread 6 mounts a canvas and calls `client.update(snapshot)`; Thread 7 owns secure network delivery.
This v1 is a basic perspective renderer with orbit, zoom, pointer picking, and responsive canvas size—not yet a GPU renderer, walking avatar engine, spatial audio system, or multiplayer connection.

Test: `node --test scripts/test-worldweaver-native-3d-client-v1.mjs`.
