# Civweave Validation Battle v1

A tiny, non-blocking turn-based battle vignette that translates external Quest validation outcomes into Civweave world fiction.

## Trigger

The battle runtime consumes `civweave:validation-receipt-recorded` and `civweave:validation-battle-request` events. The cloud validation executor enriches the receipt event with its external verdict and lazy-loads `/app/validation-battle-v1.js`.

The runtime also listens for Quest Veil ledger changes and can replay the newest unseen external threshold result. Session-scoped receipt/threshold deduping prevents the same result from playing twice in one browser session.

### Outcome mapping

- `pass`, `accepted`, `verified-pass` -> `success`
- `fail`, `revision`, `provisional-fail` -> `revision`
- `verified-fail`, `denied`, `rejected` -> `denial`

A plain external validation failure is treated as a revision rather than a permanent denial. A verified fail can use the stronger denial scene.

## Characters

The built-in registry contains five town NPCs plus Lari the Lyrebird Warlock:

| id | character | signature move | effect |
| --- | --- | --- | --- |
| `weaveling` | Weaveling | Thread Bind | thread weave |
| `kamiya` | Kamiya | Gift Delivery | wrapped present projectile |
| `rook` | Rook | Fair Trade Toss | token/cookie projectile |
| `moss` | Moss | Acorn Ward | acorn projectile |
| `merlin` | Merlin | Star Compass | star beam |
| `lari` | Lari | Charm Person | heart/charm volley |

`lira` is accepted as an alias for `lari` so older or typoed calls still resolve to the antagonist.

## Default scenes

### Success

Two or three town NPCs band together. Kamiya is guaranteed in the automatically selected party so a successful validation can visibly deliver the proof as a present. Other allies are deterministic-but-varied from the validation seed. Each ally uses a signature move; Lari reacts between impacts; the party celebrates.

### Revision / denial

Lari identifies a weak opening and uses his one reliable move, Charm Person, against a selected party member. The party reacts and regroups. Revision copy emphasizes another pass; denial copy emphasizes a materially different move.

## Runtime API

```js
CivweaveValidationBattleV1.play({
  outcome: 'success',
  receiptId: 'validation-receipt:...',
  external: true,
  allies: ['kamiya', 'moss', 'rook'],
  force: true
});
```

For external validation payloads:

```js
CivweaveValidationBattleV1.playFromValidation({
  verdict: 'fail',
  provider: 'cloudflare-workers-ai',
  validatorType: 'cloud-model-assisted-human',
  relationship: 'independent',
  receiptId: 'validation-receipt:...'
});
```

Or dispatch a generic integration event:

```js
dispatchEvent(new CustomEvent('civweave:validation-battle-request', {
  detail: {
    decision: 'verified-pass',
    thresholdId: 'threshold:...',
    submissionId: 'submission:...',
    external: true
  }
}));
```

### Plugging in another character

```js
CivweaveValidationBattleV1.registerCharacter('new-npc', {
  name: 'New NPC',
  sheet: '/New-NPC-sprites.png',
  grid: [5, 4],
  cellAspect: 1.2,
  animations: {
    idle: ['R1C1', 'R1C2', 'R1C1'],
    attack: ['R3C3', 'R4C2'],
    react: ['R2C3', 'R2C4'],
    celebrate: ['R1C3', 'R4C3']
  },
  move: {
    name: 'Signature Move',
    effect: 'beam',
    caption: 'A short in-world action line.'
  }
});
```

The source sheets are semantic key-pose atlases, not production frame-by-frame animation. The runtime steps through selected cells to make short motion-comic loops. A later art pass can add in-between frames without changing the battle event contract.

## Accessibility and behavior

- Non-blocking fixed vignette; it does not interrupt Quest state updates.
- Skip button removes the clip immediately.
- `prefers-reduced-motion` removes projectile travel and animated transitions.
- `CivweaveValidationBattleV1.setEnabled(false)` disables battle clips locally.
- No validation evidence contents, contributor identity, or private Quest text are rendered into the battle clip.
