# Civweave live-money machine readiness

Status after the 2026-08-13 FellowFare fulfillment-economy boundary pass.

## Green machine-side invariants

- Sandbox Stripe Checkout has completed successfully for supported platform-money lanes.
- Sandbox refund handling has completed successfully.
- The connected-account snapshot webhook has delivered verified refund/payment-state events into D1 with no processing error.
- Snapshot webhook receipt processing is retry-safe: failed processing can be reclaimed on Stripe retry, processed duplicates do not reapply money state, fresh concurrent duplicates are suppressed, and stale processing claims can recover.
- Provider mode mismatch fails closed.
- Unpaid Checkout completion does not settle or credit a node.
- Top-up idempotency keys cannot be reused for a materially different request.
- Refund cumulative amounts debit node credit only by the new delta.
- Dispute creation/funds-withdrawn events debit node credit only by the new delta and do not double-apply.
- Node enrollment remains proof-of-key with short-lived single-use grants.
- Platform Checkout and separate Stripe transfers remain available for node top-ups/memberships and eligible Host Steward earnings.
- Stripe platform credentials remain Cloudflare-core-only.
- Current live-money gates remain false.

## FellowFare payment boundary

FellowFare seller commerce is no longer a Stripe marketplace rail.

- `/api/money-edge/commerce/*` returns HTTP `410` with `marketplace-checkout-disabled`.
- The production Stripe entry no longer exposes `handleCommerceApiRequest`.
- Browser marketplace sale distribution, marketplace Stripe transfer instructions, and `recordSale` fail closed.
- Physical/community goods use seller-direct payment methods outside FellowFare settlement.
- Goods cannot use Acorns or Buttons as a price.
- Services, tutoring, and learning use Acorn/Button fulfillment burn.
- Fulfilled Acorns/Buttons are not transferred to the provider.
- FellowFare does not require or publish a USD exchange rate for Acorns/Buttons.
- The daily reward system selects three quest buckets and issues fixed platform rewards.
- Every 100 cumulative Acorns or Buttons fulfilled awards the configured same-asset milestone bonus.
- Legacy Stripe commerce settlement/refund/dispute handlers remain only so already-created marketplace payments can safely finish or unwind.
- The December 1 compute-reserve distribution remains available because it is a platform-reserve payout, not seller-sale settlement.

See `docs/finance/fellowfare-fulfillment-economy-v1.md` for the canonical marketplace contract.

## Automation prepared for live platform money

Manual GitHub Actions workflow:

```text
Stripe Live Readiness Preflight
```

Staged secret expected:

```text
STRIPE_LIVE_SECRET_KEY
```

The preflight is intentionally read-only. It refuses non-live Stripe server keys and checks the platform capabilities required by the currently enabled Civweave money lanes. It must not treat marketplace-recipient inventory or a FellowFare commerce fee as a launch prerequisite.

Live activation applies to supported platform-money lanes only. It must not change FellowFare's seller-payment boundary.

## Human work still required

The currently connected ChatGPT Stripe account may not be the final verified production account. Real-money activation still requires the verified Cerbanimo LLC live Stripe account, its live server credential, required live event destinations/signing secrets, an eligible first platform payout recipient, and the explicit compliance/jurisdiction/KYC-AML/tax/provider-terms attestations in `docs/finance/live-money-human-gate.md`.

The FellowFare boundary must be tested independently after activation:

```text
GET/POST /api/money-edge/commerce/* -> 410 marketplace-checkout-disabled
```

Enabling platform money is never permission to re-enable FellowFare seller checkout.
