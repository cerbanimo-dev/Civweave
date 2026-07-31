# Commonweave Cardinal Visual Contract

Commonweave is not a conventional web application decorated with scenery. The illustrated world is the application surface.

## Non-negotiable rules

1. Every user-facing screen is anchored to an illustrated scene.
2. Every navigation action begins at an image-backed click region.
3. Hotspots are semantic and invisible. They may show a focus outline for keyboard and switch users, but never visible HTML labels over the artwork.
4. Text entry, review, search, settings, and editing occur only inside an in-world object such as a hologram, terminal, chalkboard, passport, desk, ledger, or projection.
5. Bottom navigation is made from image-backed destinations, not ordinary labeled browser buttons.
6. No classic or legacy interface is offered as a user-facing fallback.
7. An unavailable feature is an asset gap. It must not silently fall through to an unillustrated page.
8. DOM elements may remain as the invisible semantic and accessibility substrate. They are not the visible composition.
9. Every generated scene must have a stable scene ID and a documented hotspot map.
10. Realm handoffs must land in the destination's illustrated entry scene.

## Accessibility does not require breaking the visual contract

Each hotspot retains an accessible name, keyboard focus, and predictable activation. In-world projections retain semantic headings, labels, form controls, status regions, and error messages. Reduced motion, contrast, text scaling, and screen-reader behavior remain first-class requirements.

## Implementation test

A screen fails the visual contract when a user can see a conventional header, card grid, toolbar, browser-style form, unlabeled placeholder room, or legacy interface without an illustrated host scene establishing it as an object in the world.
