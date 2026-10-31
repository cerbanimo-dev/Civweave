# Guild democratic governance — v1

## Authority and electorate

Every active Guild resident may read the Guild Council. Opening a proposal requires a **verified contribution in the preceding 30 days**. Current evidence sources are a *new canonical Guild Quest publication* or *awarded physical-node community check-in*, both settled by the existing server. The Guild must not count login activity, AI inference, neuron spending, a client-supplied claim, or generated text as a verified contribution. Accepted task-work receipts are reserved as a future server-verified integration, not exposed as a browser write API.

At proposal creation the server snapshots current enrolled members with recent receipts. Every eligible member has one vote, including the proposed target. A strict majority of this snapshot (`floor(N/2)+1`) must approve each decision. The proposer immediately records their own yes vote. Ballots remain open seven days or until approval/rejection; no owner key, Guildkeeper role or local UI can set votes on someone else's behalf. A single eligible member cannot use remove, ban or report against themselves as a shortcut; they may voluntarily leave through the normal session/seat release endpoint. The majority requirement applies to **delegated Guildkeeper role changes** as well as removal, ban and report.

## Execution upon approval

The canonical Cloudflare Guild Capacity Durable Object exclusively owns members, proof receipts, delegated roles, sanctions and ballots. The deciding vote and resulting action are committed in one SQLite Durable Object transaction. A majority-approved vote immediately:

- **Role transfer**: grants or revokes the delegated `guildkeeper` role for a current resident. The founding credential remains separately owned and is never copied, transferred or leaked. Delegated Guildkeepers may use existing physical-node and Guildkeeper management features but **cannot** remove/ban/report people or change roles without a new member vote.
- **Remove**: invalidates the target's active Guild sessions and releases their Guild seat. Does not impose a future admission ban.
- **Ban**: performs removal and applies a 90-day block to the current resident ID and existing device credential hash. This is not a verified universal identity; a determined person can try to use a wholly new device/identity, and the system must not promise otherwise.
- **Report**: writes a privacy-limited approved report receipt to the automatic dispatch outbox. Configured public-directory transport verifies the source Guild's receipt against the registered public edge, then fans out a bounded notice to **registered Guilds within 25 km** of the reporting Guild's attested public pin. Only the reason category, reporting Guild, time, opaque pseudonym and approved-receipt reference are exposed; no name, raw resident ID, personal evidence, coordinate or private conversation is transmitted. A report is explicitly an **unverified allegation**, not proof, and never automatically bans someone at a receiving Guild.

The old founding-owner `remove-member` management action now fails with HTTP 403 and the founding UI routes to Council. Server checks cannot be bypassed by modifying the browser. Voluntary self-departure still works.

## Relay and rollout

The Guild Cloud needs `CIVWEAVE_GUILD_REPORT_RELAY_URL` set to the corresponding environment's HTTPS core directory endpoint ending `/api/guild-directory/report`, plus the same confidential 40–200-character `CIVWEAVE_GUILD_REPORT_RELAY_TOKEN` secret on the Guild Cloud Worker and the core directory Worker. Both endpoint requests and inbox retrievals require the server-only Bearer token; ordinary browsers and unauthenticated API clients are rejected. Neither setting belongs in public client JavaScript. Both are intentionally **unset by default**. If unconfigured, a successful report ballot creates the approved outbox receipt, but no actual inter-Guild delivery is falsely claimed. Once configured, the same request attempts transmission automatically; subsequent authenticated Council reads retry unresolved items. Delivery is recorded separately from approval. A Guild with no registered neighbours has zero recipients rather than inventing delivered notices. Require core migration `0016_guild_peer_reports.sql`, registration in the existing directory, independently verified source Guild status/receipt and valid public map pins on both sides.

The core directory stores a per-recipient, expiring report for 30 days; receiving Guild members can view warnings in Council without automatic sanctions. The directory's authenticated server-to-server report inbox contains only pseudonymous aggregate notices, not the member's raw identity. Guild Cloud verifies the viewing resident session and proxies the directory response rather than revealing the relay token to the browser. This initial protocol does **not** establish a portable cross-Guild user identity or an independent evidence adjudication / appeal system. Those limitations should be addressed before treating cross-Guild reporting as operational abuse prevention. Because a real report affects people's reputation, staging must be reviewed with a test directory and test Guilds before configuring production relay. Respect the existing requirement for human approval before high-stakes deployment.

## Entry points and tests

- Owner: `cloudflare/mobile-guild-edge/src/creator-provenance-entry.mjs` in `CivweaveGuildCapacityState`
- Policy: `guild-democratic-governance-v1.mjs`
- SQLite source: `guild-democratic-governance-state-v1.mjs`
- Directory: `cloudflare/core/src/guild-peer-reports-v1.mjs`
- User UI: `public/app/guild-democratic-governance-v1.js` opened from selected Guild tab
- Guildkeeper UI: `public/app/guild-owner-management-v1.js` delegates member sanctions to Council
- Tests: `scripts/test-guild-democratic-governance-v1.mjs` and `verify-guild-democratic-governance-v1.yml`

Important: this v1 applies to the **Cloudflare mobile-Guild Capacity Durable Object**. Other node-cloud, offline mesh or third-party Guild runtimes have not yet been granted equivalent governance endpoints, and the UI must fail closed on older servers. Successful staging test assertions do not imply production deployment or report delivery.
