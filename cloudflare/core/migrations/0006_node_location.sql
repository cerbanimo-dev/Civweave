ALTER TABLE nodes ADD COLUMN location_json TEXT;

CREATE INDEX IF NOT EXISTS nodes_status_location_updated_idx
  ON nodes(status, updated_at DESC)
  WHERE location_json IS NOT NULL;
