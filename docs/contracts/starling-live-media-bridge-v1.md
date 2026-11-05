# Starling live meeting media bridge v1

A session owner explicitly creates `createStarlingLiveMediaBridge` with a trusted host ID and cancellable audio adapter. Registered AI output stays a private draft until host approval. `offerDraft` creates a silent request; `grantAndSpeak` acquires a bounded lease from the Thread 2 turn manager. Every audio adapter **must** test `canSpeak()` immediately before emitting audio, and respect `AbortSignal` during synthesis/playback.

`voiceActivity({actorId,active:true})` is called as soon as a trusted human voice activity detector detects speech, even before final ASR; it cancels playback and revokes the speaking lease. `transcript` accepts final transcriptions from authenticated humans only. A transcript is delivered to the host-supplied callback; **it never automatically invokes a model**. The caller may explicitly route addressed text to a model, subject to meeting permissions.

The browser adapter `createBrowserSpeechPlayback` supports device speech synthesis. Hosted inference / remote audio / distributed actor authentication / microphone VAD are intentionally not silently enabled. The session coordinator must authenticate every operation on the server; client caller-supplied IDs are insufficient authority for a real network room.

**Integration contract:** Thread 3 supplies model drafts, Thread 4 consumes `speech-starting`/`speech-stopped` events for avatar animation, Thread 5 records audit events using the manager event stream. Existing guide voice remains separate until the meeting UI explicitly activates this bridge. No integration with production audio paths is implied.
