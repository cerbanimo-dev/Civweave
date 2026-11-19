# First Peace Festival · implementation slice 0.1

## Paths
- Static standalone venue: `/app/events/first-peace/index.html`
- Existing Performance Studio: `/app/tools/worldweaver-performance-lab.html`
- Music catalog: `content/stormcallers/SONG_CATALOG.md`
- Manuscript coda (editorial insert): `content/manuscripts/warlock/first-peace-post-warlock-coda.md`

## Current behavior
The festival venue loads without external scripts, renders the 16-slot setlist, allows copying it, and stores/exports/clears a **local-only** personal creative pass. Rehearse Knock never claims to contact anyone. No uploaded recordings are included, and the page explicitly labels live streaming as unconnected.

## Next integrations (not claimed complete)
1. Add a visible event link to the actual Civweave Working Campus navigation after checking the source route and offline asset list. Avoid silently changing the installer/service-worker cache.
2. Build trusted authenticated event state: attendee presence, RSVP, opt-in contact exchange, chat, moderation, rate limits, audit log, and temporary blocks. Never synchronize private notes without explicit submission.
3. Create signed knock invitations to the host with rate limits, opt-out and no guaranteed response. No pilot/control access is transferred by a knock.
4. Add organizer-approved media manifests with asset hash, rightsholder, license/authorization, attribution, explicit publishing status, playback formats and captions. Serve music through approved streaming infrastructure only.
5. Worldweaver venue integration: stage placement, rooms, opt-in avatar attendance, guest sandboxing, world-level permission checks and ban enforcement on backend. Adult universes are inaccessible pending independently tested consent gates.
6. Live load test, accessibility/keyboard/mobile tests, offline reconnection, and production rollout.

The fictional pilot rules are manuscript canon; this prototype is **not** an autonomous agent/pilot permission system. Keep user consent, role authorization, and governance enforced by verified server identity, not fictional statements.

## Manuscript status
The new coda is independent review material. It has NOT overwritten the latest editable Warlock master, which may have a newer 55-chapter edition than prior 46-chapter drafts. Insert only after checking latest canon and maintaining POV, Erin/Legion distinction, and the saga's reserved final line.
