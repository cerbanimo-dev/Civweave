# Civweave launch kit: Cloudflare authority + WWW node fabric

Civweave launch infrastructure is split into two separately permissioned Cloudflare systems plus physical host nodes that implement the same `civweave.node.v1` protocol.

## Canonical topology

```text
https://commonweave.pages.dev
  canonical PWA / installer
          |
          v
https://api.commonweave.earth
  civweave-core Worker
  D1: registry + money ledger
  R2: package distribution
  Durable Object: persistent Cerbanimo Ed25519 signing identity
  Stripe Connect direct-charge authority
          |
          | private Service Binding
          v
https://nodes.commonweave.earth
https://<node-id>.nodes.commonweave.earth
  civweave-node-cloud Worker
  one SQLite-backed Durable Object per WWW node
          |
          +-- Cloudflare seed/WWW nodes
          +-- Raspberry Pi / local servers through Cloudflare Tunnel
          +-- private-device outbound relay lane (relay phase)
```

Render is no longer a money-edge authority. It may remain online as a transition/fallback host node while useful.

## Security boundary

Only `civweave-core` receives payment-provider credentials. The WWW node fabric and community nodes never receive:

```text
STRIPE_SECRET_KEY
STRIPE_CONNECT_WEBHOOK_SECRET
CIVWEAVE_MONEY_EDGE_PRIVATE_KEY
```

The core signing identity is generated inside `CivweaveCoreIdentity`, persisted in Durable Object storage, and exposes only its Ed25519 public key through `/api/money-edge/trust`.

Each Cloudflare WWW node also generates its own persistent Ed25519 identity inside its own Durable Object. Raspberry Pi and other physical nodes continue to generate their private identity locally. Enrollment proves possession of the node key with a challenge and uses a short-lived, single-use grant. There is no fleet-wide registration secret.

## Cerbanimo fee

The authoritative launch platform fee is:

```text
CIVWEAVE_PLATFORM_FEE_BPS=1500
```

That is 15%. Host-node manifests cannot override it. For a direct charge, Stripe creates the charge on the connected host-node account and the core supplies the Cerbanimo application fee.

## Core resources

Create these Cloudflare resources for `civweave-core`:

```text
Worker: civweave-core
D1: civweave-core
R2: civweave-distribution
Custom domain: api.commonweave.earth
Durable Object: CivweaveCoreIdentity
Cron: every 5 minutes for pending signed-event delivery
```

Apply both migrations in order:

```text
cloudflare/core/migrations/0001_core.sql
cloudflare/core/migrations/0002_money_edge.sql
```

Generate a deployment Wrangler file from the committed template with:

```text
node scripts/prepare-cloudflare-launch-kit-v1.mjs <D1_DATABASE_ID>
```

The generated file is local/deployment output and must not become a secret store.

### Core secrets

Set only in Cloudflare Worker secrets:

```text
STRIPE_SECRET_KEY
STRIPE_CONNECT_WEBHOOK_SECRET
NODE_FABRIC_BINDING_TOKEN
```

Do not put any of these in source or on a host node.

## WWW node fabric

Deploy `cloudflare/node-cloud/wrangler.jsonc` as `civweave-node-cloud` after the core Worker exists. It binds privately to `civweave-core` as `CORE` and serves:

```text
nodes.commonweave.earth/*
*.nodes.commonweave.earth/*
```

Each node ID maps to one SQLite-backed Durable Object. A cloud seed node has a persistent node keypair, manifest, WebSocket presence state and recent payment-event receipts.

Fabric-only secrets:

```text
NODE_FABRIC_OPERATOR_TOKEN
NODE_FABRIC_BINDING_TOKEN
```

`NODE_FABRIC_BINDING_TOKEN` is an internal credential between the two Cerbanimo-operated Cloudflare systems. It is not distributed to community nodes.

## Raspberry Pi / local server

A Pi or home server runs the normal Node 22 Civweave host-node runtime with local SQLite and optional local AI. It generates its own node/operator identity and Ed25519 keypair on first startup.

Its public transport is a Cloudflare Tunnel assigned a dedicated host under:

```text
<node-id>.nodes.commonweave.earth
```

The Tunnel is outbound from the local machine, so no router port-forward is required. The node's canonical money edge defaults to:

```text
https://api.commonweave.earth
```

No Stripe or Cerbanimo private secret is copied to the Pi.

## Payment authority

The canonical payment API is now:

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

The core implements configurable Stripe Connect accounts, hosted onboarding, direct-charge Checkout, independent paid-session verification, the 15% application fee, refunds, dispute/chargeback debt events, signed node payment events and retry delivery from D1.

The Stripe Connect webhook should eventually target:

```text
https://api.commonweave.earth/api/money-edge/webhooks/stripe
```

and include:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
charge.refunded
charge.dispute.created
charge.dispute.funds_withdrawn
```

## Live-money gate

Cloudflare is the canonical authority in code immediately, but real-money activation remains fail-closed. The committed Worker configuration keeps these false:

```text
CIVWEAVE_MONEY_LIVE_ENABLED=false
CIVWEAVE_MONEY_COMPLIANCE_APPROVED=false
CIVWEAVE_MONEY_JURISDICTION_APPROVED=false
CIVWEAVE_MONEY_KYC_AML_READY=false
CIVWEAVE_MONEY_TAX_REPORTING_READY=false
CIVWEAVE_MONEY_TERMS_APPROVED=false
```

A sandbox `sk_test_...` key can exercise onboarding and Checkout while `liveReady` remains false. A live Stripe key cannot process Civweave live top-ups until every operational gate is explicitly enabled.

## Launch sequence

1. Deploy `civweave-core`, create D1/R2, and apply both migrations.
2. Set the central Cloudflare secrets directly in Cloudflare, never in chat/source.
3. Verify `/api/money-edge/status` and `/api/money-edge/trust`.
4. Deploy `civweave-node-cloud` and its wildcard node routes.
5. Create several Cerbanimo-operated cloud seed nodes.
6. Point the Stripe Connect webhook at the Cloudflare money edge.
7. Run sandbox account onboarding, direct-charge top-up, signed delivery, refund and dispute tests.
8. Add Raspberry Pi/local-server nodes using Cloudflare Tunnel and verify identical enrollment.
9. Keep live-money flags false until legal/compliance/provider readiness is complete.

## Verification

Run:

```text
node scripts/verify-cloudflare-launch-kit-v1.mjs
```

The repository CI gate checks the two-plane permission boundary, D1/R2/Durable Object bindings, Cloudflare authority URL, 15% fee, Stripe direct-charge form, refund application-fee behavior, wildcard WWW nodes, Ed25519 trust compatibility, no payment-provider secrets on host nodes, and source syntax.
