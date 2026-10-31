# Guild physical-node capacity rewards and community location checks

## Roles and authority

The Guild identity remains local-first. Its original founder holds a separate owner-management credential; ordinary residents authenticate with a capacity session. The Cloudflare Capacity Durable Object already owns admission; it also owns the physical-node check-in state and capped **Guild verification tokens**. These are nontransferable recognition credits local to the Guild, not Acorns, Buttons, Neurons, money or canonical Passport Reward Ledger assets. A future governance-approved bridge may convert validation receipts into canonical rewards; no currency conversion is implied.

## Five cumulative capacity milestones

| Completion | Unlocked seats | Evidence |
|---|---:|---|
| Initial Guild Cloud claim | 5 | Guild Cloud paired |
| 20% | 6 | Physical companion server connects and pairs |
| 40% | 7 | First authenticated nearby member completes a rotating-code verification |
| 60% | 8 | Subsequent authenticated physical-node heartbeat |
| 80% | 9 | Challenge echo, authorized signed-object endpoint and cloud recovery probes |
| 100% | 10 | Founder finalizes while the node is online and not flagged |

Existing Guilds retain pre-existing capacity allocations. Earned seats and enrolled residents are retained even when a physical server is later removed, avoiding abrupt displacement.

## Guildkeeper neuron-flow monitor

The Guilds tab's existing **Manage Guild** action is available to the founding Guild owner (the currently supported Guildkeeper management credential). The owner-only management response now includes a read-only **Neuron flow** projection produced inside the Guild's canonical Capacity Durable Object from the existing `resident_usage` ledger; ordinary resident capacity sessions cannot read it.

It displays today's settled Guild Cloud neurons charged, remaining included allowance, current registered residents' allowance ceiling, and the next **UTC midnight** reset; a seven-day daily bar history; contributions to used neurons by Cloudflare starter node; and current residents' individual usage/remaining included quota. Charges from former residents remain in the Guild total but are grouped anonymously, preserving account removal. The live figures update only on opening or explicit Refresh; no new polling, duplicate wallet ledger or inference listener is introduced.

**Scope:** This is Guild Cloud Workers AI charge reporting, *not* a provider-wide Cloudflare account consumption meter, real-time token-by-token activity stream, device-local inference telemetry, external physical node usage, paid Gateway credit monitor or financial transaction view. Missing telemetry is shown as unavailable, not fabricated as zero. Historic data is daily aggregates, not per-request logs.

Server authorization reuses the founding owner credential verification on `GET /api/guild/manage`, which is separate from resident sessions or physical-node pairing keys. Delegated Guildkeeper privileges are not currently active; this screen grants no role delegation or rights to ordinary residents. The UI is part of the existing `public/app/guild-owner-management-v1.js` management surface. See `cloudflare/mobile-guild-edge/src/guild-neuron-flow-v1.mjs` and `scripts/test-guildkeeper-neuron-flow-v1.mjs`.

## Resident check-in and Guild verification tokens

In the installed Working Campus choose **Guilds**, select/join the relevant Guild and choose **Verify physical Guild server · earn tokens**. A logged-in resident must visit the publicly pinned location, read the rotating eight-character code displayed **locally by the physical server** and enter it. The browser requests an optional, one-time geolocation reading only on submission. A successful nearby verification is eligible for **1 nontransferable Guild verification token per resident per UTC day**, up to **20 tokens per Guild per UTC day**; up to six code attempts per resident per day. An accepted verification still counts as service evidence if a daily reward quota has been exhausted.

Each code derives from a node-held secret using HMAC, changes every minute, and is checked against an authenticated heartbeat digest with a two-minute maximum age. The Worker verifies the resident's capacity session, server code and freshness, and location proximity against the **server-side stored Guild Map pin**. Maximum location error is 500 m; the estimated distance plus error must be within 1,000 m of the pinned location. If the browser only provides a broad location, check-in is inconclusive: no credit and no negative report. A fresh successful check records its time and hashed credential receipt; raw user coordinates are not persisted by the Guild Capacity state. This method is a practical community check, **not tamper-proof geolocation or proof the machine itself occupies the stated address**: residents can share/relay a code, spoof location or collude. Attempts/reward caps and independent member reports help but do not eliminate abuse.

## Health and down/removal rules

The physical node has independent heartbeat and community-location signals:

- **Online**: recent authenticated heartbeat and no current location dispute.
- **Flagged**: one authenticated member submits a valid rolling code from a location outside the pinned radius. The node remains connected but is shown as location-disputed.
- **Down**: heartbeat is stale for 15 minutes **or** two different resident IDs report valid rotating codes from outside the pin within 24 hours. The down-start timestamp and reason are recorded. No volunteer reports by themselves do **not** mark the server down.
- **Removed**: the node remains down for 72 hours. A Durable Object alarm expires the physical-node credential, removes it from the visible physical-node listing and retains an audit reference. The Guild Cloud, logical Cloudflare starter nodes, Guild identity, member seats and earned rewards remain intact.
- **Recovery**: restored heartbeat recovers a connectivity-only outage before retirement. For a location-dispute outage, two distinct nearby successful verifications plus a fresh heartbeat are required. If retired, the founder must issue a new one-use pairing credential; past earned slots are preserved.

This requires an independent stream of heartbeats or corroborating successful on-site reports; a missed location-check opportunity is never interpreted as proof of failure. The alarm ensures unattended retirement after a sustained outage, even without an owner opening the dashboard.

## Setup on the physical server

1. Create Guild locally, pin its Guild Map placement, deploy/attach Guild Cloud.
2. From **Guilds → Manage Guild**, choose **Create 10-minute pairing code**.
3. On the physical machine, install Node.js 22+, configure the environment and run the Guild physical-node agent. Keep its terminal/screen physically accessible for nearby checkers. The pairing code and Guild sync secret must remain confidential.

```bash
export CIVWEAVE_GUILD_ORIGIN='https://your-guild-worker.workers.dev'
export CIVWEAVE_NODE_ID='your-physical-node-01'
export CIVWEAVE_NODE_PAIRING_CODE='paste-single-use-code'
export CIVWEAVE_GUILD_SYNC_KEY='existing-guild-synchronization-key'
node scripts/guild-physical-node-agent-v1.mjs
```

4. The agent echoes Cloudflare challenges, verifies the existing signed-object endpoint and cloud health, prints a rotating code at every accepted heartbeat, and persists its server-only node credential in `~/.civweave/guild-physical-node.json` with restricted permissions. Do not expose the code or the node-token file over a public route.
5. Residents opt in and check the node near the Guild pin. The founder's owner dashboard shows verified milestones and node health. If the node is missing or replaced, the founder may revoke or re-pair it.

## Routes and privacy

- `GET /api/guild/physical/status` publishes bounded node lifecycle status without a credential or raw location.
- `GET /api/guild/physical/check-in` requires a resident Bearer token and returns only that member's verification-credit total.
- `POST /api/guild/physical/check-in` requires a resident Bearer token, short-lived code and one-time location. The Worker validates the pin without storing precise coordinates.
- `POST /api/guild/physical/connect` uses the one-time pairing code.
- `POST /api/guild/physical/heartbeat` requires the physical node's secret, plus its current code hash.
- `GET/POST /api/guild/manage` remains founder-only.

## Validation

`node --test scripts/test-guild-capacity-progression-v1.mjs scripts/test-guild-community-proof-v1.mjs` checks deterministic location, reward and lifecycle logic. GitHub CI checks syntax and contract wiring. This does not establish a real-world anti-relay guarantee, successful Cloudflare deployment or a live on-site test. Do not claim precise physical positioning, fraud resistance, or production-ready reward economics beyond the documented limits.
