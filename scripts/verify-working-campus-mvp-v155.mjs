import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const [host,entry]=await Promise.all([
  read('public/app/fullscreen-family-v104.html'),
  read('public/app/installed-entry-v146.js')
]);

const packed=host.match(/const payload='([^']+)'/);
const html=packed?gunzipSync(Buffer.from(packed[1],'base64')).toString('utf8'):host;

for(const token of [
  'Commonweave Working Campus','What is your wish?','Aptitude and learning choice',
  'Build reviewable weave','Activate weave','Guided rails','Free roam',
  'commonweave.working-campus.v1','commonweave.intentions.v127',
  'commonweave.realm-inbox.v1','commonweave.context.v1',
  'commonweave.active-handoff.v1','commonweave.intention-weave.v1',
  '/app/assets/ai/weaveling.png','/app/assets/ai/moss.png','/app/assets/ai/kamiya.png',
  '/app/assets/ai/rook.png','/app/assets/ai/merlin.png'
])assert(html.toLowerCase().includes(token.toLowerCase()),`Working Campus is missing ${token}`);
for(const route of [
  '/app/realm-console-v140.html?system=commonweave',
  '/app/cabinets/living-school/index.html',
  '/app/realm-console-v140.html?system=cerbanimo',
  '/app/fellowfare-cabinet-v144.html',
  '/app/anarchadia-console-v139.html'
])assert(html.includes(route),`Working Campus is missing route ${route}`);
assert(host.includes('location.replace')&&!host.includes('<iframe'),'Compatibility host must keep direct full-screen realm navigation.');
assert(packed&&host.includes('DecompressionStream'), 'Working Campus payload is not embedded in the cached compatibility host.');
assert(entry.includes("const sites={commonweave:'/app/realm-console-v140.html")&&entry.includes("system==='commonweave'?'/app/fullscreen-family-v104.html?system=commonweave'"),'Installed entry does not boot the Working Campus for Commonweave.');

const hostScripts=[...host.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
new vm.Script(hostScripts.at(-1)?.[1]||'',{filename:'fullscreen-family-v104.loader.js'});
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
const code=scripts.at(-1)?.[1]||'';
new vm.Script(code,{filename:'fullscreen-family-v104.inline.js'});
new vm.Script(entry,{filename:'installed-entry-v146.js'});

class Store{constructor(){this.map=new Map()}getItem(k){return this.map.has(k)?this.map.get(k):null}setItem(k,v){this.map.set(k,String(v))}removeItem(k){this.map.delete(k)}}
class El{
  constructor(key=''){this.key=key;this.listeners={};this.dataset={};this.style={};this.hidden=false;this.value='';this.checked=false;this._innerHTML='';this.textContent='';this.src='';this.files=[];this.classList={toggle(){},add(){},remove(){},contains(){return false}}}
  set innerHTML(value){this._innerHTML=String(value)} get innerHTML(){return this._innerHTML}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn)}
  dispatch(type,event={}){for(const fn of [...(this.listeners[type]||[])])fn({target:this,currentTarget:this,key:'',ctrlKey:false,metaKey:false,...event})}
  scrollIntoView(){} append(){} appendChild(){} remove(){} click(){this.dispatch('click')}
}
const staticMarkup=html.slice(0,html.lastIndexOf('<script>'));
const staticIds=new Set([...staticMarkup.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]));
const staticElements=new Map(),dynamicElements=new Map(),badges=new Map();
let workspaceMarkup='';
const staticEl=id=>{if(!staticElements.has(id))staticElements.set(id,new El(id));return staticElements.get(id)};
const dynamicEl=id=>{if(!dynamicElements.has(id))dynamicElements.set(id,new El(id));return dynamicElements.get(id)};
const workspace=staticEl('workspace');
Object.defineProperty(workspace,'innerHTML',{get(){return workspaceMarkup},set(value){workspaceMarkup=String(value);dynamicElements.clear();for(const match of workspaceMarkup.matchAll(/\bid="([^"]+)"/g))dynamicEl(match[1]);}});
for(const id of ['living-school','cerbanimo','fellowfare','anarchadia'])badges.set(id,new El(`badge-${id}`));
const realms=['living-school','cerbanimo','fellowfare','anarchadia'].map(id=>{const el=new El(`realm-${id}`);el.dataset.realm=id;return el});
const views=['weave','progress','library','campus'].map(id=>{const el=new El(`view-${id}`);el.dataset.view=id;return el});
function query(selector){
  if(selector.startsWith('#')){const id=selector.slice(1);if(staticIds.has(id))return staticEl(id);return dynamicElements.get(id)||null}
  const badge=selector.match(/^\[data-badge="([^"]+)"\]$/);if(badge)return badges.get(badge[1])||null;
  if(selector==='input[name="model-route"]:checked')return null;
  return null;
}
const document={body:{style:{},append(){},appendChild(){}},querySelector:query,querySelectorAll(selector){if(selector==='.realm-node')return realms;if(selector==='[data-view]')return views;return[]},createElement(){return new El('created')}};
const localStorage=new Store(),sessionStorage=new Store(),windowListeners={};
const location={search:'?system=commonweave',origin:'http://example.test',href:'http://example.test/app/fullscreen-family-v104.html?system=commonweave',replace(){throw new Error('Unexpected Commonweave redirect')}};
class RuntimeURL extends URL{static createObjectURL(){return'blob:test'}static revokeObjectURL(){}}
const sandbox={console,document,localStorage,sessionStorage,location,window:null,setTimeout(fn){fn();return 1},clearTimeout(){},requestAnimationFrame(fn){fn()},Blob:class{},URL:RuntimeURL,URLSearchParams,FileReader:class{},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail}},dispatchEvent(){},navigator:{},structuredClone};
sandbox.window={location,origin:location.origin,addEventListener(type,fn){(windowListeners[type]??=[]).push(fn)},removeEventListener(){},setTimeout:sandbox.setTimeout,clearTimeout:sandbox.clearTimeout,parent:null};sandbox.window.parent=sandbox.window;
vm.createContext(sandbox);vm.runInContext(code,sandbox,{filename:'fullscreen-family-v104.inline.js'});
const state=()=>JSON.parse(localStorage.getItem('commonweave.working-campus.v1'));
assert(state().stage==='wish'&&state().conversation[0]?.text.includes('What is your wish'),'Weaveling welcome state did not initialize.');
query('#wish-input').value='I want to rebuild a collaborative offline-first creative software platform with learning, skilled labor, material exchange, and consent.';query('#submit-wish').dispatch('click');
assert(state().stage==='profile','Wish did not advance to aptitude intake.');
query('#skill-level').value='comfortable';query('#learning-mode').value='practice';query('#collaboration-mode').value='group';query('#weekly-hours').value='6-10';query('#constraints').value='Offline-first and no hosted AI in the free tier.';query('#build-plan').dispatch('click');
assert(state().stage==='review'&&state().plan.paths.length===3,'Aptitude intake did not build a three-path reviewable weave.');
query('#activate-plan').dispatch('click');
const active=state(),ledger=JSON.parse(localStorage.getItem('commonweave.intentions.v127')),inbox=JSON.parse(localStorage.getItem('commonweave.realm-inbox.v1'));
assert(active.stage==='active'&&active.plan.state==='active','Explicit review gate did not activate the weave.');
assert(ledger.length===1&&ledger[0].plan.id===active.plan.id,'Canonical intention ledger did not receive the active weave.');
for(const target of ['living-school','cerbanimo','fellowfare','anarchadia'])assert(inbox.some(packet=>packet.target===target),`Missing ${target} handoff.`);
realms[0].dispatch('click');
assert(location.href.includes('/app/cabinets/living-school/index.html'),'Living School did not launch through its direct runtime.');
assert(JSON.parse(localStorage.getItem('commonweave.context.v1')).intention.id===active.plan.id,'Realm context was not staged before navigation.');
assert(JSON.parse(localStorage.getItem('commonweave.active-handoff.v1')).target==='living-school','Active realm handoff was not staged.');

console.log(JSON.stringify({ok:true,surface:'working-campus',stage:active.stage,paths:active.plan.paths.map(path=>path.realm),handoffs:inbox.length,navigation:'direct full-screen',offlineState:'local canonical'},null,2));
