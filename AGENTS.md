# Civweave Agent Guide

This file applies to the entire repository. Every coding agent must read it before choosing an edit target.

## Canonical interface and runtime contract

Before changing any interface, chat, shared runtime, loader, cross-realm behavior, mobile interaction, or verification architecture, read:

`docs/contracts/mobile-interface-contract.md`

That file is the single canonical interface and runtime contract for the active project. It defines the offline-first mesh boundary, the one-chat/five-theme architecture, runtime discipline, the prohibition on runtime replacement injection, the rule that obsolete artifacts are deleted rather than versioned or archived, and the placement of static verification in CI/review.

Do not restore, recreate, consult as architectural authority, or point new work at superseded visual contracts, realm-specific chat builds, archived replacement implementations, or other removed predecessors. Git history is the archive. If a replacement makes an active artifact obsolete, delete the obsolete artifact and its stale references in the same change.

## Prime directive

**Do not select code by folder name alone. Trace the live route from the current dispatcher.**

For cabinet work, begin at:

`public/app/fullscreen-family-v104.html`

Read its current `sites` map, identify the entry for the requested realm, and follow that entry's imported scripts, stylesheets, modules, iframes, and service-worker references. The dispatcher and the newest commits touching those referenced files define the current implementation.

As of August 5, 2026, the dispatcher routes to:

- Civweave: `public/app/working-campus-v156.html`
- Living School: `public/app/cabinets/living-school/index.html`
- Cerbanimo: `public/app/realm-console-v140.html?system=cerbanimo&cabinet=1`
- FellowFare: `public/app/fellowfare-cabinet-v144.html?cabinet=1`
- Anarchadia: `public/app/anarchadia-console-v139.html?cabinet=1`

Treat this list as an orientation aid, not permission to skip checking the dispatcher. Versioned entry files can move.

## Source-of-truth hierarchy

Architectural rules come from `docs/contracts/mobile-interface-contract.md`. For locating the live implementation of a specific feature, use this order:

1. The entry referenced by `public/app/fullscreen-family-v104.html`.
2. Files directly loaded or imported by that entry.
3. Active embedded surfaces under `public/app/services/<realm>/`.
4. Shared runtime and contracts under `public/app/shared/`, plus shared family-shell files under `public/app/`.
5. Packaging and cache declarations that retain those canonical files.

Historical, backup, superseded, generated-copy, and installer-mirror implementations are never alternate sources of truth. If they were made obsolete by a canonical replacement, remove them rather than routing new work through them.

Realm routing may still use different entry structures while non-chat capabilities are consolidated, but **chat is not realm-specific infrastructure**:

- All five guide identities use the single canonical chat system defined by `docs/contracts/mobile-interface-contract.md`.
- Living School may own curriculum and learning capabilities, but it must not own a separate Moss chat UI, event loop, composer, transcript renderer, streaming path, or memory runtime.
- Realm-specific entry files may expose capabilities to the shared chat system. They may not fork the chat system.

Do not force unrelated realm-specific capabilities into one structure as part of an unrelated repair.

## Paths that are not normal edit targets

Unless the task explicitly names one of these surfaces, do not implement current cabinet behavior in:

- `public/cabinet/`
- root-level historical pages such as `public/cabinet-v*.html`
- root-level historical pages such as `public/civweave-v*.html`
- `public/index_old.html` or files with backup, old, legacy, supplied, or similar archival naming
- copied `www/app/` directories inside installer or release bundles
- ZIP archives or extracted package mirrors
- `public/cabinetonly/index.html`, which is a redirect rather than the cabinet implementation

Do not hand-edit generated installer copies to make a source bug appear fixed. Fix canonical files under `public/app/`, update package manifests or cache lists where necessary, run verification, and regenerate the package. If a generated or copied artifact is no longer required after the replacement, delete it instead of preserving it as an archive.

## Required investigation before editing

For any cabinet or cross-realm task:

1. Read `docs/contracts/mobile-interface-contract.md` for interface/runtime rules.
2. Read `public/app/fullscreen-family-v104.html`.
3. Inspect recent commits affecting the active entry and its dependencies.
4. Search the repository for every reference to the file, version marker, route, DOM ID, storage key, and service-worker cache entry you expect to change.
5. Determine whether the visible surface is a parent page, an embedded `services/<realm>/` page, or both.
6. Confirm whether installer, service-worker, verifier, and workflow files retain exact filename lists.
7. Edit the smallest canonical surface that owns the behavior.
8. If the change makes another active artifact obsolete, delete that artifact and all stale references before considering the change complete.

### Mandatory system-of-practice lookup

Before adding or changing any cross-cutting button handler, global event listener, loader, overlay, shared state store, service-worker hook, or shared runtime:

1. Read `docs/contracts/mobile-interface-contract.md`.
2. Read `docs/architecture/systems-of-practice.md`.
3. Read `config/system-ownership.json`.
4. Identify the existing capability owner and canonical control/event/API.
5. Search the active route graph for every existing owner, subscriber, caller, compatibility shim, and retired implementation.
6. **If the capability already exists, extend or repair its declared owner. Do not add a parallel owner.**
7. If duplicated ownership already exists, consolidation is the task. Do not add a third path to bridge the first two.
8. Any intentional ownership change must update the registry, applicable CI/review verification, and documentation in the same change.
9. Remove any implementation made obsolete by the ownership change. Do not archive or version it beside the replacement.
10. Run the currently canonical system-ownership check for any file covered by the ownership registry.

A visible button does not own its behavior merely because it is nearby. Realm-specific markup may expose a canonical shared control, but it may not independently intercept that control. Browser prototypes and globals must never be patched to compensate for an implementation bug that can be fixed at its source.

Useful local commands include:

```bash
git log --date=short --name-status -- public/app public/extensions public/service-worker* scripts .github/workflows
git log -n 20 --oneline -- public/app/fullscreen-family-v104.html
rg "exact-file-name|version-marker|storage-key|element-id" public scripts .github
```

If recent commits and an older document disagree, prefer the active route and current code, subject to the canonical interface/runtime contract. Update or delete misleading documentation in the same change.

## Versioned-file rules

Many filenames are stable compatibility boundaries even when their internal build markers advance.

- Do not create a higher-numbered file merely because you changed it.
- Preserve the current filename unless the task or release process requires a version bump.
- When a filename changes, update every caller, redirect, workflow path filter, service-worker cache list, installer manifest, and documentation reference in the same change.
- Search for the old filename after the edit. Any obsolete predecessor or stale reference must be deleted; do not retain it as a fallback or archive.
- Keep query-string cache revisions coherent with the actual files being loaded.

## Root hygiene

Treat the repository root as a control surface, not a storage location.

- New general documentation belongs under `docs/`.
- Release notes, audits, and design records may live under `docs/history/` when they are genuinely records rather than copies of obsolete implementations. Do not create retired implementation archives.
- Workflow touch/sentinel files belong under `ops/triggers/`, never as hidden files at `/`.
- Keep only runtime entrypoints, tool-required configuration, stable pointer documents, and explicitly grandfathered executable contracts at the root.
- Do not add a new root Markdown file simply because it is convenient for one release.
- If an executable contract genuinely must remain at root because code or packaging consumes that exact path, document that exception in the canonical root-hygiene check rather than weakening the rule.
- Run the current root-hygiene CI/review check after changing root layout, docs placement, or workflow sentinels.

The root-hygiene workflow rejects unapproved root Markdown and root-level trigger/materialize/watchdog sentinels. Prefer adding an index or link to a folder over adding another root artifact.

## Cabinet ownership boundaries

### Shared family shell

`public/app/family-shell-v104.js` and `public/app/family-shell-v104.css` own shared cabinet chrome and family navigation. A realm-specific visual or behavior change should not be placed here unless it truly applies across the family.

The shared chat system is governed separately by `docs/contracts/mobile-interface-contract.md`; do not infer chat ownership from whichever realm entry happens to display it.

### Civweave

Begin with `public/app/working-campus-v156.html`, then follow its loaded assets and runtimes.

### Living School

Begin with `public/app/cabinets/living-school/index.html` for Living School-specific curriculum and learning capabilities. Its modular realm code, styles, bootstrap, and learning loaders may live under `public/app/cabinets/living-school/`, with mature service modules under `public/app/services/living-school/`.

Moss chat is not owned here. Moss is the Living School theme and memory context of the one shared chat system. Do not create or restore a Living School-specific chat cabinet, workbench, polling loop, composer, transcript renderer, model path, or saved-chat implementation.

### Cerbanimo

Begin with `public/app/realm-console-v140.html?system=cerbanimo&cabinet=1`, then trace Cerbanimo-specific routes, engines, and service surfaces from that console.

### FellowFare

Begin with `public/app/fellowfare-cabinet-v144.html?cabinet=1`. The parent cabinet and the embedded market under `public/app/services/fellowfare/` can both affect the visible result. Inspect both before changing layout, scrolling, navigation, or Rook-specific capabilities. Rook chat itself remains owned by the shared chat system.

### Anarchadia

Begin with `public/app/anarchadia-console-v139.html?cabinet=1`, then follow governance, sovereignty, and embedded service dependencies from that entry. Merlin chat itself remains owned by the shared chat system.

## Cross-cutting constraints

Preserve these architectural expectations unless the task explicitly changes them:

- `docs/contracts/mobile-interface-contract.md` is the canonical interface/runtime rule set.
- Offline-first operation is primary.
- Hosted services widen capability but must not become mandatory for basic local work.
- The five guide identities share one chat system; themes and memory folders do not justify separate chat implementations.
- Shared Settings input belongs only to `public/app/settings-gateway-v317.js`; the presentation belongs to `public/app/model-settings-controller-v173.js`. Do not add duplicate Settings listeners, loaders, overlays, repair interceptors, or realm-local Settings implementations.
- Living School uses the same shared family Settings control and canonical Settings surface as Cerbanimo, FellowFare, and Anarchadia.
- The global five-system navigation belongs to the family shell. Embedded realm pages should not create a second competing switcher.
- Canonical cross-realm state and capability semantics live in shared contracts and parity code, not in visually convenient duplicates.
- Generated installer assets follow source changes; they do not lead them.
- Runtime replacement injection, self-patching, source rewriting, and repair loaders are forbidden.
- If a replacement makes an artifact obsolete, delete it and its stale references. Git history is the archive.

## Verification

Use the narrowest relevant CI/review check while developing, then the repository checks appropriate to the change. Static repository-contract verification belongs in GitHub Actions, tests, linting, type checks, or review checks rather than standalone verifier files when practical.

For cross-cutting ownership changes, run the current system-ownership CI/review check.

For broad runtime changes:

```bash
npm run check
```

For installer or packaged-runtime changes, run the relevant installer checks and then:

```bash
npm run build:install
```

For documentation-only changes, verify every named path against the current branch and inspect the Markdown diff.

A task is not complete when only a legacy copy works. Confirm the route reached from `fullscreen-family-v104.html` uses the changed code, and delete any active predecessor made obsolete by the change.

## Commit and pull-request hygiene

- Keep unrelated cleanup out of feature repairs unless the changed feature makes an artifact obsolete. Obsolete artifacts must be removed as part of the replacement.
- Name the active surface in the commit or pull-request summary.
- Explain whether the change affects the parent cabinet, embedded service, shared shell, package cache, or several of these.
- List the verification performed.
- When a migration retires an old path, delete the retired active artifact and stale references in the same change, then update this file and any other current pointer documentation that would otherwise mislead agents.

When uncertain, stop wandering through similarly named rooms and return to the dispatcher and `docs/contracts/mobile-interface-contract.md`. Those are the map and the architectural rules pinned to the front door.

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
- Do not merge or push directly to `main`.
- Do not skip forward because a later bundle is more interesting.
- Do not duplicate work already present on current `main` or in a valid open pull request.
- Do not mark a bundle complete until every gate passes.
- Preserve completed bundle IDs and planning history. Do not preserve obsolete implementations merely to document prior work.
- A scheduled rebase is planning-only. Do not hide production feature changes inside it.
- When the queue is exhausted, create the next epoch from fresh screenshots, redacted feedback, incidents, measurements, and current code. The old plan is a structural example, not the source of truth.

The pipeline coordinates work. It does not grant authority. Human approval remains required for merge, compatibility removal, destructive migration, paid-service activation, and high-stakes governance or economic actions.

## Canonical release storage

- `releases/1.0.79/` is the first immutable Civweave launch snapshot and launch baseline.
- The executable release selected by `VERSION` lives at `releases/{VERSION}/`; stable `server/*.mjs` entrypoints select that stored release directly.
- New shipping versions must materialize their release directory with `npm run release:materialize` before they can pass the canonical launch gate.
- Root server aliases, root symlinks, `releases/1.0.81/server/`, and a live `archive/` directory are forbidden. Git history is the archive.
