# Civweave Launch Kit: Cloudflare Backbone + WWW Node Fabric v1

This launch profile keeps the current canonical Civweave PWA origin intact while adding two separately permissioned Cloudflare systems and first-class Raspberry Pi/local host nodes.

## Launch shape

```text
Canonical PWA / home site
https://commonweave.pages.dev
        |
        | public discovery + package links
        v
Cloudflare core Worker
civweave-core
https://api.commonweave.earth
        |
        | private Cloudflare service binding
        v
Cloudflare WWW node fabric
civweave-node-cloud
https://<node-id>.nodes.commonweave.earth
        |
        +---- one SQLite-backed Durable Object per cloud node
        |
        +---- public HTTPS + hibernatable WebSocket endpoint

Physical nodes implement the same civweave.node.v1 protocol:

Raspberry Pi / home server -> Cloudflare Tunnel -> public node hostname
Private device             -> outbound relay lane -> Cloudflare node fabric (relay phase)
```

The two Workers are separate security systems. The node-fabric Worker never receives the Stripe platform secret or the Cerbanimo money-edge signing private key.

## System A: Civweave core

Source: `cloudflare/core/`

Responsibilities:

- canonical node directory;
- launch topology endpoint;
- R2 package distribution;
- durable Stripe webhook ingress in D1;
- future Cloudflare-native money-edge authority;
- authoritative Cerbanimo platform fee policy, currently 15% (`1500` basis points).

Bindings:

```text
DB       -> D1 database civweave-core
PACKAGES -> R2 bucket civweave-distribution
```

Cloud-only secrets:

```text
STRIPE_SECRET_KEY
STRIPE_CONNECT_WEBHOOK_SECRET
NODE_FABRIC_BINDING_TOKEN
```

None of these values belong on a host node.

The committed config is a template because Cloudflare assigns the D1 database ID when the database is created. Replace `__CIVWEAVE_CORE_D1_ID__` in a generated deployment copy, never in application source used as a secret store.

Apply `cloudflare/core/migrations/0001_core.sql` before routing production traffic.

## System B: public WWW host-node fabric

Source: `cloudflare/node-cloud/`

Worker name:

```text
civweave-node-cloud
```

Routes:

```text
nodes.commonweave.earth/*
*.nodes.commonweave.earth/*
```

Each node ID maps deterministically to one SQLite-backed Durable Object. The Durable Object owns that cloud node's manifest, presence, service catalogue, and hibernatable WebSockets.

Examples:

```text
seed-east.nodes.commonweave.earth
seed-learning.nodes.commonweave.earth
seed-market.nodes.commonweave.earth
```

The fabric uses a private Cloudflare Service Binding named `CORE` to publish cloud-node directory changes to `civweave-core`. Service Binding traffic does not require a public Internet hop.

Cloud-fabric-only secrets:

```text
NODE_FABRIC_OPERATOR_TOKEN
NODE_FABRIC_BINDING_TOKEN
```

`NODE_FABRIC_BINDING_TOKEN` exists only between the two Cerbanimo-operated Cloudflare systems. It is not an enrollment password and is never distributed to Raspberry Pis, community nodes, browsers, or downloadable node packages.

The fabric intentionally does **not** bind:

```text
STRIPE_SECRET_KEY
STRIPE_CONNECT_WEBHOOK_SECRET
CIVWEAVE_MONEY_EDGE_PRIVATE_KEY
```

## Creating a Cerbanimo-operated cloud seed node

Once the node-fabric Worker is deployed, an authorized operator can configure a node through the fabric administration endpoint:

```text
POST https://nodes.commonweave.earth/api/fabric/nodes/<node-id>
Authorization: Bearer <NODE_FABRIC_OPERATOR_TOKEN>
Content-Type: application/json
```

Example body:

```json
{
  "displayName": "Civweave Seed East",
  "capabilities": ["discovery", "pairing", "relay", "service-catalog"],
  "services": []
}
```

The Worker stores the node state in its Durable Object and publishes the public manifest to the core directory over the private service binding.

## Raspberry Pi / local server mode

A Pi or local server runs the existing Node 22 Civweave host-node runtime. Its node ID, operator ID, Ed25519 receipt identity, authentication credentials, and capability credentials are generated on that machine and stay on that machine.

The public-server transport is Cloudflare Tunnel:

```text
Internet
   |
Cloudflare
   |
outbound tunnel connection
   |
Raspberry Pi / local server
   |
local Civweave Node.js + SQLite + optional local AI
```

The node requires no inbound port forwarding and receives no Cerbanimo or Stripe platform secret.

For production use prefer a remotely managed Cloudflare Tunnel. A locally managed tunnel remains useful for development or deliberate self-managed deployments.

## Private node / relay mode

Ordinary devices that should not have a public hostname will use an outbound WebSocket relay lane into the node-fabric Durable Objects. This preserves local execution and local storage while removing the requirement for a public callback origin.

The v1 launch kit establishes the Durable Object WebSocket surface and transport contract. Automatic community-node relay enrollment is a follow-up gate before it can replace the existing public-HTTPS callback requirement for earning nodes.

## Payment migration boundary

The Cloudflare core already provides authenticated Stripe webhook verification and durable D1 event ingress, but **Cloudflare money-edge live mode is not enabled by this launch kit**.

The existing money edge remains the sandbox/transition implementation until the Cloudflare adapter reaches parity for:

- connected-account creation and hosted onboarding;
- direct-charge Checkout creation;
- independent paid-session verification;
- application-fee accounting;
- refund processing;
- disputes and debt protection;
- signed node payment events;
- replay-safe delivery and reconciliation.

Do not redirect the live Stripe webhook away from the currently verified money edge until those parity tests pass.

## Recommended rollout

1. Keep the existing stable PWA install origin unchanged.
2. Create D1 `civweave-core` and R2 `civweave-distribution`.
3. Deploy `civweave-core` to `api.commonweave.earth` with live-money disabled.
4. Deploy `civweave-node-cloud` with Durable Objects and the private `CORE` service binding.
5. Create wildcard proxied DNS for `*.nodes.commonweave.earth` if the route deployment does not create the desired DNS shape automatically.
6. Create 3-5 Cerbanimo-operated cloud seed nodes.
7. Add Raspberry Pi/local-server nodes through Cloudflare Tunnel and confirm protocol parity.
8. Add private relay enrollment.
9. Port the complete money edge to D1 and switch Stripe webhook authority only after parity/recovery testing.
10. Retire Render as a required authority; keep it only as an optional independent seed/fallback while useful.

## Security invariants

- Stripe platform secrets exist only in the core payment authority.
- The cloud node fabric cannot read Stripe platform credentials.
- Community host nodes generate their own private identities.
- No shared registration secret is shipped to nodes.
- Cloud nodes and physical nodes expose the same `civweave.node.v1` public protocol.
- Cloudflare Service Bindings are used for core-to-fabric communication rather than public internal APIs where possible.
- Live money remains fail-closed during the migration.

## Verification

Run:

```text
node scripts/verify-cloudflare-launch-kit-v1.mjs
```

The verifier checks topology separation, the 15% fee policy, Durable Object bindings, wildcard node routing, the private service binding, D1/R2 core bindings, forbidden secret placement, and source syntax.
