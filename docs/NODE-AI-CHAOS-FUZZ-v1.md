# Node AI Chaos / Fuzz Harness v1

This package attacks the node-local AI economy with deterministic randomized state transitions **and real OS-process fault injection**. Its purpose is to catch accounting corruption, idempotency failures, reservation races, restart persistence errors, cross-user authority mistakes, crash-window bugs, and settlement replay failures before live payment rails exist.

## Deterministic economic fuzz

Each seeded run creates several independent `NodeAiLedger` SQLite databases and several users per node. A PRNG chooses among:

- new and duplicate top-ups
- refunds and chargebacks
- valid, insufficient-balance, indebted, duplicate, and cross-user reservations
- valid settlement, over-ceiling settlement, unknown settlement, and cross-user settlement
- reservation cancellation and expiration
- SQLite close/reopen cycles
- empty-wallet creation
- deliberately invalid zero/negative/fee/TTL inputs

The model does not use the ledger to calculate expected balances. It maintains a separate in-memory oracle for wallet balance, debt, reservations, payment-event ownership, platform fees, node net cash, and successful settlements.

### Invariants checked continuously

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

## Multi-process / crash chaos

`scripts/test-node-ai-process-chaos-v1.mjs` launches separate Node OS processes against the same node-local SQLite database. This is deliberately different from opening several ledger objects in one process.

It currently simulates:

- six concurrent writers issuing hundreds of unique top-ups
- eight processes racing the same payment event ID
- ten reservation processes competing for only five backed reservation slots
- four processes racing settlement of the same reservation
- `SIGKILL` after an uncommitted reservation mutation
- `SIGKILL` after an uncommitted settlement has deleted a reservation, debited the wallet, and inserted a charge but before `COMMIT`
- process death after a durable inference settlement commits but before the result can be delivered to the caller
- two same-request inference attempts overlapping while the first provider execution is still active
- process death after the external provider has completed but before Civweave has durably settled the request

### SQLite startup race protection

The process stampede exposed an initialization race in which simultaneous node processes could collide while negotiating WAL mode. The ledger now configures `busy_timeout` before the lock-sensitive `journal_mode=WAL` pragma, allowing normal SQLite lock waiting to apply during concurrent startup.

## Durable inference settlement replay

Inference settlement now has a node-local durable record keyed by request ID. The atomic settlement transaction includes:

- reservation deletion
- wallet debit
- inference retail ledger entry
- service/request ownership
- retail amount
- durable usage receipt

After that transaction commits, a dropped HTTP response or process death cannot turn a retry into a second charge. Repeating the same request ID returns the stored economic result and receipt without invoking the provider again.

Completed model output is **not** retained for replay. A replay therefore reports `replayed: true` and `replayOutputAvailable: false`, with `output: null`. This protects exactly-once economics without introducing a node-side prompt/output archive.

If a second process reaches the same request ID while the first still owns its reservation, the second request receives `NODE_AI_REQUEST_IN_PROGRESS` (HTTP 409 at the inference endpoint). It cannot cancel the first process's reservation or execute a second provider call.

## Exactly-once economics vs provider execution

Civweave can guarantee **exactly-once local economic settlement per request ID after durable commit**.

It cannot generically guarantee exactly-once execution of an arbitrary remote model/provider across the narrow fatal window where:

1. the external provider has already completed, and
2. the node process dies before Civweave durably commits settlement.

In that window, the reservation remains durable and no charge is invented. It eventually expires and releases the user's credit. A later retry may execute the provider again unless that provider supports its own idempotency key. The contract is therefore:

- **exactly-once Civweave economic settlement per request ID**
- **at-least-once external provider execution across the pre-settlement fatal gap**, unless the provider supplies stronger idempotency semantics

This boundary is explicit rather than hidden behind a false exactly-once claim.

## Running locally

Deterministic fuzz:

```sh
node scripts/test-node-ai-chaos-fuzz-v1.mjs
```

Process / SIGKILL chaos:

```sh
node --test scripts/test-node-ai-process-chaos-v1.mjs
```

Custom deterministic fuzz:

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

- focused debt-availability regression
- real multi-process / SIGKILL chaos suite
- 2,000-operation deterministic smoke
- 40,000-operation economic chaos gate
- focused Node AI marketplace and trial-commerce contract tests
- local-ledger / no-live-payment / anti-centralization guards

The scheduled/manual lane runs the process-chaos suite again, followed by a 240,000-operation deterministic soak.

## Failure replay

Deterministic fuzz failures print the seed, operation index, recent actions, and a one-command replay. Process-chaos tests use named scenarios and fixed request/payment IDs so CI failures are directly reproducible.

## Remaining physical fault boundary

This suite now covers process concurrency, SQLite locking, abrupt process death, transaction rollback, response loss, and request replay. It does not emulate sudden device power loss during filesystem flush, storage-media corruption, kernel/filesystem bugs, Android process-management peculiarities, or actual third-party provider outages. Those belong to later physical-device and network-partition testing.
