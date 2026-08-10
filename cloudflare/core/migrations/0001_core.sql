PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS nodes (
  node_id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  runtime TEXT NOT NULL,
  public_origin TEXT NOT NULL,
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS nodes_status_updated_idx ON nodes(status, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS nodes_public_origin_idx ON nodes(public_origin);

CREATE TABLE IF NOT EXISTS stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  livemode INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processing_error TEXT
);

CREATE INDEX IF NOT EXISTS stripe_events_type_received_idx ON stripe_events(event_type, received_at DESC);

CREATE TABLE IF NOT EXISTS launch_audit (
  audit_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  subject_id TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS launch_audit_created_idx ON launch_audit(created_at DESC);
