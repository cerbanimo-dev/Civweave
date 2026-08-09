# Node AI Chaos / Fuzz Harness v1

This harness attacks the node-local AI economy with deterministic randomized state transitions. Its purpose is to catch accounting corruption, idempotency failures, reservation bugs, restart persistence errors, cross-user authority mistakes, and settlement-summary drift before live payment rails exist.

## What it exercises

Each run creates several independent `NodeAiLedger` SQLite databases and several users per node. A seeded PRNG chooses among:

- new and duplicate top-ups
- refunds and chargebacks
- valid, insufficient-balance, indebted, duplicate, and cross-user reservations
- valid settlement, over-ceiling settlement, unknown settlement, and cross-user settlement
- reservation cancellation
- reservation expiration with simulated time jumps
- SQLite close/reopen cycles
- empty-wallet creation
- deliberately invalid zero/negative/fee/TTL inputs

The model does not use the ledger to calculate expected balances. It maintains a separate in-memory oracle for wallet balance, debt, reservations, payment-event ownership, platform fees, node net cash, and successful settlements.

## Invariants checked continuously

After every mutation the harness checks the affected users. Every 25 operations it checks the durable SQLite rows, and every 250 operations it scans every node in the run.

The current invariants are:

1. Wallet balance and debt match the independent model.
2. Reserved credits never exceed backing balance.
3. An indebted wallet has zero spendable balance.
4. Duplicate payment-event IDs never mutate economic state twice.
5. A source or reservation ID owned by one user cannot move value for another user.
6. Actual settlement cannot exceed the reservation ceiling.
7. Refunds and chargebacks cannot consume credits reserved for active inference.
8. The sum of durable non-fee ledger entries equals durable wallet value.
9. Cerbanimo fee accrual equals the independently calculated fee on unique top-ups.
10. SQLite close/reopen preserves balances, debt, reservations, event IDs, and summaries.
11. Settlement summaries reconcile with independent gross, processor-fee, user-credit, platform-fee, node-net, and usage counters.

## Default local run

```sh
node scripts/test-node-ai-chaos-fuzz-v1.mjs
```

Default: 4 deterministic runs × 3,000 operations = 12,000 randomized mutations.

Custom run:

```sh
node scripts/test-node-ai-chaos-fuzz-v1.mjs \
  --seed=my-reproduction-seed \
  --runs=8 \
  --operations=5000 \
  --nodes=4 \
  --users=8
```

## CI gates

Every pull request to `main` runs:

- a 2,000-operation smoke pass
- a 40,000-operation chaos gate
- focused Node AI marketplace and trial-commerce contract tests
- local-ledger / no-live-payment / anti-centralization guards

The workflow also runs a scheduled 240,000-operation soak on the default branch and on manual dispatch.

## Failure replay

A failure prints:

- the deterministic seed
- operation index
- affected node model
- the last 60 randomized actions
- a single-run replay command

That makes intermittent-looking economic failures reproducible.

## What this does not replace

This harness is intentionally focused on deterministic node-ledger semantics. It does not replace physical-device tests for Android layout, true multi-process simultaneous writes, OS-level process kills at exact instruction boundaries, live network partition behavior, or real provider failure behavior. Those remain separate integration/chaos layers.
