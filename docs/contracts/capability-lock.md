# Civweave Capability Lock

## Purpose

Civweave must not depend on an implementation agent remembering every feature that has previously been accepted. Once a user-visible capability is accepted, later work must preserve executable proof that the capability still exists.

The Capability Lock is a repository-level regression boundary. Its central rule is:

> A candidate change may not define the evidence used to prove that it preserved already-accepted behavior.

## Sources of truth

- `config/accepted-capabilities.json` is the monotonic accepted-capability registry.
- `scripts/capability-lock-runner.mjs` is the v1 base-owned runner.
- `.github/workflows/capability-lock.yml` is the v1 always-run PR/push gate.
- `scripts/capability-lock-enforced-runner.mjs` is the v2 default-branch-authority runner.
- `.github/workflows/capability-lock-enforced.yml` is the v2 `pull_request_target` enforcement workflow.

## Trust model

For a normal pull request, the candidate checkout is the implementation under test, but the accepted registry, runner, and contract scripts do not come from the candidate change.

The v1 workflow materializes its runner from the pull request base commit. The runner then:

1. Reads the accepted registry from the base commit.
2. Reads the candidate registry from the candidate checkout.
3. Fails if any already-accepted capability is removed.
4. Fails if any already-accepted capability definition is changed.
5. Fails if the accepted registry shrinks.
6. Removes the candidate `scripts/` contract tree from the CI workspace.
7. Restores the trusted `scripts/` tree from the base commit.
8. Executes every accepted P0/P1 capability against the candidate product code.
9. Emits a machine-readable and GitHub Step Summary report.

This means an implementation agent cannot make a regression green merely by weakening an accepted test in the same pull request.

## Enforced v2 authority

V2 moves the workflow authority itself out of the candidate pull request. `.github/workflows/capability-lock-enforced.yml` uses `pull_request_target`, so once that workflow exists on the repository default branch GitHub loads the workflow definition from trusted default-branch state rather than from the candidate branch.

The enforced job is intentionally unprivileged:

- repository permission is `contents: read` only;
- action dependencies are pinned to immutable commit SHAs;
- checkout credentials are not persisted;
- no repository secrets are passed to candidate execution;
- the GitHub synthetic PR merge commit is fetched and both parents are verified against the event base/head SHAs;
- the authority runner and locked control-plane files are taken from the default branch;
- the accepted capability registry and contract scripts are taken from the actual PR base commit;
- registry policy itself is immutable under ordinary feature PRs;
- every accepted capability receives a freshly reconstructed candidate workspace;
- candidate `scripts/` are removed and replaced with the base-owned trusted scripts before execution;
- candidate processes receive an explicit environment allowlist rather than the complete GitHub Actions environment.

The locked default-branch control plane is:

- `.github/workflows/capability-lock-enforced.yml`;
- `.github/CODEOWNERS`;
- `scripts/capability-lock-enforced-runner.mjs`.

An ordinary candidate PR that changes any of those files away from default-branch authority fails the enforced lock. Control-plane migration is therefore a separate governance action, not a normal feature change.

Because `pull_request_target` executes the workflow from the repository default branch, staging the v2 files is not enough to activate default-branch authority. V2 becomes authoritative after the same control plane is deliberately promoted to `main` (the repository default branch). Until then, v1 remains the active staging gate.

## Monotonic acceptance

Existing capability entries are immutable under the ordinary feature-change path. A feature change may add a new capability entry, but it may not alter or remove an accepted one.

A new entry becomes part of the trusted base after it is merged. From the next change onward it is protected by the same base-owned proof mechanism.

Retiring or intentionally redefining an accepted capability is not an ordinary implementation change. It requires an explicit human-approved contract migration and must never be silently bundled into unrelated feature work.

V2 also freezes the registry `policy` object. A candidate cannot silently change trusted contract roots, run tiers, or the monotonic policy while leaving individual capability rows unchanged.

## Bootstrap rule: green evidence only

An existing verifier is not accepted merely because its filename says `verify`, `test`, `contract`, or `gauntlet`. The bootstrap baseline must execute successfully against the unchanged integration product before it can become immutable regression authority.

The first Capability Lock bootstrap deliberately exercised a wider set of historical verifiers. That audit found substantial verifier drift: multiple old contracts were pinned to superseded release identities, layout revisions, Settings revisions, local-model revisions, navigation implementation details, and older Living School runtime markers. Those stale contracts are not silently waived and are not promoted into the accepted baseline.

Only contracts demonstrated green against the current integration state are eligible for initial acceptance. Stale verifiers remain ordinary technical debt until repaired or replaced by a current executable contract; repairing a verifier does not by itself prove a capability was accepted.

## Tiers

- **P0** — product-critical behavior whose disappearance blocks normal use, installation, navigation, shared state, or a primary capability.
- **P1** — important behavior whose disappearance is a material regression but may not make the entire product unusable.
- **P2** — useful lower-priority behavior that may be recorded in the registry but is not part of the mandatory every-change gate unless the policy is deliberately expanded.

Every accepted P0 and P1 capability runs on every gated change.

## Initial accepted baseline

The bootstrap registry began with contracts demonstrated green against the unchanged integration product:

- persistent human-message launcher;
- local-model download and inference capability;
- local-model health pulse and interrupted-test recovery;
- Living School workbench-first startup with persistent human chat;
- Living School pedagogy invariants;
- Lud Mode download, canonical open, and offline reload through a real Chromium browser gauntlet.

V2 adds `CAPABILITY-LOCK-001`, a P0 contract for the enforced control plane itself.

This remains a starting baseline, not a claim that every current Civweave feature already has sufficient acceptance coverage. Navigation, Settings, installer, and additional chat/generation contracts that failed the bootstrap audit must be repaired or replaced before they can be promoted. Every newly accepted feature should gain an executable capability ID rather than relying on conversational memory.

## No path filtering

Capability Lock must not use `paths:` or `paths-ignore:` filters for its authoritative gate. Cross-system regressions are precisely the class of defect this gate exists to detect. A change in one subsystem, loader, service worker, route, CSS file, build script, or shared owner may affect another capability.

## Browser evidence

Static source contracts remain useful for architectural ownership and deterministic invariants, but they are not enough on their own. Browser gauntlets belong in the accepted registry when a capability depends on rendering, navigation, installation, persistence, service workers, offline behavior, or interaction lifecycle.

## Required merge enforcement

The v1 workflow job has the stable check name `capability-lock`. The v2 authoritative job has the stable check name `capability-lock-enforced`.

For bypass-resistant enforcement, GitHub branch protection or a repository ruleset must require `capability-lock-enforced` on both `staging` and `main`, require pull requests, and require code-owner review for the Capability Lock control plane. Direct pushes and administrator bypass should be disabled or tightly restricted.

Without branch protection/rulesets, repository CI can detect an attempted regression but GitHub can still permit a direct push or privileged merge that skips the check. Server-side branch enforcement is therefore part of the complete system.

## Acceptance rule for future work

When a feature reaches an accepted state:

1. identify or add the deterministic contract that proves the accepted behavior;
2. run that contract against the accepted integration state before registering it;
3. add a new immutable capability ID to `config/accepted-capabilities.json`;
4. ensure the capability is P0 or P1 when it must survive every later change;
5. merge only after the feature-specific check and Capability Lock pass;
6. from the next change onward, the base-owned contract becomes the regression authority.

Agent prose such as “verified,” “fixed,” or “tests pass” is never the acceptance authority. The capability report is.
