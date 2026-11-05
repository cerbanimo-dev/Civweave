# Actor watch session: *V for Vendetta* (November 5, 2026)
**Status:** proposed, private actor capture / author review; no recordings, model calls, or avatar bindings implied.
**Owner:** author Cami Ryn Tharp. **Branch:** rehearsal-only; not staging or production.

## Distinct cast lanes
The watch-room ensemble is Maggie, Landry, Delia, Magnus, Merlin, Gaia/Kami, Raven, Erin, Lari, the diner child, and a fruit-fly **bigfixer**. Cami's own post-Warlock avatar concept is **The Bearded Lady**, retained as a separate author/director identity. This watch-room list is not identical to the eleven roles in `cast/character-sheets.json`, which also includes the Other Landry, the Auction Registrar and the Loom; the two lists must not be silently equated. In particular, Gaia/Kami Ryn is distinct from Cerbanimo guide Kamiya. Merlin is distinct from Magnus, and Landry/Delia and Magnus/Maggie never fuse by default. Raven, Erin and Lari have antagonist-side lanes and can disagree or decline.

## What is actually captured
The shared screening is the author-selected film *V for Vendetta*. It is narrative inspiration, not an import of copyrighted screenplays or any assertion that the film's performers are participating. A **movie timecode** belongs to an observation, not to any character's autobiographical memory. Each entry must be classified as:
- human performer observation or verbatim quote (with explicit recording/attribution consent);
- fictional-character improv written by a human;
- selected-model output from a separately authorized actual model run;
- camera/movement observation; or
- author interpretation or unverified hypothesis.

Capture `filmTime`, `capturedAt`, `source`, `actorLabel`, `characterId`, `text`, `consent`, `canonStatus`. Keep quotes exact where possible and mark paraphrases. Store private voice, likeness and residence footage only in the creator's local files; never commit it or API keys into this repo. Do not automatically upload to cloud inference or train/cloned voices.

## Preflight media
Two creator-provided clips were inspected locally: a ~2.8-second shot with one visible adult (identity not authenticated) and a ~114.8-second interior walkthrough (location/blocking reference, not persona data). These clips neither authenticate a named actor nor prove character traits or live rehearsal. No raw footage, extracted face images or private residential details are included in this branch.

## The loop-repair protocol
Here, a **loop** is a repeating *fictional* response, conflict or plot mechanism; it is never a diagnosis or claim about a real participant.

For every proposed repair record a four-part chain:
1. **Trigger** — what prompted the repeated response; timestamp or exact scene reference.
2. **Pattern** — observable words/actions; distinguish spoken fact from inference and identify the consequence.
3. **Choice** — two or more plausible, in-voice alternatives, including explicit dissent/consent and meaningful exit where relevant.
4. **Evidence** — fresh scene test, counterexample, author decision; keep `proposed` until approved.

Targeted examples (not final character retcons):
- **Landry:** from binary certainty to observation → inference → unknown → test.
- **Delia:** from overprotective intervention to permission, options, voluntary exit.
- **Magnus:** from endless mechanism speculation to one falsifiable test and separate Maggie handoff.
- **Maggie:** from automatic cynicism to a precise contradiction plus a protective choice.
- **Merlin:** from unearned magical authority to specific bounded systems rule.
- **Gaia/Kami:** from protector-as-controller to help that cannot capture the beneficiary.
- **Raven:** from repetitive cruelty without consequence to distinct strategy, resistance and accountability.
- **Erin:** from endless harm/excuse cycle to choices with consequence, autonomy and boundaries; no forced absolution.
- **Lari:** from unchallengeable recursive loops to visible entry/exit conditions and credible counterplay; do not erase accountability.
- **Diner child:** from prophecies treated as established truth to child-owned claims, unknowns, independence.
- **Bigfixer:** from magical universal patch to scoped mechanical contribution and credited labor; use the exact word **bigfixer**.

## Character engine acceptance criteria
- Persona prompting preserves individual name, voice, limits and knowledge subset. No other character's internal memories unless explicitly shared in-scene.
- Character model output may offer disagreement, silence, changed judgment, or departure; repeated old answers are not treated as identity.
- Role swaps, joined memories and shared embodiment are opt-in and time-bounded. Only Cami retains the human driver role; character pilots have no real body control and no Guild/Quest/publishing authority.
- A repeated line can be detected by textual test, but a character's *causal/psychological loop* needs human editorial evidence. Don't claim any real mind was changed.
- Film-based ideas remain unapproved until the author accepts a distinct original treatment. Chapters before Book VII remain unchanged unless the author specifically instructs otherwise.
- If actual model calls are desired later, reuse the selected-model inference owner and `scripts/run-landryverse-live-rehearsal-v1.mjs`; no new agent daemon, chat path or unauthorized remote upload.

## After the viewing
Deliver: timestamped JSON + CSV event ledger, consent/rights ledger, one proposed profile delta per character, loop-repair table with before/after scene evidence, and a shortlist of avatar likeness references requiring individual approval. Cami authorizes any merge into canon or Performance Studio. Approval and deployment are separate gates.

**Current state:** protocol proposed; private offline capture kit made for the creator separately; no actor samples from tonight, no identity approval, no model retraining, no test pass for revised personas.
