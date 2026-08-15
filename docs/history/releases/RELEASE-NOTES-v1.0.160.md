# Civweave 1.0.160

## Release coherence repair

Civweave 1.0.160 completes the release materialization that was incomplete in 1.0.159. The release synchronizes the committed installer, Working Campus, route, navigation, service-worker, offline-package, and shell-integrity metadata with the current version and canonical server tree.

Canonical release SHA256 metadata is now refreshed after canonical server synchronization, and the normal release check path regenerates verified shell metadata before release-discipline validation. This prevents CI from mutating canonical release files and then comparing them against stale hashes.

## AI routing

This release includes the MiniLM response-tier router introduced immediately before the coherence repair. MiniLM classifies response budget and task type, deterministic policy selects the installed model tier, and programming or agentic requests route through the Smart tier with high-tier review when configured.

## Validation

The release materialization passes version policy, release version synchronization, canonical launch release validation, release contract validation, PWA cold-launch recovery, and canonical hash synchronization checks.
