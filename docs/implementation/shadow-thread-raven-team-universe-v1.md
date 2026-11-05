# Shadow & Thread Universe — Raven Team Sandbox (v1)

**Status:** narrative and actor-configuration packet on `staging`; **not** a live NPC deployment or an autonomous cross-chat team.

## Mandate

- **Universe owner (in-fiction): Raven.**
- **Core cast/team: Erin and Lari.**
- The team develops the **Shadow & Thread Universe** as a sandbox linked to *The Blade & Mirror Saga* and Civweave/Worldweaver.
- The launch story is *Evil Psych Wards from Venus*, pulp horror that resolves into hopeful, self-directed fantasy and a Watertown-to-Civweave threshold.
- Story locations and hospital practices are invented alternate-universe fiction, not representations or allegations about any real Watertown medical institution or personnel.

## Actor continuity

Preserve each character's established **normal avatar**, core personality, historical relationships, and continuity. An in-world name is a *role alias*, not a replacement canonical identity or a different avatar asset. Do not clone actors into a second chat engine.

| Canonical character | World alias (working) | In-world identity | Sandbox responsibility |
| --- | --- | --- | --- |
| Raven | Dr. Raven Vale | Demonic Technologies systems infiltrator; charismatic antagonist and eventually accountable collaborator | Creative point, adversarial plot design, meaningful player challenges |
| Erin | E. Marlowe | Continuity engineer and Shadow Integration lead, skeptical of coercive healing | Time-loop continuity, shadow-work design, patient agency and restitution |
| Lari the Lyrebird | L. Vesper | Corporate archivist and trickster foil, expert in deceptive narrative loops | Crisis generation, apparent villainy, revelations with fair clues |

Working aliases can be revised in canon; keep canonical IDs stable. **The fictional cast is not independently deployed by naming it here.** A working NPC requires trusted model/pilot identity assignment, authorization, a valid existing canonical avatar reference, and provider/runtime acknowledgement.

### Supporting cameos

- Nell Mercer: protagonist who remembers multiple lives, demands consent and leads reform.
- Magnus and Maggie: temporal mechanics, accountability and records.
- Landry and Delia: light/shadow/UNKNOWN integration without collapsing personal identities.
- Fruit flies: **bigfixers**, including a named fruit-fly troubleshooter who finds the fatal contract/continuity bug.
- The Loom: world-building and voluntary alternatives, not coercive treatment.

## Angel Intimation System

The **Angel Intimation System** is fictional inter-world guidance infrastructure. Its early corporate implementation seems like a supernatural whisper or predestination; the repaired version is a **user-controlled hint and invitation channel**.

Rules:
1. Clear in-world indication whether a message is from a character, a system narrator, a real human, or an automated model.
2. Suggestions are optional, dismissible, and reversibly disabled; never involuntary timeline replay.
3. No false claims of real-world angels, diagnoses, supernatural surveillance, mind control, or medical capabilities.
4. No personal medical record access, provider tool use, real-world contact, persistent memory sharing, or external publication without the applicable existing authorization and explicit consent.
5. Every time-loop choice has a readable scope/preview, an opt-out, continuity safeguards, and a restoration path.
6. Angel/daemon labels are fictional roles, not proof of metaphysical status.
7. The story's happy resolution requires accountability and restorative options for harms committed by Demonic Technologies; the benevolent motivation does not justify coercion.

## Four-act launch route

1. **The Ward That Remembers:** Nell notices mismatched discharge dates, impossible memories, and an apparently sentient fruit fly.
2. **The Contracts of Venus:** The corporation's archive, loopholes, and repeated forced life-replays are exposed. Raven engineers difficult but fair crises; Lari tests interpretations; Erin reveals how timeline continuity is maintained.
3. **The Light and Shadow:** Heroes expose the motives and the abuses. They rewrite the governing contract with affected people retaining control over their histories. Light, shadow, and UNKNOWN are valid perspectives.
4. **Watertown Joins the Weave:** Patients win free choice and restitution. Demonic workers organize. The hospital becomes a voluntary community resource. The threshold opens to Civweave with the player's identity and boundaries intact.

### Pilot scene

Nell wakes for her third discharge, remembers two entire lives, and notices that one fruit fly in the vent is reading the hospital's contracts. The player can listen, inspect a chart, ask the doctor a question, or decline to participate. The opening must never force a real-world medical interpretation.

## Worldweaver integration plan

Canonical engine: `public/app/shared/worldweaver-core-v1.mjs` and its trusted authorization adapter. Use the existing actor/pilot capabilities rather than starting a new chat/polling/model runtime. A scenario packet accompanies this note at `examples/worldweaver/shadow-thread-raven-team-v1.json`.

Implementation gates before claiming actor deployment:
- Resolve Raven, Erin, and Lari against **existing** canonical character assets and identity bindings; keep their default avatars, no invented substitute portraits.
- Register in-world aliases only as contextual presentation fields and preserve stable IDs in authored traces.
- Obtain an explicit human-initiated model assignment and trusted permission decision for each actor; apply per-world/scope memory separation and clear provenance.
- Provision an authorized standalone Worldweaver instance and receive a verified provider acknowledgement; never fake a live/OpenSimulator world.
- Use the canonical selected local/consented cloud model path with per-action budget limits and review for dangerous or external tools.
- Test offline entry, reversible opt-out, actor identity continuity, journal replay, and user-facing refusal to proceed without permission.
- Ship to staging testing first; production only after an actual end-to-end acceptance run.

**This document is a build packet, not evidence that the three actors are currently operating independently or that a live region has been provisioned.**
