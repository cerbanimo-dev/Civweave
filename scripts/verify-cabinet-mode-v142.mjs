import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const [host,shell,styles,loader,entry,manifest,worker,realm,living,fellowfare,anarchadia,marketingCabinet]=await Promise.all([
  read('public/app/fullscreen-family-v104.html'),read('public/app/family-shell-v104.js'),read('public/app/family-shell-v104.css'),read('public/app/family-ai-loader-v105.js'),read('public/app/installed-entry-v146.js'),read('public/app/manifest.webmanifest'),read('public/service-worker.js'),read('public/app/realm-console-v140.html'),read('public/app/cabinets/living-school/index.html'),read('public/app/fellowfare-cabinet-v144.html'),read('public/app/anarchadia-console-v139.html'),read('public/app/cabinet-mode-v142.html')
]);
assert(host.includes('location.replace')&&!host.includes('<iframe')&&!host.includes('id="cwf104-frame"'),'Compatibility host still mounts the blocking iframe family.');
for(const route of ['/app/realm-console-v140.html?system=commonweave','/app/cabinets/living-school/index.html','/app/fellowfare-cabinet-v144.html','/app/anarchadia-console-v139.html'])assert(host.includes(route),`Compatibility host is missing direct route ${route}`);
for(const token of ["const VERSION='1.0.4'","document.documentElement.dataset.familyShell='direct'",'.filter(([id])=>id!==current)','data-cwf-badge','data-cwf-state','commonweave.family-status.v105','timestamp(item)>last','badge.hidden=value.count<1','setInterval(refresh,30000)'])assert(shell.includes(token),`Direct family runtime is missing ${token}`);
assert(!shell.includes('MutationObserver')&&!shell.includes('contentDocument')&&!shell.includes('setInterval(refresh,2500)'),'Family runtime still performs deep frame observation or rapid polling.');
for(const token of ['CommonweaveGuideChatV153','CommonweaveModelSettingsV133','family-ai-loader-v105','async function ensure()','openChat','openSettings'])assert(loader.includes(token),`Lazy AI loader is missing ${token}`);
for(const token of ['/app/shared/commonweave-model-runtime.js','/app/minilm-reflex-runtime-v138.js','/app/assistant-runtime-v141.js','/app/guide-chat-v153.js'])assert(loader.includes(token),`Lazy AI loader does not provide ${token}`);
for(const token of ['grid-template-columns:repeat(4','cwf104-badge','cwf104-dot','cwf104-tray'])assert(styles.includes(token),`Four-button family tray styling is missing ${token}`);
assert(entry.includes("const sites={commonweave:'/app/realm-console-v140.html")&&entry.includes("params.get('system')")&&!entry.includes("DEFAULT_DESTINATION='/app/fullscreen-family-v104.html"),'Installed entry does not route directly to Commonweave software.');
const parsedManifest=JSON.parse(manifest);assert(parsedManifest.start_url.includes('system=commonweave'),'PWA does not start in Commonweave Cabinet Mode.');assert(parsedManifest.shortcuts.length===5,'Manifest must expose all five software systems.');
for(const [name,page] of [['realm',realm],['living-school',living],['fellowfare',fellowfare],['anarchadia',anarchadia]]){
  assert(page.includes('/app/family-shell-v104.js')&&page.includes('/app/family-ai-loader-v105.js'),`${name} does not mount the direct family shell and lazy AI loader.`);
  for(const eager of ['/app/shared/commonweave-model-runtime.js','/app/minilm-reflex-runtime-v138.js','/app/assistant-runtime-v141.js','/app/guide-chat-v153.js'])assert(!page.includes(eager),`${name} still eagerly loads ${eager}`);
}
assert(marketingCabinet.includes('cv141-art'),'Physical cabinet renderer must remain in source for marketing use.');
for(const token of ['/app/family-ai-loader-v105.js',"CACHE_REVISION='direct-family-r35'","DEVICE_REVISION='device-package-r35-direct'",'injectNavigationPolicy'])assert(worker.includes(token),`Direct device package is missing ${token}`);
assert(worker.includes("pathname.includes('anarchadia')&&!text.includes('/app/anarchadia-local-sovereignty-v146.js')"),'Sovereignty runtime is not limited to Anarchadia navigation.');
for(const unused of ['/app/assets/cabinets/commonweave.webp','/app/assets/world/town-square-home.webp','/app/logos/commonweave-campus.webp','/app/assets/generated/commonweave-navigation-icons/','/app/cabinet-calibrator-v144.html','/app/shared/cabinet-shells-v129.json'])assert(!worker.includes(unused),`Unused marketing image/tool is still installed: ${unused}`);
console.log(JSON.stringify({ok:true,version:'1.0.4',mode:'direct full-screen software sites',firstScreen:'commonweave',familyButtons:4,notifications:'unseen actionable local records',sharedAISettings:'lazy',liveGuideChat:'lazy',blockingFamilyIframe:false,rapidPolling:false,physicalCabinets:'repository-only marketing assets',devicePackage:'r35 direct'},null,2));
