# Civweave

Civweave is an offline-first, installable family of five connected workstations:

- Civweave
- Living School
- Cerbanimo
- FellowFare
- Anarchadia

The public host is deliberately small. It distributes and updates the device package, exposes optional network services, and keeps the installed software capable of operating locally.

> [!IMPORTANT]
> **Cabinet development currently lives under `public/app/`.** Start with `public/app/fullscreen-family-v104.html`, then follow the exact file it routes to for the realm you are changing. Do not choose a folder because its name merely sounds current.

Agents and automated contributors must read [`AGENTS.md`](./AGENTS.md) before editing this repository.

## Repository map

The canonical repository atlas is [`docs/architecture/repository-map.md`](./docs/architecture/repository-map.md). It records the current source areas, active installed-family route snapshot, shared capability landmarks, release/materialization boundaries, generated/legacy exclusions, and verification landmarks.

The repository root is a control surface, not an archive. Keep root files limited to runtime entrypoints, tool-required configuration, stable pointer documents, and explicitly required executable contracts.

High-level areas:

- [`public/app/`](./public/app/) - active installed application surfaces and browser/client runtime.
- [`public/extensions/`](./public/extensions/) - optional cross-cutting installed-package capabilities.
- [`config/`](./config/) - declarative ownership and policy/configuration registries.
- [`lib/`](./lib/) - shared Node/service logic.
- [`cloudflare/`](./cloudflare/) - Cloudflare Workers and hosted network services.
- [`server/`](./server/) - stable local, development, federated, and gateway entrypoints.
- [`scripts/`](./scripts/) - verification, migration, packaging, release, and maintenance tools.
- [`.github/workflows/`](./.github/workflows/) - CI and automation definitions.
- [`ops/triggers/`](./ops/triggers/) - workflow sentinel files used to deliberately trigger materialization or recovery jobs.
- [`docs/`](./docs/) - current engineering and product documentation.
- [`releases/`](./releases/) - immutable materialized shipping releases selected through `VERSION`.
- [`RELEASE-NOTES.md`](./RELEASE-NOTES.md) - stable pointer to the historical release-note collection.

Do not create a live `archive/` tree, retired implementation archive, root server alias, root symlink, hidden root trigger file, or convenience Markdown report at repository root. Git history is the archive. `scripts/verify-root-hygiene.mjs` and release-discipline checks enforce these boundaries.

## Current cabinet entry map

`public/app/fullscreen-family-v104.html` is the active installed cabinet-family dispatcher. It currently opens:

| System | Active entry |
| --- | --- |
| Civweave | `public/app/working-campus-v156.html` |
| Living School | `public/app/cabinets/living-school/index.html` |
| Cerbanimo | `public/app/realm-console-v140.html?system=cerbanimo&cabinet=1` |
| FellowFare | `public/app/fellowfare-cabinet-v144.html?cabinet=1` |
| Anarchadia | `public/app/anarchadia-console-v139.html?cabinet=1` |

The dispatcher appends installed-package state when it routes. This table is a route snapshot, not an architectural ownership contract. Keep the canonical copy in [`docs/architecture/repository-map.md`](./docs/architecture/repository-map.md) synchronized when the dispatcher changes.

## Where current work belongs

- `public/app/fullscreen-family-v104.html` - canonical installed family dispatcher.
- `public/app/family-shell-v104.js` and `public/app/family-shell-v104.css` - shared cabinet chrome and navigation behavior.
- `public/app/cabinets/<realm>/` - modular cabinet presentation implementations where actively routed. Living School is currently developed here.
- `public/app/*-cabinet-v*`, `public/app/*-console-v*`, and `public/app/working-campus-v*` - active realm parent surfaces referenced by the dispatcher.
- `public/app/services/<realm>/` - embedded realm tools and internal surfaces used by active parent surfaces.
- `public/app/shared/` - shared contracts, parity state, and cross-realm runtime code.
- `public/extensions/` - optional cross-cutting capabilities loaded by the installed package.
- `server/` - stable host, local, development, and federated runtime entrypoints.
- `scripts/` and `.github/workflows/` - verification, packaging, and release automation.

Presentation location does not determine functional ownership. For shared behavior, consult `docs/architecture/systems-of-practice.md` and `config/system-ownership.json` before editing a realm/page surface.

Before changing a cabinet, inspect the newest commits touching its active entry and follow its imports, scripts, stylesheets, iframes, shared owners, and service-worker references. Recent work may have moved one realm without moving the others.

## Legacy and generated paths

Older, generated, compatibility, and materialized surfaces are not automatically valid edit targets.

Do not edit these by default:

- `public/cabinet/` when it is not part of the active route;
- root-level historical pages such as `public/cabinet-v*.html`, `public/civweave-v*.html`, `public/index_old.html`, and backup variants when they are not actively routed;
- copied `www/app/` trees inside installer or release bundles;
- ZIP contents and other generated package mirrors;
- compatibility redirects such as `public/cabinetonly/index.html` when their only purpose is delegation;
- `releases/{VERSION}/` or older materialized release trees as ordinary source-edit targets;
- files in `docs/history/` as architectural authority.

Change one of those only when the task explicitly concerns that compatibility, migration, generated-output, or release-materialization boundary. Canonical source changes belong in the active functional owner first. Regenerate packages or materialize a new release afterward rather than hand-editing their copies.

A live `archive/` directory and retired implementation folders are forbidden. Git history is the archive.

## Host and installed-runtime topology

The host has two related roles:

1. `/` serves installation, updates, release metadata, and optional gateway APIs.
2. The installed device package serves the Civweave application family locally.

Within an installed package, `/loom/`, `/lite/`, and `/cabinetonly/` are compatibility aliases for the full-screen family entry. The public hosted origin may intentionally refuse to run application surfaces directly and instead require local installation.

The current built-in public host retains its compatibility address until deployment infrastructure is renamed:

`https://civweave-host-node.onrender.com`

## Local development

Requires Node.js 22.

```bash
npm start
```

Useful checks:

```bash
npm run check
node scripts/verify-root-hygiene.mjs
```

Build install artifacts only after canonical source changes and verification:

```bash
npm run build:install
```

For LAN use, the server binds to `0.0.0.0` by default. Full PWA installation and service workers require HTTPS or `localhost`; a plain LAN IP may not receive every browser installation capability.

See [`docs/operations/host-node-setup.md`](./docs/operations/host-node-setup.md) for local, Docker, LAN, and Render setup.

## Development rule of thumb

**Find the functional owner, trace the active route that reaches it, edit the canonical source, verify the route, then regenerate downstream packages.** This keeps presentation code from becoming a second owner and keeps generated output from becoming a competing source tree.

## Canonical release storage

- `releases/1.0.79/` is the first immutable Civweave launch snapshot and launch baseline.
- The executable release selected by `VERSION` lives at `releases/{VERSION}/`; stable `server/*.mjs` entrypoints select that stored release directly.
- New shipping versions must materialize their release directory with `npm run release:materialize` before they can pass the canonical launch gate.
- Root server aliases, root symlinks, `releases/1.0.81/server/`, and a live `archive/` directory are forbidden. Git history is the archive.
