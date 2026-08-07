# Civweave Hosted AI Wallet and Gateway v1

Status: foundation branch only. No production payment or Gemini credentials are enabled by this change.

## Goal

Let Civweave offer prepaid hosted Gemini access without exposing the platform credential, permitting unlimited overages, or requiring every AI task to run through a large always-on application server.

Civweave keeps three explicit execution lanes:

1. **Local**: MiniLM, WebGPU, Ollama, or another device model. No provider charge and no Civweave inference request.
2. **Bring your own key**: handled by Civweave's current device credential and settings subsystem. The hosted wallet does not read, store, migrate, or authorize BYOK secrets.
3. **Civweave hosted**: the platform credential remains server-side. A small authorization gateway reserves wallet funds, enforces model and request limits, calls Gemini, then settles actual cost.

Gemini Live may later use provider-supported short-lived ephemeral tokens so realtime media can travel directly between the device and Gemini after one Civweave authorization call.

## Initial plan ladder

| Plan | Price | Hosted allowance | Target provider reserve | Per-request ceiling | Hosted model ceiling |
|---|---:|---:|---:|---:|---|
| Local | $0 | $0 | 0% | $0 | Local or BYOK only |
| Thread | $5 | $2 | 40% | $0.10 | Flash-Lite / Flash |
| Loom | $15 | $7.50 | 50% | $0.25 | Flash-Lite / Flash |
| Weaver | $30 | $18 | 60% | $0.75 | Adds Pro |
| Studio | $75 | $51 | 68% | $2.00 | Adds Live |
| Node | $150 | $112.50 | 75% | $5.00 | Pro / Live, larger limits |

The hosted allowance is a user-facing spend balance. The provider reserve is an accounting target calculated from net distributable receipts. They are recorded separately so payment fees, taxes, refunds, promotions, and provider-price changes cannot hide an underfunded promise.

Top-up provider shares begin at 50% for $5, improve to 60% at $20, 70% at $50, and 75% at $100.

These values are launch hypotheses, not permanent promises. Before release they must be tested against current provider prices, observed request shapes, payment fees, refunds, taxes, and support costs.

## Hosted-wallet security invariants

- The Civweave platform Gemini credential is never delivered to browser, PWA, or native clients.
- The hosted wallet never reads or persists the user's BYOK credential. Device credential policy remains owned by the current main-branch settings subsystem.
- Hosted requests reserve the maximum allowed cost before contacting Gemini.
- Settlement may charge less than the reservation, never more. A higher actual provider cost is a reconciliation fault and must stop the request family for investigation.
- Every credit event has an idempotent external source ID, such as a payment invoice or manually approved adjustment.
- Capability tokens are short-lived, device-bound, model-bound, cost-bound, and invalidated whenever the authoritative wallet version changes.
- Subscription cancellation stops new capability issuance. It does not rewrite historical ledger entries.
- No automatic customer overages in v1.

## Foundation modules

### `lib/ai-wallet-policy-v1.mjs`

Contains the versioned plan catalog, subscription and top-up allocation calculations, wallet reservation rules, settlement, cancellation, daily limits, and model gates.

### `lib/ai-capability-token-v1.mjs`

Issues and verifies dependency-free HMAC-SHA256 Civweave capability tokens. These are Civweave gateway credentials, not Google credentials.

### `lib/ai-wallet-service-v1.mjs`

Provides an atomic file-backed ledger suitable for local development and a single-node prototype.

### `lib/ai-wallet-postgres-v1.mjs`

Provides the Neon-compatible transactional adapter for hosted multi-instance operation. Database functions enforce row locking, replay protection, reservation ceilings, append-only accounting, and device revocation.

## Request lifecycle

1. Authenticate the Civweave user and registered device.
2. Estimate a conservative maximum provider cost from model, context, output ceiling, tools, grounding, and modality.
3. Reserve that amount in the authoritative wallet.
4. Issue or validate a short-lived device-bound capability.
5. Send the request through the thin Gemini gateway, or mint a Gemini Live ephemeral token when that provider flow is supported.
6. Record provider usage and settle the reservation.
7. Release the unused portion of the reservation.
8. Append an immutable usage event containing no prompt content or provider secret.

If the provider response cannot be reconciled, cancel only when no provider work occurred. Otherwise quarantine the reservation for review rather than silently returning funds.

## Rollout gates

### Gate 1: accounting core

- Plan and top-up catalog
- Idempotent credits
- Reservations, settlement, cancellation
- Daily and per-request limits
- Unit tests and ledger invariants

### Gate 2: identity and payments

- Select payment processor
- Verify signed webhooks
- Map invoices and refunds to ledger events
- Add subscription state and entitlement expiry
- Add an administrative reserve dashboard

### Gate 3: hosted Gemini gateway

- Store platform credential only in deployment secret storage
- Add request estimator and model policy router
- Reserve before provider call
- Stream without logging prompt bodies
- Reconcile usage and expose customer-visible receipts
- Add global and per-plan kill switches

### Gate 4: direct-device optimizations

- Preserve current main-branch BYOK behavior without routing its secrets through the wallet
- Device key pair and signed requests
- Gemini Live ephemeral tokens
- Capability caching with short expiry
- Offline/local fallback when hosted authorization is unavailable

### Gate 5: production hardening

- Concurrency and replay tests
- Refund and chargeback workflows
- Provider price-card versioning
- Security review and secret-scanning checks
- Load shedding, queues, and reserve alarms

## Deferred decisions

The foundation intentionally does not choose a payment processor, persist personally identifying billing data, enable production Gemini credentials, expose public wallet mutation authority, or promise that the draft plan economics are profitable. Those decisions require current provider pricing, legal and tax review, and an authenticated Civweave account model.
