# Japanese v3 visible-copy coverage pass

This branch carries the visible-copy coverage audit used to find app-owned English that still needs a Japanese counterpart.

The audit intentionally preserves common injected technical and product English such as API, WebGPU, GGUF, Gemini, Ollama, Stripe, PMTiles, MapLibre, and model identifiers when they stand alone. Human-facing sentences around those terms should still have Japanese translations.

Test fixtures, model prompt scaffolding, code identifiers, protocol values, and other non-UI strings are not localization debt and are excluded during final triage.

Release 1.0.156 was materialized after reconciling this localization pass with the latest main branch. The final merge candidate keeps the Japanese visible-copy audit and runtime verifier as regression coverage.
