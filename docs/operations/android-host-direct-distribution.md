# Direct Android Device Host distribution

## Status

Phase 1 plus a first Android host handshake implementation on the development branch. This adds Civweave Settings → Android Device Host,
a browser update manager, a typed signed-release contract, an offline manifest signer,
and regression tests. **It does not publish a signed release APK or activate native installation.**
Until an operator provisions a trusted Ed25519 release key and publishes a valid
release manifest, the download action fails closed.

## Trust and publishing

The release-signing private key must be created and retained outside this repository and outside
public deploy infrastructure. It must never be put in Git, source files, release assets, CI logs,
a JavaScript response, or a build artifact. The **public** Ed25519 key and its key ID are reviewed
and pinned in `public/app/device-host-update-ui.mjs`; they are not read from the manifest.

Suggested offline key generation on the signing workstation:

```sh
openssl genpkey -algorithm ED25519 -out /secure/offline/civweave-host-release-key.pem
```

After building and independently verifying the APK package ID, Android signing certificate,
and increasing versionCode, sign release metadata offline:

```sh
node scripts/sign-android-host-release.mjs \
  --apk /path/to/civweave-device-host-1.apk \
  --version-code 1 --version-name 0.1.0 \
  --signing-key /secure/offline/civweave-host-release-key.pem \
  --key-id civweave-host-root-1 --out /path/to/stable.json
```

The output prints the raw Ed25519 public key in base64url for **reviewed source pinning**,
never the private key. The signer refuses to read a private signing key stored in the repository,
and refuses to overwrite an existing manifest. The APK must be available at the exact
signed URL under `https://civweave.cc/downloads/device-host/`; publish the signed
`stable.json` last at `https://civweave.cc/downloads/device-host/stable.json`.

The release is a signed JSON envelope with immutable schema `civweave.android-host-release.v1`,
package `cc.civweave.devicehost`, positive Android versionCode, versionName, publication timestamp,
exact APK URL, byte count, SHA-256 digest and Ed25519 signature. Signature bytes cover canonically
key-sorted JSON of the `payload` object (UTF-8, no whitespace). The browser rejects untrusted
keys, changed payloads, unexpected origins, oversized downloads and SHA mismatches.

If the PWA is served from a different secure origin or Termux localhost, the release host must
send a restrictive `Access-Control-Allow-Origin` response supporting those intended origins.
Do not use permissive CORS on any future privileged localhost host API. The download must not
redirect. Keep `Cache-Control: no-store` for `stable.json`.

**Android app signing is separate from the Ed25519 release metadata key.** Android itself must
verify the APK signature and compatible package ID/certificate during installation. Keep
the Android signing identity stable across updates. Loss of that identity cannot be solved by
changing only the release manifest.

## Experimental native host

Android Studio can open `native/android/device-host/`. GitHub Actions compiles
`:app:assembleDebug` using Android SDK 35, Gradle 8.9 and Java 17. The generated
debug APK is not a production upgrade; CI-generated debug signing is not a stable
Android release certificate.

Host version 0.1.0 opens a native pairing screen. While Android keeps its activity
alive, a read-only server binds to `127.0.0.1:8792`. The PWA update manager
accepts a user-entered, 10-character code valid for two minutes and five failed
attempts. Successful pairing issues an opaque, ephemeral bearer token that is kept
only in PWA sessionStorage and native app process memory.

The only endpoints are `OPTIONS /v1/pair`, `OPTIONS /v1/status`,
`POST /v1/pair` and paired `GET /v1/status`, which advertises only
`android.host.status.v1`. Disallowed browser origins, unauthenticated status
requests, and other routes fail closed. Origin headers constrain browser
callers, but are forgeable by native processes. Future privileged endpoints must
independently authenticate requests and require user approval.

**Not yet a background service:** Android may terminate the activity when not
foregrounded. There is no local AI, BLE, package-install or unrestricted command
execution endpoint in this milestone. The upcoming PackageInstaller integration
must independently validate signed releases and preserve user approval.

## Native foreground lifecycle and future direct updater

The Android Host is now explicitly started from its Activity via
`startForegroundService`, with a user-visible ongoing notification and a Stop
button. The canonical `DeviceHostService` owns the loopback server; exiting the
Activity should no longer close it. It is opt-in, not boot-started, and returns
`START_NOT_STICKY`: Android may stop the process or reject a foreground-service
start in some conditions. It declares the `specialUse` type with a concrete
subtype and requires physical-device validation on Android 14–16.

The native app also contains `HostReleasePolicy` and `HostUpdateManager`.
They independently verify an Ed25519-signed manifest, reject a non-increasing
versionCode, strictly bind the package ID and HTTPS release origin, stream the
APK with a signed size cap and SHA-256 checksum, then compare the embedded APK
signing certificate with the installed Android Host. Only after a user presses
**Review and install** can it create a `PackageInstaller` session. User action
is explicitly required. The installer result receiver surfaces Android's
confirmation through a notification instead of silently launching an installer
from the background. Users can deny updates.

**Activation lock:** the native Ed25519 public signing key and key ID remain
empty constants in `HostReleasePolicy.kt`, and the browser keys remain empty
in `device-host-update-ui.mjs`. Both installer lanes fail closed until an
operator reviews and pins the production public key and publishes a compatible,
production-certificate-signed APK. Never upload private signing material.

The PWA can open the native manager through `civweave-host://updates` without
sending APK URLs, executable code, shell instructions or credentials through
the deep link. This avoids making the loopback interface a privileged install
endpoint. Pairing and version discovery remain read-only.

### Required device acceptance cases

- Starting host, switching to Chrome/PWA and checking paired status, then
  stopping host and confirming the endpoint becomes unavailable.
- Backgrounding, battery-saver activation, process termination and reboot:
  no false always-on guarantees or surprise restarts.
- Android 14–16 special-use foreground service behavior and notification
  permission denial.
- Rejecting forged manifests, damaged APKs, old versions, mismatched APK
  certificates, non-Civweave APKs and redirects, without opening installation.
- Actual signed update with Android approval, user cancellation, interruption,
  and preserved application data. Test the first production signing certificate
  separately from the ephemeral CI debug certificate; they are not compatible
  upgrade identities.
- Android's version-specific permission and pending-user-action installer
  callbacks, including the case where a confirmation notification cannot be shown.
- Compatibility on older Android versions that lack an Ed25519 verification
  provider: fail closed and use the manually verified APK pathway until support
  is explicitly added and tested.

## User flow

1. User opens Civweave Settings → Manage installation and direct APK updates.
2. Once a trust key is provisioned, user explicitly checks for a signed release.
3. Civweave verifies release metadata and, on request, downloads bytes with a hard size cap.
4. It validates exact byte count and SHA-256 before saving an APK through the browser.
5. User opens the saved file and confirms any Android unknown-app-source and install prompts.

The browser cannot silently install APKs. This phase never says an APK was installed merely
because the download completed. The browser can now authenticate the experimental host and read its version after manual pairing. When unreachable, the installed version remains **unknown**. The next host milestone must implement independently verified native update download, Android-approved PackageInstaller handoff, explicit install-result reporting, background lifecycle, compatibility negotiation and retained-data migration tests.

The PWA remains usable if the optional Android host is unavailable. Do not use runtime
application-code injection or download/install new executables behind users' backs.

## Required release gates

- `node --test scripts/test-device-host-updates.mjs`
- `node --check public/app/device-host-updates.mjs`
- `node --check public/app/device-host-client.mjs`
- Android Gradle CI `:app:assembleDebug` compile gate
- `npm run check` before shipping a materialized release
- `npm run build:install` to regenerate the offline install kit
- Android instrumentation on real devices for initial install, update, rollback rejection,
  unknown-sources approval, abandoned sessions, certificate mismatch, and user-data preservation

Until these gates and native Android work are complete, do not distribute this feature as a
completed self-updating native host.
