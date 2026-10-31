import { publicHeadquartersFundingStatus, estimatePrepaidGatewayCreditsCents } from './headquarters-starling-funding-v1.mjs';

export const HQ_STARLING_PREPAID_SCHEMA = 'civweave.headquarters-starling-prepaid.v1';
export const HQ_STARLING_PREPAID_ROOT = '/internal/headquarters/starling/prepaid';
const CURRENCY_MULTIPLIER = 1_000_000; // USD -> micro-USD, integer reservation accounting
const clean = (value, max = 180) => String(value ?? '').trim().slice(0, max);
const nowIso = () => new Date().toISOString();
const fail = (message, status = 409) => Object.assign(new Error(message), { status });
const changes = result => Number(result?.meta?.changes ?? result?.changes ?? 0);
const bool = value => value === true || value === '1';
const json = (value, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'no-store' } });

function envReady(env) {
  return env.CIVWEAVE_HEADQUARTERS_GATEWAY_PREPAID_READY === '1'
    && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(clean(env.HQ_STARLING_GATEWAY_ID, 64))
    && /^[a-z0-9]{32}$/i.test(clean(env.CLOUDFLARE_ACCOUNT_ID, 64))
    && clean(env.HQ_STARLING_CLOUDFLARE_READ_TOKEN, 4096).length >= 32;
}

async function operatorAuthorized(request, env) {
  const expected = clean(env.HQ_STARLING_OPERATOR_TOKEN, 4096);
  const actual = String(request.headers.get('authorization') || '').replace(/^Bearer /, '');
  if (expected.length < 32 || actual.length !== expected.length) return false;
  const [left, right] = await Promise.all([crypto.subtle.digest('SHA-256', new TextEncoder().encode(expected)),
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(actual))]);
  const a = new Uint8Array(left), b = new Uint8Array(right);
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function normalizeCloudflareCreditBalance(result) {
  if (result?.success !== true || !Number.isFinite(result?.result?.balance)) throw fail('Cloudflare credit balance is unavailable.', 503);
  // Cloudflare AI Gateway returns the account credit balance in US dollars.
  const balance = Number(result.result.balance);
  if (balance < 0) throw fail('Cloudflare prepaid balance is negative; suspend funded work.', 503);
  const auto = result.result.topup_config;
  if (Number(auto?.amount || 0) > 0 && Number(auto?.threshold || 0) >= 0) {
    throw fail('Cloudflare automatic credit top-up must be disabled.', 503);
  }
  return Math.floor(balance * CURRENCY_MULTIPLIER);
}

export async function fetchVerifiedCloudflareBalance(env, fetchImpl = globalThis.fetch) {
  if (!envReady(env)) throw fail('Cloudflare prepaid account has not been configured.', 503);
  if (typeof fetchImpl !== 'function') throw fail('Cloudflare balance fetch unavailable.', 503);
  const url = 'https://api.cloudflare.com/client/v4/accounts/' + env.CLOUDFLARE_ACCOUNT_ID + '/ai-gateway/billing/credit-balance';
  const response = await fetchImpl(url, { method: 'GET', headers: { authorization: 'Bearer ' + env.HQ_STARLING_CLOUDFLARE_READ_TOKEN,
    accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw fail('Cloudflare prepaid balance lookup failed.', 503);
  return normalizeCloudflareCreditBalance(await response.json());
}

async function prepaidRow(edge) {
  return edge.db.prepare('SELECT * FROM headquarters_starling_prepaid_state WHERE singleton=1').first();
}

export async function initializePrepaidBaseline(edge, { fetchImpl = globalThis.fetch } = {}) {
  if (!edge.db) throw fail('D1 prepaid ledger missing.', 503);
  const balance = await fetchVerifiedCloudflareBalance(edge.env, fetchImpl);
  const now = nowIso();
  const result = await edge.db.prepare(
    'INSERT OR IGNORE INTO headquarters_starling_prepaid_state(singleton,provider_balance_micro_usd,updated_at) VALUES (1,?1,?2)'
  ).bind(balance, now).run();
  const row = await prepaidRow(edge);
  return { schema: HQ_STARLING_PREPAID_SCHEMA, initialized: changes(result) === 1, baselineMicroUsd: Number(row.provider_balance_micro_usd),
    confirmedCreditMicroUsd: Number(row.confirmed_credit_micro_usd) };
}

export function gatewayCashCostCents(creditCents) {
  if (!Number.isSafeInteger(creditCents) || creditCents < 1000 || creditCents > 1_000_000) throw fail('Cloudflare credit load must be between $10 and $10,000.');
  return creditCents + Math.ceil(creditCents * 500 / 10000);
}

export async function reconcilePrepaidCreditLoad(edge, { providerReference, creditCents }, { fetchImpl = globalThis.fetch } = {}) {
  if (!edge.db) throw fail('D1 prepaid ledger missing.', 503);
  const reference = clean(providerReference, 180);
  if (!/^[A-Za-z0-9._:-]{8,180}$/.test(reference)) throw fail('Operator must supply a unique Cloudflare payment reference.');
  const cashCost = gatewayCashCostCents(creditCents);
  const existing = await edge.db.prepare('SELECT * FROM headquarters_starling_prepaid_loads WHERE provider_reference=?1').bind(reference).first();
  if (existing) {
    if (Number(existing.purchased_credit_cents) !== creditCents) throw fail('Credit load reference reused with a different amount.');
    return { schema: HQ_STARLING_PREPAID_SCHEMA, duplicate: true, creditCents };
  }
  const row = await prepaidRow(edge);
  if (!row) throw fail('Record the Cloudflare balance baseline before buying credits.');
  if (Number(row.reserved_micro_usd) !== 0) throw fail('Wait for in-flight requests before reconciling a credit purchase.');
  const cash = await publicHeadquartersFundingStatus(edge);
  if (Number(cash.fundedCents) < Number(row.cash_committed_cents) + cashCost) {
    throw fail('Verified contributions do not cover this credit load and Cloudflare 5% fee.');
  }
  const current = await fetchVerifiedCloudflareBalance(edge.env, fetchImpl);
  const previous = Number(row.provider_balance_micro_usd);
  const increment = creditCents * 10000;
  if (current < previous + increment) throw fail('Cloudflare account balance does not show the claimed new prepaid credits.');
  const now = nowIso(), loadId = crypto.randomUUID();
  // One atomic transaction per load. D1 batch avoids minting the same balance twice.
  const statements = [
    edge.db.prepare('UPDATE headquarters_starling_prepaid_state SET provider_balance_micro_usd=?1,confirmed_credit_micro_usd=confirmed_credit_micro_usd+?2,cash_committed_cents=cash_committed_cents+?3,version=version+1,updated_at=?4 WHERE singleton=1 AND version=?5 AND provider_balance_micro_usd=?6 AND reserved_micro_usd=0')
      .bind(current, increment, cashCost, now, Number(row.version), previous),
    edge.db.prepare('INSERT INTO headquarters_starling_prepaid_loads(load_id,provider_reference,purchased_credit_cents,cash_cost_cents,balance_before_micro_usd,balance_after_micro_usd,recorded_at) VALUES(?1,?2,?3,?4,?5,?6,?7)')
      .bind(loadId,reference,creditCents,cashCost,previous,current,now)
  ];
  // D1 batch is transactional. Check the version after batch; a stale concurrent
  // refresh cannot be used to recognize a second purchase of the same credits.
  const results = await edge.db.batch(statements);
  if (changes(results[0]) !== 1) throw fail('Prepaid balance changed during reconciliation. Retry after rechecking Cloudflare.');
  return Object.freeze({ schema: HQ_STARLING_PREPAID_SCHEMA, creditCents, cashCostCents: cashCost,
    loadId, confirmed: true, gatewayCreditsLoaded: true });
}

export async function headquartersPrepaidStatus(edge, { fetchImpl = globalThis.fetch } = {}) {
  const row = await prepaidRow(edge);
  const cash = await publicHeadquartersFundingStatus(edge);
  const observedBalanceMicroUsd = await fetchVerifiedCloudflareBalance(edge.env, fetchImpl);
  const confirmed = Number(row?.confirmed_credit_micro_usd || 0), reserved = Number(row?.reserved_micro_usd || 0),
    spent = Number(row?.spent_quote_micro_usd || 0);
  const funded = Math.max(0, confirmed - reserved - spent);
  return Object.freeze({
    schema: HQ_STARLING_PREPAID_SCHEMA, initialized: Boolean(row), billingMode: 'ai-gateway-prepaid-unified',
    cashBackingCents: Number(cash.fundedCents), cashCommittedCents: Number(row?.cash_committed_cents || 0),
    confirmedCreditMicroUsd: confirmed, reservedMicroUsd: reserved, conservativelySpentMicroUsd: spent,
    ledgerAvailableMicroUsd: funded, observedAccountBalanceMicroUsd: observedBalanceMicroUsd,
    availableMicroUsd: Math.min(funded, Math.max(0, observedBalanceMicroUsd - 1_000_000)),
    note: 'Cloudflare credits are account-shared. Only credits confirmed by observed balance increases can be used; a $1 safety reserve is held.'
  });
}

function quoteInference(env, input) {
  const model = clean(input?.model, 200), allowed = clean(env.HQ_STARLING_PREPAID_MODEL, 200);
  if (!allowed || !model || model !== allowed) throw fail('Requested model is not approved for Starling prepaid inference.');
  const messages = input?.messages;
  if (!Array.isArray(messages) || !messages.length || messages.length > 12
    || messages.some(msg => !['system','user','assistant'].includes(msg?.role) || typeof msg?.content !== 'string' || !msg.content.length)) {
    throw fail('Prepaid work requires 1-12 text messages with valid roles.');
  }
  const payloadBytes = new TextEncoder().encode(JSON.stringify(messages)).byteLength;
  if (payloadBytes > 12000) throw fail('Prepaid context exceeds 12 KB maximum.');
  const maxTokens = input?.max_tokens;
  if (!Number.isSafeInteger(maxTokens) || maxTokens < 1 || maxTokens > 512) throw fail('Prepaid output bound must be 1-512 tokens.');
  const inRate = Number(env.HQ_STARLING_MODEL_INPUT_NEURONS_PER_1K_BYTES),
    outRate = Number(env.HQ_STARLING_MODEL_OUTPUT_NEURONS_PER_1K_TOKENS);
  const neuronRate = Number(env.HQ_STARLING_NEURON_MICRO_USD || 11);
  if (![inRate,outRate,neuronRate].every(v => Number.isSafeInteger(v) && v > 0 && v <= 1_000_000)) {
    throw fail('Model tariffs must be operator-configured before any prepaid inference.', 503);
  }
  // Intentionally pessimistic: context is billed by raw UTF-8 bytes, not tokenizer
  // estimates, with an additional 4x safety factor.
  const quote = Math.ceil((Math.ceil(payloadBytes * inRate / 1000) + Math.ceil(maxTokens * outRate / 1000)) * neuronRate * 4);
  const maxMicro = Number(env.HQ_STARLING_PREPAID_MAX_REQUEST_MICRO_USD || 20000);
  if (!Number.isSafeInteger(maxMicro) || maxMicro < 1 || quote > maxMicro) throw fail('Estimated inference cost exceeds the operator per-request cap.');
  return { model, messages, maxTokens, quote, payloadBytes };
}

export async function runBoundedHeadquartersPrepaidInference(edge, input, { fetchImpl = globalThis.fetch } = {}) {
  if (edge.env.HQ_STARLING_FUNDED_INFERENCE_ENABLED !== '1' || !edge.env.AI?.run) {
    throw fail('Headquarters prepaid generation is disabled.', 503);
  }
  if (!envReady(edge.env)) throw fail('Prepaid gateway is not configured.', 503);
  const id = clean(input?.requestId, 180);
  if (!/^[A-Za-z0-9_-]{16,180}$/.test(id)) throw fail('Stable request ID required for paid generation.');
  const q = quoteInference(edge.env, input);
  const status = await headquartersPrepaidStatus(edge, { fetchImpl });
  if (!status.initialized || status.cashBackingCents < status.cashCommittedCents
      || status.availableMicroUsd < q.quote) throw fail('No verified prepaid credits available for this request.');
  const now = nowIso(), gatewayId = edge.env.HQ_STARLING_GATEWAY_ID;
  const insert = await edge.db.prepare(
    "INSERT OR IGNORE INTO headquarters_starling_prepaid_requests(request_id,model,gateway_id,reserved_micro_usd,status,created_at,updated_at) VALUES(?1,?2,?3,?4,'pending',?5,?5)"
  ).bind(id,q.model,gatewayId,q.quote,now).run();
  if (changes(insert) !== 1) throw fail('Prepaid request ID has already been used.');
  const reserve = await edge.db.prepare(
    'UPDATE headquarters_starling_prepaid_state SET reserved_micro_usd=reserved_micro_usd+?1,version=version+1,updated_at=?2 WHERE singleton=1 AND confirmed_credit_micro_usd-spent_quote_micro_usd-reserved_micro_usd>=?1 AND reserved_micro_usd=0'
  ).bind(q.quote,now).run();
  if (changes(reserve) !== 1) {
    await edge.db.prepare("UPDATE headquarters_starling_prepaid_requests SET status='blocked',updated_at=?1 WHERE request_id=?2").bind(now,id).run();
    throw fail('Another request is running or the prepaid reserve is empty.');
  }
  let response, uncertain = false, usage = null;
  try {
    // Only the explicitly configured prepaid Unified Billing gateway is passed.
    // Ordinary Workers AI free requests must NOT use this gateway.
    response = await edge.env.AI.run(q.model, {
      messages:q.messages,max_tokens:q.maxTokens,stream:false
    }, { gateway:{ id:gatewayId } });
    usage = response?.usage || null;
  } catch (cause) {
    uncertain = true;
  }
  // Even on failure charge the maximum reservation: interrupted or ambiguous
  // provider calls may have been billed. Do not retry automatically.
  const finish = nowIso();
  await edge.db.batch([
    edge.db.prepare('UPDATE headquarters_starling_prepaid_state SET reserved_micro_usd=reserved_micro_usd-?1,spent_quote_micro_usd=spent_quote_micro_usd+?1,version=version+1,updated_at=?2 WHERE singleton=1 AND reserved_micro_usd>=?1').bind(q.quote,finish),
    edge.db.prepare("UPDATE headquarters_starling_prepaid_requests SET status=?1,charged_micro_usd=?2,provider_usage_json=?3,updated_at=?4 WHERE request_id=?5 AND status='pending'")
      .bind(uncertain?'uncertain':'settled',q.quote,usage?JSON.stringify(usage).slice(0,2000):null,finish,id)
  ]);
  if (uncertain) throw fail('Provider outcome was uncertain; full quote retained and request cannot be retried automatically.', 503);
  return Object.freeze({ schema:HQ_STARLING_PREPAID_SCHEMA, requestId:id, gatewayId, model:q.model, reservedAndChargedMicroUsd:q.quote,
    result: response });
}

export async function handleHeadquartersPrepaidRequest(request, env, edgeFactory, { fetchImpl = globalThis.fetch } = {}) {
  const url = new URL(request.url), path = url.pathname;
  if (!path.startsWith(HQ_STARLING_PREPAID_ROOT + '/')) return null;
  if (!await operatorAuthorized(request,env)) return json({ error:'Unauthorized headquarters operator.' },401);
  if (!envReady(env)) return json({ error:'Prepaid account is unconfigured.' },503);
  if (!['POST','GET'].includes(request.method)) return json({ error:'Method not allowed.' },405);
  try {
    const edge = edgeFactory(env);
    if (path === HQ_STARLING_PREPAID_ROOT + '/status' && request.method === 'GET')
      return json(await headquartersPrepaidStatus(edge, { fetchImpl }));
    if (request.method !== 'POST') return json({ error:'Method not allowed.' },405);
    if (Number(request.headers.get('content-length') || 0) > 18000) return json({ error:'Request too large.' },413);
    const raw = await request.text();
    if (raw.length > 18000) return json({ error:'Request too large.' },413);
    let data; try { data = JSON.parse(raw); } catch { return json({ error:'Invalid JSON.' },400); }
    if (path === HQ_STARLING_PREPAID_ROOT + '/baseline') return json(await initializePrepaidBaseline(edge,{fetchImpl}),201);
    if (path === HQ_STARLING_PREPAID_ROOT + '/confirm-load') return json(await reconcilePrepaidCreditLoad(edge,data,{fetchImpl}),201);
    if (path === HQ_STARLING_PREPAID_ROOT + '/generate') return json(await runBoundedHeadquartersPrepaidInference(edge,data,{fetchImpl}),200);
    return json({ error:'Unknown prepaid operation.' },404);
  } catch (cause) {
    return json({ error:String(cause?.message||'Prepaid request unavailable.').slice(0,300) },
      Number.isSafeInteger(cause?.status)?cause.status:503);
  }
}
