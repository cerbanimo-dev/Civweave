# Civweave documentation

The repository root is a control surface, not a document archive. Current knowledge lives here behind stable folders and indexes.

## Current documentation

- [`contracts/`](./contracts/) contains architecture and behavior contracts consumed by people, verifiers, and packaging.
- [`operations/`](./operations/) contains installation, hosting, deployment, and operator guidance.
- [`migrations/`](./migrations/) contains naming and structural migration records.
- [`roadmap/`](./roadmap/) contains the long-horizon pipeline plus its rebase and renewal procedures.
- [`history/`](./history/) contains point-in-time releases, audits, design snapshots, and inventories.

## Operational sentinels

Workflow touch files are not documentation. They live in [`../ops/triggers/`](../ops/triggers/) so CI can watch explicit paths without accumulating hidden files at repository root.

Before adding a root document, run `node scripts/verify-root-hygiene.mjs`. Root Markdown is intentionally limited to `README.md`, `AGENTS.md`, and the stable `RELEASE-NOTES.md` pointer.