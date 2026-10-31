# Persona Library and Directed Improvisation · v1 (feature branch)

## Ownership and scope

- Core behavior is `public/app/shared/persona-library-v1.mjs`, a provider-neutral **shared capability**. It **does not** own the chat composer, model runtime, world simulator, storage, or verification of the actor.
- The shared chat surface is the only chat/event input owner. Worldweaver remains the sole NPC tool-intent authority; a `worldweaverNpcCommand` is an *unexecuted* command proposal. Use the existing AI Fleet to select actual installed model weights.
- This increment also exports the injected-invoker bridge `public/app/shared/persona-scene-bridge-v1.mjs`. Its `prepareDirectedScene`, `performPersonaTurn`, `runSplitMindTurn` and `queuePersonaActionIntents` work with the existing selected-model adapter and Worldweaver's authenticated dispatch. An opt-in private rehearsal panel is now attached to the existing Worldweaver Performance Studio tool (not a new chat). On-device pack ZIP installation, durable saved sessions, full multiplayer world-state changes and automatic speaker scheduling are **not yet included**. No assertion of a working deployed game is made.

## Pack and privacy

Schema: `civweave.persona-library.v1`.

A persona data package is downloaded separately from model weights. It contains a cast index, role profile, event/action provenance, observed personal memories, voice and body-language examples, source scene references, plus an optional full-text local retrieval index. Keep unpublished manuscript excerpts and author-only revelations in **private author-controlled packages**; never commit them to public Civweave source or silently expose them to shared Guilds. User-visible character bundles must contain only scenes the reader is authorized to receive.

Characters have `modelTier` (deep role reasoning) and `improvTier: '0.8b'` (per-turn live performance). The director requires 4B. Multiple characters can reuse the same installed model weights, sequentially, with separate identities and prompt contexts. A runtime should keep only one or a few models resident subject to real device memory and scheduling. Tier labels are preferences, not guarantees that any particular model or quantization is available.

## 4B / 0.8B hierarchy

1. Author/player submits a scenario, participating characters, world branch, point in story (`stage`), desired beats and optional forbidden events.
2. A deterministic reader restricts source events to character-visible facts at the current story stage. A shared multi-character 4B request contains only facts common to **all** selected actors. `prepareDirectedScene` instead uses **one isolated 4B director call per character** so private memories cannot leak through another character's direction.
3. For each character, 4B returns JSON keyed by character: `characterGoal`, `emotion`, `instructions`, `knownEventIds`, `escalateWhen`, `improvFreedom`. `validateDirectorResponse` rejects event references that actor has not personally witnessed/experienced.
4. A character's 0.8B live improv context includes permanent persona, exemplars, character-visible memory, recent speech and the director's current instructions. Direction expires after four accepted turns by default or when a trusted world change invalidates the brief. The caller advances turns explicitly with `advanceSceneTurn`. An optional Worldweaver snapshot revision prevents stale director output from being published.
5. Model dialogue and action proposals are **not** authoritative canonical records. The local runtime logs a proposal; Worldweaver validates and acknowledges environment changes, including actor permissions. A director/human must review statements that could contradict canon or declare a new consequential fact.
6. On meaningful deviation, write an explicit `what-if` branch ID. Historical canon remains immutable; player changes produce a distinct event log.
7. Save and resume must persist branch ID, story stage, last scene brief revision, per-character awareness and willpower turn counters. Multiple players and NPCs share a trusted world state, **not** a model-written diary.

`availableKnowledge` intentionally does not interpret any character being **mentioned** in a passage as having witnessed that passage. Their self-perception and mistaken beliefs need separately sourced memory objects; do not smuggle private truths into a tiny model's context.

## Character tier proposal

| Character | Deep role | Live improv | Special handling |
| --- | --- | --- | --- |
| Magnus (later Maggie) | 4B | 0.8B | Entire relevant Magnus series stored as retrievable sources; chronology-aware identity and pronouns |
| Landry | 2B | 0.8B | Complete Landry/Mirror source archive, never all in context |
| Delia | 2B | 0.8B | Separate internal voice; same story but distinct knowledge and agency |
| Landry/Delia outward behavior | 0.8B moderator | — | Moderator receives both 2B proposals; bypass requires deterministic willpower spend |
| Jess | 2B | 0.8B | Her scenes plus separately reviewed remembered events; no premature Jess/Raven disclosure |
| Scribble | 2B | 0.8B | Embodied feline motion and humor as well as spoken voice |
| Raven, Colt, Dish | at least 2B | 0.8B | Antagonist minimum, independent motivation and spoiler gates |
| Raj, Maya and other substantial characters | 2B if necessary | 0.8B | Evaluate dramatic load and tests, not just word count |
| Minor NPCs / creatures | 0.8B where suitable | 0.8B | A small personality card, scene props and known-facts refs |
| Humans with direct in-between access | 2B+ as warranted | 0.8B | Optional multi-voice moderator, consent-aware control gate, individual wills |

Willpower: shared 2-point pool by default, +1 per 4 completed simulation turns (capped); direct control costs 1 or more. This is an **example gameplay default**, not a claim about manuscript canon. A visible receipt must record which voice spent points and on what turn. The moderator never spends points and cannot award them.

## Known limitations and integrity

- Structural validation can prevent future or unwitnessed **fact IDs** from entering a prompt, but cannot prove a freeform LLM statement is canon-consistent. Add a 4B fact checker + explicit action-claim extraction and human review for consequential claims before advertising strict continuity.
- Canon source chronology must be curated. A source *mention index* is only retrieval, not a proven witnessed-action ledger.
- No full-plot hidden omniscience: backstage director access and a character's lived knowledge must remain separate.
- An explicit scene change can break the *planned script*; it must not silently alter immutable canon events or assume a choice happened merely because a model narrated it.
- No automatic network inference, cloud consent, downloads or deployment are triggered by import.

## Executable contracts

Run `node --test scripts/test-persona-library-v1.mjs scripts/test-persona-scene-bridge-v1.mjs`. The CI contract tests 4B private instruction isolation, 0.8B structured acting, Worldweaver tool-intent queueing, stale world revision, 2B Landry and 2B Delia with 0.8B moderated expression and authorized willpower bypass. Future tests: director invalidation, multi-user race/conflict, spoiler isolation, Worldweaver tool authorization, deterministic branch replay, memory budgets and 0.8B characterization quality.

## Present bridge protocol

- `prepareDirectedScene({pack,stage,scenario,participants,invokeModel,world?})`: serial 4B JSON director calls using only the designated character's memories. Fails closed on invalid output or concurrent world-state modification.
- `performPersonaTurn({pack,scene,characterId,playerInput,invokeModel})`: one 0.8B JSON acting call, no automatic world write. Returns `speech`, `emote`, action **proposals** and director-refresh flag.
- `queuePersonaActionIntents({world,npcId,actor,pack,characterId,turnResult})`: checks the bound principal, model and persona before invoking canonical `world.dispatch({type:'queue-actions'})`. All intents stay queued until runtime acknowledgment.
- `runSplitMindTurn({pack,scene,invokeModel,willpower,directControl?,authorizeDirectControl?})`: two serial 2B internal calls and a 0.8B outward moderator unless a trusted authority approves a named voice, a deterministic spend succeeds and a receipt is returned. The moderator never invents a spend. World mutations remain separate.
- `advanceSceneTurn(scene,{expectedTurn,worldChanged?})`: compare-and-advance of accepted local turn state. This is **not** an authority to approve an action or increment a multiplayer world.
- The bridge recognizes the existing Civweave selected-model result envelopes `{status:'success',outputJson:...}` and `{outputText:'...'}` as well as OpenAI-compatible chat completion messages. Only structured JSON is accepted. A reported failure aborts.

### Author pack v3 (not in GitHub)

The private author zip stores 51 curated names, 219 indexed source scenes and 1,016 **unverified** grammatical-action candidates. These candidate excerpts are a source review work queue, **not facts, witnessed memories or dialogue training labels**. Ten previously curated event anchors remain the only promoted events. Legacy freeform emotion excerpts are now unreviewed author-only suggestions; only source-approved, story-stage-gated `verifiedEmotes` can be sent to any director or acting model. The manuscript archive is not committed to a public repository. A reader-facing package must be compiled with an explicit publication/spoiler policy and omit unapproved manuscript content.

## Opt-in Performance Studio test surface (draft PR)

At the existing Worldweaver Performance Studio, section 5A imports a **local JSON persona-pack manifest** (extract it from the author-only ZIP, or use the separate JSON download); it never silently imports model weights or the full source shards. Select a story stage, a cast, the scene and a lead speaker. Prepare director briefs first, then preview a single player cue as a character action. This uses the same configured Civweave model-runtime and Creator Suite inference route as the existing screenplay proposal tool.

Currently tested with an explicitly selected Ollama or OpenAI-compatible provider that supports per-request model IDs; the author enters the installed 4B and 0.8B IDs. A source pack is never automatically sent to any cloud model; an existing explicit consent checkbox applies whenever the configured provider leaves the device. Model outputs never modify the approved screenplay, known canon or world state by themselves. The panel is **in-memory and a rehearsal preview**, not a new chat transcript, an automated installation flow, or a claim that a whole D&D session is already implemented. It is shipped only on the feature branch until reviewed and merged.

### Optional split-mind rehearsal control

When Landry and Delia are both selected, the same panel exposes a checked split-mind mode, an installed 2B internal model ID and a visible willpower pool. Each actor receives a separate 2B call; absent a deliberate author-simulated override, their private responses are given to a 0.8B presentation moderator. Selecting a named voice for a *single explicit rehearsal cue* simulates a 1-point direct-control spend. This browser-local test is not authenticated in-world willpower authority; a production multiplayer game must obtain the intervention from its trusted world authority instead. Separate model weights are selected but never automatically installed.\n
## Campaign continuity and private save/load (feature-branch increment)

`public/app/shared/persona-campaign-v1.mjs` is a pure event-ledger/snapshot helper **within** the Persona Library capability, not a second game server, chat owner or multiplayer transport.

- `createPersonaCampaign` binds a cast, initial stage, rights-controlled source pack identity and immutable `what-if:` branch name to an owner. It never writes back to manuscript canon.
- `applyCampaignEvent` requires an externally authenticated actor and an explicit caller-owned authorizer on **every** transition; optimistic `expectedRevision` rejects stale player updates. The local lab uses a local-only author-simulation adapter; it is not a Guild credential.
- Player seats and NPC model principal bindings are explicit. NPC speech/actions remain `pending` until the **trusted runtime**, not a model or other player, sends a receipt. The event history is append-only: resolutions do not rewrite original proposals.
- A rehearsal preview records its player cue, character response and proposed actions with `status: 'unexecuted'`. It cannot imply world success or authorize NPC tools.
- Willpower is deterministic and linked to accepted turn counters. It is spent by an explicitly authorized author/runtime event rather than by instructions inside model text.
- `exportCampaignSnapshot` and `importCampaignSnapshot` support small, explicit JSON private saves. Imports require the same `packId` and pack version; they are **always untrusted** until validated by an authenticated session authority. Never merge a local import into a multiplayer world on the basis of these checks alone. A production multiplayer implementation needs signed/revisioned mesh objects, actor provenance and trusted world outcomes.
- The Performance Studio page adds a Start new / Export / Restore control, a read-only recent-turn history and per-session revision indicators. It does not silently write personal dialogue or unpublished prose to localStorage, public GitHub, mesh, or cloud.
- Reopening a save requires a new 4B director brief. Private prompts are deliberately excluded from the exported snapshot, reducing the risk of leaking a character's author-only knowledge in a shared session file.
- These controls are exposed only in the existing optional Performance Studio rehearsal surface and do not duplicate Civweave's canonical chat input. Running the campaign **inside the unified guide-chat composer**, genuine multi-device syncing and model-weight installation remain separate integration gates.
- Executable contracts: `scripts/test-persona-campaign-v1.mjs`, `scripts/test-persona-performance-lab-v1.mjs` and the existing Persona Library/Worldweaver tests.

### Planned multiplayer authority boundary

The future mesh/session owner must verify the player's Passport and seat assignment, enforce one revision per accepted change, authenticate each NPC pilot using the canonical model principal, and confirm action receipts through Worldweaver's runtime adapter. A browser file import is suitable for private rehearsal, **not** for shared authoritative state. Private character memories remain separately access controlled; a player-visible public timeline contains only dialog/actions already exposed in the scene.

### Improvised deviation handling (feature-branch control)

The rehearsal panel now offers a manual **player breaks the planned scene** checkbox. In addition, a structured 0.8B actor response may return `requestDirection:true`. Either trigger expires the current temporary 4B instruction block after accepting that preview turn. The next cue cannot reuse the old brief; the author must explicitly prepare a new 4B pass.

The new director pass receives only the recent player-visible rehearsal exchanges, explicitly marked as *unverified dialogue, not canon*. It may adapt motives, intentions, immediate environment suggestions and likely reactions, but cannot declare player world actions successful. The old story remains immutable; even on a what-if branch, actual world modifications require trusted Worldweaver acknowledgments. The refresh uses the already configured selected model and honors the same remote-inference consent boundary as other requests.

## Canonical chat integration — opt-in Cast mode

`public/app/guide-chat-surface-v350.js` retains **the only** chat composer, input event owner, saved transcript and response lifecycle. Its small **Cast** button lazily attaches `persona-chat-controls-v1.mjs`, which lets an author explicitly import a matching cast manifest and private campaign JSON, select the performer and installed model IDs, activate/deactivate the session, and export a revised save.

- The newly added `persona-chat-turn-v1.mjs` emits Civweave's ordinary assistant-result packet. It never adds its own transcript, message composer, hidden session poller, chat route or inference engine.
- When Cast is **off**, all five guide themes and native/Ollama fast paths keep their existing behavior. When Cast is **on**, only the **Civweave/Weaveling** theme's user-submitted messages take the persona route; switching to another theme does not trigger persona inference or move private campaign context.
- The 4B director receives the named performer's personally available memories and a bounded excerpt of previous **public rehearsal dialogue**. It refreshes upon scene expiry or an explicit player-deviation request, without promoting improvised lines to canon. The 0.8B turn becomes a local `rehearsal-preview` ledger event; action intents remain unexecuted.
- Each role model ID must identify an installed endpoint model. The existing Creator Suite `runCodeInference` and selected Civweave provider remain responsible for inference. No automatic installation, second model runtime, or silent local/cloud fallback is introduced. If the provider leaves the device, the user must opt in *per turn*; consent resets after the request.
- The private author-only browser preview is **not** a multiplayer identity: its local owner string comes from the explicitly imported save and is used only for user-owned file rehearsal. The single shared guide transcript may retain the character dialogue after the imported source pack is cleared, consistent with ordinary saved chat.
- Split-mind 2B/2B/0.8B rehearsal remains available in the Performance Studio. The embedded chat currently supports a single selected 0.8B speaking persona at a time, rather than claiming the full split-mind presentation system has been ported to the chat composer.

## Authenticated multiplayer gateway — integration-ready contract, not a live endpoint

`public/app/shared/persona-multiplayer-gateway-v1.mjs` provides `createPersonaMultiplayerGateway({authenticate,load,writeIfRevision,authorize})`.

- The authenticated server/mesh host supplies a **trusted** `authenticate(request)` implementation, authoritative `load(campaignId)`, and atomic `writeIfRevision(id,expectedRevision,nextState)` implementation. Client-supplied `verified`, actor ID, role, and model name are ignored for authorization.
- Only the authenticated owner or assigned human players can read a session. Unseated clients cannot learn its unpublished dialogue. Nonowners can submit only their own player cues.
- Models may propose for an explicitly bound pilot identity. Only a trusted runtime principal may resolve a model proposal into an acknowledged world outcome. Campaign changes retain immutable original events and exact revision checks; stale or conflicting updates fail rather than silently overwrite each other.
- **This is a provider-neutral backend adapter and executable test contract.** It does not open an HTTP route, implement a cryptographic identity provider, connect to an actual shared server, or guarantee persistent cross-device state by itself. Production still requires wiring to Civweave's existing Passport/Guild authentication, mesh persistence, world adapters, and user access controls. Do not expose this module as an unauthenticated API or call browser-local `verified:true` identity proof.
- Security contracts: `scripts/test-persona-multiplayer-gateway-v1.mjs`, `scripts/test-persona-chat-turn-v1.mjs`, and `scripts/test-persona-chat-surface-v1.mjs`.

All hidden/unpublished book contents remain in local author-only packages rather than the public Civweave repository.

### Split-mind private Cast chat

When the imported campaign contains both `landry` and `delia`, the speaker menu offers `Landry + Delia (split mind)`. This path calls the configured 4B director individually for both perspectives, then the two independently prompted 2B internal voices; the 0.8B outward moderator decides what becomes player-visible unless the author explicitly selects a named voice to spend one point of campaign willpower. The deterministic campaign ledger records the spend before the outward preview. The model cannot grant itself points or confirm world actions, and private internal responses are not stored in the shared chat transcript.

The Cast control also offers a one-cue *break the planned scene* checkbox. This expires the current 4B brief after the action and requires renewed direction next turn; the flag never attests a world mutation.

### Trusted action receipts

The multiplayer gateway's `verifyWorldReceipt({worldReceiptId,proposal,campaignId,actor,expectedRevision})` callback must independently verify an actual completed Worldweaver action before a `resolve-proposal/outcome=succeeded` event. A missing verifier, mismatch or reused receipt is rejected. Runtime identity alone does not establish that a particular action occurred. A real deployment must connect this verification to its protected Worldweaver record/adapter and enforce one-time receipt use atomically.

## Simultaneous Landry + Delia overrides (2026-10-31 refinement)

Landry and Delia share a willpower pool but each has their own direct-control request. In either Cast chat or Worldweaver rehearsal, the **Both override** choice submits **two author-approved spends in the same turn** (one point each by default). The two independent 2B internal performers then both produce player-visible outward speech, attributed to Landry and Delia separately. The 0.8B moderator is bypassed for that turn only. The implementation does **not** treat the second voice as silent, overwrite its line with the first, or collapse attribution into a single narrator.

- No override: existing 0.8B moderator speaks outwardly.
- One override: one named 2B voice speaks outwardly, spending one point. The other remains internal.
- Both override: two individually attributed outward utterances appear in narrative cast order, using two separate spend receipts. Player-visible dialogue is rendered as Landry and Delia's respective speech with separate gestures.
- If fewer than two points are available, **both** simultaneous requests fail before inference and before any spend can be committed. Duplicate voices, invalid costs, or unauthorized requests also fail without a partial override.
- The deterministic campaign ledger retains each spend as an append-only `willpower-spend` event, then one `rehearsal-preview` record with `spokenTurns: [{characterId,speech,emote},...]`. Export/import preserves individual speaker identity; these are **unexecuted** simulated performances, not canonical events or server-certified body actions.
- AI-written actions remain proposals, bounded to the existing Worldweaver tool-intent gate. Simultaneous speech is not equivalent to independent simultaneous world control.
- New regression tests: `scripts/test-persona-dual-override-v1.mjs`.

### Direct new-campaign creation in Cast chat

The Cast panel can read a locally selected persona manifest, choose 1–12 character IDs, provide a numbered story stage and scenario, and **start a private what-if campaign without importing an existing save**. An explicit Activate action starts model-backed play in the same canonical Weaveling chat. The campaign is in memory until the user exports its JSON; no new app-wide chat store, implicit publication or authenticated multiplayer claim is introduced. A matching campaign JSON can still be restored via the existing controls.

## Authenticated Guild campaign service (2026-10-31 integration pass)

Persona campaigns now have a **real, testable** authenticated Guild HTTP route in the existing node-cloud Worker: `/api/node/persona-campaigns` (POST create), `/api/node/persona-campaigns/snapshot?campaignId=…` (GET), and `/api/node/persona-campaigns/dispatch` (POST command + expected revision). The route runs through `server-ai-entry-v6.mjs` beneath v7 and reuses its verified `authenticatedMember()` session. Internal transport is isolated behind a domain-separated secret and an existing Guild node Durable Object. The authoritative store is transactional `node.state.storage`, scoped by node ID and room ID; no public object-mesh publication occurs.

`guild-persona-campaign-v1.mjs` creates bounded private rooms with at most 12 selected characters and 20 rooms per owner. It does not accept/store source manuscript prose, private events, secret model prompts or a full author persona pack. The stored record binds the requested `packId` and `packVersion` as **user-supplied identifiers, not a canonical manuscript attestation**. Guild auth supplies the member identity (never untrusted request actor fields), owners may assign seats, and only those seated in the room may read or submit player cues. Compare-and-swap changes run atomically inside the Guild's transactional storage.

`guild-persona-client-v1.mjs` resolves the Guild from the existing `CivweaveHostNodeSessionV1` and `CivweaveGuildQuestsV1` session owners, sends bearer-authenticated HTTPS requests with no credentials persistence, and refuses an automatic write retry on a 409 conflict. It requires explicit sharing confirmation before creating a hosted room. Only selected cast **IDs, display names, numbered stage, title and scenario** are uploaded. Hosted player cues are stored as visible authenticated turn events and are **not** treated as model responses or world-action receipts.

The single canonical Weaveling Cast panel now supports Host in Guild, Join assigned seat, Refresh shared room, owner-only seat assignment and a read-only event timeline, in addition to its local improvisation mode. An invited Guild member needs a valid Guild session and assigned room seat, not the author's private manuscript pack. Hosting never silently migrates earlier private local rehearsal history.

### Worldweaver action proof boundary

`persona-worldweaver-receipt-v1.mjs` provides an independent `verifyWorldReceipt` callback for `createPersonaMultiplayerGateway`. A trusted world host supplies the actual `world.snapshot()` and its private proposal-to-intent binding. Success requires that the exact bound NPC belongs to the correct instance and persona/pilot and that every corresponding queued NPC action matches tool/args and has a **succeeded** runtime outcome with a resolution timestamp. Browser/model supplied receipts, merely queued intents, wrong pilots, mismatched tools, and failed actions are rejected.

**Not yet connected:** No production Worldweaver simulation host has been attached to these campaign rooms; the gateway does not call the model or execute NPC actions automatically. It does not distribute the author's private cast data to Guild members. NPC inference, simulator execution, trusted proposal-binding persistence, live cross-device push events (instead of manual refresh), and installed-device end-to-end testing remain deployment gates. The model proposal and runtime resolution APIs are intentionally **not exposed** to a human Bearer-token endpoint.

## Verified Guild logical-speech runtime and automatic synchronization

In the current server-backed development branch, a member with a room seat can submit a bounded, **untrusted NPC dialogue draft**, sourced manually or from their chosen Civweave local 4B/0.8B inference route. The Guild owner must explicitly approve the draft. Only **speak** with a bounded string argument can execute on this initial logical simulator; movement, geometry changes, screen casts, Quest outcomes, payments and external side effects are intentionally rejected until trusted implementations exist.

Approval occurs within the existing Guild Durable Object `storage.transaction`: it reconstitutes `createWorldweaver()` using its persisted authoritative snapshot, binds an internal pilot to the named cast character, queues one speak action through the sole Worldweaver owner, acknowledges that **logical speech** via its trusted runtime branch, verifies the proposal-to-intent binding, and persists the Worldweaver snapshot, campaign ledger and used draft together. The returned `worldReceiptId` proves a simulated transcript action, **not** audio playback, physical movement or a remotely provisioned 3D world. Human-created drafts are explicitly labeled `human-reviewed-dialogue`, not presented as independently authenticated model output.

The Guild host can also review one Landry and one Delia draft using **Approve Both**. The server checks that two distinct drafts exist and that the shared pool contains at least two points, spends one point per voice, executes both accepted simulated speech intents and persists both receipts in the **same** transaction. Insufficient points, duplicate voices, bad draft IDs or an invalid tool fail the entire transaction without suppressing one voice or partially spending willpower.

Both the central Node Cloud's verified member sessions and the standalone **mobile-owned Guild Cloud** capacity sessions route to this same domain service. The mobile-owned Guild uses its verified `guildId` for storage (its three starter nodes share a capacity Durable Object), so an invited member on another starter node can read and act within the same Guild room. Independent Node Cloud Durable Objects remain node-scoped unless a verified Guild shared store is configured.

The browser Cast panel automatically refreshes authenticated shared-room snapshots every 4 seconds **only while the session is active and visible**. It immediately stops polling when leaving the room, on auth failure or on an invisible tab. This is bounded polling, **not** WebSocket push or realtime 3D movement. A 409 from a write never causes automatic replay; refreshing is a separate read. The private source pack stays on the model operator's own device, and initial Guild hosting requires a separate explicit sharing checkbox.

The PWA shell now includes the optional Persona modules for offline rehearsal, without adding them to the required boot-shell asset set. Offline Guild writes cannot silently succeed, and an installed-device hardware smoke test is still required before production.

Tests: `scripts/test-guild-persona-transport-v1.mjs`, `scripts/test-mobile-guild-persona-transport-v1.mjs`, `scripts/test-guild-persona-client-v1.mjs`, `scripts/test-persona-worldweaver-receipt-v1.mjs` and `scripts/test-persona-chat-surface-v1.mjs`.

## 3D Worldweaver body motion (2026-10-31 continuation)

`worldweaver-persona-motion-v1.mjs` defines a **server-authoritative**, 64×64-metre, Z-up 3D rehearsal stage, with floor, two fixed obstacles and distinct per-character capsule-like stand-ins (body and head cylinders). It exports one OpenSimulator-compatible geometry snapshot. Both the existing Worldweaver 3D preview and 2D polygon/map utilities use those exact object transforms. **A three-dimensional marker is a stand-in, not a rigged/skeletal avatar.**

An authenticated Guild player assigned to a cast role can POST `/api/node/persona-campaigns/move-draft` with one target `{x,y,z:0}`. The kinematic solver checks world revision, a 2.5-metre maximum movement per approval, the stage boundaries, fixed pillars and other actor capsules using a 10-cm stepped sweep. It rejects free flight, arbitrary teleports, malformed coordinates and crossing through other actors. The move **does not occur when proposed**. Only the Guild room owner can POST `/api/node/persona-campaigns/move-approve` with the reviewed draft ID and expected room revision.

Within the existing Guild Durable Object transaction, `guild-persona-motion-v1.mjs` checks the current scene revision again, issues a typed `move` action through the existing `createWorldweaver` pilot/intent owner, advances the authoritative 3D body position through the trusted kinematic solver, reports the succeeded runtime intent, verifies its proposal/intent binding, and saves **the movement, Worldweaver state, campaign event ledger, receipt, and deleted draft atomically**. A conflicting Guild member turn, stale scene, invalid permission or blocked move cannot partially commit coordinates. Legacy speak-only NPC rigs can be supplemented by movement-capable rigs without replacing canonical actor identities.

The canonical Weaveling Cast panel now includes the same Worldweaver 3D canvas (orbit/zoom/selection), reads the region geometry from authenticated `snapshot.motion.region`, shows server-owned actor coordinates and movement revision, and provides target-X/target-Y controls, proposed movement review and owner approval. A 4-second, visibility-scoped authenticated room read refreshes the canvas on other devices. This is a **working logical 3D kinematic simulator**, not OpenSimulator-hosted avatar locomotion, physics-engine dynamics, real-world motor actuation or an independently networked OpenSim 3D viewer. It does not replace Firestorm.

### Native OpenSimulator connector boundary

`worldweaver-opensim-motion-bridge-v1.mjs` defines the native execution verification interface, but it is not enabled by default. To activate it, an operator must supply a **real** version-pinned OpenSimulator region-module service behind private transport, per-region scope/permission checks, strict rate limits, a server-held authentication key and an independent receipt attestation verifier. The native region module must return a changed authoritative snapshot with `source:'opensim-region-module'`, a strictly increasing revision, the same instance/object identity, and an observed new 3D position agreeing with the reviewed target. Only then may a trusted server call `report-action` for the native move. Failure after an outbound move attempt is **indeterminate** until the region is re-read; no automatic retries or speculative successful receipts are allowed.

OpenSimulator region modules follow `INonSharedRegionModule`/`ISharedRegionModule` and may access the authoritative scene (see [OpenSimulator RegionModules documentation](https://opensimulator.dev/wiki/RegionModules)); moving in-world prim linksets involves the OpenSim scene object's `AbsolutePosition` setter (see [OpenSimulator SceneObjectGroup source](https://github.com/opensim/opensim/blob/master/OpenSim/Region/Framework/Scenes/SceneObjectGroup.cs)). This project does **not** currently contain a deployed, permissioned native region module, credentials, object ownership binding, or attached Firestorm client, so the server may not falsely claim that such native motion occurred.

Contracts/test commands:
`node --test scripts/test-worldweaver-persona-motion-v1.mjs scripts/test-worldweaver-opensim-motion-bridge-v1.mjs scripts/test-guild-persona-transport-v1.mjs scripts/test-mobile-guild-persona-transport-v1.mjs`.

Release gates include green branch CI, a real two-device Guild session smoke test, a provisioned OpenSim region if native movement is desired, and native adapter attestation using independently observed region positions.
