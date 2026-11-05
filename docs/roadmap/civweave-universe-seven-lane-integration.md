# Civweave-owned Universe — Seven-Lane Integration HQ

Status: integration proposal, staging development. Owner: Thread 1 / Mica (integration coordination). Date: 2026-11-05.

## Non-negotiable principle

**Civweave owns the universe. Other engines are renderers or optional bridges.** No mandatory OpenSimulator or DreamGrid dependency.

The universe is an optional immersive interface and persistent shared-world capability. It must not become the owner of core Civweave chat, account, settings, navigation, Quest, Guild or accessibility systems. Follow `AGENTS.md`, `config/agent-work-context.json`, `docs/contracts/mobile-interface-contract.md`, `docs/architecture/systems-of-practice.md`, and `config/system-ownership.json`. Existing canonical capability owners prevail.

## Work lanes and ownership

1. **Integration HQ (this lane)**: contracts, conflict resolution, review, staging integration, release decisions; no parallel product owner.
2. **World Runtime**: universe/world/room/portal/object identifiers, authoritative shared state, membership scopes, reconnect, snapshot+delta sync.
3. **3D Client**: browser renderer, avatar locomotion, transform interpolation, scene objects and spatial sound; consumes world state, does not authoritatively store it.
4. **Live Interaction**: speech detection/opt-in microphone, turn arbitration, interruption/speaking permission, silence and anti-chatter policies; never owns shared guide chat.
5. **AI & Character Fleet**: adapter use for OpenAI, Gemini and local Qwen; persona selection; NPC intents through the same authorized command interface as humans. Respect local-first preference and explicit hosted consent.
6. **Experience/UI**: accessible 'Enter The Commons Between' entry, map, route/portal UI, mobile shelf, desktop panels, VR hand/phone interaction; accessible non-3D alternatives.
7. **Infrastructure & QA**: WebSocket/HTTP transports, auth enforcement, state storage, deployment, disconnect/reconnect, multiplayer and performance regression tests.

Workstreams are coordination labels across chats; no cross-chat execution or shared live session is assumed. GitHub is the durable coordination source.

## Minimal integration API proposal (not yet implemented)

All clients (3D, 2D and optional future bridges) observe the same room stream.

- `GET /api/universe/v1/rooms/{roomId}/snapshot`: authorized snapshot with world, room, server revision, entities, permissions and current occupants; no private model prompts or private chat content.
- `WS /api/universe/v1/rooms/{roomId}/stream`: authenticated stream; `hello` includes last applied revision, `snapshot` or ordered `delta` follows; `ack`, `resync_required`, presence and heartbeat are protocol messages.
- `POST /api/universe/v1/commands` or equivalent authenticated WebSocket command: `requestId`, room/entity scope, action, arguments, expected revision; server evaluates authorization and emits only accepted state changes.
- Room/member/Guild authority is checked server-side for every mutation. Client-side rendering and AI output are untrusted.
- Idempotency by `requestId`; monotonically increasing room revision; bounded payloads, replay window, backpressure and explicit resnapshot on gaps.
- Presence is ephemeral; durable objects/rooms persist separately. Exiting or losing connectivity must not erase a Guild room.
- Where local/offline actions are allowed, maintain device-local drafts and reconcile by existing signed-object mesh policy; never silently overwrite divergent authoritative state.

Illustrative event:
```json
{"v":1,"type":"room.delta","roomId":"commons","revision":42,"events":[{"kind":"entity.moved","entityId":"avatar-1","position":[1,0,3]}]}
```

This is a proposal to negotiate with the existing Guild edge, mesh and worldweaver owners, **not** an assertion that those endpoints exist.

## Dependency order / first vertical slice

1. **Contract freeze:** map canonical owner and existing Worldweaver/Guild/mesh components; agree on IDs, auth, event schema, privacy, reconnection.
2. **Smallest playable slice:** authorized user opens 'Enter The Commons Between' in a lightweight 3D client, receives a room snapshot, moves an avatar, sees a second connected user, disconnects/reconnects without state loss.
3. **Real interaction:** optional microphone, intentional turn requests, interruption, single active speaker, quiet-by-default agents.
4. **Fleet/NPC:** NPC consumes explicitly permitted room events and proposes actions through the same authenticated command path.
5. **Guild integration:** rooms/portals/Quest links and permissions, offline read-only room snapshot where possible.
6. **Hardening:** recovery, accessibility, load, latency, low-memory mobile and hosted-outage tests.

## Required acceptance tests

- Two authenticated clients see the same ordered room state and stable object IDs.
- Unauthorized users cannot mutate rooms, entities, Guild ownership or other members' avatars.
- Replayed command requests do not duplicate mutations; stale revisions receive conflict/resync.
- Reconnect from prior revision yields missing deltas or a full snapshot.
- Network disconnect preserves durable room state; noisy presence expires.
- AI agents cannot bypass explicit permission, consent or speaker arbitration.
- Voice interaction is opt-in and reliably silent when muted, idle or without a turn.
- Standard chat, Settings, navigation and Quest workflows remain available outside 3D.
- Offline core Civweave remains usable when hosted universe services are down.
- Test contract runs on staging and is green before a PR is merged; production release remains separately gated.

## Merge and handoff rules

Every lane opens a focused PR targeting `staging`, documents the exact canonical owner touched, names changed APIs/event schemas, lists executed tests and links any upstream dependency. Integration HQ reviews ownership collisions and schema/version compatibility. No lane may merge directly to `main`; production requires a separately reviewed staging-to-main promotion. No new parallel chat, Settings, Guild or mesh system is permitted.

## Coordination status

- [x] Seven lanes and architectural ownership principle defined.
- [x] Existing branch and repository architecture inspected.
- [ ] Canonical universe runtime owner identified in source (pending targeted source trace).
- [ ] API proposal reviewed with World Runtime and Infrastructure lanes.
- [ ] First vertical slice implemented and tested in staging.
- [ ] Production approved and deployed.
