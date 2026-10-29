# Civweave Action Board v1 — Ready Now (staging)

## Purpose
A GTD-inspired **Capture → Clarify → Organize → Reflect → Engage** surface over existing Civweave Intentions and Quests. This is an additive, device-first feature and is not a replacement for the Quest review/proof/activation system.

## Entry point
The canonical Working Campus entry at `/app/working-campus-v440.html` loads `action-board-v1.mjs` and styles. A **Ready Now** button appears beside the existing Current Quest header. It opens an accessible dialog with Inbox, Ready, Focus, Waiting, Scheduled, Someday, and Logbook views. On legacy v156, this is deliberately not installed until that entry is migrated to the canonical v440 shell.

## Data ownership
- `civweave.intentions.v127`: the canonical saved personal Weaveling Quest ledger. **Read only.**
- `civweave.working-campus.v1`: current-campus draft fallback when the Quest is not in the canonical ledger. **Read only.**
- `civweave.action-board.v1`: personal quick actions, manually chosen status, estimates, dates, contexts, Focus flags, and per-Quest-Focus references. **Owned by Action Board, device local.**
- Does **not** mark Quest beat completion, create proof, activate a plan, publish to Guilds, or schedule automatic AI work.
- No cross-device sync or remote action endpoint in v1. Explicitly display device-local scope.

## Read-only projection rules
- Only saved plan objects are projected; duplicate campus/ledger plans are deduplicated by Quest ID with ledger priority.
- Completed steps (including saved `path.progress` indices) are not projected, nor are steps beneath a completed/accepted path.
- Review plans and explicitly blocked paths/steps appear in Waiting, never Ready.
- Dependencies match only **unique, explicit saved IDs**. Missing or duplicate references remain Waiting, without inferred completion.
- No dependency is invented from array ordering.
- A future start date moves the view to Scheduled; a due date does not.
- A Quest beat can be focused locally but remains canonical to its saved Quest. "View Quests" opens the standard Current Quest workflow rather than altering the stored plan.
- Time and energy filters exclude actions without estimates to avoid inventing capability requirements.

## Manual action lifecycle
Captured actions enter Inbox and can move among Inbox, Ready, Waiting, Scheduled, Someday, and Logbook. Focus is an independent flag. Moving to Done records a local timestamp. The interface never edits Quest rows to simulate progress. Storage write failure is surfaced visibly.

## Verification
Run `node --test scripts/test-action-board-v1.mjs` (or `npm run test:action-board`). Scenarios cover confirmed prerequisites, unknown/ambiguous IDs, unactivated Quests, canonical ledger precedence, deferred start dates, filtering, Focus, and store normalization.

## Follow-up scope
- Add editing and structured clarification for captured actions.
- Integrate exact Quest selection into the canonical owner without creating a competing selection store.
- Expose a capability- and resource-aware Ready engine to authorized AI callers.
- Add recurring actions, weekly reviews, reference-material handoff, sync/export, and Guild workload views after data contracts and consent boundaries are reviewed.
