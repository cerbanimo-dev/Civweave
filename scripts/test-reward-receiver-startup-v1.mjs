import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source=readFileSync(new URL('../public/app/cw-reward-receivers-v2.js',import.meta.url),'utf8');
const EVENTS='civweave.rewards.v156';

function harness(count=250,{alreadyMigrated=false}={}){
  const values=new Map([[EVENTS,JSON.stringify({events:Array.from({length:count},(_,index)=>({id:`legacy-${index}`,currency:'xp',skill:'carpentry',amount:1}))})]]);
  const writes=[],reads=[],listeners=new Map(),entries=alreadyMigrated?Array.from({length:count},(_,index)=>({id:`entry-${index}`,sourceKey:`legacy-event:legacy-${index}`,assetType:'skill-xp',skillId:'carpentry',amount:1})):[],appendCalls=[];
  class Storage{
    getItem(key){reads.push(key);return values.get(key)||null}
    setItem(key,value){writes.push(key);values.set(key,String(value))}
  }
  const localStorage=new Storage();
  const dispatchEvent=event=>{for(const listener of listeners.get(event.type)||[])listener(event);return true};
  const context={console,Storage,localStorage,queueMicrotask,setInterval:()=>0,
    addEventListener:(type,listener)=>listeners.set(type,[...(listeners.get(type)||[]),listener]),dispatchEvent,
    CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},
    CivweaveCanonicalRewardsV2:{
      readLedger:()=>({entries}),normalizeRewardBundle:value=>value,
      async appendEntry(input){appendCalls.push(input);const duplicate=entries.find(row=>row.sourceKey===input.sourceKey);if(duplicate)return{duplicate:true};entries.push({...input,id:`entry-${entries.length}`});dispatchEvent({type:'civweave:canonical-rewards-changed',detail:{ledger:{entries}}});return{duplicate:false}},
    }
  };
  context.globalThis=context;
  vm.runInNewContext(source,context);
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  return{context,entries,values,writes,reads,appendCalls,dispatchEvent,settle};
}

test('legacy reward startup migration mirrors the completed ledger once',async()=>{
  const h=harness();await h.settle();
  assert.equal(h.entries.length,250,'every legacy receipt must reach the canonical ledger');
  assert.equal(h.writes.filter(key=>key===EVENTS).length,1,'migration must not serialize the complete reward history once per migrated receipt');
  assert.equal(h.reads.filter(key=>key===EVENTS).length,2,'one migration read and one final projection read must suffice');
  const saved=JSON.parse(h.values.get(EVENTS));
  assert.equal(saved.events.filter(row=>row.id.startsWith('canonical:')).length,250);
  assert.equal(saved.events.filter(row=>row.id.startsWith('legacy-')).length,250,'legacy evidence must remain preserved');
});

test('already migrated histories do not repeatedly invoke full-ledger append and projection',async()=>{
  const h=harness(250,{alreadyMigrated:true});await h.settle();
  assert.equal(h.appendCalls.length,0,'known canonical migration source keys must be indexed once instead of rechecking every receipt in the ledger owner');
  assert.equal(h.entries.length,250);
  assert.equal(h.writes.filter(key=>key===EVENTS).length,1);
});

test('ordinary reward changes still mirror immediately and storage catch-up does not rewrite an unchanged projection',async()=>{
  const h=harness(0);await h.settle();h.writes.length=0;
  h.entries.push({id:'ordinary',assetType:'acorn',amount:10});
  h.dispatchEvent({type:'civweave:canonical-rewards-changed',detail:{ledger:{entries:h.entries}}});
  assert.equal(h.writes.filter(key=>key===EVENTS).length,1);
  assert.equal(JSON.parse(h.values.get(EVENTS)).events[0].id,'canonical:ordinary');
  h.writes.length=0;
  h.dispatchEvent({type:'storage',key:EVENTS});await h.settle();
  assert.deepEqual(h.writes,[],'an unchanged cross-window projection must not cause storage-event feedback');
});
