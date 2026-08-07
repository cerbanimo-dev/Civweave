# Civweave v1.0.16

## Permanent five-system navigation contract

Civweave could open its home screen on Render, but navigation into Living School, Cerbanimo, FellowFare, or Anarchadia could be replaced by the dark compatibility launcher. Two independent causes shared the same trapdoor:

1. The install boundary treated only the Working Campus as an intrinsically authorized application surface. The other four systems depended on transient session state or query parameters.
2. Service-worker navigation requests did not identify themselves as device-package requests to the install-only Render gateway. A rejected realm navigation could then fall through to a generic launcher or offline document.

v1.0.16 removes both failure paths and makes the repair a release invariant:

- one `system-routes-v227.js` contract owns all five canonical destinations
- every canonical system page authorizes itself even with empty session state
- every system-to-system URL carries explicit installed navigation context
- the compatibility launcher and Working Campus use the shared route contract instead of duplicate maps
- the service worker sends the package header for canonical page navigation
- canonical navigation is exact-route network-first, then exact-route cache
- the installer, blank launcher, offline page, and another realm can never substitute for a requested canonical system
- a visible recovery page appears when the exact system is genuinely unavailable
- all five canonical pages plus the route contract are precached without making worker activation depend on a perfect network
- the worker builder can only regenerate the guarded v227 import stack
- release synchronizers preserve the five-system boundary instead of rewriting it to an older architecture
- CI executes a 25-route source-to-destination matrix with empty session state

Render remains an install-only PWA distribution and host-node gateway. This repair authenticates package navigation without turning Render into the canonical live application frontend or backend.

## Source-of-truth recovery retained

- Rebuilt the current host from the intact v1.0.10 Render shell and the complete v1.0.15 Pocket Campus seed.
- Preserves Merlin universal chat, draggable persistence, Moss avatar chat, contrast repairs, Living Displays workflow states, and the Cerbanimo bridge correction.

## Shared Display Surface Engine retained

- Adds reusable geometry profiles for full and narrow chalkboards, easels, wall and portrait holograms, multi-board dashboards, circular projectors, and observatory arches.
- Centralizes safe content bounds, density, scrolling, padding, mobile fitting, and reduced-motion behavior.
- Living School display objects publish shared surface profiles while retaining their specialized workflow bindings.
- Multi-board dashboards use tighter side margins and centered attachment geometry.
