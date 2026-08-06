# Civweave Federation v1

Civweave Federation connects independently operated Civweave nodes without turning them into one central database. Each node keeps its own identity, chooses its own peers, and exchanges signed events only after explicit trust is established.

## Protocol shape

Federation v1 is a signed push protocol:

1. A node publishes a public discovery profile at `/.well-known/civweave`.
2. An operator discovers another node through the local administrator API.
3. The discovered peer remains `pending` until approved.
4. Both operators repeat the process in the opposite direction and approve each other.
5. A node signs an event with its persistent Ed25519 key and pushes it to the trusted peer's `/federation/inbox`.
6. The receiver checks the pinned key, sender identity, signature, event schema, timestamp, and duplicate status before retaining the event.

A connection is intentionally bilateral. Trusting Node B on Node A does not silently grant Node A access to Node B.

## Sovereignty rules

- Every node remains authoritative for records created on that node.
- Nodes exchange events and proofs, not whole databases.
- New peers require operator approval by default.
- A trusted peer's signing key is pinned. Rediscovery cannot silently replace it.
- A blocked node cannot deliver events.
- Removing a peer removes its local trust and block record.
- Private intentions, API keys, chat history, precise location, and unpublished drafts do not federate by default.
- Public outbox reads are disabled in v1. Events move through signed push delivery.

## Runtime topology

`server-federated-v152.mjs` is the public gateway. It:

- serves federation discovery and inbox routes;
- exposes token-protected administrator routes;
- starts the existing Civweave gateway on a loopback port;
- proxies ordinary HTTP traffic and upgrade connections to the existing application;
- stores node identity and federation state in the configured data directory.

The default container layout is:

```text
public port 8787
  ├─ /.well-known/civweave
  ├─ /federation/inbox
  ├─ /api/federation/health
  ├─ /api/federation/*     administrator token required
  └─ all other traffic     proxied to Civweave on 127.0.0.1:8788
```

## Persistent identity

At first launch the node creates:

```text
data/federation-identity.json
data/federation-state.json
```

The identity file contains the node ID and Ed25519 private key. The server refuses to silently regenerate an invalid or corrupted identity because doing so would unexpectedly create a different node.

Back up the entire data directory before migration. Never commit it, copy it into a container image, or publish it as an artifact.

## Discovery profile

```http
GET /.well-known/civweave
```

The `civweave.node-profile.v1` response includes:

- node ID;
- node name and description;
- origin URL;
- inbox URL;
- Ed25519 public key;
- SHA-256 key fingerprint;
- advertised capabilities;
- peer approval policy;
- software build information.

Federation v1 expects `PUBLIC_HOST_URL` and peer `baseUrl` values to be origin URLs without a path, credentials, query, or fragment. The inbox must use the same origin and the exact `/federation/inbox` path. Discovery and delivery redirects are rejected.

## Administrator authentication

All `/api/federation/*` routes except `/api/federation/health` require the federation administrator token.

Set:

```text
CIVWEAVE_FEDERATION_ADMIN_TOKEN=<long-random-secret>
```

Send it as either:

```http
Authorization: Bearer <token>
```

or:

```http
X-Civweave-Admin-Token: <token>
```

When no token is configured, administrator routes are locked unless `CIVWEAVE_ALLOW_UNAUTHENTICATED_ADMIN=true` is explicitly set. Do not enable that override on a shared LAN or Internet-facing node.

The public health route contains no peer or event data:

```http
GET /api/federation/health
```

## Peer lifecycle

A local peer record has one of these states:

- `pending`: discovered or seen at the inbox, but not approved;
- `trusted`: signed events using the pinned key are accepted;
- `blocked`: delivery is rejected;
- removed: no local peer record remains.

Unknown senders must provide a structurally valid profile and a correctly signed event before a pending record is created. Pending records are capped by `CIVWEAVE_MAX_PENDING_PEERS` to limit inbox flooding.

If a known node ID appears with a different public key, the request fails with a key-mismatch error. Operators must remove the peer, verify the new fingerprint out of band, and add it again deliberately.

## Administrator API

The examples below assume:

```sh
NODE=http://localhost:8787
TOKEN=replace-with-your-token
AUTH="Authorization: Bearer $TOKEN"
```

### Inspect the node

```sh
curl -H "$AUTH" "$NODE/api/federation/status"
curl -H "$AUTH" "$NODE/api/federation/peers"
curl -H "$AUTH" "$NODE/api/federation/events"
```

### Discover a peer

```sh
curl -X POST "$NODE/api/federation/peers/connect" \
  -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d '{"baseUrl":"https://peer.example"}'
```

Record and compare the returned key fingerprint with the remote operator before trusting it.

### Trust, block, or remove a peer

URL-encode the node ID in the path.

```sh
curl -X POST -H "$AUTH" "$NODE/api/federation/peers/<node-id>/trust"
curl -X POST -H "$AUTH" "$NODE/api/federation/peers/<node-id>/block"
curl -X POST -H "$AUTH" "$NODE/api/federation/peers/<node-id>/remove"
```

### Publish an event

Omit `targets` to deliver to every trusted peer. Supply an empty array to retain the signed event locally without delivering it. Supply node IDs to target specific peers.

```sh
curl -X POST "$NODE/api/federation/events" \
  -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d '{
    "kind":"fellowfare.offer.published",
    "subject":"Shared workshop tools available",
    "visibility":"federated",
    "payload":{
      "offerId":"offer:123",
      "summary":"Drill press and hand tools",
      "homeNodeRecord":"/offers/123"
    }
  }'
```

The response reports each delivery separately. A remote `pendingApproval` response is a failed delivery, not a success. Federation v1 does not yet retry failed deliveries automatically.

## Event model

A signed `civweave.federated-event.v1` record contains:

```json
{
  "schema": "civweave.federated-event.v1",
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

The signature covers every field except `signature`, using canonical JSON key ordering. Receivers reject unsupported top-level fields, invalid timestamps, mismatched origins, invalid signatures, and duplicate origin-plus-event-ID pairs.

Supported visibility values are `federated` and `public`. Both are delivered only to trusted peers in v1. `public` marks content that may be surfaced publicly by a later application layer; it does not make the raw federation inbox or event store public.

## Good first federated objects

- FellowFare public needs and offers;
- Living School public curricula;
- public events and capability listings;
- Anarchadia public proposals;
- portable completion proofs and credentials;
- release and node-discovery announcements.

Keep these local unless the user explicitly publishes them:

- private intentions and plans;
- chat transcripts;
- device workspace state;
- API keys and tokens;
- private learner records;
- precise location data;
- unpublished governance drafts.

## Security boundaries

Federation v1 provides:

- persistent Ed25519 node identity;
- signed event verification;
- key pinning;
- explicit bilateral trust;
- blocking and removal;
- event deduplication;
- administrator API authentication;
- redirect rejection for discovery and delivery;
- bounded pending-peer and event retention;
- atomic state writes;
- persistent identity and state storage.

It does not yet provide:

- user-level portable identity;
- encrypted private envelopes;
- signing-key rotation or revocation documents;
- per-capability peer permissions;
- individual-event moderation queues;
- automatic retry queues and backoff;
- conflict-free replicated documents;
- distributed consensus.

Federate only material intended for the receiving node's operators and users to read.

## Validation

Run:

```sh
node --check server-federated-v152.mjs
node --check scripts/verify-federation-v152.mjs
node scripts/verify-federation-v152.mjs
docker build -f Dockerfile.federated -t civweave-federated:test .
```

The verification script launches two isolated nodes, requires administrator authentication, connects and approves both directions, delivers a signed event, checks deduplication, rejects a tampered event, verifies blocking, confirms application proxying, and restarts a node to confirm identity persistence.
