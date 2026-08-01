# Living School Visual Core Audit

Build: Commonweave Host Node Hub v1.0.11

## Installed visual system

- 22 supplied high-resolution Living School scenes, optimized as offline WebP assets.
- 2 connected legacy transition scenes: Campus Map and Cerbanimo Bridge.
- 24 World Engine rooms in total.
- 397 normalized touch targets.
- 183 room-to-room links.
- 156 links into existing Living School workspaces and exact panel IDs.
- 58 direct actions, including settings, Ask Moss, journal, queue-state, Commonweave, FellowFare, and Cerbanimo actions.

## Geometry contract

Every hotspot is stored as source-relative percentages (`x`, `y`, `w`, `h`). The runtime fits the complete source image inside the available stage using the source width and height, then places every target inside that fitted frame. The artwork is never cropped with `object-fit: cover`, so the interaction geometry remains aligned in portrait, landscape, and differently proportioned phones.

## Validation performed

- All 24 rooms register with the World Engine, including the Great Library.
- All 397 hotspot rectangles are numeric, positive, and inside their source image.
- Every room destination resolves to a registered room.
- Every workspace focus target resolves to an element in `index.html`.
- Every referenced scene image exists and is included in the Living School offline cache.
- Browser harness mounted all 24 rooms and all 397 targets with zero runtime exceptions.
- Representative doorway, bottom-navigation, workspace-panel, and state-toggle interactions were activated in the browser harness.
- Source-frame fitting was verified at 412 × 915 portrait and 915 × 412 landscape viewport sizes.

Run the included validator with:

```bash
npm run check
```
