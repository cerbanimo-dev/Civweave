# Fellowfare → Commonweave Bridge

Fellowfare v0.3.0 exports `commonweave.exchange-bundle` version `1.0.0`.
The bundle is deliberately domain-oriented rather than UI-oriented, so Commonweave can ingest the market without importing Fellowfare's screens or local storage implementation.

## Mapping

| Fellowfare | Commonweave destination | Meaning |
|---|---|---|
| Exchange thread | `market.intent` | Need, offer, or collective demand signal |
| Proposal | `market.proposal` | Reviewable offer of contribution and terms |
| Assembly | `coordination.party` | Multi-person composition of labor, goods, money, access, or care |
| Agreement | `work.contract` | Human-confirmed arrangement created from an accepted proposal |
| Milestone | `work.unit` | Executable portion of an agreement |
| Evidence | `proof.item` | Locally retained note, link, receipt, or photo reference |
| Settlement | `value.settlement` | Record of cash, barter, gift, credit, loan, or waived compensation |
| Review | `trust.attestation` | Context-specific account of communication, reliability, quality, and repair response |

## Suggested Commonweave import behavior

1. Preserve every Fellowfare ID as an external ID and mint a Commonweave canonical ID separately.
2. Treat participant confirmation timestamps as consent evidence, never as account authentication.
3. Convert active agreements into Cerbanimo quests only after the importing user chooses to do so.
4. Convert milestones into work units without changing their completion state.
5. Preserve evidence as references unless the referenced files are explicitly transferred.
6. Route recurring agreements into a recurrence adapter rather than duplicating them immediately.
7. Keep settlement records informational. Fellowfare v0.3.0 does not process or custody money.
8. Import reviews as scoped attestations, not a global user score.
9. Offer repeated market gaps to Living School or Anarchadia only after aggregation and privacy review.

## Event semantics

The `events` array is append-oriented and can be replayed or deduplicated by event ID. Important event types include:

- `agreement.created`
- `agreement.confirmed`
- `milestone.added`
- `milestone.completed`
- `milestone.reopened`
- `evidence.attached`
- `settlement.recorded`
- `repair.opened`
- `repair.resolved`
- `recurrence.enabled`
- `recurrence.advanced`
- `trust.attested`

## Boundary

The bridge contains no AI API key. It does not imply legal enforceability, payment authorization, identity verification, or consent from anyone beyond the records explicitly present in the source bundle.
