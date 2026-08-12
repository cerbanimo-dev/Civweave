# Civweave Hub Anchor Resilience v1

## Principle

A Cloudflare Civweave host is the convenient live runtime, not the sole owner of the hub. Civweave strongly recommends at least one local **Anchor** on a laptop, desktop, Raspberry Pi, NAS, or home server, but never requires one to use or host Civweave.

The public resilience states are:

- `cloud-only`: no currently healthy local Anchor. Steward reminders remain persistent but non-blocking.
- `locally-anchored`: one healthy local recovery copy.
- `redundantly-anchored`: two or more healthy independent recovery copies.

A healthy Anchor combines a persistent local Civweave companion with a cryptographic checkpoint process. The full companion preserves local/federated node state; the Anchor process independently retains Cloudflare-signed recovery checkpoints and proves that it can read them back.

## What is backed up

A `civweave.hub-recovery-checkpoint.v1` may contain:

- public node manifest and capacity state;
- software/runtime continuity metadata;
- peer-reconstructable signed-ledger frontier metadata;
- the public keys of continuity Anchors;
- an optional opaque state envelope for host settings, reputation, and pending state.

The opaque state envelope should be encrypted before publication whenever it contains non-public state.

The Anchor contract intentionally excludes Stripe platform secrets, Stripe-held money, Passport recovery secrets, Cloudflare node private keys, and Cerbanimo money-edge signing secrets. Stripe remains authoritative for Stripe-held funds.

## Pairing

1. A steward creates a short-lived, one-time pairing grant through the operator-authenticated Cloudflare fabric route.
2. The local Anchor creates its own Ed25519 keypair.
3. The Anchor signs the grant domain and redeems the grant against the hub's public node endpoint.
4. Cloudflare stores the Anchor public key/fingerprint, recipient binding, and proof history. The local private key never leaves the Anchor machine.
5. The registry signs a new checkpoint containing the continuity Anchor public keys.

The operator token is never copied to the Anchor. Only the one-time pairing grant moves to the local device.

## Sync and storage proof

The local daemon defaults to a six-hour sync interval. Each sync:

1. signs a replay-windowed sync request;
2. downloads the newest recovery checkpoint and registry trust document;
3. verifies and pins the registry Ed25519 public key;
4. verifies the checkpoint content hash and Cloudflare registry signature;
5. atomically writes the checkpoint locally;
6. reads it back and verifies it again;
7. signs a nonce-bound storage-proof challenge for that exact checkpoint.

Unexpected registry-key rotation is rejected unless the steward explicitly runs with `--accept-trust-rotation` after independently verifying the rotation.

The v1 proof is a cryptographic key-possession plus reconstruction/readback proof. It is not hardware attestation and does not claim that the bytes remained continuously on disk between proofs.

## Weekly Button stipend

Only healthy independent Anchors qualify. An Anchor must:

- be active;
- prove the latest checkpoint;
- have a proof no older than 72 hours;
- use a checkpoint no older than 36 hours;
- report at least 95% recovery coverage.

Per hub, automatic weekly infrastructure stipends diminish by independent Anchor rank:

| Rank | Buttons/week |
|---|---:|
| 1 | 3 |
| 2 | 2 |
| 3 | 1 |
| 4+ | 0 automatic stipend |

The automatic maximum is therefore **6 Buttons per hub per week**. Duplicate Anchor signing-key fingerprints cannot multiply payouts. Receipts are week-scoped and idempotent, so daily cron retries cannot issue the same weekly grant twice.

Anchor stipend receipts are separate from AI-compute compensation. The v1 protocol emits signed `civweave.anchor-button-stipend.v1` receipts; canonical wallet ingestion can consume those receipts without changing the proof contract.

## Scheduling detail

Cloudflare runs the Anchor maintenance cron daily so a transient deployment/scheduler miss can self-heal. The stipend pass runs **before** the day's checkpoint refresh. This matters because a fresh checkpoint becomes the latest checkpoint immediately; refreshing first would make yesterday's valid proof obsolete milliseconds before stipend evaluation.

## Partition and resurrection safety

If Cloudflare or the wider grid is unavailable, the Anchor retains its last verified checkpoint and can create a signed `civweave.anchor-recovery-claim.v1` from its loopback recovery service.

During incomplete recovery Civweave may continue ordinary local work and record contribution/validation evidence provisionally. Irreversible external settlement remains frozen until sufficient signed ledger history is reconciled. This prevents a network partition from becoming a double-settlement mechanism.

## Cloud HTTP surface

Public per-node routes:

- `GET /api/node/anchor/status`
- `GET /api/node/anchor/trust`
- `POST /api/node/anchor/pair`
- `POST /api/node/anchor/sync`
- `POST /api/node/anchor/proof`
- `GET /api/node/anchor/stipends?recipientId=...`

Operator-authenticated fabric routes:

- `GET /api/fabric/nodes/:nodeId/anchors/status`
- `POST /api/fabric/nodes/:nodeId/anchors/pairing`
- `POST /api/fabric/nodes/:nodeId/anchors/checkpoint`
- `POST /api/fabric/nodes/:nodeId/anchors/stipends`
- `GET /api/fabric/anchors/trust`

Node manifests and health responses expose the resilience summary and advertise `local-anchor-recovery`.

## Docker setup

The normal federated node remains unchanged:

```sh
docker compose --env-file .env.federated -f docker-compose.federated.yml up -d --build
```

For a Cloudflare host backup, obtain a one-time pairing grant, set:

```dotenv
CIVWEAVE_CLOUD_NODE_ORIGIN=https://my-hub.nodes.commonweave.earth
CIVWEAVE_ANCHOR_PAIRING_GRANT=<one-time-grant>
CIVWEAVE_ANCHOR_SYNC_HOURS=6
```

Then start the optional profile:

```sh
docker compose --profile anchor --env-file .env.federated -f docker-compose.federated.yml up -d --build
```

The `anchor` service gets its own persistent Docker volume. Once paired, the one-time grant is no longer required for authentication; the persisted local Ed25519 key is the Anchor identity.

## Direct daemon setup

The cryptographic daemon can also run directly under Node 22:

```sh
node scripts/civweave-hub-anchor-v1.mjs \
  --node https://my-hub.nodes.commonweave.earth \
  --pair <one-time-pairing-grant>
```

Its recovery HTTP service binds to `127.0.0.1:8791` by default:

- `GET /health`
- `GET /recovery`
- `POST /sync`
- `POST /recovery/claim`

Binding to loopback means installing an Anchor does not silently expose a laptop recovery service to the LAN or public internet.
