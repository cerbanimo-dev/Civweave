# Civweave mobile Guild public edge

This directory is a self-contained **Deploy to Cloudflare** template for the second stage of mobile Guild creation.

The phone creates the Guild identity first. That local Guild remains valid even if this deployment is cancelled or fails. This Worker is then deployed into the Guildkeeper's own Cloudflare account and claimed by the already-created Guild.

## Mobile flow

1. In Civweave, create the Guild locally on the phone.
2. Civweave shows a one-time pairing code and opens this directory through **Deploy to Cloudflare**.
3. In the Cloudflare deployment form, paste that exact code into `CIVWEAVE_GUILD_CLAIM_TOKEN`.
4. Deploy the Worker and copy its `https://…workers.dev` address.
5. Return to Civweave, paste that address, and choose **Pair public edge**.

Civweave sends the Guild ID, founding-device ID, the one-time pairing code, and a separate Guild synchronization key to `/api/guild/claim`. The Durable Object stores only a hash of the synchronization key. After the one-time claim, Pocket Nodes use the synchronization key to exchange signed Guild objects through `/api/envelopes`.

## Security model

- The Cloudflare deployment does **not** create or replace the Guild identity.
- The Worker can be claimed only with the pairing code supplied as its Cloudflare secret.
- Claiming is idempotent for the same Guild and founding device, and rejected for a different Guild.
- Raw Guild synchronization keys are not persisted in the Durable Object.
- Every stored community object is validated against its payload hash, revision hash, origin fingerprint, and ECDSA P-256 signature.
- The shared Guild lane accepts public/federated objects and `group` objects addressed to this Guild. It rejects private/direct objects.

A desktop, Raspberry Pi, NAS, or other persistent local Anchor can be attached later without changing the Guild identity.
