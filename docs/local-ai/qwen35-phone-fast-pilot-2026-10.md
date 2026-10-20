# Phone-first local AI: Qwen 3.5 4B pilot

**Date:** October 20, 2026. **Status:** staged code with automated contract tests; real device inference/throughput/JSON quality NOT yet measured.

## Goal

Optimize for a fast and capable offline assistant on a 12 GB Android phone, not for a named vendor or quantization. Keep Llama 3.2 3B available for desktop experimentation, but do not retry its pinned browser ONNX loader on Android after repeated renderer deaths.

## Candidates and current engines

- **Primary phone candidate:** `qwen35-4b-litert-web` using the existing **LiteRT-LM 0.17.1 JavaScript/WebGPU** path and the 2026-10-16 upstream **`Qwen3.5-4B_mixed_int4.litertlm`**, **2,754,070,624 bytes**. Source: https://huggingface.co/litert-community/Qwen3.5-4B . Upstream native correctness and phone memory numbers do **not** establish Civweave browser performance. The LiteRT bundle does not supply a verified token-level JSON grammar mask for this generic Qwen3.5 profile; a Moss plan counts as successful only after deterministic schema validation.
- **Smaller comparison:** `qwen3-1.7b-q4f16` with its existing pinned Transformers.js v3/WebGPU route. It may have a quicker cold start; verify empirically rather than assuming.
- **Desktop comparison:** `llama32-3b-instruct-q4f16`. Remains installable for supported desktop browsers. Android ONNX Asyncify is gated until a lower-memory loader is verified.
- **Qwen 9B:** optional, separate **explicit** model selection. Installing/choosing 4B **does not** silently require or initialize 9B.

## Safe Qwen 4B installation from Android

1. Open Civweave Settings → Local models / AI Downloads.
2. Under Qwen 3.5 4B, choose **Download 2.75 GB file in browser**. Use the operating browser's **native download manager**, rather than starting a long in-page Web Fetch. Keep enough device and site storage available.
3. Select the *completed* `Qwen3.5-4B_mixed_int4.litertlm` file via **Import downloaded Qwen 4B file**. The page verifies the exact size and saves independently committed **8 MiB Cache Storage** fragments. Incomplete imports can resume from retained fragments, including after a page restart. The browser's source file is not deleted.
4. Only after the manager verifies the entire chunk manifest and all required fragments, choose **Use locally**. This is an explicit user action and never switches to another model automatically.

Android foreground in-page multi-GB Qwen 4B fetch is disabled, because similar long in-page transfers terminated the browser during the Llama experiments. This guards download memory only; LiteRT generation still requires actual on-device validation.

## Comparative test (no hidden model loads)

For Qwen 4B, submit the same Moss prompt used for earlier failures:

> Teach me to read and memorize the tarot cards through a progressive four-week Learning Journey.

Then repeat using explicitly selected Qwen 3 1.7B (if installed). Settings shows **observed per-model** last-five-run TTFT and decode tokens/s (LiteRT text-length estimates marked **approx**), plus whether the most recent Moss plan passed its structural schema gate. Results are stored **on this device only** under `civweave.local-ai.performance.v1`; no prompts, generated content or remotely uploaded analytics.

Measure: browser renderer survival, installation success, cold-load time, TTFT, token throughput, valid structured Moss plan, overall user-perceived speed, answer usefulness. **Do not conflate** prompt-only JSON, valid parsed JSON, and token-constrained decoding.

## Limitations / next decisions

- Success requires **actual device** passing a meaningful chat and full learning-plan completion. A saved 2.75 GB file and successful WebGPU adapter initialization are not proof that LiteRT 0.17.1 can run this GatedDeltaNet model in the user's browser.
- The upstream Qwen3.5 4B model card describes **one engine per conversation**, mixed-INT4 memory tradeoffs and non-parsed native tool calls. Civweave reuses existing single-engine LiteRT controls and deterministic plan validation.
- If LiteRT cannot initialize on the target phone, record the precise failure and evaluate a **GGUF/native companion** (llama.cpp) or a **supported browser WebGPU runtime**. Do not automatically substitute a third model or claim a WebLLM implementation exists.
- Keep the 2.42 GB Llama ONNX cache intact; migration purges only code-cache paths.
