import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [topbar,boundary,workspace,campus,release,manifest,pkg,workflow,atlas]=await Promise.all([
  read('public/app/working-campus-topbar-v243.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/guide-workspace-v242.js'),
  read('public/app/working-campus-v156.js'),
  read('VERSION'),
  read('public/app/manifest.webmanifest'),
  read('package.json'),
  read('.github/workflows/verify-working-campus-topbar-v243.yml'),
  read('public/app/civweave-atlas-v269.html')
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
check('topbar stays above chat without sharing its paint layer',topbar.includes('z-index:2147483646!important')&&workspace.includes('z-index:2147483644!important'));
check('chat workspace reserves measured topbar height',topbar.includes('--cw-working-campus-topbar-height')&&topbar.includes('#cw-persistent-guide-chat-v215{top:calc(var(--cw-working-campus-topbar-height'));
check('topbar height uses targeted ResizeObserver',topbar.includes("'ResizeObserver'in globalThis")&&topbar.includes('resizeObserver.observe(header)')&&!topbar.includes('MutationObserver'));
check('atlas button is a first-class header grid area',topbar.includes("MAP_BUTTON_ID='cw-working-campus-map-v243'")&&topbar.includes('grid-area:map')&&topbar.includes('<span>Atlas</span>'));
check('native Civweave Atlas is the primary map surface',topbar.includes("ATLAS_ROUTE='/app/civweave-atlas-v269.html'")&&topbar.indexOf('if(openAtlas())return true')<topbar.indexOf('globalThis.CivweaveMapSystem||globalThis.CivweaveMapV1||globalThis.CivweaveMap'));
check('atlas surface carries Civweave ownership and Commonweave data credit',atlas.includes('<h1>Civweave Atlas</h1>')&&atlas.includes('Map data with thanks to Commonweave.'));
check('legacy federation finder API remains exposed for compatibility',topbar.includes("LEGACY_FINDER_API_NAME='CivweaveFederationFinderV268'")&&topbar.includes("version:'1.8.0-native-atlas-v269'"));
check('legacy finder configuration remains available for LAN integrations',topbar.includes("DEFAULT_FINDER_ORIGIN='http://localhost:8787'")&&topbar.includes("FINDER_STORAGE='civweave.federation-finder.origin.v1'")&&topbar.includes('localStorage.setItem(FINDER_STORAGE,normalized)'));
check('finder origin accepts only http or https',topbar.includes("url.protocol!=='http:'&&url.protocol!=='https:'"));
check('map launch retains direct runtime fallback',topbar.includes('globalThis.CivweaveMapSystem||globalThis.CivweaveMapV1||globalThis.CivweaveMap'));
check('map launch retains registration handshake fallback',topbar.includes("MAP_READY_EVENT='civweave:map-ready'")&&topbar.includes('registerMap'));
check('map launch retains cancellable open request fallback',topbar.includes("MAP_EVENT='civweave:map-open-request'")&&topbar.includes('cancelable:true'));
check('legacy map route remains same-origin constrained',topbar.includes("url.origin===location.origin"));
check('atlas failure degrades visibly instead of dead-clicking',topbar.includes('Civweave Atlas could not open and no fallback map runtime is registered.'));
console.log(JSON.stringify({ok:true,version,revision:'working-campus-topbar-v243-civweave-atlas-v269',checks:checks.length,stickyTop:true,chatSafe:true,mapHandshake:['native-civweave-atlas-v269','direct-api-fallback','register-fallback','event-fallback','same-origin-route-fallback'],legacyFinderCompatibility:true},null,2));
