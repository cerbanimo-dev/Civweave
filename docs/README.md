# Civweave documentation

This directory is the default home for repository documentation. The repository root is reserved for runtime entrypoints, tool-required configuration, stable pointers, and a small number of executable contracts whose exact root path is still consumed by code or packaging.

## Current documentation

Current architecture, subsystem, and operational documents live directly in `docs/` until a domain grows large enough to deserve its own folder.

## Historical documentation

Version-specific records belong under [`history/`](./history/):

- [`history/releases/`](./history/releases/) - versioned release notes.
- [`history/audits/`](./history/audits/) - point-in-time audits and recovery reports.
- [`history/design/`](./history/design/) - versioned design backlogs and retired design snapshots.

## Operational sentinels

Workflow touch files are not documentation. They live in [`../ops/triggers/`](../ops/triggers/) so CI can watch explicit paths without accumulating hidden files at repository root.

Before adding a root document, run `node scripts/verify-root-hygiene.mjs`. In almost every case, add the document here and link to it instead.
