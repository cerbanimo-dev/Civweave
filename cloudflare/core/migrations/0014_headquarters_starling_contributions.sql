-- Headquarters-only Starling patron purchases. Never use this table for member wallets,
-- Node top-ups, host/territory allocations, or spendable Guild Neuron credits.
CREATE TABLE IF NOT EXISTS headquarters_starling_contributions (
  contribution_id TEXT PRIMARY KEY NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  gross_cents INTEGER NOT NULL CHECK(gross_cents>=500 AND gross_cents<=100000),
  processor_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK(processor_fee_cents>=0),
  backing_cents INTEGER NOT NULL DEFAULT 0 CHECK(backing_cents>=0),
  refunded_gross_cents INTEGER NOT NULL DEFAULT 0 CHECK(refunded_gross_cents>=0),
  disputed_gross_cents INTEGER NOT NULL DEFAULT 0 CHECK(disputed_gross_cents>=0),
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_charge_id TEXT UNIQUE,
  checkout_url TEXT,
  status TEXT NOT NULL CHECK(status IN ('creating','checkout-pending','settled','partially-refunded','refunded')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  settled_at TEXT
);
CREATE INDEX IF NOT EXISTS headquarters_starling_contributions_settled_idx
  ON headquarters_starling_contributions(settled_at);
-- A future paid-inference scheduler must post separately audited actual neuron usage
-- against this cash-backed reserve before using it; purchase does not mean credits
-- were already delivered or that extra Cloudflare capacity is automatically available.
