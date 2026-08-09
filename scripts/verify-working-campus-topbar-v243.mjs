import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [topbar,boundary,workspace,campus,release,manifest,pkg,workflow,finderHtml,finderRuntime,seed,offlinePackage]=await Promise.all([
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
  read('public/app/offline-package-v208.json')
]);
new Function(topbar);new Function(finderRuntime);new Function(boundary);
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
check('local Federation Finder is the primary map surface',topbar.includes("LOCAL_FINDER_PATH='/app/federation-finder-local-v269.html'")&&topbar.includes("FINDER_API_NAME='CivweaveFederationFinderV269'")&&topbar.includes("version:'1.7.1-local-first-v269'"));
check('map launch is same-origin and does not default to a localhost service',topbar.includes('new URL(LOCAL_FINDER_PATH,location.origin)')&&!topbar.includes("DEFAULT_FINDER_ORIGIN='http://localhost:8787'")&&!topbar.includes("new URL('/finder'"));
check('finder boots from bundled data before optional network refresh',finderRuntime.includes("const BUNDLED='/app/federation-finder-data/federation-seed-v269.json'")&&finderRuntime.includes("async function boot(){drawBase();const bundled=await fetch(BUNDLED")&&!finderRuntime.includes('boot();refreshPublic('));
check('finder reuses previous local Finder cache',finderRuntime.includes("CACHE_DB='federation-finder-source-cache.v1'")&&finderRuntime.includes("CACHE_KEY='commonweave-map-seed'"));
check('node host is optional and read-only',finderRuntime.includes("endpoint+'/api/finder-status'")&&finderRuntime.includes("if(!endpoint){status('No Node Host configured.'")&&!finderRuntime.includes('x-civweave-admin-token'));
check('public map refresh requires user action',finderRuntime.includes("els.refreshPublic.addEventListener('click',refreshPublic)")&&finderHtml.includes('Refresh public map'));
check('offline package contains Finder shell runtime and seed',['/app/federation-finder-local-v269.html','/app/federation-finder-local-v269.js','/app/federation-finder-data/federation-seed-v269.json'].every(path=>offlineJson.seeds.includes(path)));
check('finder shell has no remote script dependency',!finderHtml.includes('unpkg.com')&&!finderHtml.includes('maplibre-gl')&&finderHtml.includes('/app/federation-finder-local-v269.js'));
check('map launch retains direct runtime fallback',topbar.includes('globalThis.CivweaveMapSystem||globalThis.CivweaveMapV1||globalThis.CivweaveMap'));
check('map launch retains registration handshake fallback',topbar.includes("MAP_READY_EVENT='civweave:map-ready'")&&topbar.includes('registerMap'));
check('map launch retains cancellable open request fallback',topbar.includes("MAP_EVENT='civweave:map-open-request'")&&topbar.includes('cancelable:true'));
check('legacy map route remains same-origin constrained',topbar.includes("url.origin===location.origin"));
console.log(JSON.stringify({ok:true,version,revision:'working-campus-topbar-v243-federation-finder-local-v269',checks:checks.length,stickyTop:true,chatSafe:true,localFirst:true,mapHandshake:['same-origin-local-finder','direct-api-fallback','register-fallback','event-fallback','same-origin-route-fallback']},null,2));
