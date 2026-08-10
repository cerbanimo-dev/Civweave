# Civweave Learning Packs v1

Learning packs are offline-first data bundles shared by Living School and Cerbanimo. They extend the current realm engines rather than replacing them.

## Pack contract

Every pack uses `civweave.learning-pack.v1` and can contain five linked record families:

- `skills`: stable skill references used to connect work and learning.
- `taskTemplates`: Cerbanimo work examples with outcome, steps, acceptance criteria, proof, expert links, and risk class.
- `learningUnits`: Living School curriculum seeds linked to the same skills and task templates.
- `expertGuides`: domain heuristics, common failure modes, and risk policy.
- `laborReferences`: descriptive occupational reference data. These are not executable procedures.

The shared runtime is `public/app/shared/learning-pack-runtime-v1.mjs`.

## Current authored library

The locally bundled authored library now contains 74 reusable task templates, 39 learning units, and 19 expert guides before any large external reference pack is installed.

The mandatory `civweave-core-practice-v1` starter contributes 20 task templates, 12 learning units, and 10 general expert guides.

Nine optional expert packs contribute another 54 task templates, 27 learning units, and nine domain guides:

- `civweave-expert-software-v1`: software and product engineering
- `civweave-expert-design-v1`: visual, UI, and media production
- `civweave-expert-research-v1`: research, writing, and knowledge curation
- `civweave-expert-operations-v1`: operations and administration
- `civweave-expert-data-v1`: data, metrics, and analysis
- `civweave-expert-service-v1`: service, support, and community
- `civweave-expert-learning-v1`: learning design and assessment
- `civweave-expert-project-v1`: project and product coordination
- `civweave-expert-labor-v1`: general labor and logistics

Each expert pack has six task templates, three learning units, one expert guide, its own tags, and its own cache identity. They share one compact module file but can be staged independently.

## Pack resolver

`public/app/shared/learning-pack-resolver-v1.mjs` turns a task or learning request into pack recommendations. It expands common user language into domain vocabulary before both pack selection and content search. For example, `bug` expands toward software/debugging/defect, `rubric` toward learning/assessment, and `warehouse` or `pack` toward labor/logistics.

The resolver stages at most a small number of relevant optional packs for the current request rather than loading the entire expert library. The catalog remains the deterministic source of which pack IDs and module exports are approved.

Cerbanimo can call `createRecommendedQuest(query)` to resolve the best expert pack, select a task template, compile it into the existing quest contract, and add it through the existing quest engine.

Living School can call `generateRecommendedCurriculum(query)` to resolve the best expert pack, select a learning unit, compile it into the existing curriculum request shape, and hand it to the existing Moss curriculum workbench.

## Safety boundary

A labor task statement becomes a guarded draft with `requiresAdaptation: true`. It has no executable steps. Cerbanimo's adapter will not create an executable quest from a reference that lacks reviewed work steps.

The authored General Labor & Logistics expert pack is also guarded. It covers ordinary receiving, cycle counts, pick-and-pack, work-area readiness, simple assembly from supplied instructions, and shift handoff, but includes explicit stop conditions for dangerous goods, hazardous energy, regulated equipment, unknown materials, missing instructions, or work beyond the user's training and authorization.

Use `riskClass: regulated` for references that must not compile directly without an explicitly qualified workflow. Current workplace instructions, training, authorization, manufacturer procedures, and applicable safety requirements remain authoritative for real-world work.

## Offline storage

`public/app/learning-pack-seeds-v1.js` uses a dedicated Cache API store and SHA-256 receipts. Packs are listed in `public/downloads/learning-packs/catalog.json`.

The small core pack and nine expert packs ship as module exports and are materialized into the same verified offline cache format used by downloaded packs. The core pack stages automatically. Expert packs are available locally but stage only when selected or resolved. Large reference packs remain optional downloads.

The cache receipt records both the module path and named export for authored expert packs. This lets multiple small domains share a compact source module without losing independent install/update state.

## O*NET Labor Atlas

Run:

```bash
node scripts/build-learning-packs-v1.mjs
```

The builder downloads the official O*NET 30.3 JSON tables for occupation data, task statements, essential skills, and task-to-DWA mappings. It groups occupational records with their task and skill rows, preserves Detailed Work Activity element IDs as crosswalk references, writes `onet-labor-atlas-30-3.json.gz`, computes its SHA-256, and updates the catalog entry from unavailable to available.

The repository intentionally does not mark the atlas available until that generated artifact exists. This prevents the app from advertising a large offline pack that has not actually been published.

The generated pack preserves O*NET's CC BY 4.0 attribution, identifies Civweave's restructuring as a modification, links the license, and includes the required non-endorsement language for modified O*NET content.

Occupational task statements remain descriptive reference examples. They are never converted directly into a safe procedure. A selected statement first becomes a guarded, zero-step draft and must be adapted through a task-specific expert pack, current workplace instructions, and any applicable qualification or safety requirements.

## Realm APIs

Cerbanimo exposes `globalThis.CivweaveCerbanimoLearningPacksV1` with `ready`, `catalog`, `status`, `stage`, `search`, `find`, `recommendPacks`, `resolve`, `templateToQuest`, `createQuest`, `createRecommendedQuest`, and `laborTaskDraft`.

Living School exposes `globalThis.CivweaveLivingSchoolLearningPacksV1` with `ready`, `catalog`, `status`, `stage`, `search`, `find`, `recommendPacks`, `resolve`, `curriculumInput`, `generateCurriculum`, and `generateRecommendedCurriculum`.

## Next data layers

The contract is intentionally source-neutral. Future generated packs can add ESCO skill/occupation crosswalks, BLS training/outlook metadata, safety references, trade-specific expert packs, or community-authored packs without creating a second task or curriculum engine.

A future visual pack shelf only needs to read the catalog and call the same APIs. Pack installation, routing, quest generation, curriculum generation, and labor-reference safety boundaries remain below the UI layer.
