# Qwen 3.5 4B LiteRT Web: unsupported streaming executor metadata (2026-10-29)

## User-visible failure

After importing `Qwen3.5-4B_mixed_int4.litertlm` (2,754,070,624 bytes) as the legacy Qwen 3.5 4B LiteRT model, local generation can fail during engine loading:

```text
Streaming LlmExecutorMetadata section is not supported yet
```

This is not an output-token streaming bug and it does not indicate a broken download.

## How Civweave calls the model

- Registry ID: `qwen35-4b-litert-web` (`public/app/local-ai/model-registry-v266.js`).
- The 8 MiB browser-import chunks are stored in Cache Storage under `civweave-model-generative-v266`.
- `litert-gemma4-fast-runtime-v1.js` uses `chunkedResponse(...).body` to supply the complete model as a lazy `ReadableStream`.
- `Engine.create({ model, mainExecutorSettings: { maxNumTokens: 4096 } })` invokes the pinned `@litert-lm/core` 0.17.1 WebGPU engine.
- In upstream 0.17.1 `js/packages/core/src/engine.ts`, all `GPU_ARTISAN` models use `ModelAssets.createStreaming` and `Engine.createStreaming`. Passing a `Blob` or `File` does **not** bypass that path; the SDK converts it with `model.stream()`.
- The Qwen 3.5 hybrid model bundle includes `LlmExecutorMetadata` required by recurrent-state layers. The pinned Web streamed-container loader does not handle this section.

References:
- https://github.com/google-ai-edge/LiteRT-LM/blob/v0.17.1/js/packages/core/src/engine.ts
- https://developers.google.com/edge/litert-lm/js
- https://github.com/google-ai-edge/litert-samples/blob/main/models/conversion.md

## Staging mitigation

- Map exactly this loader error to `LOCAL_LITERT_STREAMING_EXECUTOR_METADATA_UNSUPPORTED`, preserving the underlying error text and model ID.
- Do not retry the GPU_ARTISAN compatibility configuration for this error: it goes through the same streamed loader and cannot repair the missing parser capability.
- Do not classify it as a GPU device loss, silently switch models, delete cached .litertlm chunks, or download weights automatically.
- Mark this legacy Qwen LiteRT browser route as incompatible in Settings. Existing imports remain intact.
- Keep on-device GGUF inference (a **different model format and download**) and explicit local OpenAI-compatible llama.cpp/ai.local HTTP servers available for working Qwen 3.5 4B inference.

## Not resolved

This mitigation is **not** a functional WebGPU LiteRT Qwen 3.5 4B fix. A web-compatible model export and loader supporting the executor metadata must be verified in a real browser before re-enabling the LiteRT path as a recommended model. Merely changing the input to `Blob`/`File`, increasing RAM, turning off output streaming, or updating to 0.18.0 without testing is not sufficient.

## Acceptance test on a real device

1. Keep the existing downloaded LiteRT model cached.
2. Select legacy Qwen 3.5 4B LiteRT, trigger a short generation.
3. Confirm structured `LOCAL_LITERT_STREAMING_EXECUTOR_METADATA_UNSUPPORTED` error without a second engine creation, lost GPU quarantine, cache deletion, or silent provider fallback.
4. Select on-device GGUF or a tested local compatible server, send a prompt with `stream:true`, and verify visible token deltas and full structured-plan validation.
