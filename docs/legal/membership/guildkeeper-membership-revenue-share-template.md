# Guildkeeper membership revenue-share agreement template

> Execution draft only. This template is not effective until completed, reviewed for the actual relationship and jurisdiction, and accepted by authorized parties. Do not store tax IDs, bank credentials, identity documents, or Stripe secrets in this repository.

## Parties and purpose

This agreement is between Cerbanimo LLC / Civweave (the **Platform**) and the person or entity approved to operate the applicable Civweave Guild (the **Guildkeeper**).

The Platform sells Civweave memberships to members. The Guildkeeper supports Guild capacity and related Guild services. In exchange for those services, the Platform may owe the Guildkeeper a revenue share calculated under this agreement.

## Membership seller and member obligation

The Platform, not the Guildkeeper, is the seller and merchant of record for Civweave memberships covered by this agreement unless a later written agreement expressly establishes a different transaction.

A member's payment for a covered Civweave membership is owed to the Platform. Payment accepted by the Platform or its payment processor satisfies the member's membership-payment obligation. The member does not owe the Guildkeeper a separate portion of that same membership fee merely because the member selected or uses the Guildkeeper's Guild.

The Platform remains responsible to the member for the covered membership transaction, including subscription administration and any refund, credit, cancellation, or other customer remedy owed by the Platform.

## Revenue share

For each eligible, successfully paid membership cycle associated with the Guild, the Platform will calculate the Guildkeeper revenue share from membership service net after payment-processing fees and any transaction-specific reversals required by the canonical Civweave money-edge rules.

The current economic policy allocates membership service net as follows:

- 50% system / compute reserve;
- 25% Guildkeeper revenue share; and
- 25% Cerbanimo share.

The Guildkeeper share is compensation owed by the Platform under this agreement. It is not member money held in escrow for the Guildkeeper and is not a separate payment obligation of the member.

## Settlement method

The Platform may settle an earned Guildkeeper share through Stripe Connect or another legally approved payout method. When Stripe Connect is used for a membership, the Platform may first receive the customer charge and subsequently transfer the calculated Guildkeeper share to the Guildkeeper's approved connected account.

The Platform will not use the Guildkeeper as `on_behalf_of` merchant for a covered platform membership unless the parties intentionally replace this agreement with a separately reviewed merchant structure.

Payout timing may depend on payment settlement, processor availability, fraud or dispute review, tax or identity requirements, connected-account capability status, applicable law, and other reasonable payment controls.

A delayed or failed payout does not alter the member's status solely because the Platform has not yet settled its separate obligation to the Guildkeeper. Amounts that cannot yet be lawfully paid may be held as an accounting obligation until resolved.

## Refunds, disputes, and reversals

If a membership payment is refunded, disputed, reversed, charged back, or otherwise reduced after a Guildkeeper share has been calculated or paid, the Platform may reverse, offset, or net the corresponding overpayment to the extent permitted by the final agreement and applicable law. The implementation must preserve an auditable record linking each adjustment to the underlying membership cycle.

## No custody or transfer service

This agreement does not authorize the Guildkeeper to use Civweave as a general-purpose money-transfer, remittance, escrow, or stored-value service. The Platform does not accept arbitrary member funds for forwarding to the Guildkeeper. The revenue share applies only to Platform revenue governed by the applicable Civweave economic policy.

## Classification, tax, and compliance

This template does not determine whether the Guildkeeper is an employee, independent contractor, business entity, partner, agent, or another legal classification. Classification must follow the actual relationship and applicable law.

Before live payouts, the Platform must complete the required identity, tax, payment-provider, reporting, withholding, licensing, labor, and other compliance steps for the Guildkeeper and the relevant jurisdiction.

## Term, changes, and termination

The final agreement should state its effective date, termination procedure, treatment of accrued but unpaid shares, handling of post-termination refunds or disputes, economic-policy change notice, records access, governing law, dispute process, and signatures or other valid acceptance method.

## Required completion fields

- Platform legal entity and formation jurisdiction
- Guild legal/public identifier
- Guildkeeper legal name or paying entity
- Guildkeeper jurisdiction and work location
- Effective date
- Approved payout account reference stored outside the repository
- Tax/payment classification determination stored in the appropriate private system
- Any jurisdiction-specific addendum
- Authorized acceptance by the Platform and Guildkeeper
