# Cerbanimo Intention Landscape v1

Cerbanimo's default cabinet landing surface is a three-level causal browser inspired by the progressive galaxy → star → planet focus mechanics in the original `glaedn/Cerbanimo` visualizer family. The new surface keeps that depth-based navigation model while adapting it to hubs, shared intentions, and execution maps.

## Level contract

1. **Hub level** shows nearby and boosted hub nodes in a true CSS 3D carousel. The centered hub owns the description card. Tapping the centered title or card descends to intentions.
2. **Intention level** keeps the parent hub rail visible but shifted upward. Shared intention titles rotate in their own 3D rail. The lower card shows current open needs. Tapping the centered intention descends to its map.
3. **Map level** removes the hub rail and keeps the intention rail as the parent selector. The map uses three execution lanes:
   - Living School: emerald, for learning, documentation, and research.
   - Cerbanimo: neon purple fading to magenta, for practice, labor, and making.
   - FellowFare: amber, for resources, mentors, access, and outsourcing.

The landscape is offline-first and renders only discovered/local data. It does not invent community hubs, intentions, needs, or tasks when none exist.

## Hub discovery adapters

The v1 browser reads:

- `civweave.hub-discovery.v1` for explicit hub discovery records.
- `federation-finder.mesh-nodes.v1` for saved/nearby Civweave mesh nodes.
- `civweave.intentions.v127` for intentions belonging to the local Civweave hub.

Explicit discovery records can carry `boosted` / `boostScore`, distance metadata, descriptions, `sharedIntentions`, and an explicit House assignment.

## The five Houses

Every hub receives one persisted random House when no explicit House is published:

- House Magenta
- House Cyan
- House Amber
- House Purple
- House Pearl

Assignments are stored in `civweave.hub-houses.v1`, so a hub does not change identity on every render. House identity is visual/community metadata, not a permission or ranking tier.

A House change must be governed. The landscape's **Vote on House** action creates a `civweave.house-change-proposal.v1` request in `civweave.anarchadia.pending-proposals.v1` and emits `civweave:anarchadia-proposal-requested`. Anarchadia remains responsible for the actual vote, decision rule, and application of an approved change.

House identity is intentionally suitable for later friendly inter-House challenges. Competition mechanics must be built from community-requested unmet-needs metrics and must not silently convert House assignment into access, reputation, or economic privilege.

## Vote identity badges

Task nodes can carry Anarchadia vote references directly, and the landscape also reads the governance vault (`civweave-anarchadia-governance-v145`) plus `civweave.anarchadia.vote-index.v1`. Each unique open vote gets a stable color derived from the vote ID. That same color appears on every related task, with a small numeric identity badge, so users can visually trace one vote across the map.

## Legacy workspace access

The landscape owns the default `?system=cerbanimo&embed=1` landing route. Existing canonical Cerbanimo rooms remain untouched. Opening a room or capability restores the existing realm-console workspace, and those screens receive an **Intention Landscape** return link.
