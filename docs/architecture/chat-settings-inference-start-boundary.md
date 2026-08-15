# Chat and Settings inference-start boundary

Generative local models must not start, prewarm, load weights, initialize WebGPU/WASM inference, or otherwise perform inference-start work merely because a user opens, restores, switches, focuses, or types into a guide chat, or because a user opens Settings.

The canonical interaction boundary is **submit-only**: a generative local model may begin startup work only after the user submits a message or explicitly invokes a model-specific test/action that clearly requests inference.

## Settings

Working Campus loads the small Settings presentation controller as part of the static document graph. Opening Settings is therefore an input-to-DOM operation, not a dynamic script-injection path. The controller may present saved configuration and may request cancellation of already-running inference after the panel is visible, but it must not bootstrap, test, probe, download, or start a model merely because Settings opened.

Older realm documents may temporarily use the Settings gateway's compatibility controller loader until those documents are rebased onto the same static graph. That compatibility path may load presentation code only. It may never load generative runtime, worker, bootstrap, model weights, or repair layers.

There is no Settings lifecycle subscriber in the active campus graph. Model management work belongs behind explicit user actions rather than Settings-open side effects.

## Chat

Opening or switching chat is presentation/state work only. Generative inference begins from explicit message submission. The low-level runtime may expose a prewarm primitive for non-UI callers, but the canonical chat owner must not invoke it from chat-open, focus, typing, workspace-state, or Settings events.

MiniLM (`Xenova/all-MiniLM-L6-v2`) is lightweight semantic infrastructure for routing/context and may warm independently. It must never become coupled to chat-open or Settings-open events, and it must not be mistaken for the selected generative model.

## Working Campus runtime

The active campus is one static JavaScript runtime. It must not fetch `.txt` code fragments, execute fetched source through `Function(...)`, install a return/reload guard, or rely on a post-load planner patch. Planner helpers may be loaded only from explicit planning actions; local generative AI may be loaded only from explicit inference actions.

Regression ownership lives in:

- `scripts/verify-interface-runtime-v1.mjs`
- `scripts/verify-system-ownership-v317.mjs`
- `scripts/verify-chat-launch-readiness-v295.mjs`
- `scripts/verify-settings-freeze-recovery-v296.mjs`

These checks intentionally fail if runtime fragment evaluation, reload repair loops, parallel Settings ownership, or generative UI prewarming returns.
