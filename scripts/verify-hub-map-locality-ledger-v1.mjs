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
const rallySetup = read('public/app/guild-rally-point-setup-v1.js');
const cloudNode = read('cloudflare/node-cloud/src/index.mjs');
const locationTest = read('scripts/test-hub-location-onboarding-v1.mjs');
const localMesh = read('public/app/local-object-mesh-v146.js');
const hostSession = read('public/app/host-node-session-v1.js');
const installBoundary = read('public/app/install-boundary-v146.js');
const nodeAiMesh = read('public/app/node-ai-mesh-v1.js');

const checks = [
  [finder.includes('/app/hub-map-v1.html') && finder.includes('Civweave Guild Map') && !finder.includes('Civweave Hub Map'), 'Finder routes to the Guild Map entry with canonical user-facing terminology'],
  [manifest.entry === '/app/hub-map-v1.html' && manifest.route === '/finder' && manifest.name === 'Civweave Guild Map', 'map package entry remains compatibility-routed while the package is named Guild Map'],
  [manifest.rallyPoint?.schema === 'civweave.guild-rally-point.v1' && manifest.rallyPoint?.cachedWithDirectory === true, 'Guild Map package declares the offline Rally Point contract'],
  [manifest.assets.includes('/app/civweave-hub-map-v1.js') && manifest.assets.includes('/app/civweave-guild-map-runtime-v2.js') && manifest.assets.includes('/app/civweave-locality-gossip-v1.js'), 'Guild Map and locality gossip are offline package assets'],
  [wrapper.includes('Guild Map') && wrapper.includes('Guilds') && wrapper.includes('civweave-locality-gossip-v1.js') && wrapper.includes('civweave-guild-map-runtime-v2.js'), 'Guild Map wrapper relabels the compatibility map and loads Guild behavior'],
  [wrapper.indexOf('host-node-session-v1.js') < wrapper.indexOf('civweave-locality-gossip-v1.js'), 'Guild member session loads before locality gossip so existing citizen and patron members can virtually pass by immediately'],
  [hubMap.includes("s.state.mode='nodes'") && hubMap.includes("id==='modeNodes'"), 'Guilds are the default map mode'],
  [hubMap.includes("DIRECTORY_ENDPOINT='/api/hub-map-nodes'") && hubMap.includes('DIRECTORY_CACHE_KEY'), 'Guild directory has online refresh plus an offline cached copy'],
  [hubMap.includes("RALLY_CACHE_KEY='civweave.guild-rally-point.selected.v1'") && hubMap.includes('cacheSelectedRallyPoint') && hubMap.includes('Guild Rally Point'), 'selected Guild Rally Point is cached and rendered for offline reconnection'],
  [hubMap.includes('runtime.join(origin') && hubMap.includes('HOST_SELECTION_KEY') && hostSession.includes("async function join(origin"), 'map Join Guild uses the canonical capacity-backed Guild session path'],
  [hubMap.includes('Explore ledger') && hubMap.includes('Pass by') && hubMap.includes('summaryForHub'), 'selected Guild pins expose join, ledger exploration, and manual virtual pass-by'],
  [hubMap.includes('navigator.geolocation.watchPosition') && hubMap.includes('proximityUpdate') && hubMap.includes('document.hidden'), 'foreground map proximity drives physical gossip and stops when hidden'],
  [hubMap.includes('virtualMemberRefresh') && hubMap.includes("publicStatus?.()?.sessions?.filter(item=>item.active)") && hubMap.includes('syncRegion?.({nodes:directory.nodes||[],networkDirectory:false})'), 'active Guild members refresh their geographic Region instead of frequent-Guild favorites'],
  [!hubMap.includes("gossip()?.frequentHubs?.(6)"), 'Guild Map automatic refresh no longer expands beyond the Region through frequent-Guild history'],
  [gossip.includes("new Set(['need','offering','idea'])") && gossip.includes("ENTRY_KIND='civweave.locality-ledger-entry.v1'"), 'Needs, Offerings, and Ideas are first-class locality ledger entries'],
  [gossip.includes("consent:input.consent==='public'?'public':'federated'") && gossip.includes('mesh.createObject'), 'locality entries use signed public/federated community objects'],
  [gossip.includes("storage:'signed IndexedDB community-object ledger'") && localMesh.includes("db.createObjectStore('objects'"), 'offline locality copies live in the existing IndexedDB signed ledger'],
  [gossip.includes("REGION_NEIGHBOR_COUNT=6") && gossip.includes("schema:'civweave.locality-region.v1'") && gossip.includes("nodeIds:[homeId,...neighbors.map(node=>node.nodeId)]"), 'a Region is the home Guild plus exactly six nearest mapped neighbors when six are available'],
  [gossip.includes("anchor:'home-hub-public-map-pin'") && gossip.includes('distanceMeters(home.location,node.location)'), 'Region geography remains anchored to the home Guild public map pin rather than roaming phone coordinates'],
  [gossip.includes('REGION_SYNC_MS=15*60*1000') && gossip.includes("addEventListener('online',()=>kickRegionSync())") && gossip.includes("addEventListener('civweave:capacity-session-ready'"), 'Region gossip renews periodically and after connectivity or Guild-session activation'],
  [gossip.includes('REGION_LEASE_KEY') && gossip.includes('acquireRegionLease') && gossip.includes('releaseRegionLease'), 'automatic Region downloads use a cross-surface lease to avoid duplicate concurrent pulls'],
  [gossip.includes('activeHomeSession(home.nodeId)') && gossip.includes("reason:'inactive-hub-session'"), 'automatic Region downloads require an active session for the selected home Guild'],
  [gossip.includes("return'hub'") && gossip.includes("return'partner'") && gossip.includes("return'passerby'"), 'ledger relevance still covers local Guild, known partner Guilds, and recent passersby'],
  [gossip.includes('mesh.syncGateway(hub.publicOrigin)') && gossip.includes('CivweaveMapMeshV276?.sync'), 'manual virtual pass-by tries the Guild gateway then the federated map mesh'],
  [gossip.includes('for(const node of region.nodes)') && gossip.includes('mesh.syncGateway(hub.publicOrigin)') && gossip.includes('await mesh.flushAll()'), 'a Region sync downloads its Guild gateways as one logical chunk and flushes once after the sweep'],
  [gossip.includes('roaming coordinates are evaluated in-memory and never written by this module') && gossip.includes('automatic Regions are anchored to the home Hub public map pin'), 'roaming device coordinates are not persisted by automatic Region gossip'],
  [installBoundary.indexOf('HOST_NODE_SESSION,') >= 0 && installBoundary.indexOf('NODE_AI_MESH_RUNTIME,') > installBoundary.indexOf('HOST_NODE_SESSION,'), 'canonical installed surfaces load Guild session ownership before the approved node mesh runtime'],
  [nodeAiMesh.includes("LOCALITY_GOSSIP_SCRIPT='/app/civweave-locality-gossip-v1.js") && nodeAiMesh.includes('async function ensureLocalityGossip()') && nodeAiMesh.includes('ensureLocalityGossip().catch(()=>{})'), 'approved node mesh runtime loads automatic Region gossip across installed Civweave surfaces'],
  [directory.includes('CORE_DIRECTORY') && directory.includes('FABRIC_ORIGIN') && directory.includes('/api/ai/node/manifest'), 'Guild directory is built from registered Cloudflare Guild manifests'],
  [directory.includes('node?.location || node?.publicLocation') && directory.includes('publicLocationsAreGuildkeeperPublished: true'), 'Guild directory returns only Guildkeeper-published locations'],
  [directory.includes('publicRallyPoint') && directory.includes('rallyPointsAreGuildkeeperPublished: true') && directory.includes('civweave.guild-rally-point.v1'), 'Guild directory carries Guildkeeper-published Rally Points into the offline directory cache'],
  [stewardSetup.includes('navigator.geolocation.watchPosition') && stewardSetup.includes('/api/fabric/location') && stewardSetup.includes('publish-precise-location') && stewardSetup.includes('position.coords.latitude.toFixed(coordinateDecimals)') && stewardSetup.includes("publicPrecision:precise?'precise':'rounded'"), 'Guildkeeper setup supports rounded-by-default or explicit precise public physical placement'],
  [stewardSetup.includes('/app/guild-rally-point-setup-v1.js') && rallySetup.includes('SET THE GUILD RALLY POINT') && rallySetup.includes('/api/fabric/rally-point'), 'Guildkeeper setup loads the Rally Point surface and publishes it through the Guild fabric'],
  [rallySetup.includes('public or community-accessible') && rallySetup.includes('Do not use a private residence') && rallySetup.includes('publicPlaceConfirmed:true'), 'Rally Point setup explicitly requires a public or community-accessible reconnection place'],
  [rallySetup.includes("RALLY_STATE_KEY='civweave.guild-rally-point.v1'") && rallySetup.includes('navigator.geolocation.watchPosition') && rallySetup.includes('position.coords.latitude.toFixed(6)'), 'Rally Point setup retains its local state and publishes a precise walked-to meeting point'],
  [cloudNode.includes("precisionRequest === 'precise'") && cloudNode.includes('coordinateDecimals = precise ? 6 : 3') && cloudNode.includes('precise ? Math.max(1, Math.ceil(accuracyMeters))'), 'Cloudflare Guild preserves explicit precise public coordinates and measured accuracy'],
  [cloudNode.includes('normalizeGuildRallyPoint') && cloudNode.includes("schema: 'civweave.guild-rally-point.v1'") && cloudNode.includes('updateGuildRallyPoint') && cloudNode.includes("url.pathname === '/api/fabric/rally-point'"), 'Cloudflare Guild validates, stores, and fans out Rally Point metadata'],
  [cloudNode.includes("rallyPoint = stored?.rallyPoint?.schema === 'civweave.guild-rally-point.v1'") && cloudNode.includes('...(rallyPoint ? { rallyPoint } : {})'), 'later Guild location updates preserve an established Rally Point'],
  [locationTest.includes("publicPrecision: 'precise'") && locationTest.includes('precisePublicCoordinateDecimals: 6') && locationTest.includes('exactReadingLeavesDeviceByDefault: false'), 'Guild location tests cover both privacy-rounded default and precise public opt-in'],
  [locationTest.includes('normalizeGuildRallyPoint') && locationTest.includes('guildRallyPointPublicPlaceRequired: true') && locationTest.includes('guildRallyPointOfflineCache: true'), 'Guild location tests cover Rally Point validation, persistence, and offline cache expectations'],
  [cloudNode.includes("schema: 'civweave.hub-location.v1'") && cloudNode.includes('location: input.location?.schema') && cloudNode.includes("'hub-location'"), 'Cloudflare Guild keeps legacy internal location schema compatibility while publishing Guild terminology'],
  [localMesh.includes('signature=await sign') && localMesh.includes("const mayRelay=object=>object.consent==='public'||object.consent==='federated'"), 'gossip inherits signed object integrity and public/federated store-and-forward'],
  [installBoundary.includes('NODE_AI_MESH_RUNTIME') && installBoundary.includes('SYSTEM_EXPERIENCE_SCRIPTS') && installBoundary.includes('NODE_AI_MESH_RUNTIME,'), 'canonical installed Civweave surfaces still load the generic node mesh runtime'],
  [nodeAiMesh.includes('DEFAULT_SYNC_MS=90_000') && nodeAiMesh.includes('await mesh.syncGateway') && nodeAiMesh.includes('queueMicrotask(autoStart)'), 'installed node mesh automatically relays generic public/federated community objects on its normal online loop'],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) {
  console.error('Guild Map locality and Rally Point verification failed:');
  failed.forEach(label => console.error(` - ${label}`));
  process.exitCode = 1;
} else {
  console.log(`Guild Map locality and Rally Point verification passed (${checks.length} checks).`);
}