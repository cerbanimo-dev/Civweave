# MiniLM Fixed ONNX Runtime Web Handoff

Branch: `handoff/fixed-minilm-ort-wasm`

## Purpose

This branch combines two complementary freeze fixes without merging either implementation wholesale over the other:

1. The existing v180 freeze-boundary work keeps AI settings independent from MiniLM startup, makes semantic activation explicit-only, defers reflex-index embedding until the first explicit match, and stores generated vectors in IndexedDB.
2. The fixed-runtime work removes the Transformers.js `pipeline()` loader and all WebGPU/WASM model-selection behavior. MiniLM now creates one direct ONNX Runtime Web session using one quantized graph and the WASM execution provider.

The older branch `test/fixed-minilm-onnx-runtime` was intentionally abandoned as an integration source because it was based on Civweave 1.0.5 and had diverged substantially from current main. Use this handoff branch instead.

## Resulting runtime contract

- Runtime: `onnxruntime-web@1.27.0`
- Model: `Xenova/all-MiniLM-L6-v2`
- Graph: `onnx/model_quantized.onnx`
- Execution provider: WASM only
- Runtime threads: 1
- Token limit: 128
- Model/backend selection: none
- Remote model hosts during browser inference: none
- Activation: explicit semantic-lab action only
- Settings lifecycle hooks: none
- Prewarm: creates/checks the session and vector cache only
- Reflex-index embedding: first explicit match only
- Reflex-index batch size: 1
- Yield between index embeddings: 16 ms
- Vector persistence: IndexedDB, with optional packaged precomputed vectors
- Lexical fallback: unchanged and always available

## Main files changed

### Runtime

- `public/app/models/all-minilm-l6-v2/adapter.js`
  - Downloads and verifies only the fixed runtime/model package.
  - Keeps the worker dormant until an explicit semantic-lab request.
  - Removes WebGPU detection and profile selection.

- `public/app/models/all-minilm-l6-v2/worker.js`
  - Imports `ort.wasm.min.mjs` directly.
  - Pins exact `.mjs` and `.wasm` runtime files.
  - Creates the session with `executionProviders: ['wasm']`.
  - Uses an app-owned WordPiece tokenizer from `vocab.txt`.
  - Preserves the v180 lazy index and IndexedDB vector-cache implementation.

- `public/app/models/all-minilm-l6-v2/model-manifest.json`
  - Describes the fixed WASM runtime and the lazy vector lifecycle.

### Build and delivery

- `scripts/stage-onnxruntime-web-assets.mjs`
  - Stages exactly the browser module, threaded WASM loader, and threaded WASM binary from the pinned package.

- `scripts/ensure-minilm-fixed-ort-model.mjs`
  - Materializes only the vocabulary/config files and the 22,972,370-byte quantized graph.
  - Verifies the graph with SHA-256 `afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1`.
  - Does not pull the q4f16/WebGPU graph or `tokenizer.json`.

- `public/service-worker.js`
  - Adds an exact allowlist for on-demand model/runtime files.
  - Caches them separately from the core device package.
  - Preserves the model cache during service-worker activation.
  - Keeps the heavy graph out of `CORE`.

- `public/extensions/civweave-model-download-v157.js`
  - Remains semantic-lab-only.
  - Does not hook settings buttons, settings opening, or automatic startup.

### Verification

- `scripts/verify-minilm-fixed-ort.mjs`
  - Checks the fixed backend, removed selection paths, explicit-only activation, lazy index behavior, service-worker model corridor, graph hash contract, settings freeze boundary, and deferred mobile packaging.

- `scripts/verify-ai-settings-freeze-boundary-v180.mjs`
  - Retains the existing first-paint and semantic-lab isolation assertions.
  - Recognizes the fixed ORT worker identity.

## Important review findings already corrected

- A stale 1.0.5 `package.json` would have rolled back the v180 settings verifier. The handoff branch is based on the current v180 package and preserves that test.
- The offline service worker originally blocked downloads for every uncached `/app/` asset. An explicit model corridor was required or the Download local model action would receive a 503.
- The model graph must not enter the mobile installer ZIP. The existing installer builder derives its archive from `CORE`, rejects ONNX graph paths, retains `modelPolicy: 'deferred'`, and enforces the Cloudflare size boundary.
- A copied Anarchadia path briefly replaced the sovereignty kernel with the governance kernel. The correct `/app/anarchadia-sovereignty-kernel-v146.js` path has been restored and is asserted by the new verifier.

## Test sequence

```bash
npm install
npm run minilm:fixed-runtime:check
npm run check
npm start
```

On a device or browser:

1. Open the isolated semantic lab, not ordinary AI settings.
2. Download the local model package.
3. Reload and verify the model package remains cached.
4. Start the reflex speed trial.
5. Confirm settings can still open and close during model download and session creation.
6. Confirm prewarm does not begin `index-embedding`.
7. Submit the first explicit semantic match and watch for one-at-a-time index progress.
8. Repeat the match and confirm the index source changes to IndexedDB or packaged precomputed vectors.
9. Test offline after the package is installed.
10. Exercise Anarchadia sovereignty offline to guard the restored core path.

## Expected diagnostic events

During session startup:

- `backend-verify`
- `session-start`
- `session-ready`

During prewarm:

- no `index-embedding`
- index reports `cold`, `indexeddb`, or `precomputed-package`

During the first explicit match on a cold device:

- `index-cache-miss`
- `index-embedding`, batch size 1
- `index-cache-written`

On later matches:

- `index-cache-ready`

## Remaining uncertainty

Static syntax and contract checks are included in the branch. This environment could not complete a real browser inference run or the external model download, so device-level freeze behavior, ONNX graph input/output compatibility, and actual warm/cold timing still require the test sequence above.

There are no CI checks attached to this branch unless a pull request or workflow run is created. Do not treat the absence of a red status as runtime proof.

## Integration guidance

Prefer cherry-picking or comparing this branch against the other instance's final branch rather than merging the abandoned `test/fixed-minilm-onnx-runtime` branch. The high-value combined pieces are:

- direct fixed ORT session creation
- exact runtime-file pinning
- one-thread WASM execution
- semantic-lab-only activation
- first-match lazy vector generation
- IndexedDB vector reuse
- separate service-worker model cache
- deferred mobile installer policy

Resolve any future conflict in favor of preserving the v180 settings first-paint boundary and the lazy vector-cache behavior. Those changes reduce different freeze vectors than the loader replacement and should remain together.
