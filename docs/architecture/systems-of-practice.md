# Civweave Systems of Practice

This document is the map for cross-cutting behavior. Before adding a button handler, global event listener, loader, overlay, state store, service worker hook, or shared runtime, first find the existing owner here and in `config/system-ownership.json`.

## The rule

**Do not add another owner to make an existing owner work. Fix or extend the owner.**

A visible control is not an invitation to attach a new event. A custom realm page is not permission to implement another copy of a shared system. A failing helper is not permission to patch browser prototypes or globals around it.

For every cross-cutting change, an agent must perform this sequence before editing:

1. Trace the active route from `public/app/fullscreen-family-v104.html`.
2. Read `config/system-ownership.json` and identify the capability owner.
3. Search every active entry and shared runtime for the canonical control, event, global API, storage key, and loader.
4. Classify each match as **owner**, **subscriber**, **caller**, **compatibility shim**, or **retired code**.
5. If more than one input owner exists, consolidation is the task. Do not add another path.
6. Change the owning implementation first. Compatibility code may delegate to the owner but may not intercept input.
7. Update the ownership verifier whenever the capability boundary changes.
8. A PR is incomplete until the ownership verifier proves the active route graph still has one owner.

## Jurisdiction-sensitive financial behavior

Before changing goods checkout, seller payment methods, marketplace fees, tax collection, seller reporting or withholding, cross-border goods behavior, service/learning/tutoring tax behavior, membership/compute/digital-service tax behavior, or a jurisdiction gate, read all three canonical artifacts:

- `config/jurisdiction-financial-features-v1.json`
- `config/jurisdiction-implementation-map-v1.json`
- `docs/finance/jurisdiction-implementation-map-v1.md`

Preserve the seller-direct goods boundary unless an explicitly approved jurisdiction mode supersedes it. Resolve seller establishment and tax status, goods origin, destination/subdivision, transaction value and product class, contract-formation surface, payment control, tax collector/remitter, and delivery control before selecting a mode. Unknown, stale, conflicting, or unreviewed jurisdiction state fails closed for platform goods payment, platform goods-tax collection, transaction-specific goods fees, and any required external-contract boundary.

The implementation map is an engineering/compliance screening artifact, not authority to enable live-money behavior. Facilitator, deemed-supplier, withholding, and platform-tax behavior continues to require the existing human compliance and live-money gates. A jurisdiction-policy change must update the feature catalog, implementation index, and human-readable map together rather than silently changing the global economic boundary.

## Settings

Settings is the reference implementation of this discipline.

- Input owner: `public/app/settings-gateway-v317.js`
- Presentation and persistence owner: `public/app/settings-gateway-v317.js`
- Downloaded-model management subscriber: `public/app/document-lifecycle-v221.js`
- Canonical control: `[data-open-unified-ai-settings]`
- Shared realm control: `public/app/family-shell-v104.js`

The gateway owns the shared form and provider persistence. Local-model renderers and the primary-route compatibility facade delegate explicit selection to `selectLocalModel`; they must not add competing submit handlers or rewrite providers on load. Opening Settings reads saved state only. The Local models tab loads its view, and explicit model actions load the management/runtime lane.

Forbidden Settings patterns:

- attaching another click listener to a Settings control;
- calling the Settings controller directly from realm code;
- loading the active Settings controller or Settings management lane during startup;
- maintaining a realm-specific Settings surface;
- using a MutationObserver, polling loop, lifecycle hook, or prototype patch to discover or repair Settings entry;
- patching DOM/browser prototypes to compensate for a bug in the Settings controller;
- treating `civweave:model-settings-opened` as permission to own the original user input.

Subscribers may react to `civweave:model-settings-opened` after the canonical surface exists. They may not prevent, stop, capture, replay, or synthesize the original Settings click.

### Living School

Living School is not a special case. It uses the same family-shell Settings control, the same Settings gateway, the same controller, and the same downloaded-model management lane as Cerbanimo, FellowFare, and Anarchadia. Living School may not ship a realm-local Settings button or load Settings repair code to create one.

## Family navigation

- Shared chrome owner: `public/app/family-shell-v104.js`
- Route authority: `public/app/system-routes-v227.js`

Realm pages can expose realm-native navigation inside their content, but cross-system travel and shared family chrome belong to the family shell. Do not attach a second cross-system switcher to an embedded service.

## Guide chat

- Canonical chat surface: `public/app/guide-chat-surface-v350.js`
- Unified capability layer: `public/app/unified-chat-system-v1.js`
- Capability passover and canonical artifact-language adapter: `public/app/guide-capability-passover-v1.js`
- Compatibility-only historical loader: `public/app/guide-workspace-v242.js`
- Shared dependency loader: `public/app/family-ai-loader-v105.js`
- Canonical artifact-language contract: `config/guide-artifact-language-v1.json`
- Human-readable artifact-language contract: `docs/contracts/guide-artifact-language-v1.md`

There is one chat system with five guide themes and separate memory folders. Realm code should request the canonical guide surface; it must not create another persistent chat owner because a page wants a different guide identity.

Specialized artifact ownership is fixed in user-facing language:

- **Weaveling makes Quests.**
- **Moss makes Learning Journeys.**
- **Kamiya makes Endeavors.**
- **Rook makes Manifests.**

The internal artifact IDs `weave`, `curriculum`, `quest`, and `resource` predate this language and remain compatibility identifiers only. In particular, internal `quest` currently maps to Kamiya's **Endeavor** machinery; it does not mean that Kamiya owns user-facing Quests. User-facing **Quest** always belongs to Weaveling.

A guide may discuss another domain, but creating another guide's specialized artifact must produce a passover offer rather than duplicate the generator. Accepting the passover opens the destination guide and resubmits the preserved request through the shared chat path. Moss's Living School generator remains the materialization owner for Learning Journeys.

## Local AI inference

- Inference owner: `public/app/local-ai/runtime-v266.js`
- Bootstrap: `public/app/local-ai/bootstrap-v266.js`

Settings may configure and manage downloaded models. Opening Settings must never start inference, probe a provider, validate cached weights, run a health test, or warm a model. Those actions require their own explicit user intent.

## Private messaging

- Canonical owner: `public/app/civweave-private-messaging-v1.js`
- Setup caller: `public/app/hub-mail-claim-v1.js`
- Offline mesh dependency: `public/app/local-object-mesh-v146.js`
- Online relay authority: `cloudflare/mail/src/index-v4.mjs`
- Canonical API: `globalThis.CivweavePrivateMessagingV1`

Private messaging is one encrypted-envelope system with multiple transports, not a mail client plus a mesh chat that happen to share a screen. The device creates the private-message envelope and encrypts the plaintext before either transport sees it. Nearby/offline exchange uses the local object mesh; internet catch-up uses the hidden Civweave relay. Both carry the same envelope UUID so duplicate arrival converges locally.

The member-facing identity is `@username`. The derived `username_pm@civweave.cc` address is an internal routing slot only. It must not be shown as the user's email address, offered to outside mail clients, or accepted by SMTP. Paid human-visible email is a separate entitlement and account surface.

Realm code may call the canonical API or host a presentation surface. It may not create its own username registry, message database, encryption owner, key format, online relay protocol, or mesh message format. New UI should subscribe to canonical PM events rather than intercepting or cloning transport behavior.

The v1 P-256 ECDH + HKDF + AES-GCM envelope is a baseline transport-privacy layer. Do not describe it as a mature Signal-equivalent protocol until forward secrecy, multi-device fanout, key transparency, prekeys/rotation, and verification UX are implemented and reviewed.

## Optional Starling Guild Collective (migration foundation)

`public/app/shared/starling-collective-v1.mjs` (also re-exported through `lib/starling-collective-v1.mjs`) holds the ported Starling persona registry and pure policies for Guildkeeper founding Intention fallback, human-member-only ratification eligibility, task-offer compatibility, and hosted generation preflight. `public/app/shared/starling-collective-tools-v1.mjs` is the optional tool manifest and task-scoped authorization preflight. `public/app/starling-lounge-v1.mjs` is a Guild-scoped view that reads existing Quest publication data, not a new chat or task owner. Its contract is `docs/contracts/starling-collective-guild-service-v1.md`. This is not a second Guild, Quest, governance, membership, wallet, or inference owner. It does not currently start agents, create/claim tasks, execute spending, or publish Guild updates. Future adapters must delegate execution and persistence to existing capability owners.

## Guild Quest publication

`cloudflare/mobile-guild-edge/src/guild-quest-publications-v1.mjs` owns the portable publication contract. The node-cloud Guild Durable Object and the standalone mobile Guild capacity Durable Object use that same contract with their existing authenticated member authorities and storage. The standalone template keeps this source inside its deploy directory; node-cloud imports it directly.

`public/app/guild-quest-client-v1.js` is the browser transport. It reads existing `CivweaveHostNodeSessionV1` sessions and delegates explicit submission and listing to `/api/node/quests`. The existing Guild Quest Tracker presents that capability. It must not substitute device-local drafts for published Guild records or create a second membership/publication store. Every current member may submit; only the publishing member may revise or withdraw. Publication never activates the local plan, and its allowlist excludes private conversation, wish, profile, evidence, and credentials.

The API and privacy boundaries are defined in `docs/contracts/guild-quest-publication-v1.md` and exercised by `scripts/test-guild-quest-publications-v1.mjs` and `scripts/test-guild-quest-publication-ui-v1.mjs`.

## Radio and review

- Radio owner: `public/app/system-radio-agent-v233.js`
- Track suggestions: `public/app/radio-track-suggestions-v240.js`
- Review owner: `public/app/shared-review-surface-v234.js`

Extend these systems at their owners. Do not attach duplicate launchers or parallel global listeners from realm code.

Review presentation uses `public/app/shared/guide-outcome-scene-v1.js` and its matching stylesheet. `CivweaveGuideOutcomeSceneV1.render/bind/preserve/markFresh` presents a capability-supplied persisted receipt; it cannot accept work, generate plans, publish, issue credentials, or grant rewards. The five callers are the shared Quest review, learning renderer, Cerbanimo engine, FellowFare marketplace, and Anarchadia console. Each retains its authoritative state and names the scope of its outcome. The obsolete Cerbanimo-only scene renderer is removed.

The helper also subscribes once to `civweave:canonical-rewards-changed`. Only `{reason: 'append', persisted: true, grantDelta}` from `cw-reward-ledger-v2.js` can request a celebration, after account/asset/positive-amount checks and bounded receipt deduplication. Startup snapshots and legacy imports carry no delta. The exact installed child delegates this display to the same-origin persistent parent. Replay never repeats a grant. Animation is finite; reduced motion and Lud retain readable state. Scene sound is off by default and enabled only by the visible Sound control for the current document. The presenter owns one lazy WebAudio context and at most three quiet synthesized notes per cue; Stop and page exit cancel playback. No media download, radio control, new preference store or audio prewarm is involved. Deterministic contracts live in `scripts/test-guide-outcome-scene-v1.mjs` and `scripts/test-canonical-reward-grant-notification-v1.mjs`.

Subsystem maps are projections of their existing capability owners: four private Quest lanes with expandable beats and governance kept distinct; Cerbanimo task dependencies and accepted proof; Living School plan-to-credential gates; FellowFare listing-to-fulfillment counts; Anarchadia local requests plus separately read governance vault decisions and prepared packets. Focus controls route to existing actions. A route, selection, replay, or map expansion supplies no authorization to perform the underlying action.

## When a new shared system is genuinely necessary

A new cross-cutting owner requires all of the following in the same PR:

1. an entry in `config/system-ownership.json`;
2. a named canonical control/event/API contract;
3. an explicit list of allowed subscribers or callers;
4. an executable ownership verifier;
5. removal or delegation of any predecessor owner;
6. documentation of the active route graph it affects.

If those artifacts are absent, the correct default is to find and extend an existing system.

The objective is not fewer files for aesthetic reasons. It is one source of behavioral authority, with callers and subscribers orbiting it instead of a swarm of competing event handlers.

## Survival Mode

Canonical assessment and reference policy: public/app/survival/survival-mode.mjs. Mobile caller: public/app/survival/app.mjs. The existing persistent-shell-actions-v1.js owns its launcher; this does not fork guide chat, navigation, or Settings. Offline seed/package: public/app/offline-package-v208.json. Photographs remain local previews, and downloaded passages never prove identification or edibility. The governing contract is docs/contracts/survival-mode-v1.md and its executable test is scripts/test-survival-mode-v1.mjs.


Living School places module quiz receipt scenes next to the active assessment, using its saved attempt ID, score, pass target and criterion feedback. A full Learning Journey completion receipt requires the current unique module set, passed assessments, matching accepted practicum, matching final pass and issued credential. Partial, fallback, demo, foreign and inconsistent records cannot produce that completed-journey receipt. The controller corroborates action-specific receipts against saved state before marking them fresh; storage failure restores the saved state and displays the failure.
