# Trace canonical ownership

## Inputs
- reproduction.md
- Canonical ownership registry and active route map

## Procedure
1. Find the declared capability owner and all active callers, loaders, storage keys and caches.
2. Classify competing matches as owner, subscriber, caller, or obsolete.
3. Confirm the active route reaches the selected implementation.

## Outputs
- ownership-map.json: canonical owner, callers, relevant contracts, affected storage and release paths

## Acceptance
- Exactly one owner is identified or the need to consolidate duplicate owners is documented.

## Next
Next stage: test-first
