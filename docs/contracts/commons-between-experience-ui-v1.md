# Commons Between — Experience / UI integration contract

Status: Thread 6 integration contract; **not** an implemented entry route.
Integration branch: `staging`.
Owner: Experience / UI presentation lane. Architectural authority remains with `docs/contracts/mobile-interface-contract.md`, `docs/architecture/systems-of-practice.md`, `config/system-ownership.json`, and the owning implementations.

## Product rule

**Civweave owns the universe.** World state, authorization, persistence, membership, and spatial identity remain with canonical functional owners. The 3D client, 2D Guild Map, mobile shelf, desktop side controls, and VR phone/hand gestures are replaceable presentations over the same authorized snapshot.

No DreamGrid/OpenSimulator runtime is required for entering the Commons. Existing optional adapters may continue to translate data, but must not become the state owner or a prerequisite for entering.

## Entry flow and initial vertical slice

1. Expose a clearly labeled, keyboard- and touch-accessible **Enter The Commons Between** control through the existing canonical installed-family navigation owner. Do not create a competing navbar.
2. Resolve the signed-in Hero / guest capability and last authorized Guild or public Commons destination through the existing identity and world owners.
3. Enter the public Commons when no previous authorized destination exists. Never infer Guild membership from a cached display label.
4. Fetch or open the last authorized world snapshot. Render a 2D map immediately if 3D is unsupported, slow, opted out, or unavailable. No user action should be blocked on 3D assets.
5. Show human-readable room/Guild identity, an explicit **Guild Map** control, and a **Leave world** control in every presentation mode.
6. Portal travel is a request to the World Runtime, not a client-side teleport that creates its own authoritative location. Pending, denied, and successful travel states must be visible.
7. On reconnect, reconcile from an authorized runtime snapshot. Local visual optimism may animate, but must not overwrite the authoritative location or Guild rights.
8. Offline: use authorized cached local state, clearly identify stale/snapshot mode, and queue only actions the existing functional owner explicitly supports. Never represent an unverified Quest or location transition as confirmed.

## Presentation modes

| Surface | Controls | Shared contract |
| --- | --- | --- |
| Mobile | World on top; bottom shelf for chat, map, inventory/objects, actions | Respect virtual keyboard and safe-area insets; keep persistent Guild Map and exit reachable; touch targets minimum 44 CSS px |
| Desktop | World canvas with side panels and persistent map/exit affordances | Full keyboard operation and focus return from overlays |
| VR | Summon Civweave phone with telephone/shaka hand sign; five-finger convergence opens hand subsystem menu; gesture controls are optional | Equivalently accessible non-gesture controls; gestures dispatch canonical actions rather than creating alternate storage or logic |
| Low-power/assistive | Semantic 2D map, room list, accessible action menu, reduced motion | Same permissions and portal results as 3D/VR |

The five Guide identities remain themes/memory contexts of **one canonical chat**, not five world-specific composers. AI NPC appearance and speech use the approved Live Interaction and Character Fleet services; the UI never launches unsolicited model calls or voice playback.

## Lane interfaces to agree before implementation

- **World Runtime (Thread 2)** provides `observeWorld(principal, worldId)` returning authorized snapshot plus revision, `requestPortalTravel(principal, portalId, expectedRevision)`, and reconnect/subscription semantics. Exact signatures must be agreed with the runtime owner, not silently imposed by this document.
- **3D Client (Thread 3)** consumes the same authorized snapshot as the 2D view and emits intent actions; it owns no permission or persistence decisions.
- **Live Interaction (Thread 4)** provides speaking/listening indicators, permission state, and explicit controls for mute, interrupt, and listening consent.
- **AI & Character Fleet (Thread 5)** exposes NPC/agent presence and approved utterances via a shared presentation contract; clients do not infer identity from avatar visuals.
- **Infrastructure & QA (Thread 7)** supplies transport, auth, reconnect, rollout flags, and test environments.
- **Integration HQ (Thread 1)** arbitrates contracts, route ownership, feature flags, and merge/release gates.

These are requested interface shapes, **not claims that APIs already exist**.

## Navigation ownership and existing assets

Start investigations from `AGENTS.md`, `config/agent-work-context.json`, `docs/architecture/repository-map.md`, the mobile interface contract, and registered system owners. Trace the active installed-family route before editing.

Reusable components to evaluate: `public/app/shared/worldweaver-map-2d-v1.mjs`, `public/app/shared/worldweaver-screen-v1.mjs`, and the existing Worldweaver avatar/geometry adapters. Developer labs are not production routes. Do not reuse a prototype by assigning it new authority. Preserve one shared navigation, chat, identity, permission, and world owner.

## Acceptance tests / Definition of Done

- Entry appears on the **actual installed app** route; one click/tap reaches an interactive public Commons without DreamGrid/OpenSimulator.
- Mobile portrait, mobile landscape, desktop, low-power 2D, and keyboard-only operation all retain Guild Map and Leave world.
- Switching 2D/3D/VR presentations preserves world ID, room ID, principal, and authorized snapshot revision; no duplicate world session or separate chat history.
- Unauthorized Guild/portal access fails closed and visibly; stale cached membership never grants rights.
- Network interruption and reconnection do not duplicate portal transitions, NPC speech, world mutations, or retained event subscriptions.
- Offline state is labeled; pending actions are distinct from committed activity and signed Guild reports.
- Reduced motion, accessible names, focus management, color contrast, and mobile keyboard occlusion have executable tests or explicit manual review gates.
- Deterministic behavior regression tests are introduced before source behavior changes, as required by `AGENTS.md`.
- Staging screenshots/video, observed route URL, test results, and commit SHAs are supplied to Integration HQ before a production merge.

## Sequence

A. Confirm active route owner and integration APIs with Threads 1/2/7.
B. Add tests for entry discoverability, presentation parity, permissions, and reconnect.
C. Implement the entry affordance in the canonical navigation owner behind a staging flag.
D. Implement semantic 2D-first room/navigation view; connect the 3D renderer as a projection.
E. Add mobile shelf, desktop panels, optional VR affordances; test live voice and NPC indicators.
F. Validate multi-client staging; request Integration HQ approval before promoting.

**Out of scope for Thread 6:** inventing a world database, replacing the single chat core, adding a second Guild membership owner, implementing multiplayer transport, or deploying to production without integration approval.
