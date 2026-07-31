# Commonweave Host Node Hub

A deliberately small host for Commonweave. It does four jobs:

1. Serves the complete Commonweave Pocket Campus PWA from `/app/`.
2. Walks a visitor through connecting and installing it.
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
- PWA: `http://localhost:8787/app/`
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

Version 1.0.9 treats the supplied artwork as the application surface across the suite. Conventional shells remain only as hidden implementation substrate; user-facing navigation is image-backed and editing occurs in illustrated world screens. See `VISUAL-CONTRACT.md`, `VISUAL-CONTRACT-AUDIT-v1.0.9.md`, and `VISUAL-ASSET-BACKLOG-v1.0.9.md`.
