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

The repository root is a control surface, not an archive. Keep root files limited to runtime entrypoints, tool-required configuration, and stable compatibility pointers.

- [`docs/`](./docs/) - current engineering and product documentation.
- [`docs/contracts/`](./docs/contracts/) - stable architecture and behavior contracts.
- [`docs/operations/`](./docs/operations/) - installation, hosting, and deployment guidance.
- [`docs/roadmap/`](./docs/roadmap/) - long-horizon pipeline, rebase, and renewal procedures.
- [`docs/history/`](./docs/history/) - versioned release notes, audits, design backlogs, inventories, and other historical records.
- [`server/`](./server/) - stable server entrypoints; versioned compatibility implementations live under `server/compat/`.
- [`archive/runtime/`](./archive/runtime/) - historical server wrappers retained for provenance.
- [`ops/triggers/`](./ops/triggers/) - workflow sentinel files used to deliberately trigger materialization or recovery jobs.
- [`scripts/`](./scripts/) - verification, migration, packaging, and maintenance tools.
- [`.github/workflows/`](./.github/workflows/) - CI and automation definitions.
- [`RELEASE-NOTES.md`](./RELEASE-NOTES.md) - stable pointer to the historical release-note collection.

Do not add new versioned Markdown reports, hidden trigger files, or full versioned server implementations to the repository root. `scripts/verify-root-hygiene.mjs` and the root-hygiene workflow enforce this boundary. Legacy root server names may exist only as lightweight compatibility pointers.

## Current cabinet entry map

`public/app/fullscreen-family-v104.html` is the active installed cabinet-family dispatcher. On the current `main` branch it opens:

| System | Active entry |
| --- | --- |
| Civweave | `public/app/working-campus-v156.html` |
| Living School | `public/app/cabinets/living-school/index.html` |
| Cerbanimo | `public/app/realm-console-v140.html?system=cerbanimo&cabinet=1` |
| FellowFare | `public/app/fellowfare-cabinet-v144.html?cabinet=1` |
| Anarchadia | `public/app/anarchadia-console-v139.html?cabinet=1` |

These filenames are versioned compatibility boundaries. The route table above is more authoritative than an older page, similarly named directory, generated installer copy, or historical release note.

## Where current work belongs

- `public/app/fullscreen-family-v104.html` - canonical installed family dispatcher.
- `public/app/family-shell-v104.js` and `public/app/family-shell-v104.css` - shared cabinet chrome and navigation behavior.
- `public/app/cabinets/<realm>/` - modular cabinet implementations. Living School is currently developed here.
- `public/app/*-cabinet-v*`, `public/app/*-console-v*`, and `public/app/working-campus-v*` - active realm parent surfaces referenced by the dispatcher.
- `public/app/services/<realm>/` - mature embedded realm tools and internal surfaces used by cabinet parents.
- `public/app/shared/` - shared contracts, parity state, and cross-realm runtime code.
- `public/extensions/` - optional cross-cutting capabilities loaded by the installed package.
- `server/` - stable host, local, development, and federated runtime entrypoints.
- `scripts/` and `.github/workflows/` - verification, packaging, and release automation.

Before changing a cabinet, inspect the newest commits touching its active entry and follow its imports, scripts, stylesheets, iframes, and service-worker references. Recent work may have moved one realm without moving the others.

## Legacy and generated paths

The repository retains older interfaces for migration history, comparison, and compatibility. They are not automatically valid edit targets.

Do not edit these by default:

- `public/cabinet/`
- root-level historical pages such as `public/cabinet-v*.html`, `public/civweave-v*.html`, `public/index_old.html`, and backup variants
- copied `www/app/` trees inside installer or release bundles
- ZIP contents and other generated package mirrors
- `public/cabinetonly/index.html`, which is only a compatibility redirect
- `server/compat/` and `archive/runtime/` unless the task explicitly concerns compatibility or migration behavior

Change one of those only when the task explicitly concerns that legacy surface, redirect, or generated artifact. Canonical source changes belong in `public/app/` or a stable `server/` entrypoint first. Regenerate packages afterward rather than hand-editing their copies.

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

**Trace from the active dispatcher, edit the referenced source, verify the route, then regenerate downstream packages.** This keeps the living cabinet from being patched in one room while workers repaint an abandoned hallway elsewhere in the repository.