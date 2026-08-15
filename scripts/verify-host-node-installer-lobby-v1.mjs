import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const installerBridge = read('public/app/installer-repair-only-v2.js');
const legacyAlias = read('public/app/installer-online-fallback-v225.js');
const lobby = read('public/app/host-node-installer-lobby-v1.js');
const status = read('functions/api/host-node-status.ts');
const search = read('functions/api/host-node-search.ts');
const access = read('public/app/host-node-session-v1.js');

const checks = [
  [installerBridge.includes('host-node-installer-lobby-v1.js'), 'current repair-only installer bridge retains the Guild lobby loader'],
  [installerBridge.includes('Find a Guild or recover a Passport') && installerBridge.includes("addEventListener('click',loadHubTools)"), 'Guild discovery starts only after explicit user intent'],
  [installerBridge.includes("hubToolsPolicy:'explicit-user-load-only'") && installerBridge.includes('firstPaintHubWork:false'), 'installer first paint does not boot Guild discovery'],
  [installerBridge.includes("browserRuntimePolicy:'installer-only-until-installed-display'"), 'Guild discovery remains available without reopening browser runtime'],
  [installerBridge.includes('cacheDistinctPath:true'), 'current Guild tools gate escapes stale installer service-worker caches'],
  [legacyAlias.includes('retired:true') && legacyAlias.includes('browserRuntime:false'), 'legacy online fallback remains retired without restoring browser runtime'],
  [lobby.includes("/api/federation/health"), 'lobby can detect a same-origin federated local Guild'],
  [lobby.includes("/.well-known/civweave"), 'local Guild status uses the public federation profile'],
  [lobby.includes('local-federated-host'), 'lobby distinguishes local federated Guilds'],
  [lobby.includes('Guildkeeper tools') && lobby.includes('/app/node-ai-operator-v1.html'), 'local Guilds expose Guildkeeper operator tools'],
  [lobby.includes("federation-finder.physical-node-endpoint"), 'Join reuses canonical physical host endpoint key'],
  [lobby.includes("civweave.host-node.selection.v1"), 'Join stores structured Guild selection metadata'],
  [lobby.includes("/api/host-node-status"), 'remote hosted lobby still reads the same-origin status proxy'],
  [lobby.includes('Citizen slots') && lobby.includes('Patron slots'), 'lobby exposes Citizen and Patron slot counters'],
  [lobby.includes('Use this Guild') && lobby.includes('Join & log in'), 'lobby exposes local and remote Guild login actions'],
  [lobby.includes('Nearest Guilds with open slots') && lobby.includes('Use my approximate location'), 'lobby exposes nearest open-Guild search'],
  [lobby.includes('<option value="free">Citizen only</option>') && lobby.includes('<option value="paid">Patron only</option>') && lobby.includes('<option value="both">Citizen or Patron</option>'), 'nearest search maps Citizen and Patron labels onto unchanged capacity filter values'],
  [lobby.includes("slotCount('free')") && lobby.includes('slots?.paid'), 'Citizen and Patron copy leaves underlying free/paid capacity contract unchanged'],
  [lobby.includes('syntheticSearchAllowed') && lobby.includes('node?.stagingSynthetic !== true') && lobby.includes('node?.synthetic !== true'), 'production Guild UI refuses synthetic search rows'],
  [lobby.includes("STAGING_PROJECT_HOST = 'civweave-staging.pages.dev'"), 'synthetic results are scoped to the isolated staging hostname'],
  [access.includes('civweave.host-node.credentials.v1') && access.includes('civweave.host-capacity.sessions.v1'), 'Guild login keeps persistent device credentials separate from tab-scoped capacity sessions'],
  [search.includes('MAX_CAPACITY_PROBES = 24') && search.includes('exactLocationStored: false'), 'nearest search is bounded and does not retain exact device location'],
  [search.includes('civweave.nearby-guild-search.v1') && search.includes('environment: "production"'), 'production endpoint identifies itself as the live Guild search contract'],
  [search.includes('core-guild-directory') && search.includes('cloudflare-guild-fabric') && search.includes('capacity: "live-probed"'), 'production search declares live directory, fabric, and capacity sources'],
  [search.includes('stagingSynthetic: false') && search.includes('function synthetic('), 'production search rejects synthetic directory, manifest, and capacity data'],
  [!search.includes('STAGING_GUILDS') && !search.includes('stagingSearch(') && !search.includes('../_shared/staging-runtime'), 'production Guild endpoint contains no staging fixture source'],
  [lobby.includes('will not invent capacity numbers'), 'local runtime reports unavailable membership capacity explicitly rather than fabricating slots'],
  [status.includes('/api/ai/node/capacity'), 'status proxy consumes Cloudflare capacity contract'],
  [status.includes('/api/node/health'), 'status proxy includes Guild health telemetry'],
  [status.includes('COMMUNITY_SEATS_PER_FREE_NODE = 6'), 'free-node community seat cap matches host economy contract'],
  [status.includes('SURVIVAL_FLOOR_NEURONS = 25'), 'funded Patron capacity uses survival-floor contract'],
  [status.includes('INCLUDED_POOL_BPS = 9_000'), 'funded Patron capacity reserves ten percent burst pool'],
  [status.includes('civweave-host-node.onrender.com'), 'known legacy hosted installer remains detectable'],
  [status.includes('host-node-not-allowed'), 'status proxy rejects arbitrary remote host targets'],
];
const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) {console.error('Guild installer lobby verification failed:');failed.forEach(label => console.error(` - ${label}`));process.exitCode = 1;} else console.log(`Guild installer lobby verification passed (${checks.length} checks).`);
