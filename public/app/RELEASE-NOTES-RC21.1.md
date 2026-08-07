# RC21.1 — Live Data Weave

Civweave's living world now reads real local activity from all four applications instead of relying only on demonstration scene data.

## Added

- Live adapters for Cerbanimo, Living School, FellowFare, and Anarchadia.
- Normalized cross-system record index for projects, quests, tasks, curricula, practica, listings, agreements, proposals, outcomes, amendments, messages, and workgroups.
- Unified search results that deep-link back to their source application.
- Dispatch Hall activity feed with attention, active-thread, and milestone counts.
- Scene pulse data so districts visibly report relevant real activity.
- Reviewable cross-system handoff staging API.
- Automatic refresh after local storage changes and every 30 seconds.
- IndexedDB read adapter for Anarchadia's local workspace.

## Safety and compatibility

The adapters are read-only. They do not silently modify application records. Cross-system writes are staged as review-required handoffs. Classic tools and all previous world-engine fallbacks remain available.
