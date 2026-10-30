# THE THRESHOLD — Civweave-first creation passover for Codex / Sol

**Issued:** 2026-10-30  
**Target:** `cerbanimo-dev/Civweave`, development base `staging`  
**Status:** implementation directive and process handoff, not proof of a live end-to-end run  
**Mission:** Establish Civweave as the working environment, planning authority, artifact store, and review trail for the user's future AI-assisted creations. Prove the process first with Worldweaver's manuscript-to-animated-film pipeline.

> **Operating rule:** Draft rapidly with the configured Gemini API stream inside Civweave; checkpoint; have a separate editorial agent (ChatGPT or another authorized reviewer) make concrete human-style revisions through Civweave tools; revalidate and advance using the canonical step-specific Civweave contract. No planning pass is an unrecorded side conversation; no manual plan injection triggers a duplicate model run.

## 0. Read this first — what exists and what is not yet real

- PR [#902](https://github.com/cerbanimo-dev/Civweave/pull/902) merged the **staging** Worldweaver Performance Studio foundation: private manuscript excerpts, bounded scene proposals and review, staged set proposals, cast bindings, local 3D/2D mockups, rehearsal score, optional audience interaction, portable film-edit interchange, and a Qwen 3.5 4B SFT-data export. The lab is at `/app/tools/worldweaver-performance-lab.html`. Neither the film nor a LoRA has been produced.
- PR [#901](https://github.com/cerbanimo-dev/Civweave/pull/901) established shared transformed geometry for 3D preview and 2D projection. **No authenticated live OpenSimulator bridge** or proven real-host avatar control yet.
- `public/app/guide-capability-passover-v1.js` already owns **guide-to-guide** handoff semantics under `civweave.guide-capability-passover.v1`. Preserve that existing contract and ownership; this Codex document is a development passover, not an excuse to invent a rival passover engine.
- Gemini selection, routing, direct-device requests, and rate pacing exist in `public/app/gemini-task-tier-router-v213.js`, `gemini-device-direct-v257.js`, and `gemini-rate-governor-v1.js`. Verify real runtime streaming capabilities instead of assuming the presence of a file implies a working token stream.
- The user-facing Opera/Civweave browser connection was unavailable when this handoff was prepared. Source and PR inspection were possible through GitHub; **no live Civweave plan was created or validated in its web UI** as part of preparing this document. Codex must perform and record that missing first pass once authenticated access is available.

**Do not choose a manuscript silently.** There are multiple story projects. Use a synthetic rights-cleared test excerpt for development, then ask the producer to identify an exact owned/licensed/public-domain manuscript and edition before a genuine adaptation. Do not publish source excerpts or personal audience data into Git.

## 1. Non-negotiable operating doctrine

1. **Civweave-first:** An Intention enters the canonical Civweave/Weaveling intake. Each subsequent planning action belongs to a named owner/guide and a durable Civweave artifact. External assistants may help create content but do not become a shadow source of truth.
2. **Civweave's real step prompt:** Obtain the authoritative runtime's effective stage/guide contract, required output shape, validation rules, and source revision through its existing authorized interfaces. The editor follows that contract while preparing the next artifact. Do not invent a purported internal system prompt, overwrite safety constraints, or expose private prompt content to untrusted models/clients. Store a digest and source revision, not secret material.
3. **One first-generation pass:** Call the user-configured, authorized **Gemini API streaming route** for fast initial draft creation within Civweave. Capture progress and partial text with checkpoints. No key in logs, client exports, Git, or training records. Honor the existing provider budget, explicit remote-data consent and selected profiles.
4. **Editor in the loop:** ChatGPT, Codex/Sol or another delegated editorial agent then reads the initial draft and applies **concrete, saved edits/redrafts through Civweave's edit tools**: clarity, completeness, continuity, factuality, dramaturgy, accessibility, and deterministic structure. Preserve every revision and rationale. An assistant can perform editorial work but must **not impersonate an authenticated human principal** for protected approval/publishing/consent/finance/voting.
5. **No double generation:** When a plan is already authored or revised externally, invoke a **trusted manual-plan insertion path** that validates and materializes the supplied content against the real stage schema, without calling the language model again. Distinguish `generate-first-draft` from `import-authored-plan` in UI, logs, costs, and tests.
6. **Guide passovers:** Use the canonical guide-capability passover for owner transitions (Weaveling → Moss/Living School, Kamiya/Cerbanimo, Rook/FellowFare, Merlin/Anarchadia). Preserve source text, relevant scope, user consent, target artifact class, and the requirement that the receiving guide genuinely own the operation. Do not fork a planner per screen.
7. **Human authority remains real:** Producer signoff, asset licensing, cloud budget, irreversible actions, Guild publication, formal voting, and training consent require the corresponding actual authorized principal. Editorial satisfaction is not permission.
8. **Local-first with an explicit cloud first-draft exception:** Save and review offline where possible; disclose Gemini usage and never upload private material without consent. Local Qwen can execute later bounded steps, rehearse, or become a fine-tuned target; it is not obliged to generate enormous one-shot outputs.
9. **Honest state:** Display `draft / reviewed / validated / authorized / executed / acknowledged` distinctly. Model text never establishes that a renderer, deployment, OpenSimulator, video export, or training job actually ran.
10. **Repair in the same workflow:** Failures create preserved partial artifacts, precise errors, repair tasks and resumption points—not silent restarts or invented success. Human-readable receipts distinguish intent from trusted backend execution.

## 2. One shared creation-run contract

Design a schema under the existing canonical capability owner (name below is a **proposal**; do not silently declare it installed):

~~~json
{
  "schema": "civweave.creation-run.v1",
  "id": "opaque",
  "intentionRef": "canonical-intention-id",
  "ownerSystem": "civweave",
  "artifactClass": "plan",
  "stage": "plan",
  "stageContract": {
    "sourceModule": "canonical-stage-owner",
    "revision": "verified-revision",
    "promptDigest": "sha256:...",
    "outputSchema": "canonical-existing-schema"
  },
  "inputs": [{"artifactRef": "source-id", "revision": 1}],
  "passes": [{
    "kind": "model-draft",
    "provider": "gemini",
    "model": "actual-selected-model",
    "state": "checkpointed",
    "artifactRevision": 1,
    "toolReceiptIds": []
  }, {
    "kind": "editorial-revision",
    "principalKind": "editor-agent",
    "baseRevision": 1,
    "artifactRevision": 2,
    "changeSummary": "specific verifiable edits"
  }, {
    "kind": "manual-plan-insert",
    "provider": "none",
    "baseRevision": 2,
    "artifactRevision": 3,
    "inferenceInvocations": 0
  }],
  "validation": {"state": "pending", "issues": []},
  "authorization": {"state": "pending", "authorizedBy": null},
  "execution": {"state": "not-started", "receipts": []}
}
~~~

This is an orchestration/event envelope, **not** a second Quest, curriculum, commerce, governance, screen, or film-content database. Refer by canonical IDs. Use revision guards, provenance, idempotency keys, minimal context exposure, immutable journal entries, explicit actor distinctions, and strict size caps.

Stage prompts are a composite of policy, active guide role, artifact schema, bounded user request, and current canonical context. Log the origin/version/digest. During manual insertion, execute the same deterministic validator and materializer as the ordinary generated response. Reject invalid fields with editable diagnostics. Skip both initial inference and recursive “continue generating” invocations.

## 3. Exact orchestration sequence for every project

| Phase | Operation in Civweave | Who proposes / who authorizes | Required saved evidence |
| --- | --- | --- | --- |
| 0. Intake | Classify intention, target guide, scope, permitted data and resource budget | Weaveling routing; user choices | Intention ID, route, context constraints |
| 1. Plan | Compose stage-shaped plan using the **actual** guide/stage contract; insert via manual path if already written | AI/editor authors; canonical validator owns structure | Plan revision, prompt-contract reference, zero-inference receipt for manual plan |
| 2. Draft | Stream a bounded first draft using the **configured Gemini route**, where permitted | Gemini suggests, never self-approves | Chunk/checkpoint progress, provider/model, terminal status, draft |
| 3. Edit | Inspect the draft, correct it, redraft weak sections, bundle permissible tool edits | Editorial agent; true human approval where mandated | Diff, revision history, commentary, tool outcome |
| 4. Check | Validate schema and content against guide/owner rules, sources, tests and task rubric | Deterministic validators + editorial reviewer | Machine-readable failures / QA report |
| 5. Repair | Create specific corrective edit tasks; rerun only failed stages and tests | Editor + bounded model assistance | Checkpoints, cancellation acknowledgment, revised pass |
| 6. Pass | Transfer to an owning subsystem with standard passover when needed | Explicitly permitted owner | Source/target IDs, preserved context, target acceptance |
| 7. Act | Create tools' *intents*; apply only via trusted runtime or authorized human | Trusted execution provider | Execution/renderer/deploy receipts and rollback refs |
| 8. Publish/export | Release artifact or source it into the next phase only after relevant review | Authenticated human / canonical owner | Final revision, provenance, consent, export manifest |

**Every new plan, subplan and replanning event loops through phases 1, 4, 5 as needed.** Do not skip Civweave just because ChatGPT or Codex can draft the plan faster outside it. Do not make the producer press a "Generate again" button to import content that already exists.

### Streaming, concurrency and stop semantics

- Separate browser cancellation, HTTP stream abort, model generation-slot cancellation, and persisted artifact rollback. Show which actually completed. A stopped UI is **not** evidence a Termux/desktop/hosted inference slot is idle.
- Bound token output by section and batch, checkpoint completed chunks, require valid end markers and structured validation before materialization. Preserve the last complete checkpoint if a later section fails.
- Prevent overlap for the same model slot and artifact revision. Expose busy/stop/repair/resume states, and make retries idempotent with explicit consent if they cost money.
- Small local models may bundle up to **three** editing actions; retain the larger-model/cloud policy and platform limits (currently up to **64** where configured), without bypassing tool schemas or action authorization.
- Make the editor's full work visible: original draft, changed phrases/sections, structured diff, test results, why revision was necessary, what still requires user approval.

## 4. The flagship vertical slice — Worldweaver Performance Studio

**Goal:** Adapt one producer-selected chapter from an owned/authorized book into a reviewable script, a physically navigable stage, an avatar rehearsal, a participatory performance, a verified editable film sequence, and (later) quality-reviewed training examples. Preserve the long-term target of a full-length original animated fantasy film.

**Existing starting modules:**
- `public/app/shared/worldweaver-performance-studio-v1.mjs` — reviewed production state, stage/cast/rehearsal/audience records, host-owned authorization.
- `public/app/shared/worldweaver-adaptation-model-v1.mjs` — bounded selected-model screenplay/set proposals. `productionPrompt(...)` is a relevant **current real step contract**; new universal orchestration must compose with it.
- `public/app/shared/worldweaver-stagecraft-v1.mjs` — approved scene → deterministic stage and timecoded score.
- `public/app/shared/worldweaver-opensim-geometry-v1.mjs`, `worldweaver-map-2d-v1.mjs`, `worldweaver-3d-preview-v1.mjs` — same-state geometry/projection.
- `public/app/shared/worldweaver-filmcraft-interchange-v1.mjs` — portable timeline, captions, approved examples; **not** native FilmCraft import, rendering, or LoRA execution.
- `public/app/tools/worldweaver-performance-lab-v1.mjs` — existing experimental UI and provider selection; its lab-local actor identity is not real Guild authentication.

**Film process:**
1. **Source + rights:** Producer chooses exact manuscript/edition. Privately import chapter excerpts with source hashes, continuity notes, tone constraints, adaptation rights and consented provider-selection record. Capture a continuity bible and story-level style brief using entirely original visual direction.
2. **Screenplay:** Gemini streams 1–3 bounded scene drafts per tool request, following the saved `productionPrompt` and validated output shape. Editorial assistant performs actual line/scene revisions in the editor. An authorized human reviews the story decisions before stage creation. Preserve source-to-scene links.
3. **Stage and rigs:** Compile approved screenplay into the single geometry authority. Build sets, props, lighting/camera/cue blocking, 3D preview and exactly matching 2D footprints; keep verified vs inferred geometry explicit. Use the established rig/avatar authority, not new shadow persona records. Implement a trusted OpenSimulator region/actor adapter with real ACKs, ownership and rollback before calling any stage live.
4. **Rehearsal:** Run timecoded character movement, dialogue, gesture, sound and screen cues against a *real* renderer; collect pass/fail action receipts. Allow controlled reblocking and partial replay without changing approved text silently.
5. **Audience:** Announce moments for voluntary questions, improvisation suggestions and reflection. Accept typed or opt-in speech-transcribed feedback (with text fallback). Capture consent per use, enable withdrawal, and never infer emotional state or identity from faces/voices without consent. Audience response can inform optional revisions but does not rewrite approved canon automatically.
6. **Film assembly:** Produce original shot/camera/animation/voice/asset jobs with editable timing, subtitle VTT, asset hashes, provenance and render receipts; implement a verified importer to the actual available FilmCraft/ArtCraft target rather than calling a planning JSON file a finished movie. Keep missing-media markers honest. User's references to expressive interior emotion, safe-but-dark theatrical fantasy and beautiful surreal landscapes are *high-level goals*, not permission to imitate named studios' distinctive visual signatures.
7. **Training loop:** Collect only actual prompt, visible model output, tool intents, trusted outcomes, editorial patches, reviews and final approved scenes. Exclude hidden chain-of-thought, private unpublished manuscript text where training rights are absent, and audience content without separate revocable training consent. Build scene/project-grouped validation splits, measure baseline Qwen 3.5 4B against LoRA on held-out work, publish only on measurable improvement with rollback.
8. **Scale:** Once the chapter slice truly works, expand to acts, then a full script/storyboard/production calendar and feature-length animated assembly. Avoid pretending the first prototype proves scalability.

The first film milestone is a **single verified scene** with a producer-approved script; saved editorial diffs; matching 2D and 3D state; one genuine trusted actor/action receipt or an explicitly marked simulation if no provider exists; an audience moment with optional input and withdrawal; and a portable editable cut with honest media placeholders. No completion claim until observed end to end.

## 5. Codex/Sol implementation assignments, in order

### A. Capability inventory / source-of-truth check

Read `AGENTS.md`, `config/agent-work-context.json`, `docs/architecture/repository-map.md`, `docs/contracts/mobile-interface-contract.md`, `docs/architecture/systems-of-practice.md`, `config/system-ownership.json`, and `docs/contracts/worldweaver-microspaces-v1.md`. Identify the actual current stage prompt composers, generated-plan materializers, editor tools, passover owner, selected inference adapter, Gemini streaming, storage and authority boundary. Produce a short evidence matrix: *working in actual deployed staging / source-only / simulated / missing / blocked*, with file paths, tests and receipts. Do not infer live status from source alone.

### B. Universal creation session and manual insertion

Integrate a bounded session/journal and stage-specific manual-plan-insert tool into existing owners. Stage contract must be captured at invocation and applied equally to Gemini-authored, local-model-authored, and editorially authored plans. Reuse authoritative structured validators and tool-based editor; no second planner, hidden re-inference, shadow state, or generic unrestricted code execution. Save exact tool outcome and provenance.

### C. Streaming first pass and real editorial loop

Wire the existing configured Gemini streaming route into the canonical task tool. Use streaming status, checkpointing, stop/idle differentiation, rate budget, consent and structured parse finalization. Expose draft → editable sections → revision → review → commit in UI; ensure small-model 1–3 edits are accepted and revisions returned before the next call. Large/cloud models retain higher authorized action budgets.

### D. Guide handoff and resume

At every owner change, call `civweave.guide-capability-passover.v1` through its existing API/UI. Avoid automatic resubmission that invokes another generation when an approved complete artifact can be handed off by reference/manual insertion. Resume after offline, timeout and midstream failure from checkpoint with correct revision/authorization, without duplicating work.

### E. Film slice and genuine integrations

Apply shared pipeline to Performance Studio; replace demo-only controls with authenticated interfaces progressively, then implement/test the missing hosted OpenSimulator avatar/region bridge, actual audio/media/render pipeline, native editor import and eventually LoRA runner. Every external integration is a separate capability gate with a clear adapter, permissions, budget, telemetry, fallback and verification.

### F. Developer experience, verification and delivery

Use staging for changes and PRs. Add contract and negative-path tests for manual insertion's **zero model calls**, stage prompt parity, no self-approval, Gemini streamed checkpoints, cancellation and slots, editor revision conflicts, exact output schemas, guide passovers, source/consent boundaries, and film 3D↔2D parity. Run `npm run test:worldweaver` and the applicable existing canonical suites. Test the installed staging PWA on desktop and Android/mobile safe areas; verify service worker asset integration, offline path, producer review actions, and end-to-end receipts. Do not hide existing CI failures by deleting checks. Stop before production promotion until user approves and tests pass.

## 6. Definition of done — two gates

**Gate 1: Universal creation workflow**
- [ ] Real staging Civweave session receives an Intention and a complete external authored plan through an authorized **manual import**, with **zero additional inference calls**.
- [ ] The active guide/stage prompt contract and validated schema are recorded by source/revision and actually enforced on imported content.
- [ ] A consented Gemini call **streams**, checkpoints, resumes/aborts accurately; editor tools persist concrete revisions and diffs; deterministic checks succeed or return reparable failures.
- [ ] Every new planning pass appears in the same Civweave artifact history, and guide passovers preserve authority and provenance. No human identity spoof or autonomous publish.

**Gate 2: Film chapter slice**
- [ ] An authorized manuscript chapter produces an editorially revised, producer-approved screenplay with source traceability.
- [ ] Stage, rig, 3D and 2D views preserve stable identities and revisions; trusted action receipts are distinguishable from lab simulation.
- [ ] Rehearsal and optional audience moment preserve opt-in, consent withdrawal, text fallback and transcript/cue timing.
- [ ] Editable film interchange is validated in the **target** editor, or explicitly labeled unintegrated. No fabricated clips, completed film, or LoRA.
- [ ] All applicable automated tests and actual staging/device smoke tests have reported outcomes and rollback instructions.

## 7. First work session: concrete instructions to Sol

1. Read repository authority files, PR #902 and this handoff. Inspect the actual deployed staging and record which steps are real.
2. Create a Civweave Intention named **“The Threshold: Civweave-first Hybrid Creation Workflow”**. Use Weaveling's true planning stage contract to **manually insert this work plan**, not regenerate it with a second model. Save Intention/plan IDs, stage contract revision and tool receipts. If UI or authorization is unavailable, record the blocker and continue only source-level implementation without claiming in-app execution.
3. Implement a minimal guided test: Gemini streams a short original draft → editor deliberately changes three phrases and restructures one section → Civweave validates and materializes the revisions with no extra generation → authorizing human sees accurate change history.
4. Make this work for the actual user-facing creator/editor and one guide-to-guide passover, then integrate Performance Studio.
5. Create the chapter demonstration only with an explicitly authorized source. Report *what ran, what failed, what remains simulated, costs/consent, test outputs, and next unblocked step*. Keep branch-based staging PRs with honest acceptance evidence.

### Sol's opening instruction

**Do not rebuild Civweave around the film project. Make the film project the first rigorous consumer of Civweave's existing planning, tool, editing, approval, mesh/local-first and creation contracts. Treat every draft, correction, approval, passover and runtime result as an inspectable artifact. The intent is not simply to generate more content: it is to demonstrate that a mixed AI/editor/human team can reliably produce and improve complex creative work inside one accountable system.**
