(()=>{
'use strict';
const SETTINGS_KEY='commonweave.universal-ai.v127';
const CHAT_KEY='commonweave.weaveling-chat.v127';
const MICRO_MANIFEST='/app/models/functiongemma-270m-it/model-manifest.json';
const MICRO_ADAPTER='/app/models/functiongemma-270m-it/adapter.js';
const SYSTEM_IDS=['commonweave','living-school','cerbanimo','fellowfare','anarchadia'];
const GUIDE_BY_SYSTEM={
  commonweave:{name:'Weaveling',role:'central mirror and orchestrator',prompt:'Reflect the user’s intent, mark assumptions, select a useful route without claiming certainty, and end with a concrete next step. Preserve agency.'},
  'living-school':{name:'Moss',role:'learning guide',prompt:'Turn the request into a learnable progression. Distinguish explanation, practice, assessment, and credential evidence.'},
  cerbanimo:{name:'Kamiya',role:'questwright and skilled-work guide',prompt:'Turn work into transparent quests, checkpoints, proof, validation, and rewards. Be playful without hiding stakes or manipulating the user.'},
  fellowfare:{name:'Rook',role:'quartermaster and exchange guide',prompt:'Name needs and offers, clarify constraints, protect trust, and make logistics and fair exchange edges explicit.'},
  anarchadia:{name:'Merlin',role:'civic and automation guide',prompt:'Prioritize clarity and coherence, mark uncertainty, translate metaphor into mechanics and next actions, and require consent for consequential civic actions.'}
};
const RESPONSE_SCHEMA={
  type:'object',
  required:['answer','choice','assumptions','requiresConsent'],
  properties:{
    answer:{type:'string'},
    choice:{type:'object',required:['mode','system','room','nextAction'],properties:{
      mode:{type:'string'},system:{type:'string',enum:SYSTEM_IDS},room:{type:'string'},nextAction:{type:'string'}
    }},
    assumptions:{type:'array',items:{type:'string'},maxItems:8},
    requiresConsent:{type:'boolean'},
    confidence:{type:'number'}
  }
};
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normalizeArray=value=>Array.isArray(value)?value:[];
const runtime=()=>globalThis.CommonweaveModelRuntime||null;
let ledgerPromise=null,microModulePromise=null;
function report(kind,detail={}){try{fetch('/api/boot-log',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({schema:'commonweave.boot-log.v1',time:new Date().toISOString(),version:'1.0.30',build:'micro-routing-hologram-r5',kind:`assistant-v133:${kind}`,url:location.href,detail}),keepalive:true,cache:'no-store'}).catch(()=>{})}catch{}}
function pathSystem(){
  const parts=location.pathname.split('/').filter(Boolean);const index=parts.indexOf('realm');
  return index>=0&&SYSTEM_IDS.includes(parts[index+1])?parts[index+1]:'commonweave';
}
function providerName(value){
  const provider=String(value||'bundled').toLowerCase();
  if(provider==='deterministic'||provider==='browser')return 'bundled';
  if(['openai','compatible','openai-compatible'].includes(provider))return 'openai-compatible';
  if(provider==='local-api')return 'ollama';
  return ['bundled','gemini','ollama','openai-compatible','hosted'].includes(provider)?provider:'bundled';
}
function selectedConfig(){
  const legacy=parse(localStorage.getItem(SETTINGS_KEY),{route:'bundled',model:'FunctionGemma 270M',endpoint:MICRO_MANIFEST,consent:false});
  let shared=null;
  try{shared=runtime()?.readSharedConfig?.('interactive')||null}catch{}
  const raw=shared||legacy;
  const provider=providerName(raw.provider||raw.route);
  if(provider==='bundled')return {provider:'bundled',route:'bundled',model:'google/functiongemma-270m-it',endpoint:MICRO_MANIFEST,externalConsent:false};
  return {...raw,provider,route:provider,externalConsent:Boolean(raw.externalConsent??raw.remoteConsent??legacy.consent)};
}
async function ledger(){
  if(!ledgerPromise)ledgerPromise=globalThis.CommonweaveParity?.load?.().catch(()=>null)||Promise.resolve(null);
  return ledgerPromise;
}
async function currentEnvironment(systemId){
  const data=await ledger();
  const query=new URLSearchParams(location.search);
  const saved=localStorage.getItem(`commonweave.realm-room.${systemId}`);
  const roomId=systemId==='commonweave'?'commonweave.quad':query.get('room')||saved||data?.systems?.find?.(item=>item.id===systemId)?.roomIds?.[0]||'';
  const room=data?.index?.rooms?.get?.(roomId)||data?.rooms?.find?.(item=>item.id===roomId)||null;
  return {systemId,roomId,roomLabel:room?.label||roomId||'The Quad',capabilityIds:normalizeArray(room?.capabilityIds),roomPurpose:room?.purpose||''};
}
function matchedRoute(text,currentSystem){
  const lower=String(text||'').toLowerCase();
  const groups=[
    {system:'living-school',mode:'Learn',words:['learn','study','course','teach','understand','practice','curriculum','lesson','skill','research','explain']},
    {system:'cerbanimo',mode:'Build',words:['build','make','code','design','repair','work','project','task','ship','prototype','quest','implement']},
    {system:'fellowfare',mode:'Acquire',words:['buy','find','material','resource','trade','sell','offer','need','inventory','exchange','delivery','borrow']},
    {system:'anarchadia',mode:'Govern',words:['govern','proposal','vote','rule','community','organize','policy','bug','federation','consent','assembly','automation']}
  ];
  const scored=groups.map(group=>({...group,hits:group.words.filter(word=>lower.includes(word))})).sort((a,b)=>b.hits.length-a.hits.length);
  const winner=scored[0];
  if(winner?.hits.length)return {system:winner.system,mode:winner.mode,confidence:Math.min(.96,.58+winner.hits.length*.1),evidence:winner.hits};
  if(/plan|steps|roadmap|what next|how do i/.test(lower))return {system:currentSystem||'commonweave',mode:'Plan',confidence:.68,evidence:['planning phrase']};
  return {system:currentSystem||'commonweave',mode:'Reflect',confidence:.42,evidence:[]};
}
async function compileContext({text,systemId,guideName,history}){
  const environment=await currentEnvironment(systemId);
  const route=matchedRoute(text,systemId);
  const data=await ledger();
  const destinationSystem=data?.systems?.find?.(item=>item.id===route.system)||null;
  const destinationRoom=destinationSystem?.roomIds?.[0]||environment.roomId;
  const consequential=/\b(send|spend|transfer|publish|submit|approve|vote|delete|invite|assign|purchase|order|deploy|federate)\b/i.test(text);
  return {
    schema:'commonweave.structured-context.v1',
    routingQuestion:'Which canonical Commonweave system best owns the user’s next useful action?',
    routingAnswer:{mode:route.mode,system:route.system,room:destinationRoom,confidence:route.confidence,evidence:route.evidence},
    userMessage:String(text),
    currentContext:environment,
    guide:{name:guideName,system:systemId},
    recentConversation:normalizeArray(history).slice(-8).map(item=>({role:item.role,text:String(item.text||'').slice(0,1200)})),
    availableSystems:SYSTEM_IDS,
    requestedModel:selectedConfig(),
    consent:{consequentialActionDetected:consequential,rule:'Drafting may be automatic. Spending, transferring, publishing, submitting, voting, deleting, assigning, purchasing, deploying, or federating requires affirmative consent.'},
    responseContract:{schema:'commonweave.guide-choice.v1',fields:['answer','choice.mode','choice.system','choice.room','choice.nextAction','assumptions','requiresConsent','confidence']}
  };
}
async function microModule(){
  if(!microModulePromise)microModulePromise=import(MICRO_ADAPTER).catch(error=>{microModulePromise=null;throw error});
  return microModulePromise;
}
async function microStatus(){
  try{
    const manifestResponse=await fetch(MICRO_MANIFEST,{cache:'no-store'});
    const manifest=manifestResponse.ok?await manifestResponse.json():null;
    const adapter=await microModule();
    const state=await adapter.status();
    return {...state,manifest};
  }catch(error){return {available:false,id:'google/functiongemma-270m-it',error:error.message}}
}
function prompts(context,systemId){
  const guide=GUIDE_BY_SYSTEM[systemId]||GUIDE_BY_SYSTEM.commonweave;
  const systemPrompt=`You are ${guide.name}, Commonweave’s ${guide.role}. ${guide.prompt}\n\nYou receive deterministic structured context produced by the application. Treat it as routing evidence, not unquestionable truth. Return JSON only and satisfy the response contract. The choice object records your own best current routing choice. Do not claim an action happened unless the context says it already happened. If requiresConsent is true, explain the proposed action but do not execute it.`;
  return [
    {role:'system',content:systemPrompt},
    {role:'user',content:`Structured context:\n${JSON.stringify(context)}\n\nRespond as JSON matching commonweave.guide-choice.v1.`}
  ];
}
function parseModelOutput(output,context){
  let value=output;
  if(typeof value==='string'){
    const cleaned=value.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
    value=parse(cleaned,null);
  }
  if(!value||typeof value!=='object')throw new Error('The selected model did not return the required structured JSON.');
  const choice=value.choice&&typeof value.choice==='object'?value.choice:{};
  const fallback=context.routingAnswer;
  return {
    answer:String(value.answer||'').trim(),
    choice:{
      mode:String(choice.mode||fallback.mode),
      system:SYSTEM_IDS.includes(choice.system)?choice.system:fallback.system,
      room:String(choice.room||fallback.room),
      nextAction:String(choice.nextAction||'Clarify the smallest visible result that would prove progress.')
    },
    assumptions:normalizeArray(value.assumptions).map(String).slice(0,8),
    requiresConsent:Boolean(value.requiresConsent),
    confidence:Number.isFinite(Number(value.confidence))?Number(value.confidence):fallback.confidence
  };
}
async function callMicro(messages,context){
  const adapter=await microModule();
  const text=await adapter.generate({messages,maxNewTokens:360});
  const parsed=parseModelOutput(text,context);
  return {response:parsed,provider:'bundled',model:'google/functiongemma-270m-it'};
}
async function callSelected(messages,context){
  const config=selectedConfig();
  if(config.provider==='bundled')return callMicro(messages,context);
  const modelRuntime=runtime();
  if(!modelRuntime?.generate)throw new Error('The shared model runtime has not loaded.');
  const result=await modelRuntime.generate({purpose:'commonweave-guide-response',executionProfile:'interactive',config,messages,schema:RESPONSE_SCHEMA,maxRepairAttempts:1});
  if(result?.status!=='success'&&result?.status!=='fallback')throw Object.assign(new Error(result?.error?.message||`The selected provider ended with ${result?.status||'an unknown status'}.`),{code:result?.error?.code,result});
  const response=parseModelOutput(result.outputJson||result.outputText,context);
  return {response,provider:result.actual?.provider||config.provider,model:result.actual?.model||config.model,diagnostics:result.diagnostics||[]};
}
async function respond({text,systemId=pathSystem(),guideName,history=[]}){
  const guide=GUIDE_BY_SYSTEM[systemId]||GUIDE_BY_SYSTEM.commonweave;
  const context=await compileContext({text,systemId,guideName:guideName||guide.name,history});
  const messages=prompts(context,systemId);
  try{
    const selected=await callSelected(messages,context);
    report('answered',{selectedProvider:selectedConfig().provider,actualProvider:selected.provider,model:selected.model,route:selected.response.choice,requiresConsent:selected.response.requiresConsent});
    return {...selected,context};
  }catch(error){
    if(selectedConfig().provider!=='bundled'){
      try{
        const local=await callMicro(messages,context);
        report('fallback-to-micro',{selectedProvider:selectedConfig().provider,error:error.message,route:local.response.choice});
        return {...local,context,fallbackFrom:{provider:selectedConfig().provider,error:error.message}};
      }catch(microError){
        error.microError=microError;
      }
    }
    report('answer-failed',{provider:selectedConfig().provider,error:error.message,microError:error.microError?.message||null,structuredContext:context.routingAnswer});
    throw Object.assign(new Error(`No AI engine answered. The request was structured for ${context.routingAnswer.system}, but ${selectedConfig().provider==='bundled'?'the FunctionGemma package is not installed':'the selected provider failed and the FunctionGemma fallback is not installed'}. Open AI settings or package the local model.`),{cause:error,context});
  }
}
function storageForDialog(node){
  if(node.id==='cw127-chat')return CHAT_KEY;
  const systemId=pathSystem();return `commonweave.guide-chat.${systemId}.v128`;
}
function initialFor(node,systemId){
  const guide=GUIDE_BY_SYSTEM[systemId]||GUIDE_BY_SYSTEM.commonweave;
  return node.id==='cw127-chat'?'I’m here. Tell me what you want to move toward, and I’ll pass structured context to your selected AI.':`I’m ${guide.name}, your ${guide.role}. What needs attention here?`;
}
function renderLog(node,key,systemId){
  const log=node.querySelector('.cw127-chat-log');if(!log)return;
  const stored=parse(localStorage.getItem(key),[]);const items=Array.isArray(stored)?stored:[];
  const visible=items.length?items:[{role:'assistant',text:initialFor(node,systemId)}];
  log.innerHTML=visible.map(item=>`<p class="${item.role==='user'?'user':'assistant'}${item.pending?' cw-ai-pending':''}">${esc(item.text)}</p>`).join('');
  log.scrollTop=log.scrollHeight;
}
async function handleSubmit(event,form,node){
  event.preventDefault();event.stopImmediatePropagation();
  const input=form.querySelector('textarea,input[type="text"]');const text=input?.value.trim();if(!text)return;
  const systemId=node.id==='cw127-chat'?'commonweave':pathSystem();const guide=GUIDE_BY_SYSTEM[systemId]||GUIDE_BY_SYSTEM.commonweave;
  const key=storageForDialog(node);const stored=parse(localStorage.getItem(key),[]);const items=Array.isArray(stored)?stored:[];
  const pendingId=`pending-${Date.now().toString(36)}`;
  items.push({role:'user',text,time:new Date().toISOString()},{role:'assistant',text:`${guide.name} is consulting the selected AI…`,time:new Date().toISOString(),pending:true,id:pendingId});
  localStorage.setItem(key,JSON.stringify(items.slice(-80)));input.value='';renderLog(node,key,systemId);
  const submit=form.querySelector('button[type="submit"],button:not([type])');if(submit)submit.disabled=true;
  try{
    const result=await respond({text,systemId,guideName:guide.name,history:items.filter(item=>!item.pending)});
    const current=parse(localStorage.getItem(key),[]);const list=Array.isArray(current)?current:[];const index=list.findIndex(item=>item.id===pendingId);
    const response=result.response;
    const next=response.choice.nextAction?`\n\nNext: ${response.choice.nextAction}`:'';
    const consent=response.requiresConsent?'\n\nThis next action waits for your explicit approval.':'';
    const fallback=result.fallbackFrom?`\n\nLocal fallback used because ${result.fallbackFrom.provider} did not answer.`:'';
    const replacement={role:'assistant',text:`${response.answer}${next}${consent}${fallback}`.trim(),time:new Date().toISOString(),provider:result.provider,model:result.model,choice:response.choice,assumptions:response.assumptions,requiresConsent:response.requiresConsent,context:result.context};
    if(index>=0)list[index]=replacement;else list.push(replacement);
    localStorage.setItem(key,JSON.stringify(list.slice(-80)));
    const label=document.querySelector('#cw127-context-label');if(label)label.textContent=response.choice.mode;
    localStorage.setItem('commonweave.weaveling-mode',response.choice.mode);
  }catch(error){
    const current=parse(localStorage.getItem(key),[]);const list=Array.isArray(current)?current:[];const index=list.findIndex(item=>item.id===pendingId);
    const replacement={role:'assistant',text:error.message,time:new Date().toISOString(),error:true,structuredContext:error.context||null};
    if(index>=0)list[index]=replacement;else list.push(replacement);
    localStorage.setItem(key,JSON.stringify(list.slice(-80)));
  }finally{if(submit)submit.disabled=false;renderLog(node,key,systemId);input?.focus()}
}
document.addEventListener('submit',event=>{
  const form=event.target.closest?.('.cw127-chat-form');if(!form)return;
  const node=form.closest('#cw127-chat,#cw128-guide');if(!node)return;
  handleSubmit(event,form,node);
},true);
const legacy=parse(localStorage.getItem(SETTINGS_KEY),null);
if(!legacy||providerName(legacy.route||legacy.provider)==='bundled'&&String(legacy.route||legacy.provider).toLowerCase()==='deterministic'){
  localStorage.setItem(SETTINGS_KEY,JSON.stringify({route:'bundled',model:'FunctionGemma 270M',endpoint:MICRO_MANIFEST,consent:false,agenticEnabled:false}));
}
globalThis.CommonweaveAssistant={respond,compileContext,microStatus,selectedConfig,RESPONSE_SCHEMA,MICRO_MANIFEST};
report('ready',{selected:selectedConfig(),microManifest:MICRO_MANIFEST});
})();
