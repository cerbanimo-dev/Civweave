# Civweave.cc headquarters Starling service — free-budget contract v1

Status: **proposed, not enabled or deployed**. This is a headquarters-only service contract. It does not replace the existing Guild Starling planner, cooperative local worker, canonical model transport, node AI wallet, Quest owner, Worldweaver owner, or human governance.

## Scope and purpose

Civweave.cc is the digital headquarters. Its installed Cloudflare worker may host an operator-approved, recurring, cloud-inference-powered Starling Collective that builds useful reusable artifacts even when no membership fees or compute top-ups arrive. This special background use of a Cloudflare account's included daily Workers AI capacity must **not** be the default of mobile Guild nodes, free self-hosted Guild servers, or a generic installation.

Other Guilds receive **portable outputs** (versioned Learning Journeys, Worldweaver workshop manifests, Quest mix templates, facilitation materials), not a standing obligation to fund the headquarters inference process. The headquarters publication catalogue remains readable and its previously published artifacts importable even while inference is offline or capacity is exhausted.

Never infer headquarters authority from a request hostname, browser-supplied boolean, template ID, Guild founding claim or visual page. The server operator explicitly enables this feature with deployment-bound configuration, authenticated backend identity and an operator-controlled shutdown/kill switch. An ordinary self-hosted instance has the policy disabled by default.

## Free-account daily allocation

Workers AI advertises 10,000 included neurons per Cloudflare account per UTC day, resetting at 00:00 UTC (subject to current provider policy). The accounting authority MUST obtain the currently configured free entitlement and actual account-pool availability rather than assume each host, node, hostname, Worker or Durable Object has its own 10,000.

For the 10,000-neuron baseline only:

| Account daily pool | Neurons | Rule |
| --- | ---: | --- |
| Owner protected use | 1,000 | Hard reserve, accessible only to authenticated headquarters owner |
| One other potential human member | 900 | Hard reserve even when no member is online; the member must have an authenticated capacity session |
| Headquarters Starling Collective | 8,100 | Maximum daily autonomous spending ceiling, never allowed to borrow human reservations |
| Total | 10,000 | Hard account-level ceiling, not three free Cloudflare allocations |

If the actual included entitlement changes, the member's 900 and owner's 10% are preferred protection targets, and the Collective is reduced first. For a provider-reported free pool F: owner target = floor(F * 0.10); member target = min(900, max(0,F - owner target)); Collective target = max(0,F - owner target - member target). If the provider budget falls below human reservations, stop the Collective and report insufficient human capacity; do not promise inaccessible compute.

This special headquarters seating rule is explicit and does not alter the general Community Compute Dividend policy, normal 900-neuron resident allowance, usual starter seat counts, Host Node Steward economics, or tier-specific hosted-Collective quotas for other Guilds.

### Invariants

1. Cloudflare free neurons are **account-shared**, including unrelated node generation and validation. No isolated HQ wallet is invented. All hosted requests drawing on this account must reserve through the existing **canonical node/account AI ledger** or a verified account-wide arbitration extension to it; otherwise the promised human reserves cannot be guaranteed.
2. Admission is **atomic**: quote upper-bound neuron cost using the configured model tariff, estimated input and capped output; reserve before inference; settle against provider-reported actual usage; release unused authorized capacity. Keep the reservation for an interrupted/unconfirmed bill until reconciled; never assume failure was free.
3. Total outstanding reservations plus settled charged neurons cannot exceed the free account allowance. The Collective's outstanding plus spent allocation cannot exceed its assigned cap. A request whose bounded upper quote cannot fit is not dispatched.
4. The two human reservations are not lent to Starling at the end of the day. Unused Starling capacity does not carry over. The daily clock is UTC, with idempotent rollover across redeploys or concurrent scheduled calls.
5. Do **not** automatically charge lifetime wallets, communal funds, paid overage or top-ups. If the Cloudflare account is Workers Paid, a separate per-request free-only policy and application hard cap are still required to prevent silent billed overages.
6. If another Worker bypasses the common allocator, reconciliation fails, usage is unavailable, the billing plan/model becomes restricted, or an outage consumes capacity unexpectedly: pause Starling with an explicit reason. Prefer safety margin when usage is stale; do not trust the worker's own estimate as proof of free remainder.
7. Keep human/member access working while Starling is paused. Read-only catalogue access must not call a model.
8. This budget is for **inference**. Free hosting is also subject to independent Worker request/CPU, Durable Object/storage, queue and bandwidth limits. Do not claim the whole digital headquarters is guaranteed to cost $0 merely because Workers AI is within 10,000 neurons.

## Relationship to canonical owners

- Starling persona registry, deliberation and planning: \`public/app/shared/starling-collective-v1.mjs\` and \`public/app/starling-collective-v1.js\` where currently authoritative. Use the existing eight character/persona definitions; do not create a second roster or shadow planner.
- Guild Starling authorization, member sessions, line caps and exact-confirmation publication: \`cloudflare/mobile-guild-edge/src/guild-starling-collective-v1.mjs\` and existing service transport. HQ automation is a distinct trusted scheduling **caller**, not a replacement for Guild admission or human proposals.
- Cloud account AI budget / signed capacity sessions: the existing node-cloud AI wallet, capacity and billing authorities. Extend their server-side account ledger for a named \`headquarters:starling\` spending class rather than inventing another invoice ledger. One cloud account can serve several nodes.
- Worldweaver manifest / NPC pilot intent: \`public/app/shared/worldweaver-core-v1.mjs\`. Worldweaver cannot activate an external 3D runtime, grant NPC privileges, assess learning or publish Guild Quests on its own.
- Weaveling: canonical Quest planning and activated state. Moss: Learning Journeys, assessments and credentials. Kamiya/Cerbanimo: tasks and evidence/quality gates. Rook/FellowFare: listings and fulfillment. Merlin/Anarchadia: real human governance. A Starling-generated cross-system Quest mix is a **reviewable composite of references** to these owners, not copied mutable state or a parallel achievement ledger.
- The existing Guild local cooperative scheduler remains **opt-in local-only**, and the mobile Guild template must not ship the HQ scheduler, privileged credentials or free-budget special case.

## Collective purposes

The standing headquarters Intention is: **create and improve portable, inspectable, accessible tools that help other Guilds learn, coordinate and build local capability.**

Priority weights guide queued proposals, not rigid quotas. All weights refer to the **8,100-neuron Starling ceiling**, never the human reserves.

| Priority | Workstream | Nominal share | Example durable output |
| --- | --- | ---: | --- |
| 1 | Worldweaver + Moss Learning Journeys | 35% | Compact learning-workshop template with explanation, interactive stations, quiz rubric and low-power 2D projection |
| 2 | Cross-system Quest mixes | 25% | Learn → practice → build → verify → help/coordinate Quest scaffold, with references to the respective owners |
| 3 | Simulated learner, accessibility and quality review | 20% | Offline accessibility checks, NPC rehearsal notes, clarity/factual/provenance audits and bounded correction proposals |
| 4 | Documentation, adaptation and distribution | 10% | Versioned lesson adaptation, translations where verified, citations, install notes and text-only fallbacks |
| 5 | Civic-art and storytelling releases | 5% | Original public-interest satire, reflective interactive media and manipulation-literacy stories that may also be adapted into learning workshops |
| 6 | Experimental improvements | 5% | Research questions, template gap analysis and proposed changes to future tools; no autonomous code deployment |

Work may be carried across several days. Weights can yield to urgent review/blockers without ever bypassing the hard budget. Prefer a completed, tested artifact to a high volume of unfinished idea drafts.

### Initial release catalogue

1. **Energy independence:** household-scale power literacy, load estimation, safety boundary, simulation, sourcing, and reviewable task plans. No hazardous electrical instructions outside appropriate expert-reviewed guidance.
2. **Tarot symbolism and recall:** a Learning Journey with Major and Minor Arcana, accessible memory stations, practice spreads and synthesis rubric, with an optional Worldweaver workshop.
3. **Mutual-aid resource mapping:** offline-first mapping exercise, skill-and-resource matching, non-identifying data defaults, voluntary assistance requests and local Quest collaboration.
4. **Community garden and food systems:** seasons/local adaptation, planning simulation, stewardship rotation, supplies, and real-world proof tasks.
5. **Learning-to-create:** beginner workshop to build a small usable app or educational game with constrained code workshop tools, staged previews and explicit approval to run/publish.

These are candidate example themes, not automatic claims that the learning materials have been sourced, verified, activated or completed.

## Bounded inference architecture

The headquarters operator explicitly opts into a **durable scheduled service**. A Cron Trigger or Durable Object alarm wakes it; no browser, resident session or Starling Lounge must remain open. Use existing Cloudflare deployment scheduling facilities rather than stacking separate chat polling loops. Lease one scheduler leader at a time using existing transactional DO storage, maintain idempotency keys and enforce per-job runtime, turn, token and neuron ceilings.

Pipeline:

\`admit + lock → retrieve a versioned task brief → budget quote/reservation → dispatch one bounded persona turn → persist outcome/usage → compact context → next permitted turn or suspend → deterministic checks → independent critic pass → review candidate\`

Each job has a finite stop condition and can checkpoint between wakeups. It is **not** an unbounded eight-agent chat session; logical personas are run serially through the available approved Cloudflare model(s), and only the roles useful to that particular task are invoked. A compact context specialist supplies source-aware brief slices, current state and explicit constraints to each next persona. No model should receive an entire archive when a bounded brief suffices.

Prefer the least neuron-intensive eligible and available model for drafting/classification and reserve the stronger available model for orchestration, difficult synthesis and final review. Model choice is versioned configuration; model availability, billing eligibility and precise neuron cost must be checked against the current Cloudflare catalog. Existing local-model names must not be assumed to be offered through Cloudflare Workers AI.

A finite proposed job may stop with \`ready-for-review\`, \`blocked\`, \`out-of-neurons\`, \`awaiting-source\`, \`quality-failed\` or \`interrupted\`. These are real observable outcomes, not prompts for infinite retries. When scheduled inference cannot run, it preserves state and continues the following UTC day when free budget is available. Kill switch blocks new reservations and prevents further scheduled turns, while retaining completed receipts.

### Suggested minimal durable records

- \`hq_starling_policy\`: operator-enabled deployment identity, schema version, consent, pause flag, budget settings, allowed models, allowed tool scopes.
- \`hq_starling_day\`: UTC day, provider-entitlement snapshot, human protected balances, Starling spent/reserved, reconciled account usage, updated timestamp.
- \`hq_starling_jobs\`: job ID, source request / Intention, workstream, priority, state, current artifact revision, lease expiration, cursor, safe retry key.
- \`hq_starling_turns\`: logical persona, selected model, approved context provenance, request receipt, actual usage / unsettled reservation, public summary and error state. Store user/private prompts only within their explicit authorization scopes.
- \`hq_template_candidates\`: provenance, canonical owner references, declared dependencies, licence, accessibility checks, review decisions and immutable version/hash.
- \`hq_template_catalogue\`: approved portable templates only, with signed manifest, immutable version, import requirements, source citations, media content hashes and deprecation/version transitions.

Do not expose private model deliberation, hidden system instructions or secrets to the public activity stream. Public HQ dashboards show **summaries and receipts**, consumed/free/reserved neurons, blocked reasons, current queue and template review status.

## Worldweaver-to-Guild publishing pipeline

1. **Author:** propose a template from a standing purpose, human request or authorized public Guild need. Never mine private chats, Passports, locations or Guild projects by default.
2. **Compose:** produce a typed Worldweaver room/workshop manifest with bounded declarative stations, NPC pilot roles, semantic alternatives, source references and exact cross-system Quest/Learning Journey dependencies.
3. **Verify:** schema validation, citation/provenance check, source and licensing check, unsafe content/code/media filtering, accessibility test, small-model trial run, bounded simulation and QA notes. Synthetic testing evidence remains explicitly synthetic.
4. **Review:** place candidate in headquarters review queue. A human approver authorizes global publication of the exact hash; Starling personas never count as human votes or approval.
5. **Publish:** export a signed, content-addressed portable template manifest with semantic version and size caps to the headquarters public catalogue. Do not silently activate a Quest, issue a credential, cast a vote, grant spending authority or execute generated JavaScript.
6. **Import:** any other server optionally requests/downloads the template or receives it over an authorized mesh sync. Import must work with local/offline tools, list required assets/models, show estimates and maintain its own owner/session and consent rules; the recipient is not required to enable cloud inference or the HQ Starling daemon.
7. **Improve:** collect only explicitly submitted, non-identifying quality feedback and authorized error reports, propose versioned revisions, preserve prior hashes, and keep review gating. Never auto overwrite another Guild's local adaptation.

### Portable manifest minimum

Portable documents should have immutable \`templateId\`, \`version\`, \`schema\`, \`title\`, \`kind\`, \`sourceLicence\`, \`sourceRefs\`, \`worldweaver\` declarative spaces/stations, \`learningJourney\` reviewable references, \`questMix\` reviewable dependencies, \`capabilitiesRequired\`, \`offlineFallback\`, \`assetHashes\`, \`qualityReceipt\`, \`publisherSignature\`. The manifest is **content**; the importing server's trusted owners still decide if any actions are authorized.

Templates can start with no 3D runtime and use an accessible 2D or static variant; these are real valid deliverables, not mock claims of a live 3D simulation.

## Safety and governance

- Only preapproved server tools and explicitly scoped capabilities; no arbitrary HTTP, shell, runtime patching, code execution or automatic source merge/deploy.
- Private source material requires the corresponding owner's permission; public review output must strip credentials, session tokens, private evidence and raw conversation histories.
- Human decisions on intentions, Quest activation, published materials, resource expenditure and Guild governance stay with the canonical human authority.
- Separate approval and evidence receipts for generated code, media, source citations and learning assessment.
- Graceful downgrade is: **pause inference, retain state, serve catalogue and normal human workloads**.
- Publication and adoption metrics should represent actual authenticated events, never fabricated agent votes or synthetic learner results.

## Implementation stages and acceptance checks

1. **Account-level accounting contract and tests.** Verify 10,000 → 1,000 owner / 900 member / 8,100 Starling; all three reservations cannot overlap; 00:00 UTC rollover; concurrency; reservation/refund/unsettled reconciliation; unexpected usage; zero funded overage. Validate all callers that consume the Cloudflare account's Workers AI allocation against a single authoritative account-level cap.
2. **Production-only HQ identity gate.** Feature off by default everywhere. Staging deploys use stub AI/preview catalogue unless an explicit test allocation is approved. Reject forged host headers, unauthenticated requests and unprovisioned deployment identity; ensure normal free Guilds do not receive background inference.
3. **Scheduler + durable receipts.** Finite jobs, one lease, per-turn model budget, restart recovery, no duplicate billing, live pause and explicit out-of-budget status. Mock job tests precede Cloudflare testing.
4. **Existing Starling persona/runtime adapter.** Bounded serial cloud turns with context condensation and signed provenance, no alternate chat or persona database.
5. **Worldweaver template builder and verification.** First compact end-to-end Learning Journey + Quest mix in review-only state; verify accessibility, schema and references.
6. **Catalogue + opt-in import.** Versioned signed manifest, hash check, read-only offline availability after download, local-only import and no implicit runtime activation.
7. **Operator dashboard, rollout and observation.** Separate owner/member/Starling balances, queue, completed/failed reasons, last budget reconciliation, template candidates and approval controls. Only enable production scheduler after a real test of budget enforcement and cancellation. No production auto-merge.

### Release blockers

Do not claim this is live until account-wide budget coordination is confirmed, an actual Cloudflare Workers AI call is quoted and settled against that coordinator, the HQ identity check is proven, the deployed scheduler survives shutdown/UTC rollover, and a human-reviewed Worldweaver/Living School/Quest manifest has been imported through the existing canonical owners. Documentation alone is not implementation.

## Authority and compatibility

This headquarters-only exception updates the **operator-approved scheduled caller** while preserving the existing generic Starling opt-in/local and ordinary Cloudflare Guild economy contracts in \`docs/contracts/starling-collective-v1.md\`, \`docs/contracts/starling-collective-guild-service-v1.md\`, \`docs/operations/community-compute-dividend-v1.md\`, and \`docs/contracts/worldweaver-microspaces-v1.md\`. It must be integrated at their actual canonical service owners; it is not permission to add parallel ledgers or systems. If verified current source disagrees with this proposed contract, reconcile the conflict in the implementation PR and keep shared architecture and ownership documentation current.
