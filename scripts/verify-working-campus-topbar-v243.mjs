import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

await import('./sync-release-version-assets.mjs');

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [topbar,boundary,workspace,campus,release,manifest,pkg,workflow]=await Promise.all([
  read('public/app/working-campus-topbar-v243.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/guide-chat-surface-v350.js'),
  read('public/app/working-campus-v156.js'),
  read('VERSION'),
  read('public/app/manifest.webmanifest'),
  read('package.json'),
  read('.github/workflows/verify-working-campus-topbar-v243.yml')
]);
new Function(topbar);new Function(boundary);
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
check('topbar stays above chat without sharing its paint layer',topbar.includes('z-index:2147483646!important')&&workspace.includes('z-index:2147483612'));
check('chat workspace reserves measured topbar height',topbar.includes('--cw-working-campus-topbar-height')&&topbar.includes('#cw-persistent-guide-chat-v215{top:calc(var(--cw-working-campus-topbar-height'));
check('topbar height uses targeted ResizeObserver',topbar.includes("'ResizeObserver'in globalThis")&&topbar.includes('resizeObserver.observe(header)')&&!topbar.includes('MutationObserver'));
check('map button is a first-class header grid area',topbar.includes("MAP_BUTTON_ID='cw-working-campus-map-v243'")&&topbar.includes('grid-area:map')&&topbar.includes('<span>Map</span>'));
check('downloads button is a first-class header grid area',topbar.includes("DOWNLOADS_BUTTON_ID='cw-working-campus-downloads-v243'")&&topbar.includes('grid-area:downloads')&&topbar.includes('<span>Downloads</span>'));
check('downloads button reopens the canonical installer manager',topbar.includes("new URL('/app/index.html',location.origin)")&&topbar.includes("target.searchParams.set('manage','downloads')")&&topbar.includes("target.searchParams.set('source','working-campus')")&&topbar.includes('location.assign(downloadsUrl())'));
check('downloads route carries explicit host and finder context',topbar.includes("current.get('host')||current.get('hostNode')")&&topbar.includes("['node','nodeId','node_id','finder','federationFinder']")&&topbar.includes("target.searchParams.set('host',explicitHost)")&&topbar.includes('target.searchParams.set(key,value)'));
check('downloads route restores the selected Host Node when query context is absent',topbar.includes("HOST_ENDPOINT_STORAGE='federation-finder.physical-node-endpoint'")&&topbar.includes('localStorage.getItem(HOST_ENDPOINT_STORAGE)')&&topbar.includes("if(!target.searchParams.has('host'))")&&topbar.includes("target.searchParams.set('host',stored)"));
check('stored Host Node restore accepts only credential-free http(s) origins',topbar.includes("url.protocol!=='http:'&&url.protocol!=='https:'")&&topbar.includes('if(url.username||url.password)return\'\''));
check('downloads remain independently addressable on mobile',topbar.includes('grid-template-areas:"brand brand" "modes modes" "map downloads" "settings review" "theme theme"'));
check('federation finder v1.7.2 is exposed as the primary map surface',topbar.includes("FINDER_API_NAME='CivweaveFederationFinderV268'")&&topbar.includes("version:'1.7.2-launch-v268-no-localhost-v1'")&&topbar.indexOf('if(openFederationFinder())return true')<topbar.indexOf('globalThis.CivweaveMapSystem||globalThis.CivweaveMapV1||globalThis.CivweaveMap'));
check('finder defaults to the current Civweave origin',topbar.includes("return new URL('/finder',location.origin).href")&&!topbar.includes("DEFAULT_FINDER_ORIGIN='http://localhost:8787'"));
check('legacy loopback finder origin is discarded on public origins',topbar.includes('isLoopbackOrigin(stored)&&!isLoopbackOrigin(location.origin)')&&topbar.includes('localStorage.removeItem(FINDER_STORAGE)'));
check('same-origin finder stays inside the current PWA window',topbar.includes("if(url.origin===location.origin){location.assign(`${url.pathname}${url.search}${url.hash}`);return true}")&&topbar.indexOf("if(url.origin===location.origin){location.assign")<topbar.indexOf("window.open(target,'civweave-federation-finder')"));
check('finder origin persists for explicit custom or LAN node hosts',topbar.includes("FINDER_STORAGE='civweave.federation-finder.origin.v1'")&&topbar.includes('localStorage.setItem(FINDER_STORAGE,explicit)')&&topbar.includes('localStorage.setItem(FINDER_STORAGE,normalized)'));
check('finder origin accepts only http or https',topbar.includes("url.protocol!=='http:'&&url.protocol!=='https:'"));
check('map launch retains direct runtime fallback',topbar.includes('globalThis.CivweaveMapSystem||globalThis.CivweaveMapV1||globalThis.CivweaveMap'));
check('map launch retains registration handshake fallback',topbar.includes("MAP_READY_EVENT='civweave:map-ready'")&&topbar.includes('registerMap'));
check('map launch retains cancellable open request fallback',topbar.includes("MAP_EVENT='civweave:map-open-request'")&&topbar.includes('cancelable:true'));
check('legacy map route remains same-origin constrained',topbar.includes("url.origin===location.origin"));
check('finder failure degrades visibly instead of dead-clicking',topbar.includes('Federation Finder could not open and no fallback map runtime is registered.'));
console.log(JSON.stringify({ok:true,version,revision:'working-campus-topbar-v243-downloads-entry-v2',checks:checks.length,stickyTop:true,chatSafe:true,downloadsManager:'/app/index.html?manage=downloads',hostSelectionRestore:true,mapHandshake:['federation-finder-v1.7.2','same-origin-pwa-navigation','explicit-remote-node-fallback','direct-api-fallback','register-fallback','event-fallback','same-origin-route-fallback']},null,2));
