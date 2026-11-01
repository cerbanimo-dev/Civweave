# The Convergence · book characters, Collective and core guides

## Canon and chronological handoff

The Convergence is Civweave's shared fictional world and interactive simulation
frame, **not** a second independent chat or a mechanism for turning fictional AI
characters into Guild members.

1. **Book meets Team Cerbanimo:** the established book characters encounter and
   collaborate with Weaveling, Moss, Kamiya, Rook and Merlin. Guide persona and
   chat authority remain in the canonical Civweave guide system.
2. **Book meets the Collective:** the book cast subsequently encounters Kami,
   Aphra, Jae, Anthony, Rosa, Sana, Kit and Farah. Starling's existing persona
   catalog, Guild turn ledger and local model scheduler continue to own them.
3. **Public opening:** real people enter Civweave and can encounter the assembled
   characters and systems. Fictional characters never gain human Passport,
   membership, citizenship, voting or financial authority.

These are **story beats, not reported production events**. A release/author
service must validate the exact preceding milestone receipt before a later
beat or a public opening can be marked true. The private UI currently has no
verified milestone receipts and therefore shows `development`.

## Canonical ownership

| Responsibility | Existing owner |
| --- | --- |
| Book script, approved role assignment and optional author-written personality, lore, continuity and relationship constraints | `public/app/shared/worldweaver-performance-studio-v1.mjs` |
| Convergence **read-only** cast packets, NPC commands and private encounter prompts | `public/app/shared/worldweaver-convergence-cast-v1.mjs` adapter |
| Starling Collective members, personalities, planning and turns | `public/app/shared/starling-collective-v1.mjs`, `starling-collective-turns-v1.mjs` |
| Five guide identities, voices and one shared guide-chat surface | `public/app/shared/civweave-ai-personas.js`, canonical guide chat |
| World/room/NPC declarations, queued actions and external authorization | `public/app/shared/worldweaver-core-v1.mjs` |
| Guild signed world/manifests and authenticated membership | canonical signed mesh and Worldweaver commune host |
| Selected model execution | canonical Civweave local/hosted inference runtime |

Worldweaver's Convergence adapter **does not** own production, lore,
model execution, approvals, chat memory, publication or login. The
existing Starling Worldweaver bridge remains unchanged. No persona is copied
into a new Starling catalog.

## Cast workflow now available

From the private `/app/tools/worldweaver-performance-lab.html`:

1. Create a rights-cleared book production and add manuscript excerpts.
2. Create and **human-approve** a screenplay scene.
3. Select a speaking character and record the author-written display name,
   personality, canon limits, relationships and noncanonical improv rules.
4. Approve the role via the existing `assign-cast` owner.
5. Export **only the reviewed character packet** as JSON. The packet contains no
   manuscript body, model chain of thought or participant submissions.
6. Optionally register the character as a local Worldweaver NPC manifest
   against the selected Civweave model. This does not start AI or move an avatar.
7. Optionally rehearse the first Cerbanimo encounter through the existing
   selected-model inference route; consent is required before sending context
   to a hosted endpoint.
8. In the existing Starling Commune/AI Fleets Residents panel, import that
   private packet to preview the book members beside the established guides
   and Collective. The import is session-only, not public or signed.

An exported packet is deliberately `signed:false`,
`publication:private-preview`. **Neither import nor self-declared authorship
proves a trusted public identity.** Public deployment requires an externally
verified author signature, publication/content provenance, audience access
policy, and a trusted model-pilot credential. Preview role castings must not
silently appear as connected Guild pilots.

## Narrative and simulation boundaries

- Book canon and voluntary executive switches remain under the real author's
  review. Landry/Delia and Magnus/Maggie keep distinct agency. Magnus and
  Maggie's independent speaking roles are preserved; a scene may not invent a
  forced merge or overwrite one with the other.
- Perspective-locked manuscript scenes do not gain independent internal POV
  from Raven, Jess, Raj, Dish or other supporting characters by improvisation.
  Story context and knowledge are limited to the excerpt/reviewed notes actually
  supplied to the model, not fabricated memories.
- A simulation beat is labeled provisional; its interactions may have a
  separate role/relationship memory but cannot rewrite book chapters.
- Rehearsal, performance, audience suggestions and later community
  participation must distinguish the canonical timeline from branch
  simulations and hypothetical alternate-world outcomes.
- In-world NPCs never acquire purchase, vote, admin, publish or unrestricted
  browser/network tools. NPC movement and speech require actual runtime
  credentials and receipts, never merely model-generated dialogue.

## Remaining integration gates before a public live Convergence

- Author-signed portable book cast packs and verified release milestone receipts.
- Import reviewed cast from the production library without manual file exchange,
  under per-user and per-Guild access rights.
- Connect approved book pilots to the single Guild Fleet scheduler and
  Worldweaver simulator tool receipts, with per-character memory partitioning.
- Implement shared scenes and moderated interactions among all three cast
  groups without starting a competing chat or agent loop.
- Verify real participant consent, spoilers/age ratings, privacy and
  user-driven decisions before enabling the public-opening act.
- Add reset/replay behavior and a reversible branch memory model so public
  interactions cannot corrupt author-owned novel continuity.

Executable contract: `node --test scripts/test-worldweaver-convergence-cast-v1.mjs`
(included in `npm run test:worldweaver`).
