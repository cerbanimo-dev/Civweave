# Post–Book VI production roadmap and acceptance gates

**November 5, 2026 · The Blade & Mirror Saga / Maggieverse.**
This is a complete *implementation plan*, not a statement that unfinished novels or deployments are complete.

| Stage | Deliverable | Current state | Acceptance gate |
| --- | --- | --- | --- |
| 1. Canon | Kami Ryn / Lari succession, preserved note status, separate Eldest Wand event | Established in story lore | Dates, distinct identities, no fabricated note text |
| 2. Book VII | The Note for Lari interlude in working Warlock and alternate Adventures manuscripts | Two alternative draft files in the author's package | Select ONE editorial master; do not concatenate two full branches |
| 3. Book VIII | Two complementary identity/provenance scenes | Drafted separately; manuscript incomplete | Landry/Delia perspective; observe/report/unknown |
| 4. Book IX | Two Guild/autonomy scenes | Drafted separately; manuscript incomplete | Place before protected last scene; exact final line last |
| 5. Part III | Nine distinct future-world dossiers, 27 quest stages and illustrative turn/thread budgets | Local package includes the atlas | Three stages/world; verifiable repair and opt-in exits |
| 6. Fictional roles | Kami, Lari, Kamiya distinction, Maggie, Magnus/Merlin, Landry/Delia, Gaia/Kami, Raven, Erin, Shadow Erin, fruit-fly bigfixers | Read-only narrative profile data | Role sheets grant ZERO real tools, votes or human consent |
| 7. Portable lore helper | Book-scope context, quest-seed proposals and advisory editorial lint | Implemented in shared .mjs + Node tests in this branch | Tests pass on actual staging branch; review UI consumers |
| 8. Offline author tool | Local HTML editor, future browser, draft review and Markdown export | Packaged for offline use | Confirm mobile and desktop browser interactions |
| 9. Real Worldweaver wiring | Authenticated editor connection to lore and opt-in NPC pilots | Not implemented | Owner scopes each action; canonical Worldweaver auth remains authoritative |
| 10. Publication | Reconciled books, EPUBs/PDFs, release metadata and stage/prod deployments | Not done | Author approves canonical manuscript; QA and rollback signed off |

## Implementation rules
- Books I–VI are immutable by this change; saga chronology after Book VI inherits the November 5 event.
- Keep Lari, Kami and Kamiya distinct. Revocation, consent and independent verification always matter.
- The original note is an image artifact, not a legible quotation.
- Use **Living School, Cerbanimo, FellowFare, Anarchadia** as the four Civweave systems, while **Intention → Quest → Party → Guild** remains the separate process.
- No additional F-word is permitted in new post–VI story prose; the single reserved Book IX final line remains absolutely last.
- Distinguish "test file exists" from "test executed"; distinguish "committed" from "deployed".

## Review steps
1. Run the standalone Node test file in this PR and check all assertions.
2. Compare Book VII variants against their original editorial sources and select master.
3. Assemble Books VIII–IX with chronology and voice passes; run draft lint and manually review consent and continuity.
4. Recheck all nine futures for independent exits, evidence and named characters.
5. Review the optional role sheets and Loom Coordinates against authenticated application boundaries.
6. Verify offline editor device behavior, then decide whether to add a Worldweaver authoring UI.
7. Only after sign-off: merge to staging, rerun tests, then plan production separately.

**Definition of done for this PR:** source-consistent canon rules + fictional profiles + opt-in portable lore helper + executable tests + complete review plan, without changing production behavior. **Definition of done for the larger publishing project:** remaining authorial, technical, accessibility and release gates above.
