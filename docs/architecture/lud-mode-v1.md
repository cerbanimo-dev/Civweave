# Lud Mode and generation provenance

Lud Mode is Civweave's dedicated human-operated lane. It is a package and operating-mode boundary, not a cosmetic switch over the normal AI runtime.

## Canonical owners

- Operating-mode policy: `public/app/lud-mode-v1.js`
- Manual authoring: `public/app/lud-manual-authoring-v1.js`
- Content provenance: `public/app/content-provenance-v1.js`
- Browser generation producer: `public/app/fast-interactive-runtime-v192.js`
- Cloud generation producer: `cloudflare/node-cloud/src/server-ai-entry-v2.mjs`
- Lud package manifest: `public/app/lud-package-v1.json`
- Lud package service-worker lane: `public/service-worker-lud-package-v1.js`
- Download controller: `public/app/lud-installer-v1.js`
- Dedicated download page: `public/app/lud/index.html`
- Entry surface: `public/app/lud/campus.html`

The corresponding declarations live in `config/system-ownership.json`.

## Separate download surface

Lud Mode is downloaded from `/app/lud/`, not from the standard Civweave installer controls. The standard installer may link to the Lud download page but does not own or initiate the Lud package download.

The Lud download page is deliberately plain and contains no generated visual assets. It must not contain image elements, picture elements, SVG artwork, canvas artwork, CSS background images, logos, mascot art, or decorative media. The packaged Lud campus follows the same plain-surface rule.

## Package boundary

The Lud package uses an explicit asset allowlist. Recursive dependency discovery is forbidden for this lane because a future dependency graph may acquire model, AI-runtime, or generated visual dependencies without changing the user-facing feature.

The package must not contain model weights, ONNX/transformer runtimes, guide-chat generation code, local-model inference, server-AI routing, browser agents, model settings, image directories, or logo directories. The package manifest carries forbidden path fragments as a build/runtime guard.

Downloading the ordinary offline campus and downloading Lud Mode are distinct operations. Lud Mode does not redefine the ordinary offline campus.

## Operating-mode behavior

When the stored operating mode is `lud`:

1. The shared family AI loader refuses guide/model generation.
2. The browser generation runtime spine refuses direct generation calls.
3. The Lud surface exposes manual creation rather than model-assisted creation.
4. Human validation uses the existing signed reward-validation contract.
5. Content discovery in the Lud surface admits only explicitly human-authored records.

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

This distinction is required for Lud filtering. Human validation can establish quality or correctness without falsifying authorship history.

## Human authoring

The Lud manual authoring owner can create:

- Quests
- learning programs
- tasks
- resource manifests
- skill manifests

These records are stamped `human-authored` at creation and can be handed to the normal Civweave state/realm contracts without invoking AI generation.

## Human validation and rewards

Lud Mode does not invent a parallel validation economy. Manual validation creates the existing signed validation receipt and submits it through `CivweaveRewardWeave`.

The existing independent-review, portable-identity, evidence-inspection, rubric-completion, confidence, and cross-device payout requirements remain authoritative. Lud Mode changes who performs the review, not the standards for earning a validator reward.

## Verification

`node --test scripts/test-lud-mode-v1.mjs` verifies the dedicated download surface, no-generated-visual-assets rule, package allowlist, no-AI entry surface, generation provenance, immutable origin, Lud runtime guards, human authoring, ownership declarations, and service-worker lane.

`.github/workflows/lud-mode-contract.yml` runs the contract on relevant pull requests and staging changes.
