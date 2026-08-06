(()=>{
'use strict';
if(globalThis.CommonweaveRewardLegacyBridgeV2)return;
const V='2.0.0';
const canonical=()=>globalThis.CommonweaveCanonicalRewardsV2;
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const number=value=>Number.isFinite(Number(value))?Number(value):0;
const exactSkills=input=>{
  const api=canonical();
  const rows=Array.isArray(input?.skillRewards)?input.skillRewards:[];
  if(!api||!rows.length)return null;
  const seen=new Set();
  return rows.map((item,index)=>{
    const raw=typeof item==='string'?{name:item}:item||{};
    const amount=Math.max(0,number(raw.amount??raw.xp??raw.baseXp));
    const name=clean(raw.name||raw.skillName||raw.skillId||raw.slug||`Skill ${index+1}`,120);
    let slug=api.skillSlug(raw.skillId||raw.skill||raw.slug||name);
    if(seen.has(slug))slug=`${slug}-${index+1}`;
    seen.add(slug);
    return{
      slug,
      name,
      parent:clean(raw.parent||'Practice',120),
      aliases:Array.isArray(raw.aliases)?raw.aliases.map(String).slice(0,20):[],
      definition:clean(raw.definition||`Demonstrated capability related to ${name}.`,1000),
      status:'provisional',
      confidence:Math.max(0,Math.min(1,number(raw.confidence||0.9))),
      difficulty:clean(raw.difficulty||input.difficulty||'developing',40),
      baseXp:Number(amount.toFixed(2)),
      xpRationale:clean(raw.rationale||raw.reason||`${amount} exact Skill XP declared by the module or task.`,1000),
      registryMatch:slug,
      evidenceRubric:(Array.isArray(raw.evidenceRubric)?raw.evidenceRubric:Array.isArray(raw.rubric)?raw.rubric:[
        `The result for ${clean(input.title||'this activity',200)} can be inspected.`,
        "The submission addresses the stated proof requirement.",
        "The contributor identifies what changed, what was tested, and any remaining limits."
      ]).map(String).slice(0,8)
    };
  }).filter(row=>row.baseXp>0).slice(0,16);
};
function prepareInput(value){
  if(!value||typeof value!=='object')return value;
  const next={...value};
  const rewards=next.rewards&&typeof next.rewards==='object'?next.rewards:null;
  const rows=Array.isArray(next.skillRewards)?next.skillRewards:Array.isArray(rewards?.skillXp)?rewards.skillXp:null;
  if(rows?.length){
    next.skillRewards=rows.map(row=>typeof row==='string'?row:{...row,xp:number(row.amount??row.xp??row.baseXp),baseXp:number(row.amount??row.xp??row.baseXp)});
    const total=next.skillRewards.reduce((sum,row)=>sum+number(typeof row==='string'?0:row.amount??row.xp??row.baseXp),0);
    next.rewardXp=total;
    next.baseXp=total;
  }
  return next;
}
function patch(runtime){
  if(!runtime||runtime.__cwExactSkillRewardsV2)return runtime;
  const core=runtime.core;
  if(!core?.mossTagTask)return runtime;
  const original=core.mossTagTask.bind(core);
  const exact=input=>exactSkills(input)||original(input);
  core.mossTagTask=exact;
  runtime.skills=exact;
  if(typeof runtime.submit==='function'){
    const submit=runtime.submit.bind(runtime);
    runtime.submit=(raw,accountId,name)=>submit(prepareInput(raw),accountId,name);
  }
  if(typeof runtime.registerQuest==='function'){
    const register=runtime.registerQuest.bind(runtime);
    runtime.registerQuest=(payload,accountId,name)=>{
      const next={...(payload||{}),tasks:Array.isArray(payload?.tasks)?payload.tasks.map(prepareInput):[]};
      return register(next,accountId,name);
    };
  }
  Object.defineProperty(runtime,'__cwExactSkillRewardsV2',{value:true});
  return runtime;
}
function watch(){
  let value=globalThis.CommonweaveRewardWeave;
  try{
    Object.defineProperty(globalThis,'CommonweaveRewardWeave',{configurable:true,enumerable:true,get:()=>value,set:next=>{value=patch(next)}});
    if(value)value=patch(value);
  }catch{if(value)patch(value)}
}
function inject(frame){
  const apply=()=>{
    try{
      const doc=frame.contentDocument;
      if(!doc?.documentElement||doc.querySelector('script[data-cw-rewards-v2="legacy-bridge"]'))return;
      const script=doc.createElement('script');
      script.src='/app/cw-reward-legacy-bridge-v2.js?v=2.0.0';
      script.dataset.cwRewardsV2='legacy-bridge';
      (doc.head||doc.documentElement).append(script);
    }catch{}
  };
  frame.addEventListener('load',apply);
  apply();
}
function scan(root=document){
  if(root?.matches?.('iframe'))inject(root);
  root?.querySelectorAll?.('iframe')?.forEach(inject);
}
function boot(){
  watch();
  scan();
  new MutationObserver(records=>records.forEach(record=>[...record.addedNodes].forEach(node=>node?.nodeType===1&&scan(node)))).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(()=>patch(globalThis.CommonweaveRewardWeave),1200);
}
globalThis.CommonweaveRewardLegacyBridgeV2=Object.freeze({version:V,exactSkills,prepareInput,patch});
document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
