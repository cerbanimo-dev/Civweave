# Civweave

Civweave is a local-first social operating system that connects intentions to learning, useful work, fair exchange, and governance.

## One current source tree

- Browser entry: `public/app/campus.html`
- Canonical screens: `public/app/routes.js`
- Host runtime: `server/runtime.mjs`
- PWA delivery: `public/service-worker.js`
- Production inventory: `docs/architecture/production-inventory.md`
- Agent rules: `AGENTS.md`

Git history is the code archive. Runtime code does not select, restore, inject, materialize, or rewrite historical Civweave source.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:8787/`.

`prestart` stages the pinned ONNX Runtime Web files and attempts to make the optional fixed MiniLM package available. MiniLM is separate from generative inference. The Campus may keep installed MiniLM warm during idle time. Opening Chat or Settings does not start or warm MiniLM or a generative model.

## Verify

```bash
npm run check
```

The production-surface verifier enforces the 16-screen sitemap, the exact browser file set, the absence of historical source selectors and realtime production bug-fix injection, the Chat/Settings model-start boundary, and Merlin's isolated user-customization rollback contract.

## Merlin customization

Merlin may stage and activate **user-authored** CSS/JavaScript through the dedicated customization layer. Exactly one last-known-good customization is retained. `/app/recovery/` does not boot the normal application runtime, so a broken customization can be disabled, edited, staged, or reverted after a crash.

This capability is never a production bug-fix path. Civweave source changes go through Git, tests, review, and deployment.

## Other current deployment surfaces

The repository also contains active Cloudflare node/core/territory infrastructure, the current Cerbanimo public site, current Node-AI/money-edge server modules, and current business/governance/legal/localization records. They are separate from the Civweave browser bundle and are listed in the production inventory.
