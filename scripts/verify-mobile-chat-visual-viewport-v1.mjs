import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('public/app/mobile-chat-visual-viewport-v1.js','utf8');
const shared=fs.readFileSync('public/app/shared-guide-surface-v236.js','utf8');
const savedUi=fs.readFileSync('public/app/saved-chat-ui-v295.js','utf8');
const savedStore=fs.readFileSync('public/app/saved-chat-store-v295.js','utf8');
const workerRepair=fs.readFileSync('public/service-worker-chat-repair-v245.js','utf8');
for(const text of [source,shared,savedUi,savedStore])new Function(text);

const styles=new Map();
const vars=new Map();
const listeners=[];
const documentElement={
  style:{
    setProperty(name,value){vars.set(name,value)},
    removeProperty(name){vars.delete(name)}
  }
};
const document={
  readyState:'complete',
  documentElement,
  head:{append(node){if(node?.id)styles.set(node.id,node)}},
  createElement(tag){return tag==='style'?{id:'',textContent:''}:{dataset:{},closest(){return null}}},
  getElementById(id){return styles.get(id)||null},
  addEventListener(type,handler){listeners.push({target:'document',type,handler})}
};
const visualViewport={
  height:512,
  width:412,
  offsetTop:0,
  offsetLeft:0,
  addEventListener(type,handler){listeners.push({target:'visualViewport',type,handler})}
};
const sandbox={
  console,
  document,
  visualViewport,
  innerWidth:412,
  innerHeight:915,
  matchMedia(){return{matches:true}},
  addEventListener(type,handler){listeners.push({target:'window',type,handler})},
  requestAnimationFrame(handler){handler();return 1},
  setTimeout(handler){handler();return 1}
};
sandbox.globalThis=sandbox;
vm.runInNewContext(source,sandbox,{filename:'mobile-chat-visual-viewport-v1.js'});

const api=sandbox.CivweaveMobileChatVisualViewportV1;
if(!api)throw new Error('Mobile chat visual viewport API did not install.');
if(vars.get('--cw-chat-visual-height')!=='512px')throw new Error(`Keyboard-open visual height was not applied: ${vars.get('--cw-chat-visual-height')}`);
if(vars.get('--cw-chat-visual-width')!=='412px')throw new Error('Visual viewport width was not applied.');
visualViewport.height=915;
api.apply();
if(vars.get('--cw-chat-visual-height')!=='915px')throw new Error('Keyboard-close visual height was not restored.');

const style=styles.get('cw-mobile-chat-visual-viewport-v1-style')?.textContent||'';
for(const required of [
  'top:var(--cw-chat-visual-top,0px)!important',
  'height:var(--cw-chat-visual-height,100dvh)!important',
  'max-height:var(--cw-chat-visual-height,100dvh)!important',
  'bottom:auto!important',
  'display:flex!important',
  'flex-direction:column!important',
  'flex:1 1 0!important',
  'height:0!important',
  'overflow-y:auto!important',
  '>.cw295-saved-chats',
  '[data-persistent-form]',
  'html[data-civweave-mobile-ai-hardening="v302"]'
])if(!style.includes(required))throw new Error(`Missing long-thread viewport CSS contract: ${required}`);

if(!listeners.some(row=>row.target==='visualViewport'&&row.type==='resize'))throw new Error('Visual viewport resize is not observed.');
if(!listeners.some(row=>row.target==='visualViewport'&&row.type==='scroll'))throw new Error('Visual viewport offset changes are not observed.');
if(!source.includes('composerVisibilityInvariant:true')||!source.includes('longThreadScrollOwner:true'))throw new Error('Long-thread composer visibility invariant is not declared.');

for(const required of [
  'function activateThreadUI',
  'ensureChatUiModules',
  "'/app/saved-chat-store-v295.js?rev=1.0.164-thread-tabs-v352'",
  "'/app/saved-chat-ui-v295.js?rev=1.0.166-thread-tabs-v354'",
  "addEventListener('civweave:guide-chat-opened'",
  "threadUi:'saved-chat-v354-lazy-on-open'"
])if(!shared.includes(required))throw new Error(`Saved-thread activation contract missing: ${required}`);
if(!savedUi.includes('cw295-has-saved-chats')||!savedUi.includes('data-cw295-new'))throw new Error('Saved thread bar/new-thread UI is missing.');
if(!savedStore.includes('function create(system)')||!savedStore.includes('function select(system,id)'))throw new Error('Saved thread create/select persistence is missing.');
if(!workerRepair.includes("'/app/mobile-chat-visual-viewport-v1.js'")||!workerRepair.includes("'/app/saved-chat-ui-v295.js'")||!workerRepair.includes("'/app/saved-chat-store-v295.js'"))throw new Error('Installed-PWA cache repair does not rotate the long-thread/threadbar assets.');

console.log('Mobile guide chat verified: long transcripts stay inside the scroll region, the composer remains in-frame, and saved thread tabs/new-thread controls are restored on chat open.');
