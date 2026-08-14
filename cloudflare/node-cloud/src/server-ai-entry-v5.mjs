import baseWorker from './server-ai-entry-v4.mjs';
import { CivweaveCloudNode } from './cloud-node-recovery-v2.mjs';
import { CivweaveCapacityAccount } from './capacity-hosting-plan-v1.mjs';
import { CivweaveAccountDirectory } from './account-directory-v1.mjs';

export { CivweaveCloudNode, CivweaveCapacityAccount, CivweaveAccountDirectory };
const headers = Object.freeze({ 'cache-control': 'no-store', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' });
async function directory(request, env) {
  const id = env.ACCOUNT_DIRECTORY?.idFromName?.('global'), stub = id ? env.ACCOUNT_DIRECTORY.get(id) : null;
  if (!stub) return Response.json({ ok: false, error: 'Account directory is unavailable.' }, { status: 503, headers });
  return stub.fetch(request);
}
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/account-directory/')) { if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers }); return directory(request, env); }
    return baseWorker.fetch(request, env, ctx);
  },
  async scheduled(controller, env, ctx) { if (typeof baseWorker.scheduled === 'function') return baseWorker.scheduled(controller, env, ctx); },
};
