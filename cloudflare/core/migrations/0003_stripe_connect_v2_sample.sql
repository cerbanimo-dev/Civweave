PRAGMA foreign_keys = ON;

-- The sample UI identifies a Civweave-side user/operator with a simple user_id.
-- Stripe account status is intentionally NOT cached here. Every status view reads
-- the V2 Account directly from Stripe so onboarding/requirements are always fresh.
CREATE TABLE IF NOT EXISTS stripe_connect_users (
  user_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Thin events are stored only for idempotency/audit. We do not persist the Account
-- requirements or capability state in this table; handlers retrieve current state
-- from Stripe after verifying each notification.
CREATE TABLE IF NOT EXISTS stripe_connect_thin_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  account_id TEXT,
  received_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS stripe_connect_thin_event_account_idx
ON stripe_connect_thin_events(account_id, received_at DESC);
