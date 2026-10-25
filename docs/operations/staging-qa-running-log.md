# Staging QA running log and follow-up projects

Updated: **2026-10-25**. This is the current working record for the staging mascot QA session. Update the existing IDs as work progresses; add new IDs for new findings. This is a test and project record, not an architectural contract.

## Current instruction and test environment

The user's current priority is **finish AI testing with flagship Qwen3.5 4B before continuing visual or music side projects**. Keep a running record of issues noticed during testing and issues the user reports, so follow-up work can be tackled in manageable chat projects. Visual work already started is parked and must be preserved.

The authorized scope includes taking fictional local QA records through their real lifecycle when possible. Do not invent physical proof, purchases, counterparties, messages, votes, or settlements to make a test appear complete. Saved user chats must be preserved.

| Item | Recorded state |
| --- | --- |
| Source checkout | `C:\Users\glaed\Downloads\civweave-launch\staging-ai-cors`, branch `fix/staging-ai-cors` |
| Integration target | `staging`; no shipping/main deployment is claimed |
| Last exact live marker tied to the browser results below | `9e7a0cbdc7b93133afeac63d92f748b001560e47`; do not assume it is still the newest public deployment |
| Newly integrated upstream source | `c8870c6e` (36 newer staging commits); current live marker not yet rechecked after this fast-forward |
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

## AI testing queue

| Priority / project ID | Current result | Next acceptance gate |
| --- | --- | --- |
| 1 — **AI-WEV-01: Four-subsystem Quest quality** | Latest real browser draft includes all four in the correct dependency order and includes assembly practice. The targeted revision timed out; the prior review draft is preserved. | Finish the AI-WEV-04 routing/deadline repair, deploy and retry explicitly. Review the resulting revision for skills, four-day schedule, agreed targets and the complete $25 budget. |
| 2 — **AI-MOS-01: Learning Journey to credential** | Native workbench inspected; final completion gate fixed and source tested. No real Qwen course has completed the whole flow. | Qwen plan → review/approval → curriculum → every module assessment → real digital practicum → Cerbanimo acceptance → final competency → portable credential. |
| 3 — **AI-KAM-01: Qwen Endeavor authoring and proof** | Real native proof/reopen/resubmit lifecycle passed using Llama before flagship steering. | Author a new Endeavor through Kamiya with Qwen, then execute honest digital proof and final acceptance. Reproduce the possible short review timeout if it blocks the flow. |
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

**Source repair ready, uncommitted and not live verified:** the existing Ollama loader now retains the selected timeout/context/token configuration. The canonical Weaveling author recognizes explicit saved Quest/weave revisions, retains the governing wish/current plan, and does not hand an explicit Quest revision to Moss merely because it contains learning details. Earlier revision turns remain context rather than replacing the wish. No new chat or model transport owner is added.

Test-first evidence: selected deadline regression failed `120000 !== 600000`; full-page revision initially reached a generic request without explicit `think:false`; a learning-detail revision incorrectly invoked Moss. **63 combined cases now pass**, including actual parent source-graph fresh draft plus exact saved-Quest revision: one model call per requested generation, both canonical structured requests with `think:false`, both runtime deadlines exactly 600,000 ms, original wish/current review retained, saved revision in REVIEW, and stable final bubble. Coherent version/cache pins were also updated; stale exact-version lookups otherwise waited for an already loaded script's load event. These mocked-provider tests prove routing/lifecycle/deadline behavior, not Qwen revision quality. Do not count the repair as deployed or the real semantic revision as passed yet.

## AI-MOS-01 — Moss Learning Journey through final credential

**Not yet live complete:** Qwen plan, curriculum, module assessments, practicum receipt, final competency and credential all remain to be exercised as one real flow. The native workbench previously had zero journeys/sources; no existing course can be counted as a completed test.

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

**Source/test ready; live course pending:** the design wrapper discarded shorter selected deadlines and raced the 600-second setting against a separate 570-second timer. Design, assessment and research fallback also omitted Ollama's `think:false`. The repaired existing owners preserve selected deadlines, delegate timeout/cancellation to the canonical runtime and disable thinking only for Ollama. Missing budgets retain bounded 570-second design / 180-second assessment defaults. Five regressions failed before repair; 56 related tests and five provider/deadline checks pass. Termux SSE and other providers remain covered. Deployment and the real Qwen course are still required.

Three modules normally require one design call and three sequential assessment calls; structure compiles locally. An optional research fallback adds a call if usable sources are absent. Substantial output may still be slow on this CPU; record actual durations and output completeness during the live test.

The plan-approval `prepareNewPath` flow clears manually added sources. Do not add a source before approval and then assume it survived; verify after approval. Explicit Weave/path identity handling is source tested: selected linked paths retain identity, unrelated standalone courses remain unlinked, and model output cannot invent linkage IDs.

### AI-MOS-03 — Explicit learning goal/title/module count parsing

**Source repair ready, not deployed/live verified:** testing exposed the parser losing an explicit requested capability/title and a worded **three short beginner modules** count. Two targeted tests were red before the repair; 29 related cases and a 78-case combined AI run passed after it. The unified capability layer is now version `1.2.18-unified-chat-system-v1-explicit-learning-goal` in the working tree. The real Qwen course flow is still required after deployment.

## AI-KAM-01 — Kamiya Endeavor authoring and proof lifecycle

**Live verified with the earlier Llama model:** imported QA READY-note Endeavor; wrote, saved and reloaded an actual digital note; all three units independently AI-accepted; final Quest accepted. Reopening the last unit revoked final acceptance; resubmission restored it. Evidence: `qa-kamiya-endeavor-accepted.png` and the Passport projection evidence above.

**Still required with Qwen:** direct chat authoring of a new Endeavor, usable units/proof requirements, activation, real digital work, independent review, final acceptance, reopen/revise and acceptance projection. Earlier Llama empty-unit output and Gemma timeout are not flagship passes. Deployed schema, `think:false` and cancellation work has source coverage but cannot substitute for this test.

### AI-KAM-02 — Native review may ignore the shared timeout

**Source-confirmed discrepancy, not yet reproduced with real Qwen review:** native proof review discarded the shared 600-second Settings budget in favor of a 62-second model limit / 65-second abort, and its request omitted `think:false`.

**Source repair ready, uncommitted and not deployed:** the existing validator now preserves the selected deadline, lets the canonical runtime own cancellation, and supplies explicit non-thinking Ollama validation for task/final review. Its focused regressions pass. Confirm actual Qwen proof review after deployment; this source result does not complete AI-KAM-01.

## AI-ROO-01 — Rook Manifest consistency and full safe lifecycle

**Live verified with the earlier Llama model:** created a fictional gift of two notebooks in Albany/today, revised to three in Troy/tomorrow, approved/published, imported one native listing, inspected structured fields and closed it. Evidence: `qa-rook-reviewed-listing.png`, `qa-rook-closed-listing.png`.

**Observed defect:** title/description retained the original two/Albany prompt while structured fields reflected three/Troy. Repair revision coherence in the canonical Manifest author/materializer, then repeat with Qwen and inspect the published native record. Do not claim the revision is correct just because structured fields changed.

**Source repair ready, uncommitted and not deployed:** canonical guide contracts now revise request-derived prose/title together with quantity, place and timing; labeled numeric fields do not rewrite unrelated budget numbers. Focused regressions pass. Actual Qwen review/publication verification is still required.

**Boundary:** no counterparty, actual order, payment, delivery or settlement was fabricated. A full multi-party lifecycle remains untested until a legitimate counterpart/test arrangement exists.

### AI-ROO-02 — Native FellowFare tabs do not switch

**Observed live defect:** Sell, Orders, Wallet and You clicks left the Market content and `#market` URL in place. The DOM had commands `market`, `loom`, `assemblies`, `inbox`, `profile`; button presence alone did not establish functioning navigation. Evidence: `qa-ui-fellowfare-{sell,orders,wallet,you}-phone.png` (four separate files).

This is a functional blocker for broader Rook/native testing, not merely a visual polish task. Trace the canonical command binding before repairing it. No deployed fix is claimed; inspect current uncommitted work before resuming, because a separate investigation was started.

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

## Parked interface projects

**User request:** while waiting on AI, inspect each interface option for hidden, cut-off or incomplete components and build improvements. This broad audit is now parked behind AI testing. Keep confirmed findings separate from hypotheses.

| ID | Finding and evidence | Current work / acceptance |
| --- | --- | --- |
| **UI-NAV-01** | **Confirmed:** mobile Merlin Tools menu at 390 px viewport was left=100/right=474, 84 px offscreen. `qa-ui-mobile-menu-before.png`. | Uncommitted canonical navigation fix measures actual rendered width before clamping; targeted regressions passed. Later complete caller/cache pins, full checks, deploy and reproduce at narrow widths. Not deployed. |
| **UI-SHELL-01** | **Confirmed:** parent 884 px viewport scrolled to 1028 px, adding 144 px dock padding while the native iframe was already shortened. | Uncommitted navigation exclusion for persistent-shell bodies plus a shell boot marker. Verify one intended scrolling surface and reachable dock after deployment. Not deployed. |
| **UI-ANA-01** | **Confirmed:** Anarchadia Proposals/Pipeline retained the large Passport/home region despite hidden state; expanded display rules overrode `[hidden]`. | Uncommitted CSS/asset pins plus [visibility regression](../../scripts/test-anarchadia-native-screen-visibility-v1.mjs); five cases red before/green after. Later test native screen switching live. Not deployed. |
| **UI-FF-01** | **Confirmed:** FellowFare mobile tabs partly cut off You; imported flex layout overrode the five-column grid. `qa-ui-fellowfare-phone.png`. | Uncommitted CSS explicitly restores five equal 44 px minimum-height mobile tabs. [CSSOM tests](../../scripts/test-fellowfare-native-tabs-v1.mjs) pass at 320/390/760/1024. Cache pin/verifier and live post-deploy check remain. Separate from the functional AI-ROO-02 defect. |
| **UI-ANA-02** | **Source-confirmed route risk:** governance/workbench return paths drop embedded/persistent-shell context. Actual path changes can fail strict parent suppression and reintroduce child chrome/chat. | Partial uncommitted routing work/tests exist. Inspect before continuing; no completed/deployed fix is claimed. [Native return tests](../../scripts/test-anarchadia-native-return-v1.mjs) were red against old handlers. Retain strict matching and delegate to the existing parent route owner. |
| **UI-HUM-01** | Human chat panel initially suspected cut off. **Disproved in measured viewports:** actual mobile override produced top 8/bottom 513 at 390×667 and top 8/bottom 446 at 390×600; header/Close reachable. | No patch needed for this observation; speculative base CSS edit was reverted. Evidence: `qa-ui-human-mobile-before.png`. Reopen only with a new reproducible case. |
| **UI-ANA-03** | **Hypothesis:** 58 px module icon plus arrow/gaps could clip long Governance Workbench labels at 320–375 px. | Reproduce visually before editing. |
| **UI-CHAT-01** | **Hypothesis:** very short keyboard viewport (about 280 px high or less) could leave no useful transcript area after header/switcher/composer. | Test with actual keyboard-sized viewport before changing layout. |
| **UI-CAMP-01** | Active v440 loads an old home-declutter guard that only targets v156; brand click currently opens Current Quest. | Source observation, not evidence that a removed dropdown should return. Inventory essential options and their canonical owners before deciding on any change. |

Remaining screen inventory after AI priority:

- Civweave: Current Quest, Quest Library, guide export, app/device, Guilds, Map and Support.
- Living School: journeys, path/modules, sources, visual inspection, practice, quiz, practicum, final and Passport after a real course exists.
- Cerbanimo: New Quest, Workboard, Project Workbench, Proof Observatory, task proof and final.
- FellowFare: Market/Sell/Orders/Wallet/You after command binding is verified.
- Anarchadia: Passport, Proposals, Ledger, Automation, Observatory, Governed Update, Workbench and review/preview/return flows.

## MUSIC-01 — Direct audio and transparent app-aware control (parked)

**User request:** major radio/music overhaul. The current icon is too high, blocks too much screen and does not react to the parent app's colors. Make the launcher transparent, use directly incorporated free streamed/downloaded audio as primary playback, and keep Spotify playlists as an optional extension.

**Observed:** the high opaque control is visible in the FellowFare phone screenshot. Double-counting the dock within an already shortened native iframe is a possible positioning cause, not yet proven.

**Inventory only; no music implementation/deployment is claimed:** the current radio station surface is owned by the second IIFE in [system-radio-agent-v233.js](../../public/app/system-radio-agent-v233.js), `CivweaveRadioStationSurfaceV1`. It currently exposes Spotify links rather than an actual audio player. [radio-safe-stations-v1.js](../../public/app/radio-safe-stations-v1.js) replaces the panel in SAFE mode; [radio-track-suggestions-v240.js](../../public/app/radio-track-suggestions-v240.js) inserts Spotify suggestions. Extend the existing single owner and make extensions cooperate; do not add another player/runtime.

The existing [open-music catalog](../../public/downloads/hub-media/open-music/catalog.json) contains 17 unique licensed metadata records, with policy, curated playlists and lazy-download metadata alongside it. Accepted policy categories include CC BY, CC BY-SA, CC0 and public domain; unknown/NC/ND are excluded. These metadata records are a starting point, not proof that every URL/permission/header currently works.

Two source pages were checked during research and list CC BY 3.0: [Freedom in my voice — Carosone](https://ccmixter.org/files/Carosone/28236), and [Climate Change The Dirty Water Remix — J.Lang](https://ccmixter.org/files/djlang59/61065). Preserve creator/featured-artist attribution, source and license links, and change notices as required. [CC BY 3.0 terms](https://creativecommons.org/licenses/by/3.0/) permit sharing/adaptation with attribution. The third sampled track, **Mind Map This — texasradiofish**, still needs source-page verification. Do not download commercial Spotify tracks.

Chat-sized implementation gates when this project resumes:

1. Verify catalog URLs, current licensing/attribution, byte-range streaming and fetch/CORS requirements for optional offline caching. These transport checks are not done.
2. Agree one existing canonical player/lifecycle owner that survives native route changes where appropriate; keep playback demand explicit, with no autoplay or automatic downloads.
3. Build direct audio play/pause, next, seek, volume, queue, loading/error states and visible attribution/license/source. Keep Spotify as an optional extension.
4. Add explicit download/remove/offline controls and bounded storage behavior; prove reload/offline playback and removal with actual tracks.
5. Position and theme the transparent launcher against the parent app/dock at desktop and mobile sizes; verify keyboard/accessibility and that controls do not obscure primary work.

## Deployment and verification record

| Commit | Deployed work / evidence |
| --- | --- |
| `d26159f365971b9fe8782c479f13c916e4cb6b9b` | Shared embedded chat ownership / duplicate fix; live parent/child count and route check passed. |
| `508467235095a58e75cb44b547a3bbd29774f748` | Complete-outcome Weaveling author, selected Quest/governance state and Merlin single-source preview ownership; Full DOM CI and deployment green. |
| `dda7c23a933289a188de5ff8ed18696873323c08` | Moss all-current-module and matching-receipt final/credential gate; Full DOM CI `40217420777` and deployment `40217420783` green; exact live marker verified. |
| `9e7a0cbdc7b93133afeac63d92f748b001560e47` | Structured Quest author owns its planning contract; Full DOM CI `40218723615` green; exact live marker verified after staging deployment `40218723376`. |

Focused checks already reported passing include 31 Weaveling scope cases; 36 preview/full-DOM/selection/owner cases; 56 stream/final-owner/scope/proof cases; 34 Moss cases including the six gate regressions; native route/structure checks; and a combined six-case new Weave/Rook/Merlin full-DOM run. Record the relevant command/results with each new change rather than treating these counts as current guarantees after unrelated edits.

Repository-wide legacy checks have pre-existing stale version/hash failures. **No claim is made that every repository check passes.** Uncommitted visual/routing changes and intentionally failing tests are not part of the live deployment above. Preserve them while AI work proceeds; review the diff and rerun their focused contracts before any later commit/deploy.

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

> Continue Qwen3.5 4B Weaveling QA from docs/operations/staging-qa-running-log.md. Inspect the in-flight four-subsystem shelf revision. Verify all four paths, four workable days, known versus unknown participant skills, agreed targets before purchase, practice/material budget within $25, and REVIEW status. Test a further revision only if necessary. Investigate why raw/draft/compile says Not reached after a saved result. Record actual evidence; do not execute the physical shelf plan.

**AI-MOS-01 / AI-MOS-02 — Finish one real digital Learning Journey:**

> Use Qwen3.5 4B to take the standalone QA Temperature Conversions journey through plan review, curriculum, every module assessment, actual digital worksheet practicum, matching Cerbanimo AI receipt, final competency and portable credential. Use the saved worksheet as honest agent-created evidence. Observe real generation timing and source retention. Fix only reproduced blockers at their canonical owners, and update the running QA log.

**AI-KAM-01 / AI-KAM-02 — Complete direct Qwen authoring and proof:**

> Test Kamiya direct Endeavor authoring with Qwen3.5 4B and an honest small digital artifact. Exercise activation, per-unit independent proof review, final acceptance, reopen and resubmit. Reproduce and repair the native 62/65-second timeout and missing think:false discrepancy without adding another transport owner. Record the live result and update the QA log.

**AI-ROO-01 / AI-ROO-02 — Repair native access and coherent revision:**

> Inspect existing unfinished FellowFare work, then reproduce the native tabs remaining on Market. Fix the canonical command binding with a failing regression. With Qwen3.5 4B, create and revise a fictional local Manifest; confirm title, description, quantity, place and date agree in chat review and the published native listing, then close it. Do not invent counterparties or settlements. Update the running QA log.

**AI-MER-01 — Improve one generated preview against its requirements:**

> Continue the QA READY badge preview with Qwen3.5 4B. Request a targeted revision with visible READY badge text and the intended heading, verify interaction plus exact source/export agreement, then exercise Keep and Revert. Keep the proposal in the local review process; do not publish or vote. Record semantic quality separately from workflow success.

**UI-NAV-01 / UI-SHELL-01 / UI-ANA-01 / UI-FF-01 — Finish the existing visual fixes after AI priority:**

> Inspect and preserve the uncommitted navigation, persistent-shell, Anarchadia hidden-state and FellowFare tab CSS fixes listed in the running QA log. Complete coherent asset pins, run the focused regressions, review the diff and deploy only completed work. Reproduce each original visual issue at mobile and desktop sizes. Do not treat source tests as a live acceptance pass.

**UI-ANA-02 — Complete context-preserving native route/return behavior:**

> Inspect the partial Anarchadia governance/workbench routing changes and failing native-return tests. Finish the existing canonical parent navigation path while retaining strict frame identity checks. Verify entry, internal navigation and return in the persistent shell with one chat/chrome owner, plus standalone behavior. Update the log with exact routes and evidence.

**MUSIC-01 — Verify direct audio sources before building the player:**

> Resume MUSIC-01 only after the current AI testing priority is satisfied. Verify the existing open-music catalog's direct URLs, current license/attribution, byte-range streaming, CORS and optional offline-cache behavior. Extend the single existing radio owner with explicit direct playback/download controls, keep Spotify optional, and make the launcher transparent, parent-color-aware and correctly positioned. No autoplay, automatic downloads or second player owner. Verify actual playback and offline removal, then update the QA log.

**Remaining visual inventory — inspect before proposing fixes:**

> Resume the parked interface inventory in the running QA log after AI priority. Visit each remaining control/screen, capture actual mobile and desktop behavior, distinguish confirmed defects from hypotheses, and add stable issue IDs with evidence and bounded acceptance criteria. Do not revive removed UI or duplicate shared capabilities just because a label or screen exists.

## Append-only session updates

- **2026-10-25:** user redirected effort to AI testing first and requested this durable running document. Latest fresh Qwen browser weave has all four paths in the correct order and includes assembly practice; participant-skill assumptions, scheduling, targets, practice budget and inaccurate progress-stage display remain open. Visual and music implementation are parked; their source work and findings are retained above.
- **2026-10-25, later:** targeted Weaveling revision timed out while the prior review survived. Exact-source reproduction found missed saved-Quest revision routing plus the loader's hardcoded 120-second deadline. Test-first source repairs are in progress. Upstream staging was fast-forwarded to `c8870c6e` while preserving dirty AI and parked UI work; the new live marker has not yet been verified. Moss goal parsing, Rook prose coherence and Kamiya review-budget source fixes are ready but not yet deployed/live accepted.
