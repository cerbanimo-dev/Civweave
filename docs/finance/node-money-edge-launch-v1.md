# Civweave node money edge v1

The canonical Cerbanimo money edge is the Cloudflare `civweave-core` Worker. Render is not a payment authority; it may remain online as a transitional/fallback host while useful.

## Current Stripe model

Civweave operates the external-money lane as a **marketplace**. Customer charges are created on the Cerbanimo platform and earned shares are distributed with Stripe **separate charges and transfers**.

New Host Steward payout accounts are Stripe Accounts V2 recipient accounts:

- dashboard: Express;
- fee collection responsibility: Cerbanimo/application;
- negative balance liability: Cerbanimo/application;
- requested payout capability: `configuration.recipient.capabilities.stripe_balance.stripe_transfers`;
- connected accounts do not need to accept the customer charge themselves.

Older sandbox accounts may still have the former direct-charge/full-dashboard shape. They remain readable for migration/testing, but new production enrollment must use the marketplace recipient model.

## Economic lanes

External money is deliberately split into distinct lanes rather than using one global platform-fee percentage.

### Node compute top-ups

After Stripe's actual processor fee, service net is allocated:

```text
70% system/compute reserve
25% Host Steward
 5% Cerbanimo
```

The customer charge belongs to the platform. The Host Steward's 25% earned share is transferred to the host recipient account from the verified source charge.

### Node memberships

Memberships are monthly platform subscriptions. After processor costs, the current membership economy is:

```text
50% system
25% Host Steward
25% Cerbanimo
```

Host earnings are transferred separately after a paid invoice is independently verified.

### Cerbanimo/FellowFare product and service sales

The listed USD price is the contributor payout base. A **1% Cerbanimo split fee is added on top** of the listed price and never reduces contributor payouts.

- Product sale: the full listed amount is distributed immediately among the Cerbanimo contributors who generated the product, weighted by vested cotoken/co-credit contribution.
- Service sale: the default 10% origin/template royalty is allocated to contributors who built the reusable original project/template, and the remaining 90% goes to the people delivering that service instance. Each pool is divided by its own vested cotoken/co-credit contribution weight.
- The same contribution weighting drives associated Acorn/Button sale rewards.
- Direct commerce proceeds and the 1% split fee do not feed the December 1 reserve distribution.

### December 1 reserve distribution

Once per year, 50% of eligible AI cash reserve becomes the annual payout. That payout is split:

```text
85% eligible cotoken contributors
10% node host
 5% Cerbanimo
```

The other 50% of eligible reserve remains reserved. Cotokens are weights only; they are not burned by the distribution.

## Node enrollment loop

1. Every host node creates its own stable node/operator identity and Ed25519 receipt keypair locally.
2. When an operator chooses Connect payouts, the node fetches the Cloudflare core trust document and pins the signing identity.
3. The core fetches the node manifest and sends a proof challenge. The node signs it with its private key.
4. The core issues a short-lived, single-use enrollment grant bound to node ID, operator ID, callback origin, and receipt public key. Only the grant hash is stored in D1.
5. The core creates or reuses a Stripe Accounts V2 recipient connected account and returns Stripe-hosted onboarding.
6. Stripe collects the Host Steward's truthful identity/business and payout-bank information.
7. Civweave must observe `configuration.recipient.capabilities.stripe_balance.stripe_transfers.status = active` before treating the recipient as transfer-ready.

## Payment settlement loop

1. A buyer starts Checkout through the node/app.
2. The node signs the request where node authority is required.
3. Cloudflare core validates the request and creates the platform Checkout Session/subscription.
4. Stripe sends the relevant live webhook to Cloudflare core.
5. Core verifies the webhook and independently retrieves the Stripe payment objects before applying value.
6. D1 records the authoritative settlement idempotently.
7. Earned Host Steward/contributor shares are transferred to recipient connected accounts using separate Transfers. When the transfer is tied to a particular charge, the verified source charge is used as `source_transaction`.
8. Core emits signed payment events to the node where node-local state must change.
9. Refund/dispute events produce delta adjustments and transfer reversals/debits as appropriate without double application.

## Cloudflare authority storage

```text
D1 civweave-core
  nodes
  Stripe webhook event idempotency
  enrollment grants
  connected-account bindings
  top-ups/memberships/settlements
  refunds/disputes
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

`CIVWEAVE_PLATFORM_FEE_BPS=500` remains the Cerbanimo share of **compute top-up service net only**. It is not the commerce fee and must not be reused as a generic marketplace take rate. Product/service commerce has its own 1% fee-on-top contract.

## Payment API

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

The payment snapshot webhook subscribes to:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
charge.refunded
charge.dispute.created
charge.dispute.funds_withdrawn
```

Accounts V2 recipient requirements/capability changes must also be observable through a separately signed live event destination so transfer eligibility does not depend on stale local state.

## Live-money gate

Cloudflare is canonical authority regardless of whether real money is currently enabled. Live transactions remain fail-closed until all operational gates are deliberately true:

```text
CIVWEAVE_MONEY_LIVE_ENABLED=true
CIVWEAVE_MONEY_COMPLIANCE_APPROVED=true
CIVWEAVE_MONEY_JURISDICTION_APPROVED=true
CIVWEAVE_MONEY_KYC_AML_READY=true
CIVWEAVE_MONEY_TAX_REPORTING_READY=true
CIVWEAVE_MONEY_TERMS_APPROVED=true
```

The committed launch configuration leaves those gates false. A live Stripe key alone must not enable real Civweave payments.

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
- Recipient transfers are idempotent and tied to the correct settlement source.
- Refund/dispute adjustments remain separate from processor-fee and Cerbanimo-share accounting.
- Live money fails closed on provider, webhook, compliance, jurisdiction, KYC/AML, tax, and terms readiness.

See `docs/finance/live-money-human-gate.md` for the remaining launch checkpoints.
