# Civweave Node AI Marketplace v1

## Architectural lock

Civweave does not operate a central hosted-AI wallet, central inference reserve, central model allowlist, or network-wide transactional database.

Each participating node is its own prepaid AI service boundary. A node owns:

- its user balances,
- retail AI pricing,
- inference gating and reservations,
- provider and model selection,
- local hardware and model packages,
- agent runtimes and retrieval systems,
- refund/chargeback debt,
- its operator margin.

Cerbanimo LLC owns the Civweave protocol and receives the configured application/protocol fee on node top-ups. The fee is calculated from the top-up itself and does not depend on which inference backend the node chooses.

## Storage

The reference node stores payment events, balances, reservations and ledger entries in one node-local SQLite database. There is no Postgres adapter and no requirement for a separate database service.

Offline Civweave state remains device-local. Future mesh synchronization may carry node discovery, service manifests, reputation data and signed aggregate receipts. Mesh availability is not required for a node to reserve or settle a local inference request.

## Service manifests

A node publishes `civweave.node-ai-service-manifest.v1`. Services advertise capabilities and retail constraints, not a centrally approved model catalog. Operators may differentiate by using Fireworks, self-hosted open weights, custom fine-tunes, OpenHands, custom agents, private RAG stores or future compatible packages.

The protocol boundary cares about truthful capabilities, pricing, receipts and safety contracts. It does not require a particular backend.

## Top-ups and retail usage

A top-up produces a node-specific prepaid balance. The quote contains:

- gross paid by the user,
- processor fee if known,
- Cerbanimo application fee,
- user node credit,
- node net cash.

There is intentionally no `providerReserveCents` or `providerShareBps`. Provider cost is the node operator's implementation expense, not a Civweave accounting primitive.

Inference requests reserve the node's maximum **retail** charge before execution. Settlement cannot exceed the reservation. Unused reservation capacity is released. Refunds and chargebacks cannot push spendable balance below zero; unresolved amounts become debt and block new paid inference.

## Periodic settlement

Nodes can produce signed `civweave.node-ai-settlement-receipt.v1` receipts for a time window. Receipts include gross top-ups, processor fees, user credits, Cerbanimo fees due and usage counts. `previousReceiptHash` lets periodic receipts form a tamper-evident chain without synchronous writes to a central server.

Future mesh publication can forward these receipts in small periodic bursts. A central transactional database is not part of the protocol.

## Compatibility

During migration, legacy `/api/ai/wallet/...` routes may alias the node-owned endpoints so installed clients do not break. Their semantics are node-local. `/api/ai/plans` is deprecated and returns node services rather than a central plan catalog.

## Payment boundary

This foundation deliberately stops before a live payment processor. No Cerbanimo LLC bank, card, tax or payout information is required to run these contracts or tests.

When live top-ups are enabled, onboarding and payout details should be entered directly into the chosen payment processor. Civweave should receive processor tokens/account identifiers and signed webhook events, never raw bank or card details.
