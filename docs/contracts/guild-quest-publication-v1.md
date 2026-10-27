# Guild Quest publication

Any current authenticated Guild member may explicitly submit a saved Weaveling Quest to their own Guild. A Quest is an existing `kind: weave-plan` record with a `civweave.intention-weave.v1` plan. Cerbanimo's internal `quest` records are Endeavors and are not accepted here. Publication does not activate, move, or modify the original device-owned Quest.

The portable authority is `cloudflare/mobile-guild-edge/src/guild-quest-publications-v1.mjs`. Both existing hosted adapters use that same implementation. Node-cloud verifies its existing capacity session and current membership before calling its existing node Durable Object. The standalone mobile Guild edge verifies its existing resident session inside the capacity Durable Object. Its three starter nodes share the Guild's one board. No new binding or migration is needed.

The browser caller is `public/app/guild-quest-client-v1.js` (`CivweaveGuildQuestsV1`). It reads sessions from `CivweaveHostNodeSessionV1`; it never writes a parallel session or publication store. Local drafts remain available offline, while hosted submission/listing reports unavailable service explicitly. Network publication requires the user's explicit destination and submission action.

## API

All routes use the existing member bearer token and `nodeId` query/header. The server resolves the actor and destination from verified current membership. Caller-supplied `guildId`, `nodeId`, and author fields inside the submission grant no authority. Responses are `no-store`; CORS permits the existing explicit bearer-token client flow without cookies.

| Method and route | Request | Result |
| --- | --- | --- |
| `GET /api/node/quests` | Optional `limit` (1–100), `cursor` | `{ok, schema, nodeId, guildId, quests, nextCursor}` containing published records only |
| `GET /api/node/quests/{id}` | Publication ID | `{ok, publication}`; withdrawn records are visible only to their publishing member |
| `POST /api/node/quests/publish` | `{quest, expectedRevision}` | `{ok, publication, idempotent, created}`; 201 for a new publication, 200 for an update or identical replay |
| `POST /api/node/quests/{id}/withdraw` | `{expectedRevision}` | Same publication response with `status: withdrawn`; removes it from shared listing |

A publication contains `schema: civweave.guild-quest-publication.v1`, a server-derived stable `id`, `guildId`, original publishing `nodeId`, `authorUserId`, `revision`, `status`, `publishedAt`, `updatedAt`, and the projected `quest`. `authorUserId` identifies the submitting member; it does not make an authorship claim about the content. The same member and source Quest have one publication per Guild. A mobile member may read records published by a member on another starter node; the list envelope's `guildId` is the common destination.

New publications use `expectedRevision: 0`. Updates, withdrawal, and republication use the latest revision. Changed content with a stale revision fails with 409. An identical replay against the current or immediately preceding revision is idempotent. Only the original publishing member may change the row. Membership is checked on every external request; possessing an old session without current membership does not authorize access.

## Privacy and bounds

Publication projects explicit fields: Quest ID, title, outcome, state, open needs, and plan paths with their visible titles, purpose, completion criteria, steps, status, and numeric progress. `tracks` and task arrays normalize to `paths` and `steps`. Original wish, latest request, chat/conversation, profile, constraints, evidence contents, notes, assignment identities, arbitrary metadata, and credentials are excluded. The user previews the same projected fields before submission. Publishing a title or step shares that text with Guild members; it does not grant permission to include other private source fields.

Request bodies are bounded to 96 KiB, plans to 12 paths, each path to 64 steps, and open needs to 32. Titles are bounded to 240 characters, outcome to 4,000, and step descriptions to 2,000. Each Guild can retain 500 source publications, with at most 50 per publishing member; withdrawn records retain their revision and count toward this bound. Explicit withdrawal is a tombstone, not a claim that already viewed copies were erased.

Existing Durable Object transactional storage makes revision comparison, record changes, and the published index atomic. The node-cloud internal route requires a separate domain-derived authority token and accepts only the server-resolved member; exposing the same path through normal node routing does not bypass authorization.

`scripts/test-guild-quest-publications-v1.mjs` verifies two independent members, session and Guild isolation, current membership, private-field stripping, revision conflicts, withdrawal, pagination, and standalone mobile residents across starter nodes. `scripts/test-guild-quest-publication-ui-v1.mjs` exercises the existing carousel and explicit submission with independent browser storage.
