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
new Function(boundary);

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
assert(chat.dataset.civweaveLocalLayout===operation.id,'The applied local override was not marked.');
const restored=api.restoreFallback({operation,fallback},root);
assert(restored.ok&&display.children.indexOf(chat)===5,'The saved server placement was not restored.');
assert(!('civweaveLocalLayout'in chat.dataset),'The local override marker survived restoration.');

for(const token of [
  'civweave.local-interface-overrides.v167','civweave.server-layout-fallback.v1','targetShell','applySaved','KEEP ON THIS DEVICE','RESTORE SERVER LAYOUT','civweave-local-layout-v167','A server-provided fallback copy is saved locally'
])assert(runtime.includes(token),`Runtime is missing ${token}.`);
assert(runtime.includes("system:'anarchadia',kind:'local-interface-change'"),'Merlin does not create a canonical Anarchadia local-interface action.');
assert(runtime.includes('previewDocument(operation)'),'The request does not generate a live-page preview.');
assert(html.indexOf('anarchadia-change-review-v165.js')<html.indexOf('anarchadia-live-layout-v167.js'),'The local layout layer must load after the reviewed change pipeline.');
assert(html.includes('Try: Move this chat window to the top of the page.'),'The visible Merlin prompt does not expose the supported direct command.');
assert(html.includes('family-shell-v104.css?v=merlinites-r1')&&html.includes('family-shell-v104.js?v=merlinites-r2'),'The reconciled Anarchadia page lost the current merlinites global shell cache-bust.');
assert(html.indexOf('<script src="/app/model-settings-controller-v173.js')<html.indexOf('<script src="/app/family-ai-loader-v105.js'),'Anarchadia loads chat before the direct settings controller.');
assert(worker.includes("EXTENSION_VERSION='working-campus-additions-v174-settings-single-owner-assets'"),'Installed package did not rotate to the single-owner settings cutover.');
assert(worker.includes("SETTINGS_RUNTIME_REVISION='settings-runtime-v157.2-single-owner'"),'Service worker status does not report the single-owner settings runtime.');
assert(worker.includes('/extensions/civweave-antigravity-live-source-guard-v167.js'),'Installed package lost the Antigravity live-source guard.');
assert(worker.includes("LIVE_SOURCE_PROOF_REVISION='antigravity-live-source-proof-v167'"),'Service worker status does not report live-source proof.');
assert(worker.includes('/app/anarchadia-live-layout-v167.js'),'Installed cores do not receive the local layout runtime.');
assert(worker.includes("LOCAL_LAYOUT_REVISION='merlin-local-layout-fallback-v167'"),'Service worker status does not report the local layout revision.');
assert(worker.includes("MERLINITES_VISUAL_REVISION='merlinites-visual-overhaul-v166'"),'Service worker status does not report the merlinites visual shell.');
assert(worker.includes("TWO_AGENT_RELAY_REVISION='living-school-two-agent-youtube-v166'"),'The current package lost the Living School two-agent relay.');
assert(worker.includes("SETTINGS_CONTROLLER_REVISION='direct-settings-controller-v173'"),'Service worker status does not report the direct settings controller.');
assert(boundary.includes("ADDITIONS_VERSION='v174-settings-single-owner-assets'"),'Install boundary did not rotate to the single-owner settings cutover.');
assert(boundary.includes("PREVIOUS_ADDITIONS_VERSION='v173-ai-loader-cutover'"),'Install boundary lost the previous direct-settings receipt.');
assert(boundary.includes("SETTINGS_CONTROLLER_REVISION='v173-direct-settings-controller'"),'Install boundary does not report the direct settings controller.');
assert(boundary.includes("SETTINGS_RUNTIME_REVISION='v157.2-single-owner'"),'Install boundary does not report the single-owner settings runtime.');
assert(boundary.includes("additionsVersion:'v173-ai-loader-cutover'"),'Install boundary lost the v173 settings compatibility receipt.');
assert(boundary.includes("additionsVersion:'v172-settings-window-capture'"),'Install boundary lost the v172 settings compatibility receipt.');
assert(boundary.includes("additionsVersion:'v171-settings-safe-open'"),'Install boundary lost the v171 settings compatibility receipt.');
assert(boundary.includes("additionsVersion:'v167-antigravity-live-source-proof'"),'Install boundary lost the Antigravity proof compatibility receipt.');
assert(boundary.includes("additionsVersion:'v166-two-agent-youtube-reviewed-handoffs'"),'Install boundary lost the v166 relay compatibility receipt.');

console.log(JSON.stringify({
  ok:true,
  exactRequest:'Move this chat window to the top of the page',
  generated:'live-page-preview',
  keep:'device-persistent-local-override',
  fallback:'server-element-shell-and-original-placement',
  restore:'server-layout',
  preserved:['single-owner-settings-runtime','direct-settings-controller','settings-window-capture-compatibility','settings-safe-open-compatibility','antigravity-live-source-proof','merlinites-visual-shell','reviewed-merlin-handoffs','living-school-two-agent-relay','offline-installed-package']
},null,2));