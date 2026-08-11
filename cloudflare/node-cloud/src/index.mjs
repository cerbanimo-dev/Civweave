export { CivweaveCapacityAccount } from './capacity.mjs';

export const CLOUD_NODE_SCHEMA = 'civweave.node.v1';
export const CLOUD_NODE_RUNTIME = 'cloudflare-durable-object-v2';

const enc = new TextEncoder();
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
export const normalizeNodeId = value => clean(value, 120).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
function b64url(bytes) { const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes); let binary = ''; for (const byte of data) binary += String.fromCharCode(byte); return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, ''); }
function fromB64url(value) { const normalized = String(value).replaceAll('-', '+').replaceAll('_', '/'); const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4); const binary = atob(padded); return Uint8Array.from(binary, char => char.charCodeAt(0)); }
function derToPem(der) { const bytes = der instanceof Uint8Array ? der : new Uint8Array(der); let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); const base64 = btoa(binary); return `-----BEGIN PUBLIC KEY-----\n${(base64.match(/.{1,64}/g) || []).join('\n')}\n-----END PUBLIC KEY-----`; }
function pemToDer(pem) { const base64 = clean(pem, 20000).replace(/-----BEGIN PUBLIC KEY-----/g, '').replace(/-----END PUBLIC KEY-----/g, '').replace(/\s+/g, ''); if (!base64) throw new Error('Money-edge trust public key is invalid.'); const binary = atob(base64); return Uint8Array.from(binary, char => char.charCodeAt(0)); }
async function sha256Hex(value) { const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(value))); return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join(''); }
function concatBytes(...parts) { const arrays = parts.map(part => part instanceof Uint8Array ? part : new Uint8Array(part)); const out = new Uint8Array(arrays.reduce((sum, part) => sum + part.byteLength, 0)); let offset = 0; for (const part of arrays) { out.set(part, offset); offset += part.byteLength; } return out; }
function moneySignatureParts(header) {
  const values = Object.fromEntries(String(header || '').split(',').map(part => part.trim().split('=', 2)).filter(parts => parts.length === 2));
  const timestamp = Number(values.t), keyId = clean(values.kid, 120), signature = clean(values.sig, 2000);
  if (!Number.isSafeInteger(timestamp) || !keyId || !signature) throw Object.assign(new Error('Malformed money-edge event signature.'), { status: 401 });
  return { timestamp, keyId, signature };
}
async function verifyMoneyEdgeEvent(env, rawText, header) {
  if (!env.CORE) throw Object.assign(new Error('Core trust binding is unavailable.'), { status: 503 });
  const { timestamp, keyId, signature } = moneySignatureParts(header);
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) throw Object.assign(new Error('Money-edge event signature is outside the replay window.'), { status: 401 });
  const trustResponse = await env.CORE.fetch('https://civweave-core.internal/api/money-edge/trust', { headers: { accept: 'application/json' } });
  const envelope = await trustResponse.json().catch(() => ({}));
  if (!trustResponse.ok || !envelope?.trust?.publicKey) throw Object.assign(new Error('Core money-edge trust identity is unavailable.'), { status: 503 });
  if (clean(envelope.trust.keyId, 120) !== keyId) throw Object.assign(new Error('Money-edge event signing key is not trusted.'), { status: 401 });
  const publicKey = await crypto.subtle.importKey('spki', pemToDer(envelope.trust.publicKey), { name: 'Ed25519' }, false, ['verify']);
  const message = concatBytes(enc.encode(`civweave.money-edge-event.v1\n${timestamp}\n`), enc.encode(rawText));
  const valid = await crypto.subtle.verify({ name: 'Ed25519' }, publicKey, fromB64url(signature), message);
  if (!valid) throw Object.assign(new Error('Money-edge event signature is invalid.'), { status: 401 });
  return envelope.trust;
}

export function nodeIdFromHostname(hostname, domain = 'nodes.commonweave.earth') {
  const host = clean(hostname, 255).toLowerCase().split(':')[0], suffix = `.${domain}`;
  if (!host.endsWith(suffix)) return null;
  const candidate = host.slice(0, -suffix.length);
  if (!candidate || candidate.includes('.')) return null;
  return normalizeNodeId(candidate) || null;
}

export function buildCloudNodeManifest(nodeId, input = {}, domain = 'nodes.commonweave.earth') {
  const id = normalizeNodeId(nodeId); if (!id) throw new TypeError('nodeId is required.');
  const displayName = clean(input.displayName || id, 180);
  const capabilities = [...new Set((Array.isArray(input.capabilities) ? input.capabilities : ['discovery', 'pairing', 'relay', 'service-catalog']).map(item => clean(item, 120)).filter(Boolean))];
  return Object.freeze({
    schema: CLOUD_NODE_SCHEMA, nodeId: id, operatorId: clean(input.operatorId || `cerbanimo-cloud-${id}`, 180), displayName, runtime: CLOUD_NODE_RUNTIME,
    publicOrigin: `https://${id}.${domain}`, publicKey: clean(input.publicKey, 20000) || null, keyId: clean(input.keyId, 120) || null, capabilities,
    services: Array.isArray(input.services) ? input.services : [], transport: { publicHttps: true, webSocket: true, tunnelRequired: false, relayRequired: false },
    security: { stripePlatformSecretPresent: false, cerbanimoSigningPrivateKeyPresent: false, nodePrivateIdentityScope: 'durable-object-local' }, status: 'active', updatedAt: new Date().toISOString()
  });
}
function nodePage(manifest) { const esc = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); const caps = manifest.capabilities.map(cap => `<li>${esc(cap)}</li>`).join(''); return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(manifest.displayName)} · Civweave node</title><style>body{font:16px system-ui;background:#11152b;color:#f5f2ea;max-width:760px;margin:auto;padding:48px 22px}main{border:1px solid #6f77a8;border-radius:24px;padding:28px;background:#171d3a}code{color:#9de3cf}a{color:#f5ca77}</style></head><body><main><p>Civweave public host node</p><h1>${esc(manifest.displayName)}</h1><p><code>${esc(manifest.nodeId)}</code></p><p>Runtime: ${esc(manifest.runtime)}</p><h2>Capabilities</h2><ul>${caps}</ul><p><a href="/api/ai/node/manifest">Node manifest</a> · <a href="/api/ai/node/capacity">Capacity</a> · <a href="/api/node/health">Health</a></p></main></body></html>`; }

export class CivweaveCloudNode {
  constructor(state, env) { this.state = state; this.env = env; }
  async identity() {
    let identity = await this.state.storage.get('identity'); if (identity?.privateJwk?.d && identity?.publicKey) return identity;
    const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']), privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey), spki = await crypto.subtle.exportKey('spki', pair.publicKey), publicKey = derToPem(spki), fingerprint = await sha256Hex(publicKey);
    identity = { schema: 'civweave.node-cloud-identity.v1', privateJwk, publicKey, keyId: `node-${fingerprint.slice(0, 12)}`, fingerprint, createdAt: new Date().toISOString() };
    await this.state.storage.put('identity', identity); return identity;
  }
  async manifest(nodeId) {
    const identity = await this.identity(), stored = await this.state.storage.get('manifest');
    if (stored) { if (stored.publicKey === identity.publicKey && stored.keyId === identity.keyId) return stored; const repaired = buildCloudNodeManifest(nodeId, { ...stored, publicKey: identity.publicKey, keyId: identity.keyId }, this.env.NODE_DOMAIN || 'nodes.commonweave.earth'); await this.state.storage.put('manifest', repaired); return repaired; }
    const created = buildCloudNodeManifest(nodeId, { publicKey: identity.publicKey, keyId: identity.keyId }, this.env.NODE_DOMAIN || 'nodes.commonweave.earth'); await this.state.storage.put('manifest', created); return created;
  }
  async sign(domain, timestamp, raw) { const identity = await this.identity(), privateKey = await crypto.subtle.importKey('jwk', identity.privateJwk, { name: 'Ed25519' }, false, ['sign']), message = concatBytes(enc.encode(`${domain}\n${timestamp}\n`), raw instanceof Uint8Array ? raw : enc.encode(String(raw))), signature = await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, message); return { keyId: identity.keyId, signature: b64url(signature) }; }
  capacityStub() { if (!this.env.CAPACITY) throw Object.assign(new Error('Capacity binding is unavailable.'), { status: 503 }); return this.env.CAPACITY.get(this.env.CAPACITY.idFromName('civweave-account')); }
  async applyPaymentCapacity(nodeId, event) {
    if (!event?.userId) throw Object.assign(new TypeError('Payment event userId is required.'), { status: 400 });
    let pathname, body;
    if (event.type === 'topup.paid') {
      pathname = '/settlements/topup';
      body = { sourceId: event.id, nodeId, userId: event.userId, netServiceCents: Number(event.serviceNetCents || 0) };
      if (!Number.isSafeInteger(body.netServiceCents) || body.netServiceCents < 1) throw Object.assign(new RangeError('Paid top-up service net is invalid.'), { status: 400 });
    } else if (event.type === 'topup.refunded' || event.type === 'payment.chargeback') {
      pathname = '/settlements/topup-adjustment';
      body = { sourceId: event.id, nodeId, userId: event.userId, kind: event.type === 'topup.refunded' ? 'refund' : 'chargeback', userCreditCents: Number(event.userCreditCents || event.amountCents || 0) };
      if (!Number.isSafeInteger(body.userCreditCents) || body.userCreditCents < 1) return { skipped: true, reason: 'zero-credit-adjustment' };
    } else return { skipped: true, reason: 'not-a-capacity-payment-event' };
    const response = await this.capacityStub().fetch('https://capacity.internal' + pathname, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(result.error || `Capacity settlement returned HTTP ${response.status}`), { status: response.status });
    return result;
  }

  async fetch(request) {
    const url = new URL(request.url), nodeId = normalizeNodeId(request.headers.get('x-civweave-node-id') || url.searchParams.get('nodeId'));
    if (!nodeId) return json({ ok: false, error: 'node-id-missing' }, 400);
    const manifest = await this.manifest(nodeId);
    if (request.method === 'GET' && url.pathname === '/') return new Response(nodePage(manifest), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    if (request.method === 'GET' && (url.pathname === '/api/node/manifest' || url.pathname === '/api/ai/node/manifest')) return json({ manifest, marketplace: { schema: 'civweave.node-ai-http.v1', enabled: true, nodeId, runtime: CLOUD_NODE_RUNTIME } });
    if (request.method === 'GET' && url.pathname === '/api/node/health') return json({ schema: 'civweave.node-health.v1', ok: true, nodeId, runtime: CLOUD_NODE_RUNTIME, connections: this.state.getWebSockets?.().length || 0, updatedAt: manifest.updatedAt });
    if (request.method === 'POST' && url.pathname === '/api/ai/node/live/challenge') {
      const input = await request.json().catch(() => ({})); if (clean(input.nodeId, 180) !== nodeId || !/^[A-Za-z0-9_-]{32,200}$/.test(clean(input.challenge, 300))) return json({ error: 'invalid-challenge' }, 400);
      const signed = await this.sign('civweave.node-live-challenge.v1', 0, enc.encode(`${nodeId}\n${input.challenge}`)); return json({ schema: 'civweave.node-ai-live-commerce.v1', nodeId, keyId: signed.keyId, signature: signed.signature });
    }
    if (request.method === 'POST' && url.pathname === '/api/ai/node/live/payments/webhook') {
      const body = await request.text();
      try { await verifyMoneyEdgeEvent(this.env, body, request.headers.get('x-civweave-money-edge-signature')); }
      catch (error) { return json({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 401); }
      const events = await this.state.storage.get('payment-events') || []; let event;
      try { event = JSON.parse(body); } catch { return json({ error: 'invalid-payment-event-json' }, 400); }
      if (!event?.id || !event?.type) return json({ error: 'invalid-payment-event' }, 400);
      if (events.some(item => item.id === event.id)) return json({ ok: true, stored: true, duplicate: true, nodeId, eventId: event.id });
      let capacity;
      try { capacity = await this.applyPaymentCapacity(nodeId, event); }
      catch (error) { return json({ ok: false, error: String(error?.message || error), nodeId, eventId: event.id }, Number.isSafeInteger(error?.status) ? error.status : 503); }
      events.push({ id: event.id, type: event.type, receivedAt: new Date().toISOString(), payload: event, capacity }); while (events.length > 200) events.shift(); await this.state.storage.put('payment-events', events);
      return json({ ok: true, stored: true, nodeId, eventId: event.id, capacity });
    }
    if (request.method === 'GET' && url.pathname === '/api/node/socket') {
      if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return json({ ok: false, error: 'websocket-upgrade-required' }, 426);
      const pair = new WebSocketPair(), [client, server] = Object.values(pair); this.state.acceptWebSocket(server, ['civweave-node-client']); server.serializeAttachment?.({ nodeId, connectedAt: Date.now() }); server.send(JSON.stringify({ schema: 'civweave.node-socket.v1', type: 'welcome', nodeId })); return new Response(null, { status: 101, webSocket: client });
    }
    if (request.method === 'POST' && url.pathname === '/internal/configure') { const identity = await this.identity(), next = buildCloudNodeManifest(nodeId, { ...(await request.json()), publicKey: identity.publicKey, keyId: identity.keyId }, this.env.NODE_DOMAIN || 'nodes.commonweave.earth'); await this.state.storage.put('manifest', next); return json({ ok: true, manifest: next }); }
    if (request.method === 'POST' && url.pathname === '/internal/sign-request') { const raw = await request.text(), timestamp = Math.floor(Date.now() / 1000), signed = await this.sign('civweave.node-money-edge-request.v1', timestamp, enc.encode(raw)); return json({ keyId: signed.keyId, signatureHeader: `t=${timestamp},kid=${signed.keyId},sig=${signed.signature}` }); }
    return json({ ok: false, error: 'not-found' }, 404);
  }
  async webSocketMessage(ws, message) { const attachment = ws.deserializeAttachment?.() || {}; let payload; try { payload = typeof message === 'string' ? JSON.parse(message) : { type: 'binary' }; } catch { payload = { type: 'text', value: String(message) }; } if (payload?.type === 'ping') { ws.send(JSON.stringify({ schema: 'civweave.node-socket.v1', type: 'pong', nodeId: attachment.nodeId, at: Date.now() })); return; } ws.send(JSON.stringify({ schema: 'civweave.node-socket.v1', type: 'ack', nodeId: attachment.nodeId, receivedType: clean(payload?.type || 'message', 80) })); }
  webSocketClose(ws, code, reason) { try { ws.close(code, reason); } catch {} }
}

async function secretEqual(left, right) { if (!left || !right) return false; const [a, b] = await Promise.all([sha256Hex(left), sha256Hex(right)]); let diff = a.length ^ b.length; for (let i = 0; i < Math.min(a.length, b.length); i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff === 0; }
function nodeStub(env, nodeId) { return env.NODES.get(env.NODES.idFromName(nodeId)); }
function capacityStub(env) { if (!env.CAPACITY) throw Object.assign(new Error('Capacity Durable Object binding is unavailable.'), { status: 503 }); return env.CAPACITY.get(env.CAPACITY.idFromName('civweave-account')); }
async function callCapacity(env, pathname, init = {}) { return capacityStub(env).fetch(new Request(`https://capacity.internal${pathname}`, init)); }
function publicCapacity(snapshot) { if (!snapshot || typeof snapshot !== 'object') return snapshot; const { reservesMicrocents, ...safe } = snapshot; return safe; }
async function callNode(env, nodeId, request, pathname = null) { const url = new URL(request.url); if (pathname) url.pathname = pathname; url.searchParams.set('nodeId', nodeId); const headers = new Headers(request.headers); headers.set('x-civweave-node-id', nodeId); return nodeStub(env, nodeId).fetch(new Request(url, { method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body })); }
async function syncCore(env, manifest) { if (!env.CORE || !env.NODE_FABRIC_BINDING_TOKEN) return { ok: false, deferred: true }; const response = await env.CORE.fetch('https://civweave-core.internal/internal/nodes/upsert', { method: 'POST', headers: { 'content-type': 'application/json', 'x-civweave-fabric-token': env.NODE_FABRIC_BINDING_TOKEN }, body: JSON.stringify(manifest) }); return response.json().catch(() => ({ ok: false, status: response.status })); }
async function coreJson(env, pathname, init = {}) { const response = await env.CORE.fetch(`https://civweave-core.internal${pathname}`, init), payload = await response.json().catch(() => ({})); if (!response.ok) throw Object.assign(new Error(payload.error || `Core returned HTTP ${response.status}`), { status: response.status }); return payload; }

export default {
  async fetch(request, env) {
    const url = new URL(request.url), domain = env.NODE_DOMAIN || 'nodes.commonweave.earth', nodeFromHost = nodeIdFromHostname(url.hostname, domain);
    if (request.method === 'GET' && url.pathname === '/api/fabric/health' && !nodeFromHost) return json({ schema: 'civweave.node-cloud-fabric.v1', ok: true, domain, durableObjects: Boolean(env.NODES), capacityBinding: Boolean(env.CAPACITY), coreBinding: Boolean(env.CORE), moneyAuthority: 'cloudflare-core' });
    if (request.method === 'GET' && url.pathname === '/api/fabric/capacity' && !nodeFromHost) { const response = await callCapacity(env, `/snapshot?nodeId=${encodeURIComponent(url.searchParams.get('nodeId') || '')}`), payload = await response.json().catch(() => ({})); return json(publicCapacity(payload), response.status); }
    if (nodeFromHost && request.method === 'GET' && url.pathname === '/api/ai/node/capacity') { const response = await callCapacity(env, `/snapshot?nodeId=${encodeURIComponent(nodeFromHost)}`), payload = await response.json().catch(() => ({})); return json(publicCapacity(payload), response.status); }
    const capacityAdmin = !nodeFromHost ? url.pathname.match(/^\/api\/fabric\/capacity\/(configure|nodes\/register|members\/admit|members\/billing|settlements\/membership|settlements\/topup|settlements\/topup-adjustment|usage\/reserve|usage\/settle)$/) : null;
    if (capacityAdmin && request.method === 'POST') { if (!await secretEqual(request.headers.get('authorization')?.replace(/^Bearer\s+/i, ''), env.NODE_FABRIC_OPERATOR_TOKEN)) return json({ ok: false, error: 'forbidden' }, 403); const response = await callCapacity(env, `/${capacityAdmin[1]}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: await request.text() }); return new Response(response.body, { status: response.status, headers: response.headers }); }
    const adminMatch = url.pathname.match(/^\/api\/fabric\/nodes\/([a-zA-Z0-9-]+)$/);
    if (adminMatch && request.method === 'POST' && !nodeFromHost) {
      if (!await secretEqual(request.headers.get('authorization')?.replace(/^Bearer\s+/i, ''), env.NODE_FABRIC_OPERATOR_TOKEN)) return json({ ok: false, error: 'forbidden' }, 403);
      const nodeId = normalizeNodeId(adminMatch[1]); if (!nodeId) return json({ ok: false, error: 'invalid-node-id' }, 400);
      const configured = await callNode(env, nodeId, new Request(`https://${nodeId}.${domain}/internal/configure`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: await request.text() }), '/internal/configure'), result = await configured.json(); if (!configured.ok) return json(result, configured.status);
      const capacityResponse = await callCapacity(env, '/nodes/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nodeId }) }), capacity = await capacityResponse.json().catch(() => ({})); if (!capacityResponse.ok) return json({ ok: false, error: capacity.error || 'capacity-node-registration-failed' }, capacityResponse.status);
      return json({ ok: true, manifest: result.manifest, capacity: publicCapacity(capacity), core: await syncCore(env, result.manifest) });
    }
    const payoutMatch = url.pathname.match(/^\/api\/fabric\/nodes\/([a-zA-Z0-9-]+)\/payouts$/);
    if (payoutMatch && request.method === 'POST' && !nodeFromHost) {
      if (!await secretEqual(request.headers.get('authorization')?.replace(/^Bearer\s+/i, ''), env.NODE_FABRIC_OPERATOR_TOKEN)) return json({ ok: false, error: 'forbidden' }, 403);
      const nodeId = normalizeNodeId(payoutMatch[1]), manifestResponse = await callNode(env, nodeId, new Request(`https://${nodeId}.${domain}/api/ai/node/manifest`, { method: 'GET' }), '/api/ai/node/manifest'), envelope = await manifestResponse.json(), manifest = envelope.manifest, input = await request.json().catch(() => ({})), identity = { nodeId: manifest.nodeId, operatorId: manifest.operatorId, callbackUrl: manifest.publicOrigin };
      const enrollment = (await coreJson(env, '/api/money-edge/enrollment/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(identity) })).enrollment;
      const registration = (await coreJson(env, '/api/money-edge/nodes/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...identity, enrollmentGrant: enrollment.token, email: input.email || undefined, country: input.country || undefined }) })).registration;
      return json({ ok: true, registration }, 201);
    }
    if (nodeFromHost) return callNode(env, nodeFromHost, request);
    const pathNode = url.pathname.match(/^\/n\/([a-zA-Z0-9-]+)(\/.*)?$/);
    if (pathNode) { const nodeId = normalizeNodeId(pathNode[1]), forwarded = new URL(request.url); forwarded.pathname = pathNode[2] || '/'; return callNode(env, nodeId, new Request(forwarded, request)); }
    return json({ schema: 'civweave.node-cloud-fabric.v1', ok: true, message: 'Civweave Cloudflare host-node fabric', nodeDomain: domain, nodeRoute: `https://<node-id>.${domain}`, capacityRoute: '/api/fabric/capacity', moneyAuthority: 'cloudflare-core' });
  }
};
