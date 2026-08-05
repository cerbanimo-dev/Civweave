# Commonweave AI Wallet Postgres Layer v1

Status: isolated foundation branch. No production payment processor or Gemini credential is enabled.

## Purpose

This layer replaces the single-process JSON ledger with a transaction-safe PostgreSQL implementation for multi-instance gateways. The file ledger remains available only as a local development fallback.

## Runtime selection

- `AI_WALLET_STORAGE=file` uses the atomic JSON development ledger.
- `AI_WALLET_STORAGE=postgres` requires `AI_WALLET_DATABASE_URL` or `DATABASE_URL`.
- With no explicit storage setting, a database URL selects Postgres; otherwise Commonweave uses the file ledger.
- The Neon driver is loaded only when Postgres mode starts. Install `@neondatabase/serverless` on that host before enabling it.

The wallet remains disabled unless `AI_WALLET_ENABLED=1` and all four independent wallet secrets contain at least 32 bytes.

## Database model

`db/migrations/001-ai-wallet-ledger.sql` creates wallets, registered devices, append-only payment events, spend reservations, and append-only ledger entries. All credit, debit, reservation, settlement, cancellation, and expiration operations execute inside PostgreSQL functions with row locks. The balance columns are a fast materialized projection; the immutable ledger is the audit trail.

## Security properties

- Payment source IDs are globally idempotent and cannot be rebound to another user.
- Reservations cannot exceed plan request ceilings, daily ceilings, or available balance.
- Settlement cannot exceed the amount reserved.
- Refunds and chargebacks preserve active reservations; unrecovered value becomes wallet debt.
- Wallet debt blocks new hosted-AI capabilities.
- Postgres-backed sessions and capabilities require an active registered device.
- Revoked devices fail session validation before an older signed session expires.
- Ledger and payment-event rows reject updates and deletes.
- Schema, table, sequence, and function privileges are revoked from `PUBLIC`.

## Internal routes

The wallet boundary provides internal-secret-protected operations for issuing a device-bound session, revoking a device, reading ledger entries, and reconciling expired reservations. Clients never receive database credentials, wallet secrets, or the future Gemini provider credential.

## Reconciliation

Every hosted request reserves its maximum possible cost before provider invocation. The trusted gateway settles actual cost or cancels the reservation. A periodic reconciler expires abandoned holds in bounded batches after crashes, provider timeouts, or disconnected clients.

## Deployment sequence

1. Create a Neon preview branch.
2. Apply `db/migrations/001-ai-wallet-ledger.sql` as the database owner.
3. Install `@neondatabase/serverless` on the hosted gateway.
4. Set `AI_WALLET_STORAGE=postgres` and the pooled connection string.
5. Set all four wallet secrets, but keep `AI_WALLET_ENABLED=0`.
6. Run schema, adapter, HTTP, replay, concurrency, and reconciliation checks.
7. Enable only in a private staging environment.

Do not apply this to production or enable public sessions until an account authority and processor-specific webhook adapter are reviewed together.
