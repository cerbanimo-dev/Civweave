# merlinites semantic planning v164

`merlinites` is Commonweave's local semantic planning and review layer. It uses the installed `all-MiniLM-L6-v2` encoder to rank known structures, criteria, and evidence. It does not pretend that an encoder generates prose or proves real-world completion.

## Authority boundary

`merlinites` is advisory.

- Existing intention approval gates remain required.
- Living School's deterministic rubric remains the authority for passing assessments and awarding XP.
- Cerbanimo still requires deterministic, peer, or human verification before accepting work or settling rewards.
- Semantic similarity never activates an intention, completes a task, issues a credential, or mints a reward.

## Planning flow

1. Preserve the original deterministic weave.
2. Add a `commonweave.merlinites-semantic-plan.v1` tree beside it.
3. Expand each path into bounded steps and atomic evidence-bearing actions.
4. Stop at the configured maximum depth, currently three.
5. Return the first unfinished leaf through `CommonweaveMerlinitesV164.nextAction(plan)`.
6. Expand a later node independently with `CommonweaveMerlinitesV164.expandNode(node, { maxDepth })`.

The tree is generated lazily from existing path data. Original titles, steps, assumptions, states, and approval controls are not replaced.

## Learning review

`evaluateLearning()` compares an answer against each rubric criterion separately. It records demonstrated, partial, missing, and misconception signals and proposes a targeted follow-up for the weakest required criterion.

A semantic review can support a deterministic pass, but it cannot promote a deterministic failure or uncertain result.

## Cerbanimo evidence review

`evaluateTask()` maps proof items to task, quest, and proof criteria. It identifies missing coverage and rejects bare completion claims as evidence. Its output always includes:

- `autoComplete: false`
- `verified: false`
- `requiresHumanOrDeterministicVerification: true`

## MiniLM runtime

The original reflex `match()` API remains unchanged. `merlinites` adds a separate `rank()` API for bounded, caller-supplied candidate sets.

- Maximum 64 candidates per ranking request.
- Maximum 16 returned matches.
- Candidate embedding cache limited to 24 sets.
- Cache signatures include candidate IDs and text, preventing criteria from different lessons from sharing stale vectors.
- Lexical ranking remains available immediately when MiniLM is absent, cold, or slower than the caller's wait budget.

## Public API

```js
const merlinites = globalThis.CommonweaveMerlinitesV164;

merlinites.enhancePlan(plan);
await merlinites.refinePlan(plan, { text: plan.wish, semanticWaitMs: 600 });
merlinites.expandNode(node, { maxDepth: 3 });
merlinites.nextAction(plan);
await merlinites.evaluateLearning({ prompt, response, criteria, deterministic });
await merlinites.evaluateTask({ task, quest });
await merlinites.status();
```

## Regression contract

The verifier at `scripts/verify-merlinites-semantic-v164.mjs` asserts that `merlinites`:

- does not mutate the original weave;
- preserves the existing user-facing response and approval gate;
- cannot promote deterministic assessment failures;
- cannot auto-complete or verify Cerbanimo work;
- preserves the original MiniLM reflex `match()` path;
- invalidates cached candidate vectors when criterion text changes.
