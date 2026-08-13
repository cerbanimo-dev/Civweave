PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS money_edge_commerce_recipients (
  user_id TEXT PRIMARY KEY,
  connected_account_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS money_edge_commerce_sales (
  sale_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  node_id TEXT NOT NULL,
  buyer_user_id TEXT,
  sale_type TEXT NOT NULL,
  endeavor_id TEXT,
  display_name TEXT NOT NULL,
  currency TEXT NOT NULL,
  listed_cents INTEGER NOT NULL,
  split_fee_bps INTEGER NOT NULL,
  split_fee_cents INTEGER NOT NULL,
  buyer_charge_cents INTEGER NOT NULL,
  service_origin_royalty_bps INTEGER NOT NULL,
  status TEXT NOT NULL,
  checkout_session_id TEXT UNIQUE,
  checkout_url TEXT,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT UNIQUE,
  stripe_balance_transaction_id TEXT,
  processor_fee_cents INTEGER NOT NULL DEFAULT 0,
  refunded_gross_cents INTEGER NOT NULL DEFAULT 0,
  disputed_gross_cents INTEGER NOT NULL DEFAULT 0,
  settled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(node_id) REFERENCES money_edge_nodes(node_id)
);

CREATE INDEX IF NOT EXISTS money_edge_commerce_sales_node_idx
ON money_edge_commerce_sales(node_id, created_at DESC);

CREATE TABLE IF NOT EXISTS money_edge_commerce_payouts (
  sale_id TEXT NOT NULL,
  recipient_user_id TEXT NOT NULL,
  destination_account_id TEXT NOT NULL,
  roles_json TEXT NOT NULL,
  weight REAL NOT NULL,
  amount_cents INTEGER NOT NULL,
  stripe_transfer_id TEXT,
  refund_reversed_cents INTEGER NOT NULL DEFAULT 0,
  dispute_reversed_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(sale_id, recipient_user_id),
  FOREIGN KEY(sale_id) REFERENCES money_edge_commerce_sales(sale_id)
);

CREATE INDEX IF NOT EXISTS money_edge_commerce_payouts_destination_idx
ON money_edge_commerce_payouts(destination_account_id, created_at DESC);
