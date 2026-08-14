# Civweave live-money machine readiness

Status after the 2026-08-14 FellowFare 5% service-fee split pass.

## Green machine-side invariants

- Existing platform Checkout/refund/idempotency protections remain intact.
- Platform Checkout and separate transfers remain limited to platform-owned lanes such as node top-ups, memberships, and eligible Host Steward earnings.
- Stripe platform credentials remain Cloudflare-core-only.
- Live-money gates remain fail-closed until explicitly activated.

## FellowFare three-rail boundary

### Physical/community goods

- Goods use seller-direct payment methods outside FellowFare settlement.
- Goods cannot have Acorn/Button prices.
- FellowFare does not collect, route, split, escrow, or take a percentage of a goods purchase.
- The old `/api/money-edge/commerce/*` platform-charge marketplace route returns `410 marketplace-checkout-disabled`.

### Acorns and Buttons

- Services, tutoring, and learning may use Acorn/Button fulfillment burn.
- Fulfilled units are not transferred to the provider.
- FellowFare publishes no required USD exchange rate for Acorns/Buttons.
- Each day selects three quest buckets with fixed rewards.
- Every 100 cumulative units fulfilled awards the configured same-asset milestone bonus.

### USD services, tutoring, and learning

- Production routes are exposed under `/api/fellowfare/direct-commerce/*`.
- Only `service`, `learning`, and `tutoring` kinds are accepted.
- Providers use Accounts v2 merchant configuration with full Stripe dashboard and card-payments capability.
- Stripe Products/Prices live on the connected provider account.
- Checkout is created with the connected account as charge owner.
- FellowFare receives `application_fee_amount` only.
- Default FellowFare fee is **5% / 500 bps**, configurable with `CIVWEAVE_FELLOWFARE_SERVICE_FEE_BPS`.
- The application fee is split **50/50** between the facilitating Hub Steward and Cerbanimo, making the default economic shares **2.5% of the service sale each**.
- The active Hub Node is bound into server-created Stripe Price metadata before checkout. Checkout reads that metadata instead of accepting a buyer-selected payout destination.
- The server retrieves the connected-account Price and verifies FellowFare listing/kind/Hub metadata before checkout.
- No buyer-supplied amount is trusted.
- When Stripe emits `application_fee.created`, Cloudflare core transfers the Host Steward half from the platform fee balance to that Hub's registered payout account and records the settlement in D1.
- `application_fee.refunded` proportionally reverses the Host Steward transfer for partial or full fee refunds.
- No destination charge, transfer destination, or separate seller transfer is used to pay the service provider.
- FellowFare does not collect provider gross proceeds and does not route seller proceeds.

Legacy browser sale-distribution methods remain fail-closed. Legacy Stripe settlement/refund/dispute handlers remain only so transactions created under the retired model can finish or unwind safely. The December 1 compute-reserve distribution remains separate and available.

## Automation prepared for live mode

The existing read-only Stripe live preflight and guarded Cloudflare live-money workflows remain the activation path. Production readiness must include the merchant/card-payments capability needed by FellowFare service providers in addition to the platform recipient capabilities used by Host Stewards.

The live snapshot webhook preflight now requires both `application_fee.created` and `application_fee.refunded`. Missing either event blocks readiness because the 50/50 Steward/Cerbanimo fee split cannot be safely maintained without settlement and refund events.

## Human work still required

Real-money activation still requires the verified Cerbanimo LLC live Stripe account, live server credential, required event destinations/signing secrets, real connected-account onboarding, and explicit compliance/jurisdiction/KYC-AML/tax/provider-terms attestations in `docs/finance/live-money-human-gate.md`.

Acceptance must independently confirm:

```text
/api/money-edge/commerce/* -> 410 marketplace-checkout-disabled
/api/fellowfare/direct-commerce/* -> service/learning/tutoring only
```

and verify one provider-owned direct charge end to end, including the 5% FellowFare application fee, the 50/50 Host Steward/Cerbanimo fee split, a refund reversal test, and absence of a seller transfer.