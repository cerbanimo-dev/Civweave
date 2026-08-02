# Commonweave Host Node Hub

A deliberately small host for Commonweave. It does four jobs:

1. Serves the installer, updater, and optional network gateway from `/`.
2. Serves the installed offline-first Commonweave Pocket Campus from `/loom/` and `/lite/`.
3. Provides a lightweight host-node API for registration, presence, relay envelopes, and acknowledgements.
4. Offers the full offline mobile install kit as a ZIP download.

No advertising site, database framework, build chain, or external runtime dependency is required. The backend uses Node.js built-ins only.

## Quick local start

Requires Node.js 20 or newer.

```bash
npm start
```

Open:

- Installer: `http://localhost:8787`
- Visual PWA: `http://localhost:8787/loom/`
- Cabinet workstations: `http://localhost:8787/lite/`
- Health: `http://localhost:8787/api/health`

For another device on your LAN, open `http://YOUR_COMPUTER_IP:8787`. The server binds to `0.0.0.0` by default.

## Important PWA security note

Browsers allow full PWA installation and service workers on HTTPS origins and on `localhost`. A phone visiting a plain `http://192.168.x.x:8787` LAN address can download the ZIP and use the web app, but some browsers will not allow complete PWA installation from that insecure LAN origin. Use HTTPS through Render, a trusted local reverse proxy, or a tunnel for the smoothest mobile installation.

See `HOST-NODE-SETUP-GUIDE.md` for local, Docker, LAN, and Render instructions.


## Gemini Antigravity routing

Hosted Commonweave pages send Antigravity interaction requests to the same-origin `/api/ai/gemini/interactions` proxy. The host forwards each request to Google and does not write the Gemini key to disk, logs, or host-node state. Keep the key session-only in the browser. Standard creative-model routing remains unchanged.


## Default public host and update broadcasts

The built-in default host is `https://commonweave-host-node.onrender.com`. Connected clients listen for release events and periodically compare the current host build, app version, and install-kit SHA-256. Deploying a newer package automatically makes the new metadata available; `POST /api/releases/broadcast` immediately rebroadcasts the active release to connected clients.

## Cardinal visual interface

Version 1.0.10 treats the supplied artwork as the application surface across the suite. Conventional shells remain only as hidden implementation substrate; user-facing navigation is image-backed and editing occurs in illustrated world screens. See `VISUAL-CONTRACT.md`, `VISUAL-CONTRACT-AUDIT-v1.0.9.md`, and `VISUAL-ASSET-BACKLOG-v1.0.9.md`.


## v1.0.10 live-node recovery

This build repairs Living School and Cerbanimo visual startup, routes the Quad into host setup on unconnected devices, adds compact image-backed navigation glyphs, calibrates FellowFare's main atrium, suppresses stale heartbeat calls, and gives Antigravity permission failures a non-blocking Gemini fallback. See `RELEASE-NOTES-v1.0.10.md`.

## v1.0.28 parity-ledger architecture

The current entry points are:

- Visual Commonweave: `/loom/`
- Commonweave Lite: `/lite/`
- Canonical capability ledger: `/app/shared/commonweave-parity-ledger.json`

Visual and Lite consume the same systems, rooms, capability IDs, consent rules, handoffs, and reward semantics. The mature service applications remain available as working source surfaces while capabilities are migrated behind shared adapters. See `COMMONWEAVE-PARITY-LEDGER.md` and `RELEASE-NOTES-v1.0.28.md`.

## v1.0.29 cabinet workstations

Commonweave Lite now uses the five system cabinet artworks as its actual interface shell. All canonical rooms and capabilities render inside the cabinet projection rectangle, the physical bottom controls switch systems, and mature source tools open inside the same screen. The hierarchy remains shared with Visual Commonweave through the parity ledger. See `RELEASE-NOTES-v1.0.29.md`.


## v1.0.30 offline-first topology repair

The website and local application are distinct again:

- `/` installs, updates, reports host status, and exposes optional network/seed tools.
- `/loom/` and `/lite/` are the installed local campus renderers.
- `/service-worker.js` owns the root PWA scope and caches the coherent local shell.
- Hub connectivity widens gossip, federation, updates, and trade but is not required for local work.
- Visual pages use a small counted cabinet launcher to open their matching workstation as an overlay.

Cabinet images are now direct WebP assets rather than browser-decoded base64 chunks, and workstation content is clipped to the calibrated projection glass. See `RELEASE-NOTES-v1.0.30.md`.
