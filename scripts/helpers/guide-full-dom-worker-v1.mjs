// Node-only full-page fixture. Production sources, DOM selectors and event listeners run unchanged.
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {parentPort,workerData} from 'node:worker_threads';
import {JSDOM,ResourceLoader,VirtualConsole} from 'jsdom';
import {indexedDB,IDBKeyRange} from 'fake-indexeddb';
const {implForWrapper}=createRequire(import.meta.url)('jsdom/lib/jsdom/living/generated/utils.js');

const publicRoot=fileURLToPath(new URL('../../public/',import.meta.url));
const origin='https://civweave-staging.pages.dev';
const stats={resources:[],requests:[],http:[],requestTimers:[],storageEvents:[],inference:0,blocked:[],errors:[],events:new Map(),observers:[],microtasks:new Map()};
let collectingNativeTimers=false;
const nativePreview=workerData.scenario==='native-preview';
const questScenario=workerData.scenario==='quest';
const selectedModel=nativePreview||questScenario?'qwen3.5:4b':'gemma4:latest';
const questOrder=['anarchadia','fellowfare','living-school','cerbanimo'];
const questPacket={title:'QA shared shelf',wish:'Build a shared shelf.',outcome:'A reviewed shared shelf is planned.',assumptions:['Fictional fixture; no work executed.'],subsystems:Object.fromEntries(questOrder.map(realm=>[realm,{included:true,reason:`The fixture needs ${realm}.`,title:`QA ${realm}`,purpose:`The ${realm} contribution.`,steps:[`Complete the ${realm} contribution.`],completionCriteria:`The ${realm} contribution is reviewable.`,evidence:[`Evidence for ${realm}.`]}])),pathOrder:questOrder,governance:{included:false,title:'',purpose:'',agreements:[],reviewQuestion:''}};
const previewHtml='<main><h1>QA READY badge</h1><span class="badge">READY</span><button id="mark-ready">Mark READY</button><output id="ready-note">WAITING</output></main>';
const previewCss='.badge{background:green;color:white;padding:4px}';
const previewJs='document.querySelector("#mark-ready").onclick=()=>{document.querySelector("#ready-note").textContent="READY"};';
const nativePatch={summary:'A working sandbox READY interaction.',preview:{html:previewHtml,css:previewCss,js:previewJs}};
const installed=new WeakSet(),modules=new WeakMap(),contexts=new WeakMap();
const nodeLabel=node=>`${node?.nodeName||''}#${node?.id||''}.${String(node?.className||'').slice(0,80)}`;
function localFile(url){const target=path.resolve(publicRoot,'.'+decodeURIComponent(new URL(url,origin).pathname));if(!target.startsWith(publicRoot))throw new Error('Fixture resource escaped public root');return target}
function moduleFor(specifier,reference,context){
  const url=new URL(specifier,reference);let cache=modules.get(context);if(!cache){cache=new Map();modules.set(context,cache)}
  if(cache.has(url.href))return cache.get(url.href);
  if(url.origin!==origin)throw new Error(`External module disabled in offline DOM fixture: ${url.href}`);
  stats.resources.push(url.pathname);
  const module=new vm.SourceTextModule(readFileSync(localFile(url),'utf8'),{context,identifier:url.href,
    initializeImportMeta:meta=>{meta.url=url.href},importModuleDynamically:(specifier,ref)=>evaluateModule(specifier,ref.identifier,context)});
  cache.set(url.href,module);return module;
}
async function evaluateModule(specifier,reference,context){
  const module=moduleFor(specifier,reference,context);
  if(module.status==='unlinked')await module.link((specifier,ref)=>moduleFor(specifier,ref.identifier,context));
  if(module.status==='linked')await module.evaluate();return module;
}
// jsdom executes real classic scripts through this API but does not supply an import callback.
const runInContext=vm.runInContext;
vm.runInContext=function(code,context,options={}){
  if(context.document?.defaultView)contexts.set(context.document.defaultView,context);
  return runInContext(code,context,{...options,importModuleDynamically:specifier=>evaluateModule(specifier,options.filename||origin,context)});
};
function install(window){
  if(!window||installed.has(window))return;installed.add(window);
  // jsdom 26 inserts iframe WindowProxies into this registry, but its Storage
  // implementation excludes the writer by raw Window identity. Normalize the
  // test platform so a write reaches other documents only, as in browsers.
  const sameOrigin=window._currentOriginData?.windowsInSameOrigin;
  if(sameOrigin)window._currentOriginData.windowsInSameOrigin=[...new Set(sameOrigin.map(target=>implForWrapper(target.localStorage)?._associatedWindow).filter(Boolean))];
  if(nativePreview){
    window.addEventListener('storage',event=>{if(event.key==='civweave.anarchadia.citizen-console.v139'){
      stats.storageEvents.push({url:window.location.href,source:event.url,trusted:event.isTrusted});
    }});
  }
  const nativeTimeout=window.setTimeout.bind(window),nativeClearTimeout=window.clearTimeout.bind(window),timers=new Map();
  window.setTimeout=(callback,ms,...args)=>{
    const record=collectingNativeTimers&&Number(ms)>=5000?{ms:Number(ms),owner:new Error().stack.split('\n').slice(2,6).join('\n'),cleared:false,fired:false}:null;
    if(record)stats.requestTimers.push(record);
    const id=nativeTimeout(()=>{if(record)record.fired=true;timers.delete(id);callback(...args)},ms);
    if(record)timers.set(id,record);return id;
  };
  window.clearTimeout=id=>{const record=timers.get(id);if(record){record.cleared=true;timers.delete(id)}nativeClearTimeout(id)};
  const NativeObserver=window.MutationObserver;
  window.MutationObserver=class extends NativeObserver{constructor(callback){
    const data={owner:new Error().stack.split('\n').slice(2,5).join('\n'),count:0,targets:new Map()};
    super((records,observer)=>{data.count++;for(const record of records){const label=nodeLabel(record.target);data.targets.set(label,(data.targets.get(label)||0)+1)}
      if(data.count>2000){this.disconnect();stats.blocked.push({kind:'observer',owner:data.owner});return}callback(records,observer)});
    stats.observers.push(data);
  }};
  const enqueue=window.queueMicrotask.bind(window);
  window.queueMicrotask=callback=>{
    const owner=new Error().stack.split('\n').slice(2,5).join('\n'),count=(stats.microtasks.get(owner)||0)+1;stats.microtasks.set(owner,count);
    if(count>1000){if(count===1001)stats.blocked.push({kind:'microtask',owner});return}enqueue(callback);
  };
  const dispatch=window.dispatchEvent.bind(window);
  window.dispatchEvent=event=>{if(event.type.startsWith('civweave:'))stats.events.set(event.type,(stats.events.get(event.type)||0)+1);return dispatch(event)};
  Object.assign(window,{TextEncoder,TextDecoder,Response,Request,Headers,ReadableStream,WritableStream,TransformStream,structuredClone,indexedDB,IDBKeyRange});
  Object.defineProperty(window.crypto,'subtle',{value:webcrypto.subtle,configurable:true});
  window.fetch=async(input,options={})=>{
    const url=new URL(String(input?.url||input),window.location.href);stats.requests.push(url.href);
    if(url.hostname==='127.0.0.1'&&url.port==='11434'){
      if(url.pathname==='/api/chat'){
        stats.inference++;
        const call={url:url.href,body:JSON.parse(options.body),aborted:false};stats.http.push(call);
        options.signal?.addEventListener('abort',()=>{call.aborted=true;call.abortReason=String(options.signal.reason?.message||options.signal.reason||'')},{once:true});
        if(questScenario){
          const payload={model:selectedModel,message:{role:'assistant',content:JSON.stringify(questPacket)},done:true,done_reason:'stop'};
          return call.body.stream?new Response(JSON.stringify(payload)+'\n',{headers:{'content-type':'application/x-ndjson'}}):Response.json(payload);
        }
        if(nativePreview){
          await new Promise((resolve,reject)=>{
            const timer=setTimeout(resolve,Number(workerData.httpDelayMs)||0);
            if(options.signal?.aborted){clearTimeout(timer);reject(options.signal.reason);return}
            options.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(options.signal.reason)},{once:true});
          });
          if(workerData.failure)return Response.json({error:'QA native provider rejection'},{status:503});
          const output=structuredClone(nativePatch);
          if(workerData.forbiddenPreview)output.preview.js='fetch("https://example.test/forbidden")';
          return Response.json({model:selectedModel,message:{role:'assistant',content:JSON.stringify(output)},done:true,done_reason:'stop'});
        }
        const packet={answer:'QA Manifest saved for review.',choice:{mode:'Acquire',system:'fellowfare',room:'fellowfare.square',nextAction:'Review the Manifest'},assumptions:[],requiresConsent:true,confidence:.9};
        return new Response(JSON.stringify({model:selectedModel,message:{role:'assistant',content:JSON.stringify(packet)},done:true})+'\n',{headers:{'content-type':'application/x-ndjson'}});
      }
      return Response.json({models:[{name:selectedModel,model:selectedModel}]});
    }
    if(url.origin===origin)try{return new Response(readFileSync(localFile(url)),{headers:{'content-type':url.pathname.endsWith('.json')?'application/json':'text/plain'}})}catch{}
    return Response.json({ok:false,error:'Unavailable in offline DOM fixture'},{status:404});
  };
  window.matchMedia=query=>({matches:false,media:query,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
  window.CSS||={};window.CSS.escape||=(value=>String(value).replace(/[^a-z0-9_-]/gi,'\\$&'));
  window.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
  window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
  window.requestIdleCallback=fn=>window.setTimeout(()=>fn({timeRemaining:()=>50,didTimeout:false}),20);window.cancelIdleCallback=window.clearTimeout.bind(window);
  window.HTMLElement.prototype.scrollIntoView=function(){};window.scrollTo=()=>{};
  // jsdom has no layout engine. A visible application element gets a nonzero viewport rectangle.
  window.HTMLElement.prototype.getBoundingClientRect=function(){const hidden=this.hidden||this.closest('[hidden]');return{x:0,y:0,left:0,top:0,right:hidden?0:1200,bottom:hidden?0:800,width:hidden?0:1200,height:hidden?0:800,toJSON(){return this}}};
  window.HTMLCanvasElement.prototype.getContext=()=>null;
  if(window.HTMLDialogElement){window.HTMLDialogElement.prototype.showModal=function(){this.open=true};window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new window.Event('close'))}}
  const cache=new Map();window.caches={open:async()=>({match:async key=>cache.get(String(key))?.clone(),put:async(key,value)=>cache.set(String(key),value),delete:async key=>cache.delete(String(key)),keys:async()=>[]}),keys:async()=>[],match:async()=>undefined,delete:async()=>true};
  const config={provider:'ollama',route:'ollama',model:selectedModel,endpoint:'http://127.0.0.1:11434/api/chat',baseUrl:'http://127.0.0.1:11434',...(nativePreview||questScenario?{timeoutMs:300000,maxTokens:4096}:{})};
  try{
    window.localStorage.setItem('civweave.universal-ai.v127',JSON.stringify(config));
    window.localStorage.setItem('civweave-model-profiles-v1',JSON.stringify({interactive:config}));
    window.localStorage.setItem('civweave.local-ai.selection.v266',JSON.stringify({active:true,id:workerData.staleModel}));
    window.localStorage.setItem('civweave.new-user-onboarding.v1',JSON.stringify({complete:true,completedAt:new Date().toISOString()}));
    window.sessionStorage.setItem('civweave.pwa.launch-session.v1','1');window.sessionStorage.setItem('civweave.install-boundary.boot.v228','1');
  }catch{}
  window.addEventListener('error',event=>stats.errors.push(event.error?.stack||event.message));
  window.addEventListener('unhandledrejection',event=>{stats.errors.push(event.reason?.stack||String(event.reason));event.preventDefault()});
  // jsdom skips type=module scripts. Execute the real modules in the same window context.
  const startedModules=new WeakSet();
  new NativeObserver(()=>{const context=contexts.get(window.document?.defaultView);if(!context)return;for(const script of window.document.querySelectorAll('script[type="module"][src]')){
    if(startedModules.has(script))continue;startedModules.add(script);evaluateModule(script.src,window.location.href,context).catch(error=>stats.errors.push(error.stack||String(error)));
  }}).observe(window.document,{childList:true,subtree:true});
}
class LocalResources extends ResourceLoader{fetch(url,options){
  install(options.element?.ownerDocument?.defaultView);const target=new URL(url);
  if(target.origin!==origin)return Promise.resolve(Buffer.from(''));
  if(!/\.(?:html|js|mjs|css)$/.test(target.pathname))return null;
  if(target.pathname.endsWith('.css'))return Promise.resolve(Buffer.from(''));
  stats.resources.push(target.pathname);
  try{return Promise.resolve(readFileSync(localFile(target)))}catch{stats.errors.push(`Missing resource ${target.pathname}`);return Promise.resolve(Buffer.from(''))}
}}
const console=new VirtualConsole();console.on('jsdomError',error=>stats.errors.push(error.detail?.stack||error.message));
process.on('unhandledRejection',error=>stats.errors.push(error?.stack||String(error)));
const entry=workerData.entry;
const dom=new JSDOM(readFileSync(localFile(entry),'utf8'),{url:origin+entry+`?system=${workerData.system||'civweave'}&installed=1`,resources:new LocalResources(),runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:console,beforeParse:install});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate,timeout=15000){const start=Date.now();while(!predicate()){if(Date.now()-start>timeout)throw new Error('Full DOM fixture timed out');await sleep(25)}}
let heartbeat=0;setInterval(()=>heartbeat++,20);
try{
  const window=dom.window;
  await until(()=>window.CivweaveGuideChatSurfaceV350);await sleep(400);
  if(nativePreview){
    const host=window.document.querySelector('#cw-persistent-system-stage');
    await until(()=>host?.contentWindow?.AnarchadiaCitizenConsoleV158&&host?.contentWindow?.AnarchadiaChangeReviewV165);
    const child=host.contentWindow,document=child.document,key='civweave.anarchadia.citizen-console.v139';
    const stored=()=>JSON.parse(child.localStorage.getItem(key)||'{}').proposals||[];
    const sourcesBeforeApproval=[...new Set(stats.resources)],runtimeBeforeApproval={parent:window.CivweaveModelRuntime?.version,child:child.CivweaveModelRuntime?.version};
    document.querySelector('[data-request-kind="feature"]').click();
    const form=document.querySelector('#ac-request-form');
    for(const [name,value] of Object.entries({title:'QA READY badge preview',problem:'The fictional sandbox has no status badge or READY interaction.',expected:'Show heading QA READY badge, a green READY badge, a Mark READY button, and a WAITING output that changes to READY when clicked.',area:'Civweave',acceptance:'The heading is visible.\nThe badge is green and reads READY.\nThe output initially reads WAITING.\nClick Mark READY to display READY.',risk:'Local fictional sandbox, zero budget, no network calls, no messages or purchases, reversible Keep or Revert only.',evidence:'Inspect WAITING, click Mark READY, inspect READY.'}))form.elements.namedItem(name).value=value;
    form.dispatchEvent(new child.Event('submit',{bubbles:true,cancelable:true}));
    const item=stored()[0],reviewState=item?.status,inferenceBeforeApproval=stats.inference;
    const approve=document.querySelector(`[data-ac165-approve="${item.id}"]`);if(!approve)throw new Error('Native Merlin approval control did not mount.');
    collectingNativeTimers=true;approve.click();
    await until(()=>['preview-ready','failed','blocked'].includes(stored().find(row=>row.id===item.id)?.status),20000);
    await sleep(350);collectingNativeTimers=false;
    parentPort.postMessage({ok:true,heartbeat,inference:stats.inference,http:stats.http,requestTimers:stats.requestTimers,storageEvents:stats.storageEvents,blocked:stats.blocked,resources:[...new Set(stats.resources)],sourcesBeforeApproval,runtimeBeforeApproval,requests:stats.requests,events:Object.fromEntries(stats.events),errors:stats.errors,proposal:stored().find(row=>row.id===item.id),reviewState,inferenceBeforeApproval,parentSpine:window.CivweaveFastInteractiveV192?.diagnostics?.(),childSpine:child.CivweaveFastInteractiveV192?.diagnostics?.(),toast:document.querySelector('#ac-toast')?.textContent});
    process.exit(0);
  }
  const api=window.CivweaveGuideChatSurfaceV350;
  if(questScenario){
    api.openWindow('civweave');await sleep(100);
    const input=window.document.querySelector('#cw-persistent-guide-chat-v215 textarea');
    input.value='Create a Quest to build a small shared shelf. I need to learn safe measuring and assembly, obtain boards within $25, and agree with another participant on size, spending and roles before buying or building. Save for review without executing work.';
    input.closest('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
    await until(()=>!api.state().busy);await sleep(350);
    const chat=window.document.querySelector('#cw-persistent-guide-chat-v215');
    const plans=JSON.parse(window.localStorage.getItem('civweave.intentions.v127')||'[]'),bubble=chat.querySelector('[data-log] article:last-child .cw350-bubble'),answer=bubble?.textContent;
    await sleep(300);
    parentPort.postMessage({ok:true,heartbeat,inference:stats.inference,http:stats.http,blocked:stats.blocked,resources:[...new Set(stats.resources)],errors:stats.errors,plans,text:chat.textContent,stableBubble:bubble===chat.querySelector('[data-log] article:last-child .cw350-bubble')&&answer===bubble?.textContent});
    process.exit(0);
  }
  api.openWindow('fellowfare');await sleep(100);
  const input=window.document.querySelector('#cw-persistent-guide-chat-v215 textarea');
  if(!input)throw new Error('Canonical Rook composer did not mount');
  input.value='Create a Manifest for QA notebooks. quantity: 2 notebooks; area: Albany, NY; timing: tomorrow; exchange: free. Local QA only.';
  input.closest('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
  await until(()=>!api.state().busy);await sleep(250);
  const chat=window.document.querySelector('#cw-persistent-guide-chat-v215'),actions=JSON.parse(window.localStorage.getItem('civweave.realm-actions.v141')||'[]');
  const gateButtons=[...chat.querySelectorAll('[data-gate]')].map(button=>({action:button.dataset.gate,id:button.dataset.id,text:button.textContent}));
  const bubble=chat.querySelector('[data-log] article:last-child .cw350-bubble'),finalAnswer=bubble?.textContent;
  const review=chat.querySelector('[data-gate="open-action"]');
  if(!review)throw new Error('Rook did not expose the canonical saved-draft review control');
  review.click();await until(()=>window.document.querySelector('#cw-shared-review-surface-v234'));
  const reviewText=window.document.querySelector('#cw-shared-review-surface-v234').textContent;
  const approve=window.document.querySelector('#cw-shared-review-surface-v234 [data-review-command="approve-action"]');
  if(!approve)throw new Error('Rook draft review did not expose its canonical approval action');
  approve.click();await until(()=>JSON.parse(window.localStorage.getItem('civweave.realm-actions.v141')||'[]')[0]?.state==='published');
  await sleep(1000);
  const finalActions=JSON.parse(window.localStorage.getItem('civweave.realm-actions.v141')||'[]');
  const requestAuthorityReady=await window.CivweaveGemma4CurrentRegistryAuthorityV1.ensureRequestAuthority();
  parentPort.postMessage({ok:true,heartbeat,inference:stats.inference,blocked:stats.blocked,resources:[...new Set(stats.resources)],requests:stats.requests,
    events:Object.fromEntries(stats.events),errors:stats.errors,state:api.state(),text:chat?.textContent?.slice(-3000),actions,finalActions,reviewText,gateButtons,
    requestAuthorityReady,requestAuthorityVersion:window.CivweaveGemma4LiteRTRequestAuthorityV1?.version,
    published:JSON.parse(window.localStorage.getItem('civweave.fellowfare.pending-threads.v1')||'[]'),
    stableBubble:bubble===chat.querySelector('[data-log] article:last-child .cw350-bubble')&&finalAnswer===bubble?.textContent,
    topObservers:stats.observers.toSorted((a,b)=>b.count-a.count).slice(0,6).map(({owner,count,targets})=>({owner,count,targets:[...targets].toSorted((a,b)=>b[1]-a[1]).slice(0,3)}))});
}catch(error){
  const child=dom.window.document.querySelector('#cw-persistent-system-stage')?.contentWindow;
  let proposal;try{proposal=JSON.parse(child?.localStorage.getItem('civweave.anarchadia.citizen-console.v139')||'{}').proposals?.[0]}catch{}
  parentPort.postMessage({ok:false,error:error.stack||String(error),inference:stats.inference,http:stats.http,requestTimers:stats.requestTimers,storageEvents:stats.storageEvents,proposal,toast:child?.document.querySelector('#ac-toast')?.textContent,blocked:stats.blocked,events:Object.fromEntries(stats.events),errors:stats.errors,resources:[...new Set(stats.resources)]});
}
process.exit(0);
