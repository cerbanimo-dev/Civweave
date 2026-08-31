# Gemma 4 import reconciliation v3

Observed staging state after both LiteRT files were imported:

- browser receipt: 2/2 large files imported
- import progress: 100%
- pack state: `browser-partial` at 99%
- stale UI action: `Complete Q4F16 core`

The stale action came from the legacy dual-Q4 Settings action owner, which still installed a card-level `MutationObserver` and rewrote Premier Phone Pack controls after the current LiteRT modules had rendered. The current phone path now uses `gemma4-dual-actions-v2.js`, which is observer-free and does not own Q4 presentation.

When the browser receipt already contains all large LiteRT files but the pack is not `ready`, the current action owner exposes **Finish phone performance core**. That action asks the local model manager to recognize E2B/E4B through the OPFS-backed cache facade, then re-evaluates the Premier Phone Pack. If another small support component is missing, the error identifies it and explicitly says the multi-gigabyte LiteRT files do not need to be imported again.

The Settings menu remains passive: Gemma action/storage code is still loaded only after an explicit model action.