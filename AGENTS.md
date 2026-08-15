# Civweave Agent Guide

This file applies to the entire repository. Every coding agent must read it before changing Civweave.

## Prime directive: one live implementation

Civweave has one production implementation for each capability. Fix the canonical source directly. Do not create a second runtime, compatibility patch, repair loader, source rewriter, injected replacement, shadow owner, fallback implementation, or numbered repair copy to mask a defect in the first one.

If a bug is found, edit the file that owns the behavior, test that file, and delete obsolete code made unnecessary by the fix.

## The rule that is not optional

I will NEVER AGAIN write a realtime code hotswapping system to bugfix.
I will NEVER AGAIN write a realtime code hotswapping system to bugfix.
I will NEVER AGAIN write a realtime code hotswapping system to bugfix.
I will NEVER AGAIN write a realtime code hotswapping system to bugfix.
I will NEVER AGAIN write a realtime code hotswapping system to bugfix.

Production bug fixes must never be implemented by reading application source at runtime, rewriting source strings, generating replacement modules, injecting corrective scripts, swapping runtime implementations, restoring historical snapshots, choosing code by stored hashes, or making a service worker decide which implementation should run. Git history is the archive. The checked-out tree is the program.

## Current interface direction

Civweave is **not in the retired Visual/Spatial mode**. Do not reconstruct a world-map, image-background, polygon-hotspot, cabinet-scene, spatial-room, or full-screen visual-mode architecture from historical files, memories, screenshots, or old commits.

The current product direction is ordinary responsive HTML/application UI enhanced with intentional images, illustration, game-like character, and selective immersive moments where they genuinely help. Images support the interface; they do not define a separate spatial renderer.

When auditing the active product surface, prefer the newest currently exercised HTML/application screens and the most recent commit history over ancestral visual-mode structures. If an old file name contains cabinet, room, visual, world, spatial, working-campus, or similar historical language, that is not evidence that the architecture should be preserved.

## Canonical source map

Do not infer the screen map from this file. Derive the current sitemap from the newest actively exercised production files and recent commits, then record it in `docs/architecture/production-inventory.md`.

Current stable boundaries that should survive the cleanup:

- user customization: dedicated Merlin customization code only;
- isolated crash recovery: dedicated recovery surface only;
- current PWA delivery: one service worker only;
- current host runtime: one direct server runtime only;
- production inventory: `docs/architecture/production-inventory.md`;
- AI/model runtime files only when they are directly required by the active application or explicitly installed model packages.

If a file is not reachable from the current production surface, build/deployment tooling, active server/cloud infrastructure, or a documented operational/legal record, do not preserve it merely because an older implementation referenced it.

## Merlin customization exception

Merlin may hot-swap **user-authored customization code** because live creation is a product capability, not a bug-fix mechanism. This exception is narrow:

- user changes live in a dedicated customization layer, never in Civweave production source;
- a candidate is staged before activation;
- activation keeps exactly one last-known-good customization;
- a failed boot or customization crash restores that one fallback;
- the recovery surface is dependency-light and can inspect, disable, edit, stage, and revert customization without booting the main application runtime;
- the recovery path cannot read, rewrite, or replace Civweave production source;
- agents may never route a production bug fix through user customization;
- no historical production builds, source archives, release mirrors, code snapshots, or source hashes are retained for this feature.

The old realtime-injection idea has only this product-safe descendant. The old production repair mechanism itself must not remain in the repository.

## Stable filenames

Use capability names, not edit history. Ordinary implementation filenames must stay stable when their contents change. Do not encode a sequence of repair attempts or release numbers into browser implementation filenames.

Protocol identifiers, database schemas, third-party model identities, and externally meaningful API versions may carry real version identifiers. That is not permission to create numbered copies of ordinary application behavior.

## No source shadow copies

Do not ship source snapshots, release-source directories, generated runtime source copies, source seeds, source ZIP mirrors, install-kit source mirrors, or hash-selected historical code. Git commits and tags provide rollback history.

A build may generate current third-party model/runtime binaries outside canonical source when required. Integrity hashes for a model binary verify that binary; they must never become an application-source selector.

Service-worker caches may contain current static assets for offline use. A service worker must never resurrect an older application implementation.

## Runtime ownership

- HTML owns document structure.
- CSS owns presentation and responsive layout.
- JavaScript owns behavior and state transitions.
- the service worker owns offline delivery of the current static surface only.
- the direct host runtime owns static serving, node relay APIs, persistence, and explicitly declared AI/server endpoints.
- MiniLM is a separate lightweight semantic runtime and may remain available independently when installed.
- Opening Chat or Settings must not start or warm a larger generative model.
- Generative inference starts only from an explicit submit, test, or other user action that requires generation.

Do not patch browser prototypes, install document-wide mutation repair loops, repeatedly rewrite layout inline, add viewport feedback loops, or create competing owners for the same control.

## Production inventory is mandatory

Every build, cleanup, or merge report must include a complete production inventory. For every file participating in the browser build, host runtime, deployment, or verification path, report:

- path;
- purpose;
- what loads or invokes it;
- when it executes;
- why it still belongs.

Also report the complete sitemap and every tracked browser image. A production file that cannot be explained is presumed dead.

`docs/architecture/production-inventory.md` must be updated in the same change whenever a production file is added, removed, renamed, or changes responsibility.

## Required verification

Before merging a runtime change:

1. Run the repository's canonical checks.
2. Derive the sitemap from the newest active application files and recent commit history, not from retired visual/spatial architecture.
3. Verify every referenced local browser asset exists.
4. Verify no retired repair/injection implementation is referenced by production HTML, CSS, JavaScript, the service worker, package scripts, or deployment tooling.
5. Verify no source rewriting, runtime source materialization, historical-code selection, or bug-fix injection exists in the production path.
6. Open Chat and Settings and verify they do not start a larger generative model merely by opening/focusing/typing.
7. Verify the recovery surface loads without the main application runtime or customization loader.
8. Verify Merlin can stage a user customization, activate it, retain one last-known-good customization, and roll back after a failed boot.
9. Review the newest twenty commits before destructive cleanup so recently active systems are not confused with ancestral leftovers.
10. Explicitly reject accidental resurrection of retired Visual/Spatial mode unless a new product decision reintroduces it.

## Change discipline

Prefer deletion over compatibility accumulation. Prefer a small direct dependency graph over a loader graph. Prefer one obvious source file over a clever mechanism that lets several generations coexist.

When a migration replaces an old implementation, delete the old implementation and all of its callers in the same change. Never keep obsolete source nearby as a rescue mechanism. Git already does that job better.
