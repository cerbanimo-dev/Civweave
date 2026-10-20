# Android Llama 3.2 3B ONNX renderer termination — runtime blocker

## Confirmed observations (20 October 2026)

- User's Android repeatedly exits/loses renderer during **pass 1, `loading-model`**, before `model-ready`. The latest checkpoint reported 16 seconds elapsed and no worker event for 9 seconds.
- All **8/8 required Cache Storage artifacts** are present. Manifest and Asyncify module/WASM preflights pass. The 2,095,929,344-byte external-weight file and 311,427,072-byte continuation exist as independently imported 8 MiB storage parts.
- These facts confirm **disk** availability only; they do not establish a usable ONNX session or available RAM. The worker reports progress of reading those assets, not GPU-ready. Last phase is `initializing-onnx-session`/`loading-model`, not tokenizer or JSON compilation.
- The staged ONNX Runtime is **1.26.0-dev.20260416-b7804b056c**, pinned **before** the upstream July 14, 2026 fix for large external-data memory peaks. The active runtime uses `ort-wasm-simd-threaded.asyncify`, not a JSPI Blob-backed build.
- This is consistent with memory exhaustion during ONNX session construction, but cannot prove the Android kernel/OOM reason without OS/renderer crash logs.

## Identified upstream defect and remedy

[ONNX Runtime issue #29455](https://github.com/microsoft/onnxruntime/issues/29455) describes the WebGPU external-data loader allocating a single buffer for the external data files and retaining it for the entire session creation, leading to peak CPU memory comparable to model weight size **on top of GPU allocation**. [Merged fix #29477](https://github.com/microsoft/onnxruntime/pull/29477) on July 14, 2026 adds on-demand Blob/range-backed loading **in JSPI builds only**. On a similarly sized 2.4GB external-data model, its authors reported a drop in JS heap peak from 2476MB to 434MB (different hardware/model; not a Civweave phone measurement).

Existing `llama32-chunked-model-storage-v1.js` makes the **import** resumable and limits write-side buffers to 8 MiB. `chunkedResponse()` yields a ReadableStream, but the pinned ONNX loader still materializes the full external data when creating a session. Reducing output tokens, KV context, watch timers, streaming logs or cache chunk size **does not fix this load-time duplication**.

## Current safety policy

- Do not retry the 3B ONNX Asyncify WebGPU model on Android until the actual loader is replaced and verified. The diagnostic's Android worker launch is disabled even if a prior test had a successful checkpoint. The normal app runtime rejects before creating its worker. Desktop behavior and the installed model file cache remain available.
- Safe browser preflight (limits), staged-runtime asset checks, and Cache Storage manifest inspection remain enabled.
- No automatic model substitution. Users may explicitly select an already installed smaller model, such as the existing Qwen 3 0.6B or SmolLM2 135M packages, in Settings → AI Downloads. Do not claim token-constrained JSON capability on those model paths without proving it.

## Conditions to re-enable Android 3B experiment

1. Update/pin a matching Transformers.js / ONNX Runtime Web **JSPI** runtime + matching WASM binary that **includes #29477** and supports the target browser (Asyncify and JSPI builds are not interchangeable).
2. Ensure the model loading path actually provides **Blob-backed** external data to the JSPI runtime, not a monolithic Uint8Array, ArrayBuffer or conventional stream that is eagerly collected.
3. Validate file lengths, model graph/external-data integrity, service-worker staging and source provenance. Preserve existing cache; do not force a multi-GB redownload.
4. Instrument actual model-ready, nonempty draft, then separate constrained JSON completion. Measure CPU/worker and GPU memory or inspect Android renderer logs where feasible.
5. Only after a genuine Android device pass, update the runtime compatibility gate and regression assertions. Guard all normal Moss/Weaveling routes until then.

Never treat 8/8 cache files, a GPU adapter's 2GiB maxBufferSize, or a running progress percentage as sufficient proof to bypass the gate.
