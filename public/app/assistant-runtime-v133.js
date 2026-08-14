(()=>{
'use strict';
const SETTINGS_KEY='civweave.universal-ai.v127';
const CHAT_KEY='civweave.weaveling-chat.v127';
const MODEL_ID='HuggingFaceTB/SmolLM2-360M-Instruct';
const VERSION='1.0.31-guide-prompts-v135';
const SYSTEM_IDS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];

const SHARED_GUIDE_PROMPT=`You are one of Civweave's five resident AI guides. Civweave helps people turn intentions into learning, skilled work, access to resources, and collective decisions while preserving user agency.

Talk to the person naturally. Answer the actual request instead of classifying it, announcing a route, or forcing every answer into a workflow. Be concise enough for a small local model, but give enough substance to be genuinely useful. Warmth is welcome; canned reassurance is not.

Never repeat a sentence, compliment, phrase, or idea merely to fill space. If you notice repetition beginning, stop and state the useful answer once. Treat earlier assistant wording as conversation history, never as wording you must imitate or repeat.

Do not invent current facts, tool access, files, accounts, actions, availability, or certainty. Do what you can directly. If an answer genuinely depends on fresh information, tools, specialist capability, or reasoning you cannot reliably provide, say what is missing in ordinary language and suggest involving the appropriate Civweave capability or a stronger model. Do not output routing labels or internal classifications.

Stay lightly in character, but usefulness outranks mascot performance. You may suggest another Civweave guide when their specialty would clearly help, but never force a transfer. Never claim that a consequential action happened unless the application confirms it.`;

const GUIDE_BY_SYSTEM=Object.freeze({
  civweave:Object.freeze({
    name:'Weaveling',
    role:'general guide and cross-realm coordinator',
    focus:`You are Weaveling. You are the broadest Civweave guide and the connective tissue between the other four realms. Help people clarify what they want, think through ordinary questions, brainstorm, plan, reflect, and connect learning, work, resources, and governance when several matter at once. Prefer coherent next steps over bureaucracy. Do not treat every message as a routing problem. If a specialist would add real value, mention them naturally: Moss for learning, Kamiya for building and skilled work, Rook for resources and exchange, or Merlin for governance and collective decisions.`
  }),
  'living-school':Object.freeze({
    name:'Moss',
    role:'Living School learning guide',
    focus:`You are Moss, the Living School guide. Help people learn, understand, practice, teach, research, and build durable skills. Explain ideas at the learner's current level, expose the important structure without unnecessary jargon, and use examples when they help. When useful, turn confusion into a small progression of explanation, practice, reflection, and evidence of mastery. Do not turn every conversation into a lesson plan, quiz, credential, or assessment. Curiosity comes before paperwork.`
  }),
  cerbanimo:Object.freeze({
    name:'Kamiya',
    role:'Cerbanimo maker and skilled-work guide',
    focus:`You are Kamiya, the Cerbanimo guide for making things and doing skilled work. Help with projects, design, code, debugging, repair, implementation, planning, collaboration, and getting work across the finish line. Favor concrete decisions, tradeoffs, sequences, tests, and shippable next steps. Break large work down when that makes it easier to execute, but do not mechanically turn every request into quests or checkpoints. Never bluff technical specifics; state uncertainty and ask for or seek the missing evidence when precision matters.`
  }),
  fellowfare:Object.freeze({
    name:'Rook',
    role:'FellowFare resources and mutual-aid guide',
    focus:`You are Rook, the FellowFare guide for resources, needs, offers, exchange, and mutual aid. Help people figure out what they need, what they can offer, what could be borrowed, shared, traded, bought, sold, delivered, or coordinated, and what constraints matter. Keep trust, consent, privacy, accessibility, logistics, and fairness visible without making ordinary human cooperation sound like a transaction ledger. Never imply that an item, person, price, payment method, or resource is available unless the application or user has actually established that.`
  }),
  anarchadia:Object.freeze({
    name:'Merlin',
    role:'Anarchadia civic and governance guide',
    focus:`You are Merlin, the Anarchadia guide for governance and collective decisions. Help with proposals, consent, policy, rights, moderation, disagreement, appeals, civic process, community rules, and collective automation. Separate facts from values, make uncertainty visible, surface meaningful tradeoffs and affected parties, and help turn disagreement into a workable decision process. Do not pretend consensus exists, do not manufacture authority, and do not push the user toward a political conclusion. Consequential civic actions require explicit consent.`
  })
});

const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normalizeArray=value=>Array.isArray(value)?value:[];
const runtime=()=>globalThis.CivweaveModelRuntime||null;
let ledgerPromise=null;

function report(kind,detail={}){
  try{fetch('/api/boot-log',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({schema:'civweave.boot-log.v1',time:new Date().toISOString(),version:VERSION,build:'guide-prompts-v135',kind:`assistant-v135:${kind}`,url:location.href,detail}),keepalive:true,cache:'no-store'}).catch(()=>{})}catch{}
}

function pathSystem(){
  const parts=location.pathname.split('/').filter(Boolean);
  const index=parts.indexOf('realm');
  return index>=0&&SYSTEM_IDS.includes(parts[index+1])?parts[index+1]:'civweave';
}

function providerName(value){
  const provider=String(value||'bundled').toLowerCase();
  if(['deterministic','browser','packaged','bundled','smollm2','functiongemma'].includes(provider))return 'bundled';
  if(['downloaded-local','generative-local','qwen','smollm3'].includes(provider))return provider;
  if(['openai','compatible','openai-compatible'].includes(provider))return 'openai-compatible';
  if(provider==='local-api')return 'ollama';
  return ['gemini','ollama','openai-compatible','hosted','server-auto'].includes(provider)?provider:'bundled';
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

function consequentialAction(text){
  return /\b(send|spend|transfer|publish|submit|approve|vote|delete|invite|assign|purchase|order|deploy|federate)\b/i.test(String(text||''));
}

async function compileContext({text,systemId,guideName,history}){
  const environment=await currentEnvironment(systemId);
  return {
    schema:'civweave.conversation-context.v2',
    userMessage:String(text||''),
    currentContext:environment,
    guide:{name:guideName,system:systemId},
    recentConversation:normalizeArray(history).filter(item=>!item?.pending).slice(-6).map(item=>({role:item.role==='assistant'?'assistant':'user',text:String(item.text||'').slice(0,1200)})),
    consent:{consequentialActionDetected:consequentialAction(text),rule:'Drafting and discussion may be automatic. Spending, transferring, publishing, submitting, voting, deleting, assigning, purchasing, deploying, or federating requires affirmative consent.'}
  };
}

function guideSystemPrompt(systemId,environment={}){
  const guide=GUIDE_BY_SYSTEM[systemId]||GUIDE_BY_SYSTEM.civweave;
  const place=environment.roomLabel&&environment.roomLabel!=='The Quad'?` You are currently speaking from ${environment.roomLabel}.`:'';
  return `${SHARED_GUIDE_PROMPT}\n\n${guide.focus}${place}`;
}

function prompts(context,systemId){
  const messages=[{role:'system',content:guideSystemPrompt(systemId,context.currentContext)}];
  for(const item of context.recentConversation){
    messages.push({role:item.role,content:item.text});
  }
  const last=messages[messages.length-1];
  if(!(last?.role==='user'&&last.content===context.userMessage))messages.push({role:'user',content:context.userMessage});
  return messages;
}

function parseModelOutput(output,context){
  let answer='';
  if(typeof output==='string')answer=output;
  else if(output&&typeof output==='object')answer=String(output.answer||output.text||output.message||'');
  answer=answer.replace(/<think>[\s\S]*?<\/think>/gi,'').replace(/^```(?:text|markdown)?\s*/i,'').replace(/\s*```$/,'').trim();
  if(!answer)answer='I could not form a useful answer from the available context.';
  return {
    answer,
    choice:{mode:'Conversation',system:context.guide.system,room:context.currentContext.roomId,nextAction:''},
    assumptions:[],
    requiresConsent:Boolean(context.consent?.consequentialActionDetected),
    confidence:null
  };
}

async function respond({text,systemId=pathSystem(),guideName,history=[]}){
  systemId=SYSTEM_IDS.includes(systemId)?systemId:'civweave';
  const guide=GUIDE_BY_SYSTEM[systemId]||GUIDE_BY_SYSTEM.civweave;
  const context=await compileContext({text,systemId,guideName:guideName||guide.name,history});
  const modelRuntime=runtime();
  if(!modelRuntime?.generate)throw new Error('The shared model runtime has not loaded.');
  const config=selectedConfig();
  const result=await modelRuntime.generate({
    purpose:`civweave-guide-chat:${systemId}`,
    executionProfile:'interactive',
    systemId,
    realm:systemId,
    config,
    messages:prompts(context,systemId),
    maxRepairAttempts:0
  });
  if(!['success','fallback'].includes(result?.status))throw Object.assign(new Error(result?.error?.message||`The model request ended with ${result?.status||'an unknown status'}.`),{code:result?.error?.code,result});
  const response=parseModelOutput(result.outputText||result.outputJson,context);
  const fallbackUsed=result.status==='fallback'||Boolean(result.fallback?.used);
  report('answered',{systemId,guide:guide.name,selectedProvider:config.provider,actualProvider:result.actual?.provider||config.provider,model:result.actual?.model||config.model,fallbackUsed,requiresConsent:response.requiresConsent});
  return {response,provider:result.actual?.provider||config.provider,model:result.actual?.model||config.model,diagnostics:result.diagnostics||[],context,fallbackFrom:fallbackUsed?{provider:config.provider,reason:result.fallback?.reason||'The selected provider did not complete the call.'}:null};
}

function storageForDialog(node){
  if(node.id==='cw127-chat')return CHAT_KEY;
  return `civweave.guide-chat.${pathSystem()}.v128`;
}

function initialFor(node,systemId){
  const guide=GUIDE_BY_SYSTEM[systemId]||GUIDE_BY_SYSTEM.civweave;
  return node.id==='cw127-chat'
    ?'I’m here. Tell me what you want to work through.'
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
  items.push({role:'user',text,time:new Date().toISOString()},{role:'assistant',text:`${guide.name} is thinking…`,time:new Date().toISOString(),pending:true,id:pendingId});
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
    const consent=response.requiresConsent?'\n\nI can discuss or draft this now, but the consequential action itself waits for your explicit approval.':'';
    const fallback=result.fallbackFrom?`\n\nLocal fallback: another available model answered because ${result.fallbackFrom.provider} did not complete the call.`:'';
    const replacement={role:'assistant',text:`${response.answer}${consent}${fallback}`.trim(),time:new Date().toISOString(),provider:result.provider,model:result.model,choice:response.choice,assumptions:response.assumptions,requiresConsent:response.requiresConsent};
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
globalThis.CivweaveAssistantV134={version:VERSION,respond,compileContext,guideSystemPrompt,prompts,guides:GUIDE_BY_SYSTEM,selectedConfig,model:MODEL_ID};
})();