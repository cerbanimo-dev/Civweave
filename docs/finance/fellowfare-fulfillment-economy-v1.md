# FellowFare fulfillment economy v1

Status: canonical marketplace economy contract.

## Purpose

FellowFare separates community fulfillment from conventional payment processing.

Acorns (`🌰`) and Buttons (`🔘`) are participation resources. They are **not peer-to-peer payment instruments** inside FellowFare. Users earn them from the platform, fulfill them to access eligible services/learning, and the fulfilled units are burned. The provider does not receive the requester's spent units.

Physical/community goods use a separate seller-direct rail. FellowFare may host the listing, reputation, discovery, communication, and arrangement record, but it does not collect, route, split, escrow, or settle the seller's payment.

## Canonical rules

### Acorns and Buttons

- Acorns and Buttons are never purchased from FellowFare for USD.
- FellowFare does not publish a USD exchange rate for either resource.
- Acorns and Buttons are not transferred user-to-user as settlement.
- Eligible services, tutoring, and learning can specify a fulfillment amount in Acorns and/or Buttons.
- Completing fulfillment creates a negative canonical-ledger entry for the requester with `operation=fulfillment-burn`.
- The entry explicitly records `nonTransferable=true` and `recipientCredited=false`.
- Providers gain contribution evidence from completed work; platform rewards are issued independently from another user's burn.

### Physical/community goods

Kinds currently treated as goods are `product` and `resource`.

- Goods cannot have an Acorn or Button price.
- FellowFare does not run a seller checkout.
- FellowFare does not collect a USD purchase amount.
- FellowFare does not create a destination charge or separate seller transfer.
- FellowFare does not escrow or split the seller's proceeds.
- A seller may describe their own price, accepted private payment methods, and pickup/payment instructions.
- Payment occurs directly between buyer and seller outside FellowFare's settlement system.
- Gift/free listings remain allowed.

Legacy listing records carrying `usdMinor`, token prices, or `commerce` metadata are sanitized when the current marketplace loads. For goods, an old displayable USD amount may be preserved only as seller-facing price text while the platform settlement fields are zeroed and commerce metadata is removed.

### Services, tutoring, and learning

Kinds currently eligible for fulfillment settlement are `service`, `learning`, and `tutoring`.

- USD marketplace checkout is disabled for these kinds.
- Acorn/Button fulfillment is allowed.
- The requester burns the listed fulfillment amount when completing an eligible arrangement.
- The provider receives no direct transfer of those burned units.
- Completion becomes contribution/activity evidence that can satisfy fixed platform-reward quests.
- Learning completion can be observed from canonical learning XP receipts or explicit completion events.

This makes the economy:

```text
participation -> platform reward -> user balance
user balance -> fulfillment -> burn
provider contribution -> platform reward eligibility
```

It is deliberately not:

```text
buyer token -> seller token
buyer USD -> FellowFare -> seller payout
```

## Daily quests

Each local day selects three quests, one from each bucket:

1. personal progress;
2. fulfillment;
3. community participation.

The current fixed reward for an ordinary completed daily quest is **5 units** of the quest's designated resource.

Current quest pool includes:

### Personal progress

- Finish a learning module -> `+5 🌰`
- Finish a Cerbanimo quest -> `+5 🔘`
- Help someone finish a learning activity -> `+5 🌰`

### Fulfillment

- Fulfill `20 🌰` -> `+5 🌰`
- Fulfill `20 🔘` -> `+5 🔘`
- Complete a service arrangement -> `+5 🔘`

### Community participation

- Post a need -> `+5 🌰`
- Post an offering -> `+5 🔘`
- Respond to a community need -> `+5 🔘`
- Validate a contribution -> `+5 🔘`
- Contribute a useful project resource -> `+5 🌰`

The bucket rule prevents a daily set made entirely of spending tasks and ensures a progress/community path remains available to a user without an existing token balance.

Daily quest rewards are platform issuance. They are not transfers from the person on the other side of an arrangement.

## Fulfillment milestones

Fulfillment is tracked independently for Acorns and Buttons.

For every cumulative **100 units fulfilled**, the platform issues a **10-unit bonus of the same resource**:

```text
100 fulfilled -> +10
200 fulfilled -> +10
300 fulfilled -> +10
...
```

A daily fulfillment quest and a lifetime milestone may both complete from the same legitimate fulfillment event. They reward different behavior: current participation and long-term circulation.

Only completed fulfillment counts. Attempts, cancelled arrangements, duplicate activity IDs, and direct transfers do not advance the fulfillment totals.

## Stripe/payment boundary

The public Cloudflare route `/api/money-edge/commerce/*` is retired and returns `410 marketplace-checkout-disabled`.

The browser compatibility API for old Cerbanimo marketplace distribution also fails closed for:

- marketplace sale distribution;
- marketplace Stripe transfer instructions;
- marketplace `recordSale`.

Legacy Stripe webhook settlement/refund/dispute handlers remain available only to safely finish or unwind a payment that was created before this boundary was introduced. No public production route may create a new marketplace Checkout Session.

Stripe remains available for **non-marketplace** money rails such as:

- node compute top-ups;
- memberships;
- Host Steward earnings tied to those platform services;
- the December 1 compute-reserve distribution.

The annual compute-reserve payout is deliberately preserved and is not a FellowFare seller-payment rail.

## Compatibility invariants

Future changes must preserve all of these unless this contract is deliberately superseded:

- goods are seller-direct;
- goods have no Acorn/Button price;
- FellowFare does not collect or route seller payment;
- services/learning/tutoring use fulfillment burn rather than recipient token transfer;
- no USD/Acorn/Button exchange rate is required;
- each day has exactly three quest buckets;
- ordinary quest rewards are fixed;
- every 100 fulfilled produces the configured same-asset milestone bonus;
- legacy marketplace payment creation remains fail-closed;
- legacy payment unwind and unrelated platform-reserve payout systems remain recoverable.
