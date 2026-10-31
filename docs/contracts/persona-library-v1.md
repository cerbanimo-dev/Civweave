# Persona Library and Directed Improvisation · v1 (feature branch)

## Ownership and scope

- Core behavior is `public/app/shared/persona-library-v1.mjs`, a provider-neutral **shared capability**. It **does not** own the chat composer, model runtime, world simulator, storage, or verification of the actor.
- The shared chat surface is the only chat/event input owner. Worldweaver remains the sole NPC tool-intent authority; a `worldweaverNpcCommand` is an *unexecuted* command proposal. Use the existing AI Fleet to select actual installed model weights.
- This increment also exports the injected-invoker bridge `public/app/shared/persona-scene-bridge-v1.mjs`. Its `prepareDirectedScene`, `performPersonaTurn`, `runSplitMindTurn` and `queuePersonaActionIntents` work with the existing selected-model adapter and Worldweaver's authenticated dispatch. An end-user UI route, on-device pack installer, durable saved sessions and automatic speaker scheduling are **not yet included**. No assertion of a working deployed game is made.

## Pack and privacy

Schema: `civweave.persona-library.v1`.

A persona data package is downloaded separately from model weights. It contains a cast index, role profile, event/action provenance, observed personal memories, voice and body-language examples, source scene references, plus an optional full-text local retrieval index. Keep unpublished manuscript excerpts and author-only revelations in **private author-controlled packages**; never commit them to public Civweave source or silently expose them to shared Guilds. User-visible character bundles must contain only scenes the reader is authorized to receive.

Characters have `modelTier` (deep role reasoning) and `improvTier: '0.8b'` (per-turn live performance). The director requires 4B. Multiple characters can reuse the same installed model weights, sequentially, with separate identities and prompt contexts. A runtime should keep only one or a few models resident subject to real device memory and scheduling. Tier labels are preferences, not guarantees that any particular model or quantization is available.

## 4B / 0.8B hierarchy

1. Author/player submits a scenario, participating characters, world branch, point in story (`stage`), desired beats and optional forbidden events.
2. A deterministic reader restricts source events to character-visible facts at the current story stage. A shared multi-character 4B request contains only facts common to **all** selected actors. `prepareDirectedScene` instead uses **one isolated 4B director call per character** so private memories cannot leak through another character's direction.
3. For each character, 4B returns JSON keyed by character: `characterGoal`, `emotion`, `instructions`, `knownEventIds`, `escalateWhen`, `improvFreedom`. `validateDirectorResponse` rejects event references that actor has not personally witnessed/experienced.
4. A character's 0.8B live improv context includes permanent persona, exemplars, character-visible memory, recent speech and the director's current instructions. Direction expires after four accepted turns by default or when a trusted world change invalidates the brief. The caller advances turns explicitly with `advanceSceneTurn`. An optional Worldweaver snapshot revision prevents stale director output from being published.
5. Model dialogue and action proposals are **not** authoritative canonical records. The local runtime logs a proposal; Worldweaver validates and acknowledges environment changes, including actor permissions. A director/human must review statements that could contradict canon or declare a new consequential fact.
6. On meaningful deviation, write an explicit `what-if` branch ID. Historical canon remains immutable; player changes produce a distinct event log.
7. Save and resume must persist branch ID, story stage, last scene brief revision, per-character awareness and willpower turn counters. Multiple players and NPCs share a trusted world state, **not** a model-written diary.

`availableKnowledge` intentionally does not interpret any character being **mentioned** in a passage as having witnessed that passage. Their self-perception and mistaken beliefs need separately sourced memory objects; do not smuggle private truths into a tiny model's context.

## Character tier proposal

| Character | Deep role | Live improv | Special handling |
| --- | --- | --- | --- |
| Magnus (later Maggie) | 4B | 0.8B | Entire relevant Magnus series stored as retrievable sources; chronology-aware identity and pronouns |
| Landry | 2B | 0.8B | Complete Landry/Mirror source archive, never all in context |
| Delia | 2B | 0.8B | Separate internal voice; same story but distinct knowledge and agency |
| Landry/Delia outward behavior | 0.8B moderator | — | Moderator receives both 2B proposals; bypass requires deterministic willpower spend |
| Jess | 2B | 0.8B | Her scenes plus separately reviewed remembered events; no premature Jess/Raven disclosure |
| Scribble | 2B | 0.8B | Embodied feline motion and humor as well as spoken voice |
| Raven, Colt, Dish | at least 2B | 0.8B | Antagonist minimum, independent motivation and spoiler gates |
| Raj, Maya and other substantial characters | 2B if necessary | 0.8B | Evaluate dramatic load and tests, not just word count |
| Minor NPCs / creatures | 0.8B where suitable | 0.8B | A small personality card, scene props and known-facts refs |
| Humans with direct in-between access | 2B+ as warranted | 0.8B | Optional multi-voice moderator, consent-aware control gate, individual wills |

Willpower: shared 2-point pool by default, +1 per 4 completed simulation turns (capped); direct control costs 1 or more. This is an **example gameplay default**, not a claim about manuscript canon. A visible receipt must record which voice spent points and on what turn. The moderator never spends points and cannot award them.

## Known limitations and integrity

- Structural validation can prevent future or unwitnessed **fact IDs** from entering a prompt, but cannot prove a freeform LLM statement is canon-consistent. Add a 4B fact checker + explicit action-claim extraction and human review for consequential claims before advertising strict continuity.
- Canon source chronology must be curated. A source *mention index* is only retrieval, not a proven witnessed-action ledger.
- No full-plot hidden omniscience: backstage director access and a character's lived knowledge must remain separate.
- An explicit scene change can break the *planned script*; it must not silently alter immutable canon events or assume a choice happened merely because a model narrated it.
- No automatic network inference, cloud consent, downloads or deployment are triggered by import.

## Executable contracts

Run `node --test scripts/test-persona-library-v1.mjs scripts/test-persona-scene-bridge-v1.mjs`. The CI contract tests 4B private instruction isolation, 0.8B structured acting, Worldweaver tool-intent queueing, stale world revision, 2B Landry and 2B Delia with 0.8B moderated expression and authorized willpower bypass. Future tests: director invalidation, multi-user race/conflict, spoiler isolation, Worldweaver tool authorization, deterministic branch replay, memory budgets and 0.8B characterization quality.

## Present bridge protocol

- `prepareDirectedScene({pack,stage,scenario,participants,invokeModel,world?})`: serial 4B JSON director calls using only the designated character's memories. Fails closed on invalid output or concurrent world-state modification.
- `performPersonaTurn({pack,scene,characterId,playerInput,invokeModel})`: one 0.8B JSON acting call, no automatic world write. Returns `speech`, `emote`, action **proposals** and director-refresh flag.
- `queuePersonaActionIntents({world,npcId,actor,pack,characterId,turnResult})`: checks the bound principal, model and persona before invoking canonical `world.dispatch({type:'queue-actions'})`. All intents stay queued until runtime acknowledgment.
- `runSplitMindTurn({pack,scene,invokeModel,willpower,directControl?,authorizeDirectControl?})`: two serial 2B internal calls and a 0.8B outward moderator unless a trusted authority approves a named voice, a deterministic spend succeeds and a receipt is returned. The moderator never invents a spend. World mutations remain separate.
- `advanceSceneTurn(scene,{expectedTurn,worldChanged?})`: compare-and-advance of accepted local turn state. This is **not** an authority to approve an action or increment a multiplayer world.
- The bridge recognizes the existing Civweave selected-model result envelopes `{status:'success',outputJson:...}` and `{outputText:'...'}` as well as OpenAI-compatible chat completion messages. Only structured JSON is accepted. A reported failure aborts.

### Author pack v2 (not in GitHub)

The private author zip stores 51 curated names, 219 indexed source scenes and 1,016 **unverified** grammatical-action candidates. These candidate excerpts are a source review work queue, **not facts, witnessed memories or dialogue training labels**. Ten previously curated event anchors remain the only promoted events. A reader-facing package must be compiled with an explicit publication/spoiler policy and omit unapproved manuscript content.
