# Civweave launch kit: Cloudflare authority + host fabric

Civweave launch infrastructure is split into a Pages host layer, an account-local starter-node edge, separately permissioned central Cloudflare authority/fabric services, and optional physical/local Anchors that implement the same `civweave.node.v1` family of contracts.

## Canonical topology

```text
Cloudflare host/steward account
  Pages: https://<project>.pages.dev
  Worker: civweave-host-edge.<account>.workers.dev
      ├── starter Durable Object node A
      ├── starter Durable Object node B
      └── starter Durable Object node C
          |
          | public/federated contracts only
          v
https://api.commonweave.earth
  civweave-core Worker
  D1: registry + money ledger
  R2: package distribution
  Durable Object: persistent Cerbanimo Ed25519 signing identity
  Stripe Connect authority
          |
          | private Service Binding inside the Cerbanimo account only
          v
https://nodes.commonweave.earth
https://<node-id>.nodes.commonweave.earth
  civweave-node-cloud central Worker
  one SQLite-backed Durable Object per central WWW node
          |
          +-- Cloudflare seed/WWW nodes
          +-- local Anchors / Raspberry Pi / local servers
          +-- private-device outbound relay lane
```

The reserved root Pages host is `https://civweave.pages.dev`. `https://commonweave.pages.dev` is retained only as a legacy install-origin migration target. New documentation and deployment metadata use `https://civweave.pages.dev`.

A Cloudflare Pages branch/hash alias such as `<branch>.<project>.pages.dev` is not a permanent host identity. Civweave routes installation from a preview alias back to that project's stable `<project>.pages.dev` production origin.

Render is no longer a money-edge authority. It may remain online as a transition/fallback host node while useful.

## Cloudflare account provisioning invariant

A new Civweave Cloudflare host account is not fully provisioned merely because its Pages project exists. The launch invariant is:

```text
1 Pages production host
+ 1 account-local civweave-host-edge Worker
+ 3 registered SQLite Durable Object starter nodes
= provisioned Cloudflare host account
```

The starter-node count is the same `maxHostNodes: 3` enforced by `CivweaveCapacityAccount`. Registration is idempotent. If provisioning dies after one or two nodes are created, rerunning setup fills the remaining slots instead of creating a second account fabric.

The three account-local nodes are exposed through stable Worker paths:

```text
https://<account-edge>.workers.dev/nodes/<node-id>/
```

The account edge intentionally has no central `CORE` service binding, Stripe platform key, Cerbanimo signing key, or central fabric binding token. It owns only account-local node/capacity state plus optional Workers AI. Central money and trust authority stay on the Cerbanimo-operated core.

## Host creation

The preferred host-steward path is now:

```text
clone cerbanimo-dev/Civweave
        ↓
Wrangler login to steward's Cloudflare account
        ↓
node scripts/setup-cloudflare-node.mjs --host-id <name>
        ↓
ensure/create Cloudflare Pages project
        ↓
deploy civweave-host-edge + register three starter nodes
        ↓
build and deploy Cloudflare Pages production host
        ↓
open /app/?host_setup=1 once
        ↓
Civweave persistently recommends a local Anchor/companion
```

The reserved root is created with `--canonical`. Canonical deployment requires a locally supplied `CIVWEAVE_EXPECT_CLOUDFLARE_EMAIL` check so it cannot silently publish from the wrong Wrangler login. The account email is never committed to source.

Community hosts cannot claim the reserved `civweave` Pages project name. Their default project is `civweave-<host-id>`; a different project name can be supplied explicitly if that name is already occupied.

Worker provisioning is strongly attempted but does not destroy a successful Pages setup if the steward's token lacks Worker/Durable Object permissions. In that partial state `host-deployment-v1.json` records the account edge as `pending`, Pages remains usable, and rerunning setup after fixing token permissions completes the same account rather than starting over.

## GitHub main-branch updates and account affinity

Both canonical and community deployment workflows update the Pages host **and** `civweave-host-edge` from `main`. Before either workflow mutates the account, it lists existing production Pages deployments and verifies that the credentials point to the expected `<project>.pages.dev` target.

A workflow must fail instead of reporting success when, for example, a `civweave` deployment command returns a `commonweave.pages.dev` URL. The final Pages deployment output is checked a second time for the same invariant.

For community repositories, configure:

```text
repository variable CIVWEAVE_PAGES_PROJECT=<project>
repository variable CIVWEAVE_HOST_ID=<host-id>
repository secret CLOUDFLARE_API_TOKEN=<token for the same account>
repository secret CLOUDFLARE_ACCOUNT_ID=<same account>
```

The Cloudflare operator secret for starter-node registration is generated inside the host account. GitHub does not need to know its value after all three starter nodes exist. If provisioning is incomplete, a retry may rotate that still-prelaunch account-local secret so it can safely finish the missing slots.

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

Only `civweave-core` receives payment-provider credentials. The account edge, WWW node fabric, and community nodes never receive:

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

## Central WWW node fabric

Deploy `cloudflare/node-cloud/wrangler.jsonc` as `civweave-node-cloud` after the core Worker exists. It binds privately to `civweave-core` as `CORE` and serves:

```text
nodes.commonweave.earth/*
*.nodes.commonweave.earth/*
```

Each node ID maps to one SQLite-backed Durable Object. A cloud seed node has a persistent node keypair, manifest, WebSocket presence state and recent payment-event receipts.

Central fabric-only secrets:

```text
NODE_FABRIC_OPERATOR_TOKEN
NODE_FABRIC_BINDING_TOKEN
```

`NODE_FABRIC_BINDING_TOKEN` is an internal credential between the two Cerbanimo-operated Cloudflare systems. It is not distributed to community/account-edge nodes.

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

The core implements Stripe Connect onboarding, paid-session verification, refunds/dispute adjustments, signed node payment events and retry delivery from D1. Host Pages projects and account-edge Workers never receive the platform Stripe secret.

## Live-money gate

Cloudflare is the canonical authority in code immediately, but real-money activation remains fail-closed. The committed Worker configuration leaves the operational readiness gates false until they are deliberately approved.

A sandbox key can exercise onboarding and Checkout without making the live-money gate true.

## Launch sequence

1. Run `setup-cloudflare-node.mjs --canonical` or `--host-id ...` from the intended Cloudflare account.
2. Verify setup reports the account Worker and all three starter-node URLs, or explicitly reports a non-blocking pending fabric state.
3. Verify the canonical/community installer and PWA from the stable Pages production origin.
4. For the Cerbanimo-operated authority account, deploy `civweave-core`, create D1/R2, and apply migrations.
5. Set central Cloudflare secrets directly in Cloudflare, never in source.
6. Verify `/api/money-edge/status`, `/api/money-edge/trust`, and `/api/launch-topology`.
7. Deploy the central `civweave-node-cloud` wildcard fabric.
8. Configure same-account GitHub Cloudflare secrets/variables when automatic `main` deployment is desired.
9. Open each host's steward setup URL and add a local Anchor where possible.
10. Keep live-money flags false until legal/compliance/provider readiness is complete.

## Verification

Run:

```text
node scripts/test-cloudflare-account-bootstrap-v1.mjs
node scripts/verify-cloudflare-launch-kit-v1.mjs
node scripts/verify-cloudflare-production-origin-v251.mjs
node scripts/verify-pwa-install-campus-v246.mjs
```

Repository CI checks the three-starter-node account invariant, wrong-account deployment refusal, Cloudflare authority boundary, host-origin installation contract, Pages preview safety, local Anchor reminder, D1/R2/Durable Object bindings, signed trust compatibility, and source syntax.
