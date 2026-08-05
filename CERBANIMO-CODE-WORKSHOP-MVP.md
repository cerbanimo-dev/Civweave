# Cerbanimo Code Workshop MVP

This MVP adds a mobile-first codebase workshop to the Cerbanimo quest console. It is designed for the installed PWA and ordinary mobile browsers, including Android devices controlling work from Cerbanimo without requiring a local desktop interface.

## Three-pass flow

### Pass 1: Connect and survey

- The user enters a GitHub `owner/repository`, base branch, and fine-grained token.
- The token is held in `sessionStorage` only and is removed when the session is cleared.
- The workshop maps the repository tree, records the language mix, and loads a bounded set of text manifests and task-relevant files.

### Pass 2: Quest to code and review

- The user chooses an existing Cerbanimo quest work unit.
- The workshop retrieves a bounded repository context packet and sends it through the configured Commonweave Agentic model.
- Antigravity returns a structured proposal containing complete text-file upserts or deletions, verification commands, risks, and assumptions.
- Every proposed file can be expanded and reviewed on mobile.
- Individual files can be excluded from the pull request without discarding the whole proposal.
- Proposed deletions are checked against the surveyed repository tree.

### Pass 3: Guard and deliver

- Protected paths block staging by default.
- GitHub write permission is checked before delivery.
- Included changes are written as one Git tree and one commit on an isolated `agent/cerbanimo-*` branch.
- A draft pull request is opened. The MVP never creates a ready or automatically merged pull request.
- The PR URL and commit SHA are attached to the Cerbanimo work unit as proof.

## MVP authentication

This version uses a user-supplied fine-grained GitHub token because it can operate without a Commonweave-hosted OAuth service. The token is not stored in `localStorage`.

A production pass should replace this with a GitHub App installation flow and short-lived installation tokens.

Recommended token access for the selected repository:

- Contents: read and write
- Pull requests: read and write
- Metadata: read

## Agent configuration

The workshop uses the Agentic profile from Commonweave AI settings. When that profile is configured for Antigravity, the existing Commonweave model runtime launches the background Antigravity interaction. Repository context is bounded before it leaves the device.

## Safety boundaries

The default protected prefixes are:

- `.github/`
- `infra/`
- `infrastructure/`
- `src/auth/`
- `src/billing/`
- `migrations/`

The user can edit the list, but the workshop never bypasses an active block silently. Invalid paths, protected paths, and deletions whose targets were not found in the survey cannot be staged while included.

## Current MVP boundary

The workshop surveys, drafts, reviews, branches, commits, opens a draft PR, and records evidence. It does not yet execute the proposed verification commands or stream a live development container. Those belong in the next runner/companion layer.

## Verification

```bash
node --check public/app/cerbanimo-code-workshop-v204.js
node --check public/app/cerbanimo-code-workshop-hardening-v205.js
node scripts/verify-cerbanimo-code-workshop-v205.mjs
```

Then open Cerbanimo Cabinet Mode, enter the Quest Command surface, and choose **Code Workshop**.
