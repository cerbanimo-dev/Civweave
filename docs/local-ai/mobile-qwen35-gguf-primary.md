# Browser-only GGUF phone primary · staging

**No server is required.** Civweave stages Wllama 3.8.1 locally at `/app/vendor/wllama/esm/`. Wllama uses WebAssembly and experimental WebGPU in a browser worker, loads GGUF files from its device cache, and streams output through Civweave's existing shared AI runtime.

## Import the GGUF already on your phone (no second download)

In **Settings → AI & safety → On-device GGUF**, use **Choose existing GGUF file or shards**, then **Import selected GGUF files and use as primary**.

- Files come from Android's file picker (for example **Downloads**). If the original model is in another app's private cache, export or copy its actual `.gguf` file to a folder the picker can access first.
- Civweave copies the original GGUF bytes into browser-managed cache storage, checks GGUF headers and each saved shard's expected size, and selects it as the shared primary model without quantization changes. This uses additional device storage; it does not move or delete your downloaded original.
- Wllama cannot open a **single unsplit GGUF larger than 2 GB**. Civweave now reads the original GGUF header and tensor offsets, builds **properly formatted tensor-aligned shards** inside the browser using Blob slices, and caches those shards. This keeps the original Q4 weights intact: no alternate quantization, model redownload, server, or desktop is required. The original file is preserved. For models with unusual GGUF metadata, a tensor exceeding a safe shard size, insufficient storage, or unsupported versions, import fails explicitly rather than selecting an alternate model. Existing `llama-gguf-split` shards still import directly.
- **Qwen 3.5 4B Q4_K_M embedding fix (Oct 22):** The real `token_embd.weight` may use Q6_K and occupy about 521.5 MB. The previous browser splitting target was 480 MB and therefore rejected a valid tensor. The updated 1.8 GB per-shard payload target accepts that complete tensor and still checks final GGUF shard size against Wllama's 2 GB limit. Error messages now distinguish malformed tensor offsets from a genuinely oversized tensor. This change does not alter the original file or any quantization.
- The original GGUF architecture and GPU-backend support still have to be tested in Civweave's bundled Wllama engine. Successful native llama.cpp benchmark results do not automatically prove browser inference will work on that device.

## In-platform workflow

1. Open staging Civweave → Settings → AI & safety → **On-device GGUF · phone primary**.
2. Choose a GGUF. The available built-in options are Qwen 3.5 4B **IQ2_M** (about 1.6 GB) and Qwen 3.5 2B **Q4_K_M** (about 1.3 GB).
3. Press **Download GGUF into Civweave**. The bytes download into the browser's managed model cache, with progress in Settings.
4. After download finishes, press **Use downloaded GGUF as primary**. This disables any previously active ONNX/LiteRT selection *without deleting its weights*, and persists the shared five-system AI selection.
5. Open a guide and generate an answer. The runtime imports Wllama dynamically only for explicit GGUF use, loads the selected cached weights, and streams the answer. Browser WebGPU is attempted with limited offload, with a CPU/WASM retry on load failure. No inference API request goes to localhost or the internet. The previous loopback server integration is retired from the UI.

**Quantization limitation:** The benchmarked 4B's GGUF quantization may not match the browser-compatible 4B IQ2_M included here. A GGUF file larger than 2 GB must be **properly split with llama-gguf-split**; setting a Hugging Face URL to the first `-00001-of-000NN.gguf` shard is supported by Wllama, provided all shards exist at the source. Merely byte-slicing a single GGUF is not a valid replacement. Do not claim the former 30/31 score carries over to a different quantization or browser backend. Wllama's mobile WebGPU support is experimental and may be slower or fail on some phones.

For import/custom quantizations, set the download URL to a direct HTTPS Hugging Face `/resolve/.../*.gguf` link. The preset identity is not a proof of the chosen custom file's architecture; use only the correct Qwen 3.5 model file.

The browser cache and existing downloads remain untouched when this option is not selected. The app neither installs nor requires any native GGUF server. An optional 2B GGUF can be downloaded, but loading two multi-gigabyte models concurrently is deliberately disabled on RAM-constrained phones; helper scheduling beyond the primary model remains a separate integration step.

## Verification

Run `npm run verify:mobile-qwen-gguf`. The dedicated GitHub workflow checks syntax and that the shared runtime routes to Wllama *before* any OpenAI-compatible HTTP transport. Device-level runtime loading and five-system benchmarks must still be run on staging hardware.
