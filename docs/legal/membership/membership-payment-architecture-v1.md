# Civweave membership payment architecture v1

> Execution draft for product, engineering, accounting, and counsel review. This file describes the intended transaction structure; it is not a legal opinion, signed agreement, or authorization to enable production money movement.

## Transaction identity

A paid Civweave membership is sold by Cerbanimo LLC / Civweave as one platform membership. The member's payment obligation for the membership is to Civweave, and payment to Civweave through its payment processor satisfies that membership-payment obligation.

A Guildkeeper is not the merchant of record for a Civweave membership merely because the member selected that Guild. Civweave remains responsible for the membership transaction, including the customer-facing charge, subscription lifecycle, refunds or credits owed by Civweave, and delivery of the purchased membership rights.

## Guildkeeper revenue share

A Guildkeeper may earn a contractual revenue share from Civweave for providing Guild capacity and related Guild services. That obligation runs from Civweave to the Guildkeeper under the applicable Guildkeeper agreement. It is not a debt owed by the member to the Guildkeeper and is not presented to the member as money that Civweave is merely transmitting on the Guildkeeper's behalf.

For the current membership economy, processor fees are determined first. The remaining membership service net is allocated:

- 50% to the system / compute reserve;
- 25% as the Guildkeeper revenue share; and
- 25% as the Cerbanimo share.

Rounding and minimum compute-backing rules are applied by the canonical money-edge implementation.

## Stripe implementation invariant

Membership checkout must remain a platform-owned Stripe Checkout subscription. The membership charge must not set `on_behalf_of` to the Guildkeeper and must not make the connected Guildkeeper account the merchant of record.

After a paid invoice is verified and Stripe's actual processing fee is known, Civweave may create a separate Stripe Connect transfer from the platform charge to the eligible Guildkeeper connected account for the contractual revenue-share amount. The transfer is a settlement of Civweave's separate obligation to the Guildkeeper.

A delayed, failed, suspended, reversed, or otherwise unavailable Guildkeeper payout does not by itself invalidate a member's paid membership. Any unpaid Guildkeeper amount must remain an obligation or accounting hold of Civweave until it is lawfully settled, reversed, or otherwise resolved under the applicable agreement.

## Customer-facing language

Checkout and membership UI should describe Civweave/Cerbanimo as the seller of the membership. It may explain that the selected Guildkeeper receives a share of Civweave membership revenue, but it must not describe the member as paying a separately owed Guildkeeper amount through Civweave.

Receipts, subscription records, refund handling, support language, and accounting records should tell the same transaction story.

## Credits

Membership compute credits are service entitlements inside Civweave. They must not be represented as cash, a deposit account, an escrow balance, or a claim redeemable for fiat currency. Any later proposal to make them transferable, withdrawable, or redeemable requires a separate legal and payments review before implementation.

## Initial launch scope

The initial legal review for this structure is scoped to California, Missouri, Kansas, and New York. Production enablement remains subject to current counsel/accounting review of the actual contracts, recurring-subscription rules, tax treatment, worker/payment classification, Stripe requirements, and any other applicable obligations.

Staging must use Stripe test mode only and must be isolated from production Cloudflare workers, databases, webhooks, connected accounts, and live Stripe credentials.

## Engineering guardrails

The implementation should fail closed if any staging deployment receives a live Stripe key, targets the production money-edge worker or database, or reports itself as live-ready. Membership settlement should be webhook-driven and idempotent. Production money activation continues to require the existing explicit human compliance gates.
