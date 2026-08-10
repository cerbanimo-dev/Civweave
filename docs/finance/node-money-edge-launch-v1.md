# Civweave node money edge v1

This launch path turns the node-local AI marketplace into an opt-in real-payment loop without distributing Cerbanimo or Stripe private credentials to host nodes.

## Economic loop

1. A new node starts and creates its own stable node ID, operator ID, Ed25519 receipt identity, auth secret, capability secret, and internal operator credential. Private material stays in the node's persistent data directory.
2. The operator configures the node's services, pricing, privacy/retention terms, and public HTTPS origin. The node advertises only its receipt public key.
3. When the operator chooses **Connect payouts**, the node contacts the canonical Cerbanimo money edge over HTTPS and retrieves its public Ed25519 trust document. The node verifies the fingerprint and pins that public key locally. A later silent key change is rejected.
4. The node requests a short-lived enrollment grant. Before issuing one, the money edge fetches the node manifest and sends a cryptographic challenge to the public node. The node signs the challenge with its locally generated receipt private key.
5. After proof succeeds, the money edge issues a random single-use grant bound to that exact node ID, operator ID, callback origin, and receipt public key. Only the grant hash is stored by the money edge. The node immediately redeems it; there is no shared registration password to distribute.
6. The money edge creates or reuses the operator's Stripe connected account and returns Stripe-hosted onboarding. Stripe performs identity/business verification and payout setup.
7. A paired Civweave user chooses an amount of prepaid node credit. The node signs the checkout request with its receipt key. The money edge verifies the registered node key and creates a **direct charge** on that operator's connected account with the Cerbanimo application fee.
8. Stripe notifies the money edge. The edge verifies the webhook and independently retrieves the paid Checkout Session, successful PaymentIntent, charge, and balance transaction.
9. Only after provider verification does the money edge sign a canonical `civweave.node-payment-event.v1` and deliver it to the registered node. The signed event includes the Cerbanimo fee basis points and fee amount selected by money-edge policy.
10. The node verifies the pinned money-edge public key, verifies that the signed fee math is internally consistent, and feeds the event into its durable SQLite credit/debit lanes. External money carries zero Button, Acorn, or XP mint authority.
11. Node cash stays in the operator's connected Stripe account. Stripe handles that account's payout schedule. Civweave does not create a central operator-cash balance.

## Trust boundaries

- `STRIPE_SECRET_KEY` and `STRIPE_CONNECT_WEBHOOK_SECRET` exist only on the Cerbanimo money-edge host.
- Nodes never receive Stripe platform credentials, Cerbanimo private signing keys, or a shared enrollment secret.
- Each node generates its own private identity and operational secrets locally. Environment variables for those values are migration/recovery overrides only.
- The Cerbanimo money edge generates its own Ed25519 signing identity and administrative credential on persistent storage when explicit overrides are absent.
- First-use money-edge trust is bootstrapped over the configured HTTPS origin, fingerprint-checked, and pinned. Unannounced trust-root replacement fails closed.
- Enrollment grants are short-lived, single-use, stored as hashes, and cryptographically bound to the node identity proven by challenge.
- The Cerbanimo application fee is controlled by `CIVWEAVE_MONEY_PLATFORM_FEE_BPS` on the money edge. A node manifest cannot choose or lower Cerbanimo's live fee.
- Node → edge requests after enrollment are signed with the node receipt key.
- Edge → node payment events are signed with the dedicated money-edge key.
- Every live money event carries `mintEffect: 0` and `supplyEffect: 0`.
- Top-up creation is idempotent. Payment delivery is durable and retryable. Refund and dispute adjustments reuse the existing node debt and reservation protections.
- Live readiness fails closed until provider, webhook, fee policy, compliance, jurisdiction, KYC/AML readiness, tax-reporting readiness, and provider-terms gates are explicitly enabled.

## Cerbanimo money-edge environment

For sandbox integration, the only externally issued private values that must be configured are Stripe credentials:

```text
CIVWEAVE_MONEY_EDGE_ENABLED=1
CIVWEAVE_MONEY_LIVE_ENABLED=false
CIVWEAVE_MONEY_PLATFORM_FEE_BPS=<Cerbanimo application fee in basis points>
STRIPE_SECRET_KEY=<Stripe sandbox platform secret>
STRIPE_CONNECT_WEBHOOK_SECRET=<Stripe sandbox Connect webhook secret>
```

The host must provide a persistent `DATA_DIR`. The money edge stores:

```text
DATA_DIR/node-money-edge-v1.sqlite
DATA_DIR/money-edge-identity-v1.json
```

`money-edge-identity-v1.json` contains the generated private signing identity and administrative credential and must remain private and persistent. New deployments do not need these environment variables, but existing deployments may continue to use them as migration/recovery overrides:

```text
CIVWEAVE_MONEY_EDGE_PRIVATE_KEY=
CIVWEAVE_MONEY_EDGE_ADMIN_SECRET=
CIVWEAVE_MONEY_EDGE_KEY_ID=
CIVWEAVE_MONEY_EDGE_IDENTITY_PATH=
```

Before switching Stripe to live mode, the operational approval gates must be deliberately set:

```text
CIVWEAVE_MONEY_LIVE_ENABLED=true
CIVWEAVE_MONEY_COMPLIANCE_APPROVED=true
CIVWEAVE_MONEY_JURISDICTION_APPROVED=true
CIVWEAVE_MONEY_KYC_AML_READY=true
CIVWEAVE_MONEY_TAX_REPORTING_READY=true
CIVWEAVE_MONEY_TERMS_APPROVED=true
```

Do not set those gates merely to make a sandbox status page turn green.

## New host-node environment

A new node does **not** need Cerbanimo or Stripe secrets and does not need a manually generated keypair. At minimum, configure its marketplace/service behavior and a public HTTPS origin:

```text
NODE_AI_MARKETPLACE_ENABLED=1
NODE_AI_LIVE_COMMERCE_ENABLED=1
NODE_AI_DISPLAY_NAME=<operator-facing node name>
NODE_AI_PUBLIC_BASE_URLS=https://<public-node-origin>
NODE_AI_SERVICES_JSON=<advertised service JSON>
NODE_AI_LIVE_MAX_TOPUP_CENTS=100000
```

The canonical money edge defaults to:

```text
https://commonweave-host-node-9l1u.onrender.com
```

`CIVWEAVE_MONEY_EDGE_URL` can override that value for development or migration. `CIVWEAVE_MONEY_EDGE_PUBLIC_KEY` is no longer required for a new node because the public key is retrieved over HTTPS, fingerprint-checked, and pinned on first payout connection.

The node persists its generated identity and private credentials at:

```text
DATA_DIR/node-ai-bootstrap-v1.json
```

Back up or preserve that file with the node's persistent data. Deleting it intentionally creates a new node cryptographic identity.

## Operator onboarding

After the node has a public HTTPS origin:

1. Open the node operator console using that node's own operator-authentication mechanism.
2. Select **Connect payouts**.
3. Civweave pins the Cerbanimo money-edge trust root, proves possession of the node's local Ed25519 key, obtains a one-use enrollment grant, redeems it, and opens Stripe-hosted onboarding.
4. The operator supplies their own legal/business/payout details directly to Stripe.
5. After Stripe enables charges and payouts, the node can accept real prepaid node-credit checkouts when the Cerbanimo money edge is itself live-ready.

No Stripe secret, Cerbanimo private key, public-key PEM, registration password, or OpenSSL command is part of normal node onboarding.

## Customer checkout

Federation Finder exposes live node credit separately from sandbox credit. A user must already have a node-issued wallet session. Checkout is created through the selected node, so node identity, user identity, fee contract, success/cancel origin, and signed node request remain bound together.

## Launch gate

The focused release gate must prove:

- a fresh node self-generates and persists a stable Ed25519 identity and operational secrets;
- money-edge signing identity and admin credential persist on Cerbanimo-owned storage;
- HTTPS trust fetch is fingerprint-checked and pinned, and an unannounced key replacement is rejected;
- enrollment grants are short-lived, identity-bound, hash-stored, and single-use;
- signed node ownership challenge succeeds before enrollment;
- node-manifest fee claims cannot override Cerbanimo's money-edge fee policy;
- direct connected-account checkout carries the expected application fee;
- provider-side payment verification occurs before local credit;
- processor fee remains separate from the Cerbanimo application fee;
- signed edge → node payment event carries authoritative fee data and zero mint/supply authority;
- idempotent durable top-up and delivery behavior survives retries;
- refund/chargeback adjustment compatibility remains intact;
- no Stripe or Cerbanimo private secret exists on the node runtime;
- live mode remains disabled unless all operational gates are true.

## Abuse and key rotation

Zero-secret enrollment removes a fleet-wide credential, but it is not intended to be the final anti-abuse layer. Before broad third-party live enrollment, add operator-account authentication and rate limiting around enrollment/account creation. Stripe's own onboarding/KYC remains downstream of this gate.

Initial trust currently uses HTTPS first-use pinning. A later money-edge key-rotation protocol should publish a new trust root signed by the previously pinned key rather than silently replacing it.
