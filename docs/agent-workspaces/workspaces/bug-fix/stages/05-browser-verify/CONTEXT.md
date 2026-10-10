# Verify the installed product

## Inputs
- change-summary.md
- failing-test-reference.md

## Procedure
1. Run the narrow test followed by relevant broader checks.
2. Exercise the actual installed browser path, including offline behavior where relevant.
3. Inspect Settings, navigation, service worker and local inference startup for affected work.

## Outputs
- verification.md: commands, results, browser reproduction and failure evidence

## Acceptance
- Accepted behavior works through the installed entrypoint; failures are not described as passes.

## Next
Next stage: review
