import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const parseJsonc=raw=>JSON.parse(raw.split('\n').filter(line=>!line.trim().startsWith('//')).join('\n'));

const [policy,worker,productionRaw,stagingRaw]=await Promise.all([
  read('public/app/local-first-policy-v131.js'),
  read('cloudflare/node-cloud/src/server-ai-entry-v6.mjs'),
  read('cloudflare/node-cloud/wrangler.jsonc'),
  read('cloudflare/node-cloud/wrangler.staging.jsonc'),
]);

for(const token of [
  "NETWORK_DAY_LIMIT=2400",
  "NETWORK_MINUTE_LIMIT=60",
  "CIVWEAVE_CLIENT_REQUEST_BUDGET",
  "inFlightGets",
  "responseCache",
  "server-backoff",
])assert(policy.includes(token),`client request governor missing ${token}`);

for(const token of [
  "GUILD_API_RATE_LIMITER",
  "GUILD_AI_RATE_LIMITER",
  "CIVWEAVE_GUILD_RATE_LIMIT",
  "expensiveRequest",
  "rateActor",
])assert(worker.includes(token),`Guild Worker limiter missing ${token}`);

const production=parseJsonc(productionRaw),staging=parseJsonc(stagingRaw);
const binding=(config,name)=>config.ratelimits?.find(item=>item.name===name);
assert(binding(production,'GUILD_API_RATE_LIMITER')?.simple?.limit===60,'production Guild API limit is not 60/minute');
assert(binding(production,'GUILD_AI_RATE_LIMITER')?.simple?.limit===6,'production Guild AI limit is not 6/minute');
assert(binding(staging,'GUILD_API_RATE_LIMITER')?.simple?.limit===60,'staging Guild API limit is not 60/minute');
assert(binding(staging,'GUILD_AI_RATE_LIMITER')?.simple?.limit===6,'staging Guild AI limit is not 6/minute');
assert(binding(production,'GUILD_API_RATE_LIMITER')?.namespace_id!==binding(staging,'GUILD_API_RATE_LIMITER')?.namespace_id,'staging and production API namespaces must stay isolated');
assert(binding(production,'GUILD_AI_RATE_LIMITER')?.namespace_id!==binding(staging,'GUILD_AI_RATE_LIMITER')?.namespace_id,'staging and production AI namespaces must stay isolated');

class StorageMock{
  constructor(){this.map=new Map()}
  getItem(key){return this.map.has(String(key))?this.map.get(String(key)):null}
  setItem(key,value){this.map.set(String(key),String(value))}
  removeItem(key){this.map.delete(String(key))}
  key(index){return[...this.map.keys()][index]??null}
  get length(){return this.map.size}
}

let networkCalls=0;
const localStorage=new StorageMock(),sessionStorage=new StorageMock();
localStorage.setItem('civweave.host-node.selection.v1',JSON.stringify({origin:'https://guild.example'}));
const context={
  globalThis:null,
  localStorage,
  sessionStorage,
  Storage:StorageMock,
  location:{href:'https://civweave.cc/app',origin:'https://civweave.cc'},
  URL,Response,Request,Headers,structuredClone,console,Date,Promise,Map,Set,Object,Array,String,Number,Math,JSON,RegExp,Error,Boolean,
  setTimeout,clearTimeout,
  dispatchEvent(){},
  CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},
  fetch:async()=>{networkCalls+=1;return Response.json({ok:true,networkCalls})},
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(policy,context);

const first=await context.fetch('https://guild.example/api/fabric/capacity');
const second=await context.fetch('https://guild.example/api/fabric/capacity');
assert(first.ok&&second.ok,'cached capacity reads should succeed');
assert(networkCalls===1,'duplicate Guild capacity GETs were not coalesced/cached');

let throttled=0;
for(let index=0;index<70;index+=1){
  const response=await context.fetch(`https://guild.example/api/test/${index}`,{method:'POST'});
  if(response.status===429&&response.headers.get('x-civweave-local-throttle')==='1')throttled+=1;
}
assert(networkCalls===60,`minute budget allowed ${networkCalls} network calls instead of 60`);
assert(throttled===11,`expected 11 locally throttled POSTs after the cached GET, got ${throttled}`);
const budget=context.CivweaveLocalFirstPolicy.networkBudget();
assert(budget.dayLimit===2400&&budget.minuteLimit===60,'public network budget metadata drifted');
assert(budget.origins['https://guild.example']?.dayCount===60,'network budget did not record the 60 network attempts');

console.log(JSON.stringify({
  ok:true,
  client:{perGuildDeviceMinute:60,perGuildDeviceDay:2400,duplicateGetNetworkCalls:1,throttled},
  worker:{apiPerActorMinute:60,aiPerActorMinute:6,productionNamespaces:['41001','41002'],stagingNamespaces:['41101','41102']},
},null,2));
