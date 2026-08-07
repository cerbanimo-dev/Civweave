# SmolLM2 360M onboard model

This directory contains Civweave's packaged `HuggingFaceTB/SmolLM2-360M-Instruct` model.

## Roles

SmolLM2 has two explicit roles:

1. **Onboard AI** when the user selects the local route.
2. **Degraded-mode fallback** when a selected provider fails, times out, is unavailable, or returns an unusable response.

User cancellation is not treated as provider failure and does not trigger another model call.

## Fallback expectation

The local fallback is instructed to:

- provide the smallest useful answer supported by supplied context;
- state uncertainty when evidence is incomplete;
- never claim network access, tool execution, writes, messages, purchases, votes, deployments, or other external actions;
- never invent current facts absent from context;
- preserve affirmative-consent boundaries;
- satisfy the requested JSON schema when one is supplied.

## Browser runtime

`npm install` stages the pinned Transformers.js browser runtime beneath:

```text
public/app/vendor/transformers/
```

The generated vendor directory is ignored by Git. Model and tokenizer files remain in this directory. The ONNX graph is tracked by Git LFS.

Inference runs in `worker.js` so the UI remains responsive. The worker uses WebGPU when available and WASM otherwise. Remote model downloads are disabled.

## Local trial

Open **AI settings → Onboard SmolLM2 360M → Run five-prompt trial**.

The trial checks learning, skilled work, exchange, governance, and reflection prompts and reports:

- valid JSON responses;
- correct Civweave route choices;
- execution backend;
- per-prompt latency;
- total elapsed time.

The first run loads the 273 MB local graph into the browser cache and will be much slower than later calls.
