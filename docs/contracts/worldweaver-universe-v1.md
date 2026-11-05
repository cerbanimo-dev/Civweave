# Worldweaver Universe v1 — The Commons Between

Canonical module: `public/app/shared/worldweaver-universe-v1.mjs`  
Browser proof: `/app/tools/worldweaver-universe-lab.html`  
Executable contract: `scripts/test-worldweaver-universe-v1.mjs`

## Canonical universe

**The Commons Between** is the one v1 Worldweaver universe blueprint. It composes existing Worldweaver rooms, visual districts, story portals, Convergence milestones and PvE rules without introducing a second simulation or application authority.

The user-facing navigation contract adds:

- **The Threshold** at Starling Commons as the arrival nexus.
- A **3D ring carousel** containing every universe room exactly once.
- A **three-lane Intention Highway**:
  - Living School — learn.
  - Cerbanimo / Quest Forge — build.
  - FellowFare — exchange.
- **Anarchadia** as the governance interchange connected to every intention lane.
- Convergence Stage as a separate performance/canon-review destination rather than an intention lane.

The three lanes visualize one intention across systems. They do not merge those systems' data owners.

## Authority

Worldweaver remains the spatial authority. Existing application owners remain authoritative for curriculum, Quest/project state, listings/exchange, governance, and book/film canon. Selecting a carousel card or highway lane is presentation-only until an authorized runtime acknowledges an actual spatial move.

The builder still creates draft Worldweaver rooms and stops before provisioning. DreamGrid/OpenSimulator remains a future trusted renderer/provider adapter; it is not silently claimed as active.

## Cleanup/security rule

This universe stays in one canonical `worldweaver-universe-v1.mjs` file. Do not add parallel compatibility universe modules. Replace and remove when a future version is intentionally adopted.

The module and browser lab prohibit dynamic script insertion, `eval`, `new Function`, iframe compatibility bridges and runtime source patching.

## Portable universe file rule

Every distributed Worldweaver universe file MUST contain the whole working Civweave Portable client. `public/app/shared/worldweaver-portable-client-v1.mjs` is the single bundling owner, accepting both Commons-style `rooms` and Lantern-style `districts`. Its exported `.civweave.html` is a standalone, offline, single-file artifact with world data, semantic Guild Map/room navigation, local Quest drafts, private journal, cooperative PvE prompts, and JSON draft export/import. The export browser is `/app/tools/worldweaver-universe-files.html`.

The source `.mjs` universe blueprints remain authoring modules, not distributable universe files. Do not distribute a naked `.mjs` blueprint as a playable universe. Do not fork a chat runtime, authentication, Guild state, official Quest ledger or world simulation in the portable presenter: any local progress is explicitly an unverified draft, and the authenticated Civweave owners remain authoritative. No remote assets, network calls, iframe shells, script injection or CDN dependencies may be required for a portable file.

Run `npm run test:worldweaver` to exercise the portable-client contract together with both universe blueprints.

## Authenticated portable attachment v1 (staging)

The downloaded single-file universe remains **fully offline-capable** and its drafts remain private until the person selects **Attach to Guild / node**. It opens the chosen HTTPS Civweave host's fixed `/app/tools/worldweaver-universe-attach.html` route with only a random challenge and universe ID in a URL fragment. Draft text and credentials NEVER enter the URL. The popup must be served by the explicitly chosen Civweave origin; it is not an arbitrary webhook or cross-origin token API.

The trusted host page delegates authentication to `CivweaveHostNodeSessionV1.ensureSelected()` and re-verifies current membership with `status(nodeId)`. The verified origin, node ID and user ID must match the existing selected session. Legacy Guildkeeper credentials without verified current membership are deliberately rejected. **HTTPS local nodes** use this same authenticated session endpoint if their Civweave installation serves the attachment page. Unauthenticated HTTP/local-only servers do not claim attachment; a local file export/import remains available.

After verification, an opener-bound, challenge-bound `postMessage` exchange transfers only the bounded local draft bundle. The host window requires human confirmation of *individual* Quest steps and journal notes, checks current membership again before writing, and returns a receipt with no credentials. The only cross-window wildcard target is the reply to opaque `file:` openers; it contains a request or non-secret local-import receipt, never login tokens. File import provides a fallback when popup communication is unavailable.

`worldweaver-portable-reconcile-v1.mjs` validates each draft, detects unchanged imports and same-source changes, and refuses silent overwrites. Repeated imports are idempotent. A changed draft with the same stable ID becomes a **conflict** needing an explicit separate review. The canonical `CivweaveActionBoardV1.importPortableActions` writes approved Quest steps as device-local Inbox actions with bounded provenance, not as AI-authored Weaveling Quests. Local checkmarks do not become completion proof. Explicitly approved journal notes use the existing `CivweaveLocalMeshV146.createObject` with `consent:'private'`, `publish:false` and `hopLimit:0`. They are not distributed to Guilds.

This stage does **not** automatically push authoritative Guild Quests, world state, or AI operations. Publishing an approved Weaveling Quest remains the separate human-reviewed `CivweaveGuildQuestsV1` workflow. Portable attachment is a verified local handoff into canonical owners, not a second simulation, chat, login or Quest ledger. Network outages, blocked storage, stale authentication and unsupported node origins fail visibly and preserve originals.

Run `npm run test:worldweaver` and `npm run test:action-board`. The staging Pages site itself must still receive an external live HTTP/device smoke test before claiming full deployment verification.
