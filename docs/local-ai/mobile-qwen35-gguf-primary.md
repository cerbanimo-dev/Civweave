# Native Qwen 3.5 4B GGUF phone primary (staging)

The phone benchmark used **Qwen 3.5 4B in a native GGUF llama-server runtime**. This is **not** the same artifact or engine as the existing browser Qwen 3.5 4B LiteRT model. The app must connect to the native engine to use the benchmarked model.

## Phone setup

1. Start the GGUF server used with Model Tester Mobile, listening on the phone's loopback interface, with its Qwen 3.5 4B weights loaded. If launching a compatible llama.cpp binary directly, the equivalent shape is:

   `llama-server -m /path/to/Qwen3.5-4B.gguf --host 127.0.0.1 --port 8080 --alias Qwen3.5-4B-GGUF`

2. Open Civweave staging → Settings → **AI & safety** → **Phone primary · Qwen 3.5 4B GGUF**.
3. Use `http://127.0.0.1:8080/v1` (the default) and press **Verify and use native 4B as phone primary**. Civweave checks `GET /v1/models` and requires a Qwen 3.5 **4B** identity before changing any shared AI settings.
4. Return to the five systems and test a conversation, shared Quest, Moss Learning Journey, Kamiya Endeavor, Rook Manifest, and Merlin review-only proposal. This routing uses the shared OpenAI-compatible runtime; the native 4B is selected as the final-answer model for all five.

**Browser network requirement:** The GGUF server must allow the staging origin to make cross-origin requests; Android Chrome may also prompt for local-network access. Civweave does not disable those browser protections or proxy the model through Cloudflare. If model discovery is blocked, the existing AI route is left unchanged. A native server may expose a different alias; the alias must identify Qwen 3.5 4B so model identity can be verified.

## Optional helpers

- **Qwen 3.5 2B**: if a separate local GGUF server is running (for example `127.0.0.1:8081/v1`), enter its endpoint in the optional 2B field. It may provide short advisory task outlines for planning and structured-output requests.
- **Qwen 3.5 0.8B**: the lower-cost alternative for advisory outlines when a 2B server is not configured. Enter a distinct endpoint (for example port 8082).
- **Qwen 3.5 9B**: remains an explicitly selected high-memory alternative; not automatically loaded alongside the 4B on RAM-constrained phones.

All endpoints must be on-device loopback. Helpers are probed for the correct size during setup and used **only if explicitly configured**. A failed helper is skipped; a failed primary is reported as an error rather than silently swapping to another model or sending content to a cloud provider. Helper text is untrusted, cannot authorize actions, and is never a final user response. Running multiple GGUF servers increases RAM use; leave helper fields empty when resources are tight.

Downloaded browser models (LiteRT/ONNX/WASM) remain installed and manually selectable through Settings. Switching away from the native GGUF route disables its special helper routing without deleting weights or stored data.

## Generation behavior and test boundaries

The native GGUF route requests model-native chat with thinking disabled, streaming enabled, and the existing Civweave request/schema validation and repair boundaries. It does not inherit the browser LiteRT model's runtime limitations. The earlier 30/31 phone result was a synthetic benchmark; native five-system end-to-end integration still needs direct device testing.

Regression check: `node scripts/verify-mobile-qwen-gguf-primary-v1.mjs`

**No automatic server installation or GGUF model download** is performed by this staging change.
