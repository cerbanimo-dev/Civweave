# Civweave Agent Guide

This file applies to the entire repository. Every coding agent must read it before changing Civweave.

## Prime directive: one live implementation

Civweave has one production implementation for each capability. Fix the canonical source directly. Do not create a second runtime, compatibility patch, repair loader, source rewriter, injected replacement, shadow owner, versioned fixer, or fallback implementation to mask a defect in the first one.

If a bug is found, edit the file that owns the behavior, test that file, and delete obsolete code made unnecessary by the fix.

## The rule that is not optional

I will NEVER AGAIN write a realtime code hotswapping system to bugfix.
I will NEVER AGAIN write a realtime code hotswapping system to bugfix.
I will NEVER AGAIN write a realtime code hotswapping system to bugfix.
I will NEVER AGAIN write a realtime code hotswapping system to bugfix.
I will NEVER AGAIN write a realtime code hotswapping system to bugfix.

Production bug fixes must never be implemented by reading source files at runtime, rewriting strings, generating replacement modules, injecting corrective scripts, swapping runtime implementations, restoring historical snapshots, or selecting code by stored hashes. Git history is the archive. The checked-out tree is the runtime.

## Merlin customization exception

Merlin may hot-swap **user-authored customization code** because live creation is a product capability, not a bug-fix mechanism. This exception is narrow:

- user changes live in a dedicated customization layer, never in Civweave production source;
- before activation Merlin saves exactly one last-known-good customization snapshot;
- the candidate change is isolated from the canonical app whenever possible;
- a failed health check or crash restores the last-known-good customization;
- `/recovery/` is a dependency-light Merlin recovery surface that can inspect, disable, edit, and revert customization even when the main app cannot boot;
- agents may never route production bug fixes through this customization path;
- no historical production builds, release ZIPs, source hashes, or code snapshots are retained in the shipping tree for this feature.

## Canonical production surface

The browser product is the current 16-screen Civweave world plus its shared stylesheet and shared JavaScript runtime. The canonical screens are:

1. Town Square
2. Regional World Map
3. Crossroads Station
4. Inside the Quad
5. Residential Quarter
6. Workshop District
7. Gardens & Wildlands
8. Federation Harbor
9. Archive District
10. Festival Grounds
11. Frontier Outpost
12. Undercity Commons
13. Dispatch Hall
14. Personal Chronicle
15. Community Portal
16. World Settings & Accessibility

Every screen must be reachable from the canonical screen manifest in the live JavaScript runtime. Do not add alternate copies of a screen to repair routing or layout.

## File naming

Use stable capability names, not edit-history names. Do not create filenames whose purpose is to preserve a previous implementation or encode a sequence of repair attempts.

Good: `screen.js`, `settings.js`, `service-worker.js`, `server.mjs`.

Bad: `chat-freeze-v347.js`, `settings-repair-v12.js`, `runtime-override-v4.js`, `working-campus-return-guard-v425.js`.

A protocol or external model may contain its own real version identifier when that version is part of the protocol/model identity. That is not permission to version ordinary implementation filenames.

## No release-source shadow copies

Do not ship source snapshots, release-source directories, generated runtime copies, `.seed`/`.cwseed` code archives, source ZIP mirrors, or hash-selected historical code. Git commits and tags provide rollback history. Deployment artifacts may be generated outside the tracked production tree when a deployment platform requires them, but they are not canonical source and must not be imported by the runtime.

Service-worker caches may contain current static assets for offline use. A service worker must never choose among historical application implementations or resurrect an old source file.

## Runtime ownership

- HTML owns document structure.
- CSS owns presentation and responsive layout.
- JavaScript owns behavior and state transitions.
- The service worker owns offline delivery of the **current** static surface only.
- The host server owns static serving, node relay APIs, persistence, and explicitly declared AI proxies.
- MiniLM may remain resident as the lightweight semantic/router model when the user has installed it. Opening Chat or Settings must not start a generative model.
- Generative inference starts only from an explicit user request that requires it.

Do not patch browser prototypes, install document-wide mutation repair loops, repeatedly rewrite layout inline, or create competing owners for the same control.

## Production inventory is mandatory

Every build, cleanup, or merge report must include a complete production inventory. For every file participating in the build or runtime, report:

- path;
- purpose;
- what loads or invokes it;
- whether it executes at runtime, build time, deployment time, or test time;
- why it still belongs in the repository.

Also report the full 16-screen sitemap and the asset used by each screen. A file that cannot be explained is presumed dead and should be removed or explicitly justified before merge.

## Required verification

Before merging a runtime change:

1. Run the canonical repository check.
2. Verify all 16 screen routes resolve.
3. Verify every referenced local asset exists.
4. Verify no production HTML/JS/CSS references retired versioned fixer filenames.
5. Verify no source-rewriting, runtime materialization, historical-code selection, or bug-fix injection mechanism exists in the production path.
6. Open Chat and Settings and verify they perform no generative-model prewarm.
7. Verify `/recovery/` loads without importing the main application runtime.
8. Verify Merlin customization can stage a candidate, keep one last-known-good customization, and revert after a failed health check.

## Change discipline

Prefer deletion over compatibility accumulation. Prefer a small direct dependency graph over a loader graph. Prefer one obvious source file over a clever mechanism that makes several generations coexist.

When a migration intentionally replaces an old implementation, delete the old implementation and all of its callers in the same change. Never leave it nearby as a future rescue mechanism. Git already does that job better.
