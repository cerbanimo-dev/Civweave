import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [topbar,boundary,workspace,campus,release,manifest,pkg,workflow,finderHtml,finderRuntime,seed,offlinePackage,stager,cloudflareBuild]=await Promise.all([
  read('public/app/working-campus-topbar-v243.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/guide-workspace-v242.js'),
  read('public/app/working-campus-v156.js'),
  read('VERSION'),
  read('public/app/manifest.webmanifest'),
  read('package.json'),
  read('.github/workflows/verify-working-campus-topbar-v243.yml'),
  read('public/app/federation-finder-local-v269.html'),
  read('public/app/federation-finder-local-v269.js'),
  read('public/app/federation-finder-data/federation-seed-v269.json'),
  read('public/app/offline-package-v208.json'),
  read('scripts/stage-federation-finder-data-v274.mjs'),
  read('scripts/build-cloudflare-pages.mjs')
]);
new Function(topbar);new Function(finderRuntime);new Function(boundary);new Function(stager.replace(/^#![^\n]*\n/,''));
JSON.parse(seed);const offlineJson=JSON.parse(offlinePackage);
const version=release.trim();
const manifestJson=JSON.parse(manifest);
const packageJson=JSON.parse(pkg);
const checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};
check('repository release is semantic',/^\d+\.\d+\.\d+$/.test(version));
check('release surfaces are coherent',packageJson.version===version&&manifestJson.name===`Civweave v${version}`);
check('topbar runtime remains v243',topbar.includes('working-campus-topbar-v243'));
check('topbar runtime is syntax checked',workflow.includes('node --check public/app/working-campus-topbar-v243.js'));
check('v243 is approved experience support',boundary.includes("const WORKING_CAMPUS_TOPBAR='/app/working-campus-topbar-v243.js'")&&boundary.includes('WORKING_CAMPUS_TOPBAR,')&&boundary.includes("workingCampusTopbarRevision:'v243-sticky-top-map-launch-contract'"));
check('old hit safety remains lower-specificity compatibility only',campus.includes("main.app>.top{position:relative!important")&&topbar.includes('main.app>header.top{position:sticky!important'));
check('topbar is sticky to safe top edge',topbar.includes('position:sticky!important;top:max(6px,env(safe-area-inset-top))!important'));
check('topbar stays above chat without sharing its paint layer',topbar.includes('z-index:2147483646!important')&&workspace.includes('z-index:2147483644!important'));
check('chat workspace reserves measured topbar height',topbar.includes('--cw-working-campus-topbar-height')&&topbar.includes('#cw-persistent-guide-chat-v215{top:calc(var(--cw-working-campus-topbar-height'));
check('topbar height uses targeted ResizeObserver',topbar.includes("'ResizeObserver'in globalThis")&&topbar.includes('resizeObserver.observe(header)')&&!topbar.includes('MutationObserver'));
check('map button is a first-class header grid area',topbar.includes("MAP_BUTTON_ID='cw-working-campus-map-v243'")&&topbar.includes('grid-area:map')&&topbar.includes('<span>Map</span>'));
check('local Federation Finder is the primary map surface',topbar.includes("LOCAL_FINDER_PATH='/app/federation-finder-local-v269.html'")&&topbar.includes("FINDER_API_NAME='CivweaveFederationFinderV269'"));
check('map launch is same-origin and does not default to a localhost service',topbar.includes('new URL(LOCAL_FINDER_PATH,location.origin)')&&!topbar.includes("DEFAULT_FINDER_ORIGIN='http://localhost:8787'")&&!topbar.includes("new URL('/finder'"));

check('finder boots emergency data before any optional public refresh',finderRuntime.includes("const BUNDLED='/app/federation-finder-data/federation-seed-v269.json'")&&finderRuntime.includes('async function boot(){drawBase();const bundled=await fetch(BUNDLED')&&!finderRuntime.includes('boot();refreshPublic('));
check('full install-staged atlas supersedes the emergency seed',finderRuntime.includes("const ATLAS='/app/federation-finder-data/atlas-v274/manifest.json'")&&finderRuntime.includes('async function loadInstalledAtlas()')&&finderRuntime.includes('manifest.featureChunks')&&finderRuntime.includes("state.source='installed-atlas'"));
check('finder reuses previous local Finder cache',finderRuntime.includes("CACHE_DB='federation-finder-source-cache.v1'")&&finderRuntime.includes("CACHE_KEY='commonweave-map-seed'"));
check('release stager pins all four original Commonweave Finder datasets',stager.includes('/map/orgs.geojson')&&stager.includes('/search/index.json')&&stager.includes('/map/edges.json')&&stager.includes('/relationships.csv'));
check('release stager shards the full atlas under the static host file limit',stager.includes('FEATURE_CHUNKS=64')&&stager.includes('EDGE_CHUNKS=32')&&stager.includes('MAX_FILE=23*1024*1024'));
check('release build refuses to publish without staging the full Finder atlas',cloudflareBuild.includes('stage-federation-finder-data-v274.mjs')&&cloudflareBuild.includes('Federation Finder atlas staging failed')&&cloudflareBuild.indexOf('finderStage')<cloudflareBuild.indexOf('rebuildReleaseArtifacts();'));
check('staged atlas assets are injected into the offline campus package',stager.includes("const prefix='/app/federation-finder-data/atlas-v274/'")&&stager.includes('pkg.assets=['));

check('mobile and desktop zoom controls are implemented',finderRuntime.includes("els.map.addEventListener('wheel'")&&finderRuntime.includes("els.map.addEventListener('dblclick'")&&finderRuntime.includes('state.pointers.size>=2')&&finderRuntime.includes('zoomAtScreen')&&finderHtml.includes('id="zoomIn"')&&finderHtml.includes('id="zoomOut"'));
check('zoom clusters resolve progressively instead of drawing the full atlas at once',finderRuntime.includes('function cellSize()')&&finderRuntime.includes('function clusterData()')&&finderRuntime.includes('slice(0,3200)')&&finderRuntime.includes('state.scale<38'));
check('device and offline location discovery are present',finderRuntime.includes('navigator.geolocation.getCurrentPosition')&&finderRuntime.includes('function resolveLocalLocation()')&&finderRuntime.includes('function haversine(')&&finderRuntime.includes('function nearestFeatures(')&&finderHtml.includes('Use device location'));
check('precise device location is session-only',finderRuntime.includes('state.userLocation={coords:[...coords],source}')&&!finderRuntime.includes('localStorage.setItem(USER_LOCATION'));
check('saved mesh and live node topology overlay the contact atlas',finderRuntime.includes("MESH_KEY='federation-finder.mesh-nodes.v1'")&&finderRuntime.includes('mergeSavedMesh()')&&finderRuntime.includes('mergeNodeRecords()'));
check('node host is optional and read-only',finderRuntime.includes('/api/finder-status')&&finderRuntime.includes('No Node Host configured.')&&!finderRuntime.includes('x-civweave-admin-token')&&!finderRuntime.includes("method:'POST'"));
check('pairing uses a discovery handoff and delegates privileged trust to node console',finderRuntime.includes("schema:'civweave.finder-handoff/v1'")&&finderRuntime.includes('CivweaveQRV156')&&finderRuntime.includes('openNodeConsole')&&finderRuntime.includes('Discovery handoff only')&&finderHtml.includes('Complete verification and trust decisions in the local node pairing flow'));
check('public map refresh requires user action',finderRuntime.includes("els.refreshPublic.addEventListener('click',refreshPublic)")&&finderHtml.includes('Refresh pinned public source'));
check('offline package contains Finder shell runtime and emergency seed',['/app/federation-finder-local-v269.html','/app/federation-finder-local-v269.js','/app/federation-finder-data/federation-seed-v269.json'].every(path=>offlineJson.seeds.includes(path)));
check('finder shell has no remote script dependency',!finderHtml.includes('unpkg.com')&&!finderHtml.includes('maplibre-gl')&&finderHtml.includes('/app/federation-finder-local-v269.js')&&finderHtml.includes('/extensions/civweave-qr-v156.js'));
check('map launch retains direct runtime fallback',topbar.includes('globalThis.CivweaveMapSystem||globalThis.CivweaveMapV1||globalThis.CivweaveMap'));
check('map launch retains registration handshake fallback',topbar.includes("MAP_READY_EVENT='civweave:map-ready'")&&topbar.includes('registerMap'));
check('map launch retains cancellable open request fallback',topbar.includes("MAP_EVENT='civweave:map-open-request'")&&topbar.includes('cancelable:true'));
check('legacy map route remains same-origin constrained',topbar.includes("url.origin===location.origin"));
console.log(JSON.stringify({ok:true,version,revision:'working-campus-topbar-v243-federation-finder-v274-offline-discovery',checks:checks.length,stickyTop:true,chatSafe:true,localFirst:true,offlineAtlas:true,zoom:true,locationDiscovery:true,nodeDiscovery:true,pairingHandoff:true,mapHandshake:['same-origin-local-finder','direct-api-fallback','register-fallback','event-fallback','same-origin-route-fallback']},null,2));
