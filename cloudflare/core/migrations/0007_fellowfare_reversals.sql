ALTER TABLE fellowfare_transactions ADD COLUMN refunded_gross_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fellowfare_transactions ADD COLUMN disputed_gross_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fellowfare_transactions ADD COLUMN seller_reversed_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fellowfare_transactions ADD COLUMN host_reversed_cents INTEGER NOT NULL DEFAULT 0;
