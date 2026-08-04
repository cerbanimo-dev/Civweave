# Local MiniLM semantic router

This directory contains the tracked adapter, worker, manifest, and compact semantic index. The tokenizer and ONNX graphs are installed locally by `npm run setup:local` and are intentionally not committed.

MiniLM performs feature extraction and semantic matching. It does not generate prose. Commonweave uses deterministic local planners when no generative provider is configured, and can connect to Gemini, Antigravity, Ollama, LM Studio, or another OpenAI-compatible generator through the shared AI vault.
