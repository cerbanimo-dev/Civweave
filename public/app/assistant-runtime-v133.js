(()=>{
'use strict';
const SETTINGS_KEY='civweave.universal-ai.v127';
const CHAT_KEY='civweave.weaveling-chat.v127';
const MODEL_ID='HuggingFaceTB/SmolLM2-360M-Instruct';
const SYSTEM_IDS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const GUIDE_BY_SYSTEM={
  civweave:{name:'Weaveling',role:'central mirror and orchestrator',prompt:'Reflect the user’s intent, mark assumptions, select a useful route without claiming certainty, and end with a concrete next step. Preserve agency.'},
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
const runtime=()=>globalThis.CivweaveModelRuntime||null;
let ledgerPromise=null;

function report(kind,detail={}){
  try{fetch('/api/boot-log',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({schema:'civweave.boot-log.v1',time:new Date().toISOString(),version:'1.0.30',build:'smollm2-onboard-r6',kind:`assistant-v134:${kind}`,url:location.href,detail}),keepalive:true,cache:'no-store'}).catch(()=>{})}catch{}
}

function pathSystem(){
  const parts=location.pathname.split('/').filter(Boolean);
  const index=parts.indexOf('realm');
  return index>=0&&SYSTEM_IDS.includes(parts[index+1])?parts[index+1]:'civweave';
}

function providerName(value){
  const provider=String(value||'bundled').toLowerCase();
  if(['deterministic','browser','packaged','bundled','smollm2','functiongemma'].includes(provider))return 'bundled';
  if(['openai','compatible','openai-compatible'].includes(provider))return 'openai-compatible';
  if(provider==='local-api')return 'ollama';
  return ['gemini','ollama','openai-compatible','hosted'].includes(provider)?provider:'bundled';
}

function selectedConfig(){
  const legacy=parse(localStorage.getItem(SETTINGS_KEY),{route:'bundled',model:MODEL_ID,endpoint:'/app/models/smollm2-360m-instruct/model-manifest.json',consent:false});
  let shared=null;
  try{shared=runtime()?.readSharedConfig?.('interactive')||null}catch{}
  const raw=shared||legacy;
  const provider=providerName(raw.provider||raw.route);
  if(provider==='bundled')return {provider:'bundled',route:'bundled',model:MODEL_ID,endpoint:'/app/models/smollm2-360m-instruct/model-manifest.json',externalConsent:false,maxTokens:420,timeoutMs:180000};
  return {...raw,provider,route:provider,externalConsent:Boolean(raw.externalConsent??raw.remoteConsent??legacy.consent)};
}

async function ledger(){
  if(!ledgerPromise)ledgerPromise=globalThis.CivweaveParity?.load?.().catch(()=>null)||Promise.resolve(null);
  return ledgerPromise;
}

async function currentEnvironment(systemId){
  const data=await ledger();
  const query=new URLSearchParams(location.search);
  const saved=localStorage.getItem(`civweave.realm-room.${systemId}`);
  const roomId=systemId==='civweave'?'civweave.quad':query.get('room')||saved||data?.systems?.find?.(item=>item.id===systemId)?.roomIds?.[0]||'';
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
  if(/plan|steps|roadmap|what next|how do i/.test(lower))return {system:currentSystem||'civweave',mode:'Plan',confidence:.68,evidence:['planning phrase']};
  return {system:currentSystem||'civweave',mode:'Reflect',confidence:.42,evidence:[]};
}

async function compileContext({text,systemId,guideName,history}){
  const environment=await currentEnvironment(systemId);
  const route=matchedRoute(text,systemId);
  const data=await ledger();
  const destinationSystem=data?.systems?.find?.(item=>item.id===route.system)||null;
  const destinationRoom=destinationSystem?.roomIds?.[0]||environment.roomId;
  const consequential=/\b(send|spend|transfer|publish|submit|approve|vote|delete|invite|assign|purchase|order|deploy|federate)\b/i.test(text);
  return {
    schema:'civweave.structured-context.v1',
    routingQuestion:'Which canonical Civweave system best owns the user’s next useful action?',
    routingAnswer:{mode:route.mode,system:route.system,room:destinationRoom,confidence:route.confidence,evidence:route.evidence},
    userMessage:String(text),
    currentContext:environment,
    guide:{name:guideName,system:systemId},
    recentConversation:normalizeArray(history).slice(-8).map(item=>({role:item.role,text:String(item.text||'').slice(0,1200)})),
    availableSystems:SYSTEM_IDS,
    requestedModel:selectedConfig(),
    onboardFallback:{model:MODEL_ID,expectation:'If the selected provider fails, answer locally with modest scope, explicit uncertainty, no invented tool use, and no claim that external actions occurred.'},
    consent:{consequentialActionDetected:consequential,rule:'Drafting may be automatic. Spending, transferring, publishing, submitting, voting, deleting, assigning, purchasing, deploying, or federating requires affirmative consent.'},
    responseContract:{schema:'civweave.guide-choice.v1',fields:['answer','choice.mode','choice.system','choice.room','choice.nextAction','assumptions','requiresConsent','confidence']}
  };
}

function prompts(context,systemId){
  const guide=GUIDE_BY_SYSTEM[systemId]||GUIDE_BY_SYSTEM.civweave;
  const systemPrompt=`You are ${guide.name}, Civweave’s ${guide.role}. ${guide.prompt}\n\nYou receive structured context produced by the application. Treat routing as evidence, not unquestionable truth. Return JSON only and satisfy the response contract. Do not claim that an action happened unless the context says it already happened. When requiresConsent is true, explain the proposed action but do not execute it.`;
  return [
    {role:'system',content:systemPrompt},
    {role:'user',content:`Structured context:\n${JSON.stringify(context)}\n\nRespond as JSON matching civweave.guide-choice.v1.`}
  ];
}

function parseModelOutput(output,context){
  let value=output;
  if(typeof value==='string'){
    const cleaned=value.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
    value=parse(cleaned,null);
    if(!value){
      return {
        answer:cleaned||'I could not form a complete answer from the available local context.',
        choice:{mode:context.routingAnswer.mode,system:context.routingAnswer.system,room:context.routingAnswer.room,nextAction:'Clarify the smallest visible result that would prove progress.'},
        assumptions:['The model returned plain text instead of the requested structured response.'],
        requiresConsent:Boolean(context.consent?.consequentialActionDetected),
        confidence:Math.min(.45,Number(context.routingAnswer.confidence||.4))
      };
    }
  }
  if(!value||typeof value!=='object')throw new Error('The selected model did not return a usable response.');
  const choice=value.choice&&typeof value.choice==='object'?value.choice:{};
  const fallback=context.routingAnswer;
  return {
    answer:String(value.answer||value.text||value.message||'').trim()||'I need one more concrete detail before I can offer a useful next step.',
    choice:{
      mode:String(choice.mode||fallback.mode),
      system:SYSTEM_IDS.includes(choice.system)?choice.system:fallback.system,
      room:String(choice.room||fallback.room),
      nextAction:String(choice.nextAction||'Clarify the smallest visible result that would prove progress.')
    },
    assumptions:normalizeArray(value.assumptions).map(String).slice(0,8),
    requiresConsent:Boolean(value.requiresConsent||context.consent?.consequentialActionDetected),
    confidence:Number.isFinite(Number(value.confidence))?Number(value.confidence):fallback.confidence
  };
}

async function respond({text,systemId=pathSystem(),guideName,history=[]}){
  const guide=GUIDE_BY_SYSTEM[systemId]||GUIDE_BY_SYSTEM.civweave;
  const context=await compileContext({text,systemId,guideName:guideName||guide.name,history});
  const modelRuntime=runtime();
  if(!modelRuntime?.generate)throw new Error('The shared model runtime has not loaded.');
  const config=selectedConfig();
  const result=await modelRuntime.generate({purpose:'civweave-guide-response',executionProfile:'interactive',config,messages:prompts(context,systemId),schema:RESPONSE_SCHEMA,maxRepairAttempts:1});
  if(!['success','fallback'].includes(result?.status))throw Object.assign(new Error(result?.error?.message||`The model request ended with ${result?.status||'an unknown status'}.`),{code:result?.error?.code,result});
  const response=parseModelOutput(result.outputJson||result.outputText,context);
  const fallbackUsed=result.status==='fallback'||Boolean(result.fallback?.used);
  report('answered',{selectedProvider:config.provider,actualProvider:result.actual?.provider||config.provider,model:result.actual?.model||config.model,fallbackUsed,route:response.choice,requiresConsent:response.requiresConsent});
  return {response,provider:result.actual?.provider||config.provider,model:result.actual?.model||config.model,diagnostics:result.diagnostics||[],context,fallbackFrom:fallbackUsed?{provider:config.provider,reason:result.fallback?.reason||'The selected provider did not complete the call.'}:null};
}

function storageForDialog(node){
  if(node.id==='cw127-chat')return CHAT_KEY;
  return `civweave.guide-chat.${pathSystem()}.v128`;
}

function initialFor(node,systemId){
  const guide=GUIDE_BY_SYSTEM[systemId]||GUIDE_BY_SYSTEM.civweave;
  return node.id==='cw127-chat'
    ?'I’m here. Tell me what you want to move toward. Your chosen AI gets the structured context first, and SmolLM2 stands underneath it as the onboard fallback.'
    :`I’m ${guide.name}, your ${guide.role}. What needs attention here?`;
}

function renderLog(node,key,systemId){
  const log=node.querySelector('.cw127-chat-log');
  if(!log)return;
  const stored=parse(localStorage.getItem(key),[]);
  const items=Array.isArray(stored)?stored:[];
  const visible=items.length?items:[{role:'assistant',text:initialFor(node,systemId)}];
  log.innerHTML=visible.map(item=>`<p class="${item.role==='user'?'user':'assistant'}${item.pending?' cw-ai-pending':''}">${esc(item.text)}</p>`).join('');
  log.scrollTop=log.scrollHeight;
}

async function handleSubmit(event,form,node){
  event.preventDefault();
  event.stopImmediatePropagation();
  const input=form.querySelector('textarea,input[type="text"]');
  const text=input?.value.trim();
  if(!text)return;
  const systemId=node.id==='cw127-chat'?'civweave':pathSystem();
  const guide=GUIDE_BY_SYSTEM[systemId]||GUIDE_BY_SYSTEM.civweave;
  const key=storageForDialog(node);
  const stored=parse(localStorage.getItem(key),[]);
  const items=Array.isArray(stored)?stored:[];
  const pendingId=`pending-${Date.now().toString(36)}`;
  items.push({role:'user',text,time:new Date().toISOString()},{role:'assistant',text:`${guide.name} is consulting the selected AI…`,time:new Date().toISOString(),pending:true,id:pendingId});
  localStorage.setItem(key,JSON.stringify(items.slice(-80)));
  input.value='';
  renderLog(node,key,systemId);
  const submit=form.querySelector('button[type="submit"],button:not([type])');
  if(submit)submit.disabled=true;
  try{
    const result=await respond({text,systemId,guideName:guide.name,history:items.filter(item=>!item.pending)});
    const current=parse(localStorage.getItem(key),[]);
    const list=Array.isArray(current)?current:[];
    const index=list.findIndex(item=>item.id===pendingId);
    const response=result.response;
    const next=response.choice.nextAction?`\n\nNext: ${response.choice.nextAction}`:'';
    const consent=response.requiresConsent?'\n\nThis next action waits for your explicit approval.':'';
    const fallback=result.fallbackFrom?`\n\nOnboard fallback: SmolLM2 answered locally because ${result.fallbackFrom.provider} did not complete the call.`:'';
    const replacement={role:'assistant',text:`${response.answer}${next}${consent}${fallback}`.trim(),time:new Date().toISOString(),provider:result.provider,model:result.model,choice:response.choice,assumptions:response.assumptions,requiresConsent:response.requiresConsent};
    if(index>=0)list[index]=replacement;else list.push(replacement);
    localStorage.setItem(key,JSON.stringify(list.slice(-80)));
  }catch(error){
    const current=parse(localStorage.getItem(key),[]);
    const list=Array.isArray(current)?current:[];
    const index=list.findIndex(item=>item.id===pendingId);
    const replacement={role:'assistant',text:`No model completed this call. ${error.message}`,time:new Date().toISOString(),error:true};
    if(index>=0)list[index]=replacement;else list.push(replacement);
    localStorage.setItem(key,JSON.stringify(list.slice(-80)));
    report('answer-failed',{systemId,provider:selectedConfig().provider,message:error.message,code:error.code||null});
  }finally{
    if(submit)submit.disabled=false;
    renderLog(node,key,systemId);
  }
}

function attach(node){
  if(!node||node.dataset.smollm2AssistantAttached==='true')return;
  const form=node.querySelector('.cw127-chat-form,form');
  const log=node.querySelector('.cw127-chat-log');
  if(!form||!log)return;
  node.dataset.smollm2AssistantAttached='true';
  const systemId=node.id==='cw127-chat'?'civweave':pathSystem();
  renderLog(node,storageForDialog(node),systemId);
  form.addEventListener('submit',event=>handleSubmit(event,form,node),true);
}

function scan(){
  for(const node of document.querySelectorAll('dialog')){
    if(node.id==='cw127-chat'||node.querySelector('.cw127-chat-log'))attach(node);
  }
}

const observer=new MutationObserver(scan);
observer.observe(document.documentElement,{childList:true,subtree:true});
addEventListener('DOMContentLoaded',scan,{once:true});
globalThis.CivweaveAssistantV134={respond,compileContext,selectedConfig,model:MODEL_ID};
})();
