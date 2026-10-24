import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const bleSource=readFileSync(new URL('../public/app/human-chat-ble-controls-v1.js',import.meta.url),'utf8');
const avatarSource=readFileSync(new URL('../public/app/avatar-expression-director-v345.js',import.meta.url),'utf8');
const stripSource=readFileSync(new URL('../public/app/minilm-decision-strip-v1.js',import.meta.url),'utf8');
const translationSource=readFileSync(new URL('../public/app/local-ai/translation-packs-v1.js',import.meta.url),'utf8');
const pulseSource=readFileSync(new URL('../public/app/local-ai/test-pulse-v269.js',import.meta.url),'utf8');

function harness({ble=false,avatar=false}={}){
  const observers=new Set(),pending=new Set(),microtasks=[],listeners=new Map(),events=[];
  let buttonText='Nearby',buttonWrites=0,peers=0;
  const notify=()=>{for(const observer of observers)pending.add(observer)};
  const button={get textContent(){return buttonText},set textContent(value){buttonText=String(value);buttonWrites++;notify()}};
  const toolbar={querySelector:()=>button},human={querySelector:()=>toolbar};
  const row={dataset:{role:'assistant',pending:'true'},classList:{contains:()=>true},
    querySelector:selector=>selector==='p'?{textContent:'Weaveling is thinking…'}:null};
  const chat={id:'cw-persistent-guide-chat-v215',dataset:{guide:'civweave'},querySelectorAll:()=>[row]};
  class Observer{constructor(callback){this.callback=callback}observe(){observers.add(this)}disconnect(){observers.delete(this);pending.delete(this)}}
  const context={document:{readyState:'complete',documentElement:{dataset:{}},getElementById:id=>
      id==='cw-human-chat-network-v1'?human:id==='cw-persistent-guide-chat-v215'?chat:null},
    MutationObserver:Observer,queueMicrotask:callback=>microtasks.push(callback),
    addEventListener:(type,callback)=>listeners.set(type,[...(listeners.get(type)||[]),callback]),
    dispatchEvent:event=>{events.push(event);for(const callback of listeners.get(event.type)||[])callback(event)},
    CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail}},
    setTimeout:()=>0,clearTimeout(){},
    fetch:()=>new Promise(()=>{}), // Asset I/O is independent of observer/event scheduling.
    CivweaveContextRouterV344:{status:()=>({ready:false})},
    CivweaveBleObjectTransportV1:{status:()=>({peers:Array.from({length:peers},()=>({state:'open'}))})}};
  vm.createContext(context);
  if(ble)vm.runInContext(bleSource,context,{filename:'human-chat-ble-controls-v1.js'});
  if(avatar)vm.runInContext(avatarSource,context,{filename:'avatar-expression-director-v345.js'});
  function flush(limit=100){
    let rounds=0;
    for(;rounds<limit&&(pending.size||microtasks.length);rounds++){
      const changed=[...pending];pending.clear();for(const observer of changed)if(observers.has(observer))observer.callback([]);
      const queued=microtasks.splice(0);for(const callback of queued)callback();
    }
    return{rounds,pending:pending.size+microtasks.length,buttonWrites,buttonText,
      avatarEvents:events.filter(event=>event.type==='civweave:avatar-expression').length};
  }
  return{notify,flush,emit:type=>{for(const callback of listeners.get(type)||[])callback({type})},setPeers:value=>{peers=value}};
}

test('Nearby controls stop observing their own unchanged label after unrelated chat mutations',()=>{
  const app=harness({ble:true});app.flush();app.notify();
  const settled=app.flush();
  assert.equal(settled.pending,0,`Nearby repeatedly rewrote the same label ${settled.buttonWrites} times`);
  assert.equal(settled.buttonWrites,0,'an existing current label needs no DOM write');
  app.setPeers(2);app.emit('civweave:ble-peer');
  const connected=app.flush();assert.equal(connected.pending,0);assert.equal(connected.buttonText,'Nearby · 2');assert.equal(connected.buttonWrites,1);
});

test('the avatar observer alone releases the queue while a response is pending',()=>{
  const app=harness({avatar:true}),initial=app.flush();assert.equal(initial.avatarEvents,1);
  for(let index=0;index<20;index++){app.notify();assert.equal(app.flush().pending,0)}
  assert.ok(app.flush().avatarEvents<=21,'avatar events remain bounded by external mutations');
});

test('Nearby and avatar owners settle together while an inference response remains pending',()=>{
  const app=harness({ble:true,avatar:true});app.notify();const state=app.flush();
  assert.equal(state.pending,0,'chat observers must release the microtask queue for inference and browser input');
  assert.equal(state.buttonWrites,0);assert.ok(state.avatarEvents<=2);
});

test('translation settings release the mutation queue when an unrelated chat row is added',()=>{
  const observers=new Set(),pending=new Set(),microtasks=[],storage=new Map();let markup='',writes=0;
  const notify=()=>{for(const observer of observers)pending.add(observer)};
  const panel={get innerHTML(){return markup},set innerHTML(value){markup=String(value);writes++;notify()}};
  const host={querySelector:selector=>selector==='#cw-translation-packs-v1'?panel:null};
  class Observer{constructor(callback){this.callback=callback}observe(){observers.add(this)}disconnect(){observers.delete(this);pending.delete(this)}}
  const context={document:{readyState:'complete',documentElement:{lang:'en'},getElementById:id=>
    id==='cw-local-ai-v266'?host:id==='cw-translation-packs-v1-style'?{}:null,querySelectorAll:()=>[]},
    navigator:{language:'en'},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},MutationObserver:Observer,
    queueMicrotask:callback=>microtasks.push(callback),addEventListener(){},dispatchEvent(){},CustomEvent:class{}};
  vm.runInNewContext(translationSource,context,{filename:'translation-packs-v1.js'});
  assert.equal(writes,1,'the existing settings panel renders once at startup');
  notify(); // A Rook pending reply changes the same document subtree as the hidden settings panel.
  function flush(){
    for(let rounds=0;rounds<100&&(pending.size||microtasks.length);rounds++){
      const changed=[...pending];pending.clear();for(const observer of changed)observer.callback([{addedNodes:[{}]}]);
      for(const callback of microtasks.splice(0))callback();
    }
    return pending.size+microtasks.length;
  }
  assert.equal(flush(),0,`translation settings repeated their own identical DOM write`);
  assert.equal(writes,1,'unchanged translation settings need no child replacement');
  context.CivweaveTranslationPacksV1.setAutoEnabled(false);
  assert.equal(writes,2,'a real settings change still refreshes the panel');
  assert.equal(flush(),0,'a settings change also releases the observer queue');
  notify();assert.equal(flush(),0);assert.equal(writes,2,'later chat rows leave the current settings panel intact');
});

test('the decision strip recognizes pending balance scripts when cached runtime APIs are stale',()=>{
  for(const stale of [['host'],['usage'],['host','usage']]){
    const observers=new Set(),pending=new Set(),appended=[],microtasks=[];let trackerText='';
    const notify=()=>{for(const observer of observers)pending.add(observer)};
    const label={isConnected:true},tracker={get textContent(){return trackerText},set textContent(value){trackerText=String(value);notify()},hidden:true};
    const strip={dataset:{},querySelector:selector=>selector.includes('data-minilm-label')?label:selector.includes('data-guild-neuron-tracker')?tracker:null};
    const root={querySelector:()=>strip};
    class Observer{constructor(callback){this.callback=callback}observe(){observers.add(this)}disconnect(){observers.delete(this)}}
    const hostPath='/app/host-node-session-v1.js',usagePath='/app/guild-chat-usage-v1.js';
    const scripts=[hostPath,usagePath].map(src=>({src:src+'?v=cached',dataset:{}}));
    const context={URL,location:{href:'https://staging.example/app/persistent-system-shell-v1.html'},MutationObserver:Observer,
      document:{scripts,documentElement:{dataset:{}},getElementById:id=>id==='cw-persistent-guide-chat-v215'?root:{},
        createElement:()=>({dataset:{}}),head:{append(node){scripts.push(node);appended.push(new URL(node.src,context.location.href).pathname);notify()}}},
      localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
      addEventListener(){},queueMicrotask:callback=>microtasks.push(callback),dispatchEvent(){},CustomEvent:class{},
      CivweaveHostNodeSessionV1:{version:stale.includes('host')?'1.0.136-stale-cache':'1.0.137-current',sessionFor:()=>({nodeId:'synthetic-guild'})},
      CivweaveGuildChatUsageV1:{version:stale.includes('usage')?'1.0.1-stale-cache':'1.0.2-current',snapshot:()=>({known:false}),refresh:()=>new Promise(()=>{})},
      CivweaveResponseRouterV347:{classify(){}},CivweaveServerAIRouterV301:{version:'1.0.121-current'}};
    vm.runInNewContext(stripSource,context,{filename:'minilm-decision-strip-v1.js'});
    let rounds=0;
    for(;rounds<100&&(pending.size||microtasks.length);rounds++){
      const changed=[...pending];pending.clear();for(const observer of changed)observer.callback([]);
      for(const callback of microtasks.splice(0))callback();
    }
    assert.equal(pending.size+microtasks.length,0,`${stale.join('+')}: ${appended.length} script additions still trigger another observer callback`);
    assert.equal(appended.filter(path=>path===hostPath).length,stale.includes('host')?1:0);
    assert.equal(appended.filter(path=>path===usagePath).length,stale.includes('usage')?1:0);
  }
});

test('local model health controls release the observer queue with a selected model',()=>{
  const observers=new Set(),pending=new Set(),microtasks=[];let label='Test model',writes=0;
  const notify=()=>{for(const observer of observers)pending.add(observer)};
  const button={dataset:{localTestPulse:'qa-local'},get textContent(){return label},set textContent(value){label=String(value);writes++;notify()}};
  const actions={querySelector:()=>button},row={dataset:{modelId:'qa-local'},querySelector:()=>actions};
  const result={dataset:{},set innerHTML(value){notify()}};
  const panel={querySelector:()=>result,querySelectorAll:selector=>selector==='[data-local-test-pulse]'?[button]:[row]};
  class Observer{constructor(callback){this.callback=callback}observe(){observers.add(this)}disconnect(){observers.delete(this);pending.delete(this)}}
  const context={document:{readyState:'complete',getElementById:id=>id==='cw-local-ai-v266'?panel:{}},
    localStorage:{getItem:()=>null,setItem(){}},MutationObserver:Observer,queueMicrotask:callback=>microtasks.push(callback),addEventListener(){},
    CivweaveLocalModelDownloadV266:{selection:()=>({active:true,id:'qa-local'})}};
  vm.runInNewContext(pulseSource,context,{filename:'test-pulse-v269.js'});
  for(const callback of microtasks.splice(0))callback();
  notify();
  for(let rounds=0;rounds<100&&(pending.size||microtasks.length);rounds++){
    const changed=[...pending];pending.clear();for(const observer of changed)observer.callback([{addedNodes:[{}]}]);
    for(const callback of microtasks.splice(0))callback();
  }
  assert.equal(pending.size+microtasks.length,0,`model health controls repeated their own unchanged label ${writes} times`);
  assert.equal(writes,0);
});

test('pending Rook chat settles with translation, model health, Nearby, avatar and route observers active together',async()=>{
  const observers=new Set(),pending=new Map(),microtasks=[],listeners=new Map(),storage=new Map(),writes=new Map();
  function notify(target){for(const observer of observers)pending.set(observer,[...(pending.get(observer)||[]),{type:'childList',target,addedNodes:[{}],removedNodes:[]}])}
  function contentNode(name,initial=''){
    let value=initial;const node={dataset:{},isConnected:true,setAttribute(){}};
    for(const key of ['textContent','innerHTML'])Object.defineProperty(node,key,{get:()=>value,set:next=>{value=String(next);writes.set(name,(writes.get(name)||0)+1);notify(node)}});
    return node;
  }
  const nearby=contentNode('nearby','Nearby'),modelButton=contentNode('model-button','Test model');modelButton.dataset.localTestPulse='qa-local';
  const translation=contentNode('translation'),result=contentNode('health'),label=contentNode('route-label'),tracker=contentNode('route-tracker');
  const modelRow={dataset:{modelId:'qa-local'},querySelector:()=>({querySelector:()=>modelButton})};
  const settings={querySelector:selector=>selector==='#cw-translation-packs-v1'?translation:result,
    querySelectorAll:selector=>selector==='[data-local-test-pulse]'?[modelButton]:[modelRow]};
  const strip={dataset:{},querySelector:selector=>selector.includes('data-minilm-label')?label:selector.includes('data-guild-neuron-tracker')?tracker:null};
  const row={dataset:{role:'assistant',pending:'true'},classList:{contains:()=>true},querySelector:()=>({textContent:'Rook is thinking…'})};
  const chat={id:'cw-persistent-guide-chat-v215',dataset:{guide:'fellowfare'},querySelectorAll:()=>[row],querySelector:()=>strip};
  class Observer{constructor(callback){this.callback=callback}observe(){observers.add(this)}disconnect(){observers.delete(this);pending.delete(this)}}
  const context={URL,location:{href:'https://staging.example/app/persistent-system-shell-v1.html'},
    document:{readyState:'complete',scripts:[],documentElement:{dataset:{},lang:'en'},querySelectorAll:()=>[],
      getElementById:id=>id==='cw-human-chat-network-v1'?{querySelector:()=>({querySelector:()=>nearby})}:
        id==='cw-persistent-guide-chat-v215'?chat:id==='cw-local-ai-v266'?settings:id.includes('style')?{}:null},
    navigator:{language:'en'},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},sessionStorage:{getItem:()=>null},
    MutationObserver:Observer,queueMicrotask:callback=>microtasks.push(callback),setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
    addEventListener:(type,callback)=>listeners.set(type,[...(listeners.get(type)||[]),callback]),
    dispatchEvent:event=>{for(const callback of listeners.get(event.type)||[])callback(event)},
    CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail}},fetch:()=>new Promise(()=>{}),
    CivweaveContextRouterV344:{status:()=>({ready:false})},CivweaveBleObjectTransportV1:{status:()=>({peers:[]})},
    CivweaveLocalModelDownloadV266:{selection:()=>({active:true,id:'qa-local'})},
    CivweaveHostNodeSessionV1:{version:'1.0.137-current',sessionFor:()=>({nodeId:'synthetic-guild'})},
    CivweaveGuildChatUsageV1:{version:'1.0.2-current',snapshot:()=>({known:false}),refresh:()=>new Promise(()=>{})},
    CivweaveResponseRouterV347:{classify(){}},CivweaveServerAIRouterV301:{version:'1.0.121-current'}};
  vm.createContext(context);
  for(const [filename,source] of [['Nearby',bleSource],['avatar',avatarSource],['translation',translationSource],['model-health',pulseSource],['route-strip',stripSource]])
    vm.runInContext(source,context,{filename});
  async function flush(){
    for(let rounds=0;rounds<100&&(pending.size||microtasks.length);rounds++){
      const changed=[...pending];pending.clear();for(const [observer,records] of changed)if(observers.has(observer))observer.callback(records);
      for(const callback of microtasks.splice(0))callback();await Promise.resolve();
    }
    return pending.size+microtasks.length;
  }
  assert.equal(await flush(),0,'startup writes must settle across all loaded observers');
  const before=Object.fromEntries(writes);
  for(let turn=0;turn<10;turn++){notify(chat);assert.equal(await flush(),0,`pending chat mutation ${turn+1} must release the event loop`)}
  assert.deepEqual(Object.fromEntries(writes),before,'unrelated pending rows need no hidden-panel or control replacement');
  context.CivweaveTranslationPacksV1.setAutoEnabled(false);
  assert.equal(await flush(),0,'a real translation change settles while a model remains selected');
  assert.equal(writes.get('translation'),before.translation+1);assert.equal(writes.get('model-button')||0,0);
});
