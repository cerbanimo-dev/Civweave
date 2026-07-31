# Fellowfare v0.3.0 · Exchange Ledger

Version three closes the gap between arranging an exchange and responsibly completing one.

## Added

- Accepted proposals now create portable agreements.
- Human confirmation state remains visible per participant.
- Agreement milestones support ownership, due dates, completion, and reopening.
- Evidence custody supports notes, links, receipt references, and photo references.
- Settlement records distinguish fulfillment from cash, barter, gift, credit, loan, or waived compensation.
- Repair requests preserve a path to remedy before reputation penalties.
- Settled exchanges can create contextual trust attestations.
- Recurring agreements reopen as new fulfillment cycles while retaining prior evidence.
- Exchange Desk combines active agreements, due work, settlement readiness, and conversation.
- Fellowfare agreement packs can be shared independently.
- Full market backups now include agreements and ledger events.
- `commonweave.exchange-bundle` export provides a versioned integration boundary.
- JSON Schema and bridge mapping documentation are included.
- Existing v0.2 local data migrates automatically to the v0.3 storage model.

## Safety boundaries

- Fellowfare records settlement but does not process money.
- One participant cannot silently confirm another participant.
- Evidence remains local unless the user exports a pack.
- Repair history and contextual reviews remain tied to the exchange that produced them.
- AI suggestions cannot alter the ledger without a human action.
- Model API keys are removed from Fellowfare and Commonweave exports.

## Validation

The release passes static PWA checks, deterministic AI tests, complete agreement-lifecycle tests, route and click-flow rendering tests, model-bridge tests, schema parsing, and source syntax checks.
