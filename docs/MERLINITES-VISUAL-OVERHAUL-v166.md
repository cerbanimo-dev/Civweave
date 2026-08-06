# merlinites visual overhaul v166

This pass establishes a realm-defining visual layer without replacing the working application flows.

## Global Civweave shell

- Replaces the tall `CABINET MODE` header and two text pills with a compact Thread Rail.
- Keeps all five realms in fixed left-to-right positions: Civweave, Living School, Cerbanimo, FellowFare, Anarchadia.
- Keeps the active realm in place and marks it instead of removing it from the dock.
- Moves Weaveling into a dedicated compass control in the top rail.
- Keeps AI settings as a separate compact control.
- Preserves readiness, active, review, and unread-count signals.

## Existing assets used

The overhaul reuses the canonical AI profile assets from `public/app/assets/ai/profiles.json`:

- Weaveling: `weaveling.png` and `weaveling-compass.png`
- Moss: `moss.png` and `moss-acorn.png`
- Kamiya: `kamiya.png` and `kamiya-gift.png`
- Rook: `rook.png` and `rook-coin-button.png`
- Merlin: `merlin.png` and `merlin-hat.png`

The artifact images identify realms in the global shell. Existing guide avatars remain in their workspaces, and the Living School Moss control uses the canonical Moss avatar instead of a generated CSS placeholder.

## Realm-defining anchor treatments

### Civweave

Uses woven paths, pearl-like nodes, prismatic threads, asymmetrical rounded surfaces, and a low-opacity Weaveling presence. The settings and intention surfaces read as parts of a loom rather than a generic blue form stack.

### Cerbanimo

Uses cut corners, work rails, segmented energy conduits, loaded-state labels, mechanical task panels, and Kamiya's gift artifact. The active quest reads as machinery rather than a project-management card list.

### Living School

Uses editorial pages, uneven paper objects, botanical light, bookmark-like navigation, and the canonical Moss avatar. The map reads as a cultivated field guide rather than a green dashboard.

### FellowFare

Uses awning stripes, ledger paper, request slips, hanging-tab navigation, copper and cream surfaces, and Rook's coin-button artifact. The workbench reads as an exchange counter rather than a chat application.

### Anarchadia

Uses pasted notices, uneven cuts, civic stamps, tape, offset modules, and rougher workshop geometry. The console keeps its neon readability while becoming less uniformly cyberpunk and more visibly participatory.

## Boundaries

This pass changes presentation and navigation composition only. It does not replace the existing state stores, AI routes, proof flows, review gates, offline behavior, or realm-specific navigation.

## Next pass

1. Capture the five anchor screens at common mobile widths and correct collisions or contrast failures.
2. Replace remaining glyph-only realm-local navigation icons with canonical art or purpose-built transparent icons.
3. Reshape the Civweave intention overview into the full woven route map.
4. Propagate each anchor language into secondary rooms after the anchor screens are approved.
5. Add screenshot regression coverage for the top rail, fixed realm dock, and one anchor screen per realm.
