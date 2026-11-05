# The Lantern Mesh — Worldweaver universe v1

The Lantern Mesh is a portable Civweave universe seed built on the existing `civweave.worldweaver.v1` owner. It does not create a second authority, networking stack, model router, economy or simulator.

## World shape

Four districts form a cooperative archipelago:

- **Mosslight Academy** — Living School / learning workshops.
- **Quest Forge** — intentions become bounded quests and rehearsable actions.
- **FellowFare Night Market** — creator demonstrations, exchanges and provenance-aware commerce.
- **Anarchadia Assembly** — debate, reversible experiments and civic decisions.

The Starling guide roles Moss, Kamiya, Rook and Merlin each have a bounded NPC blueprint. Installing the seed does not start model inference. The host remains responsible for authenticating model pilots and authorizing every tool call.

## Laws of the universe

The default conflict model is PvE/story/environmental rather than interpersonal domination. Cross-world bridges require explicit human review. Local Guild authority is retained. External actions, publishing, payments and simulator writes are never implied by the seed.

## Files

- `public/app/shared/worldweaver-lantern-mesh-v1.mjs` — universe blueprint and canonical installer.
- `public/app/tools/worldweaver-lantern-mesh-lab.html` — local browser demonstrator.
- `public/app/tools/worldweaver-lantern-mesh-lab-v1.mjs` — demo wiring.
- `scripts/test-worldweaver-lantern-mesh-v1.mjs` — deterministic contract tests.

Run the focused test with:

```bash
node --test scripts/test-worldweaver-lantern-mesh-v1.mjs
```

The demo provisions only a synthetic `local-renderer` inside the lab. It does not claim a live OpenSimulator region, multiplayer transport, or external AI provider.
