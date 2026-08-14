# Civweave node money edge v1

The canonical Cerbanimo money edge is the Cloudflare `civweave-core` Worker. Render is not a payment authority.

## Current Stripe models

Civweave deliberately uses different Stripe patterns for different economic lanes.

### Platform money

Compute top-ups, memberships, Host Node Steward earnings, Territory Stewardship earnings, and reserve-funded distributions remain platform-controlled money lanes. Recipient payout accounts may use Accounts v2 recipient configuration and separate transfers where the platform owns the original charge.

### Territory Stewardship second stage

Every pre-existing Cerbanimo cash share is now subdivided after its original transaction-lane calculation:

```text
existing Cerbanimo share
  -> 50% Cerbanimo Global
  -> 50% Territory Stewardship
```

This second stage changes no provider, seller, contributor, Host Node Steward, or system/compute reserve percentage. If a territory is vacant, unassigned, unsigned, or not payout-ready, its half is held in the Territory Operations Reserve instead of reverting to Cerbanimo Global.

### FellowFare goods

Physical/community goods never enter the money edge for seller settlement.

```text
FellowFare listing -> buyer/seller arrangement -> seller's private payment method
```

FellowFare does not create a goods Checkout Session, collect or escrow the purchase price, route seller proceeds, assign Acorn/Button prices, or take a percentage of the goods sale.

### FellowFare services, tutoring, and learning

These listings may offer Acorn/Button fulfillment, USD direct checkout, or both.

Token flow:

```text
requester balance -> fulfillment burn
provider contribution -> platform reward eligibility
```

USD flow at the default 5% fee:

```text
buyer -> provider connected Stripe account
             |
             +-> 5% FellowFare application fee
                       |
                       +-> 50% facilitating Host Node Steward (2.5% of sale)
                       +-> 50% existing Cerbanimo bucket (2.5% of sale)
                                      |
                                      +-> 50% Cerbanimo Global (1.25% of sale)
                                      +-> 50% Territory Stewardship (1.25% of sale)
```

The USD charge is a Stripe Connect **direct charge**. The connected provider is merchant of record, uses a merchant/card-payments Accounts v2 configuration, and owns the Stripe Product, Price, Checkout Session, and resulting charge. FellowFare receives only `application_fee_amount`.

The default FellowFare service/learning/tutoring fee is **5% / 500 bps**, configurable by `CIVWEAVE_FELLOWFARE_SERVICE_FEE_BPS`. The application fee first remains **50/50** between the facilitating Host Node Steward and the existing Cerbanimo bucket. Only that Cerbanimo half receives the Territory Stewardship second stage. At the default rate, the final economic shares are **2.5% of the service sale to the facilitating Host Node Steward, 1.25% to Cerbanimo Global, and 1.25% to Territory Stewardship**.

The facilitating Hub is bound into server-created connected-account Price metadata before checkout. The buyer does not choose or submit either Steward payout destination. When Stripe creates the application fee, Cloudflare core records the Host Node Steward first-stage split and separately records the Territory Stewardship subdivision of the Cerbanimo bucket. If platform funds are not available yet, settlements remain pending and `balance.available` retries them when funds become transferable.

Partial and full refunds reduce both Steward entitlements proportionally. Already-paid transfers are reversed where possible so the adopted economic split stays true after unwind.

FellowFare does not receive the provider's gross sale and then transfer proceeds. New FellowFare service commerce must not use destination charges or separate seller transfers.

Production API:

```text
POST /api/fellowfare/direct-commerce/accounts
GET  /api/fellowfare/direct-commerce/accounts/:userId
POST /api/fellowfare/direct-commerce/accounts/:userId/onboard
POST /api/fellowfare/direct-commerce/prices
POST /api/fellowfare/direct-commerce/checkout
```

The server retrieves the connected-account Stripe Price and verifies FellowFare listing and Hub metadata before checkout rather than trusting buyer-supplied amounts or payout routing.

## Existing platform economic lanes after Territory Stewardship

### Node compute top-ups

After processor fees:

```text
70.0% system/compute reserve
25.0% Host Node Steward
 2.5% Cerbanimo Global
 2.5% Territory Stewardship
```

The historical first stage remains 70/25/5. Only the former 5% Cerbanimo bucket is subdivided.

### Node memberships

After processor costs:

```text
50.0% system
25.0% Host Node Steward
12.5% Cerbanimo Global
12.5% Territory Stewardship
```

The historical first stage remains 50/25/25. Only the former 25% Cerbanimo bucket is subdivided.

### December 1 reserve distribution

Once per year, 50% of eligible AI cash reserve becomes the annual payout:

```text
85.0% eligible cotoken contributors
10.0% node host
 2.5% Cerbanimo Global
 2.5% Territory Stewardship
```

The remaining 50% stays reserved. Cotokens are weights only and are not burned. The contributor and node-host percentages are unchanged from the prior 85/10/5 first-stage policy.

## Territory identity and routing

D1 stores the territory hierarchy, appointments, node territory assignments, and Territory Stewardship settlements.

A registered Hub assigns a territory through its existing signed money-edge identity:

```text
GET  /api/money-edge/territories
POST /api/money-edge/territories/node
```

For a Hub transaction, the money edge resolves the most-specific active appointed territory first and then walks parent territories. Checkout buyer input cannot choose or redirect the Territory Steward recipient.

A Territory Steward may be appointed while their agreement, legal identity, tax setup, or payout onboarding is incomplete. The office-linked entitlement is then recorded but held rather than transferred. Territory Stewardship is compensation attached to an office and term, not equity.

## Retired FellowFare marketplace route

The old platform-charge/separate-transfer marketplace endpoint remains retired:

```text
/api/money-edge/commerce/* -> 410 marketplace-checkout-disabled
```

Legacy settlement/refund/dispute code remains only to finish or unwind payments created under the retired architecture. The former gross-sale commerce host-fee endpoints are also retired. The active service-fee Steward shares do not revive that model: they distribute portions of FellowFare's application fee after a provider-owned direct charge while leaving provider gross ownership intact.

## Cloudflare authority storage

D1 retains node records, territory assignments and appointments, Territory Stewardship settlement history, Stripe event idempotency, enrollment grants, connected-account mappings, platform-money settlements, FellowFare service-fee split settlements, and legacy commerce records needed for recovery/audit. Durable Objects retain core signing identity. R2 remains distribution storage.

## Core-only secrets

Stripe platform credentials and Civweave signing secrets stay on Cloudflare core and are never distributed to host nodes.

`CIVWEAVE_PLATFORM_FEE_BPS=500` remains the **pre-second-stage Cerbanimo bucket** of compute top-up service net. The Territory module subdivides that existing bucket 50/50 without changing the top-up charge. FellowFare service/learning/tutoring direct commerce instead uses `CIVWEAVE_FELLOWFARE_SERVICE_FEE_BPS`, defaulting to **500 bps**.

## Live-money gate

Live Stripe transactions remain fail-closed until the existing compliance, jurisdiction, KYC/AML, tax/reporting, terms, and `CIVWEAVE_MONEY_LIVE_ENABLED` gates are deliberately satisfied.

Territory personal payouts add their own agreement, identity, tax, and payout-readiness gates. An appointment may therefore be visible while its money remains held in the Territory Operations Reserve.

Those gates may authorize provider-owned FellowFare service/learning/tutoring direct charges. They never authorize physical-goods checkout or revival of the retired platform-charge marketplace route.

The production snapshot webhook must include `application_fee.created`, `application_fee.refunded`, and `balance.available` so Host Node Steward and Territory Stewardship shares, refund adjustments, and pending-balance retries are settled through the idempotent money-edge state machines.

## Security invariants

- Stripe platform credentials exist only in Cloudflare core.
- Goods remain seller-direct outside FellowFare settlement.
- Burned Acorns/Buttons never become recipient transfers.
- Service/learning/tutoring USD charges belong to the connected provider.
- FellowFare receives only its configured application fee on those direct charges.
- The default application fee first-stage split remains 50% facilitating Host Node Steward / 50% existing Cerbanimo bucket.
- Only the existing Cerbanimo bucket is subdivided 50% Cerbanimo Global / 50% Territory Stewardship.
- Host Node Steward, provider, contributor, and compute/system percentages are not reduced by Territory Stewardship.
- The facilitating Hub is bound into seller-owned Price metadata before checkout; buyers cannot redirect either Steward share.
- Checkout validates the connected-account Stripe Price and its FellowFare listing/Hub metadata.
- Steward transfers persist or remain held until platform funds and payout gates permit settlement rather than being silently dropped.
- Refunds and disputes proportionally reduce applicable Steward entitlements.
- No new FellowFare seller settlement uses destination charges or separate transfers.
- The old `/api/money-edge/commerce/*` route remains fail-closed.
- Legacy unwind and unrelated platform-reserve payouts remain recoverable.

See `docs/finance/territory-stewardship-economy-v1.md`, `docs/finance/live-money-human-gate.md`, and `docs/finance/fellowfare-fulfillment-economy-v1.md`.
