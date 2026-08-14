# Civweave node money edge v1

The canonical Cerbanimo money edge is the Cloudflare `civweave-core` Worker. Render is not a payment authority.

## Current Stripe models

Civweave deliberately uses different Stripe patterns for different economic lanes.

### Platform money

Compute top-ups, memberships, Host Steward earnings, and reserve-funded distributions remain platform-controlled money lanes. Recipient payout accounts may use Accounts v2 recipient configuration and separate transfers where the platform owns the original charge.

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

USD flow:

```text
buyer -> provider connected Stripe account
             |
             +-> 5% FellowFare application fee
                       |
                       +-> 50% facilitating Hub Steward
                       +-> 50% Cerbanimo
```

The USD charge is a Stripe Connect **direct charge**. The connected provider is merchant of record, uses a merchant/card-payments Accounts v2 configuration, and owns the Stripe Product, Price, Checkout Session, and resulting charge. FellowFare receives only `application_fee_amount`.

The default FellowFare service/learning/tutoring fee is **5% / 500 bps**, configurable by `CIVWEAVE_FELLOWFARE_SERVICE_FEE_BPS`. The fee proceeds are split **50/50** between the facilitating Hub Steward and Cerbanimo. At the default rate, each receives an economic share equal to **2.5% of the service sale**.

The facilitating Hub is bound into server-created connected-account Price metadata before checkout. The buyer does not choose or submit the payout destination. When Stripe creates the application fee, Cloudflare core resolves that Hub's registered Steward payout account and transfers half of the application fee from the platform balance. Cerbanimo retains the other half. Partial and full application-fee refunds proportionally reverse the Host Steward transfer.

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

## Existing platform economic lanes

### Node compute top-ups

After processor fees:

```text
70% system/compute reserve
25% Host Steward
 5% Cerbanimo
```

### Node memberships

After processor costs:

```text
50% system
25% Host Steward
25% Cerbanimo
```

### December 1 reserve distribution

Once per year, 50% of eligible AI cash reserve becomes the annual payout:

```text
85% eligible cotoken contributors
10% node host
 5% Cerbanimo
```

The remaining 50% stays reserved. Cotokens are weights only and are not burned.

## Retired FellowFare marketplace route

The old platform-charge/separate-transfer marketplace endpoint remains retired:

```text
/api/money-edge/commerce/* -> 410 marketplace-checkout-disabled
```

Legacy settlement/refund/dispute code remains only to finish or unwind payments created under the retired architecture. The former gross-sale commerce host-fee endpoints are also retired. The active service-fee Steward share is not a revival of that model: it distributes half of FellowFare's application fee after a provider-owned direct charge while leaving provider gross ownership intact.

## Cloudflare authority storage

D1 retains node records, Stripe event idempotency, enrollment grants, connected-account mappings, platform-money settlements, FellowFare service-fee split settlements, and legacy commerce records needed for recovery/audit. Durable Objects retain core signing identity. R2 remains distribution storage.

## Core-only secrets

Stripe platform credentials and Civweave signing secrets stay on Cloudflare core and are never distributed to host nodes.

`CIVWEAVE_PLATFORM_FEE_BPS=500` remains the Cerbanimo share of compute top-up service net only. FellowFare service/learning/tutoring direct commerce instead uses `CIVWEAVE_FELLOWFARE_SERVICE_FEE_BPS`, defaulting to **500 bps**.

## Live-money gate

Live Stripe transactions remain fail-closed until the existing compliance, jurisdiction, KYC/AML, tax/reporting, terms, and `CIVWEAVE_MONEY_LIVE_ENABLED` gates are deliberately satisfied.

Those gates may authorize provider-owned FellowFare service/learning/tutoring direct charges. They never authorize physical-goods checkout or revival of the retired platform-charge marketplace route.

The production snapshot webhook must include `application_fee.created` and `application_fee.refunded` so Host Steward fee shares and refund reversals are settled through the same idempotent receipt state machine as other money-edge events.

## Security invariants

- Stripe platform credentials exist only in Cloudflare core.
- Goods remain seller-direct outside FellowFare settlement.
- Burned Acorns/Buttons never become recipient transfers.
- Service/learning/tutoring USD charges belong to the connected provider.
- FellowFare receives only its configured application fee on those direct charges.
- The default service fee is 5%, with application-fee proceeds split 50/50 between the facilitating Hub Steward and Cerbanimo.
- The facilitating Hub is bound into seller-owned Price metadata before checkout; buyers cannot redirect the Steward share.
- Checkout validates the connected-account Stripe Price and its FellowFare listing/Hub metadata.
- No new FellowFare seller settlement uses destination charges or separate transfers.
- The old `/api/money-edge/commerce/*` route remains fail-closed.
- Legacy unwind and unrelated platform-reserve payouts remain recoverable.

See `docs/finance/live-money-human-gate.md` and `docs/finance/fellowfare-fulfillment-economy-v1.md`.
