# Threshold acceptance evidence — 2026-10-30

Governing handoff: [PR #903](https://github.com/cerbanimo-dev/Civweave/pull/903). Staging is the integration base. Private manuscripts, scripts and training samples are excluded from Git. Source tests do not establish human authority or external execution.

| Capability | Observed evidence | Status |
| --- | --- | --- |
| Existing deployed staging | Campus, Quest map and guide navigation rendered | Existing functionality observed; new hybrid run below was local |
| Worldweaver surrounding UI | Local workshop/stations saved and survived reload; Worlds reuses shared utility owner | Functional local interface; PR #904 review deployment |
| Authored Quest | `weave-mvuzw69v-92iey9`, revision 1; `authored-import-mvuzw69v-938cq9`; declared editor-agent authorship, valid, inference 0 | Actual local canonical import; activation and authorization pending |
| Private source | Producer confirmed sole ownership and Gemini sharing; complete Book One privately imported, 94,960 characters with exact CRLF newlines, source hash and rights | No separate training consent |
| Gemini | `creation-run:e4695f73-eb7b-494b-ad7f-f43580591239`: real Gemini 3.1 Flash-Lite SSE, 1,529 visible characters, STOP, 25,483 input / 455 output tokens, checkpoint and saved edit receipt | Actual provider stream; free-tier restriction retained; no billing statement inspected |
| Failure/repair | Earlier zero-text provider error preserved in `creation-run:6df3a377-4538-410b-8d1c-68524c871543`. Repaired standalone Creator's missing shared Settings restoration; readiness makes no request; retry journal explicitly links prior attempt | No silent restart |
| Editorial loop | Original Creator revision 1 preserved; independent revisions 2–4 corrected source continuity/designs, pacing, departments and count annotations through real document tools | Three editorial passes, zero added inference; producer review pending |
| Evidence export | Real Creator download contains original/final revisions, four exact tool receipts, checkpoint, prior failure, zero missing artifacts and no complete manuscript body | Portable local evidence verified |
| Trailer | Real Performance Studio file import: six shots, exactly900frames/30fps, 15 spoken words, 35 missing-media jobs; JSON/VTT downloaded | Validated review package; no rendered media |
| Saved package | `production-export:c8fd55c0-5231-48a4-9502-c3551fe1b09c`, linked to run revision7/document revision4 | Explicitly persisted in existing Creator artifact store; human approval pending |
| Mobile | Actual390×844 browser smoke; available375px content width had no horizontal overflow; import/shot/save controls fit | Emulation, not Android hardware or installed-device offline proof |
| Guild training | Synthetic authenticated custody, consent/purpose, idempotency, withdrawal and closed-release tests | No live sample delivery, collective decision, payout, burn or training job |
| ArtCraft/OpenSimulator | Existing content/geometry/rig owners retained; import/render/world flags stay false or pending | No authenticated bridge, rig, native editor import or renderer verified |

Weaveling contract: `/extensions/civweave-weaveling-plan-json-v190.js`, revision `1.3.0-weaveling-plan-json-v190-authored-import`, digest `sha256:56dfb2867ce944e2a08bd475f8784bb83d67f6ca03a94e3327bf6f8a1d1b8d68`.

Creator document-stage digest: `sha256:d65311da310fcdecd0137a32a504d7b8048ec8b45b199fb6502f2a15befd486f`. Successful Gemini edit: `creator-tool:7ec28ed8-69bd-4853-9b74-4723a96617db`. Editorial receipts: `creator-tool:690eeeea-64a8-4a5e-90d2-708a262a6fd4`, `creator-tool:e1abb831-c98f-4b01-b542-8d3ba89a383b`, `creator-tool:3838d06e-2748-4cb0-ab7d-284946be9497`.

Saved package digest: `sha256:50d64c3268c73370c16d90b47ce0f9d0b1d9bf53cfb688e11b98a7e69a41b3b5`. Imported source digest: `sha256:ed6117802870fd3653efafeb1ca2e431eb21f476f0eecbc3e245af864618412e`. ZIP LF source and imported CRLF source compare exactly after newline normalization. These IDs are device artifacts, not human or cloud credentials.

## Gates still open

Gate1 is substantially exercised locally. Its deployed-staging session, actual device/offline checks, receiving guide acceptance and live stop/resume evidence remain open. Synthetic negative-path tests do not replace those checks.

Gate2 remains open: producer approval of this exact screenplay/assets, approved stage compilation, real rig bindings, same-scene2D/3D runtime proof, trusted actor/render receipts, voluntary audience rehearsal, native target import and media assembly. Lab source intake is explicitly synthetic; no human authorization was impersonated.

Host Guild release, dataset access and negotiation remain unavailable without trusted exact-purpose collective and Guildkeeper adapters. Custody alone never authorizes training or settlement.

## Verification and CI

Run `npm run test:threshold` and `npm run test:worldweaver`; final counts accompany delivery. The earlier Settings ownership failure was repaired by aligning both active Settings query pins with the actual owner's version; its unchanged verifier passes. The unchanged Gemini tier verifier still expects a different guide model from current staging.

The targeted QA pass on the current local source completed **69 Threshold tests**, including the exact prepare/inspect/download evidence controls, **112 Worldweaver tests**, and `npm run check:syntax`: **1,539 source files**, selected release entrypoints, Guild access checks and the canonical Settings/ownership postchecks passed. Creator package isolation also passed. These counts describe the source snapshot before the later staging merge and subsequent artifact-view changes; those changes require their own checks before publication.

The earlier published PR #904 snapshot (`3905cee7a7b4689194f55e184b9ac806b3e6fbde`) had two independently reproduced staging baseline failures:

- [Map package job](https://github.com/cerbanimo-dev/Civweave/actions/runs/41056451192/job/124065078984): `scripts/test-civweave-map-v1.mjs:90` expects `Civweave Hub Map`; `public/app/civweave-map-v1-manifest.json` declares `Civweave Guild Map`. The test and manifest are byte-identical between that PR head and staging `fb51da55f06767cee39235689660d090fa6093d9`. The current local run reproduces the same mismatch, with the other eleven Map tests passing.
- [Creator package job](https://github.com/cerbanimo-dev/Civweave/actions/runs/41056450000/job/124065075875): `scripts/test-cloudflare-creator-provenance-human-endorsement-v1.mjs:24` tries to assign `stored.status` after that object became frozen, producing `TypeError: Cannot assign to read only property 'status'`. The test and relevant receipt, endorsement, review, tribunal and cloud lifecycle modules are byte-identical between that PR head and the same staging revision. The current local run reproduces the exact error.

This establishes those two failure causes as present in the staging source used as the integration base; it does not classify every failing check as unrelated. They remain visible and were not edited or removed to conceal a failure. The old staging-package build and Cloudflare Pages deployment succeeded, but that is not a passing check run or deployment receipt for the newer unpublished source. Full CI status must be checked on its eventual published head.

## Rollback and privacy

Revert source through normal staging review/deployment. Do not promote production without approval and passing checks. Preserve device revisions and private handoff files. A cloud application's different origin does not receive these local artifacts automatically. Later host withdrawal or rollback cannot erase downstream exports or completed models.
