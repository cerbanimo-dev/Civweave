# Commonweave Convergence Program

Commonweave is in an architectural convergence release. The product may continue to become more useful, but its runtime may not continue to grow sideways.

## Governing rule

Preserve user data, domain contracts, offline operation, and the installed golden path. Delete duplicate execution paths, compatibility choreography, and historical runtime layers.

Every important concern must converge onto one owner:

- one active entry per realm
- one family navigation owner
- one shared AI-settings owner
- one guide runtime with realm adapters
- one delegated action controller per realm
- one canonical state writer per domain
- one generated package manifest
- one service worker consuming generated manifests
- one direct local server and one direct gateway server

## Current lock

Wave 0 is active. New rooms, runtime stacks, storage authorities, launchers, settings layers, service workers, server variants, and version-suffixed app entrypoints are frozen.

Permitted work is limited to:

1. convergence and deletion
2. user-data protection
3. security repairs
4. golden-path defects

Living School PR #178 is the only active demolition lane. Other feature branches may remain preserved, but they are not part of the active merge train until their owning realm has converged.

## Directory direction

New canonical realm implementations belong under:

```text
public/app/realms/<realm>/
```

Shared contracts and runtimes belong under:

```text
public/app/shared/
```

Compatibility aliases and state migrations must be isolated under:

```text
public/app/compat/
public/app/migrations/
```

Compatibility code must not be woven through canonical runtime files.

## Hard deletion rules

Delete a mechanism when it exists only to:

- synthesize a click on another control
- coordinate application state through a mutation observer
- preserve a hidden guide or navigation launcher
- read another realm's private storage directly
- parse runtime source to discover package metadata
- rewrite source text during server startup
- satisfy a verifier for an unreachable runtime
- retain historical code "for reference"

Git history is the archive.

## Required pull-request shape

Convergence pull requests must state:

- the single owner introduced or retained
- the duplicate owners removed
- the user data or schema preserved
- the compatibility window, if any
- the golden-path steps exercised
- the runtime files and lines deleted versus added

A realm clean room is not complete until it has one startup path, one state engine, one renderer, one action controller, one guide identity, and one settings route.

## Tooling

Build the current runtime graph:

```bash
node scripts/build-convergence-inventory.mjs
```

Enforce the active convergence lock:

```bash
node scripts/verify-convergence-guardrails.mjs
```

The inventory is written to `artifacts/convergence/` and uploaded by CI. Its `orphan`, `archive`, and `compatibility` classifications form the deletion queue. Classification is evidence for review, not automatic permission to delete user migrations.

## Sequence

1. Lock architecture and inventory the executable graph.
2. Complete the Living School clean room.
3. Introduce one declarative application manifest and stable realm entries.
4. Reduce the family shell to global chrome and adapter calls.
5. Generate installer and service-worker package lists from the manifest.
6. Replace runtime source-patched servers with direct implementations.
7. Clean-room Commonweave, Cerbanimo, FellowFare, then Anarchadia.
8. Remove compatibility aliases after their declared support window.
9. Ship the convergence release only after fresh-install, upgrade, offline, restart, keyboard, missing-model, and missing-gateway golden paths pass.

## Exit gate

Convergence is complete only when the targets in `config/convergence-policy.json` are met, including zero hidden compatibility controls, zero synthetic click relays, zero mutation-observer routers, zero runtime source rewrites, and at least a 40 percent reduction in active runtime files.
