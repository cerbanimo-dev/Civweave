import baseWorker from './server-ai-entry-v1.mjs';
import { CivweaveCloudNode } from './cloud-node-membership-v1.mjs';
import { CivweaveUserPoolCapacityAccount as CivweaveCapacityAccount } from './capacity-user-pools-v2.mjs';
import { nodeIdFromHostname, normalizeNodeId } from './index.mjs';
import { chooseUserAiPoolRoute } from './user-ai-pool-router-v2.mjs';

export { CivweaveCloudNode, CivweaveCapacityAccount };

const enc = new TextEncoder();
const dec = new TextDecoder();
const SESSION_DOMAIN = 'civweave.capacity-session.v1';
const WORKERS_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
const DEFAULT_GATEWAY_MODEL = 'google/gemini-3.1-flash-lite';
const MAX_GENERATION_TOKENS = 16_384;
const WORKERS_INPUT_NEURONS_PER_MILLION = 4_119;
const WORKERS_OUTPUT_NEURONS_PER_MILLION = 34_868;
const DEFAULT_GATEWAY_INPUT_NEURONS_PER_MILLION = 22_728;
const DEFAULT_GATEWAY_OUTPUT_NEURONS_PER_MILLION = 136_364;
const AI_CORS = Object.freeze({
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, x-civweave-node-id',
  'access-control-max-age': '86400',
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
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || `Capacity service returned HTTP ${response.status}.`), { status: response.status });
  return payload;
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
function estimateTokens(rows, maxTokens) {
  const chars = rows.reduce((sum, row) => sum + row.content.length, 0);
  return Object.freeze({ inputTokens: Math.max(1, Math.ceil(chars / 3) + rows.length * 4), outputTokens: Math.max(32, Math.ceil(maxTokens * 1.15)) });
}
function neuronsForTokens(inputTokens, outputTokens, inputRate, outputRate) {
  return Math.max(1, Math.ceil((inputTokens * inputRate + outputTokens * outputRate) / 1_000_000));
}
function gatewayConfig(env) {
  const model = clean(env.CIVWEAVE_UNIFIED_BILLING_MODEL || DEFAULT_GATEWAY_MODEL, 180);
  if (model === DEFAULT_GATEWAY_MODEL) return Object.freeze({ model, inputRate: DEFAULT_GATEWAY_INPUT_NEURONS_PER_MILLION, outputRate: DEFAULT_GATEWAY_OUTPUT_NEURONS_PER_MILLION });
  const inputRate = Number(env.CIVWEAVE_GATEWAY_INPUT_NEURONS_PER_MILLION), outputRate = Number(env.CIVWEAVE_GATEWAY_OUTPUT_NEURONS_PER_MILLION);
  if (!Number.isSafeInteger(inputRate) || inputRate < 1 || !Number.isSafeInteger(outputRate) || outputRate < 1) throw Object.assign(new Error('Custom AI Gateway model requires explicit neuron conversion rates.'), { status: 503 });
  return Object.freeze({ model, inputRate, outputRate });
}
function usageTokens(result = {}) {
  const usage = result?.usage || result?.usageMetadata || {};
  const input = Number(usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokenCount ?? 0);
  const explicitOutput = usage.completion_tokens ?? usage.output_tokens;
  const output = explicitOutput != null ? Number(explicitOutput || 0) : Number(usage.candidatesTokenCount ?? 0) + Number(usage.thoughtsTokenCount ?? 0);
  return Object.freeze({ inputTokens: Math.max(0, Number.isFinite(input) ? input : 0), outputTokens: Math.max(0, Number.isFinite(output) ? output : 0) });
}
function textPart(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(item => typeof item === 'string' ? item : clean(item?.text, 5_000_000)).filter(Boolean).join('');
  return '';
}
function extractText(result) {
  if (typeof result?.response === 'string') return result.response;
  if (typeof result?.text === 'string') return result.text;
  if (typeof result?.result?.response === 'string') return result.result.response;
  const choice = result?.choices?.[0]?.message?.content;
  if (choice != null) return textPart(choice);
  const parts = result?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) return parts.map(item => clean(item?.text, 5_000_000)).filter(Boolean).join('');
  if (result?.response != null) return JSON.stringify(result.response);
  return '';
}
function structuredObject(result) {
  const candidates = [result?.response, result?.result?.response, result?.output, result?.outputJson, result?.choices?.[0]?.message?.parsed];
  for (const candidate of candidates) if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) return candidate;
  return null;
}
function boundedSchema(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const text = JSON.stringify(value);
  if (text.length > 24_000) throw Object.assign(new RangeError('Response schema is too large.'), { status: 400 });
  return JSON.parse(text);
}
function parseStructured(text) {
  const source = clean(text, 5_000_000).trim();
  if (!source) return null;
  const attempts = [source];
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1]?.trim();
  if (fenced) attempts.push(fenced);
  const start = source.search(/[\[{]/);
  if (start >= 0) {
    let depth = 0, inString = false, escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') { inString = true; continue; }
      if (char === '{' || char === '[') depth += 1;
      else if (char === '}' || char === ']') {
        depth -= 1;
        if (depth === 0) { attempts.push(source.slice(start, index + 1)); break; }
      }
    }
  }
  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
  }
  return null;
}
function generationProvenance(model, computeRoute, input = {}) {
  const generatedAt = new Date().toISOString();
  const generation = Object.freeze({ schema: 'civweave.generation-provenance.v1', kind: 'ai-generated', aiGenerated: true, provider: computeRoute === 'ai-gateway-unified-billing' ? 'cloudflare-ai-gateway' : 'cloudflare-workers-ai', model: clean(model, 240), requestId: clean(input.requestId, 180), purpose: clean(input.purpose || 'cloud-generation', 180), generatedAt });
  return Object.freeze({ generation, artifact: Object.freeze({ schema: 'civweave.content-provenance.v1', origin: 'ai-generated', aiGenerated: true, createdAt: generatedAt, sourceSystem: 'civweave-cloud-generation', artifactType: 'structured-model-output', generation, humanValidations: [] }) });
}
function stampStructuredOutput(outputJson, artifactProvenance) {
  if (!outputJson || typeof outputJson !== 'object' || Array.isArray(outputJson)) return outputJson;
  const metadata = outputJson.metadata && typeof outputJson.metadata === 'object' && !Array.isArray(outputJson.metadata) ? outputJson.metadata : {};
  const existing = metadata.civweaveProvenance && typeof metadata.civweaveProvenance === 'object' && !Array.isArray(metadata.civweaveProvenance) ? metadata.civweaveProvenance : null;
  const provenance = existing?.origin && existing.origin !== 'unknown' ? existing : artifactProvenance;
  return { ...outputJson, metadata: { ...metadata, civweaveProvenance: provenance } };
}
function resolveNodeId(request, env) {
  const url = new URL(request.url), domain = env.NODE_DOMAIN || 'nodes.commonweave.earth';
  return normalizeNodeId(request.headers.get('x-civweave-node-id') || url.searchParams.get('nodeId') || nodeIdFromHostname(url.hostname, domain));
}
function sharedFreeLimitError(error) {
  return Number(error?.status) === 429 || /3036|daily free allocation|10,000 neurons|account limited/i.test(clean(error?.message || error, 2000));
}
async function reserveSelection(env, nodeId, userId, route, input, model) {
  return (await capacityPost(env, '/usage/reserve', { nodeId, userId, requestedNeurons: route.quotaNeurons, billingCeilingNeurons: route.providerNeurons, billingRail: route.route, fundingSource: route.pool, billingModel: model, allowLifetimeCredits: input.allowLifetimeCredits === true })).reservation;
}
async function settle(env, reservation, quotaNeurons, providerNeurons = quotaNeurons) {
  return capacityPost(env, '/usage/settle', { reservationId: reservation.reservationId, actualNeurons: quotaNeurons, actualBillingNeurons: providerNeurons });
}
async function runRoute(env, route, gateway, options) {
  if (route.route === 'ai-gateway-unified-billing') return env.AI.run(gateway.model, options, { gateway: { id: clean(env.CIVWEAVE_AI_GATEWAY_ID || 'default', 120), collectLog: true } });
  return env.AI.run(WORKERS_MODEL, options);
}
async function handleGenerate(request, env, nodeId) {
  if (!env.AI) return json({ ok: false, error: 'Cloudflare AI binding is unavailable.' }, 503);
  let session;
  try { session = await verifyCapacitySession(env, bearer(request), nodeId); }
  catch (error) { return json({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 401); }
  const input = await request.json().catch(() => ({}));
  const rows = messages(input), maxTokens = Math.max(32, Math.min(MAX_GENERATION_TOKENS, Number(input.maxTokens) || 1024));
  let schema;
  try { schema = boundedSchema(input.responseSchema); }
  catch (error) { return json({ ok: false, error: String(error?.message || error) }, 400); }
  let gateway;
  try { gateway = gatewayConfig(env); }
  catch (error) { return json({ ok: false, error: String(error?.message || error) }, Number(error?.status) || 503); }
  const estimated = estimateTokens(rows, maxTokens);
  const workersEstimate = neuronsForTokens(estimated.inputTokens, estimated.outputTokens, WORKERS_INPUT_NEURONS_PER_MILLION, WORKERS_OUTPUT_NEURONS_PER_MILLION);
  const gatewayEstimate = neuronsForTokens(estimated.inputTokens, estimated.outputTokens, gateway.inputRate, gateway.outputRate);
  let memberStatus;
  try { memberStatus = await capacityPost(env, '/members/status', { nodeId, userId: session.userId }); }
  catch (error) { return json({ ok: false, error: String(error?.message || error) }, Number(error?.status) || 503); }
  let route = chooseUserAiPoolRoute({ workersPlan: memberStatus?.capacity?.workersPlan, includedRemainingNeurons: Number(memberStatus?.quota?.includedRemainingNeurons || 0), sharedFreeRemainingNeurons: Number(memberStatus?.quota?.workersAiFreeRemainingNeurons ?? memberStatus?.capacity?.workersAiFreeRemainingNeurons ?? 0), workersEstimateNeurons: workersEstimate, gatewayEstimateNeurons: gatewayEstimate });
  const options = { messages: rows, max_tokens: maxTokens, temperature: Math.max(0, Math.min(2, Number(input.temperature ?? 0.2))) };
  if (schema) options.response_format = { type: 'json_schema', json_schema: schema };
  else if (input.responseFormat === 'json') options.response_format = { type: 'json_object' };
  let reservation;
  try { reservation = await reserveSelection(env, nodeId, session.userId, route, input, route.route === 'ai-gateway-unified-billing' ? gateway.model : WORKERS_MODEL); }
  catch (error) { return json({ ok: false, error: String(error?.message || error), code: Number(error?.status) === 402 ? 'COMPUTE_PAYMENT_REQUIRED' : 'COMPUTE_RESERVATION_FAILED' }, Number.isSafeInteger(error?.status) ? error.status : 503); }
  let result;
  try { result = await runRoute(env, route, gateway, options); }
  catch (error) {
    await settle(env, reservation, 0, 0).catch(() => {});
    if (route.route === 'workers-ai-free' && String(memberStatus?.capacity?.workersPlan).toLowerCase() === 'free' && sharedFreeLimitError(error)) {
      route = Object.freeze({ route: 'ai-gateway-unified-billing', pool: 'included', quotaNeurons: workersEstimate, providerNeurons: gatewayEstimate });
      try { reservation = await reserveSelection(env, nodeId, session.userId, route, input, gateway.model); result = await runRoute(env, route, gateway, options); }
      catch (fallbackError) { if (reservation) await settle(env, reservation, 0, 0).catch(() => {}); return json({ ok: false, error: String(fallbackError?.message || fallbackError), code: 'AI_GATEWAY_FALLBACK_FAILED' }, Number.isSafeInteger(fallbackError?.status) ? fallbackError.status : 502); }
    } else return json({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 502);
  }
  try {
    const usage = usageTokens(result);
    const workersActual = neuronsForTokens(usage.inputTokens, usage.outputTokens, WORKERS_INPUT_NEURONS_PER_MILLION, WORKERS_OUTPUT_NEURONS_PER_MILLION);
    const gatewayActual = neuronsForTokens(usage.inputTokens, usage.outputTokens, gateway.inputRate, gateway.outputRate);
    const quotaActual = route.pool === 'lifetime' ? gatewayActual : workersActual;
    const providerActual = route.route === 'ai-gateway-unified-billing' ? gatewayActual : workersActual;
    const chargedQuota = Math.min(reservation.requestedNeurons, quotaActual), chargedProvider = Math.min(reservation.billingCeilingNeurons, providerActual);
    const settlement = await settle(env, reservation, chargedQuota, chargedProvider);
    const updatedStatus = await capacityPost(env, '/members/status', { nodeId, userId: session.userId });
    const text = extractText(result), nativeStructured = structuredObject(result), parsedOutputJson = schema || input.responseFormat === 'json' ? (nativeStructured || parseStructured(text)) : null;
    if ((schema || input.responseFormat === 'json') && !parsedOutputJson) {
      const diagnostics = { resultKeys: result && typeof result === 'object' ? Object.keys(result).slice(0, 20) : [], responseType: Array.isArray(result?.response) ? 'array' : typeof result?.response, textLength: text.length, textPreview: clean(text, 600) };
      return json({ ok: false, error: 'Cloudflare AI did not return valid structured output.', code: 'CLOUDFLARE_STRUCTURED_OUTPUT_INVALID', model: route.route === 'ai-gateway-unified-billing' ? gateway.model : WORKERS_MODEL, computeRoute: route.route, diagnostics, usage: { ...usage, chargedNeurons: chargedQuota, providerNeurons: chargedProvider }, settlement, quota: updatedStatus.quota }, 502);
    }
    const model = route.route === 'ai-gateway-unified-billing' ? gateway.model : WORKERS_MODEL;
    const provenance = generationProvenance(model, route.route, input);
    const outputJson = stampStructuredOutput(parsedOutputJson, provenance.artifact);
    return json({ ok: true, schema: 'civweave.cloud-generation.v2', nodeId, userId: session.userId, model, computeRoute: route.route, pool: route.pool, text: text || (outputJson ? JSON.stringify(outputJson) : ''), outputJson, metadata: { generation: provenance.generation }, usage: { ...usage, chargedNeurons: chargedQuota, providerNeurons: chargedProvider }, settlement, quota: updatedStatus.quota });
  } catch (error) { await settle(env, reservation, 0, 0).catch(() => {}); return json({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 502); }
}

async function hashCredential(value) {
  const secret = clean(value, 400);
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(secret)) throw Object.assign(new TypeError('A valid device login credential is required.'), { status: 400 });
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`civweave.host-login-credential.v1\n${secret}`));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function residentId(value) { const id = clean(value, 180); if (!/^[A-Za-z0-9:_-]{12,180}$/.test(id)) throw Object.assign(new TypeError('A valid device resident id is required.'), { status: 400 }); return id; }
function nodeOrigin(nodeId, env) { return `https://${nodeId}.${clean(env.NODE_DOMAIN, 255) || 'nodes.commonweave.earth'}`; }
async function signNode(env, nodeId, rawText) {
  const stub = env.NODES?.get(env.NODES.idFromName(nodeId));
  if (!stub) throw Object.assign(new Error('Node binding is unavailable.'), { status: 503 });
  const response = await stub.fetch('https://node.internal/internal/sign-request', { method: 'POST', headers: { 'content-type': 'application/json', 'x-civweave-node-id': nodeId }, body: rawText });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.signatureHeader) throw Object.assign(new Error(payload.error || 'Host node could not sign the membership request.'), { status: response.status || 503 });
  return payload.signatureHeader;
}
async function coreMembership(env, nodeId, body) {
  const rawText = JSON.stringify(body), signature = await signNode(env, nodeId, rawText);
  const init = { method: 'POST', headers: { 'content-type': 'application/json', 'x-civweave-node-signature': signature }, body: rawText };
  const response = env.CORE?.fetch ? await env.CORE.fetch('https://civweave-core.internal/api/money-edge/memberships', init) : await fetch(new URL('/api/money-edge/memberships', clean(env.CIVWEAVE_CORE_ORIGIN, 2000) || 'https://api.commonweave.earth'), init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || `Core returned HTTP ${response.status}.`), { status: response.status });
  return payload.membership;
}
async function beginMembership(request, env, nodeId) {
  try {
    const input = await request.json().catch(() => ({})), userId = residentId(input.userId), tierId = clean(input.tierId || 'member', 80).toLowerCase();
    if (!['member', 'maker', 'builder', 'steward'].includes(tierId)) throw Object.assign(new RangeError('Unknown Civweave membership tier.'), { status: 400 });
    const preparation = await capacityPost(env, '/members/prepare-membership', { nodeId, userId, loginCredentialHash: await hashCredential(input.credential) }), origin = nodeOrigin(nodeId, env);
    const membership = await coreMembership(env, nodeId, { nodeId, userId, tierId, idempotencyKey: `paid-seat:${nodeId}:${userId}:${tierId}`, successUrl: `${origin}/api/commerce/membership/return?result=success&nodeId=${encodeURIComponent(nodeId)}`, cancelUrl: `${origin}/api/commerce/membership/return?result=cancelled&nodeId=${encodeURIComponent(nodeId)}` });
    return json({ ok: true, schema: 'civweave.paid-seat-checkout.v1', nodeId, preparation, membership, checkout: membership }, 201);
  } catch (error) { return json({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 500); }
}
function returnToInstaller(request, env, nodeId) {
  const source = new URL(request.url), target = new URL('/', clean(env.CIVWEAVE_CANONICAL_INSTALL_ORIGIN, 2000) || 'https://civweave.pages.dev');
  target.searchParams.set('host', nodeOrigin(nodeId, env));
  target.searchParams.set('node', nodeId);
  target.searchParams.set('membership', source.searchParams.get('result') === 'success' ? 'success' : 'cancelled');
  return Response.redirect(target.href, 303);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url), nodeId = resolveNodeId(request, env);
    if (nodeId && request.method === 'OPTIONS' && (url.pathname.startsWith('/api/commerce/') || url.pathname === '/api/ai/node/generate')) return new Response(null, { status: 204, headers: AI_CORS });
    if (nodeId && request.method === 'POST' && url.pathname === '/api/ai/node/generate') return handleGenerate(request, env, nodeId);
    if (nodeId && request.method === 'POST' && url.pathname === '/api/commerce/membership/prejoin') return beginMembership(request, env, nodeId);
    if (nodeId && request.method === 'GET' && url.pathname === '/api/commerce/membership/return') return returnToInstaller(request, env, nodeId);
    return baseWorker.fetch(request, env, ctx);
  },
  async scheduled(controller, env, ctx) { if (typeof baseWorker.scheduled === 'function') return baseWorker.scheduled(controller, env, ctx); },
};