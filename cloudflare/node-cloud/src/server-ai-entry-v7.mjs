import baseWorker, {
  CivweaveCloudNode,
  CivweaveCapacityAccount,
  CivweaveAccountDirectory,
} from './server-ai-entry-v6.mjs';
import { nodeIdFromHostname, normalizeNodeId } from './index.mjs';
import {
  QWEN_HIGH_MODEL,
  chooseQwenHighCompute,
  qwenHighComputeIntent,
  qwenNeuronsForTokens,
} from './qwen-high-compute-policy-v1.mjs';

export { CivweaveCloudNode, CivweaveCapacityAccount, CivweaveAccountDirectory };

const MAX_GENERATION_TOKENS = 16_384;
const CORS = Object.freeze({
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, x-civweave-node-id',
  'access-control-max-age': '86400',
});
const clean = (value, max = 12_000) => String(value ?? '').trim().slice(0, max);
const json = (value, status = 200, headers = {}) => Response.json(value, { status, headers: { 'cache-control': 'no-store', ...CORS, ...headers } });

function requestNodeId(request, env) {
  const url = new URL(request.url);
  return normalizeNodeId(
    request.headers.get('x-civweave-node-id')
      || url.searchParams.get('nodeId')
      || nodeIdFromHostname(url.hostname, env.NODE_DOMAIN || 'nodes.commonweave.earth'),
  );
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
  if (!response.ok) throw Object.assign(new Error(payload.error || `Capacity returned HTTP ${response.status}.`), { status: response.status });
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
  return Object.freeze({
    inputTokens: Math.max(1, Math.ceil(chars / 3) + rows.length * 4),
    outputTokens: Math.max(32, Math.ceil(maxTokens * 1.15)),
  });
}
function usageTokens(result = {}, fallbackInputTokens = 0, outputText = '') {
  const usage = result?.usage || result?.usageMetadata || {};
  const rawInput = Number(usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokenCount ?? 0);
  const explicitOutput = usage.completion_tokens ?? usage.output_tokens;
  const rawOutput = explicitOutput != null
    ? Number(explicitOutput || 0)
    : Number(usage.candidatesTokenCount ?? 0) + Number(usage.thoughtsTokenCount ?? 0);
  const inputTokens = Number.isFinite(rawInput) && rawInput > 0 ? rawInput : Math.max(1, Number(fallbackInputTokens || 0));
  const outputTokens = Number.isFinite(rawOutput) && rawOutput > 0 ? rawOutput : Math.max(1, Math.ceil(String(outputText || '').length / 3));
  return Object.freeze({ inputTokens, outputTokens });
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
  if (result?.response != null) {
    try { return JSON.stringify(result.response); } catch {}
  }
  return '';
}
function boundedSchema(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const text = JSON.stringify(value);
  if (text.length > 24_000) throw Object.assign(new RangeError('Response schema is too large.'), { status: 400 });
  return JSON.parse(text);
}
function structuredObject(result) {
  const candidates = [result?.response, result?.result?.response, result?.output, result?.outputJson, result?.choices?.[0]?.message?.parsed];
  for (const candidate of candidates) if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) return candidate;
  return null;
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
function stampStructuredOutput(outputJson, provenance) {
  if (!outputJson || typeof outputJson !== 'object' || Array.isArray(outputJson)) return outputJson;
  const metadata = outputJson.metadata && typeof outputJson.metadata === 'object' && !Array.isArray(outputJson.metadata) ? outputJson.metadata : {};
  const existing = metadata.civweaveProvenance && typeof metadata.civweaveProvenance === 'object' && !Array.isArray(metadata.civweaveProvenance) ? metadata.civweaveProvenance : null;
  return { ...outputJson, metadata: { ...metadata, civweaveProvenance: existing?.origin && existing.origin !== 'unknown' ? existing : provenance } };
}
async function authenticatedMember(request, env, ctx, nodeId) {
  const source = new URL(request.url), sessionUrl = new URL('/api/ai/node/session', source.origin);
  sessionUrl.searchParams.set('nodeId', nodeId);
  const headers = new Headers({ accept: 'application/json', 'x-civweave-node-id': nodeId });
  const authorization = clean(request.headers.get('authorization'), 20_000);
  if (authorization) headers.set('authorization', authorization);
  const response = await baseWorker.fetch(new Request(sessionUrl, { method: 'GET', headers }), env, ctx);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || 'Guild member session is invalid.'), { status: response.status || 401 });
  const userId = clean(payload.userId || payload.member?.userId, 180);
  if (!userId) throw Object.assign(new Error('Guild member session did not resolve a resident.'), { status: 401 });
  return Object.freeze({ nodeId, userId });
}
async function digestKey(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || ''))));
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function enforceHighComputeRate(request, env, nodeId) {
  if (!env.GUILD_AI_RATE_LIMITER?.limit) return null;
  const authorization = clean(request.headers.get('authorization'), 20_000);
  const actor = authorization ? `${nodeId}:auth:${await digestKey(authorization)}` : `${nodeId}:anonymous`;
  const result = await env.GUILD_AI_RATE_LIMITER.limit({ key: `ai:${actor}` });
  if (result?.success) return null;
  return json({ ok: false, error: 'Guild request rate limit exceeded.', code: 'CIVWEAVE_GUILD_RATE_LIMIT', kind: 'ai', retryAfter: 60 }, 429, { 'retry-after': '60', 'access-control-expose-headers': 'retry-after' });
}
async function reserveQwen(env, member, selection) {
  return (await capacityPost(env, '/usage/reserve', {
    nodeId: member.nodeId,
    userId: member.userId,
    requestedNeurons: selection.estimatedNeurons,
    billingCeilingNeurons: selection.estimatedNeurons,
    billingRail: selection.route,
    fundingSource: selection.pool,
    billingModel: QWEN_HIGH_MODEL,
    allowLifetimeCredits: selection.allowLifetimeCredits === true,
  })).reservation;
}
async function settleQwen(env, reservation, neurons) {
  return capacityPost(env, '/usage/settle', {
    reservationId: reservation.reservationId,
    actualNeurons: neurons,
    actualBillingNeurons: neurons,
  });
}

async function handleQwenGenerate(request, env, ctx, nodeId, input) {
  let schema;
  try { schema = boundedSchema(input.responseSchema); }
  catch (error) { return json({ ok: false, error: String(error?.message || error) }, 400); }

  let member;
  try { member = await authenticatedMember(request, env, ctx, nodeId); }
  catch (error) { return json({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 401); }

  let memberStatus;
  try { memberStatus = await capacityPost(env, '/members/status', member); }
  catch (error) { return json({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 503); }

  const rows = messages(input);
  const maxTokens = Math.max(32, Math.min(MAX_GENERATION_TOKENS, Number(input.maxTokens) || 1024));
  const estimatedTokens = estimateTokens(rows, maxTokens);
  const selection = chooseQwenHighCompute({ input, estimatedTokens, memberStatus });
  if (!selection.selected) return null;

  const limited = await enforceHighComputeRate(request, env, nodeId);
  if (limited) return limited;

  let reservation;
  try { reservation = await reserveQwen(env, member, selection); }
  catch { return null; }

  const options = {
    messages: rows,
    max_completion_tokens: maxTokens,
    temperature: Math.max(0, Math.min(2, Number(input.temperature ?? 0.2))),
  };
  if (schema) options.response_format = { type: 'json_schema', json_schema: schema };
  else if (input.responseFormat === 'json') options.response_format = { type: 'json_object' };

  let result;
  try { result = await env.AI.run(QWEN_HIGH_MODEL, options); }
  catch {
    await settleQwen(env, reservation, 0).catch(() => {});
    return null;
  }

  const text = extractText(result);
  const usage = usageTokens(result, estimatedTokens.inputTokens, text);
  const actualNeurons = Math.min(reservation.requestedNeurons, qwenNeuronsForTokens(usage.inputTokens, usage.outputTokens));
  let settlement;
  try { settlement = await settleQwen(env, reservation, actualNeurons); }
  catch (error) {
    await settleQwen(env, reservation, 0).catch(() => {});
    return json({ ok: false, error: String(error?.message || error), code: 'QWEN_HIGH_COMPUTE_SETTLEMENT_FAILED' }, Number.isSafeInteger(error?.status) ? error.status : 502);
  }

  const updatedStatus = await capacityPost(env, '/members/status', member).catch(() => memberStatus);
  const parsedOutputJson = schema || input.responseFormat === 'json' ? (structuredObject(result) || parseStructured(text)) : null;
  if ((schema || input.responseFormat === 'json') && !parsedOutputJson) return json({
    ok: false,
    error: 'Qwen high-compute route did not return valid structured output.',
    code: 'QWEN_HIGH_COMPUTE_STRUCTURED_OUTPUT_INVALID',
    model: QWEN_HIGH_MODEL,
    computeRoute: selection.route,
    usage: { ...usage, chargedNeurons: actualNeurons, providerNeurons: actualNeurons },
    settlement,
    quota: updatedStatus?.quota,
  }, 502);

  const generatedAt = new Date().toISOString();
  const generation = Object.freeze({
    schema: 'civweave.generation-provenance.v1',
    kind: 'ai-generated',
    aiGenerated: true,
    provider: 'cloudflare-workers-ai',
    model: QWEN_HIGH_MODEL,
    requestId: clean(input.requestId, 180),
    purpose: clean(input.purpose || 'cloud-generation', 180),
    generatedAt,
  });
  const artifactProvenance = Object.freeze({
    schema: 'civweave.content-provenance.v1',
    origin: 'ai-generated',
    aiGenerated: true,
    createdAt: generatedAt,
    sourceSystem: 'civweave-cloud-generation',
    artifactType: 'structured-model-output',
    generation,
    humanValidations: [],
  });
  const outputJson = stampStructuredOutput(parsedOutputJson, artifactProvenance);
  return json({
    ok: true,
    schema: 'civweave.cloud-generation.v2',
    nodeId,
    userId: member.userId,
    model: QWEN_HIGH_MODEL,
    computeRoute: selection.route,
    pool: selection.pool,
    text: text || (outputJson ? JSON.stringify(outputJson) : ''),
    outputJson,
    metadata: {
      generation,
      highCompute: {
        schema: selection.schema,
        reason: selection.reason,
        lifetimeCreditsAllowed: selection.allowLifetimeCredits === true,
        estimatedNeurons: selection.estimatedNeurons,
      },
    },
    usage: { ...usage, chargedNeurons: actualNeurons, providerNeurons: actualNeurons },
    settlement,
    quota: updatedStatus?.quota,
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/api/ai/node/generate') {
      const nodeId = requestNodeId(request, env);
      if (nodeId) {
        const input = await request.clone().json().catch(() => ({}));
        if (qwenHighComputeIntent(input)) {
          const response = await handleQwenGenerate(request, env, ctx, nodeId, input);
          if (response) return response;
        }
      }
    }
    return baseWorker.fetch(request, env, ctx);
  },
  async scheduled(controller, env, ctx) {
    if (typeof baseWorker.scheduled === 'function') return baseWorker.scheduled(controller, env, ctx);
  },
};
