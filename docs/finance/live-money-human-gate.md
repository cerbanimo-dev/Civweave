# Civweave live-money human gate

Machine-side payment plumbing may advance through sandbox testing, read-only live preflight, deployment, and fail-closed hardening. This checklist marks the boundary where a verified human must supply factual business information or make an explicit legal/operational attestation.

## Keep these gates false until every item below is complete

```text
CIVWEAVE_MONEY_LIVE_ENABLED=false
CIVWEAVE_MONEY_COMPLIANCE_APPROVED=false
CIVWEAVE_MONEY_JURISDICTION_APPROVED=false
CIVWEAVE_MONEY_KYC_AML_READY=false
CIVWEAVE_MONEY_TAX_REPORTING_READY=false
CIVWEAVE_MONEY_TERMS_APPROVED=false
```

No automation may infer or self-approve those statements.

## Human checkpoint A: Stripe live platform

- [ ] Switch from the Cerbanimo sandbox to the actual Cerbanimo LLC live Stripe account.
- [ ] Complete Stripe's live business/entity verification using truthful company, representative, ownership, support, bank, and tax information.
- [ ] Confirm Stripe shows the platform as able to operate in live mode.
- [ ] Create or obtain a live server-side Stripe key. Never commit or paste it into chat.
- [ ] Save it as GitHub Actions secret `STRIPE_LIVE_SECRET_KEY` for the read-only preflight. Do not replace the active sandbox `STRIPE_SECRET_KEY` yet.

## Human checkpoint B: live event destinations

Create live-mode equivalents of the two sandbox destinations. Keep their secrets separate.

### Connected-account payment snapshots

Endpoint:

```text
https://civweave-core.glaedn.workers.dev/api/money-edge/webhooks/stripe
```

Scope: **Connected accounts**
Payload: **Snapshot**
Events:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
charge.refunded
charge.dispute.created
charge.dispute.funds_withdrawn
```

- [ ] Destination is enabled in live mode.
- [ ] Signing secret is stored outside source control for later promotion.

### Accounts V2 thin requirements/capabilities

Endpoint:

```text
https://civweave-core.glaedn.workers.dev/api/connect-demo/webhooks/stripe-thin
```

Payload: **Thin**
Events:

```text
v2.core.account[requirements].updated
v2.core.account[configuration.merchant].capability_status_updated
v2.core.account[configuration.customer].capability_status_updated
```

- [ ] Destination is enabled in live mode with the Stripe-required scope for the Accounts V2 objects in use.
- [ ] Signing secret is stored separately from the snapshot signing secret.

## Human checkpoint C: first real host-node provider

- [ ] Onboard one real host-node provider through Stripe-hosted onboarding.
- [ ] Provider supplies their own truthful identity/business and payout-bank details directly to Stripe.
- [ ] Stripe reports merchant card-payment capability active before Civweave charges through that account.
- [ ] Provider can access the Stripe-provided dashboard/payout management surface.

## Human checkpoint D: Cerbanimo attestations

A verified responsible human must deliberately establish each statement before its corresponding Civweave gate can become true:

- [ ] Compliance approval is complete for the intended launch scope.
- [ ] Jurisdiction review is complete for the launch geography.
- [ ] KYC/AML responsibilities and Stripe/Cerbanimo operating procedures are understood and ready.
- [ ] Tax collection/reporting responsibilities for Cerbanimo's fees and the intended commerce model are understood and ready.
- [ ] Current Stripe/provider terms and platform obligations have been reviewed and accepted.

If any statement is uncertain, its gate remains false.

## Machine checkpoint after A-D

Only after the human checkpoints are complete:

1. Run **Stripe Live Readiness Preflight** using `STRIPE_LIVE_SECRET_KEY`. This workflow is read-only and refuses non-live keys.
2. Promote live Stripe credentials/signing secrets to the Cloudflare Worker while `CIVWEAVE_MONEY_LIVE_ENABLED=false` and the attestation gates still fail closed.
3. Verify `providerMode=live`, `integrationDoorReady=true`, and `liveReady=false` before changing any live-money gate.
4. Deliberately set the attestation gates based only on completed human attestations.
5. Set `CIVWEAVE_MONEY_LIVE_ENABLED=true` last.
6. Run one minimal real acceptance transaction, verify the 15% application fee, webhook receipt, D1 settlement, node delivery, refund, and payout readiness.
7. Keep the emergency stop available throughout launch.
