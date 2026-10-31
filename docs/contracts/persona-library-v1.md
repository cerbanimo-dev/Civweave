# Persona Library and Directed Improvisation · v1 (feature branch)

## Ownership and scope

- Core behavior is `public/app/shared/persona-library-v1.mjs`, a provider-neutral **shared capability**. It **does not** own the chat composer, model runtime, world simulator, storage, or verification of the actor.
- The shared chat surface is the only chat/event input owner. Worldweaver remains the sole NPC tool-intent authority; a `worldweaverNpcCommand` is an *unexecuted* command proposal. Use the existing AI Fleet to select actual installed model weights.
- This increment also exports the injected-invoker bridge `public/app/shared/persona-scene-bridge-v1.mjs`. Its `prepareDirectedScene`, `performPersonaTurn`, `runSplitMindTurn` and `queuePersonaActionIntents` work with the existing selected-model adapter and Worldweaver's authenticated dispatch. An opt-in private rehearsal panel is now attached to the existing Worldweaver Performance Studio tool (not a new chat). On-device pack ZIP installation, durable saved sessions, full multiplayer world-state changes and automatic speaker scheduling are **not yet included**. No assertion of a working deployed game is made.

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

### Author pack v3 (not in GitHub)

The private author zip stores 51 curated names, 219 indexed source scenes and 1,016 **unverified** grammatical-action candidates. These candidate excerpts are a source review work queue, **not facts, witnessed memories or dialogue training labels**. Ten previously curated event anchors remain the only promoted events. Legacy freeform emotion excerpts are now unreviewed author-only suggestions; only source-approved, story-stage-gated `verifiedEmotes` can be sent to any director or acting model. The manuscript archive is not committed to a public repository. A reader-facing package must be compiled with an explicit publication/spoiler policy and omit unapproved manuscript content.

## Opt-in Performance Studio test surface (draft PR)

At the existing Worldweaver Performance Studio, section 5A imports a **local JSON persona-pack manifest** (extract it from the author-only ZIP, or use the separate JSON download); it never silently imports model weights or the full source shards. Select a story stage, a cast, the scene and a lead speaker. Prepare director briefs first, then preview a single player cue as a character action. This uses the same configured Civweave model-runtime and Creator Suite inference route as the existing screenplay proposal tool.

Currently tested with an explicitly selected Ollama or OpenAI-compatible provider that supports per-request model IDs; the author enters the installed 4B and 0.8B IDs. A source pack is never automatically sent to any cloud model; an existing explicit consent checkbox applies whenever the configured provider leaves the device. Model outputs never modify the approved screenplay, known canon or world state by themselves. The panel is **in-memory and a rehearsal preview**, not a new chat transcript, an automated installation flow, or a claim that a whole D&D session is already implemented. It is shipped only on the feature branch until reviewed and merged.

### Optional split-mind rehearsal control

When Landry and Delia are both selected, the same panel exposes a checked split-mind mode, an installed 2B internal model ID and a visible willpower pool. Each actor receives a separate 2B call; absent a deliberate author-simulated override, their private responses are given to a 0.8B presentation moderator. Selecting a named voice for a *single explicit rehearsal cue* simulates a 1-point direct-control spend. This browser-local test is not authenticated in-world willpower authority; a production multiplayer game must obtain the intervention from its trusted world authority instead. Separate model weights are selected but never automatically installed.\n
## Campaign continuity and private save/load (feature-branch increment)

`public/app/shared/persona-campaign-v1.mjs` is a pure event-ledger/snapshot helper **within** the Persona Library capability, not a second game server, chat owner or multiplayer transport.

- `createPersonaCampaign` binds a cast, initial stage, rights-controlled source pack identity and immutable `what-if:` branch name to an owner. It never writes back to manuscript canon.
- `applyCampaignEvent` requires an externally authenticated actor and an explicit caller-owned authorizer on **every** transition; optimistic `expectedRevision` rejects stale player updates. The local lab uses a local-only author-simulation adapter; it is not a Guild credential.
- Player seats and NPC model principal bindings are explicit. NPC speech/actions remain `pending` until the **trusted runtime**, not a model or other player, sends a receipt. The event history is append-only: resolutions do not rewrite original proposals.
- A rehearsal preview records its player cue, character response and proposed actions with `status: 'unexecuted'`. It cannot imply world success or authorize NPC tools.
- Willpower is deterministic and linked to accepted turn counters. It is spent by an explicitly authorized author/runtime event rather than by instructions inside model text.
- `exportCampaignSnapshot` and `importCampaignSnapshot` support small, explicit JSON private saves. Imports require the same `packId` and pack version; they are **always untrusted** until validated by an authenticated session authority. Never merge a local import into a multiplayer world on the basis of these checks alone. A production multiplayer implementation needs signed/revisioned mesh objects, actor provenance and trusted world outcomes.
- The Performance Studio page adds a Start new / Export / Restore control, a read-only recent-turn history and per-session revision indicators. It does not silently write personal dialogue or unpublished prose to localStorage, public GitHub, mesh, or cloud.
- Reopening a save requires a new 4B director brief. Private prompts are deliberately excluded from the exported snapshot, reducing the risk of leaking a character's author-only knowledge in a shared session file.
- These controls are exposed only in the existing optional Performance Studio rehearsal surface and do not duplicate Civweave's canonical chat input. Running the campaign **inside the unified guide-chat composer**, genuine multi-device syncing and model-weight installation remain separate integration gates.
- Executable contracts: `scripts/test-persona-campaign-v1.mjs`, `scripts/test-persona-performance-lab-v1.mjs` and the existing Persona Library/Worldweaver tests.

### Planned multiplayer authority boundary

The future mesh/session owner must verify the player's Passport and seat assignment, enforce one revision per accepted change, authenticate each NPC pilot using the canonical model principal, and confirm action receipts through Worldweaver's runtime adapter. A browser file import is suitable for private rehearsal, **not** for shared authoritative state. Private character memories remain separately access controlled; a player-visible public timeline contains only dialog/actions already exposed in the scene.

### Improvised deviation handling (feature-branch control)

The rehearsal panel now offers a manual **player breaks the planned scene** checkbox. In addition, a structured 0.8B actor response may return `requestDirection:true`. Either trigger expires the current temporary 4B instruction block after accepting that preview turn. The next cue cannot reuse the old brief; the author must explicitly prepare a new 4B pass.

The new director pass receives only the recent player-visible rehearsal exchanges, explicitly marked as *unverified dialogue, not canon*. It may adapt motives, intentions, immediate environment suggestions and likely reactions, but cannot declare player world actions successful. The old story remains immutable; even on a what-if branch, actual world modifications require trusted Worldweaver acknowledgments. The refresh uses the already configured selected model and honors the same remote-inference consent boundary as other requests.
