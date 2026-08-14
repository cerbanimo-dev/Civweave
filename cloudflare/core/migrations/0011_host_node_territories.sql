PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS host_node_territories (
  node_id TEXT PRIMARY KEY,
  territory_id TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK(source_kind IN ('civweave-root','territory-steward')),
  source_id TEXT,
  assigned_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(territory_id) REFERENCES money_edge_territories(territory_id)
);

CREATE INDEX IF NOT EXISTS host_node_territories_territory_idx
ON host_node_territories(territory_id,updated_at DESC);

CREATE INDEX IF NOT EXISTS host_node_territories_source_idx
ON host_node_territories(source_kind,source_id);
