# FellowFare fulfillment economy

Status: canonical marketplace economy contract. Current runtime revision: v2.

## Purpose

FellowFare deliberately separates three economic rails:

1. Acorn (`🌰`) and Button (`🔘`) fulfillment for services, learning, tutoring, and community participation.
2. Provider-owned Stripe direct charges for optional USD service, learning, and tutoring sales.
3. Seller-direct private payment for physical/community goods.

These rails must not collapse back into the retired model where FellowFare receives a buyer's gross purchase and later transfers a seller payout.

## Acorns and Buttons

Acorns and Buttons are participation resources, not peer-to-peer settlement instruments.

- They are never purchased from FellowFare for USD.
- FellowFare publishes no required USD exchange rate for them.
- They are not transferred user-to-user as settlement.
- Eligible services, tutoring, and learning may specify an Acorn and/or Button fulfillment amount.
- Fulfillment creates a negative canonical-ledger entry with `operation=fulfillment-burn`, `nonTransferable=true`, and `recipientCredited=false`.
- The provider gains contribution evidence from completed work, but does not receive the requester's burned units.
- Platform rewards are issued independently from another user's fulfillment.

## Physical/community goods

Kinds treated as goods are `product` and `resource`.

- Goods cannot have an Acorn or Button price.
- FellowFare does not run a goods seller checkout.
- FellowFare does not collect, route, split, escrow, or settle the purchase price.
- FellowFare does not take a percentage of the goods sale.
- A seller may state their own price, accepted private payment methods, and pickup/payment instructions.
- Payment occurs directly between buyer and seller outside FellowFare settlement.
- Gift/free listings remain allowed.

Legacy goods records carrying USD/token settlement fields are sanitized. A displayable old USD amount may survive only as seller-facing text, while platform settlement fields are zeroed.

## Services, tutoring, and learning

Kinds eligible for these rails are `service`, `learning`, and `tutoring`.

A provider may offer **Acorn/Button fulfillment, USD, or both**.

### Token fulfillment

```text
requester balance -> fulfillment burn
provider contribution -> platform reward eligibility
```

The requester burns the listed units. The provider receives no transfer of those units.

### USD direct commerce

USD service/learning/tutoring sales use Stripe Connect **direct charges**:

```text
buyer -> provider's connected Stripe account
             |
             +-> FellowFare application fee
```

Canonical properties:

- The connected provider is merchant of record for the charge.
- The provider uses an Accounts v2 merchant configuration with card-payments capability.
- The Checkout Session and Price live on the connected provider account.
- FellowFare receives an `application_fee_amount` from the direct charge.
- The default FellowFare fee is **1% / 100 bps**, configurable by `CIVWEAVE_FELLOWFARE_SERVICE_FEE_BPS`.
- FellowFare does not receive the provider's gross sale and then transfer proceeds.
- No destination charge or separate seller transfer is used for this rail.
- The server retrieves the connected-account Stripe Price and verifies its FellowFare listing metadata before checkout. Buyer-supplied amounts are not trusted.

The production API is `/api/fellowfare/direct-commerce/*`.

## Daily quests

Each local day selects exactly three quests, one from each bucket: personal progress, fulfillment, and community participation. The current ordinary quest reward is **5 units** of the designated resource.

Current pool includes:

- Finish a learning module -> `+5 🌰`
- Finish a Cerbanimo quest -> `+5 🔘`
- Help someone finish a learning activity -> `+5 🌰`
- Fulfill `20 🌰` -> `+5 🌰`
- Fulfill `20 🔘` -> `+5 🔘`
- Complete a service arrangement -> `+5 🔘`
- Post a need -> `+5 🌰`
- Post an offering -> `+5 🔘`
- Respond to a community need -> `+5 🔘`
- Validate a contribution -> `+5 🔘`
- Contribute a useful project resource -> `+5 🌰`

The bucket rule guarantees that daily participation is not composed entirely of spending tasks.

## Fulfillment milestones

Fulfillment is tracked independently for Acorns and Buttons. Every cumulative **100 units fulfilled** issues a **10-unit bonus of the same resource**:

```text
100 -> +10
200 -> +10
300 -> +10
...
```

Daily fulfillment quests and lifetime milestones may stack. Attempts, cancelled arrangements, duplicates, and direct transfers do not advance fulfillment totals.

## Retired marketplace machinery

The old platform-charge/separate-transfer route `/api/money-edge/commerce/*` remains retired and returns `410 marketplace-checkout-disabled`.

The old browser commerce-distribution compatibility API fails closed for new sale distribution, Stripe seller-transfer instructions, and `recordSale`. Legacy webhook settlement/refund/dispute code remains only to safely finish or unwind payments created under the old architecture.

The former cross-node commerce host fee remains retired.

Stripe remains separately available for compute top-ups, memberships, Host Steward/platform earnings, and the December 1 compute-reserve distribution.

## Compatibility invariants

Future changes must preserve these unless this contract is deliberately superseded:

- goods remain seller-direct with no Acorn/Button price and no FellowFare percentage of the goods sale;
- services/learning/tutoring may use fulfillment, provider-owned Stripe direct charges, or both;
- burned tokens never become a recipient token transfer;
- USD service charges belong to the connected provider and FellowFare receives only its application fee;
- FellowFare does not collect service gross and route seller proceeds;
- no destination charge or separate seller transfer is used for new FellowFare service commerce;
- each day has exactly three quest buckets and fixed ordinary rewards;
- every 100 fulfilled produces the configured same-asset milestone bonus;
- the old platform-charge marketplace route remains fail-closed;
- legacy payment unwind and unrelated platform-reserve payout systems remain recoverable.
