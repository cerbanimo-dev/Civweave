# Worldweaver Universe v1 — The Commons Between

Canonical module: `public/app/shared/worldweaver-universe-v1.mjs`  
Browser proof: `/app/tools/worldweaver-universe-lab.html`  
Executable contract: `scripts/test-worldweaver-universe-v1.mjs`

## Canonical universe

**The Commons Between** is the one v1 Worldweaver universe blueprint. It composes existing Worldweaver rooms, visual districts, story portals, Convergence milestones and PvE rules without introducing a second simulation or application authority.

The user-facing navigation contract adds:

- **The Threshold** at Starling Commons as the arrival nexus.
- A **3D ring carousel** containing every universe room exactly once.
- A **three-lane Intention Highway**:
  - Living School — learn.
  - Cerbanimo / Quest Forge — build.
  - FellowFare — exchange.
- **Anarchadia** as the governance interchange connected to every intention lane.
- Convergence Stage as a separate performance/canon-review destination rather than an intention lane.

The three lanes visualize one intention across systems. They do not merge those systems' data owners.

## Authority

Worldweaver remains the spatial authority. Existing application owners remain authoritative for curriculum, Quest/project state, listings/exchange, governance, and book/film canon. Selecting a carousel card or highway lane is presentation-only until an authorized runtime acknowledges an actual spatial move.

The builder still creates draft Worldweaver rooms and stops before provisioning. DreamGrid/OpenSimulator remains a future trusted renderer/provider adapter; it is not silently claimed as active.

## Cleanup/security rule

This universe stays in one canonical `worldweaver-universe-v1.mjs` file. Do not add parallel compatibility universe modules. Replace and remove when a future version is intentionally adopted.

The module and browser lab prohibit dynamic script insertion, `eval`, `new Function`, iframe compatibility bridges and runtime source patching.
