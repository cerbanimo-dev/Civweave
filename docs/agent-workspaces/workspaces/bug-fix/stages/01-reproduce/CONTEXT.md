# Reproduce the defect

## Inputs
- Original user report and observed UI behavior
- Installed-family active route, device and model selection

## Procedure
1. Reproduce in the real active route, not an archived prototype.
2. Capture the expected and observed behavior, logs and relevant device state.
3. When nondeterministic, record exactly how the failure was witnessed.

## Outputs
- reproduction.md: steps, observed/expected behavior, environment and evidence

## Acceptance
- A second maintainer can attempt the same failure; nondeterminism is explicit.

## Next
Next stage: trace-owner
