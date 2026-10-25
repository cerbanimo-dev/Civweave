import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {JSDOM} from 'jsdom';

const read=path=>readFileSync(new URL(`../public/${path}`,import.meta.url),'utf8');
const navigation=read('app/themed-system-nav-v178.js');
const campus=[1,2,3,4,5].map(index=>read(`app/working-campus-v156.part${index}.txt`)).join('');

function fixture(t,{path='/app/working-campus-v440.html',system='civweave',feature='library'}={}){
  const dom=new JSDOM(read(path.slice(1)),{url:`https://civweave.test${path}?system=${system}&civweave=1&cabinet=1&embed=1&persistentShell=1&feature=${feature}&keep=1`,runScripts:'outside-only'}),{window}=dom;
  const observers=[],Observer=window.MutationObserver,timers=[];
  window.MutationObserver=class extends Observer{constructor(callback){super(callback);observers.push(this)}};
  t.after(()=>{for(const observer of observers)observer.disconnect();window.close()});
  Object.defineProperty(window.document,'readyState',{value:'complete',configurable:true});
  window.setTimeout=(callback,delay)=>{timers.push(delay);return 0};window.clearTimeout=()=>{};
  window.requestAnimationFrame=callback=>{callback();return 0};window.HTMLElement.prototype.scrollIntoView=function(){this.dataset.revealed='true'};
  window.scrollTo=()=>{};window.CSS={escape:value=>value};
  window.CivweaveProgressiveDisclosureV1={};window.structuredClone=structuredClone;
  return{window,timers,start:()=>window.eval(navigation)};
}

test('embedded Quest Library waits for actual campus readiness and opens the canonical view once',t=>{
  const app=fixture(t),{window}=app;app.start();
  assert.equal(new URL(window.location.href).searchParams.get('feature'),'library','An unavailable destination must remain pending.');
  window.eval(campus);
  assert.equal(window.CivweaveWorkingCampusV156.currentView(),'quest');
  window.dispatchEvent(new window.CustomEvent('civweave:working-campus-runtime-ready'));
  assert.equal(window.CivweaveWorkingCampusV156.currentView(),'library');
  assert.equal(window.document.getElementById('view-title').textContent,'Quest Library');
  assert.equal(new URL(window.location.href).searchParams.has('feature'),false);
  assert.equal(new URL(window.location.href).searchParams.get('keep'),'1');
  const workspace=window.document.getElementById('workspace').firstElementChild;
  window.dispatchEvent(new window.CustomEvent('civweave:working-campus-runtime-ready'));
  window.dispatchEvent(new window.Event('pageshow'));
  assert.equal(window.document.getElementById('workspace').firstElementChild,workspace,'A consumed shortcut must not redraw the destination.');
  assert.equal(window.document.getElementById('cw-themed-system-nav'),null,'Embedded content must not mount another navigation rail.');
  assert.equal(window.document.getElementById('cw-themed-system-nav-style'),null);
  assert.deepEqual(app.timers,[],'Feature readiness must not depend on a fixed retry or mount polling.');
});

test('embedded content consumes a shortcut immediately when its capability already exists',t=>{
  const app=fixture(t),{window}=app;window.eval(campus);app.start();
  assert.equal(window.CivweaveWorkingCampusV156.currentView(),'library');
  assert.equal(new URL(window.location.href).searchParams.has('feature'),false);
  assert.equal(window.document.getElementById('cw-themed-system-nav'),null);
});

test('embedded Moss shortcuts wait for the existing workbench ready event',t=>{
  const app=fixture(t,{path:'/app/cabinets/living-school/index.html',system:'living-school',feature:'practicum'}),{window}=app;app.start();
  assert.equal(new URL(window.location.href).searchParams.get('feature'),'practicum');
  window.document.body.innerHTML='<details data-cw-pd-id="living-practicum"><summary>Apply learning in the world</summary><input></details>';
  window.dispatchEvent(new window.CustomEvent('civweave:living-school-workbench-ready'));
  const panel=window.document.querySelector('details');assert.equal(panel.open,true);assert.equal(panel.dataset.revealed,'true');
  assert.equal(new URL(window.location.href).searchParams.has('feature'),false);
  assert.equal(window.document.getElementById('cw-themed-system-nav'),null);
  assert.deepEqual(app.timers,[]);
});

test('an unsupported embedded shortcut stays unconsumed without scheduled retries',t=>{
  const app=fixture(t,{feature:'unknown-feature'}),{window}=app;window.eval(campus);app.start();
  window.dispatchEvent(new window.CustomEvent('civweave:working-campus-runtime-ready'));
  assert.equal(window.CivweaveWorkingCampusV156.currentView(),'quest');
  assert.equal(new URL(window.location.href).searchParams.get('feature'),'unknown-feature');
  assert.deepEqual(app.timers,[]);
});

test('embedded Cerbanimo waits for its asynchronous canonical workbench mount',{timeout:5000},async t=>{
  const app=fixture(t,{path:'/app/realm-console-v140.html',system:'cerbanimo',feature:'project-workbench'}),{window}=app;app.start();
  let release;window.CivweaveParity={load:()=>new Promise(resolve=>{release=resolve})};
  window.eval(read('app/realm-console-v140.js'));
  assert.equal(new URL(window.location.href).searchParams.get('feature'),'project-workbench');
  const ledger=JSON.parse(gunzipSync(Buffer.from([1,2,3,4].map(part=>read(`app/shared/civweave-parity-ledger.part${part}.b64`)).join('').replace(/\s+/g,''),'base64')).toString('utf8'));
  ledger.index={systems:new Map(ledger.systems.map(item=>[item.id,item])),capabilities:new Map(ledger.capabilities.map(item=>[item.id,item]))};
  const ready=new Promise(resolve=>window.addEventListener('civweave:realm-console-ready',resolve,{once:true}));release(ledger);await ready;
  assert.equal(new URL(window.location.href).searchParams.get('room'),'project-workbench');
  assert.equal(new URL(window.location.href).searchParams.has('feature'),false);
  assert.equal(window.document.getElementById('cw-themed-system-nav'),null);
  assert.deepEqual(app.timers,[]);
});

test('embedded FellowFare consumes the requested tab through its existing controller',t=>{
  const app=fixture(t,{path:'/app/fellowfare-cabinet-v144.html',system:'fellowfare',feature:'assemblies'}),{window}=app;
  window.eval(read('app/fellowfare-native-host-v207.js'));
  window.eval(read('app/fellowfare-cabinet-v144.js'));
  app.start();
  assert.equal(window.document.querySelector('[data-ffc-command="assemblies"]').hasAttribute('aria-current'),true);
  assert.equal(window.document.querySelector('[data-ffc-status]').textContent,'Opened orders.');
  assert.equal(new URL(window.location.href).searchParams.has('feature'),false);
  assert.equal(window.document.getElementById('cw-themed-system-nav'),null);
});

test('embedded Anarchadia consumes a ledger shortcut after its existing controller is ready',t=>{
  const app=fixture(t,{path:'/app/anarchadia-console-v139.html',system:'anarchadia',feature:'ledger'}),{window}=app;
  window.eval(read('app/anarchadia-console-v158.js'));app.start();
  assert.equal(window.document.getElementById('ac-app').dataset.screen,'ledger');
  assert.equal(window.document.getElementById('screen-ledger').hidden,false);
  assert.equal(new URL(window.location.href).searchParams.has('feature'),false);
  assert.equal(window.document.getElementById('cw-themed-system-nav'),null);
});

test('loading the shared feature owner twice preserves one embedded lifecycle',t=>{
  const app=fixture(t),{window}=app;app.start();
  const owner=window.CivweaveFamilyNavigationV178;app.start();assert.equal(window.CivweaveFamilyNavigationV178,owner);
  window.eval(campus);window.dispatchEvent(new window.CustomEvent('civweave:working-campus-runtime-ready'));
  assert.equal(window.CivweaveWorkingCampusV156.currentView(),'library');
  assert.deepEqual(app.timers,[]);
});

test('all native subsystem entries include the same feature owner',()=>{
  for(const entry of ['app/realm-console-v140.html','app/fellowfare-cabinet-v144.html','app/anarchadia-console-v139.html','app/cabinets/living-school/index.html','app/working-campus-v440.html']){
    assert.match(read(entry),/<script[^>]+src="\/app\/themed-system-nav-v178\.js(?:\?[^\"]*)?"/,entry);
  }
});
