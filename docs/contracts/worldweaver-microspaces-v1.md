# Worldweaver microspaces and NPC pilots · v1 contract

## Purpose
Worldweaver is one shared, local-first **manifest and intent** capability. It is not a sixth realm, replacement chat, Second Life emulator, or alternate authority for learning, Quests, commerce, or voting.

Canonical owner: `public/app/shared/worldweaver-core-v1.mjs` (`createWorldweaver`, `SPACE_GUIDES`, `NPC_TOOLS`).
Executable contract: `scripts/test-worldweaver-core-v1.mjs`.
The local planning utility is `/app/worldweaver/index.html`; its Worlds launcher belongs to the existing shared utility owner. The five installed system routes are unchanged. This initial module is an integration-ready foundation and does not yet start an OpenSimulator server or install a browser viewer.

## Four space templates

| Guide / theme | Space kind | Intended uses | Canonical record linked, never copied into Worldweaver |
| --- | --- | --- | --- |
| Moss / Living School | `learning-workshop` | Mini learning experiences, explanation/practice/assessment stations, metaphor workshops | `learning-path` in Living School |
| Kamiya / Cerbanimo | `task-training` | Tool simulations, rehearsal, hands-on skill and task demonstrations | `quest-task` in Cerbanimo |
| Rook / FellowFare | `creator-shop` | Standalone or Guild Map-linked merchandise and creator demonstrations | `fellowfare-listing` in FellowFare |
| Merlin / Anarchadia | `convention` | Conventions with speaker turns, debates, governance ballot entry points | `governance-ballot` in Anarchadia |

A mini-instance is a **logical room/world manifest** with its own lifecycle. Creating it does not allocate a host, consume AI inference, create a purchasable product, or claim that an external 3D world exists.

`scope: 'standalone'` makes a portable private/shareable manifest. `scope: 'guild-map'` includes an existing, validated Guild ID and is only an *intent to link*; it does not publish a map marker. Mapping remains with the Guild Map owner. The four kinds share the same engine and can coexist in one grid or be rendered as mini standalone rooms.

### Lifecycle
`draft -> provision-requested -> live`. Only an authenticated human can explicitly request provisioning in this first increment. Only a trusted runtime can confirm `provisioned` with a backend (`local-renderer`, `opensim`, `overte`, or `genie`) and an opaque world reference. Provider availability is not implied by listing the backend name.

Future adaptations can support bounded preauthorized free/local model provisioning, explicit budget checks and sandboxed ephemeral worlds, with their own executable authorizer policies.

## Objects and scripts

`add-station` stores declarative experience content, not executable HTML, JavaScript, or LSL. Future renderers will translate reviewed station definitions into accessible HTML, 2D interactions, or in-world prims/scripts. No arbitrary model-produced script can run solely because it appears in a station.

Shop entries reference existing FellowFare listing IDs; purchase, fees, escrow, fulfillment, taxation and payouts stay entirely in FellowFare's validated commerce flow. No model-side checkout or secret API access.

Conventions can store attributed debate turns. Linked ballots are *entry points* to the Anarchadia governance owner. Worldweaver contains no `cast-vote`, ballot ledger, tally, quorum, vote delegation, or permission-to-vote operation. Human and model speech remain visibly distinguishable; model speakers cannot impersonate human participants or cast human votes.

## Model-rigged NPCs

A model can **rig itself** when its authenticated model identity matches the NPC's requested model ID and the external capability authorizer grants `rig-npc`. Humans may also configure a pilot and bind an authenticated model principal to it.

Each NPC has:
- Character name, optional appearance asset reference and role-specific space.
- `pilotPrompt`: bounded, saved *character instruction*, applied **below** platform safety instructions, shared runtime policy, tool permissions, and the active user's higher-priority commands. It is not a way to overwrite the model's real system instructions.
- `modelId`, `pilotPrincipalId` and approved capability list.
- Bounded proposal queue: 1–3 structured actions per turn (such as observe, move, speak, demonstrate, build, present or facilitate).
- Tool outcomes that only the authenticated world-runtime adapter can acknowledge. The model may never mark its own build or intervention successful.

NPCs do not gain `purchase`, `cast-vote`, `publish`, `admin`, `execute-code` or unrestricted `http` abilities. A `build` intent is a constrained request for a provider adapter to validate and execute; it is not arbitrary script execution. Character memories and prompt scopes must remain separated across users, Guilds and world instances unless the relevant owner explicitly authorizes a transfer.

## Security, persistence, and provider independence

`createWorldweaver({authorize, id, clock, initialState})` requires an externally provided **trusted authorization function** for every command. It returns `dispatch(command, authenticatedActor)` and `snapshot()`. The module's actor records are not authentication; never let a browser/model supply its own `verified` flag in production. A service layer must enforce ownership, delegation, exact Guild authority, permission scopes, budgets, rate limits, instance limits, script inspection and runtime leases. A future mesh writer should seal canonical snapshots as signed/revisioned objects, preserve conflicting revisions, and verify authorship on import.

Worldweaver only stages reference records and tool intents. Downstream bridges use the existing owner for each action:
- Living School: assessment, module completion and credential evidence
- Cerbanimo: task, proof, accepted progress and rewards
- FellowFare: listings, inventory and financial settlement
- Anarchadia: amendments, ballots, vote integrity and outcomes
- Guild Map: linked locations and navigation
- Starling / local AI: inference via the canonical selected-model runtime, with bounded local resource guards

Provider adapters (OpenSimulator, local 2D/WebGL, future Genie or Overte) may render the same manifest. OpenSimulator `osNpc*` and OSSL are privilege-bearing and should be enabled for trusted operators only; do not expose RemoteAdmin or privileged script functions publicly. Provider failures cannot falsify tool success.

## Next implementation gates

1. Create a signed local-object-mesh persistence adapter and canonical, authenticated permission checks.
2. Implement one local renderer with accessible small workshops, displays, debate halls and portable shop previews.
3. Add the OpenSimulator adapter with constrained object fabrication, avatar/NPC creation, tool outcome confirmations, snapshots and rollback.
4. Register the shared capability with the existing chat tool dispatcher and provide guide-specific templates **without** creating additional guide chats.
5. Wire real references to existing Learning School, Cerbanimo, FellowFare, Anarchadia and Guild Map UIs. Keep human confirmation before spending, global publication and binding governance.
6. Test multiplayer authorization, griefing/impersonation resistance, rate and resource budgets, long-running NPC behavior, and recovery after reconnect.

The feature branch is not a production deployment. Test all host changes on staging before a production merge.

## Visual self-design and Starling avatar pilots (feature-branch increment)

The authoritative Starling team remains `public/app/shared/starling-collective-v1.mjs`: it defines Aphra, Jae, Anthony, Rosa, Sana, Kit, Farah and Kami. `worldweaver-starling-bridge-v1.mjs` **reads** that existing registry and maps each persona to its packaged `/app/assets/starling/<id>.svg` portrait. No second Starling character catalog is created; the optional `personaRef` binds an NPC to the authenticated Starling pilot identity. These existing SVG assets are reference art, not directly machine-understood images.

`rasterizeTrustedAvatar` in `worldweaver-avatar-v1.mjs` converts the verified, packaged SVG portrait to a bounded PNG data URI in the user's browser *on demand*. This step is never automatic at boot and never downloads remote artwork. `avatarVisualRequest` produces provider-neutral image/text input for an actually vision-capable selected model; otherwise it explicitly offers a text-description fallback rather than pretending a model saw an image.

`proposeAvatarViaModel` in `worldweaver-avatar-pilot-v1.mjs` hands that request to the existing selected-model invoker **supplied by the caller**, checks exact model/persona binding, requires image bytes when vision is claimed, validates returned structured JSON, and dispatches a pending `propose-avatar` record to the one canonical Worldweaver core. It does not own inference scheduling or silently spend cloud neurons. Failed inference cannot overwrite the active avatar. Model-tool and guide integration remains pending.

The initial body plan is procedural **2D**, not a claim that an OpenSimulator skeleton or 3D mesh was generated. It supports up to 24 primitive body parts in a noncyclic hierarchy, 12 bounded rotation poses (including idle), and 16 event-triggered `pose`/`say` behaviors. The pure `renderAvatarSvg` and `avatarEventSteps` preview and interpret this declarative plan without executing scripts. Each model may propose only for an NPC bound to its verified principal/model/persona. Human review is required before a trusted world renderer can report `apply-avatar`; the previously applied avatar stays active during edits and rejected changes. More general 3D skeletal binding and approved LSL adapters require a later capability implementation and independent security checks.

The approved actor identity, authorizer and renderer are trusted external dependencies, **not booleans supplied by a model**. Avatar image input must be consented before using hosted vision inference. Neither a model-generated appearance nor an in-world script grants commerce, publication, voting, or network permissions.


## Standalone avatar preview (no production integration)

`public/app/tools/worldweaver-avatar-lab.html` and `worldweaver-avatar-lab-v1.mjs` expose an optional, directly loadable browser prototype. They read the canonical Starling personas and demonstrate local portrait display, image rasterization, declarative body previews, event-driven pose changes, and textual dialogue. The editable plan is explicitly a **preview** and does not impersonate a model, send hosted requests, persist authoritative rig state, render 3D, or provision a world. Its developer/browser route has no automatic navigation registration and does not create a new shared interaction owner. The actual runtime can use `proposeAvatarViaModel` only after it supplies a trusted authenticated model adapter.\n
## World screens and presentations

Canonical screen media grammar and renderer: `public/app/shared/worldweaver-screen-v1.mjs`. The shared Worldweaver owner alone manages screen manifests and presentation revision history. This is a *logical screen* object suitable for the workshop, task training, shop, convention or Starling room; rendering in a live 3D scene requires a provider adapter.

### Screen lifecycle
- `create-screen` takes a space ID, title and 16:9, 4:3, square or portrait layout. A space has at most 12 screen manifests.
- `cast-screen` and `clear-screen` are direct **authenticated human** actions, never commands an LLM can execute outside its own authorized tool queue.
- A bound NPC must receive `cast-screen` and/or `clear-screen` in its `capabilities`, then `queue-actions` with a 1–3 action batch. Cast intent arguments include `screenId` and normalized `content`; cross-instance casts are rejected.
- A trusted renderer confirms or fails the action with `report-action`. Only a *successful* acknowledgement changes `screen.current`; stale screen revisions prevent out-of-order model casts from replacing newer human content.
- An NPC-suggested external HTTPS image, video or website source enters `review-required` and must receive `approve-cast` from an authenticated human before execution. `reject-cast` preserves previous content. Future trusted content galleries may opt into a separately authenticated allowed-media list.
- Screen history is bounded; screen content captures its presenter type and principal, and is not falsely recorded as human-created when a model presents.

### Content
Each presentation contains:
```json
{"kind":"image","source":{"assetId":"creator:generated-or-uploaded-id"},"title":"Design showcase","alt":"Illustration preview"}
```
```json
{"kind":"video","source":{"assetId":"library:reviewed-video-id"},"title":"Process demonstration"}
```
```json
{"kind":"website","source":{"url":"https://example.org/guide"},"title":"Research source"}
```
An `assetId` is an opaque reference. The actual bytes must be looked up by a trusted permission-checking resolver belonging to the existing Creator Suite or library. Worldweaver does not store blobs or generate media. HTTPS URLs reject credentials, local/private address literals, nonstandard ports, fragments and dangerous schemes. URLs are never server-fetched by Worldweaver. External images/videos can still contact their provider from the *viewer's browser* and must be treated as third-party media.

### Presentation
`renderWorldScreen` uses native `img`, user-controlled `video`, and sandboxed `iframe`. Websites have `sandbox="allow-scripts allow-forms"`, **not** `allow-same-origin`, with no granted device capabilities and `referrerPolicy="no-referrer"`. No user/model HTML or JavaScript is inserted in the world. Some sites cannot be framed because of CSP/X-Frame-Options; the screen provides an explicit **Open website** link rather than bypassing those protections. Browser autoplay is not assumed.

The isolated `/app/tools/worldweaver-screen-lab.html` can load a user-selected PNG/JPEG/WebP, an MP4/WebM video (max 50 MB each), generate a local demonstration PNG slide, accept an HTTPS link, and preview the cast. Its local object URLs are session-scoped. Its model actor and trusted renderer are **simulations** demonstrating permissions, not authenticated Guild participants or live LLMs. No actual model inference, provider deployment, shared Guild sync, live 3D screen or creator-asset storage integration is claimed.

The new screen cases run under `npm run test:worldweaver` and `scripts/test-worldweaver-screens-v1.mjs`. A real installation must use signed mesh state, authenticated identity and proper asset checks before enabling remote model-driven casting.

## October 30, 2026 lab-hardening pass

The optional Avatar Lab now auto-saves only validated rigs under per-persona local browser storage keys. The portable import/export bundle is `civweave.worldweaver.avatar-lab.v1` and is restricted to 32 KB. Invalid text does not overwrite the last valid preview; the user can undo up to 12 earlier validated states, restore the canonical starter, or export a valid plan. Storage denial is explicitly reported and never treated as persistence success. The appearance image reference stays on-device unless a separate model call is explicitly initiated.

The optional Screen Lab now checks media MIME against **magic bytes**, enforces decoded image dimensions (8192-pixel maximum edge and 32 megapixels) and a five-minute finite video duration, caps images at 12 MiB and videos at 50 MiB, and avoids SVG file uploads. It uses a reference-aware object URL registry that preserves files still displayed or queued, revokes unused URLs, and stops/unloads media on a screen change. User requests expose approval and cancellation controls. All lab identities remain simulated and cannot be transplanted into a real Worldweaver host as an authentication implementation.

The canonical Worldweaver manifest now supports an authenticated-human `cancel-cast` transition on pending `cast-screen` / `clear-screen` intents. A canceled action cannot later be acknowledged by the trusted runtime. Original authorizer and external instance permission checks remain required.

Regression tests: `scripts/test-worldweaver-labs-hardening-v1.mjs`, included in `npm run test:worldweaver`. These are deterministic module tests and CI syntax checks. They do **not** substitute for on-device mobile/browser testing, external website CSP behavior, actual multiplayer permissions, or a live OpenSimulator renderer.

## Lightweight 2D World Map — shared authoritative projection

The portable `public/app/shared/worldweaver-map-2d-v1.mjs` projects the **same authorized Worldweaver state** used by future 3D adapters into DOM-only navigable space, screen, NPC and station objects. It does not fork world simulation state or instantiate a second client-side agent runtime. `projectWorld2D` returns a bounded node graph with revision, entity types, normalized map positions and explicit `geometryStatus` indicating schematic fallback or geometry furnished by a trusted provider. Historical building coordinates are **not** inferred from the demonstrator. Guild-group visibility is conservative; deployed callers must filter object and space access before projecting and enforce permissions on any returned interaction request.

`observeWorld2D` emits a compact model-accessible entity/action observation without avatar pilot prompts, internal instructions or original station text. It never grants `cast-screen`, `move`, external access or any other tool capability; the canonical tool dispatcher and real-world renderer must continue to authorize every action. `renderWorldMap2D` produces accessible button-based HTML without WebGL/WebGPU and offers an explicit `onActivate` handoff to the host, not automatic privileged movement or commerce. `createWorldMap2DView` accepts `getSnapshot` and host-supplied `subscribe` hooks to refresh when a *trusted* canonical state stream changes. The local demos update synchronously after world dispatch; cross-device real-time sync is not yet installed.

**Recursive screen rule:** `kind:'civweave'` with `source:{worldRef:'<same-instance-id>'}` is a native in-world application screen, **not a third-party website iframe**. The host renders its live 2D Worldweaver projection. A Weave screen appearing inside that map is shown as a `Civweave ↳ 2D` portal/button rather than recursively rendering the application again. This intentionally prevents the infinitely nested home-screen failure while retaining inspect/navigation request callbacks. Content may only address its enclosing instance; cross-instance model or human casts are rejected at the canonical Worldweaver owner.

Standalone demo: `/app/tools/worldweaver-map-lab.html`. It creates four explicitly **illustrative** guild rooms from the same Worldweaver manifest (Learning Hall, Quest Forge, Creator Arcade, Convention Hall), allows navigation and in-room app casting, and prints model-observation JSON. The identities and provider confirmations are lab simulations. It does *not* claim the historical visual commune layout, a deployed 3D client, actual browser cross-tab synchronization, or real inference.

Tests: `scripts/test-worldweaver-map-2d-v1.mjs` with scope isolation, recursive screen termination, revision consistency, bad world references, model-safe observation, trusted geometry and subscriber lifecycle.

## OpenSimulator region geometry and 3D/2D polygon parity (October 2026)

The **authoritative multiplayer world** is planned for an OpenSimulator region/grid. OpenSimulator's SceneObjectGroups contain linked prims (SceneObjectParts) with positions, rotations and shapes; the grid persists the world. The browser implementation is a compatible **geometry preview and low-end viewer**, not a native OpenSimulator viewer protocol or a separately authoritative universe.

- **Bridge input:** `public/app/shared/worldweaver-opensim-geometry-v1.mjs` accepts a tightly validated `civweave.opensim-region-geometry.v1` payload exported by an authenticated, permission-filtered OpenSim region module. Coordinates use meters and OpenSim-style axes X east, Y north, Z up. A SceneObjectGroup has absolute position and group quaternion; prims have relative offsets, rotations and scales. Types in this first pass: `box`, `cylinder`, or `mesh` with actual supplied local vertices and triangle indices. Other prim sculpt types need an approved triangulation adapter or explicit approximate collision/footprint bounds; do not silently call them exact.
- **One transform pass:** scale each local part vertex; rotate by local part quaternion; translate by local offset; rotate by group quaternion; translate by group position. Output world-space triangles with persistent source object ID, prim ID and face ID. No separate 2D shapes are hand-authored.
- **3D preview:** `public/app/shared/worldweaver-3d-preview-v1.mjs` draws those same triangles into a simple perspective canvas with orbit/zoom/selection. This preview is not Firestorm, OpenSim rendering, a physics client or a new server.
- **2D polygon map:** `projectOpenSimPolygons3Dto2D` projects every nonvertical 3D face into the XY map and computes a convex footprint per prim/linkset as a *conservative envelope*, preserving source IDs and quality labels. Projection is `mapX=100*x/regionWidth`, `mapY=100*(1-y/regionHeight)`. `worldweaver-map-2d-v1.mjs` renders projected 2D SVG polygons and exposes them to model-readable observations only when their instance IDs are authorized. Footprint hulls of concave mesh objects overestimate the true area: individual face polygons retain the actual source triangle geometry.
- **Civweave screens:** in-world `kind:'civweave'` content can receive `worldLayout:{sceneGeometry}` to show the same backed 2D polygons in the one-depth nonrecursive portal.
- **Prototype:** `/app/tools/worldweaver-geometry-lab.html` uses actual district names found in the historical illustrated world `public/app/civweave-living-world.js`, but **provisionally constructed positions/heights/roofs**. Rotate or move a building and observe both views and model geometry revision update together. This is a geometric integration test, not a historical-fidelity restoration or an imported live OAR.

A native adapter must eventually export authentic region snapshots (including parcel permissions and filtering) and change events to the existing signed state transport, and receive reviewed tool commands from Worldweaver. The region module must avoid blocking scene simulation threads with outbound HTTP; apply rate/geometry/memory limits and per-agent permission scopes. **Never** enable public RemoteAdmin, general OSSL script execution, or arbitrary model-triggered prim writes as a shortcut. Real-time multiplayer sync, mesh asset fetching and native avatar driving remain unimplemented in this pass.

Verification: `scripts/test-worldweaver-opensim-geometry-v1.mjs` checks 3D/2D vertex parity, quaternion rotation, part offsets, mesh triangles, quality annotations, instance visibility, recursive screen map geometry and scene-revision updates.

## Performance Studio — screenplay, virtual stage, audience and film pipeline (v1)

User goal: adapt user-rights-cleared books into a full-length original animated film through a reusable model-driven process. The initial implementation is a deliberately **private, reviewable rehearsal studio**, not a movie generator, public audience platform, or replacement for native OpenSimulator.

**Canonical application scope**
- `public/app/shared/worldweaver-performance-studio-v1.mjs`: production state, chunked manuscript import (human/rights gate), screenplay proposals and human approval, manual cast-to-avatar reference bindings, rehearsal event receipts, and explicitly consented audience submissions/revocations. This is a production-domain helper to the shared Worldweaver owner; it creates no new Guild, commerce, ballot or canonical chat authority.
- `worldweaver-adaptation-model-v1.mjs`: a selected model inference callback makes up to **three screenplay proposals per call**, each tied to specific imported source excerpt IDs. No autonomous approval or fabricated proof. A stale response cannot mutate a changed project. Browser lab optionally delegates to Civweave's existing `runCodeInference` route/selected local or consented cloud provider; absence of a configured model fails visibly instead of claiming generation.
- `worldweaver-stagecraft-v1.mjs`: a human-approved script builds provisional OpenSimulator-compatible 3D prim scenery and **clearly labeled stand-ins** for characters, keyed by cast/avatar and pilot references. The real scene uses `buildOpenSimGeometry` and `projectWorld2D` to project the same 3D vertices onto the 2D footprints. A separate cue compiler lists dialogue, acting direction and timed voluntary audience moments. **No real skeletal rig, TTS audio file, animation render or native OpenSimulator avatar is implied by a stand-in.**
- `worldweaver-filmcraft-interchange-v1.mjs`: exports a portable film-edit timeline with planned shot and dialogue tracks, missing-media placeholders and WebVTT subtitle strings. This is **not** a native FilmCraft import project and does not pretend that any generated images, music, voices or video clips already exist. The validated `civweave.filmcraft-interchange.v1` format is a future importer/exporter boundary for the open-source FilmCraft app and Civweave Creator Suite. It also exports scene-grouped JSONL for supervised Qwen3.5 4B fine-tuning, using human-approved screenplay examples. This creates **training data only**, not a trained LoRA, and does not fabricate model hidden thoughts.
- `/app/tools/worldweaver-performance-lab.html`: browser-local proof of the pipeline, staged 3D/2D mockup, optional device TTS, optional manually triggered browser SpeechRecognition (may contact the browser's speech provider) and typed audience reflection fallback. The lab saves nothing remotely, performs no covert audio/video recording and has only a simulated local producer principal. The private project is manually downloadable as JSON.

**Privacy and consent**
Audience participation is voluntary and time-bound to an announced reflection moment inside a running rehearsal. Each response carries separate participation and training booleans; no default consent. Submissions may be withdrawn, which blanks the text and removes the active participant identifier/consents. LoRA export needs a second explicit owner authorization to train on rights-cleared manuscript and an additional operator opt-in before **separately training-consented** audience text can be included. No video-based audience emotion, identity, biometric profiling or microphone background monitoring. For a hosted public audience, a trustworthy external identity and retention/deletion service must replace the lab-only in-memory model; historical downloaded datasets cannot be remotely recalled, so consent governance needs export time and withdrawal notices.

**Aesthetic direction**
Use original emotional character design, uncanny but accessible practical-fantasy staging, and landscape-driven visual storytelling. Do not copy existing film characters, sets or an identifiable artist's signature images. Any creator supplied footage/voices/assets require license and consent metadata, including for animation training.

**Sol / Codex evaluation gates**
1. Source edition/rights, character continuity map, audience suitability and original visualization brief.
2. Script proposal review (faithfulness, scene causality, action filmability, and a character-by-character read-through).
3. Provisional OpenSimulator set layout, 3D/2D coordinate agreement, blocking and accessible stage plans; real rig/animation adapters thereafter.
4. A supervised rehearsal with timecoded cues, optional voiced lines, opt-in audience interaction and explicit transcript origin. All tools return authoritative receipts rather than imagined successes.
5. Shot planning, asset render/voice/caption production, FilmCraft import, asset continuity checks, full assembly/quality review.
6. Only after enough **verified** human edits, failed/successful actor attempts and approved production outcomes: prepare training/validation splits, run Qwen3.5 4B LoRA externally, evaluate held-out scenes and preserve rollbacks. Training is optional and distinct from editorial acceptance.

Browser proof, tests and handoff cannot assert that a feature-length film or OpenSimulator native performance has already been produced.

### Stage reconfiguration and inference privacy hardening
After approving a screenplay, an AI can propose a revised set plan via `propose-stage`, but the existing approved geometry remains in use until `review-stage` receives a verified human approval. `compileStageScene` uses only the most recently approved set revision. Every proposal is revision-scoped so stale model outputs cannot silently alter sets, and only one pending stage proposal exists for each scene.

The browser studio asks for explicit per-request confirmation before sending manuscript or script excerpts to a remotely hosted selected inference endpoint. This uses the existing `CivweaveModelRuntime.endpointLeavesDevice` check; it does not create a second inference provider. Browser speech transcription also requires a separate provider-consent checkbox, because its implementation may send microphone audio to the browser's chosen speech service.

Audience response capture now requires a **trusted controller to open a specific scripted audience moment** via `open-audience-moment`; the same controller can close it with `close-audience-moment`. Knowing a moment's ID or having a rehearsal in progress is not enough to submit early or late. The lab represents local synthetic actor identities only; production will require authenticated host audience and stage controller roles.

A character-to-avatar binding records a reviewed role, `avatarRef`, model principal, and optional voice reference. The 3D browser set currently renders a character **stand-in**, not a native OpenSimulator rig; Sol must implement actual rig/animation approvals and model pilot execution before reporting a modeled character performance. Training exports are not proof that a Qwen LoRA has been fitted, and FilmCraft planning JSON is not yet a native FilmCraft project.

## Local workspace boundary

`public/app/shared/worldweaver-workspace-v1.mjs` is the device draft persistence adapter for the existing core. `public/app/worldweaver/workspace.mjs` presents the four templates, a searchable space library, readable station plans, external record references, and NPC character drafts. Every manifest mutation delegates to `createWorldweaver`; there is no second world engine or chat. Opening the page reads saved drafts and starts no inference or network requests for world state.

The adapter's fixed local human principal permits only `create`, `add-station`, `link`, `rig-npc`, and attributed local `debate-turn` notes on standalone drafts. This principal is a device draft label, not verified human identity. NPCs use the explicit `local-draft-pilot` placeholder. Character prompts and proposed tools do not bind or run an authenticated pilot. Provisioning, runtime outcomes, model action queues, and Guild scopes are rejected. The UI labels the OpenSimulator connection unavailable and never presents a draft as a live world.

Storage key: `civweave.worldweaver.workspace.v1`. Opening never creates a draft or writes storage. Limits are 24 spaces, 48 stations, 16 references, 8 character drafts and 32 debate notes per space, with a bounded serialized envelope. Stored records are validated before use. Failed writes do not advance memory; corrupt data is preserved with a visible recovery message. Optimistic stale-tab checks require explicit reload before retrying; localStorage is not a transactional mesh or a cross-tab compare-and-swap service. This adapter neither imports untrusted manifests nor claims signed mesh persistence.

Export is explicit and contains the exact selected space's manifest records, including its notes and character instructions; unrelated spaces are excluded. Export is not publishing, adapter approval, or provisioning. References remain unverified here. Existing feature links open Living School, Cerbanimo, FellowFare, or Anarchadia through the route owner; guide links open the existing guide without transferring private conversation or prompts.

The workspace uses semantic forms, keyboard tabs, visible focus, reduced-motion styling, and readable station instructions independent of 3D placement. The offline package and optional service-worker asset set include the whole workspace module graph. Deterministic contracts: `scripts/test-worldweaver-workspace-v1.mjs`, `scripts/test-worldweaver-ui-v1.mjs`, and `scripts/test-worldweaver-launcher-v1.mjs`, run with the core by `npm run test:worldweaver`.

## Thirty-second ArtCraft trailer authoring and handoff

`public/app/shared/worldweaver-trailer-authoring-v1.mjs` is a local-file adapter for the existing `worldweaver-performance-studio-v1.mjs` production owner. Its `importTrailerAuthoring(raw, {id, clock})` accepts an authoring object or JSON string, creates a temporary canonical production, maps symbolic source/scene keys to the identifiers returned by that owner, and validates the trailer before returning `{state, trailer, receipt, package}`. The caller replaces its current lab session only after successful validation and explicit local replacement consent. A failed import preserves the previous session; invalid JSON and shot timing remain editable. No inference, automatic approval, storage write, world action or network request occurs during import.

The input schema is `civweave.trailer-authoring.v1`. The file is limited to **2 MiB of UTF-8 JSON**. Object fields are allowlisted at every level; arbitrary production snapshots, existing canonical record IDs, `status`, `reviewedBy`, permissions, actor records, executable scripts and approval flags are rejected. Identifier keys start with an alphanumeric character, contain only alphanumeric characters or `:._/-`, have at most 180 characters, and cannot contain `..`.

| Object | Allowed keys and requirements |
| --- | --- |
| Root | `schema`, `project`, `sourceProvenance`, `sources`, `scenes`, `trailer`; all required. |
| `project` | `title` (1–180 characters), `sourceTitle` (1–180), `rights` (`owned`, `licensed`, or `public-domain`), `visualBrief` (1–1,500); all required. These are source-rights declarations, not independently verified legal or producer authority. |
| `sourceProvenance` | Required `manuscriptRef` (bounded identifier) and `sourceHash` (`sha256:` followed by 64 lowercase hexadecimal characters); optional `edition` (1–240 characters). The exporter labels the supplied hash as unverified metadata; it does not independently read the referenced manuscript or edition. |
| `sources` | 1–50 objects: required `key`, `chapter` (1–120 characters), `text` (1–12,000); optional `sourceRef` (1–180). Keys are unique. Text stays private to the local authoring file and in-memory production. |
| `scenes` | 1–16 objects: required `key`, `title` (1–140), `synopsis` (1–1,100), `sourceKeys` (1–10 existing unique source keys), `dialogue`, `set`; optional `moments`, `runtimeSeconds` (5–3,600), `visualDirection` (1–800). `key` becomes the canonical proposal slug; canonical source IDs are assigned through the owner. |
| Scene `dialogue` | 1–80 objects with required `character` (identifier) and `text` (1–1,300); optional `direction` (1–180) and `seconds` (1–90, or omitted/null for later timing conformity). At most 20 distinct character roles per scene. |
| Scene `set` | Required `location` (1–100), `mood` (1–240), `color` (`#RRGGBB`); optional `props` (0–24), `light` (1–200), `ambience` (1–250). |
| Set `props` | Each object requires `id`, `name` (1–100), `shape` (`box` or `cylinder`), `x`, `y`, `height`, `width`, `depth`, `color` (`#RRGGBB`). IDs are unique within the set. `x/y` are in −75…75, height in 0.1…30, width/depth in 0.1…35. These are provisional stage declarations, not uploaded mesh assets. |
| Scene `moments` | Optional 0–20 objects with required `id`, `afterLine`, `prompt` (1–250), `mode` (`reflection`, `question`, `improv-suggestion`, `reaction`); optional `use` (1–300), `maxSeconds` (5–180). The referenced line must exist. These planned invitations import no audience responses. |
| `trailer` | Required `shots`; optional `title` (1–240), `frameRate` (24, 25, 30, 48, 50, or 60; default 30), `rigRequirements` (0–64 proposed character requirement rows, described below). The duration is always exactly 30 seconds. |
| Trailer `shots` | 1–32 objects with required `id`, `sceneKey`, `inFrame`, `outFrame`; optional `dialogue`, `propIds`, `blocking`, `camera`, `lighting`, `sound`, `screenCues`. IDs are unique; `sceneKey` must resolve to an imported scene. No `sceneId` is accepted in the authoring file; the importer returns the mapped canonical plan separately. |
| Shot `dialogue` | Optional 0–16 objects with exactly `lineIndex`, `inFrame`, `outFrame`. The line must exist in that scene. The duration must match its declared `seconds` or the approved canonical score, where available; unassigned line timing remains a proposal requiring audio conformity. |
| Shot `propIds` | Optional 0–24 existing unique prop IDs in the effective scene set; omitting the array selects the scene's props. |
| Shot `blocking` | Optional 0–32 objects with required `character`, `inFrame`, `outFrame`, `from`, `to`, `action`; optional `description` (1–600). Character must exist in that scene. Action is `hold`, `walk`, `turn`, or `gesture`; positions contain only finite `x/y/z`, with x/y in 0…256 and z in 0…64, using provisional OpenSimulator-style region meters. One character cannot receive overlapping movement cues. |
| Shot `camera` | Optional object with exactly `framing`, `movement`, `description` (1–800). Framing is `establishing`, `wide`, `medium`, `close-up`, `detail`, or `over-shoulder`; movement is `locked`, `pan`, `tilt`, `dolly`, `push-in`, `pull-out`, `orbit`, or `tracking`. An omitted camera becomes an explicitly proposed locked wide shot. |
| Shot `lighting` | Optional descriptive text (1–800); omission uses the declared set light or an explicit review placeholder. |
| Shot `sound` | Optional 0–12 objects with exactly `id`, `kind`, `inFrame`, `outFrame`, `description` (1–1,000). IDs are unique within the shot; kind is `music`, `ambience`, or `effect`. These are separate proposed sound layers, not existing audio files. |
| Shot `screenCues` | Optional 0–12 objects with exactly `inFrame`, `outFrame`, `text` (1–500). Plain text only; markup, executable URI/code fields and control-character payloads are rejected. Screen title cues cannot overlap one another in the same shot. |

All frame ranges use **global half-open integer intervals** `[inFrame, outFrame)`. Shots must start at frame zero, appear in sequence without gaps or overlaps, and end at `30 * frameRate` (900 at 30 fps). Every dialogue, movement, sound or title cue must be wholly inside its shot. Dialogue/subtitle cues cannot overlap; silence and separately declared audio layers are allowed. A trailer never silently truncates, stretches or repeats dialogue to fit a different duration. Source scene IDs are immutable proposal identities; each handoff binds them to `productionRevision`, because the current production owner has no independent scene revision counter.

### Local identity, review and persistence

The existing source owner currently requires a `kind: human` actor for project/source intake. This adapter uses the fixed **synthetic, unverified** `lab:unverified-source-intake` principal for those local commands only, with `verified: false`. It is not authenticated producer identity. Screenplay proposals use `lab:editor-agent-authoring-import` with `kind: model`, in batches of at most three, and remain `review-required`. No review, cast binding, rehearsal or approval command is part of import. The import receipt exposes both identities, symbolic-to-canonical mappings, zero inference invocations, pending producer authorization, and `authenticatedProducer: false`.

The Performance Studio's local-file/paste UI is **memory only**. It does not autosave to the existing Creator store, another database, localStorage or a remote service. Reloading discards the in-memory production. Keep the original authoring file and explicitly export the private project or final handoff before closing; a private project JSON may contain source excerpts and optional audience text. Cached application assets do not preserve those private records. A slow file read cannot overwrite newer pasted form edits.

The explicit **Download revised private authoring file** control exports the current symbolic `civweave.trailer-authoring.v1` document, including script/set changes and current rig/blocking/shot edits. This file is resumable through the same importer and contains private source excerpts. It is distinct from the older private production-state dump and the source-free ArtCraft review package. No automatic write occurs. An explicit **Save review export** can separately persist an immutable, source-free package plus its bounded review revision history in the existing Creator artifact store, tied to the exact edited creation run and source hash; it does not autosave the private source production or authenticate a producer. Offline use of that optional save additionally requires the existing Creator package/store to be available; the campus cache does not duplicate its database owner.

`exportArtCraftTrailerPackage(state, options)` remains in `worldweaver-filmcraft-interchange-v1.mjs`. It projects existing scenes and typed jobs into `civweave.artcraft-trailer-package.v1`, with the exact 30-second edit, script and source references, set declarations, blocking, cast/rig placeholders, camera/lighting/audio jobs, missing-media markers and WebVTT captions. The mapped plan uses canonical `sceneId` instead of `sceneKey` and includes `sourceProvenance`. Exports omit raw manuscript excerpts and audience responses. Source hashes remain caller-supplied metadata. All packages retain `producerAuthorization.status: pending`, `nativeArtCraftImportVerified: false`, `rendered: false`, and `worldExecution: false`, including after a simulated lab review.

Review-required scenes can enter this editorial review package while their stage/score stay pending. The exporter does not temporarily mark them approved to call Stagecraft. Already approved scenes use the existing `compileStageScene`, `compilePerformanceScore` and approved FilmCraft interchange; current approved set revisions and original screenplay set declarations are kept distinct. The older `exportFilmCraftInterchange` still rejects an entirely unapproved production. A portable review package is not proof of native ArtCraft import, rendered trailer footage, authenticated acceptance, deployed rigs or training execution.

### Offline assets and verification

The offline application manifest and optional shell-cache asset set carry the complete static Performance Studio/trailer import graph, including the existing Worldweaver core's avatar/screen/map dependencies. The lab remains optional and cannot make shell installation depend on every lab asset succeeding. Once these assets have actually cached, local file intake, review validation and JSON/VTT handoff require no inference or internet service. Gemini, other remote inference, browser speech services, media generation, connected world actions and native ArtCraft integration have separate availability and consent requirements. Static cache-list coverage is not a claim that an individual device has completed offline installation.

Executable coverage: `scripts/test-worldweaver-trailer-authoring-v1.mjs` checks strict symbolic import, authority rejection, atomic UI replacement, repairable edits, downloads, identity disclosures, cache graph and registration; `scripts/test-worldweaver-trailer-package-v1.mjs` checks exact frame partitioning, cue/reference validation, revised sets, pending authorization and execution flags. Both run under `npm run test:worldweaver`. The Worldweaver and Threshold CI jobs install the lockfile dependencies with `npm ci --ignore-scripts` before running UI/module tests.

### Device editing, rig sheets and blocking review

`public/app/shared/worldweaver-production-review-v1.mjs` is presentation only. Its Script, Timeline, Sets/props, Rig requirements, Blocking, Camera/light/audio, Captions/titles and Files/receipts tabs use semantic forms to edit existing proposed data. Imported trailer mode disables the older lab approval/casting/rehearsal controls; it does not promote a synthetic lab identity into a real producer. Invalid edits leave form text available for repair. Canonical receipts and provenance are read-only evidence, while their associated production files have explicit editing controls and individual downloads.

Every plan, blocking and rig edit delegates to `createTrailerDeviceReview` in the existing authoring adapter, using its exact visible revision guard and the canonical exporter. Script/set edits reimport an edited authoring document through the existing production owner as new proposed scene identities. This does not rewrite an approved scene in place. The same review session retains immutable old `{plan, package}` snapshots, including old dialogue, sets, rig requirements and blocking, capped at 32 revisions and 2 MiB. Raw manuscript excerpts and private production state are excluded from that history. An accepted edit, a retained revision and a persisted Creator artifact are separate states.

Each `rigRequirements` row allows `character` (an actual canonical scene dialogue character), `bodyType` (`humanoid`, `creature`, `other`), optional `appearanceNotes`, `movementNotes`, `voiceNotes` (each up to 1,200 characters), `rigReference` (up to 240), `skeleton` and `proportions`. `skeleton` allows only `controls` (0–64) and optional `notes` (up to 1,200). A control has `name` (unique, up to 80), `kind` (`bone`, `ik`, `blendshape`), and optional paired finite `min`/`max` in −360…360 with max no smaller than min. `proportions` allows only `heightMeters` (0.05…20), `headToBodyRatio` (0.02…1), `armSpanMeters` (0.05…40), and `legToBodyRatio` (0…1). No status, cast binding, execution permission or approval field is accepted. These sheets remain proposed requirements, even when an informational rig reference exists.

The rig tab draws a generic control schematic; `other` uses an abstract volume/effect layout instead of a humanoid skeleton. The diagram is neither a loaded skeletal asset nor rig validation. Numeric dimensions, control requirements and notes are editable on the device. Blocking exposes actual actor/shot selection, from/to XYZ, action and frame range, a readable XY path and a frame scrubber. The existing single 3D canvas and matching 2D map move beside the blocking or set forms; they are not cloned into another renderer. Scrubbing emits `civweave:trailer-preview-frame`; the lab owner independently revalidates its current mapped plan before deriving positions and preview heights. Model/runtime motion execution remains absent.

`previewSceneGeometry` in the existing Stagecraft owner provides a pure, explicitly proposed projection for review-required scenes, with pending authorization and `worldExecution: false`; the separate approved staging compiler retains its original gate. Thus the user can inspect/edit proposed scenery and marker movement before any authenticated approval or real rendering. Tests in `scripts/test-worldweaver-production-review-v1.mjs` and the authoring suite exercise form edits, invalid-input retention, scrubbing, requirement controls and resumable authoring roundtrips. All run under the existing Worldweaver suite and CI.
