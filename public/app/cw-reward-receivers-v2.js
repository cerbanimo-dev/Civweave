(()=>{
'use strict';
if(globalThis.CivweaveRewardReceiversV2)return;
const api=globalThis.CivweaveCanonicalRewardsV2;if(!api)throw Error('Canonical reward ledger must load before receivers.');
const V='2.1.0',EVENTS='civweave.rewards.v156',SKILLS=['living-school.reward-ledger.v1.1','living-school.reward-ledger.v1'],BUTTONS=['fellowfare.reward-ledger.v1.1','fellowfare.reward-ledger.v1'],seen=new Set();let migrating=false;
const clean=(v,n=500)=>String(v??'').trim().slice(0,n),num=v=>Number.isFinite(Number(v))?Number(v):0,parse=(v,f)=>{try{return JSON.parse(v)??f}catch{return f}},copy=v=>JSON.parse(JSON.stringify(v)),signedAmount=e=>e?.operation==='burn'?-Math.abs(num(e.amount)):num(e.amount);
const CONTRACT=`CIVWEAVE REWARD CONTRACT civweave.reward-contract.v2
Learning and doing are provenance categories, not separate XP currencies. Both add Skill XP to the canonical Reward Ledger.
For every module, lesson, assessment, task, quest, or completion return this exact object:
"rewards":{"skillXp":[{"skillId":"canonical-kebab-case","name":"Human Skill Name","amount":20,"rationale":"Why this exact amount applies"}],"acorns":0,"buttons":0,"sourceKind":"learning"}
Use sourceKind "learning" for Living School and "doing" for Cerbanimo. Each skill amount is absolute. Never emit a generic rewardXp pool, never use amounts as weights, and never redistribute declared amounts. Skill XP is earn-only. Acorns and Buttons are personal non-transferable reward credits: positive values earn them and negative values burn them; they are never transfers between Passports. A receiver hashes, signs, validates, and deduplicates each entry. Return JSON only when a JSON schema is supplied.`;
const rewardProperty={type:'object',description:'Exact Civweave ledger rewards. Skill amounts are absolute; Acorns and Buttons are non-transferable earn/burn credits.',required:['skillXp','acorns','buttons','sourceKind'],properties:{skillXp:{type:'array',items:{type:'object',required:['skillId','amount'],properties:{skillId:{type:'string'},name:{type:'string'},amount:{type:'number',minimum:0},rationale:{type:'string'},parent:{type:'string'}}}},acorns:{type:'number'},buttons:{type:'number'},sourceKind:{type:'string',enum:['learning','doing','validation','exchange','fulfillment','correction']}}};
function relevant(r={}){const text=`${r.purpose||''} ${r.systemId||''} ${JSON.stringify(r.context||{})} ${(r.messages||[]).map(x=>x?.content||'').join(' ')}`.toLowerCase();return/(living-school|cerbanimo|moss|kamiya|curriculum|lesson|module|assessment|task|quest|skill|reward|completion)/.test(text)}
function schema(s){if(!s||s.type!=='object')return s;const n=copy(s);n.properties=n.properties||{};if(!n.properties.rewards)n.properties.rewards=copy(rewardProperty);n.required=[...new Set([...(Array.isArray(n.required)?n.required:[]),'rewards'])];return n}
function normalizeTree(v,ctx={},visited=new WeakSet()){
  if(!v||typeof v!=='object'||visited.has(v))return v;
  visited.add(v);
  if(Array.isArray(v))return v.map(item=>normalizeTree(item,ctx,visited));
  if(v.schema==='civweave.reward-contract.v2')return v;
  const directReward=!('rewards'in v)&&Array.isArray(v.skillXp)&&('sourceKind'in v||'acorns'in v||'buttons'in v);
  if(directReward)return api.normalizeRewardBundle(v,ctx);
  if('rewards'in v||'rewardXp'in v||'skillRewards'in v)v.rewards=api.normalizeRewardBundle(v,ctx);
  for(const [key,x] of Object.entries(v))if(key!=='rewards'&&x&&typeof x==='object')v[key]=normalizeTree(x,ctx,visited);
  return v;
}
function contractGenerate(runtime){
  const original=runtime.generate.bind(runtime);
  const generate=async request=>{
    let next=request&&typeof request==='object'?{...request}:request;
    if(next&&relevant(next)){
      const doing=/cerbanimo|kamiya|task|quest|labor|work/i.test(`${next.purpose||''} ${next.systemId||''}`),sourceKind=doing?'doing':'learning';
      next={...next,schema:schema(next.schema),context:{...(next.context||{}),rewardContract:{version:'civweave.reward-contract.v2.1',authority:'civweave.reward-ledger.v2',sourceKind,exactAmounts:true,nonTransferable:['acorn','button'],burnable:['acorn','button'],levelFormula:'floor(sqrt(skillXp / 40)) + 1',assets:['skill-xp','acorn','button']}},messages:[...(next.messages||[]),{role:'system',content:CONTRACT}]};
    }
    const result=await original(next);
    if(result?.outputJson&&typeof result.outputJson==='object'){
      const outputJson=normalizeTree(copy(result.outputJson),{sourceSystem:next?.systemId||next?.purpose,sourceKind:next?.context?.rewardContract?.sourceKind});
      return{...result,outputJson};
    }
    return result;
  };
  Object.defineProperty(generate,'__cwRewardContractV2',{value:true});
  return generate;
}
function patchRuntime(runtime){
  if(!runtime?.generate||runtime.rewardContractRevision===V||runtime.generate.__cwRewardContractV2)return runtime;
  const generate=contractGenerate(runtime);
  if(Object.isExtensible(runtime)&&!Object.isFrozen(runtime)){
    try{runtime.generate=generate;runtime.rewardContractRevision=V;runtime.__cwRewardContractV2=true;return runtime}catch{}
  }
  const proxy={...runtime,generate,rewardContractRevision:V,__cwRewardContractV2:true};
  return Object.isFrozen(runtime)?Object.freeze(proxy):proxy;
}
function watch(name,patch){let value=patch(globalThis[name]);try{Object.defineProperty(globalThis,name,{configurable:true,enumerable:true,get:()=>value,set:n=>{value=patch(n)}})}catch{if(value)patch(value)}}
function rows(value){return Array.isArray(value)?value:Array.isArray(value?.events)?value.events:[]}
async function migrateEvents(){const value=parse(localStorage.getItem(EVENTS),null);for(const [i,row] of rows(value).entries()){const id=clean(row?.id||row?.receiptId||`${row?.createdAt||''}:${row?.currency||''}:${row?.skill||''}:${row?.amount||0}:${i}`);if(!id||id.startsWith('canonical:')||seen.has(`event:${id}`))continue;const currency=clean(row.currency||row.assetType,30).toLowerCase(),assetType=currency==='xp'?'skill-xp':currency==='acorn'?'acorn':currency==='button'?'button':'',amount=num(row.amount);if(assetType&&amount)await api.appendEntry({accountId:row.accountId,assetType,operation:row.operation,skillId:row.skill||row.skillId,skillName:row.skillName||row.skill,amount,sourceSystem:row.system||row.sourceSystem||'civweave',sourceKind:row.sourceKind||row.phase||'migration',sourceId:row.sourceId||row.completionId||id,sourceKey:`legacy-event:${id}`,createdAt:row.createdAt,metadata:{legacyKey:EVENTS,legacyId:id}});seen.add(`event:${id}`)}}
async function migrateSkills(){for(const key of SKILLS){const state=parse(localStorage.getItem(key),null),receipts=Array.isArray(state?.xpReceipts)?state.xpReceipts:[];for(const [i,row] of receipts.entries()){const id=clean(row.id||row.receiptId||`${key}:${row.createdAt||''}:${row.skillSlug||row.skillId||row.skill||''}:${row.amount||row.xp||0}:${i}`);if(seen.has(`skill:${id}`))continue;const amount=num(row.amount??row.xp),skillId=row.skillSlug||row.skillId||row.skill;if(amount&&skillId)await api.appendEntry({accountId:row.accountId,assetType:'skill-xp',operation:'earn',skillId,skillName:row.skillName||row.skill||skillId,amount:Math.abs(amount),sourceSystem:row.sourceSystem||row.system||'living-school',sourceKind:row.sourceKind||row.phase||'migration',sourceId:row.sourceId||row.completionId||id,sourceKey:`legacy-skill:${id}`,createdAt:row.createdAt,metadata:{legacyKey:key,legacyId:id}});seen.add(`skill:${id}`)}}}
async function migrateButtons(){for(const key of BUTTONS){const state=parse(localStorage.getItem(key),null),receipts=Array.isArray(state?.receipts)?state.receipts:[];for(const [i,row] of receipts.entries()){const id=clean(row.id||row.receiptId||`${key}:${row.createdAt||''}:${row.amount||0}:${i}`);if(seen.has(`button:${id}`))continue;const amount=num(row.amount);if(amount)await api.appendEntry({accountId:row.accountId,assetType:'button',operation:row.operation||row.type,amount,sourceSystem:row.sourceSystem||row.system||'fellowfare',sourceKind:row.sourceKind||row.phase||'migration',sourceId:row.sourceId||id,sourceKey:`legacy-button:${id}`,createdAt:row.createdAt,metadata:{legacyKey:key,legacyId:id,operation:row.operation||row.type}});seen.add(`button:${id}`)}}}
async function migrate(){if(migrating)return;migrating=true;try{await migrateEvents();await migrateSkills();await migrateButtons()}finally{migrating=false}}
let rawSet=Storage.prototype.setItem;
function patchStorage(){const p=Storage.prototype;if(p.__cwRewardReceiverV2)return;rawSet=p.setItem;Object.defineProperty(p,'__cwRewardReceiverV2',{value:true});p.setItem=function(key,value){const result=rawSet.call(this,key,value);if(this===localStorage&&[EVENTS,...SKILLS,...BUTTONS].includes(key))queueMicrotask(()=>migrate().catch(console.warn));return result}}
function mirror(){const current=parse(localStorage.getItem(EVENTS),{}),legacy=rows(current).filter(x=>!String(x?.id||'').startsWith('canonical:')),events=api.readLedger().entries.map(e=>({id:`canonical:${e.id}`,accountId:e.accountId,currency:e.assetType==='skill-xp'?'xp':e.assetType,skill:e.skillId,amount:signedAmount(e),operation:e.operation||'earn',system:e.sourceSystem,phase:e.sourceKind,sourceId:e.sourceId,createdAt:e.createdAt,canonicalHash:e.hash}));rawSet.call(localStorage,EVENTS,JSON.stringify({...(!Array.isArray(current)&&current&&typeof current==='object'?current:{}),schema:'civweave.compatible-reward-events.v2.1',events:[...legacy,...events].slice(-25000),canonicalProjection:true,updatedAt:new Date().toISOString()}))}
function eventBundle(d){return d?.rewards||d?.rewardBundle||d?.module?.rewards||d?.task?.rewards||d?.completion?.rewards}
function bindEvents(){for(const name of ['living-school:module-completed','living-school:lesson-completed','living-school:assessment-completed','cerbanimo:task-completed','cerbanimo:quest-completed','civweave:reward-bundle'])addEventListener(name,event=>{const d=event.detail||{},bundle=eventBundle(d);if(!bundle)return;const system=name.startsWith('living-school')?'living-school':name.startsWith('cerbanimo')?'cerbanimo':d.sourceSystem||'civweave';api.issueRewardBundle(bundle,{sourceSystem:system,sourceKind:system==='cerbanimo'?'doing':system==='living-school'?'learning':d.sourceKind,sourceId:d.completionId||d.moduleId||d.taskId||d.id,evidenceHash:d.evidenceHash,validatorIds:d.validatorIds,accountId:d.accountId}).catch(console.warn)})}
function boot(){patchStorage();watch('CivweaveModelRuntime',patchRuntime);bindEvents();addEventListener('storage',e=>{if([EVENTS,...SKILLS,...BUTTONS].includes(e.key))migrate().catch(console.warn)});addEventListener('civweave:canonical-rewards-changed',mirror);migrate().then(mirror).catch(console.warn);setInterval(()=>{const current=globalThis.CivweaveModelRuntime,patched=patchRuntime(current);if(patched&&patched!==current)globalThis.CivweaveModelRuntime=patched},1500)}
globalThis.CivweaveRewardReceiversV2=Object.freeze({version:V,promptContract:CONTRACT,rewardProperty,normalizeGeneratedTree:normalizeTree,patchRuntime,migrate});
boot();
})();
