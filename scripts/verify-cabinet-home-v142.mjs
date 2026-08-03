import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const read=file=>fs.readFile(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [runtime,styles,realmHtml,anarchadiaHtml,shellText,serviceWorker]=await Promise.all([
  read('public/app/cabinet-home-v142.js'),
  read('public/app/cabinet-home-v142.css'),
  read('public/app/realm-console-v140.html'),
  read('public/app/anarchadia-console-v139.html'),
  read('public/app/shared/cabinet-shells-v129.json'),
  read('public/service-worker.js')
]);
const shells=JSON.parse(shellText);

for(const [guide,asset] of [
  ['Weaveling','/app/assets/ai/weaveling.png'],
  ['Moss','/app/assets/ai/moss.png'],
  ['Kamiya','/app/assets/ai/kamiya.png'],
  ['Rook','/app/assets/ai/rook.png'],
  ['Merlin','/app/assets/ai/merlin.png']
]){
  assert(runtime.includes(`guide:'${guide}'`),`${guide} is missing from the cabinet home contract.`);
  assert(runtime.includes(`mascot:'${asset}'`),`${guide}'s mascot is not mounted next to cabinet chat.`);
}

assert(runtime.includes("header.insertAdjacentElement('afterend',band)"),'Cabinet controls must mount immediately below the header.');
assert(runtime.includes('ch142-chat-log')&&runtime.includes('ch142-chat-form'),'Cabinet home is missing the prominent inline chat surface.');
assert(runtime.includes('<details class="ch142-features">'),'Feature controls must use a dropdown.');
assert(styles.includes('[data-cabinet-mode="home"] .rc-dashboard')&&styles.includes('[data-cabinet-mode="home"] .rc-workspace'),'Legacy feature grids must be hidden from cabinet home.');
assert(styles.includes('.ac-grid{display:none!important}'),'Anarchadia’s lower feature tile grid must be replaced by the dropdown.');
assert(runtime.includes('data-ch142-capability')&&runtime.includes("location.assign(`/app/realm-console-v140.html?${query}`)"),'Implemented realm features must launch directly.');
assert(runtime.includes('data-screen-target')&&runtime.includes('data-request-kind'),'Implemented Anarchadia features must launch their existing screen or request form.');
assert(runtime.includes('data-ch142-coming="true"')&&runtime.includes("toast('Coming soon. This control stays here instead of sending you to a dead route.')"),'Missing features must say Coming soon without redirecting.');

for(const html of [realmHtml,anarchadiaHtml]){
  assert(html.includes('/app/cabinet-home-v142.css'),'Cabinet console is missing the shared cabinet-home stylesheet.');
  assert(html.includes('/app/cabinet-home-v142.js'),'Cabinet console is missing the shared cabinet-home controller.');
  assert(html.includes('/app/assistant-runtime-v141.js'),'Cabinet console is missing the canonical assistant runtime.');
}

const anarchadia=shells.systems.anarchadia.screen;
assert(anarchadia.y<26.85,`Anarchadia overlay was not shifted upward: ${anarchadia.y}`);
assert(anarchadia.x>12.8,`Anarchadia overlay did not move inward from the left: ${anarchadia.x}`);
assert(anarchadia.width<74.4,`Anarchadia overlay was not thinned in width: ${anarchadia.width}`);
assert(anarchadia.height===56.15,`Anarchadia overlay height must remain unchanged: ${anarchadia.height}`);
assert(Math.abs((anarchadia.x+anarchadia.width/2)-50)<0.001,'Anarchadia overlay must remain horizontally centered.');
assert(serviceWorker.includes('cabinet-home-r22'),'Service worker must rotate the cabinet-home cache.');
assert(serviceWorker.includes('/app/cabinet-home-v142.js')&&serviceWorker.includes('/app/cabinet-home-v142.css'),'Service worker must cache the active cabinet-home layer.');

console.log(JSON.stringify({
  ok:true,
  acceptance:{
    mascotChat:true,
    controlsBelowHeader:true,
    featureDropdown:true,
    directFeatureLaunch:true,
    comingSoonFallback:true,
    anarchadiaOverlayRaised:true,
    anarchadiaOverlayNarrowed:true,
    anarchadiaOverlayHeightPreserved:true
  },
  anarchadiaScreen:anarchadia
},null,2));
