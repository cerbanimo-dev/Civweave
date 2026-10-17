# Moss: deterministic output validation

## Inputs
- draft-module.json
- Existing canonical Living School JSON schema
- source-packet.json

## Procedure
1. Validate required fields, assessment structure, references and provenance using deterministic code.
2. Reject unknown source IDs and malformed modules.
3. Do not use model prose or confidence as schema authority.

## Outputs
- validated-module.json: schema-clean artifact with exact validation status

## Acceptance
- Only schema-valid modules advance; failure retains the draft for targeted retry.

## Next
Next stage: materialize
