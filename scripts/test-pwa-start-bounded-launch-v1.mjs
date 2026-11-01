import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../public/app/pwa-start-v436.html',import.meta.url),'utf8');
const source=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('const START_REVISION='));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve()};
function emitter(){const listeners=new Map();return {addEventListener(type,fn,options){if(!listeners.has(type))listeners.set(type,new Map());listeners.get(type).set(fn,Boolean(options?.once))},removeEventListener(type,fn){listeners.get(type)?.delete(fn)},emit(type,detail={}){for(const [fn,once] of [...listeners.get(type)??[]]){if(once)listeners.get(type).delete(fn);fn({type,...detail})}},count(){return [...listeners.values()].reduce((n,s)=>n+s.size,0)}}}
function harness({register,update}={}){
 const timers=new Map(),navigation=[],warnings=[],events=emitter(),workerEvents=emitter(),registrationEvents=emitter(),installing=emitter(),registration={...registrationEvents,active:{scriptURL:'https://civweave.test/old-worker.js'},installing:null,waiting:null,update:update??(()=>new Promise(()=>{}))};let time=0,nextTimer=0,registerCalls=0;
 const serviceWorker={...workerEvents,controller:null,register:(...args)=>{registerCalls++;return register?register(registration,...args):new Promise(()=>{})}},status={textContent:''},dataset={},session=new Map();
 const context={URL,URLSearchParams,Promise,console:{warn:(...args)=>warnings.push(args)},location:{href:'https://civweave.test/app/pwa-start-v436.html?system=civweave',origin:'https://civweave.test',search:'?system=civweave',replace:href=>navigation.push(href)},navigator:{standalone:true,serviceWorker},matchMedia:()=>({matches:false}),document:{querySelector:()=>status,documentElement:{dataset}},sessionStorage:{setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)},addEventListener:events.addEventListener,removeEventListener:events.removeEventListener,setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,at:time+ms,ms});return id},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(source,context);
 return {context,registration,serviceWorker,installing,status,dataset,session,navigation,warnings,timers,events,get registerCalls(){return registerCalls},async advance(ms){const target=time+ms;for(;;){await flush();const row=[...timers].filter(([,t])=>t.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!row)break;time=row[1].at;timers.delete(row[0]);row[1].fn()}time=target;await flush()}};
}
test('a stalled registration is bounded and recovery is armed before it can hang',async()=>{
 const h=harness();assert.ok([...h.timers.values()].some(t=>t.ms===7000),'doorway recovery must exist before registration settles');await h.advance(6000);assert.equal(h.navigation.length,1);assert.equal(new URL(h.navigation[0]).pathname,'/app/working-campus-v440.html');assert.equal(h.registerCalls,1);assert.equal(h.dataset.cwPwaWorkerRefresh,'deferred');assert.equal(h.serviceWorker.count(),0);
});
test('late registration after the deadline cannot update, activate or bind listeners',async()=>{
 const pending=deferred();let updates=0,activations=0;const h=harness({register:()=>pending.promise,update:async()=>updates++});await h.advance(6000);h.registration.waiting={scriptURL:h.context.CivweavePwaStartV436.expectedWorkerURL(),postMessage(){activations++}};pending.resolve(h.registration);await flush();assert.equal(h.navigation.length,1);assert.equal(updates,0);assert.equal(activations,0);assert.equal(h.serviceWorker.count(),0);assert.equal(h.registration.count(),0);
});
test('an unresolved update is covered by the same budget and late completion stays inert',async()=>{
 const pending=deferred();let updates=0;const h=harness({register:async r=>r,update:()=>{updates++;return pending.promise}});await flush();assert.equal(updates,1);await h.advance(6000);assert.equal(h.navigation.length,1);pending.resolve();await flush();assert.equal(h.serviceWorker.count(),0);assert.equal(h.registration.count(),0);assert.equal(h.navigation.length,1);
});
test('registration and update errors leave the doorway without claiming worker readiness',async()=>{
 for(const options of [{register:async()=>{throw Error('registration unavailable')}},{register:async r=>r,update:async()=>{throw Error('update unavailable')}}]){const h=harness(options);await flush();assert.equal(h.navigation.length,1);assert.equal(h.dataset.cwPwaWorkerRefresh,'deferred');assert.equal(h.serviceWorker.count(),0);assert.equal(h.registration.count(),0);assert.equal(h.warnings.length,1)}
});
test('generation timeout removes worker, update and controller listeners',async()=>{
 const h=harness({register:async(r,url)=>{h.installing.scriptURL=new URL(url,'https://civweave.test').href;r.installing=h.installing;return r}});await flush();assert.ok(h.serviceWorker.count()>0);assert.ok(h.installing.count()>0);await h.advance(6000);assert.equal(h.navigation.length,1);assert.equal(h.serviceWorker.count(),0);assert.equal(h.registration.count(),0);assert.equal(h.installing.count(),0);
});
test('a verified current generation advances immediately and cleans up before pagehide',async()=>{
 const h=harness({register:async(r,url)=>{r.active={scriptURL:new URL(url,'https://civweave.test').href};return r}});await flush();assert.equal(h.navigation.length,1);assert.equal(h.dataset.cwPwaWorkerRefresh,'current');assert.equal(h.serviceWorker.count(),0);h.events.emit('pagehide');assert.equal(h.timers.size,0);
});
test('pagehide cancels pending work without redirecting a departing document',async()=>{
 const pending=deferred(),h=harness({register:()=>pending.promise});h.events.emit('pagehide');pending.resolve(h.registration);await flush();assert.equal(h.navigation.length,0);assert.equal(h.timers.size,0);assert.equal(h.registration.count(),0);
});

test('a persisted pageshow resumes a departed launch through the same bounded owner',async()=>{
 const initial=deferred();let attempts=0,updates=0;
 const h=harness({register:async(r,url)=>{attempts++;if(attempts===1)return initial.promise;r.active={scriptURL:new URL(url,'https://civweave.test').href};return r},update:async()=>updates++});
 await flush();const expectedDestination=h.context.CivweavePwaStartV436.destination().href;assert.equal(h.registerCalls,1);h.events.emit('pagehide');await flush();assert.equal(h.navigation.length,0);assert.equal(h.timers.size,0);
 h.events.emit('pageshow',{persisted:true});await flush();assert.equal(h.registerCalls,2);assert.equal(h.navigation.length,1);assert.equal(h.navigation[0],expectedDestination);assert.equal(h.dataset.cwPwaWorkerRefresh,'current');
 initial.resolve(h.registration);await flush();assert.equal(updates,0);assert.equal(h.navigation.length,1,'A late result from the departed launch must remain inert');assert.equal(h.registration.count(),0);assert.equal(h.serviceWorker.count(),0);
});

test('initial and repeated pageshow events cannot overlap a live launch',async()=>{
 const pending=deferred(),h=harness({register:()=>pending.promise});
 h.events.emit('pageshow',{persisted:false});h.events.emit('pageshow');await flush();assert.equal(h.registerCalls,1);
 for(let i=0;i<4;i++)h.events.emit('pageshow',{persisted:true});await flush();assert.equal(h.registerCalls,1);assert.equal(h.timers.size,2);
 h.events.emit('pagehide');await flush();for(let i=0;i<4;i++)h.events.emit('pageshow',{persisted:true});await flush();assert.equal(h.registerCalls,2);assert.equal(h.timers.size,2,'Only one recovery watchdog and one worker budget may remain');
 await h.advance(6000);assert.equal(h.navigation.length,1);assert.equal(h.dataset.cwPwaWorkerRefresh,'deferred');assert.equal(h.serviceWorker.count(),0);
});
