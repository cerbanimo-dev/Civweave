# Anarchadia moderation tribunals v1

## Constitutional boundary

Detection may open a case. Detection never establishes guilt, mints a punishment, or bans an account. A sanction requires an Anarchadia tribunal outcome that satisfies the configured quorum and guilt threshold. Appeals create a fresh regional review and exclude the original jury.

## Lexicon sources and licensing

The runtime separates broad candidate vocabulary from the high-confidence hate overlay.

- LDNOOBW (English and Japanese), CC BY 4.0: broad offensive/obscene candidate vocabulary. Inclusion in that source alone must never be treated as hate speech.
- Yusuke Matsubara's Japanese bad-words list for Wikimedia vandalism detection, CC0 1.0: Japanese candidate spellings and moderation vocabulary. Inclusion alone must never be treated as hate speech.
- Civweave curated hate overlay, AGPL-3.0-or-later: explicit target and explanation annotations used by the deterministic tribunal-opening fallback.

HurtLex is useful research material but is CC BY-NC-SA 4.0, so Civweave does not embed or derive its commercial runtime lexicon from HurtLex.

## Detection pipeline

1. Preserve the original text as evidence.
2. Build normalized views using Unicode NFKC, zero-width removal, punctuation/spacing compaction, common leetspeak substitutions, cross-script confusables, and katakana/hiragana folding.
3. Check exact terms, explicit aliases, normalized obfuscations, and bounded edit-distance variants.
4. If the device's MiniLM session is already active, semantically rank targeted-hate, quoted/counterspeech, and ordinary-nonhate descriptions. Moderation does not silently download or start MiniLM.
5. An optional local generative classifier may add context such as quotation, counterspeech, reclamation, or direct attack.
6. Cross the configured tribunal-opening threshold only for an explicitly tribunal-eligible lexicon entry. The initial default is 0.82 and regional policy may change it within the permitted range.

A broad profanity match may be surfaced to S.A.F.E. mode or moderation UI, but it is not a hate-speech conviction and is not by itself tribunal-eligible.

`anarchadia-moderation-runtime-v1.js` is the public-message gate. Public chat surfaces call `moderatePublicChatMessage()` before propagation. The gate checks any active Anarchadia public-chat restriction first, then performs detection and can create/persist a tribunal candidate. Private or plan-scoped encrypted conversations are not silently reclassified as public chat by this module.

## Tribunal lifecycle

`flag -> jury selection -> deliberation -> quorum -> verdict -> optional audit -> juror reward -> sanction -> optional regional appeal`

Default jury procedure:

- cryptographically seeded random weighted panel: 5
- quorum: 60%
- guilt threshold among decisive verdicts: 67%
- random secondary human review: 15%
- high-quality reviewer selection bonus is capped and subject to a recent-service ceiling

Each juror submits a verdict, severity when guilty, explanation, and one or more evidence references. Structural validation checks that decisive verdicts contain a real rationale and cite case evidence. Agreement with the majority is not required for reward eligibility.

## Durable jury reputation and compensation

`anarchadia-juror-registry-v1.js` persists local juror quality and service history. Jury selection can be given the region/node's eligible actor IDs, then draws the random panel using each actor's persisted selection weight while excluding conflicts. Assignment timestamps are recorded so elevated reviewers cannot monopolize tribunal work.

Every validated jury submission mints exactly **2 new Acorns** with ledger reason `tribunal_jury_reward`.

- If the submission is not selected for secondary review, the reward becomes mintable as soon as the tribunal closes with quorum.
- If selected, the reward waits for secondary human validation.
- A coherent dissent can pass secondary review. Review is about participation quality, not majority obedience.
- Positive secondary-review history raises future jury-selection probability up to a cap.
- Dismissing jury invitations gradually removes elevated selection bonus until the user returns to baseline probability. It never pushes the user below baseline.
- Service history and review history survive reloads through the juror registry.

Acorn jury compensation is issuance, not a transfer from the accused, victim, or a courthouse treasury. Acorn spending is treated as a burn elsewhere in the Civweave economic model, so tribunal service is a controlled issuance faucet paired with the Acorn sink.

## Governed tribunal policy

`anarchadia-tribunal-policy-v1.js` stores tribunal policy per region. A proposed change is content-hashed and must pass a closed, signed quadratic policy ballot with quorum before the candidate policy can replace the active policy. A direct vote overrides delegation for that ballot.

The following constitutional invariants are not ordinary policy knobs:

- jury reward stays 2 Acorns;
- classifiers cannot convict;
- quadratic voting cannot determine individual guilt;
- appeals use a fresh jury.

Sanction bands default to zero. This means shipping the tribunal machinery cannot silently ship an unelected punishment schedule. A region must affirmatively adopt any Button fine, Acorn restitution, or public-chat restriction schedule.

## Sanctions and restitution

`anarchadia-tribunal-enforcement-v1.js` settles a guilty outcome against the policy revision attached to the case and keeps the three channels separate:

- Button fine: a negative Button ledger entry against the guilty actor;
- Acorn restitution: newly minted Acorns for the affected actor or actors, independent of the fine;
- temporary public-chat restriction: an Anarchadia access record checked before a public message is sent.

Juror payment never depends on conviction or severity. Restitution never comes from the juror reward stream.

## Delegation and quadratic voting

Hot-swap delegation is category scoped. A direct vote always overrides the user's active delegation for that ballot. Delegation chains are cycle-safe and can be time/region scoped.

Quadratic voting is implemented for **policy questions**, not guilt. Each represented voter keeps an independent credit budget, with cost `votes^2`; a delegate chooses an allocation on a principal's behalf but does not pool principals' credits into a super-wallet. Signed allocations are verified before a policy ballot can close. Tribunal guilt remains a quorum/threshold adjudication.

## Mesh and online parity

Tribunal gossip envelopes contain case IDs, hashes, region, status, jury IDs, verdict hashes, and appeal IDs. They explicitly omit raw abusive text. Raw evidence stays tribunal-only and can be kept in a separate encrypted/local evidence vault. The same envelope can be passed through the Civweave community-object mesh, allowing eventual offline propagation without replicating hateful content across every peer.

The moderation API does not require continuous connectivity: detection, jury state, policy state, restrictions, and juror reputation are local-first. Online delivery can propagate tribunal envelopes immediately; mesh delivery can gossip the same hash-only objects later.
