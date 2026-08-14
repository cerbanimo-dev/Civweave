# Civweave launch evidence

`public-launch-readiness-v1.json` is the machine-readable promotion record. The repository may continue to develop while a manual gate is `blocked`, but a public launch may not be declared until every manual gate is `pass` and its evidence field points to a durable record.

The launch-hardening branch is materialized as canonical release **1.0.134**. Generated release, service-worker, and shell-integrity assets are produced by the repository's canonical materializer rather than edited by hand.

## Canonical commands

Code readiness:

```bash
node scripts/run-launch-gate-v1.mjs
```

Fast local contract check:

```bash
node scripts/run-launch-gate-v1.mjs --quick
```

Public promotion, intentionally fail-closed:

```bash
node scripts/run-launch-gate-v1.mjs --public
```

## Manual evidence

Before changing a manual gate from `blocked` to `pass`, attach concrete evidence:

- `mainBranchProtection`: repository rules showing pull requests and the **Launch readiness** status are required before merging to `main`.
- `cloudflareWorkerProduction`: successful production Worker build/deploy for the candidate commit plus a health smoke result.
- `legalReviewAndClickwrap`: approved Terms and incorporated policies, with all draft/counsel/placeholders removed, followed by the versioned affirmative clickwrap implementation.
- `remoteRestoreDrill`: backup SHA-256, integrity manifest, clean-target restore result, and post-restore smoke test. Never test restoration against the only production copy.
- `lowEndPhysicalDeviceMatrix`: real weak-device evidence covering cold and warm startup, generation/classifier latency, peak memory, worker shutdown, fully disconnected relaunch, interrupted model download recovery, and observed battery/thermal behavior.

Do not mark physical, legal, administrative, or production evidence as passed because a static CI verifier exists. CI proves the mechanism; the evidence proves the real-world condition.
