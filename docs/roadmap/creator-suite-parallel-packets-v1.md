# Creator Suite Parallel Task Packets v1

All packets in this catalog are designed to be independently implementable from the same frozen base:

- `docs/contracts/content-creation-provenance-v1.md`
- `public/app/content-provenance-v1.js`
- `public/creator-suite/package-v1.json`
- `/creator-suite/` is a separately downloadable/installable package and must not be pulled into the ordinary Civweave offline core.

A packet may change its named owner paths, tests, package manifest entries, and documentation needed for that capability. It must not redefine origin semantics or create a second provenance owner.

## Packet CS-001 — Download surface

Expose **Download Creator Suite** on Civweave's Downloads surface as a distinct optional install, with copy that makes clear it is not bundled with Civweave core.

Acceptance: one discoverable launcher; no automatic download; installed/open state handled separately from Civweave; mobile and desktop tested.

## Packet CS-002 — Creator Suite install lifecycle

Own install/update/uninstall/recovery behavior for the `/creator-suite/` service-worker scope.

Acceptance: install works from supported browsers; updates do not corrupt local projects; uninstall instructions are explicit; core Civweave remains unaffected.

## Packet CS-003 — Package-size and storage preflight

Add storage estimation and preflight before optional editor-engine/model packs are downloaded.

Acceptance: estimate available quota, show expected download/storage size, fail gracefully under low storage, never evict Civweave core data intentionally.

## Packet CS-004 — ProseMirror + Yjs text engine

Replace the baseline contenteditable implementation with an offline-first ProseMirror document model backed by Yjs, while emitting the same creation-event contract.

Acceptance: semantic editing, undo/redo, offline persistence, transaction-origin attribution, no raw draft text in public provenance packets.

## Packet CS-005 — Yjs mesh collaboration

Synchronize Creator Suite text documents over the existing local object mesh using Yjs updates.

Acceptance: offline peers converge, duplicate/reordered updates converge, actor/provenance attribution remains stable, no new mesh owner.

## Packet CS-006 — AI-selective undo

Use editor transaction origins to support undoing AI-originated operations without erasing unrelated human operations.

Acceptance: human/AI undo scopes are deterministic and covered by regression tests.

## Packet CS-007 — Text provenance visualization

Add an optional document overlay/history view showing human, Civweave AI, deterministic, and external-origin spans/events.

Acceptance: off by default, accessible, does not expose private history to network services.

## Packet CS-008 — Rich-text export

Export tracked text projects to HTML, Markdown, plain text, and a structured Civweave document format.

Acceptance: export adds an `artifact.export` event and preserves provenance receipt linkage.

## Packet CS-009 — Audio engine integration

Integrate a permissively usable open-source/browser-native multitrack audio engine or implement the required primitives directly after license review.

Acceptance: multitrack playback, cut/split/move/gain/fades, offline operation, all mutations emit semantic creation events.

## Packet CS-010 — Audio waveform worker

Generate waveform peaks off the main thread and store compact derived visualization data locally.

Acceptance: long audio does not freeze UI; waveform derivation is deterministic; source audio never leaves device by default.

## Packet CS-011 — Audio render/export

Render edited audio projects locally to supported output formats using browser/WASM facilities.

Acceptance: rendered output matches edit graph; export event and output digest are recorded; cancellation/backpressure supported.

## Packet CS-012 — Audio recording hardening

Harden microphone recording across mobile/desktop browsers, interruptions, permission changes, and background/foreground transitions.

Acceptance: recoverable partial takes; explicit failure states; no phantom human-authored claim when recording failed.

## Packet CS-013 — Video editor engine integration

Integrate FreeCut/OpenReel-compatible primitives or equivalent local WebCodecs/WebGPU/worker pipeline behind the Creator Suite adapter.

Acceptance: multitrack clips, trim/move, overlays, basic transitions, offline operation, semantic provenance events.

## Packet CS-014 — Video render worker

Render video edits off the main thread with bounded memory and device-capability degradation.

Acceptance: cancellation, progress, low-memory fallback, deterministic export digest, no core-app freeze.

## Packet CS-015 — Video camera/screen capture hardening

Support camera/mic and screen capture with explicit source attribution and interruption recovery.

Acceptance: capture events are human-origin; imported prerecorded content remains external/unknown unless trusted provenance exists.

## Packet CS-016 — Video timeline UX

Build the mobile-first timeline, clip selection, trim handles, tracks, snapping, and keyboard/accessibility interactions.

Acceptance: usable on phone and desktop; no hidden image hotspots; all actions delegate to the video adapter.

## Packet CS-017 — Shared AI Creator API

Harden `CivweaveCreatorToolsV1` into a stable schema-validated tool interface usable by local, Guild, and Cloudflare AI routes.

Acceptance: explicit capabilities discovery, bounded arguments, actor metadata required, no DOM automation required for model edits.

## Packet CS-018 — Guide tool bindings

Allow Weaveling/Moss/Kamiya/Rook/Merlin to call installed Creator Suite actions through the existing unified chat capability path.

Acceptance: no second chat runtime; tool use is visibly attributed; absence of Creator Suite returns a clean install-required capability result.

## Packet CS-019 — AI generation ingestion

Normalize text/audio/video/image generation results into Creator Suite assets with immutable AI-origin events and provider/model/request metadata.

Acceptance: platform AI output cannot be mislabeled human-authored; provider failures are explicit.

## Packet CS-020 — AI transform operations

Support AI edit/transform requests against existing tracked assets rather than only full generation.

Acceptance: source and result digests recorded; transform remains attributable to the AI actor; human subsequent edits remain separate events.

## Packet CS-021 — Packet compression/chunking

Compress large creation histories and chunk them for bounded storage/transport while retaining verifiable commitments.

Acceptance: chunk loss/corruption detected; packet root deterministic; large projects stay within bounded memory.

## Packet CS-022 — Device key management

Move encrypted packet keys into a dedicated device key-management layer using non-exportable keys where practical, with explicit recovery/export flows.

Acceptance: keys are never put on the public ledger; recovery does not silently weaken encryption.

## Packet CS-023 — Encrypted packet vault

Store audit-eligible encrypted provenance packets locally with retention metadata and explicit user controls.

Acceptance: packets encrypted at rest, searchable by receipt/session metadata without decrypting content, deletions/retention enforceable.

## Packet CS-024 — Mesh provenance transport

Transport encrypted provenance packets/receipts through the canonical local object mesh.

Acceptance: same packet UUID converges across duplicate paths; mesh peers cannot read encrypted packet contents without authorization.

## Packet CS-025 — Guild provenance transport

Add opportunistic upload/download of encrypted packet envelopes and public commitments through the Guild service.

Acceptance: local creation never depends on Guild availability; retries idempotent; Guild sees only authorized metadata/envelopes.

## Packet CS-026 — Ledger creation receipt

Commit compact creation receipts/head hashes to the existing Civweave ledger without storing raw creative history.

Acceptance: receipt links artifact hash/session head/origin summary; ledger entry can independently prove later packet consistency.

## Packet CS-027 — SCITT-style transparency receipt

Implement a SCITT-inspired signed registration/receipt format around Civweave creation commitments.

Acceptance: issuer statement, registration receipt, verification API, no claim of formal SCITT conformance unless the implementation actually conforms.

## Packet CS-028 — C2PA export adapter

Embed suitable public provenance assertions/content credentials in exported media using vetted C2PA tooling.

Acceptance: local/browser processing where supported, exported media verifies with independent compatible tooling, private drafts are not embedded.

## Packet CS-029 — C2PA import verifier

Read and validate C2PA manifests on imported content and map trusted claims into external provenance metadata without overwriting Civweave history.

Acceptance: valid/invalid/unavailable clearly distinct; unknown remains unknown when verification cannot establish origin.

## Packet CS-030 — Portable creation receipt viewer

Build a lightweight receipt/C2PA/provenance inspector that can be used without opening a full editing project.

Acceptance: verifies hashes/signatures locally; explains what is known versus unknown; never labels unknown as AI by inference.

## Packet CS-031 — Daily Guild sampler

Select a privacy-bounded sample of recent eligible creation receipts/packets for Guild review.

Acceptance: deterministic/auditable sampling policy, configurable rate, disputes prioritized without making every artifact subject to review.

## Packet CS-032 — Provenance anomaly engine

Detect broken chains and suspicious creation patterns such as bulk external paste/import, impossible ordering, altered actor envelopes, or missing commitments.

Acceptance: outputs anomaly evidence and confidence; never claims AI authorship solely from style/detector inference.

## Packet CS-033 — Model provenance reviewer

Create the bounded model-review task that inspects sampled decrypted packet evidence and returns a structured provenance finding.

Acceptance: schema-constrained findings, no raw packet retention in model logs beyond policy, unknown is a first-class outcome.

## Packet CS-034 — Human tribunal review surface

Create a human review UI for sampled/disputed provenance packets using Cerbanimo Quest Beat work semantics.

Acceptance: minimum necessary evidence disclosure, reviewer conflicts excluded, signed/additive review result, creation origin immutable.

## Packet CS-035 — Cerbanimo Quest Beat audit integration

Materialize scheduled/sample provenance reviews as Cerbanimo Quest Beats using the existing Quest Beat/work receipt architecture.

Acceptance: no parallel task system; completion produces signed review receipt; private evidence stays protected beneath public work receipt.

## Packet CS-036 — Audit retention and deletion policy

Implement configurable local/Guild retention windows for encrypted detailed histories versus long-lived public receipts.

Acceptance: public commitment can survive detailed packet deletion; user-facing policy is understandable; legal hold is not invented implicitly.

## Packet CS-037 — Import quarantine

Create a safe import path where external media enters as `unknown` until trusted provenance is verified.

Acceptance: imported AI content cannot acquire human-authored status through normal editing/import UI; user can still work with unknown content.

## Packet CS-038 — Provenance disclosure badges

Create consistent artifact badges for Human Authored, AI Generated, Deterministic, Mixed/AI-assisted presentation, and External/Unknown.

Acceptance: badge language derives from verifiable event data; public presentation can distinguish origin from later assistance/review.

## Packet CS-039 — Mixed-origin contribution summary

Compute non-deceptive contribution summaries from operation history without pretending event counts equal intellectual contribution percentages.

Acceptance: exposes counts/durations/spans where meaningful; avoids unsupported percentage-of-authorship claims.

## Packet CS-040 — Cross-device project transfer

Export/import complete encrypted Creator Suite projects between devices while preserving session history and commitments.

Acceptance: verification survives transfer; keys/recovery explicit; import never silently forks identity or rewrites origin.

## Packet CS-041 — Passport actor binding

Bind local human creation events to the canonical Passport identity using privacy-preserving pseudonymous actor references/signatures.

Acceptance: no Creator-Suite-only identity store; key rotation/history handled explicitly; public receipt need not reveal the user's public username.

## Packet CS-042 — AI actor signing

Bind platform AI events to authenticated model/provider route metadata so later edits cannot relabel an AI operation as human.

Acceptance: signature/attestation survives packet transport; failed attestation downgrades trust rather than inventing provenance.

## Packet CS-043 — Local timestamp/clock hardening

Make ordering robust against user clock changes and offline periods using monotonic/session ordering plus signed checkpoint time when available.

Acceptance: wall-clock changes do not invalidate legitimate sessions or allow event reordering to pass verification.

## Packet CS-044 — Adversarial provenance test suite

Attack event deletion, insertion, reordering, actor rewrites, packet truncation, duplicate replay, clock manipulation, key substitution, stale receipts, and forged imports.

Acceptance: deterministic tests for every attack; clear documented residual trust assumptions.

## Packet CS-045 — Mobile performance budget

Set and enforce CPU/memory/storage budgets for text/audio/video creation on low-resource phones.

Acceptance: no expensive engine starts until user enters that editor; bounded previews; graceful capability reduction instead of hangs.

## Packet CS-046 — Accessibility pass

Make all Creator Suite creation, provenance, timeline, review, and install controls keyboard/screen-reader/touch accessible.

Acceptance: semantic controls, focus management, labels, reduced-motion support, contrast and mobile hit targets checked.

## Packet CS-047 — Vendor/license audit

Audit every third-party editor/provenance dependency, record license/attribution/redistribution obligations, and reject ambiguous licensing.

Acceptance: machine-readable inventory plus human-readable notices; no dependency enters shipped package without an explicit compatible license.

## Packet CS-048 — Offline vendor bundling

Vendor approved third-party JS/WASM/assets into the optional Creator Suite package instead of relying on CDNs.

Acceptance: fully functional offline after suite download; integrity/version metadata pinned; core Civweave package remains unchanged.

## Packet CS-049 — Creator Suite update migrations

Add schema migrations for IndexedDB/project/provenance storage across Creator Suite versions.

Acceptance: old projects open after updates; migration is transactional/recoverable; provenance hashes are not silently rewritten.

## Packet CS-050 — Crash/recovery journal

Journal unsaved editor state and restore after browser/process/device interruption.

Acceptance: recovery never fabricates missing provenance events; partial recovered content is clearly marked when origin evidence is incomplete.

## Packet CS-051 — Project browser

Create a local Creator Suite project browser with text/audio/video type, provenance state, modified time, and storage size.

Acceptance: reads local metadata without decrypting unrelated audit packets; delete/export actions explicit.

## Packet CS-052 — Public provenance explanation

Create the user-facing explanation of what Creator Suite provenance proves, what it does not prove, and how external/unknown content is treated.

Acceptance: no detector-overclaiming; privacy model and audit sampling explained plainly.

## Packet CS-053 — Guild audit policy controls

Let Guilds configure sampling rates, reviewer pools, retention, escalation, and human/model review balance within platform safety/privacy limits.

Acceptance: Guild policy cannot rewrite origin semantics or silently opt members into raw-history disclosure beyond the agreed participation contract.

## Packet CS-054 — Sampling fairness/resistance analysis

Test whether creators can predict/avoid sampling or whether sampling disproportionately targets specific content/users.

Acceptance: documented threat model and deterministic simulations; recommended policy changes encoded where appropriate.

## Packet CS-055 — Dispute/appeal flow

Allow creators to challenge broken/anomalous review findings without rewriting immutable creation history.

Acceptance: appeal is additive signed history; reviewer evidence and decision chain auditable; final status distinguishes origin from review outcome.

## Packet CS-056 — Export verification regression corpus

Maintain representative text/audio/video outputs and verify receipts/C2PA survive supported export paths and expected benign transformations.

Acceptance: CI regression corpus with hashes/expected verification outcomes; unsupported transformations documented.

## Packet CS-057 — Content provenance API fuzzing

Fuzz session/event/packet inputs for malformed types, extreme sizes, cyclic/hostile values, Unicode edge cases, and serialization ambiguity.

Acceptance: bounded runtime, deterministic canonicalization, no hash-equivalence ambiguity found in covered cases.

## Packet CS-058 — Creator Suite security headers/sandbox review

Review CSP, permissions policy, media permissions, downloadable-file handling, worker isolation, and cross-scope service-worker interactions.

Acceptance: least-privilege headers/policies compatible with offline editor needs; no unnecessary broad camera/mic permissions.

## Packet CS-059 — Separate-download automated contract

Extend CI so any future attempt to add `/creator-suite/` to the ordinary Civweave offline package fails.

Acceptance: package isolation is an executable invariant across package/build scripts, not only prose.

## Packet CS-060 — End-to-end provenance scenario suite

Automate representative human-only, AI-only, AI-assisted, imported-unknown, C2PA-imported, offline, mesh-sync, Guild-audited, and disputed creation journeys.

Acceptance: each scenario reaches the expected receipt/origin/audit state with no silent fallback.
