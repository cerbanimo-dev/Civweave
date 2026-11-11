# Post–Book VI lore runtime contract

**Scope:** Read-only fictional narrative data. Staging feature branch; **not** a deployed app integration or independently running agent fleet.

Canonical source: docs/lore/post-book-vi-kami-ryn-ascension-2026-11-05.md

Files:
- public/app/shared/maggieverse-post-vi-lore-v1.mjs — contextForBook, findFuture, proposeFictionalQuest, checkDraft.
- scripts/test-maggieverse-post-vi-lore-v1.mjs — Node test runner.
- docs/lore/kami-ryn-postvi/character-agent-sheets-v1.json — fiction-only role profiles.
- docs/lore/kami-ryn-postvi/loom-coordinates-v1.json — portable, static context illustration.

Rules: Books I–VI remain unchanged; later books inherit the November 5, 2026 Kami Ryn succession. Book IX's protected final line is the absolute last line and is the saga's only permitted F-word. Original note cannot be reliably transcribed. Kami and Kamiya remain distinct. Lari retains an independent identity but not the Goddess title. Participation, identity sharing, model permissions and Guild governance cannot be inferred from lore.

The optIn flag in a fictional quest seed is **only a story label**; it is not trusted consent. No data returned from this module is a verified credential, completed quest, voter identity, real-time world state or instruction to act on external systems.

To review without merging: run node --test scripts/test-maggieverse-post-vi-lore-v1.mjs in the repository. Human editorial review is still required for voice, POV, lore and chronological subtleties.
