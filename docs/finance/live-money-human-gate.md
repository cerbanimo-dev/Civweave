# Civweave live-money human gate

Machine-side payment plumbing may advance through sandbox testing, read-only live preflight, deployment, credential staging, and fail-closed hardening. A verified human must supply factual business information and make the legal/operational attestations before live money is enabled.

This gate covers Civweave platform-money lanes and FellowFare **service/learning/tutoring direct charges**. It never authorizes FellowFare physical-goods checkout or revival of the retired platform-charge/separate-transfer marketplace.

Production authority:

```text
https://civweave-core.cerbanimo.workers.dev
```

## Keep these gates false until launch review is complete

```text
CIVWEAVE_MONEY_LIVE_ENABLED=false
CIVWEAVE_MONEY_COMPLIANCE_APPROVED=false
CIVWEAVE_MONEY_JURISDICTION_APPROVED=false
CIVWEAVE_MONEY_KYC_AML_READY=false
CIVWEAVE_MONEY_TAX_REPORTING_READY=false
CIVWEAVE_MONEY_TERMS_APPROVED=false
```

Automation must never infer or self-approve these statements.

## Human checkpoint A: live Stripe platform

- [ ] Use the verified Cerbanimo LLC live Stripe account.
- [ ] Complete truthful business/entity verification.
- [ ] Confirm the platform can create the supported live charges and application fees.
- [ ] Stage the minimum required live server credential through the guarded secret workflow, never source control or chat.

## Human checkpoint B: live event destinations

Keep snapshot-payment and connected-account requirements/capability signing secrets separate.

Platform payment webhook:

```text
https://civweave-core.cerbanimo.workers.dev/api/money-edge/webhooks/stripe
```

Connected-account requirements/capability events must cover the Accounts v2 configurations actually used by production recipients and FellowFare merchant accounts. FellowFare direct-commerce readiness depends on current merchant `card_payments` capability rather than stale local state.

Legacy marketplace events may still arrive for transactions predating the new boundary. They may finish or unwind but must not originate another old-style sale.

## Human checkpoint C: live connected accounts

Test both applicable account roles separately:

1. A real Host Steward/platform payout recipient, with the required recipient transfer capability active.
2. A real FellowFare service/learning/tutoring provider, using an Accounts v2 merchant configuration with a full Stripe dashboard and active card-payments capability.

For the FellowFare provider verify:

- [ ] the provider supplies truthful identity/business information directly to Stripe;
- [ ] the provider can access their Stripe account/payment management surface;
- [ ] a test Product/Price is created on the provider account;
- [ ] Checkout creates a **direct charge on the provider account**;
- [ ] the configured FellowFare `application_fee_amount` reaches the platform;
- [ ] FellowFare does not receive gross proceeds and does not create a seller transfer;
- [ ] physical-goods listings cannot use this route.

## Human checkpoint D: Cerbanimo attestations

Before enabling live money, a responsible human must confirm:

- [ ] compliance approval for the intended launch scope;
- [ ] jurisdiction review for launch geography;
- [ ] KYC/AML responsibilities and operating procedures;
- [ ] tax collection/reporting responsibilities for platform-money and direct-charge service/learning lanes;
- [ ] current Stripe/provider terms and Connect obligations;
- [ ] the FellowFare three-rail boundary remains intentional: goods seller-direct, tokens fulfillment-burn, service/learning/tutoring USD provider-owned direct charges.

## Guarded promotion

Use the existing Stripe live-readiness and Cloudflare live-money promotion workflows. Stage credentials while the live switch remains false, verify readiness, then enable only after every human checkpoint is complete.

Acceptance must include:

- a platform-money transaction such as a compute top-up or membership;
- one provider-owned FellowFare service/learning/tutoring direct charge with the application fee verified;
- confirmation that `/api/money-edge/commerce/*` still returns `410 marketplace-checkout-disabled`;
- confirmation that a physical-goods kind is rejected by `/api/fellowfare/direct-commerce/*`;
- confirmation that Acorn/Button settlement remains fulfillment burn with no recipient transfer.

## Emergency control

The existing Cloudflare Money Emergency Stop can disable live money without replacing credentials or rewriting legal attestations. Clearing it requires the workflow's explicit confirmation mechanism.

## What automation must never do

Automation may verify reported facts, but it must not:

- invent business, owner, tax, bank, or identity information;
- mark a legal/compliance attestation true because a test passed;
- move secrets through source control or chat;
- enable live money before required Stripe and human checkpoints are complete;
- create a FellowFare physical-goods charge;
- recreate destination-charge or platform-charge/separate-transfer seller settlement for new FellowFare commerce;
- reinterpret direct-charge authorization as permission for FellowFare to collect provider gross proceeds.
