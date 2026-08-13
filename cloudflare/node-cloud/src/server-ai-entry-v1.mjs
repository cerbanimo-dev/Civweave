import baseWorker, { CivweaveCloudNode, CivweaveCapacityAccount } from './entry.mjs';
import { nodeIdFromHostname, normalizeNodeId } from './index.mjs';

export { CivweaveCloudNode, CivweaveCapacityAccount };

const enc = new TextEncoder();
const dec = new TextDecoder();
const SESSION_DOMAIN = 'civweave.capacity-session.v1';
const GENERATION_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
const INPUT_NEURONS_PER_MILLION = 4_119;
const OUTPUT_NEURONS_PER_MILLION = 34_868;
const DEFAULT_CORE_ORIGIN = 'https://api.commonweave.earth';
const AI_CORS = Object.freeze({
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, x-civweave-node-id',
  'access-control-max-age': '86400'
});
const MEMBERSHIP_TIERS = Object.freeze({
  member: Object.freeze({ id: 'member', serviceAmountCents: 500, monthlyLifetimeCredits: 100_000 }),
  maker: Object.freeze({ id: 'maker', serviceAmountCents: 1_000, monthlyLifetimeCredits: 250_000 }),
  builder: Object.freeze({ id: 'builder', serviceAmountCents: 2_000, monthlyLifetimeCredits: 600_000 }),
  steward: Object.freeze({ id: 'steward', serviceAmountCents: 4_000, monthlyLifetimeCredits: 1_500_000 }),
});

const clean = (value, max = 12_000) => String(value ?? '').trim().slice(0, max);
const json = (value, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'no-store', ...AI_CORS } });
function b64urlDecode(value) {
  const normalized = clean(value, 20_000).replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
async function hmacKey(env) {
  const source = clean(env.NODE_FABRIC_SESSION_SECRET || env.NODE_FABRIC_OPERATOR_TOKEN, 10_000);
  if (source.length < 24) throw Object.assign(new Error('Host capacity session authority is unavailable.'), { status: 503 });
  const material = await crypto.subtle.digest('SHA-256', enc.encode(`${SESSION_DOMAIN}\0${source}`));
  return crypto.subtle.importKey('raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
}
function bearer(request) {
  const value = clean(request.headers.get('authorization'), 20_000);
  return /^Bearer\s+/i.test(value) ? value.replace(/^Bearer\s+/i, '') : '';
}
async function verifyCapacitySession(env, token, expectedNodeId) {
  const [encoded, signatureText, extra] = clean(token, 20_000).split('.');
  if (!encoded || !signatureText || extra) throw Object.assign(new Error('Malformed member capacity session.'), { status: 401 });
  const valid = await crypto.subtle.verify('HMAC', await hmacKey(env), b64urlDecode(signatureText), enc.encode(`${SESSION_DOMAIN}\n${encoded}`));
  if (!valid) throw Object.assign(new Error('Invalid member capacity session.'), { status: 401 });
  let payload;
  try { payload = JSON.parse(dec.decode(b64urlDecode(encoded))); }
  catch { throw Object.assign(new Error('Malformed member capacity session payload.'), { status: 401 }); }
  const now = Math.floor(Date.now() / 1000);
  if (payload?.v !== 1 || !payload.nodeId || !payload.userId || !Number.isSafeInteger(payload.exp) || payload.exp <= now) throw Object.assign(new Error('Member capacity session expired or invalid.'), { status: 401 });
  if (payload.nodeId !== expectedNodeId) throw Object.assign(new Error('Member capacity session belongs to a different host node.'), { status: 403 });
  return payload;
}
function capacityStub(env) {
  if (!env.CAPACITY) throw Object.assign(new Error('Capacity binding is unavailable.'), { status: 503 });
  return env.CAPACITY.get(env.CAPACITY.idFromName('civweave-account'));
}
async function capacityPost(env, pathname, body) {
  const response = await capacityStub(env).fetch(`https://capacity.internal${pathname}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || `Capacity service returned HTTP ${response.status}.`), { status: response.status });
  return payload;
}
function actualNeurons(usage = {}) {
  const input = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const output = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  if (!Number.isFinite(input) || !Number.isFinite(output)) return 1;
  return Math.max(1, Math.ceil((input * INPUT_NEURONS_PER_MILLION + output * OUTPUT_NEURONS_PER_MILLION) / 1_000_000));
}
function messages(input = {}) {
  const rows = Array.isArray(input.messages) ? input.messages : [];
  const normalized = rows.slice(-64).map(item => ({
    role: item?.role === 'assistant' ? 'assistant' : item?.role === 'system' ? 'system' : 'user',
    content: clean(item?.content, 48_000),
  })).filter(item => item.content);
  if (clean(input.system, 48_000)) normalized.unshift({ role: 'system', content: clean(input.system, 48_000) });
  if (!normalized.length && clean(input.prompt, 48_000)) normalized.push({ role: 'user', content: clean(input.prompt, 48_000) });
  if (!normalized.length) normalized.push({ role: 'user', content: 'Continue.' });
  return normalized;
}
function generationEstimate(rows, maxTokens) {
  const chars = rows.reduce((sum, row) => sum + row.content.length, 0);
  const inputTokens = Math.ceil(chars / 4);
  const outputTokens = Math.max(32, Math.min(4096, Number(maxTokens) || 1024));
  return Math.max(4, Math.min(240, Math.ceil((inputTokens * INPUT_NEURONS_PER_MILLION + outputTokens * OUTPUT_NEURONS_PER_MILLION) / 1_000_000) + 3));
}
function boundedSchema(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const text = JSON.stringify(value);
  if (text.length > 24_000) throw Object.assign(new RangeError('Response schema is too large.'), { status: 400 });
  return JSON.parse(text);
}
function extractText(result) {
  if (typeof result?.response === 'string') return result.response;
  if (typeof result?.text === 'string') return result.text;
  if (typeof result?.result?.response === 'string') return result.result.response;
  if (result?.response != null) return JSON.stringify(result.response);
  return '';
}
function parseStructured(text) {
  const source = clean(text, 5_000_000).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try { return JSON.parse(source); } catch { return null; }
}
async function handleGenerate(request, env, nodeId) {
  if (!env.AI) return json({ ok: false, error: 'Workers AI binding is unavailable.' }, 503);
  let session;
  try { session = await verifyCapacitySession(env, bearer(request), nodeId); }
  catch (error) { return json({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 401); }
  const input = await request.json().catch(() => ({}));
  const rows = messages(input);
  const maxTokens = Math.max(32, Math.min(4096, Number(input.maxTokens) || 1024));
  const requestedNeurons = generationEstimate(rows, maxTokens);
  let reservation;
  try {
    reservation = (await capacityPost(env, '/usage/reserve', {
      nodeId, userId: session.userId, requestedNeurons, allowLifetimeCredits: input.allowLifetimeCredits === true,
    })).reservation;
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error), code: Number(error?.status) === 402 ? 'COMPUTE_PAYMENT_REQUIRED' : 'COMPUTE_RESERVATION_FAILED' }, Number.isSafeInteger(error?.status) ? error.status : 503);
  }
  try {
    const schema = boundedSchema(input.responseSchema);
    const options = {
      messages: rows,
      max_tokens: maxTokens,
      temperature: Math.max(0, Math.min(2, Number(input.temperature ?? 0.2))),
    };
    if (schema) options.response_format = { type: 'json_schema', json_schema: schema };
    else if (input.responseFormat === 'json') options.response_format = { type: 'json_object' };
    const result = await env.AI.run(GENERATION_MODEL, options);
    const chargedNeurons = Math.min(reservation.requestedNeurons, actualNeurons(result?.usage));
    const settlement = await capacityPost(env, '/usage/settle', { reservationId: reservation.reservationId, actualNeurons: chargedNeurons });
    const memberStatus = await capacityPost(env, '/members/status', { nodeId, userId: session.userId });
    const text = extractText(result);
    const outputJson = schema || input.responseFormat === 'json' ? parseStructured(text) : null;
    if ((schema || input.responseFormat === 'json') && !outputJson) return json({ ok: false, error: 'Workers AI did not return valid structured output.', model: GENERATION_MODEL, usage: { ...(result?.usage || {}), chargedNeurons }, settlement, quota: memberStatus.quota }, 502);
    return json({
      ok: true,
      schema: 'civweave.cloud-generation.v1',
      nodeId,
      userId: session.userId,
      model: GENERATION_MODEL,
      text,
      outputJson,
      usage: { ...(result?.usage || {}), chargedNeurons },
      settlement,
      quota: memberStatus.quota,
    });
  } catch (error) {
    await capacityPost(env, '/usage/settle', { reservationId: reservation.reservationId, actualNeurons: 0 }).catch(() => {});
    return json({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 502);
  }
}
function externalOrigin(request) {
  const forwarded = clean(request.headers.get('x-civweave-account-edge-origin'), 2000);
  try { return new URL(forwarded || request.url).origin; } catch { return new URL(request.url).origin; }
}
function sameOriginReturn(value, origin, fallbackPath) {
  if (!value) return `${origin}${fallbackPath}`;
  const url = new URL(clean(value, 4000));
  if (url.protocol !== 'https:' || url.origin !== origin) throw Object.assign(new RangeError('Checkout return URL must stay on this host origin.'), { status: 400 });
  return url.href;
}
function nodeStub(env, nodeId) {
  if (!env.NODES) throw Object.assign(new Error('Node binding is unavailable.'), { status: 503 });
  return env.NODES.get(env.NODES.idFromName(nodeId));
}
async function signNodeRequest(env, nodeId, rawText) {
  const response = await nodeStub(env, nodeId).fetch('https://node.internal/internal/sign-request', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-civweave-node-id': nodeId },
    body: rawText,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.signatureHeader) throw Object.assign(new Error(payload.error || 'Host node could not sign the money-edge request.'), { status: response.status || 503 });
  return payload.signatureHeader;
}
async function coreFetch(env, pathname, init = {}) {
  if (env.CORE?.fetch) return env.CORE.fetch(`https://civweave-core.internal${pathname}`, init);
  const origin = clean(env.CIVWEAVE_CORE_ORIGIN, 2000) || DEFAULT_CORE_ORIGIN;
  return fetch(new URL(pathname, origin), init);
}
async function signedCorePost(env, nodeId, pathname, body) {
  const rawText = JSON.stringify(body);
  const signature = await signNodeRequest(env, nodeId, rawText);
  const response = await coreFetch(env, pathname, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-civweave-node-signature': signature },
    body: rawText,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || `Money edge returned HTTP ${response.status}.`), { status: response.status });
  return payload;
}
async function handleCommerce(request, env, nodeId, kind) {
  let session;
  try { session = await verifyCapacitySession(env, bearer(request), nodeId); }
  catch (error) { return json({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 401); }
  if (kind === 'options' && request.method === 'GET') return json({ ok: true, schema: 'civweave.commerce-options.v1', nodeId, tiers: Object.values(MEMBERSHIP_TIERS), topup: { currency: 'USD', minCents: 100, maxCents: 100_000 } });
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405);
  const input = await request.json().catch(() => ({})), origin = externalOrigin(request);
  const successUrl = sameOriginReturn(input.successUrl, origin, '/?commerce=success');
  const cancelUrl = sameOriginReturn(input.cancelUrl, origin, '/?commerce=cancelled');
  try {
    if (kind === 'topup') {
      const grossCents = Number(input.grossCents);
      if (!Number.isSafeInteger(grossCents) || grossCents < 100 || grossCents > 100_000) throw Object.assign(new RangeError('Top-up amount must be between $1 and $1,000.'), { status: 400 });
      const body = { nodeId, userId: session.userId, grossCents, currency: 'USD', idempotencyKey: clean(input.idempotencyKey, 180) || `capacity-topup:${crypto.randomUUID()}`, successUrl, cancelUrl };
      const payload = await signedCorePost(env, nodeId, '/api/money-edge/topups', body);
      return json({ ok: true, schema: 'civweave.commerce-checkout.v1', checkout: payload.topup, topup: payload.topup }, 201);
    }
    if (kind === 'membership') {
      const tierId = clean(input.tierId, 80).toLowerCase(), tier = MEMBERSHIP_TIERS[tierId];
      if (!tier) throw Object.assign(new RangeError('Unknown Civweave membership tier.'), { status: 400 });
      const body = { nodeId, userId: session.userId, tierId, idempotencyKey: clean(input.idempotencyKey, 180) || `capacity-membership:${crypto.randomUUID()}`, successUrl, cancelUrl };
      const payload = await signedCorePost(env, nodeId, '/api/money-edge/memberships', body);
      return json({ ok: true, schema: 'civweave.commerce-checkout.v1', checkout: payload.membership, membership: payload.membership }, 201);
    }
    return json({ ok: false, error: 'Unknown commerce route.' }, 404);
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 500);
  }
}
function resolveNodeId(request, env) {
  const url = new URL(request.url), domain = env.NODE_DOMAIN || 'nodes.commonweave.earth';
  return normalizeNodeId(request.headers.get('x-civweave-node-id') || url.searchParams.get('nodeId') || nodeIdFromHostname(url.hostname, domain));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url), nodeId = resolveNodeId(request, env);
    if (nodeId && request.method === 'OPTIONS' && (url.pathname.startsWith('/api/ai/node/') || url.pathname.startsWith('/api/commerce/'))) return new Response(null, { status: 204, headers: AI_CORS });
    if (nodeId && request.method === 'POST' && url.pathname === '/api/ai/node/generate') return handleGenerate(request, env, nodeId);
    if (nodeId && url.pathname === '/api/commerce/options') return handleCommerce(request, env, nodeId, 'options');
    if (nodeId && url.pathname === '/api/commerce/topup') return handleCommerce(request, env, nodeId, 'topup');
    if (nodeId && url.pathname === '/api/commerce/membership') return handleCommerce(request, env, nodeId, 'membership');
    return baseWorker.fetch(request, env, ctx);
  },
  async scheduled(controller, env, ctx) {
    if (typeof baseWorker.scheduled === 'function') return baseWorker.scheduled(controller, env, ctx);
  },
};
