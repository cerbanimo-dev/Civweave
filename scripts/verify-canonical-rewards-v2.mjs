import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';

const ROOT=new URL('../',import.meta.url);
const sources=['public/app/civweave-ledger-contract-v1.js','public/app/cw-reward-ledger-v2.js','public/app/cw-reward-receivers-v2.js','public/app/cw-reward-surfaces-v2.js'];
for(const path of sources)assert.ok(fs.existsSync(new URL(path,ROOT)),`${path} is missing`);

class StorageMock{constructor(){this.map=new Map()}getItem(k){return this.map.has(String(k))?this.map.get(String(k)):null}setItem(k,v){this.map.set(String(k),String(v))}removeItem(k){this.map.delete(String(k))}}
const keyStore=new Map();
const indexedDB={open(){const request={result:null,error:null,onupgradeneeded:null,onsuccess:null,onerror:null};queueMicrotask(()=>{const db={objectStoreNames:{contains:()=>true},createObjectStore(){},close(){},transaction(){const tx={oncomplete:null,onerror:null,error:null,objectStore(){return{get(key){const r={result:null,error:null,onsuccess:null,onerror:null};queueMicrotask(()=>{r.result=keyStore.get(key);r.onsuccess?.()});return r},put(value,key){keyStore.set(key,value);queueMicrotask(()=>tx.oncomplete?.())}}}};return tx}};request.result=db;request.onupgradeneeded?.();request.onsuccess?.()});return request}};
class MutationObserver{observe(){}disconnect(){}}
class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}
const noop=()=>{},document={readyState:'complete',documentElement:{dataset:{}},body:{dataset:{}},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]};
const context={console,crypto:webcrypto,TextEncoder,TextDecoder,indexedDB,Storage:StorageMock,localStorage:new StorageMock(),document,MutationObserver,CustomEvent,addEventListener:noop,dispatchEvent:noop,requestAnimationFrame:fn=>setTimeout(fn,0),setTimeout,clearTimeout,setInterval:()=>1,clearInterval:noop,queueMicrotask,location:{href:'https://example.test/app',pathname:'/app',search:''},btoa:v=>Buffer.from(v,'binary').toString('base64'),atob:v=>Buffer.from(v,'base64').toString('binary'),URL,URLSearchParams,performance,Intl,globalThis:null};
context.globalThis=context;vm.createContext(context);
for(const path of sources)vm.runInContext(fs.readFileSync(new URL(path,ROOT),'utf8'),context,{filename:path});

const api=context.CivweaveCanonicalRewardsV2,receivers=context.CivweaveRewardReceiversV2,surfaces=context.CivweaveRewardSurfacesV2,contract=context.CivweaveLedgerContractV1;
assert.ok(api&&receivers&&surfaces&&contract,'reward runtimes did not boot');
assert.equal(api.levelForXp(0),1);assert.equal(api.levelForXp(40),2);assert.equal(api.xpForLevel(3),160);
assert.equal(contract.TRANSFERABLE.button,false);assert.equal(contract.TRANSFERABLE.acorn,false);assert.equal(contract.BURNABLE.button,true);assert.equal(contract.BURNABLE.acorn,true);assert.equal(contract.BURNABLE['skill-xp'],false);
const exact=api.normalizeRewardBundle({rewards:{skillXp:[{skillId:'Carpentry',amount:20},{skillId:'Planning',amount:5}],acorns:3,buttons:0,sourceKind:'learning'}});
assert.deepEqual(JSON.parse(JSON.stringify(exact.skillXp.map(x=>[x.skillId,x.amount]))),[['carpentry',20],['planning',5]]);
assert.equal(exact.exactSkillAmounts,true);assert.match(receivers.promptContract,/Never emit a generic rewardXp pool/);assert.match(receivers.promptContract,/Each skill amount is absolute/);assert.match(receivers.promptContract,/non-transferable/);
await api.issueRewardBundle({rewards:{skillXp:[{skillId:'Carpentry',amount:20},{skillId:'Planning',amount:5}],acorns:3,buttons:0,sourceKind:'learning'}},{sourceSystem:'living-school',sourceKind:'learning',sourceId:'module-1'});
await api.issueRewardBundle({rewards:{skillXp:[{skillId:'Carpentry',amount:75}],acorns:0,buttons:8,sourceKind:'doing'}},{sourceSystem:'cerbanimo',sourceKind:'doing',sourceId:'task-1'});
await api.issueRewardBundle({rewards:{skillXp:[],acorns:-1,buttons:-3,sourceKind:'exchange'}},{sourceSystem:'fellowfare',sourceKind:'exchange',sourceId:'trade-1'});
await api.issueRewardBundle({rewards:{skillXp:[{skillId:'Carpentry',amount:75}],buttons:8,sourceKind:'doing'}},{sourceSystem:'cerbanimo',sourceKind:'doing',sourceId:'task-1'});
const p=api.project();assert.equal(p.skills.carpentry.xp,95);assert.equal(p.skills.carpentry.learningXp,20);assert.equal(p.skills.carpentry.doingXp,75);assert.equal(p.skills.carpentry.level,2);assert.equal(p.acorns,2);assert.equal(p.buttons,5);assert.equal(p.entries.length,7,'duplicate completion minted twice');
const burns=api.readLedger().entries.filter(row=>row.operation==='burn');assert.equal(burns.length,2);assert.ok(burns.every(row=>row.amount>0),'burn entries should store positive magnitude plus explicit operation');
await assert.rejects(()=>api.appendEntry({assetType:'button',operation:'transfer',amount:1,sourceId:'bad-transfer'}),/non-transferable/);
await assert.rejects(()=>api.appendEntry({assetType:'button',operation:'earn',amount:1,toAccountId:'passport:other',sourceId:'bad-transfer-2'}),/non-transferable/);
await assert.rejects(()=>api.appendEntry({assetType:'skill-xp',operation:'burn',amount:1,skillId:'carpentry',sourceId:'bad-xp-burn'}),/not burnable/);
const subsystemClaim={...api.readLedger(),totalXp:999999,skillXp:999999,acorns:999999,buttons:999999,balances:{acorns:999999,buttons:999999}};
const passport=surfaces.calculatePassportFromLedger(subsystemClaim);
assert.equal(passport.skillXp,100,'Passport trusted a subsystem total instead of summing ledger entries');
assert.equal(passport.skills.carpentry.xp,95);assert.equal(passport.skills.planning.xp,5);assert.equal(passport.acorns,2);assert.equal(passport.buttons,5);
assert.equal(passport.authority,'civweave.reward-ledger.v2');assert.equal(passport.entries.length,7);
const tree=api.livingTreeProjection();assert.equal(tree.find(x=>x.skillId==='carpentry').level,2);
const integrity=await api.verifyLedger();assert.equal(integrity.ok,true,JSON.stringify(integrity.errors));const tampered=api.readLedger();tampered.entries[0].amount=999;assert.equal((await api.verifyLedger(tampered)).ok,false,'tampering was not detected');
console.log('canonical reward ledger v2 verified');
