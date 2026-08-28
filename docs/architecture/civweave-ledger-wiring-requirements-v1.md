# Civweave ledger runtime wiring requirements v1

The installed boundary and offline package must include, in dependency order:

1. `civweave-ledger-contract-v1.js`
2. `cw-reward-ledger-v2.js`
3. `civweave-fulfillment-ledger-v1.js`

A build that contains the files but does not load/cache them is incomplete and must fail regression verification.
