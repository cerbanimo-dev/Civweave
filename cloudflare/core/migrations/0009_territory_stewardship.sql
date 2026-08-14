PRAGMA foreign_keys = ON;

ALTER TABLE money_edge_nodes ADD COLUMN territory_id TEXT;

CREATE TABLE IF NOT EXISTS money_edge_territories (
  territory_id TEXT PRIMARY KEY,
  parent_territory_id TEXT,
  name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  subdivision_code TEXT,
  locality TEXT,
  depth INTEGER NOT NULL DEFAULT 0 CHECK(depth >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(parent_territory_id) REFERENCES money_edge_territories(territory_id)
);

CREATE INDEX IF NOT EXISTS money_edge_territory_parent_idx
ON money_edge_territories(parent_territory_id,depth);

CREATE TABLE IF NOT EXISTS money_edge_territory_stewards (
  appointment_id TEXT PRIMARY KEY,
  territory_id TEXT NOT NULL,
  public_name TEXT NOT NULL,
  legal_name TEXT,
  legal_identity_status TEXT NOT NULL DEFAULT 'pending-verification',
  home_region TEXT,
  effective_from TEXT NOT NULL,
  effective_until TEXT,
  appointment_status TEXT NOT NULL DEFAULT 'appointed',
  agreement_status TEXT NOT NULL DEFAULT 'pending-signature',
  agreement_path TEXT,
  payout_account_id TEXT,
  payout_status TEXT NOT NULL DEFAULT 'held-pending-onboarding',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(territory_id) REFERENCES money_edge_territories(territory_id)
);

CREATE INDEX IF NOT EXISTS money_edge_territory_steward_active_idx
ON money_edge_territory_stewards(territory_id,appointment_status,effective_from,effective_until);

CREATE TABLE IF NOT EXISTS money_edge_territory_settlements (
  settlement_id TEXT PRIMARY KEY,
  source_kind TEXT NOT NULL,
  source_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  territory_id TEXT,
  appointment_id TEXT,
  steward_public_name TEXT,
  payout_account_id TEXT,
  existing_cerbanimo_share_cents INTEGER NOT NULL CHECK(existing_cerbanimo_share_cents >= 0),
  cerbanimo_global_cents INTEGER NOT NULL CHECK(cerbanimo_global_cents >= 0),
  territory_share_cents INTEGER NOT NULL CHECK(territory_share_cents >= 0),
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
  FOREIGN KEY(node_id) REFERENCES money_edge_nodes(node_id),
  FOREIGN KEY(territory_id) REFERENCES money_edge_territories(territory_id),
  FOREIGN KEY(appointment_id) REFERENCES money_edge_territory_stewards(appointment_id)
);

CREATE INDEX IF NOT EXISTS money_edge_territory_settlement_pending_idx
ON money_edge_territory_settlements(status,created_at);

CREATE INDEX IF NOT EXISTS money_edge_territory_settlement_node_idx
ON money_edge_territory_settlements(node_id,created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS money_edge_territory_settlement_transfer_idx
ON money_edge_territory_settlements(transfer_id)
WHERE transfer_id IS NOT NULL;

-- Root territories provide a fallback steward. Local territories override their
-- parent only for nodes explicitly assigned to the more-specific territory.
INSERT OR IGNORE INTO money_edge_territories
  (territory_id,parent_territory_id,name,country_code,subdivision_code,locality,depth,active,created_at,updated_at)
VALUES
  ('us',NULL,'United States','US',NULL,NULL,0,1,'2026-08-14T00:00:00.000Z','2026-08-14T00:00:00.000Z'),
  ('us-mo-kc','us','Kansas City, Missouri','US','MO','Kansas City',1,1,'2026-08-14T00:00:00.000Z','2026-08-14T00:00:00.000Z'),
  ('us-ca-la','us','Los Angeles, California','US','CA','Los Angeles',1,1,'2026-08-14T00:00:00.000Z','2026-08-14T00:00:00.000Z'),
  ('jp',NULL,'Japan','JP',NULL,NULL,0,1,'2026-08-14T00:00:00.000Z','2026-08-14T00:00:00.000Z');

-- Appointment is distinct from agreement acceptance and payout onboarding.
-- Revenue can accrue to the office while cash remains held until those gates clear.
INSERT OR IGNORE INTO money_edge_territory_stewards
  (appointment_id,territory_id,public_name,legal_name,legal_identity_status,home_region,effective_from,effective_until,
   appointment_status,agreement_status,agreement_path,payout_account_id,payout_status,created_at,updated_at)
VALUES
  ('steward-us-cami-20260814','us','Cami Ryn Stormcaller',NULL,'pending-verification','New York','2026-08-14T00:00:00.000Z',NULL,
   'appointed','pending-signature','docs/legal/stewardship/agreement-cami-ryn-stormcaller-us.md',NULL,'held-pending-onboarding','2026-08-14T00:00:00.000Z','2026-08-14T00:00:00.000Z'),
  ('steward-jp-taki-20260814','jp','Taki',NULL,'pending-verification','Tokyo','2026-08-14T00:00:00.000Z',NULL,
   'appointed','pending-signature','docs/legal/stewardship/agreement-taki-japan.md',NULL,'held-pending-onboarding','2026-08-14T00:00:00.000Z','2026-08-14T00:00:00.000Z'),
  ('steward-us-mo-kc-anthony-20260814','us-mo-kc','Anthony Stematz-Breitling','Anthony Stematz-Breitling','pending-verification','Kansas City, Missouri','2026-08-14T00:00:00.000Z',NULL,
   'appointed','pending-signature','docs/legal/stewardship/agreement-anthony-stematz-breitling-kansas-city-mo.md',NULL,'held-pending-onboarding','2026-08-14T00:00:00.000Z','2026-08-14T00:00:00.000Z'),
  ('steward-us-ca-la-saphirah-20260814','us-ca-la','Saphirah Pociluyko','Saphirah Pociluyko','pending-verification','Los Angeles, California','2026-08-14T00:00:00.000Z',NULL,
   'appointed','pending-signature','docs/legal/stewardship/agreement-saphirah-pociluyko-los-angeles-ca.md',NULL,'held-pending-onboarding','2026-08-14T00:00:00.000Z','2026-08-14T00:00:00.000Z');
