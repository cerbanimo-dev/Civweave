# Civweave v1.0.12

## Self-healing installer shell

This release fixes the installer dead-end reported on the Render deployment:

> App-shell preparation failed: 12 required shell files are missing.

Opening the installer registers a service worker even before Civweave is installed. A worker could become active after its versioned shell cache had been cleared or left empty, then report `0/12` files and turn the primary action into a reset loop.

v1.0.12 changes that behavior:

- the worker may activate with an incomplete shell instead of becoming permanently redundant
- the first package-status request automatically retries every required shell asset
- explicit `REPAIR_DEVICE_PACKAGE` messages trigger the same resumable repair
- failed asset paths and messages are retained in the returned package status
- the online Working Campus is always reachable without installation or offline readiness
- the installer contains a direct HTML link to the online campus, independent of recovery JavaScript
- when shell preparation fails, the primary action becomes **Open Civweave online** and the update action becomes **Repair shell**
- the online route opens `/app/working-campus-v156.html` directly rather than the legacy blank `/app/` launcher

The offline campus, saved knowledge schools, local models, credentials, intentions, and IndexedDB state remain separate and preserved.

Regression coverage reproduces an initial `0/12` shell, verifies that the worker remains active, retries the cache, reaches `12/12`, and confirms the complete imported worker stack evaluates together.
