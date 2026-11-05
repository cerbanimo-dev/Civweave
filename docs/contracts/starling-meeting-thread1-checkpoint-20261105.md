# Starling meeting — Thread 1 integration checkpoint (2026-11-05)

Tracking: #948. Target meeting: 2026-11-11.

## On staging
1. `starling-meeting-floor-v1.mjs` — single speaking floor, host-only grants, default mute.
2. `starling-meeting-session-gateway-v1.mjs` — authenticated command boundary.
3. `starling-meeting-websocket-transport-v1.mjs` — upgrade adapter and text speech authorization.
4. `starling-meeting-speech-playback-v1.mjs` — client-side cancellable text-to-speech safety boundary.

## Speech playback hookup
Construct a new playback owner for each connected session with a `player` that implements:
- `play({text,actorId,signal})`: synthesize/play only authorized text; respect AbortSignal immediately.
- `stop()`: stop currently audible output **and clear pending player/TTS buffers**.

Feed the messages from an authenticated, trusted socket into `playback.receive(JSON.parse(event.data))`. On socket close/error/host exit call `playback.disconnect()`. Do not feed arbitrary model completions directly into this API.

**Caveat:** The adapter is not mounted to a Worker route; real audio/TTS, durable session ownership and host identity validation are still missing. A server timer must broadcast `speech.stop` upon lease expiry even when idle; client should independently stop at expiry. The transport broadcasts text, not encoded audio.

## Tests to execute in a checked-out repo
```bash
node --test scripts/test-starling-meeting-floor-v1.mjs scripts/test-starling-meeting-session-gateway-v1.mjs scripts/test-starling-meeting-websocket-transport-v1.mjs scripts/test-starling-meeting-speech-playback-v1.mjs
```
The scripts are committed, but an end-to-end successful run is not yet verified.

## Next integration priorities
- P0: real Cloudflare Durable Object session owner and HTTP/WebSocket route with authenticated upgrade and Origin enforcement
- P0: lease-expiry timer and cancellation of current speech/audio even with no subsequent network frames
- P0: host UI buttons for mute, pause, speak, stop, and participant list
- P0: real-device network disconnect/reconnect, concurrent request, and silence-rehearsal tests
- P1: connect Thread 3 model bridge adapter
- P1: persist approved transcripts and Quest decisions from Thread 5
- P2: wire avatar speaking states from Thread 4

## Safety and release
Do not claim a live meeting endpoint or production-ready 3D room until authenticated route, durable storage, real playback, consent, test evidence and staging rehearsal are verified. Production remains untouched.
