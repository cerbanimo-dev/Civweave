# Commonweave Rails

An implementation remains interoperable only while these rails remain intact.

1. Five canonical systems remain addressable: Commonweave, Living School, Cerbanimo, FellowFare, and Anarchadia.
2. Commonweave owns the shared AI vault and passes provider access to the other systems without duplicating secrets.
3. Intentions produce three typed requests: learning, task, and materials.
4. Shared objects use versioned envelopes with stable IDs, timestamps, origin IDs, type, payload, hop count, and TTL.
5. API secrets, private keys, passphrases, and raw authentication headers never enter exports, ledgers, mesh packets, or logs.
6. Rewards are append-only ledger events. Balances are derived, never overwritten.
7. Proof validation records the validator, model or method, rubric, decision, confidence, and evidence hash.
8. External effects require explicit consent. Anarchadia never pushes or merges code automatically.
9. Every system remains usable locally when no generative provider is configured.
10. User data remains exportable as plain JSON and importable without a hosted account.
11. Mesh messages are signed, deduplicated, bounded by TTL, and may be rejected locally.
12. Accessibility, keyboard operation, readable contrast, and reduced-motion behavior are required.

The protected implementation files are `RAILS.md`, `public/core/protocol.js`, `public/core/vault.js`, and the security-sensitive portions of `server.mjs`.
