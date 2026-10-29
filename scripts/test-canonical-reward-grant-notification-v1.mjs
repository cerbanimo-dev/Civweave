import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {IDBFactory} from 'fake-indexeddb';

const source=readFileSync(new URL('../public/app/cw-reward-ledger-v2.js',import.meta.url),'utf8');
const contract=readFileSync(new URL('../public/app/civweave-ledger-contract-v1.js',import.meta.url),'utf8');
const key='civweave.reward-ledger.v2';
function fixture(){
  const values=new Map(),events=[],atDispatch=[];let failWrite=false;
  const localStorage={getItem:name=>values.get(name)||null,setItem(name,value){if(failWrite&&name===key){const error=new Error('Quota exceeded in reward fixture');error.name='QuotaExceededError';throw error}values.set(name,String(value))}};
  const context={crypto:webcrypto,indexedDB:new IDBFactory(),TextEncoder,TextDecoder,localStorage,console,
    CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},
    dispatchEvent(event){events.push(event);atDispatch.push(JSON.parse(localStorage.getItem(key)||'null'));return true},
    btoa:value=>Buffer.from(value,'binary').toString('base64'),atob:value=>Buffer.from(value,'base64').toString('binary')};
  vm.createContext(context);vm.runInContext(contract,context);vm.runInContext(source,context);
  return{api:context.CivweaveCanonicalRewardsV2,events,atDispatch,values,failWrite:value=>{failWrite=value},reboot(){vm.runInContext('delete globalThis.CivweaveCanonicalRewardsV2',context);vm.runInContext(source,context)}};
}
const input=(assetType='acorn',extras={})=>({assetType,operation:'earn',amount:7,sourceSystem:'living-school',sourceKind:'learning',sourceId:'fixture-module',sourceKey:`fixture:${assetType}`,accountId:'passport:fixture',...(assetType==='skill-xp'?{skillId:'carpentry',skillName:'Carpentry'}:{}),...extras});

test('bootstrap and reopening an existing ledger never announce a fresh grant',async()=>{
  const app=fixture();assert.equal(app.events.length,1);assert.equal(app.events[0].detail.reason,'bootstrap');assert.equal(app.events[0].detail.addedEntry,null);assert.equal(app.events[0].detail.grantDelta,null);
  await app.api.appendEntry(input());app.reboot();const boot=app.events.at(-1).detail;
  assert.equal(boot.reason,'bootstrap');assert.equal(boot.addedEntry,null);assert.equal(boot.grantDelta,null);assert.equal(boot.ledger.entries.length,1);
});

test('only signed and stored new earnings expose a bounded display delta for each canonical asset',async()=>{
  const app=fixture();
  for(const assetType of ['skill-xp','acorn','button']){
    const result=await app.api.appendEntry(input(assetType,{metadata:{private:'must not enter display delta'},validatorIds:['private-validator'],evidenceHash:'private-evidence'})),detail=app.events.at(-1).detail,stored=app.atDispatch.at(-1);
    assert.equal(result.duplicate,false);assert.equal(detail.reason,'append');assert.equal(detail.persisted,true);assert.equal(detail.addedEntry.id,result.entry.id);
    assert.equal(stored.entries.find(row=>row.id===result.entry.id)?.hash,result.entry.hash,'The grant event must follow the actual storage write');
    const delta=detail.grantDelta;assert.equal(delta.receiptId,result.entry.hash);assert.equal(delta.entryId,result.entry.id);assert.equal(delta.accountId,'passport:fixture');assert.equal(delta.assetType,assetType);assert.equal(delta.amount,7);assert.equal(delta.sourceId,'fixture-module');
    assert.equal(delta.metadata,undefined);assert.equal(delta.validatorIds,undefined);assert.equal(delta.evidenceHash,undefined);assert.equal(delta.signature,undefined);assert.equal(delta.sourceKey,undefined);
  }
  assert.equal(app.api.project(undefined,{accountId:'passport:fixture'}).skillXp,7);assert.equal(app.api.project(undefined,{accountId:'passport:fixture'}).acorns,7);assert.equal(app.api.project(undefined,{accountId:'passport:fixture'}).buttons,7);
  assert.equal((await app.api.verifyLedger()).ok,true);
});

test('idempotent retries keep the same entry and do not emit another grant notification',async()=>{
  const app=fixture(),first=await app.api.appendEntry(input()),count=app.events.length,second=await app.api.appendEntry(input());
  assert.equal(second.duplicate,true);assert.equal(second.entry.id,first.entry.id);assert.equal(app.events.length,count);assert.equal(app.api.readLedger().entries.length,1);
});

test('burns, corrections and reversals still persist through their existing semantics without a celebratory delta',async()=>{
  const app=fixture();await app.api.appendEntry(input());
  for(const operation of ['burn','correction','reversal']){
    const result=await app.api.appendEntry(input('acorn',{operation,amount:1,sourceKey:`fixture:${operation}`})),detail=app.events.at(-1).detail;
    assert.equal(detail.reason,'append');assert.equal(detail.persisted,true);assert.equal(detail.addedEntry.id,result.entry.id);assert.equal(detail.grantDelta,null);assert.equal(result.entry.operation,operation);
  }
});

test('legacy migrations are retained in the ledger without fresh-grant eligibility',async()=>{
  const app=fixture();
  for(const extras of [{sourceKind:'migration',sourceKey:'fixture:migration'},{sourceKind:'learning',sourceKey:'legacy-skill:old-module'},{sourceKind:'learning',sourceKey:'fixture:import',metadata:{legacyKey:'living-school.reward-ledger.v1'}}]){
    const result=await app.api.appendEntry(input('acorn',extras)),detail=app.events.at(-1).detail;
    assert.equal(result.duplicate,false);assert.equal(detail.persisted,true);assert.equal(detail.addedEntry.id,result.entry.id);assert.equal(detail.grantDelta,null);
  }
  assert.equal(app.api.readLedger().entries.length,3);assert.equal(app.api.project().acorns,21,'Notification eligibility never changes migration grant amounts');
});

test('a failed storage write rejects the grant, emits nothing, and leaves the queue usable for an explicit retry',async()=>{
  const app=fixture(),before=app.events.length;app.failWrite(true);
  await assert.rejects(app.api.appendEntry(input()),error=>error.name==='QuotaExceededError'&&/Quota exceeded/.test(error.message));
  assert.equal(app.events.length,before);assert.equal(app.api.readLedger().entries.length,0);assert.equal(app.values.has(key),false);
  app.failWrite(false);const result=await app.api.appendEntry(input());assert.equal(result.duplicate,false);assert.equal(result.entry.sequence,1);assert.equal(app.events.at(-1).detail.grantDelta.receiptId,result.entry.hash);
});
