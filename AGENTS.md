# Civweave Agent Guide

This file applies to the entire repository. Every coding agent must read it before choosing an edit target.

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

When several copies appear to implement the same feature, use this order:

1. The entry referenced by `public/app/fullscreen-family-v104.html`.
2. Files directly loaded or imported by that entry.
3. Active embedded surfaces under `public/app/services/<realm>/`.
4. Shared runtime and contracts under `public/app/shared/`, plus shared cabinet shell files under `public/app/`.
5. Packaging and cache declarations that copy or retain those canonical files.
6. Historical, backup, generated, and installer-mirror copies only when an explicit task targets them.

The current cabinet architecture is intentionally mixed while realms are migrated:

- `public/app/cabinets/<realm>/` contains newer modular cabinet implementations. Living School currently uses this structure.
- Active parent cabinet and console files for other realms remain directly under `public/app/`.
- Mature tools embedded by those parents live under `public/app/services/<realm>/`.

Do not force every realm into one structure as part of an unrelated repair.

## Paths that are not normal edit targets

Unless the task explicitly names one of these surfaces, do not implement current cabinet behavior in:

- `public/cabinet/`
- root-level historical pages such as `public/cabinet-v*.html`
- root-level historical pages such as `public/civweave-v*.html`
- `public/index_old.html` or files with backup, old, legacy, supplied, or similar archival naming
- copied `www/app/` directories inside installer or release bundles
- ZIP archives or extracted package mirrors
- `public/cabinetonly/index.html`, which is a redirect rather than the cabinet implementation

Do not hand-edit generated installer copies to make a source bug appear fixed. Fix canonical files under `public/app/`, update package manifests or cache lists where necessary, run verification, and regenerate the package.

## Required investigation before editing

For any cabinet or cross-realm task:

1. Read `public/app/fullscreen-family-v104.html`.
2. Inspect recent commits affecting the active entry and its dependencies.
3. Search the repository for every reference to the file, version marker, route, DOM ID, storage key, and service-worker cache entry you expect to change.
4. Determine whether the visible surface is a parent page, an embedded `services/<realm>/` page, or both.
5. Confirm whether installer, service-worker, verifier, and workflow files retain exact filename lists.
6. Edit the smallest canonical surface that owns the behavior.

### Mandatory system-of-practice lookup

Before adding or changing any cross-cutting button handler, global event listener, loader, overlay, shared state store, service-worker hook, or shared runtime:

1. Read `docs/architecture/systems-of-practice.md`.
2. Read `config/system-ownership.json`.
3. Identify the existing capability owner and canonical control/event/API.
4. Search the active route graph for every existing owner, subscriber, caller, compatibility shim, and retired implementation.
5. **If the capability already exists, extend or repair its declared owner. Do not add a parallel owner.**
6. If duplicated ownership already exists, consolidation is the task. Do not add a third path to bridge the first two.
7. Any intentional ownership change must update the registry, executable verifier, and documentation in the same pull request.
8. Run `node scripts/verify-system-ownership-v317.mjs` for any file covered by the ownership registry.

A visible button does not own its behavior merely because it is nearby. Realm-specific markup may expose a canonical shared control, but it may not independently intercept that control. Browser prototypes and globals must never be patched to compensate for an implementation bug that can be fixed at its source.

Useful local commands include:

```bash
git log --date=short --name-status -- public/app public/extensions public/service-worker* scripts .github/workflows
git log -n 20 --oneline -- public/app/fullscreen-family-v104.html
rg "exact-file-name|version-marker|storage-key|element-id" public scripts .github
```

If recent commits and an older document disagree, prefer the active route and current code. Update documentation when the disagreement could mislead another worker.

## Versioned-file rules

Many filenames are stable compatibility boundaries even when their internal build markers advance.

- Do not create a higher-numbered file merely because you changed it.
- Preserve the current filename unless the task or release process requires a version bump.
- When a filename changes, update every caller, redirect, verifier, workflow path filter, service-worker cache list, installer manifest, and documentation reference in the same change.
- Search for the old filename after the edit. Remaining references must be intentional.
- Keep query-string cache revisions coherent with the actual files being loaded.

## Root hygiene

Treat the repository root as a control surface, not a storage location.

- New general documentation belongs under `docs/`.
- Versioned release notes, audits, design backlogs, and retired implementation records belong under `docs/history/` in the appropriate category.
- Workflow touch/sentinel files belong under `ops/triggers/`, never as hidden files at `/`.
- Keep only runtime entrypoints, tool-required configuration, stable pointer documents, and explicitly grandfathered executable contracts at the root.
- Do not add a new root Markdown file simply because it is convenient for one release.
- If an executable contract genuinely must remain at root because code or packaging consumes that exact path, document that exception in `scripts/verify-root-hygiene.mjs` rather than weakening the rule.
- Run `node scripts/verify-root-hygiene.mjs` after changing root layout, docs placement, or workflow sentinels.

The root-hygiene workflow rejects unapproved root Markdown and root-level trigger/materialize/watchdog sentinels. Prefer adding an index or link to a folder over adding another root artifact.

## Cabinet ownership boundaries

### Shared family shell

`public/app/family-shell-v104.js` and `public/app/family-shell-v104.css` own shared cabinet chrome and family navigation. A realm-specific visual or behavior change should not be placed here unless it truly applies across the family.

### Civweave

Begin with `public/app/working-campus-v156.html`, then follow its loaded assets and runtimes.

### Living School

Begin with `public/app/cabinets/living-school/index.html`. Its modular cabinet code, styles, bootstrap, and loaders belong under `public/app/cabinets/living-school/`. Supporting learning engines and mature service modules may live under `public/app/services/living-school/`.

Do not patch an older flat Living School page just because it contains similar labels.

### Cerbanimo

Begin with `public/app/realm-console-v140.html?system=cerbanimo&cabinet=1`, then trace Cerbanimo-specific routes, engines, and service surfaces from that console.

### FellowFare

Begin with `public/app/fellowfare-cabinet-v144.html?cabinet=1`. The parent cabinet and the embedded market under `public/app/services/fellowfare/` can both affect the visible result. Inspect both before changing layout, scrolling, navigation, or Rook behavior.

### Anarchadia

Begin with `public/app/anarchadia-console-v139.html?cabinet=1`, then follow governance, sovereignty, and embedded service dependencies from that entry.

## Cross-cutting constraints

Preserve these architectural expectations unless the task explicitly changes them:

- Offline-first operation is primary.
- Hosted services widen capability but must not become mandatory for basic local work.
- Shared Settings input belongs only to `public/app/settings-gateway-v317.js`; the presentation belongs to `public/app/model-settings-controller-v173.js`. Do not add duplicate Settings listeners, loaders, overlays, repair interceptors, or realm-local Settings implementations.
- Living School uses the same shared family Settings control and canonical Settings surface as Cerbanimo, FellowFare, and Anarchadia.
- The global five-system navigation belongs to the family shell. Embedded realm pages should not create a second competing switcher.
- Canonical cross-realm state and capability semantics live in shared contracts and parity code, not in visually convenient duplicates.
- Generated installer assets follow source changes; they do not lead them.

## Verification

Run the narrowest relevant verifier while developing, then the repository checks appropriate to the change.

For cross-cutting ownership changes:

```bash
node scripts/verify-system-ownership-v317.mjs
```

For broad runtime changes:

```bash
npm run check
```

For installer or packaged-runtime changes, run the relevant installer verifier and then:

```bash
npm run build:install
```

For documentation-only changes, verify every named path against the current branch and inspect the Markdown diff.

A task is not complete when only a legacy copy works. Confirm the route reached from `fullscreen-family-v104.html` uses the changed code.

## Commit and pull-request hygiene

- Keep unrelated legacy cleanup out of feature repairs.
- Name the active surface in the commit or pull-request summary.
- Explain whether the change affects the parent cabinet, embedded service, shared shell, package cache, or several of these.
- List the verification performed.
- When a migration intentionally retires an old path, say so and update this file plus the README.

When uncertain, stop wandering through similarly named rooms and return to the dispatcher. It is the map pinned to the front door.

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
- Preserve completed bundle IDs and history. Rebases may rewrite unfinished work only.
- A scheduled rebase is planning-only. Do not hide production feature changes inside it.
- When the queue is exhausted, create the next epoch from fresh screenshots, redacted feedback, incidents, measurements, and current code. The old plan is a structural example, not the source of truth.

The pipeline coordinates work. It does not grant authority. Human approval remains required for merge, compatibility removal, destructive migration, paid-service activation, and high-stakes governance or economic actions.

## Canonical release storage

- `releases/1.0.79/` is the first immutable Civweave launch snapshot and launch baseline.
- The executable release selected by `VERSION` lives at `releases/{VERSION}/`; stable `server/*.mjs` entrypoints select that stored release directly.
- New shipping versions must materialize their release directory with `npm run release:materialize` before they can pass the canonical launch gate.
- Root server aliases, root symlinks, `releases/1.0.81/server/`, and a live `archive/` directory are forbidden. Git history is the archive.
