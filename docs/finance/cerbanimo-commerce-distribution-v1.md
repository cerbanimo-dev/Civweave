# Cerbanimo Commerce Distribution v1

Cerbanimo product and service sales use the existing vested Cerbanimo co-ledger as the contribution-weight source for both canonical Acorn/Button rewards and sale proceeds.

## Service sales

A service sale settles immediately. The people who perform the sold service instance receive the delivery pool. A smaller origin royalty is reserved for the contributors who built the reusable service template and completed the original Cerbanimo project.

The default origin royalty is **10% (1000 bps)** and is a policy parameter, not baked into the allocation algorithm. When no eligible origin contributors exist, the delivery workers receive 100%.

Within the delivery pool and origin-royalty pool, vested co-credit/cotoken weight determines each contributor's share. A person who legitimately appears in both roles may receive both shares.

## Product sales

A product sale settles immediately. The full distributable sale amount is split among the Cerbanimo contributors who generated the product, weighted by their vested co-credit/cotoken contribution shares.

## Acorns and Buttons

The same contribution weights and service/product role rules are used when a sale carries an Acorn or Button reward budget. The commerce runtime writes recipient-specific canonical reward ledger entries so multi-contributor sales do not collapse into one deduplicated receipt.

Co-credits/cotokens are **weights, not spendable shares** in this operation. Reading them for a sale does not consume or burn them.

## Cash settlement and the annual pool

Direct Cerbanimo commerce is a separate settlement lane from the annual contribution distribution. Every commerce distribution is emitted with:

- `settlementTiming: immediate`
- `routesToAnnualPool: false`
- `annualPoolEligible: false`
- `annualPoolContributionMinor: 0`

The runtime produces deterministic Stripe separate-transfer instructions from the paid source transaction. Those instructions use the same split as the cash receipt and carry `civweave_annual_pool=excluded` metadata.

## Rounding and replay safety

Cash is allocated in integer minor currency units with largest-remainder rounding. The sum of recipient payouts is required to equal the full distributable amount exactly. Reward shares use hundredths of an Acorn/Button and the same deterministic allocation rule.

Sale receipts are idempotent by `saleId`. Canonical Acorn/Button source keys also include the recipient ID, so replaying a sale cannot mint a second reward while distinct contributors can still receive their own shares.

## Verification

Run:

```bash
node scripts/verify-cerbanimo-commerce-distribution-v1.mjs
```

The verifier covers immediate service settlement, origin stipend behavior, product contribution splitting, Acorn/Button weighting, exact rounding, annual-pool exclusion, and Stripe transfer intents.
