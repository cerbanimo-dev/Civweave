PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS passport_credentials (
  credential_id TEXT NOT NULL,
  passport_id TEXT NOT NULL,
  credential_type TEXT NOT NULL,
  issuer TEXT,
  jurisdiction TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  verification_receipt_id TEXT,
  verified_by_hub_id TEXT,
  issued_at TEXT,
  expires_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY(passport_id, credential_id)
);
CREATE INDEX IF NOT EXISTS passport_credentials_type_idx ON passport_credentials(passport_id,credential_type,status);

CREATE TABLE IF NOT EXISTS passport_topups (
  topup_id TEXT PRIMARY KEY,
  passport_id TEXT NOT NULL,
  serving_hub_id TEXT NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  host_connected_account_id TEXT NOT NULL,
  gross_cents INTEGER NOT NULL CHECK(gross_cents > 0),
  currency TEXT NOT NULL,
  processor_fee_cents INTEGER NOT NULL DEFAULT 0,
  service_net_cents INTEGER NOT NULL DEFAULT 0,
  system_credit_cents INTEGER NOT NULL DEFAULT 0,
  host_share_cents INTEGER NOT NULL DEFAULT 0,
  cerbanimo_share_cents INTEGER NOT NULL DEFAULT 0,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT UNIQUE,
  stripe_host_transfer_id TEXT,
  stripe_credit_grant_id TEXT,
  status TEXT NOT NULL DEFAULT 'checkout-pending',
  created_at TEXT NOT NULL,
  settled_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS passport_topups_passport_idx ON passport_topups(passport_id,created_at DESC);
