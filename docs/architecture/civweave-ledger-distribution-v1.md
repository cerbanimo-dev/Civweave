# Civweave ledger distribution v1

## Scope matrix

| Record family | Personal devices | Home Guild | Other Guilds |
| --- | --- | --- | --- |
| Validation claims | full owner copy | relevant scoped copy | only when validating/servicing |
| Raw evidence | authorized devices | optional encrypted/scoped | explicit audience only |
| Threshold receipts | portable proof | relevant copy | when required by downstream action |
| Reward events | full Passport event set | recovery/cache only when permitted | transaction/proof-specific only |
| Cotoken/contribution events | relevant endeavor records | project Guild replica | collaborating Guilds |
| Fulfillment records | requester/fulfiller | servicing Guild | counterparty/validator Guilds |
| Governance records | member-relevant | full Guild replica | federated decisions only |
| Locality records | opportunistic cache | regional cache | public/federated gossip |
| UI totals / Passport / Chronicle | local projection | optional projection | never authoritative |

Guilds exchange signed scoped records, not whole member databases. A Guild may preserve or route records but never receives authority to spend a member's Button/Acorn balance or rewrite canonical reward history.
