# Story Protocols — AGENTS.md
Scope: `public/creator-suite/world-protocols/`. This supplements the repository-wide agent guide.

## Navigate
1. `catalog.mjs` is the **only canonical source** for the nine public world packets.
2. `lore/*.md` explains each packet for human and agent readers; do not treat it as additional secret lore.
3. `core.mjs` composes selected packets for the existing document agent; `panel.mjs` is a selection surface, not a generation engine.
4. `CROSSOVERS.md` defines mixing rules. `SPOILERS.md` defines the public/private boundary. `LORA.md` covers optional future fine-tuning.
5. `public/creator-suite/document-agent-v1.js` remains the owner of model calls and revisioned tool edits.
6. Preserve source-level provenance, human revisions, local persistence, model selection and consent from the existing Creator Suite.

## Every writing step
- Identify selected world IDs and read their shipped premises and mechanics.
- For multi-world stories, establish a clear intersection rule; make contradictory mechanics explicit rather than silently changing either world's laws.
- Characters may notice science fiction/fantasy conventions and react with grounded humor. The joke should work even when a reader misses the allusion.
- Treat references to popular comics/books/movies/TV as genre literacy, not a license to insert their protected settings, dialogue or characters by default.
- Prefer original characters and events. Never invent private series canon, imply an unconfirmed connection is official, or surprise readers with spoilers from material they did not opt into.
- Use structured document edits, inspect the saved state, then revise. No one-stream replacement of long documents.

## Privacy / security
**Never bundle author-only manuscripts, reveal maps, secret identities, unreleased endings, or training examples containing those spoilers with public protocol files.** A LoRA trained on secret material cannot guarantee that secrets stay hidden. Authorized private sources must be expressly selected per project when that capability exists; default to public lore only.
