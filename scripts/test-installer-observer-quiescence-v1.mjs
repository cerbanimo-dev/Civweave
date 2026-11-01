import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const {JSDOM}=createRequire(import.meta.url)('jsdom');
const bridgeSource=readFileSync(new URL('../public/app/pwa-install-prompt-v250.js',import.meta.url),'utf8');
const campusHtml=readFileSync(new URL('../public/app/working-campus-v156.html',import.meta.url),'utf8');
const plannerSource=campusHtml.match(/<script id="working-campus-planner-v199">([\s\S]*?)<\/script>/)?.[1];
assert.ok(plannerSource,'The active v156 planner script must be exercised.');
const settle=()=>new Promise(resolve=>setTimeout(resolve,10));

function fixture(t,html,{watchdogMs,userAgent}={}){
 const dom=new JSDOM(html,{url:'https://civweave-staging.pages.dev/app/index.html',runScripts:'outside-only'}),win=dom.window,NativeObserver=win.MutationObserver;
 const metrics={deliveries:0,capped:false},observers=[];
 // Keep the real MutationObserver delivery semantics. The cap makes a broken
 // self-observing owner fail a test instead of starving the test runner forever.
 win.MutationObserver=class extends NativeObserver{
  constructor(callback){super((records,observer)=>{metrics.deliveries++;if(metrics.deliveries>=60){metrics.capped=true;for(const row of observers)row.disconnect();return}callback(records,observer)});observers.push(this)}
 };
 win.matchMedia=()=>({matches:false});
 if(userAgent)Object.defineProperty(win.navigator,'userAgent',{value:userAgent});
 if(watchdogMs!==undefined){const original=win.setTimeout.bind(win);win.setTimeout=(callback,delay,...args)=>original(callback,delay===12000?watchdogMs:delay,...args)}
 t.after(()=>{for(const observer of observers)observer.disconnect();win.close()});
 const changes=[];const monitor=new NativeObserver(records=>changes.push(...records));monitor.observe(win.document.body,{attributes:true,childList:true,subtree:true});t.after(()=>monitor.disconnect());
 return {win,metrics,changes,clearChanges(){changes.length=0;metrics.deliveries=0},button:()=>win.document.querySelector('#install-app')};
}
const installer=(t,options)=>{const f=fixture(t,'<button id="install-app">Install</button><p id="install-help"></p>',options);f.win.eval(bridgeSource);return f};
const stable=f=>{assert.equal(f.metrics.capped,false,'Owner must settle before the observer safety cap');assert.ok(f.metrics.deliveries<10,`Expected bounded observer delivery, saw ${f.metrics.deliveries}`)};

test('native install remains responsive while browser choice is pending and becomes quiescent after dismissal',async t=>{
 const f=installer(t);await settle();stable(f);assert.equal(f.win.CivweavePWAInstallV250.observerPolicy,'idempotent-writes-coalesced-refresh');f.clearChanges();for(let n=0;n<4;n++)f.win.CivweavePWAInstallV250.refresh();await settle();assert.equal(f.changes.length,0,'refreshing an idle button must not rewrite its attributes or text');
 let choose,prompts=0;f.win.CivweavePWAInstallV250.restore({prompt(){prompts++},userChoice:new Promise(resolve=>{choose=resolve})});f.button().click();assert.equal(prompts,1,'Native prompt stays on the explicit click');await settle();stable(f);assert.equal(f.win.CivweavePWAInstallV250.state().prompting,true);assert.equal(f.button().getAttribute('aria-busy'),'true');
 f.clearChanges();for(let n=0;n<4;n++)f.win.CivweavePWAInstallV250.refresh();await settle();assert.equal(f.changes.length,0,'busy=true refresh must also be idempotent');
 choose({outcome:'dismissed'});await settle();stable(f);assert.equal(f.win.CivweavePWAInstallV250.state().prompting,false);assert.equal(f.button().hasAttribute('aria-busy'),false);assert.equal(prompts,1);
 f.clearChanges();f.win.CivweavePWAInstallV250.refresh();await settle();assert.equal(f.changes.length,0);
});

test('the native prompt watchdog can settle an unanswered browser request without an observer storm',async t=>{
 const f=installer(t,{watchdogMs:30});await settle();let prompts=0;f.win.CivweavePWAInstallV250.restore({prompt(){prompts++},userChoice:new Promise(()=>{})});f.button().click();await new Promise(resolve=>setTimeout(resolve,60));stable(f);assert.equal(prompts,1);assert.equal(f.win.CivweavePWAInstallV250.state().prompting,false);assert.equal(f.button().hasAttribute('aria-busy'),false);assert.equal(f.button().disabled,false);
});

test('the install owner still reconciles a real external button change once and detaches when leaving',async t=>{
 const f=installer(t);await settle();f.clearChanges();f.button().disabled=true;f.button().textContent='An outdated label';await settle();stable(f);assert.equal(f.button().disabled,false);assert.equal(f.button().textContent,'Install Civweave');
 f.win.dispatchEvent(new f.win.Event('pagehide'));f.clearChanges();f.button().textContent='Leaving';await settle();assert.equal(f.metrics.deliveries,0);assert.equal(f.button().textContent,'Leaving');
});

test('Opera keeps its browser-managed installation guard with a quiescent button',async t=>{
 const f=installer(t,{userAgent:'Mozilla/5.0 Windows NT 10.0 Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0'});await settle();let prompts=0;const event=new f.win.Event('beforeinstallprompt',{cancelable:true});Object.assign(event,{prompt(){prompts++},userChoice:Promise.resolve({outcome:'accepted'})});f.win.dispatchEvent(event);f.button().click();await settle();stable(f);assert.equal(prompts,0);assert.equal(f.win.CivweavePWAInstallV250.available(),false);assert.equal(f.win.CivweavePWAInstallV250.state().browserManagedPrompt,true);assert.match(f.win.document.querySelector('#install-help').textContent,/Opera/);
});

function campus(t){const f=fixture(t,'<div id="workspace"></div><form id="weaveling-chat-form"><textarea id="weaveling-chat-input"></textarea></form><p id="weaveling-chat-status"></p>');f.win.eval(plannerSource);return f}
function renderPlanButton(f){f.win.document.querySelector('#workspace').innerHTML='<section><button id="build-plan" type="button">Build plan</button></section>';return f.win.document.querySelector('#build-plan')}

test('v156 plan rendering normalizes its button then yields with live MutationObservers',async t=>{
 const f=campus(t),button=renderPlanButton(f);await settle();stable(f);assert.equal(button.textContent,'Generate Quest with AI');assert.equal(button.dataset.questAuthoring,'ai-required');
 f.clearChanges();for(let n=0;n<3;n++){f.win.dispatchEvent(new f.win.Event('pageshow'));f.win.dispatchEvent(new f.win.Event('civweave:guide-workspace-ready'))}await settle();assert.equal(f.changes.length,0,'repeat lifecycle events must not rewrite an already-correct button');
});

test('v156 keeps explicit Quest submission and dynamic replacement without observing after pagehide',async t=>{
 const f=campus(t);let submissions=0;const saved=JSON.stringify({wish:'Build a synthetic garden',profile:{skill:'new'}});f.win.localStorage.setItem('civweave.working-campus.v1',saved);f.win.document.querySelector('#weaveling-chat-form').addEventListener('submit',event=>{event.preventDefault();submissions++});
 renderPlanButton(f);await settle();stable(f);f.win.document.querySelector('#build-plan').click();assert.equal(submissions,1);assert.match(f.win.document.querySelector('#weaveling-chat-input').value,/Build a synthetic garden/);assert.equal(f.win.localStorage.getItem('civweave.working-campus.v1'),saved);
 f.clearChanges();const next=renderPlanButton(f);await settle();stable(f);assert.equal(next.textContent,'Generate Quest with AI');assert.equal(submissions,1,'Rendering must never generate another Quest');
 f.win.dispatchEvent(new f.win.Event('pagehide'));f.clearChanges();next.textContent='Leaving';await settle();assert.equal(f.metrics.deliveries,0,'Planner observation must stop with its page');
 f.win.dispatchEvent(new f.win.Event('pageshow'));await settle();stable(f);assert.equal(next.textContent,'Generate Quest with AI');f.clearChanges();const resumed=renderPlanButton(f);await settle();stable(f);assert.equal(resumed.dataset.questAuthoring,'ai-required','A resumed page must still normalize a newly rendered button');assert.equal(submissions,1);
});
