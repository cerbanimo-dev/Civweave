# Civweave Systems Mesh v251

This integration gives the five canonical Civweave systems one shared, non-privileged browser event contract while preserving their separate canonical ledgers and validators.

Canonical system IDs match `public/app/system-routes-v227.js` exactly:

- `civweave`
- `living-school`
- `cerbanimo`
- `fellowfare`
- `anarchadia`

## Browser boundary

`public/app/civweave-systems-mesh-v251.js` is intentionally not a Node Host client and contains no Node Admin token, system-scoped token, signing key, localhost endpoint, canonical reward write, or network transport call.

Each canonical route loads it through the shared route contract. The runtime can:

- create source-bound `civweave.system-event-draft/v1` records
- keep a bounded local outbox
- export `civweave.system-draft-bundle/v1`
- receive `civweave.system-projection/v1` candidates
- import `civweave.system-projection-bundle/v1`
- deduplicate candidate projections
- record local accepted/rejected/deferred decisions
- dispatch browser events for system-specific adapters

It cannot sign an event, relay it across the physical mesh, administer a node, or directly mutate another system's ledger.

## Event vocabulary

- `civweave.intention.created`
- `living-school.learning.verified`
- `living-school.validation.completed`
- `cerbanimo.labor.completed`
- `cerbanimo.task.available`
- `fellowfare.exchange.completed`
- `fellowfare.resource.available`
- `anarchadia.policy.published`
- `anarchadia.passport.updated`

Unknown event types fail closed. The active canonical route cannot publish an event owned by another system.

## Portable Node Host handoff

A public or installed Civweave PWA must not inherit localhost Node Host authority merely because it is the Civweave app.

The safe disconnected bridge is therefore:

1. a system creates an unsigned local draft;
2. the PWA exports a `civweave.system-draft-bundle/v1`;
3. the local Node Host Systems console imports it;
4. a human operator explicitly approves signing;
5. Node Host validates, sanitizes, signs, projects and queues the canonical mesh event;
6. candidate handoffs can later be exported as `civweave.system-projection-bundle/v1` and imported into the target system.

A projection remains a candidate. Passport, cotoken, Button, governance, learning and other canonical state still require the target system's own acceptance path.

## Existing ledger integration

This contract is designed to sit beside the existing canonical reward/validation runtimes such as `CivweaveCanonicalRewardsV2` and `CivweaveRewardWeave`. It does not replace or call their ledger mutation APIs directly. System-specific adapters should validate a projection, apply it through the target system's existing idempotent ledger/validator path, then record the projection decision.

## Offline

The systems mesh runtime is included in `public/app/offline-package-v208.json`, so the contract is part of the resumable offline campus package.

## Verification

Run:

```bash
node scripts/verify-civweave-systems-mesh-v251.mjs
```

The verifier asserts the canonical five-system registry, source ownership, target restrictions, bounded local outbox/inbox behavior, portable draft/projection bundles, and the absence of Node Host credentials/network primitives or canonical ledger writes from the browser runtime.
