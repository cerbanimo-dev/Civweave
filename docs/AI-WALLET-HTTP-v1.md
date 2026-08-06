# Civweave hosted AI wallet HTTP boundary v1

Status: foundation-only, disabled by default, no live payment processor or platform Gemini credential.

## Safety boundary

The hosted wallet activates only when `AI_WALLET_ENABLED=1` and all four independent secrets contain at least 32 bytes. Missing configuration produces a 503 response and a redacted health status. The wallet routes are evaluated before the legacy host-node bearer gate because wallet sessions use a separate, device-bound identity token.

The permanent Gemini credential is never returned to the PWA. Ordinary hosted inference will later reserve wallet funds, call Gemini inside the gateway, settle from measured provider usage, and stream only model output to the device.

## Environment

- `AI_WALLET_CAPABILITY_SECRET`: signs short-lived model and spend capabilities.
- `AI_WALLET_AUTH_SECRET`: verifies short-lived wallet sessions issued by the future account service.
- `AI_WALLET_PAYMENT_SECRET`: verifies canonical payment events.
- `AI_WALLET_INTERNAL_SECRET`: protects settlement calls made by the inference gateway.

These values must be independent. Rotating the capability secret revokes outstanding capabilities. Rotating the auth secret revokes wallet sessions. Payment and internal secrets should be rotated through overlapping deployment windows once production adapters exist.

## Public catalog

`GET /api/ai/plans`

Returns the versioned plan ladder and whether hosted wallets are currently enabled. It never returns secret or account data.

## User wallet routes

All wallet user routes require `Authorization: Bearer <CWAUTH1 session>`. A session is HMAC signed, expires, includes `wallet:user`, and is bound to one device identifier.

- `GET /api/ai/wallet`: returns the authenticated user's redacted wallet.
- `POST /api/ai/wallet/capability`: issues a short-lived capability restricted to the session device, current plan, approved models, current wallet version, and request ceiling.
- `POST /api/ai/wallet/reservations`: requires both the wallet session and `x-civweave-ai-capability`; reserves the maximum possible request cost.

Reservations expire after fifteen minutes if the gateway never settles them. The expiry is longer than the current hosted-provider timeout and prevents abandoned holds from freezing a balance.

The client cannot credit, debit, cancel, or settle its own wallet.

## Internal reservation control

- `POST /api/ai/wallet/reservations/:id/settle`
- `POST /api/ai/wallet/reservations/:id/cancel`

Both require `x-civweave-internal-secret`. Settlement is used after measured provider usage and cannot exceed the reserved maximum. Cancellation is reserved for the trusted gateway when preflight or provider execution fails before billable work completes.

## Canonical payment webhook

`POST /api/ai/wallet/payments/webhook`

This endpoint accepts Civweave's canonical payment event, not a processor-specific Stripe, Google Play, or app-store payload. A future adapter must verify the processor's native signature and translate it into this schema.

The raw body is signed with:

```text
x-civweave-payment-signature: t=<unix-seconds>,v1=<hex-hmac-sha256>
HMAC input: <timestamp>.<raw request body>
```

The default replay window is five minutes. Event IDs are idempotent and permanently bound to one user.

Supported foundation events:

- `subscription.paid`: validates the exact plan price and credits the advertised hosted allowance.
- `topup.paid`: requires an existing paid plan and applies the configured top-up band.
- `subscription.refunded`: removes allowance and downgrades to Local.
- `topup.refunded`: removes the specified hosted allowance.
- `payment.chargeback`: removes the specified hosted allowance.

Refunds never consume an active reservation. Any amount that cannot be recovered from unreserved balance becomes wallet debt, blocks new capabilities, and is repaid before later credits become spendable.

## Persistence

The current implementation is an atomic, mode-0600 JSON ledger suitable for one development host process. Mutations are serialized to prevent lost updates. It is not the final multi-instance production store.

Before horizontal deployment, move wallets, payment-source events, reservations, and usage records into Postgres transactions with row locking and unique event constraints.

## Not yet enabled

- No checkout or subscription UI.
- No processor-specific webhook adapter.
- No account service issuing production wallet sessions.
- No Gemini platform credential.
- No hosted inference route.
- No Gemini Live ephemeral-token minting.
- No automatic Google credit purchase.
