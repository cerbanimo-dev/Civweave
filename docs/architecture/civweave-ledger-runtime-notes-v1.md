# Civweave ledger runtime migration notes v1

The canonical direction is now Validation Ledger -> Fulfillment/Contribution authorization -> Reward/Contribution settlement. The older Reward Weave domain stores remain compatibility inputs until their callers are migrated; they must not be treated as alternate canonical Button/Acorn balances once the canonical Reward Ledger v2 path is active.

`civweave-ledger-contract-v1.js` must load before `cw-reward-ledger-v2.js`, and `civweave-fulfillment-ledger-v1.js` must load after both. Installed/offline surfaces must carry all three runtimes together so offline operation preserves the same rules.
