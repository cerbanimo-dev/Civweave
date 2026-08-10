# Civweave Agent Guide

This file applies to the entire repository.

## Prime directive

**Preserve the core-first architecture. Do not resurrect retired frontend shells, compatibility layers, package-enforcement lists, or version-chain bootstraps.**

The canonical browser entry is `public/app/index.html`. It directly loads exactly:

- `public/app/core.css`
- `public/app/core.js`

The canonical service worker is `public/service-worker.js`. The canonical server entry is `server.mjs`.

## Runtime ownership

Normal navigation stays inside the core runtime. The four realm views are states of the same application, selected with `?system=`:

- `living-school`
- `cerbanimo`
- `fellowfare`
- `anarchadia`

Do not add a second shell, iframe parent, family dispatcher, realm-console wrapper, recovery page, or navigation injection layer around them.

Feature code may be loaded lazily when a feature is actually requested. A feature module must not become a prerequisite for booting, installing, or opening another feature.

## Preserved state contracts

The clean runtime intentionally continues reading/writing these existing browser-state contracts so users do not lose current work:

- `civweave.working-campus.v1`
- `civweave.intentions.v127`
- `civweave.realm-inbox.v1`

Those storage-key names are data compatibility, not permission to restore the retired working-campus runtime.

## Local AI

`public/app/local-ai/` and `public/app/models/` are optional current modules. They are cold at normal boot. Release builds may stage Transformers runtime assets so a downloaded model can be invoked when requested, but model/runtime assets must not be added to the mandatory core package or service-worker boot list.

## Public tree policy

`public/` is allowlisted. Do not copy archived, generated, cabinet, recovery, installer-mirror, or historical versioned frontend trees back into it. The release builder intentionally copies only the canonical public core and generated current download artifacts.

The standalone `public/finder/` and `public/node-ai/` modules are preserved as current independent surfaces. They must remain independent of core boot.

## Packaging

`scripts/build-mobile-install-kit.mjs` owns the mandatory offline core. Its file list must stay small and explicit. Never derive mandatory files by parsing the service worker or by recursively copying the public tree.

`scripts/build-cloudflare-pages.mjs` owns the static release allowlist. Do not replace it with an unrestricted `cp public` operation.

## Verification

For runtime or packaging changes run:

```bash
npm run check:core
npm run build:install
```

For broad backend/domain changes also run the relevant focused tests or `npm run check`.

A frontend task is not complete if it requires any retired entry filename, versioned compatibility shell, injected bootstrap, duplicate settings runtime, or multiple simultaneously rendered frontend layers.

## Long-horizon agentic pipeline

`TEN-YEAR-PIPELINE.md` remains a planning queue, but architecture references written before the core reset are historical. If a pipeline item conflicts with this guide or the current canonical entry, reinterpret the item against the current core rather than recreating the old path.

Explicit user instructions outrank the pipeline. Human approval remains required for merge, destructive data migration, paid-service activation, and high-stakes governance or economic actions.

Default automated work to a branch and draft pull request. Do not push directly to `main` unless the user supplies the repository's explicit direct-to-main authorization phrase.
