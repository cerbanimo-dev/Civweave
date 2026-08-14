import accountWorker, {
  CivweaveAccountNode as BaseNode,
  CivweaveCapacityAccount,
} from './recovery-entry-v10.mjs';

const enc = new TextEncoder();
const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const MAIL_CLAIM_TTL_MS = 10 * 60 * 1000;
const MAIL_CLAIM_PREFIX = 'mail-claim-v1:';
const MAIL_HEADERS = Object.freeze({
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, x-civweave-node-id',
});

function nodeIdFor(request) {
  const url = new URL(request.url);
  return clean(request.headers.get('x-civweave-node-id') || url.searchParams.get('nodeId'), 180)
    .toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}
async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function parseClaimToken(value) {
  const token = clean(value, 500);
  const dot = token.indexOf('.');
  if (dot < 1) throw Object.assign(new Error('Mail claim token is invalid.'), { status: 400 });
  const nodeId = token.slice(0, dot).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const secret = token.slice(dot + 1);
  if (!nodeId || !/^[A-Za-z0-9_-]{40,200}$/.test(secret)) throw Object.assign(new Error('Mail claim token is invalid.'), { status: 400 });
  return { nodeId, secret, token: `${nodeId}.${secret}` };
}

export { CivweaveCapacityAccount };

export class CivweaveAccountNode extends BaseNode {
  async issueMailClaim(nodeId, input = {}) {
    const userId = clean(input.userId, 180), credential = clean(input.credential, 400);
    await this.verifyMemberLogin(nodeId, userId, credential);
    const secret = randomToken(), token = `${nodeId}.${secret}`, hash = await sha256Hex(`civweave.mail-claim.v1\n${token}`);
    const createdAt = Date.now(), expiresAt = createdAt + MAIL_CLAIM_TTL_MS;
    await this.state.storage.put(`${MAIL_CLAIM_PREFIX}${hash}`, { schema: 'civweave.mail-claim.v1', expiresAt });
    return Object.freeze({
      ok: true,
      claimToken: token,
      expiresAt: new Date(expiresAt).toISOString(),
      claimUrl: `https://mail.civweave.cc/#claim=${encodeURIComponent(token)}`,
    });
  }

  async consumeMailClaim(nodeId, input = {}) {
    const parsed = parseClaimToken(input.claimToken);
    if (parsed.nodeId !== nodeId) throw Object.assign(new Error('Mail claim token belongs to another Hub.'), { status: 403 });
    const hash = await sha256Hex(`civweave.mail-claim.v1\n${parsed.token}`), key = `${MAIL_CLAIM_PREFIX}${hash}`;
    const record = await this.state.storage.get(key);
    if (!record || Number(record.expiresAt) <= Date.now()) {
      if (record) await this.state.storage.delete(key);
      throw Object.assign(new Error('Mail claim token is expired or already used.'), { status: 410 });
    }
    await this.state.storage.delete(key);
    return Object.freeze({ ok: true, consumed: true });
  }

  async fetch(request) {
    const url = new URL(request.url), nodeId = nodeIdFor(request);
    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/account/mail/claim/')) {
      return new Response(null, { status: 204, headers: MAIL_HEADERS });
    }
    if (request.method === 'POST' && url.pathname === '/api/account/mail/claim/request') {
      const input = await request.json().catch(() => ({}));
      try {
        return Response.json(await this.issueMailClaim(nodeId, input), { headers: MAIL_HEADERS });
      } catch (error) {
        return Response.json({ ok: false, error: String(error?.message || error) }, {
          status: Number.isSafeInteger(error?.status) ? error.status : 500,
          headers: MAIL_HEADERS,
        });
      }
    }
    if (request.method === 'POST' && url.pathname === '/api/account/mail/claim/consume') {
      const input = await request.json().catch(() => ({}));
      try {
        return Response.json(await this.consumeMailClaim(nodeId, input), { headers: MAIL_HEADERS });
      } catch (error) {
        return Response.json({ ok: false, error: String(error?.message || error) }, {
          status: Number.isSafeInteger(error?.status) ? error.status : 500,
          headers: MAIL_HEADERS,
        });
      }
    }
    return super.fetch(request);
  }
}

export default accountWorker;
