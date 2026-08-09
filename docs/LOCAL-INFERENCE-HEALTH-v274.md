# Civweave browser-local inference health v274

Civweave's downloaded-model test is an inference health check, not a model-quality benchmark.

## Passing stages

A downloaded model passes only after the device completes this chain:

1. required cached artifacts are present and valid;
2. a WebGPU adapter can actually be created;
3. the tokenizer loads from the local cache;
4. the causal language model loads into WebGPU;
5. a one-token shader warm-up completes;
6. the model's chat template is applied successfully;
7. the prompt plus requested output fits the declared model context;
8. a generated token is observed;
9. decoded text is produced.

The health probe disables model thinking/reasoning and asks for only 32 output tokens. It measures infrastructure health without allowing a thinking-capable model to spend the whole smoke-test budget on reasoning tokens.

## Context contracts

| Model | Model context window | Civweave working default | Cold health-test ceiling |
| --- | ---: | ---: | ---: |
| Qwen 3 0.6B q4f16 | 40,960 tokens | 4,096 tokens | 6 min |
| Qwen 3 1.7B q4f16 | 40,960 tokens | 4,096 tokens | 10 min |
| SmolLM3 3B q4f16 | 65,536 tokens | 2,048 tokens | 15 min |

The model context window is the architecture's declared maximum. The Civweave working default is deliberately smaller because browser WebGPU memory and prompt-prefill cost vary dramatically by device. It is a conservative operating policy, not a claim that the model cannot accept a larger prompt.

## Timing

Civweave does not publish a fake universal time-to-first-token number. The health probe records the actual device's:

- cold model load time;
- shader warm-up time;
- prompt token count;
- first generated token latency (TTFT);
- generated-token count;
- decode tokens per second;
- GPU adapter metadata when the browser exposes it.

A subsequent request while the model remains resident should usually avoid most of the cold-load cost, so cold TTFT and warm/resident TTFT should be interpreted separately.

## Thinking profiles

Interactive downloaded-model chat defaults to the model's non-thinking chat template for responsiveness. Agentic downloaded-model work defaults to thinking enabled. Callers can override the thinking flag explicitly.

## SmolLM3 metadata repair

The SmolLM3 model weights remain pinned to the existing verified model revision. Its tokenizer/chat-template metadata is pinned independently to the later Jinja.js-compatible template revision. Existing devices therefore repair only the missing/stale metadata artifacts rather than redownloading the multi-gigabyte model weights.

## Failure reporting

A failed health check stores the last completed stage and metrics locally. The UI should report whether failure occurred while checking the GPU, loading the tokenizer, loading the model, warming shaders, preparing the chat prompt, waiting for the first token, or decoding output. No remote or deterministic fallback is substituted for this diagnostic.
