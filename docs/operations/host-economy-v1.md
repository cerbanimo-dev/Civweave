# Civweave adaptive host economy v1

This contract keeps host residency, billing status, compute funding, Host Node Steward compensation, Territory Stewardship, and platform economics separate.

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

## Hub login and discovery

- The Downloads screen is the canonical Hub admission surface and keeps Hub status directly below the first install module.
- A new public Join action may claim only an open community seat. The browser creates a per-Hub resident id plus a high-entropy device credential; the capacity authority stores only a domain-separated hash of that credential.
- Successful admission issues a signed, expiring capacity session using the node fabric's dedicated session secret. The bearer token remains tab-scoped in `sessionStorage`; the reusable device credential remains local and is never published in Hub events.
- Cloudflare generation and validation remain fail-closed without that capacity session.
- Nearest-Hub discovery uses the steward-published three-decimal location already present in node manifests. Device coordinates are rounded to three decimals before a bounded search request and are neither stored nor returned.
- Discovery may filter for free, paid-expansion, or either kind of open slot. A visible paid-expansion slot is not permission to bypass membership settlement; new public admission remains community-only until active payment authority exists.

## Territory Stewardship invariant

The Host Node Steward cut is protected. Territory Stewardship is funded only by subdividing the cash share that previously accrued entirely to Cerbanimo:

- 50% of the existing Cerbanimo share remains **Cerbanimo Global**;
- 50% of the existing Cerbanimo share becomes the **Territory Stewardship Share**.

No provider, seller, contributor, Host Node Steward, or compute/system reserve share is reduced by this second-stage split. An unassigned, vacant, unsigned, or not-yet-onboarded Territory Steward share is held for the Territory rather than reverting to Cerbanimo Global.

See `docs/finance/territory-stewardship-economy-v1.md` for the canonical routing and succession contract.

## Monthly memberships

Monthly membership service value is split after payment processing:

- 50% system and compute reserve
- 25% Host Node Steward
- 12.5% Cerbanimo Global
- 12.5% Territory Stewardship

This preserves the prior 50% system / 25% host / 25% Cerbanimo first-stage economics. Only the previous Cerbanimo 25% receives the new 50/50 second-stage allocation.

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
- 25% Host Node Steward
- 2.5% Cerbanimo Global
- 2.5% Territory Stewardship

This preserves the prior 70% system / 25% host / 5% Cerbanimo first-stage economics. Customer charges remain on the Civweave platform. The Host Node Steward's 25% earned share is transferred exactly as before; Territory Stewardship is carved solely from the former Cerbanimo 5%.

The compute backing stays in the platform balance until the corresponding compute is consumed. Refunds and chargebacks reverse the proportional Host Node Steward share, Territory Stewardship entitlement, and corresponding lifetime compute liability. Already-spent refunded compute becomes wallet debt rather than an unbacked credit balance.

## Territory routing

Each registered Hub may bind itself, using its existing signed money-edge identity, to a canonical territory. The most-specific active appointed territory wins; an active parent territory is the fallback. Buyer or seller checkout input cannot select the Territory Steward recipient.

If no territory has been assigned or the office cannot yet receive money, its calculated share remains held in a Territory Operations Reserve until a lawful payout destination exists.

## Cloud validation

When a suitable local model exists, validation can remain local. When no suitable local model exists:

- an open validation packet may appear as a Validate or Ignore quick action;
- the action shows its coin bounty and estimated compute cost;
- cloud validation requires an authenticated member capacity session;
- compute is reserved before inference and actual usage is settled afterward;
- lifetime credits are not used unless the user explicitly allows them;
- the resulting validation receipt is signed with the user's Civweave identity and enters the existing validation and reward system.

The initial cloud validator uses Cloudflare Workers AI only as an evidence/rubric evaluator. The deterministic reward engine remains responsible for accepting or rejecting the signed validation receipt and issuing any validator bounty.
