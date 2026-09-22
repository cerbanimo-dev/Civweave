# Civweave ledger security invariants v1

1. Buttons and Acorns are burnable personal reward credits and are never transferable between Passports.
2. Fulfillment settlement is represented by a requester burn and a separate fulfiller reward, both referencing the same validated fulfillment.
3. Skill XP is not burnable or transferable.
4. Cotokens live in the contribution ledger and are not Reward Ledger assets.
5. A cached balance or UI projection never outranks canonical signed events.
6. A Guild may replicate scoped records but may not impersonate a Passport or spend a member's rewards.
7. Offline multi-device reward history is merged from issuer-local signed chains rather than requiring one global append sequence.
8. Fulfillment settlement is idempotent by fulfillment ID and source keys.
