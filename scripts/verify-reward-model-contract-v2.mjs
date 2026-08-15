import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';

const root=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),'utf8');
class StorageMock{constructor(){this.map=new Map()}getItem(k){return this.map.has(String(k))?this.map.get(String(k)):null}setItem(k,v){this.map.set(String(k),String(v))}removeItem(k){this.map.delete(String(k))}}
class MutationObserver{observe(){}disconnect(){}}
class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}
const noop=()=>{},document={readyState:'complete',documentElement:{},querySelector:()=>null,querySelectorAll:()=>[]};
let captured=null;
const originalRuntime=Object.freeze({generate:async request=>{captured=request;return{status:'success',outputJson:{answer:'ready',rewards:{skillXp:[{skillId:'Carpentry',amount:20}],acorns:1,buttons:0,sourceKind:'learning'}}}}});
const context={console,crypto:webcrypto,TextEncoder,TextDecoder,Storage:StorageMock,localStorage:new StorageMock(),document,MutationObserver,CustomEvent,addEventListener:noop,dispatchEvent:noop,setTimeout,clearTimeout,setInterval:()=>1,clearInterval:noop,queueMicrotask,requestAnimationFrame:fn=>fn(),location:{href:'https://example.test/app',pathname:'/app',search:''},URL,URLSearchParams,Intl,performance,btoa:v=>Buffer.from(v,'binary').toString('base64'),atob:v=>Buffer.from(v,'base64').toString('binary'),CivweaveModelRuntime:originalRuntime,globalThis:null};
context.globalThis=context;vm.createContext(context);
vm.runInContext(read('public/app/cw-reward-ledger-v2.js'),context,{filename:'cw-reward-ledger-v2.js'});
vm.runInContext(read('public/app/cw-reward-receivers-v2.js'),context,{filename:'cw-reward-receivers-v2.js'});
const patched=context.CivweaveModelRuntime;
assert.equal(patched.rewardContractRevision,'2.0.0');
assert.notEqual(patched,originalRuntime,'a frozen unpatched runtime should receive a compatible proxy');
const result=await patched.generate({purpose:'living-school-module-forge',systemId:'living-school',schema:{type:'object',required:['answer'],properties:{answer:{type:'string'}}},messages:[{role:'user',content:'Build a carpentry module'}]});
assert.ok(captured.messages.some(row=>/CIVWEAVE REWARD CONTRACT/.test(row.content)),'reward prompt contract was not delivered');
assert.ok(captured.schema.required.includes('rewards'),'receiver did not require the reward object');
assert.equal(captured.context.rewardContract.authority,'living-school');
assert.equal(result.outputJson.rewards.skillXp[0].amount,20);
const fastGenerate=async request=>patched.generate(request);Object.defineProperty(fastGenerate,'__civweaveFastInteractiveV192',{value:true});
const fastProxy=Object.freeze({...patched,generate:fastGenerate});
context.CivweaveModelRuntime=fastProxy;
assert.equal(context.CivweaveModelRuntime,fastProxy,'fast runtime identity should survive when it inherits the reward contract marker');
const exact=context.CivweaveCanonicalRewardsV2.normalizeRewardBundle({skillRewards:[{skillId:'Carpentry',amount:2.5},{skillId:'Planning',amount:1.25}]},{sourceSystem:'living-school',sourceKind:'learning'});
assert.equal(exact.exactSkillAmounts,true,'canonical reward ledger did not recognize explicit skill amounts');
assert.equal(exact.legacyFallback,false,'explicit skill amounts must not enter the legacy fallback path');
assert.deepEqual(JSON.parse(JSON.stringify(exact.skillXp.map(row=>[row.skillId,row.amount]))),[['carpentry',2.5],['planning',1.25]]);
console.log('reward model contract and canonical exact skill rewards v2 verified');
