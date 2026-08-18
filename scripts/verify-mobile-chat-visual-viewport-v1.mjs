import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('public/app/mobile-chat-visual-viewport-v1.js','utf8');
new Function(source);

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
  '[data-persistent-form]',
  'html[data-civweave-mobile-ai-hardening="v302"]'
])if(!style.includes(required))throw new Error(`Missing visual viewport CSS contract: ${required}`);

if(!listeners.some(row=>row.target==='visualViewport'&&row.type==='resize'))throw new Error('Visual viewport resize is not observed.');
if(!listeners.some(row=>row.target==='visualViewport'&&row.type==='scroll'))throw new Error('Visual viewport offset changes are not observed.');
if(!source.includes('composerVisibilityInvariant:true'))throw new Error('Composer visibility invariant is not declared.');

console.log('Mobile chat visual viewport verified: keyboard-open height constrains the canonical guide surface and keeps the composer in the visible viewport.');
