# Commonweave v1.0.32 · Cerbanimo Quest Engine Restoration

Cerbanimo keeps its existing chat-first Cabinet Mode and regains the first major piece of its classic working machinery.

## Restored inside Cabinet Mode

- Dependency-aware quests and work units
- Real computed progress instead of a fixed active-quest percentage
- A derived next meaningful action
- Task ownership, descriptions, dependencies, and acceptance criteria
- Proof-required gates before work can enter review
- Accept, revise, reopen, submit, and final quest acceptance transitions
- Durable local receipts for every meaningful change
- Portable JSON quest bundles
- Automatic migration from:
  - approved Kamiya quest drafts
  - generic Cabinet Mode quest records
  - the classic `cerbanimo-pocket-constellary-v0.6` store
- Mirroring into the canonical Commonweave record store for cross-realm continuity

## Interface

The restored engine appears inside the current Cerbanimo cabinet dashboard and replaces generic forms when opening quest management, task acceptance, or proof submission capabilities. Cabinet artwork, chat-first navigation, feature dropdowns, and device-surface behavior remain intact.

## Offline package

The quest engine JavaScript and CSS are required device-package assets. The service-worker cache revision was rotated so the feature remains available offline after update.

## Validation

`verify-cerbanimo-quest-engine-v144.mjs` checks:

- sequential dependency blocking
- prevention of premature task starts
- proof requirements before review
- accepted task transitions
- computed progress and next-action derivation
- conversion of approved Kamiya actions into full quests
