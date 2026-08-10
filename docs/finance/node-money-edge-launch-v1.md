# Civweave node money edge v1

The canonical Cerbanimo money edge is the Cloudflare `civweave-core` Worker at:

```text
https://api.commonweave.earth
```

Render is not a payment authority. It may remain online as a transitional host node/fallback while useful.

## Economic loop

1. Every host node creates its own stable node/operator identity and Ed25519 receipt keypair locally. Cloudflare WWW nodes keep this identity in their own SQLite-backed Durable Object; Raspberry Pi and server nodes keep it in their local persistent data.
2. When an operator chooses **Connect payouts**, the node fetches the Cloudflare core public trust document, verifies its fingerprint and pins the Ed25519 public key.
3. The core fetches the node manifest and sends the node a challenge. The node signs it with its own private key.
4. The core issues a random, short-lived, single-use enrollment grant bound to node ID, operator ID, callback origin and receipt public key. Only the grant hash is stored in D1.
5. The core creates or reuses a configurable Stripe connected account and returns Stripe-hosted onboarding.
6. A paired user purchases prepaid node credit. The node signs the request. The core verifies that signature and creates a direct charge on the operator connected account with Cerbanimo's authoritative 15% application fee.
7. Stripe sends a Connect webhook to the Cloudflare core. The core verifies the webhook and independently retrieves the Checkout Session, successful PaymentIntent, charge and balance transaction.
8. Only after verification does the core sign `civweave.node-payment-event.v1` and deliver it to the registered node. The event carries authoritative fee data and zero Button/Acorn/XP mint authority.
9. Refund and dispute events produce signed debit adjustments. Pending deliveries remain in D1 and are retried by the core cron.
10. Operator cash remains in that operator's Stripe connected account and Stripe handles payouts.

## Cloudflare authority storage

```text
D1 civweave-core
  nodes
  Stripe webhook event idempotency
  enrollment grants
  connected-account bindings
  top-ups
  refunds/disputes
  pending signed-event deliveries

Durable Object CivweaveCoreIdentity
  persistent Cerbanimo Ed25519 signing identity

R2 civweave-distribution
  installers/packages/large immutable distribution assets
```

The signing private key is generated inside Durable Object storage. It is not an environment variable and is never distributed to host nodes.

## Core-only secrets

These exist only as Cloudflare Worker secrets on `civweave-core`:

```text
STRIPE_SECRET_KEY
STRIPE_CONNECT_WEBHOOK_SECRET
NODE_FABRIC_BINDING_TOKEN
```

Host nodes never receive them.

The authoritative launch fee is:

```text
CIVWEAVE_PLATFORM_FEE_BPS=1500
```

A host-node manifest cannot lower or replace this value.

## Node setup

New physical nodes need no Cerbanimo/Stripe private credentials and no manually generated keypair. Their money edge defaults to:

```text
CIVWEAVE_MONEY_EDGE_URL=https://api.commonweave.earth
```

A Raspberry Pi or local server should expose a dedicated HTTPS node hostname through Cloudflare Tunnel:

```text
https://<node-id>.nodes.commonweave.earth
```

The node then performs the same proof-of-key enrollment as a Cloudflare-hosted WWW node. No port-forwarding or shared registration password is required.

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

The Stripe webhook must be a Connect webhook and subscribe to:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
charge.refunded
charge.dispute.created
charge.dispute.funds_withdrawn
```

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

The committed launch configuration leaves all of those false. A Stripe sandbox key can exercise onboarding and direct-charge Checkout without making `liveReady` true. A live Stripe key alone cannot enable real Civweave payments.

## Security invariants

- Stripe platform credentials exist only in `civweave-core`.
- The WWW node fabric has no Stripe platform credential and no Cerbanimo signing private key.
- Physical/community nodes generate their own private identities.
- Enrollment uses challenge proof plus a hash-stored, identity-bound, single-use grant.
- Nodes pin the core trust root and reject unannounced replacement.
- Node to core requests are signed with the node key.
- Core to node payment events are signed with the persistent core key.
- Direct-charge application fee authority belongs to Cerbanimo core policy.
- Every external-money event has `mintEffect: 0` and `supplyEffect: 0`.
- Checkout requests are idempotent and provider payment state is independently re-verified before node credit.
- Refund and dispute adjustments remain separate from processor fees and application-fee accounting.
- Live money fails closed on provider, webhook, compliance, jurisdiction, KYC/AML, tax and terms readiness.

See `docs/operations/launch-kit-cloudflare-node-fabric-v1.md` for deployment and Raspberry Pi/WWW-node rollout details.
