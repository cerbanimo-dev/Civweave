# Civweave 1.0.84

Civweave 1.0.84 restores the downloaded browser-model inference path on top of the current 1.0.83 release without reverting the newer open-learning-media service, hardware ladder, CPU/WASM compatibility fallback, metadata-repair protections, node AI marketplace, or canonical release history.

## Downloaded local inference

- Uses `AutoTokenizer` and `AutoModelForCausalLM` rather than the generic text-generation pipeline.
- Applies each model chat template directly and controls thinking explicitly.
- Interactive local chat defaults to thinking off; qualified agentic local work defaults to thinking on.
- Verifies a real WebGPU adapter and preserves the explicit CPU/WASM compatibility lane.
- Performs a one-token warm-up before health generation.
- Counts prompt tokens, enforces declared model context windows, and records TTFT, generated tokens, decode tokens/sec, cold load, warm-up, and backend diagnostics.

## Health test

`Test model` is a direct 32-token non-thinking inference check. It reports the last completed stage rather than collapsing every failure into “no output,” and persists measured device performance in AI Settings.

## Context contracts

- Qwen 3 0.6B: 40,960 model tokens / 4,096 working default.
- Gemma 3 1B IT: 32,768 / 4,096.
- Qwen 3 1.7B: 40,960 / 4,096.
- SmolLM3 3B: 65,536 / 2,048.
- Qwen 3 4B: 40,960 / 2,048.

SmolLM3 retains its existing weight revision while tokenizer/chat-template metadata is independently pinned to the later Jinja.js-compatible revision, allowing targeted metadata repair without replacing valid model weights.

## Integration

Working Campus and canonical AI Settings now request the same v282 local inference bootstrap. The release is materialized under `releases/1.0.84`; 1.0.79 remains the immutable launch baseline and 1.0.83 remains the preceding open-learning-media release.
