# Core Labor Intelligence Audit v1

## Finding before this change

The O*NET Labor Atlas and ESCO crosswalk were presented as optional reference packs, but their actual role was infrastructure-like and unevenly connected.

### Cerbanimo

The Cerbanimo learning-pack adapter could normalize authored `skillRefs` through ESCO, but it called the crosswalk with `stage:false`. If the ESCO pack had not already been installed manually, generation simply retained Civweave skill IDs. Normal `createRecommendedQuest(query)` selected authored `task-template` records and explicitly excluded labor references, so the O*NET Labor Atlas did not inform ordinary quest generation. The Atlas was reachable only through the separate guarded `laborTaskDraft(referenceId, taskId)` path.

### Living School

Living School had the same passive ESCO behavior: accepted crosswalk mappings could enrich curriculum input only when the ESCO pack was already staged. `generateRecommendedCurriculum(query)` selected authored `learning-unit` records and excluded labor references, so O*NET occupations and essential-skill rows did not inform normal module generation.

### FellowFare

FellowFare recognized work/labor requests mostly through category and lexical heuristics. Its Work handoff carried agreement text and terms to Cerbanimo, and its Learn handoff carried thread text to Living School, but neither carried O*NET occupation identities, ESCO mappings, or normalized skill references. Rook's parent request flow likewise used the shared action contract without an occupational context layer.

## Architecture after this change

`public/app/shared/labor-intelligence-core-v1.mjs` is now the one shared labor-context owner.

It lazily manages:

- O*NET 30.3 Labor Atlas staging and occupation search;
- ESCO skill normalization;
- O*NET-to-ESCO occupation mapping;
- compact `civweave.labor-context.v1` generation for realm consumers.

The two data artifacts are marked `coreInfrastructure`, `hiddenFromShelf`, `optional:false`, and `autoStage:false`. This means the capability is part of the core package, but heavy parsing/cache work does not happen during realm boot.

## Realm usage after this change

### Cerbanimo

Authored task templates remain the executable-work source. The original user query plus authored skill refs are enriched with matching occupations, essential-skill context, accepted ESCO occupation mappings, and normalized skill refs when the request is labor-related. The result is stored under `packMetadata.laborContext`.

Raw O*NET task statements remain reference examples. `laborTaskDraft()` still produces a guarded, zero-step draft requiring adaptation and cannot directly create an executable quest.

### Living School

Authored learning units remain the curriculum source. Labor-related capability requests gain normalized skill refs and compact occupational/essential-skill context. Only descriptive capability context is appended to curriculum generation; raw O*NET task statements are not turned into lesson procedures.

### FellowFare

Labor-related market threads gain a lazy `laborContext` and normalized occupation refs. Work handoffs to Cerbanimo and Learn handoffs to Living School carry the same shared context. The parent Rook request flow also enriches labor request previews in the background.

FellowFare remains authoritative for exchange terms, settlement, and repair. The shared labor graph does not set prices, assert qualifications, accept agreements, or authorize work.

## Published core artifacts

The branch materializes the official O*NET 30.3-derived artifact into the repository and keeps the existing ESCO artifact. The catalog records:

- O*NET: 1,016 occupations, 18,796 task statements, 17,880 essential-skill rows, and 23,850 task-to-DWA rows.
- ESCO bridge: 61 authored Civweave skills, 4 accepted skill mappings, 20 review mappings, 37 unresolved skills, and 4,210 occupation mappings.

Both are checksum-addressed in the learning-pack catalog and included in offline/mobile package declarations, while runtime activation stays lazy.

## Verification boundary

`verify-core-labor-intelligence-v1.mjs` checks cross-realm wiring, hidden shelf treatment, packaged availability, real compressed artifact readability, and the key safety invariant: a real O*NET task statement produces `requiresAdaptation: true`, zero executable steps, and guarded risk class.
