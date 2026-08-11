# Stripe Connect V2 sample for Civweave

This sample lives inside the Cloudflare core Worker and is deliberately separate from the existing node-money ledger. It is a runnable reference for Accounts V2 onboarding, connected-account products, a tiny storefront, thin requirement webhooks, and direct Checkout charges with the Civweave application fee.

## Runtime and SDK

- Node/Worker language: JavaScript ES modules.
- Stripe SDK: `stripe@22.4.0`.
- The SDK pins Stripe API `2026-07-29.dahlia`, so the code does **not** set `apiVersion` manually.
- Every Stripe request is issued through one `Stripe` client. In Cloudflare the client uses `Stripe.createFetchHttpClient()` so outbound requests still go through the SDK while using the Worker Fetch runtime.

## Safety gate

The interactive sample code is bundled into the core Worker but **disabled by default**:

```text
STRIPE_CONNECT_SAMPLE_ENABLED=false
```

This is intentional. The sample provider console is a compact integration lab, not the production Civweave provider-auth surface. Publishing it unauthenticated on the public Worker would expose account/product creation controls.

For a sandbox or local test deployment, explicitly set `STRIPE_CONNECT_SAMPLE_ENABLED=true`. Do not enable the interactive sample on the public production Worker until its provider routes are placed behind the final Civweave operator authentication/authorization layer.

The **thin Stripe webhook is not behind this UI gate**. It remains publicly routable because Stripe must be able to deliver server-to-server requirement/capability notifications. It is cryptographically protected by the destination signing secret and rejects requests that do not carry a valid Stripe signature.

The existing real-money gates remain independent and fail-closed. Enabling the sample does **not** enable live money.

## Required secrets

Add these as GitHub **repository secrets** when the corresponding Stripe integration is ready. The deployment workflow copies them into the `civweave-core` Worker when present.

- `STRIPE_SECRET_KEY`
  - **PLACEHOLDER:** start with a Stripe test-mode key (`sk_test_...`).
  - The sample fails with a descriptive HTTP 503 if it is absent.
- `STRIPE_CONNECT_THIN_WEBHOOK_SECRET`
  - **PLACEHOLDER:** the `whsec_...` signing secret from the thin Accounts V2 event destination described below.
  - Keep this separate from `STRIPE_CONNECT_WEBHOOK_SECRET`, which verifies the existing snapshot payment webhook used by the money edge.

The existing `CIVWEAVE_PLATFORM_FEE_BPS=1500` Worker variable makes the sample application fee 15%.

## Routes

Interactive provider UI, available only when `STRIPE_CONNECT_SAMPLE_ENABLED=true`:

`https://civweave-core.glaedn.workers.dev/connect-demo`

Interactive storefront pages, also gated:

`https://civweave-core.glaedn.workers.dev/store/{CONNECTED_ACCOUNT_ID}`

The account ID in a public URL is for the sample only. A production storefront should expose an opaque Civweave merchant slug and resolve the Stripe Account ID server-side.

The thin Accounts V2 webhook is **always routable**, including when the interactive sample is disabled:

`https://civweave-core.glaedn.workers.dev/api/connect-demo/webhooks/stripe-thin`

Until `STRIPE_CONNECT_THIN_WEBHOOK_SECRET` is configured, the webhook fails closed with a descriptive 503. With the secret configured, invalid or missing Stripe signatures are rejected before an event is processed.

## Account creation

`POST /api/connect-demo/accounts`

Example body:

```json
{
  "userId": "operator-cami",
  "displayName": "Cami's Civweave node",
  "contactEmail": "provider@example.com"
}
```

The Worker creates an Accounts V2 object using only:

- `display_name`
- `contact_email`
- `identity.country = us`
- `dashboard = full`
- Stripe as fee/loss collector
- `customer` configuration
- `merchant` configuration requesting `card_payments`

It never passes a top-level `type`, and therefore never sends `standard`, `express`, or `custom`.

D1 stores only the Civweave `userId -> accountId` mapping. Current onboarding status is always retrieved directly from Stripe V2 with `configuration.merchant` and `requirements` included.

## Onboarding

`POST /api/connect-demo/accounts/{USER_ID}/onboard`

The Worker creates a V2 Account Link with `merchant` and `customer` configurations. The provider UI exposes this as **Onboard to collect payments** and also has a **Refresh status from Stripe** button.

The status response computes:

- `readyToProcessPayments` from `configuration.merchant.capabilities.card_payments.status === "active"`
- `onboardingComplete` from the current requirements minimum-deadline status

No onboarding status is cached in D1.

## Thin requirements/capability webhook

In Stripe Dashboard, create a dedicated Accounts V2 event destination:

1. Open **Developers → Webhooks** and add an event destination.
2. Set **Events from** to **Connected accounts**.
3. Open advanced options and select **Thin** payload style.
4. Select these event types:
   - `v2.core.account[requirements].updated`
   - `v2.core.account[configuration.merchant].capability_status_updated`
   - `v2.core.account[configuration.customer].capability_status_updated`
5. Set the endpoint to:
   `https://civweave-core.glaedn.workers.dev/api/connect-demo/webhooks/stripe-thin`
6. Copy the destination's `whsec_...` signing secret into the GitHub repository secret named exactly `STRIPE_CONNECT_THIN_WEBHOOK_SECRET`.

The handler verifies the Stripe signature, parses the notification with the current Stripe SDK Event Notification API, fetches the versioned event, then retrieves the current Account from Stripe. D1 stores only an event receipt for idempotency/audit, not the requirements state.

For local testing with Stripe CLI:

```bash
stripe listen \
  --thin-events 'v2.core.account[requirements].updated,v2.core.account[configuration.merchant].capability_status_updated,v2.core.account[configuration.customer].capability_status_updated' \
  --forward-thin-to http://localhost:8787/api/connect-demo/webhooks/stripe-thin
```

Use the `whsec_...` value printed by the CLI as your local `STRIPE_CONNECT_THIN_WEBHOOK_SECRET`.

## Products

`POST /api/connect-demo/products`

Example body:

```json
{
  "userId": "operator-cami",
  "name": "One hour systems session",
  "description": "A sample connected-account product.",
  "priceInCents": 5000,
  "currency": "usd"
}
```

The Worker passes `{ stripeAccount: accountId }` to `stripeClient.products.create()`, which sends the Stripe-Account header and creates the Product/Price on the connected account.

The storefront lists products with the same connected-account request option and expands `data.default_price`.

## Checkout/direct charge

`POST /api/connect-demo/store/{ACCOUNT_ID}/checkout`

Example body:

```json
{
  "priceId": "price_...",
  "quantity": 1
}
```

The Worker retrieves the Price through the connected account, calculates the platform application fee, and creates a hosted Checkout Session with:

- the connected account in the Stripe-Account request option
- `payment_intent_data.application_fee_amount`
- a Stripe-hosted Checkout URL

This is a Connect **direct charge**. The connected account owns the charge and Civweave receives the application fee.

## Existing payment webhook

Do not replace the existing money-edge snapshot webhook with the thin Account V2 destination. They serve different jobs and should use different signing secrets.

Snapshot payment webhook:

`https://civweave-core.glaedn.workers.dev/api/money-edge/webhooks/stripe`

GitHub secret:

`STRIPE_CONNECT_WEBHOOK_SECRET`

Current payment events handled by the money edge include completed Checkout, refunds, and disputes.

Thin Account V2 webhook:

`https://civweave-core.glaedn.workers.dev/api/connect-demo/webhooks/stripe-thin`

GitHub secret:

`STRIPE_CONNECT_THIN_WEBHOOK_SECRET`

Keeping the signing secrets and endpoints separate reduces the chance of parsing one payload style as the other.

## Production path

The sample deliberately stops short of becoming the public provider-management UI. The production integration should reuse these Stripe operations behind Civweave's authenticated operator surface, use an opaque storefront identifier instead of an `acct_...` URL, and keep current Stripe account status as the source of truth rather than copying requirements into application state.

The existing Civweave launch flags remain fail-closed. Adding this sample does not set `CIVWEAVE_MONEY_LIVE_ENABLED=true` and does not mark compliance, jurisdiction, KYC/AML, tax, or provider-terms gates as approved.
