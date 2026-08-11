# SmolLM2 360M legacy adapter

The bundled SmolLM2 360M model package has been retired from Civweave's release payload.

This directory remains only as a compatibility marker for older runtime code. Model weights, tokenizer data, and package configuration are **not shipped with the app** and must not be restored to the hosted release or offline-campus package.

## Current local-AI path

Use **AI settings → Local models**. Civweave's current local-model registry downloads a selected model explicitly to device-owned model storage and keeps model installation separate from:

- the PWA shell;
- the offline campus;
- knowledge schools;
- visual/media hydration.

The application must remain usable without any local model installed. Hosted startup must not materialize this legacy package or any other optional device model.

Legacy `adapter.js` and `worker.js` are retained temporarily so older cached pages fail through the existing compatibility/fallback path rather than discovering a new bundled model. They must not be treated as evidence that SmolLM2 is installed.
