# Starling Collective · PvE Improv Mission & Production Runbook

## Their job

The eight Starling personas are **fictional player characters**, not Guild governors or human employees. Their ongoing job is to **PvE the storylines**: play inside a Guildkeeper-authored fictional premise, encounter resistance from the environment/NPCs, improvise characterful responses, absorb credible consequences, and leave playable opportunities for the next voice.

**PvE** means "players versus environment." The opponent is a narrative obstacle, conflict or NPC, **not a human Guild member**. Each generation is a proposed fictional continuation; it cannot award loot in the real economy, mark a Quest completed, change a vote, rewrite the manuscript or impersonate a person.

### The three-beat loop

| Beat | Fictional job | Required result |
| --- | --- | --- |
| Encounter | Set the place, goal, hazard and meaningful decision | A playable problem with stakes |
| Complication | Yes-and what the previous character did; let the environment react | An earned cost, unexpected discovery or evolving obstacle |
| Consequence | Resolve one local move without eliminating the story's tension | A continuity fact, limitation and hook for the next scene |

The director is `public/app/shared/starling-story-pve-v1.mjs`. It guides an existing authorized model; no separate inference service or wallet is introduced. Each selected Starling persona keeps their own voice and goal.

### Who does what

- **Kami:** synthesize a practical group move, keep the story moving without speaking for real humans.
- **Rosa:** pressure-test shortages, time, effort and collective problem solving.
- **Sana:** notice access barriers, care and the excluded perspective; never use disability as a gimmick.
- **Kit:** build props, physical puzzles, machines, spaces and affordances.
- **Farah:** track clues, evidence, timeline and what is only a character's inference.
- **Jae:** negotiate with fictional NPCs and explore cooperative choices.
- **Anthony:** challenge false assumptions and add a coherent alternative interpretation.
- **Aphra:** apply satirical tension, expose hypocrisy and shift scene energy.

No agent has permanent plot armor. Character contributions carry through signed continuity; contradictions become proposed revisions requiring human review.

## Execution and daily boundaries

1. **Local manual:** In the Guild Fleet → Starling Lounge, select a persona and choose **Play next encounter** or **Play 3-beat scene**. Uses the already selected local model. No hosted spending.
2. **Local opt-in autopilot:** Founding Guildkeeper clicks **Enable PvE autopilot**. Default maximum **4 signed story beats per UTC day**, **60 minutes apart**, under the canonical browser-local worker. The worker pauses when the PWA/Lounge is closed, and never silently consumes cloud neurons.
3. **Cloud manual:** An authenticated, founding device paired to **that exact Guild-owned Cloudflare AI node** can choose **Play cloud PvE beat**. Each click requires consent. At most **4 signed cloud beats/day**, maximum 440 output tokens per generation. `allowLifetimeCredits=false`. The existing Cloudflare node provider performs the actual spend/quota check. No generic Marketplace account fallback or inferred membership.
4. **Paired local model host:** A Termux/Android host can perform bounded local drafts, recover results and contribute signed observation metadata when its Guildkeeper device is open and paired. Host outputs are not automatically canonical and host scheduler implementation must honor story instructions to count as narrative PvE.

Every generated turn is signed into the existing Guild object mesh with `storyMode='pve'`, a `pveSceneId`, a `pvePhase` and `completionVerified=false`. The full scene is readable by authorized Guild members. A three-beat manual round shares a single scene ID; generations run serially and preserve earlier output if a later beat fails.

## Daily Guild report on the phone

The **Daily Guild report** panel is an authenticated read/export view of the canonical signed mesh. It aggregates local and cloud PvE turn metadata, worker receipts and observed paired-host job states. The founding device may publish an updated dated Markdown snapshot to the mesh. It can **Sync report** through an explicitly paired Guild cloud primary and **Save .md on this phone**.

Report-only producer grants are separately signed, Guild-scoped, revocable and seven-day by default. They do not authorize AI, spending or Quest work. Phone sync uses cursor-based authenticated Cloudflare Guild envelopes when the deployed Guild edge supports them. Long-offline phones need the durable signed snapshot; app-closed guaranteed native push is not yet provided by this web feature.

## Canon and quality gate

The current actor is an **improviser**, not a canon editor. Content is `proposed` until a human editor selects it. Reviewers should compare it against approved story bible, existing scene consequences, consent/continuity notes and intended tone, then explicitly accept, revise or reject for an eventual manuscript/world seed. The current launch has signed provenance and visible reports, **not** an automated canon-promotion button. Inference counts cannot be used as Quest-completion evidence.

A future editor pipeline can score: character fidelity, causal consistency, continuity recall, original obstacles, ensemble agency, and hook usability. Failed/incomplete generations remain visible as failures and do not become story facts.

## Production release and verification

The focused production release is branched from the current `main` branch, not merged wholesale from the divergent staging branch. Required checks: Node source syntax, native Starling turn and worker tests, PvE phases and cloud cap tests, signed report writer/reader/grant tests, 450-event Pocket cloud pagination, canonical release checks and a successful Cloudflare Pages deployment of the new `main` commit. Confirm `https://civweave.cc/app/host-deployment-v1.json` references that main commit, and verify served story and report modules.

**Activation is per Guild**, not automatic: a Guildkeeper must already possess a valid signed Guild creation, configured local model or paired Cloudflare capacity, and explicitly start the scene or opt into local autopilot. Deploying code cannot impersonate the Guildkeeper to activate paid remote inference.
