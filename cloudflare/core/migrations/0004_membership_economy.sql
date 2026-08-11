PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS money_edge_memberships (
  node_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  tier_id TEXT NOT NULL,
  connected_account_id TEXT NOT NULL,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  checkout_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'checkout-pending',
  monthly_lifetime_credits INTEGER NOT NULL CHECK(monthly_lifetime_credits > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(node_id, user_id),
  UNIQUE(stripe_subscription_id),
  UNIQUE(checkout_session_id)
);

CREATE TABLE IF NOT EXISTS money_edge_membership_cycles (
  invoice_id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  tier_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_payment_intent_id TEXT NOT NULL,
  stripe_charge_id TEXT NOT NULL,
  stripe_balance_transaction_id TEXT,
  stripe_transfer_id TEXT,
  gross_cents INTEGER NOT NULL CHECK(gross_cents >= 0),
  processor_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK(processor_fee_cents >= 0),
  service_net_cents INTEGER NOT NULL CHECK(service_net_cents >= 0),
  system_reserve_cents INTEGER NOT NULL CHECK(system_reserve_cents >= 0),
  host_share_cents INTEGER NOT NULL CHECK(host_share_cents >= 0),
  cerbanimo_share_cents INTEGER NOT NULL CHECK(cerbanimo_share_cents >= 0),
  lifetime_credits_neurons INTEGER NOT NULL CHECK(lifetime_credits_neurons > 0),
  settled_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS money_edge_membership_subscription_idx
ON money_edge_memberships(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS money_edge_membership_cycle_node_user_idx
ON money_edge_membership_cycles(node_id,user_id,settled_at DESC);
