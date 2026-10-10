# Survival Mode v1 — Safety-first field assessment

## Objective and ownership

Survival Mode is a cross-realm, opt-in capability of Weaveling, not a sixth realm, independent chat system, or emergency-response service. The owner is public/app/survival/survival-mode.mjs. The mobile page is only a presentation caller. The shared chat owner remains guide-chat-surface-v350.js.

## Active v1 behaviors

1. The existing persistent-shell actions expose Survival Mode without coins, membership, server consent, or AI startup.
2. Camera or file selection creates only a temporary local preview. Images are not stored, uploaded, identified, or scored.
3. The user reports concerns and available resources; unchecked does not imply safe.
4. A deterministic priority order handles immediate dangers, possible electrical hazards, and serious injuries ahead of exposure, water, shelter, navigation, foraging, repairs, and supplies.
5. The user can search already-downloaded Living Library materials. Search excerpts clearly distinguish local availability from original internet links. Expanded/deep sources may offer full saved article text when locally present.
6. Photograph presence alone never changes diagnosis, species identification, water purity, structural safety, or edibility. Empty or failing searches never license speculation.

## Safety invariants

- No automated edible-plant authorization, medical diagnosis, or electrical/structural clearance.
- No promise of live weather, safe routes, current local risks, or emergency dispatch.
- No automatic publishing of user location, images, or resources to a Guild.
- Essential assessment is free and model-independent, and explicitly labels unknown conditions.
- Offline source provenance, limitations, and index failures are shown, not hidden.

## Integration and next steps

The reference search reuses knowledge-school-runtime-v243.mjs and knowledge-library-upstream-v1.mjs. Future phases add evaluated device vision with observed/suspected/unknown distinctions, curated regional lookalikes, offline emergency procedures, map packs, and opt-in Guild coordination. These are NOT implemented in v1.

## Acceptance

Run npm run test:survival. Test genuine cold offline PWA boot and source retrieval on a device before describing this as emergency-ready.
