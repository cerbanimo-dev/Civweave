const SESSION_DOMAIN = 'civweave.capacity-session.v1';
const enc = new TextEncoder();
const dec = new TextDecoder();
const CORS = Object.freeze({
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, x-civweave-node-id',
  'access-control-max-age': '86400',
});
const clean = (value, max = 12_000) => String(value ?? '').trim().slice(0, max);
const json = (value, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'no-store', ...CORS } });

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
function nodeIdFor(request) {
  return clean(request.headers.get('x-civweave-node-id') || new URL(request.url).searchParams.get('nodeId'), 180).toLowerCase();
}
function blockedIpv4(host) {
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}
function safeUrl(value) {
  let url;
  try { url = new URL(clean(value, 4000)); }
  catch { throw Object.assign(new Error('Browser tool requires a valid URL.'), { status: 400 }); }
  if (!['http:', 'https:'].includes(url.protocol)) throw Object.assign(new Error('Browser tool only permits HTTP(S) targets.'), { status: 400 });
  if (url.username || url.password) throw Object.assign(new Error('Browser tool URLs may not contain embedded credentials.'), { status: 400 });
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.invalid')) throw Object.assign(new Error('Browser tool refuses local or private hostnames.'), { status: 403 });
  if (blockedIpv4(host) || host === '::' || host === '::1' || /^f[cd][0-9a-f:]*$/i.test(host) || /^fe[89ab][0-9a-f:]*$/i.test(host)) throw Object.assign(new Error('Browser tool refuses private, loopback, link-local, multicast, or unspecified IP targets.'), { status: 403 });
  url.hash = '';
  return url.href;
}
function boundValue(value, depth = 0) {
  if (depth > 5) return '[truncated]';
  if (typeof value === 'string') return clean(value, 80_000);
  if (Array.isArray(value)) return value.slice(0, 240).map(item => boundValue(item, depth + 1));
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, child] of Object.entries(value).slice(0, 120)) out[clean(key, 120)] = boundValue(child, depth + 1);
  return out;
}
async function quick(env, action, payload) {
  if (!env.BROWSER?.quickAction) throw Object.assign(new Error('Cloudflare Browser Run binding is unavailable.'), { status: 503 });
  const response = await env.BROWSER.quickAction(action, payload);
  const browserMs = Number(response.headers.get('x-browser-ms-used') || 0) || 0;
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    const message = clean(body?.errors?.[0]?.message || body?.error || `Browser Run returned HTTP ${response.status}.`, 1200);
    throw Object.assign(new Error(message), { status: response.status || 502 });
  }
  return { result: boundValue(body.result), browserMs };
}
async function runTool(env, input) {
  const action = clean(input?.action, 40).toLowerCase();
  if (action === 'search') {
    const query = clean(input?.query, 1200);
    if (!query) throw Object.assign(new Error('Browser search requires a query.'), { status: 400 });
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const out = await quick(env, 'markdown', { url, gotoOptions: { waitUntil: 'domcontentloaded', timeout: 20_000 } });
    return { action, query, url, ...out };
  }
  if (action === 'open' || action === 'markdown') {
    const url = safeUrl(input?.url);
    const out = await quick(env, 'markdown', { url, gotoOptions: { waitUntil: 'domcontentloaded', timeout: 20_000 } });
    return { action: 'open', url, ...out };
  }
  if (action === 'links') {
    const url = safeUrl(input?.url);
    const out = await quick(env, 'links', { url, excludeExternalLinks: Boolean(input?.sameOriginOnly), gotoOptions: { waitUntil: 'domcontentloaded', timeout: 20_000 } });
    return { action, url, ...out };
  }
  if (action === 'accessibility') {
    const url = safeUrl(input?.url);
    const out = await quick(env, 'accessibilityTree', { url, gotoOptions: { waitUntil: 'domcontentloaded', timeout: 20_000 } });
    return { action, url, ...out };
  }
  throw Object.assign(new Error('Unsupported browser tool action. Supported actions: search, open, links, accessibility.'), { status: 400 });
}

export async function handleBrowserToolRequest(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405);
  const nodeId = nodeIdFor(request);
  if (!nodeId) return json({ ok: false, error: 'Browser tool requires a host node id.' }, 400);
  let session;
  try { session = await verifyCapacitySession(env, bearer(request), nodeId); }
  catch (error) { return json({ ok: false, error: String(error?.message || error) }, Number.isSafeInteger(error?.status) ? error.status : 401); }
  const input = await request.json().catch(() => ({}));
  try {
    const output = await runTool(env, input);
    return json({ ok: true, schema: 'civweave.browser-tool-result.v1', nodeId, userId: session.userId, source: 'cloudflare-browser-run', liveFetched: true, ...output });
  } catch (error) {
    return json({ ok: false, schema: 'civweave.browser-tool-result.v1', error: String(error?.message || error), liveFetched: false }, Number.isSafeInteger(error?.status) ? error.status : 502);
  }
}

export const browserToolVersion = '1.0.0-browser-tool-entry-v1';
