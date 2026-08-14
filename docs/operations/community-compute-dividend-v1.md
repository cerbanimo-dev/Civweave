# Community Compute Dividend v1

## Purpose

A Civweave Cloudflare host community treats paid membership as infrastructure funding, not a private velvet rope. Paid residents keep the same daily community allowance as free residents, receive their own backed lifetime compute credits, and increase the shared capacity available to everyone.

The allocator must never promise compute that the host has not funded. Membership effects are therefore expressed as targets first, then capped against the shared reserve that can actually back them.

## Free-instance capacity

A free Civweave instance starts with:

- 10 community/free seats.
- A 900-neuron daily included target per resident.
- A 10,000-neuron Cloudflare free daily pool.
- A 10% burst reserve, leaving 9,000 neurons for the ten 900-neuron starter allowances.
- A hard maximum of 28 total residents.
- A hard maximum of 16 community/free residents.

The three host-node identities remain routing and locality surfaces inside one capacity account. Capacity is accounted at the instance/account level rather than pretending each host node has its own Cloudflare free-AI allocation.

## Membership contribution units

One contribution unit is $5/month of active membership service value.

Each active contribution unit adds two things to the community target:

1. **+2 potential community/free seats**, until the instance reaches 16 free residents.
2. **+200 neurons/day to every resident's community allowance target.**

The effect scales linearly with membership price:

| Membership service price | Contribution units | Potential free-seat boost | Community daily target boost |
| --- | ---: | ---: | ---: |
| $5 | 1 | +2 | +200/resident |
| $10 | 2 | +4 | +400/resident |
| $20 | 4 | +8 | +800/resident |
| $40 | 8 | +16 | +1,600/resident |

The free-seat boost still stops at 16 total community seats and the instance still stops at 28 total residents. Extra contribution units after the free-seat cap continue to strengthen the compute target.

## Funded target rule

Let:

- `U` = active membership contribution units.
- `M` = current resident count.
- `B = 900 + 200U` = per-resident community target.
- `S` = the currently funded shared daily compute ceiling from Cloudflare's free pool plus operating, endowment, and shared-top-up reserves.
- `R = 10%` = protected burst reserve.

The included pool is `floor(S × 0.90)`.

The actual included daily allowance is the smaller of:

- the target `B`, and
- `floor(included pool / M)`.

This is the large-scale safety valve. Membership can raise the target quickly, but the allocator only raises the real allowance as far as the money backing the shared pool can safely support. Any funded amount is split evenly across all current residents, free and paid alike.

Personal lifetime credits are not included in this division. They remain attached to the paying resident and are only spent when that resident explicitly allows lifetime-credit use.

## Admissions

The dynamic community-seat limit is:

`min(16, 10 + 2U)`

New admissions must also respect the 28-resident hard cap. Pending paid checkouts reserve a resident slot for a short period so a free admission cannot race a paid checkout past the maximum.

### Downgrades

A paid resident who becomes free is never ejected. Their seat becomes a community seat and their contribution units disappear from the active total. The free-seat limit and community compute target are recalculated immediately.

If that downgrade leaves the instance temporarily above its new free-seat limit, existing residents are grandfathered in place. New community admissions remain closed until membership support rises again or natural departures bring the instance back under its dynamic limit.

This preserves community continuity without allowing a cancellation to create unbacked new seats.

## Top-up sharing

Cloudflare compute top-ups have a shared component:

- 1% of service value is shared by default and is the enforced minimum.
- The purchaser may voluntarily raise the community share to 2%, 3%, 4%, or 5%.
- The purchaser may choose **Top up the node equally**. In this mode, the full system-backed compute portion of the top-up is placed in the shared node reserve instead of the purchaser's personal compute wallet.

The host and Cerbanimo portions of the existing top-up split are not reclassified as compute. Node-equal mode therefore shares the entire system compute portion, not money already designated for host compensation or Cerbanimo's service share.

Shared top-up funds enter a dedicated community top-up reserve and are amortized into the funded daily shared ceiling. Refunds and chargebacks reverse personal and shared backing proportionally to the original top-up, so the purchaser is not charged personally for compute that was originally given to the community.

## User-facing behavior

The Membership & Compute surface must explain the communal effect before checkout. Cloudflare top-ups expose the 1%-5% selector and the node-equal option. Membership tiers explain that every $5/month contributes +2 potential free seats and +200 neurons/day to the community target, subject to the instance caps and actual funded reserves.

Capacity responses expose both target and funded values so UI can distinguish aspiration from current backing:

- target included neurons/day,
- funded included neurons/day,
- target community bonus,
- funded community bonus,
- active contribution units,
- dynamic free-seat limit,
- whether funding currently caps the target,
- whether residents are grandfathered above a reduced seat limit.

## Deployment constraint

The Civweave allocator can account for paid reserve-backed overage while preserving Cloudflare's free daily allocation as the first source of compute. The deployed Worker must still be on a Cloudflare plan/capability that permits paid Workers AI overage before reserve-backed capacity above the free Cloudflare ceiling can actually be consumed. The capacity model intentionally keeps that deployment capability separate from membership accounting so a configuration mistake cannot silently create an unbounded bill.
