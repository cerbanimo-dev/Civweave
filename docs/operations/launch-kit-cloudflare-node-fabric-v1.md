# Civweave launch kit: Cloudflare authority + host fabric

Civweave launch infrastructure is split into a Pages host layer, separately permissioned Cloudflare authority/fabric services, and optional physical/local Anchors that implement the same `civweave.node.v1` family of contracts.

## Canonical topology

```text
https://civweave.pages.dev
  OG/root Civweave Pages host + installer
          |
          +-- https://civweave-<host-id>.pages.dev
          |     community Pages hosts created from the same GitHub source
          |     each host may install its own PWA from its stable production origin
          |
          v
https://api.commonweave.earth
  civweave-core Worker
  D1: registry + money ledger
  R2: package distribution
  Durable Object: persistent Cerbanimo Ed25519 signing identity
  Stripe Connect authority
          |
          | private Service Binding
          v
https://nodes.commonweave.earth
https://<node-id>.nodes.commonweave.earth
  civweave-node-cloud Worker
  one SQLite-backed Durable Object per WWW node
          |
          +-- Cloudflare seed/WWW nodes
          +-- local Anchors / Raspberry Pi / local servers
          +-- private-device outbound relay lane
```

`https://commonweave.pages.dev` is retained only as a legacy install-origin migration target. New documentation and deployment metadata use `https://civweave.pages.dev`.

A Cloudflare Pages branch/hash alias such as `<branch>.<project>.pages.dev` is not a permanent host identity. Civweave routes installation from a preview alias back to that project's stable `<project>.pages.dev` production origin.

Render is no longer a money-edge authority. It may remain online as a transition/fallback host node while useful.

## Host creation

The preferred host-steward path is now:

```text
clone cerbanimo-dev/Civweave
        ↓
Wrangler login to steward's Cloudflare account
        ↓
node scripts/setup-cloudflare-node.mjs --host-id <name>
        ↓
Cloudflare Pages production host
        ↓
open /app/?host_setup=1 once
        ↓
Civweave persistently recommends a local Anchor/companion
```

The reserved root is created with `--canonical`. Canonical deployment requires a locally supplied `CIVWEAVE_EXPECT_CLOUDFLARE_EMAIL` check so it cannot silently publish from the wrong Wrangler login. The account email is never committed to source.

Community hosts cannot claim the reserved `civweave` Pages project name. Their default project is `civweave-<host-id>`; a different project name can be supplied explicitly if that name is already occupied.

## Local Anchor boundary

A Pages host is allowed to operate without a local Anchor. The UI should nevertheless be persistent and insistent about adding one.

The Anchor is the preferred location for:

- recovery copies of host identity/state;
- durable local federation data;
- always-on peer discovery and relay;
- local AI and larger local models;
- scheduled work that browser background APIs cannot guarantee.

The first Pages-host reminder is non-blocking and steward-specific. It can be snoozed for one day and disappears when that steward records an Anchor as paired. Future Anchor-proof work can replace that local acknowledgement with cryptographic freshness/reconstruction proofs without changing the host creation path.

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

The authoritative launch platform fee remains controlled by the core configuration. Host-node manifests cannot override it.

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

Apply the committed migrations in order, then generate a deployment Wrangler file from the committed template with:

```text
node scripts/prepare-cloudflare-launch-kit-v1.mjs <D1_DATABASE_ID>
```

The generated file is local/deployment output and must not become a secret store.

The core deploys through `cloudflare/core/src/origin-entry.mjs`, which delegates the money/registry runtime unchanged while making `https://civweave.pages.dev` the canonical install-origin metadata returned by `/api/launch-topology`.

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

A Pi or home server runs the normal Node 22 Civweave host-node runtime with persistent local data and optional local AI. It generates its own node/operator identity and Ed25519 keypair on first startup.

A public local node may use Cloudflare Tunnel under:

```text
<node-id>.nodes.commonweave.earth
```

The Tunnel is outbound from the local machine, so no router port-forward is required. A backup-only Anchor can remain LAN/localhost-only.

No Stripe or Cerbanimo private secret is copied to the physical node.

## Payment authority

The canonical payment API remains on the Cloudflare core:

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

The core implements Stripe Connect onboarding, paid-session verification, refunds/dispute adjustments, signed node payment events and retry delivery from D1. Host Pages projects never receive the platform Stripe secret.

## Live-money gate

Cloudflare is the canonical authority in code immediately, but real-money activation remains fail-closed. The committed Worker configuration leaves the operational readiness gates false until they are deliberately approved.

A sandbox key can exercise onboarding and Checkout without making the live-money gate true.

## Launch sequence

1. Create/deploy the reserved `civweave` Pages project for `https://civweave.pages.dev` from the intended canonical Cloudflare account.
2. Verify the canonical installer and PWA from the stable production origin.
3. Deploy `civweave-core`, create D1/R2, and apply migrations.
4. Set central Cloudflare secrets directly in Cloudflare, never in source.
5. Verify `/api/money-edge/status`, `/api/money-edge/trust`, and `/api/launch-topology`.
6. Deploy `civweave-node-cloud` and its wildcard node routes.
7. Create community Pages hosts with `setup-cloudflare-node.mjs --host-id ...`.
8. Open each host's steward setup URL and add a local Anchor where possible.
9. Keep live-money flags false until legal/compliance/provider readiness is complete.

## Verification

Run:

```text
node scripts/verify-cloudflare-launch-kit-v1.mjs
node scripts/verify-cloudflare-production-origin-v251.mjs
node scripts/verify-pwa-install-campus-v246.mjs
```

Repository CI checks the Cloudflare authority boundary, host-origin installation contract, Pages preview safety, local Anchor reminder, D1/R2/Durable Object bindings, signed trust compatibility, and source syntax.
