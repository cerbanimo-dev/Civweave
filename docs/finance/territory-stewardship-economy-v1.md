# Civweave Territory Stewardship Economy v1

Status: adopted implementation contract, subject to execution of the stewardship resolution and individual agreements before cash payout.

## Core invariant

Territory Stewardship is funded **only from the cash share that previously accrued to Cerbanimo**. It does not reduce the provider/seller share, the Host Node Steward share, the system/compute reserve, or the contributor pool.

Every existing Cerbanimo cash share is subdivided:

- **50% Cerbanimo Global**
- **50% Territory Stewardship**

The Territory Stewardship Share belongs economically to the **office for the applicable territory**, not permanently to the individual holding that office. It is compensation/revenue share, **not equity**, and grants no ownership, voting, membership, or residual claim in Cerbanimo LLC, Civweave, or a territorial operating entity.

## Current transaction lanes

### Compute top-ups

After processor costs, the existing top-up economics are 70% system/compute reserve, 25% Host Node Steward, and 5% Cerbanimo. The new second-stage split changes only the last bucket:

- **70% system/compute reserve**
- **25% Host Node Steward**
- **2.5% Cerbanimo Global**
- **2.5% Territory Stewardship**

### Monthly memberships

After processor costs, the existing membership economics are 50% system/compute reserve, 25% Host Node Steward, and 25% Cerbanimo. The new second-stage split is:

- **50% system/compute reserve**
- **25% Host Node Steward**
- **12.5% Cerbanimo Global**
- **12.5% Territory Stewardship**

### FellowFare services, learning, and tutoring

Provider-owned Stripe direct charges remain unchanged. The provider retains 95% before its own Stripe/merchant costs when the default 5% application fee is used. The application fee first remains 50/50 between the facilitating Host Node Steward and the existing Cerbanimo bucket. Only the Cerbanimo half receives a second-stage split:

- **95% provider gross before the FellowFare application fee**
- **2.5% facilitating Host Node Steward**
- **1.25% Cerbanimo Global**
- **1.25% Territory Stewardship**

Physical/community goods remain seller-direct and continue to carry no FellowFare percentage.

### December 1 annual reserve distribution

The existing rule that 50% of eligible AI cash reserve enters the annual payout remains unchanged. Within that payout:

- **85% eligible cotoken contributors**
- **10% Node Host**
- **2.5% Cerbanimo Global**
- **2.5% Territory Stewardship**

The other 50% of eligible reserve remains reserved exactly as before.

### Shared-domain hosting

The existing `<hub>.civweave.cc` $5/$10 hosting cost-share is not a Cerbanimo/Host revenue split and is unchanged by this policy.

## Territory routing

Every Hub Node may be assigned a canonical `territory_id`. Revenue generated through that Hub resolves the Territory Steward in this order:

1. the most specific active appointed territory assigned to the Hub;
2. its parent territory, recursively;
3. if no active appointment exists, the Territory Operations Reserve.

Initial hierarchy:

- `us` — United States, national fallback; Cami Ryn Stormcaller, home region New York
  - `us-mo-kc` — Kansas City, Missouri; Anthony Stematz-Breitling
  - `us-ca-la` — Los Angeles, California; Saphirah Pociluyko
- `jp` — Japan, national fallback; Taki, home region Tokyo

A Kansas City Hub therefore routes its Territory Stewardship Share to the Kansas City office, not to the national U.S. fallback. A U.S. Hub outside an appointed local territory falls back to the U.S. office. The same pattern supports future nested territories without changing payment economics.

## Office-linked entitlement and succession

An appointment may begin before the Steward has completed agreement signature, identity verification, tax setup, or payout onboarding. The office may accrue an entitlement during that period, but Civweave holds the cash rather than transferring it.

A payout is released only when the applicable appointment has:

- `appointment_status = appointed`;
- `agreement_status = accepted`;
- verified payout identity as required by the payment provider and applicable law; and
- `payout_status = ready` with an approved payout account.

When a Steward leaves office, their entitlement to transactions settling after the end of their term stops. A successor receives future office-linked entitlements after appointment. A vacancy does not cause Cerbanimo to recapture the Territory Stewardship Share; it remains in the Territory Operations Reserve.

## Refunds, disputes, and chargebacks

Territory payouts follow the same economic reversal principle as the Host Node Steward payout. If the underlying payment is refunded or disputed, the Territory Stewardship entitlement is proportionally reduced. If cash was already transferred, the platform attempts a corresponding transfer reversal. If it was still held, the held entitlement is reduced instead.

## Runtime implementation

Canonical implementation lives in:

- `cloudflare/core/src/territory-stewardship-v1.mjs`
- `cloudflare/core/migrations/0009_territory_stewardship.sql`
- `cloudflare/core/src/money-edge-with-memberships.mjs`
- `public/app/cerbanimo-commerce-distribution-v1.js`

Public registry:

```text
GET /api/money-edge/territories
```

A registered Hub may assign its routing territory using its existing signed money-edge identity:

```text
POST /api/money-edge/territories/node
{
  "nodeId": "...",
  "territoryId": "us-ca-la"
}
```

The request must carry the normal `x-civweave-node-signature`. Buyer input cannot select or redirect the Territory Stewardship recipient at checkout.

## Legal and tax boundary

The software policy deliberately does not label a Steward as an employee or independent contractor. Worker classification, payroll, withholding, information reporting, VAT/consumption-tax treatment, cross-border withholding, and treaty handling depend on the actual relationship and jurisdiction. The individual agreement therefore makes classification and payment processing subject to applicable law rather than attempting to create a tax result by contract label.
