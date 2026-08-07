# Jules Evergreen Control Plane

The evergreen control plane turns `TEN-YEAR-PIPELINE.md` into a cautious, continuous Jules work queue that can automatically merge ordinary, fully validated bundles.

## What it does

Every five minutes, the trusted workflow on `main`:

1. reads `AGENTS.md` and the pipeline,
2. resolves legacy bundle claims such as PR #179 and the merged pipeline PR #192,
3. inspects recent Jules sessions and their pull-request outputs,
4. keeps Jules-created pull requests in draft state while work or checks continue,
5. watches GitHub checks, reviews, changed paths, roadmap integrity, and merge conflicts,
6. returns stale failure summaries to the originating Jules session,
7. marks an eligible pull request ready and automatically squash-merges it, and
8. launches the next eligible bundle on a fresh run after `main` advances.

## Required setup

1. Authorize the Google Labs Jules GitHub app for `cerbanimo-dev/Civweave`.
2. Create a Jules REST API key in Jules Settings.
3. Add it to GitHub Actions as the repository secret `JULES_API_KEY`.
4. Create a fine-grained GitHub token owned by the merge identity and add it as `EVERGREEN_GITHUB_TOKEN`.

The merge token should be restricted to this repository with **Contents: write** and **Pull requests: write**. Do not grant ruleset or branch-protection bypass. The separate token is required because merges made with the workflow's ordinary `GITHUB_TOKEN` do not reliably start the downstream push workflows needed for deployment and evergreen-branch synchronization.

The workflow is enabled whenever the Jules key exists unless `JULES_EVERGREEN_ENABLED=0`. Automatic merge defaults on and can be paused independently with `JULES_AUTOMERGE_ENABLED=0`.

Optional repository variables:

| Variable | Default | Purpose |
| --- | ---: | --- |
| `JULES_DAILY_TASK_BUDGET` | `10` | Hard rolling 24-hour launch ceiling, below the current base-plan limit of 15 tasks. |
| `JULES_MINIMUM_MINUTES_BETWEEN_LAUNCHES` | `30` | Prevents duplicate launches during API or GitHub propagation delays. |
| `JULES_FAILURE_FEEDBACK_AFTER_MINUTES` | `90` | Wait before sending a stale CI failure summary back to Jules. |
| `JULES_FAILED_RETRY_CAP` | `2` | Failed sessions allowed for one bundle in 24 hours before stopping for attention. |
| `JULES_AUTOMERGE_ENABLED` | `1` | Set to `0` for a merge freeze while monitoring and launching continue. |

Run the workflow manually with **dry run** enabled to inspect its next action without creating a Jules session, changing a pull request, or merging.

## Automatic merge gate

A Jules pull request is merged only when all of these are true:

- the originating Jules session is `COMPLETED`,
- every reported check and status has completed successfully and at least one exists,
- GitHub reports the pull request mergeable and current with `main`,
- the pull request belongs to this repository and names the selected bundle,
- no review requests changes,
- no blocking label is present,
- no sensitive control-plane, workflow, migration, database, wallet, governance, economic, or paid-service path is touched,
- `TEN-YEAR-PIPELINE.md` differs from `main` only by checking the selected bundle,
- the head SHA has not moved while the daemon prepares the merge, and
- the dedicated merge token is available.

The merge endpoint still obeys branch protection and repository rules. The daemon does not bypass branch protection. Apply `do-not-merge` at any time to disable automatic merge for a particular pull request.

## Security boundaries

- One managed Jules session and one managed pull request at a time.
- One roadmap bundle per pull request.
- `AUTO_CREATE_PR` is used; the merge is a separate, policy-gated action.
- No secret is written to the repository, logs, prompts, or pull-request comments.
- A missing API key, missing merge token, missing Jules source, quota response, active PR, active session, legacy claim, retry ceiling, or disabled variable causes a clean no-op or leaves the PR open.
- The workflow executes only trusted control code checked out from `main`; it never executes Jules pull-request code with repository secrets.
- Evergreen-control files cannot modify themselves through automatic merge.
- The `evergreen/jules-pipeline` branch is a disposable mirror of `main`, force-synchronized after every merge.

## Queue reconciliation

Older work began before bundle IDs existed. `.github/jules-evergreen.json` maps those bundles to their historical pull requests. A merged mapped PR counts as completed, an open mapped PR claims the bundle, and a closed unmerged mapped PR releases it back to the queue.

Future implementation pull requests must update their own checkbox in `TEN-YEAR-PIPELINE.md`. Any other roadmap edit blocks automatic merge.

## Current Jules API assumptions

The implementation uses the alpha REST API at `https://jules.googleapis.com/v1alpha`, API-key authentication, repository Sources, Sessions, session messages, `AUTO_CREATE_PR`, and the documented session states. Because the API is alpha, contract changes require a human-merged control-plane update.
