import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const human=readFileSync(new URL('../public/app/human-message-bubble-v1.js',import.meta.url),'utf8');
const shell=readFileSync(new URL('../public/app/persistent-system-shell-v1.js',import.meta.url),'utf8');

async function harness({embedded=true,persistent=true}={}){
  const active=new Set(),pending=new Set(),nodes=new Map(),listeners=new Map();let added=0,removed=0,intervals=0;
  const notify=()=>{for(const observer of active)pending.add(observer)};
  class Observer{constructor(callback){this.callback=callback}observe(){active.add(this)}disconnect(){active.delete(this)}}
  const append=node=>{nodes.set(node.id,node);if(node.id==='cw-human-message-launcher-v1')added++;notify()};
  const document={readyState:'loading',documentElement:{dataset:{}},head:{append},body:{append,style:{}},
    getElementById:id=>nodes.get(id)||null,addEventListener(){},
    createElement:()=>({dataset:{},style:{setProperty(){}},setAttribute(){},addEventListener(){},querySelector:()=>null,
      remove(){if(nodes.delete(this.id)){if(this.id==='cw-human-message-launcher-v1')removed++;notify()}}})};
  const window={};window.self=window;window.top=embedded?{}:window;
  const child={document,window,URLSearchParams,location:{search:persistent?'?embed=1&persistentShell=1':'?embed=1'},
    localStorage:{getItem:()=>null},MutationObserver:Observer,queueMicrotask,setInterval:()=>++intervals,
    addEventListener:(type,fn)=>listeners.set(type,[...(listeners.get(type)||[]),fn]),dispatchEvent(){},
    CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}}};
  if(embedded&&persistent){
    const host={contentDocument:document,contentWindow:{MutationObserver:Observer}};
    const parent={frame:()=>host,loadToken:1,frameMatchesExpected:()=>true,chromeObserver:null,MutationObserver:Observer,
      HUMAN_LAUNCHER_ID:'cw-human-message-launcher-v1',AI_LAUNCHER_ID:'cwp215-launcher',GUIDE_ROOT_ID:'cw-persistent-guide-chat-v215'};
    const start=shell.indexOf('function suppressChildChrome('),end=shell.indexOf('function scheduleChildChrome(',start);
    assert.ok(start>=0&&end>start,'test must exercise the canonical parent chrome owner');
    vm.runInNewContext(shell.slice(start,end)+'\nsuppressChildChrome()',parent);
  }
  vm.runInNewContext(human,child);
  for(const ready of listeners.get('DOMContentLoaded')||[])ready();
  await new Promise(resolve=>setImmediate(resolve));
  let rounds=0;
  for(;rounds<100&&pending.size;rounds++){const batch=[...pending];pending.clear();for(const observer of batch)if(active.has(observer))observer.callback([])}
  return{added,removed,rounds,pending:pending.size,observers:active.size,intervals,listeners,child};
}

test('persistent content frames defer human chrome to the parent without observer recreation loops',async()=>{
  const state=await harness();
  assert.equal(state.pending,0,`parent/child observers never stabilize: ${state.added} additions and ${state.removed} removals`);
  assert.equal(state.added,0,'embedded content must never create a competing human launcher');
  assert.equal(state.observers,1,'only the parent chrome observer remains active');
  assert.equal(state.intervals,0,'embedded content must not poll human chat state');
  assert.equal(state.listeners.size,0,'embedded content must not subscribe as a second human chat owner');
  assert.equal(state.child.CivweaveHumanMessageBubbleV1,undefined,'child must not publish an inactive duplicate chrome owner');
});

test('top-level and ordinary embedded pages retain their human chat owner',async()=>{
  for(const options of [{embedded:false,persistent:true},{embedded:true,persistent:false}]){
    const state=await harness(options);
    assert.equal(state.added,1);assert.equal(state.removed,0);assert.equal(state.pending,0);
    assert.equal(typeof state.child.CivweaveHumanMessageBubbleV1.openHuman,'function');
  }
});
