# Guild Daily Steward — 1,000-neuron planning pilot

**Implementation state (November 1, 2026):** deterministic authenticated Guild preview and tested metered runner contract, **not** a continuously scheduled hosted AI service. This is deliberately fail-closed until the canonical capacity, guild-chat and evidence owners supply their trusted adapters. Do not report this as running every day or consuming actual neurons yet.

## Behavior

Once a day (UTC initially), a Guild's AI steward should review the **currently relevant, authorized** Guild context: published/active Quests and incomplete paths, proposed intentions (clearly unratified), current Guild-visible chat requests whose senders consented to planning use, and authenticated contribution records. Historical participation matters only when backed by **accepted canonical contribution evidence**. Passport skill claims alone are not participation evidence.

The output has two independent lanes:

- **AI work**: prioritized draft investigation, preparation and proposals. Actual task claiming, spending, deployment, publishing, evidence submission or completing a Quest still requires the corresponding owner and grant.
- **Human invitations**: voluntary *offers* to members with recent accepted contributions **and** corresponding shared Passport skills. If no human has demonstrated relevant involvement, **zero** human offers. There is no involuntary allocation, no to-do list generated for idle humans, and no assumption that a self-claimed skill means a person accepted work.

A later verified human interaction may make them newly eligible. An invitation requires acceptance, and refusal/opt-out must be honored.

## Capacity

The starting instance has 10,000 free Cloudflare neurons/day, 9,000 shared as ten 900-neuron member allowances and 1,000 as a **protected burst reserve**. The protected reserve is **not** automatically spare. Daily steward cap is **at most 1,000 neurons per Guild per UTC day**, only from the capacity owner's **attested uncommitted system-usable free allocation**. If the owner reports none, skip inference and keep the deterministic draft. Do not debit members' included or lifetime balances, manufacture a separate quota, assume unspent reserve is available, or use paid overage without independent authorization.

The runner's required sequence is: quote remaining free system balance → single per-day durable start receipt → reserve within available amount → model review → actual canonical settlement → store daily plan, charged neurons and end state. A failed attempt is recorded and not automatically repeated. Model may prioritize known candidate identifiers and describe risks; it may not create a new human assignment, authorize an expenditure or invent completion evidence. Model output is treated as untrusted.

Monitor first-week **charged neurons per cycle**, running total by day, skipped/failed runs, context sizes, model token usage, task/offer counts and acceptance rates. Adjust context compression, maximum tokens, reserve availability and cadence after measuring real charges rather than presuming one run costs 1,000 neurons.

## Shipped API and boundaries

- Authenticated `GET /api/node/starling/plan` responds with `civweave.guild-daily-plan.v1` deterministic **preview only**. It uses the canonical server-side Guild Quest publication index, human-proposed intentions and consenting Passport claims. It charges **zero** neurons and makes **zero** human assignments. On the mobile Guild service, the preview additionally reads **independently accepted** work proofs and derives a demonstrated skill only if the proof’s still-published Quest has exactly one unambiguous realm; node-cloud still reports that verified contribution feed unavailable. Guild-chat request ingestion is unavailable on both backends.
- `cloudflare/mobile-guild-edge/src/guild-daily-planner-v1.mjs` exports `buildGuildDailyPlan`, `dailyNeuronBudget`, `applyDailyModelReview`, `readDailyGuildPlanPreview` and `runDailyGuildPlanningCycle`. The metered runner cannot run without a verified Guild-scoped context provider, canonical ledger quote/reserve/settle implementation and model provider; it must not be exposed as a client-controlled billing endpoint.
- The current Quest publication projection intentionally omits original wish, private conversation, profile and evidence; do not infer them from the browser. Chat requests must arrive from the authorized Guild chat owner with member consent, scoped visibility and auditable provenance.
- The canonical accepted task/evidence authority must supply contributions with `authority: canonical-contribution`, `verified: true`, `accepted: true`, Guild and member IDs, date and demonstrated skill IDs. Ignore all unverified attendance, raw chat volume, pseudo-XP, passive presence and AI-authored claims.

## Remaining work to activate daily hosted runs

1. Capacity owner: add an **account-level**, atomic system-purpose free-neuron allocation and availability calculation, respecting member allowances, Cloudflare actual daily consumption and whichever part of the existing reserve governance explicitly releases. Enforce 1,000 **total per Guild per day** across all three starter nodes, not per node, plus global account capacity.
2. Chat owner: supply a bounded, consent-controlled current Guild request feed, independent of private DMs and other Guilds. Add retention and revocation controls.
3. Cerbanimo evidence owner: expand the mobile-only accepted-work adapter with genuine skill tags on reviewed task evidence, and supply an equivalent verified feed for node-cloud. Link voluntary offers to actual acceptance and existing verified task claim authority; respect consent and availability. A multiple-realm Quest cannot establish an individual skill by inference.
4. Server host: wire `runDailyGuildPlanningCycle` to the trusted Cloudflare AI model and canonical quote/reserve/settle. Bound input/output tokens and context size, use a single Guild-wide Durable Object lease/alarm, and arrange the next UTC-day trigger even if no user opens the app. Never schedule browser timers as the server substitute.
5. Guild UI: display the daily plan, what the AI plans to attempt, offers awaiting acceptance, current cost, and last run. Provide Guildkeeper controls for daily enable/pause and an audit trail. Human role/governance modifications remain under voting rules.
6. The Starling Guild Fleet Quest HUD now displays the read-only preview, separate AI draft tasks, voluntary human invitations and unconnected feed/scheduling warnings. Continue with a Guildkeeper-facing audit/enable/pause UI before enabling the runtime. Exercise a week on staging, check actual neuron spend and trust boundaries, then approve a production policy. Do not silently reallocate the protected 10% before this policy decision.

## Tests

`node --test scripts/test-guild-daily-planner-v1.mjs`

Tests cover zero volunteer tasks for passive humans, consent and skill/contribution matching, Guild isolation, private-chat exclusion, missing/unverified free spare, no forged model actions, idempotent day runs, verified settlement and failure handling.
