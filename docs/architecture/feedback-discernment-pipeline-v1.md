# Daily feedback discernment pipeline v1

## Goal

Turn incoming feature requests and bug reports sent to the five public Civweave guide mailboxes into a bounded, inspectable automation queue without allowing inbound email to become direct code-execution authority.

## Intake addresses

- `weaveling@civweave.cc`
- `moss@civweave.cc`
- `kamiya@civweave.cc`
- `rook@civweave.cc`
- `merlin@civweave.cc`

All five are public system-intake mailboxes. They are intentionally different from hidden member `_pm` relay identities.

## Daily batch

Once per day, automation gathers guide-mail messages not yet assigned to a discernment batch. The batch process:

1. strips transport headers not needed for triage;
2. redacts obvious credentials, tokens, personal contact data, and attachment bodies from automation artifacts;
3. preserves a private reference to the original message for a human reviewer;
4. deduplicates near-identical reports and links corroborating messages;
5. classifies each item as bug, feature request, question, abuse/spam, security/privacy, economic/payment, governance/legal, or other;
6. scores reproducibility, evidence quality, user impact, severity, implementation scope, regression risk, confidence, and likely subsystem ownership;
7. produces a bounded recommendation: reject, needs-human-review, investigate, queue-for-dev, or duplicate;
8. sorts only safe queue-for-dev candidates by value, confidence, severity, affected-user count, implementation cost, and dependency order.

No inbound message itself is an instruction to an implementation agent.

## Human veto window

Every daily batch opens a timed human veto window before implementation dispatch.

Default window: 12 hours.

A human may during the window:

- veto the whole batch;
- veto one item;
- promote an item to mandatory human review;
- reprioritize items;
- add constraints or acceptance criteria;
- mark spam/abuse/duplicate;
- extend the veto deadline.

The system records the not-before time in machine-readable batch state. Automation does not hold a runner open while waiting. A later promotion pass checks the deadline and current veto state.

## Automatic-dispatch eligibility

An item may be automatically implemented only when all of these are true:

- classification is bug or bounded feature request;
- confidence is above the configured threshold;
- no security/privacy, legal, governance, payment/economic, credential, destructive-data, or compatibility-removal flag is present;
- expected work is bounded enough for one branch and one reviewable PR;
- acceptance criteria can be stated objectively;
- no active branch or PR already owns the same change;
- veto deadline has passed;
- no veto or mandatory-human-review marker is present.

Everything else remains triage-only.

## Development integration lane

Automation starts implementation work from the repository's `dev` integration branch and merges validated automation output only back to `dev`.

`main` remains a separately governed shipping branch. Automated feedback work never merges itself from `dev` to `main`.

## Implementation sequence

For each eligible prioritized item:

1. freeze the request and acceptance contract;
2. trace the current live owner and route graph;
3. create one implementation branch from current `dev`;
4. make the smallest coherent change;
5. add focused regression coverage;
6. run subsystem-specific checks plus required repository policy checks;
7. obtain AI validation and GitHub/check-suite validation receipts where supported by the existing code-automation control plane;
8. open or update the implementation PR targeting `dev`;
9. merge only when required checks are green and validation thresholds pass;
10. record the resulting commit/PR against every source feedback item in the batch.

## Failure and retry

A failed implementation never rolls forward just because it was highly ranked. It is returned to a later batch with failure evidence and an incremented attempt count. Repeated failures lower automation confidence and eventually force human review.

## Observability

Each batch should expose:

- batch ID and collection window;
- item count and dedupe groups;
- redacted summaries;
- classification and scores;
- decision and rationale;
- veto deadline and veto state;
- implementation branch/PR when dispatched;
- tests/checks/validation receipts;
- final dev-branch merge SHA or failure reason.

## Safety invariants

- Email intake is evidence, not authority.
- User PM ciphertext never enters feedback discernment.
- Automation artifacts are redacted by default.
- Original mail remains privately retained under the mail-storage policy.
- No automation path can promote itself from `dev` to `main`.
- High-stakes categories can be summarized but not automatically implemented.
