# Cerbanimo Commerce Distribution v1

**Status: legacy marketplace sale distribution retired; annual reserve distribution preserved.**

This file remains because old builds, receipts, and migration tooling refer to the v1 name. It no longer defines the active FellowFare service-payment contract.

## Retired marketplace behavior

The following former behavior is not allowed for new FellowFare transactions:

- Cerbanimo/FellowFare collecting a buyer's gross product/service purchase and later distributing seller proceeds;
- destination charges or platform-charge/separate-transfer seller settlement;
- contributor cash payout splitting from a buyer's FellowFare sale;
- Acorn/Button recipient allocation as a side effect of a sale;
- commerce host-fee allocation.

The old browser compatibility API exposes `commerceEnabled=false` and fails closed if cached code calls `buildDistribution`, `stripeTransferInstructions`, or `recordSale`.

The old public Cloudflare route `/api/money-edge/commerce/*` returns HTTP `410 marketplace-checkout-disabled`. Legacy lifecycle code may still settle, refund, dispute, or reverse transactions created before retirement.

## Current FellowFare economy

Physical/community goods use seller-direct private payment. FellowFare does not collect, route, split, escrow, settle, or take a percentage of the goods payment.

Services, tutoring, and learning may use either or both of:

- Acorn/Button fulfillment, where requester units burn and are not transferred to the provider;
- USD Stripe Connect direct charges owned by the connected provider, with FellowFare receiving an application fee.

The current default service/learning/tutoring application fee is 1% (`100` bps), configurable through `CIVWEAVE_FELLOWFARE_SERVICE_FEE_BPS`. The provider remains merchant of record. FellowFare never receives the provider's gross sale and then sends the provider a payout.

See `docs/finance/fellowfare-fulfillment-economy-v1.md` for the canonical rules.

## December 1 node-reserve distribution

The annual reserve distribution remains active because it is not seller-sale settlement.

On December 1, **50% of the node's eligible AI cash reserve** enters the annual payout. The other 50% remains in reserve. The annual payout is divided:

- **85%** among eligible contributing users, weighted by eligible Cerbanimo cotokens for the annual period;
- **10%** to the node host;
- **5%** to Cerbanimo.

Thus a node with a $1,000 eligible reserve creates a $500 annual payout: $425 to contributing users, $50 to the node host, and $25 to Cerbanimo. Cotokens are weights only and are not consumed.

The annual runtime emits platform-reserve transfer instructions for eligible recipients. This payout remains technically and conceptually separate from FellowFare seller commerce.

## Verification

```bash
node scripts/verify-cerbanimo-commerce-distribution-v1.mjs
node scripts/verify-fellowfare-direct-commerce-v2.mjs
```

The first verifier keeps the retired distribution API fail-closed while preserving the annual reserve event. The second verifies the active provider-owned direct-charge service rail.
