# Guild Radio · Timestamped Bundle Broadcast v1

## Ownership and stations
`public/app/system-radio-agent-v233.js` remains the only HTMLAudioElement, radio lifecycle and navigation-persistent player. The pure time resolver is `public/app/shared/guild-radio-schedule-v1.mjs`, not a separate player.

- **Guild FM** plays the authoritative schedule and speaks a short, authored retrospective DJ soundbite as the next bundle begins.
- **Guild Deep Dive** plays the **same music and same schedule** while speaking an extended, authored analysis of the just-completed bundle over the next bundle. The listener may mute the commentary independently of music, and the music ducks while speech is active.
- Manual "Listen here", offline saves, and the optional Spotify reference remain independent modes of that one player. Tuning must be an explicit user gesture; no background autoplay or unrequested network audio download.
- The S.A.F.E. gate prohibits broadcast of recordings without the required lyric audit. Starter bundle tracks are not yet S.A.F.E.-audited, so this mode fails closed until they are.

## Authority, clock and contract
The paired Guild Cloud Worker exposes public read-only `GET /api/guild/radio/schedule` when a guild is claimed. It responds with `civweave.guild-radio-schedule.v1`, `guildId`, UTC `epoch`, `issuedAt`, `expiresAt`, `serverNow`, and bounded `chunks`. Each chunk has `bundleId`, title, DJ, start and end timestamps, brief and long commentary, and an ordered list of tracks containing stable catalogue IDs, declared durations and precise UTC start/end timestamps.

The guild derives a reproducible pseudo-random order from guild ID plus UTC broadcast day. It **selects the entire curated bundle**, then shuffles the songs inside that bundle; it does not randomly select the next track. It avoids repeating a bundle consecutively when another eligible bundle is available. Schedules are deterministic for all listeners on the same Guild and day. UTC wall-clock time, not the caller's local playlist position, decides which recording is on air; listeners who join mid-track seek to that song's global offset.

The Worker sends only a compact forward window (approximately 45 minutes) and current server clock, **never copyrighted audio bytes**. The client refreshes the packet at most every two minutes while listening; a short local 3.5-second timer handles track changes and drift. A paused listener explicitly resumes to the live position, not an individual delayed playlist. Broadcast track skipping and freeform seeking are disabled to preserve synchronization.

The client accepts only a structurally valid schedule whose IDs match actually available licensed tracks. It calculates a server-time offset and never treats untrusted guild text as code. Failed or absent Guild synchronization displays **Local preview · not guild-synced**; the local preview uses the same seedable planner and the locally bundled track corpus but does not imply other listeners hear the same stream. The full catalog is intentionally *not* considered timed until verified durations and playback rights are available.

## DJ script corpus and audio
The first release includes three two-song themes in `public/downloads/hub-media/open-music/guild-bundles-v1.json`, drawn from three existing verified CC BY MP3 files: expression and technology, the living commons, and human-machine accountability. Weaveling, Moss and Kamiya are credited as DJ persona labels. Briefs and extended discussion are original prepared editorial text; **no claim is made of a live AI host, recorded actors, a generated podcast feed or artist-approved lyric interpretation**.

The installed browser's speech synthesizer voices DJ text locally (subject to browser/OS voice availability), in bounded utterances for Android. The listener can mute DJ speech without muting the music. The text is visible even if synthetic speech is unavailable. Audio files are loaded only following user action. Required installer caching covers the lightweight schedule module, corpus and catalog **without precaching MP3 recordings**.

## Future expansion (not implemented)
Guild-governed bundle submission and member voting, validated track runtime discovery, audio-ready generated DJ clips, voice-persona consent/selection, creative attribution, and rotating topic- or world-specific commentary require separate moderated authoring and publishing workflows. Generated analysis must identify speculation, avoid misattributing musicians' intentions and preserve provenance. Guild governance approval should own publication of any future third-party contributed audio.

## Acceptance checks
`node --test scripts/test-guild-radio-schedule-v1.mjs` checks bundle-level selections, deterministic per-Guild schedule, contiguous timestamps, mid-track offset and unlisted-ID rejection.
`node --test scripts/test-radio-direct-audio-v1.mjs scripts/test-radio-panel-layout-v1.mjs` guards the single player, explicit playback, S.A.F.E. and viewport layout.
`node scripts/verify-radio-shell-guarantee-v305.mjs` checks install-required assets and no automatic audio download.
Operational proof still requires live Cloudflare staging deployment, two-device time alignment, browser TTS play/mute, a changeover, and the unpaired/offline preview path.
