import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {JSDOM,ResourceLoader,VirtualConsole} from 'jsdom';
import {indexedDB,IDBKeyRange} from 'fake-indexeddb';
import {webcrypto} from 'node:crypto';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';

const root=fileURLToPath(new URL('../public/',import.meta.url));
const origin='https://civweave.test';
const read=file=>readFileSync(path.join(root,file),'utf8');
const routes=[['market','The market that is actually here.'],['loom','Turn real work into a real listing.'],['assemblies','From listing to fulfilled exchange.'],['inbox','Only balances and rails we can actually verify.'],['profile','Portable where it is real. Empty where it is not.']];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function nativeFixture({counterparty=false,pending=false}={}){
  const errors=[],resources=[],requests=[];
  class LocalResources extends ResourceLoader{fetch(url){
    const target=new URL(url);if(target.origin!==origin)return null;
    if(target.pathname.endsWith('.css'))return Promise.resolve(Buffer.from(''));
    if(!target.pathname.endsWith('.js'))return null;
    resources.push(target.pathname);
    try{return Promise.resolve(Buffer.from(read(target.pathname.slice(1))))}catch{return null}
  }}
  const console=new VirtualConsole();console.on('jsdomError',error=>errors.push(error.detail?.stack||error.message));
  const dom=new JSDOM(read('app/fellowfare-cabinet-v144.html'),{url:origin+'/app/fellowfare-cabinet-v144.html?cabinet=1&installed=1&embed=1&persistentShell=1#market',runScripts:'dangerously',resources:new LocalResources(),pretendToBeVisual:true,virtualConsole:console,beforeParse(window){
    window.sessionStorage.setItem('civweave.pwa.launch-session.v1','1');window.sessionStorage.setItem('civweave.install-boundary.boot.v228','1');
    if(counterparty)window.localStorage.setItem('fellowfare.marketplace.v2',JSON.stringify({schema:'fellowfare.marketplace.v2',version:2,profile:{id:'me',name:'',area:'',bio:'',userEdited:false},listings:[{schema:'fellowfare.listing.v2',id:'qa-counterparty-listing',title:'QA spare notebook',description:'Fictional fixture only; no actual exchange.',kind:'resource',mode:'offer',pricing:{gift:true,usdMinor:0,buttons:0,acorns:0},fulfillment:{area:'QA fixture',timing:'No physical work',quantity:'1'},ownerId:'qa-counterparty',source:{system:'fellowfare',sourceId:'qa-fixture'},status:'open'}],orders:[],settings:{showClosed:false},migration:{legacySeedScrubbedAt:'qa-fixture'}}));
    if(pending)window.localStorage.setItem('civweave.fellowfare.pending-threads.v1',JSON.stringify([{id:'qa-reviewed-manifest',ownerId:'me',title:'QA reviewed notebook need',description:'A fictional reviewed Manifest.',mode:'need',category:'materials',amount:0,methods:['Gift'],area:'QA fixture',when:'No physical work',quantity:'2 notebooks'}]));
    Object.assign(window,{TextEncoder,TextDecoder,Response,Request,Headers,ReadableStream,structuredClone,indexedDB,IDBKeyRange});
    Object.defineProperty(window.crypto,'subtle',{value:webcrypto.subtle});
    window.fetch=async url=>{requests.push(String(url));return Response.json({ok:false,error:'Offline native DOM fixture'},{status:503})};
    window.matchMedia=query=>({matches:false,media:query,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
    window.CSS={escape:value=>String(value)};window.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
    window.HTMLElement.prototype.scrollIntoView=function(){};window.scrollTo=()=>{};
    window.HTMLCanvasElement.prototype.getContext=()=>null;
    window.HTMLDialogElement.prototype.showModal=function(){this.open=true};
    window.HTMLDialogElement.prototype.close=function(){this.open=false};
  }});
  await new Promise(resolve=>dom.window.addEventListener('load',resolve,{once:true}));await sleep(50);
  return{window:dom.window,errors,resources,requests};
}

async function runNativeRoutes(){
  const {window,errors,resources,requests}=await nativeFixture(),document=window.document;
  assert.ok(resources.includes('/app/services/fellowfare/cabinet-bridge.js'));
  assert.ok(window.CivweaveFellowFareMarketplaceV2);
  assert.deepEqual(errors,[]);
  for(const [route,title] of routes){
    document.querySelector(`[data-ffc-command="${route}"]`).click();await sleep(25);
    assert.equal(document.body.dataset.ffRoute,route,`${route} must render the actual marketplace screen`);
    assert.equal(window.location.hash,'#'+route);
    assert.equal(document.querySelector('#main h1')?.textContent,title);
    assert.equal(document.querySelector(`[data-ffc-command="${route}"]`).getAttribute('aria-current'),'page');
    assert.equal(document.querySelectorAll('[data-ffc-command][aria-current]').length,1);
  }
  document.querySelector('[data-ffc-command="market"]').click();
  document.querySelector('[data-route-jump="inbox"]').click();await sleep(25);
  assert.equal(document.body.dataset.ffRoute,'inbox');
  assert.equal(document.querySelector('[data-ffc-command="inbox"]').getAttribute('aria-current'),'page','Internal canonical routing must keep the visible native tab current');
  assert.equal(document.querySelector('[data-ffc-loading]').hidden,true);
  assert.equal(document.querySelector('#ffc144-workbench').contentWindow,undefined,'A native div must not pretend to be an iframe');
  assert.equal(requests.some(url=>url.includes('/api/chat')),false,'Ordinary marketplace navigation must not start inference');
}

async function runNativeActions(){
  const {window,errors,requests}=await nativeFixture({counterparty:true}),document=window.document;
  assert.deepEqual(errors,[]);
  document.querySelector('[data-ffc-command="profile"]').click();await sleep(30);
  const profile=document.querySelector('#ffv2ProfileForm');
  profile.elements.namedItem('name').value='QA local participant';profile.elements.namedItem('area').value='Fixture only';profile.elements.namedItem('bio').value='No real person or exchange.';
  profile.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await sleep(30);
  assert.equal(JSON.parse(window.localStorage.getItem('fellowfare.marketplace.v2')).profile.name,'QA local participant');
  assert.equal(document.querySelector('.ffv2-profile-card h2').textContent,'QA local participant');
  document.querySelector('[data-ffc-command="market"]').click();await sleep(30);
  document.querySelector('[data-arrange-listing="qa-counterparty-listing"]').click();
  const form=document.querySelector('#ffv2ArrangeForm');assert.equal(form.closest('dialog').open,true);
  form.elements.namedItem('note').value='Fictional pending arrangement; cancel without performing an exchange.';
  form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await sleep(60);
  assert.equal(document.body.dataset.ffRoute,'assemblies');
  const order=JSON.parse(window.localStorage.getItem('fellowfare.marketplace.v2')).orders[0];assert.equal(order.status,'pending');
  assert.equal(document.querySelector('[data-ffc-command="assemblies"]').getAttribute('aria-current'),'page');
  const card=document.querySelector(`[data-ff-order-id="${order.id}"]`);assert.ok(card,'The native Orders capability must expose the real pending arrangement');
  card.querySelector('[data-ff-order-action="cancelled"]').click();await sleep(60);
  assert.equal(JSON.parse(window.localStorage.getItem('fellowfare.marketplace.v2')).orders[0].status,'cancelled');
  assert.equal(document.querySelector(`[data-ff-order-id="${order.id}"] .ffv2-status`)?.textContent,'cancelled','A local order transition must repaint from the state that was actually saved');
  assert.equal(requests.some(url=>url.includes('/api/chat')),false);
  assert.deepEqual(errors,[]);
}

async function runNativeManifest(){
  const {window,errors}=await nativeFixture({pending:true}),document=window.document;
  assert.deepEqual(errors,[]);
  assert.equal(window.localStorage.getItem('civweave.fellowfare.pending-threads.v1'),null,'Native readiness must consume the reviewed Rook handoff');
  const market=()=>JSON.parse(window.localStorage.getItem('fellowfare.marketplace.v2'));
  assert.equal(market().listings.length,1);assert.equal(market().listings[0].source.sourceId,'qa-reviewed-manifest');
  assert.match(document.querySelector('[data-ffc-status]').textContent,/Imported 1 reviewed/);
  const bridge=window.CivweaveFellowFareCabinetBridgeV1,controller=window.CivweaveFellowFareCabinetV144;
  window.eval(read('app/services/fellowfare/cabinet-bridge.js'));window.eval(read('app/fellowfare-cabinet-v144.js'));
  assert.equal(window.CivweaveFellowFareCabinetBridgeV1,bridge);assert.equal(window.CivweaveFellowFareCabinetV144,controller);
  window.dispatchEvent(new window.CustomEvent('fellowfare:cabinet-ready'));await sleep(20);
  assert.equal(market().listings.length,1,'Repeated readiness must not publish duplicate reviewed listings');
  document.querySelector('[data-ffc-command="loom"]').click();await sleep(30);
  document.querySelector('#main [data-ff-need-shortcut]').click();await sleep(30);
  const form=document.querySelector('#ffv2ComposerForm');assert.equal(form.closest('dialog').open,true);assert.equal(form.elements.namedItem('mode').value,'need');
  for(const [name,value] of Object.entries({kind:'request',title:'QA local paper need',description:'Fictional native UI test only.',area:'QA fixture',timing:'No physical exchange',quantity:'1 page'}))form.elements.namedItem(name).value=value;
  form.elements.namedItem('gift').checked=true;
  form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await sleep(40);
  const listing=market().listings.find(row=>row.title==='QA local paper need');assert.ok(listing);assert.equal(listing.mode,'need');assert.equal(listing.pricing.gift,true);assert.equal(listing.status,'open');
  assert.equal(form.closest('dialog').open,false);
  document.querySelector('[data-ffc-command="market"]').click();await sleep(30);
  const search=document.querySelector('#ffv2Search');search.value='QA local paper';search.dispatchEvent(new window.Event('input',{bubbles:true}));
  assert.equal(document.querySelectorAll('.ffv2-listing').length,1);assert.equal(document.querySelector('.ffv2-listing h3').textContent,listing.title);
  document.querySelector(`[data-view-listing="${listing.id}"]`).click();assert.equal(document.querySelector('#ffv2Detail').open,true);assert.match(document.querySelector('#ffv2DetailBody').textContent,/1 page/);
  document.querySelector('[data-close-detail]').click();
  document.querySelector(`[data-close-listing="${listing.id}"]`).click();await sleep(30);
  assert.equal(market().listings.find(row=>row.id===listing.id).status,'closed');
  document.querySelector('#ffv2Closed').checked=true;document.querySelector('#ffv2Closed').dispatchEvent(new window.Event('change',{bubbles:true}));
  assert.equal(document.querySelector(`[data-listing-id="${listing.id}"] .ffv2-status`).textContent,'closed');
  assert.deepEqual(errors,[]);
}

function runLegacyBridgeAuthentication(){
  const dom=new JSDOM('<main></main>',{url:origin+'/app/services/fellowfare/cabinet.html',runScripts:'outside-only'}),{window}=dom,calls=[];
  window.CivweaveFellowFareMarketplaceV2={routeTo:route=>calls.push(route)};
  window.eval(read('app/services/fellowfare/cabinet-bridge.js'));
  const send=(source,messageOrigin,command='loom')=>window.dispatchEvent(new window.MessageEvent('message',{source,origin:messageOrigin,data:{type:'fellowfare:cabinet-command',command}}));
  send(window,'https://untrusted.test');send({},origin);assert.deepEqual(calls,[]);
  send(window,origin);assert.deepEqual(calls,['loom']);
  send(window,origin,'unknown');assert.deepEqual(calls,['loom'],'Unknown commands may not silently navigate');
  dom.window.close();
}

if(isMainThread){
  for(const [scenario,title] of [['routes','the complete native FellowFare entry changes all five screens through its existing tab owner'],['actions','native FellowFare saves a profile, creates a pending arrangement and shows its cancellation'],['manifest','native readiness imports one reviewed Manifest and Sell publishes a searchable, inspectable and closable need'],['auth','the retained iframe bridge authenticates its parent and rejects unknown commands']])test(title,{timeout:20000},async()=>{
    const result=await new Promise((resolve,reject)=>{
      const worker=new Worker(new URL(import.meta.url),{workerData:{scenario}});
      const timer=setTimeout(()=>{worker.terminate();reject(new Error('Native FellowFare fixture timed out'))},18000);
      worker.once('message',result=>{clearTimeout(timer);resolve(result)});worker.once('error',error=>{clearTimeout(timer);reject(error)});
      worker.once('exit',code=>{clearTimeout(timer);if(code)reject(new Error(`Native FellowFare fixture exited ${code}`))});
    });
    assert.equal(result.ok,true,result.error);
  });
}else{
  try{if(workerData.scenario==='actions')await runNativeActions();else if(workerData.scenario==='manifest')await runNativeManifest();else if(workerData.scenario==='auth')runLegacyBridgeAuthentication();else await runNativeRoutes();parentPort.postMessage({ok:true})}catch(error){parentPort.postMessage({ok:false,error:error.stack||String(error)})}
  process.exit(0);
}
