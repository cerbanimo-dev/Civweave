# Civweave production inventory

This is the required source-of-truth inventory for the current tree. Git history is the archive. The repository must not contain historical Civweave browser implementations merely so runtime code can choose among them.

## Selection audit

Before this cleanup, the newest twenty commits on `main` were reviewed. The active work in that window was MiniLM routing, submit-only generative startup, Android chat freeze work, current branding/mobile navigation, New New York host authority, removal of post-paint repair, and current Cerbanimo Japanese copy. The same window also showed repeated edits to numbered chat/fullscreen/orchestrator/hardening/service-worker repair layers and repeatedly materialized release source trees. Those repair layers were the regression surface and were not preserved as source-of-truth.

## Canonical 16-screen sitemap

`public/app/routes.js` is the machine-readable registry.

| # | Screen | URL | Runtime owner |
|---|---|---|---|
| 1 | Campus home | `/app/campus.html#home` | `campus.html` + `campus.js` |
| 2 | Weave | `/app/campus.html#weave` | `campus.html` + `campus.js` |
| 3 | Progress | `/app/campus.html#progress` | `campus.html` + `campus.js` |
| 4 | Library | `/app/campus.html#library` | `campus.html` + `campus.js` |
| 5 | Living School | `/app/living-school.html` | `realm.js` |
| 6 | Cerbanimo | `/app/cerbanimo.html` | `realm.js` |
| 7 | FellowFare | `/app/fellowfare.html` | `realm.js` |
| 8 | Anarchadia | `/app/anarchadia.html` | `realm.js` |
| 9 | AI Settings | `/app/settings.html` | `settings.js` |
| 10 | Install & Downloads | `/app/downloads.html` | `downloads.js` |
| 11 | Weaveling chat | `/app/chat.html?guide=weaveling` | `chat.js` |
| 12 | Moss chat | `/app/chat.html?guide=moss` | `chat.js` |
| 13 | Kamiya chat | `/app/chat.html?guide=kamiya` | `chat.js` |
| 14 | Rook chat | `/app/chat.html?guide=rook` | `chat.js` |
| 15 | Merlin chat | `/app/chat.html?guide=merlin` | `chat.js` |
| 16 | Merlin recovery | `/app/recovery/` | isolated `recovery.js` |

## Browser production tree

The browser tree is deliberately small. `scripts/verify-production-surface.mjs` rejects unclassified extra files under `public/`.

| File | Loaded/invoked by | Executes | Responsibility / reason kept |
|---|---|---|---|
| `public/index.html` | root request | runtime | Tiny redirect to the one Campus entry. No source selector. |
| `public/service-worker.js` | browser/PWA | runtime | Caches current shell/current runtime only, removes old Civweave caches, never selects historical source. |
| `public/app/routes.js` | Campus/chat | runtime | Exactly 16 screens plus five guide identities. |
| `public/app/common.css` | main screens | runtime | Shared tokens, safe areas, cards, buttons and navigation. |
| `public/app/manifest.webmanifest` | browser/PWA | runtime metadata | Stable PWA identity, current start URL, current icons and realm shortcuts. |
| `public/app/campus.html` | canonical entry | runtime | Static Campus document and four realm links. |
| `public/app/campus.css` | Campus | runtime | Campus layout, realm cards, inline Weaveling and workspace. |
| `public/app/campus.js` | Campus | runtime | Local intention/weave state, explicit-submit Weaveling generation, four Campus views, logo cycle and SW registration. |
| `public/app/semantic-router.js` | Campus only | runtime | Sole MiniLM owner. May idle-warm installed MiniLM independently of Chat/Settings. |
| `public/app/chat.html` | five guide routes | runtime | One ordinary-document chat surface. |
| `public/app/chat.css` | Chat | runtime | CSS-grid full-height chat and one native scrollable message log. No viewport-repair JavaScript. |
| `public/app/chat.js` | Chat | runtime | Guide threads and explicit-submit generation. Opening/focus/typing never starts MiniLM or generative inference. |
| `public/app/settings.html` | Settings route | runtime | Static interactive/agentic provider controls. |
| `public/app/settings.css` | Settings | runtime | Responsive settings presentation. |
| `public/app/settings.js` | Settings | runtime | Reads/saves provider profiles. Provider probing happens only from explicit Test. |
| `public/app/downloads.html` | Downloads route | runtime | PWA install/current-shell and optional MiniLM package controls. |
| `public/app/downloads.css` | Downloads | runtime | Download/status layout. |
| `public/app/downloads.js` | Downloads | runtime | Install prompt, SW update, explicit MiniLM cache install/remove and current runtime-cache clear. No source archives. |
| `public/app/living-school.html` | Living School route | runtime | Moss identity shell. |
| `public/app/cerbanimo.html` | Cerbanimo route | runtime | Kamiya identity shell. |
| `public/app/fellowfare.html` | FellowFare route | runtime | Rook identity shell. |
| `public/app/anarchadia.html` | Anarchadia route | runtime | Merlin identity shell and user-customization entry. |
| `public/app/realm.css` | four realm pages | runtime | Shared workbench presentation. |
| `public/app/realm.js` | four realm pages | runtime | Learning paths/evidence, quests/proof, listings/orders, passport/proposals. Imports prior *user data* once where useful but never prior code. |
| `public/app/customization-loader.js` | normal app screens | runtime | The only user-code swap mechanism. Applies user-authored CSS/JS, keeps one last-known-good customization and rolls back failed boots/customization crashes. Cannot replace production source. |
| `public/app/merlin-customization.js` | Anarchadia | runtime | Syntax-checks and stages user customization; activation is explicit. |
| `public/app/recovery/index.html` | recovery route | runtime | Dependency-light recovery document that does not boot the main application. |
| `public/app/recovery/recovery.css` | recovery | runtime | Self-contained recovery presentation. |
| `public/app/recovery/recovery.js` | recovery | runtime | Disable/revert/edit/stage user customization and optional session-key Merlin assistance. Never auto-activates generated code and cannot access production source. |
| `public/app/shared/civweave-model-runtime.js` | Campus, Chat, Settings | runtime | Stable provider adapter for deterministic, Gemini, Ollama, OpenAI-compatible, browser-native and hosted generation. Loading it performs no generation. |
| `public/app/shared/civweave-node-ai-routing-v1.mjs` | peer-AI routing/tests | runtime | Active signed peer-model advert/routing/receipt contract. Protocol version is externally meaningful, not an implementation repair number. |
| `public/app/models/all-minilm-l6-v2/worker.js` | `semantic-router.js` | runtime worker | Fixed ONNX Runtime Web/WASM MiniLM semantic matching/ranking. One thread. |
| `public/app/models/all-minilm-l6-v2/reflex-index.json` | MiniLM worker | runtime data | Current semantic reflex definitions. |

## Tracked browser images

These are the only tracked browser images. Each is referenced by current code or the PWA manifest.

| File | Current use |
|---|---|
| `public/app/assets/ai/weaveling.png` | Campus and Weaveling identity |
| `public/app/assets/ai/moss.png` | Campus, Living School, Moss chat |
| `public/app/assets/ai/kamiya.png` | Campus, Cerbanimo, Kamiya chat |
| `public/app/assets/ai/rook.png` | Campus, FellowFare, Rook chat |
| `public/app/assets/ai/merlin.png` | Campus, Anarchadia, Merlin chat/recovery |
| `public/app/logos/civweave-app-icon.png` | app header/favicon |
| `public/app/logos/civweave-day-logo.jpg` | Campus daytime logo |
| `public/app/logos/civweave-night-logo.jpg` | Campus nighttime logo |
| `public/app/logos/icon-192.png` | PWA icon |
| `public/app/logos/icon-512.png` | PWA icon |
| `public/app/logos/icon-maskable-512.png` | PWA maskable icon |

No world-background archive, generated visual catalog, sprite-sheet root dump, placeholder WebP set, asset lockboard, or unreferenced browser image remains in the canonical browser tree.

## Generated MiniLM/runtime files

These are generated/current third-party runtime or model files, not historical Civweave source:

- `public/app/vendor/onnxruntime/ort.wasm.min.mjs`
- `public/app/vendor/onnxruntime/ort-wasm-simd-threaded.mjs`
- `public/app/vendor/onnxruntime/ort-wasm-simd-threaded.wasm`
- `public/app/models/all-minilm-l6-v2/config.json`
- `public/app/models/all-minilm-l6-v2/tokenizer_config.json`
- `public/app/models/all-minilm-l6-v2/vocab.txt`
- `public/app/models/all-minilm-l6-v2/onnx/model_quantized.onnx`

The MiniLM graph hash is a third-party binary integrity check only. It never selects or restores Civweave application source.

## Direct host runtime

| File | Loaded/invoked by | Executes | Responsibility / reason kept |
|---|---|---|---|
| `server/runtime.mjs` | `npm start`, Docker, Render | runtime | Only Node host entry. Directly serves current `public/`; supports ranges, health/config, SSE, node registration/heartbeat, relay envelopes, presence, Gemini interactions and active Node-AI wallet endpoints. It does not materialize or import archived source. |

### Active server library files

All retained `lib/` modules are current node/commerce/territory infrastructure or dependencies of that infrastructure. The old reconstruction-backup module is removed.

| File | Role |
|---|---|
| `lib/ai-capability-token-v1.mjs` | signed AI capability tokens |
| `lib/ai-wallet-account-v1.mjs` | wallet account primitives |
| `lib/ai-wallet-auth-v1.mjs` | wallet authentication |
| `lib/ai-wallet-http-v1.mjs` | HTTP composition used by `server/runtime.mjs` |
| `lib/ai-wallet-service-v1.mjs` | active wallet/service composition used by `server/runtime.mjs` |
| `lib/local-host-capacity-v1.mjs` | local host capacity state |
| `lib/node-ai-bootstrap-v1.mjs` | local node identity/secret bootstrap |
| `lib/node-ai-http-v1.mjs` | node-AI marketplace HTTP surface |
| `lib/node-ai-inference-gate-v1.mjs` | authorization/accounting gate |
| `lib/node-ai-inference-http-v1.mjs` | inference HTTP adapter |
| `lib/node-ai-ledger-sqlite-v1.mjs` | local node-AI ledger |
| `lib/node-ai-live-commerce-v1.mjs` | active commerce adapter |
| `lib/node-ai-marketplace-v1.mjs` | service manifests, pricing, receipts and settlement primitives |
| `lib/node-ai-onboarding-v1.mjs` | node onboarding primitives |
| `lib/node-ai-operator-session-v1.mjs` | operator session primitives |
| `lib/node-ai-service-package-v1.mjs` | declared node-AI service package loader |
| `lib/node-ai-trial-commerce-v1.mjs` | trial/prepaid commerce path |
| `lib/node-money-edge-bootstrap-v1.mjs` | money-edge bootstrap |
| `lib/node-money-edge-http-v1.mjs` | money-edge HTTP adapter |
| `lib/node-money-edge-stripe-v1.mjs` | Stripe-backed money-edge adapter |
| `lib/node-money-edge-v1.mjs` | money-edge core |
| `lib/node-territory-host-authority-v1.mjs` | territory-host authority operations |

## Build, deployment and verification files

| File | Invoked by | Executes | Responsibility / reason kept |
|---|---|---|---|
| `package.json` | npm | build/runtime/test | Exact ONNX dependency, direct host start and minimal checks. No release-source materializers. |
| `VERSION` | humans/deployment metadata | metadata | Current release label only. It is not a source selector. |
| `scripts/stage-onnxruntime-web-assets.mjs` | prestart/Docker | build | Copies pinned ONNX runtime assets into the current static runtime location. |
| `scripts/ensure-minilm-fixed-ort-model.mjs` | prestart/manual | build | Materializes/checks the current MiniLM model package. Model hash is integrity-only. |
| `scripts/verify-production-surface.mjs` | `npm run check` | test | Enforces exact browser surface, 16 screens, anti-injector rules, model-start boundary, direct server, Merlin rollback and absence of source archives. |
| `scripts/test-node-ai-marketplace-v1.mjs` | `npm run check` | test | Active marketplace contract tests. |
| `scripts/test-node-ai-http-v1.mjs` | `npm run check` | test | Active node-AI HTTP/auth/accounting tests. |
| `scripts/test-node-ai-routing-v1.mjs` | `npm run check` | test | Active peer-AI routing/receipt tests. |
| `scripts/test-local-host-capacity-v1.mjs` | `npm run check` | test | Active local host capacity tests. |
| `scripts/build-cloudflare-pages.mjs` | New New York deployment | deploy | Copies only current `public/` to ephemeral Pages output and rejects oversized assets. No source archive generation. |
| `scripts/provision-cloudflare-account-edge-v1.mjs` | New New York deployment | deploy | Deploys the active account-edge worker and verifies three territory starter nodes. |
| `scripts/bind-territory-host-authority-v1.mjs` | authority finalizer | deploy | Founder-side root binding/revocation of territory host authority. |
| `Dockerfile` | Docker | build/runtime | Builds the one current host runtime and runs checks. |
| `docker-compose.yml` | local Docker | deploy/runtime | Runs the same `npm start` host. |
| `render.yaml` | Render | deploy/runtime | Builds/checks and starts the same direct host. |
| `start-local.sh` | local operator | runtime | Thin shell wrapper around `npm start`. |
| `start-local.cmd` | local operator | runtime | Thin Windows wrapper around `npm start`. |
| `.github/workflows/ci.yml` | GitHub Actions | test | Installs current dependencies and runs the canonical check. |
| `.github/workflows/bootstrap-new-new-york-workers-dev-v1.yml` | manual/recent territory ops | deploy | Ensures the New New York workers.dev namespace and dispatches its current deployment. |
| `.github/workflows/deploy-new-new-york-territory-host-v1.yml` | manual/bootstrapped territory ops | deploy | Builds/deploys the clean Pages tree and current account-edge territory host. |
| `.github/workflows/finalize-new-new-york-territory-authority-v1.yml` | post-deployment | deploy | Founder-side verification and authority binding. |

## Separate current deployment surfaces

These are kept because they are independently deployed/current systems, not browser fallbacks:

- `cloudflare/account-edge/`: active account-edge / starter-node Worker used by New New York.
- `cloudflare/core/`: active founder core Worker.
- `cloudflare/node-cloud/`: active node-cloud Worker.
- `cloudflare/recovery-relay/`: active recovery relay.
- `cloudflare/cerbanimo-mail/` and `cloudflare/mail/`: active mail workers.
- `cloudflare/shared-domain/`: shared Worker domain code.
- `site/`: current Cerbanimo public site, including current Japanese copy.
- `config/`: only current host transport, jurisdiction/financial, launch topology, Node-AI/money-edge examples, open-learning media and open-music harvest configuration. Release-source and old ownership registries are removed.
- `docs/finance/`, `docs/governance/`, `docs/legal/`, `docs/localization/`: current non-executable business/governance/localization records. They do not participate in the browser build.

## Removed categories

The cleanup removes rather than deactivates:

- numbered browser repair/fixer/hardening/orchestrator/guard implementations;
- old Working Campus, cabinet, console, dispatcher and spatial/world browser source;
- old chat fullscreen/saved-chat/local-chat repair layers;
- all alternate service-worker repair/self-heal implementations;
- tracked release-source trees and runtime release selectors;
- hidden generated gateway/runtime source files;
- source materializers, release synchronizers and installer source-mirror builders;
- source seeds, source ZIPs and mobile install-kit source mirrors;
- old Pages API functions no longer used by the direct host/current Workers;
- old federated server wrappers that selected or rewrote archived source;
- root sprite sheets, old giant logo source dumps and source-assets not referenced by the current browser;
- generated world/background/lockboard/catalog/placeholder browser assets;
- historical architecture/release documents that existed only to explain retired implementations;
- the node reconstruction-backup code path. Git history is the code backup.

## Non-negotiable regression boundaries

1. Production source changes happen in Git, then tests, then deployment.
2. No runtime code may select, materialize, inject, or restore a historical Civweave implementation.
3. The service worker may cache only the current application and current runtime assets.
4. Opening Chat or Settings may not start or warm MiniLM or a generative model.
5. Campus may idle-warm installed MiniLM independently.
6. Generative inference begins only after explicit submit/test/action.
7. Merlin may swap only user-authored customization, with one last-known-good rollback point and an isolated recovery surface.
8. Every production file addition/removal/rename must update this inventory in the same change.
