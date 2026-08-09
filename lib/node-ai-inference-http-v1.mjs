import { verifyAiCapability } from './ai-capability-token-v1.mjs';

const API_SCHEMA = 'civweave.node-ai-inference-http.v1';
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

function sendJson(res, status, payload) {
  const bytes = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': bytes.length,
    'cache-control': 'no-store'
  });
  res.end(bytes);
}
async function readJson(req, limit = 2 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Inference request body too large.'), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Invalid inference request JSON.'), { status: 400 }); }
}
function statusFor(error) {
  if (Number.isSafeInteger(error?.status)) return error.status;
  const message = String(error?.message || '');
  if (/no implementation handler|does not advertise|No node AI wallet/i.test(message)) return 404;
  if (error instanceof TypeError || error instanceof RangeError || /exceeds|insufficient|unsupported/i.test(message)) return 400;
  if (/capability|signature|bound to|expired|revoked|wallet update|malformed/i.test(message)) return 401;
  if (/invalid/i.test(message)) return 400;
  return 500;
}

export function createNodeAiInferenceHttpHandler({ ledger, manifest, inferenceGate = null, capabilitySecret = '', now = () => Date.now() } = {}) {
  function status() {
    return Object.freeze({
      schema: API_SCHEMA,
      nodeId: manifest?.nodeId || null,
      ready: Boolean(ledger && manifest && inferenceGate && capabilitySecret),
      services: manifest?.services?.map(service => service.id) || []
    });
  }

  async function handle(req, res, url) {
    const pathname = decodeURIComponent(url.pathname);
    if (pathname !== '/api/ai/node/inference') return false;
    if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
    if (!ledger || !manifest || !inferenceGate || !capabilitySecret) {
      sendJson(res, 503, { error: 'This node has not attached an AI service implementation package.', inference: status() });
      return true;
    }

    try {
      const input = await readJson(req);
      const serviceId = clean(input.serviceId, 120);
      if (!serviceId) throw new TypeError('serviceId is required.');
      const capabilityToken = clean(req.headers['x-civweave-ai-capability'], 16_000);
      if (!capabilityToken) throw new Error('A node AI capability is required.');
      const deviceId = clean(input.deviceId, 180) || undefined;
      let capability = verifyAiCapability(capabilityToken, {
        secret: capabilitySecret,
        nowMs: now(),
        deviceId,
        nodeId: manifest.nodeId,
        serviceId
      });
      const wallet = ledger.getWallet(capability.sub);
      if (!wallet) throw new RangeError(`No node AI wallet exists for ${capability.sub}.`);
      capability = verifyAiCapability(capabilityToken, {
        secret: capabilitySecret,
        nowMs: now(),
        deviceId,
        nodeId: manifest.nodeId,
        serviceId,
        expectedWalletVersion: wallet.walletVersion
      });
      const execution = await inferenceGate.execute({
        userId: capability.sub,
        serviceId,
        request: input.request,
        requestId: clean(input.requestId, 180) || undefined,
        retailCeilingCents: capability.maxRetailCostCents,
        metadata: {
          source: 'node-ai-http-v1',
          deviceId: capability.device,
          capabilityId: capability.jti
        }
      });
      sendJson(res, 200, {
        schema: API_SCHEMA,
        nodeId: manifest.nodeId,
        serviceId,
        output: execution.output,
        retailCostCents: execution.retailCostCents,
        wallet: execution.wallet,
        receipt: execution.receipt
      });
    } catch (error) {
      const statusCode = statusFor(error);
      sendJson(res, statusCode, { error: statusCode === 500 ? 'Node AI inference failed.' : clean(error?.message || error, 1000) });
    }
    return true;
  }

  return Object.freeze({ status, handle });
}
