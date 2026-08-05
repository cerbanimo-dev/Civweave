# Commonweave Hosted AI Wallet and Gateway v1

Status: foundation branch only. No production payment or Gemini credentials are enabled by this change.

## Goal

Let Commonweave offer prepaid hosted Gemini access without exposing the platform credential, permitting unlimited overages, or requiring every AI task to run through a large always-on application server.

Commonweave keeps three explicit execution lanes:

1. **Local**: MiniLM, WebGPU, Ollama, or another device model. No provider charge and no Commonweave inference request.
2. **Bring your own key**: the user's provider credential is available only for the current session or stored in the passphrase-encrypted device vault. Calls may go directly from the device to the provider.
3. **Commonweave hosted**: the platform credential remains server-side. A small authorization gateway reserves wallet funds, enforces model and request limits, calls Gemini, then settles actual cost.

Gemini Live may later use provider-supported short-lived ephemeral tokens so realtime media can travel directly between the device and Gemini after one Commonweave authorization call.

## Initial plan ladder

| Plan | Price | Hosted allowance | Target provider reserve | Per-request ceiling | Hosted model ceiling |
|---|---:|---:|---:|---:|---|
| Local | $0 | $0 | 0% | $0 | Local or BYOK only |
| Thread | $5 | $2 | 40% | $0.10 | Flash-Lite / Flash |
| Loom | $15 | $7.50 | 50% | $0.25 | Flash-Lite / Flash |
| Weaver | $30 | $18 | 60% | $0.75 | Adds Pro |
| Studio | $75 | $51 | 68% | $2.00 | Adds Live |
| Node | $150 | $112.50 | 75% | $5.00 | Pro / Live, larger limits |

The hosted allowance is a user-facing spend balance. The provider reserve is an accounting target calculated from net distributable receipts. They are deliberately recorded separately so payment fees, taxes, refunds, promotions, and provider-price changes cannot hide an underfunded promise.

Top-up provider shares begin at 50% for $5, improve to 60% at $20, 70% at $50, and 75% at $100.

These values are launch hypotheses, not permanent promises. Before release they must be tested against current Gemini prices, observed request shapes, payment fees, refunds, and support costs.

## Security invariants

- The Commonweave Gemini credential is never delivered to browser, PWA, or native clients.
- Client-side encryption is allowed for a user's own BYOK credential, but not treated as protection for a shared platform credential.
- Plaintext provider secrets are forbidden in `localStorage`, IndexedDB exports, Commonweave seeds, realm handoffs, logs, analytics, and error payloads.
- Persistent BYOK storage requires the existing AES-GCM passphrase vault. Session storage is the default.
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

Issues and verifies dependency-free HMAC-SHA256 Commonweave capability tokens. These are Commonweave gateway credentials, not Google credentials.

### `lib/ai-wallet-service-v1.mjs`

Provides a small atomic file-backed ledger suitable for local development and a single-node prototype. Production should replace the storage adapter with transactional Postgres while preserving the same reservation semantics.

### `public/extensions/commonweave-device-credentials-v160.js`

Removes plaintext persistent credential storage. Legacy plaintext records are migrated into the current session and immediately removed. Users must explicitly use the encrypted vault for future persistence.

## Request lifecycle

1. Authenticate the Commonweave user and device.
2. Estimate a conservative maximum provider cost from model, context, output ceiling, tools, grounding, and modality.
3. Reserve that amount in the authoritative wallet.
4. Issue or validate a short-lived device-bound capability.
5. Send the request through the thin Gemini gateway, or mint a Gemini Live ephemeral token when that provider flow is supported.
6. Record provider usage and settle the reservation.
7. Return unused funds to the available balance.
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

- BYOK direct requests
- Device key pair and signed requests
- Gemini Live ephemeral tokens
- Capability caching with short expiry
- Offline/local fallback when hosted authorization is unavailable

### Gate 5: production hardening

- Move ledger to transactional Postgres
- Concurrency and replay tests
- Refund and chargeback workflows
- Provider price-card versioning
- Security review and secret-scanning checks
- Load shedding, queues, and reserve alarms

## Deferred decisions

The foundation intentionally does not choose a payment processor, persist personally identifying billing data, enable production Gemini credentials, expose wallet mutation routes, or promise that the draft plan economics are profitable. Those decisions require current provider pricing, legal and tax review, and an authenticated Commonweave account model.
