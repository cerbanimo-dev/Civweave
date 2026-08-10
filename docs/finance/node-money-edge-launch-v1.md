# Civweave node money edge v1

This launch path turns the existing node-local AI marketplace from sandbox accounting into an opt-in real-payment loop without moving payment-provider credentials onto volunteer nodes.

## Economic loop

1. A node operator configures the existing Node AI marketplace, advertises services, pricing, privacy/retention terms, and a receipt-signing public key.
2. The operator explicitly connects a Stripe Standard connected account through the trusted Cerbanimo money edge.
3. A paired Civweave user chooses an amount of prepaid node credit and asks that node to create checkout.
4. The node signs the request with its existing receipt key. The money edge verifies the registered node key and creates a **direct charge** on that operator's connected account with a Cerbanimo application fee.
5. Stripe notifies the money edge. The edge verifies the webhook and independently retrieves the paid Checkout Session, successful PaymentIntent, successful charge, and balance transaction.
6. Only after provider verification does the money edge sign a canonical `civweave.node-payment-event.v1` and deliver it to the registered node.
7. The node verifies the pinned money-edge public key and feeds the event into the existing durable `creditTopUp` / `debitAdjustment` SQLite lanes. The existing capability → reserve → inference → settle path is unchanged.
8. Node cash stays in the operator's connected Stripe account. Stripe handles that account's payout schedule. Civweave does not create a central operator-cash balance.

## Trust boundaries

- Stripe platform secret and Connect webhook secret exist only on the money-edge host.
- Nodes never receive Stripe platform credentials.
- Money-edge node registration requires a challenge signed by the node's advertised receipt private key.
- Node → edge requests are signed with that same node key.
- Edge → node money events are signed with the dedicated money-edge key and verified against `CIVWEAVE_MONEY_EDGE_PUBLIC_KEY`.
- Every live money event carries `mintEffect: 0` and `supplyEffect: 0`. External money has no Button, Acorn, or XP mint authority.
- Top-up creation is idempotent. Payment delivery is durable and retryable. Refund and dispute adjustments reuse the existing node debt and reservation protections.
- Live readiness fails closed until the provider, webhook, signing keys, compliance, jurisdiction, KYC/AML readiness, tax-reporting readiness, and provider terms gates are explicitly enabled.

## Money-edge environment

Required for a live edge:

```text
CIVWEAVE_MONEY_EDGE_ENABLED=1
CIVWEAVE_MONEY_LIVE_ENABLED=true
CIVWEAVE_MONEY_COMPLIANCE_APPROVED=true
CIVWEAVE_MONEY_JURISDICTION_APPROVED=true
CIVWEAVE_MONEY_KYC_AML_READY=true
CIVWEAVE_MONEY_TAX_REPORTING_READY=true
CIVWEAVE_MONEY_TERMS_APPROVED=true
CIVWEAVE_MONEY_EDGE_PRIVATE_KEY=<ed25519 private key PEM>
CIVWEAVE_MONEY_EDGE_ADMIN_SECRET=<32+ bytes>
STRIPE_SECRET_KEY=<platform live secret>
STRIPE_CONNECT_WEBHOOK_SECRET=<Connect webhook secret>
```

The corresponding Ed25519 public key is distributed to nodes as `CIVWEAVE_MONEY_EDGE_PUBLIC_KEY`.

## Node environment

A node that wants live commerce adds:

```text
NODE_AI_LIVE_COMMERCE_ENABLED=1
CIVWEAVE_MONEY_EDGE_URL=https://<trusted-money-edge-origin>
CIVWEAVE_MONEY_EDGE_PUBLIC_KEY=<pinned edge public key PEM>
NODE_AI_RECEIPT_PRIVATE_KEY=<existing node receipt private key PEM>
NODE_AI_RECEIPT_PUBLIC_KEY=<matching public key PEM>
NODE_AI_LIVE_MAX_TOPUP_CENTS=100000
```

The existing node marketplace secrets and service configuration remain required. `NODE_AI_PAYMENT_WEBHOOK_SECRET` continues to support the older canonical shared-secret payment ingress but is not the trust mechanism for this live edge.

## Operator onboarding

The operator console exposes live-money status only when requested. After unlocking the existing node-local operator controls, the operator can start connected-account onboarding. The money edge probes the node manifest, verifies key ownership, creates or reuses the connected account, and returns the provider-hosted onboarding URL.

## Customer checkout

Federation Finder exposes live node credit separately from sandbox credit. A user must already have a node-issued wallet session. Checkout is created through the selected node, so the node identity, user identity, fee contract, success/cancel origin, and signed node request remain bound together.

## Launch gate

The focused release gate must prove:

- signed node registration challenge;
- direct connected-account checkout with application fee;
- provider-side payment verification before local credit;
- processor fee separated from the Cerbanimo application fee;
- signed edge → node money event;
- zero mint/supply authority;
- idempotent durable top-up and delivery behavior;
- refund/chargeback adjustment compatibility;
- no Stripe secret on the node-side runtime;
- live mode remains disabled unless all operational gates are true.
