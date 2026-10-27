# Staging QA running log and follow-up projects

Updated: **2026-10-27**. This is the current working record for the staging mascot QA session. Update the existing IDs as work progresses; add new IDs for new findings. This is a test and project record, not an architectural contract.

## Current instruction and test environment

The user's current priorities include **screen-by-screen visual repairs, the restored Guild Quest carousel and explicit member submission, visible Quest maps, and satisfying animated progress/review feedback with the AI friends and Lari the Lyrebird**. The Qwen3.5 4B results and unfinished AI acceptance gates remain recorded below. Keep recording every observed or user-reported issue as a bounded follow-up project.

The authorized scope includes taking fictional local QA records through their real lifecycle when possible. Do not invent physical proof, purchases, counterparties, messages, votes, or settlements to make a test appear complete. Saved user chats must be preserved.

| Item | Recorded state |
| --- | --- |
| Source checkout | `C:\Users\glaed\Downloads\civweave-launch\staging-ai-cors`, branch `fix/staging-ai-cors` |
| Integration target | `staging`; no shipping/main deployment is claimed |
| Current exact live marker | `05731d1c9f44c0f067700943a0b54c0d2b06815b`, exact live marker verified 2026-10-27; Guild publication, private Quest maps, official-design Lari sprites and canonical review/revision controls are deployed |
| Deployment / focused app CI | Deploy `40442009143`, Guide Full DOM Startup `40442009291`, System Radio `40442008929`, first-frame recovery `40442008979`, Termux controls `40442008948` and Moss manual-plan/bounded-prefill `40442009247` succeeded. Full local Guide workflow: 209 passing cases. This is not a claim that every legacy repository check passes. |
| Earlier browser results | The four-path shelf draft and prior preview/proof results used `9e7a0cbd` or the specifically recorded earlier deployment; later checks identify their deployment explicitly. |
| Integrated upstream base | `f6a0e65a`, preserving multi-plan learning libraries and durable Termux jobs from newer staging work |
| Deployment marker | [staging-deployment-v1.json](https://civweave-staging.pages.dev/app/staging-deployment-v1.json) |
| Active browser entry | [persistent system shell](https://civweave-staging.pages.dev/app/persistent-system-shell-v1.html?system=anarchadia&installed=1) |
| Selected provider/model | Local Ollama / `qwen3.5:4b` |
| Local endpoint | `http://127.0.0.1:11434/api/chat` |
| Browser generation timeout | **600 seconds**, saved through Settings; earlier 300-second failures remain historical results |
| Device constraint | CPU inference, roughly 7.5 output tokens/second observed; run real inference sequentially |
| Shared chat contract | One chat runtime with five themes and isolated guide memory; do not create realm-local chat implementations |
| Before ending the QA session | Restore original campus intention **“Learn and memorize the tarot”** through normal UI, leave Qwen selected, and preserve chats and ledgers |

Evidence labels used below:

- **Live verified:** performed through the staging UI or observed actual local-model/network response.
- **Source/test verified:** deterministic checks or source tracing; this does not prove the complete live workflow.
- **Observed defect:** reproduced behavior that still needs a repair or acceptance check.
- **Hypothesis:** plausible from source or limited observation; reproduce before treating it as a defect.
- **Parked:** intentionally deferred by the current instruction. Uncommitted code is not deployed code.

### Latest deployment checkpoint

**October 26, live `bfbb48be`:** Guild search now mounts its full capacity/search dialog inside the current shell without installer navigation. Location was not requested and no Guild was joined. Direct-radio v2 played the unsaved Climate Change track; its network stream exposed a zero-length seek range, then an explicit seek loaded the verified memory copy and reached 0:40 while remaining paused. A second seek while playing reached 1:00 and continued playback. The track still offered **Save offline**, proving the seek preparation did not represent an offline save. Header and player stayed visible when a lower track control scrolled into view at 390×667. Previously saved Freedom in my voice played from a blob after the full app reload (duration 231.296 s); offline removal acceptance is being checked. Screenshots: `qa-guild-search-after-2026-10-26.png`, `qa-radio-layout-after-2026-10-26.png` in the wrapper workspace.

Saved-video display admission also passed live: the completed digital-note Endeavor still has 3/3 accepted units and its original evidence, while all three unrelated saved electronics videos show a mismatch explanation and a direct link instead of loading their players. Full-screen screenshot records the current entry; DOM inspection supplies the below-fold acceptance evidence. Library Back returned the parent to persistent Civweave and removed the nested modal. Map Back likewise returned the top wrapper to persistent Civweave. Freedom's offline removal settled to Save offline, verified after returning through those routes. Playback was paused and volume stayed 0.7.

**OPS-CI-01 update:** two older checks also fail on upstream `f6a0e65a`: Moss SSE readiness expects the superseded runtime query `1.0.16-ollama-request-thinking`; Termux transport isolation expects the superseded Guide query `1.0.186-draft-completeness`. Focused behavior checks above pass. These stale version assertions require their own maintenance and are not hidden as green checks.

### October 27 deployed acceptance

Pages deployment `40529301843` and Guide Full DOM `40529301994` succeeded for live `05731d1c`. Guild server deployment `40528080759`, Guild publication contract `40528080928`, Guide Artifact Lifecycle `40528080165`, and corrected radio CI `40528462997` succeeded in its lineage. The initial radio CI failed after the builder alignment because its release placeholder became literal; restoring the release-version interpolation fixed that affected contract without changing current worker bytes.

**Live verified:** the normal current-Quest Review button now opens the canonical private four-lane map, including the separate governance layer; a Cerbanimo map node focuses the saved path details. Closing review and choosing Revise opens the single parent Weaveling composer. Nothing was activated. The restored standalone Guild carousel loads the two actual directory Guilds, shows the login gate and no private drafts; no real Guild was joined or published to. The staging publication route returns 401 with CORS for an anonymous GET; its authenticated POST preflight returns 204 with the required bearer/node headers. The two-member publish/list/withdraw/resubmit flow is deterministic service/DOM coverage, not a live real-member publication. The separate Kamido production/mobile Worker was not deployed.

**Live visual acceptance:** the saved digital-note Endeavor shows its existing final acceptance receipt, 3/3 accepted map and Kamiya/Lari scene. The official purple-and-gold warlock Lari and orange-and-black tail match the inspected reference, while Kamiya uses its unchanged original sheet. Replay and Stop work; reload leaves `data-playing=false` on the same receipt. The final wide screenshot is `qa-lari-official-scene-wide-2026-10-27.png`; phone screenshot is `qa-lari-official-scene-2026-10-27.png`. These are in the wrapper workspace. Reduced motion, revision states, bounded rendering, no reward mutation and Lud art exclusion are covered by the executable tests. The live scene uses the existing honest accepted fixture; no proof or outcome was fabricated to obtain the image.

**New follow-ups from this walkthrough:** **UI-GUILD-02** — the standalone carousel still inherits redundant Commonweave console content below it and duplicate branding; consolidate that presentation without hiding Lud's separate human tools. **VISUAL-QUEST-02** — the personal map is correctly bounded horizontally at phone width but four long lane lists make it tall; add a compact overview/expansion control while retaining accessible complete path details. **GUILD-QUEST-02** — decide an explicit previewed public projection for plans whose only Anarchadia content is in the separate governance object; private review already shows it, while the initial hosted projection shares path arrays only. Preserve privacy and do not silently publish all agreements.

### GUILD-QUEST-01 — Shared board, carousel and explicit submission

**User reported:** no usable infrastructure for publishing/viewing Guild Quests; restore the earlier carousel and let any user with a Guild submit a Quest.

**Source finding:** the existing Guild → Quest → colored Quest Map carousel survives in `CivweaveGuildQuestTrackerV1`, but `discoveredGuilds()` projected device-local private drafts into the selected Guild's shared board. A local association is not a multi-member publication. User-facing Quests are Weaveling `weave-plan` artifacts; Cerbanimo's internal `quest` records are Endeavors and must not be silently republished as Quests.

**In progress:** shared allowlisted publication domain for existing node-cloud and mobile Guild authorities; any verified current member may submit, authors alone may revise/withdraw with revision conflicts. UI restores the carousel, previews the exact public fields and names the destination before explicit submission. No automatic publication on local creation/activation. Tests use fictional two-member Guild stores; no real Guild publication or membership is fabricated.

Acceptance: member A submits → member B reads the same hosted Quest → carousel map displays its paths → author withdrawal disappears for both → expired/nonmember/cross-Guild attempts fail → private wish/chat/profile/proof/session fields never enter the publication. Deploy the staging Guild Worker separately from Pages. The real Kamido mobile Guild deployment is outside this staging acceptance.

### VISUAL-QUEST-01 — Maps and review reward scenes

**User requested:** visual Quest maps like the earlier glaedn/Cerbanimo site, stronger gamified visual feedback, reward animations and AI-friend versus Lari the Lyrebird scenes demonstrating success versus requested revision.

**Source finding:** the carousel already has colored lane maps; active guide sprite sheets are available. No active Lari sprite/battle implementation was found. Extend the current capability owners rather than restoring obsolete world/navigation owners.

**Source/test verified October 27:** restored carousel has all four subsystem lanes, with unknown paths explicitly labelled instead of being routed to Cerbanimo. The canonical shared review also maps private Quests without a Guild or network, including the separately stored Anarchadia governance layer. Nodes focus existing detail sections; declared dependency references are distinct from merely displayed plan order. The Endeavor workboard has its own real task-dependency graph with accepted, blocked, review and revision states.

The finite Cerbanimo receipt scene now uses the original Kamiya expression sheet and a generated transparent four-pose Lari atlas. **User correction applied:** Lari's actual black feathers, purple-and-gold warlock costume, heart staff and orange-and-black tail were inspected on cerbanimo.cc and supplied as identity references; the existing Kamiya sheet supplied the style reference. The earlier invented brown bird was replaced before deployment. Prompt, source links and asset hash: `docs/history/lari-review-sprites-2026-10-27.md`. Accepted outcomes celebrate; revision remains constructive. Persisted acceptance stays authoritative, no reward balances or proof are minted by animation, reopening does not replay automatically, and reduced-motion users receive the same readable outcome. This currently wires Kamiya receipts; the other guide outcome hooks and actual ledger-backed reward bursts remain open.

Follow-up project: extend verified scene hooks to the other four guide outcomes and actual ledger-backed reward bursts. Improve the visual dependency layout using explicitly supplied relationships; never infer successful execution from map order. Record exactly which hooks are implemented before calling the complete visual feedback system finished.

**UI-CAMP-03:** the current Quest's Revise button only searched its own document for a textarea, so the persistent shell's parent chat stayed closed. A failing full-DOM regression now passes after the caller delegates to the canonical parent-owned Weaveling composer. Opening revision starts no inference and preserves the selected Quest. Browser acceptance follows deployment. A live follow-up found that Review Quest also fell back to the old campus list; its caller now delegates to the canonical mapped review owner, with another failing-then-passing regression and 30 focused integration cases passing.

**Packaging verification:** 71 focused Guild/private-map/visual/receipt/startup/current-selection cases pass. The complete updated Guide Full DOM workflow passes 217 cases (19 + 125 + 49 + 24). Guild and shared review structural checks pass; both Worker dry-run bundles pass; all 52 required shell hashes pass. The old service-worker evaluation script invokes a stale source-rewriting version synchronizer before evaluating; it fails on the unchanged current route revision. Its incidental local source changes were inspected and reverted, preserving the current navigation and manifest. The old practicum test harness also omits `allModuleAssessmentsPassed` and fails before its receipt assertion; the current final-gate tests remain the relevant check. These are recorded failures, not green checks.

**OPS-BUILD-01:** service-worker regeneration was found to overwrite the current registered worker's Settings/runtime/persistent-shell imports with an older template. The generator now preserves the active registered worker generation, changes only the new shell-assets pin, and supports a nonmutating `--check` in Guild CI. Generated metadata remains committed-byte-only.

`f6a9cd83` deploys the saved-Quest revision route and selected Ollama timeout repair, Moss explicit capability/title/module-count parsing, Rook revision prose consistency, Kamiya selected review deadlines, and Moss course-stage deadline/thinking fixes. Focused checks passed before deployment. Parked visual/native-route edits were excluded.

**Latest live outcome, checked October 26:** Moss's original prompt reached Qwen and saved **QA Temperature Conversions** with the correct title, exactly three relevant modules, worksheet outcome and approval gate. Approval and native handoff passed. Research fallback completed, then **curriculum design timed out; 0/3 modules were built**. An overlapping background Cerbanimo economic review also timed out. The approved plan survived; final competency and credential remained locked. Evidence: `qa-moss-qwen-plan-review.png` and `qa-moss-qwen-course-timeout-2026-10-26.png`. This is a failed course-build test, not a completed Learning Journey. Weaveling's repaired revision route and Rook/Kamiya fixes still need real Qwen retests.

## AI testing queue

| Priority / project ID | Current result | Next acceptance gate |
| --- | --- | --- |
| 1 — **AI-WEV-01: Four-subsystem Quest quality** | October 27 real Qwen revision completed on `bfbb48be`, saved all four ordered paths in REVIEW, included assembly practice, practice scrap inside $25 and final dimension/load checks. | Fix contradictory experience assumptions and incomplete four-day/two-weekend schedule; verify these in a further explicit revision. |
| 2 — **AI-MOS-01: Learning Journey to credential** | Real Qwen plan/approval/handoff passed on `f6a9cd83`; design timed out, 0/3 modules. Approved plan retained, credential locked. | Isolate background interference and design output/duration before explicit retry; then all module assessments, real practicum receipt and final credential gates. |
| 3 — **AI-KAM-01: Qwen Endeavor authoring and proof** | Real native proof/reopen/resubmit lifecycle passed using Llama before flagship steering. | Author a new Endeavor through Kamiya with Qwen, then execute honest digital proof and final acceptance. Verify the deployed selected-deadline review fix in the actual flow. |
| 4 — **AI-ROO-01: Manifest revision consistency** | Earlier create/revise/approve/publish/inspect/close passed with Llama; revised title/description were stale. | Repeat with Qwen; ensure title, description, quantity, place and date agree after revision and in the native listing. Repair native tab access if it blocks the test. |
| 5 — **AI-MER-01: Preview semantic quality** | Real Qwen preview generation, interaction, Keep and Revert passed. Generated badge did not fully satisfy its requested appearance. | Revise the preview against explicit badge text/appearance requirements; verify the same source is previewed and exported. No production vote/publication is needed. |
| Alongside each — **AI-UX-01 / AI-UX-02** | Streaming lifecycle has deterministic coverage; duplicate chat fixed live. | Observe real Qwen completion without unnecessary replay/redraw, and keep checking one parent chat while switching native routes. |

## AI-WEV-01 — Weaveling routing, planning and revision

**October 27 real retest:** the shorter explicit shelf revision completed with Ollama `qwen3.5:4b` and saved **Weekend Shelf Build: Novice Safety & Budget (Revised)** in REVIEW. All four paths remain Anarchadia → FellowFare → Living School → Cerbanimo. Material cost includes practice scrap, Living School includes dry-fit assembly practice, and final inspection refers to agreed dimensions and safe load. No activation, purchase, messaging or execution occurred. The original wish remains visible as the governing Quest goal.

**Quality still open:** its assumption simultaneously says both participants have no prior experience and says the other participant's level is unknown. Its steps mention Day 1 and a Day 2 agreement, without assigning Day 3–4 or the two weekends. The response therefore passes routing/persistence/deadline recovery and several content criteria, but fails full planning quality. Screenshot: `qa-qwen-revision-saved-2026-10-27.png`. The chat's Live Study Kit also displays Intake/Draft/Compile as “Not reached” despite a saved generated result; record that instrumentation issue as **AI-UX-04**, without presenting it as evidence that no model ran.

**User request:** discern the necessary subsystems from prompt context, produce useful Quest weaves, and route/plan across **all four** subsystems using Qwen3.5 4B.

**Live verified:** the latest new browser request under deployment `9e7a0cbd` saved a review with all four paths in the correct order. This supersedes the preceding browser result that omitted Anarchadia. Do not mark the project complete based only on path presence/order.

**Still open:** the full new review explicitly assumes both participants are novices, although only one person's novice status was supplied. It includes assembly practice, but has no concrete four-day/two-weekend schedule or agreed load target, and does not specify the practice-material budget. These are current browser findings; missing assembly practice in the earlier CLI run below is historical.

**Revision failed:** a real chat revision was submitted around 23:19 UTC on 2026-10-25 to retain all four subsystems, use only the known novice status, schedule four days across two weekends, agree size/placement/load targets before purchasing, account for practice materials inside $25, and keep the result in REVIEW. By 23:22:32 UTC it reported **“Generation timed out”** and that no second model was started. The previous review draft was preserved; none of those revisions is yet a live pass. Settings still visibly showed Qwen/Ollama and 600 seconds.

Reproduction prompt used for the current fresh-chat browser test:

> Create a new Quest to build a small wooden shelf over two weekends. I am a novice who needs to learn safe measuring, cutting, and assembly. We still need boards and fixings and have a maximum $25 budget. Two participants will share the shelf and must agree on its size, placement, spending, and who does which work before buying or building. We have access to appropriate tools and an experienced supervisor. Save a practical reviewable Quest; do not purchase, message anyone, or execute work.

Acceptance checklist for that saved review:

- Anarchadia records the participants' agreement before buying or building.
- FellowFare obtains the required materials within a real $25 total, including practice materials, with honest inventory/receipt evidence.
- Living School teaches and checks safe measuring, cutting **and assembly**; its practice is distinct from building the final shelf.
- Cerbanimo carries out final construction against agreed dimensions, placement and suitable load criteria.
- Dependencies, step dates and the two-weekend limit agree; no “Weekend 1 Day 5–8” style schedule.
- Known novice status applies only to the stated person. Other participant attributes remain unknown until confirmed.
- The result remains a review until explicitly activated. This physical shelf QA must not manufacture execution evidence.

**Source/test verified:** canonical author [civweave-weaveling-plan-json-v190.js](../../public/extensions/civweave-weaveling-plan-json-v190.js), version `1.2.11-weaveling-plan-json-v190-complete-outcome`, uses content-first included/excluded subsystem slots followed by path order. It validates every included path exactly once. Explicit revision exclusions override previous inferred requirements. The general planning floor no longer appends its competing prose planning contract to the structured Quest author; this shipped in `9e7a0cbd`.

[test-weaveling-full-dom-authoring-v1.mjs](../../scripts/test-weaveling-full-dom-authoring-v1.mjs) exercises the actual parent source graph with a mock NDJSON provider: one HTTP request, `think:false`, bounded output/context, four-path saved review, explicit activation and stable final bubble. This is deterministic integration evidence, not evidence of Qwen's semantic quality.

Real-model runner history is retained in local artifact folders. The runner uses production authoring/transport/normalization/persistence in isolated synthetic storage, but does not cover browser routing, CORS or downstream execution. Expected realms are evaluation annotations, never supplied to the model. **Structural success is not a semantic quality pass.** See [runner instructions](weaveling-quality-runner.md).

| Local run folder | Actual result / limitation |
| --- | --- |
| `qa-weaveling-quality-2026-10-24-qwen` | Four single-subsystem prompts routed correctly; mixed shelf incorrectly selected only Anarchadia. |
| `qa-weaveling-quality-2026-10-24-qwen-slots` | Mixed included four but duplicate order was rejected; other cases exposed empty reasons, inconsistent proof and omitted production. |
| `qa-weaveling-quality-2026-10-24-qwen-ordered` | Singles passed structurally; mixed omitted learning and construction. Longer instructions did not solve quality. |
| `qa-weaveling-quality-2026-10-25-qwen-compact-mixed` | Version 1.2.9 included four in correct order, but dates contradicted dependencies and learning duplicated production. |
| `qa-weaveling-quality-2026-10-25-qwen-sequence-mixed` | Version 1.2.10 included four in wrong dependency order; semantic failure. |
| `qa-weaveling-quality-2026-10-25-qwen-sequence-sampled` | Temperature .7 experiment failed structural order coverage. This is not the app's default temperature. |
| `qa-weaveling-quality-2026-10-25-qwen-content-mixed` | Version 1.2.11, temperature .2, one HTTP call, 206 seconds: four in correct order. Still assumed two novices, omitted assembly practice, left the two-weekend schedule and targets vague. |

The earlier browser draft **“Two-Weekend Wooden Shelf Build: Novice Safety & Budget”** had three paths, impossible day numbering, duplicated final construction in learning, and an invented 50 lb target. It was inspected but not activated. Evidence: `qa-weaveling-fullstack-review-before.png`. Keep this result distinct from the newer four-path draft.

### AI-WEV-02 — Selected Quest and proof projection

**Live verified:** the saved QA READY Decision v2 showed Cerbanimo accepted 3/3 and Passport at 100% accepted independent proof. Unfinished Anarchadia remained 0%. The later selected shelf review also appeared as the current review in native Passport without work controls. Evidence: `qa-passport-accepted-proof-projection.png`.

**Deployed:** `508467235095a58e75cb44b547a3bbd29774f748` includes selected-plan/governance repair. Keep checking that headings, banners, current review and downstream path IDs follow the explicit selected Quest; do not mistake one accepted path for completion of the whole weave.

### AI-WEV-03 — Progress stages disagree with saved result

**Observed defect:** the latest live process UI reports raw/draft/compile stages as **“Not reached”** despite a saved result. Capture the exact completed response and stage display together, trace the canonical progress owner, and reconcile stage completion with the persisted result. Do not add a second progress tracker.

### AI-WEV-04 — Saved Quest revision misses its author and loses the timeout

**Confirmed source cause of the shorter revision failure:** the exact request beginning **“Revise the saved shelf Quest…”** returned `planIntent:false`; its working-memory mode became `new` and its wish became the revision text. It fell through to generic chat. Separately, the Ollama loader replaced the saved 600-second deadline with a hardcoded 120 seconds. Fresh structured Quest creation read the saved configuration directly, explaining why a longer fresh draft could succeed while a revision timed out early. The native Termux route was not selected and is not the cause of this failure.

**Deployed in `f6a9cd83`; real Qwen revision acceptance pending:** the existing Ollama loader now retains the selected timeout/context/token configuration. The canonical Weaveling author recognizes explicit saved Quest/weave revisions, retains the governing wish/current plan, and does not hand an explicit Quest revision to Moss merely because it contains learning details. Earlier revision turns remain context rather than replacing the wish. No new chat or model transport owner is added.

Test-first evidence: selected deadline regression failed `120000 !== 600000`; full-page revision initially reached a generic request without explicit `think:false`; a learning-detail revision incorrectly invoked Moss. **63 combined cases now pass**, including actual parent source-graph fresh draft plus exact saved-Quest revision: one model call per requested generation, both canonical structured requests with `think:false`, both runtime deadlines exactly 600,000 ms, original wish/current review retained, saved revision in REVIEW, and stable final bubble. Coherent version/cache pins were also updated; stale exact-version lookups otherwise waited for an already loaded script's load event. These mocked-provider tests prove routing/lifecycle/deadline behavior, not Qwen revision quality. The repair is deployed in `f6a9cd83`; the real semantic revision has not passed yet.

## AI-MOS-01 — Moss Learning Journey through final credential

**Live plan/approval/handoff passed on `f6a9cd83`:** Qwen saved the requested title and three modules covering formulas/units, worked forward/reverse conversions, and error checking. The last outcome requires five conversions, reverse checks and an explained mistake. Approval queued materialization; native handoff retained title, capability and count 3. Research fallback completed in 2:18. After continuing an optional pack offer, design started and subsequently timed out. The actual report says **0/3 structured modules complete**, all blocked because design did not finish. The approved plan remains recoverable. **Not complete:** curriculum, assessments, practicum, final competency and credential. Current learner label remains **Local learner**; final/credential buttons are disabled.

Suggested standalone fictional QA journey: **QA Temperature Conversions**, three beginner modules covering formulas/units; worked Celsius↔Fahrenheit examples; checking results and explaining mistakes. Final practicum: a saved digital worksheet with at least five conversions and reverse checks, submitted through Cerbanimo for real review. Keep it separate from the current READY Quest.

Planned execution:

1. Ask Qwen for the three-module Learning Journey and save it for review; approve through normal UI before curriculum generation.
2. Inspect generated sources and uncertainty. Model-memory research fallback is visibly unverified; use an actual primary temperature reference where the source UI permits it.
3. For each module, save actual working notes, answer all visible assessment questions, and pass the current assessment. The bank rotates after an attempt; do not treat an old answer key as current evidence.
4. Save the digital practicum and send the real linked request to Cerbanimo. Complete actual artifact evidence and independent AI review; do not import a fabricated accepted receipt.
5. Return to Moss, check the matching Cerbanimo receipt, submit capability/evidence/uncertainty/revision explanation, evaluate final competency and issue a portable credential only after every gate is satisfied.

**Actual artifact prepared, not a course completion:** `qa-temperature-conversion-worksheet-2026-10-25.md` contains exact checked conversions (0°C→32°F, 20→68, −10→14, 37→98.6, 100→212, 77°F→25°C), inverse checks, a common order error, limitations and revision. It honestly identifies agent-performed digital QA. Source: [NIST SI Units — Temperature](https://www.nist.gov/pml/owm/si-units-temperature).

**Deployed gate fix:** `dda7c23a933289a188de5ff8ed18696873323c08`, [living-school-cleanroom-core-v218-base.mjs](../../public/app/cabinets/living-school/living-school-cleanroom-core-v218-base.mjs), version `living-school-cleanroom-v218.4-complete-course-gate`. All nonempty unique current modules need explicit assessment passes, and the accepted receipt must match the current school/practicum/request. Final evaluation and credential issuance independently enforce the gate. Six targeted cases failed before the repair (five failures/one pass), then all six passed; 34 related checks and Full DOM CI passed. **This still needs the real positive browser flow above.**

Related test: [test-moss-final-completion-gate-v1.mjs](../../scripts/test-moss-final-completion-gate-v1.mjs).

### AI-MOS-02 — Generation duration and source lifecycle

**Deployed in `f6a9cd83`; live course pending:** the design wrapper discarded shorter selected deadlines and raced the 600-second setting against a separate 570-second timer. Design, assessment and research fallback also omitted Ollama's `think:false`. The repaired existing owners preserve selected deadlines, delegate timeout/cancellation to the canonical runtime and disable thinking only for Ollama. Missing budgets retain bounded 570-second design / 180-second assessment defaults. Five regressions failed before repair; 56 related tests and five provider/deadline checks pass. Termux SSE and other providers remain covered. The real Qwen course is still required.

Three modules normally require one design call and three sequential assessment calls; structure compiles locally. An optional research fallback adds a call if usable sources are absent. Substantial output may still be slow on this CPU; record actual durations and output completeness during the live test.

The plan-approval `prepareNewPath` flow clears manually added sources. Do not add a source before approval and then assume it survived; verify after approval. Explicit Weave/path identity handling is source tested: selected linked paths retain identity, unrelated standalone courses remain unlinked, and model output cannot invent linkage IDs.

**Observed status issue to revisit after core AI testing:** while the native Generation Run shows an active model request, the saved journey row says **Queued · generation incomplete** and exposes **Retry approved curriculum generation**. The label is misleading during an active run. Duplicate-call behavior has not been tested; do not infer that the button actually launches concurrent inference.

**Additional live failure-status defect, October 26:** after both requests failed, the panel still said **Generating curriculum** and its elapsed timer kept increasing overnight (828 minutes when inspected). This is a stale UI timer, **not evidence that inference ran for 828 minutes**. The report correctly recorded timeout/0-of-3. Reconcile the active-run terminal state, label and clock with the canonical failure event.

**Source-offer relevance issue:** a temperature-conversion course offered Digital & AI Literacy, Technology Builder, and Civic & Media Literacy packs. None was downloaded; **Continue to curriculum** resumed design. Check topic scoring before offering unrelated packs as preparation for a simple scientific calculation course.

### AI-SCHED-01 — Background economic review overlaps the course

**Observed on `f6a9cd83`:** after source fallback completed in 2:18 and the optional pack offer was continued, Curriculum design started. The run panel then showed a third request, **cerbanimo economic review · nested**, with two active requests. Root did not manually start another inference.

**Source-confirmed origin and gap:** `CivweaveBasicValueSystemsV1.processKey` reviews existing `cerbanimo.quest-engine.v144` records. A Living School store write can trigger another same-origin document's storage subscriber, which scans all three stores. There is no foreground-course guard or cross-document coordination. The common Ollama transport permits overlapping HTTP requests; whether Ollama decoded concurrently or queued internally was not measured. Economic estimate/review requests can use 4096 tokens/600 seconds, omit `think:false`, and have no course cancellation signal. They bypass the exact design-purpose counter. The UI calls every non-Living-School purpose “nested”; this does not establish parentage. Both design and valuation timed out in the observed run; **causality is not proven**. Test foreground isolation and bounded explicit-demand scheduling before retrying the same oversized design blindly. Do not count valuation as an assessment request.

### AI-MOS-03 — Explicit learning goal/title/module count parsing

**Deployed in `f6a9cd83`; live acceptance pending:** testing exposed the parser losing an explicit requested capability/title and a worded **three short beginner modules** count. Two targeted tests were red before the repair; 29 related cases and a 78-case combined AI run passed after it. The unified capability layer is now version `1.2.18-unified-chat-system-v1-explicit-learning-goal` on staging. The original prompt now starts Qwen planning; the completed plan and course flow still require acceptance.

## AI-KAM-01 — Kamiya Endeavor authoring and proof lifecycle

**Live verified with the earlier Llama model:** imported QA READY-note Endeavor; wrote, saved and reloaded an actual digital note; all three units independently AI-accepted; final Quest accepted. Reopening the last unit revoked final acceptance; resubmission restored it. Evidence: `qa-kamiya-endeavor-accepted.png` and the Passport projection evidence above.

**Still required with Qwen:** direct chat authoring of a new Endeavor, usable units/proof requirements, activation, real digital work, independent review, final acceptance, reopen/revise and acceptance projection. Earlier Llama empty-unit output and Gemma timeout are not flagship passes. Deployed schema, `think:false` and cancellation work has source coverage but cannot substitute for this test.

### AI-KAM-02 — Native review may ignore the shared timeout

**Source-confirmed discrepancy, not yet reproduced with real Qwen review:** native proof review discarded the shared 600-second Settings budget in favor of a 62-second model limit / 65-second abort, and its request omitted `think:false`.

**Deployed in `f6a9cd83`; live retest pending:** the existing validator now preserves the selected deadline, lets the canonical runtime own cancellation, and supplies explicit non-thinking Ollama validation for task/final review. Its focused regressions pass. Confirm actual Qwen proof review; this source result does not complete AI-KAM-01.

## AI-ROO-01 — Rook Manifest consistency and full safe lifecycle

**Live verified with the earlier Llama model:** created a fictional gift of two notebooks in Albany/today, revised to three in Troy/tomorrow, approved/published, imported one native listing, inspected structured fields and closed it. Evidence: `qa-rook-reviewed-listing.png`, `qa-rook-closed-listing.png`.

**Observed defect:** title/description retained the original two/Albany prompt while structured fields reflected three/Troy. Repair revision coherence in the canonical Manifest author/materializer, then repeat with Qwen and inspect the published native record. Do not claim the revision is correct just because structured fields changed.

**Deployed in `f6a9cd83`; live retest pending:** canonical guide contracts now revise request-derived prose/title together with quantity, place and timing; labeled numeric fields do not rewrite unrelated budget numbers. Focused regressions pass. Actual Qwen review/publication verification is still required.

**Boundary:** no counterparty, actual order, payment, delivery or settlement was fabricated. A full multi-party lifecycle remains untested until a legitimate counterpart/test arrangement exists.

### AI-ROO-02 — Native FellowFare navigation and arrangement repaint

**Corrected October 26 on `f6a9cd83`:** Sell, Orders and Wallet work after native travel settles. Earlier snapshots were taken during asynchronous system opening; they do not establish that every tab was dead. Do not carry that broad outage claim forward.

**Confirmed source/test defects, committed in `547a47dc` and deployed through `8841d8eb`:** native tabs used invalid empty `aria-current`, internal navigation could leave the wrong tab selected, and cancelling an arrangement persisted `cancelled` but repainted from stale in-memory Orders state. Persistence now belongs to the canonical marketplace API; the native controller calls its existing bridge directly. Retained iframe transport still authenticates sender and origin. The functional suite covers all five screens, profile save, arrangement cancellation/repaint, reviewed import once, listing publish/search/details/closure and iframe authentication. No real payment or counterparty was fabricated. Live verification follows deployment.

## AI-MER-01 — Merlin governed preview quality

**Live verified with Qwen after the timeout and single-source fixes:** proposal `proposal-mvn6n7qf-kqr3om`, **QA READY badge preview**, reached preview-ready. The sandbox began WAITING; **Mark READY** changed the status to READY. **KEEP THIS PREVIEW** selected it. Reopening and **REVERT TO CURRENT LOOK** returned it to intake / **REVERTED · BACK IN REVIEW**. No vote or production publication occurred.

**Observed candidate-quality defect:** the tiny green badge was empty rather than displaying READY, and the heading retained “preview.” The status interaction worked. Evidence: `qa-merlin-preview-ready.png`. Next, request a targeted revision with explicit visible badge acceptance criteria and repeat preview/Keep/Revert.

**Deployed source/test verified:** console version `1.0.9-preview-source-owner`; the model supplies summary and one HTML/CSS/JS source set. The validated sandbox and three derived exports use those exact sources. Intake-only retry, provider ownership and full native DOM cases pass. Three previous Qwen retries at 300 seconds timed out; successful completion uses the later 600-second setting. Tests: [provider](../../scripts/test-merlin-preview-provider-v1.mjs), [full DOM preview](../../scripts/test-merlin-full-dom-preview-v1.mjs).

## Shared AI and access projects

| ID | Request / evidence | Status and next step |
| --- | --- | --- |
| **AI-ACCESS-01** | User reported missing CORS headers on trust bundle and current release, blocking local AI setup. | **Live verified repaired:** trust bundle 200 with ACAO; release/current 404 also has ACAO; actual local AI response succeeded. Signed current release remains absent, so the direct installed-workspace workaround is still needed. Do not describe release/current as 200. |
| **AI-UX-01** | User requested that the bubble stop redrawing after streaming ends. | **Deployed/source tested:** keyed article/bubble identity, final token flush, idempotent startup, and final writes only when text differs. Observe a real Qwen completion for unnecessary replay/redraw. A genuine change from streaming summary to formatted structured review can require one final update. |
| **AI-UX-02** | User reported duplicate chat visible in the native view. | **Fixed, deployed and live verified** in `d26159f365971b9fe8782c479f13c916e4cb6b9b`: FellowFare Market→Orders retained one parent launcher/chat, zero child launchers/chats, saved chats intact. Child embedded chat defers to the parent; frame matching permits expected hash/query changes while preserving strict origin/path/launch keys. Evidence: `qa-duplicate-chat-fixed.png`. Continue regression checks on different native subpages. |
| **AI-OPS-01** | Renderer froze; reload/close timed out and user reopened the tab. | Historical recovery, not a current fixed defect. If it recurs, capture bounded observations and source cause; do not add runtime patching or repeated synthetic event loops. |

## Active interface projects

**User request:** while waiting on AI, inspect each interface option for hidden, cut-off or incomplete components and build improvements. This broad audit resumed on October 26 after recording the AI results. Keep confirmed findings separate from hypotheses.

| ID | Finding and evidence | Current work / acceptance |
| --- | --- | --- |
| **UI-NAV-01** | **Confirmed:** mobile Merlin Tools menu at 390 px viewport was left=100/right=474, 84 px offscreen. `qa-ui-mobile-menu-before.png`. | **Live verified on 8841:** 390 px viewport menu left=8/right=382, width374, within bounds. Canonical rendered-width clamp is deployed; regression green. |
| **UI-SHELL-01** | **Confirmed:** parent 884 px viewport scrolled to 1028 px, adding 144 px dock padding while the native iframe was already shortened. | **Live verified on 8841:** parent clientHeight=scrollHeight=667 at 390×667; extra dock scroll removed. Stage retains its own content scrolling. |
| **UI-ANA-01** | **Confirmed:** Anarchadia Proposals/Pipeline retained the large Passport/home region despite hidden state; expanded display rules overrode `[hidden]`. | **Live verified on 8841:** Proposals, Pipeline and Observatory no longer expose the expanded Passport home region. Five visibility regressions and coherent pins shipped. |
| **UI-FF-01** | **Confirmed:** FellowFare mobile tabs partly cut off You; imported flex layout overrode the five-column grid. `qa-ui-fellowfare-phone.png`. | **Live verified on 8841:** all five tabs fit, x=4..376 in the 380 px stage, each44 px high; You opens profile and selected Market initially has aria-current=page. [CSSOM tests](../../scripts/test-fellowfare-native-tabs-v1.mjs) also cover320/390/760/1024. Separate from the arrangement repaint and selection defects in AI-ROO-02. |
| **UI-ANA-02** | **Source-confirmed route risk:** governance/workbench return paths drop embedded/persistent-shell context. Actual path changes can fail strict parent suppression and reintroduce child chrome/chat. | Source repair complete: governance/workbench delegate native travel and returns to the existing parent; only those two native page paths are allowlisted, with strict origin/frame/path matching retained. Fifteen native-return cases and related route/rescue checks pass. **Live verified on 8841:** governance entry/all six section tabs/return, Workbench entry/return remain in parent shell with one guide owner and zero child guide launchers. Standalone and hostile-frame cases are source/test verified. |
| **UI-NAV-02** | **Confirmed on f6:** Moss shortcuts remained open after travelling to FellowFare. The menu covered Wallet on the phone viewport (`qa-ui-wallet-mobile-before.png` captures the overlay, not an unobstructed Wallet). | Existing route-change subscriber now cancels hold state and closes the previous guide menu. Regression failed before and passes after; **live verified on 8841:** Merlin menu closes immediately on travel to Rook. |
| **UI-MOS-01** | **Confirmed:** failed native chat course generation retained Generating curriculum and an overnight running clock, despite 0/3 modules and a terminal timeout report. | Existing observer now settles failed/partial/completed chat runs and freezes request/session clocks. Five regressions red before/green after, retained reports/history, idempotent terminal handling. Background calls are labeled background unless an actual parent request is recorded. **Later live re-open check on 7d lineage:** report still 0/3, no stale Generating curriculum rail/overnight clock; terminal event transitions remain test-verified. |
| **UI-HUM-01** | Human chat panel initially suspected cut off. **Disproved in measured viewports:** actual mobile override produced top 8/bottom 513 at 390×667 and top 8/bottom 446 at 390×600; header/Close reachable. | No patch needed for this observation; speculative base CSS edit was reverted. Evidence: `qa-ui-human-mobile-before.png`. Reopen only with a new reproducible case. |
| **UI-ANA-03** | **Hypothesis:** 58 px module icon plus arrow/gaps could clip long Governance Workbench labels at 320–375 px. | Reproduce visually before editing. |
| **UI-CHAT-01** | **Hypothesis:** very short keyboard viewport (about 280 px high or less) could leave no useful transcript area after header/switcher/composer. | Test with actual keyboard-sized viewport before changing layout. |
| **UI-CAMP-01** | Active v440 loads an old home-declutter guard that only targets v156; brand click currently opens Current Quest. | Source observation, not evidence that a removed dropdown should return. Inventory essential options and their canonical owners before deciding on any change. |

Remaining screen inventory:

- Civweave: Current Quest, Quest Library, guide export, app/device, Guilds, Map and Support.
- Living School: journeys, path/modules, sources, visual inspection, practice, quiz, practicum, final and Passport after a real course exists.
- Cerbanimo: New Quest, Workboard, Project Workbench, Proof Observatory, task proof and final.
- FellowFare: verify all five mobile tabs, selection and arrangement repaint on the new deployment. Wallet currently shows Stripe status unavailable / Failed to fetch on f6; verify its actual backend configuration before changing money behavior.
- Anarchadia: Passport, Proposals, Ledger, Automation, Observatory, Governed Update, Workbench and review/preview/return flows.

## MUSIC-01 — Direct audio and transparent app-aware control

**User request:** major radio/music overhaul. Lower the icon, make it transparent and reactive to app colors, use directly incorporated free streamed/downloaded audio as primary playback, and keep Spotify as an optional extension.

**Implemented and deployed in 8841; live acceptance partial:** the existing `CivweaveRadioStationSurfaceV1` in [system-radio-agent-v233.js](../../public/app/system-radio-agent-v233.js) owns one parent player. Embedded systems alias it. Controls include play/pause, previous/next, seek, volume, attribution/source/license, explicit verified offline save/remove and visible errors. No autoplay or audio fetch occurs until Play/Save. Route palettes update without replacing the playing audio element. SAFE mode excludes unaudited direct recordings; curated Spotify remains optional.

Three unmodified CC BY 3.0 source recordings are included on the app origin: J.Lang featuring Coruscate, **Climate Change The Dirty Water Remix**; Carosone featuring SackJo22 and Ditto Ditto, **Freedom in my voice**; Aussens@iter featuring Mr. Yesterday and Snowflake, **The Singularity**. Total 12,044,592 bytes. Primary pages and exact hashes/attribution are retained in [STARTER-CREDITS.md](../../public/downloads/hub-media/open-music/STARTER-CREDITS.md) and [starter catalog](../../public/downloads/hub-media/open-music/starter-catalog.json). The original 17-record discovery catalog is unchanged. Mind Map This is tagged explicit and was excluded from the default starter selection.

The remote ccMixter media URLs reject missing/cross-site referrers and lack fetch CORS permission; same-origin licensed redistribution makes direct playback and optional offline storage testable. The service worker pre-caches only the small starter manifest, never the audio. Four executable cache tests cover required readiness, missing-manifest repair, atomic failure and no audio prefetch. Sixteen player tests cover actual manifest/hash metadata, all five theme queues, controls, single ownership, offline failures, SAFE mode and stable DOM updates.

**Live verified on 8841:** Freedom plays with currentTime18.35s/duration231.30s and readyState4; Pause, Next, volume0.70→0.65→0.70 work. Save offline reports success and Remove appears; replay uses a blob URL, and paused PageUp seeks to85s. The same parent audio survives FellowFare→Anarchadia; parentaudio1/childaudio0/childlauncher0, route accent changes saffron→pink, transparent44px launcher above dock. Full offline network-disconnected reload was not tested. Remaining: reload/save removal, responsive control repair below and streamed seek fallback. Follow-up expansion: verify/incorporate the other eligible catalog recordings and complete SAFE content audits; do not treat all 17 metadata records as playable or audited.

## Deployment and verification record

| Commit | Deployed work / evidence |
| --- | --- |
| `d26159f365971b9fe8782c479f13c916e4cb6b9b` | Shared embedded chat ownership / duplicate fix; live parent/child count and route check passed. |
| `508467235095a58e75cb44b547a3bbd29774f748` | Complete-outcome Weaveling author, selected Quest/governance state and Merlin single-source preview ownership; Full DOM CI and deployment green. |
| `dda7c23a933289a188de5ff8ed18696873323c08` | Moss all-current-module and matching-receipt final/credential gate; Full DOM CI `40217420777` and deployment `40217420783` green; exact live marker verified. |
| `9e7a0cbdc7b93133afeac63d92f748b001560e47` | Structured Quest author owns its planning contract; Full DOM CI `40218723615` green; exact live marker verified after staging deployment `40218723376`. |
| `f6a9cd837ee07b07c19427128c84af492024031f` | Selected model deadlines, saved Quest revision routing, Moss goal parsing/course thinking policy, Kamiya review budgets and Rook revised prose. Full DOM CI `40245640639` and deployment `40245640275` green; exact marker verified. Real Moss plan and approval passed. |

Focused checks already reported passing include 31 Weaveling scope cases; 36 preview/full-DOM/selection/owner cases; 56 stream/final-owner/scope/proof cases; 34 Moss cases including the six gate regressions; native route/structure checks; and a combined six-case new Weave/Rook/Merlin full-DOM run. Record the relevant command/results with each new change rather than treating these counts as current guarantees after unrelated edits.

Repository-wide legacy checks have pre-existing stale version/hash failures. **No claim is made that every repository check passes.** The resumed visual/routing/music bundle is not yet part of the live deployment above. Its first combined integration run passed 86/86 cases. Exact deployment and browser acceptance are recorded when completed.

### OPS-CI-01 — Replace stale checks with current behavioral contracts

Read-only comparison on `f6a9cd83` found the same first failures as earlier staging runs in six directly related workflows: Unified Chat (obsolete exact switch call), Family AI loader (old version 1.0.138), Weaveling authority (old materializer 1.1.1), Weaveling/LiteRT (old bypass 1.4.1), Kamiya chat (obsolete facade string), and Moss bridge (VM fixture omits `allModuleAssessmentsPassed`). These are not new live behavioral failures. A bounded follow-up should trace current owners and replace obsolete static assertions or incomplete fixtures with meaningful behavior checks, preserving every real safety/lifecycle guarantee. Do not change runtime code merely to match obsolete strings.

## Evidence files and handoff

The local session artifact root is **`C:\Users\glaed\Downloads\civweave-launch`**, outside this Git checkout. Filenames below are relative to that root and were verified present when this log was created. They do not automatically travel with a repository clone.

| Artifact | What it establishes |
| --- | --- |
| `qa-duplicate-chat-fixed.png` | Live single parent chat after native routing. |
| `qa-rook-reviewed-listing.png`, `qa-rook-closed-listing.png` | Earlier reviewed/closed native Manifest lifecycle. |
| `qa-kamiya-endeavor-accepted.png` | Earlier actual digital-note proof accepted through native review. |
| `qa-passport-accepted-proof-projection.png` | Accepted Cerbanimo path projection while another path remains unfinished. |
| `qa-weaveling-fullstack-review-before.png` | Earlier three-path shelf draft defects, not the newest four-path result. |
| `qa-merlin-preview-ready.png` | Working READY interaction and incomplete badge appearance. |
| `qa-ui-mobile-menu-before.png` | Tools menu offscreen. |
| `qa-ui-human-mobile-before.png` | Measured reachable human chat panel, not a confirmed cutoff defect. |
| `qa-ui-fellowfare-phone.png` | Mobile tab cutoff and current radio position/opacity. |
| `qa-ui-fellowfare-sell-phone.png`, `qa-ui-fellowfare-orders-phone.png`, `qa-ui-fellowfare-wallet-phone.png`, `qa-ui-fellowfare-you-phone.png` | Native tab commands leaving Market content visible. |
| `qa-temperature-conversion-worksheet-2026-10-25.md` | Actual digital artifact ready for a future honest practicum submission. |
| `qa-weaveling-quality-*` folders | Real source-runner metadata, requests, provider output, normalized plans and reports; see AI-WEV-01 for individual outcomes. |
| `qa-mascot-flow-report-2026-10-24.md` | Earlier historical session report, updated in stages; this running log is the current record and supersedes its stale timeout/preview/pending-result status. |

For each continuation, record: **ID → exact prompt/action → model/deployment → observed result → saved artifact → smallest remaining acceptance check**. Update the evidence level and deployed state only after the corresponding check. Preserve past failures as test history without preserving obsolete runtime implementations.

## Copyable follow-up project prompts

These are bounded follow-ups for this chat or another explicitly created chat. They do not start a new task automatically. Read this log and the repository instructions first, update the same IDs, and preserve unrelated unfinished work.

**AI-WEV-01 / AI-WEV-03 — Review the current revision, then repair only an observed blocker:**

> Continue Qwen3.5 4B Weaveling QA from docs/operations/staging-qa-running-log.md. Explicitly retry the saved four-subsystem shelf revision through the deployed canonical route. Verify all four paths, four workable days, known versus unknown participant skills, agreed targets before purchase, practice/material budget within $25, and REVIEW status. Investigate why raw/draft/compile says Not reached after a saved result. Record actual evidence; do not execute the physical shelf plan.

**AI-MOS-01 / AI-MOS-02 — Finish one real digital Learning Journey:**

> Use Qwen3.5 4B to take the standalone QA Temperature Conversions journey through plan review, curriculum, every module assessment, actual digital worksheet practicum, matching Cerbanimo AI receipt, final competency and portable credential. Use the saved worksheet as honest agent-created evidence. Observe real generation timing and source retention. Fix only reproduced blockers at their canonical owners, and update the running QA log.

**AI-KAM-01 / AI-KAM-02 — Complete direct Qwen authoring and proof:**

> Test Kamiya direct Endeavor authoring with Qwen3.5 4B and an honest small digital artifact. Exercise activation, per-unit independent proof review, final acceptance, reopen and resubmit. Verify the deployed selected-timeout/think:false review fix in real Qwen requests. Fix only a reproduced remaining blocker at its canonical owner. Record the live result and update the QA log.

**AI-ROO-01 / AI-ROO-02 — Repair native access and coherent revision:**

> Verify settled native tab selection and arrangement cancellation repaint, already repaired and regression-tested. With Qwen3.5 4B, create and revise a fictional local Manifest; confirm title, description, quantity, place and date agree in chat review and the published native listing, then close it. Do not invent counterparties or settlements. Update the running QA log.

**AI-MER-01 — Improve one generated preview against its requirements:**

> Continue the QA READY badge preview with Qwen3.5 4B. Request a targeted revision with visible READY badge text and the intended heading, verify interaction plus exact source/export agreement, then exercise Keep and Revert. Keep the proposal in the local review process; do not publish or vote. Record semantic quality separately from workflow success.

**UI-NAV-01 / UI-SHELL-01 / UI-ANA-01 / UI-FF-01 — Finish the existing visual fixes:**

> Continue live acceptance of the deployed navigation, persistent-shell, Anarchadia hidden-state and FellowFare tab CSS fixes listed in the running QA log at mobile and desktop sizes. Preserve their canonical owners and regression coverage. Do not treat source tests as a live acceptance pass.

**UI-ANA-02 — Complete context-preserving native route/return behavior:**

> Extend live acceptance of the deployed Anarchadia governance/workbench native routes and returns while retaining strict frame identity checks. Entry, governance tabs and both returns passed on8841; keep one parent chat/chrome owner and standalone regression coverage. Update the log with exact routes and evidence.

**MUSIC-01 / MUSIC-02 / MUSIC-03 — Complete direct player acceptance:**

> Verify the deployed direct player's controls remain visible while the track list scrolls, streamed seeking has a bounded memory fallback for Pages' unsupported Range responses, and explicit offline save/reload/blob playback/remove works. Preserve one parent player, explicit playback/download, visible source/license, optional Spotify and SAFE exclusions. Then expand eligible catalog recordings and audit SAFE content. Record limits honestly, including whether network-disconnected playback was actually tested.

**Remaining visual inventory — inspect before proposing fixes:**

> Continue the active interface inventory in the running QA log. Visit each remaining control/screen, capture actual mobile and desktop behavior, distinguish confirmed defects from hypotheses, and add stable issue IDs with evidence and bounded acceptance criteria. Do not revive removed UI or duplicate shared capabilities just because a label or screen exists.

**OPS-CI-01 — Modernize the six confirmed stale checks:**

> Read OPS-CI-01 in the running QA log and compare the failing staging logs with their earlier failures. Trace each current canonical owner, replace obsolete exact-version/string assertions and incomplete VM fixtures with behavioral contracts, and preserve existing lifecycle and safety requirements. Do not change application behavior solely to satisfy historical checks. Update the log with before/after evidence.

## Append-only session updates

- **2026-10-25:** user redirected effort to AI testing first and requested this durable running document. Latest fresh Qwen browser weave has all four paths in the correct order and includes assembly practice; participant-skill assumptions, scheduling, targets, practice budget and inaccurate progress-stage display remain open. Visual and music implementation are parked; their source work and findings are retained above.
- **2026-10-25, later:** targeted Weaveling revision timed out while the prior review survived. Exact-source reproduction found missed saved-Quest revision routing plus the loader's hardcoded 120-second deadline. Test-first source repairs are in progress. Upstream staging was fast-forwarded to `c8870c6e` while preserving dirty AI and parked UI work; the new live marker has not yet been verified. Moss goal parsing, Rook prose coherence and Kamiya review-budget source fixes are ready but not yet deployed/live accepted.

- **2026-10-26, interface resumption:** checked the failed Moss design report (0/3) and preserved the approved plan. Corrected the FellowFare all-tabs-outage claim after settled live navigation. Integrated mobile tab sizing, stale guide-menu closure, hidden-screen styling, strict Anarchadia native returns, same-document arrangement repaint, terminal run clocks, and direct audio starter/player at source. First combined integration run: 86/86 passed; deployment and actual browser acceptance pending.

- **2026-10-26, source integration:** UI/music source bundle committed as `547a47dc`. Before deployment, fetched and merged upstream `b7046413` (Moss native design deadline/prefill changes). Combined run-rail owner is `2.1.2-terminal-prefill`: terminal clocks and late-event protection coexist with actual first-token/deadline diagnostics. Exact native-only design timeout is 1,200,000 ms for openai-compatible / qwen35-4b-native / 127.0.0.1:8080/v1 / living-school-research-grounded-curriculum-v218.1. Selected Ollama qwen3.5:4b remains 600,000 ms. No real-model success is inferred from this merge. Post-merge shared startup/player/rescue batch: 54/54 passed.

### AI-MOS-04 — Final prompt source injection exceeds the compact core evidence

**Source-confirmed integration finding, not a new live outcome:** upstream compactDesignEvidence limits its own design excerpts to four 650-character notes, but the active generation guard subsequently injects up to 52,000 characters from full sources plus 12,000 synthesis characters into the actual provider prompt. Therefore the final guarded design request is not proven compact by inspecting the core builder alone. The production transport regression currently requires full source injection. Before another long curriculum attempt, inspect the final guarded prompt and reconcile relevant source evidence with the selected model context without bypassing the canonical guard. Do not claim source compaction or a solved generation timeout from the upstream core change alone.


## October 26 screen-walk findings and acceptance

| ID | Current finding / next action |
| --- | --- |
| **UI-GUILD-01** | **Live defect on8841:** Find nearby Guilds briefly opens an empty modal, then navigates the whole installed app to `/app/index.html?manage=guilds...`. Source cause: canonical lobby only appended under installer cards/main; the parent has no main. Test-first explicit mount/in-shell retry repair is complete locally (five regressions); deploy and verify panel/search UI without granting location or joining. Evidence: `qa-ui-guild-search-installer-2026-10-26.png`. |
| **UI-LIB-01** | **Live defect on8841:** Moss Living Library → Back to Civweave loads legacy v156 campus inside the nested library iframe, leaving the parent on Living School. Repair return through the trusted canonical parent route; preserve standalone behavior. Evidence: `qa-library-nested-campus-before-2026-10-26.png`. |
| **MUSIC-02** | **Live defect on8841:** selecting/saving a lower track scrolls the outer443px panel to412, moving Close/header/player offscreen (header top−393). Split track-list scrolling from reachable controls, with short-height fallback. CSS regressions red before/green after locally; deploy/live check pending. `qa-direct-radio-mobile-2026-10-26.png` is a before image showing this defect. |
| **MUSIC-03** | **Live defect on8841:** keyboard seeks on streamed MP3 reset to0; explicit Range bytes0-1 returns200/full3,704,835bytes with noContent-Range. [Cloudflare Pages documentation](https://developers.cloudflare.com/pages/configuration/serving-pages/) confirms this static-serving limit. Saved blob has full seekable0..231.296 and PageUp correctly seeks85. Add bounded verified memory-only fetch after explicit unseekable seek; only Save persists. |
| **UI-ANA-04** | **Observation requiring source diagnosis:** Pipeline and Observatory still say semantic package/matcher warming while lexical rails are active. This is not proof of ongoing loading or successful semantic review. Expose actual unavailable/loading/error readiness and recovery through its existing owner if indefinite warming is confirmed. No new AI request was made during this walkthrough. |

Walkthrough on8841: FellowFare profile and all five phone tabs; Anarchadia Proposals/Pipeline/Automation/Observatory; Governed Update Overview, People/nodes, Changes, Ballots, Federation, Execution; Workbench onboarding and strict native returns; Moss saved-plan/failure recovery and Living Library. Governance tabs had no horizontal overflow (375px client/scroll width); Workbench390/390, childguide0. No credentials, ballots, Guild admissions, proof claims or money transactions were fabricated.

CI on8841: deployed successfully; FullDOM, FellowFare and exact native design deadline green. First-frame behavioral12/12 passed but its old Cerbanimo verifier failed because it equated loading the shared embedded feature owner with constructing child chrome; the same failure reproduces at f6 and b704. Source-level VM behavior replacement now verifies singleton/no child chrome/strict route identity and24related cases pass. Radio DOM+cache20/20 passed; its old revision/builder assertion required coherent generator metadata updates, now locally repaired. Rerun both workflows on the next bundle.


### Later October 26 resume — upstream and remaining acceptance

The live marker after resuming was7d4e2913, which includes8841 plus later Moss changes. Visual/radio source from8841 remains its ancestor, but do not label the later manual-plan/library observations as an isolated8841 execution. Source integration will preserve current upstream rather than replace it.

**AI-MOS-04 update:** upstream7d source/test repairs final prompt size only for the exact local native Qwen design tuple. Mocked native transport shrinks21,440 original characters to4,370 submitted, retaining six actual source IDs and one request. Selected Ollama still submits21,438 characters in the same fixture and keeps600s. The flagship Ollama context-size/quality acceptance remains open. These figures are controlled fixtures, not a real Qwen completion.

**Current approval policy across providers:** approval saves a plan; opening/selecting does not call a model. Open Living School → Select this plan → Generate selected plan is explicit. Legacy queued/autoRun metadata remains recoverable but does not authorize automatic generation. Update the earlier historical approval/handoff results with this current path before the next real course attempt.

**UI-MAP-01 — confirmed later live return defect:** shared Map opens its standalone wrapper normally. Its inner ← Civweave action loads a campus inside hubMapFrame, leaving the outer URL onhub-map-v1. Map itself renders at phone width with working Scout/Close controls and visible attribution. Test-first canonical return repair now authenticates the exact wrapper/frame or standalone map before returning to current persistent Civweave;9/9 source regressions pass. Deploy/live return acceptance pending. `qa-guild-map-mobile-2026-10-26.png` records the functioning map view, not a corrected return.

**UI-CAMP-02 — observed duplicate Learning Journey projection:** Civweave Quest Library shows QA Temperature Conversions twice (generation failed/retry and queued for generation), while native Moss lists one approved plan. Investigate shared identity/course projection, dedupe only true identities and preserve same-title independent plans. Do not delete stored plans/curricula to clean the UI.

**UI-VIDEO-01 — confirmed saved companion bypass:** accepted digital-note tasks show the unrelated UNIT-4 Digital Electronics & IC Technology clip (atlas12points), and the IAB blocks its YouTube iframe. Fresh topic selection already rejects digital-only matching; persisted task attachments bypassed topic admission in the renderer. Repair saved attachment presentation using the canonical relevance gate, preserve all accepted proof/receipts, and show honest unavailable state for invalid companions. Embed refusal is a separate browser/provider limitation, not proof of global YouTube unavailability.

Civweave Current Quest/Quest Library/secondary controls were opened. Four-path shelf remains REVIEW and was not activated. Export Quest was clicked but the in-app browser download event did not arrive within10s; source binds a JSON blob download, so this attempt is **unverified**, not a confirmed functional export pass or a proven no-op. Original tarot intention was not exposed in the current selected-review UI; do not rewrite the shelf review or delete plans to restore a draft.


**UI-CAMP-02 bounded follow-up prompt:**

> Preserve `approvedPlanId` from canonical Learning Journey approval through `chatCurriculumData`, generation `requestedData`, successful curriculum metadata and recovery records. Consolidate Civweave Library projections only when those real identities match; prefer the current materialized/recovery status while retaining plan actions. Add regressions for queued+failed+successful projection, distinct same-title journeys and ambiguous legacy records. Do not infer identity from title/capability text or delete stored journeys. Offer explicit association for legacy recovery records lacking proof of their originating plan.

The UI-CAMP-02 diagnosis is complete, but no unsafe deduplication was made: `savedLearningJourneys()` in `working-campus-v156.part3.txt` collapses approved/queued plan IDs and emits recovery by request ID; legacy request data discarded approvedPlanId. This is a data-lineage project, not evidence that the two cards can safely be merged by their shared title.


### UI source bundle ready for browser acceptance

`139c648d` commits Guild mount/retry, authenticated Library/Map returns, radio v2 scroll/seek repair, and saved-video admission. `c88bb4ca` integrates upstream7d without replacing its explicit Moss plan-selection/compact-native-prompt changes. Active family-loader and approval/chat caller revisions were refreshed after the merge.

Post-merge Guide workflow commands passed locally: startup/HTTP/review17 cases; native/Moss/navigation/media125; subsystem/route context49; proof projection16. Two old fixtures were updated to assert inert approval/open/selection and the explicit Generate path; API Stop still refuses late persistence and real selected path identity survives the native handler. Additional focused radio/Guild40 and Library/Map/Guild22 checks passed; all four radio verifiers and first-frame singleton/strict-route verifier passed. No real model generation was part of these deterministic checks.

**AI-UX-03 — manual generation cancellation acceptance:** the current native Generate handler calls the engine without an explicit lifecycle options object. The public retry/materialization API supports signal/onEvent and its cancellation regression passes; this does not prove the native Generate UI offers or forwards Stop. Inspect the existing lifecycle owner and verify actual Stop during the next controlled generation, preserving the approved plan and preventing late course commits.

The saved-video repair performs display admission without rewriting accepted Quest/tasks/reviews/proofs/receipts. The legacy source label user-selected is not authoritative attachment provenance; unmatched stored videos remain directly accessible with an honest notice, but cannot bypass topic admission. The new direct link offers a way out of an IAB-refused embed without claiming that playback was tested.


### Latest staging integration before UI deployment

Merged stagingf6a0e65a, retaining its multi-plan library and authenticated durable Termux jobs. These are upstream features, not new real-device acceptance claims. Loader review reproduced a mandatory readiness failure: its requested unified-chat1.2.20 owner was checked against1.2.19. Two new executable source-graph regressions failed before; both pass after the exact readiness fix, family loader1.0.156 cache pins, shared chat1.2.20 handoff and matching Settings runtime query. Explicit approval/path identity fixtures now include the plan-library key rather than bypassing the real handler.

**UI-CAMP-02 / AI lineage follow-up remains open:** the multi-plan store preserves separate plan IDs, but generation/request normalization still drops approvedPlanId. Native display also associates same-capability records by text; separate same-capability plans can inherit apparent completion/failure. Durable Resume rebuilds an intent:new request without originating approvedPlanId/weaveId/pathId. Preserve those actual identities end to end and test linked/revised resume before claiming complete cross-system durable execution. Selected Ollama does not enter this durable native path.

**AI-UX-03 latest:** upstream adds an explicit authenticated Termux Cancel control. Its click was initially blocked by the busy/retryStarting guard while foreground work was active. A focused repair is being validated so this one cancellation action remains available during work while other actions stay guarded. This does not establish generic Ollama UI Stop acceptance; API lifecycle tests remain separate.


**Final integration checks before deploy:** new loader regressions2/2; post-latest-merge Guide commands19+125+49+16 cases all pass. Radio35/35 pass in its dedicated run; one preceding35-case run failed under parallel full-graph CPU load and passed immediately in isolation, so keep test timing under observation rather than claiming flake-free CI. The Termux cancellation verifier now proves Cancel bypasses only the busy/retry guard, uses the stored accepted job ID and pairing token, and leaves disabled/ordinary/declined actions blocked. UI controller cache pin is durable-jobs-v13-cancel-busy. No real Termux/Ollama inference was run by these checks.
