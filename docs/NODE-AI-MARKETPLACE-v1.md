# Civweave Node AI Marketplace v1

## Architectural lock

Civweave does not operate a central hosted-AI wallet, central inference reserve, central model allowlist, central node recommender, or network-wide transactional database.

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

Offline Civweave state remains device-local. Mesh synchronization carries discovery objects and can carry signed aggregate settlement receipts in periodic bursts. Mesh availability is not required for a node to reserve or settle a local inference request.

## Service manifests and operator packages

A node publishes `civweave.node-ai-service-manifest.v1`. Services advertise capabilities and retail constraints, not a centrally approved model catalog. Operators may differentiate by using Fireworks, self-hosted open weights, custom fine-tunes, OpenHands, custom agents, private RAG stores or future compatible packages.

`NODE_AI_SERVICE_PACKAGE_MODULE` may point at a local JavaScript module controlled by the node operator. A package implements the node's advertised services with `quote()` and `execute()` handlers. HTTP(S) module URLs are rejected, and mesh service adverts never distribute executable code.

The protocol boundary cares about truthful capabilities, pricing, receipts and safety contracts. It does not require a particular backend.

## Mesh discovery and routing

The existing signed Civweave object mesh is the discovery fabric. Node service manifests are published as `civweave.node-ai.service-advert.v1` community objects, so WebRTC peers, gateway synchronization and offline bundle import/export can carry the same adverts without introducing a second networking stack.

`public/app/shared/civweave-node-ai-routing-v1.mjs` deterministically filters and ranks eligible services. A request may require capabilities, a retail ceiling, local execution, third-party-inference restrictions, preferred nodes, trust scores and observed latency. Ineligible services are rejected with explicit reasons. Eligible services are ranked using deterministic components for explicit preference, local execution, privacy, trust, latency, freshness and price floor. Stable lexical tie-breaking prevents an invisible central recommender or random winner.

`public/app/node-ai-mesh-v1.js` publishes and discovers service adverts, redistributes settlement batches, and can synchronize the object mesh in bounded intervals. It can also pull the local node's public manifest from `/api/ai/node/manifest` and upsert it into the mesh.

## Remote inference

A node may expose `/api/ai/node/inference` after an operator service package is attached. The route remains fail-closed when no package is configured.

The request is authorized by a node AI capability token bound to:

- user,
- device,
- node ID,
- allowed service IDs,
- maximum retail cost,
- current node-wallet version,
- expiration time.

The node verifies the capability and wallet version before execution. The service package quotes the request, the inference gate rejects quotes above the capability or advertised retail ceiling, and the node reserves the quoted retail amount before calling the operator handler. Successful execution settles the actual retail amount and returns a usage receipt. Provider cost remains private to the operator and is not a Civweave accounting field.

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

The object mesh can carry one or more receipts inside `civweave.node-ai.settlement-batch.v1` objects. This lets nodes exchange compact periodic updates rather than requiring every inference request to create network traffic. A central transactional database is not part of the protocol.

## Compatibility

During migration, legacy `/api/ai/wallet/...` routes may alias the node-owned endpoints so installed clients do not break. Their semantics are node-local. `/api/ai/plans` is deprecated and returns node services rather than a central plan catalog.

## Payment boundary

This foundation deliberately stops before a live payment processor. No Cerbanimo LLC bank, card, tax or payout information is required to run these contracts or tests.

When live top-ups are enabled, onboarding and payout details should be entered directly into the chosen payment processor. Civweave should receive processor tokens/account identifiers and signed webhook events, never raw bank or card details.
