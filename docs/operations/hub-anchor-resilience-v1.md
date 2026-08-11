# Civweave Hub Anchor Resilience v1

## Principle

A Cloudflare Civweave host is a convenient live runtime, not the owner of the hub. Hub continuity is the recoverable combination of signed identity history, configuration/checkpoints, and peer-held ledger history. Every cloud host should strongly encourage at least one local **Anchor** on a laptop, desktop, Raspberry Pi, NAS, or small home server. The Anchor remains optional: no host is refused service for declining it.

The UI/service vocabulary is:

- `cloud-only`: no currently healthy local Anchor. Setup reminders should remain visible and become more prominent as the hub gains members/reputation.
- `locally-anchored`: one healthy local recovery copy.
- `redundantly-anchored`: two or more healthy independent recovery copies.

## What an Anchor stores

The Anchor daemon stores the latest signed `civweave.hub-recovery-checkpoint.v1` plus the Cloudflare Anchor-registry trust document. A checkpoint contains the public node manifest, public capacity snapshot, software/runtime continuity data, peer-reconstructable ledger frontier metadata, continuity Anchor public keys, and an optional opaque host-state envelope.

Sensitive external-money secrets are intentionally excluded. Stripe remains authoritative for Stripe-held money/top-ups. Cloudflare money-edge signing secrets remain Cloudflare-side. Passport/recovery secrets are not copied into the public checkpoint contract.

`stateEnvelope` exists for additional hub settings/reputation/pending-state material. It is treated as opaque data by the Anchor registry and should be encrypted before publication when it contains non-public state.

## Pairing

1. A host operator creates a short-lived one-time pairing grant for a specific `recipientId`.
2. The local Anchor creates its own Ed25519 signing key and proves possession while redeeming the grant.
3. Cloudflare records only the Anchor public key/fingerprint and the stipend recipient binding.
4. The local private key stays on the Anchor machine.
5. The hub publishes an updated checkpoint containing the continuity Anchor public keys, signed by the Anchor registry.

This avoids exporting a Cloudflare Durable Object private key to a laptop. During disaster recovery an Anchor can instead present a signed continuity claim referencing a previously Cloudflare-signed checkpoint. A replacement runtime can rotate its runtime key while retaining hub continuity.

## Sync and proof

The local daemon defaults to syncing every six hours. On sync it:

1. signs a fresh sync request;
2. downloads the newest signed recovery checkpoint and registry trust document;
3. atomically writes the checkpoint locally;
4. reads it back and verifies the expected checkpoint identity/hash;
5. signs the Cloudflare storage-proof challenge;
6. reports the checkpoint's recovery coverage.

The v1 proof is a practical key-possession + reconstruction/readback proof, not a hardware attestation or a formal proof that bytes remained on disk continuously. Stipend farming is additionally limited by unique Anchor signing-key fingerprints and a three-Anchor payout cap. Hardware/device attestation can be added later without changing the receipt schema.

## Weekly Button stipend

Only healthy Anchors are eligible. A healthy Anchor must be active, have proved the latest checkpoint, have a proof no older than 72 hours, use a checkpoint no older than 36 hours, and report at least 95% recovery coverage.

Per hub, the first three independent healthy Anchors receive diminishing weekly stipends:

| Anchor rank | Weekly stipend |
|---|---:|
| 1 | 3 Buttons |
| 2 | 2 Buttons |
| 3 | 1 Button |
| 4+ | 0 automatic Buttons |

The maximum automatic infrastructure stipend is therefore 6 Buttons per hub per week. Re-running stipend settlement is idempotent. Each grant is a signed `civweave.anchor-button-stipend.v1` receipt tied to `recipientId`, hub, Anchor, week, checkpoint, and recovery coverage. Backup stipend receipts are separate from AI-compute compensation.

The Cloudflare cron runs daily rather than only once per week so a transient scheduling/deployment miss can self-heal. Receipt IDs are week-scoped, so a healthy Anchor can still receive only one stipend receipt for that week. The stipend pass runs before the day's new checkpoint is cut, so an Anchor is evaluated against the most recent checkpoint it had a chance to prove.

## Partition / resurrection rule

When Cloudflare or the wider grid is unavailable, the local Anchor continues to serve its last checkpoint at `http://127.0.0.1:8791/recovery` and can issue an Anchor-signed recovery claim from `/recovery/claim`.

During incomplete recovery Civweave should continue ordinary local work and record new contribution/validation evidence provisionally. Irreversible external settlement remains frozen until the recovered hub has reconciled sufficient signed ledger history. This is the fail-closed boundary that prevents a network partition from turning disaster recovery into duplicate settlement.

## HTTP surface

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

Cloud node manifests and health responses expose the current resilience summary and advertise `local-anchor-recovery`, allowing Hub Map/discovery surfaces to display cloud-only / anchored / redundantly-anchored state without requiring an administration credential.

## Local daemon

Create a pairing grant, then on the backup machine run:

```sh
node scripts/civweave-hub-anchor-v1.mjs \
  --node https://my-hub.nodes.commonweave.earth \
  --pair <one-time-pairing-grant>
```

Useful local endpoints:

- `GET http://127.0.0.1:8791/health`
- `GET http://127.0.0.1:8791/recovery`
- `POST http://127.0.0.1:8791/sync`
- `POST http://127.0.0.1:8791/recovery/claim`

The daemon listens on loopback by default, so installing an Anchor does not silently expose a laptop as a public internet server.
