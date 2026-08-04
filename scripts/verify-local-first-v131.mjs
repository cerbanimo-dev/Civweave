import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const [pkg,gateway,localHost,prepareStart,startRuntime,stageRuntime,policy,parity,familyHost,familyShell,marketingCabinet,legacyVisual,launcher,sw,installerHtml,installerJs,boundary,entryHtml,entryJs,mesh,realmHtml,livingHtml,fellowfareHtml,anarchadiaHtml]=await Promise.all([
  read('package.json'),read('server-gateway-v131.mjs'),read('server-local-v131.mjs'),read('scripts/prepare-start-v131.mjs'),read('scripts/start-commonweave-v131.mjs'),read('scripts/stage-transformers-assets.mjs'),read('public/app/local-first-policy-v131.js'),read('public/app/shared/commonweave-parity-runtime.js'),read('public/app/fullscreen-family-v104.html'),read('public/app/family-shell-v104.js'),read('public/app/cabinet-mode-v142.html'),read('public/app/cabinet-visual-v141.html'),read('public/app/v130-cabinet-launcher.js'),read('public/service-worker.js'),read('public/index.html'),read('public/install-v130.js'),read('public/app/install-boundary-v146.js'),read('public/app/installed-entry-v146.html'),read('public/app/installed-entry-v146.js'),read('public/app/local-object-mesh-v146.js'),read('public/app/realm-console-v140.html'),read('public/app/cabinets/living-school/index.html'),read('public/app/fellowfare-cabinet-v144.html'),read('public/app/anarchadia-console-v139.html')
]);
const packageJson=JSON.parse(pkg);
assert(packageJson.version==='1.0.4','package version is not 1.0.4');
assert(packageJson.scripts.prestart==='node scripts/prepare-start-v131.mjs','npm prestart is not environment-aware');
assert(packageJson.scripts.start==='node scripts/start-commonweave-v131.mjs','npm start is not environment-aware');
assert(packageJson.scripts['start:local']==='node server-local-v131.mjs','local campus start command is not the aligned local entry');
for(const token of ["process.env.RENDER === 'true'","'../server-gateway-v131.mjs'","'../server-local-v131.mjs'"])assert(startRuntime.includes(token),`start dispatcher missing ${token}`);
for(const token of ["process.env.RENDER === 'true'",'stage-transformers-assets.mjs','ensure-minilm-model.mjs','Public gateway mode','Local campus mode'])assert(prepareStart.includes(token),`start preparation missing ${token}`);
for(const [name,wrapper] of [['gateway',gateway],['local',localHost]]){
  assert(wrapper.includes("replace(/^\\uFEFF/"),`${name} wrapper does not strip a UTF-8 BOM`);
  assert(wrapper.includes("replace(/\\r\\n?/g"),`${name} wrapper does not normalize Windows line endings`);
}
assert(localHost.includes("const VERSION = '1.0.4';")&&localHost.includes("const BUILD = '1.0.4-fullscreen-family-local-runtime';"),'local host does not report the v1.0.4 software family');
for(const token of ['/app/installed-entry-v146.html','/app/fullscreen-family-v104.html','/app/realm-console-v140.html',"'software family HTML allowlist'"])assert(localHost.includes(token),`local host does not preserve ${token}`);
for(const token of ["process.env.RENDER==='true'","renderBuild&&!force","skipping device-side Transformers.js staging"])assert(stageRuntime.includes(token),`Render semantic-runtime staging guard missing ${token}`);
for(const token of ['packageInstall','installerSurface','applicationSurface',"req.headers['x-commonweave-package'] === 'install'",'installUrl: `${requestOrigin(req, url)}/`','localInstallRequired: true','pathname === \'/api/boot-log\'','res.writeHead(204','COMMONWEAVE_RELEASE_URL'])assert(gateway.includes(token),`install-only gateway missing ${token}`);
assert(gateway.includes("const installKitSha256 = '';")&&gateway.includes('const installKitSize = 0;'),'gateway does not replace install-kit hashing with zero-cost metadata');
assert(gateway.includes('applicationSurface && !installerSurface && !packageInstall'),'gateway does not block ordinary browser-mode application surfaces');
for(const token of ["telemetryRequest","/api/boot-log","legacy-telemetry-blocked","Next: Tell me your wish or set an intention.","Next: Review or activate the saved intention","CHAT_KEYS","conversationLinkKey"])assert(policy.includes(token),`local-first policy missing ${token}`);
assert(installerHtml.includes('LEAN OFFLINE SOFTWARE PACKAGE')&&!installerHtml.includes('Open local campus'),'public root is not the v1.0.4 install-only doorway');
for(const token of ["const VERSION='1.0.4'",'GET_DEVICE_PACKAGE_STATUS','packageReady','beforeinstallprompt','Share → Add to Home Screen'])assert(installerJs.includes(token),`installer runtime missing ${token}`);
for(const token of ['display-mode: standalone','window.top!==window.self','location.replace(installerUrl())'])assert(boundary.includes(token),`installed route boundary missing ${token}`);
assert(entryHtml.includes('installed-entry-v146.js')&&!entryHtml.includes('Opening the local weave'),'installed entry still contains the retired intro');
for(const token of ["'/app/fullscreen-family-v104.html'","params.get('system')","system=commonweave"])assert(entryJs.includes(token),`installed entry routing missing ${token}`);
for(const token of ['indexedDB.open','RTCPeerConnection','syncGateway','createObject','outbox'])assert(mesh.includes(token),`local object mesh missing ${token}`);

for(const token of ['FAMILY_URL','/app/fullscreen-family-v104.html','function cabinetUrl','function visualUrl(options={}){return cabinetUrl(options)}'])assert(parity.includes(token),`software parity route missing ${token}`);
assert(!parity.includes('Promise.all([fetch(`${LEDGER_URL}'),'capability runtime still requires cabinet shell geometry');
for(const token of ['id="cwf104-frame"','guide-chat-v153.js','minilm-model-settings-v138.js','family-shell-v104.js'])assert(familyHost.includes(token),`full-screen family host missing ${token}`);
for(const token of ["const VERSION='1.0.4'",'.filter(([id])=>id!==current)','CommonweaveModelSettingsV133','CommonweaveGuideChatV153','data-cwf-badge','data-cwf-state'])assert(familyShell.includes(token),`full-screen family runtime missing ${token}`);
for(const [name,html] of [['commonweave/cerbanimo',realmHtml],['living-school',livingHtml],['fellowfare',fellowfareHtml],['anarchadia',anarchadiaHtml]])assert(html.includes('/app/guide-chat-v153.js'),`${name} software surface is not wired to live chat`);

// Physical cabinet source remains in the repository, but is no longer the installed canonical route.
assert(marketingCabinet.includes('cv141-art')&&marketingCabinet.includes('cabinet-calibration-v144.js'),'physical cabinet marketing renderer was removed from source');
assert(legacyVisual.includes('/app/cabinet-mode-v142.html')&&legacyVisual.includes('location.replace'),'legacy visual source redirect changed unexpectedly');
assert(launcher.includes('CommonweaveParity.cabinetUrl'),'launcher does not use the canonical family route helper');
assert(!launcher.includes('/api/boot-log'),'cabinet launcher still submits telemetry');
assert(!sw.includes('/api/boot-log'),'service worker still submits telemetry');
assert(!sw.includes('networkFirst')&&!sw.includes('binaryStreamFirst'),'service worker bypasses the installed package');
for(const token of ['/app/installed-entry-v146.html','/app/fullscreen-family-v104.html','/app/install-boundary-v146.js','/app/local-object-mesh-v146.js',"INSTALL_REVISION='fullscreen-entry-r34'",'GET_DEVICE_PACKAGE_STATUS',"'x-commonweave-package':'install'"])assert(sw.includes(token),`service worker missing ${token}`);
for(const retired of ['/app/assets/cabinets/commonweave.webp','/app/assets/world/town-square-home.webp','/app/cabinet-calibrator-v144.html','/app/shared/cabinet-shells-v129.json'])assert(!sw.includes(retired),`retired install payload remains: ${retired}`);
console.log(JSON.stringify({ok:true,version:packageJson.version,publicOrigin:'installer and marked package distribution only',defaultStart:'Commonweave full-screen Cabinet Mode',renderRole:'installer, signed releases, marked package bytes, and optional exchange',localRole:'canonical application, models, state, and companion services',canonicalMode:'/app/fullscreen-family-v104.html?system=commonweave',installedEntry:'/app/installed-entry-v146.html',ordinaryApplicationTraffic:'cache-only',communityObjects:'local canonical outbox',persistentMesh:'optional local companion required'},null,2));
