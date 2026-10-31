# Starling Commune — visual HUD handoff (2026-10-31)

## Implemented on staging

- `public/app/starling-lounge-v1.mjs` remains the **one Guild-scoped Starling Lounge**, now named Starling Commune. No replacement chat, AI wallet, Quest owner, voting system, or extra model loop.
- The screen is a HUD surrounding the main visual commune. Desktop: resident roster on the left, world and conversation in the center, Quest watch and control room on the right. Mobile: five focusable, scrollable tabs (Commune, Residents, Dialogue, Quests, Controls); the scene is the default tab.
- The illustrated schematic contains a Commons, Living School, Quest Forge and FellowFare. These buildings are visual navigation/focus only. Coordinates and idle animation are **not authoritative world positions, actual travel, or evidence of execution**.
- All eight fictional Starling personas use their existing `/app/assets/starling/*.svg` portraits. Weaveling, Moss, Kamiya, Rook and Merlin use existing Civweave AI assets. The cast and system guides remain distinct.
- Local Starling turn generation and local host jobs drive working / queued avatar state. The latest signed Guild mesh turns may produce a short-lived **recent** indicator; they never imply continued inference. No background timers are added.
- Selecting a system guide permits a specifically addressed shared Civweave chat draft, but deliberately disables Starling-only local model turn / three-person-round / host draft controls. Selecting a fictional persona restores those operations.
- Existing authenticated Guild Quest beats, provenance-gated suggestions, local/browser autopilot, paired Termux or Android execution host, signed transcript, and canonical shared chat are retained. No synthetic votes, Quest completions, neuron spending, or silent jobs.
- Reduced-motion and safe-area controls are included. No inference is started by opening the scene.

## Navigation and planning-console parity

- The main Starling integration's `open()` now attempts a read-only authenticated Guild connection and opens the visual Commune first. If no Guild is available, it preserves access to the original local planning workbench rather than inventing a Guild context.
- The selected Guild card also opens the Commune, with a cache-busted module URL and updated "Starling Commune" action.
- The original planning workbench is retained as a companion console, styled to match the Commune and reachable through Commune → Controls → Open planning workbench. It can return to the Commune through its own header control after authenticated Guild connection.
- Existing planning APIs, pending reviews, publish confirmations, local Quest import, Guild capacity introspection, and privacy controls remain with their current owners.

## Actual Worldweaver binding (prepared; requires runtime owner to connect)

`CivweaveStarlingLoungeV1.attachWorldSource({ getSnapshot, getLayout, worldRef, subscribe, onActivate })` installs the existing `createWorldMap2DView` projection of **the same authorized snapshot** Worldweaver would give its 3D renderer. The fallback illustration hides while the map is displayed. This method never manufactures a world snapshot, permissions, NPC commands, or simulated model responses. `detachWorldSource()` unmounts and closes the subscription, including on page close.

The future world/simulation owner must supply a properly authorized `getSnapshot`, trusted `worldRef`, actual positions or geometry through `getLayout`, a bounded, authenticated update subscription, and permission-checked inspection/navigation via `onActivate`. It must not use demo principals from labs, browser-local self-reports, or a second parallel Starling runtime. To activate 3D, supply the same revisioned provider and compatible NPC/scene IDs; keep this 2D map as low-memory fallback.

## Guide-runtime activity binding

`CivweaveStarlingLoungeV1.bindGuideActivity({read,subscribe})` is a presentation-only bridge for Civweave's own guide-runtime owner. `read()` yields an object containing `agents: [{id, status, at}]` where ids are `weaveling, moss, kamiya, rook, merlin`, statuses are `working, idle, offline`, and `at` is an ISO date string. Reports older than two minutes or dated too far in the future are discarded. A missing or failed reader returns the avatars to standby / no live signal, not to a false working state. `unbindGuideActivity()` and page close stop the subscription. The source must be authoritative within Civweave before the app binds it; this UI adapter itself makes **no trust or authentication decisions**.

No production world provider or authoritative guide-runtime stream was found in the existing Lounge wiring. Until those owners connect, the illustrated 2D commune explicitly says **preview**, and system guides do not claim active inference.

## Acceptance / follow-up

1. Open from an authenticated Guild card. Check roster counts (8 fictional + 5 system guides), image loads, safe-area layout, keyboard Escape and panel controls on phone and desktop.
2. Run a local turn and a sequential three-person round. Confirm only the currently running persona animates as working and signed turns appear without bogus completed Quest claims.
3. Select Rook and Kamiya: their local Starling turn buttons must be disabled, while the shared chat can open an addressed prefill.
4. Queue an actual host draft; ensure queued is distinct from running and job status remains Guild-filtered.
5. Connect a trusted Worldweaver provider; compare 2D projected IDs and revisions with its 3D renderer, and validate unsubscription, stale-report handling, reduced-motion and offline fallback.
6. Build actual agent locomotion, interaction receipts and world synchronization in the proper Worldweaver runtime; do not mistake the design-only stage for that milestone.

## 2026-10-31 Worldweaver local scene integration (staging)

The Commune now mounts a real `createWorldweaver` manifest (not a parallel scene database) using the new `public/app/shared/worldweaver-commune-host-v1.mjs`. On entering an authenticated Guild, the app reads a Guild-founder-signed commune manifest from the existing Pocket object mesh. If one does not exist, the founding-device owner can explicitly choose **Start local world**. No model inference, real-world claims, external network provider, money, or publication is triggered by opening a page.

The host validates signed Guild genesis, matching founding signing device, Guild reader authorization and scene-signature provenance. It constructs four native Worldweaver spaces (Merlin Commons, Moss Living School, Kamiya Quest Forge, Rook FellowFare), a shared screen and a display station. It builds real renderable geometry through `createProvisionalOpenSimScene` → `buildOpenSimGeometry`, and validates a real 3D canvas plus the accessible 2D projection **before** the trusted local adapter acknowledges `request-provision` as `provisioned`. The resulting `backend:local-renderer` manifests are signed as a Guild-scoped object and can be read on eligible replicated mesh devices. The manifest is not an OpenSim / multiplayer server; no claim is made that an external host exists.

The Commune's 3D and 2D switches use `createOpenSim3DPreview` and `createWorldMap2DView` with the **same signed world revision** and cached `sceneGeometry`. 3D supports pointer orbit/zoom/picking; accessible 2D uses canonical object IDs. Selecting an avatar opens the existing focused agent HUD; during a verified local Starling turn or a canonical guide request it animates as working. Visual portrait transitions are **HUD choreography, not world action receipts, world-space NPC coordinates, or AI-autonomous movement**. The scene's 13-zone architecture is an explicitly provisional reconstruction, not historic verified building topology.

The canonical guide chat now supplies real processing/idle signals through `CivweaveGuideChatSurfaceV350.state()`. Its existing `civweave:guide-chat-state` and `civweave:avatar-direct-text` events only trigger a fresh read of the authoritative single-chat owner; untrusted event data cannot grant model activity. Each guide status expires if the source stops updating. Starling local model execution, signed turns and host jobs continue to own Starling persona status.

Remaining deployment boundaries: a non-Pocket Guild without a signed founding record needs an equivalent authenticated world-state authority; OpenSimulator / Overte native world navigation and independently acknowledged `move` receipts, authoritative avatar positions, real multiplayer transport and historical-scene recovery are **not yet implemented**. Never represent portrait motion as executed NPC travel.

Verification: `npm run test:worldweaver` now includes `scripts/test-worldweaver-commune-host-v1.mjs`. The host's signed lifecycle, four canonical rooms, geometry projection, idempotency, unauthorized user, failed renderer and tampered records are covered. Browser/mobile acceptance is still required before production promotion.

### Signed Worldweaver room navigation

The single Guild-signed Worldweaver manifest includes four live-local spaces. The Commune HUD now offers a responsive **Space** selector and the canonical 2D map's space nodes navigate into any available signed room, reusing `selectRoom()` on the same `createCommuneWorldHost` rather than creating a second world. The 3D and 2D projections share the selected room reference and geometries, and the renderer caches each active revision. Unrecognized or foreign room IDs are rejected. The interactive 3D facade remains explicitly local/provisional; never imply OpenSimulator connectivity or external NPC locomotion.

### Guide work-state parity

System guides now read `CivweaveGuideChatSurfaceV350.state()` at scene opening and when the canonical chat surface emits its own `civweave:guide-chat-state` or `civweave:avatar-direct-text` signals. These events are refresh notifications only; the Commune does not accept their payload as authority. When the canonical guide is busy processing a request, that guide's portrait visibly works and travels by a **symbolic UI transition** toward the thematic station. At completion or loss of status the avatar returns to standby; existing Starling signed turn and host signals drive the fictional cast. No unverified background inference or movement receipt is generated.

## 2026-10-31 · Local Fleet / Guild Fleet and AI simulator tool bridge

### Main views, not parallel model registries

**Local Fleet** opens for any user even without a Guild. It reads the single `CivweaveAIFleetV1` device role catalog and browser-private `civweave.ai.fleet.choices.v1` and `civweave.ai.fleet.bindings.v1` records, displaying Swift, Archive, Forge, Quill and Atlas, the selected local inference route, and last-known imported GGUF bindings. Local role preferences, GGUF bytes, local provider credentials and private conversations are **not** inserted into the Guild mesh, Worldweaver snapshots or guild-level UI. Installation/activation remain owned by the canonical AI Settings page; clicking Local Fleet does not run or download any model. A previously saved verified import may be stale until the existing Settings GGUF verifier checks the files again.

**Guild Fleet** is offered only with a selected authenticated Guild, and is reachable both in the Commune’s primary two-tab switcher and from canonical AI Fleet Settings. It reads only existing verified Worldweaver snapshots, grouped Guild pilots and signed Starling turns; the two fleets share no mutable model registry. Switching from Guild-only Quests/Controls back to Local Fleet returns to a visible local panel and hides privileged world controls.

### Registered NPC pilots

The founding Guild device can explicitly click **Register selected Starling pilot** to register a chosen persona’s **currently selected local** model in the existing signed `Worldweaver` manifest. The action is validated by the same canonical Guild genesis and founding-device signer checks as provisioning; it checks the last signed object revision, rejects duplicate pilots, applies the canonical `rig-npc` transition and signs a new revision of the Guild world object. Other Guild readers observe the registered pilot through the standard Worldweaver 2D projection. A registration is a configuration record, **not** proof that a model is online or that NPC movement has executed.

The 3D scene’s overlay now shows **only registered** Worldweaver Starling pilots in an explicitly marked HUD dock. Their activity animations reflect existing Guild-local model and host signals; portrait coordinates are not represented as avatar world-space positions. The rest of the collective remains available as selectable role concepts, but no longer appears to be physically spawned in the 3D world merely because its SVG portrait exists.

### AI simulation observation and tool boundaries

`public/app/shared/worldweaver-simulator-tools-v1.mjs` exposes two bounded programmatic operations:

- `observe()`: reads the signed snapshot through `observeWorld2D`, returns the current world reference, revision, bounded public-in-room entities and pending-intent count; this is the **same** Worldweaver projection owner used by the UI.
- `prepare({personaId,tool,args})`: requires a registered pilot in the currently selected room, checks approved Worldweaver NPC capabilities, bounds structured arguments and checks move coordinates/screen ownership. It returns `pending-verified-model-pilot`; **does not** call `queue-actions`, execute an OpenSimulator or local-renderer action, or write an invented success receipt.

The Guild HUD exposes **Observe this Worldweaver room** and **Prepare move proposal**; the resulting structured observation/proposal is displayed, with explicit pending status. Manual local Starling turns in the Guild view now include a compact Worldweaver **read-only observation** from the current signed room, so the selected actual local model receives genuine scene context. The model is not granted a simulator execution tool merely by seeing those facts.

### Remaining steps toward true embodied AI

1. Connect the canonical model-runtime identity owner to signed NPC `modelId` / `pilotPrincipalId` bindings, with consent and finite inference/resource budgets. A user-typed or model-generated principal must never count as authentication.
2. Give the registered local model a typed tool schema and bounded output parser; submit intents through `createWorldweaver.dispatch({type:'queue-actions'})` **only** when the trusted runtime authenticates that model and Guild authorization.
3. Add a deterministic local-renderer NPC movement/speech engine (and separate OpenSimulator adapter) that actually applies an approved intent, reports a success or failure receipt through `report-action`, and exports authoritative avatar world-space coordinates and movement events. An unexecuted proposal must never appear as a successful action.
4. Sign and replicate authorized runtime position/pose deltas, lease ownership and replay protection; render both 2D and 3D from the **same provider-authenticated positions**, while marking disconnected/replayed state as stale.
5. Complete multiplayer/network adapters, per-agent isolation, model selection, user acceptance tests, emulator/mobile testing, offline PWA acceptance, and CI before production promotion.

### Tests and deployment

`scripts/test-worldweaver-fleet-simulator-v1.mjs` covers local/Guild isolation, signed pilot registration, canonical map observation, proposal-only tool states, coordinate/permission limits and rejected Guild authority. It is included in `npm run test:worldweaver`. The Lounge contract suite covers both primary fleet scopes and the single model manager. Fleet and Worldweaver dependencies are added to **optional** offline shell assets rather than expanding required shell files. Direct in-tool evaluation passed the signed-world, registration and tool checks; the complete Node/GitHub CI/browser suites have not yet been run. All changes in this pass target **staging**, not `main`.

## 2026-10-31 · Branded responsive Fleet/Worldweaver visual pass

The Starling/Fleet HUD now applies the established Civweave deep-ink, mint, rose/lilac and warm-gold palette, serif headings, branded icon lockup, consistent card radius and depth, readable selected/focus states, and a cohesive two-level Fleet hierarchy. The actual interactive scene is visually prioritized above fleet inventories. All model privacy, Guild permissions, simulator authorization, and signed history are unchanged.

**Structural fixes:** Restored the previously missing `data-sl-local-fleet` / `data-sl-guild-fleet` panel markup so the already-existing role, pilot and simulator renderers have real destinations. The chrome wraps the header, fleet switcher and narrow-viewport panel navigation into **one** sticky block: navigation no longer relies on a fixed 62px top offset that could cover a multi-line header. The mobile panel visibility rules now extend through 900px, and the correct Fleet context panel appears only on the scene tab. Local Fleet claims the empty desktop Guild rail, while Guild Fleet retains its Quest and operations rail.

**Collision fixes:** The 13 illustrative cast/guide portraits moved from absolute stage coordinates to a responsive, flow-based presence deck after the scene. The four fallback landmarks are kept within a decorative stage, rearranged into two rows on narrow screens. Real registered Worldweaver pilots are separately displayed in a *flow-based grid beneath* the 2D/3D canvas. They no longer sit at overlapping percent coordinates on top of scene geometry. The pilot presence deck remains available in both 2D and 3D modes, and the scene-status legend remains in normal document flow. Neither deck claims authoritative NPC location.

**Accessibility:** Wrapped action groups and card titles, min-width zero on nested grid/flex items, protected long model identifiers, keyboard-visible focus rings, 44px primary narrow-viewport touch targets, safe-area/keyboard scroll padding, and reduced-motion fallback.

**Verification performed:** Structural inspection of the initial HTML produced 362 opening/closing tags before the extra scoped markup, with matched tags and no unclosed containers; updated markup and CSS syntax are covered by `scripts/test-starling-lounge-contract-v1.mjs`. Three targeted tests of markup, brand/collision rules and landmark footprints passed by direct evaluation. Test geometry covers narrow 260/300/360/390px scenes and wider 600/700/701/900/1100px scenes. The implementation uses real CSS grid, so registered-pilot cards are automatically reflowed without positional overlap.

**Visual QA outstanding:** An authenticated browser rendering and real-device screenshots at 320, 360, 390, 768, 1024, and 1440 CSS pixels are still needed before a claim of visual perfection or production promotion. The current available browser connector was disconnected, so a live screenshot/pixel-diff acceptance pass could not be performed in this session. The above contract tests provide collision-prevention structure, not proof of every font- or device-dependent rendered pixel.

The staging import paths and CSS asset query versions were also refreshed to avoid reusing cached older Fleet UI modules after deployment. Main/production has not been merged in this pass.
