# Worldweaver · book and author insights to feature-film bones

**Status:** implemented testable foundation, not a generated film, native ArtCraft importer, deployed Gemini route, actual Codex execution, or fine-tuning job.

**Canonical source:** `public/app/shared/worldweaver-performance-studio-v1.mjs`, `worldweaver-adaptation-model-v1.mjs`, `worldweaver-stagecraft-v1.mjs`, `worldweaver-filmcraft-interchange-v1.mjs`. Extend these instead of creating another independent chat, movie production store, world simulator or authoring authority.

**This increment:** `public/app/shared/worldweaver-film-bones-v1.mjs`, browser lab `public/app/tools/worldweaver-film-bones-lab.html`, test `scripts/test-worldweaver-film-bones-v1.mjs`.

## The production contract

Actual director/author: selects source manuscript edition, approves author insights for transmission, resolves canon, accepts costs, chooses takes, approves final sound and release.

Gemini Flash: selected Civweave model for **small, bounded first-draft batches**, not a replacement for the author's intentions or an architecture designer. One batch generates 1–24 explicit shots with 24 fps frame counts (48–360 frames, 2–15 s), spatial camera start/end, actor blocking, purpose, lighting, set continuity and temporary audio directions. Preserve actual provider response and tool receipts. Model version is read from configured runtime, never silently switched.

Codex: human-style **implementation/editor/operator** for actual source changes, tests, pipeline repairs and recorded results; **not** an authenticated human principal permitted to consent, spend, approve rights, vote or publish. Task request → claim → patch.ready → cryptographic SHA-256 verification → explicit apply → ack. A GitHub issue/branch is not evidence of an invoked Codex worker.

ChatGPT/advanced editorial reviewer: resolves nuanced interpretation, book chronology, cross-world time mechanics, POV, autonomy, technical design and complicated bug triage; creates constraints/repairs for Codex and Gemini instead of hoping Gemini guesses the author's meaning.

ArtCraft: receives directed shot compositions, locations, camera and character blocking **after** human review; proposed JSON is a portable direction package, not a verified native import format. Inspect actual ArtCraft interface/API and independently verify live clip input/output receipts, limits, version and charges before automation.

Sound: ask ArtCraft for its strongest contextual **reference** sound, but preserve it on a muted/nonfinal review track. Human-directed dialogue/ADR, Foley, ambience, effects, score, music licensing, editing and final mix replace it. Do not ship generated reference stems unintentionally.

## Implementation ramp and acceptance

| Gate | Output | Pass condition |
| --- | --- | --- |
| R0 Baseline | Exact author-chosen rights-cleared book edition, source hash, spoiler ledger, private author notes, existing-stage capability audit | No private text in repo/training; canonical owners identified |
| R1 Vertical slice | One synthetic reviewed scene → 1–24 validated shots, stage directions, reference audio notes | Zero invented source/actor refs, exact frame time, clear visual action and continuity, real review |
| R2 First actual chapter | Saved author-insight + manuscript references, Gemini streamed batches, Codex fixes and editorial approvals | Source-to-shot trace, real provider/patch receipts, no auto re-generation |
| R3 Complete 10–20 min reel | Global, sequential shots with editable camera and actor staging | Continuous timecodes, no duplicate IDs, re-openable handoff, reference audio separate |
| R4 Feature-length bones | All approved scenes, target 75–110 min per director's choice | No skipped scenes, duration/coverage gates, scalable bounded batches, deliberate choices rather than filler |
| R5 ArtCraft proof | Authorized physical/2D composition, real video takes and job receipts | Actual model and app/version compatibility, editable shot matching, costs and failures reported |
| R6 Human final mix | Approved visual cut + original human sound | Generated audio excluded from final master, source and music licensing and review captured |
| R7 Improvement | Human-rated corrections, training and held-out evaluations | Real examples only, train/validation split by project, Qwen 3.5 4B baseline versus tuned candidate measured |

85-minute film with six-second average shots is approximately 850 separate takes. Do **not** ask Gemini to produce one giant film in one request. Batch 1–24 at a time and keep every revision/checkpoint. The frame-index assembler provides global starts and ends and reports gaps in approved-scene coverage and runtime instead of inventing filler.

## Manuscript / headcanon constraints

Use distinct Landry/Delia and Magnus/Maggie perspective lines, with independent inner-persona agency and voluntary executive exchanges. Maggie's narrative voice can arrive retrospectively from different future times and is actually dictated into the in-universe manuscript. Do not synchronize physical and In-Between clocks for editing convenience. Maintain the Book IX final-line firewall; Part III begins in another publication. Alternate physical universes have material/energy costs and counterpart consent. The author can approve exceptions only deliberately via a versioned insight note.

A **source record** includes edition ID, source passage ID, cryptographic digest, permissible context tier and spoiler level. An **author insight** is independently versioned, with `approvedForModel` and separate training permission. Do not send confidential notes merely because they exist in Civweave. Every staged shot links to approved screenplay source IDs, with all unsupported causal claims escalated, not filled in.

## Actual code and UI

- `validateShotBatch(state,batch)`: source-bound, reviewed scene only; finite duration/camera/actor positions; strict source and prop checks; refuses fabricated `renderStatus`.
- `makeGeminiShotTask(state,sceneId,options)`: consented invocation packet that contains approved scene and only explicitly model-approved insight notes. This does **not** call Gemini.
- `assembleFilmBones(state,batches,{targetMinutes})`: deterministic global frame positions, scene coverage and runtime gaps, per-shot ArtCraft-direction text and explicit reference-vs-final sound controls. This does **not** render clips.
- `makeCodexFilmTask(...)`: unassigned request with goal, branch, real base SHA, acceptance tests, patch/ack requirements and author-approval firewall.
- `exportCivweaveFilmTraining(records,{ownerTrainingAuthorization})`: JSONL SFT/validation examples only from genuine successful Gemini receipts, actual applied Codex commits, human approval, rights and training permission. No private manuscript body, hidden reasoning or audience data.
- `worldweaver-film-bones-lab.html`: private local JSON import/export, responsive shot validation and assembly, bounded Gemini/Codex request packages, verified-receipt training export. Its buttons make no hidden API requests.

## Codex implementation queue (not yet executed by Codex)

**C1 — Live inference:** Connect the new shot-task contract to the *existing* configured Civweave Gemini streaming provider. Enforce consent, actual model selection, rate governor, no Cloudflare neuron fallback, streamed visible checkpoints, cancellation, idempotence and JSON quarantine. Record user-visible success/failure receipts. Repair/retry only the failed batch.

**C2 — Source & insight binding:** Persist indexed source/insight metadata under the existing owner and exact revisions, enforce private and spoiler scopes, and invalidate dependent approvals after source changes. Keep author notes protected and hash validation meaningful, not decorative.

**C3 — ArtCraft verified adapter:** Inspect current ArtCraft Studio/FilmCraft supported export/import interfaces instead of assuming native JSON import. Prove one real blocking/camera/pose/shot handoff with a rendered 2–15s clip and receipts. If native import is unavailable, use an honest editable manual interchange and document the missing adapter.

**C4 — Reel continuity:** Reconcile camera screen direction, actor eyelines/positions, props, transitions, color/lighting, edit pacing, subtitles and retakes over 10 minutes. Export a real editable timeline, preserving actual media hashes and separate generated-reference-audio tracks.

**C5 — Evaluation/training:** Capture *real* model drafts, source-grounded critiques, Codex diffs, tests, human review scores and amended approved plans. Project-level holdout splits, no duplicate leakage; test source fidelity, dramatic quality, timing, positioning, human editing minutes, shot usability, and output costs.

## A training record is evidence, not aspirational text

The ramp documentation is an **instruction/curriculum artifact**, not a fake successful execution sample. A legitimate example has: `projectId`, `sceneId`, source SHA-256, ownership/training consent, safe bounded input, actual `model.provider=gemini` and success receipt, applied Codex SHA, producer approval reference, and producer-approved final shot plan. Store rejected drafts and actual corrections as separately observed preference feedback; no invented hidden chain of thought.

Training categories: source-aware adaptation; original art direction; actor blocking and readable gestures; camera choice and movement; frame timing/edit rhythm; continuity across shots; explicit ambiguity escalation; ArtCraft job/asset receipt validation; temporary generated audio versus human final mix. Score deterministic blockers (zero fabricated sources, non-finite positions, unapproved edits and fake renders) separately from human 1–5 ratings (emotional intent, dramatic clarity, motivation, shot transitions, character consistency and timing). Measure untuned Qwen 3.5 4B against the eventual LoRA only on held-out projects.

## Integration reality

The official ArtCraft pages establish visual scene composition, image-to-location, actor posing, and video generation, not this specific manifest's native import. Current feature source and browser lab create **reviewable preproduction data**, not hosted world simulation or a finished movie. Run project tests, CI and genuine clip verification before claiming ArtCraft/Codex/Gemini end-to-end integration.
