PRAGMA foreign_keys = ON;

-- Once the Charterkeeper agreement gate is satisfied, previously accrued
-- Charterkeeper allocations can move into the normal balance-availability retry lane.
CREATE TRIGGER IF NOT EXISTS charterkeeper_release_reserved_settlements
AFTER UPDATE OF agreement_status ON money_edge_charters
WHEN NEW.agreement_status = 'accepted' AND OLD.agreement_status <> 'accepted'
BEGIN
  UPDATE money_edge_charter_settlements
  SET status = 'pending-funds', updated_at = NEW.updated_at
  WHERE charter_id = NEW.charter_id
    AND status = 'reserved-pending-agreement'
    AND payout_account_id IS NOT NULL;
END;

-- Charterkeeper compensation requires the person/entity to keep operating the
-- source Guild. A source-Guild operator transfer ends active Charters and freezes
-- any not-yet-paid Charterkeeper settlement rather than paying a historical operator.
CREATE TRIGGER IF NOT EXISTS charterkeeper_end_on_source_operator_transfer
AFTER UPDATE OF operator_id ON money_edge_nodes
WHEN NEW.operator_id <> OLD.operator_id
BEGIN
  UPDATE money_edge_charters
  SET status = 'ended',
      ended_at = COALESCE(ended_at, NEW.updated_at),
      ended_by_node_id = NEW.node_id,
      updated_at = NEW.updated_at
  WHERE charterkeeper_node_id = NEW.node_id
    AND charterkeeper_operator_id = OLD.operator_id
    AND status = 'active';

  UPDATE money_edge_charter_settlements
  SET status = 'reserved-charter-inactive',
      settlement_error = 'Charterkeeper source Guild changed operators before settlement.',
      updated_at = NEW.updated_at
  WHERE charter_id IN (
    SELECT charter_id FROM money_edge_charters
    WHERE charterkeeper_node_id = NEW.node_id
      AND status = 'ended'
      AND ended_by_node_id = NEW.node_id
  )
  AND transfer_id IS NULL
  AND status IN ('pending-funds','pending-error','reserved-pending-agreement','reserved-payout-unavailable');
END;
