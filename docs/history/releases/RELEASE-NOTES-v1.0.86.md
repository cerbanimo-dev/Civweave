# Civweave 1.0.86

Civweave 1.0.86 establishes the fail-closed money-integration edge without enabling live money movement.

- Adds a provider-neutral money edge that reserves existing Buttons or Acorns before external settlement.
- Requires verified external settlement before the corresponding internal transfer can gain finality.
- Carries Base/Base-Sepolia USDC proof primitives and a hosted-provider receipt verification boundary.
- Adds idempotency, receipt replay prevention, reconciliation, cancellation, dispute hooks, refund/reconciliation capability gates, and an emergency stop.
- Separates structural integrationDoorReady from operational liveReady.
- Ships live money disabled and rejects any money-edge result with mint authority or non-zero mint/supply effect.
- Keeps provider credentials, webhook secrets, KYC/AML decisions, tax-reporting readiness, jurisdiction approval, and provider terms outside source control as explicit live-activation gates.

This release gets Civweave to the software boundary for selecting and sandboxing a real money provider. It does not activate real USD or USDC movement.
