# Civweave Charterkeeper architecture v1

> Staging implementation contract. This document describes product and settlement behavior; it is not a legal authorization for live payouts.

## Role

A **Charterkeeper** is a Guildkeeper who helps a new Guild come into existence and then yields day-to-day authority to that Guild's appointed Guildkeeper. A Charterkeeper may continue operating a separate source Guild and may charter multiple independent child Guilds.

Charterkeeping has two supported routes:

1. **Founder transfer** — the Charterkeeper prepares/creates the new Guild, trains an already-appointed Guildkeeper from the source Guild, then the child Guild accepts the handoff.
2. **Mentor direct** — the Charterkeeper nominates an existing source-Guild member, Civweave formally appoints that member as a Guildkeeper, trains them, and the new Guildkeeper creates the child Guild directly before accepting the Charter relationship from that Guild.

A Charter is a one-hop relationship between one source Guild and one child Guild. Charterkeeper revenue does not recurse through ancestors or create downstream commission chains.

## Appointment gate

A Charter nominee is not merely a text field. Civweave uses the existing Guildkeeper governance store, which already requires an appointed Guildkeeper to be an existing Guild member.

For `founder-transfer`, Charter creation is blocked unless the nominee is already an appointed Guildkeeper in the source Guild. For `mentor-direct`, the Charterkeeper console first asks the source Guild to appoint the nominee; the appointment fails if the nominee is not already a Guild member. Only after this succeeds does the source Guild sign the Charter request with `nomineeAppointmentConfirmed=true`.

The canonical money edge refuses a new Charter without that signed source-Guild appointment attestation and records the confirmation on the Charter row. This keeps appointment semantics consistent even if the UI is bypassed.

## Training and handoff

A Charter begins in `nominated` state. Before activation, the nominee must complete the required Charterkeeper curriculum:

- Guild purpose and charter;
- member safety and governance;
- capacity and costs;
- payments and compliance; and
- handoff readiness.

The source Charterkeeper Guild records completion. Completion alone does not activate revenue sharing. The proposed child Guild must exist as a separately registered Guild and sign its own acceptance with that Guild's money-edge identity. This provides a cryptographic handoff instead of treating a founder's declaration as sufficient.

Only one Charterkeeper relationship may be active for a child Guild at a time. The uniqueness constraint applies only to active Charters, so a legitimately ended Charter does not permanently prevent the child Guild from establishing a later Charterkeeper relationship. Either the source Charterkeeper Guild or the child Guild may end the Charter.

## Continued Charterkeeper eligibility

The Charter captures the operator identity of the source Guild. Future settlement verifies that the same operator still controls the source Guild. If the source Guild disappears or its operator changes, future Charterkeeper revenue stops automatically until a separately reviewed new Charter relationship is established.

This lets a Charterkeeper manage several Guilds without turning a historical founder record into a perpetual right after they stop serving as a Guildkeeper.

## Economic boundary

Charterkeeper compensation comes **only from the Cerbanimo-side amount that already exists for the transaction**. It does not increase the member price and does not reduce the system/compute reserve or the child Guildkeeper's share.

The v1 staging policy is:

- 50% of the existing Cerbanimo-side amount to the active Charterkeeper relationship;
- 50% remains on the Cerbanimo side for later Cerbanimo/Territory allocation.

This percentage is stored as policy and on the Charter so it can be changed prospectively without rewriting transaction history.

Charterkeeper allocation happens before Territory Stewardship. Territory Stewardship therefore splits only the Cerbanimo amount remaining after any active Charterkeeper allocation. If no active Charter exists, Territory Stewardship receives the same Cerbanimo-side amount it received before Charterkeepers existed.

For a membership cycle using the current 50/25/25 membership economy, an active Charter produces, after processor fees: 50% system reserve, 25% child Guildkeeper share, 12.5% Charterkeeper, and 12.5% remaining Cerbanimo-side amount. Existing Territory Stewardship may then split that final 12.5% under its own policy.

## Payout identity

The Charterkeeper payout destination is the connected account belonging to the Charterkeeper's active source Guild. Civweave does not accept an arbitrary bank or payout destination in a Charter record.

Revenue may be accounted for while agreement/onboarding gates are incomplete, but cash transfer is held until the Charter is active, the Charterkeeper agreement is accepted, and the source Guild has a usable connected payout account.

## Refunds and disputes

Charterkeeper settlements are linked to the underlying source transaction and are independently reversible. Top-up refunds/disputes and FellowFare service-fee refunds reduce the corresponding Charterkeeper entitlement proportionally. Membership refund/dispute handling should follow the same invariant when membership-level reversal support is expanded.

## Safety invariants

- the nominee must be a real appointed Guildkeeper in the source Guild before the Charter opens;
- no recursive/downline Charterkeeper commissions;
- one active Charterkeeper per child Guild;
- ended Charters do not permanently lock a child Guild;
- multiple child Guilds per source Charterkeeper Guild are allowed;
- child Guild acceptance is required before revenue participation begins;
- Charterkeeper source-Guild control is rechecked at settlement time;
- member price, system reserve and child Guildkeeper share are unchanged;
- production payout activation remains subject to legal, tax, classification, Stripe and jurisdictional review.
