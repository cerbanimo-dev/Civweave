# Map the feature owner

## Inputs
- feature-contract.md
- Canonical architectural contracts and source map

## Procedure
1. Find existing capability owners.
2. Trace active routes, callers and storage.
3. Propose a new owner only if extension cannot serve the feature.

## Outputs
- ownership-map.json: owner, integration boundary, callers, storage and migration

## Acceptance
- One canonical owner per capability; source folder is not treated as authority.

## Next
Next stage: test-first
