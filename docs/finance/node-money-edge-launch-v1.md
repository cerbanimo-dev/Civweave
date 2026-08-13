# Civweave node money edge v1

The canonical Cerbanimo money edge is the Cloudflare `civweave-core` Worker. Render is not a payment authority; it may remain online as a transitional/fallback host while useful.

FellowFare seller commerce is **not** a money-edge payment rail. The canonical marketplace economy is documented in `docs/finance/fellowfare-fulfillment-economy-v1.md`.

## Current Stripe model

Civweave uses Stripe for platform-controlled money lanes such as compute top-ups, memberships, Host Steward earnings, and reserve-funded distributions.

Host Steward payout accounts are Stripe Accounts V2 recipient accounts:

- dashboard: Express;
- fee collection responsibility: Cerbanimo/application where the platform creates the underlying charge;
- negative balance liability: Cerbanimo/application where applicable;
- requested payout capability: `configuration.recipient.capabilities.stripe_balance.stripe_transfers`.

These recipient accounts are **not** FellowFare goods-seller accounts. FellowFare does not onboard physical-goods sellers into a platform marketplace payout flow.

Older sandbox marketplace-recipient records may remain readable for recovery/testing. They must not be used to create a new FellowFare seller checkout.

## Economic lanes

External money is deliberately split into distinct platform lanes rather than using a global marketplace take rate.

### Node compute top-ups

After Stripe's actual processor fee, service net is allocated:

```text
70% system/compute reserve
25% Host Steward
 5% Cerbanimo
```

The customer charge belongs to the platform. The Host Steward's earned share is transferred from the verified platform charge.

### Node memberships

Memberships are monthly platform subscriptions. After processor costs, the current membership economy is:

```text
50% system
25% Host Steward
25% Cerbanimo
```

Host earnings are transferred separately after a paid invoice is independently verified.

### FellowFare goods

Physical/community goods do not use the money edge for seller settlement.

```text
FellowFare listing -> buyer/seller arrangement -> seller's private payment method
```

FellowFare does not:

- create a marketplace Checkout Session for the goods sale;
- collect the seller's purchase price;
- escrow the purchase price;
- split the purchase price;
- route the seller's proceeds;
- charge a FellowFare commerce percentage on the sale.

The seller may state their own price and accepted private payment methods in the listing. Payment is arranged directly between buyer and seller.

### FellowFare services, tutoring, and learning

Services, tutoring, and learning use Acorn/Button fulfillment rather than a platform seller-payment flow.

```text
requester balance -> fulfillment burn
provider contribution -> platform reward eligibility
```

Burned Acorns/Buttons are not transferred to the provider. FellowFare publishes no required USD exchange rate for either resource.

### December 1 reserve distribution

Once per year, 50% of eligible AI cash reserve becomes the annual payout. That payout is split:

```text
85% eligible cotoken contributors
10% node host
 5% Cerbanimo
```

The other 50% of eligible reserve remains reserved. Cotokens are weights only; they are not burned by the distribution.

This is a platform-reserve distribution and is separate from FellowFare seller commerce.

## Node enrollment loop

1. Every host node creates its own stable node/operator identity and Ed25519 receipt keypair locally.
2. When an operator chooses Connect payouts, the node fetches the Cloudflare core trust document and pins the signing identity.
3. The core fetches the node manifest and sends a proof challenge. The node signs it with its private key.
4. The core issues a short-lived, single-use enrollment grant bound to node ID, operator ID, callback origin, and receipt public key. Only the grant hash is stored in D1.
5. The core creates or reuses the appropriate Stripe recipient account for eligible platform earnings and returns Stripe-hosted onboarding.
6. Stripe collects the Host Steward's truthful identity/business and payout-bank information.
7. Civweave must observe `configuration.recipient.capabilities.stripe_balance.stripe_transfers.status = active` before treating the recipient as transfer-ready.

## Platform-payment settlement loop

This loop applies to eligible Civweave platform products such as compute top-ups and memberships, not FellowFare seller transactions.

1. A customer starts an eligible platform Checkout through the node/app.
2. The node signs the request where node authority is required.
3. Cloudflare core validates the request and creates the platform Checkout Session/subscription.
4. Stripe sends the relevant live webhook to Cloudflare core.
5. Core verifies the webhook and independently retrieves Stripe payment objects before applying value.
6. D1 records authoritative settlement idempotently.
7. Eligible Host Steward/platform shares are transferred using the appropriate verified source transaction.
8. Core emits signed payment events to the node where node-local state must change.
9. Refund/dispute events produce delta adjustments and transfer reversals/debits as appropriate without double application.

## Retired FellowFare marketplace endpoints

The production entry rejects:

```text
/api/money-edge/commerce/*
```

with HTTP `410` and code:

```text
marketplace-checkout-disabled
```

Legacy commerce webhook settlement/refund/dispute code is retained only so already-created payments can finish or unwind safely. It is not an authorization to open new marketplace sales.

## Cloudflare authority storage

```text
D1 civweave-core
  nodes
  Stripe webhook event idempotency
  enrollment grants
  connected-account bindings
  top-ups/memberships/settlements
  refunds/disputes
  legacy commerce records retained for unwind/audit
  pending signed-event deliveries

Durable Object CivweaveCoreIdentity
  persistent Cerbanimo Ed25519 signing identity

R2 civweave-distribution
  installers/packages/large immutable distribution assets
```

## Core-only secrets

These belong only on the Cloudflare core Worker and must never be committed or distributed to host nodes:

```text
STRIPE_SECRET_KEY
STRIPE_CONNECT_WEBHOOK_SECRET
STRIPE_CONNECT_THIN_WEBHOOK_SECRET
NODE_FABRIC_BINDING_TOKEN
```

`CIVWEAVE_PLATFORM_FEE_BPS=500` remains the Cerbanimo share of **compute top-up service net only**. It must not be reused as a FellowFare marketplace take rate.

## Payment API

Current platform-money APIs include:

```text
GET  /api/money-edge/status
GET  /api/money-edge/trust
POST /api/money-edge/enrollment/start
POST /api/money-edge/nodes/register
GET  /api/money-edge/nodes/:nodeId/status
POST /api/money-edge/topups
POST /api/money-edge/topups/:topupId/refund
POST /api/money-edge/webhooks/stripe
```

FellowFare marketplace commerce APIs are intentionally retired.

## Live-money gate

Cloudflare is canonical authority regardless of whether real platform money is currently enabled. Live platform transactions remain fail-closed until all operational gates are deliberately true:

```text
CIVWEAVE_MONEY_LIVE_ENABLED=true
CIVWEAVE_MONEY_COMPLIANCE_APPROVED=true
CIVWEAVE_MONEY_JURISDICTION_APPROVED=true
CIVWEAVE_MONEY_KYC_AML_READY=true
CIVWEAVE_MONEY_TAX_REPORTING_READY=true
CIVWEAVE_MONEY_TERMS_APPROVED=true
```

Those gates authorize the supported platform-money lanes. They do **not** re-enable FellowFare seller checkout.

## Security invariants

- Stripe platform credentials exist only in Cloudflare core.
- Host nodes never receive the Stripe platform key or Cerbanimo signing private key.
- Physical/community nodes generate their own private identities.
- Enrollment uses challenge proof plus a hash-stored, identity-bound, single-use grant.
- Nodes pin the core trust root and reject unannounced replacement.
- Node-to-core requests are signed with the node key where applicable.
- Core-to-node payment events are signed with the persistent core key.
- Platform Checkout amounts and economic splits come from Cerbanimo policy, not host-provided fee declarations.
- Customer payment state is independently re-verified before credit or transfer.
- Recipient transfers are idempotent and tied to the correct platform settlement source.
- Refund/dispute adjustments remain separate from processor-fee and Cerbanimo-share accounting.
- FellowFare physical-goods seller payments remain outside the platform money edge.
- FellowFare services/learning/tutoring use fulfillment burn, not seller payment routing.
- The public marketplace commerce route remains fail-closed even when live platform money is enabled.

See `docs/finance/live-money-human-gate.md` for platform-money launch checkpoints and `docs/finance/fellowfare-fulfillment-economy-v1.md` for the marketplace economy contract.
