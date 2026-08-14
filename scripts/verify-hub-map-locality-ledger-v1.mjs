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
const localMesh = read('public/app/local-object-mesh-v146.js');
const hostSession = read('public/app/host-node-session-v1.js');

const checks = [
  [finder.includes('/app/hub-map-v1.html'), 'Finder routes to the Hub Map entry'],
  [manifest.entry === '/app/hub-map-v1.html' && manifest.route === '/finder', 'map package entry is Hub-first'],
  [manifest.assets.includes('/app/civweave-hub-map-v1.js') && manifest.assets.includes('/app/civweave-locality-gossip-v1.js'), 'Hub Map and locality gossip are offline package assets'],
  [wrapper.includes('Hub Map') && wrapper.includes('Hub nodes') && wrapper.includes('civweave-locality-gossip-v1.js') && wrapper.includes('civweave-hub-map-v1.js'), 'Hub Map wrapper relabels the existing map and loads Hub behavior'],
  [hubMap.includes("s.state.mode='nodes'") && hubMap.includes("id==='modeNodes'"), 'Hub nodes are the default map mode'],
  [hubMap.includes("DIRECTORY_ENDPOINT='/api/hub-map-nodes'") && hubMap.includes('DIRECTORY_CACHE_KEY'), 'Hub directory has online refresh plus an offline cached copy'],
  [hubMap.includes('runtime.join(origin') && hubMap.includes('HOST_SELECTION_KEY') && hostSession.includes("async function join(origin"), 'map Join Hub uses the canonical capacity-backed Hub session path'],
  [hubMap.includes('Explore ledger') && hubMap.includes('Pass by') && hubMap.includes('summaryForHub'), 'selected Hub pins expose join, ledger exploration, and virtual pass-by'],
  [hubMap.includes('navigator.geolocation.watchPosition') && hubMap.includes('proximityUpdate') && hubMap.includes('document.hidden'), 'foreground map proximity drives physical gossip and stops when hidden'],
  [gossip.includes("new Set(['need','offering','idea'])") && gossip.includes("ENTRY_KIND='civweave.locality-ledger-entry.v1'"), 'Needs, Offerings, and Ideas are first-class locality ledger entries'],
  [gossip.includes("consent:input.consent==='public'?'public':'federated'") && gossip.includes('mesh.createObject'), 'locality entries use signed public/federated community objects'],
  [gossip.includes("storage:'signed IndexedDB community-object ledger'") && localMesh.includes("db.createObjectStore('objects'"), 'offline locality copies live in the existing IndexedDB signed ledger'],
  [gossip.includes("return'hub'") && gossip.includes("return'partner'") && gossip.includes("return'passerby'"), 'ledger relevance covers local Hub, frequent partner Hubs, and recent passersby'],
  [gossip.includes('mesh.syncGateway(hub.publicOrigin)') && gossip.includes('CivweaveMapMeshV276?.sync'), 'virtual pass-by tries the Hub gateway then the federated map mesh'],
  [gossip.includes('roaming coordinates are evaluated in-memory and never written by this module'), 'roaming device coordinates are not persisted by gossip'],
  [directory.includes('CORE_DIRECTORY') && directory.includes('FABRIC_ORIGIN') && directory.includes('/api/ai/node/manifest'), 'Hub directory is built from registered Cloudflare Hub manifests'],
  [directory.includes('node?.location || node?.publicLocation') && directory.includes('publicLocationsAreStewardPublished: true'), 'Hub directory returns only steward-published node locations'],
  [stewardSetup.includes('navigator.geolocation.watchPosition') && stewardSetup.includes('/api/fabric/location') && stewardSetup.includes("position.coords.latitude.toFixed(3)"), 'steward setup captures a fresh physical site and publishes the privacy-rounded site position'],
  [cloudNode.includes("schema: 'civweave.hub-location.v1'") && cloudNode.includes('location: input.location?.schema') && cloudNode.includes("'hub-location'"), 'Cloudflare Hub stores steward location in the canonical node manifest'],
  [localMesh.includes('signature=await sign') && localMesh.includes("const mayRelay=object=>object.consent==='public'||object.consent==='federated'"), 'gossip inherits signed object integrity and public/federated store-and-forward'],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) {
  console.error('Hub Map locality ledger verification failed:');
  failed.forEach(label => console.error(` - ${label}`));
  process.exitCode = 1;
} else {
  console.log(`Hub Map locality ledger verification passed (${checks.length} checks).`);
}
