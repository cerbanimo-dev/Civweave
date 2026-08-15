import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const installer=read('public/app/index.html');
const lobby=read('public/app/host-node-installer-lobby-v1.js');
const status=read('functions/api/host-node-status.ts');
const search=read('functions/api/host-node-search.ts');
const access=read('public/app/host-node-session-v1.js');

const pwaIndex=installer.indexOf('/app/pwa-install-prompt-v249.js');
const sessionIndex=installer.indexOf('/app/host-node-session-v1.js');
const lobbyIndex=installer.indexOf('/app/host-node-installer-lobby-v1.js');
const checks=[
  [pwaIndex>=0&&lobbyIndex>pwaIndex,'PWA install owner loads before Host Node lobby'],
  [sessionIndex>=0&&lobbyIndex>sessionIndex,'Host session owner loads before Host Node lobby'],
  [!installer.includes('installer-repair-only-v1.js')&&!installer.includes('installer-online-fallback-v225.js'),'Host discovery is source-wired without installer repair sidecars'],
  [lobby.includes('/api/federation/health'),'lobby can detect a same-origin federated Docker Host Node'],
  [lobby.includes('/.well-known/civweave'),'local Host Node status uses the public federation profile'],
  [lobby.includes('local-federated-host'),'lobby distinguishes local federated Host Nodes'],
  [lobby.includes('Host steward tools')&&lobby.includes('/app/node-ai-operator-v1.html'),'local Docker Host Nodes expose steward operator tools'],
  [lobby.includes('federation-finder.physical-node-endpoint'),'Join reuses canonical physical Host Node endpoint key'],
  [lobby.includes('civweave.host-node.selection.v1'),'Join stores structured Host Node selection metadata'],
  [lobby.includes('/api/host-node-status'),'remote hosted lobby reads the same-origin Host Node status proxy'],
  [lobby.includes('Free slots')&&lobby.includes('Paid slots'),'lobby exposes free and paid slot counters'],
  [lobby.includes('Use this Hub Node')&&lobby.includes('Join & log in'),'lobby exposes local and remote Hub login actions'],
  [lobby.includes('Nearest Hubs with open slots')&&lobby.includes('Use my approximate location'),'lobby exposes nearest open-Hub search'],
  [lobby.includes('<option value="free">')&&lobby.includes('<option value="paid">')&&lobby.includes('<option value="both">'),'nearest search offers free, paid, and combined filters'],
  [access.includes('civweave.host-node.credentials.v1')&&access.includes('civweave.host-capacity.sessions.v1'),'Hub login separates persistent device credentials from tab sessions'],
  [search.includes('MAX_CAPACITY_PROBES = 24')&&search.includes('exactLocationStored: false'),'nearest search is bounded and does not retain exact location'],
  [lobby.includes('will not invent capacity numbers'),'local runtime reports unavailable capacity instead of fabricating slots'],
  [status.includes('/api/ai/node/capacity'),'status proxy consumes Cloudflare capacity contract'],
  [status.includes('/api/node/health'),'status proxy includes Hub health telemetry'],
  [status.includes('COMMUNITY_SEATS_PER_FREE_NODE = 6'),'free-node community seat cap matches host economy contract'],
  [status.includes('SURVIVAL_FLOOR_NEURONS = 25'),'funded capacity uses survival-floor contract'],
  [status.includes('INCLUDED_POOL_BPS = 9_000'),'funded capacity reserves ten percent burst pool'],
  [status.includes('civweave-host-node.onrender.com'),'known legacy hosted node remains detectable by status proxy'],
  [status.includes('host-node-not-allowed'),'status proxy rejects arbitrary remote host targets'],
];
const failed=checks.filter(([ok])=>!ok).map(([,label])=>label);
if(failed.length){console.error('Host Node installer lobby verification failed:');failed.forEach(label=>console.error(` - ${label}`));process.exitCode=1}else console.log(`Host Node installer lobby verification passed (${checks.length} checks).`);
