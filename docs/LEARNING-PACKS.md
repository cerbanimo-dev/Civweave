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

The locally bundled authored library contains 74 reusable task templates, 39 learning units, and 19 expert guides before the core labor reference layer is activated.

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

The resolver stages at most a small number of relevant optional expert packs for the current request rather than loading the entire expert library. The catalog remains the deterministic source of which pack IDs and module exports are approved.

Cerbanimo can call `createRecommendedQuest(query)` to resolve the best expert pack, select a task template, compile it into the existing quest contract, and add it through the existing quest engine.

Living School can call `generateRecommendedCurriculum(query)` to resolve the best expert pack, select a learning unit, compile it into the existing curriculum request shape, and hand it to the existing Moss curriculum workbench.

## Core labor intelligence

O*NET and ESCO are no longer user-managed shelf options. They are core infrastructure owned by `public/app/shared/labor-intelligence-core-v1.mjs`:

- `onet-labor-atlas-30-3` supplies descriptive occupation, task-statement, essential-skill, and DWA reference context.
- `esco-skill-crosswalk-v1` normalizes authored Civweave skill identities into ESCO and bridges O*NET occupations to ESCO occupation identities.

Both artifacts remain **lazy**. `coreInfrastructure: true` means the capability is part of Civweave; `autoStage: false` means the data is not decompressed, hashed, or cached during realm boot. The core manager stages it only when a labor-related generation or request actually needs it. This preserves the Cerbanimo launch-freeze repair while removing the misleading “optional add-on” lifecycle.

The Learning Pack Shelf hides both records. Users browse authored task, learning, and expert content there; internal crosswalk/index data is handled by the generation and handoff runtimes.

`labor-intelligence-core-v1.mjs` exposes lazy `ensureAtlas`, `ensureCrosswalk`, `normalizeSkills`, `mapOnetOccupation`, `searchOccupations`, and `enrichWorkContext` helpers. Returned labor context is explicitly marked `reference-only-no-procedures` and `requiresAdaptation: true`.

## How labor context is used

### Cerbanimo

`public/app/cerbanimo-learning-packs-v1.js` keeps the normal authored task-template resolver as the executable-work source. After a template is selected, the original request and template skill refs are passed through core labor intelligence. Labor-relevant requests can gain compact O*NET occupation matches, O*NET essential-skill context, accepted ESCO occupation mappings, and normalized authored skill refs in `packMetadata.laborContext`.

O*NET task statements are never promoted directly into quest steps. `laborTaskDraft()` remains a guarded adaptation path with zero executable steps until a reviewed task-specific template exists.

### Living School

`public/app/living-school-learning-packs-v1.mjs` keeps the authored learning-unit resolver as the curriculum source. Generation retains the original skill refs, adds accepted normalized skill refs, and, for labor-relevant capabilities, adds compact occupational/essential-skill context. That context is labelled descriptive rather than procedural before it is handed to the curriculum workbench.

This lets a request such as learning a trade or preparing for a type of work use the same occupation/skill graph as Cerbanimo without treating an occupational database as curriculum instructions.

### FellowFare

FellowFare previously categorized “Work” largely from text/category heuristics and handed agreement text to Cerbanimo without an occupation graph. `public/app/services/fellowfare/labor-context-v1.mjs` now enriches labor-related market threads lazily and carries `laborContext` through Work → Cerbanimo and Learn → Living School handoffs. The parent Rook request flow also enriches labor request previews in the background with occupation refs and normalized skill context.

FellowFare remains the authority for exchange terms, settlement, and repair. The labor graph is descriptive matching/context only; it does not assert qualification, price work, accept an agreement, or authorize work.

## Learning Pack Shelf

`public/app/shared/learning-pack-shelf-v1.mjs` is one shared, realm-aware browser for user-facing pack content. `learning-pack-shelf-v1.css` gives the same controller a Cerbanimo treatment or Living School treatment without creating separate storage or routing systems.

The shelf provides catalog search and authored core/expert filters, verified offline add/update and optional-pack removal, pack-content browsing, Cerbanimo `Start task` actions for authored task templates, Living School `Learn this` actions for learning units, expert-guide browsing, mobile safe-area layout, Escape close, and keyboard focus containment. Records marked `coreInfrastructure` or `hiddenFromShelf` are deliberately excluded.

## Safety boundary

A labor task statement becomes a guarded draft with `requiresAdaptation: true`. It has no executable steps. Cerbanimo's adapter will not create an executable quest from a reference that lacks reviewed work steps.

The authored General Labor & Logistics expert pack is also guarded. It covers ordinary receiving, cycle counts, pick-and-pack, work-area readiness, simple assembly from supplied instructions, and shift handoff, but includes explicit stop conditions for dangerous goods, hazardous energy, regulated equipment, unknown materials, missing instructions, or work beyond the user's training and authorization.

Use `riskClass: regulated` for references that must not compile directly without an explicitly qualified workflow. Current workplace instructions, training, authorization, manufacturer procedures, and applicable safety requirements remain authoritative for real-world work.

## Offline storage

`public/app/learning-pack-seeds-v1.js` uses a dedicated Cache API store and SHA-256 receipts. Packs are listed in `public/downloads/learning-packs/catalog.json`.

The small authored core pack stages automatically. Optional expert packs stage only when selected or resolved. The O*NET and ESCO core labor artifacts are packaged and checksum-verified but stage lazily on first relevant use. This is a capability/core distinction rather than a boot/eager-loading distinction.

## O*NET Labor Atlas

Run:

```bash
node scripts/build-learning-packs-v1.mjs
```

The builder downloads the official O*NET 30.3 JSON tables for occupation data, task statements, essential skills, and task-to-DWA mappings. It groups occupational records with their task and skill rows, preserves Detailed Work Activity element IDs as crosswalk references, writes `onet-labor-atlas-30-3.json.gz`, computes its SHA-256, and updates the catalog.

The current core artifact covers 1,016 occupations, 18,796 task statements, 17,880 essential-skill rows, and 23,850 task-to-DWA rows. The compressed artifact is under 1 MiB and is published with a SHA-256 receipt in the catalog.

The generated pack preserves O*NET's CC BY 4.0 attribution, identifies Civweave's restructuring as a modification, links the license, and includes the required non-endorsement language for modified O*NET content.

Occupational task statements remain descriptive reference examples. They are never converted directly into a safe procedure. A selected statement first becomes a guarded, zero-step draft and must be adapted through a task-specific expert pack, current workplace instructions, and any applicable qualification or safety requirements.

## ESCO skill normalization bridge

Run:

```bash
node scripts/build-esco-crosswalk-v1.mjs
```

The generated `esco-skill-crosswalk-v1` artifact is the interoperability half of core labor intelligence. It gives authored Civweave skill IDs stable links into ESCO while preserving the Civweave IDs already used by tasks, learning units, guides, rewards, and evidence.

Civweave-generated skill mappings follow a strict provenance rule: normalized exact preferred-label or authored-alias matches may be accepted; non-exact lexical candidates remain review mappings below the canonical threshold; generated mappings never claim European Commission, human-review, or U.S. Department of Labor validation.

The same artifact also ingests the European Commission's official O*NET-to-ESCO occupation crosswalk. Official relation types and validation provenance are retained. `related` occupation matches stay review-only; quality-assured exact, narrow, broad, and close mappings may participate in the occupation bridge.

`public/app/shared/skill-crosswalk-v1.mjs` resolves only accepted mappings at confidence 0.90 or above by default. `labor-intelligence-core-v1.mjs` owns when that lower-level bridge is staged and consumed by realms.

## Realm APIs

Cerbanimo exposes `globalThis.CivweaveCerbanimoLearningPacksV1` with pack APIs plus compatibility helpers for crosswalk status/install/normalization. Underneath, generation uses `labor-intelligence-core-v1` and retains `laborContext` on generated quest input metadata.

Living School exposes `globalThis.CivweaveLivingSchoolLearningPacksV1` with the same compatibility helpers and uses the core labor layer during curriculum input generation.

FellowFare uses the shared labor core from both the parent Rook request flow and the embedded market handoff bridge rather than maintaining a second occupation taxonomy.

## Next data layers

The next useful labor layer is BLS training, education, wage, and outlook metadata keyed through normalized occupation identities. Safety references, trade-specific expert packs, and community-authored packs can then attach to the same skill/occupation graph without creating a second task or curriculum engine.
