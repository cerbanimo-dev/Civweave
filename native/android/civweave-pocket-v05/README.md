# Civweave Pocket · Android BLE shell v0.5

This is a **new Android Studio source project**, not an already-built or deployed Civweave APK. It embeds Civweave staging in an isolated WebView and provides a native foreground BLE central that connects directly to the StickS3 on Bluetooth (no shared Wi-Fi, local PC, hotspot, or internet needed for pairing).

## Prerequisites

- Android Studio with Android SDK 35, JDK 17; Gradle 8.7+; AGP 8.6.1
- Android 8+ device with BLE; Android 12+ grants Nearby Devices; Android 13+ notification permission recommended
- StickS3 flashed with `../sticks3_ble_uiflow.py` via UIFlow 2 `Run Once` (press B to dismiss); if connection succeeds then `Run Always`

## Build

Open `android-pocket` in Android Studio, let Gradle sync, then **Build > Build Bundle(s)/APK(s) > Build APK(s)**. The output will be `app/build/outputs/apk/debug/app-debug.apk`. This source package has **not** been compiled on Android yet; validate the build before installing.

## Connection

1. Run the StickS3 BLE UIFlow program (screen says `BLE READY - PAIR PHONE`).
2. Install/debug-run the Android project, allow Nearby devices/notification permissions, tap **CONNECT**.
3. Android scans for service `bc257ca0-197e-4ba4-8ab7-c70ef45c0010` and automatically enables notifications from the Stick.
4. Status remains OFFLINE until a real authenticated upstream HTTPS `/v1/pocket/state` source is entered with its dedicated token. A manual preview is clearly marked as preview, never 'generating'.
5. Pairing works via local BLE without shared Wi-Fi. An internet link via cellular is needed to retrieve live server state and atlases.

## Source authority and protocol

The Android bridge fetches `GET /v1/pocket/state` via HTTPS with a dedicated Bearer token (never logged). It accepts only `civweave.pocket.state.v1` with `source:trusted-server`, `fresh:true`, `age_seconds` <= 8, nondecreasing `seq`, and a nonempty `job_id` for `generating`. It clears the display after >8 seconds offline. It transmits a short, sanitized `source:server` status to the Stick. The Stick then locally enforces a 9-second TTL; no local animation, accelerometer or random game event can assert real generation. A `POST /v1/pocket/action` endpoint must independently validate the device's permission before executing requests.

BLE UUIDs: `bc257ca0-197e-4ba4-8ab7-c70ef45c0010` (service), `..0011` (Android writes), `..0012` (Stick notifies). Transfer messages: `01 [S|I] [length big endian uint16] [checksum uint16]`, `02 [up to 19 data bytes]`, `03` final. No raw AI credentials or audio in BLE v0.5.

## Known limitations (intentionally not represented as implemented)

- Live cloud integration needs a **server-owned status endpoint** and separate device-scoped authentication. Existing Civweave browser `civweave:model-event` is a client-side request event, **not** accepted as a server receipt.
- PTT press/release signals exist and display feedback. Actual BLE voice PCM transport, secure pairing, transcription, AI response/TTS and playback are NOT included. `VOICE READY` is a control-mode diagnostic, not a working call.
- BLE characteristic discovery alone does not authenticate a neighboring device. Do not transfer private data/audio until device authentication and message protection are implemented.
- The foreground service requires an explicit user launch; Android may still stop it under device power restrictions. Battery optimization tests are pending.
- Native phone rendering uses public Civweave character atlas URLs from staging. If URLs fail, a text fallback remains; original sprites are not silently replaced with unrelated artwork.
- No production merge or deployment has been performed. The standalone shell is not a replacement for all capabilities of an existing Civweave Android wrapper.

## CI debug APK

The included `.github/workflows/build-civweave-pocket-android.yml` can build a debug APK on a GitHub-hosted runner **after** you commit the project under `android-pocket/` and the workflow under the repo's root `.github/workflows/`. It uploads `app-debug.apk` as a GitHub Actions artifact. This workflow has not been run here and should not be treated as proof of a successful compilation.
