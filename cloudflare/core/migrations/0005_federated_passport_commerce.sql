PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS passport_accounts (
  passport_id TEXT PRIMARY KEY,
  stripe_customer_id TEXT UNIQUE,
  recovery_enabled INTEGER NOT NULL DEFAULT 0,
  recovery_anchor_kind TEXT,
  recovery_capsule_json TEXT,
  recovery_capsule_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS passport_devices (
  passport_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  public_jwk_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY(passport_id, device_id),
  FOREIGN KEY(passport_id) REFERENCES passport_accounts(passport_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS passport_challenges (
  challenge_id TEXT PRIMARY KEY,
  passport_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  hub_id TEXT,
  nonce TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS passport_sessions (
  token_hash TEXT PRIMARY KEY,
  passport_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  hub_id TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS passport_sessions_passport_idx ON passport_sessions(passport_id,expires_at);

CREATE TABLE IF NOT EXISTS passport_credit_leases (
  lease_id TEXT PRIMARY KEY,
  passport_id TEXT NOT NULL,
  hub_id TEXT NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  stripe_credit_grant_id TEXT,
  granted_cents INTEGER NOT NULL CHECK(granted_cents > 0),
  used_cents INTEGER NOT NULL DEFAULT 0 CHECK(used_cents >= 0),
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  settled_at TEXT,
  UNIQUE(passport_id,hub_id,status)
);

CREATE TABLE IF NOT EXISTS fellowfare_sellers (
  passport_id TEXT PRIMARY KEY,
  connected_account_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'onboarding',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fellowfare_transactions (
  transaction_id TEXT PRIMARY KEY,
  buyer_passport_id TEXT NOT NULL,
  seller_passport_id TEXT NOT NULL,
  serving_hub_id TEXT NOT NULL,
  seller_connected_account_id TEXT NOT NULL,
  host_connected_account_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  seller_subtotal_cents INTEGER NOT NULL CHECK(seller_subtotal_cents > 0),
  processor_recovery_cents INTEGER NOT NULL DEFAULT 0 CHECK(processor_recovery_cents >= 0),
  network_fee_cents INTEGER NOT NULL CHECK(network_fee_cents >= 0),
  host_fee_cents INTEGER NOT NULL CHECK(host_fee_cents >= 0),
  cerbanimo_fee_cents INTEGER NOT NULL CHECK(cerbanimo_fee_cents >= 0),
  buyer_total_cents INTEGER NOT NULL CHECK(buyer_total_cents > 0),
  safety_certificate_hash TEXT NOT NULL,
  safety_certificate_json TEXT NOT NULL,
  listing_hash TEXT NOT NULL,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT UNIQUE,
  seller_transfer_id TEXT,
  host_transfer_id TEXT,
  status TEXT NOT NULL DEFAULT 'checkout-pending',
  created_at TEXT NOT NULL,
  settled_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS fellowfare_tx_buyer_idx ON fellowfare_transactions(buyer_passport_id,created_at DESC);
CREATE INDEX IF NOT EXISTS fellowfare_tx_seller_idx ON fellowfare_transactions(seller_passport_id,created_at DESC);

CREATE TABLE IF NOT EXISTS federation_capability_ads (
  hub_id TEXT PRIMARY KEY,
  public_origin TEXT NOT NULL,
  visibility TEXT NOT NULL,
  capabilities_json TEXT NOT NULL,
  signature TEXT NOT NULL,
  public_key_fingerprint TEXT,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
