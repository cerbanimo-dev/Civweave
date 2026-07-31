# Visual Contract Audit · v1.0.9

## Corrected in this release

### Host gateway

- The host-node homepage is now the illustrated Town Square.
- The Quad is the installation and connection click region.
- The offline kit is reached through a second invisible image region.
- Host status and version appear as an in-world signal rather than a conventional marketing page.

### Commonweave

- Town Square and every supplied district remain full-screen image scenes.
- The conventional application shell is not user-visible.
- The bottom dock is entirely image-backed.
- District and feature labels are invisible semantic hotspots.
- Weaveling, intentions, search, review, settings, and host setup appear in illustrated projection scenes.
- Realm travel goes directly to visual entry scenes.

### Living School

- The visual campus is always the entry point.
- Every supplied room image remains reachable from the illustrated map or room hotspots.
- Existing curriculum, assessment, practicum, passport, research, review, and model controls are moved into the current room's in-world work surface instead of revealing the classic shell.
- Moss and Cerbanimo actions preserve illustrated continuity.
- The only persistent navigation is the image dock.

### Cerbanimo

- Visual world entry is unconditional.
- Search and detail workflows are projected against supplied Cerbanimo scene art.
- The conventional app shell stays hidden.
- The image dock routes among visual destinations and back to Commonweave.

### Anarchadia

- The illustrated Home Hall is the first-run and database-recovery entry.
- The legacy toggle and visible hotspot-debug control were removed.
- All classic route names resolve to an illustrated civic room.
- Forms and constitutional work appear in room-specific projection surfaces.
- IndexedDB repair no longer depends on a hard-coded version that can become older than the repaired database.
- Clearing local data creates a fresh illustrated hall rather than exposing onboarding cards.

### FellowFare

- The conventional top bar and text bottom navigation were replaced by a seven-image dock.
- All sixteen supplied mall scenes are image screens.
- The six major mall wings are reached from invisible Town Atrium hotspots.
- Every text feature represented in the supplied marketplace, free store, help desk, repair café, skill shop, tool rental, resource center, volunteer hub, and pantry artwork activates its workflow directly.
- Marketplace, Loom, assemblies, inbox, profile, composer, agreement, and model workflows remain functional inside scene-backed in-world screens.
- Rooms without supplied art no longer render synthetic placeholder scenery.

## Architectural status

This release removes user-facing legacy launch paths and establishes one shared implementation contract. It does not claim that every future function has a unique final illustration. Where a dedicated asset does not yet exist, the function is hosted in the closest existing illustrated room through an in-world projection.

## Remaining compliance work

- Replace every shared projection host with a bespoke object asset where the workflow deserves its own screen.
- Run coordinate calibration on every hotspot at common portrait, landscape, tablet, and desktop aspect ratios.
- Add automated visual-route tests that fail when a visible conventional shell appears.
- Commission the missing destination assets listed in `VISUAL-ASSET-BACKLOG-v1.0.9.md`.
