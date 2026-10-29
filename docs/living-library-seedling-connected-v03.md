# Seedling Edition v0.3 — Wi-Fi library + Moss companion

## Components and security boundaries

**X4 Pro CrossPoint firmware:** keeps EPUB library offline; reads OPDS book catalogs over Wi-Fi on stable builds. On plugin-capable beta/nightly firmware, the optional `seedling` SD-card plugin reads the public catalog at `/seedling/library-v1.json` (or preview branch URL) and downloads public-domain books under `/Books/Seedling/Updates`. Updates are **user-selected, not automatic background pushes**. CrossPoint's on-device HTTPS relay does not validate peer certificates, so **never send Passport, Guild or AI credentials through the plugin**.

**Phone/desktop Civweave:** `/app/living-library-seedling-connect-v1.html` loads the normal Civweave working campus in a *same-origin iframe*. It checks the actual logged-in Passport/Guild session and calls the canonical `CivweaveGuideChatSurfaceV350.open({guide:'living-school'})` and `.submitText(prompt,'living-school',{skipAddress:true})`. The selected model, Cloudflare account allowance (if configured), and approval gates are controlled by the existing Civweave runtime. No separate model key or direct AI spend mechanism is created. The companion supports TXT export of completed Moss messages. It does **not** run AI natively on the X4 Pro.

## What works as separate surfaces

- Official CrossPoint OPDS on the X4 Pro, using Project Gutenberg's public feed, needs no beta firmware.
- Plugin-capable CrossPoint X4 Pro builds can load `/plugins/seedling/{manifest.json,device.json,README.md}`, browse a versioned public book catalog and download public EPUBs to SD. Use Settings -> Connectivity -> Plugins to enable.
- Open the Civweave companion on the **same host/origin as the main Civweave working campus** and log in to a Guild/Passport. Check connection. If it says chat ready, enter a prompt and press Send; the normal Moss engine handles the request. View its native workflow/approval UI inside the embedded campus.
- The manual Learning Journey editor at `/app/living-library-seedling-v1.html` can stage canonical REVIEW plans and export reflowable X4 Pro EPUBs. A plan staged there is not automatically generated, approved or sent.

## Tests

Run `node --test scripts/test-living-library-seedling-v1.mjs` and `python -m unittest scripts/test_seedling_shelf_builder.py -v`. The first suite tests canonical review staging, exported EPUBs, Passport-gated Moss chat API, and no secret fields in CrossPoint plugin catalog. It cannot prove hardware Wi-Fi, browser iframe loading or paid model performance; these need human validation on the actual devices.

## Still to engineer

1. **Native Moss on X4 Pro:** requires a custom CrossPoint firmware integration or a secure on-device chat client with certificate-verified transport, scoped Passport device pairing, revocation, budget metering, generation UI, and tested sleep/reconnect behavior. The existing SD plugin cannot safely act as an authenticated client because the firmware relay lacks HTTPS peer verification.
2. **Truly unattended library synchronization:** current stable CrossPoint OPDS and SD catalog are user-initiated. Background content sync would need a supported scheduled plugin runner or native firmware service; verify availability and battery/storage impacts first.
3. **Automatic reference-volume updates:** `v0.2` has 40 offline articles; current public update catalog lists the 14 public-domain books. Publish signed, versioned article EPUBs with verification metadata before advertising remote updates to those volumes.
4. **Cross-device chats and generated plan sync:** normal Civweave browser session persists through existing app mechanisms; EPUB/TXT files require explicit download/transfer until authenticated device sync is built.

## Installation

- Stable CrossPoint 1.6.5: place all 19 EPUBs in `Books/Seedling/`. Add public OPDS using `https://www.gutenberg.org/ebooks/search.opds/`; no plugin required.
- Plugin-capable CrossPoint beta/nightly: copy `plugins/seedling/` to SD root, enable Plugins, choose the Seedling catalog from Home > Plugins. Keep the official firmware recovery instructions and avoid installing an experimental build solely for an optional public book catalog.
- Civweave companion: after PR is deployed to staging, visit `https://civweave-staging.pages.dev/app/living-library-seedling-connect-v1.html` from your logged-in browser. If the auth panel is not logged in, sign in to your existing Guild through its embedded Civweave campus. If it is a different origin from the usual Guild, log in again; do not copy session tokens.
