# MiniLM Semantic Reflex

Civweave uses `Xenova/all-MiniLM-L6-v2` as a local semantic retrieval model, not as a text generator.

The engine embeds the user's message and compares it with a small Civweave intent library. Civweave retains canonical routing, state, consent, and planning. Guide responses are composed from grounded response patterns, so there is no token-by-token wait and no generated JSON contract to repair.

The supplied `all-MiniLM-L6-v2.zip` established the matching tokenizer and configuration set. The packaged ONNX weights are the official Transformers.js `q4f16` WebGPU graph and quantized WASM graph.
