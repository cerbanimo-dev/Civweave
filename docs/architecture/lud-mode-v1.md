# Lud Mode and generation provenance

Lud Mode is Civweave's dedicated human-operated lane. It is a package and operating-mode boundary, not a cosmetic switch over the normal AI runtime.

## Canonical owners

- Operating mode: `public/app/lud-mode-v1.js`
- Lud presentation/manual drafts: `public/app/lud-manual-authoring-v1.js`
- Human creation adapter: `public/app/lud-human-tools-v1.js`
- Cerbanimo Quests: `public/app/cerbanimo-quest-engine-v144.js`
- Human task and learning-module proposals: `public/app/proposal-voting-gate-v2.js`
- Validation-neuron browser client: `public/app/human-validation-neuron-client-v1.js`
- Validation-neuron capacity authority: `cloudflare/node-cloud/src/capacity-human-validation-v1.mjs`
- Content provenance: `public/app/content-provenance-v1.js`
- Lud package: `public/app/lud-package-v1.json`
- Lud package worker: `public/service-worker-lud-package-v1.js`
- Download page: `public/app/lud/index.html`
- Cached entry asset: `public/app/lud/campus.html`
- Browser entry route: `/app/lud/campus`

These declarations are mirrored in `config/system-ownership.json`.

## Package boundary

Lud Mode is downloaded separately from `/app/lud/`. Its package is an explicit allowlist, not recursive dependency discovery. The download page and campus contain no generated visual assets, images, logos, SVG artwork, canvases, or CSS background images.

The package may include human-only Civweave capabilities such as the Cerbanimo Quest engine, proposal voting, local mesh, reward records, and human validation settlement. It may not include model weights, local-model runtimes, guide generation, server-AI routing, browser agents, model settings, image directories, or logo directories.

`public/app/lud/campus.html` remains the cached asset while navigation uses `/app/lud/campus`, matching Cloudflare Pages clean-URL behavior.

## Human creation reuses Civweave

Lud Mode does not maintain parallel copies of Cerbanimo and Living School behavior. The Lud human-tools adapter loads existing capability owners only after explicit human action:

- Quests are created through `CivweaveCerbanimoQuestV144`.
- New Cerbanimo tasks use `CivweaveProposalVotingGateV2` and commit through the Cerbanimo owner after quorum.
- New Living School modules use the same proposal/quorum owner and commit into the active curriculum.
- Learning-program drafts, resource manifests, and skill manifests remain in the small Lud manual store only where no other canonical mutation owner exists.

This lets Lud and Standard users collaborate on the same human-created records instead of creating a second Lud application.

## Human validation neurons

A Lud resident may spend the resident's ordinary current-day included neuron allowance to fund human validation rather than AI validation.

The policy is fixed at **30 neurons per validation request**. Each request uses exactly two or three independent human validators:

- two validators receive **15 neurons each**;
- three validators receive **10 neurons each**.

At the current base allowance of 900 included neurons/day, a resident who spends no included neurons elsewhere can fund at most 30 such requests that day.

Opening the request consumes 30 neurons from the requester's current-day included quota. It does not count as Workers AI provider usage because no model ran. The request expires at the daily reset.

**Unused daily validation capacity does not roll over.** It is an included service allowance, not a wallet balance.

Only completed accepted human review creates persistent validator compute credits. Those earned neurons are stored separately from cash-backed lifetime credits. If a Standard-mode validator later spends earned neurons on AI, provider usage and any provider cost are settled at that later inference. The lifetime-credit cash reserve is not used merely because validator neurons persist.

Existing Buttons, Acorns, Cotokens, evidence requirements, independence rules, and cross-device validation rules remain authoritative. Neuron transfer is an additional Lud-funded reward leg.

## Provenance

Anything generated through Civweave's AI boundary carries `civweave.generation-provenance.v1` at creation, including whether it is AI-generated, provider, model, request ID when available, purpose when available, and generation time.

Structured generated objects also carry `metadata.civweaveProvenance` using `civweave.content-provenance.v1`. Creation origin is immutable. Human review is additive and never converts AI-generated content into human-authored content.

Lud discovery admits only explicitly human-authored content. Unknown provenance fails closed; Civweave does not use an AI detector to guess authorship.

## Verification

`node --test scripts/test-lud-mode-v1.mjs` checks the package boundary, no-generated-visual rule, no-AI runtime boundary, provenance rules, and canonical human-tool reuse.

`node --test scripts/test-lud-human-validation-neurons-v1.mjs` checks the 30-neuron request, 15/10 split, 900-to-30 daily ceiling, non-rollover source allowance, distinct validator claims, and the separation between earned validator compute and cash-backed lifetime credits.

`scripts/browser-lud-mode-gauntlet-v1.mjs` exercises the dedicated service worker in Chromium through download, clean-route open, and offline reload.
