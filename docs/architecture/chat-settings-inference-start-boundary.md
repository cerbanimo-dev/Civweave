# Chat and Settings inference-start boundary

Generative local models must not start, prewarm, load weights, initialize WebGPU/WASM inference, or otherwise perform inference-start work merely because a user opens, restores, switches, focuses, or types into a guide chat, or because a user opens Settings.

The canonical interaction boundary is **submit-only**: a generative local model may begin startup work only after the user submits a message or explicitly invokes a model-specific test/action that clearly requests inference.

Settings may load management-only code after the panel paints. It must not load the generative runtime/worker/bootstrap as part of opening the panel. If inference is already running, Settings may request cancellation after the Settings surface is visible.

MiniLM (`Xenova/all-MiniLM-L6-v2`) is exempt from this generative-model UI boundary. It is lightweight semantic infrastructure used for routing/context and may warm independently of chat and Settings. It must not become coupled to chat-open or Settings-open events.

Regression ownership lives in:

- `scripts/verify-chat-launch-readiness-v295.mjs`
- `scripts/verify-settings-freeze-recovery-v296.mjs`
- `scripts/verify-local-ai-smooth-fit-v314.mjs`

Those checks intentionally fail if chat or Settings reintroduce generative prewarming as a convenience or performance feature.
