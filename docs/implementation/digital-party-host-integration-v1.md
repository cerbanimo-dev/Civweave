# Digital Party hosting integration plan — Issue #945

Status: **implementation plan for staging review**, not a deployed feature. Scope: an opt-in, bounded fiction/performance session built atop Civweave's existing Party and Starling systems. This document does not grant autonomous agents credentials or publish authority.

## Verified existing owners (staging)

| Concern | Existing owner / contract | Reuse rule |
| --- | --- | --- |
| Human Party membership, anonymous role handles, encrypted transport, offline outbox | `public/app/shared-intention-party-chat-v1.js`; `scripts/verify-shared-intention-party-chat-v1.mjs` | Extend the existing Party capability; do not start a second chat, message transport or inbox |
| Shared chat entry and model routing | `public/app/shared-guide-surface-v236.js`; `docs/contracts/mobile-interface-contract.md` | One composer, lifecycle, transcript, streaming and local-model path |
| Starling personas and bounded turns | `public/app/shared/starling-collective-v1.mjs`; `public/app/shared/starling-collective-worker-v1.mjs`; `docs/contracts/starling-collective-v1.md` | Personas perform simulated character turns; no model-mediated Guild authority |
| Guild daily report | `public/app/shared/starling-daily-report-v1.mjs`; `docs/contracts/starling-daily-report-v1.md` | Record only signed, sanitized activity metadata; no private story transcripts or generated Quest proof |
| Hosted Guild capacity | `cloudflare/mobile-guild-edge/src/guild-starling-collective-v1.mjs` | Existing canonical admission and funded inference budgets apply |
| Canonical architectural boundaries | `AGENTS.md`, `config/agent-work-context.json`, `docs/architecture/repository-map.md` | Test first for behavior; do not edit materialized releases |

Paths are starting points verified on `staging`, not permission to add listeners or duplicate their implementation. Recheck imports, references, and branch SHAs immediately before code changes.

## Proposed session contract

The Party host explicitly opens an existing plan-scoped Party with a distinct optional fiction-performance mode. Session record needs `sessionId`, `planId`, `guildId` only when present and authorized, `hostParticipantId`, `status`, `createdAt`, `expiresAt`, `revision`, `allowedCharacterIds`, `turnPolicy` and a minimized participant list. Define the record schema and validation in the canonical Party owner, not here.

- **Invite / knocking:** inbound requests are merely pending requests. Nothing can join, start a microphone, invoke a model, or notify others beyond the opted-in host until authorization. Invitations expire; revocation blocks rejoin. A fictional in-story knock is not a claim of off-device perception or actual presence.
- **Join and leave:** human participants consent to the room and its retention policy. Character personas are explicitly labeled simulated performers, never human attendees or authenticated Guild members. Explicit close revokes session capabilities. Network reconnection must not independently restore revoked authority.
- **Turn taking:** the interaction owner arbitrates one active speaker and a bounded queue. Default is *silent unless called on*. Incoming Party messages never directly initiate model replies; a host-controlled dispatch action or explicit approved `@character` address is required. Interruptions cancel or pause queued generation rather than spawning parallel talk.
- **Permissions:** host authorizes who can invite, prompt character performance, record or export transcripts, and propose Quest assignments. Characters may propose fictional scene actions but cannot cast human votes, sign Quest completion, deploy code, transact credits, or access private memory without explicit authorized transfer.
- **Persistence:** use the Party's existing encrypted mesh and bounded offline outbox. Keep only necessary session metadata in the group. Story text remains in user-authorized transcripts; never silently copy it into Guild reports. On resumed sessions, review expiry and roster permissions before allowing new model work.
- **PvE continuity:** scene beats, generated dialogue and improvisation are fiction. Durable canon promotion requires human editorial review, separate from Guild Quest verification. A model generated 'completed' is never execution evidence.
- **Budgets and shutdown:** local inference only on explicit demand, with device thermal/RAM limits; hosted inference only by existing authenticated, funded paths with consent and visible failures. Close/session expiry cancels outstanding generations and holds no audio capture open.

## Implementation sequence (small PRs)

1. **Discovery** — trace current Party runtime, signed Guild session authority, Starling persona registry, canonical shared chat model invocation, loaders and offline asset manifest. Confirm whether planned November meeting capabilities already exist; do not blindly add a new owner.
2. **Tests first** — deterministic tests for pending vs approved knock; expiry, revocation and reconnect; silent-by-default agent turn gate; no model trigger from incoming network packets; one speaker at a time; cancellation; rejected unauthorized tools; false Quest-completion assertions.
3. **Session authority** — minimal Party-owned schema and human-signed actions. Reuse existing Party encryption and transport; no independent chat loop or global event capture layer.
4. **Persona dispatcher** — explicit human dispatch into the canonical model runtime, one bounded scene turn at a time. Clear persona labels and no unsupervised responsive chatter.
5. **Reporting and review** — sanitize signed session metadata into existing Guild report producer authorization; expose an explicit author review step for script/canon/Quest proposals.
6. **Staging acceptance** — test two humans plus multiple fictional personas, interruption/silence, offline/reconnect, phone keyboard, denied invite, role separation, actual local-model failure, and cloud capacity denial. Record actual CI results and staging deployment artifacts before considering production.

## Release gate / demonstration

A host starts the Party, permits a human attendee to join, sees silent fictional performers, prompts exactly one character for a bounded PvE response, interrupts, revokes an invite, loses/reconnects network, and sees an accurate signed activity receipt **without** any automatic Quest completion or private transcript leakage. No production launch claim is valid until live staging receipts demonstrate this scenario.

## Open integration questions

- Which canonical owner should persist session authority when a Party is purely device-local without a Guild?
- Which currently routed Party UI is the visible control surface for the host's session settings?
- Whether microphone/live voice needs a separate consented device/audio capability — never piggyback on chat without explicit permission.
- Confirm source and tests for Worldweaver 3D avatar rendering as an **optional presentation subscriber**, not a second interaction authority.

Tracked by [issue #945](https://github.com/cerbanimo-dev/Civweave/issues/945). 
