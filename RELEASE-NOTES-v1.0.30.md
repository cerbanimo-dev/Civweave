# Commonweave v1.0.30

## Offline-first mesh and cabinet runtime repair

This release restores the intended separation between the Commonweave website and the installed local application.

### Topology

- `/` is the installer, updater, host-status, seed-download, and optional federation/trade gateway.
- `/loom/` is the Visual Commonweave PWA.
- `/lite/` is the accessible cabinet workstation renderer.
- The installed PWA is designed to continue offline from its versioned local cache.
- Host APIs, gossip, federation, release sharing, and wider trade remain optional network services.

### Cabinet fixes

- Replaced fragile browser-side base64 reconstruction with five direct validated WebP assets.
- Added strict projection containment so forms, cards, grids, long labels, and embedded tools stay inside the cabinet screen.
- Added a small system-matched cabinet launcher near the bottom center of Visual pages.
- The launcher screen shows the number of mapped workstation interactions for the current visual context.
- Cabinet workstations open as an overlay instead of navigating away from the illustrated room.
- Room surfaces retain their original in-world behavior.

### PWA fixes

- Added a root-scoped versioned service worker.
- Pre-caches the Visual shell, Lite shell, cabinet assets, parity ledger, guides, and core campus routes.
- Runtime-caches visited rooms and same-origin assets.
- Updates wait for deliberate activation.
- Restored the downloadable campus seed route.
- Rebuilt `/recover.html` as a repair flow that installs the current offline worker without deleting local user state.

### Runtime fixes

- Corrected null persisted chat history handling that caused `Cannot read properties of null (reading 'length')`.
- Removed the client-side `atob` cabinet loader responsible for malformed base64 errors.
- Kept all 5 systems, 59 rooms, 117 capabilities, and 17 golden-path steps on the shared parity ledger.

### Validation

`npm run check`

Validates syntax, the complete parity ledger, all five cabinet WebPs, installer and manifest contracts, root service worker scope, offline seed availability, Visual and Lite routes, overflow guards, boot logging, and the v1.0.30 host process.
