# Scheduled Rebase Protocol

A rebase cycle is a planning and architecture maintenance pull request. It is not a feature bundle wearing a fake moustache.

Read this file whenever the selected bundle has `kind: rebase`.

## Scheduled triggers

The epoch schedules one rebase during Q2 of each year from 2027 through 2036. An emergency rebase may be inserted earlier when any of these occur:

- the active dispatcher or manifest changes enough to invalidate the next bundle,
- the pipeline branch falls materially behind `main`,
- a security incident changes trust boundaries,
- a browser, runtime, provider, protocol, or platform dependency reaches end of life,
- a major convergence or replatform decision lands,
- three consecutive bundles are blocked by the same false assumption,
- current screenshots and feedback contradict the planned user flow,
- an open pull request already implements or invalidates a future bundle.

## Required outputs

A rebase pull request must update:

- `TEN-YEAR-PIPELINE.md`,
- any compatibility dates or required-reading paths that changed.

It must append a rebase record containing the old imprint, new imprint, changed cycles, retired bundles, and evidence summary.

## Procedure

### 1. Freeze selection

Do not launch a new delivery bundle in the same lane. Clear or resolve stale claims. Existing implementation pull requests may continue only when their owner and compatibility assumptions remain valid.

### 2. Re-imprint `main`

Record:

- branch and commit,
- visible release,
- current dispatcher and active realm entries,
- application manifest,
- canonical storage writers and migration readers,
- service-worker import graph and package manifests,
- local and gateway server entrypoints,
- supported browsers and device profiles,
- repository checks and failing workflows,
- runtime inventory and duplicate-owner metrics,
- open and recently merged pull requests and issues,
- dependency and API end-of-life notices.

### 3. Gather product evidence

Review redacted feedback packets, incidents, health-check failures, accessibility findings, storage and boot measurements, and fresh screenshots of:

1. installer and recovery,
2. Civweave wish-to-plan flow,
3. Living School learning loop,
4. Cerbanimo plan-to-work loop,
5. FellowFare need/offer loop,
6. Anarchadia passport and governance loop,
7. offline restart,
8. missing-model and missing-gateway states.

A screenshot is evidence of one state, not proof of the underlying behavior.

### 4. Reconcile the queue

For every unfinished bundle, choose exactly one status:

- **retain**: still valid as written,
- **rewrite**: goal remains but assumptions changed,
- **split**: too large for one reviewable pull request,
- **merge**: duplicates another future bundle,
- **retire-completed-elsewhere**: current main already satisfies it,
- **retire-obsolete**: product direction or platform evidence invalidated it,
- **block**: external dependency or unresolved decision prevents safe work.

Retirement must include a reason and replacement when applicable. Never renumber completed bundle IDs.

### 5. Rebuild the horizon

- Detail the next four quarters to implementation depth.
- Keep years two and three at feature-bundle depth.
- Keep later years directional, with compatibility and preservation obligations.
- Preserve the 2036 renewal gate unless the epoch itself is formally replaced.
- Move speculative technology behind evidence gates.

### 6. Rebase cleanly

Rebase the planning branch onto current `main`. Resolve conflicts by tracing current ownership, not by mechanically keeping both sides. The rebase pull request must not include production feature changes.

### 7. Verify

Verify the Markdown checklist, every named repository path, and the current repository checks. When convergence tooling exists on `main`, regenerate its inventory and run its guardrails.

## Exit gates

A rebase is complete when:

- the imprint matches executable main,
- the next bundle is concrete and unblocked,
- open work is not duplicated,
- compatibility expiries are current,
- data-preservation obligations are explicit,
- stale assumptions are recorded rather than hidden,
- repository verification passes,
- a human approves activation of the revised queue.

Agents may prepare this pull request. They may not merge it.
