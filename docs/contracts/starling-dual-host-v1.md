# Starling execution hosts — Android native and Termux

These are **interchangeable local execution hosts** for Starling Collective drafts. They complement, rather than replace, Civweave's canonical Starling planner, Living School, Guild Quest board, Cerbanimo proof/quality gates, and one shared guide chat.

**Protocol:** `civweave.starling-host-job.v1` in `public/app/shared/starling-execution-transport-v1.mjs`.

| Capability | Termux host | Android wrapper native bridge |
| --- | --- | --- |
| Queue/recover/cancel local draft jobs | Yes, Python journal + existing Companion | Yes, app-private journal + WorkManager |
| Inference engine | Existing paired llama.cpp Companion, 127.0.0.1:8766 → 8080 | Fixed local 127.0.0.1:8080; host APK can inject an embedded `StarlingLocalEngine` |
| Periodic work after Civweave Lounge closes | While Termux service is alive | WorkManager opportunistic periodic work, subject to Android quotas/battery state |
| Credentials | Existing Companion 64-hex pairing token (browser session only) | Origin-scoped AndroidX WebMessageListener, main-frame only |
| Local document/code tool authority | Not implemented | Not implemented |
| Human Guild task claim, verified Cerbanimo completion, hosted credits | Not authorized | Not authorized |

## Termux setup

Existing Companion setup remains unchanged. Launch the original `public/termux/civweave_companion.py` on `127.0.0.1:8766` with its pairing token, and ensure its managed llama.cpp server is running on port 8080. In **another Termux session**, install the Starling host:

```sh
pkg install -y python curl
mkdir -p "$HOME/.civweave-companion"
curl -fL https://civweave-staging.pages.dev/termux/civweave_starling_host.py -o "$HOME/.civweave-companion/starling_host.py"
python "$HOME/.civweave-companion/starling_host.py"
```

The host binds **only** to `127.0.0.1:8767` and uses the same existing Companion pairing token. It never accepts model URLs, shell commands, file paths, remote clients, cloud endpoints or unauthenticated requests. Browser origins are restricted to the Civweave production and staging sites. The host stores its job journal at `~/.civweave-companion/starling-host-v1.json` with mode 0600. On restart, a running job becomes *interrupted/review-required*: it does not silently rerun.

Open the Starling Lounge, pair the existing Termux Companion through Civweave Settings, select **Termux companion**, then Connect. Queue a draft or explicitly enable local autopilot. In Termux:Boot, you can launch the Companion and Starling host after boot if you prefer; Android may still suspend or kill Termux. Unpairing and stopping the Python process disable access and execution; disabling autopilot through the Lounge persists the stop policy.

## Android wrapper setup

Source: `native/android/civweave-starling-v1/src/main/java/cc/civweave/starling/`.

The **Android app shell must integrate and build** these Kotlin files; they are not an APK. Add AndroidX WebKit (for `WebViewCompat.addWebMessageListener`) and AndroidX WorkManager dependencies matching the wrapper's supported Android SDK, and `android.permission.INTERNET`. The shell must permit cleartext HTTP to the explicit loopback llama.cpp address (127.0.0.1) only, or provide an embedded model engine.

Install the bridge **only** in the Civweave app's trusted WebView:

```kotlin
StarlingNativeBridge(applicationContext).install(civweaveWebView)
```

The bridge is origin-restricted to the actual HTTPS staging/production origins and rejects subframe messages. **Do not substitute `addJavascriptInterface`** because that interface is exposed to all frames. The native bridge schedules bounded `WorkManager` jobs and stores durable receipts in app-private preferences. On native Android, a running llama.cpp server at `127.0.0.1:8080` can serve jobs without the Termux Starling service; the APK can instead set `StarlingNativeEngines.engine` to an embedded local model implementation. Neither backend promises uninterrupted realtime execution: WorkManager scheduling is inexact and the OS can defer or terminate work. This source does not implement a foreground service, embedded GGUF binaries, an APK installer, or a native Android release.

## Shared commands and review

All host requests are limited to:
- GET `/v1/starling/status`, GET `/v1/starling/jobs`, GET `/v1/starling/jobs/:jobId`
- POST `/v1/starling/jobs` with fixed draft-only job schema
- POST `/v1/starling/jobs/:jobId/cancel`
- POST `/v1/starling/schedule` with explicit enable/disable, 15–1440 minute interval and 1–12 draft/day cap

The trusted Android WebMessageListener carries the same `method/path/body` envelope; the Termux host accepts it over paired loopback HTTP. Every job is local, non-authoritative, and returns `reviewRequired: true`, `claimVerified: false`. The Starling Lounge displays completed host drafts. **Only an explicit Import completed draft action** signs a reviewed host draft into the existing Guild object mesh as a proposal; the host itself does not possess the Guild signing identity. Civweave's canonical Cerbanimo task owner alone will implement future claims and verifiable work outcomes.

The two independent host schedulers should not be simultaneously enabled for one Guild. The Lounge stores a non-secret selected-host preference and disables its browser-cooperative scheduler before enabling a host scheduler. If you switch hosts, stop the previous host scheduler first. This is UI coordination, not a substitute for a future distributed host lease and Guild-issued worker authorization.

## Tests and current release boundary

`python3 scripts/test-starling-termux-host-v1.py` exercises the actual Python HTTP handler, pairing, idempotency, persistence, and schedule cap with a mocked Companion. `node --test scripts/test-starling-dual-host-v1.mjs` tests the browser host contract and static Android security integration. These tests **do not compile the Kotlin APK** or run WorkManager on physical Android; device acceptance is still required before shipping native functionality.
