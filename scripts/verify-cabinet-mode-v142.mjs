import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const [host,shell,styles,entry,manifest,worker,realm,living,fellowfare,anarchadia,marketingCabinet]=await Promise.all([
  read('public/app/fullscreen-family-v104.html'),
  read('public/app/family-shell-v104.js'),
  read('public/app/family-shell-v104.css'),
  read('public/app/installed-entry-v146.js'),
  read('public/app/manifest.webmanifest'),
  read('public/service-worker.js'),
  read('public/app/realm-console-v140.html'),
  read('public/app/cabinets/living-school/index.html'),
  read('public/app/fellowfare-cabinet-v144.html'),
  read('public/app/anarchadia-console-v139.html'),
  read('public/app/cabinet-mode-v142.html')
]);
for(const token of ['data-fullscreen-family="v104"','id="cwf104-frame"','family-shell-v104.js','guide-chat-v153.js','minilm-model-settings-v138.js'])assert(host.includes(token),`Full-screen family host is missing ${token}`);
for(const token of ["const VERSION='1.0.4'","commonweave:{label:'Commonweave'","'living-school':{label:'Living School'","cerbanimo:{label:'Cerbanimo'","fellowfare:{label:'FellowFare'","anarchadia:{label:'Anarchadia'",'.filter(([id])=>id!==current)','data-cwf-badge','data-cwf-state','CommonweaveModelSettingsV133','CommonweaveGuideChatV153'])assert(shell.includes(token),`Family runtime is missing ${token}`);
assert(shell.includes("site:'/app/realm-console-v140.html?system=commonweave"),'Commonweave must open its software console, not the campus or cabinet art.');
for(const token of ['grid-template-columns:repeat(4','cwf104-badge','cwf104-dot','cwf104-tray'])assert(styles.includes(token),`Four-button family tray styling is missing ${token}`);
assert(entry.includes('/app/fullscreen-family-v104.html?system=commonweave')&&entry.includes("params.get('system')")&&entry.includes("allowed.has(system)?system:'commonweave'"),'Installed entry does not skip directly to the full-screen family with a safe Commonweave default.');
const parsedManifest=JSON.parse(manifest);assert(parsedManifest.start_url.includes('system=commonweave'),'PWA does not start in Commonweave Cabinet Mode.');assert(parsedManifest.shortcuts.length===5,'Manifest must expose all five software systems.');
for(const page of [realm,living,fellowfare,anarchadia])assert(page.includes('/app/guide-chat-v153.js'),`Underlying software page is not wired to live guide chat.`);
assert(marketingCabinet.includes('cv141-art'),'Physical cabinet renderer must remain in source for marketing use.');
for(const token of ['/app/fullscreen-family-v104.html','/app/family-shell-v104.css','/app/family-shell-v104.js',"const VERSION='1.0.4'"])assert(worker.includes(token),`Lean device package is missing ${token}`);
for(const unused of ['/app/assets/cabinets/commonweave.webp','/app/assets/world/town-square-home.webp','/app/logos/commonweave-campus.webp','/app/assets/generated/commonweave-navigation-icons/','/app/cabinet-calibrator-v144.html','/app/shared/cabinet-shells-v129.json'])assert(!worker.includes(unused),`Unused marketing image/tool is still installed: ${unused}`);
console.log(JSON.stringify({ok:true,version:'1.0.4',mode:'five full-screen cabinet software sites',firstScreen:'commonweave',familyButtons:4,sharedAISettings:true,liveGuideChat:true,physicalCabinets:'repository-only marketing assets',devicePackage:'lean'},null,2));
