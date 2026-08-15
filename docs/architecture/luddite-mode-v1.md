# Luddite Mode and generation provenance

Luddite Mode is Civweave's dedicated human-operated lane. It is a package and operating-mode boundary, not a cosmetic switch over the normal AI runtime.

## Canonical owners

- Operating-mode policy: `public/app/luddite-mode-v1.js`
- Manual authoring: `public/app/luddite-manual-authoring-v1.js`
- Content provenance: `public/app/content-provenance-v1.js`
- Browser generation producer: `public/app/fast-interactive-runtime-v192.js`
- Cloud generation producer: `cloudflare/node-cloud/src/server-ai-entry-v2.mjs`
- Luddite package manifest: `public/app/luddite-package-v1.json`
- Luddite package service-worker lane: `public/service-worker-luddite-package-v1.js`
- Installer controller: `public/app/luddite-installer-v1.js`
- Entry surface: `public/app/luddite-campus-v1.html`

The corresponding declarations live in `config/system-ownership.json`.

## Package boundary

The Luddite package uses an explicit asset allowlist. Recursive dependency discovery is forbidden for this lane because a future dependency graph may acquire model or AI runtime dependencies without changing the user-facing feature.

The package must not contain model weights, ONNX/transformer runtimes, guide-chat generation code, local-model inference, server-AI routing, browser agents, model settings, or other AI execution assets. The package manifest also carries forbidden path fragments as a build/runtime guard.

Downloading the ordinary offline campus and downloading Luddite Mode are distinct operations. Luddite Mode does not redefine the ordinary offline campus.

## Operating-mode behavior

When the stored operating mode is `luddite`:

1. The shared family AI loader refuses guide/model generation.
2. The browser generation runtime spine refuses direct generation calls.
3. The Luddite surface exposes manual creation rather than model-assisted creation.
4. Human validation uses the existing signed reward-validation contract.
5. Content discovery in the Luddite surface admits only explicitly human-authored records.

Unknown provenance fails closed. Civweave must not infer human authorship from style, content, an AI detector, or lack of an AI marker.

## Generation metadata contract

Anything generated through Civweave's AI generation boundary must carry generation metadata when it is created.

The generation envelope schema is `civweave.generation-provenance.v1` and includes at minimum:

- `kind`
- `aiGenerated`
- `provider`
- `model`
- `requestId` when available
- `purpose` when available
- `generatedAt`

For AI generation, `kind` is `ai-generated` and `aiGenerated` is `true`.

Structured generated objects also carry `metadata.civweaveProvenance` using schema `civweave.content-provenance.v1`. This is intentional: downstream code commonly persists `outputJson` without retaining the full runtime response, so provenance must travel inside the generated object as well as on the outer generation result.

Synthetic or deterministic generation is labeled explicitly rather than being mislabeled as AI generation.

## Immutable origin, additive validation

Creation origin is write-once provenance. Once an artifact is explicitly classified as `ai-generated`, `human-authored`, or `deterministic-generated`, later validation must not rewrite that origin.

Human review is additive metadata. A human may validate an AI-generated artifact, producing an artifact that is both AI-generated and human-validated. It does not become human-authored.

This distinction is required for Luddite filtering. Human validation can establish quality or correctness without falsifying authorship history.

## Human authoring

The Luddite manual authoring owner can create:

- Quests
- learning programs
- tasks
- resource manifests
- skill manifests

These records are stamped `human-authored` at creation and can be handed to the normal Civweave state/realm contracts without invoking AI generation.

## Human validation and rewards

Luddite Mode does not invent a parallel validation economy. Manual validation creates the existing signed validation receipt and submits it through `CivweaveRewardWeave`.

The existing independent-review, portable-identity, evidence-inspection, rubric-completion, confidence, and cross-device payout requirements remain authoritative. Luddite Mode changes who performs the review, not the standards for earning a validator reward.

## Verification

`node --test scripts/test-luddite-mode-v1.mjs` verifies the package allowlist, installer label, no-AI entry surface, generation provenance, immutable origin, Luddite runtime guards, human authoring, ownership declarations, and service-worker lane.

`.github/workflows/luddite-mode-contract.yml` runs the contract on relevant pull requests and staging changes.
