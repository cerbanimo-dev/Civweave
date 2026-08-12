# Cerbanimo Commerce Distribution v1

Cerbanimo product and service sales use the existing vested Cerbanimo co-ledger as the contribution-weight source for both canonical Acorn/Button rewards and sale proceeds. The same contract also defines the December 1 node-reserve distribution.

## Service sales

A service sale settles immediately. The people who perform the sold service instance receive the delivery pool. A smaller origin royalty is reserved for the contributors who built the reusable service template and completed the original Cerbanimo project.

The default origin royalty is **10% (1000 bps)** and is a policy parameter, not baked into the allocation algorithm. When no eligible origin contributors exist, the delivery workers receive 100%.

Within the delivery pool and origin-royalty pool, vested co-credit/cotoken weight determines each contributor's share. A person who legitimately appears in both roles may receive both shares.

## Product sales

A product sale settles immediately. The full distributable sale amount is split among the Cerbanimo contributors who generated the product, weighted by their vested co-credit/cotoken contribution shares.

## 1% dollar split fee

Dollar-denominated Cerbanimo product and service sales retain the existing **1% (100 bps) split fee**. It is charged **on top of** the listed/distributable sale price and belongs to Cerbanimo's platform fee lane.

For a $100.00 sale:

- buyer charge: $101.00
- contributor/template payout base: $100.00
- Cerbanimo split fee: $1.00

The fee never reduces the worker, template-origin, or product-contributor allocation. It is also not routed into the December 1 contributor pool. The commerce distribution exposes `buyerChargeMinor` and a `commerceSplitFee` object so the server-side money edge can charge the correct total while separate transfers still conserve the complete listed sale amount.

## Acorns and Buttons

The same contribution weights and service/product role rules are used when a sale carries an Acorn or Button reward budget. The commerce runtime writes recipient-specific canonical reward ledger entries so multi-contributor sales do not collapse into one deduplicated receipt.

Co-credits/cotokens are **weights, not spendable shares** in this operation. Reading them for a sale does not consume or burn them.

## Direct cash settlement vs. the annual pool

Direct Cerbanimo commerce is a separate settlement lane from the annual contribution distribution. Every commerce distribution is emitted with:

- `settlementTiming: immediate`
- `routesToAnnualPool: false`
- `annualPoolEligible: false`
- `annualPoolContributionMinor: 0`

The runtime produces deterministic Stripe separate-transfer instructions from the paid source transaction. Those instructions use the same split as the cash receipt and carry `civweave_annual_pool=excluded` plus the 1% split-fee metadata.

## December 1 node-reserve distribution

On December 1, **50% of the node's eligible AI cash reserve** enters the annual payout. The other 50% remains in the node reserve.

The annual payout itself is divided:

- **85%** among eligible contributing users, weighted by their eligible Cerbanimo cotokens for the annual period
- **10%** to the node host
- **5%** to Cerbanimo

Thus a node with a $1,000 eligible reserve creates a $500 annual payout: $425 to contributing users, $50 to the node host, and $25 to Cerbanimo. Cotokens are used only to divide the contributor portion and are not consumed by the distribution.

The annual runtime emits platform-reserve Stripe transfer instructions for each recipient. The host and Cerbanimo percentages are shares of the annual payout, not extra deductions from the retained 50% reserve.

## Rounding and replay safety

Cash is allocated in integer minor currency units with deterministic largest-remainder rounding. Direct sale recipient payouts must equal the full listed/distributable sale amount exactly, while the 1% fee is charged separately on top. Annual recipient payouts must equal the complete 50%-of-eligible-reserve annual payout exactly.

Sale receipts are idempotent by `saleId`. Canonical Acorn/Button source keys also include the recipient ID, so replaying a sale cannot mint a second reward while distinct contributors can still receive their own shares.

## Verification

Run:

```bash
node scripts/verify-cerbanimo-commerce-distribution-v1.mjs
```

The verifier covers immediate service settlement, origin stipend behavior, product contribution splitting, Acorn/Button weighting, the 1% fee-on-top invariant, annual-pool exclusion for sales, the 50% reserve event, the annual 85/10/5 split, exact rounding, and Stripe transfer intents.
