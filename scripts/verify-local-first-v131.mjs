import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const [pkg,gateway,localHost,prepareStart,startRuntime,stageRuntime,policy,parity,cabinetHtml,cabinetCss,cabinetJs,legacyVisual,launcher,sw,loomHtml,realmHtml,liteHtml]=await Promise.all([
  read('package.json'),read('server-gateway-v131.mjs'),read('server-local-v131.mjs'),read('scripts/prepare-start-v131.mjs'),read('scripts/start-commonweave-v131.mjs'),read('scripts/stage-transformers-assets.mjs'),read('public/app/local-first-policy-v131.js'),read('public/app/shared/commonweave-parity-runtime.js'),read('public/app/cabinet-mode-v142.html'),read('public/app/cabinet-mode-v142.css'),read('public/app/cabinet-mode-v142.js'),read('public/app/cabinet-visual-v141.html'),read('public/app/v130-cabinet-launcher.js'),read('public/service-worker.js'),read('public/app/loom-v128.html'),read('public/app/realm-v128.html'),read('public/app/lite-v129.html')
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
assert(localHost.includes("const VERSION = '1.0.31';")&&localHost.includes("const BUILD = '1.0.31-local-campus-runtime';"),'local host does not align version and build markers');
for(const token of ['/app/cabinet-mode-v142.html','/app/realm-console-v140.html',"'cabinet mode HTML allowlist'"])assert(localHost.includes(token),`local host does not allow ${token}`);
for(const token of ["process.env.RENDER==='true'","renderBuild&&!force","skipping device-side Transformers.js staging"])assert(stageRuntime.includes(token),`Render semantic-runtime staging guard missing ${token}`);
for(const token of ["appUrl: null","localInstallRequired: true","pathname === '/api/boot-log'","res.writeHead(204","localSurface","return json(res, 410","COMMONWEAVE_RELEASE_URL"])assert(gateway.includes(token),`gateway missing ${token}`);
assert(gateway.includes("const installKitSha256 = '';")&&gateway.includes('const installKitSize = 0;'),'gateway does not replace install-kit hashing with zero-cost metadata');
assert(gateway.includes("'install kit startup hashing'"),'gateway lacks the explicit install-kit hashing replacement contract');
for(const token of ["telemetryRequest","/api/boot-log","legacy-telemetry-blocked","Next: Tell me your wish or set an intention.","Next: Review or activate the saved intention","CHAT_KEYS","conversationLinkKey"])assert(policy.includes(token),`local-first policy missing ${token}`);

assert(parity.includes('/app/cabinet-mode-v142.html'),'Canonical mode does not route to Cabinet Mode');
assert(parity.includes('function cabinetUrl'),'Cabinet Mode URL helper missing');
assert(parity.includes('function visualUrl(options={}){return cabinetUrl(options)}'),'Legacy visual URL is not a compatibility alias');
for(const token of ['cabinet-mode-v142.css','local-first-policy-v131.js','cabinet-mode-v142.js','CABINET MODE'])assert(cabinetHtml.includes(token),`Cabinet Mode page missing ${token}`);
for(const token of ['aspect-ratio:941/1672','calc(100dvh * 941 / 1672)','calc(100vw * 1672 / 941)','.cv141-screen','.cv141-controls','transform:translate(-50%,-50%)'])assert(cabinetCss.includes(token),`canonical cabinet sizing missing ${token}`);
for(const token of ['/app/realm-console-v140.html','/app/anarchadia-console-v139.html','cabinet-shells-v129.json','data-system','closeCabinet'])assert(cabinetJs.includes(token),`Cabinet Mode runtime missing ${token}`);
assert(cabinetJs.includes("location.assign('/loom/')")&&!cabinetJs.includes('history.back()'),'Cabinet close control does not return directly to the hub');
assert(legacyVisual.includes('/app/cabinet-mode-v142.html')&&legacyVisual.includes('location.replace'),'Legacy visual page does not redirect to Cabinet Mode');
assert(launcher.includes('CommonweaveParity.cabinetUrl'),'cabinet launcher does not use the canonical Cabinet Mode route');
assert(!launcher.includes('showModal'),'cabinet launcher still opens the shrunken nested modal');
assert(!launcher.includes('/api/boot-log'),'cabinet launcher still submits telemetry');
assert(!sw.includes('/api/boot-log'),'service worker still submits telemetry');
assert(!sw.includes('networkFirst'),'service worker still forces cabinet traffic through the network');
assert(!sw.includes('binaryStreamFirst'),'service worker still bypasses cached MiniLM graphs');
for(const token of ['/app/cabinet-mode-v142.html','/app/local-first-policy-v131.js',"CACHE_REVISION='cabinet-mode-r22'","GUIDE_REVISION='guide-orchestration-r21'"])assert(sw.includes(token),`service worker missing ${token}`);
for(const [name,html] of [['loom',loomHtml],['lite',liteHtml]])assert(html.includes('/app/local-first-policy-v131.js'),`${name} does not load the local-first policy before its runtimes`);
assert(realmHtml.includes('/app/cabinet-mode-v142.html')&&realmHtml.includes('location.replace'),'legacy realm HTML does not redirect to Cabinet Mode');
assert(!realmHtml.includes('/app/realm-v141.js'),'legacy realm HTML still loads the archived scene controller');
console.log(JSON.stringify({ok:true,version:packageJson.version,defaultStart:'local campus off Render; gateway on Render',renderRole:'health, releases, and optional federation only',localRole:'hub, Cabinet Mode, models, state, and diagnostics',canonicalMode:'/app/cabinet-mode-v142.html',cabinetClose:'/loom/',miniLM:'user device only',telemetry:'local diagnostics only',windowsLineEndings:'supported',guideRuntime:'v141'},null,2));
