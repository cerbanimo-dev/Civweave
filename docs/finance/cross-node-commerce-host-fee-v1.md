# Cross-node commerce host fee v1

Civweave assesses at most **one host fee per trade**. Crossing node boundaries never creates a second host fee.

This contract defines **allocation only**. The checkout policy determines the host-fee amount or rate separately.

## Allocation

- Same buyer and seller home node: that node host receives **100%** of the host fee.
- Different buyer and seller home nodes: the buyer-side host and seller-side host split the single fee **50/50**.
- If the fee is an odd number of minor currency units, the seller side receives the one-unit deterministic remainder.
- If only one side has an eligible stewarded home node, that host receives **100%** of the host fee.
- If neither side has an eligible stewarded home node, the host-fee amount remains with the Civweave system authority.

Relay, transit, validation, and compute nodes do not become commerce-fee recipients merely because traffic passed through them. Their compensation belongs to their own resource/service accounting. This keeps route padding from manufacturing additional host revenue.

The maximum combined payout to hosts for one trade is therefore always the single host fee.

## Identity boundary

The buyer and seller home-node identities should be fixed when the transaction is created and carried through settlement. A later node switch must not rewrite the economic recipients for an already-created trade.

The Cloudflare core exposes the canonical deterministic policy at:

```text
GET  /api/commerce/host-fee/policy
POST /api/commerce/host-fee/quote
```

The quote endpoint accepts an already-computed `hostFeeMinor` plus optional `buyerHost` and `sellerHost` objects and returns the exact allocation. It does not choose the host-fee rate and it does not move money.

Actual Stripe transfers remain a server-side settlement responsibility and must conserve the listed contributor payout, Cerbanimo fee, and this single host fee independently.
