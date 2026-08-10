# Civweave

Civweave is a local-first five-system workspace: Civweave plus Living School, Cerbanimo, FellowFare, and Anarchadia.

## Core runtime

The browser has one canonical entry:

```text
public/app/index.html
  ├─ core.css
  └─ core.js
```

Realm navigation is application state inside that runtime. The core can create a reviewable intention weave, materialize realm handoffs into local state, install as a PWA, and operate offline without loading legacy realm shells.

The core deliberately preserves current intention/workspace storage contracts so the runtime cleanup does not erase user work.

## Optional modules

Current local-model code and model metadata live under `public/app/local-ai/` and `public/app/models/`. They are not loaded at boot. Release builds may stage Transformers runtime files so local generation is available when explicitly requested.

`public/finder/` and `public/node-ai/` remain independent current surfaces and are not part of core boot.

## Run

```bash
npm install
npm start
```

The server entry is `server.mjs`.

## Verify

```bash
npm run check:core
```

The core verifier enforces one canonical stylesheet, one canonical script, `/app/` PWA start, direct server startup, and absence of retired boot/package-enforcement references.

## Build

```bash
npm run build:install
npm run build:release
node scripts/build-cloudflare-pages.mjs
```

The mobile install kit contains only the explicit mandatory core. It does not recursively package the historical application tree.

## Architecture rule

Do not restore `working-campus-v*`, `installed-entry-v*`, family-shell, realm-console, install-boundary, recovery injection, service-worker patch stacks, or equivalent layered boot mechanisms as canonical runtime dependencies. Add capabilities to the core or load them lazily as isolated modules.
