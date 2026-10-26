# Staging QA running log and follow-up projects

Updated: **2026-10-26**. This is the current working record for the staging mascot QA session. Update the existing IDs as work progresses; add new IDs for new findings. This is a test and project record, not an architectural contract.

## Current instruction and test environment

The user's latest instruction is **check the AI tests and update this log, then resume screen-by-screen visual repairs and missing/barebones functionality**. The Qwen3.5 4B results and unfinished AI acceptance gates remain recorded below. Visual/navigation/music work is now resumed; preserve and finish its existing source changes. Keep recording every observed or user-reported issue as a bounded follow-up project.

The authorized scope includes taking fictional local QA records through their real lifecycle when possible. Do not invent physical proof, purchases, counterparties, messages, votes, or settlements to make a test appear complete. Saved user chats must be preserved.

| Item | Recorded state |
| --- | --- |
| Source checkout | `C:\Users\glaed\Downloads\civweave-launch\staging-ai-cors`, branch `fix/staging-ai-cors` |
| Integration target | `staging`; no shipping/main deployment is claimed |
| Current exact live marker | `f6a9cd837ee07b07c19427128c84af492024031f`, verified 2026-10-25 at approximately 23:40 UTC |
| Deployment / focused app CI | Deploy `40245640275` and Guide Full DOM Startup `40245640639` both succeeded. This is not a claim that every legacy repository check passes. |
| Earlier browser results | The four-path shelf draft and prior preview/proof results used `9e7a0cbd` or the specifically recorded earlier deployment; later checks identify their deployment explicitly. |
| Integrated upstream base | `c8870c6e` (36 newer staging commits), preserving Moss streaming/source-recovery and Termux context updates |
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

`f6a9cd83` deploys the saved-Quest revision route and selected Ollama timeout repair, Moss explicit capability/title/module-count parsing, Rook revision prose consistency, Kamiya selected review deadlines, and Moss course-stage deadline/thinking fixes. Focused checks passed before deployment. Parked visual/native-route edits were excluded.

**Latest live outcome, checked October 26:** Moss's original prompt reached Qwen and saved **QA Temperature Conversions** with the correct title, exactly three relevant modules, worksheet outcome and approval gate. Approval and native handoff passed. Research fallback completed, then **curriculum design timed out; 0/3 modules were built**. An overlapping background Cerbanimo economic review also timed out. The approved plan survived; final competency and credential remained locked. Evidence: `qa-moss-qwen-plan-review.png` and `qa-moss-qwen-course-timeout-2026-10-26.png`. This is a failed course-build test, not a completed Learning Journey. Weaveling's repaired revision route and Rook/Kamiya fixes still need real Qwen retests.

## AI testing queue

| Priority / project ID | Current result | Next acceptance gate |
| --- | --- | --- |
| 1 — **AI-WEV-01: Four-subsystem Quest quality** | Latest real browser draft includes all four in the correct dependency order and includes assembly practice. The targeted revision timed out; the prior review draft is preserved. | Retry the deployed AI-WEV-04 routing/deadline repair explicitly. Review the resulting revision for skills, four-day schedule, agreed targets and the complete $25 budget. |
| 2 — **AI-MOS-01: Learning Journey to credential** | Real Qwen plan/approval/handoff passed on `f6a9cd83`; design timed out, 0/3 modules. Approved plan retained, credential locked. | Isolate background interference and design output/duration before explicit retry; then all module assessments, real practicum receipt and final credential gates. |
| 3 — **AI-KAM-01: Qwen Endeavor authoring and proof** | Real native proof/reopen/resubmit lifecycle passed using Llama before flagship steering. | Author a new Endeavor through Kamiya with Qwen, then execute honest digital proof and final acceptance. Verify the deployed selected-deadline review fix in the actual flow. |
| 4 — **AI-ROO-01: Manifest revision consistency** | Earlier create/revise/approve/publish/inspect/close passed with Llama; revised title/description were stale. | Repeat with Qwen; ensure title, description, quantity, place and date agree after revision and in the native listing. Repair native tab access if it blocks the test. |
| 5 — **AI-MER-01: Preview semantic quality** | Real Qwen preview generation, interaction, Keep and Revert passed. Generated badge did not fully satisfy its requested appearance. | Revise the preview against explicit badge text/appearance requirements; verify the same source is previewed and exported. No production vote/publication is needed. |
| Alongside each — **AI-UX-01 / AI-UX-02** | Streaming lifecycle has deterministic coverage; duplicate chat fixed live. | Observe real Qwen completion without unnecessary replay/redraw, and keep checking one parent chat while switching native routes. |

## AI-WEV-01 — Weaveling routing, planning and revision

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

**Confirmed source/test defects, repaired locally:** native tabs used invalid empty `aria-current`, internal navigation could leave the wrong tab selected, and cancelling an arrangement persisted `cancelled` but repainted from stale in-memory Orders state. Persistence now belongs to the canonical marketplace API; the native controller calls its existing bridge directly. Retained iframe transport still authenticates sender and origin. The functional suite covers all five screens, profile save, arrangement cancellation/repaint, reviewed import once, listing publish/search/details/closure and iframe authentication. No real payment or counterparty was fabricated. Live verification follows deployment.

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
| **UI-NAV-01** | **Confirmed:** mobile Merlin Tools menu at 390 px viewport was left=100/right=474, 84 px offscreen. `qa-ui-mobile-menu-before.png`. | Uncommitted canonical navigation fix measures actual rendered width before clamping; targeted regressions passed. Later complete caller/cache pins, full checks, deploy and reproduce at narrow widths. Not deployed. |
| **UI-SHELL-01** | **Confirmed:** parent 884 px viewport scrolled to 1028 px, adding 144 px dock padding while the native iframe was already shortened. | Uncommitted navigation exclusion for persistent-shell bodies plus a shell boot marker. Verify one intended scrolling surface and reachable dock after deployment. Not deployed. |
| **UI-ANA-01** | **Confirmed:** Anarchadia Proposals/Pipeline retained the large Passport/home region despite hidden state; expanded display rules overrode `[hidden]`. | Uncommitted CSS/asset pins plus [visibility regression](../../scripts/test-anarchadia-native-screen-visibility-v1.mjs); five cases red before/green after. Later test native screen switching live. Not deployed. |
| **UI-FF-01** | **Confirmed:** FellowFare mobile tabs partly cut off You; imported flex layout overrode the five-column grid. `qa-ui-fellowfare-phone.png`. | Uncommitted CSS explicitly restores five equal 44 px minimum-height mobile tabs. [CSSOM tests](../../scripts/test-fellowfare-native-tabs-v1.mjs) pass at 320/390/760/1024. Cache pin/verifier and live post-deploy check remain. Separate from the arrangement repaint and selection defects in AI-ROO-02. |
| **UI-ANA-02** | **Source-confirmed route risk:** governance/workbench return paths drop embedded/persistent-shell context. Actual path changes can fail strict parent suppression and reintroduce child chrome/chat. | Source repair complete: governance/workbench delegate native travel and returns to the existing parent; only those two native page paths are allowlisted, with strict origin/frame/path matching retained. Fifteen native-return cases and related route/rescue checks pass. Caller pins updated; deployment/live verification pending. |
| **UI-NAV-02** | **Confirmed on f6:** Moss shortcuts remained open after travelling to FellowFare. The menu covered Wallet on the phone viewport (`qa-ui-wallet-mobile-before.png` captures the overlay, not an unobstructed Wallet). | Existing route-change subscriber now cancels hold state and closes the previous guide menu. Regression failed before and passes after; live verification pending. |
| **UI-MOS-01** | **Confirmed:** failed native chat course generation retained Generating curriculum and an overnight running clock, despite 0/3 modules and a terminal timeout report. | Existing observer now settles failed/partial/completed chat runs and freezes request/session clocks. Five regressions red before/green after, retained reports/history, idempotent terminal handling. Background calls are labeled background unless an actual parent request is recorded. Live verification pending. |
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

**Source implemented, deployment/live checks pending:** the existing `CivweaveRadioStationSurfaceV1` in [system-radio-agent-v233.js](../../public/app/system-radio-agent-v233.js) owns one parent player. Embedded systems alias it. Controls include play/pause, previous/next, seek, volume, attribution/source/license, explicit verified offline save/remove and visible errors. No autoplay or audio fetch occurs until Play/Save. Route palettes update without replacing the playing audio element. SAFE mode excludes unaudited direct recordings; curated Spotify remains optional.

Three unmodified CC BY 3.0 source recordings are included on the app origin: J.Lang featuring Coruscate, **Climate Change The Dirty Water Remix**; Carosone featuring SackJo22 and Ditto Ditto, **Freedom in my voice**; Aussens@iter featuring Mr. Yesterday and Snowflake, **The Singularity**. Total 12,044,592 bytes. Primary pages and exact hashes/attribution are retained in [STARTER-CREDITS.md](../../public/downloads/hub-media/open-music/STARTER-CREDITS.md) and [starter catalog](../../public/downloads/hub-media/open-music/starter-catalog.json). The original 17-record discovery catalog is unchanged. Mind Map This is tagged explicit and was excluded from the default starter selection.

The remote ccMixter media URLs reject missing/cross-site referrers and lack fetch CORS permission; same-origin licensed redistribution makes direct playback and optional offline storage testable. The service worker pre-caches only the small starter manifest, never the audio. Four executable cache tests cover required readiness, missing-manifest repair, atomic failure and no audio prefetch. Sixteen player tests cover actual manifest/hash metadata, all five theme queues, controls, single ownership, offline failures, SAFE mode and stable DOM updates.

Acceptance still required in the deployed browser: actual time advancing, pause/next/seek/volume, explicit save/reload/cache playback/remove, one audio owner through route travel, transparent positioning/color at phone and desktop sizes. Follow-up expansion: verify/incorporate the other eligible catalog recordings and complete SAFE content audits; do not treat all 17 metadata records as playable or audited.

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

> Inspect existing unfinished FellowFare work, then reproduce the native tabs remaining on Market. Fix the canonical command binding with a failing regression. With Qwen3.5 4B, create and revise a fictional local Manifest; confirm title, description, quantity, place and date agree in chat review and the published native listing, then close it. Do not invent counterparties or settlements. Update the running QA log.

**AI-MER-01 — Improve one generated preview against its requirements:**

> Continue the QA READY badge preview with Qwen3.5 4B. Request a targeted revision with visible READY badge text and the intended heading, verify interaction plus exact source/export agreement, then exercise Keep and Revert. Keep the proposal in the local review process; do not publish or vote. Record semantic quality separately from workflow success.

**UI-NAV-01 / UI-SHELL-01 / UI-ANA-01 / UI-FF-01 — Finish the existing visual fixes:**

> Inspect and preserve the uncommitted navigation, persistent-shell, Anarchadia hidden-state and FellowFare tab CSS fixes listed in the running QA log. Complete coherent asset pins, run the focused regressions, review the diff and deploy only completed work. Reproduce each original visual issue at mobile and desktop sizes. Do not treat source tests as a live acceptance pass.

**UI-ANA-02 — Complete context-preserving native route/return behavior:**

> Inspect the partial Anarchadia governance/workbench routing changes and failing native-return tests. Finish the existing canonical parent navigation path while retaining strict frame identity checks. Verify entry, internal navigation and return in the persistent shell with one chat/chrome owner, plus standalone behavior. Update the log with exact routes and evidence.

**MUSIC-01 — Verify direct audio sources before building the player:**

> Resume MUSIC-01 only after the current AI testing priority is satisfied. Verify the existing open-music catalog's direct URLs, current license/attribution, byte-range streaming, CORS and optional offline-cache behavior. Extend the single existing radio owner with explicit direct playback/download controls, keep Spotify optional, and make the launcher transparent, parent-color-aware and correctly positioned. No autoplay, automatic downloads or second player owner. Verify actual playback and offline removal, then update the QA log.

**Remaining visual inventory — inspect before proposing fixes:**

> Continue the active interface inventory in the running QA log. Visit each remaining control/screen, capture actual mobile and desktop behavior, distinguish confirmed defects from hypotheses, and add stable issue IDs with evidence and bounded acceptance criteria. Do not revive removed UI or duplicate shared capabilities just because a label or screen exists.

**OPS-CI-01 — Modernize the six confirmed stale checks:**

> Read OPS-CI-01 in the running QA log and compare the failing staging logs with their earlier failures. Trace each current canonical owner, replace obsolete exact-version/string assertions and incomplete VM fixtures with behavioral contracts, and preserve existing lifecycle and safety requirements. Do not change application behavior solely to satisfy historical checks. Update the log with before/after evidence.

## Append-only session updates

- **2026-10-25:** user redirected effort to AI testing first and requested this durable running document. Latest fresh Qwen browser weave has all four paths in the correct order and includes assembly practice; participant-skill assumptions, scheduling, targets, practice budget and inaccurate progress-stage display remain open. Visual and music implementation are parked; their source work and findings are retained above.
- **2026-10-25, later:** targeted Weaveling revision timed out while the prior review survived. Exact-source reproduction found missed saved-Quest revision routing plus the loader's hardcoded 120-second deadline. Test-first source repairs are in progress. Upstream staging was fast-forwarded to `c8870c6e` while preserving dirty AI and parked UI work; the new live marker has not yet been verified. Moss goal parsing, Rook prose coherence and Kamiya review-budget source fixes are ready but not yet deployed/live accepted.

- **2026-10-26, interface resumption:** checked the failed Moss design report (0/3) and preserved the approved plan. Corrected the FellowFare all-tabs-outage claim after settled live navigation. Integrated mobile tab sizing, stale guide-menu closure, hidden-screen styling, strict Anarchadia native returns, same-document arrangement repaint, terminal run clocks, and direct audio starter/player at source. First combined integration run: 86/86 passed; deployment and actual browser acceptance pending.
