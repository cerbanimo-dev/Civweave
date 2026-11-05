# The Girls Who Stole Tomorrow
**The Blade & Mirror Saga · Landryverse novel proposal · Cami Ryn Tharp**

Status: **development draft, requires author review**. This is a self-contained story-room source folder on a non-shipping Git branch, not a released manuscript, live pilot deployment or signed cast packet.

## Story
One morning all calendars stop at midnight. A seven-year-old girl tells Landry she has already rescued her six times. Someone is buying and selling futures, and the apparently benevolent system behind the theft refuses to let anyone risk a disappointing tomorrow. The heroes must restore the possibility of choice, rather than decide a preferred destiny for everyone.

## Contents
- [Authoring manifest](manifest.json) — proposed universe metadata and source ownership.
- [Five-act outline](outline.md) — adventure beats, reveals, PvE challenges and continuity gates.
- [Loom Coordinates](loom-coordinates.json) — world facts, states, uncertainty, tools, scene and actor knowledge.
- [Customized character sheets](cast/character-sheets.json) — eleven role/character configurations, including The Loom and the combined editorial aspects.
- [Turn-taking protocol](cast/turn-protocol.md) — how to run character-led passes using the existing approved inference owner.
- [Simulated roundtable](rehearsals/01-turns.md) — explicit sheet-guided dialogue revisions; **no actual remote model calls performed**.
- [Executable table-read fixture](rehearsals/02-scripted-test.json) — 14 bounded turns with scene, speaker, facts-known and spoiler checks.
- [Chapter 1](manuscript/01-the-last-date.md) — Landry first-person literary draft.
- [Lore ledger](lore.md) — constraints, discoveries and open questions, spoilers marked.
- [Continuity review](continuity-review.md) — approval gates and differences from older source notes.

## Existing sources used safely
The author-only Library persona manifest v3 supplied summarized voice/agency baseline for Magnus, Landry and Delia; this folder **does not copy the source file, manuscript excerpts, private scene references or unreviewed emotes**. Current author messages take precedence over outdated v3 details. Maggie has a new separately modeled voice, because the prior file did not contain a separate Maggie record. Merlin's guide brief is adapted from the canonical Civweave guide profiles; Gaia/Kami is a new author concept.

The canonical book-casting owner is Performance Studio; source text and role packets require author review. Until then all descriptions are proposals. Do not treat these profiles as signed Convergence cast packets or as connected model instances.

## Build and run the test
On Node.js 22 from the repository root:

```sh
node --test scripts/test-landryverse-story-v1.mjs scripts/test-worldweaver-portable-client-v1.mjs scripts/test-worldweaver-universe-v1.mjs
node scripts/build-landryverse-story-v1.mjs --out dist/landryverse-test
```

Open `dist/landryverse-test/landryverse-girls-who-stole-tomorrow.civweave.html` directly in a browser, including offline. The exported file contains **the canonical Civweave portable client** with maps, personal local Quest drafts, a journal and PvE prompts. The associated `table-read-report.json` is a deterministic **scripted** test: no AI model calls, no human identity verification, no world provisioning and no automatic manuscript approval. It is not a substitute for a live character-fleet benchmark.

The `Verify Landryverse Story` GitHub Action runs these tests and builds three review artifacts when this folder or its test owner changes. GitHub artifacts are available under the run's **Artifacts** section, not as a production deployment. The generator does not modify an authoritative Worldweaver instance.

## Next legitimate integration
Review chapter and character descriptions with the author; approve screenplay/cast in the existing Performance Studio; select models using the **existing** inference runtime, with consent for hosted model use; generate real Worldweaver instance and portable export through existing owners; publish only after separate provenance approval.
