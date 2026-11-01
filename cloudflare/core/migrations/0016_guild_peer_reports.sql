-- Public directory transport for *approved, pseudonymous* nearby-Guild reports.
-- A Guild's membership DO is the sole author; directory verifies live receipt.
CREATE TABLE IF NOT EXISTS guild_peer_report_inbox (
  report_id TEXT NOT NULL,
  source_guild_id TEXT NOT NULL,
  recipient_guild_id TEXT NOT NULL,
  receipt_json TEXT NOT NULL,
  received_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (report_id, recipient_guild_id)
);
CREATE INDEX IF NOT EXISTS guild_peer_report_inbox_recipient_idx ON guild_peer_report_inbox(recipient_guild_id,expires_at);
