# Civweave live-money human gate

Machine-side payment plumbing may advance through sandbox testing, read-only live preflight, deployment, credential staging, and fail-closed hardening. This checklist marks the boundary where a verified human must supply factual business information or make an explicit legal/operational attestation.

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
- [ ] Confirm Stripe shows the platform as able to create live charges.
- [ ] Create or obtain a live server-side restricted key with only the permissions Civweave actually needs. Never commit or paste it into chat.
- [ ] Save it as GitHub Actions secret `STRIPE_LIVE_SECRET_KEY` for the read-only preflight and guarded promotion. Do not replace the active Cloudflare `STRIPE_SECRET_KEY` manually.

## Human checkpoint B: live event destinations

Create live-mode equivalents of the sandbox payment destination and the connected-account requirements/capability destination. Keep their signing secrets separate.

### Marketplace payment snapshots

Endpoint:

```text
https://civweave-core.cerbanimo.workers.dev/api/money-edge/webhooks/stripe
```

Events:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
charge.refunded
charge.dispute.created
charge.dispute.funds_withdrawn
```

- [ ] Destination is enabled in live mode.
- [ ] Its live signing secret is stored as GitHub Actions secret `STRIPE_LIVE_CONNECT_WEBHOOK_SECRET`.

### Accounts V2 requirements/capabilities

Live thin-event endpoint:

```text
https://civweave-core.cerbanimo.workers.dev/api/connect-demo/webhooks/stripe-thin
```

Use a live-mode Stripe event destination for the Accounts V2 recipient accounts that Civweave creates for Host Stewards and other payout recipients.

- [ ] Requirements-change events are enabled for connected Accounts V2 objects.
- [ ] Recipient capability changes, especially `configuration.recipient.capabilities.stripe_balance.stripe_transfers`, are observable by Civweave.
- [ ] Its signing secret is stored separately as GitHub Actions secret `STRIPE_LIVE_CONNECT_THIN_WEBHOOK_SECRET`.

## Human checkpoint C: first real payout recipient

- [ ] Onboard one real Host Steward through Stripe-hosted onboarding.
- [ ] The provider supplies their own truthful identity/business and payout-bank details directly to Stripe.
- [ ] The connected account uses Civweave's Accounts V2 marketplace recipient configuration: Express dashboard, Cerbanimo-managed pricing, and Cerbanimo negative-balance liability.
- [ ] Stripe reports `configuration.recipient.capabilities.stripe_balance.stripe_transfers.status = active` before Civweave transfers earnings to the account.
- [ ] The provider can access the Stripe-provided earnings/payout management surface.

## Human checkpoint D: Cerbanimo attestations

A verified responsible human must deliberately establish each statement before its corresponding Civweave gate can become true:

- [ ] Compliance approval is complete for the intended launch scope.
- [ ] Jurisdiction review is complete for the launch geography.
- [ ] KYC/AML responsibilities and Stripe/Cerbanimo operating procedures are understood and ready.
- [ ] Tax collection/reporting responsibilities for Cerbanimo's fees and the intended marketplace model are understood and ready.
- [ ] Current Stripe/provider terms and platform obligations have been reviewed and accepted.

If any statement is uncertain, its gate remains false.

## Guarded machine promotion after A-D

Use the GitHub Actions workflow **Promote Cloudflare Live Money v1**. It has two distinct stages so live credentials can be tested without opening the money valve.

1. Run **Stripe Live Readiness Preflight** using `STRIPE_LIVE_SECRET_KEY`. This workflow is read-only and refuses non-live keys.
2. Run **Promote Cloudflare Live Money v1** with `stage_live_credentials=true` and `enable_live_money=false`. It promotes the live Stripe key and both live webhook signing secrets to the Cloudflare Worker while all transaction gates remain fail closed.
3. Verify `providerMode=live`, `integrationDoorReady=true`, and `liveReady=false` before changing any human gate.
4. Only after checkpoints A-D are complete, run the promotion workflow again with every attestation input explicitly set true, `enable_live_money=true`, and the exact confirmation phrase requested by the workflow.
5. The workflow stages the human gates while `CIVWEAVE_MONEY_LIVE_ENABLED=false`, verifies that `live-money-disabled` is the only remaining blocker, then sets `CIVWEAVE_MONEY_LIVE_ENABLED=true` last.
6. If final readiness verification fails, the workflow automatically restores the live switch to false.
7. Run one minimal real acceptance transaction and verify the current economic contract end to end:
   - buyer is charged the listed commerce amount plus the 1% Cerbanimo split fee when testing a product/service sale;
   - the full listed amount remains available for contributor-weighted payout;
   - the 1% fee does not enter the December 1 pool;
   - the paid charge is verified by webhook and recorded idempotently;
   - recipient transfers use the verified charge as their source transaction where applicable;
   - the single commerce host fee follows the canonical same-node/cross-node host allocation contract;
   - a small refund correctly reverses/debits the associated settlement without duplicate application.

## Emergency control

The GitHub Actions workflow **Cloudflare Money Emergency Stop v1** can turn `CIVWEAVE_MONEY_EMERGENCY_STOP` on without changing the live Stripe credentials or the legal/operational attestations. Clearing the stop requires the workflow's explicit confirmation phrase. An active emergency stop must force `liveReady=false`.

## Ordinary deployments after activation

Normal Cloudflare code deployment deliberately does **not** rewrite Stripe platform/webhook secrets and does not source-control the live-money gates. It deploys with remote-variable preservation and checks that `liveReady` did not change merely because code was shipped. Live credential promotion and live gate changes belong only to the guarded workflows above.

## What automation must never do

Automation may verify facts reported by Stripe and Civweave, but it must not:

- invent business, owner, tax, bank, or identity information;
- mark a legal/compliance attestation true because a test passed;
- move a secret through source control or chat;
- enable live money before the live account, webhooks, first payout recipient, and human attestations are complete.