# Anarchadia RC19.4 — World Engine Migration

All nine illustrated Anarchadia rooms now run through the Commonweave World Engine.

- Data-driven scenes replace room-specific hotspot rendering.
- Existing portrait and landscape artwork remains responsive.
- Every visual station routes to its existing visual room, classic workbench, modal, or civic action.
- Each room includes a resident with deterministic dialogue, ambient civic activity, and locally persisted room memory.
- World state stays local to the device and does not create authority, consent, or legitimacy claims.
- If the engine cannot mount, the previous hotspot renderer remains in the page as an automatic fallback.
- The engine is cached for offline use.

Validation: JavaScript syntax checks and all 14 Anarchadia domain/export tests passed.
