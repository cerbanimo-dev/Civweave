import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const [runtime,html,worker,boundary]=await Promise.all([
  readFile('public/app/anarchadia-live-layout-v167.js','utf8'),
  readFile('public/app/anarchadia-console-v139.html','utf8'),
  readFile('public/service-worker-v156.js','utf8'),
  readFile('public/app/install-boundary-v146.js','utf8')
]);
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
new Function(runtime);

class MemoryStorage{
  constructor(){this.values=new Map()}
  getItem(key){return this.values.has(String(key))?this.values.get(String(key)):null}
  setItem(key,value){this.values.set(String(key),String(value))}
  removeItem(key){this.values.delete(String(key))}
}
const sandbox={
  console,Date,Math,JSON,Object,Array,Set,Map,RegExp,String,Number,Boolean,Promise,URL,
  localStorage:new MemoryStorage(),setTimeout,clearTimeout,
  CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  dispatchEvent(){return true},addEventListener(){},CSS:{escape:value=>String(value)},globalThis:null
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(runtime,sandbox,{filename:'anarchadia-live-layout-v167.js'});
const api=sandbox.AnarchadiaLiveLayoutV167;
assert(api?.recognizeLayout,'Merlin local-layout API was not installed.');

const intent=api.recognizeLayout('Move this chat window to the top of the page');
assert(intent?.targetSelector==='.ac-merlin-chat','The exact user request did not resolve to the Merlin chat window.');
assert(intent?.placement==='top','The exact user request did not resolve to the top placement.');
assert(api.recognizeLayout('Please explain the chat window')===null,'A non-layout conversation was incorrectly treated as an interface edit.');
const operation=api.operationFor(intent,{path:'/app/anarchadia-console-v139.html',build:'server-build-1'});
assert(operation.referenceSelector==='.ac-passport'&&operation.parentSelector==='.ac-display','Top placement does not preserve the console bar and move before the first content card.');

class FakeNode{
  constructor({id='',className='',outerHTML='<section></section>'}={}){this.id=id;this.classList=className?className.split(/\s+/):[];this.outerHTML=outerHTML;this.dataset={};this.parentElement=null;this.children=[]}
  append(node){this._insert(node,this.children.length)}
  prepend(node){this._insert(node,0)}
  insertBefore(node,anchor){const index=this.children.indexOf(anchor);this._insert(node,index<0?this.children.length:index)}
  _insert(node,index){if(node.parentElement){const previousParent=node.parentElement,prior=previousParent.children.indexOf(node);if(prior>=0){previousParent.children.splice(prior,1);if(previousParent===this&&prior<index)index--}}node.parentElement=this;this.children.splice(index,0,node)}
  cloneNode(){return{outerHTML:this.outerHTML,querySelectorAll(){return[]}}}
}
const display=new FakeNode({className:'ac-display',outerHTML:'<section class="ac-display"></section>'});
const noise=new FakeNode({className:'ac-frame-noise'});
const bar=new FakeNode({className:'ac-console-bar'});
const passport=new FakeNode({className:'ac-passport'});
const grid=new FakeNode({className:'ac-grid'});
const pulse=new FakeNode({className:'ac-pulse'});
const chat=new FakeNode({className:'ac-merlin-chat',outerHTML:'<section class="ac-merlin-chat"><div class="ac-merlin-log">private history</div></section>'});
const footer=new FakeNode({className:'ac-footer'});
for(const node of[noise,bar,passport,grid,pulse,chat,footer])display.append(node);
const nodes={'.ac-display':display,'.ac-passport':passport,'.ac-merlin-chat':chat,'.ac-footer':footer};
const root={querySelector(selector){return nodes[selector]||null}};
const fallback=api.captureFallback(operation,root);
assert(fallback?.serverProvided===true,'The server-provided fallback was not marked and saved.');
assert(fallback.originalIndex===5&&fallback.nextSiblingSelector==='.ac-footer','The original chat placement was not captured.');
assert(fallback.targetShell.includes('ac-merlin-chat'),'The device fallback does not contain the server-provided chat shell.');
const moved=api.applyOperation(operation,root);
assert(moved.ok&&display.children.indexOf(chat)===2,'The chat window was not moved above the passport.');
assert(chat.dataset.commonweaveLocalLayout===operation.id,'The applied local override was not marked.');
const restored=api.restoreFallback({operation,fallback},root);
assert(restored.ok&&display.children.indexOf(chat)===5,'The saved server placement was not restored.');
assert(!('commonweaveLocalLayout'in chat.dataset),'The local override marker survived restoration.');

for(const token of [
  'commonweave.local-interface-overrides.v167','commonweave.server-layout-fallback.v1','targetShell','applySaved','KEEP ON THIS DEVICE','RESTORE SERVER LAYOUT','commonweave-local-layout-v167','A server-provided fallback copy is saved locally'
])assert(runtime.includes(token),`Runtime is missing ${token}.`);
assert(runtime.includes("system:'anarchadia',kind:'local-interface-change'"),'Merlin does not create a canonical Anarchadia local-interface action.');
assert(runtime.includes('previewDocument(operation)'),'The request does not generate a live-page preview.');
assert(html.indexOf('anarchadia-change-review-v165.js')<html.indexOf('anarchadia-live-layout-v167.js'),'The local layout layer must load after the reviewed change pipeline.');
assert(html.includes('Try: Move this chat window to the top of the page.'),'The visible Merlin prompt does not expose the supported direct command.');
assert(worker.includes("EXTENSION_VERSION='working-campus-additions-v167-merlin-local-layout-fallback'"),'Installed package did not rotate to the local-layout revision.');
assert(worker.includes('/app/anarchadia-live-layout-v167.js'),'Installed cores do not receive the local layout runtime.');
assert(worker.includes("LOCAL_LAYOUT_REVISION='merlin-local-layout-fallback-v167'"),'Service worker status does not report the local layout revision.');
assert(worker.includes("TWO_AGENT_RELAY_REVISION='living-school-two-agent-youtube-v166'"),'The current package lost the Living School two-agent relay.');
assert(boundary.includes("additionsVersion:'v167-merlin-local-layout-fallback'"),'Install boundary did not rotate to v167.');
assert(boundary.includes("additionsVersion:'v166-two-agent-youtube-reviewed-handoffs'"),'Install boundary lost the v166 relay compatibility receipt.');

console.log(JSON.stringify({
  ok:true,
  exactRequest:'Move this chat window to the top of the page',
  generated:'live-page-preview',
  keep:'device-persistent-local-override',
  fallback:'server-element-shell-and-original-placement',
  restore:'server-layout',
  preserved:['reviewed-merlin-handoffs','living-school-two-agent-relay','offline-installed-package']
},null,2));
