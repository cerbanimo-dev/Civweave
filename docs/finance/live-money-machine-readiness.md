# Civweave live-money machine readiness

Status after the 2026-08-11 payment hardening pass.

## Green machine-side invariants

- Sandbox connected-account direct charge completed successfully.
- Civweave application fee verified at 15%.
- Sandbox refund completed successfully.
- Connected-account snapshot webhook delivered a verified `charge.refunded` event into D1 with no processing error.
- Snapshot webhook receipt processing is retry-safe: failed processing can be reclaimed on Stripe retry, processed duplicates do not reapply money state, fresh concurrent duplicates are suppressed, and stale processing claims can recover.
- Provider mode mismatch fails closed.
- Unpaid Checkout completion does not settle or credit a node.
- Top-up idempotency keys cannot be reused for a materially different request.
- Refund cumulative amounts debit node credit only by the new delta.
- Dispute creation/funds-withdrawn events debit node credit only by the new delta and do not double-apply.
- Node enrollment remains proof-of-key with short-lived single-use grants.
- Operator payout onboarding and payout-detail management use Stripe-hosted surfaces.
- Stripe platform credentials remain Cloudflare-core-only.
- Interactive Connect sample remains disabled in production.
- Current live-money gates remain false and provider remains sandbox.

## Automation prepared for live mode

Manual GitHub Actions workflow:

```text
Stripe Live Readiness Preflight
```

Staged secret expected:

```text
STRIPE_LIVE_SECRET_KEY
```

The preflight is intentionally read-only. It refuses non-live Stripe server keys, authenticates against Stripe, checks the live connected-account snapshot webhook at the canonical Worker URL, queries Civweave money-edge status, and aborts if `liveReady` is unexpectedly true. It performs no Stripe mutation, no Cloudflare deployment, and no live-money gate change.

See `docs/finance/live-money-human-gate.md` for the remaining human-only checkpoints.
