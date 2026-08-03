# Commonweave Federation v1

Commonweave Federation lets independently hosted Commonweave nodes discover one another, establish explicit trust, and exchange signed events without sharing entire databases.

## Design goals

- Every node can operate independently.
- A node remains authoritative for its own records.
- Nothing federates merely because two servers can reach each other.
- New peers require approval by default.
- Events are signed with a persistent Ed25519 node identity.
- Nodes may block, remove, or distrust peers locally.
- Private intentions, chat history, and device-only state do not federate by default.
- The existing Commonweave application and host-node API remain available behind the same public origin.

## Runtime topology

`server-federated-v152.mjs` is the public gateway. It listens on port `8787`, starts the existing Commonweave gateway on loopback port `8788`, handles federation routes, and proxies all other traffic to the existing application.

This keeps federation additive. The existing install-only PWA, release distribution, local-first runtime, host registration, and relay endpoints continue to work.

## Node identity

At first launch the node creates:

- `data/federation-identity.json`
- `data/federation-state.json`

The identity file contains a persistent Ed25519 key pair and node ID. Protect the data directory as you would any server credential. Back it up before migrating a node. Copying the data directory preserves the node identity; starting with an empty directory creates a new identity.

## Discovery

Each node publishes:

```text
GET /.well-known/commonweave
```

The response uses `commonweave.node-profile.v1` and includes:

- node ID;
- public URL;
- inbox and outbox URLs;
- public signing key;
- advertised capabilities;
- peer approval policy;
- software build information.

## Trust lifecycle

A peer can be in one of four local states:

- `pending`: discovered but not allowed to deliver events;
- `trusted`: signed events are accepted;
- `blocked`: requests are refused;
- removed: no local peer record remains.

Automatic acceptance is disabled by default. Set `COMMONWEAVE_AUTO_ACCEPT_PEERS=true` only for controlled networks.

## Federation API

### Inspect this node

```text
GET /api/federation/status
GET /api/federation/peers
GET /api/federation/events
```

### Discover a peer

```http
POST /api/federation/peers/connect
Content-Type: application/json

{
  "baseUrl": "https://another-node.example"
}
```

### Approve, block, or remove a peer

```text
POST /api/federation/peers/{nodeId}/trust
POST /api/federation/peers/{nodeId}/block
POST /api/federation/peers/{nodeId}/remove
```

URL-encode the node ID when placing it in the path.

### Publish a federated event

```http
POST /api/federation/events
Content-Type: application/json

{
  "kind": "fellowfare.offer.published",
  "subject": "Shared workshop tools available",
  "visibility": "federated",
  "payload": {
    "offerId": "offer:123",
    "summary": "Drill press and hand tools",
    "homeNodeRecord": "/offers/123"
  }
}
```

By default the node attempts delivery to every trusted peer. Supply a `targets` array of node IDs to restrict delivery.

### Receive events

```text
POST /federation/inbox
```

Incoming events are accepted only when:

1. the sender is trusted locally;
2. the event origin matches the sender node ID;
3. the Ed25519 signature verifies against the trusted peer key;
4. the event ID has not already been stored.

The first message from an unknown node creates a pending peer record and returns `202` without accepting the event.

## Event model

Federation exchanges events and proofs, not database snapshots.

A `commonweave.federated-event.v1` record contains:

```json
{
  "schema": "commonweave.federated-event.v1",
  "id": "event:...",
  "origin": "cw:...",
  "kind": "living-school.curriculum.published",
  "visibility": "federated",
  "subject": "Introductory bicycle repair curriculum",
  "payload": {},
  "createdAt": "2026-08-03T20:00:00.000Z",
  "signature": "..."
}
```

The signed portion excludes only the `signature` field. Canonical JSON key ordering is used before signing and verification.

## Recommended first federated object types

Start with records that are naturally public and easy to revoke or supersede:

- FellowFare needs and offers;
- Living School public curricula;
- public events and capability listings;
- Anarchadia public proposals;
- portable completion proofs and credentials.

Keep these local unless a user explicitly publishes them:

- private intentions;
- chat transcripts;
- device workspace data;
- API keys;
- private learner records;
- precise location data;
- unpublished governance drafts.

## Networking and HTTPS

Local nodes can federate over a trusted LAN using HTTP. Internet-visible nodes should use HTTPS through a reverse proxy or hosting platform.

Recommended reverse proxies:

- Caddy for the simplest automatic HTTPS setup;
- Cloudflare Tunnel when inbound ports cannot be opened;
- Nginx or Traefik in an existing server stack.

`PUBLIC_HOST_URL` must contain the externally reachable URL. Other nodes use it for discovery and inbox delivery.

## Security boundaries in v1

Federation v1 provides node identity, signature verification, explicit peer trust, event deduplication, and local blocking. It does not yet provide:

- end-to-end encryption for private cross-node payloads;
- user-level portable identity;
- key rotation or key revocation documents;
- fine-grained per-capability peer permissions;
- moderation queues for individual events;
- automatic event re-delivery and exponential retry;
- conflict-free replicated documents.

Those belong in later protocol revisions. Until encrypted envelopes are implemented, federate only data intended for the receiving node administrators and users to read.

## Migration and backup

Back up the complete mounted `/app/data` directory. Restoring it preserves:

- node ID and signing keys;
- trusted and blocked peers;
- retained federation events;
- legacy host-node state.

Never publish `federation-identity.json` or commit it to Git.
