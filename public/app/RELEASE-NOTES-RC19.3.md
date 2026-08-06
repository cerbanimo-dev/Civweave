# Living School RC19.3 — Full World Engine Migration

Every Living School visual destination now runs through the reusable Civweave World Engine.

## Migrated campus

- All 18 spatial destinations use declarative scenes, including the five temporary gateway rooms.
- Every room exposes the same object definitions to both image hotspots and the accessible Room Actions tray.
- Portals, classic-workspace handoffs, Moss, the directory, and the Cerbanimo bridge remain connected.
- Each room now has a deterministic resident and ambient activity without requiring a model or network connection.
- Scene state remains offline and namespaced in the World Engine store.

## Safety and fallback

- Scene mounting is isolated with a compatibility-renderer fallback.
- A failed scene cannot strand the learner or remove classic controls.
- Existing browser-back, swipe, keyboard, fit/fill, directory, and return-to-room behavior remains intact.
- The original hotspot definitions remain the migration source of truth, reducing route drift.

## Validation

- JavaScript syntax checked with Node.
- All 18 rooms verified to have engine scene IDs and registrations.
- Every referenced visual asset exists.
- All portal targets resolve to known rooms.
- Seed manifest and install-kit checksums regenerated.
