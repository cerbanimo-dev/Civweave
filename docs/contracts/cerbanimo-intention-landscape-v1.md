# Civweave Guild Quest Tracker contract

Cerbanimo's default landscape is the canonical three-tier browser for Civweave's community work hierarchy. The fantasy language is not decorative terminology layered over a second data model. It maps directly onto existing Civweave records:

- **Guild = Node.** A local, nearby, saved, or boosted Civweave hub/node is presented as a Guild.
- **Quest = Shared intention.** An intention published by a Guild is presented as a Quest.
- **Quest Map = Intention plan.** The Quest's existing Living School, Cerbanimo, and FellowFare paths are rendered as the three execution lanes of one map.

The hierarchy is therefore **Guilds (Nodes) → Quests (shared intentions) → Quest Maps**.

## Three-tier interaction contract

1. **Guild level** shows nearby, saved, boosted, and local nodes in the mobile-first 3D carousel. The centered Guild owns the detail card. Swipe, wheel, arrow keys, and direct card selection rotate the rail. Selecting the centered Guild descends to its Quests.
2. **Quest level** keeps the parent Guild rail visible in a compressed state while the Guild's shared intentions rotate in their own carousel. The selected Quest shows its outcome, progress, and open needs. Selecting it descends to the Quest Map.
3. **Quest Map level** keeps the selected Quest available as context and renders exactly three execution lanes from the Quest's existing plan paths:
   - **Living School** — canonical `#aeea57`, Learn & Grow.
   - **Cerbanimo** — canonical `#e85dff`, Design & Build.
   - **FellowFare** — canonical `#efb452`, Support & Share.

The tier selector follows Civweave's current palette: Civweave mint for Guilds, Cerbanimo purple for Quests, and FellowFare amber for the Quest Map. House colors remain community identity accents and do not replace realm lane colors.

## Progress semantics

Quest Map steps are not a second task ledger. Each lane reads the Quest's existing `plan.paths` / `tracks` and uses path/task status plus stored `path.progress` to determine completion. Proof-driven progress events may refresh the view, but the tracker does not award completion by itself.

Open needs are read directly when a Quest publishes them. When explicit needs are absent, unfinished path steps may be summarized as needs. The tracker must never invent Guilds, Quests, tasks, progress, or community activity.

## Guild discovery adapters

The tracker reads:

- `civweave.hub-discovery.v1` for explicit Guild/node discovery records.
- `federation-finder.mesh-nodes.v1` for saved and nearby Civweave mesh nodes.
- `civweave.intentions.v127` for Quests belonging to the local Civweave Guild.

Existing discovery fields remain valid. The interface may call them Guilds, but persistence and federation compatibility continue to accept existing hub/node identifiers and fields.

## Houses remain orthogonal

Every Guild receives one persisted House when no explicit House is published:

- House Magenta
- House Cyan
- House Amber
- House Purple
- House Pearl

Assignments remain stored in `civweave.hub-houses.v1`. A House is social/visual identity, not the Guild itself, not a permission tier, and not an economic ranking.

A House change remains governed. The **Guild House vote** action creates a `civweave.house-change-proposal.v1` request in `civweave.anarchadia.pending-proposals.v1` and emits `civweave:anarchadia-proposal-requested`. The proposal keeps legacy `hubId`/`hubName` fields and also supplies `guildId`/`guildName` so existing governance consumers remain compatible while the user-facing lore becomes consistent.

## Anarchadia vote identity badges

Quest Map steps can carry Anarchadia vote references directly. The tracker also reads the governance vault (`civweave-anarchadia-governance-v145`) and `civweave.anarchadia.vote-index.v1`. Each open vote receives a stable color derived from its vote ID. The same numbered/color badge appears on every related step so one governance question can be followed across all three lanes.

## Canonical access and compatibility

The tracker owns the default `?system=cerbanimo&embed=1` landscape route. Existing Cerbanimo rooms and capabilities remain untouched. Opening a room restores the canonical realm-console workspace and exposes a **Guild Quest Tracker** return link.

`CivweaveCerbanimoIntentionLandscapeV1` remains exported for compatibility. `CivweaveGuildQuestTrackerV1` is the lore-aligned alias for new callers. No dynamic script injection, build-time source rewriting, or runtime patch layer is part of this feature.
