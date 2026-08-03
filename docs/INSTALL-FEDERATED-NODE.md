# Install a Federated Commonweave Node

This guide installs a full Commonweave node that serves the PWA, keeps its own persistent identity, and can connect to other Commonweave nodes.

## Choose what you are installing

There are two distinct installations:

1. **Commonweave app:** a user installs the PWA from a node in their browser.
2. **Commonweave node:** an administrator runs a server that distributes the app and participates in federation.

A person may use the app without operating a node.

---

# Part I: Install the Commonweave app

Open the HTTPS URL of any trusted Commonweave node.

## Android

### Chrome, Edge, or Brave

1. Open the node URL.
2. Use the page's **Install Commonweave** action when shown.
3. If no prompt appears, open the browser menu.
4. Tap **Install app** or **Add to Home screen**.
5. Confirm installation.

The installed app continues to receive updates from its home node through the service worker.

## iPhone and iPad

1. Open the node URL in Safari.
2. Tap the Share button.
3. Tap **Add to Home Screen**.
4. Confirm the name and tap **Add**.

Apple devices do not expose the same install prompt used by Chromium browsers. Installation must be initiated from Safari's Share menu.

## Windows 10 and 11

### Microsoft Edge

1. Open the node URL.
2. Select **Apps** in the Edge menu.
3. Select **Install Commonweave**.
4. Choose whether to pin it to Start, the taskbar, or the desktop.

### Google Chrome

1. Open the node URL.
2. Select the install icon in the address bar, or open the menu.
3. Select **Install Commonweave**.

## macOS

### Safari

On supported macOS versions, open the node URL in Safari and choose **File → Add to Dock**.

### Chrome or Edge

Open the node URL and use the install icon or **Install Commonweave** menu action.

## Linux

Use Chrome, Chromium, Edge, Brave, or another browser that supports PWA installation:

1. Open the node URL.
2. Select the install icon in the address bar.
3. Confirm installation.

Firefox can run the site but does not provide equivalent desktop PWA installation on every Linux distribution.

## ChromeOS

1. Open the node URL in Chrome.
2. Select the install icon in the address bar.
3. Confirm installation.

---

# Part II: Operate a Commonweave node

## Recommended method: Docker Compose

Docker Compose is the most consistent installation path for Windows, macOS, Linux, Raspberry Pi, NAS systems, and many cloud servers.

### Prepare the repository

```bash
git clone https://github.com/cerbanimo-dev/Commonweave.git
cd Commonweave
cp .env.federated.example .env
```

Edit `.env` and set at least:

```dotenv
PUBLIC_HOST_URL=https://your-node.example
COMMONWEAVE_NODE_NAME=Your Community Name
COMMONWEAVE_NODE_DESCRIPTION=A short description of this node.
```

For local-only testing, use:

```dotenv
PUBLIC_HOST_URL=http://localhost:8787
```

Start the node:

```bash
docker compose -f docker-compose.federated.yml up -d --build
```

Check it:

```bash
curl http://localhost:8787/api/federation/status
```

Stop it:

```bash
docker compose -f docker-compose.federated.yml down
```

Update it:

```bash
git pull
docker compose -f docker-compose.federated.yml up -d --build
```

The named Docker volume preserves the node identity and federation state across rebuilds.

## Windows 10 and 11

### Docker Desktop

1. Install Git for Windows.
2. Install Docker Desktop and enable its WSL 2 backend.
3. Open PowerShell.
4. Run the Docker Compose instructions above.
5. Open `http://localhost:8787`.

To make the node reachable from the Internet, place it behind an HTTPS reverse proxy, Cloudflare Tunnel, or a router configuration you understand and control. Do not expose the Docker daemon itself.

### Native Node.js development mode

Install Node.js 22 or newer and Git, then run:

```powershell
git clone https://github.com/cerbanimo-dev/Commonweave.git
cd Commonweave
$env:PUBLIC_HOST_URL="http://localhost:8787"
$env:COMMONWEAVE_NODE_NAME="My Windows Commonweave Node"
npm install
node server-federated-v152.mjs
```

Keep the terminal open while the node runs.

## macOS

### Docker Desktop

Install Docker Desktop and Git, then use the Docker Compose instructions.

### Native Node.js

With Homebrew:

```bash
brew install node@22 git
git clone https://github.com/cerbanimo-dev/Commonweave.git
cd Commonweave
npm install
PUBLIC_HOST_URL=http://localhost:8787 \
COMMONWEAVE_NODE_NAME="My Mac Commonweave Node" \
node server-federated-v152.mjs
```

## Linux server or desktop

Install Docker Engine, the Docker Compose plugin, and Git using your distribution's package manager. Then use the Docker Compose instructions.

For a native Node.js installation:

```bash
git clone https://github.com/cerbanimo-dev/Commonweave.git
cd Commonweave
npm install
export PUBLIC_HOST_URL=http://localhost:8787
export COMMONWEAVE_NODE_NAME="My Linux Commonweave Node"
node server-federated-v152.mjs
```

For a long-running native installation, create a systemd unit or use Docker's restart policy rather than leaving it attached to a shell.

## Raspberry Pi

Use a 64-bit Raspberry Pi OS installation when possible.

1. Install Docker Engine and the Compose plugin.
2. Clone the repository.
3. Copy `.env.federated.example` to `.env`.
4. Set `PUBLIC_HOST_URL` to the Pi's HTTPS hostname or local address.
5. Start with Docker Compose.

Example local configuration:

```dotenv
PUBLIC_HOST_URL=http://commonweave.local:8787
COMMONWEAVE_NODE_NAME=Living Room Commonweave
```

For public federation, use HTTPS. Caddy or Cloudflare Tunnel can provide a public HTTPS route without placing Commonweave directly on port 80 or 443.

## Android with Termux

An Android device can run a small personal or local-network node, although the operating system may stop background processes to save battery.

Install Termux from F-Droid or another maintained source, then run:

```bash
pkg update
pkg upgrade
pkg install git nodejs-lts
termux-wake-lock
git clone https://github.com/cerbanimo-dev/Commonweave.git
cd Commonweave
npm install
export PUBLIC_HOST_URL=http://127.0.0.1:8787
export COMMONWEAVE_NODE_NAME="My Pocket Commonweave Node"
node server-federated-v152.mjs
```

Open `http://127.0.0.1:8787` on the same phone.

For access from other devices on Wi-Fi, replace `127.0.0.1` with the phone's local IP address and allow Termux to remain active. Android battery optimization may still suspend the node.

## Synology, QNAP, Unraid, TrueNAS SCALE, and other NAS platforms

Use the platform's Docker or container application:

1. Create a project from `docker-compose.federated.yml`.
2. Create a persistent volume mapped to `/app/data`.
3. Set the environment variables from `.env.federated.example`.
4. Expose container port `8787` through a local host port.
5. Configure the NAS reverse proxy for HTTPS before Internet federation.

Never delete the `/app/data` volume unless you intend to create a new node identity.

## Cloud VPS

On a small Ubuntu, Debian, Fedora, or similar VPS:

1. Install Docker and Git.
2. Clone the repository.
3. Configure `.env` with the node's public HTTPS URL.
4. Start Docker Compose.
5. Put Caddy, Nginx, Traefik, or Cloudflare Tunnel in front of port `8787`.
6. Back up the Docker volume.

A minimal Caddy configuration is:

```caddyfile
your-node.example {
  reverse_proxy 127.0.0.1:8787
}
```

## Render

Create a new Web Service from the repository and configure:

- Runtime: Docker
- Dockerfile path: `Dockerfile.federated`
- Persistent disk mount: `/app/data`
- Health check path: `/api/federation/status`
- Environment variable `PUBLIC_HOST_URL`: the final Render HTTPS URL
- Environment variable `COMMONWEAVE_NODE_NAME`: the node's display name

A persistent disk is required to preserve the signing identity through redeployments.

## Railway, Fly.io, and similar container hosts

Deploy using `Dockerfile.federated`, expose port `8787`, mount persistent storage at `/app/data`, and set `PUBLIC_HOST_URL` to the final HTTPS origin.

The exact dashboard labels differ, but the four requirements are constant:

1. build the federated Dockerfile;
2. expose port `8787`;
3. mount persistent storage at `/app/data`;
4. set the public URL correctly.

## Cloudflare Pages

Cloudflare Pages can host the static PWA but cannot run this persistent Node federation server by itself.

Use Pages for a public installer or release mirror, and run the federated node on a container host, home server, VPS, or a future Workers-compatible implementation.

---

# Connect two nodes

Assume these nodes are online:

```text
https://node-a.example
https://node-b.example
```

From node A, discover node B:

```bash
curl -X POST https://node-a.example/api/federation/peers/connect \
  -H 'content-type: application/json' \
  -d '{"baseUrl":"https://node-b.example"}'
```

The response includes node B's node ID. Trust it on node A:

```bash
curl -X POST 'https://node-a.example/api/federation/peers/cw%3A.../trust'
```

Repeat the process from node B toward node A so trust is mutual.

Publish a test event from node A:

```bash
curl -X POST https://node-a.example/api/federation/events \
  -H 'content-type: application/json' \
  -d '{
    "kind":"commonweave.test",
    "subject":"Hello from node A",
    "payload":{"message":"The weave is connected."}
  }'
```

Inspect node B:

```bash
curl https://node-b.example/api/federation/events
```

## Local test with two copies

Run two repository copies or two Compose projects with different ports and data volumes. Each node must have a distinct `PUBLIC_HOST_URL` and persistent data directory.

Example URLs:

```text
http://localhost:8787
http://localhost:8789
```

Do not point two running nodes at the same `/app/data` directory.

---

# Backups and updates

Back up `/app/data` before host migrations or destructive upgrades. It contains the node's federation identity.

A safe update sequence is:

1. back up the data volume;
2. pull or deploy the new code;
3. rebuild and restart the container;
4. verify `/api/federation/status`;
5. verify that the node ID has not changed;
6. send a test event to one trusted peer.

# Troubleshooting

## The app works but federation does not

Check that `PUBLIC_HOST_URL` is the URL another node can actually reach. `localhost` is only valid for same-machine testing.

## A peer remains pending

This is expected. Approve it with the `/trust` endpoint. Automatic trust is intentionally disabled by default.

## Events return `pendingApproval`

The receiving node has discovered the sender but has not trusted it. Approve the sender on the receiving node and send the event again.

## The node ID changed

The `/app/data` directory was replaced, deleted, or not mounted persistently. Restore the previous data backup to recover the original identity.

## Internet peers cannot reach the node

Confirm DNS, HTTPS, firewall, router, reverse proxy, and container port settings. Test `/.well-known/commonweave` from a device outside the local network.
