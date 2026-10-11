// Transport-only configuration; safety judgments remain in survival-mode.mjs.
export const MODEL_ID='Xenova/vit-gpt2-image-captioning';
export const TRANSFORMERS_JS='/app/vendor/transformers-v4/transformers.min.js';
export const WASM_CHUNKS=Object.freeze([
  '/app/vendor/transformers-v4/wasm/ort-wasm-simd-threaded.jsep.wasm.part0',
  '/app/vendor/transformers-v4/wasm/ort-wasm-simd-threaded.jsep.wasm.part1'
]);
export const MAX_IMAGE_BYTES=12*1024*1024;
export const MAX_GENERATED_TOKENS=48;
