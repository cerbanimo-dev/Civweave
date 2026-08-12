import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const installerBridge = read('public/app/installer-online-fallback-v225.js');
const lobby = read('public/app/host-node-installer-lobby-v1.js');
const status = read('functions/api/host-node-status.ts');

const checks = [
  [installerBridge.includes('host-node-installer-lobby-v1.js'), 'installer bridge loads Host Node lobby'],
  [!installerBridge.includes("if (!host || document.querySelector('script[data-civweave-host-node-lobby]'))"), 'installer bridge no longer requires a host query before loading discovery'],
  [lobby.includes("/api/federation/health"), 'lobby can detect a same-origin federated Docker Host Node'],
  [lobby.includes("/.well-known/civweave"), 'local Host Node status uses the public federation profile'],
  [lobby.includes('local-federated-host'), 'lobby distinguishes local federated Host Nodes'],
  [lobby.includes('Host steward tools') && lobby.includes('/app/node-ai-operator-v1.html'), 'local Docker Host Nodes expose steward operator tools'],
  [lobby.includes("federation-finder.physical-node-endpoint"), 'Join reuses canonical physical Host Node endpoint key'],
  [lobby.includes("civweave.host-node.selection.v1"), 'Join stores structured Host Node selection metadata'],
  [lobby.includes("/api/host-node-status"), 'remote hosted lobby still reads the same-origin Host Node status proxy'],
  [lobby.includes('Free slots') && lobby.includes('Paid slots'), 'lobby exposes free and paid slot counters'],
  [lobby.includes('Use this Host Node') && lobby.includes('Join this Host'), 'lobby exposes local and remote Host selection actions'],
  [lobby.includes('will not invent capacity numbers'), 'local runtime reports unavailable membership capacity explicitly rather than fabricating slots'],
  [status.includes('/api/ai/node/capacity'), 'status proxy consumes Cloudflare capacity contract'],
  [status.includes('COMMUNITY_SEATS_PER_FREE_NODE = 6'), 'free-node community seat cap matches host economy contract'],
  [status.includes('SURVIVAL_FLOOR_NEURONS = 25'), 'funded paid capacity uses survival-floor contract'],
  [status.includes('INCLUDED_POOL_BPS = 9_000'), 'funded paid capacity reserves ten percent burst pool'],
  [status.includes('civweave-host-node.onrender.com'), 'known legacy hosted installer remains detectable'],
  [status.includes('host-node-not-allowed'), 'status proxy rejects arbitrary remote host targets'],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) {
  console.error('Host Node installer lobby verification failed:');
  failed.forEach(label => console.error(` - ${label}`));
  process.exitCode = 1;
} else {
  console.log(`Host Node installer lobby verification passed (${checks.length} checks).`);
}
