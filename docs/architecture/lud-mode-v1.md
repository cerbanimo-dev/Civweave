# Lud Mode and generation provenance

Lud Mode is Civweave's dedicated human-operated lane. It is a package and operating-mode boundary, not a cosmetic switch over the normal AI runtime.

## Canonical owners

- Operating mode: `public/app/lud-mode-v1.js`
- Passport identity: `public/app/shared/civweave-passport-identity-v1.js`
- Guild session/login: `public/app/host-node-session-v1.js`
- Guild discovery/admission surface: `public/app/host-node-installer-lobby-v1.js`
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

The package may include human-only Civweave capabilities such as Passport identity, Guild membership, the Cerbanimo Quest engine, proposal voting, local mesh, reward records, and human validation settlement. It may not include model weights, local-model runtimes, guide generation, server-AI routing, browser agents, model settings, image directories, or logo directories.

`public/app/lud/campus.html` remains the cached asset while navigation uses `/app/lud/campus`, matching Cloudflare Pages clean-URL behavior.

## Passport and Guild membership

Lud Mode participates in the same identity and Guild systems as Standard Civweave rather than maintaining mode-specific copies.

`CivweavePassportIdentityV1` initializes the local Passport before any Guild join is required. It uses the existing Anarchadia Passport storage contract, `civweave.anarchadia.citizen-console.v139` with schema `civweave.anarchadia-console.v1`. If a Passport already exists, Lud preserves and reuses its ID and state. If no Passport exists, the shared owner creates the same compatible local record that Anarchadia consumes. There is no Lud-specific Passport ID or Passport store.

Guild discovery, Citizen/Patron capacity, device login, admission, membership checkout, and capacity sessions remain owned by the existing shared Guild access modules. Joining a Guild while Lud Mode is active does **not** enable local or server AI; the Lud operating-mode boundary remains authoritative.

Because the dedicated Lud service worker fails closed on unknown requests, it contains an explicit network-only allowlist for the live Guild membership/session and human-validation endpoints used by these shared owners. Those responses are never added to the offline Lud asset cache. Arbitrary same-origin APIs, including AI generation endpoints, remain blocked.

Offline Lud work and Passport identity remain available without a Guild connection. Guild discovery, admission, membership checkout, live capacity, and server-backed validation settlement naturally require a reachable Guild or service endpoint.

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

Accepted human review gives each validator a **same-day neuron bonus**. The bonus is usable only until that day's ordinary neuron reset and does not roll over or become a persistent wallet balance. It also never enters the cash-backed lifetime-credit wallet. If a Standard-mode validator spends the bonus on AI before reset, provider usage and any provider cost are settled at that inference; any unspent bonus simply expires at reset.

Existing Buttons, Acorns, Cotokens, evidence requirements, independence rules, and cross-device validation rules remain authoritative. Neuron transfer is an additional Lud-funded reward leg.

## Provenance

Anything generated through Civweave's AI boundary carries `civweave.generation-provenance.v1` at creation, including whether it is AI-generated, provider, model, request ID when available, purpose when available, and generation time.

Structured generated objects also carry `metadata.civweaveProvenance` using `civweave.content-provenance.v1`. Creation origin is immutable. Human review is additive and never converts AI-generated content into human-authored content.

Lud discovery admits only explicitly human-authored content. Unknown provenance fails closed; Civweave does not use an AI detector to guess authorship.

## Verification

`node --test scripts/test-lud-mode-v1.mjs` checks the package boundary, no-generated-visual rule, no-AI runtime boundary, provenance rules, and canonical human-tool reuse.

`node --test scripts/test-lud-human-validation-neurons-v1.mjs` checks the 30-neuron request, 15/10 split, 900-to-30 daily ceiling, non-rollover source allowance, same-day validator-bonus expiry, distinct validator claims, and separation from cash-backed lifetime credits.

`node --test scripts/test-lud-guild-passport-v1.mjs` checks shared Passport generation/preservation, Guild-owner reuse, the packaged Guild membership assets, the no-AI boundary, and the service worker's explicit membership/validation network allowlist.

`scripts/browser-lud-mode-gauntlet-v1.mjs` exercises the dedicated service worker in Chromium through download, clean-route open, and offline reload.
