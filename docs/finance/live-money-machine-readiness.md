# Civweave live-money machine readiness

Status after the 2026-08-14 FellowFare 5% service-fee and Territory Stewardship passes.

## Green machine-side invariants

- Existing platform Checkout/refund/idempotency protections remain intact.
- Platform Checkout and separate transfers remain limited to platform-owned lanes such as node top-ups, memberships, eligible Host Node Steward earnings, eligible Territory Stewardship earnings, and reserve distributions.
- Stripe platform credentials remain Cloudflare-core-only.
- Live-money gates remain fail-closed until explicitly activated.
- Territory Stewardship is a second-stage subdivision only of the pre-existing Cerbanimo cash share. It does not reduce a provider, Host Node Steward, contributor, or system/compute share.

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
- The application fee first stage remains **50% facilitating Host Node Steward / 50% pre-existing Cerbanimo bucket**.
- The Cerbanimo half then receives the Territory second stage: **50% Cerbanimo Global / 50% Territory Stewardship**.
- At the default 5% application fee, final economic shares are **2.5% of the sale to the Host Node Steward, 1.25% to Cerbanimo Global, and 1.25% to Territory Stewardship**. The provider's economic position is unchanged by the second stage.
- The active Hub Node is bound into server-created Stripe Price metadata before checkout. Checkout reads that metadata instead of accepting a buyer-selected payout destination.
- The Hub's canonical territory is resolved separately by Cloudflare core, so buyer input cannot redirect the Territory Steward recipient.
- The server retrieves the connected-account Price and verifies FellowFare listing/kind/Hub metadata before checkout.
- No buyer-supplied amount is trusted.
- When Stripe emits `application_fee.created`, Cloudflare core records the existing Host Node Steward first-stage entitlement, then records the Territory subdivision of the Cerbanimo half.
- If Stripe reports that the platform balance is not available yet, eligible transfer settlements remain pending rather than losing either Steward share. `balance.available` retries pending Host and Territory transfers.
- `application_fee.refunded` recalculates the Host Node Steward entitlement against the net retained fee and proportionally reduces the Territory Stewardship entitlement. Refunds after payout reverse the applicable transfer where possible.
- No destination charge, transfer destination, or separate seller transfer is used to pay the service provider.
- FellowFare does not collect provider gross proceeds and does not route seller proceeds.

Legacy browser sale-distribution methods remain fail-closed. Legacy Stripe settlement/refund/dispute handlers remain only so transactions created under the retired model can finish or unwind safely. The December 1 compute-reserve distribution remains separate and available, with only its former 5% Cerbanimo bucket subdivided into 2.5% Cerbanimo Global and 2.5% Territory Stewardship.

## Territory registry and payout state

Migration `0009_territory_stewardship.sql` creates the canonical territory hierarchy, office appointments, and settlement ledger. Existing Hub Nodes start with no territory assignment rather than being guessed into a jurisdiction.

The money edge exposes:

```text
GET  /api/money-edge/territories
POST /api/money-edge/territories/node
```

The assignment endpoint requires the Hub's normal signed money-edge request. A Hub resolves the most-specific active appointed territory first and then walks its parent hierarchy.

An appointment can be active while personal payout remains blocked. Territory money is held when:

- the Hub has no territory assignment;
- the territory/parent chain has no active appointment;
- the Stewardship Agreement has not been accepted;
- legal identity, tax, or payment-provider onboarding is incomplete; or
- a payout account is not ready.

These states reserve the Territory Stewardship Share for the office rather than silently moving it back to Cerbanimo Global.

## Automation prepared for live mode

The existing read-only Stripe live preflight and guarded Cloudflare live-money workflows remain the activation path. Production readiness must include the merchant/card-payments capability needed by FellowFare service providers and the recipient capabilities required by Host Node Stewards and payout-ready Territory Stewards.

The live snapshot webhook preflight requires `application_fee.created`, `application_fee.refunded`, and `balance.available`. Missing any of them blocks readiness because Host Node Steward and Territory Stewardship fee entitlements cannot be safely maintained without settlement, refund, and pending-balance retry events.

## Human work still required

Real-money activation still requires the verified Cerbanimo LLC live Stripe account, live server credential, required event destinations/signing secrets, real connected-account onboarding, and explicit compliance/jurisdiction/KYC-AML/tax/provider-terms attestations in `docs/finance/live-money-human-gate.md`.

Territory personal payout additionally requires the signed stewardship resolution, the applicable signed Stewardship Agreement, verified legal/tax identity, appropriate worker/payment classification, and payout onboarding. The repository seeds the offices as appointed but `pending-signature` and `held-pending-onboarding`; code does not pretend the legal or KYC work has already happened.

Acceptance must independently confirm:

```text
/api/money-edge/commerce/* -> 410 marketplace-checkout-disabled
/api/fellowfare/direct-commerce/* -> service/learning/tutoring only
/api/money-edge/territories -> public registry without payout account secrets
/api/money-edge/territories/node -> signed Hub territory assignment only
```

and verify one provider-owned direct charge end to end, including the 5% FellowFare application fee, unchanged 2.5% Host Node Steward economic share, 1.25% Cerbanimo Global / 1.25% Territory Stewardship second stage, a held Territory case, a payout-ready Territory case, pending-balance retry, refund reversal, and absence of a seller transfer.
