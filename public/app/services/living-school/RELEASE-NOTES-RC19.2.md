# Living School RC19.2 — First World Engine Room

This release introduces the framework-neutral Civweave World Engine and converts the Great Library from bespoke hotspot code into a data-driven world scene.

## World Engine foundation

- Scene registry and renderer
- Reusable objects, portals, workspace handoffs, NPC actors, ambient events, and room-local state
- Offline persistence through a namespaced world-state document
- EventTarget hooks for scene entry, object activation, actor interaction, ambient activity, and state changes
- Declarative visibility, dynamic labels, counters, toggles, badges, and accessible announcements
- Reduced-motion support and no network or framework dependency

## Converted room: Great Library

The Great Library now runs through the engine while preserving all previous routes:

- Subject stacks open the marketplace
- Focus and reading tables open learning controls
- The Commons and Moss doors travel spatially
- Learning tools retain their classic handoff
- Juniper the librarian is an interactive, deterministic NPC
- Reading lamps, quiet-study mood, and the return cart persist between visits
- Small ambient events make the room change over time
- The Room Actions tray is generated from the same scene objects

The other Living School rooms continue using the compatibility renderer. This establishes a safe migration path: each room can be converted independently without breaking visual mode.
