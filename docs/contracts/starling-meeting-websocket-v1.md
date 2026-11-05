# Starling Collective Meeting WebSocket integration (staging contract)

Owner: Thread 1 / Mica. Parent tracking issue: #948.

## Implemented modules
- `public/app/shared/starling-meeting-floor-v1.mjs`: exclusive time-bound floor.
- `public/app/shared/starling-meeting-session-gateway-v1.mjs`: authenticated command boundary, mute by default.
- `public/app/shared/starling-meeting-websocket-transport-v1.mjs`: Cloudflare-style WebSocket adapter.

## Important deployment requirement
The WebSocket module is **an adapter, not an exposed route**. Integrate with a durable, single-owner session backend (prefer a Cloudflare Durable Object per meeting) before claiming it is live. Creating a fresh transport or gateway for each request loses the room membership and floor state.

The host application must supply:
1. A **server-verified** `authorizeUpgrade({request, sessionId})` returning `{actorId, sessionId, token}`. Reject unauthenticated participants and invalid Origin at the edge. Never pass the caller's claimed actorId, role or raw query-string credential as trusted identity.
2. A gateway with `authenticate({token,sessionId,action})` returning server-sourced `{actorId,role,sessionId,connectionId}`. Tokens must be bound to a session, actor and connection with expiry/revocation enforced.
3. `createPair: ()=>Object.values(new WebSocketPair())` on Cloudflare. Use the accepted server socket for messages.
4. Rate limits, TLS, strict Origin validation, session/member capacity, abuse controls, authentication refresh, and privacy-safe log policy.

Example **inside a dedicated per-meeting Durable Object** (illustrative, not deployed):

```js
const gateway=createMeetingSessionGateway({authenticate:verifyMeetingToken});
const transport=createStarlingMeetingWebSocketTransport({
  gateway,authorizeUpgrade:verifyUpgrade,createPair:()=>Object.values(new WebSocketPair())
});
// When GET /meeting/:sessionId/socket and header Upgrade:websocket
return transport.attach({request,sessionId});
```

Do not attach this to the existing `/api/node/socket` endpoint without a separate authorization and tenancy review.

## Wire messages
Client -> server: `{requestId,action,payload}`, where action is one of `floor.request`, `floor.grant`, `floor.revoke`, `host.mute`, `host.unmute`, `host.pause`, `host.resume`, `speech.chunk`, `speech.end`, `model.ready`, `snapshot`, `events`. Join/leave are controlled by socket lifecycle.

Server -> client:
- `meeting.welcome` and `meeting.state` (authoritative floor state)
- `meeting.ack` (request-specific result, private to requester)
- `speech.chunk` (only allowed after verified floor permission)
- `speech.stop` (cancel currently playing speech on interruption, expiry when detected, or disconnect)
- `meeting.error`

## Audio safety
This adapter supports authorized **text** speech chunks only. Do NOT pass binary PCM/Opus directly to an audio player. A future TTS/voice gateway must check the current floor grant before sending each media frame. The receiving player must clear queued frames and stop synthesis on `speech.stop`, room pause, mute, or lost connection. An expired lease with no inbound traffic needs its own server-side timer to force a stop signal. Never rely on the UI mute indicator as a security check.

## Acceptance checks
```bash
node --test scripts/test-starling-meeting-floor-v1.mjs
node --test scripts/test-starling-meeting-session-gateway-v1.mjs
node --test scripts/test-starling-meeting-websocket-transport-v1.mjs
```

These tests are committed to staging but **not confirmed passing** by Thread 1's local runtime. Full deployment validation, long-lived multi-actor tests, cross-DO isolation and real audio interruption remain open gates.
