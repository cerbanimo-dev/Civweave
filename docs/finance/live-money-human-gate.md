# Civweave live-money human gate

Machine-side payment plumbing may advance through sandbox testing, read-only live preflight, deployment, credential staging, and fail-closed hardening. This checklist marks the boundary where a verified human must supply factual business information or make an explicit legal/operational attestation.

This gate applies to **Civweave platform-money lanes** such as compute top-ups, memberships, Host Steward earnings, and reserve-funded distributions. It does **not** authorize FellowFare seller checkout. FellowFare goods remain seller-direct and services/learning/tutoring use Acorn/Button fulfillment as defined in `docs/finance/fellowfare-fulfillment-economy-v1.md`.

The production Cloudflare authority is:

```text
https://civweave-core.cerbanimo.workers.dev
```

## Keep these gates false until every item below is complete

```text
CIVWEAVE_MONEY_LIVE_ENABLED=false
CIVWEAVE_MONEY_COMPLIANCE_APPROVED=false
CIVWEAVE_MONEY_JURISDICTION_APPROVED=false
CIVWEAVE_MONEY_KYC_AML_READY=false
CIVWEAVE_MONEY_TAX_REPORTING_READY=false
CIVWEAVE_MONEY_TERMS_APPROVED=false
```

No automation may infer or self-approve those statements. These values are deliberate remote Cloudflare runtime state and are not source-controlled deployment defaults. Ordinary code deployments preserve them.

## Human checkpoint A: Stripe live platform

- [ ] Switch from the Cerbanimo sandbox to the actual Cerbanimo LLC live Stripe account.
- [ ] Complete Stripe's live business/entity verification using truthful company, representative, ownership, support, bank, and tax information.
- [ ] Confirm Stripe shows the platform as able to create the supported live platform charges.
- [ ] Create or obtain a live server-side restricted key with only the permissions Civweave actually needs. Never commit or paste it into chat.
- [ ] Save it as GitHub Actions secret `STRIPE_LIVE_SECRET_KEY` for the read-only preflight and guarded promotion. Do not replace the active Cloudflare `STRIPE_SECRET_KEY` manually.

## Human checkpoint B: live event destinations

Keep payment and recipient-capability signing secrets separate.

### Platform payment snapshots

Endpoint:

```text
https://civweave-core.cerbanimo.workers.dev/api/money-edge/webhooks/stripe
```

Relevant events include the events required by the currently enabled platform lanes, including paid Checkout/subscription, refund, and dispute events.

- [ ] Destination is enabled in live mode.
- [ ] Its live signing secret is stored as GitHub Actions secret `STRIPE_LIVE_CONNECT_WEBHOOK_SECRET`.

Legacy FellowFare marketplace events may still arrive for a payment that predates the fulfillment boundary. The webhook may finish or unwind those records, but no new FellowFare marketplace Checkout Session may be created.

### Accounts V2 requirements/capabilities

Live thin-event endpoint:

```text
https://civweave-core.cerbanimo.workers.dev/api/connect-demo/webhooks/stripe-thin
```

Use a live-mode Stripe event destination for Accounts V2 recipient accounts used by eligible platform payout recipients such as Host Stewards.

- [ ] Requirements-change events are enabled for connected Accounts V2 objects.
- [ ] Recipient capability changes, especially `configuration.recipient.capabilities.stripe_balance.stripe_transfers`, are observable by Civweave.
- [ ] Its signing secret is stored separately as GitHub Actions secret `STRIPE_LIVE_CONNECT_THIN_WEBHOOK_SECRET`.

## Human checkpoint C: first real platform payout recipient

- [ ] Onboard one real Host Steward through Stripe-hosted onboarding.
- [ ] The provider supplies their own truthful identity/business and payout-bank details directly to Stripe.
- [ ] Stripe reports `configuration.recipient.capabilities.stripe_balance.stripe_transfers.status = active` before Civweave transfers eligible platform earnings to the account.
- [ ] The provider can access the Stripe-provided earnings/payout management surface.

Do not use this onboarding flow to turn a FellowFare goods seller into a platform marketplace recipient.

## Human checkpoint D: Cerbanimo attestations

A verified responsible human must deliberately establish each statement before its corresponding Civweave gate can become true:

- [ ] Compliance approval is complete for the intended platform-money launch scope.
- [ ] Jurisdiction review is complete for that launch geography.
- [ ] KYC/AML responsibilities and Stripe/Cerbanimo operating procedures are understood and ready.
- [ ] Tax collection/reporting responsibilities for Cerbanimo's own supported platform-money lanes are understood and ready.
- [ ] Current Stripe/provider terms and platform obligations have been reviewed and accepted.
- [ ] The FellowFare fulfillment/payment boundary has been reviewed and remains intentionally separate from this authorization.

If any statement is uncertain, its gate remains false.

## Guarded machine promotion after A-D

Use the GitHub Actions workflow **Promote Cloudflare Live Money v1**. It has two distinct stages so live credentials can be tested without opening the money valve.

1. Run **Stripe Live Readiness Preflight** using `STRIPE_LIVE_SECRET_KEY`. This workflow is read-only and refuses non-live keys.
2. Run **Promote Cloudflare Live Money v1** with `stage_live_credentials=true` and `enable_live_money=false`. It promotes the live Stripe key and required live webhook signing secrets to the Cloudflare Worker while all transaction gates remain fail closed.
3. Verify `providerMode=live`, `integrationDoorReady=true`, and `liveReady=false` before changing any human gate.
4. Only after checkpoints A-D are complete, run the promotion workflow again with every attestation input explicitly set true, `enable_live_money=true`, and the exact confirmation phrase requested by the workflow.
5. The workflow stages the human gates while `CIVWEAVE_MONEY_LIVE_ENABLED=false`, verifies that `live-money-disabled` is the only remaining blocker, then sets `CIVWEAVE_MONEY_LIVE_ENABLED=true` last.
6. If final readiness verification fails, the workflow automatically restores the live switch to false.
7. Run minimal acceptance transactions only for the supported platform-money lanes, such as a compute top-up or membership, and verify settlement, recipient earnings where applicable, and refund/reversal behavior.
8. Independently verify that `/api/money-edge/commerce/*` still returns `410 marketplace-checkout-disabled` after live platform money is enabled.

## Emergency control

The GitHub Actions workflow **Cloudflare Money Emergency Stop v1** can turn `CIVWEAVE_MONEY_EMERGENCY_STOP` on without changing the live Stripe credentials or the legal/operational attestations. Clearing the stop requires the workflow's explicit confirmation phrase. An active emergency stop must force `liveReady=false`.

## Ordinary deployments after activation

Normal Cloudflare code deployment deliberately does **not** rewrite Stripe platform/webhook secrets and does not source-control the live-money gates. It deploys with remote-variable preservation and checks that `liveReady` did not change merely because code was shipped. Live credential promotion and live gate changes belong only to the guarded workflows above.

## What automation must never do

Automation may verify facts reported by Stripe and Civweave, but it must not:

- invent business, owner, tax, bank, or identity information;
- mark a legal/compliance attestation true because a test passed;
- move a secret through source control or chat;
- enable live money before the live account, required webhooks, first payout recipient, and human attestations are complete;
- reinterpret `CIVWEAVE_MONEY_LIVE_ENABLED=true` as permission to re-enable FellowFare seller checkout;
- create a FellowFare goods charge, destination charge, seller transfer, or marketplace percentage fee through the platform.
