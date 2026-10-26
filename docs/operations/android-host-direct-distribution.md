# Direct Android Device Host distribution

## Status

Phase 1 implementation on the development branch. This adds Civweave Settings → Android Device Host,
a browser update manager, a typed signed-release contract, an offline manifest signer,
and regression tests. **It does not produce a built APK or activate installation.**
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

## User flow

1. User opens Civweave Settings → Manage installation and direct APK updates.
2. Once a trust key is provisioned, user explicitly checks for a signed release.
3. Civweave verifies release metadata and, on request, downloads bytes with a hard size cap.
4. It validates exact byte count and SHA-256 before saving an APK through the browser.
5. User opens the saved file and confirms any Android unknown-app-source and install prompts.

The browser cannot silently install APKs. This phase never says an APK was installed merely
because the download completed. The browser cannot yet authenticate an installed host, so
the UI reports installed version as **unknown**. A subsequent native host implementation must
add authenticated pairing, version discovery, Android-approved PackageInstaller handoff, explicit
install result reporting, compatibility negotiation and retained-data migration tests.

The PWA remains usable if the optional Android host is unavailable. Do not use runtime
application-code injection or download/install new executables behind users' backs.

## Required release gates

- `node --test scripts/test-device-host-updates.mjs`
- `node --check public/app/device-host-updates.mjs`
- `npm run check` before shipping a materialized release
- `npm run build:install` to regenerate the offline install kit
- Android instrumentation on real devices for initial install, update, rollback rejection,
  unknown-sources approval, abandoned sessions, certificate mismatch, and user-data preservation

Until these gates and native Android work are complete, do not distribute this feature as a
completed self-updating native host.
