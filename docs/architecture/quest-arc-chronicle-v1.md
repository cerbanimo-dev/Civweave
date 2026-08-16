# Quest Arc Chronicle v1

## Purpose

Quest Arc Chronicle is a derived story and receipt-projection layer for Civweave Quests. It does not replace the canonical Quest engine, validation ledger, Quest Veil, reward ledger, or Passport.

Canonical work truth remains owned by `public/app/cerbanimo-quest-engine-v144.js`. Human-readable proof remains gated by `public/app/quest-veil-ledger-gate-v1.js`. Quest Arc Chronicle subscribes to those owners and derives a narrative progression plus deliberately low-information public stand-ins.

## Vocabulary

- **Quest Arc** — the full narrative progression.
- **Quest Beat** — one story progression step.
- **Quest Chronicle** — the visible history of cleared and setback Beats.
- **Quest Verse** — an optional four-line public rendering of a completed or setback Beat.
- **Sealed Receipt** — the protected detailed work record represented publicly by a Beat or Verse and, where available, a cryptographic commitment.

## Default Hero arc

The default mandatory path is:

1. The Spark
2. The Call
3. The Stakes
4. Counsel
5. The Muster
6. The Threshold
7. The First Trial
8. The Road of Trials
9. The Deepening
10. The Descent
11. The Ordeal
12. The Breakthrough
13. The Claim
14. The Homeward Road
15. The Reckoning
16. The Gift

Optional or conditional Beats are inserted without changing the default path:

- **At the Gate** — paused or uncertain before commitment.
- **Fellowship** — a Party, Guild, mentor, or collaborator joins.
- **The Snare** — a failed or blocked attempt.
- **Reforging** — revision after a Snare, followed by return to the interrupted Beat.
- **The Release** — intentional closure without the original objective being completed.

The runtime exports all 21 Beats even though only 16 form the normal uninterrupted path.

## Automatic progression

`public/app/quest-arc-chronicle-v1.js` subscribes to `cerbanimo:quest-engine-changed` and derives the current Beat from canonical Quest/task state. When canonical state moves ahead by more than one story stage, intervening default Beats are recorded as cleared so the Chronicle remains a continuous Hero arc rather than a sparse percentage log.

Revision produces a conditional branch:

`current work Beat -> The Snare (SETBACK) -> Reforging -> interrupted work Beat`

Story-only manual events are also supported for optional Beats and explicit Lud narration. They mutate only derived Quest Arc state and never mutate canonical task completion or validation truth.

## Lud Mode boundary

The Quest Arc core is intentionally model-free and is included in `public/app/lud-package-v1.json`. Lud Mode renders the current Beat and recent deterministic Beat receipts from this core. The core contains no shared model runtime or loader dependency.

The optional low-tier generator lives separately in `public/app/quest-verse-generator-v1.js` and is not part of the Lud package. It fails back to the deterministic Beat representation and refuses model execution while Lud Mode is active.

## Quest Verse contract

The Verse adapter passes only public story inputs:

- public Quest name
- public Quest brief
- current Quest Beat and Beat meaning
- `CLEARED` or `SETBACK`
- optional safe outcome hint

It requests the shared interactive runtime with `taskTier: "small"`, `complexity: "small"`, `maxTokens: 160`, streaming disabled, and a maximum 12-second runtime timeout. The core validates exactly four non-empty short lines, allows one constrained retry, then falls back to the deterministic Beat receipt.

Private receipt text, evidence, validator identities, source artifacts, and work summaries are never inputs to the Verse prompt.

## Receipt projection and privacy

A public projection has schema `civweave.quest-chronicle-projection.v1` and carries only:

- Quest identifier when the caller is allowed to expose it
- public Quest name
- Beat identifier and label
- outcome
- deterministic Beat text and/or validated Verse
- optional receipt commitment
- creation time

Every projection explicitly marks sealed receipt content, work summary, evidence, and safe outcome hint as not included.

New protected receipts can be committed with a random 24-byte salt and stable-canonicalized SHA-256 digest. Verification recomputes the commitment from the disclosed receipt and stored salt. Secure randomness and WebCrypto SHA-256 are required; the implementation fails closed rather than substituting a weak digest.

Existing Quest Veil entries already expose a SHA-256 `sourceHash`. When a Beat receipt derives from those existing human-safe entries, that hash may be carried as `civweave.quest-veil-source-commitment.v1` and is explicitly labeled `legacyUnsalted: true`. It is not represented as equivalent to a new salted sealed-receipt commitment.

`safeVeilReceiptStandIns()` reads only `CivweaveQuestVeilLedgerGateV1.humanChronicle()`. It never reads the validation ledger or raw submission. Only final `verified-pass` and `verified-fail` task-veils become receipt stand-ins, and the Quest Veil title/story are intentionally discarded during projection.

## Public metadata rule

Quest names and briefs are not assumed public merely because they exist in a local Quest record. Network Verse generation must receive explicitly public-safe Quest metadata from its caller. If public metadata is unavailable, the deterministic Beat receipt remains valid and requires no generation.

## Regression coverage

- `scripts/test-quest-arc-chronicle-v1.mjs`
  - 21-Beat vocabulary and continuous default path
  - Snare/Reforging recovery
  - four-line validation/retry/fallback
  - model-free Lud core
  - salted commitment verification and tamper rejection
  - Quest Veil safe-projection isolation
- `scripts/test-quest-verse-generator-v1.mjs`
  - explicit small-tier routing and resource caps
  - Lud no-model boundary
- `scripts/test-lud-game-ui-v1.mjs`
  - current Quest Beat HUD
  - visible deterministic Chronicle
  - offline package revision coverage
