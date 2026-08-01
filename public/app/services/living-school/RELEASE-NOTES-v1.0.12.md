# Release Notes v1.0.12 — Living School Interface Surfaces

## Added

- Imported eight reusable illustrated interface objects: three chalkboards and five holographic display systems.
- Replaced the generic projection overlay with source-aligned device surfaces that host the real Living School DOM.
- Routed the compact pathway intake to the pedestal projector and the full curriculum builder to the mossbound board; schedules, research output, learner constellations, dashboards, and feeds use purpose-specific interface artwork.
- Added live state badges for empty forms, forms in progress, and populated data feeds.
- Added typography roles using Cabin Sketch and Schoolbell for chalk surfaces, plus Cinzel and Rajdhani for holographic surfaces.
- Added responsive surface geometry, scroll containment, keyboard focus preservation, and reduced-motion handling.
- Added an interface-surface manifest and offline cache entries for every new local asset.

## Important implementation detail

Text and controls are not painted into the image files. Existing forms and output panels are moved into the illustrated surface at runtime, so validation, submission, state updates, accessibility semantics, and local-first behavior remain functional.
