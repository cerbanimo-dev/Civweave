# Civweave v1.0.93

## Local-first installed launch

- `Open Civweave` now enters the installed-entry boundary instead of reopening the installer/download hub.
- Installed boot selects the cached canonical system route immediately and does not wait for manifest fetches or service-worker refresh work.
- Canonical system navigation is cache-first for an already-installed route; network access is retained as a repair/fill path.
- Explicit update and online recovery paths remain available without becoming boot dependencies.

## Responsive AI Settings

- Local-AI management mounts after the settings surface gets its first paint.
- The local-AI bootstrap yields between module loads to keep mobile UI responsive.
- Active model-download progress patches only the affected row instead of rescanning the entire model catalogue on every progress pulse.

## Forward-port

This release is layered on Civweave 1.0.92 and preserves the intervening Learning Pack, local-model/runtime, portable ZIP, marketplace, and federation work already present on `main`.
