# Worldweaver microspaces and NPC pilots · v1 contract

## Purpose
Worldweaver is one shared, local-first **manifest and intent** capability. It is not a sixth realm, replacement chat, Second Life emulator, or alternate authority for learning, Quests, commerce, or voting.

Canonical owner: `public/app/shared/worldweaver-core-v1.mjs` (`createWorldweaver`, `SPACE_GUIDES`, `NPC_TOOLS`).
Executable contract: `scripts/test-worldweaver-core-v1.mjs`.
Active UI routes modified by v1: **none**. This initial module is an integration-ready foundation and does not yet start an OpenSimulator server or install a browser viewer.

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
