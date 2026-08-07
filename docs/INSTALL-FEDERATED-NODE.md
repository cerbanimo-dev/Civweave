# Install a Federated Civweave Node

A Civweave app and a Civweave node are different things:

- **App users** install the PWA from a node they trust.
- **Node operators** run a server that distributes Civweave and exchanges signed events with other approved nodes.

A person can use Civweave without operating a node.

## Install the Civweave app

Open the HTTPS address of a trusted node.

### Android and ChromeOS

In Chrome, Edge, or Brave, use the page's install action. When no prompt appears, open the browser menu and choose **Install app** or **Add to Home screen**.

### iPhone and iPad

Open the node in Safari, tap **Share**, choose **Add to Home Screen**, and confirm.

### Windows, macOS, and desktop Linux

Open the node in Chrome or Edge and choose the install icon in the address bar or the browser's **Install Civweave** command.

The installed PWA remains attached to that home node for releases and updates. Civweave's local-first workspace remains on the device unless the user explicitly publishes a federated object.

---

# Operate a node with Docker Compose

Docker Compose is the recommended path for a laptop, desktop, Raspberry Pi, NAS, home server, VPS, or container host.

## Requirements

- Git
- Docker Engine or Docker Desktop
- Docker Compose v2
- an externally reachable HTTPS origin for Internet federation

## 1. Clone the repository

```sh
git clone https://github.com/cerbanimo-dev/Civweave.git
cd Civweave
```

To test this PR before merge, check out its branch:

```sh
git checkout agent/federated-node-network
```

## 2. Create the environment file

```sh
cp .env.federated.example .env.federated
```

Generate a federation administrator token:

```sh
openssl rand -hex 32
```

Edit `.env.federated`:

```dotenv
PUBLIC_HOST_URL=https://weave.example.org
CIVWEAVE_NODE_NAME=Neighborhood Tool Library
CIVWEAVE_NODE_DESCRIPTION=Civweave node for our local workshop and learning circle.
CIVWEAVE_PORT=8787
CIVWEAVE_FEDERATION_ADMIN_TOKEN=paste-the-random-token-here
CIVWEAVE_ALLOW_UNAUTHENTICATED_ADMIN=false
CIVWEAVE_AUTO_ACCEPT_PEERS=false
CIVWEAVE_MAX_FEDERATION_EVENTS=5000
CIVWEAVE_MAX_PENDING_PEERS=256
HUB_TOKEN=
```

`PUBLIC_HOST_URL` must be the public origin other nodes can reach. Use no path, query, credentials, or fragment.

Keep `.env.federated` private. The administrator token grants peer-management and event-publication control.

## 3. Start the node

```sh
docker compose --env-file .env.federated -f docker-compose.federated.yml up -d --build
```

Check the container:

```sh
docker compose --env-file .env.federated -f docker-compose.federated.yml ps
docker compose --env-file .env.federated -f docker-compose.federated.yml logs -f
```

Check public health and discovery:

```sh
curl https://weave.example.org/api/federation/health
curl https://weave.example.org/.well-known/civweave
```

Check the protected administrator status:

```sh
curl https://weave.example.org/api/federation/status \
  -H 'Authorization: Bearer paste-the-random-token-here'
```

## 4. Put HTTPS in front of the node

Internet-visible nodes should not publish plain HTTP.

### Caddy

```caddyfile
weave.example.org {
  reverse_proxy 127.0.0.1:8787
}
```

Caddy obtains and renews certificates automatically when DNS points to the server and ports 80 and 443 are reachable.

### Cloudflare Tunnel

Use a tunnel when the host is behind carrier-grade NAT, a locked router, or a network where inbound ports cannot be opened. Point the tunnel service at:

```text
http://localhost:8787
```

Set `PUBLIC_HOST_URL` to the HTTPS hostname assigned to the tunnel.

### Nginx

Proxy ordinary HTTP and upgrade connections to port 8787. Preserve the original host and forwarded protocol headers.

## 5. Pair two nodes

Federation trust is bilateral. Both operators perform these steps.

Assume:

```sh
NODE_A=https://alpha.example
TOKEN_A=alpha-secret
NODE_B=https://beta.example
TOKEN_B=beta-secret
```

Discover Node B from Node A:

```sh
curl -X POST "$NODE_A/api/federation/peers/connect" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d "{\"baseUrl\":\"$NODE_B\"}"
```

Discover Node A from Node B:

```sh
curl -X POST "$NODE_B/api/federation/peers/connect" \
  -H "Authorization: Bearer $TOKEN_B" \
  -H 'Content-Type: application/json' \
  -d "{\"baseUrl\":\"$NODE_A\"}"
```

Each response includes a node ID and signing-key fingerprint. Compare fingerprints through a separate trusted channel, then approve each peer:

```sh
curl -X POST "$NODE_A/api/federation/peers/<node-b-id>/trust" \
  -H "Authorization: Bearer $TOKEN_A"

curl -X POST "$NODE_B/api/federation/peers/<node-a-id>/trust" \
  -H "Authorization: Bearer $TOKEN_B"
```

The nodes can now exchange signed events in both directions.

## 6. Publish a test event

```sh
curl -X POST "$NODE_A/api/federation/events" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d '{
    "kind":"civweave.hello",
    "subject":"Hello from Alpha",
    "visibility":"federated",
    "payload":{"message":"The thread is connected."}
  }'
```

Inspect Node B:

```sh
curl "$NODE_B/api/federation/events" \
  -H "Authorization: Bearer $TOKEN_B"
```

A delivery result is successful only when the remote node acknowledges `accepted: true`. A pending peer is reported as a failed delivery until the receiving operator approves it.

---

# Platform notes

## Raspberry Pi

Use a 64-bit Raspberry Pi OS release and a current Docker installation. The image is based on Node 22 Alpine and supports common 64-bit ARM hosts. Store Docker's data directory on reliable storage rather than a disposable SD-card partition when possible.

## NAS systems

On Synology, QNAP, TrueNAS SCALE, Unraid, or similar systems, import the Compose file through the platform's container manager. Map port 8787 and preserve the named volume or bind-mount `/app/data` to a backed-up directory.

## VPS and cloud virtual machines

Open only the ports needed by the reverse proxy, usually 80 and 443. Keep port 8787 bound to localhost or blocked by the firewall when a reverse proxy sits in front of it.

## Render and similar container hosts

Deploy using `Dockerfile.federated`, set `PUBLIC_HOST_URL` to the final HTTPS service URL, configure `CIVWEAVE_FEDERATION_ADMIN_TOKEN` as a secret, and attach persistent storage at `/app/data`.

A host without persistent `/app/data` creates a new node identity after redeployment. That breaks existing key pins and requires every peer to verify and trust the replacement identity.

## Termux on Android

Termux is useful for development and LAN experiments, but Android background-process limits make it a fragile always-on public node. A small server, Raspberry Pi, NAS, or VPS is a better long-running home for federation.

For local testing without Docker, use Node 22 or newer:

```sh
export PORT=8787
export CIVWEAVE_APP_PORT=8788
export PUBLIC_HOST_URL=http://127.0.0.1:8787
export CIVWEAVE_FEDERATION_ADMIN_TOKEN="$(openssl rand -hex 32)"
export DATA_DIR="$PWD/data"
node server-federated-v152.mjs
```

---

# Updates, backup, and recovery

## Update

```sh
git pull
docker compose --env-file .env.federated -f docker-compose.federated.yml up -d --build
```

The named volume survives container replacement.

## Back up

Back up all of `/app/data`. It contains:

- the node ID and signing keys;
- trusted, pending, and blocked peers;
- retained federated events;
- legacy host-node state.

For a named Docker volume, stop the service before taking a consistent archive or use your host's volume-backup tooling.

## Restore

Restore the complete data directory before starting the replacement node. Keep the same `PUBLIC_HOST_URL` when possible. Restoring only the event state without the identity file creates an unusable mismatch.

## Rotate a compromised administrator token

Change `CIVWEAVE_FEDERATION_ADMIN_TOKEN` in `.env.federated`, then recreate the container:

```sh
docker compose --env-file .env.federated -f docker-compose.federated.yml up -d --force-recreate
```

Administrator-token rotation does not change the node's signing identity.

## Replace a compromised signing identity

Federation v1 does not yet have an automated key-rotation document. A replacement identity must be treated as a new node:

1. take the compromised node offline;
2. preserve evidence needed for incident review;
3. start with a fresh data directory;
4. tell every peer operator the old node ID is retired;
5. compare the new fingerprint out of band;
6. remove the old peer and add the new node deliberately.

---

# Troubleshooting

## `503 Federation administration is disabled`

Set `CIVWEAVE_FEDERATION_ADMIN_TOKEN` and restart the node. The public health and discovery routes remain available while administration is locked.

## `401 Federation administrator authorization required`

Send the configured token in `Authorization: Bearer ...` or `X-Civweave-Admin-Token`.

## Peer remains pending

The receiving node's operator has not approved the sender. Both nodes must discover and trust each other for two-way exchange.

## Signing key changed

Do not trust the replacement automatically. Confirm whether the peer intentionally rebuilt or migrated without its data volume. Compare the new fingerprint through another channel, remove the old peer, and add the replacement only after verification.

## Delivery reports remote approval missing

The remote inbox returned `pendingApproval`. Ask that node's operator to inspect and trust your node ID and fingerprint.

## Node identity changes after restart

The data volume is not persistent or is mounted at the wrong path. Confirm `/app/data` is backed by the intended named volume or host directory.

## Container is healthy but the app surface returns 502

Inspect container logs. The federation gateway is running, but the internal Civweave application process failed or has not started.

## Discovery works locally but not from another node

Check DNS, HTTPS, firewall rules, reverse-proxy routing, and `PUBLIC_HOST_URL`. Discovery redirects are rejected, so the exact origin must directly serve `/.well-known/civweave`.

---

# Preflight checklist

- `PUBLIC_HOST_URL` is the exact reachable HTTPS origin.
- A long federation administrator token is configured as a secret.
- Unauthenticated administration is disabled.
- `/app/data` is persistent and backed up.
- `/.well-known/civweave` is publicly reachable.
- `/api/federation/health` reports `ok: true`.
- Administrator status requires the token.
- Peer fingerprints were compared outside the federation channel.
- Both nodes approved each other.
- A signed test event arrived at the remote node.
