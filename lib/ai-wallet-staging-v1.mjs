import crypto from 'node:crypto';
import { getAiPlan } from './ai-wallet-policy-v1.mjs';
import { verifyAiCapability } from './ai-capability-token-v1.mjs';
import { verifyAiWalletSession } from './ai-wallet-auth-v1.mjs';
import { registerWalletDeviceAndIssueSession, revokeWalletDevice } from './ai-wallet-account-v1.mjs';

export const AI_WALLET_STAGING_SCHEMA = 'commonweave.ai-wallet-staging.v1';
const MAX_BODY_BYTES = 128 * 1024;
const MODEL_COSTS = Object.freeze({
  'gemini-flash-lite': { base: 1, inputCharsPerCent: 8000, outputCharsPerCent: 5000 },
  'gemini-flash': { base: 2, inputCharsPerCent: 5000, outputCharsPerCent: 3000 },
  'gemini-pro': { base: 5, inputCharsPerCent: 2500, outputCharsPerCent: 1500 },
  'gemini-live': { base: 8, inputCharsPerCent: 1500, outputCharsPerCent: 1000 }
});

function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}
function secretReady(value) {
  return Buffer.byteLength(clean(value, 10000)) >= 32;
}
function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function bearer(req) {
  const header = String(req.headers.authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}
function sendJson(res, status, payload, headers = {}) {
  const bytes = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': bytes.length,
    'cache-control': 'no-store',
    ...headers
  });
  res.end(bytes);
}
async function readRaw(req, limit = MAX_BODY_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Request body too large.'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function readJson(req, limit = MAX_BODY_BYTES) {
  const raw = await readRaw(req, limit);
  if (!raw.length) return {};
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    throw Object.assign(new Error('Invalid JSON body.'), { status: 400 });
  }
}
function requireStagingUser(value) {
  const userId = clean(value, 180);
  if (!/^staging:[a-z0-9][a-z0-9._:@-]{2,170}$/i.test(userId)) {
    throw new TypeError('Staging wallet userId must use the staging: namespace.');
  }
  return userId;
}
function requireDevice(value) {
  const deviceId = clean(value, 180);
  if (!/^[a-z0-9][a-z0-9._:@-]{2,170}$/i.test(deviceId)) throw new TypeError('A valid deviceId is required.');
  return deviceId;
}
function requirePositiveCents(value, label = 'amountCents', maximum = 10000) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new TypeError(`${label} must be an integer between 1 and ${maximum}.`);
  }
  return value;
}
function publicPlan(plan) {
  return {
    id: plan.id,
    label: plan.label,
    maxRequestCents: plan.maxRequestCents,
    dailyHostedLimitCents: plan.dailyHostedLimitCents,
    allowedHostedModels: [...plan.allowedHostedModels]
  };
}
function publicWallet(wallet) {
  if (!wallet) return null;
  const plan = getAiPlan(wallet.planId);
  return {
    schema: wallet.schema,
    walletId: wallet.walletId,
    userId: wallet.userId,
    plan: publicPlan(plan),
    balanceCents: wallet.balanceCents,
    reservedCents: wallet.reservedCents,
    availableCents: Math.max(0, wallet.balanceCents - wallet.reservedCents),
    debtCents: wallet.debtCents || 0,
    dailySpentCents: wallet.dailySpentCents,
    dailyWindow: wallet.dailyWindow,
    walletVersion: wallet.walletVersion,
    updatedAt: wallet.updatedAt
  };
}
function errorStatus(error) {
  if (Number.isSafeInteger(error?.status)) return error.status;
  const message = String(error?.message || '');
  if (/session|signature|credential|authorization|registered|revoked|staging key/i.test(message)) return 401;
  if (/No hosted-AI wallet|Unknown reservation/i.test(message)) return 404;
  if (/Insufficient|daily hosted-AI limit|unpaid refund|chargeback/i.test(message)) return 402;
  if (error instanceof TypeError || error instanceof RangeError || /invalid|malformed|exceeds|not enabled|not allowed/i.test(message)) return 400;
  return 500;
}
function safeError(error) {
  const status = errorStatus(error);
  return {
    status,
    body: { error: status === 500 ? 'Staging hosted-AI request failed.' : clean(error?.message || 'Staging hosted-AI request failed.', 1000) }
  };
}
function requireMethod(req, method) {
  if (req.method !== method) throw Object.assign(new Error('Method not allowed.'), { status: 405 });
}
function deterministicChunks({ model, promptLength, maxOutputCharacters }) {
  const message = [
    'Simulated hosted AI completed through the Commonweave staging gateway.',
    `Model policy: ${model}.`,
    `Request size: ${promptLength} characters.`,
    `Output ceiling: ${maxOutputCharacters} characters.`,
    'No provider credential was used and no prompt body was logged.'
  ].join(' ');
  const words = message.split(/(\s+)/).filter(Boolean);
  const chunks = [];
  let current = '';
  for (const word of words) {
    if ((current + word).length > 48 && current) {
      chunks.push(current);
      current = '';
    }
    current += word;
  }
  if (current) chunks.push(current);
  return chunks;
}

export function estimateStagingRequest({ prompt, model, maxOutputCharacters = 1200, planId }) {
  const text = String(prompt ?? '');
  if (!text.trim()) throw new TypeError('prompt is required.');
  if (text.length > 20000) throw new RangeError('Staging prompts are limited to 20000 characters.');
  if (!Number.isSafeInteger(maxOutputCharacters) || maxOutputCharacters < 100 || maxOutputCharacters > 12000) {
    throw new RangeError('maxOutputCharacters must be between 100 and 12000.');
  }
  const plan = getAiPlan(planId);
  const modelId = clean(model, 120);
  if (!plan.allowedHostedModels.includes(modelId)) throw new RangeError(`Model ${modelId} is not enabled for the ${plan.id} plan.`);
  const rate = MODEL_COSTS[modelId];
  if (!rate) throw new RangeError(`No staging price card exists for ${modelId}.`);
  const rawMaximum = rate.base + Math.ceil(text.length / rate.inputCharsPerCent) + Math.ceil(maxOutputCharacters / rate.outputCharsPerCent);
  if (rawMaximum > plan.maxRequestCents) throw new RangeError(`Estimated request exceeds the ${plan.id} per-request limit.`);
  const actualCostCents = Math.max(1, Math.min(rawMaximum, Math.ceil(rawMaximum * 0.6)));
  return Object.freeze({
    schema: 'commonweave.ai-staging-estimate.v1',
    priceCard: 'staging-deterministic-r1',
    model: modelId,
    promptCharacters: text.length,
    maxOutputCharacters,
    maximumCostCents: rawMaximum,
    simulatedActualCostCents: actualCostCents
  });
}

export function createAiWalletStagingHandler({
  walletService,
  requested = false,
  authSecret = '',
  capabilitySecret = '',
  stagingSecret = '',
  allowFile = false,
  now = () => Date.now()
} = {}) {
  const missing = [];
  if (!walletService) missing.push('wallet service');
  if (!secretReady(authSecret)) missing.push('AI_WALLET_AUTH_SECRET');
  if (!secretReady(capabilitySecret)) missing.push('AI_WALLET_CAPABILITY_SECRET');
  if (!secretReady(stagingSecret)) missing.push('AI_WALLET_STAGING_SECRET');
  const postgres = walletService?.storage === 'neon-postgres-ledger';
  if (walletService && !postgres && !allowFile) missing.push('Postgres staging storage');
  const enabled = Boolean(requested && missing.length === 0);

  function status() {
    return Object.freeze({
      schema: AI_WALLET_STAGING_SCHEMA,
      requested: Boolean(requested),
      enabled,
      storage: walletService?.storage || 'unavailable',
      postgresRequired: !allowFile,
      simulatedProvider: true,
      realProviderCredentialUsed: false,
      previewUrl: '/ai-wallet-preview-v1.html',
      missing: [...missing]
    });
  }
  function requireStagingKey(req) {
    const supplied = clean(req.headers['x-commonweave-staging-key'], 10000);
    if (!constantTimeEqual(supplied, stagingSecret)) throw new Error('Invalid Commonweave staging key.');
  }
  async function requireSession(req) {
    const session = verifyAiWalletSession(bearer(req), {
      secret: authSecret,
      nowMs: now(),
      requiredRole: 'wallet:user'
    });
    requireStagingUser(session.sub);
    const active = await walletService.isDeviceActive({ userId: session.sub, deviceId: session.device });
    if (!active) throw new Error('Wallet device is not registered or has been revoked.');
    return session;
  }
  async function handleSimulate(req, res) {
    const session = await requireSession(req);
    const input = await readJson(req);
    const prompt = String(input.prompt ?? '');
    const wallet = await walletService.getWallet(session.sub);
    if (!wallet) throw new RangeError(`No hosted-AI wallet exists for ${session.sub}.`);
    const model = clean(input.model || getAiPlan(wallet.planId).allowedHostedModels[0], 120);
    const estimate = estimateStagingRequest({
      prompt,
      model,
      maxOutputCharacters: input.maxOutputCharacters || 1200,
      planId: wallet.planId
    });
    const capability = await walletService.issueCapability({
      userId: session.sub,
      deviceId: session.device,
      models: [model],
      maxRequestCents: estimate.maximumCostCents,
      ttlSeconds: 120
    });
    const verified = verifyAiCapability(capability, {
      secret: capabilitySecret,
      nowMs: now(),
      deviceId: session.device,
      model,
      estimatedCostCents: estimate.maximumCostCents,
      expectedWalletVersion: wallet.walletVersion
    });
    const reservationId = `staging:${crypto.randomUUID()}`;
    const requestId = `staging-request:${crypto.randomUUID()}`;
    const reserved = await walletService.reserve({
      userId: session.sub,
      reservationId,
      maxCostCents: estimate.maximumCostCents,
      model,
      ttlSeconds: 300,
      metadata: {
        staging: true,
        simulated: true,
        purpose: 'staging-simulated-inference',
        capabilityId: verified.jti,
        priceCard: estimate.priceCard,
        promptCharacters: estimate.promptCharacters,
        maxOutputCharacters: estimate.maxOutputCharacters
      }
    });
    res.writeHead(200, {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    });
    const write = value => res.write(`${JSON.stringify(value)}\n`);
    write({
      type: 'reservation',
      schema: AI_WALLET_STAGING_SCHEMA,
      reservationId,
      estimate,
      wallet: publicWallet(reserved)
    });
    const chunks = deterministicChunks({ model, promptLength: prompt.length, maxOutputCharacters: estimate.maxOutputCharacters });
    for (const text of chunks) write({ type: 'chunk', text });
    const settled = await walletService.settle({
      userId: session.sub,
      reservationId,
      actualCostCents: estimate.simulatedActualCostCents,
      requestId,
      metadata: {
        staging: true,
        simulated: true,
        provider: 'commonweave-deterministic-staging',
        priceCard: estimate.priceCard,
        reservedCents: estimate.maximumCostCents,
        actualCostCents: estimate.simulatedActualCostCents,
        promptCharacters: estimate.promptCharacters,
        maxOutputCharacters: estimate.maxOutputCharacters,
        promptStored: false
      }
    });
    write({
      type: 'receipt',
      receipt: {
        schema: 'commonweave.ai-staging-receipt.v1',
        requestId,
        reservationId,
        model,
        reservedCents: estimate.maximumCostCents,
        actualCostCents: estimate.simulatedActualCostCents,
        releasedCents: estimate.maximumCostCents - estimate.simulatedActualCostCents,
        simulated: true,
        providerCredentialUsed: false,
        at: new Date(now()).toISOString()
      },
      wallet: publicWallet(settled)
    });
    res.end();
  }

  async function handle(req, res, url) {
    const pathname = decodeURIComponent(url.pathname);
    if (!pathname.startsWith('/api/ai/staging')) return false;
    if (pathname === '/api/ai/staging/status') {
      if (req.method !== 'GET') sendJson(res, 405, { error: 'Method not allowed.' });
      else sendJson(res, 200, status());
      return true;
    }
    if (!enabled) {
      sendJson(res, 503, { error: 'Hosted AI staging preview is disabled or incomplete.', staging: status() });
      return true;
    }
    try {
      if (pathname === '/api/ai/staging/session') {
        requireMethod(req, 'POST');
        requireStagingKey(req);
        const input = await readJson(req);
        const userId = requireStagingUser(input.userId);
        const deviceId = requireDevice(input.deviceId);
        const ttlSeconds = Number.isSafeInteger(input.ttlSeconds) ? input.ttlSeconds : 3600;
        const token = await registerWalletDeviceAndIssueSession({
          walletService,
          userId,
          deviceId,
          publicKey: input.publicKey || null,
          label: clean(input.label || 'Hosted AI staging preview', 120),
          metadata: { ...(input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? input.metadata : {}), staging: true, passportId: clean(input.passportId, 180) },
          roles: ['wallet:user'],
          ttlSeconds
        }, { authSecret });
        sendJson(res, 201, {
          schema: 'commonweave.ai-wallet-session-envelope.v1',
          staging: true,
          session: token,
          userId,
          deviceId,
          expiresInSeconds: ttlSeconds
        });
        return true;
      }
      if (pathname === '/api/ai/staging/credits') {
        requireMethod(req, 'POST');
        requireStagingKey(req);
        const input = await readJson(req);
        const userId = requireStagingUser(input.userId);
        const amountCents = requirePositiveCents(input.amountCents);
        const planId = clean(input.planId || 'thread', 40).toLowerCase();
        getAiPlan(planId);
        if (planId === 'local') throw new RangeError('Staging test credits require a hosted plan.');
        const sourceId = clean(input.sourceId || `staging:test-credit:${crypto.randomUUID()}`, 180);
        if (!sourceId.startsWith('staging:')) throw new TypeError('Staging credit sourceId must use the staging: namespace.');
        const wallet = await walletService.credit({
          userId,
          amountCents,
          sourceId,
          planId,
          eventType: 'staging.test-credit',
          metadata: { staging: true, simulatedFunds: true, note: clean(input.note || 'Staging preview credit', 200) }
        });
        sendJson(res, 201, { schema: AI_WALLET_STAGING_SCHEMA, sourceId, wallet: publicWallet(wallet) });
        return true;
      }
      if (pathname === '/api/ai/staging/wallet') {
        requireMethod(req, 'GET');
        const session = await requireSession(req);
        await walletService.expireReservations({ userId: session.sub });
        const wallet = await walletService.getWallet(session.sub);
        if (!wallet) throw new RangeError(`No hosted-AI wallet exists for ${session.sub}.`);
        sendJson(res, 200, { schema: AI_WALLET_STAGING_SCHEMA, staging: true, deviceId: session.device, wallet: publicWallet(wallet) });
        return true;
      }
      if (pathname === '/api/ai/staging/receipts') {
        requireMethod(req, 'GET');
        const session = await requireSession(req);
        const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 20)));
        const entries = await walletService.listLedgerEntries({ userId: session.sub, limit });
        sendJson(res, 200, {
          schema: 'commonweave.ai-staging-receipts.v1',
          staging: true,
          receipts: entries.filter(entry => entry?.metadata?.staging === true || String(entry?.reservationId || '').startsWith('staging:'))
        });
        return true;
      }
      if (pathname === '/api/ai/staging/revoke') {
        requireMethod(req, 'POST');
        requireStagingKey(req);
        const input = await readJson(req);
        const userId = requireStagingUser(input.userId);
        const deviceId = requireDevice(input.deviceId);
        const revoked = await revokeWalletDevice(walletService, { userId, deviceId });
        sendJson(res, 200, { schema: AI_WALLET_STAGING_SCHEMA, userId, deviceId, revoked });
        return true;
      }
      if (pathname === '/api/ai/staging/simulate') {
        requireMethod(req, 'POST');
        await handleSimulate(req, res);
        return true;
      }
      sendJson(res, 404, { error: 'Unknown hosted AI staging route.' });
      return true;
    } catch (error) {
      const safe = safeError(error);
      if (!res.headersSent) sendJson(res, safe.status, safe.body);
      else {
        try { res.write(`${JSON.stringify({ type: 'error', error: safe.body.error })}\n`); } catch {}
        res.end();
      }
      return true;
    }
  }

  return Object.freeze({ status, handle });
}
