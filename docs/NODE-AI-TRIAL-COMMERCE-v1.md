# Node Onboarding + Trial Commerce v1

This package makes the node AI marketplace usable before live money is connected.

## Boundaries

- Trial credits are sandbox values only. They are not money and cannot be cashed out.
- The sandbox uses the same node-local SQLite wallet, reservation, refund/chargeback debt, inference settlement and Cerbanimo fee-accrual methods intended for later live payment events.
- No payment processor is invoked by any `/api/ai/node/trial/*` route.
- Pairing does not use a central account service. A node operator creates a short-lived one-time ticket and the user redeems it directly with that node.
- Node wallet sessions and the operator internal credential are stored in browser `sessionStorage`, never persistent local storage.
- Provider-cost estimates exist only in the operator browser session. They are not part of the Civweave protocol, mesh adverts, signed receipts, or public profitability data.
- The onboarding wizard validates and generates non-secret environment configuration. It intentionally does not persist environment variables or secret material from the browser.

## Operator flow

1. Open `/node-ai/operator` on the node.
2. Unlock the local operator controls with `NODE_AI_INTERNAL_SECRET`. The browser keeps the credential for this tab/session only.
3. Review or edit node identity, public reachability/location, privacy declarations, services, retail ceilings, service implementation module and sandbox mode.
4. Validate the draft. The node returns a generated environment block with secret fields blank.
5. Apply the configuration through the node environment and restart.
6. Run the safe self-test.
7. Create a one-time pairing ticket for a user/device.

The console can also simulate a chargeback and inspect 30-day sandbox economics. A private cost-per-request estimate can be entered to estimate inference margin; it never leaves the browser session.

## User flow

1. Discover the node in Federation Finder.
2. Inspect capability, price and privacy declarations plus current reachability/inference readiness.
3. Redeem the one-time `cwpair_...` ticket. The resulting wallet session is bound to the local device ID and held only for the browser session.
4. Add sandbox credit from the Finder while trial mode is enabled.
5. Set a maximum retail ceiling for a service and run an explicit trial request.
6. Review the node ledger history and locally retained inference receipts.
7. Set a preferred node and device-owned trust flag. If a request fails, Finder names compatible discovered alternatives but does not silently switch or spend on another node.

## Sandbox accounting

Sandbox top-ups call `NodeAiLedger.creditTopUp()` with a `sandbox:true` marker. Duplicate idempotency keys do not double-credit. Refunds and simulated chargebacks call `debitAdjustment()`.

The important adversarial case is preserved: a chargeback cannot consume credits currently reserved for inference. It recovers only unreserved balance and converts any unrecoverable amount into node-local wallet debt. A wallet with debt cannot create new inference reservations until the debt is cleared by later credits.

## Pairing tickets

Pairing tickets are stored in the node SQLite database as SHA-256 hashes. Raw codes are returned once to the operator and are never stored. Tickets expire quickly and can be redeemed once. Redemption registers the device with the node and issues the same signed wallet-session format used by the normal node AI capability gate.

## Live payment boundary

`NODE_AI_TRIAL_COMMERCE_ENABLED=1` enables only the sandbox endpoints. It does not activate Stripe, Connect, bank settlement, card acceptance, payouts or any other live payment rail.

The later Live Settlement package should consume processor-issued account identifiers/tokens and signed webhook events. Bank/card/tax/payout details must be entered directly with the processor, not in Civweave configuration or chat.
