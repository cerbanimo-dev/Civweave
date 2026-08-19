PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS money_edge_charters (
  charter_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  charterkeeper_node_id TEXT NOT NULL,
  charterkeeper_operator_id TEXT NOT NULL,
  route TEXT NOT NULL CHECK(route IN ('founder-transfer','mentor-direct')),
  nominee_user_id TEXT NOT NULL,
  nominee_label TEXT,
  nominee_appointment_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(nominee_appointment_confirmed IN (0,1)),
  proposed_guild_name TEXT NOT NULL,
  proposed_node_id TEXT,
  child_node_id TEXT,
  child_operator_id TEXT,
  status TEXT NOT NULL DEFAULT 'nominated' CHECK(status IN ('nominated','training','ready-for-guild','handoff-pending','active','ended')),
  agreement_status TEXT NOT NULL DEFAULT 'pending-signature' CHECK(agreement_status IN ('pending-signature','accepted','revoked')),
  agreement_version TEXT,
  agreement_accepted_at TEXT,
  charterkeeper_share_bps INTEGER NOT NULL DEFAULT 5000 CHECK(charterkeeper_share_bps >= 0 AND charterkeeper_share_bps <= 10000),
  activated_at TEXT,
  ended_at TEXT,
  ended_by_node_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(charterkeeper_node_id) REFERENCES money_edge_nodes(node_id),
  FOREIGN KEY(child_node_id) REFERENCES money_edge_nodes(node_id)
);

CREATE INDEX IF NOT EXISTS money_edge_charters_charterkeeper_idx
ON money_edge_charters(charterkeeper_node_id,status,created_at DESC);

CREATE INDEX IF NOT EXISTS money_edge_charters_nominee_idx
ON money_edge_charters(nominee_user_id,status,created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS money_edge_charters_one_active_child_idx
ON money_edge_charters(child_node_id)
WHERE child_node_id IS NOT NULL AND status='active';

CREATE TABLE IF NOT EXISTS money_edge_charter_training (
  charter_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  completed_by_node_id TEXT NOT NULL,
  evidence_hash TEXT,
  note TEXT,
  completed_at TEXT NOT NULL,
  PRIMARY KEY(charter_id,module_id),
  FOREIGN KEY(charter_id) REFERENCES money_edge_charters(charter_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS money_edge_charter_settlements (
  settlement_id TEXT PRIMARY KEY,
  source_kind TEXT NOT NULL,
  source_id TEXT NOT NULL,
  child_node_id TEXT NOT NULL,
  charter_id TEXT NOT NULL,
  charterkeeper_node_id TEXT NOT NULL,
  payout_account_id TEXT,
  existing_cerbanimo_share_cents INTEGER NOT NULL CHECK(existing_cerbanimo_share_cents >= 0),
  charterkeeper_share_cents INTEGER NOT NULL CHECK(charterkeeper_share_cents >= 0),
  cerbanimo_remaining_cents INTEGER NOT NULL CHECK(cerbanimo_remaining_cents >= 0),
  currency TEXT NOT NULL,
  source_transaction_id TEXT,
  transfer_id TEXT,
  transferred_cents INTEGER NOT NULL DEFAULT 0 CHECK(transferred_cents >= 0),
  refund_reversed_cents INTEGER NOT NULL DEFAULT 0 CHECK(refund_reversed_cents >= 0),
  dispute_reversed_cents INTEGER NOT NULL DEFAULT 0 CHECK(dispute_reversed_cents >= 0),
  status TEXT NOT NULL,
  settlement_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  settled_at TEXT,
  UNIQUE(source_kind,source_id),
  FOREIGN KEY(child_node_id) REFERENCES money_edge_nodes(node_id),
  FOREIGN KEY(charter_id) REFERENCES money_edge_charters(charter_id),
  FOREIGN KEY(charterkeeper_node_id) REFERENCES money_edge_nodes(node_id)
);

CREATE INDEX IF NOT EXISTS money_edge_charter_settlement_pending_idx
ON money_edge_charter_settlements(status,created_at);

CREATE INDEX IF NOT EXISTS money_edge_charter_settlement_child_idx
ON money_edge_charter_settlements(child_node_id,created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS money_edge_charter_settlement_transfer_idx
ON money_edge_charter_settlements(transfer_id)
WHERE transfer_id IS NOT NULL;