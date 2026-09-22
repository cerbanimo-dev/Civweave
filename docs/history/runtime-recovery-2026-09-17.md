# Runtime recovery review — September 17, 2026

## Baseline

Fetched origin and fast-forwarded development staging from 297aae5e to 3f81f556 (1,252 commits). Main is the shipping branch, not the development integration baseline. Preserved the user's staged mempalace.yaml and local staging updater. The pre-refresh stash is retained as a recovery reference.

## Changes

- Settings gateway is the sole provider persistence owner. Local renderers delegate explicit selections; opening Settings no longer reselects an old local model. Provider credentials cannot cross provider boundaries.
- Gemma ONNX external tensors include all decoder and embedding shards. Thought-channel content is removed from visible answers, including incomplete thought output.
- LiteRT keeps its busy lock through conversation disposal and defers engine unloading during active generation. Empty responses fail explicitly.
- Guide requests preserve caller token and timeout budgets. Failed model calls no longer manufacture a canned assistant response or feed those failures into later chat history.
- Hosted structured output is parsed and schema-checked before success; invalid responses enter the existing repair/error lane.
- Cerbanimo ledger deadlines cover response-body consumption. The persistent shell accepts Pages' .html-to-clean-URL redirect while retaining origin, query, fragment, and stale-navigation checks.
- The shared navigation exposes Tools & shortcuts and Settings for every system through the existing menu owner.

## Verification

14 Node regression tests passed in scripts/test-runtime-recovery-v1.mjs. Seven existing contract checks passed: local-selection-authority-v1, settings-open-inert-v321, cerbanimo-load-freeze-v176, server-ai-structured-normalizer-v2, server-ai-request-deadlines-v1, selected-provider-authority-output-v1, and litert-structured-tool-shape-v1. Changed JavaScript passed syntax checks. A dedicated CI workflow now runs the recovery suite and Settings contracts.

On the isolated local staging server, Cerbanimo rendered successfully without the prior false timeout. Tools opened the existing quest shortcuts and shared Settings. No model was selected in that browser profile. No live model download, inference quality benchmark, cloud credential test, production deployment, or release packaging was performed.

## Remaining validation limits

npm run check stops in sync-release-version-assets.mjs with "worker route contract revision was not found while synchronizing Civweave 1.0.163." Its partial generated-file changes were reverted. Other inspected older checks include stale version assertions and an AbortController omission in a VM harness; these are not evidence of a passing full release gate. The full repository check remains blocked. The installed release must not be represented as updated by these source changes.
