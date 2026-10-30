# Codex handoff — Worldweaver labs hardening + archived commune reconstruction

**Date:** 2026-10-30  
**Base:** `staging`  
**Change set:** PR #899 (`feature/worldweaver-labs-hardening-20261030`)  
**Ownership:** Worldweaver shares one canonical owner; this work is a staging-only experimental capability.

## 1. What is actually implemented

### Avatar Lab
- `public/app/tools/worldweaver-avatar-lab-v1.mjs` now auto-saves **validated** edits only, per Starling persona, in browser localStorage when allowed. Last working preview remains intact when JSON is malformed.
- `public/app/shared/worldweaver-lab-draft-v1.mjs` is the strict import/export and storage helper. Versioned JSON bundle schema: `civweave.worldweaver.avatar-lab.v1` (max 32 KB). Persona mismatches, unknown schemas and unexpected plan fields fail closed.
- UI adds Import JSON, Export JSON, Undo last valid edit (12-state bounded history), and Reset canonical starter.
- Browser storage failure is not reported as success. Invalid unsaved text produces a leave-page warning; local import is rejected if the persona changes during file reading.

### Screen Lab
- `public/app/shared/worldweaver-lab-media-v1.mjs`: supports PNG/JPEG/WebP and MP4/WebM only, checks magic signature bytes, image decoder pixel dimensions (max edge 8192; max 32 Mi pixels), and finite video duration (max 300 seconds). File caps: image 12 MiB, video 50 MiB. No SVG file uploads or arbitrary HTML.
- Resource lifecycle leases keep local Blob URLs alive while currently selected, displayed or queued; release when unused/cleared or on pagehide. Stop video playback/unload media elements before replacing DOM.
- `public/app/tools/worldweaver-screen-lab-v1.mjs`: updated visible cast queue/status. Human review for model-proposed external URLs; ability to cancel a pending cast; no double application; older model casts are rejected if a human changed the screen.
- `public/app/shared/worldweaver-core-v1.mjs`: new `cancel-cast` manifest command for verified human actors; only `queued` and `review-required` screen intents are cancellable. It does not give models new capabilities.
- The lab still uses *simulated* actor and renderer identities and stays isolated from the authenticated shared Guild layer.

### Verification
Run:
```bash
npm run test:worldweaver
node --check public/app/tools/worldweaver-avatar-lab-v1.mjs
node --check public/app/tools/worldweaver-screen-lab-v1.mjs
```
`scripts/test-worldweaver-labs-hardening-v1.mjs` covers import/export, persona isolation, corrupted and blocked localStorage, file headers, decoded bounds, media lease cleanup, video teardown, and human cancellation/duplicate ack. Existing Worldweaver model/approval tests remain in the same command. GitHub Actions `Verify Worldweaver Core` runs these.

**Do not claim the labs generate a 3D commune or operate a real Worldweaver provider yet.** No browser E2E tests or physical mobile-device performance verification have been completed in this pass.

## 2. Codex follow-up: browser + mobile acceptance

Use a browser/PWA test harness (prefer real-device Android/iPhone and desktop browser) to manually verify and automate the following where possible:

1. Avatar malformed plan is rejected without blanking the last preview. Valid edits save across same-origin reload; one persona cannot load another's plan. Undo/reset/import/export behavior is deterministic. Storage disabled/private mode degrades without claiming durability.
2. Screen upload: fake PNG named `.png`, SVG pretending to be PNG, huge image, giant decoded image, unknown/overlong video, and unsupported codecs all fail gracefully. No unbounded decoded pixels or leaked URLs after repeated replacements.
3. Run image -> video -> website -> clear, plus model external URL review/reject, stale intent after human overwrite, double apply and cancelled intent late acknowledgement. The current display must remain valid.
4. Check keyboard-only controls, mobile safe areas, labels, landscape layout and screen-reader announcements. Confirm external websites blocked by their own CSP still have an **Open website** fallback.
5. Confirm service worker / installer asset manifest does not strip the new `/app/shared/worldweaver-lab-*.mjs` modules from actual deployment or offline precache. Test airplane-mode expected degradation.

## 3. Next project: reconstruct the visual platform's buildings and commune map from archived code

**Do not treat the initial illustrative zone list in chat as sourced architecture.** The `archive/` directory was not present at the staging repository root during this pass (404). Codex must first discover the *actual* historical visual-version source from Git history, old release tags, archived branches, linked source artifacts, the user's uploaded archive, or supplied screenshots. Confirm artifact provenance and rights before reusing its geometry and textures. The present-day `site/cerbanimo-cc` and `public/app/` assets are possible reference locations, **not evidence** of the original building footprints.

### Phase A — source evidence inventory
- Identify exact historical commit/tag/archive SHA and folders, date, image/3D assets, building names, scene graphs, interaction routes, camera locations, top-down maps, relevant screenshots and styles.
- Produce `docs/worldweaver/archive-visual-evidence-v1.json`: each building/zone source path, SHA, asset/route, evidence type, confidence, architectural dimensions if actually recorded, and known unknowns.
- Where screenshots are incomplete, label shape/size/position as `inferred`, never `verified`. Ask for targeted user visual confirmation when no reliable source exists.

### Phase B — authoritative intermediate world manifest
Create a portable, versioned `worldweaver.commune-layout.v1` manifest and validation tests, not an opaque mesh or generated screenshot:
```json
{
  "schema": "worldweaver.commune-layout.v1",
  "source": {"repo": "cerbanimo-dev/Civweave", "ref": "EXACT_HISTORICAL_SHA"},
  "scale": {"metersPerUnit": 1, "source": "inferred"},
  "zones": [],
  "buildings": [],
  "terrain": [],
  "paths": [],
  "screenAnchors": [],
  "npcSpawnAnchors": [],
  "uncertainties": []
}
```
Each building needs stable ID, evidenceRefs, footprint, stories/height when grounded, entrances, collision limits, role/system owner, style/texture references and asset provenance. Every anchor needs parent structure and local coordinates. Validate no duplicate IDs, collisions, unreachable public paths, undefined art assets, oversized meshes or leaked external URLs.

### Phase C — deterministic first 3D generation
- Generate a geometry-first walkable reconstruction in a **local browser/WebGL renderer** (or OpenSimulator backend once a trusted provider is installed). Use simple procedural building shells from the manifest before replacing them with higher fidelity models or textures. Do not conflate rendered screenshot fidelity with correctly restored geometry.
- Connect Worldweaver screens via existing logical screen IDs, the existing Starling/NPC binding contracts, and role-linked buildings as actual world objects. Do not fork Starling personas, Guild Map, FellowFare settlement, Anarchadia ballot ownership or Living School assessment logic.
- Export stable scene/manifest snapshots for incremental changes and rollback. Human review for public Guild publishing, spending, governance and third-party assets.
- Test one continuous walkthrough with all sourced buildings and communal paths, screen casting from a model-piloted avatar, an actual video media screen, and offline/browser fallback. Keep model interactions bounded; don't create a parallel inference runtime.

### Handoff acceptance criteria
1. Source inventory records a verified historical anchor or explicitly declares source unknown.
2. Deterministic layout manifest validates with provenance and uncertainty tags.
3. Generated 3D scene restores documented paths/buildings without invented source claims.
4. At least one avatar walks to a screen and requests an approved display. Recording proves the runtime, not the model, acknowledged the action.
5. Staging tests, on-device mobile smoke tests and cleanup/rollback all pass before any production promotion.

## 4. Non-overlap constraints

- Avoid editing live `Starling Lounge` and its model scheduler or duplicating the persona registry. Existing eight Starling definitions and SVG portraits are canonical.
- Preserve separate `Living School`, `Cerbanimo`, `FellowFare`, `Anarchadia`, `Guild Map` authorities. Worldweaver stores pointers/intent logs, not payments, votes or Quest completion.
- Keep `staging` integration only. `main` is shipping; don't promote without verified end-to-end operations.
- Respect `AGENTS.md`, `config/agent-work-context.json`, `docs/architecture/repository-map.md`, `config/system-ownership.json`.
- There were unrelated failures in broad `Verify Agent Work Context` and Settings/system ownership checks on prior PRs due to chat/Settings assertions; investigate against staging baseline, do not suppress or rewrite checks merely to make this feature green.

## 5. Additional requirement — same-state 2D world and the recursive Weave screen joke

Follow-up feature adds `public/app/shared/worldweaver-map-2d-v1.mjs`, an economical **DOM-only** 2D map projection, plus `public/app/tools/worldweaver-map-lab.html`. This is a renderer for the same Worldweaver manifest, **not** an alternative simulation. Models receive `observeWorld2D` compact observations; real-time host subscriptions must be authenticated. Native `civweave` casting now opens the current world's 2D view within a Weave screen, intentionally showing a nonrecursive 2D portal for the screen nested inside that very map.

Codex's 3D commune implementation must use this projection as its **low-end and accessible alternate interface** and as its agent observation layer. The 3D renderer and the map must receive identical canonical world/position revisions, share screen object IDs and navigation/interaction commands, and keep all permissions with existing owners. Verify historical building topology/scale before replacing schematic coordinates. Add actual provider state streaming (Cloudflare Durable Objects coordination and/or trusted local host), with bounded update rate, reconnect replay, stale-revision protection and device fallback. No fake live status or silent sync substitutions. Tests must compare 3D and 2D snapshots for entity ID parity, path accessibility, active screens, NPC positions and action receipts. The ironic recursion stop is deliberate product behavior and should be preserved.\n
## 6. OpenSimulator 3D-to-2D polygon bridge

The October 30 bridge adds the canonical validated region-geometry translator at public/app/shared/worldweaver-opensim-geometry-v1.mjs, a perspective-only browser test viewer at public/app/shared/worldweaver-3d-preview-v1.mjs, and the side-by-side lab at public/app/tools/worldweaver-geometry-lab.html. The 2D polygon layer uses world-space transformed vertex coordinates, not independently created schematic drawings. Existing illustrated world district names are grounded in public/app/civweave-living-world.js; geometry/positions in the demo are explicitly provisional.

Codex: implement an authenticated read-only OpenSimulator IRegionModule, extracting SceneObjectGroups, individual SceneObjectParts, scale, rotation, linked transforms, mesh triangles, terrain height fields and changed-object events into the documented v1 schema. Keep region thread hooks nonblocking, auth and parcel rights external, and rate/object budgets enforced. Verify with real OAR and native viewer; don't claim the demonstration is a live OpenSimulator client. If geometry is absent, flag conservative envelopes as approximate.

Only after viewer/2D position parity is verified should reviewed agent edits and rollback be connected to this bridge. 3D and 2D users must see identical object IDs, coordinates, action outcomes and revision numbers. No public RemoteAdmin or arbitrary model-supplied executable scripts.

## 7. Screenplay-to-movie process for Codex 6.1 Sol

A private Performance Studio pipeline has been staged with a human-reviewed source-to-screenplay state engine, bounded existing-model inference adapter, OpenSimulator-compatible 3D stage mockup, 2D polygon parity, reversible rehearsal cue records, optional audience transcription, consented response capture, and FilmCraft/Qwen3.5 4B data exports. No user manuscript was imported into this demo; no real OpenSimulator movie, character rig, voice synthesis asset, FilmCraft native project, or trained LoRA exists yet. There are several potentially relevant user manuscripts; do not silently select one.

Sol's acceptance sequence:
1. Confirm source book edition, adaptation/training rights and intent, chapter by chapter. Create a continuity bible and original design brief.
2. Use the selected Civweave local/consented cloud AI with one to three scene proposals per call, preserving excerpt provenance, tool receipts and revisions. Human approve screenplay and cast decisions.
3. Convert approved scenes to stage sets, storyboard/camera blocking, gesture and lighting cues. Replace provisional actor stand-ins with approved Starling/avatar rigs through the authorized OpenSimulator adapter. Match 3D and 2D object IDs and polygons.
4. Practice scripted performances on a real hosted OpenSimulator region; acknowledge actual movements/animations/screens from the renderer. Invite voluntary audience contributions only at announced moments, offer text fallback, flag provider-hosted speech recognition, preserve consent withdrawal and avoid facial/emotional profiling.
5. Queue individually renderable original shots, vocal performances and assets. Generate timecoded captions/transcript and a verified FilmCraft-compatible editable project import. Current output is a portable planning manifest, not a native FilmCraft project or video render.
6. Only after collecting enough validated human edits, tool action success/failure records and reviewed clips, prepare training/validation splits for Qwen3.5 4B LoRA. Compare a baseline to a trained adapter on held-out scenes, record evaluation metrics and retain rollback. No fabricated hidden chain-of-thought or unconsented audience material.

Original art direction: expressive characters and emotions, approachable yet unsettling fantasy puppetry/theatrical textures, and striking surreal landscapes that communicate the story's emotional architecture. Film references are mood references only: do not reproduce characters, set layouts or distinctive signature imagery of existing movies or artists.

Remaining gaps: real OpenSimulator native region/physics/avatar adapter, full actor animation rigs, storyboards and shot camera automation, streaming audio/TTS with recording permissions, durable production storage and withdrawal propagation, FilmCraft native timeline import, render queue and full movie assembly. Keep everything staging-only until real end-to-end acceptance.
