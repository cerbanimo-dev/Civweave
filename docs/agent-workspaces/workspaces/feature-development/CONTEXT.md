# Feature-development workspace

Purpose: implement an explicitly requested feature at its canonical functional owner. Scope expected behavior and storage impact before writing a failing test; preserve existing accepted capabilities and offline-first operation.

A feature may create a new owner only when no existing owner covers the behavior and the ownership registry is explicitly updated. For PWA changes, account for active callers, service workers, installer manifests, browser verification, and local data continuity.
