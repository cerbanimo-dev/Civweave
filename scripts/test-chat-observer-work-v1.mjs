import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const bleSource=readFileSync(new URL('../public/app/human-chat-ble-controls-v1.js',import.meta.url),'utf8');
const avatarSource=readFileSync(new URL('../public/app/avatar-expression-director-v345.js',import.meta.url),'utf8');

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
