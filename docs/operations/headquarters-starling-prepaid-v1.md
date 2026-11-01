# Headquarters Starling prepaid AI Gateway: operator runbook

This headquarters-only feature is disabled by default. Contributions are settled cash, not Cloudflare credits. No Workers Paid subscription is required. Normal Guild node top-ups and membership credits are unrelated.

## Cloudflare prerequisites

Create a dedicated AI Gateway for headquarters with Workers AI billing mode **Unified billing**, an active cost-based global spend-limit rule, and **automatic credit top-up disabled**. Cloudflare warns that even prepaid credits may occasionally go negative and bill the account; cost limits are eventually consistent. Do not enable the paid inference runtime until these provider settings are independently checked.

Cloudflare has a credit purchase API endpoint but it requires a dashboard session and rejects API token/OAuth/service-token purchase calls with HTTP 403. The human operator purchases credits in Cloudflare Dashboard → AI Gateway → Credits Available → Manage → Top-up credits. Cloudflare charges 5% on credit purchases. Do not attempt to automate that dashboard payment.

Read-only Cloudflare API endpoints used for verification:
- GET /client/v4/accounts/{account_id}/ai-gateway/billing/credit-balance
- GET /client/v4/accounts/{account_id}/ai-gateway/gateways/{gateway_id}

Configure Cloudflare core D1 migrations 0014 and 0015 and Wrangler secrets HQ_STARLING_CLOUDFLARE_READ_TOKEN, HQ_STARLING_OPERATOR_TOKEN (random 32+ bytes), CLOUDFLARE_ACCOUNT_ID, and HQ_STARLING_GATEWAY_ID. Set CIVWEAVE_HEADQUARTERS_GATEWAY_PREPAID_READY only after account-specific inspection. Model generation also needs an AI binding and exact approved model/pricing env vars HQ_STARLING_PREPAID_MODEL, HQ_STARLING_MODEL_INPUT_NEURONS_PER_1K_BYTES, HQ_STARLING_MODEL_OUTPUT_NEURONS_PER_1K_TOKENS. HQ_STARLING_FUNDED_INFERENCE_ENABLED and CIVWEAVE_HEADQUARTERS_FUNDING_ENABLED must stay absent or 0 until separate authorization and testing. Public Stripe checkout additionally needs HQ_FUNDING_RATE_LIMITER and all existing Money Edge approval conditions.

## Human-controlled purchase and reconciliation

All following paths are internal Cloudflare core endpoints requiring Authorization: Bearer <HQ_STARLING_OPERATOR_TOKEN>. Do not expose tokens to browsers or Guilds.

1. Before making a purchase, POST /internal/headquarters/starling/prepaid/baseline with JSON {}. This captures the real Cloudflare account balance; no spendable credits are minted.
2. Check net Stripe contributions cover the purchase plus Cloudflare's 5% fee. The minimum Cloudflare purchase is $10 credit for $10.50 of cash backing.
3. Purchase the fixed amount **manually in the Cloudflare dashboard** and retain the reference.
4. POST /internal/headquarters/starling/prepaid/confirm-load with JSON {"providerReference":"cloudflare-receipt-reference","creditCents":1000}. The system checks the genuine Cloudflare balance has risen by at least the claimed credits, cash covers the purchase plus the Cloudflare fee, and the unique load has not already been recognized.
5. GET /internal/headquarters/starling/prepaid/status to compare confirmed available credits to provider balance. If provider balance fell because of other usage, POST /internal/headquarters/starling/prepaid/rebase-after-usage with JSON {} to lower the prior comparison baseline before the next purchase. A balance increase can never be rebased upward as a verified purchase.
6. Only after user/operator approval and provider tests, enable the separate paid-execution flag. POST /internal/headquarters/starling/prepaid/generate with a unique requestId, configured model, up to 12 text messages and max_tokens up to 512. This is a serialized operator-only capability, not an autonomous deployed scheduler. All calls use explicit gateway routing and a separate D1 prepaid ledger.

## Safety and rollback

Free Workers AI jobs must never be routed through the prepaid Gateway. Paid calls are quoted before AI inference; unknown/failing provider outcomes consume the full reservation conservatively. An interrupted reservation stays held until operator audit. Disable HQ_STARLING_FUNDED_INFERENCE_ENABLED on any uncertainty. Refunds and disputes can reduce backing; no further paid work can run if settled contribution backing falls below committed Cloudflare loads. Keep the user-facing contribution checkout off until verified Stripe webhook retryability, operator payout/legal compliance, rate limits and staging billing checks have passed. This PR neither charges a card nor activates paid inference.

Source documentation:
https://developers.cloudflare.com/ai-gateway/features/unified-billing/
https://developers.cloudflare.com/api/resources/ai_gateway/subresources/billing/methods/credit_balance/
https://developers.cloudflare.com/api/typescript/resources/ai_gateway/subresources/billing/subresources/topup/methods/create/
https://developers.cloudflare.com/api/resources/ai_gateway/methods/get/
https://developers.cloudflare.com/ai-gateway/features/spend-limits/