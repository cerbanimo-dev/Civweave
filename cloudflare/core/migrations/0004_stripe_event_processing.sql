ALTER TABLE stripe_events ADD COLUMN processing_state TEXT NOT NULL DEFAULT 'processed';
ALTER TABLE stripe_events ADD COLUMN processing_attempts INTEGER NOT NULL DEFAULT 1;
ALTER TABLE stripe_events ADD COLUMN last_attempt_at TEXT;
ALTER TABLE stripe_events ADD COLUMN processed_at TEXT;

UPDATE stripe_events
SET processing_state = CASE WHEN processing_error IS NULL THEN 'processed' ELSE 'error' END,
    processing_attempts = CASE WHEN processing_attempts < 1 THEN 1 ELSE processing_attempts END,
    last_attempt_at = COALESCE(last_attempt_at, received_at),
    processed_at = CASE WHEN processing_error IS NULL THEN COALESCE(processed_at, received_at) ELSE NULL END;
