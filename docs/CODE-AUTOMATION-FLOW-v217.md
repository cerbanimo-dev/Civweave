# Civweave code-intent and automation flow v218

This control plane separates **creator-led software projects** from **delegated software builds** before any GitHub worker is allowed to start.

## The ownership boundary

Clear delegation is required for automatic coding.

| User meaning | Example wording | Result |
| --- | --- | --- |
| Creator-led | “I want to make a game about time loops.” | Create a Cerbanimo project with several user-owned tasks. Do not dispatch GitHub automation. |
| Delegated | “Make me a game about mutual aid.” | Create an automation-only Cerbanimo plan, require approval, then dispatch the configured GitHub worker. |
| Unclear | “I want a game about local history.” | Do not automate. Keep implementation ownership unresolved until the user chooses guided creation or delegated implementation. |

The classifier does not depend on those exact sentences. It scores the grammatical role and request shape, including:

- first-person creation: “I’d like to build…”, “we plan to develop…”, “I’m working on…”, “let’s make…”;
- guidance requests: “help me build…”, “walk me through making…”, “how do I create…”;
- explicit delegation: “I want you to implement…”, “have Jules build…”, “please create…”, “could you make…”;
- passive delegation: “I need this API fixed”, “I want a game built”;
- self-ownership signals: “myself”, “on my own”, “hands-on”.

Contractions and polite wrappers are normalized before classification. Guidance language outranks a superficial “can you” prefix, so “Can you help me build…” remains creator-led while “Can you build…” is delegated.

Physical board, card, dice, and tabletop game requests do not enter software automation unless the request also names a digital platform, codebase, engine, or software technology.

## Creator-led Cerbanimo projects

A creator-led request becomes a reviewable Cerbanimo action with user-owned checkpoints:

1. Define the intended experience, audience, and promise.
2. Choose platform, tools, constraints, and a small first scope.
3. Describe the core loop, controls, success, failure, and progression.
4. Inventory art, audio, content, data, and available assets.
5. Build or assemble the smallest usable or playable prototype.
6. Test it, record friction, and choose the next revision.
7. Decide whether any bounded implementation task should later be delegated.

The action is marked `automationOnly: No` and `execution.status: user-led-planning`. It never enters the GitHub dispatch queue. A later clearly delegated subtask can create its own automation-only plan.

## Delegated requests that enter automation

- **Anarchadia:** clearly delegated on-platform feature, defect, interface, system, workflow, offline, ledger, validator, or design changes.
- **Cerbanimo:** clearly delegated software work requested as part of skilled work, including games, applications, APIs, databases, frontends, backends, PWAs, service workers, integrations, tests, deployments, and repository work.

Ordinary conversation, creator-led work, ambiguous ownership, and non-software design stay outside the automation queue.

## Automation plan contract

The runtime creates `civweave.code-automation-plan.v1`, stores it as a `cerbanimo / automation-quest`, and leaves it in review. An Anarchadia request keeps its source and authority context, while implementation ownership moves to Cerbanimo.

The plan contains six ordered steps:

1. Freeze the request and acceptance contract.
2. Trace executable ownership and design the smallest safe change.
3. Implement the bounded change.
4. Add focused verification and reproduce the intended result.
5. Reconcile one pull request against fresh main.
6. Prove final dual-gate merge readiness.

Every step has two independent gates:

- a platform AI task-validator receipt covering the step rubric, evidence hash, and exact commit;
- successful required GitHub checks for that same commit, with the commit confirmed as an ancestor of the current PR head.

A later green commit cannot validate an earlier AI receipt, and an AI pass cannot substitute for GitHub checks.

## Settings and repository rename

The browser reads the first available key:

- `civweave.github-automation-flow.v1`
- `civweave.github-automation.v1`
- `civweave.jules-automation.v1`

Canonical settings:

```json
{
  "enabled": true,
  "repository": "cerbanimo-dev/Civweave",
  "baseBranch": "main",
  "implementationAgent": "jules",
  "dispatchMode": "github-repository-dispatch",
  "token": "stored only on the user's device",
  "validatorEndpoint": "https://your-validator.example",
  "validatorToken": "stored only on the user's device",
  "stepRequiredChecks": ["local-first", "code-automation-control-plane"],
  "mergeRequiredChecks": ["local-first", "code-automation-control-plane"],
  "mergeMethod": "squash",
  "requireSignedAiReceipts": true
}
```

Legacy stored repository values naming the former repository are migrated in memory to `cerbanimo-dev/Civweave` before dispatch. Tokens are used only in request headers and are never copied into plans or repository-dispatch payloads.

If settings are incomplete, a delegated automation plan remains visible but inert. Creator-led plans do not require GitHub settings.

## GitHub launch and validation

Approval queues `civweave.code-automation-dispatch.v1`. The default route sends a `civweave-code-automation` repository dispatch. The Jules prompt requires one branch, one pull request, ordered step commits, matching validator submissions, required GitHub checks, and a checked-in manifest at `.civweave/automation-plans/<plan-id>.json`. Jules may not push directly to main or merge.

The monitor requests a signed `civweave.code-automation-attestation.v1` from the configured platform validator. It independently retrieves GitHub checks and confirms:

- every receipt names the plan and exact step;
- complete rubric criteria passed;
- AI and GitHub receipts name the same commit;
- every step commit is included in the current PR head;
- repository, base branch, and manifest match the approved plan;
- no review requests changes;
- GitHub reports the PR mergeable;
- Jules completed the session;
- the final validated commit is still the exact PR head.

If the head changes, the final gate closes and both forms of evidence must be refreshed.

## Merge authority

Only the monitor owns automatic merge. The browser can classify, create, approve, dispatch, and display plans. Jules can implement. Neither may merge.

The monitor labels blocked PRs `code-automation-blocked` and ready PRs `code-automation-ready`. It can exact-SHA squash-merge only when `CODE_AUTOMATION_GITHUB_TOKEN` is configured and `CODE_AUTOMATION_AUTOMERGE_ENABLED` is not false.

Required repository secrets:

- `JULES_API_KEY`
- `CODE_AUTOMATION_GITHUB_TOKEN`
- `CIVWEAVE_AI_VALIDATOR_URL`
- `CIVWEAVE_AI_VALIDATOR_TOKEN`

There is no bypass path. Missing, failed, unsigned, stale, or commit-mismatched AI evidence blocks merge. Missing, pending, or failed GitHub checks block merge. Ambiguous ownership blocks automation before implementation starts.
