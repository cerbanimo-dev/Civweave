# Worldweaver microspaces and NPC pilots · v1 contract

## Purpose
Worldweaver is one shared, local-first **manifest and intent** capability. It is not a sixth realm, replacement chat, Second Life emulator, or alternate authority for learning, Quests, commerce, or voting.

Canonical owner: `public/app/shared/worldweaver-core-v1.mjs` (`createWorldweaver`, `SPACE_GUIDES`, `NPC_TOOLS`).
Executable contract: `scripts/test-worldweaver-core-v1.mjs`.
Local workspace: `/app/worldweaver/index.html`, opened by the existing shared utility owner `persistent-shell-actions-v1.js` through its **Worlds** control. It reuses the shared five-guide navigation and does not add a sixth realm. The workspace does not start an OpenSimulator server or install a browser viewer.

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
2. Extend the local station-plan preview into interactive workshops, displays, debate halls and portable shop previews when their capability adapters are ready.
3. Add the OpenSimulator adapter with constrained object fabrication, avatar/NPC creation, tool outcome confirmations, snapshots and rollback.
4. Register the shared capability with the existing chat tool dispatcher and provide guide-specific templates **without** creating additional guide chats.
5. Wire real references to existing Learning School, Cerbanimo, FellowFare, Anarchadia and Guild Map UIs. Keep human confirmation before spending, global publication and binding governance.
6. Test multiplayer authorization, griefing/impersonation resistance, rate and resource budgets, long-running NPC behavior, and recovery after reconnect.

The feature branch is not a production deployment. Test all host changes on staging before a production merge.

## Local workspace boundary

`public/app/shared/worldweaver-workspace-v1.mjs` is the device draft persistence adapter for the existing core. `public/app/worldweaver/workspace.mjs` presents the four templates, a searchable space library, readable station plans, external record references, and NPC character drafts. Every manifest mutation delegates to `createWorldweaver`; there is no second world engine or chat. Opening the page reads saved drafts and starts no inference or network requests for world state.

The adapter's fixed local human principal permits only `create`, `add-station`, `link`, `rig-npc`, and attributed local `debate-turn` notes on standalone drafts. This principal is a device draft label, not verified human identity. NPCs use the explicit `local-draft-pilot` placeholder. Character prompts and proposed tools do not bind or run an authenticated pilot. Provisioning, runtime outcomes, model action queues, and Guild scopes are rejected. The UI labels the OpenSimulator connection unavailable and never presents a draft as a live world.

Storage key: `civweave.worldweaver.workspace.v1`. Opening never creates a draft or writes storage. Limits are 24 spaces, 48 stations, 16 references, 8 character drafts and 32 debate notes per space, with a bounded serialized envelope. Stored records are validated before use. Failed writes do not advance memory; corrupt data is preserved with a visible recovery message. Optimistic stale-tab checks require explicit reload before retrying; localStorage is not a transactional mesh or a cross-tab compare-and-swap service. This adapter neither imports untrusted manifests nor claims signed mesh persistence.

Export is explicit and contains the exact selected space's manifest records, including its notes and character instructions; unrelated spaces are excluded. Export is not publishing, adapter approval, or provisioning. References remain unverified here. Existing feature links open Living School, Cerbanimo, FellowFare, or Anarchadia through the route owner; guide links open the existing guide without transferring private conversation or prompts.

The workspace uses semantic forms, keyboard tabs, visible focus, reduced-motion styling, and readable station instructions independent of 3D placement. The offline package and optional service-worker asset set include the whole workspace module graph. Deterministic contracts: `scripts/test-worldweaver-workspace-v1.mjs`, `scripts/test-worldweaver-ui-v1.mjs`, and `scripts/test-worldweaver-launcher-v1.mjs`, run with the core by `npm run test:worldweaver`.
