# Cerbanimo Commerce Distribution v1

**Status: marketplace sale distribution retired; annual reserve distribution preserved.**

This file remains because old builds, receipts, and migration tooling refer to the v1 name. It no longer defines an active FellowFare seller-payment contract.

## Retired marketplace behavior

The following former behavior is no longer allowed for new FellowFare transactions:

- platform collection of a product/service purchase price;
- the former 1% marketplace split fee;
- contributor payout splitting from a buyer's FellowFare sale;
- marketplace Stripe Checkout creation;
- marketplace separate Transfers to product/service sellers;
- Acorn/Button reward allocation as a side effect of a sale;
- commerce host-fee allocation.

The browser compatibility API now exposes `commerceEnabled=false`, `marketplacePaymentMode=disabled`, and fails closed if old code calls `buildDistribution`, `stripeTransferInstructions`, or `recordSale`.

The public Cloudflare marketplace commerce route also fails closed with HTTP `410 marketplace-checkout-disabled`.

Legacy payment lifecycle code may still settle, refund, dispute, or reverse a Stripe transaction that was created before this retirement. That is recovery behavior only and must not be used to originate another sale.

## Current FellowFare economy

Physical/community goods use seller-direct payment methods. FellowFare does not collect, route, split, escrow, or settle those payments.

Services, tutoring, and learning use Acorn/Button fulfillment. The requester burns the required units; the provider does not receive those same units. Platform-issued daily and milestone rewards are separate from the requester’s burn.

See `docs/finance/fellowfare-fulfillment-economy-v1.md` for the canonical rules.

## December 1 node-reserve distribution

The annual reserve distribution remains active because it is not a marketplace seller-sale distribution.

On December 1, **50% of the node's eligible AI cash reserve** enters the annual payout. The other 50% remains in the node reserve.

The annual payout is divided:

- **85%** among eligible contributing users, weighted by their eligible Cerbanimo cotokens for the annual period;
- **10%** to the node host;
- **5%** to Cerbanimo.

Thus a node with a $1,000 eligible reserve creates a $500 annual payout: $425 to contributing users, $50 to the node host, and $25 to Cerbanimo. Cotokens are weights only and are not consumed by the distribution.

The annual runtime emits platform-reserve transfer instructions for eligible recipients. This payout must remain technically and conceptually separate from FellowFare seller commerce.

## Verification

Run:

```bash
node scripts/verify-cerbanimo-commerce-distribution-v1.mjs
```

The verifier now checks that marketplace sale distribution and transfer calls fail closed while the annual 50%-of-reserve and 85/10/5 distribution remain available and conserve the complete annual payout.
