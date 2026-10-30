# Reader-safe spoiler policy
Only the nine public setting premises and mechanics in `catalog.mjs` are shipped in the client. No unreleased multi-series character identities, future plot revelations, romantic twists, time-loop solutions, private manuscripts or secret ending imagery belong here.

**Enforcement order:** (1) no privileged lore in public bundles, (2) include only selected public packets in each model call, (3) mystery-preserving generation instructions, (4) post-generation continuity checks and human review.

Prompt rules and a future LoRA reduce accidental spoilers; neither can guarantee nondisclosure when the underlying model has seen secret training data. Never train the optional adapter on private plot notes with the intention of filtering them out at inference.

User-authored fanfiction may include spoilers the author deliberately types. The protocol does not override a user's own text; it simply avoids introducing unprovided private lore.
