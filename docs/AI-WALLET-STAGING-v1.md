# Commonweave hosted AI staging preview v1

This preview exercises device registration, wallet sessions, test credits, capability issuance, reservations, streamed output, settlement, released funds, ledger receipts, and device revocation without contacting a payment processor or AI provider.

## Safety boundary

The preview is disabled unless all of the following are true:

- `AI_WALLET_ENABLED=1`
- `AI_WALLET_STAGING_ENABLED=1`
- the wallet signing secrets are configured
- `AI_WALLET_STAGING_SECRET` contains at least 32 bytes
- Postgres wallet storage is active

File storage is rejected by default. `AI_WALLET_STAGING_ALLOW_FILE=1` exists only for local tests and single-process development.

Every staging user ID and test-credit source ID must begin with `staging:`. The preview cannot credit a production-shaped user ID. The staging key is separate from the wallet, payment, internal, and provider secrets.

## Preview console

Open `/ai-wallet-preview-v1.html` on the host node.

The console derives its initial user ID from `commonweave.anarchadia.citizen-console.v139.passportId` when available. It registers a device-bound wallet session and stores the session and staging key in `sessionStorage`, never persistent browser storage.

## Routes

- `GET /api/ai/staging/status`: redacted readiness and preview URL.
- `POST /api/ai/staging/session`: staging-key protected device registration and renewable wallet session.
- `POST /api/ai/staging/credits`: staging-key protected test credit. No processor event is accepted.
- `GET /api/ai/staging/wallet`: wallet-session protected balance and plan summary.
- `POST /api/ai/staging/simulate`: wallet-session protected deterministic NDJSON stream. Reserves before output and settles afterward.
- `GET /api/ai/staging/receipts`: wallet-session protected Postgres ledger receipts.
- `POST /api/ai/staging/revoke`: staging-key protected device revocation.

The simulated provider records prompt length and output ceiling, not prompt content. Its deterministic price card is deliberately conservative and is not a claim about current Gemini pricing.

## Test credit CLI

```bash
AI_WALLET_STAGING_SECRET='32-or-more-random-bytes' \
AI_WALLET_STAGING_URL='https://staging-host.example' \
npm run wallet:staging:credit -- \
  --user staging:AC-LOCAL \
  --cents 200 \
  --plan thread
```

## Isolated Neon setup

Use the existing isolated Neon branch or create a fresh branch from the desired schema baseline. Apply `db/migrations/001-ai-wallet-ledger.sql` there, install `@neondatabase/serverless`, and set the staging deployment's `AI_WALLET_DATABASE_URL` to that branch only. Production database credentials must not be present in the staging deployment.

## What remains intentionally absent

- real Gemini calls
- platform Gemini credentials
- checkout or subscriptions
- processor-native webhooks
- automatic overages
- production account authority
- production database migration
