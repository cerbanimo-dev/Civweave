PRAGMA foreign_keys = ON;

-- v2 top-up accounting keeps the customer charge on the Civweave platform,
-- transfers only the host's earned share, and leaves compute backing ring-fenced
-- in the platform balance until usage consumes it.
ALTER TABLE money_edge_topups ADD COLUMN service_net_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE money_edge_topups ADD COLUMN system_reserve_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE money_edge_topups ADD COLUMN host_share_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE money_edge_topups ADD COLUMN cerbanimo_share_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE money_edge_topups ADD COLUMN stripe_transfer_id TEXT;
ALTER TABLE money_edge_topups ADD COLUMN refunded_gross_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE money_edge_topups ADD COLUMN disputed_gross_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE money_edge_topups ADD COLUMN host_refund_reversed_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE money_edge_topups ADD COLUMN host_dispute_reversed_cents INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS money_edge_topup_transfer_idx
ON money_edge_topups(stripe_transfer_id);
