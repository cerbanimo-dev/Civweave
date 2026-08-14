import baseWorker, { CivweaveCloudNode, CivweaveCapacityAccount, allowedCampusOrigin, campusCorsHeaders } from './entry.mjs';
import { nodeIdFromHostname, normalizeNodeId } from './index.mjs';
import { estimateGenerationNeurons, selectWorkersAiModel } from './model-router-v1.mjs';

export { CivweaveCloudNode, CivweaveCapacityAccount };

const enc = new TextEncoder();
const dec = new TextDecoder();
const SESSION_DOMAIN = 'civweave.capacity-session.v1';
const DEFAULT_CORE_ORIGIN = 'https://api.commonweave.earth';
const MEMBERSHIP_TIERS = Object.freeze({
  member: Object.freeze({ id: 'member', serviceAmountCents: 500, monthlyLifetimeCredits: 100_000 }),
  maker: Object.freeze({ id: 'maker', serviceAmountCents: 1_000, monthlyLifetimeCredits: 250_000 }),
  builder: Object.freeze({ id: 'builder', serviceAmountCents: 2_000, monthlyLifetimeCredits: 600_000 }),
  steward: Object.freeze({ id: 'steward', serviceAmountCents: 4_000, monthlyLifetimeCredits: 1_500_000 }),
});

const clean = (value, max = 12_000) => String(value ?? '').trim().slice(0, max);
const json = (value, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'no-store' } });
function withCampusCors(response, request) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(campusCorsHeaders(request))) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
function isBrowserEdgeRoute(pathname) {
  return pathname === '/api/ai/node/generate' || pathname.startsWith('/api/commerce/');
}
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
function actualNeurons(usage = {}, model) {
  const input = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const output = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  if (!Number.isFinite(input) || !Number.isFinite(output)) return 1;
  return estimateGenerationNeurons(input, output, model);
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
function generationEstimate(rows, maxTokens, modelRoute, structured = false) {
  const chars = rows.reduce((sum, row) => sum + row.content.length, 0);
  const inputTokens = Math.ceil(chars / 4);
  const outputTokens = Math.max(32, Math.min(4096, Number(maxTokens) || 1024));
  let models = Array.isArray(modelRoute?.pipeline) && modelRoute.pipeline.length ? [...modelRoute.pipeline] : [modelRoute?.model];
  if (structured && modelRoute?.tier === 'smart') models.push(models[0]);
  const estimate = models.reduce((sum, model) => sum + estimateGenerationNeurons(inputTokens, outputTokens, model), 0);
  return Math.max(4, Math.min(1_000, estimate + models.length * 3));
}
function boundedSchema(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const text = JSON.stringify(value);
  if (text.length > 24_000) throw Object.assign(new RangeError('Response schema is too large.'), { status: 400 });
  return JSON.parse(text);
}
function extractText(result) {
  if (typeof result === 'string') return result;
  for (const value of [result?.output_text, result?.response, result?.text, result?.result?.response]) if (typeof value === 'string' && value.trim()) return value;
  const choice = Array.isArray(result?.choices) ? result.choices[0] : null;
  if (typeof choice?.message?.content === 'string' && choice.message.content.trim()) return choice.message.content;
  if (Array.isArray(choice?.message?.content)) {
    const text = choice.message.content.map(item => typeof item === 'string' ? item : item?.text || item?.content || '').filter(Boolean).join('\n');
    if (text.trim()) return text;
  }
  if (Array.isArray(result?.output)) {
    const text = result.output.flatMap(item => Array.isArray(item?.content) ? item.content : [item]).map(item => typeof item === 'string' ? item : item?.text || item?.output_text || item?.content || '').filter(Boolean).join('\n');
    if (text.trim()) return text;
  }
  if (result?.response && typeof result.response === 'object') return extractText(result.response);
  if (result?.result && typeof result.result === 'object') return extractText(result.result);
  return '';
}
function parseStructured(text) {
  const source = clean(text, 5_000_000).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try { return JSON.parse(source); } catch { return null; }
}
function completionOptions(model, rows, maxTokens, temperature, schema, responseFormat, tier) {
  const options = { messages: rows, temperature };
  if (model === '@cf/qwen/qwen2.5-coder-32b-instruct') options.max_tokens = maxTokens;
  else options.max_completion_tokens = maxTokens;
  if (model !== '@cf/qwen/qwen2.5-coder-32b-instruct') options.reasoning_effort = tier === 'deep' ? 'high' : 'low';
  if (schema) options.response_format = { type: 'json_schema', json_schema: schema };
  else if (responseFormat === 'json') options.response_format = { type: 'json_object' };
  return options;
}
function validateCompletion(text, schema, responseFormat) {
  const value = clean(text, 5_000_000);
  if (!value) return { ok: false, reason: 'empty completion', outputJson: null };
  const outputJson = schema || responseFormat === 'json' ? parseStructured(value) : null;
  if ((schema || responseFormat === 'json') && !outputJson) return { ok: false, reason: 'invalid structured output', outputJson: null };
  if (/\b(?:cannot|unable to) (?:complete|perform|answer)\b/i.test(value) && value.length < 800) return { ok: false, reason: 'model refusal', outputJson };
  return { ok: true, reason: 'response contract passed', outputJson };
}
async function handleGenerate(request, env, nodeId) {
  if (!env.AI) return json({ ok: false, error: 'Workers AI binding is unavailable.' }, 503);
  let session;
  try { session = await verifyCapacitySession(env, bearer(request), nodeId); }
  catch (error) { return json({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 401); }
  const input = await request.json().catch(() => ({}));
  const rows = messages(input);
  const maxTokens = Math.max(32, Math.min(4096, Number(input.maxTokens) || 1024));
  const modelRoute = selectWorkersAiModel({ ...input, messages: rows, workersPlan: env.CIVWEAVE_WORKERS_PLAN || 'free' });
  if (modelRoute.model === '@cf/moonshotai/kimi-k2.7-code') {
    const approval = input.modelApproval && typeof input.modelApproval === 'object' ? input.modelApproval : {};
    const approved = approval.approved === true
      && approval.scope === 'single-request'
      && approval.model === modelRoute.model
      && approval.warningShown === true;
    if (!approved) return json({
      ok: false,
      code: 'KIMI_APPROVAL_REQUIRED',
      error: 'Kimi Code is a high-cost specialist route and requires approval for this request before any inference call.',
      model: modelRoute.model,
      modelRoute,
    }, 428);
  }
  const requestedNeurons = generationEstimate(rows, maxTokens, modelRoute, Boolean(input.responseSchema || input.responseFormat === 'json'));
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
    const basePipeline = Array.isArray(modelRoute.pipeline) && modelRoute.pipeline.length ? [...modelRoute.pipeline] : [modelRoute.model];
    const pipeline = (schema || input.responseFormat === 'json') && modelRoute.tier === 'smart' ? [basePipeline[0], basePipeline[0]] : basePipeline;
    const attempted = [];
    let result = null, text = '', outputJson = null, selectedModel = modelRoute.model, chargedNeurons = 0, lastError = null, passed = false;
    for (let index = 0; index < pipeline.length; index += 1) {
      const model = pipeline[index];
      if (model === '@cf/openai/gpt-oss-120b' && modelRoute.tier === 'code' && !modelRoute.requirements.complex) break;
      try {
        const repairRetry = index > 0 && pipeline[index - 1] === model && modelRoute.tier === 'smart';
        const attemptRows = repairRetry ? [...rows, { role: 'user', content: 'The prior attempt did not pass the response contract. Return one complete valid JSON object only, with every requested field and no markdown fence.' }] : rows;
        result = await env.AI.run(model, completionOptions(model, attemptRows, maxTokens, Math.max(0, Math.min(2, Number(input.temperature ?? 0.2))), schema, input.responseFormat, model === '@cf/openai/gpt-oss-120b' ? 'deep' : modelRoute.tier));
        chargedNeurons += actualNeurons(result?.usage, model);
        text = extractText(result);
        const validation = validateCompletion(text, schema, input.responseFormat);
        const specialistEscalation = modelRoute.tier === 'code' && modelRoute.variant === 'standard' && index === 0 && modelRoute.requirements.patchHeavy;
        attempted.push({ model, status: validation.ok && !specialistEscalation ? 'passed' : 'failed-validation', validation: specialistEscalation ? 'patch/debug-heavy task requires the code-specialist validation pass' : validation.reason, repairRetry });
        if (validation.ok && !specialistEscalation) { selectedModel = model; outputJson = validation.outputJson; passed = true; break; }
      } catch (error) {
        lastError = error;
        attempted.push({ model, status: 'provider-error', validation: clean(error?.message || error, 500) });
      }
    }
    chargedNeurons = Math.min(reservation.requestedNeurons, chargedNeurons);
    const settlement = await capacityPost(env, '/usage/settle', { reservationId: reservation.reservationId, actualNeurons: chargedNeurons });
    const routed = { ...modelRoute, selectedModel, attempted };
    if (!passed) return json({ ok: false, error: clean(lastError?.message || 'Workers AI pipeline did not produce a completion that passed validation.'), model: selectedModel, modelRoute: routed, usage: { ...(result?.usage || {}), chargedNeurons }, settlement }, 502);
    return json({
      ok: true,
      schema: 'civweave.cloud-generation.v1',
      nodeId,
      userId: session.userId,
      model: selectedModel,
      modelRoute: routed,
      text,
      outputJson,
      usage: { ...(result?.usage || {}), chargedNeurons },
      settlement,
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
  return normalizeNodeId(request.headers.get('x-civweave-node-id') || nodeIdFromHostname(url.hostname, domain));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url), nodeId = resolveNodeId(request, env);
    if (isBrowserEdgeRoute(url.pathname) && request.headers.get('origin') && !allowedCampusOrigin(request)) return json({ ok: false, error: 'origin-not-allowed' }, 403);
    if (isBrowserEdgeRoute(url.pathname) && request.method === 'OPTIONS') return withCampusCors(new Response(null, { status: 204 }), request);
    if (nodeId && request.method === 'POST' && url.pathname === '/api/ai/node/generate') return withCampusCors(await handleGenerate(request, env, nodeId), request);
    if (nodeId && url.pathname === '/api/commerce/options') return withCampusCors(await handleCommerce(request, env, nodeId, 'options'), request);
    if (nodeId && url.pathname === '/api/commerce/topup') return withCampusCors(await handleCommerce(request, env, nodeId, 'topup'), request);
    if (nodeId && url.pathname === '/api/commerce/membership') return withCampusCors(await handleCommerce(request, env, nodeId, 'membership'), request);
    return baseWorker.fetch(request, env, ctx);
  },
  async scheduled(controller, env, ctx) {
    if (typeof baseWorker.scheduled === 'function') return baseWorker.scheduled(controller, env, ctx);
  },
};
