# Starling Collective daily Guild report (staging v1)

## Contract

Each Guild has one rolling **UTC-day** Markdown report (`starling-<guild>-YYYY-MM-DD.md`). It is not an AI-generated summary, a private reasoning transcript, or a substitute for the canonical Quest/evidence ledger.

- The Starling signed object mesh already carries per-persona turns and worker receipts. As they are created, the founder's open Lounge regenerates a report and publishes an incremented `civweave.starling-daily-report-file.v1` group object (ID `starling-daily-report:<guildId>:<date>`). The report is an actual signed Markdown string, not just a UI placeholder. A Pocket Node can read a replicated full file even when some underlying events have not yet arrived.
- `civweave.starling-report-event.v1` is an append-only signed action **metadata** type for cloud inference, streamed community local inference, trusted tools, or other authorized producer adapters. It records action type, status, actor, reference ID and a bounded summary. It does not copy raw prompts, credentials, model chain-of-thought, or arbitrary files. Producer adapters should write a `started` and terminal `completed`/`failed`/`blocked` record as appropriate. A completed inference means a model call ended, **not** that a Quest was completed.
- A paired local Termux / Android host journal is sampled when its trusted host connection is refreshed. The founding device signs idempotent, review-only observation records for queued/running/completed/failed/cancelled/interrupted jobs. This is an authenticated local pairing observation, not independent verification of host execution.
- The report on a reader's phone is reconstructed from valid signed Guild-scoped objects; when the latest validated founder-signed full Markdown file contains more activity than the individual receipts yet delivered, that full file is displayed. The **Save .md on this phone** button explicitly exports the report. Guild mesh storage itself is the offline in-app copy; a normal mobile PWA cannot silently write to the phone's Downloads folder.
- The report includes date, Guild ID, count of reported actions, execution/completion states, source devices, role, actions, descriptions, and references. All signed Collective statements remain unverified until their ordinary human/Quest review.

## Authorization and transport

`readDailyGuildReport` requires a trusted Guild-membership reader callback. It verifies signed Guild genesis, signature validity, Guild-group audience, record type, signer, date, and bounded fields. The founder's own signed turns and worker receipts are allowed.

An off-device cloud or community model host MUST have a trusted host/device authorization callback (`verifyProducer`) checked at write time and on receiving phones; a model output string, anonymous job ID, session preference, or public Guild name is not a credential. Remote events otherwise **fail closed**. This callback needs to be wired to a canonical host enrollment/identity grant (with revocation and authorized scopes) before remote hosted automation can publish its own reports.

The transport is the existing Civweave signed object mesh plus configured Guild Pocket peer links or explicitly attached cloud primary. There is no new cloud database, second sync engine, push-notification vendor, or AI usage budget. The group report is visible to authorized Guild replicas, so summaries must be suitable for Guild-level sharing.

## Current limits / remaining integration

1. Staging collects browser-local signed turns, opted-in browser worker receipts, and observed paired local-host states. These update when Civweave/Lounge is active and peers can synchronize.
2. `appendGuildReportAction` supplies a bounded authenticated API for cloud/remote reporters, but the current native Starling Collective hosted inference path has not been enabled. A cloud host needs enrolled signing credentials and a canonical inference settlement receipt wired into this API; no arbitrary caller is granted hosted AI access or neurons.
3. Full, out-of-app background delivery requires native mobile background sync/push or an already-authorized persistent host. PWAs may pause when closed; do not promise instant background arrival. The reader refreshes when Civweave next becomes active.
4. Daily rollover uses UTC, matching the existing Guild worker's UTC daily cap. Guild-specific timezone support can be added with an explicit stored Guild preference and server-verified rollover.
5. A deployment and on-device offline/online integration test remain necessary; unit tests cover signature/reader denial, remote producer fail-closed, local aggregation, signed file revision, and deduplication.

## Verification

Run `node --check public/app/shared/starling-daily-report-v1.mjs` and `node --test scripts/test-starling-daily-report-v1.mjs`. These are also included in `starling-native-contract.yml`.
