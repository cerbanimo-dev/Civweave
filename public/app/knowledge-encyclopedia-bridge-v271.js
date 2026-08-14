(()=>{
'use strict';
const VERSION='1.0.134-knowledge-encyclopedia-bridge-v272-server-failover';
if(globalThis.CivweaveKnowledgeEncyclopediaBridgeV271?.version===VERSION)return;
const state={version:VERSION,ready:false,error:'',installed:false};
globalThis.CivweaveKnowledgeEncyclopediaBridgeV271=state;
let modulePromise=null,installPromise=null;
const clean=(value,max=5000)=>String(value??'').trim().replace(/\s+/g,' ').slice(0,max);
const mode=system=>system==='living-school'?'Learn':system==='cerbanimo'?'Build':system==='fellowfare'?'Acquire':system==='anarchadia'?'Govern':'Reflect';

function loadModule(){
  if(!modulePromise)modulePromise=import('/app/shared/knowledge-encyclopedia-v271.mjs?v=knowledge-encyclopedia-v271');
  return modulePromise;
}
function fallbackAnswer(knowledge){
  const sources=Array.isArray(knowledge?.sources)?knowledge.sources:[];
  if(!sources.length)return'I checked the local knowledge shelf, but it returned no usable reference for this question. The shelf may not be installed on this device, or the installed material may not cover the topic.';
  const first=sources[0],second=sources[1],lead=clean(first.passage,680),support=second?`\n\nA second local reference, ${second.title}, adds: ${clean(second.passage,360)}`:'';
  return`${first.title}: ${lead}${support}\n\nLocal shelf: ${sources.slice(0,3).map(source=>source.title).join(' · ')}. These are downloaded references, not a live current-events check.`;
}
function knowledgeOverrideMessage(knowledge){
  const matrix=knowledge.personality||{},sources=Array.isArray(knowledge.sources)?knowledge.sources:[];
  return[
    'KNOWLEDGE MODE OVERRIDE FOR THIS TURN.',
    'This is a stable knowledge question, not a request to create an intention, quest, market action, or governance action.',
    'Return questDraft:null. Do not manufacture an action or approval gate.',
    'Write a compact mini-informational answer, usually 2-5 short paragraphs.',
    sources.length?'Use context.knowledgeEncyclopedia.sources as the primary factual grounding. Synthesize them; do not quote long passages.':'The local knowledge shelf returned no usable match. It may be uninstalled or simply lack matching material. You may use stable model knowledge, but do not claim a downloaded source was found.',
    'Never describe downloaded archive material as current, live, newly verified, or up to date.',
    `Guide personality: ${matrix.guide||'Guide'}; lens=${matrix.lens||'general'}; voice=${matrix.voice||'clear'}; preferred shape=${Array.isArray(matrix.shape)?matrix.shape.join(' -> '):'compact explanation'}.`,
    `Personality affects framing only. It must never alter source facts. Priority: ${matrix.priority||'Preserve factual meaning.'}`,
    sources.length?'End with one brief line beginning “Local shelf:” naming up to three source titles.':''
  ].filter(Boolean).join(' ');
}
function patchCompose(api,classify){
  if(!api?.compose||api.compose.__cwKnowledgeV271)return;
  const original=api.compose.bind(api);
  const wrapped=function(text,...rest){if(classify(text)?.eligible)return null;return original(text,...rest)};
  wrapped.__cwKnowledgeV271=true;wrapped.__cwOriginal=original;api.compose=wrapped;
}
function patchPlanner(api,classify){
  if(!api?.maybeCreate||api.maybeCreate.__cwKnowledgeV271)return;
  const original=api.maybeCreate.bind(api);
  const wrapped=function(input,...rest){const text=typeof input==='string'?input:input?.text;if(classify(text)?.eligible)return null;return original(input,...rest)};
  wrapped.__cwKnowledgeV271=true;wrapped.__cwOriginal=original;api.maybeCreate=wrapped;
}
function patchGenerate(runtime,encyclopedia){
  if(!runtime?.generate||runtime.generate.__cwKnowledgeV271)return;
  const original=runtime.generate.bind(runtime);
  const wrapped=async function(options={}){
    if(options?.purpose!=='civweave-guide-response-v141')return original(options);
    const text=clean(options?.context?.userMessage,4000),system=clean(options?.context?.guide?.system||options?.context?.currentContext?.systemId||'civweave',80);
    const classification=encyclopedia.classifyKnowledgeQuestion(text);
    if(!classification.eligible)return original(options);
    const knowledge=await encyclopedia.buildKnowledgeContext(text,system);
    const selected=clean(options?.config?.provider||options?.config?.route,80).toLowerCase();
    if(!Array.isArray(knowledge?.sources)||!knowledge.sources.length){
      if(selected==='server-auto')return original(options);
    }
    const messages=[...(Array.isArray(options.messages)?options.messages:[]),{role:'system',content:knowledgeOverrideMessage(knowledge)}];
    let result;
    try{result=await original({...options,context:{...(options.context||{}),knowledgeEncyclopedia:knowledge},messages})}catch(error){result={status:'error',error:{message:error?.message||String(error)}}}
    if(['success','fallback'].includes(result?.status))return result;
    return{
      status:'success',
      outputJson:{answer:fallbackAnswer(knowledge),choice:{mode:mode(system),system,room:clean(options?.context?.currentContext?.roomId,240),nextAction:''},assumptions:[],requiresConsent:false,confidence:(Array.isArray(knowledge.sources)&&knowledge.sources.length>0)?0.82:0.45,questDraft:null},
      outputText:'',
      actual:{provider:'local-knowledge-school',model:'knowledge-encyclopedia-v271-retrieval-fallback'},
      fallback:{used:true,reason:clean(result?.error?.message||'Selected model failed during local encyclopedia synthesis.',500)}
    };
  };
  wrapped.__cwKnowledgeV271=true;wrapped.__cwOriginal=original;
  try{runtime.generate=wrapped}catch{globalThis.CivweaveModelRuntime=Object.freeze({...runtime,generate:wrapped,knowledgeEncyclopediaRevision:VERSION})}
}
async function install(){
  if(state.installed)return state;
  const encyclopedia=await loadModule();
  patchCompose(globalThis.CivweaveGuideContractsV141,encyclopedia.classifyKnowledgeQuestion);
  patchPlanner(globalThis.CivweaveIntentionPlanner,encyclopedia.classifyKnowledgeQuestion);
  patchGenerate(globalThis.CivweaveModelRuntime,encyclopedia);
  state.ready=true;state.installed=true;state.error='';
  try{dispatchEvent(new CustomEvent('civweave:knowledge-encyclopedia-ready',{detail:{version:VERSION,personalities:Object.keys(encyclopedia.PERSONALITY_MATRICES||{})}}))}catch{}
  return state;
}
state.install=()=>installPromise||(installPromise=install().catch(error=>{state.error=clean(error?.message||error,900);installPromise=null;throw error}));
state.install().catch(error=>console.warn('[Civweave knowledge encyclopedia]',error));
})();
