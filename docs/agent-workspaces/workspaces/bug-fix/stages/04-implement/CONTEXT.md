# Repair the existing owner

## Inputs
- ownership-map.json
- failing-test-reference.md

## Procedure
1. Change the owner, not a neighboring surface.
2. Update real callers and registrations without creating a parallel authority.
3. Remove obsolete active predecessors and references when replacement is complete.

## Outputs
- change-summary.md: exact files, data migration, affected callers, removed duplicates

## Acceptance
- The narrow regression passes without mutating feature contracts or existing user data.

## Next
Next stage: browser-verify
