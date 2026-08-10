# Money Integration Sprint v1

## Finish line

This sprint ends at the door of live-money integration. Civweave can reserve existing Buttons or Acorns, prepare an external payment, verify settlement, finalize the internal transfer only after settlement proof exists, reconcile provider state, open disputes, and stop all money activity instantly. No live provider credentials or live-money enablement ship in this sprint.

## Completed engineering slice

- [x] Extract the Base USDC proof protocol from the contribution-gateway work.
- [x] Extract the provider-neutral hosted receipt verifier and replay registry.
- [x] Extract deterministic root/device-diverse validator committee selection.
- [x] Add a provider-neutral server money edge with an internal-ledger adapter boundary.
- [x] Reserve existing Buttons/Acorns before external payment creation.
- [x] Require certified external settlement before internal transfer finality.
- [x] Add idempotency protection for order creation.
- [x] Prevent one provider receipt from settling multiple orders.
- [x] Add cancellation before settlement and dispute handling after settlement.
- [x] Add provider reconciliation hooks.
- [x] Add an emergency stop.
- [x] Enforce zero mint authority and zero supply effect on the money boundary.
- [x] Keep live money disabled by default.
- [x] Add explicit compliance, jurisdiction, KYC/AML, tax-reporting, provider-terms, credentials, webhook-verification, refund, and reconciliation readiness gates.
- [x] Add automated protocol and lifecycle tests.

## Provider contract

A live provider adapter must expose:

- `id`
- `mode` (`sandbox` or `live`)
- `credentialsPresent`
- `webhookVerificationReady`
- `createPayment(context)`
- `verifyReceipt(receipt, context)`
- `fetchReceipt(context)` or an equivalent reconciliation hook
- `refund(context)` or an equivalent refund/chargeback hook

Provider secrets stay server-side. The edge records provider IDs, immutable payment/receipt identifiers, hashes, statuses, and audit events, not secret credentials.

## Internal ledger contract

The contribution ledger adapter must expose:

- `reserveExistingAsset(...)`
- `releaseReservation(...)`
- `finalizeReservedTransfer(...)`
- optional `flagDispute(...)`

The money edge does not expose a mint call. Any adapter result carrying a non-zero `mintEffect`, non-zero `supplyEffect`, or `mintAuthority` is rejected.

## Door-open definition

`integrationDoorReady` means the software boundaries are complete: ledger reservation/release/finality and provider payment/verification/reconciliation/refund hooks exist.

`liveReady` additionally requires all operational gates to be explicitly satisfied:

- live-money enable flag
- emergency stop clear
- live provider adapter
- provider credentials present
- webhook authenticity verification ready
- compliance approval
- jurisdiction approval
- KYC/AML readiness when required
- tax-reporting readiness when required
- provider terms approved

The repository should reach `integrationDoorReady = true` while shipping with `liveReady = false`.

## Deliberately outside this sprint

- signing a provider contract or opening a custodial account
- storing real provider secrets
- enabling real USD or USDC movement
- choosing the final regulated provider
- making legal conclusions about money-transmission, virtual-currency, tax, securities, consumer-protection, sanctions, or banking obligations
- production limits, reserve policy, pricing, treasury policy, or liquidity commitments

Those are the knobs on the actual door. The next sprint can choose a provider and wire its sandbox credentials first, then require an explicit human decision before live enablement.
