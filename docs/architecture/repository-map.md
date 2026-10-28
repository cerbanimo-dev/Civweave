# Civweave Repository Map

This document is the repository atlas for humans and coding agents. Use it to answer **where should I look first?** and **which paths are authoritative?** before editing.

It is a navigation document, not a substitute for the architectural contracts. If this map disagrees with the canonical interface/runtime contract, the ownership registry, or the active implementation, those sources win and this map must be corrected in the same change.

## Read this first

Before choosing an edit target, use this order:

1. Read `AGENTS.md`.
2. Read `config/agent-work-context.json` for the machine-readable branch, protected-path, test-first, guide-memory, mesh-conflict, and developer-tool guardrails.
3. Read `docs/contracts/mobile-interface-contract.md` for interface/runtime rules.
4. Read `docs/architecture/systems-of-practice.md` when the task affects shared behavior.
5. Read `config/system-ownership.json` when the capability is registered there.
6. Use this map to locate the likely implementation area.
7. Trace the active implementation, callers, subscribers, loaders, storage keys, service-worker references, and workflows before editing.

The repository is organized around **functional ownership**, not around screens, rooms, cabinets, realms, images, or visual placement.

## 60-second routing guide

### I am changing installed Civweave UI or client behavior

Start in `public/app/`.

- If the symptom is on a concrete visible system surface, trace from `public/app/system-routes-v227.js` and `public/app/persistent-system-shell-v1.html` to the active system entry.
- If the behavior is shared across systems, identify the owner in `docs/architecture/systems-of-practice.md` and `config/system-ownership.json` before editing a page.
- Shared presentation/runtime code commonly lives in `public/app/shared/` and other explicitly named shared owners under `public/app/`.
- Optional installed-package capabilities may live under `public/extensions/`.

Do **not** create a second behavior owner in a realm page merely because that page displays the control.

### I am changing chat, Settings, navigation, local AI, messaging, radio, review, or another shared capability

Start with:

- `docs/architecture/systems-of-practice.md`
- `config/system-ownership.json`

Then edit the declared owner and its callers/subscribers as needed. Do not attach another listener, loader, polling loop, overlay, store, or runtime to work around the current owner.

### I am changing the local/federated/server runtime

Start in `server/` for stable runtime entrypoints and follow the selected release/runtime they load.

The current stable server entrypoints are:

- `server/gateway.mjs`
- `server/gateway-base.mjs`
- `server/local.mjs`
- `server/federated.mjs`
- `server/dev.mjs`

Shared Node/service domain code may live under `lib/`.

### I am changing Cloudflare-hosted network behavior

Start in `cloudflare/`, then trace the exact Worker/service entry and its shared libraries/configuration. Hosted services extend the offline-first installed system; they do not become the owner of basic local application behavior merely because they can provide it online.

### I am changing build, release, installer, migration, or verification behavior

Start in:

- `scripts/`
- `.github/workflows/`
- `package.json`
- `VERSION`

Canonical source changes happen before generated installers or materialized releases. Regenerate downstream artifacts; do not hand-edit generated copies as if they were source.

### I am changing product/engineering documentation

Use `docs/` unless the file is one of the intentionally stable root control documents.

- `docs/contracts/` — canonical behavior and architecture contracts.
- `docs/architecture/` — ownership maps and repository architecture.
- `docs/operations/` — installation, hosting, deployment, and operator guidance.
- `docs/roadmap/` — long-horizon pipeline/rebase/renewal procedures.
- `docs/history/` — genuine historical records such as release notes, audits, inventories, and design records.

Git history is the archive for obsolete implementations. Do not create a live `archive/` tree.

## Authority order

When files disagree, use this precedence:

1. Explicit user instruction for the current task.
2. Security, privacy, data-preservation, and recovery constraints.
3. `docs/contracts/mobile-interface-contract.md`.
4. `docs/architecture/systems-of-practice.md`.
5. `config/system-ownership.json`.
6. The active canonical implementation and its current callers/subscribers.
7. The active presentation route for determining what actually renders.
8. This repository map for navigation.
9. Older README prose, historical notes, generated packages, and release records.

`config/agent-work-context.json` is an executable navigation/guardrail aid within this authority order; it does not override the canonical contracts or active owner.

Presentation routing is evidence about composition. It is not permission to redefine functional ownership.

## Directory atlas

| Path | Primary role | Editing rule |
| --- | --- | --- |
| `public/app/` | Active installed application surfaces and client runtime | Primary starting point for installed UI/client changes. Trace active routes and ownership first. |
| `public/app/shared/` | Shared browser/runtime contracts and cross-system code | Edit only when the shared capability belongs here; avoid realm-specific forks. |
| `public/app/cabinets/` | Modular presentation surfaces where currently used | A cabinet may present capabilities but does not automatically own them. |
| `public/extensions/` | Optional cross-cutting installed-package capabilities | Follow the extension’s explicit contract and callers. |
| `public/` | PWA shell, installer, service workers, public static/runtime assets | Change canonical source here when the owning runtime really lives here; keep caches and manifests coherent. |
| `server/` | Stable local/dev/federated/gateway entrypoints | Keep entrypoint names stable unless the release contract requires a coordinated change. |
| `lib/` | Shared Node/service logic | Prefer shared domain logic here over duplicating it in entrypoints. |
| `cloudflare/` | Cloudflare Workers and hosted network services | Treat as optional network capability, not a replacement for offline-first ownership. |
| `config/` | Declarative ownership, policy, and agent work-context registries | Keep `system-ownership.json` synchronized with owners and `agent-work-context.json` synchronized with branch/path/testing/memory/tool guardrails. These files describe rules; they do not override higher-authority contracts. |
| `scripts/` | Build, release, migration, verification, packaging, maintenance | Prefer deterministic tooling; avoid runtime repair/self-patching machinery. |
| `.github/workflows/` | CI, automation, deployment/release workflows | Keep path filters and generated-artifact expectations synchronized with source moves. |
| `ops/triggers/` | Deliberate workflow sentinel/touch files | Sentinels belong here, never as hidden files at repository root. |
| `tools/civweave-dev-mcp/` | Developer-only local PWA inspection/source-edit MCP bridge | Maintainer observation, reproduction, source editing, and verification only; never an end-user/public runtime endpoint or runtime repair path. |
| `docs/contracts/` | Canonical architecture/behavior contracts | Architectural authority. Update deliberately when the contract itself changes. |
| `docs/architecture/` | Current ownership and repository maps | Navigation/ownership documentation; keep synchronized with active owners and routes. |
| `docs/operations/` | Installation/hosting/deployment guidance | Operational documentation, not application ownership. |
| `docs/roadmap/` | Agentic pipeline and long-horizon planning | Governs unscoped pipeline work, not explicit user tasks. |
| `docs/history/` | Genuine historical records | Records only; never a source tree for retired implementations. |
| `releases/{VERSION}/` | Materialized immutable shipping release selected by `VERSION` | Do not use as the normal edit target. Change canonical source and materialize a new shipping version. |

## Active installed-family route snapshot

`public/app/system-routes-v227.js` defines the installed-family routes. `public/app/persistent-system-shell-v1.html` hosts system content in an iframe while retaining the shared navigation, Settings, and guide chat. Content entrypoints use `embed=1&persistentShell=1` under that shell. The removed fullscreen-family dispatcher is not an active source.

Current route table:

| System | Active entry |
| --- | --- |
| Civweave | `public/app/working-campus-v440.html` |
| Living School | `public/app/cabinets/living-school/index.html?cabinet=1` |
| Cerbanimo | `public/app/realm-console-v140.html?system=cerbanimo&cabinet=1` |
| FellowFare | `public/app/fellowfare-cabinet-v144.html?cabinet=1` |
| Anarchadia | `public/app/anarchadia-console-v139.html?cabinet=1` |

This table is a **route snapshot**, not an architecture contract. If the dispatcher changes, update this table in the same change. Do not infer shared-system ownership from these filenames.

Anarchadia's Governance and Workbench are native content destinations within the same persistent shell. `persistent-system-shell-v1.js` accepts only the fixed `nativePage=governance` and `nativePage=workbench` routes for Anarchadia, with allowlisted Workbench views and bounded proposal/Quest identifiers. The first-frame bootstrap uses the same fixed destinations, and the shell validates the expected content origin, path, and launch parameters. Native entry and return controls delegate to the parent's existing `CivweavePersistentSystemShellV1.navigate` owner; standalone returns preserve the installed/embedding context without creating another shell or navigation owner.

FellowFare's active entry renders its marketplace in the same document. `fellowfare-cabinet-v144.js` delegates commands and reviewed imports directly to the existing `services/fellowfare/cabinet-bridge.js` API. `services/fellowfare/marketplace-v2.js` owns marketplace state, order persistence, rendering, and current-tab state; `marketplace-v2-capabilities.js` delegates order mutations to it. The retained iframe boundary uses `postMessage` only with matching origin and parent sender checks. The native host does not emulate an iframe's `contentWindow` or `contentDocument`.

The optional Starling Guild Collective policy is owned by `public/app/shared/starling-collective-v1.mjs` (re-exported to Node by `lib/starling-collective-v1.mjs`) under `docs/contracts/starling-collective-guild-service-v1.md`. Mobile Guild founding records its provisional Intention in `public/app/mobile-guild-create-v1.mjs`; the read-only Guild Lounge is `public/app/starling-lounge-v1.mjs`; shared tool policy is `public/app/shared/starling-collective-tools-v1.mjs`, with a non-registered local Aider adapter in `tools/starling/`. This is not a replacement for Guild/Quest/governance owners; the Collective runtime is not yet activated.

## Shared capability landmarks

The canonical ownership list lives in `docs/architecture/systems-of-practice.md` and `config/system-ownership.json`. Current high-value landmarks include:

| Capability | Current landmark |
| --- | --- |
| Shared Settings input | `public/app/settings-gateway-v317.js` |
| Settings presentation and persistence | `public/app/settings-gateway-v317.js`; local-model renderers delegate saves to this owner |
| Family navigation/chrome | `public/app/themed-system-nav-v178.js` and `public/app/persistent-system-shell-v1.js` |
| Route authority | `public/app/system-routes-v227.js` |
| Guide chat workspace | `public/app/guide-workspace-v242.js` |
| Guide chat loader | `public/app/family-ai-loader-v105.js` |
| Local AI inference | `public/app/local-ai/runtime-v266.js` |
| Local AI bootstrap | `public/app/local-ai/bootstrap-v266.js` |
| Private messaging | `public/app/civweave-private-messaging-v1.js` |
| Offline object mesh | `public/app/local-object-mesh-v146.js` |
| Guild Quest publication | `cloudflare/mobile-guild-edge/src/guild-quest-publications-v1.mjs`; `public/app/guild-quest-client-v1.js` calls it through existing member sessions |
| Radio | `public/app/system-radio-agent-v233.js` |
| Review surface | `public/app/shared-review-surface-v234.js`; receipt presentation helper `public/app/shared/guide-outcome-scene-v1.js` and matching CSS |

These are navigation landmarks only. Always re-check the ownership registry and active callers before changing them because filenames and owners can move.

The persistent shell owns the single radio player in `system-radio-agent-v233.js`. Embedded content aliases the parent radio API instead of creating another player, launcher, or audio element, so changing native content does not replace playback. Direct listening uses the licensed same-origin starter catalog at `public/downloads/hub-media/open-music/starter-catalog.json`; streaming and saving individual tracks begin with explicit user actions, while Spotify remains an extension. `radio-safe-stations-v1.js` and `radio-track-suggestions-v240.js` also alias their parent owners when embedded and leave the direct-audio view to the player owner.

The shared Guild launcher uses `guild-symbol-v1.js` and the existing `host-node-installer-lobby-v1.js` owner. `boot({mount})` connects that lobby inside the installed shell before binding controls; installer placement remains the default when no mount is supplied. Load failures stay in the current surface with retry instead of navigating the installed app to the installer.

Direct audio seeking falls back to a bounded, verified in-memory blob when the static host cannot serve a requested time range. That explicit seek does not persist media; only Save offline writes the audio cache.

## Hosting and runtime model

Civweave is an offline-first installable family with optional connected services.

The runtime boundary is:

1. Public/hosted infrastructure distributes installation/update material and optional network services.
2. The installed device package runs the Civweave family locally.
3. Local and mesh operation remain primary architectural constraints.
4. Cloud services widen capability but must not silently become mandatory for core local work.

Stable `server/*.mjs` entrypoints read `VERSION` and select runtime material from `releases/{VERSION}/server/`. Treat the stable server entrypoints as control points and the selected release as materialized shipping state, not as a second editable source tree.

## Release and versioning model

`VERSION` is the release selector. Never assume the current version from an old document; read the file on the branch you are changing.

On the branch used to author this map, `VERSION` and `package.json` both identify `1.0.163`, and `releases/1.0.163/` is materialized. That number is an example of current state, not a value to hard-code into future logic.

Release flow:

1. Change canonical source.
2. Update every active caller/reference when a compatibility-boundary filename must change.
3. Run the relevant checks.
4. Update version/release metadata coherently when shipping a new version.
5. Materialize the shipping release with `npm run release:materialize`.
6. Build install artifacts after canonical source and release verification are correct.

Important invariants:

- `releases/1.0.79/` is the first immutable launch snapshot/baseline.
- The executable release selected by `VERSION` lives at `releases/{VERSION}/`.
- `releases/1.0.81/server/` is forbidden as a live compatibility implementation.
- Root server aliases and root symlinks are forbidden.
- A live `archive/` directory is forbidden. Git history is the archive.

## DO NOT EDIT AS SOURCE

Unless the task explicitly concerns migration, compatibility, release materialization, or generated output, do not treat the following as canonical edit targets:

- `releases/{VERSION}/` or older materialized release trees.
- Generated installer/package mirrors, copied `www/app/` trees, ZIP contents, or other build output.
- Historical/backup pages that are not reached by the active dispatcher or declared as current owners.
- Old versioned copies left behind by a replacement.
- Compatibility redirects or shims whose only job is to delegate to a canonical owner.
- Files in `docs/history/` as architectural authority.
- Any resurrected `archive/` tree, retired implementation folder, root server alias, root symlink, or backup implementation.

If a supposedly obsolete implementation is still active, first prove how it is reached. If a replacement makes it unnecessary, delete the predecessor and all stale references in the same change rather than preserving both.

## Common change workflows

### Visible UI bug

1. Reproduce the symptom.
2. Trace from the current active route to the rendered surface.
3. Identify the functional owner of the broken behavior.
4. Search all owners/callers/subscribers/listeners/loaders for duplicates.
5. Fix the owner rather than adding a repair layer.
6. Remove obsolete duplicate behavior.
7. Verify the active route reaches the fixed owner.

### Shared-system change

1. Read `docs/architecture/systems-of-practice.md`.
2. Read `config/system-ownership.json`.
3. Confirm one owner, allowed callers/subscribers, and the canonical API/control/event.
4. Change the owner first.
5. Update registry/docs/verifiers if the ownership boundary actually changes.
6. Prove no second input/event owner was introduced.

### Server or hosted-service change

1. Identify whether the behavior belongs to local installed runtime, stable server entrypoint, shared `lib/`, or hosted `cloudflare/` service.
2. Preserve the offline-first boundary.
3. Avoid copying the same business logic into multiple entrypoints/providers.
4. Verify the specific server/service path plus the broader release/runtime gates that apply.

### File move or rename

Update all of the following in the same change when applicable:

- imports and script/style references;
- route tables and redirects;
- service-worker cache lists;
- installer manifests and packaging scripts;
- workflow path filters;
- tests/verifiers;
- documentation;
- generated release/install material through the normal build/materialization process.

Search for the old filename afterward. A stale active reference means the move is not complete.

## Verification landmarks

Node requirement: `22.x`.

Broad repository/runtime check:

```bash
npm run check
```

This gate validates checked-in source without generating release metadata or rewriting routes. Syntax verification discovers current repository JavaScript, excludes generated vendor/materialized trees, and retains the selected release's server syntax checks. The workflow regression checks the executable verification dependency graph for retired release mutators.

Installer packaging also takes the checked-in Pages graph as its source. It generates installer assets and retains installer smoke checks; it does not run the retired route/version synchronizers that would replace current navigation.

Release-discipline check:

```bash
npm run check:release-discipline
```

Installer/package build after canonical source changes:

```bash
npm run build:install
```

Shipping release materialization:

```bash
npm run release:materialize
```

For documentation-only changes, verify every named path and route against the current branch and inspect the Markdown diff. A repository map that points at a deleted or retired file is itself a bug.

## Keeping this map current

Update this file in the same change when any of the following moves materially:

- the installed-family dispatcher or its route table;
- a canonical shared capability owner;
- a major top-level source directory or responsibility;
- stable server entrypoints;
- release/materialization rules;
- generated/legacy boundaries;
- verification commands that agents are expected to run.

Do not turn this file into a historical changelog. Keep it describing the current repository. Git history records what the map used to say.

## Survival Mode capability

The canonical cross-realm survival-assessment owner is public/app/survival/survival-mode.mjs, presented at public/app/survival/index.html with temporary camera preview and source browsing in public/app/survival/app.mjs. The existing persistent-shell-actions-v1.js supplies its launcher, and offline-package-v208.json and optional service-worker assets seed the offline page. This is not a sixth realm or chat system. See docs/contracts/survival-mode-v1.md.
