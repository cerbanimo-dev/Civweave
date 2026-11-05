# World Runtime · Thread 2 · session v1

**Authority rule:** Civweave owns the universe. 3D, 2D, VR, OpenSimulator and any later renderer consume the same authorized state; no renderer writes canonical state directly.

## Implemented in this branch

- `public/app/shared/worldweaver-world-session-v1.mjs`: Guild-scoped, revisioned presence and portal navigation using the existing Commons Between room catalog.
- `join` always arrives at Starling Commons (the Threshold), `move` requires a direct defined portal (both directions), and `leave` removes presence.
- The host supplies authenticated actors and a mandatory `authorize` decision per command; command parameters cannot assign a different principal/Guild.
- Commands serialize through one queue to avoid duplicate revisions. The host's `append` must durably persist each event before the session publishes it.
- `snapshot()` returns a transport-neutral room/presence projection; `delta(lastRevision)` enables reconnect, falling back to a full snapshot when the bounded replay tail has expired.
- `initialEvents` reconstruct state from a trusted, contiguous Guild-specific event log. A persisted log cannot skip revisions or move through nonexistent portals.
- Deterministic contract tests: `node --test scripts/test-worldweaver-world-session-v1.mjs`.

## Required production host integrations (not implemented here)

The host must validate real session/Guild membership, determine authenticated principal IDs from trusted session credentials, use atomic durable append and an authorized snapshot store, implement WebSocket fanout scoped to Guild members, and reject unauthorized history reads. The host must enforce storage concurrency across workers (for example a single Durable Object per Guild): the in-process queue protects only one JS session instance, **not** multiple server replicas. An event record's timestamp is metadata supplied by the host, not proof of identity. Clients must not call this module with self-certified identities.

This module **does not** provision rooms, implement real cross-device sync, authenticate users, connect WebSockets, or deploy to staging. It is the portable session contract and an independently testable foundation.

## Interface for other lanes

- World Runtime owns room IDs, adjacent portal rules, Guild-scoped presence and revision/cursor semantics.
- 3D Client and Experience/UI use `snapshot`/`delta` and request `join`/`move`/`leave` through the host; they never send bare trusted actors.
- Live Interaction and AI Fleet should bind speaker/pilot presence to **verified** principals and keep world presence separate from speech permissions.
- Infrastructure & QA owns durable single-writer event storage, authenticated WebSocket endpoints, authorization policy, network replay and chaos tests.
- The existing `worldweaver-core-v1.mjs` remains authoritative for world manifests, stations, NPCs and screen actions.
