# Civweave Learning Packs v1

Learning packs are offline-first data bundles shared by Living School and Cerbanimo. They extend the current realm engines rather than replacing them.

## Pack contract

Every pack uses `civweave.learning-pack.v1` and can contain five linked record families:

- `skills`: stable cross-pack skill references.
- `taskTemplates`: Cerbanimo work examples with outcome, steps, acceptance criteria, proof, expert links, and risk class.
- `learningUnits`: Living School curriculum seeds linked to the same skills and task templates.
- `expertGuides`: domain heuristics, common failure modes, and risk policy.
- `laborReferences`: descriptive occupational reference data. These are not executable procedures.

The shared runtime is `public/app/shared/learning-pack-runtime-v1.mjs`.

## Safety boundary

A labor task statement becomes a guarded draft with `requiresAdaptation: true`. It has no executable steps. Cerbanimo's adapter will not create an executable quest from a reference that lacks reviewed work steps.

Use `riskClass: regulated` for references that must not compile directly without an explicitly qualified workflow. Current workplace instructions, training, authorization, and applicable safety requirements remain authoritative for real-world work.

## Offline storage

`public/app/learning-pack-seeds-v1.js` uses a dedicated Cache API store and SHA-256 receipts. Packs are listed in `public/downloads/learning-packs/catalog.json`.

The small core practice pack ships as `public/app/shared/core-practice-pack-v1.mjs`; the seed runtime materializes it into the same verified offline cache as downloadable packs. Large reference packs remain optional.

## Core practice pack

`civweave-core-practice-v1` provides:

- 20 reusable task templates
- 12 learning units
- 10 expert guides
- shared skill references

It is original Civweave starter content intended to give Moss and Kamiya useful local scaffolding immediately.

## O*NET labor atlas

Run:

```bash
node scripts/build-learning-packs-v1.mjs
```

The builder downloads the official O*NET 30.3 JSON tables for occupation data, task statements, essential skills, and task-to-DWA mappings. It writes `onet-labor-atlas-30-3.json.gz`, computes its SHA-256, and updates the catalog entry from unavailable to available.

The generated pack preserves O*NET attribution and marks the Civweave restructuring as a modification. Publish the generated file as an optional download artifact rather than silently folding it into the mandatory application payload.

## Realm APIs

Cerbanimo exposes `globalThis.CivweaveCerbanimoLearningPacksV1` with `search`, `templateToQuest`, `createQuest`, `laborTaskDraft`, `stage`, `status`, and `catalog`.

Living School exposes `globalThis.CivweaveLivingSchoolLearningPacksV1` with `search`, `curriculumInput`, `generateCurriculum`, `stage`, `status`, and `catalog`.

This foundation intentionally separates the data contract from a future visual pack shelf. A browser, category selector, AI pack resolver, or expert-pack marketplace can sit on these APIs without changing the underlying format.
