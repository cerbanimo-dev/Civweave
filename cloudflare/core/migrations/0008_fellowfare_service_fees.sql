PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS money_edge_fellowfare_service_fees (
  application_fee_id TEXT PRIMARY KEY,
  charge_id TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  fee_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  host_share_cents INTEGER NOT NULL,
  cerbanimo_share_cents INTEGER NOT NULL,
  host_transfer_id TEXT,
  refunded_fee_cents INTEGER NOT NULL DEFAULT 0,
  host_reversed_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  settled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(node_id) REFERENCES money_edge_nodes(node_id)
);

CREATE INDEX IF NOT EXISTS money_edge_fellowfare_service_fee_node_idx
ON money_edge_fellowfare_service_fees(node_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS money_edge_fellowfare_service_fee_transfer_idx
ON money_edge_fellowfare_service_fees(host_transfer_id)
WHERE host_transfer_id IS NOT NULL;
