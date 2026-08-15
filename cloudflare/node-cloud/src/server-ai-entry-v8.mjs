import baseWorker, { CivweaveCapacityAccount, CivweaveAccountDirectory } from './server-ai-entry-v7.mjs';
import { CivweaveCloudNode } from './cloud-node-recovery-v3.mjs';

export { CivweaveCloudNode, CivweaveCapacityAccount, CivweaveAccountDirectory };

export default {
  async fetch(request, env, ctx) { return baseWorker.fetch(request, env, ctx); },
  async scheduled(controller, env, ctx) {
    if (typeof baseWorker.scheduled === 'function') return baseWorker.scheduled(controller, env, ctx);
  },
};
