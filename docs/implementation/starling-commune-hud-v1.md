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
