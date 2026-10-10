# Moss: compile validated structure

## Inputs
- learning-design.md
- assessment-plan.json
- source-packet.json
- Existing canonical Living School module schema

## Procedure
1. Ask the existing selected-model runtime to construct the canonical module structure.
2. Use bounded output, visible actual model metadata and stage-local repair.
3. Preserve preceding artifacts if JSON compilation fails.

## Outputs
- draft-module.json: structured draft, actual-model metadata and source IDs

## Acceptance
- Schema conversion is inspectable, and no generation success is claimed for invalid JSON.

## Next
Next stage: validate
