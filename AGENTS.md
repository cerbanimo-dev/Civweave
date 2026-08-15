# Civweave Agent Guide

This file applies to the entire repository. Every coding agent must read it before choosing an edit target.

## Canonical interface and runtime contract

Before changing any interface, chat, shared runtime, loader, cross-system behavior, mobile interaction, or verification architecture, read:

`docs/contracts/mobile-interface-contract.md`

That file is the single canonical interface and runtime contract for the active project. It defines the offline-first mesh boundary, the one-chat/five-theme architecture, runtime discipline, the prohibition on runtime replacement injection, the rule that obsolete artifacts are deleted rather than versioned or archived, and the placement of static verification in CI/review.

Do not restore, recreate, consult as architectural authority, or point new work at superseded visual contracts, spatial/cabinet architecture documents, realm-specific chat builds, archived replacement implementations, or other removed predecessors. Git history is the archive.

## Prime directive: capabilities own behavior, not places

**Do not derive application architecture from screens, scenes, rooms, cabinets, realm pages, folders, images, or visual placement.**

Civweave is a functional system with presentation layers. A visual surface may expose a capability, but its location does not make that surface the capability owner.

Architectural ownership must be determined from:

1. `docs/contracts/mobile-interface-contract.md`.
2. `docs/architecture/systems-of-practice.md` for current shared-system ownership.
3. `config/system-ownership.json` for declared capability owners.
4. The active shared implementation and its callers.
5. The active route only when needed to determine how a concrete visible surface reaches that implementation.

Presentation routes are evidence about rendering and composition, not the source of architectural truth.

## No spatial-architecture regression

Civweave must not regress into an architecture where functionality is defined by locations in a visual world.

- Do not make an illustrated scene, cabinet, room, terminal, hotspot, background image, or realm page the required owner of a capability merely because it displays that capability.
- Do not require navigation, chat, settings, forms, account management, installation, recovery, or messaging to live inside an in-world object or image-backed surface.
- Do not create separate implementations because the same function appears in different themes, realms, screens, or visual environments.
- Do not interpret five themes as five applications. Shared functional needs belong to shared systems.
- Artwork and game-like presentation are engagement layers. They may theme or frame functionality but must not determine application structure.
- Semantic mobile interaction, accessibility, offline operation, and direct state ownership take precedence over spatial metaphors.
- If an existing spatial wrapper is only duplicating a shared capability, consolidate the capability into its canonical owner and remove the obsolete wrapper when it no longer has an independent purpose.

## One chat system

Civweave has one canonical chat system.

The five guide identities are themes and memory contexts of that system:

- Weaveling / Civweave
- Moss / Living School
- Kamiya / Cerbanimo
- Rook / FellowFare
- Merlin / Anarchadia

They share one composer, transcript renderer, lifecycle, input/event owner, streaming path, local-model path, saved-chat UI, and responsive mobile behavior. Each theme keeps its own memory namespace.

Realm-specific capabilities may be invoked from chat through capability handlers. They must not create another chat UI, polling loop, event owner, model path, or transcript system.

Living School curriculum and learning tools are capabilities. They do not justify a separate Moss chat cabinet or workbench.

## Required investigation before editing

For any interface, shared-system, or cross-system task:

1. Read `docs/contracts/mobile-interface-contract.md`.
2. Read `docs/architecture/systems-of-practice.md` when the change affects shared ownership.
3. Read `config/system-ownership.json` when the capability is registered there.
4. Identify the canonical functional owner before editing presentation code.
5. Search the repository for every owner, caller, subscriber, loader, registration, storage key, service-worker entry, workflow reference, and obsolete predecessor related to the capability.
6. Trace the active route only as needed to understand how the visible UI reaches the canonical implementation.
7. Repair or extend the existing owner. Do not add a parallel owner.
8. If duplicated ownership already exists, consolidation is the task. Do not bridge duplicates with a third layer.
9. If the change makes another active artifact obsolete, delete that artifact and every stale reference in the same change.

A visible button does not own its behavior merely because it is nearby. A realm page may expose a canonical shared control, but it may not independently intercept or reimplement that control.

Browser prototypes and globals must never be patched to compensate for an implementation bug that can be fixed at its source.

## Active-route tracing

When debugging a concrete rendered surface, trace the route actually used by the current application rather than guessing from filenames or directories.

`public/app/fullscreen-family-v104.html` may be used to discover current presentation entrypoints when it is still the active dispatcher, but it is not an architectural contract. Do not encode its current visual routing topology into shared-system design.

If recent commits, an active route, and an older document disagree, the canonical contract and current functional ownership win. Update or delete misleading documentation in the same change.

## Source-of-truth rules

- A shared capability has one canonical owner.
- A presentation surface is not a second implementation.
- A theme is configuration, not a fork.
- A memory folder is a namespace, not a separate chat runtime.
- Generated installer assets follow source changes; they do not lead them.
- Packaging and caches may reference canonical files but must not become alternate implementations.
- Historical, backup, superseded, generated-copy, installer-mirror, and spatial-prototype implementations are never alternate sources of truth.
- If an artifact was made obsolete, delete it rather than routing new work through it.

## Runtime discipline

- Offline-first operation is primary.
- Hosted services widen capability but must not become mandatory for basic local work.
- One interaction must have one authoritative event owner.
- Prefer bounded work, bounded rendering, explicit lifecycle ownership, and backpressure.
- Do not stack polling loops, mutation observers, capture handlers, synthetic clicks, repair interceptors, or retry layers around a broken owner.
- Do not repeatedly throw events at the DOM to discover or repair state.
- Expensive local-model work begins from explicit user demand and respects device resource limits.
- Runtime replacement injection, self-patching, source rewriting, and emergency repair loaders are forbidden.

## Obsolete means delete

If an implementation, file, system, workflow, script, interface, contract, loader, registration, test, or documentation artifact has been made obsolete by its replacement, delete it from the active repository in the same change.

Do not preserve obsolete implementations as:

- versioned duplicates,
- archived copies,
- tombstones,
- legacy fallbacks,
- compatibility copies,
- backup files,
- side-by-side replacements,
- retired implementation folders,
- or alternate architectural documentation.

Git history is the archive. A replacement is not complete until the superseded active artifact and stale references are gone.

## Versioned-file rules

- Do not create a higher-numbered file merely because you changed it.
- Preserve a stable filename when it is a compatibility boundary and the release process does not require a rename.
- When a filename changes, update every caller, redirect, workflow path filter, service-worker cache list, installer manifest, and documentation reference in the same change.
- Search for the old filename after the edit. Any obsolete predecessor or stale reference must be removed.
- Keep query-string cache revisions coherent with the actual files being loaded.

## Repository hygiene

Treat the repository root as a control surface, not a storage location.

- New general documentation belongs under `docs/`.
- Release notes, audits, and planning records may live under `docs/history/` when they are genuine records rather than copies of obsolete implementations.
- Do not create retired implementation archives.
- Workflow touch/sentinel files belong under `ops/triggers/`, never as hidden files at `/`.
- Keep only runtime entrypoints, tool-required configuration, stable pointer documents, and explicitly required executable contracts at the root.
- Do not add a new root Markdown file simply because it is convenient for one release.

## Cross-cutting ownership constraints

Preserve these architectural expectations unless the user explicitly changes them:

- `docs/contracts/mobile-interface-contract.md` is the canonical interface/runtime rule set.
- Capabilities are organized by functional ownership, not spatial placement.
- The five guide identities share one chat system.
- Shared Settings input belongs to its canonical shared settings owner. Do not add duplicate Settings listeners, loaders, overlays, repair interceptors, or realm-local Settings implementations.
- Global five-system navigation is shared navigation. Individual realm/theme surfaces must not create competing navigation systems.
- Canonical cross-system state and capability semantics live in shared contracts and declared owners, not in visually convenient duplicates.
- Images, scenes, cabinets, rooms, terminals, and other visual metaphors may present functionality but never define ownership by themselves.
- If a replacement makes an artifact obsolete, delete it and its stale references. Git history is the archive.

## Verification

Static repository-contract verification belongs in GitHub Actions, tests, linting, type checks, or review checks rather than standalone verifier files when practical.

For broad runtime changes:

```bash
npm run check
```

For installer or packaged-runtime changes, run the relevant installer checks and then:

```bash
npm run build:install
```

For documentation-only changes, verify every named path against the current branch and inspect the Markdown diff.

A task is not complete when only a legacy or spatially duplicated copy works. Confirm the active presentation route reaches the canonical shared implementation and delete any predecessor made obsolete by the change.

## Commit and pull-request hygiene

- Name the canonical functional system affected by the change, not merely the screen or room where the symptom appeared.
- Explain whether the change affects shared runtime, a capability handler, presentation, packaging/cache, or several of these.
- List the verification performed.
- When a migration retires an old path, delete the retired active artifact and stale references in the same change, then update current pointer documentation that would otherwise mislead agents.

When uncertain, return to `docs/contracts/mobile-interface-contract.md`, the ownership registry, and the active shared implementation. Do not infer architecture from scenery.

## Long-horizon agentic pipeline mode

Use the decade pipeline when the task asks for the next best improvement, continuous improvement, roadmap execution, an agentic cycle, or another unscoped advancement of Civweave. A specific user request remains more authoritative than the queue.

Before choosing work in pipeline mode:

1. Read `docs/roadmap/ten-year-pipeline.md`.
2. Select the first unchecked bundle whose preceding bundles are checked.
3. Implement exactly that bundle.
4. Check the bundle in the same branch only after its implementation, migration, compatibility, and verification gates pass.
5. Follow `docs/roadmap/rebase.md` when the selected bundle is a scheduled rebase.
6. Follow `docs/roadmap/renewal.md` when the final renewal bundle is reached.

The priority order is:

1. explicit user instruction,
2. security, privacy, data preservation, and recovery,
3. the active architectural convergence lock and executable ownership evidence,
4. the selected pipeline bundle,
5. later roadmap ideas.

Pipeline rules:

- One bundle per branch and pull request.
- Default to a draft pull request.
- Do not merge or push directly to `main` unless the explicit task directs a direct merge.
- Do not skip forward because a later bundle is more interesting.
- Do not duplicate work already present on current `main` or in a valid open pull request.
- Do not mark a bundle complete until every gate passes.
- Preserve completed bundle IDs and planning history. Do not preserve obsolete implementations merely to document prior work.
- A scheduled rebase is planning-only. Do not hide production feature changes inside it.
- When the queue is exhausted, create the next epoch from fresh screenshots, redacted feedback, incidents, measurements, and current code. The old plan is a structural example, not the source of truth.

The pipeline coordinates work. It does not grant architectural authority. Human approval remains required for destructive migration, paid-service activation, and high-stakes governance or economic actions.

## Canonical release storage

- `releases/1.0.79/` is the first immutable Civweave launch snapshot and launch baseline.
- The executable release selected by `VERSION` lives at `releases/{VERSION}/`; stable `server/*.mjs` entrypoints select that stored release directly.
- New shipping versions must materialize their release directory with `npm run release:materialize` before they can pass the canonical launch gate.
- Root server aliases, root symlinks, `releases/1.0.81/server/`, and a live `archive/` directory are forbidden. Git history is the archive.

## Civweave Dev Tools MCP control instructions

The canonical local agent bridge for direct Civweave PWA inspection and source editing is `tools/civweave-dev-mcp/`. It is an observation/interaction and source-edit boundary, not a runtime repair layer.

Start it against a dedicated Chromium/Opera development profile whose Chrome DevTools Protocol endpoint is bound to loopback:

```bash
CIVWEAVE_REPO_ROOT=/path/to/Civweave \
CIVWEAVE_CDP_ENDPOINT=http://127.0.0.1:9222 \
node tools/civweave-dev-mcp/server.mjs
```

When the bridge is available:

1. Use a dedicated Chromium/Opera development profile with CDP bound to loopback. Do not attach the bridge to a personal browsing profile.
2. Start the bridge with `CIVWEAVE_REPO_ROOT` pointing at the canonical checkout and `CIVWEAVE_CDP_ENDPOINT` pointing at the dedicated browser. The CDP endpoint is operator configuration, never a model-selected tool parameter.
3. Start with `pwa.list_targets`, then use `targetId` or `urlIncludes` to select the intended Civweave page.
4. Inspect before editing: use `pwa.snapshot`, `pwa.runtime_state`, `pwa.query`, `pwa.screenshot`, and `pwa.watch` to reproduce and measure the problem.
5. Use `pwa.navigate`, `pwa.reload`, `pwa.click`, `pwa.type`, and `pwa.scroll` only to reproduce normal user actions and verify a source change. They are not implementation mechanisms.
6. Make persistent changes only in canonical repository source, using `repo.apply_patch` or normal source-editing tools. Review `repo.diff` immediately after a write and search for stale callers/owners before declaring the change complete.
7. Run the narrowest relevant allowlisted verification through `repo.run_npm_script`, then run the broader gates required by this file (`npm run check`, installer checks, `npm run build:install`, etc.) for the affected system.
8. Re-open or reload the active route and reproduce the original scenario after the source change. Browser success before source modification is not evidence of a fix.
9. Deployment, merge, secrets, database mutation, paid-service activation, and other high-blast-radius actions remain outside this bridge and require their existing explicit tools and approvals.

Hard controls:

- Do not add or use arbitrary browser evaluation tools such as `pwa.eval`, caller-supplied `Runtime.evaluate`, runtime patch helpers, DOM/source injection, service-worker replacement, cache rewriting, or storage mutation as a fix.
- Internal fixed CDP evaluation used by read tools must remain bounded and observational. `pwa.watch` must not install observers, globals, monkey patches, hooks, polling loops, or other instrumentation in the application page.
- `pwa.runtime_state` may expose storage key names and availability, not stored values, unless a future narrowly scoped diagnostic tool receives explicit privacy review.
- Browser navigation through the bridge is HTTP(S)-only. `javascript:`, `data:`, `file:`, and equivalent execution/read shortcuts are forbidden.
- The configured CDP endpoint must not be overridable per tool call. Run a separate bridge for a different browser endpoint.
- `repo.apply_patch` must remain checked (`git apply --check` before apply), repository-root constrained, and unable to modify `.git` metadata.
- Do not add arbitrary shell execution, deploy, push, merge, secret, or database tools to this bridge. Use separate purpose-built integrations with approval boundaries.
- The MCP server must bind to loopback by default. A non-loopback bind requires authentication and explicit allowed origins.
- CDP calls must remain bounded by timeouts. If a renderer is frozen, return the available failure/partial diagnostics; do not add persistent runtime hooks to “recover” observability.
- If the bridge is unavailable, do not emulate it by injecting code into the PWA. Fall back to ordinary browser inspection/screenshots and canonical source tools.
