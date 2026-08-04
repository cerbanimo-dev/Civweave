# Living School internal screen style restoration

This change restores the visual language of the pre-v151 Living School screen without restoring its files, runtime, or physical cabinet renderer.

## Source reference

The style reference is the Living School theme used by `realm-console-v140.css` before the dedicated v151 runtime replaced that screen. The retained language includes:

- dark moss and teal panel hierarchy
- parchment-toned text and gold status accents
- serif display typography
- framed hero/room headers
- two-column capability cards that collapse cleanly on mobile
- dark local-first forms, receipts, and records
- compact rounded bottom navigation

## Implementation boundary

Only the current `living-school-cabinet-v151.css` is restyled. The existing v151 HTML, module runtime, ten rooms, state schema, accessibility hooks, rubric engine, project gate, and Cerbanimo bridge remain authoritative.

No archived stylesheet, JavaScript module, image-driven scene, calibrated cabinet shell, iframe, or physical cabinet aspect ratio is mounted.
