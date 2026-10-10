# Create a failing contract

## Inputs
- reproduction.md
- ownership-map.json
- Existing Capability Lock and CI contracts

## Procedure
1. Identify the smallest check that would fail against the broken implementation.
2. Add or tighten a test before the behavior change, or document why a manual repro is unavoidable.
3. Do not weaken trusted accepted tests.

## Outputs
- failing-test-reference.md: path, command, pre-fix failure, relevant accepted capability IDs

## Acceptance
- Failure is demonstrated against the unchanged product or the documented manual exception is defensible.

## Next
Next stage: implement
