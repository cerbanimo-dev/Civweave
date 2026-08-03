import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const [pkg,gateway,localHost,prepareStart,startRuntime,stageRuntime,policy,parity,cabinetHtml,cabinetCss,cabinetJs,legacyVisual,launcher,sw,installerHtml,installerJs,boundary,entryHtml,mesh,loomHtml,realmHtml,liteHtml]=await Promise.all([
  read('package.json'),read('server-gateway-v131.mjs'),read('server-local-v131.mjs'),read('scripts/prepare-start-v131.mjs'),read('scripts/start-commonweave-v131.mjs'),read('scripts/stage-transformers-assets.mjs'),read('public/app/local-first-policy-v131.js'),read('public/app/shared/commonweave-parity-runtime.js'),read('public/app/cabinet-mode-v142.html'),read('public/app/cabinet-mode-v142.css'),read('public/app/cabinet-mode-v142.js'),read('public/app/cabinet-visual-v141.html'),read('public/app/v130-cabinet-launcher.js'),read('public/service-worker.js'),read('public/index.html'),read('public/install-v130.js'),read('public/app/install-boundary-v146.js'),read('public/app/installed-entry-v146.html'),read('public/app/local-object-mesh-v146.js'),read('public/app/loom-v128.html'),read('public/app/realm-v128.html'),read('public/app/lite-v129.html')
]);
const packageJson=JSON.parse(pkg);
assert(packageJson.scripts.prestart==='node scripts/prepare-start-v131.mjs','npm prestart is not environment-aware');
assert(packageJson.scripts.start==='node scripts/start-commonweave-v131.mjs','npm start is not environment-aware');
assert(packageJson.scripts['start:local']==='node server-local-v131.mjs','local campus start command is not the aligned local entry');
for(const token of ["process.env.RENDER === 'true'","'../server-gateway-v131.mjs'","'../server-local-v131.mjs'"])assert(startRuntime.includes(token),`start dispatcher missing ${token}`);
for(const token of ["process.env.RENDER === 'true'",'stage-transformers-assets.mjs','ensure-minilm-model.mjs','Public gateway mode','Local campus mode'])assert(prepareStart.includes(token),`start preparation missing ${token}`);
for(const [name,wrapper] of [['gateway',gateway],['local',localHost]]){
  assert(wrapper.includes("replace(/^\\uFEFF/"),`${name} wrapper does not strip a UTF-8 BOM`);
  assert(wrapper.includes("replace(/\\r\\n?/g"),`${name} wrapper does not normalize Windows line endings`);
}
assert(localHost.includes("const VERSION = '1.0.31';")&&localHost.includes("const BUILD = '1.0.31-local-campus-runtime';"),'local host does not align its legacy runtime markers');
for(const token of ['/app/installed-entry-v146.html','/app/cabinet-mode-v142.html','/app/realm-console-v140.html',"'cabinet mode HTML allowlist'"])assert(localHost.includes(token),`local host does not allow ${token}`);
for(const token of ["process.env.RENDER==='true'","renderBuild&&!force","skipping device-side Transformers.js staging"])assert(stageRuntime.includes(token),`Render semantic-runtime staging guard missing ${token}`);
for(const token of ['packageInstall','installerSurface','applicationSurface',"req.headers['x-commonweave-package'] === 'install'",'installUrl: `${requestOrigin(req, url)}/`','localInstallRequired: true','pathname === \'/api/boot-log\'','res.writeHead(204','COMMONWEAVE_RELEASE_URL'])assert(gateway.includes(token),`install-only gateway missing ${token}`);
assert(gateway.includes("const installKitSha256 = '';")&&gateway.includes('const installKitSize = 0;'),'gateway does not replace install-kit hashing with zero-cost metadata');
assert(gateway.includes('applicationSurface && !installerSurface && !packageInstall'),'gateway does not block ordinary browser-mode application surfaces');
for(const token of ["telemetryRequest","/api/boot-log","legacy-telemetry-blocked","Next: Tell me your wish or set an intention.","Next: Review or activate the saved intention","CHAT_KEYS","conversationLinkKey"])assert(policy.includes(token),`local-first policy missing ${token}`);
assert(installerHtml.includes('INSTALL-ONLY DEVICE PACKAGE')&&!installerHtml.includes('Open local campus'),'public root is not an install-only doorway');
for(const token of ['GET_DEVICE_PACKAGE_STATUS','packageReady','beforeinstallprompt','Share → Add to Home Screen'])assert(installerJs.includes(token),`installer runtime missing ${token}`);
for(const token of ['display-mode: standalone','window.top!==window.self','location.replace(installerUrl())'])assert(boundary.includes(token),`installed route boundary missing ${token}`);
assert(entryHtml.includes('installed-entry-v146.js'),'installed entry document is not wired');
for(const token of ['indexedDB.open','RTCPeerConnection','syncGateway','createObject','outbox'])assert(mesh.includes(token),`local object mesh missing ${token}`);
assert(parity.includes('/app/cabinet-mode-v142.html'),'Canonical mode does not route to Cabinet Mode');
assert(parity.includes('function cabinetUrl'),'Cabinet Mode URL helper missing');
assert(parity.includes('function visualUrl(options={}){return cabinetUrl(options)}'),'Legacy visual URL is not a compatibility alias');
for(const token of ['cabinet-mode-v142.css','local-first-policy-v131.js','install-boundary-v146.js','cabinet-mode-v142.js','CABINET MODE'])assert(cabinetHtml.includes(token),`Cabinet Mode page missing ${token}`);
for(const token of ['aspect-ratio:941/1672','calc(100dvh * 941 / 1672)','calc(100vw * 1672 / 941)','.cv141-screen','transform:translate(-50%,-50%)'])assert(cabinetCss.includes(token),`canonical cabinet sizing missing ${token}`);
for(const token of ['/app/realm-console-v140.html','/app/anarchadia-console-v139.html','cabinet-shells-v129.json','data-system','closeCabinet'])assert(cabinetJs.includes(token),`Cabinet Mode runtime missing ${token}`);
assert(cabinetJs.includes("location.assign('/loom/')")&&!cabinetJs.includes('history.back()'),'Cabinet close control does not return directly to the hub');
assert(legacyVisual.includes('/app/cabinet-mode-v142.html')&&legacyVisual.includes('location.replace'),'Legacy visual page does not redirect to Cabinet Mode');
assert(launcher.includes('CommonweaveParity.cabinetUrl'),'cabinet launcher does not use the canonical Cabinet Mode route');
assert(!launcher.includes('/api/boot-log'),'cabinet launcher still submits telemetry');
assert(!sw.includes('/api/boot-log'),'service worker still submits telemetry');
assert(!sw.includes('networkFirst')&&!sw.includes('binaryStreamFirst'),'service worker bypasses the installed package');
for(const token of ['/app/installed-entry-v146.html','/app/install-boundary-v146.js','/app/local-object-mesh-v146.js',"INSTALL_REVISION='install-only-r26'",'GET_DEVICE_PACKAGE_STATUS',"'x-commonweave-package':'install'"])assert(sw.includes(token),`service worker missing ${token}`);
for(const [name,html] of [['loom',loomHtml],['lite',liteHtml]]){assert(html.includes('/app/local-first-policy-v131.js'),`${name} does not load the local-first policy`);assert(html.includes('/app/install-boundary-v146.js'),`${name} does not enforce installed mode`);assert(html.includes('/app/local-object-mesh-v146.js'),`${name} does not mount local object exchange`)}
assert(realmHtml.includes('/app/cabinet-mode-v142.html')&&realmHtml.includes('location.replace'),'legacy realm HTML does not redirect to Cabinet Mode');
console.log(JSON.stringify({ok:true,version:packageJson.version,publicOrigin:'installer and marked package distribution only',defaultStart:'local campus off Render; install gateway on Render',renderRole:'installer, signed releases, marked package bytes, and optional exchange',localRole:'canonical application, models, state, and companion services',canonicalMode:'/app/cabinet-mode-v142.html',installedEntry:'/app/installed-entry-v146.html',ordinaryApplicationTraffic:'cache-only',communityObjects:'local canonical outbox',persistentMesh:'optional local companion required'},null,2));
