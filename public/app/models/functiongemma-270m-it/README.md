# Commonweave bundled micro-model package

Commonweave expects a local FunctionGemma 270M instruction/function-calling package here.

Recommended base model: `google/functiongemma-270m-it`.

The bundled model is not used as a pretend full conversational guide. Its job is to refine or validate Commonweave's structured routing context and provide an offline response only when no user-selected model is available.

## Expected browser package

Place a local Transformers.js ESM bundle at:

`/app/vendor/transformers/transformers.min.js`

Place the model repository files beneath this directory, preserving the Transformers.js local-model structure:

- `config.json`
- `generation_config.json`
- tokenizer files
- `onnx/model*.onnx`
- external ONNX data files referenced by the selected graph

The active adapter is `/app/models/functiongemma-270m-it/adapter.js`. It refuses remote model downloads and loads only the packaged files.

For a Commonweave-specific production build, fine-tune FunctionGemma on the canonical room IDs, capability IDs, consent classes, and route-selection schema before conversion and quantization.
