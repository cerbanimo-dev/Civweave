# MiniLM + deterministic template planning and reward policy v198

## Purpose

This change reconnects the fixed ONNX Runtime MiniLM package to deterministic planning without giving semantic similarity authority over completion, validation, or rewards.

MiniLM is a librarian. It ranks candidate template pieces against the user’s context. Deterministic code chooses a diverse set, adds deliverables, evidence requirements, acceptance criteria, and stable ordering, then preserves the existing review and activation gates.

## Planning surfaces

The composer can build three structures:

- Learning paths: outcome, diagnostic, source foundation, guided practice, independent transfer, assessment, and reflection.
- Project plans: outcome, constraints, discovery, design, prototype, integrated build, validation, delivery, and retrospective.
- Market requests: exact need or offer, quantity and timing, fair terms, substitutes, source comparison, verification, handoff, and fairness review.

Every generated reward-bearing task includes:

- a concrete deliverable;
- one or more inspectable evidence types;
- at least two acceptance criteria;
- a complexity score of at least four;
- a stable content fingerprint used to prevent duplicate reward claims even when a task is renamed or regenerated.

“Identify the smallest task” remains useful only as a non-reward-bearing microstep inside a larger task. It cannot pass the reward gate by itself.

## MiniLM activation policy

The model is not started during page boot. The adapter is imported only when a substantive plan or realm action needs ranking. If the fixed local package is present, the composer explicitly prewarms the local ONNX Runtime session and ranks up to 64 template candidates. If the package is absent, paused, or fails to start, the same candidates are ranked with deterministic lexical overlap.

The fallback is reproducible and does not block plan creation.

## Reward policy

The policy normalizes task rewards around a base reward bundle:

| Mode | Multiplier | Eligible task limit |
|---|---:|---:|
| Deterministic + local semantic | 0.5× | 3 per local calendar day |
| Generative model | 1.5× | Unlimited |
| Generative peer-model review | 2.0× | Unlimited, no self-review |

User-facing copy is framed positively: **Generative models earn 50% more rewards**, have no daily task cap, and can earn extra rewards when reviewing another user’s submission.

A claim is rejected when it is trivial, lacks a deliverable, lacks inspectable evidence, has fewer than two acceptance criteria, falls below the complexity threshold, repeats a prior content fingerprint, consists only of a completion claim, exceeds the deterministic daily limit, or attempts a self-review bonus.

The policy writes compatible Button, Acorn, and Skill XP events to `commonweave.rewards.v156` and stores claim/cap state in `commonweave.reward-policy.v198`.

## Authority boundary

MiniLM may rank template pieces and evidence-relevant language. It may not:

- mark tasks complete;
- pass learning assessments;
- validate proof;
- mint or settle rewards;
- bypass consent or activation gates.

Those decisions remain deterministic and auditable.
