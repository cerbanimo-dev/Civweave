# Commonweave RC21.6 · Adaptive Plan Graph and Round-Trip Outcomes

## Added

- Automatic linking of native destination records back to exact intention steps using native commit receipts.
- Adaptive dependency graph with parallel groups and a calculated critical path.
- Destination-state reconciliation for active, review, blocked, rejected, and completed records.
- Conflict detection when a native record and Commonweave plan both change after import.
- User-controlled conflict resolution that either adopts native state or preserves the orchestration plan.
- Impact previews for high-level plan changes, including downstream dependencies, deadline caveats, and strategy tradeoffs.
- Reviewed recovery-plan proposals when work is blocked, stale, or drifting.
- Configurable intention check-ins and meaningful-change messages in the persistent Quad thread.
- Dedicated Intention Steward interface with plan health, graph nodes, conflicts, recovery controls, and outcome synthesis.
- Completion synthesis summarizing completed work, systems involved, material plan changes, and continuation paths.

## Guardrails

- Native records remain owned by Cerbanimo, Living School, FellowFare, and Anarchadia.
- Commonweave adopts native state only after explicit conflict resolution.
- Recovery plans and structural adjustments remain review-required.
- Deadline or strategy changes do not silently rewrite destination records.
