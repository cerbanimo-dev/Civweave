import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ROOT=new URL('../',import.meta.url);
const path='public/app/cw-fellowfare-fee-policy-v1.js';
assert.ok(fs.existsSync(new URL(path,ROOT)),`${path} is missing`);

class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}
class MutationObserver{observe(){}disconnect(){}}
class StorageMock{constructor(){this.map=new Map()}getItem(key){return this.map.has(String(key))?this.map.get(String(key)):null}setItem(key,value){this.map.set(String(key),String(value))}removeItem(key){this.map.delete(String(key))}}
const document={readyState:'loading',documentElement:{},head:{append(){}},querySelector:()=>null,querySelectorAll:()=>[]};
const context={console,document,MutationObserver,CustomEvent,localStorage:new StorageMock(),addEventListener:()=>{},dispatchEvent:()=>true,requestAnimationFrame:fn=>fn(),setTimeout,Intl,globalThis:null};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL(path,ROOT),'utf8'),context,{filename:path});
const fees=context.CivweaveFellowFareFeePolicyV1;
assert.ok(fees,'fee policy did not boot');
assert.equal(fees.policy.totalBps,100);
assert.equal(fees.policy.hostBps,50);
assert.equal(fees.policy.cerbanimoBps,50);
assert.equal(fees.policy.cerbanimoLabel,'Cerbanimo LLC');

const buttonQuote=fees.quote({amount:100,assetType:'button',hubId:'north-country'});
assert.equal(buttonQuote.gross,100);
assert.equal(buttonQuote.fee,1);
assert.equal(buttonQuote.providerNet,99);
assert.deepEqual(JSON.parse(JSON.stringify(buttonQuote.splits)),[
  {role:'provider',amount:99},
  {role:'serving-host',accountId:'host:north-country',amount:.5,bps:50},
  {role:'cerbanimo-llc',accountId:'treasury:cerbanimo-llc',label:'Cerbanimo LLC',amount:.5,bps:50}
]);

const acornQuote=fees.quote({amount:7,assetType:'acorn',hubId:'node-2'});
assert.equal(acornQuote.fee,.07);
assert.equal(acornQuote.providerNet,6.93);
assert.equal(acornQuote.splits.find(row=>row.role==='serving-host').amount,.035);
assert.equal(acornQuote.splits.find(row=>row.role==='cerbanimo-llc').amount,.035);

for(const kind of ['gift','donation','refund','reversal','reward','mint']){
  const quote=fees.quote({amount:50,assetType:'button',kind});
  assert.equal(quote.fee,0,`${kind} should be fee-exempt`);
  assert.equal(quote.providerNet,50,`${kind} should preserve the full amount`);
}

const receipt=fees.settlementReceipt({transactionId:'tx-1',threadId:'thread-1',agreementId:'agreement-1',amount:40,assetType:'button',hubId:'host-a',sourceReceiptId:'ledger:123',createdAt:'2026-08-11T22:30:00.000Z'});
assert.equal(receipt.schema,'fellowfare.fee-split-receipt.v1');
assert.equal(receipt.gross,40);
assert.equal(receipt.fee,.4);
assert.equal(receipt.providerNet,39.6);
assert.equal(receipt.splits.find(row=>row.role==='serving-host').amount,.2);
assert.equal(receipt.splits.find(row=>row.role==='cerbanimo-llc').amount,.2);
assert.equal(receipt.sourceReceiptId,'ledger:123');

console.log(JSON.stringify({ok:true,policy:fees.policy,buttonQuote,acornQuote,receipt},null,2));
