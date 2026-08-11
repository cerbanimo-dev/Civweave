# Civweave adaptive host economy v1

This contract keeps host residency, billing status, compute funding, and payout economics separate.

## Starter Cloudflare account

- Up to three host nodes per Cloudflare account.
- Up to six community residents per host, eighteen total.
- Community residency is not a billing status. A community resident may become paid without consuming a paid-expansion seat.
- Up to nine paid-expansion residents are available on the Cloudflare Free configuration.
- Workers AI daily capacity is hard-capped at the account's 10,000 free neurons until funded overage exists.
- Upgrading the Workers account alone does not expand the free neuron pool or permanent community population.

## Adaptive paid capacity

A paid Workers plan only opens the overage pipe. Additional daily service and permanent community seats are unlocked from actual reserve funding.

- Daily included compute breathes with total funded capacity and resident count.
- Ten percent of funded daily capacity remains a shared burst reserve.
- The minimum survival service floor is 25 neurons per resident per day.
- Permanent community seats beyond the starter eighteen require 180 days of survival-floor backing in the community endowment.
- Revenue loss freezes growth and reduces included throughput before residency is removed.
- Paid-expansion residents whose membership ends enter grace rather than being abruptly deleted.

## Monthly memberships

Monthly membership service value is split after payment processing:

- 50% system and compute reserve
- 25% host operator
- 25% Cerbanimo LLC

Each tier adds non-expiring lifetime compute credits every paid month:

| Tier | Monthly service value | Lifetime compute added |
| --- | ---: | ---: |
| Member | $5 | 100,000 neurons |
| Maker | $10 | 250,000 neurons |
| Builder | $20 | 600,000 neurons |
| Steward | $40 | 1,500,000 neurons |

The lifetime-credit grant is checked against the system share at the configured neuron backing price before settlement. Residual system share is divided between current operations and the community endowment.

## Compute top-ups

Top-up service value is split after payment processing:

- 70% lifetime compute backing
- 25% host operator
- 5% Cerbanimo LLC

Customer charges remain on the Civweave platform. Only the host's earned share is transferred to the host's connected Stripe account. The compute backing stays in the platform balance until the corresponding compute is consumed.

Refunds and chargebacks reverse the proportional host share and remove the corresponding lifetime compute liability. Already-spent refunded compute becomes wallet debt rather than an unbacked credit balance.

## Cloud validation

When a suitable local model exists, validation can remain local. When no suitable local model exists:

- an open validation packet may appear as a Validate or Ignore quick action;
- the action shows its coin bounty and estimated compute cost;
- cloud validation requires an authenticated member capacity session;
- compute is reserved before inference and actual usage is settled afterward;
- lifetime credits are not used unless the user explicitly allows them;
- the resulting validation receipt is signed with the user's Civweave identity and enters the existing validation and reward system.

The initial cloud validator uses Cloudflare Workers AI only as an evidence/rubric evaluator. The deterministic reward engine remains responsible for accepting or rejecting the signed validation receipt and issuing any validator bounty.
