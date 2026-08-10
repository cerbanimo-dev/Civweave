# Civweave v1.0.28 — Parity Ledger Foundation

This release establishes one canonical campus structure for both the illustrated world and the lightweight interface.

## Added

- A machine-readable parity ledger with 5 systems, 59 rooms, and 117 capabilities, stored losslessly in compressed source form and served as normal JSON.
- Canonical capability IDs, consent classes, handoffs, reward behavior, source references, and renderer mappings.
- Civweave Lite at `/lite/`, organized by the same systems and rooms as Visual Civweave.
- A room-driven Visual realm shell that reads its scenes and capabilities from the parity ledger.
- Working-source bridges at `/lite/source/<system>/` so mature service features remain reachable while they are migrated.
- Ledger validation and host smoke tests.

## Architecture

The current service applications are implementation sources, not separate information architectures. Visual and Lite now resolve the same canonical room and capability records. Future work can replace each source bridge with a shared adapter without changing either renderer's navigation.

## Consent

Capabilities are classified as `automatic`, `review`, or `explicit`. Drafting and interpretation may happen automatically or for review; publishing, acceptance, transfer, spending, submission, sealing, and governance effects remain explicit.

## Validation

Run:

```bash
npm run check
```

This validates JavaScript syntax, every ledger mapping and visual asset path, Visual and Lite host routes, all four source bridges, and the v1.0.28 boot log.
