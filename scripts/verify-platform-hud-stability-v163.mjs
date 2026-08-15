import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=await readFile(path.join(root,'public/app/platform-experience-v160.js'),'utf8');
const worker=await readFile(path.join(root,'public/service-worker-v156.js'),'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};

for(const token of [
  '1.0.4-platform-experience-v160.2-owner-clean',
  'function writeText',
  'function writeHidden',
  'function relevantMutation',
  'if(patchQueued||patching)return',
  'observer?.disconnect?.()',
  'diagnostics={observerCallbacks:0,patchRuns:0,domWrites:0}',
  "ownership:'appearance-and-review-hud-only'",
  'assistantPatching:false',
  'contractPatching:false'
])assert(source.includes(token),`Shared HUD stability runtime is missing ${token}`);
assert(!source.includes('new MutationObserver(patchDom)'),'The shared HUD must not run its patch function for every page mutation.');
assert(!source.includes('review.innerHTML='),'The review control must not rebuild its own child tree during refresh.');
assert(!source.includes('Object.defineProperty(globalThis'),'Appearance HUD must not intercept another runtime global.');
assert(!source.includes('patchAssistant')&&!source.includes('patchContracts'),'Appearance HUD must not patch assistant or action-contract owners.');
for(const token of [
  'working-campus-additions-v163-hud-observer-stability',
  'hud-observer-stability-v163',
  "PLATFORM_EXPERIENCE_REVISION='dark-review-rook-learning-v160.1-hud-stable'",
  "'/app/platform-experience-v160.js'"
])assert(worker.includes(token),`Installed-device repair package is missing ${token}`);

class Storage{
  constructor(){this.map=new Map()}
  getItem(key){return this.map.has(String(key))?this.map.get(String(key)):null}
  setItem(key,value){this.map.set(String(key),String(value))}
  removeItem(key){this.map.delete(String(key))}
}
const camel=value=>value.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());
const observers=[];
class MutationObserver{
  constructor(callback){this.callback=callback;this.active=false;observers.push(this)}
  observe(){this.active=true}
  disconnect(){this.active=false}
}
const notify=addedNodes=>{for(const observer of observers)if(observer.active)observer.callback([{addedNodes,target:null}])};
class Element{
  constructor(tag='div'){
    this.nodeType=1;this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.style={};
    this.hidden=false;this.title='';this.id='';this.className='';this.attributes=new Map();this.listeners=new Map();this._text='';
    const classes=new Set();
    this.classList={contains:name=>classes.has(name),toggle:(name,force)=>{const next=force===undefined?!classes.has(name):Boolean(force);if(next)classes.add(name);else classes.delete(name);return next},add:name=>classes.add(name)};
  }
  set textContent(value){const next=String(value??'');if(this._text===next)return;this._text=next;notify([{nodeType:3}])}
  get textContent(){return this._text}
  append(...nodes){for(const node of nodes){if(!node)continue;this.children.push(node);node.parentElement=this}if(nodes.length)notify(nodes)}
  addEventListener(type,handler){this.listeners.set(type,handler)}
  setAttribute(name,value){this.attributes.set(name,String(value))}
  getAttribute(name){return this.attributes.has(name)?this.attributes.get(name):null}
  matches(selector){return selector.split(',').some(raw=>{const part=raw.trim();if(part==='iframe')return this.tagName==='IFRAME';if(part==='.top')return this.className.split(/\s+/).includes('top')||this.classList.contains('top');if(part==='#cwf104-head')return this.id==='cwf104-head';if(part==='meta[name="theme-color"]')return this.tagName==='META'&&this.getAttribute('name')==='theme-color';if(part==='link[data-cw160-frame-theme]')return this.tagName==='LINK'&&Object.hasOwn(this.dataset,'cw160FrameTheme');const match=part.match(/^\[data-([a-z0-9-]+)\]$/i);if(match)return Object.hasOwn(this.dataset,camel(match[1]));return false})}
  querySelector(selector){for(const child of this.children){if(child.matches?.(selector))return child;const found=child.querySelector?.(selector);if(found)return found}return null}
  querySelectorAll(selector){const found=[];for(const child of this.children){if(child.matches?.(selector))found.push(child);found.push(...(child.querySelectorAll?.(selector)||[]))}return found}
}
const documentElement=new Element('html'),head=new Element('head'),body=new Element('body'),meta=new Element('meta'),host=new Element('header');
meta.setAttribute('name','theme-color');host.className='top';host.classList.add('top');documentElement.append(head,body);head.append(meta);body.append(host);
const document={readyState:'complete',documentElement,head,body,createElement:tag=>new Element(tag),getElementById:id=>documentElement.querySelector(`#${id}`),querySelector:selector=>documentElement.matches(selector)?documentElement:documentElement.querySelector(selector),querySelectorAll:selector=>documentElement.querySelectorAll(selector),addEventListener(){}};
const localStorage=new Storage(),microtasks=[],events=[];
localStorage.setItem('civweave.realm-actions.v141',JSON.stringify([{id:'action-1',title:'Add a platform dark mode',state:'review',system:'anarchadia',createdAt:'2026-08-04T12:00:00Z'}]));
const context={console,document,localStorage,sessionStorage:new Storage(),MutationObserver,CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},Date,Math,JSON,Object,URLSearchParams,matchMedia:()=>({matches:false,addEventListener(){}}),queueMicrotask:callback=>microtasks.push(callback),setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout,addEventListener(){},dispatchEvent:event=>events.push(event)};
context.globalThis=context;context.window=context;vm.createContext(context);vm.runInContext(source,context,{filename:'platform-experience-v160.js'});
let flushes=0;while(microtasks.length){const task=microtasks.shift();task();if(++flushes>50)throw new Error('Shared HUD entered a recursive microtask loop during boot.')}
const api=context.CivweavePlatformExperienceV160;assert(api,'Shared HUD API did not boot.');assert(host.querySelector('[data-cw160-review]'),'Review HUD control was not mounted.');assert(host.querySelector('[data-cw160-theme]'),'Theme HUD control was not mounted.');
const stableWrites=api.diagnostics.domWrites,stablePatches=api.diagnostics.patchRuns;
for(let index=0;index<250;index++){const node=new Element('div');node.className='subsystem-update';body.append(node);api.refreshControls()}
while(microtasks.length){const task=microtasks.shift();task();if(++flushes>100)throw new Error('Shared HUD entered a recursive loop after subsystem updates.')}
assert(api.diagnostics.patchRuns===stablePatches,`Unrelated subsystem mutations scheduled ${api.diagnostics.patchRuns-stablePatches} extra HUD patch runs.`);
assert(api.diagnostics.domWrites===stableWrites,`Stable HUD refreshes performed ${api.diagnostics.domWrites-stableWrites} unnecessary DOM writes.`);
assert(api.diagnostics.observerCallbacks>=250,'The test did not exercise the shared observer under subsystem mutations.');
console.log(JSON.stringify({ok:true,systems:['civweave','living-school','cerbanimo','fellowfare','anarchadia'],bootPatchRuns:stablePatches,stableDomWrites:stableWrites,unrelatedMutationCallbacks:api.diagnostics.observerCallbacks,extraPatchRuns:api.diagnostics.patchRuns-stablePatches,extraDomWrites:api.diagnostics.domWrites-stableWrites,foreignRuntimePatches:0,installedRepair:'working-campus-additions-v163-hud-observer-stability'},null,2));