# The Commons Between · Worldweaver universe v1

## What this is

**The Commons Between** is a staging blueprint for one shared Civweave universe. It composes capabilities that already exist in the repository instead of introducing a second world authority.

The blueprint is implemented in `public/app/shared/worldweaver-universe-v1.mjs`. It can materialize five **draft** rooms through the canonical `createWorldweaver` owner:

- **Starling Commons** — arrival, meetings, orientation and attributed discussion.
- **Living School** — explanation, practice and demonstrations.
- **Quest Forge** — task rehearsal, evidence and Quest handoff.
- **FellowFare Hall** — creator displays and existing commerce references.
- **Convergence Stage** — rights-cleared story performance and author-reviewed character encounters.

The builder does **not** request provisioning and does not claim that OpenSimulator, DreamGrid, a hosted 3D scene, AI inference or multiplayer networking is running.

## Universe shell

The same universe package references three existing Civweave sources:

1. `worldweaver-visual-scene-v1.mjs` supplies the current 13-district **provisional** visual topology. Those coordinates remain placeholders until a verified provider import replaces them.
2. `worldweaver-story-seeds-v1.mjs` supplies the Door & Dawn catalogue: 16 story worlds across nine In-Between universes and seven physical realities. The universe treats them as opt-in portals, not automatically live simulations.
3. `worldweaver-convergence-cast-v1.mjs` supplies the staged Convergence milestones and author-reviewed cast boundary.

Renderers are projections of the same canonical state. A local renderer, 2D map, browser 3D preview, OpenSimulator or DreamGrid adapter may display the world, but none becomes a separate state owner.

## PvE story runtime

The universe's default story stance is **PvE improv**: participants collaborate against world problems, hazards, puzzles and social conflicts. AI pilots are not granted default adversarial authority over people.

The blueprint exposes only the bounded pilot capability set already supported by Worldweaver: observe, inspect, speak, move, demonstrate, present and facilitate. It explicitly does not grant purchase, voting, publication, administration, code execution or unrestricted network access.

A narrative victory is not a tool receipt. Only the trusted runtime adapter may report that an external action actually succeeded. Likewise, an improvised story outcome stays session narrative until the owning Quest or canon system explicitly accepts it.

## Provisioning path

A host that wants to turn this blueprint into a live world must:

1. create the draft rooms with `buildCommonsBetween`;
2. authenticate the human/Guild authority;
3. verify the selected renderer/provider;
4. request provisioning through the canonical Worldweaver lifecycle;
5. let a trusted runtime report the provider world reference;
6. persist the signed/revisioned state through the existing mesh/host layer;
7. keep 2D, 3D and OpenSimulator/DreamGrid projections on the same instance IDs and revisions.

The existing `worldweaver-commune-host-v1.mjs` remains the current signed local Guild host. This universe module is a composition blueprint above that layer, not a replacement for it.

## Tests

`scripts/test-worldweaver-universe-v1.mjs` verifies that the blueprint:

- references 13 current visual districts and all 16 story seeds by catalogue metadata;
- preserves the nine/seven story-world split;
- creates only canonical Worldweaver room kinds;
- creates screens and stations without provisioning or fake runtime receipts;
- works both as a standalone draft and as a Guild-map-scoped draft.

The test is included in `npm run test:worldweaver`.
