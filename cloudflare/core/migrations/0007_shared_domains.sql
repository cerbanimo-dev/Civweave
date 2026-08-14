CREATE TABLE IF NOT EXISTS shared_domain_aliases (
  label TEXT PRIMARY KEY,
  host_id TEXT NOT NULL UNIQUE,
  pages_origin TEXT NOT NULL,
  entitlement_status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (entitlement_status IN ('inactive','active','grace','suspended')),
  entitlement_source TEXT NOT NULL DEFAULT 'hosting-cost-share'
    CHECK (entitlement_source IN ('hosting-cost-share','sponsored','platform-owned')),
  paid_through TEXT,
  grace_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (entitlement_status != 'active' OR entitlement_source != 'hosting-cost-share' OR paid_through IS NOT NULL),
  CHECK (entitlement_status != 'grace' OR grace_until IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS shared_domain_aliases_status_idx
  ON shared_domain_aliases(entitlement_status, paid_through, grace_until);

CREATE INDEX IF NOT EXISTS shared_domain_aliases_host_idx
  ON shared_domain_aliases(host_id);
