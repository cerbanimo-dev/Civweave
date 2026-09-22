import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';

const ROOT=new URL('../',import.meta.url);
const sources=['public/app/civweave-ledger-contract-v1.js','public/app/cw-reward-ledger-v2.js','public/app/civweave-fulfillment-ledger-v1.js'];
for(const path of sources)assert.ok(fs.existsSync(new URL(path,ROOT)),`${path} is missing`);

class StorageMock{constructor(){this.map=new Map()}getItem(k){return this.map.has(String(k))?this.map.get(String(k)):null}setItem(k,v){this.map.set(String(k),String(v))}removeItem(k){this.map.delete(String(k))}}
const keyStore=new Map();
const indexedDB={open(){const request={result:null,error:null,onupgradeneeded:null,onsuccess:null,onerror:null};queueMicrotask(()=>{const db={objectStoreNames:{contains:()=>true},createObjectStore(){},close(){},transaction(){const tx={oncomplete:null,onerror:null,error:null,objectStore(){return{get(key){const r={result:null,error:null,onsuccess:null,onerror:null};queueMicrotask(()=>{r.result=keyStore.get(key);r.onsuccess?.()});return r},put(value,key){keyStore.set(key,value);queueMicrotask(()=>tx.oncomplete?.())}}}};return tx}};request.result=db;request.onupgradeneeded?.();request.onsuccess?.()});return request}};
class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}
const context={console,crypto:webcrypto,TextEncoder,TextDecoder,indexedDB,localStorage:new StorageMock(),CustomEvent,dispatchEvent:()=>{},queueMicrotask,btoa:v=>Buffer.from(v,'binary').toString('base64'),atob:v=>Buffer.from(v,'base64').toString('binary'),structuredClone,globalThis:null};
context.globalThis=context;vm.createContext(context);
for(const path of sources)vm.runInContext(fs.readFileSync(new URL(path,ROOT),'utf8'),context,{filename:path});

const rewards=context.CivweaveCanonicalRewardsV2,fulfillment=context.CivweaveFulfillmentLedgerV1;
assert.ok(rewards&&fulfillment,'ledger runtimes did not boot');
const validThreshold=id=>({id,submissionId:id.replace('threshold-','f-'),outcome:'pass',payoutEligible:true,confidence:.94,diversity:{satisfied:true,familyCount:2},verdictReceiptIds:['receipt-a','receipt-b'],integrity:'derived-from-weighted-confidence',createdAt:new Date().toISOString()});
context.localStorage.setItem(fulfillment.VALIDATION_KEY,JSON.stringify({schema:'civweave.validation-ledger.v1.1',thresholdReceipts:[validThreshold('threshold-1'),validThreshold('threshold-2')]}));

await rewards.appendEntry({accountId:'passport:a',assetType:'button',operation:'earn',amount:10,sourceSystem:'cerbanimo',sourceKind:'doing',sourceId:'task-a'});
const prerecord=fulfillment.record({fulfillmentId:'f-1',requesterId:'passport:a',fulfillerId:'passport:b',assetType:'button',burnAmount:4,rewardAmount:6,validationRef:'threshold-1',status:'validated'});
assert.equal(prerecord.duplicate,false);
const settled=await fulfillment.settle({fulfillmentId:'f-1',requesterId:'passport:a',fulfillerId:'passport:b',assetType:'button',burnAmount:4,rewardAmount:6,validationRef:'threshold-1'});
assert.equal(settled.entry.status,'settled');
assert.equal(settled.burn.operation,'burn');
assert.equal(settled.reward.operation,'earn');
assert.equal(settled.validation.id,'threshold-1');
assert.equal(fulfillment.readLedger().entries.filter(row=>row.fulfillmentId==='f-1').length,1,'settlement duplicated a pre-recorded fulfillment');
const a=rewards.project(undefined,{accountId:'passport:a'}),b=rewards.project(undefined,{accountId:'passport:b'});
assert.equal(a.buttons,6,'requester burn did not reduce balance');
assert.equal(b.buttons,6,'fulfiller reward was not newly issued');
assert.equal(rewards.readLedger().entries.filter(row=>row.sourceId==='f-1').length,2,'fulfillment should create exactly two reward events');
const again=await fulfillment.settle({fulfillmentId:'f-1',requesterId:'passport:a',fulfillerId:'passport:b',assetType:'button',burnAmount:4,rewardAmount:6,validationRef:'threshold-1'});
assert.equal(again.duplicate,true,'fulfillment settled twice');
assert.equal(rewards.readLedger().entries.filter(row=>row.sourceId==='f-1').length,2,'duplicate settlement mutated rewards');
await assert.rejects(()=>fulfillment.settle({fulfillmentId:'f-missing',requesterId:'passport:a',fulfillerId:'passport:b',assetType:'button',burnAmount:1,rewardAmount:1,validationRef:'threshold-missing'}),/accepted canonical validation threshold/);
await assert.rejects(()=>fulfillment.settle({fulfillmentId:'f-2',requesterId:'passport:a',fulfillerId:'passport:b',assetType:'button',burnAmount:99,rewardAmount:99,validationRef:'threshold-2'}),/Insufficient button balance/);
console.log('Civweave fulfillment ledger v1 verified');
