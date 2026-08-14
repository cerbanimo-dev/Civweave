# Territory Stewardship implementation notes

## Economic invariant

The runtime never takes Territory Stewardship from a Host Node Steward, provider, contributor, or system/compute reserve. It first computes each pre-existing transaction lane exactly as before, then subdivides only `cerbanimo_share_cents` 50/50 into Cerbanimo Global and Territory Stewardship.

## Territory identifiers

Initial canonical territories:

| ID | Office | Parent |
| --- | --- | --- |
| `us` | United States, home region New York | none |
| `us-mo-kc` | Kansas City, Missouri | `us` |
| `us-ca-la` | Los Angeles, California | `us` |
| `jp` | Japan, home region Tokyo | none |

The hierarchy lets a specifically assigned local Hub use its local appointment while other U.S. Hubs can use the national `us` office. Future territories can be added without changing the percentage model.

## Runtime states

An appointment and a payout are intentionally separate facts. Initial appointments are seeded as `appointed`, while agreements remain `pending-signature` and payout remains `held-pending-onboarding`.

A Territory settlement may be:

- reserved because the Hub is not assigned a territory;
- reserved because no active office is available;
- reserved while the appointed Steward is not yet payout-ready;
- pending because Stripe platform funds are not yet transferable;
- settled;
- partially reversed or reversed after refund/dispute.

## Security boundary

`GET /api/money-edge/territories` exposes public office/territory state but never payout account identifiers.

`POST /api/money-edge/territories/node` requires the existing signed Hub money-edge identity. Checkout parameters cannot select the Territory Steward recipient.

## Activation

Do not put legal identity documents, tax identifiers, bank data, or Stripe secrets in Git. After the resolution and individual agreement are actually signed and the legally appropriate payout setup is complete, update the appointment state and payout account through a secure operational path rather than source code.
