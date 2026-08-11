CREATE TABLE IF NOT EXISTS passport_credit_debts (
  debt_id TEXT PRIMARY KEY,
  passport_id TEXT NOT NULL,
  source_topup_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  recovered_cents INTEGER NOT NULL DEFAULT 0 CHECK(recovered_cents >= 0),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(source_topup_id,reason)
);
CREATE INDEX IF NOT EXISTS passport_credit_debts_passport_idx ON passport_credit_debts(passport_id,created_at DESC);

ALTER TABLE passport_topups ADD COLUMN reversed_host_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE passport_topups ADD COLUMN credit_debt_cents INTEGER NOT NULL DEFAULT 0;
