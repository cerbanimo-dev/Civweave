-- Headquarters-only AI Gateway prepaid custody.
-- Cash contributions (0014) are distinct from Cloudflare credits and billed usage.
-- No seeded balance: the operator must establish a live Cloudflare baseline.
CREATE TABLE IF NOT EXISTS headquarters_starling_prepaid_state (
  singleton INTEGER PRIMARY KEY CHECK (singleton=1),
  provider_balance_micro_usd INTEGER NOT NULL CHECK(provider_balance_micro_usd>=0),
  confirmed_credit_micro_usd INTEGER NOT NULL DEFAULT 0 CHECK(confirmed_credit_micro_usd>=0),
  spent_quote_micro_usd INTEGER NOT NULL DEFAULT 0 CHECK(spent_quote_micro_usd>=0),
  reserved_micro_usd INTEGER NOT NULL DEFAULT 0 CHECK(reserved_micro_usd>=0),
  cash_committed_cents INTEGER NOT NULL DEFAULT 0 CHECK(cash_committed_cents>=0),
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS headquarters_starling_prepaid_loads (
  load_id TEXT PRIMARY KEY NOT NULL,
  provider_reference TEXT NOT NULL UNIQUE,
  purchased_credit_cents INTEGER NOT NULL CHECK(purchased_credit_cents>=1000),
  cash_cost_cents INTEGER NOT NULL CHECK(cash_cost_cents>=1000),
  balance_before_micro_usd INTEGER NOT NULL,
  balance_after_micro_usd INTEGER NOT NULL,
  recorded_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS headquarters_starling_prepaid_requests (
  request_id TEXT PRIMARY KEY NOT NULL,
  model TEXT NOT NULL,
  gateway_id TEXT NOT NULL,
  reserved_micro_usd INTEGER NOT NULL CHECK(reserved_micro_usd>0),
  charged_micro_usd INTEGER NOT NULL DEFAULT 0 CHECK(charged_micro_usd>=0),
  status TEXT NOT NULL CHECK(status IN ('pending','blocked','settled','uncertain')),
  provider_usage_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS headquarters_starling_prepaid_requests_status_idx
  ON headquarters_starling_prepaid_requests(status);
