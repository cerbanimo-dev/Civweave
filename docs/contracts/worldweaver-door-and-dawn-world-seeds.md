# Door & Dawn · sixteen persistent world seeds

**Status:** author-development material, not completed prose or working OpenSimulator regions.
**Catalogue:** `public/app/shared/worldweaver-story-seeds-v1.mjs`
**Read-only preview:** `/app/tools/worldweaver-story-seed-atlas.html`
**Test:** `node --test scripts/test-worldweaver-story-seeds-v1.mjs`

## New Part III structure

Part III extends the **nine recovered Open Continuum settings** with **seven new proposals**, categorizing all sixteen by their actual ontology rather than their publication order. The placement of the old nine and the premises of the seven new settings are proposed structure, not a claim of earlier author approval.

### Nine In-Between universes

| Seed | Provenance | Defining tension |
| --- | --- | --- |
| The City Between Panels | Recovered | A story cannot demand a hero's tragedy |
| The Orchard of Moving Castles | Recovered | Protection must let families leave |
| The Department of Unfinished Lessons | Recovered | Learning without compulsory loops |
| Monsters After Midnight | Recovered | Recognition is not the basis of personhood |
| The Kingdom of Side Quests | Recovered | Unseen work is foundational |
| The Library of Unwritten Tomorrows | New proposal | Maggie's future narration is witness, not fate |
| The Garden Behind the Eyes | New proposal | An internally structured world need not be consciously visual |
| The Hall of Four Voices | New proposal | Two human perspectives and four autonomous personae |
| The School of Flat Horizons | New proposal | Dimensional learning without compelled revelation |

**Persistence contract:** Each In-Between universe is a **single persistent story universe**, not a set of disconnected dreams, reset-on-visit vignettes or a multiverse sandbox where every generated event has already happened. A generative model may reason over possible outcomes. It stores these as **uncommitted alternatives** until a trusted author/world host records a choice. That single canonical history then carries costs and consequences forward. Local time may run at a different rate and ordering than time in a physical reality; a narrative's interwoven acts do not imply synchronized clocks.

### Seven parallel physical realities

| Seed | Provenance | Defining tension |
| --- | --- | --- |
| The Starship Commons | Recovered | A sentient ship's right to refuse, and passengers' informed navigation |
| The Neon Afterimage | Recovered | Physical infrastructure, finite compute and synthetic autonomy |
| The Kaiju Garden | Recovered | Ecological restoration and protection of existing residents |
| The Gentle Apocalypse | Recovered | Local repairability versus a reviving dependency machine |
| The Divergence City | New proposal | Alternate Landry-Prime and consent under benevolent rule |
| The Warded Shore | New proposal | Boundaries, reparations and ethical crossing |
| The Commons Without Founders | New proposal | An independent federation that survives its founders |

**Physicality contract:** These are materially separate lived realities with independent inhabitants, populations, economies, clocks and histories. Their human protagonists may live through experiences there, subject to the eventual continuity and crossing mechanics established by Parts I and II. Any arrival, departure or exchange is a consequential event, not a free projection. Matter transfer requires feedstock, energy, care, maintenance and permission. Neither Landry nor Maggie can treat another world as a disposal site or claim sovereignty over it. An alternate counterpart is not a disposable stand-in.

## Point-of-view and chronology protection

The novels remain locked to **two human perspective lines**: Landry/Delia and Magnus/Maggie. These are four distinct personae, not four interchangeable external narrators. Landry-Prime and Delia's companions retain agency without acquiring a surprise independent book POV. Magnus and Maggie can **voluntarily exchange executive roles**, retaining their own agency. Maggie's commentary may be dictated retrospectively from **different points in the future**, from the In-Between, and the first manuscript is genuinely an in-universe document she dictated. The In-Between's emotional/causal scene pairing with physical scenes must not be mistaken for a shared clock or forced genre symmetry.

The final scene of Book IX stays untouched: the tiara and Maggie's exact last reaction remain the last line of that novel. Part III begins as a **separate work**, never appended after the Book IX finale.

## What the code actually provides

- `WORLD_SEEDS` is a frozen, bounded source of scene premises, setting laws, incident hooks, four-movement arcs, agent roles, ethical limits, visual direction and provenance for all sixteen settings.
- `worldsByLayer(layer)` and `getWorldSeed(id)` provide deterministic catalogue access.
- `buildStoryWorldStart(id)` returns an **unactivated**, empty-history proposed world state with a per-world local story clock, a protected POV list, and separate storage slots for canonical events versus multiverse possibilities.
- The read-only atlas browses the seeds and exports the seed record or a fresh unactivated starter. It never claims OpenSimulator provisioning, inference, simulated life, durable mesh commits or activation.
- The existing Worldweaver Performance Studio can prefill a reviewed production's **draft fields** using an atlas link. It does not auto-select rights, import a manuscript as fact, approve a production, or run a scenario.

Existing images in `public/app/assets/world/` are borrowed **visual moodboard references** from Civweave's illustrated campus. They do not imply world-specific story drawings, geometry, or fully rendered physical realities already exist.

## Acceptance criteria for future persistence/runtime integration

1. A trusted host must own an authenticated, append-only revisioned canonical story history for **each world instance**, separately from predicted or rejected possibilities; conflicts are preserved for explicit resolution, not silently merged.
2. Simulation events must be validated and acknowledged by their actual host. Model-proposed narration, movements, props, outcomes and crossings must not self-certify execution.
3. A resident/persona record must track agency, knowledge boundary, continuity and memory without creating unauthorized access to another person's interior experience.
4. The author determines canonical scene commits and literary POV. Human participants retain rights to consent, leave, decline crossings and challenge local coercion; fictional in-world governance follows the world's own story rules.
5. In-Between and physical worlds may contain related events, but no implementation should force an identical chronological sequence or erase causality because scene times differ.
6. Visual assets may be reused as references until bespoke artwork is approved. OpenSimulator geometry must come from an actual authorized host export or be clearly provisional, with 2D and 3D presentations reading the same source.
7. Do not add another chat owner, world engine, ballot ledger or autonomous model loop. The canonical Worldweaver manifest, Starling adapter and existing source owners remain responsible for their respective actions.

**Not yet implemented:** persistent world instance host backed by signed mesh objects, sixteen executable region instances, bespoke 3D/2D settings, full simulation session lifecycle, or long-form finished stories. These are intentionally not claimed by the catalog.
