import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source=readFileSync(new URL('../public/app/minilm-response-router-v347.js',import.meta.url),'utf8');
const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve()};
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject}};
function clock(){
  let now=0,next=0;const timers=new Map();
  return{
    setTimeout(fn,ms){const id=++next;timers.set(id,{at:now+Number(ms),fn});return id},
    clearTimeout(id){timers.delete(id)},
    async advance(ms){const end=now+ms;await flush();while(true){const first=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!first)break;now=first[1].at;timers.delete(first[0]);first[1].fn();await flush()}now=end;await flush()},
    get pending(){return timers.size}
  };
}
function rankHarness({dependency=async()=>null,adapter}={}){
  const time=clock(),start=source.indexOf('async function semanticRank('),end=source.indexOf('function semanticEvidence(',start);
  assert.ok(start>=0&&end>start);
  const globals={semanticRouter:dependency,adapter:async()=>adapter,clean:x=>x,
    setTimeout:time.setTimeout,clearTimeout:time.clearTimeout,sleep:ms=>new Promise(resolve=>time.setTimeout(resolve,ms))};
  const rank=vm.runInNewContext(source.slice(start,end)+'\nsemanticRank',globals);
  return{time,rank};
}
function observe(promise){const state={settled:false,value:undefined};promise.then(value=>{state.settled=true;state.value=value});return state}

test('semantic deadline includes a stalled dependency and blocks later model work',async()=>{
  const dependency=deferred();let adapterCalls=0;
  const {time,rank}=rankHarness({dependency:()=>dependency.promise,adapter:{status(){adapterCalls++;return{available:false}}}});
  const result=observe(rank('hello',[],'dependency',20));await time.advance(20);
  assert.equal(result.settled,true,'dependency lookup must not escape the routing deadline');assert.equal(result.value,null);
  dependency.resolve(null);await flush();assert.equal(adapterCalls,0,'expired requests must not start the next stage');
});

test('semantic deadline includes stalled cache inventory and prevents late prewarm',async()=>{
  const inventory=deferred();let prewarms=0,ranks=0;
  const {time,rank}=rankHarness({adapter:{status:()=>inventory.promise,prewarm(){prewarms++},rank(){ranks++}}});
  const result=observe(rank('hello',[],'inventory',20));await time.advance(20);
  assert.equal(result.settled,true,'Cache Storage inventory must share the routing deadline');assert.equal(result.value,null);
  inventory.resolve({available:true,ready:false});await flush();assert.equal(prewarms,0);assert.equal(ranks,0);
});

test('semantic deadline includes shared warmup and handles its late rejection',async()=>{
  const warm=deferred();let ranks=0;
  const {time,rank}=rankHarness({adapter:{status:async()=>({available:true,ready:false}),prewarm:()=>warm.promise,rank(){ranks++}}});
  const result=observe(rank('hello',[],'warmup',20));await time.advance(20);
  assert.equal(result.settled,true);assert.equal(result.value,null);
  warm.reject(new Error('late runtime failure'));await flush();assert.equal(ranks,0);
});

test('semantic deadline handles a late ranking rejection',async()=>{
  const ranking=deferred();
  const {time,rank}=rankHarness({adapter:{status:async()=>({available:true,ready:true}),rank:()=>ranking.promise}});
  const result=observe(rank('hello',[],'ranking',20));await time.advance(20);
  assert.equal(result.settled,true);assert.equal(result.value,null);
  ranking.reject(new Error('late rank failure'));await flush();assert.equal(time.pending,0);
});

test('successful MiniLM evidence is preserved and releases its deadline timer',async()=>{
  const matches=[{id:'short',score:.9}];
  const {time,rank}=rankHarness({adapter:{status:async()=>({available:true,ready:true}),rank:async()=>({matches})}});
  assert.equal(await rank('hello',[],'healthy',20),matches);assert.equal(time.pending,0);
});

test('stalled MiniLM inventory still produces an ordinary deterministic routing decision',async()=>{
  const time=clock(),inventory=deferred();
  const context={console,URL,queueMicrotask,location:{href:'https://example.test/app/'},navigator:{},
    document:{scripts:[],head:{append(){}},createElement:()=>({dataset:{}})},
    setTimeout:time.setTimeout,clearTimeout:time.clearTimeout,setInterval:()=>1,clearInterval(){},
    addEventListener(){},dispatchEvent(){},CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
    CivweaveContextRouterV344:{status:()=>({available:false})},__testAdapter:{status:()=>inventory.promise}};
  context.globalThis=context;
  assert.equal(source.split('import(ADAPTER)').length,2);
  vm.runInNewContext(source.replace('import(ADAPTER)','Promise.resolve(globalThis.__testAdapter)'),context);
  const result=observe(context.CivweaveResponseRouterV347.classify('amberotterlighthouse',{context:{guide:{system:'civweave'}}}));
  await time.advance(700);assert.equal(result.settled,true,'classification must progress without the semantic cache');
  assert.equal(result.value.taskClass,'ordinary');assert.equal(result.value.artifactClass,null);assert.equal(result.value.networkRequired,false);
  assert.equal(result.value.source,'deterministic-length-fallback');
  assert.equal(time.pending,0);
});
