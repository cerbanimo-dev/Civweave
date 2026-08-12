# Civweave live-money machine readiness

Status after the 2026-08-12 marketplace payout hardening pass.

## Green machine-side invariants

- Sandbox Stripe Checkout has completed successfully.
- Sandbox refund handling has completed successfully.
- The connected-account snapshot webhook has delivered verified refund/payment-state events into D1 with no processing error.
- Snapshot webhook receipt processing is retry-safe: failed processing can be reclaimed on Stripe retry, processed duplicates do not reapply money state, fresh concurrent duplicates are suppressed, and stale processing claims can recover.
- Provider mode mismatch fails closed.
- Unpaid Checkout completion does not settle or credit a node.
- Top-up idempotency keys cannot be reused for a materially different request.
- Refund cumulative amounts debit node credit only by the new delta.
- Dispute creation/funds-withdrawn events debit node credit only by the new delta and do not double-apply.
- Node enrollment remains proof-of-key with short-lived single-use grants.
- Platform Checkout and separate Stripe transfers are already used for node top-ups/memberships; compute backing stays in the platform reserve until earned host shares are transferred.
- New Host Steward payout accounts are now modeled as Accounts V2 marketplace **recipient** accounts rather than merchant/direct-charge accounts.
- New recipient accounts request `configuration.recipient.capabilities.stripe_balance.stripe_transfers`, use the Express dashboard, and assign pricing plus negative-balance liability to Cerbanimo.
- The production provider retains a compatibility read/onboarding path for older sandbox accounts while all newly created accounts use the recipient model.
- Product/service commerce uses the merged Cerbanimo contribution distribution contract: contributor-weighted immediate settlement and a 1% Cerbanimo split fee added on top of the listed USD price.
- Product/service proceeds and the 1% split fee remain excluded from the December 1 reserve pool.
- Stripe platform credentials remain Cloudflare-core-only.
- Current live-money gates remain false.

## Automation prepared for live mode

Manual GitHub Actions workflow:

```text
Stripe Live Readiness Preflight
```

Staged secret expected:

```text
STRIPE_LIVE_SECRET_KEY
```

The preflight is intentionally read-only. It refuses non-live Stripe server keys and checks:

- live Stripe authentication and platform charge capability;
- the live payment snapshot webhook and required payment/refund/dispute events;
- the committed Accounts V2 marketplace-recipient contract;
- separate-charges-and-transfers support;
- the 1% commerce split-fee-on-top invariant;
- current connected-account inventory for legacy liability shapes;
- Civweave money-edge status, while refusing to run if `liveReady` is unexpectedly already true.

It performs no Stripe mutation, no Cloudflare deployment, and no live-money gate change.

## Human work still required

The currently connected ChatGPT Stripe account is the Cerbanimo sandbox. Real-money activation still requires the verified Cerbanimo LLC live Stripe account, its live server credential, live event destinations/signing secrets, the first real recipient onboarding, and the explicit compliance/jurisdiction/KYC-AML/tax/provider-terms attestations in `docs/finance/live-money-human-gate.md`.
