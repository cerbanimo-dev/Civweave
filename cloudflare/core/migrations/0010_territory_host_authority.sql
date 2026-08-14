PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS territory_host_authorities (
  authority_id TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL,
  territory_id TEXT NOT NULL,
  issuer_node_id TEXT NOT NULL,
  issuer_operator_id TEXT NOT NULL,
  issuer_callback_base TEXT NOT NULL,
  issuer_public_key TEXT NOT NULL,
  issuer_key_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  can_issue_host_admissions INTEGER NOT NULL DEFAULT 1 CHECK(can_issue_host_admissions IN (0,1)),
  can_delegate_authority INTEGER NOT NULL DEFAULT 0 CHECK(can_delegate_authority IN (0,1)),
  max_grant_ttl_seconds INTEGER NOT NULL DEFAULT 3600 CHECK(max_grant_ttl_seconds BETWEEN 60 AND 86400),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY(appointment_id) REFERENCES money_edge_territory_stewards(appointment_id),
  FOREIGN KEY(territory_id) REFERENCES money_edge_territories(territory_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS territory_host_authority_active_appointment_idx
ON territory_host_authorities(appointment_id)
WHERE status='active';

CREATE UNIQUE INDEX IF NOT EXISTS territory_host_authority_active_node_idx
ON territory_host_authorities(issuer_node_id)
WHERE status='active';

CREATE INDEX IF NOT EXISTS territory_host_authority_territory_idx
ON territory_host_authorities(territory_id,status);

CREATE TABLE IF NOT EXISTS territory_host_admission_grants (
  grant_hash TEXT PRIMARY KEY,
  grant_id TEXT NOT NULL UNIQUE,
  authority_id TEXT NOT NULL,
  territory_id TEXT NOT NULL,
  candidate_host_id TEXT NOT NULL,
  candidate_node_id TEXT NOT NULL,
  candidate_operator_id TEXT NOT NULL,
  candidate_callback_base TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  consumed_node_id TEXT,
  FOREIGN KEY(authority_id) REFERENCES territory_host_authorities(authority_id),
  FOREIGN KEY(territory_id) REFERENCES money_edge_territories(territory_id)
);

CREATE INDEX IF NOT EXISTS territory_host_admission_open_idx
ON territory_host_admission_grants(authority_id,expires_at,consumed_at);

CREATE INDEX IF NOT EXISTS territory_host_admission_candidate_idx
ON territory_host_admission_grants(candidate_host_id,candidate_node_id,created_at DESC);

CREATE TABLE IF NOT EXISTS territory_host_admission_audit (
  audit_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  authority_id TEXT,
  grant_id TEXT,
  territory_id TEXT,
  issuer_node_id TEXT,
  subject_node_id TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS territory_host_admission_audit_created_idx
ON territory_host_admission_audit(created_at DESC);
