import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [bridge,base,map,engine,assetManifest,boundary,workspace,campus,release,manifest,pkg,workflow]=await Promise.all([
  read('public/app/working-campus-topbar-v243.js'),
  read('public/app/working-campus-topbar-v243-base.js'),
  read('public/app/federation-association-map.js'),
  read('public/app/map-thread-engine.js'),
  read('public/app/assets/map/threads/manifest.json'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/guide-workspace-v242.js'),
  read('public/app/working-campus-v156.js'),
  read('VERSION'),
  read('public/app/manifest.webmanifest'),
  read('package.json'),
  read('.github/workflows/verify-working-campus-topbar-v243.yml')
]);
new Function(bridge);new Function(base);new Function(map);new Function(engine);new Function(boundary);
const version=release.trim(),manifestJson=JSON.parse(manifest),packageJson=JSON.parse(pkg),threadManifest=JSON.parse(assetManifest),checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};
check('repository release is semantic',/^\d+\.\d+\.\d+$/.test(version));
check('release surfaces are coherent',packageJson.version===version&&manifestJson.name===`Civweave v${version}`);
check('canonical v243 path is an association-map bridge',bridge.includes("ASSOCIATION_MAP='/app/federation-association-map.js'")&&bridge.includes("BASE_TOPBAR='/app/working-campus-topbar-v243-base.js'"));
check('built-in association map preloads before legacy topbar',bridge.indexOf("load(ASSOCIATION_MAP,'association-map')")<bridge.indexOf("load(BASE_TOPBAR,'base-topbar')"));
check('legacy topbar still loads when map preload fails',bridge.includes('Built-in association map could not preload')&&bridge.includes(".then(()=>load(BASE_TOPBAR,'base-topbar'))"));
check('map button accessibility names built-in association map',bridge.includes("button.title='Open Federation Association Map'")&&bridge.includes("setAttribute('aria-label','Open Federation Association Map')"));
check('v243 canonical path remains approved experience support',boundary.includes("const WORKING_CAMPUS_TOPBAR='/app/working-campus-topbar-v243.js'")&&boundary.includes('WORKING_CAMPUS_TOPBAR,'));
check('legacy sticky and mobile topbar behavior is preserved',base.includes('working-campus-topbar-v243')&&base.includes('position:sticky!important')&&base.includes('--cw-working-campus-topbar-height'));
check('chat workspace stays below topbar paint layer',base.includes('z-index:2147483646!important')&&workspace.includes('z-index:2147483644!important'));
check('federation finder remains pairing and failure fallback',base.includes("FINDER_API_NAME='CivweaveFederationFinderV268'")&&map.includes('CivweaveFederationFinderV268?.open?.()')&&map.includes('Pair / discover'));
check('finder custom origin remains protocol constrained',base.includes("FINDER_STORAGE='civweave.federation-finder.origin.v1'")&&base.includes("url.protocol!=='http:'&&url.protocol!=='https:'"));
check('built-in map capture-intercepts topbar map button',map.includes("closest('#cw-working-campus-map-v243')")&&map.includes('stopImmediatePropagation()')&&map.includes('},true)'));
check('built-in map is canonical direct map runtime',map.includes('globalThis.CivweaveMapSystem=api')&&map.includes("new CustomEvent('civweave:map-ready'"));
check('association map exposes federation and data modes',map.includes('data-mode="federation"')&&map.includes('data-mode="data"')&&map.includes("mode=next==='data'?'data':'federation'"));
check('federation topology reads public profile and privileged status',map.includes("jsonFetch('/.well-known/civweave'")&&map.includes("jsonFetch('/api/federation/status'"));
check('privileged federation events require in-memory admin token',map.includes("jsonFetch('/api/federation/events'")&&map.includes("adminToken=''" )&&map.includes('adminTokenStored:false')&&!map.includes('localStorage.setItem(adminToken'));
check('data mode reads live data and systems mesh',map.includes('CivweaveLiveData.refresh')&&map.includes('CivweaveLiveData.snapshot')&&map.includes('CivweaveSystemsMeshV251?.outbox?.()'));
check('data mode maps four canonical realm domains',['living-school','cerbanimo','fellowfare','anarchadia'].every(system=>map.includes(`'${system}'`)));
check('people sources include contact and FellowFare local state',map.includes("'civweave.contacts.v1'")&&map.includes("'commonweave.contacts.v1'")&&map.includes("'civweave.mesh.contacts.v1'")&&map.includes("'fellowfare.mvp.state.v3'"));
check('map explicitly avoids precise-location inference',map.includes("privacyPolicy:'no-precise-location-inference; admin token memory-only'"));
check('thread engine uses approved asset root and neutral geometry tiles',engine.includes("ASSET_ROOT='/app/assets/map/threads'")&&engine.includes("thread-${kind}-${pad(variant)}-silver.webp"));
check('thread engine runtime-tints five semantic colors',engine.includes('FILTER_BY_COLOR')&&['gold','cyan','green','pink','silver'].every(color=>engine.includes(`${color}:`)));
check('thread engine tiles curves and straights along traced paths',engine.includes('curvePath')&&engine.includes('layoutTiles')&&engine.includes("bend>5?'curve':'straight'")&&engine.includes('CURVES=8')&&engine.includes('STRAIGHTS=3'));
check('thread manifest is optimized geometry pack',threadManifest.schema==='civweave.map-thread-assets.v2'&&threadManifest.geometryAssetCount===11&&threadManifest.runtimeTinting===true&&threadManifest.geometry.curveVariants===8&&threadManifest.geometry.straightVariants===3);
check('thread manifest lists eleven unique geometry assets',Array.isArray(threadManifest.assets)&&threadManifest.assets.length===11&&new Set(threadManifest.assets.map(row=>row.file)).size===11);
check('workflow syntax checks bridge map engine and preserved base',workflow.includes('node --check public/app/working-campus-topbar-v243.js')&&workflow.includes('node --check public/app/working-campus-topbar-v243-base.js')&&workflow.includes('node --check public/app/federation-association-map.js')&&workflow.includes('node --check public/app/map-thread-engine.js'));
check('old direct and route fallback contract remains available in base',base.includes('CivweaveMapSystem')&&base.includes('civweave:map-open-request'));
check('working campus still carries a top surface below new bridge',campus.includes('main.app')||campus.includes('working-campus'));
console.log(JSON.stringify({ok:true,version,revision:'working-campus-topbar-v243-association-map-v275',checks:checks.length,mapPrimary:'built-in-association-map',finderRole:'pairing-and-failure-fallback',threadGeometry:11,dataMode:true,privacy:'no-precise-location-inference; admin token memory-only'},null,2));
