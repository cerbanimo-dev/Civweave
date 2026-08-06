# Convergence data preservation rules

Aggressive deletion applies to executable architecture, not user history.

## Preserve

- active intentions and weave revisions
- Living School curriculum, progress, sources, assessments, practica, receipts, credentials, and skill evidence
- Cerbanimo projects, quests, work units, evidence, validation, and ownership records
- FellowFare needs, offers, exchange drafts, proposals, publications, and fulfillment receipts
- Anarchadia passport identity, governance records, capabilities, and projections
- signed Skill XP, Acorn, and Button ledger entries
- portable exports and recovery metadata

## Migration requirements

Every storage migration must be:

- deterministic
- idempotent
- versioned by schema, not runtime filename
- testable with fixtures from supported prior schemas
- reversible through portable export when practical
- explicit about fields intentionally retired

Old schema writers are removed after migration. Old schema readers live only in migration modules and may not become a second active state engine.

## Deletion boundary

A runtime may be deleted as soon as canonical state can be loaded, migrated, rendered, changed, exported, and reloaded without that runtime. A storage key may not be deleted merely because its original UI was retired.
