# Civweave ledger implementation status v1

Implemented on staging:
- canonical ledger architecture contract
- runtime reward asset contract
- Buttons/Acorns non-transferable and burnable
- Skill XP non-burnable/non-transferable
- Cotokens excluded from Reward Ledger
- account-scoped Reward Ledger projections
- explicit earn/burn operations
- insufficient-balance rejection for burns
- issuer/device-local hash-chain verification
- fulfillment ledger with idempotent paired requester burn + fulfiller reward settlement
- validation reference required for fulfillment settlement
- regression/CI contracts for ledger invariants

Pending wiring is guarded by `verify-civweave-ledger-runtime-wiring-v1.mjs`: the contract, Reward Ledger and Fulfillment Ledger must load in that order and all three must be present in the offline package.
