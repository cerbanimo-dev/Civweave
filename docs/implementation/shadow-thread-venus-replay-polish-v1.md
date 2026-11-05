# Shadow & Thread — Venus Replay: Pulp polish and player-owned possibilities

**Universe:** `shadow-and-thread` · **Novel:** *Evil Psych Wards from Venus*
**Creative owner:** Raven; actors Erin and Lari; character names `Dr. Raven Vale`, `E. Marlowe`, and `L. Vesper`.
**Canonical fiction boundary:** fictional alternate-universe Samaritan Hospital System. No assertions about real hospitals, clinical treatment, supernatural events or real people.

## Changes to the working game

1. **Evidence Caseboard.** The existing audit-hatch scene now offers a three-clue deduction. The player must find the conflicting discharge dates, the lack of present-tense signatures, and the missing CURRENT register. Wrong guesses have no penalty, no forced replay, no hospital signature, and no state mutation. The hidden choice requires a valid in-scene finding. Existing endings and the immediate right to decline remain accessible.
2. **The What-If Mirror.** Each locally completed story decision offers a read-only, deterministic alternative preview. The player explicitly chooses to adopt another timeline; previewing never changes the original save or overwrites player decisions. Existing source-of-truth boundaries remain unchanged; alternative projections are not public canon.
3. **Replay Trails.** A bounded `v1:<choice>.<choice>` token reconstructs a deterministic authored path. Only choice IDs travel in the URL. No private model-generated text, hint preferences, patient/user name, cast packet, local notes, or device data are included. Loading a received link is an explicit action; receiving a URL does not automatically replace local saved progress. This is a convenience link, not a signed history or server-side identity attestation.
4. **Secret ending: The Bigfixers' First Accord.** Solving the caseboard allows Nell and a fruit-fly bigfixer guild to expose the coercive contract and require visible exits. Lari acknowledges the irreverent paperwork revolt; Erin preserves the records; Raven hands control to the people affected. The ending opens a *voluntary invitation* to Civweave rather than asserting the entire novel is finished.

## Presentation

The existing Worldweaver replay page gains a Venus transmission hero, muted pulp palette, scene-dependent dread/twilight/dawn treatment, clue counters, accessible controls, mobile-first caseboard checkboxes, actor sprite cropping for Lari's existing reviewed 2x2 atlas, reduced-motion support, and explicit narrative/model boundaries. Layout decoration does not confer authorization or change canonical simulation state.

## Canon and implementation boundaries

- Authored replay state remains in `public/app/shared/worldweaver-story-replay-v1.mjs` and per-device storage; the page is a display and interaction surface.
- Actor improvisation delegates to the existing selected Civweave model runtime only when the human requests it. Model replies remain private, review-required proposals, never automatic NPC speech or verified facts.
- Missing original Raven/Erin artwork stays unresolved. Lari's existing approved sprite is reused. No replacement identity is invented.
- All existing player history is rebuilt from validated choices. Older saves without a caseboard proof remain readable. The hidden route requires a finding before the transition.
- There is no new persistent chat owner, signed Guild host, OpenSimulator provisioning, automatic AI scheduling, medical service, financial action, or claim of authoritative canon approval.
- Share trails are portable local reconstructions, not a human-readable signed log or a claim of verified actions.

## Test and acceptance

`node --test scripts/test-shadow-thread-spice-v1.mjs` checks caseboard prerequisites, secret ending, harmless rejected guesses, save verification, timeline preview vs adoption, private share token boundaries, and unchanged voluntary exits. It is included in `npm run test:worldweaver` and `verify-worldweaver-core.yml`.

The existing regression suites also cover the first seven dialogue beats, replay persistence, the second scene, original actor names, and opt-in AI rehearsal.

**Production status:** staging-only until the ordinary Civweave release path approves promotion; staging deployment success must be confirmed from GitHub Actions independently of committed source.
