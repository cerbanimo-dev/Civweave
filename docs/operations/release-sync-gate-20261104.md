# Civweave release synchronization gate — 2026-11-04

## Purpose
Keep the five concurrent development lanes from accidentally overwriting staging or promoting an unverified build. This is an operator checklist, **not** a claim of successful deployment.

## Verified starting point (2026-11-04)
- Repository: `cerbanimo-dev/Civweave`
- Default branch: `main`
- GitHub compare `staging...main`: **diverged**, with `main` ahead by 5 commits and behind by 332 commits.
- `main` includes the Starling PvE improv director, cloud-report bridge, signed daily report implementation, and `.github/workflows/verify-starling-pve-production-v1.yml`.
- Do not assume those changes exist on `staging`. Do not force-reset, automatically merge or deploy production as a substitute for reconciliation.
- The compare result is a point-in-time observation, not a permanently current release status.

## Required preflight for each lane
1. Identify the change owner in `docs/architecture/systems-of-practice.md` and `config/system-ownership.json`.
2. Use a narrowly scoped branch from the current intended **base**. State whether the PR targets `main` or `staging`; do not infer from the default branch.
3. Before a merge, refresh both branch SHAs and inspect `staging...main`. Record **ahead/behind**, changed files, and the relevant PRs.
4. When branches have diverged, reconcile on a dedicated integration branch and run conflict review. Preserve each side's functionality and tests. **No force push or wholesale replacement.**
5. Require the existing release-discipline, source-syntax, fleet, Starling report, PvE, and runtime checks that apply to changed modules. A test file existing is not evidence a workflow ran or passed.
6. Require a real staging deployment and browser/Android/Desktop smoke test before promoting to production. Confirm exact deployed SHA, hostname, route, model backend and Guild identity.
7. Save a release record containing PR/commit links, CI conclusions, staging smoke evidence, go/no-go decision, backup/rollback route, and the person authorizing promotion.

## Staging smoke matrix
| Area | Minimum positive proof | Failure boundary |
| --- | --- | --- |
| Shell/PWA | Cold install, update, offline reopen, previously cached Guild reading | No silent deletion of cached member data |
| Local AI — Android | Verified GGUF 2B/4B import, automatic *compatible* role matching, explicit user activation | No duplicate model download, hidden remote fallback, or unverified shard activation |
| Local AI — desktop | Ollama discovery on explicit action, private endpoint policy, role persistence and local generation | Never claim a model is running from a stored preference |
| Starling PvE | Opted-in Guildkeeper starts a scene; encounter → complication → consequence; signed fiction lands in review | No simulated Quest completion, Guild vote, canon mutation or spending |
| Guild daily reports | Signed action receipt, one rolling UTC report, duplicate suppression, offline phone re-open, later peer catch-up | No unsigned off-device producer or invented usage/completion data |
| Production | Production SHA maps to the exact reviewed release and rollback is available | Do not treat a green unit test or GitHub commit as a deployed verification |

## Commands for a checked-out integration worktree
```bash
git fetch origin main staging
git rev-list --left-right --count origin/staging...origin/main
git log --oneline --left-right origin/staging...origin/main
git diff --stat origin/staging...origin/main
npm run check:release-discipline
npm run test:ai-fleet
npm run test:starling-reports
npm run test:starling-turns
npm run test:starling-worker
npm run check:runtime
```

If the repository's production PvE workflow exists on the checked-out branch, inspect its current required commands and ensure its green status applies to the **exact** release SHA. Do not assume the workflow exists on both branches.

## Integration priorities
1. Reconcile the five `main`-only commits against staging changes without dropping either side.
2. Confirm the active Starling Cloudflare Guild routing and signed producer authorization against a real paired Guild.
3. Test Android and desktop fleet attachment on actual installed models, not just mocked inventories.
4. Verify Guild reports on the Guildkeeper's phone after being offline and after reconnecting.
5. Only then propose a production promotion with explicit rollback notes.

## Five-lane coordination
Each lane should publish a short handoff containing: **branch + base SHA; paths changed; tests actually run; outstanding blockers; intended PR target**. Integration owns the final merged-release checklist, but it does not silently execute independent lanes' work or infer completion from a task claim.
