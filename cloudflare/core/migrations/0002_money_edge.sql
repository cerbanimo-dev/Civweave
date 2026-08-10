PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS money_edge_nodes (
  node_id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  connected_account_id TEXT NOT NULL UNIQUE,
  callback_origin TEXT NOT NULL,
  receipt_public_key TEXT NOT NULL,
  platform_fee_bps INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS money_edge_enrollment_grants (
  grant_hash TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  callback_origin TEXT NOT NULL,
  receipt_public_key TEXT NOT NULL,
  platform_fee_bps INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE INDEX IF NOT EXISTS money_edge_enrollment_node_idx
ON money_edge_enrollment_grants(node_id, created_at DESC);

CREATE TABLE IF NOT EXISTS money_edge_topups (
  topup_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  node_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  gross_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  platform_fee_cents INTEGER NOT NULL,
  processor_fee_cents INTEGER NOT NULL DEFAULT 0,
  user_credit_cents INTEGER NOT NULL,
  status TEXT NOT NULL,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT UNIQUE,
  stripe_balance_transaction_id TEXT,
  checkout_url TEXT,
  refunded_cents INTEGER NOT NULL DEFAULT 0,
  disputed_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  settled_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(node_id) REFERENCES money_edge_nodes(node_id)
);

CREATE INDEX IF NOT EXISTS money_edge_topup_node_idx
ON money_edge_topups(node_id, created_at DESC);

CREATE TABLE IF NOT EXISTS money_edge_deliveries (
  delivery_id TEXT PRIMARY KEY,
  source_event_id TEXT NOT NULL UNIQUE,
  topup_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  delivered_at TEXT,
  FOREIGN KEY(topup_id) REFERENCES money_edge_topups(topup_id),
  FOREIGN KEY(node_id) REFERENCES money_edge_nodes(node_id)
);

CREATE INDEX IF NOT EXISTS money_edge_delivery_pending_idx
ON money_edge_deliveries(status, created_at);
