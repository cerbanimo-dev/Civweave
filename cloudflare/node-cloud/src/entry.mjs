import worker, {
  CivweaveCloudNode,
  CivweaveCapacityAccount,
  nodeIdFromHostname
} from './index.mjs';

export { CivweaveCloudNode, CivweaveCapacityAccount };

const enc = new TextEncoder();
const VALIDATION_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
const VALIDATION_INPUT_NEURONS_PER_MILLION = 4_119;
const VALIDATION_OUTPUT_NEURONS_PER_MILLION = 34_868;
const SESSION_DOMAIN = 'civweave.capacity-session.v1';
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const b64url = bytes => {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
};
const fromB64url = value => {
  const normalized = String(value).replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
};
const json = (value, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'no-store' } });

async function hmacKey(env) {
  const source = clean(env.NODE_FABRIC_OPERATOR_TOKEN, 10000);
  if (source.length < 24) throw Object.assign(new Error('Node fabric operator secret is unavailable for member sessions.'), { status: 503 });
  const material = await crypto.subtle.digest('SHA-256', enc.encode(`${SESSION_DOMAIN}\0${source}`));
  return crypto.subtle.importKey('raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function issueCapacitySession(env, member, domain) {
  const now = Math.floor(Date.now() / 1000);
  const payload = Object.freeze({
    v: 1,
    nodeId: clean(member?.nodeId, 180),
    userId: clean(member?.userId, 180),
    seatClass: clean(member?.seatClass, 40),
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    origin: `https://${clean(member?.nodeId, 180)}.${domain}`
  });
  if (!payload.nodeId || !payload.userId) throw Object.assign(new Error('Capacity session cannot be issued without nodeId and userId.'), { status: 500 });
  const encoded = b64url(enc.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(`${SESSION_DOMAIN}\n${encoded}`));
  return Object.freeze({
    schema: SESSION_DOMAIN,
    token: `${encoded}.${b64url(signature)}`,
    nodeId: payload.nodeId,
    userId: payload.userId,
    origin: payload.origin,
    expiresAt: new Date(payload.exp * 1000).toISOString()
  });
}
async function verifyCapacitySession(env, token, expectedNodeId) {
  const [encoded, signatureText, extra] = clean(token, 12000).split('.');
  if (!encoded || !signatureText || extra) throw Object.assign(new Error('Malformed member capacity session.'), { status: 401 });
  const valid = await crypto.subtle.verify('HMAC', await hmacKey(env), fromB64url(signatureText), enc.encode(`${SESSION_DOMAIN}\n${encoded}`));
  if (!valid) throw Object.assign(new Error('Invalid member capacity session.'), { status: 401 });
  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(fromB64url(encoded))); }
  catch { throw Object.assign(new Error('Malformed member capacity session payload.'), { status: 401 }); }
  const now = Math.floor(Date.now() / 1000);
  if (payload?.v !== 1 || !payload.nodeId || !payload.userId || !Number.isSafeInteger(payload.exp) || payload.exp <= now) throw Object.assign(new Error('Member capacity session expired or invalid.'), { status: 401 });
  if (payload.nodeId !== expectedNodeId) throw Object.assign(new Error('Member capacity session belongs to a different host node.'), { status: 403 });
  return payload;
}
function bearer(request) {
  const value = clean(request.headers.get('authorization'), 12000);
  return /^Bearer\s+/i.test(value) ? value.replace(/^Bearer\s+/i, '') : '';
}
function capacityStub(env) {
  if (!env.CAPACITY) throw Object.assign(new Error('Capacity Durable Object binding is unavailable.'), { status: 503 });
  return env.CAPACITY.get(env.CAPACITY.idFromName('civweave-account'));
}
async function capacityPost(env, pathname, body) {
  const response = await capacityStub(env).fetch(`https://capacity.internal${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || `Capacity service returned HTTP ${response.status}.`), { status: response.status });
  return payload;
}
function compactPacket(packet = {}) {
  return Object.freeze({
    id: clean(packet.id, 180),
    requestId: clean(packet.requestId, 180),
    submissionId: clean(packet.submissionId, 180),
    subjectTitle: clean(packet.subjectTitle || packet.title, 240),
    rubric: (Array.isArray(packet.rubric) ? packet.rubric : []).slice(0, 24).map(item => clean(item, 600)).filter(Boolean),
    evidenceSummary: clean(packet.evidenceSummary, 12000),
    evidenceArtifacts: (Array.isArray(packet.evidenceArtifacts) ? packet.evidenceArtifacts : []).slice(0, 24).map(item => ({
      id: clean(item?.id, 180),
      name: clean(item?.name, 240),
      contentHash: clean(item?.contentHash, 180),
      inlineText: clean(item?.inlineText, 8000),
      sourceRef: clean(item?.sourceRef, 1200)
    }))
  });
}
function validationEstimate(packet) {
  const text = `${packet.evidenceSummary}\n${packet.rubric.join('\n')}\n${packet.evidenceArtifacts.map(item => `${item.name}\n${item.inlineText}\n${item.sourceRef}`).join('\n')}`;
  return Math.max(24, Math.min(120, Math.ceil(18 + text.length / 700)));
}
function actualNeurons(usage = {}) {
  const input = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0), output = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  if (!Number.isFinite(input) || !Number.isFinite(output)) return 1;
  return Math.max(1, Math.ceil((input * VALIDATION_INPUT_NEURONS_PER_MILLION + output * VALIDATION_OUTPUT_NEURONS_PER_MILLION) / 1_000_000));
}
function parseModelResponse(result) {
  const raw = typeof result?.response === 'string' ? result.response : JSON.stringify(result?.response ?? result ?? {});
  try { return JSON.parse(raw); }
  catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw Object.assign(new Error('Cloud validator returned malformed structured output.'), { status: 502 });
    try { return JSON.parse(match[0]); }
    catch { throw Object.assign(new Error('Cloud validator returned malformed structured output.'), { status: 502 }); }
  }
}
function normalizeValidation(value, packet) {
  const verdict = ['pass', 'fail', 'uncertain'].includes(String(value?.verdict).toLowerCase()) ? String(value.verdict).toLowerCase() : 'uncertain';
  const rubric = packet.rubric;
  const byCriterion = new Map((Array.isArray(value?.rubricScores) ? value.rubricScores : []).map(item => [clean(item?.criterion, 600), item]));
  const rubricScores = rubric.map(criterion => {
    const source = byCriterion.get(criterion) || {};
    const score = Math.max(0, Math.min(1, Number(source.score ?? (source.met ? 1 : 0)) || 0));
    return Object.freeze({ criterion, met: Boolean(source.met), score, note: clean(source.note, 600) });
  });
  const confidence = Math.max(0, Math.min(1, Number(value?.confidence) || 0));
  let reason = clean(value?.reason || value?.rationale, 1800);
  if (reason.length < 24) reason = `${reason || 'Cloud rubric validation completed.'} Evidence and rubric were evaluated against the submitted packet.`;
  return Object.freeze({ verdict, confidence, reason, rubricScores });
}

async function handleValidation(request, env, nodeId) {
  if (!env.AI) return json({ ok: false, error: 'Workers AI binding is unavailable.' }, 503);
  let session;
  try { session = await verifyCapacitySession(env, bearer(request), nodeId); }
  catch (error) { return json({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 401); }
  const input = await request.json().catch(() => ({})), packet = compactPacket(input.packet || {});
  if (!packet.id || !packet.rubric.length) return json({ ok: false, error: 'Validation packet must include an id and rubric.' }, 400);
  const requestedNeurons = Math.max(validationEstimate(packet), Math.min(120, Number(input.estimatedNeurons) || 0));
  let reservation;
  try {
    reservation = (await capacityPost(env, '/usage/reserve', {
      nodeId,
      userId: session.userId,
      requestedNeurons,
      allowLifetimeCredits: input.allowLifetimeCredits === true
    })).reservation;
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 503);
  }

  try {
    const prompt = JSON.stringify(packet);
    const schema = {
      type: 'object',
      properties: {
        verdict: { type: 'string', enum: ['pass', 'fail', 'uncertain'] },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reason: { type: 'string' },
        rubricScores: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              criterion: { type: 'string' },
              met: { type: 'boolean' },
              score: { type: 'number', minimum: 0, maximum: 1 },
              note: { type: 'string' }
            },
            required: ['criterion', 'met', 'score', 'note'],
            additionalProperties: false
          }
        }
      },
      required: ['verdict', 'confidence', 'reason', 'rubricScores'],
      additionalProperties: false
    };
    const result = await env.AI.run(VALIDATION_MODEL, {
      messages: [
        {
          role: 'system',
          content: 'You are a conservative evidence validator. Judge only the supplied evidence against every rubric criterion. Pass only when every criterion is supported by inspected evidence. Fail when evidence contradicts or clearly misses a criterion. Use uncertain when evidence is insufficient. Do not invent facts.'
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_schema', json_schema: schema },
      max_tokens: 220,
      temperature: 0.1
    });
    const chargedNeurons = Math.min(reservation.requestedNeurons, actualNeurons(result?.usage));
    const settlement = await capacityPost(env, '/usage/settle', { reservationId: reservation.reservationId, actualNeurons: chargedNeurons });
    const validation = normalizeValidation(parseModelResponse(result), packet);
    return json({
      ok: true,
      schema: 'civweave.cloud-validation.v1',
      nodeId,
      userId: session.userId,
      model: VALIDATION_MODEL,
      validation,
      usage: { ...result?.usage, chargedNeurons },
      settlement
    });
  } catch (error) {
    await capacityPost(env, '/usage/settle', { reservationId: reservation.reservationId, actualNeurons: 0 }).catch(() => {});
    return json({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 502);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url), domain = env.NODE_DOMAIN || 'nodes.commonweave.earth', nodeId = nodeIdFromHostname(url.hostname, domain);
    if (nodeId && request.method === 'POST' && url.pathname === '/api/ai/node/validation') return handleValidation(request, env, nodeId);

    const admission = !nodeId && request.method === 'POST' && url.pathname === '/api/fabric/capacity/members/admit';
    const response = await worker.fetch(request, env, ctx);
    if (!admission || !response.ok) return response;
    const payload = await response.json().catch(() => null);
    if (!payload?.member) return json(payload || { ok: false, error: 'capacity-admission-response-invalid' }, 502);
    try {
      return json({ ...payload, capacitySession: await issueCapacitySession(env, payload.member, domain) }, response.status);
    } catch (error) {
      return json({ ...payload, capacitySession: null, sessionError: String(error?.message || error) }, response.status);
    }
  }
};
