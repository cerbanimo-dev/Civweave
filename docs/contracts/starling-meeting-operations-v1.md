# Starling Collective — Meeting Operations v1 (Thread 5)

Target integration branch: `staging`. Intended first meeting: November 11, 2026.

## Functional boundary

`lib/starling-meeting-operations.mjs` is a deterministic, offline-first event-record core. It does not own a chat UI, live audio, turns, model routing, Quest execution, voting governance, or hosted persistence.

- Thread 2 is the sole source of `speech.committed` events through `lib/starling-meeting-live-adapter.mjs`. Partial ASR, silent listening, inner model messages, and speculative replies are never transcript entries.
- Thread 3 maps provider-specific model identities to stable meeting participant IDs, without importing model-private memory without explicit consent.
- Thread 4 presents a projection of these records; the 3D environment is not their functional owner.
- Thread 1 owns integration with the existing local object mesh, canonical Quest engine (`public/app/cerbanimo-quest-engine-v144.js`) and voting gate (`public/app/proposal-voting-gate-v2.js`), deployment, and audit.

## Input contract

Create with `createMeeting({meetingId,guildId,createdBy,participants})`.
A participant is `{id,kind:'human'|'agent',role:'guildkeeper'|'member'|'agent'|'observer'}`.
A human Guildkeeper must create the meeting.

Append via `appendMeetingEvent(meeting,{id,type,actorId,at,payload})` with an ISO UTC timestamp. The returned record is a new immutable value and can be persisted by the owning mesh integration.

Supported events:

| Event | Payload | Authority |
| --- | --- | --- |
| `listening` | none | Any participant; deliberately ignored |
| `speech.committed` | `{turnId,text}` | Any participant; only from Thread 2 verified speaking event |
| `agenda.updated` | `{items:string[]}` | Human Guildkeeper |
| `decision.proposed` | `{decisionId,title}` | Participant, including agents |
| `decision.approved` | `{decisionId}` | Human Guildkeeper |
| `decision.rejected` | `{decisionId}` | Human Guildkeeper |
| `quest.handoff` | `{decisionId,questId,ownerId}` | Human Guildkeeper; previously approved decision |

Each event ID is idempotent. A committed turn ID is also idempotent. Proposals are separate from authorization. A Quest handoff is a **pending request for a canonical Quest owner**, not proof that the Quest was created or completed. No agent can approve or hand off work using its agent role.

`projectMeeting(meeting)` returns agenda, transcript, decisions, and pending handoffs. `exportMeetingMarkdown(meeting)` provides an offline-readable report. Storage, signatures, conflict resolution, transcript consent, recording retention/deletion, identity authentication, and mesh synchronization must be completed at the integration boundary before real multi-device use. Caller-provided identity and timestamps are **not independently authenticated** by this pure core.

## Interoperability and acceptance

1. Thread 2 sends only verified final turns, with globally unique `turnId` and `id`, after the speech owner grants the floor.
2. Thread 1 authenticates the Guildkeeper and meeting participant identities before passing events; use canonical mesh conflict resolution, do not silently merge divergent meeting histories.
3. A human explicitly approves a proposed decision before any Quest handoff; the canonical Quest engine validates and persists the actual Quest separately.
4. Projection is safe without network or models. Records from an offline client remain provisional until the mesh confirms provenance and ordering.
5. Participants are informed when transcript recording is active and can use a non-recorded meeting mode; consent and retention remain integration blockers.
6. Transcript capture defaults to off. The live adapter requires committed, spoken, floor-granted turns; its caller must supply authenticated participant IDs and consent state from trusted runtime state, never the model message. This mapping is not itself authentication.\n7. Automated tests: `node --test scripts/test-starling-meeting-operations.mjs scripts/test-starling-meeting-live-adapter.mjs`.

This foundation is **not** a deployed meeting service and does not claim to be a complete voting, transcript-sync, or Quest integration.
