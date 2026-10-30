# Guild physical-node capacity rewards and founder management

## Source of authority

A Guild begins on its creator's local device. New Cloudflare Guilds create a separate owner-management key during the one-time claim. The key is distinct from the shared Guild synchronization key, and only its domain-separated SHA-256 digest is retained by the Guild-state Durable Object. Ownership is checked on every administrative request, not by UI visibility alone. The founder's device holds the credential in its private local Guild state; do not share/export it to members or server operators.

The **existing** `cloudflare/mobile-guild-edge/src/creator-provenance-entry.mjs` Capacity Durable Object continues to own member admission; this feature adds milestone state there rather than a new membership service. Brand-new Guilds use 5–10 Citizen seats and no Patron expansion during this reward cycle. Existing previously claimed Guilds retain their 6 Citizen / 22 Patron legacy allocation and are not silently downgraded. An owner-key migration for older Guilds requires a separately authenticated, founder-signed recovery protocol and is deliberately not granted to someone merely holding the sync key.

## Milestones

| Stage | Capacity | Evidence |
| --- | ---: | --- |
| Cloud Guild created | 5 | Initial Cloudflare claim |
| 20% | 6 | Live Node 22 companion pairs using a short-lived single-use code, connects to Worker |
| 40% | 7 | Online node and a fresh, accurate owner's browser position within 500 m of the stored pin |
| 60% | 8 | Authenticated fresh heartbeat from paired physical node confirms identity and the cloud round trip |
| 80% | 9 | Physical agent echoes an issued challenge and reports both authorized signed-object endpoint reachability and a second cloud health probe |
| 100% | 10 | Owner finalizes while all previous milestones hold and heartbeat is fresh |

New slots unlock **one per verified milestone**. At 40% there are seven total seats, two more than the five initial ones. Rewards are cumulative and stored by the Cloudflare Durable Object. A temporary outage does not remove enrolled members or earned capacity; node-online status becomes stale after three minutes. Owners can revoke a paired physical node's key without erasing earned slots.

Proximity is **owner-attested**, based on browser geolocation. It is not tamper-proof server-location or GPS hardware attestation; a malicious owner could fake readings. The Worker rejects stale, inaccurate or distant coordinates. IP geolocation is not used.

## Owner dashboard

On the installed Working Campus, choose **Guilds → Manage Guild** on the originating owner's device. The interface displays locked/unlocked slots, milestones, member directory and removal, owner location verification, server pairing and heartbeat, a copyable invite origin, and the configuration/recovery state. No owner controls appear for ordinary residents. The backend independently rejects resident/session tokens from admin endpoints. Delegated guild-role editing is not activated; this release reserves admin authority for the founder only.

## Physical server setup

Use Node.js 22+ on a desktop, Raspberry Pi, NAS or other physical server.

1. Create a Guild locally, pin its Guild Map location, deploy its Guild Cloud and attach the Worker URL as usual.
2. On the founding device, open **Manage Guild**, choose **Create 10-minute pairing code**. Keep it secret.
3. On the **physical server**, set the environment variables below. Use the Worker origin returned by the Guild creation flow. The sync key comes from your Guild's existing secure local credentials; it is used only to probe the existing authorized signed-object relay and must not be published.
4. Run the companion and keep it running via your local operating system service manager. It stores a node token in `~/.civweave/guild-physical-node.json` with private-file permissions.
5. At the pinned location with the owner device, select **Verify nearby location** after the physical server shows connected. The companion then advances heartbeat-based stages. Select **Complete final checks** once the connection/sync checks pass.

```bash
export CIVWEAVE_GUILD_ORIGIN='https://your-guild-worker.workers.dev'
export CIVWEAVE_NODE_ID='your-physical-node-01'
export CIVWEAVE_NODE_PAIRING_CODE='paste-single-use-code'
export CIVWEAVE_GUILD_SYNC_KEY='existing-guild-synchronization-key'
node scripts/guild-physical-node-agent-v1.mjs
```

Unsetting the pairing code after the first successful connection is recommended. The node token is never exposed by a Guild status or membership endpoint. Revoke the node from owner management if the machine is lost; then issue a fresh pairing code. No Cloudflare account administrator secret is installed on the physical server.

## Endpoint summary

- `GET/POST /api/guild/manage` — owner Bearer token; the POST actions are `pair-node`, `verify-location`, `finalize`, `revoke-node`, and `remove-member`.
- `POST /api/guild/physical/connect` — short-lived, one-time node pairing code; returns a node Bearer token.
- `POST /api/guild/physical/heartbeat` — node Bearer token, challenge echo, and bounded sync/recovery probe flags.
- Existing `POST /api/ai/node/session` remains the ordinary resident admission path; its Citizen-slot cap is read from the same Durable Object.

## Verification

`npm run test:guild-capacity-progression` executes deterministic stage/proximity and wiring assertions; the dedicated GitHub workflow checks source syntax and the contract on PRs and staging/main pushes. Verify Cloudflare deployment and real physical/node location separately before advertising production readiness.
