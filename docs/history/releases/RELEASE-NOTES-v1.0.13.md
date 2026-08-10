# Civweave v1.0.13

## Canonical Working Campus core-only startup

This release fixes two startup failures that persisted across Render and Cloudflare Pages:

- Render logged `Document navigation interrupted script loading` from `civweave-additions-v156.js`.
- Cloudflare briefly painted the Working Campus, then left a black surface containing only the version marker.

The canonical Working Campus was loading its own complete runtime and then automatically layering the global compatibility bundle over it. That second bundle introduced another guide, viewport controller, update controller, shared-tools loader, navigation observers, and additional settings paths during the same startup window.

v1.0.13 gives `/app/working-campus-v156.html` a strict core-only boundary:

- the canonical campus is always authorized and never redirected to the installer
- it appends zero global compatibility scripts during startup
- persistent guide, shared additions, and update-controller layers remain available to legacy realm pages but do not overlay the canonical campus
- navigation teardown in shared additions becomes silent rather than logging a false startup failure
- the installed-entry launcher routes onward immediately instead of waiting on a blank document
- Render and Cloudflare use the same idempotent build policy and script revisions

## Release-coherent campus source

The five `working-campus-v156.part*.txt` runtime fragments are now release-pinned, network-first text assets with cached offline fallback. They can no longer be mixed across releases by the old cache-first policy.

The release-version synchronizer advances the service-worker core cache namespace to the current Civweave version, preventing v1.0.13 from inheriting the old `civweave-shell-1.0.7-*` and `civweave-runtime-1.0.7-*` lanes.

## Regression coverage

The release includes executable checks proving that:

- the canonical Working Campus causes no redirect and appends zero global scripts
- legacy installed realm pages still receive their compatibility bundle
- campus source fragments prefer the network and fall back to cache offline
- the complete layered service worker evaluates together
- earlier redirect-safety and shell-repair tests remain valid for future versions instead of being pinned to one release number
