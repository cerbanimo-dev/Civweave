# Cross-node commerce host fee v1

**Status: retired.**

This document is retained only as a migration marker for old deployments and references. FellowFare no longer assesses, quotes, allocates, or distributes a commerce host fee on buyer/seller trades.

The former endpoints:

```text
GET  /api/commerce/host-fee/policy
POST /api/commerce/host-fee/quote
```

now return HTTP `410` with code `commerce-host-fee-retired`.

The former `commerce-node-fees.mjs` allocator and its verification workflow have been removed.

## Current boundary

Physical/community goods use seller-direct payment. FellowFare may provide discovery, reputation, messaging, and arrangement records, but it does not collect or route the seller's payment and it does not calculate a host percentage from that sale.

Services, tutoring, and learning use Acorn/Button fulfillment. Fulfilled units are burned from the requester and are not transferred to the provider or a node host.

Node hosts may still earn money through **separate Civweave platform-money systems** such as eligible compute, membership, or reserve-funded distributions. Those earnings are not derived from a FellowFare seller transaction and must not be reconstructed as a commerce host fee.

See `docs/finance/fellowfare-fulfillment-economy-v1.md` for the canonical marketplace economy and `docs/finance/node-money-edge-launch-v1.md` for supported platform-money lanes.
