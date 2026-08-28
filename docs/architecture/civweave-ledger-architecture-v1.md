# Civweave Ledger Architecture v1

## Canonical authority map

Civweave uses separate ledgers for separate kinds of truth. A Guild is a replica and routing boundary, not an owner of a member's balances or identity.

### Validation Ledger

Authority: whether a claimed accomplishment or fulfillment is sufficiently proven.

Canonical records:
- submissions / claims
- evidence references and scoped evidence artifacts
- validation packets
- signed validator receipts
- deterministic threshold receipts
- supersession/reversal references

A validation threshold receipt may authorize downstream reward or contribution events. Validation does not itself mutate reward balances or contribution ownership.

### Reward Ledger

Authority: per-Passport Skill XP, Acorns, and Buttons.

Assets:
- `skill-xp`: earn/correction/reversal only; not burnable or transferable.
- `acorn`: earn/burn/correction/reversal; never transferable.
- `button`: earn/burn/correction/reversal; never transferable.

Buttons and Acorns are not transferred between accounts. When one person fulfills another person's token, settlement creates two independent events referencing the same fulfillment: a burn on the requester's Passport and a newly issued reward on the fulfiller's Passport. No asset ownership passes from requester to fulfiller.

Canonical balance projection:

`balance(account, asset) = valid earns + corrections + reversals - valid burns`

The ledger synchronizes signed events, never naked balance totals.

### Contribution Ledger

Authority: contribution attribution and Cotoken ownership within an endeavor.

Canonical records:
- endeavor ID
- submission / proof reference
- contributor identity
- basis-point share
- effort basis
- proposed / vested / disputed / reversed status
- validation threshold reference
- signatures and provenance

Cotokens are contribution/ownership records, not spendable Buttons and not part of the Reward Ledger.

### Fulfillment Ledger

Authority: the social/economic contract connecting a request to its fulfillment.

Canonical records:
- request / token ID
- requester Passport
- fulfiller Passport
- requested outcome
- proof contract
- requested burn asset and amount
- reward asset and amount
- validation reference
- settlement status and settlement event IDs

Settlement is idempotent. A fulfillment cannot be settled twice.

### Domain ledgers

FellowFare may keep exchange / order / escrow / fulfillment records, Anarchadia may keep governance records, and Civweave may keep locality/community records. These do not become alternate authorities for Reward Ledger balances.

## Replication model

Canonical means one deterministic set of valid signed records, not one canonical server.

### Personal devices

An authorized Passport device may hold the full readable Reward Ledger for that Passport plus relevant validation and contribution records. Personal projections such as wallet totals, skill levels, Passport cards and Chronicle entries are rebuilt locally from canonical records.

For distributed writing, reward entries form issuer/device-local signed chains rather than one global sequence. Each issuer chain has its own monotonic sequence and previous-issuer hash. Replicas merge the set of valid event IDs and deterministically project balances. This allows two authorized devices to operate offline without producing an invalid global-chain fork.

Offline Button/Acorn burn authority must be bounded per device so two disconnected devices cannot both burn the same available balance. A device may display the whole known Passport balance while only being authorized to burn its currently assigned offline allowance.

### Guild replicas

A Guild is a replicated social system. Pocket Nodes, persistent local hosts, and optional public Cloudflare edges are service replicas of the Guild, not owners of member ledgers.

Guild infrastructure may hold:
- Guild governance records
- shared project Contribution Ledgers
- fulfillment / exchange records serviced by the Guild
- validation packets and receipts relevant to work being validated
- encrypted or scoped recovery/cache material where explicitly allowed

Guild membership does not grant blanket access to a member's personal Reward Ledger, raw evidence, or private history. A Guild cannot impersonate a Passport, spend a member's Buttons/Acorns, rewrite valid signed reward history, or erase contribution history when membership ends.

### Inter-Guild replication

Guilds exchange signed scoped objects, not whole databases. Another Guild receives only the claim, fulfillment, validation, settlement, governance, or project records it has a reason and audience permission to possess.

Public/federated objects may travel through the signed store-and-forward mesh under existing hop, expiry, signature, audience and conflict rules. Private/direct/group evidence remains scoped.

## Projection rule

Passport, Living School skill trees, FellowFare wallet totals, Chronicle entries, level bars and ownership percentages are projections. If a projection is deleted, it must be rebuildable from canonical ledger records. A cached total can never outrank the signed events that produce it.
