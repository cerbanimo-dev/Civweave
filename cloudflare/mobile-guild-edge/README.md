# Civweave mobile Guild Cloud

This directory is the self-contained **Deploy to Cloudflare** template for the Cloudflare stage of mobile Guild creation.

The phone creates the Guild identity first. That local Guild remains valid if Cloudflare is unavailable, removed, or replaced. Connecting Cloudflare now provisions an always-online Guild fabric around that local identity rather than creating the identity in the cloud.

## What one deployment creates

The Worker owns three Durable Object layers plus Workers AI:

- `GUILD_STATE` — one-time Guild claim, founding-device binding, synchronization authorization, and signed envelope relay.
- `CAPACITY` — the Guild's Cloudflare capacity controller and starter-node registry.
- `NODES` — three independently addressed starter Guild nodes created deterministically as `<guild-id>-a`, `<guild-id>-b`, and `<guild-id>-c`.
- `AI` — the Guildkeeper account's Workers AI binding. Authenticated node requests can run a caller-selected Workers AI model without routing ordinary Guild inference through Civweave's central Cloudflare account.

The starter nodes are logical Cloudflare nodes inside the Guildkeeper-owned Worker deployment. Each exposes its own health and AI manifest under `/nodes/<node-id>/...` and can grow behind the same capacity/fabric contract later.

## Mobile flow

1. In Civweave, create the Guild locally on the phone.
2. Civweave shows a one-time pairing code and opens this directory through **Deploy to Cloudflare**.
3. In the Cloudflare deployment form, paste that exact code into `CIVWEAVE_GUILD_CLAIM_TOKEN`.
4. Cloudflare runs the explicit build preflight and deploys the Worker, Durable Objects, and Workers AI binding.
5. Open the Worker root if desired; it now shows a human-readable **Civweave Guild Cloud is online** status page.
6. Return to Civweave, paste the Worker's `https://…workers.dev` address, and pair it.
7. `/api/guild/claim` binds the deployment to the already-created local Guild and bootstraps the three starter nodes.

Civweave records the resulting `civweave.guild-cloud-fabric.v1` manifest in local Guild state and in the signed Guild edge-attachment object. The one-time pairing code is then discarded locally.

## Public/status routes

- `GET /` — human-readable deployment and pairing status.
- `GET /api/health` — machine health plus fabric summary.
- `GET /api/guild/status` — Guild claim state and fabric summary.
- `GET /api/fabric/capacity` — starter-node capacity snapshot.
- `GET /api/fabric/manifest` — Guild Cloud capabilities and node addresses.
- `GET /nodes/<node-id>/api/node/health` — individual starter-node health.
- `GET /nodes/<node-id>/api/ai/node/manifest` — individual starter-node AI manifest.

## Authenticated routes

Pocket Nodes use the separate Guild synchronization key as a Bearer token. Only its hash is stored by the Guild-state Durable Object.

- `GET /api/envelopes`
- `POST /api/envelopes`
- `POST /nodes/<node-id>/api/ai/node/generate`

Workers AI generation requires a `model` plus `input`, `messages`, or `prompt`. The Worker bounds request size, disables streaming on this JSON route, and caps an explicitly supplied `max_tokens` above 2048. Model routing can remain a Civweave capability above this transport rather than being hard-coded into the deployment template.

## Security and sovereignty model

- Cloudflare does **not** create or replace the Guild identity.
- The Worker can be claimed only with the pairing code supplied as its Cloudflare secret.
- Claiming is idempotent for the same Guild and founding device and rejected for a different Guild.
- Raw Guild synchronization keys are not persisted in Durable Object storage.
- Workers AI execution requires Guild synchronization authorization.
- Every stored community object is validated against its payload hash, revision hash, origin fingerprint, and ECDSA P-256 signature.
- The shared Guild lane accepts public/federated objects and `group` objects addressed to this Guild. It rejects private/direct objects.
- Removing the Cloudflare deployment removes hosted capacity, not the locally canonical Guild genesis or its device-owned identity.

A desktop, Raspberry Pi, NAS, or other persistent local Anchor can be attached later without changing the Guild identity. A replacement Cloudflare account can likewise be paired around the same local Guild identity rather than becoming its source of truth.
