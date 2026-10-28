# Starling Collective — native optional Civweave Guild service (v1)

Status: migration foundation, not an already-running Guild Collective or task-claim service.

## Ownership and migration

Starling's eight fictional personas, distinct writing/reasoning styles, deliberation, persona memories, sequential model scheduler, Aider handoffs, and creator/media functions are being ported into Civweave as an optional **native** service. Civweave alone owns Guild identity, reviewed/active Quests, Living School curricula, Cerbanimo tasks/evidence/quality gates, FellowFare resources and Button/Acorn ledgers, Anarchadia human governance, and node AI budgets. The older standalone Starling Studio is migration input, not a permanent parallel project database. Use native capability owners for internal calls; optional MCP is for outside agents.

## Guild founding and collective focus

The Guildkeeper supplies a provisional founding Quest Intention during Guild creation. Do not represent the intention as an active Quest before it completes native authoring and review. This founding Intention directs the Collective until the authorized Anarchadia governance owner reports a **ratified human-member vote** on a replacement. The eight fictional AI personas never count as Guild members, participants in quorum, or votes in human Guild governance. Their internal deliberations and votes are independent and non-binding for the human Guild. A Guild ratification is not valid for another Guild.

The pure policy helper requires a trusted verification callback from the canonical governance owner; it must never accept an LLM-supplied assertion that a vote is verified.

## Autonomous project collaboration

Discovery only consumes Guild-authorized, human-posted project/Quest records. The canonical membership/provenance owner verifies authorship, the task owner supplies task state and capability requirements, and the Collective's installed tool registry declares what is truly possible. A deterministic compatibility matcher provides suggestions.

Default outcome: **offer assistance**. An explicit Guild/project setting and separately verified task-specific grant may enable automatic claim attempts. The actual canonical Quest task owner must process claims transactionally; do not mark eligible candidates claimed without that step. Use leases, cancellation, idempotency, duplicate-claim protection and human overrides. Completion requires submitted evidence and the ordinary Cerbanimo review/quality gate, not merely an agent's self-report.

## Living School

Research is sourced, learning modules cite provenance, and reusable learned content is retrieved from the authorized curriculum store. Passing a quiz supports a module-specific competency record, not permanent model-weight training or a guarantee the source is correct. The Collective may initiate its own learning journeys and use approved curriculum resources in future tasks.

## FellowFare

Rook prepares outside-help requests with transparent Button/Acorn proposed burn quantities. Actual fulfillment follows Civweave's separate nontransferable reward and fulfillment ledgers. A Collective Passport/account, if provisioned, has its own explicit spending authority; Guild hosting never permits spending another member's assets. Unfunded/unauthorized requests remain drafts. Physical/community work offers remain voluntary.

## Anarchadia

Persona deliberation/voting concerns the Collective's own internal governance. Human Guild votes remain authenticated real-member actions; no agent or synthetic persona impersonation, ballot stuffing, or use of AI personas in quorum.

## Execution and budgets

Local inference remains free of membership-sponsored hosted-generation charges; local device scheduling and resource ceilings still apply. Hosted Collective requests apply **both** a tier-specific daily Collective generation limit and the member/node's existing Cloudflare AI neuron allocation. This daily cap is not a parallel currency, wallet, or bonus neuron pool. Tier-specific daily counts must come from versioned membership policy rather than hardcoded assumptions. The hosted route checks trusted member/session, quotes, reserves, executes, and settles actual inference against the canonical node AI ledger. Do not create unfunded, hidden, or unlimited paid overages.

## Migration phases

1. Import the Starling personas, deliberation protocol, isolated memories, and serialized inference policy into native shared Civweave code. Preserve prior user-created data via explicit migration tools.
2. Add founding Intention capture to Guild creation and subscribe to ratified Anarchadia human-member decisions.
3. Connect Collective logical agent turns to native Civweave local/cloud inference, with durable suspend/resume on low-memory devices.
4. Add permissioned Guild task discovery, opt-in offers, automatic claim eligibility, Cerbanimo evidence/quality results and live Quest beat status.
5. Integrate sourced Living School study/assessment, Rook's actual request/fulfillment authority, and separate persona deliberation records.
6. Apply daily membership tier throttles *inside* the existing node inference budget, then surface collective and human collaboration in one Guild status interface.
7. Retire the temporary Starling Studio MCP/outbox and its parallel databases after verified migration.

## First implementation slice

`lib/starling-collective-v1.mjs` ports the eight Starling persona definitions and defines pure helpers for founding-vs-ratified intention, capability-based task matching, and local-vs-hosted preflight. It intentionally cannot create Quests, issue verified votes, spend tokens, or claim tasks; those must route through the existing Civweave owners. `scripts/test-starling-collective-v1.mjs` verifies fail-closed behavior. Further work is required before a Collective can run within a Guild.
