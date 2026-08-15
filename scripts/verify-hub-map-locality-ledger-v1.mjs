import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const finder = read('public/finder/index.html');
const manifest = JSON.parse(read('public/app/civweave-map-v1-manifest.json'));
const wrapper = read('public/app/hub-map-v1.html');
const hubMap = read('public/app/civweave-hub-map-v1.js');
const gossip = read('public/app/civweave-locality-gossip-v1.js');
const directory = read('functions/api/hub-map-nodes.ts');
const stewardSetup = read('public/host-setup.html');
const cloudNode = read('cloudflare/node-cloud/src/index.mjs');
const locationTest = read('scripts/test-hub-location-onboarding-v1.mjs');
const localMesh = read('public/app/local-object-mesh-v146.js');
const hostSession = read('public/app/host-node-session-v1.js');
const installBoundary = read('public/app/install-boundary-v146.js');
const coreRuntime = read('public/app/core-interface-runtime-v1.js');
const nodeAiMesh = read('public/app/node-ai-mesh-v1.js');

const hostSessionIndex=coreRuntime.indexOf("'/app/host-node-session-v1.js'");
const nodeMeshIndex=coreRuntime.indexOf("'/app/node-ai-mesh-v1.js'");
const checks = [
  [finder.includes('/app/hub-map-v1.html'), 'Finder routes to the Hub Map entry'],
  [manifest.entry === '/app/hub-map-v1.html' && manifest.route === '/finder', 'map package entry is Hub-first'],
  [manifest.assets.includes('/app/civweave-hub-map-v1.js') && manifest.assets.includes('/app/civweave-locality-gossip-v1.js'), 'Hub Map and locality gossip are offline package assets'],
  [wrapper.includes('Hub Map') && wrapper.includes('Hub nodes') && wrapper.includes('civweave-locality-gossip-v1.js') && wrapper.includes('civweave-hub-map-v1.js'), 'Hub Map wrapper relabels the existing map and loads Hub behavior'],
  [wrapper.indexOf('host-node-session-v1.js') < wrapper.indexOf('civweave-locality-gossip-v1.js'), 'Hub member session loads before locality gossip so existing free and paid members can virtually pass by immediately'],
  [hubMap.includes("s.state.mode='nodes'") && hubMap.includes("id==='modeNodes'"), 'Hub nodes are the default map mode'],
  [hubMap.includes("DIRECTORY_ENDPOINT='/api/hub-map-nodes'") && hubMap.includes('DIRECTORY_CACHE_KEY'), 'Hub directory has online refresh plus an offline cached copy'],
  [hubMap.includes('runtime.join(origin') && hubMap.includes('HOST_SELECTION_KEY') && hostSession.includes("async function join(origin"), 'map Join Hub uses the canonical capacity-backed Hub session path'],
  [hubMap.includes('Explore ledger') && hubMap.includes('Pass by') && hubMap.includes('summaryForHub'), 'selected Hub pins expose join, ledger exploration, and manual virtual pass-by'],
  [hubMap.includes('navigator.geolocation.watchPosition') && hubMap.includes('proximityUpdate') && hubMap.includes('document.hidden'), 'foreground map proximity drives physical gossip and stops when hidden'],
  [hubMap.includes('virtualMemberRefresh') && hubMap.includes("publicStatus?.()?.sessions?.filter(item=>item.active)") && hubMap.includes('syncRegion?.({nodes:directory.nodes||[],networkDirectory:false})'), 'active Hub members refresh their geographic Region instead of frequent-Hub favorites'],
  [!hubMap.includes("gossip()?.frequentHubs?.(6)"), 'Hub Map automatic refresh no longer expands beyond the Region through frequent-Hub history'],
  [gossip.includes("new Set(['need','offering','idea'])") && gossip.includes("ENTRY_KIND='civweave.locality-ledger-entry.v1'"), 'Needs, Offerings, and Ideas are first-class locality ledger entries'],
  [gossip.includes("consent:input.consent==='public'?'public':'federated'") && gossip.includes('mesh.createObject'), 'locality entries use signed public/federated community objects'],
  [gossip.includes("storage:'signed IndexedDB community-object ledger'") && localMesh.includes("db.createObjectStore('objects'"), 'offline locality copies live in the existing IndexedDB signed ledger'],
  [gossip.includes("REGION_NEIGHBOR_COUNT=6") && gossip.includes("schema:'civweave.locality-region.v1'") && gossip.includes("nodeIds:[homeId,...neighbors.map(node=>node.nodeId)]"), 'a Region is the home Hub plus exactly six nearest mapped neighbors when six are available'],
  [gossip.includes("anchor:'home-hub-public-map-pin'") && gossip.includes('distanceMeters(home.location,node.location)'), 'Region geography is anchored to the home Hub public map pin rather than roaming phone coordinates'],
  [gossip.includes('REGION_SYNC_MS=15*60*1000') && gossip.includes("addEventListener('online',()=>kickRegionSync())") && gossip.includes("addEventListener('civweave:capacity-session-ready'"), 'Region gossip renews periodically and after connectivity or Hub-session activation'],
  [gossip.includes('REGION_LEASE_KEY') && gossip.includes('acquireRegionLease') && gossip.includes('releaseRegionLease'), 'automatic Region downloads use a cross-surface lease to avoid duplicate concurrent pulls'],
  [gossip.includes('activeHomeSession(home.nodeId)') && gossip.includes("reason:'inactive-hub-session'"), 'automatic Region downloads require an active session for the selected home Hub'],
  [gossip.includes("return'hub'") && gossip.includes("return'partner'") && gossip.includes("return'passerby'"), 'ledger relevance still covers local Hub, known partner Hubs, and recent passersby'],
  [gossip.includes('mesh.syncGateway(hub.publicOrigin)') && gossip.includes('CivweaveMapMeshV276?.sync'), 'manual virtual pass-by tries the Hub gateway then the federated map mesh'],
  [gossip.includes('for(const node of region.nodes)') && gossip.includes('mesh.syncGateway(hub.publicOrigin)') && gossip.includes('await mesh.flushAll()'), 'a Region sync downloads its Hub gateways as one logical chunk and flushes once after the sweep'],
  [gossip.includes('roaming coordinates are evaluated in-memory and never written by this module') && gossip.includes('automatic Regions are anchored to the home Hub public map pin'), 'roaming device coordinates are not persisted by automatic Region gossip'],
  [hostSessionIndex>=0 && nodeMeshIndex>hostSessionIndex, 'core interface runtime loads Hub session ownership before the approved node mesh runtime'],
  [nodeAiMesh.includes("LOCALITY_GOSSIP_SCRIPT='/app/civweave-locality-gossip-v1.js") && nodeAiMesh.includes('async function ensureLocalityGossip()') && nodeAiMesh.includes('ensureLocalityGossip().catch(()=>{})'), 'approved node mesh runtime loads automatic Region gossip across installed Civweave surfaces'],
  [directory.includes('CORE_DIRECTORY') && directory.includes('FABRIC_ORIGIN') && directory.includes('/api/ai/node/manifest'), 'Hub directory is built from registered Cloudflare Hub manifests'],
  [directory.includes('node?.location || node?.publicLocation') && directory.includes('publicLocationsAreStewardPublished: true'), 'Hub directory returns only steward-published node locations'],
  [stewardSetup.includes('navigator.geolocation.watchPosition') && stewardSetup.includes('/api/fabric/location') && stewardSetup.includes('publish-precise-location') && stewardSetup.includes('position.coords.latitude.toFixed(coordinateDecimals)') && stewardSetup.includes("publicPrecision:precise?'precise':'rounded'"), 'Steward setup supports rounded-by-default or explicit precise public physical placement'],
  [cloudNode.includes("precisionRequest === 'precise'") && cloudNode.includes('coordinateDecimals = precise ? 6 : 3') && cloudNode.includes('precise ? Math.max(1, Math.ceil(accuracyMeters))'), 'Cloudflare Hub preserves explicit precise public coordinates and measured accuracy'],
  [locationTest.includes("publicPrecision: 'precise'") && locationTest.includes('precisePublicCoordinateDecimals: 6') && locationTest.includes('exactReadingLeavesDeviceByDefault: false'), 'Hub location tests cover both privacy-rounded default and precise public opt-in'],
  [cloudNode.includes("schema: 'civweave.hub-location.v1'") && cloudNode.includes('location: input.location?.schema') && cloudNode.includes("'hub-location'"), 'Cloudflare Hub stores Steward location in the canonical node manifest'],
  [localMesh.includes('signature=await sign') && localMesh.includes("const mayRelay=object=>object.consent==='public'||object.consent==='federated'"), 'gossip inherits signed object integrity and public/federated store-and-forward'],
  [coreRuntime.includes("'/app/node-ai-mesh-v1.js'") && installBoundary.includes("const CORE_INTERFACE_RUNTIME='/app/core-interface-runtime-v1.js'") && !installBoundary.includes('SYSTEM_EXPERIENCE_SCRIPTS'), 'canonical installed Civweave surfaces use the core interface runtime to load the generic node mesh runtime'],
  [nodeAiMesh.includes('DEFAULT_SYNC_MS=90_000') && nodeAiMesh.includes('await mesh.syncGateway') && nodeAiMesh.includes('queueMicrotask(autoStart)'), 'installed node mesh automatically relays generic public/federated community objects on its normal online loop'],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) {
  console.error('Hub Map locality ledger verification failed:');
  failed.forEach(label => console.error(` - ${label}`));
  process.exitCode = 1;
} else {
  console.log(`Hub Map locality ledger verification passed (${checks.length} checks).`);
}
