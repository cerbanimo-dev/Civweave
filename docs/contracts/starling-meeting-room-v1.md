# Starling Collective 3D meeting room — Thread 4

Status: foundation proposed for staging. Target demonstration: 2026-11-11.

## Capability boundary

The 3D room is an optional **presentation** of an existing Guild/Party meeting capability. It must not own chat, session authentication, a transcript, turn grants, audio capture, model routing, Guild votes, Quest completion, or persistent memory. It must work with a semantic 2D fallback and must never block meeting attendance when GPU/WebGL is unavailable.

- Thread 1 / Mica: owns integration, event contracts, authentication and deployment review.
- Thread 2: owns turn arbitration, permissions, interruptions, listening and speaking grants.
- Thread 3: provides model audio and speech output subject to Thread 2 authorization.
- Thread 4: owns projected avatar appearance, seating, movement, speaking/listening animation and positional playback presentation.
- Thread 5: owns agenda/transcripts/decisions/Quest record integrations.

## Interface v1

The pure browser-compatible module `public/app/shared/starling-meeting-room-v1.mjs` exposes:

- `positionParticipants(participants)` => deterministic bounded coordinates (max 16).
- `projectAvatarState(participant, session)` => `absent|disconnected|idle|muted|requesting_turn|listening|speaking`.
- `projectMeetingRoom(session)` => `{status,avatars:[{id,seat,position,facingRadians,displayName,kind,state,audioEnabled}]}`.

Inputs are UI projections only; upstream meeting session owner must validate the identity, grants and participant roster. Every event is scoped by authenticated meeting/session ID and current monotonic revision at the boundary before projection. Do not use this local projection as an authorization check on the server.

Sample session snapshot:

```json
{
  "roomStatus": "live",
  "activeSpeakerId": "moss",
  "grantedSpeakerId": "moss",
  "participants": [
    {"id":"human-1","displayName":"Host","kind":"human","connected":true},
    {"id":"moss","displayName":"Moss","kind":"agent","connected":true},
    {"id":"rook","displayName":"Rook","kind":"agent","connected":true,"handRaised":true}
  ]
}
```

A participant speaks **only** when `activeSpeakerId` and `grantedSpeakerId` both match the participant and the room is live, the participant connected and neither muted nor prohibited. Incoming model text does not activate speaking. The room plays authorized audio only; no client-side inferred turn granting. The renderer must cease already playing media immediately when a grant is revoked or session changes.

## Rendering plan

Start with a lightweight WebGL renderer using GLB avatar assets when available, with geometric placeholders and a semantic DOM fallback. Import Three.js only after a user opens the 3D mode and resources permit; do not add a mandatory package dependency or start model inference. Bind `state` to avatar animations and `audioEnabled` to the *presentation* playback switch, while Thread 2 and the media transport still enforce stream permissions.

Accessible controls must remain HTML controls outside the scene: participant list, hand raise/request turn, mute, leave, captions/transcript and reduced-motion preferences. On mobile prioritize low-poly static avatars, bounded participant count, and explicit audio opt-in.

## Next integration work

1. Thread 2 supplies event schema and signed/verified turn lease lifecycle (room ID, revision, expiry, revoke).
2. Thread 3 supplies the media stream with interruption/abort semantics.
3. Thread 1 identifies the canonical Guild meeting session owner and launch route (no duplicate chat UI).
4. Thread 4 binds this projection into a lazily loaded scene + accessible fallback and tests reconnect/revoke.
5. Thread 5 feeds transcript/agenda into the existing meeting record owner.

## Verification

```sh
node --test scripts/test-starling-meeting-room-v1.mjs
```

This PR is foundational only: it does not claim a running 3D room, cross-device presence, live spatial audio, or staging deployment.


## Browser-loadable room preview

`public/app/tools/starling-meeting-room-lab.html` is an optional, zero-dependency CSS 3D meeting lab. It offers a circular meeting space, four sample participants, camera rotation/zoom/reset, an accessible semantic roster, a 2D view toggle and reduced-motion styles. It never asks for microphone permissions, loads a model, plays speech, or connects to a Guild. The "simulate" buttons only change local demonstration state.

Preview it by serving the existing `public/` directory and opening `/app/tools/starling-meeting-room-lab.html`. The module uses an ordinary relative import of the shared room projection. It is **not** the production Guild meeting launch route. Live wiring requires Mica to identify the canonical meeting/session capability and supply authenticated revisioned snapshots from Thread 2; do not infer authority from demonstration UI.

Automated checks: `node --test scripts/test-starling-meeting-room-v1.mjs` and `node --check public/app/tools/starling-meeting-room-lab.mjs`. The dedicated GitHub workflow runs these checks for staging changes. Full browser visual verification, keyboard and mobile testing, and real-time speaker lease revocation remain outstanding.


## Playback presentation handoff (Thread 2/3)

`public/app/shared/starling-meeting-audio-v1.mjs` provides `createMeetingAudioPresenter({start,stop})` to control playback on an **already authenticated** session stream supplied by Thread 1/2. It is not a media transport or security boundary. The caller must verify grant signatures and session membership; no caller may use local lab's synthetic session grants as real authorization. A snapshot must include `sessionId` (bounded identifier), monotonically increasing integer `revision`, `roomStatus`, `participants`, `activeSpeakerId`, and `grantedSpeakerId`. On a revoked grant, muted/disconnected participant, invalid snapshot, or room closure, the presenter immediately calls `stop` on the previously active stream. A session switch stops playback and requires a **fresh presenter** for the new session, preventing old-room media reuse. `dispose()` stops active playback and makes the instance inert. Playback-start failures fail silently and trigger a stop call. The wrapper must never call TTS/model APIs or infer who can speak from transcript text.

The presenter deliberately has no client-generated grant, wall-clock lease inference or network reconnect loop. Thread 2's authoritative lease expiration and Thread 3's media cancellation must occur upstream; revision equality is treated as replay and discarded. A direct Guild integration must clean up on exit, page navigation and participant removal.
