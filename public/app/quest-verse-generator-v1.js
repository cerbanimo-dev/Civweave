(()=>{
'use strict';
if(globalThis.CivweaveQuestVerseGeneratorV1)return;
const VERSION='1.0.0';
const PURPOSE='quest-chronicle-verse-low-tier-v1';
const clean=(value,max=1200)=>String(value??'').trim().slice(0,max);
function core(){return globalThis.CivweaveQuestArcChronicleV1||null}
function ludEnabled(){try{return globalThis.CivweaveLudModeV1?.isEnabled?.()===true}catch{return false}}
function extracted(result){if(typeof result==='string')return result;if(typeof result?.outputText==='string')return result.outputText;if(typeof result?.text==='string')return result.text;if(Array.isArray(result?.outputJson?.lines))return result.outputJson.lines.join('\n');if(typeof result?.outputJson?.verse==='string')return result.outputJson.verse;return''}
async function runtimeGenerator(prompt,{retry=false,input={}}={}){
  if(ludEnabled())return null;
  try{await globalThis.CivweaveFamilyAILoaderV105?.ensure?.()}catch{}
  const runtime=globalThis.CivweaveModelRuntime;
  if(!runtime?.generate)return null;
  let config=null;try{config=runtime.readSharedConfig?.('interactive')||null}catch{}
  if(!config)return null;
  const request={
    purpose:PURPOSE,
    executionProfile:'interactive',
    taskTier:'small',
    complexity:'small',
    config:{...config,maxTokens:160,temperature:0.55,stream:false,timeoutMs:Math.min(12000,Number(config.timeoutMs)||12000)},
    context:{publicOnly:true,requestedTier:'low',questBeat:clean(input.questBeat,80),outcome:clean(input.outcome,40),retry:Boolean(retry)},
    messages:[
      {role:'system',content:'Return only a four-line Quest Verse. Use only the supplied public quest metadata. Never infer hidden work details.'},
      {role:'user',content:prompt}
    ]
  };
  const result=await runtime.generate(request);
  if(!['success','fallback'].includes(result?.status))return null;
  return extracted(result);
}
async function generate(input={}){const api=core();if(!api)return{ok:false,kind:'BEAT',text:'Quest Beat — Cleared',lines:[],attempts:0,fallback:true,error:'quest-arc-unavailable'};return api.generateVerse(input,{generate:runtimeGenerator})}
async function createProjection(input={}){const api=core();if(!api)return null;if(ludEnabled())return api.projectReceipt({...input,mode:'BEAT',verse:''});const verse=await generate(input);return api.projectReceipt({...input,verse:verse?.kind==='VERSE'?verse.text:'',mode:input.mode||'BOTH'})}
async function createVeilProjection(entry,input={}){const api=core();if(!api)return null;const base=api.projectionFromVeilEntry(entry,{...input,mode:'BEAT'});if(!base)return null;if(ludEnabled()||input.mode==='BEAT')return base;return createProjection({...input,questId:base.questId,beatId:base.beatId,outcome:base.outcome,receiptCommitment:base.receiptCommitment,createdAt:base.createdAt})}
function status(){return{version:VERSION,purpose:PURPOSE,ludBlocked:ludEnabled(),taskTier:'small',maxTokens:160}}
const api=Object.freeze({version:VERSION,purpose:PURPOSE,generate,createProjection,createVeilProjection,status});
globalThis.CivweaveQuestVerseGeneratorV1=api;
try{dispatchEvent(new CustomEvent('civweave:quest-verse-generator-ready',{detail:status()}))}catch{}
})();