# Civweave Guild Quest Tracker contract

The Civweave Guild Quest Tracker is the canonical three-tier browser for Civweave's community work hierarchy. It belongs to Civweave, not Cerbanimo. The fantasy language is not decorative terminology layered over a second data model; it maps directly onto existing Civweave records while legacy hub/node field names remain accepted for persistence and federation compatibility.

- **Guild = community host record.** A local, nearby, saved, or boosted Civweave community host is presented to people as a Guild.
- **Quest = Shared intention.** An intention published by a Guild is presented as a Quest.
- **Quest Map = Intention plan.** The Quest's existing Living School, Cerbanimo, and FellowFare paths are rendered as the three execution lanes of one map.

The user-facing hierarchy is therefore **Guilds → Quests (shared intentions) → Quest Maps**.

## Three-tier interaction contract

1. **Guild level** shows live, nearby, saved, boosted, and selected Guilds in the mobile-first 3D carousel. The centered Guild owns the detail card. Swipe, wheel, arrow keys, and direct card selection rotate the rail. Selecting the centered Guild descends to its Quests.
2. **Quest level** keeps the parent Guild rail visible in a compressed state while the Guild's shared intentions rotate in their own carousel. The selected Quest shows its outcome, progress, and open needs. Selecting it descends to the Quest Map.
3. **Quest Map level** keeps the selected Quest available as context and renders exactly three execution lanes from the Quest's existing plan paths:
   - **Living School** — canonical `#aeea57`, Learn & Grow.
   - **Cerbanimo** — canonical `#e85dff`, Design & Build.
   - **FellowFare** — canonical `#efb452`, Support & Share.

The tier selector follows Civweave's current palette: Civweave mint for Guilds, Cerbanimo purple for Quests, and FellowFare amber for the Quest Map. House colors remain community identity accents and do not replace realm lane colors.

## Progress semantics

Quest Map steps are not a second task ledger. Each lane reads the Quest's existing `plan.paths` / `tracks` and uses path/task status plus stored `path.progress` to determine completion. Proof-driven progress events may refresh the view, but the tracker does not award completion by itself.

Open needs are read directly when a Quest publishes them. When explicit needs are absent, unfinished path steps may be summarized as needs. The tracker must never invent Guilds, Quests, tasks, progress, community activity, titles, descriptions, or House assignments. Missing records render as explicit empty states rather than demo content.

## Guild discovery adapters

The tracker uses the same actual Guild identity sources as the Guild Map:

- `/api/hub-map-nodes` is the live directory source and `civweave.hub-map.directory.v1` is its offline cache.
- `civweave.host-node.selection.v1` identifies this device's selected Guild. Device-local `civweave.intentions.v127` Quests may be attached only to that selected real Guild identity.
- `civweave.hub-discovery.v1` remains an accepted source for existing saved/discovered Guild records.
- `federation-finder.mesh-nodes.v1` remains an accepted source for saved and nearby Civweave mesh records.

Records are merged by their real Guild/node ID. Directory fields such as the Guild's published display name, status, public origin, capacity slots, location, and Rally Point remain authoritative when present. The tracker must not inject a synthetic "Your Civweave Guild" record when no Guild is selected or discoverable.

Existing persistence fields remain valid. The interface calls these communities Guilds; legacy hub/node identifiers and fields remain internal compatibility inputs only and are not canonical user-facing terminology.

## Houses remain orthogonal

The available community Houses are:

- House Magenta
- House Cyan
- House Amber
- House Purple
- House Pearl

A Guild shows a House only when an explicit House is published or an existing assignment for that real Guild ID is stored in `civweave.hub-houses.v1`. Rendering the tracker must not randomly assign a House. A Guild with no House remains visually neutral until its community establishes one.

A House change remains governed. The **Guild House vote** action creates a `civweave.house-change-proposal.v1` request in `civweave.anarchadia.pending-proposals.v1` and emits `civweave:anarchadia-proposal-requested`. The proposal keeps legacy `hubId`/`hubName` fields and also supplies `guildId`/`guildName` so existing governance consumers remain compatible while the user-facing lore stays consistent.

## Anarchadia vote identity badges

Quest Map steps can carry Anarchadia vote references directly. The tracker also reads the governance vault (`civweave-anarchadia-governance-v145`) and `civweave.anarchadia.vote-index.v1`. Each open vote receives a stable color derived from its vote ID. The same numbered/color badge appears on every related step so one governance question can be followed across all three lanes.

## Canonical access and compatibility

The tracker lives on the Civweave-owned sub-surface `/app/civweave-guild-quest-v1.html`. The Civweave Working Campus exposes it through the **Guilds** control. Cerbanimo's default realm-console surface no longer loads or owns the Guild Quest Tracker; Cerbanimo remains focused on its own Quest workbench and capabilities.

The route contract recognizes `/app/civweave-guild-quest-v1.html` as a Civweave surface without replacing `/app/working-campus-v156.html` as Civweave's primary system route. This keeps existing Civweave navigation stable while giving the Guild hierarchy a first-class Civweave home.

The implementation file names `cerbanimo-intention-landscape-v1.js` and `cerbanimo-intention-landscape-v1.css`, plus the `CivweaveCerbanimoIntentionLandscapeV1` global, remain temporarily for compatibility. `CivweaveGuildQuestTrackerV1` is the canonical API for new callers. No dynamic script injection, build-time source rewriting, or runtime patch layer is part of this feature.
