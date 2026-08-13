import baseWorker, { CivweaveNodeAccount, CivweaveMembershipAccount } from './server-ai-entry-v2.mjs';
import userPoolWorker, { CivweaveCapacityAccount } from './server-ai-entry-user-pools-v2.mjs';

export default {
  async fetch(request, env, ctx) {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/api/ai/node/generate') {
      return userPoolWorker.fetch(request, env, ctx);
    }
    return baseWorker.fetch(request, env, ctx);
  },
};

export { CivweaveNodeAccount, CivweaveMembershipAccount, CivweaveCapacityAccount };
