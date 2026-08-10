export const CLOUD_NODE_SCHEMA = 'civweave.node.v1';
export const CLOUD_NODE_RUNTIME = 'cloudflare-durable-object-v1';

const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value, null, 2), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
});
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
export const normalizeNodeId = value => clean(value, 120).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

export function nodeIdFromHostname(hostname, domain = 'nodes.commonweave.earth') {
  const host = clean(hostname, 255).toLowerCase().split(':')[0];
  const suffix = `.${domain}`;
  if (!host.endsWith(suffix)) return null;
  const candidate = host.slice(0, -suffix.length);
  if (!candidate || candidate.includes('.')) return null;
  return normalizeNodeId(candidate) || null;
}

export function buildCloudNodeManifest(nodeId, input = {}, domain = 'nodes.commonweave.earth') {
  const id = normalizeNodeId(nodeId);
  if (!id) throw new TypeError('nodeId is required.');
  const displayName = clean(input.displayName || id, 180);
  const capabilities = [...new Set((Array.isArray(input.capabilities) ? input.capabilities : ['discovery', 'pairing', 'relay', 'service-catalog']).map(item => clean(item, 120)).filter(Boolean))];
  return Object.freeze({
    schema: CLOUD_NODE_SCHEMA,
    nodeId: id,
    operatorId: clean(input.operatorId || `cerbanimo-cloud-${id}`, 180),
    displayName,
    runtime: CLOUD_NODE_RUNTIME,
    publicOrigin: `https://${id}.${domain}`,
    capabilities,
    services: Array.isArray(input.services) ? input.services : [],
    transport: {
      publicHttps: true,
      webSocket: true,
      tunnelRequired: false,
      relayRequired: false
    },
    security: {
      stripePlatformSecretPresent: false,
      cerbanimoSigningPrivateKeyPresent: false,
      nodePrivateIdentityScope: 'durable-object-local'
    },
    status: 'active',
    updatedAt: new Date().toISOString()
  });
}

function nodePage(manifest) {
  const esc = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const caps = manifest.capabilities.map(cap => `<li>${esc(cap)}</li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(manifest.displayName)} · Civweave node</title><style>body{font:16px system-ui;background:#11152b;color:#f5f2ea;max-width:760px;margin:auto;padding:48px 22px}main{border:1px solid #6f77a8;border-radius:24px;padding:28px;background:#171d3a}code{color:#9de3cf}a{color:#f5ca77}</style></head><body><main><p>Civweave public host node</p><h1>${esc(manifest.displayName)}</h1><p><code>${esc(manifest.nodeId)}</code></p><p>Runtime: ${esc(manifest.runtime)}</p><h2>Capabilities</h2><ul>${caps}</ul><p><a href="/api/node/manifest">Node manifest</a> · <a href="/api/node/health">Health</a></p></main></body></html>`;
}

export class CivweaveCloudNode {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async manifest(nodeId) {
    const stored = await this.state.storage.get('manifest');
    if (stored) return stored;
    const created = buildCloudNodeManifest(nodeId, {}, this.env.NODE_DOMAIN || 'nodes.commonweave.earth');
    await this.state.storage.put('manifest', created);
    return created;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const nodeId = normalizeNodeId(request.headers.get('x-civweave-node-id') || url.searchParams.get('nodeId'));
    if (!nodeId) return json({ ok: false, error: 'node-id-missing' }, 400);
    const manifest = await this.manifest(nodeId);

    if (request.method === 'GET' && url.pathname === '/') return new Response(nodePage(manifest), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    if (request.method === 'GET' && url.pathname === '/api/node/manifest') return json(manifest);
    if (request.method === 'GET' && url.pathname === '/api/node/health') return json({ schema: 'civweave.node-health.v1', ok: true, nodeId, runtime: CLOUD_NODE_RUNTIME, connections: this.state.getWebSockets?.().length || 0, updatedAt: manifest.updatedAt });
    if (request.method === 'GET' && url.pathname === '/api/node/socket') {
      if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return json({ ok: false, error: 'websocket-upgrade-required' }, 426);
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.state.acceptWebSocket(server, ['civweave-node-client']);
      server.serializeAttachment?.({ nodeId, connectedAt: Date.now() });
      server.send(JSON.stringify({ schema: 'civweave.node-socket.v1', type: 'welcome', nodeId }));
      return new Response(null, { status: 101, webSocket: client });
    }
    if (request.method === 'POST' && url.pathname === '/internal/configure') {
      const next = buildCloudNodeManifest(nodeId, await request.json(), this.env.NODE_DOMAIN || 'nodes.commonweave.earth');
      await this.state.storage.put('manifest', next);
      return json({ ok: true, manifest: next });
    }
    return json({ ok: false, error: 'not-found' }, 404);
  }

  async webSocketMessage(ws, message) {
    const attachment = ws.deserializeAttachment?.() || {};
    let payload;
    try { payload = typeof message === 'string' ? JSON.parse(message) : { type: 'binary' }; }
    catch { payload = { type: 'text', value: String(message) }; }
    if (payload?.type === 'ping') {
      ws.send(JSON.stringify({ schema: 'civweave.node-socket.v1', type: 'pong', nodeId: attachment.nodeId, at: Date.now() }));
      return;
    }
    ws.send(JSON.stringify({ schema: 'civweave.node-socket.v1', type: 'ack', nodeId: attachment.nodeId, receivedType: clean(payload?.type || 'message', 80) }));
  }

  webSocketClose(ws, code, reason) {
    try { ws.close(code, reason); } catch {}
  }
}

async function secretEqual(left, right) {
  if (!left || !right) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(left)), crypto.subtle.digest('SHA-256', enc.encode(right))]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.min(x.length, y.length); i += 1) diff |= x[i] ^ y[i];
  return diff === 0;
}

function nodeStub(env, nodeId) {
  const id = env.NODES.idFromName(nodeId);
  return env.NODES.get(id);
}
async function callNode(env, nodeId, request, pathname = null) {
  const url = new URL(request.url);
  if (pathname) url.pathname = pathname;
  url.searchParams.set('nodeId', nodeId);
  const headers = new Headers(request.headers);
  headers.set('x-civweave-node-id', nodeId);
  return nodeStub(env, nodeId).fetch(new Request(url, { method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body }));
}
async function syncCore(env, manifest) {
  if (!env.CORE || !env.NODE_FABRIC_BINDING_TOKEN) return { ok: false, deferred: true };
  const response = await env.CORE.fetch('https://civweave-core.internal/internal/nodes/upsert', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-civweave-fabric-token': env.NODE_FABRIC_BINDING_TOKEN },
    body: JSON.stringify(manifest)
  });
  return response.json().catch(() => ({ ok: false, status: response.status }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const domain = env.NODE_DOMAIN || 'nodes.commonweave.earth';
    const nodeFromHost = nodeIdFromHostname(url.hostname, domain);

    if (request.method === 'GET' && url.pathname === '/api/fabric/health' && !nodeFromHost) {
      return json({ schema: 'civweave.node-cloud-fabric.v1', ok: true, domain, durableObjects: Boolean(env.NODES), coreBinding: Boolean(env.CORE) });
    }

    const adminMatch = url.pathname.match(/^\/api\/fabric\/nodes\/([a-zA-Z0-9-]+)$/);
    if (adminMatch && request.method === 'POST' && !nodeFromHost) {
      if (!await secretEqual(request.headers.get('authorization')?.replace(/^Bearer\s+/i, ''), env.NODE_FABRIC_OPERATOR_TOKEN)) return json({ ok: false, error: 'forbidden' }, 403);
      const nodeId = normalizeNodeId(adminMatch[1]);
      if (!nodeId) return json({ ok: false, error: 'invalid-node-id' }, 400);
      const configured = await callNode(env, nodeId, new Request(`https://${nodeId}.${domain}/internal/configure`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: await request.text() }), '/internal/configure');
      const result = await configured.json();
      if (!configured.ok) return json(result, configured.status);
      const core = await syncCore(env, result.manifest);
      return json({ ok: true, manifest: result.manifest, core });
    }

    if (nodeFromHost) return callNode(env, nodeFromHost, request);

    const pathNode = url.pathname.match(/^\/n\/([a-zA-Z0-9-]+)(\/.*)?$/);
    if (pathNode) {
      const nodeId = normalizeNodeId(pathNode[1]);
      const forwarded = new URL(request.url);
      forwarded.pathname = pathNode[2] || '/';
      return callNode(env, nodeId, new Request(forwarded, request));
    }

    return json({ schema: 'civweave.node-cloud-fabric.v1', ok: true, message: 'Civweave Cloudflare host-node fabric', nodeDomain: domain, nodeRoute: `https://<node-id>.${domain}` });
  }
};
