# Civweave Host Node Setup Guide

## What this package contains

- `server.mjs`: dependency-free Node host-node backend and static server.
- `public/index.html`: minimal installation landing page.
- `public/app/`: the complete offline-first Civweave PWA.
- `public/downloads/Civweave-Mobile-Install-Kit.zip`: downloadable offline install kit.
- `render.yaml`: one-click Render Blueprint configuration.
- `Dockerfile` and `docker-compose.yml`: container deployment.
- `data/`: local JSON host-node state.

## Host-node capabilities

The backend exposes:

- `GET /api/health`: health and basic node counts.
- `GET /api/config`: connection information and feature declaration.
- `POST /api/nodes/register`: register or refresh a local Civweave node.
- `POST /api/nodes/heartbeat`: keep a node marked active.
- `GET /api/nodes`: inspect known nodes.
- `POST /api/envelopes`: publish a bounded relay envelope.
- `GET /api/envelopes?nodeId=...&cursor=...`: poll relay envelopes.
- `POST /api/envelopes/:id/ack`: acknowledge delivery.
- `POST /api/presence`: publish current system, scene, and activity.
- `GET /api/presence`: inspect recent presence.
- `GET /api/events`: server-sent event stream for live node, presence, and envelope notices.

This is a host and relay node, not a canonical cloud database. Civweave remains local-first. The node stores only data explicitly sent to it.

# Option A: Run locally with Node.js

## 1. Install Node.js

Use Node.js 20 or newer. Node 22 LTS is recommended.

Confirm:

```bash
node --version
```

## 2. Start the node

From this folder:

### macOS, Linux, or Termux

```bash
chmod +x start-local.sh
./start-local.sh
```

Or:

```bash
npm start
```

### Windows

Double-click `start-local.cmd`, or run:

```powershell
npm start
```

The node listens on port `8787` unless `PORT` is set.

## 3. Open it

On the same machine:

```text
http://localhost:8787
```

The landing page checks the host, opens the installation wizard, and connects the PWA to the current node.

## 4. Open from another device on your network

Find the host computer's local IPv4 address.

### Windows

```powershell
ipconfig
```

### Linux or Termux

```bash
ip addr
```

### macOS

```bash
ipconfig getifaddr en0
```

Then open this on the phone:

```text
http://YOUR_LOCAL_IP:8787
```

Example:

```text
http://192.168.1.42:8787
```

Allow inbound TCP port `8787` through the computer firewall if necessary.

### PWA installation over LAN

Service workers normally require HTTPS, except on `localhost`. A phone using a plain local IP may not receive the browser installation prompt. The app and ZIP download still work. For full installability, use one of these:

- Deploy to Render for managed HTTPS.
- Put Caddy, nginx, or another trusted HTTPS reverse proxy in front of the node.
- Use a secure tunnel during testing.

## 5. Optional private-node token

Set `HUB_TOKEN` before starting:

```bash
HUB_TOKEN="replace-with-a-long-random-secret" npm start
```

The installer includes an optional token field. API clients can send either:

```http
Authorization: Bearer YOUR_TOKEN
```

or:

```http
X-Civweave-Hub-Token: YOUR_TOKEN
```

Health and public connection metadata remain accessible so the installer can find the node.

## 6. Local persistence

State is stored in:

```text
data/host-node-state.json
```

Back up that file to preserve registrations and relay history. The PWA's local data remains in each browser profile and is not stored in this file unless a workflow sends it to the node.

# Option B: Run locally with Docker

From this folder:

```bash
docker compose up -d --build
```

Open:

```text
http://localhost:8787
```

Stop:

```bash
docker compose down
```

The `./data` directory is mounted into the container for persistence.

# Option C: Deploy on Render

## 1. Create a Git repository

Put the contents of this folder at the repository root. The root should contain:

```text
package.json
server.mjs
render.yaml
public/
```

Commit and push it to GitHub, GitLab, or Bitbucket.

## 2. Create the service

In Render:

1. Choose **New** → **Blueprint**.
2. Connect the repository.
3. Render detects `render.yaml`.
4. Review the service and apply the Blueprint.

Alternatively create a **Web Service** manually with:

- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/api/health`

Do not hardcode a public port. Render supplies `PORT`, and this server reads it automatically.

## 3. Open the public installer

After deployment, open:

```text
https://YOUR-SERVICE.onrender.com
```

Render supplies HTTPS, so mobile browsers can install the PWA normally.

## 4. Optional environment settings

Set these in Render's Environment page:

```text
HUB_NAME=Your Community Host Node
HUB_TOKEN=a-long-random-secret
MAX_ENVELOPES=5000
```

Do not set `PORT`; Render provides it.

## 5. Persistence choices on Render

### Free web service

A free Render web service is suitable for testing installation and temporary relay behavior. Its filesystem is ephemeral. Node registrations, presence, and envelopes can disappear when the service restarts, redeploys, or spins down.

The installed Civweave PWA still retains its local-first browser data and continues working offline.

### Paid web service with persistent disk

For durable host-node state:

1. Upgrade the web service to a paid instance.
2. Add a persistent disk with mount path `/var/data`.
3. Set:

```text
DATA_DIR=/var/data
```

Only host-node relay state needs the disk. The bundled app remains part of the deployed source.

### Larger deployments

This host intentionally uses a small JSON state store. Before running multiple server instances or supporting a large public federation, replace the JSON persistence adapter with Postgres or another shared datastore. The HTTP API can remain stable while storage changes underneath it.

# User installation flow

1. User opens the host-node home page.
2. User selects **Open installation wizard**.
3. The PWA opens with the node URL prefilled.
4. User selects **Connect node**.
5. The browser registers a stable local node ID and stores the host configuration locally.
6. User selects **Install Civweave**, or uses the browser's Install/Add to Home Screen command.
7. User enters Civweave. Heartbeats continue while the app is open.
8. If the node goes offline, the installed app continues using its cached shell and local records.

# Host location onboarding

After the Cloudflare account Worker and its three starter nodes are ready, the host steward page offers **Place this hub on the mesh**:

1. Take the steward device to the physical place the hub serves.
2. Tap **Sync this place with the mesh** and approve the browser's one-time location request.
3. Civweave waits briefly for the best available GPS fix.
4. The browser rounds latitude and longitude to three decimal places before transmission. The exact device reading is not sent or retained.
5. The account Worker writes the same rounded site position to all three starter-node manifests so discovery and map surfaces can place the hub consistently.

The first successful sync creates a random location-claim key in the steward browser. Durable Object storage keeps only its SHA-256 digest. The same browser can update the site later; a different browser cannot silently replace it. Preserve the steward browser or its local Anchor before clearing site data.

The saved connection record uses:

```text
civweave.host-node.v1
```

The stable browser node ID uses:

```text
civweave.host-node-id.v1
```

# Basic verification

Run:

```bash
curl http://localhost:8787/api/health
```

Register a test node:

```bash
curl -X POST http://localhost:8787/api/nodes/register \
  -H "Content-Type: application/json" \
  -d '{"nodeId":"test-node","label":"Test Node","capabilities":["relay"]}'
```

Send an envelope:

```bash
curl -X POST http://localhost:8787/api/envelopes \
  -H "Content-Type: application/json" \
  -d '{"from":"test-node","to":"*","kind":"hello","payload":{"message":"The thread is live."}}'
```

Read it:

```bash
curl "http://localhost:8787/api/envelopes?nodeId=test-node"
```

# Security boundary

- The host does not receive the user's complete local database by default.
- The host stores only explicit registration, presence, and relay API submissions.
- Hub placement is opt-in and user-initiated. Exact GPS coordinates remain on the steward device; mesh manifests receive coordinates rounded to three decimal places and a conservative accuracy band.
- Location updates use a browser-generated claim key. Only its SHA-256 digest is stored by the Durable Object after the first successful claim.
- `HUB_TOKEN` protects write and inspection APIs when configured.
- TLS is provided by Render in hosted deployment.
- For a public node, use a token and avoid transmitting secrets inside relay payloads.
- This first host-node build does not provide user accounts, moderation, end-to-end envelope encryption, or abuse-resistant public federation controls.


## Gemini Antigravity routing

Hosted Civweave pages send Antigravity interaction requests to the same-origin `/api/ai/gemini/interactions` proxy. The host forwards each request to Google and does not write the Gemini key to disk, logs, or host-node state. Keep the key session-only in the browser. Standard creative-model routing remains unchanged.


## Default public host and update broadcasts

The built-in default host is `https://civweave-host-node.onrender.com`. Connected clients listen for release events and periodically compare the current host build, app version, and install-kit SHA-256. Deploying a newer package automatically makes the new metadata available; `POST /api/releases/broadcast` immediately rebroadcasts the active release to connected clients.
