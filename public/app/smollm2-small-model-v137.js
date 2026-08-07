(()=>{
'use strict';

const MODEL_ID='HuggingFaceTB/SmolLM2-360M-Instruct';
const MODEL_ADAPTER='/app/models/smollm2-360m-instruct/adapter.js';
const CONTRACT_MARKER='CIVWEAVE_SMALL_MODEL_CONTRACT_V2';
const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const MODES={
  'civweave':'Reflect',
  'living-school':'Learn',
  'cerbanimo':'Build',
  'fellowfare':'Acquire',
  'anarchadia':'Govern'
};
const LABELS={
  'civweave':'Civweave',
  'living-school':'Living School',
  'cerbanimo':'Cerbanimo',
  'fellowfare':'FellowFare',
  'anarchadia':'Anarchadia'
};
const GUIDE_NAMES={
  'civweave':'Weaveling',
  'living-school':'Moss',
  'cerbanimo':'Kamiya',
  'fellowfare':'Rook',
  'anarchadia':'Merlin'
};
const GUIDE_FOCUS={
  'civweave':'reflect, prioritize, coordinate multiple paths, and name the next concrete move',
  'living-school':'explain, sequence practice, and define evidence of learning',
  'cerbanimo':'turn the work into a concrete build step, checkpoint, and proof of completion',
  'fellowfare':'clarify the resource need, exchange terms, logistics, and trust boundary',
  'anarchadia':'clarify the proposal, consent boundary, decision process, and next civic step'
};
const ROUTE_CODES={A:'anarchadia',B:'cerbanimo',C:'civweave',D:'fellowfare',E:'living-school'};
const SYSTEM_CODES=Object.fromEntries(Object.entries(ROUTE_CODES).map(([code,system])=>[system,code]));
const SYSTEM_ALIASES={
  'civweave':['civweave','weaveling','reflect','reflection','orchestrate','orchestration','prioritize','priority','plan','planning','coordinate'],
  'living-school':['living-school','living school','learn','learning','study','school','curriculum','lesson','research','practice','moss'],
  'cerbanimo':['cerbanimo','build','building','make','making','repair','implement','implementation','work','skilled labor','quest','kamiya'],
  'fellowfare':['fellowfare','fellow fare','acquire','acquisition','trade','exchange','resource','material','borrow','buy','sell','rook'],
  'anarchadia':['anarchadia','govern','governance','proposal','policy','vote','voting','civic','collective decision','assembly','merlin']
};

let adapterPromise=null;

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[char]));

function isObject(value){
  return Boolean(value&&typeof value==='object'&&!Array.isArray(value));
}

function safeString(value,max=1000){
  return String(value==null?'':value).trim().slice(0,max);
}

function canonicalSystem(value){
  const raw=safeString(value,160).toLowerCase().replace(/[_/]+/g,' ').replace(/\s+/g,' ').trim();
  if(!raw)return '';
  if(SYSTEMS.includes(raw))return raw;
  for(const [system,aliases] of Object.entries(SYSTEM_ALIASES)){
    if(aliases.some(alias=>raw===alias||raw.includes(alias)))return system;
  }
  return '';
}

function canonicalMode(value,system=''){
  const raw=safeString(value,100).toLowerCase();
  if(/learn|study|practice|research|teach/.test(raw))return 'Learn';
  if(/build|make|repair|implement|work|quest/.test(raw))return 'Build';
  if(/acquire|trade|exchange|borrow|buy|sell|material|resource/.test(raw))return 'Acquire';
  if(/govern|vote|proposal|policy|civic|assembly/.test(raw))return 'Govern';
  if(/reflect|plan|priorit|coordinate|orchestrat/.test(raw))return 'Reflect';
  return MODES[system]||'';
}

function extractJsonText(text){
  const source=safeString(text,200000).replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  if(!source)return '';
  try{JSON.parse(source);return source}catch{}
  const starts=[];
  for(let index=0;index<source.length;index+=1){
    if(source[index]==='{'||source[index]==='[')starts.push(index);
  }
  for(const start of starts){
    const open=source[start];
    const close=open==='{'?'}':']';
    let depth=0,quoted=false,escaped=false;
    for(let index=start;index<source.length;index+=1){
      const char=source[index];
      if(quoted){
        if(escaped)escaped=false;
        else if(char==='\\')escaped=true;
        else if(char==='"')quoted=false;
        continue;
      }
      if(char==='"'){quoted=true;continue}
      if(char===open)depth+=1;
      if(char===close){
        depth-=1;
        if(depth===0){
          const candidate=source.slice(start,index+1);
          try{JSON.parse(candidate);return candidate}catch{break}
        }
      }
    }
  }
  return '';
}

function parseJsonValue(value){
  if(isObject(value)||Array.isArray(value))return value;
  const json=extractJsonText(value);
  if(!json)return null;
  try{return JSON.parse(json)}catch{return null}
}

function isSchemaEcho(value){
  if(!isObject(value))return false;
  const keys=Object.keys(value);
  return Boolean(
    (value.type==='object'||value.type==='array')
    && (isObject(value.properties)||Array.isArray(value.required)||value.items)
    && !('answer' in value)
    && !('nextAction' in value)
  ) || (keys.length<=4&&keys.includes('properties')&&keys.includes('required'));
}

function nestedCandidates(value,maxDepth=4){
  const output=[];
  const seen=new Set();
  function visit(node,depth,path){
    if(depth>maxDepth||node==null||seen.has(node))return;
    if(typeof node==='object')seen.add(node);
    output.push({node,path});
    if(Array.isArray(node)){
      node.slice(0,8).forEach((item,index)=>visit(item,depth+1,`${path}[${index}]`));
      return;
    }
    if(!isObject(node))return;
    const preferred=['choice','route','routing','destination','result','response','output','answer','data','value','selection'];
    for(const key of preferred){
      if(key in node)visit(node[key],depth+1,path?`${path}.${key}`:key);
    }
    for(const [key,item] of Object.entries(node)){
      if(preferred.includes(key))continue;
      if(isObject(item)||Array.isArray(item))visit(item,depth+1,path?`${path}.${key}`:key);
    }
  }
  visit(value,0,'root');
  return output;
}

function firstString(value,keys){
  for(const {node} of nestedCandidates(value)){
    if(typeof node==='string'&&keys.includes('$self'))return safeString(node);
    if(!isObject(node))continue;
    for(const key of keys){
      if(key==='$self')continue;
      if(typeof node[key]==='string'&&node[key].trim())return safeString(node[key]);
    }
  }
  return '';
}

function findStructuredContext(messages){
  for(const item of (Array.isArray(messages)?messages:[]).slice().reverse()){
    const text=safeString(item?.content??item?.text,60000);
    if(!text)continue;
    const marker='Structured context:';
    const markerIndex=text.indexOf(marker);
    const source=markerIndex>=0?text.slice(markerIndex+marker.length):text;
    const parsed=parseJsonValue(source);
    if(isObject(parsed)&&isObject(parsed.routingAnswer))return parsed;
    if(isObject(parsed)&&isObject(parsed.fallbackExpectation)&&Array.isArray(parsed.conversation)){
      for(const turn of parsed.conversation.slice().reverse()){
        const nested=findStructuredContext([{content:turn.content??turn.text}]);
        if(nested)return nested;
      }
    }
  }
  return null;
}

function parseRouteCode(text){
  const source=safeString(text,120).toUpperCase();
  const first=source.match(/^\s*([A-E])\b/);
  if(first)return {code:first[1],system:ROUTE_CODES[first[1]],raw:source};
  const isolated=source.match(/\b([A-E])\b/);
  if(isolated)return {code:isolated[1],system:ROUTE_CODES[isolated[1]],raw:source};
  const system=canonicalSystem(source);
  return {code:SYSTEM_CODES[system]||'',system,raw:source};
}

function normalizeAction(value){
  const parsed=parseJsonValue(value);
  if(parsed&&isSchemaEcho(parsed))return {parsed,usable:false,schemaEcho:true,nextAction:'',answer:'',shape:Object.keys(parsed).join(', ')};
  const nextAction=firstString(parsed,['nextAction','next_action','nextStep','next_step','step','action','recommendation']);
  const answer=firstString(parsed,['answer','message','text','summary']);
  if(parsed&&(nextAction||answer)){
    return {
      parsed,
      usable:true,
      schemaEcho:false,
      nextAction:nextAction||answer,
      answer:answer||nextAction,
      shape:Array.isArray(parsed)?`array(${parsed.length})`:Object.keys(parsed).join(', ')
    };
  }
  const plain=safeString(value,600);
  return {parsed,usable:false,schemaEcho:false,nextAction:'',answer:plain,shape:parsed?(Array.isArray(parsed)?`array(${parsed.length})`:Object.keys(parsed).join(', ')):'not-json'};
}

function compactGuideRequest(request){
  const context=findStructuredContext(request?.messages);
  const lockedSystem=canonicalSystem(context?.routingAnswer?.system)||'civweave';
  const guide=GUIDE_NAMES[lockedSystem];
  const userMessage=safeString(context?.userMessage||'',3000);
  const room=safeString(context?.currentContext?.roomLabel||context?.currentContext?.roomId||'',240);
  const recent=(Array.isArray(context?.recentConversation)?context.recentConversation:[])
    .slice(-4)
    .map(item=>({role:item.role,text:safeString(item.text,500)}));
  const requiresConsent=Boolean(context?.consent?.consequentialActionDetected);
  const systemPrompt=`${CONTRACT_MARKER}\nYou are ${guide}, Civweave's local onboard guide for ${LABELS[lockedSystem]}.\nThe route is LOCKED to ${lockedSystem}. Do not choose or mention a different realm.\nYour job is to ${GUIDE_FOCUS[lockedSystem]}.\nReturn exactly one JSON object with these keys and no others:\n{"answer":"brief useful answer","nextAction":"one concrete imperative step","assumptions":[],"requiresConsent":false}\nUse only supplied context. Never claim network access, tool use, purchases, votes, messages, deployments, or writes occurred. If evidence is incomplete, say so briefly.`;
  const userPayload={request:userMessage,currentRoom:room,recentConversation:recent,requiresConsent};
  return {
    ...request,
    schema:null,
    maxTokens:Math.min(120,Number(request?.maxTokens||request?.config?.maxTokens||120)),
    config:{...(request?.config||{}),maxTokens:120},
    messages:[
      {role:'system',content:systemPrompt},
      {role:'user',content:JSON.stringify(userPayload)}
    ],
    __civweaveLockedSystem:lockedSystem,
    __civweaveOriginalContext:context
  };
}

function normalizeGuideResult(result,request){
  const actual=String(result?.actual?.provider||'').toLowerCase();
  if(!result||!['bundled-smollm2','bundled','smollm2'].includes(actual))return result;
  if(request?.purpose!=='civweave-guide-response'&&!request?.schema)return result;
  const context=request?.__civweaveOriginalContext||findStructuredContext(request?.messages);
  const contextSystem=canonicalSystem(request?.__civweaveLockedSystem||context?.routingAnswer?.system)||'civweave';
  const parsed=parseJsonValue(result.outputJson??result.outputText);
  const action=normalizeAction(result.outputJson??result.outputText);
  const modelSystem=canonicalSystem(firstString(parsed,['system','realm','destination','target']));
  const assumptions=Array.isArray(parsed?.assumptions)
    ?parsed.assumptions.map(item=>safeString(item,240)).filter(Boolean).slice(0,7)
    :[];
  if(modelSystem&&modelSystem!==contextSystem){
    assumptions.unshift(`The local model suggested ${LABELS[modelSystem]}, but Civweave kept the canonical route locked to ${LABELS[contextSystem]}.`);
  }
  if(action.schemaEcho){
    assumptions.unshift('The local model echoed a schema; Civweave recovered a bounded response from the supplied route context.');
  }
  const answer=action.answer
    ||`The route is ${LABELS[contextSystem]}. I do not have enough local evidence for a more specific answer yet.`;
  const nextAction=action.nextAction
    ||`Open ${LABELS[contextSystem]} and name the smallest visible result that would prove progress.`;
  const normalized={
    answer,
    choice:{
      mode:MODES[contextSystem],
      system:contextSystem,
      room:safeString(context?.routingAnswer?.room||context?.currentContext?.roomId,200),
      nextAction
    },
    assumptions:assumptions.slice(0,8),
    requiresConsent:Boolean(parsed?.requiresConsent??parsed?.requires_consent??context?.consent?.consequentialActionDetected),
    confidence:Number.isFinite(Number(parsed?.confidence))?Number(parsed.confidence):Number(context?.routingAnswer?.confidence||0.55)
  };
  return {
    ...result,
    outputJson:normalized,
    outputText:JSON.stringify(normalized),
    structured:{
      ...(result.structured||{}),
      requested:true,
      valid:true,
      normalizedBy:'civweave-small-model-contract-v2',
      routeLocked:true,
      lockedSystem:contextSystem,
      sourceShape:action.shape,
      schemaEchoRecovered:action.schemaEcho
    },
    diagnostics:[
      ...(Array.isArray(result.diagnostics)?result.diagnostics:[]),
      `SmolLM2 response normalized under a locked ${LABELS[contextSystem]} route.`
    ]
  };
}

function installRuntimeWrapper(){
  const runtime=globalThis.CivweaveModelRuntime;
  if(!runtime?.generate||runtime.__smallModelContractV137)return false;
  const previous=runtime.generate.bind(runtime);
  const wrapped=async request=>{
    const incoming=request||{};
    const provider=String(incoming.config?.provider||incoming.config?.route||'').toLowerCase();
    const bundled=['bundled','packaged','smollm2','smollm2-360m-instruct','huggingfacetb/smollm2-360m-instruct'].includes(provider);
    let prepared=incoming;
    if(bundled&&incoming.purpose==='civweave-guide-response'){
      prepared=compactGuideRequest(incoming);
    }else if(bundled){
      const messages=Array.isArray(incoming.messages)?incoming.messages:[];
      if(!messages.some(item=>String(item?.content||'').includes(CONTRACT_MARKER))){
        prepared={
          ...incoming,
          messages:[
            {role:'system',content:`${CONTRACT_MARKER}\nComplete the requested task. When JSON is requested, return the JSON value itself, not JSON Schema. Never echo keys named type, properties, or required unless the user explicitly requested a schema.`},
            ...messages
          ]
        };
      }
    }
    const result=await previous(prepared);
    return normalizeGuideResult(result,prepared);
  };
  globalThis.CivweaveModelRuntime={...runtime,generate:wrapped,__smallModelContractV137:true};
  return true;
}

async function adapter(){
  if(!adapterPromise)adapterPromise=import(MODEL_ADAPTER).catch(error=>{adapterPromise=null;throw error});
  return adapterPromise;
}

function classifierPrompt(text,order){
  const definitions={
    A:'Anarchadia: shared proposals, policy, approval, voting, or collective rules',
    B:'Cerbanimo: make, repair, implement, build, or other skilled work',
    C:'Civweave: prioritize, coordinate, reflect, or choose among multiple projects',
    D:'FellowFare: obtain, borrow, trade, sell, or exchange physical resources',
    E:'Living School: learn, study, research, explain, or practice knowledge'
  };
  return `${CONTRACT_MARKER}\nYou are a five-way switch. Read the request and output exactly one capital letter. No punctuation and no explanation.\n${order.map(code=>`${code} = ${definitions[code]}`).join('\n')}\nPriority rules: policy or voting beats everything; physical resource exchange beats building; repair or implementation beats learning; learning beats reflection; reflection is for prioritizing or coordinating multiple paths.\nREQUEST: ${text}\nLETTER:`;
}

function actionPrompt(text,system){
  return `${CONTRACT_MARKER}\nThe route is locked to ${LABELS[system]}. Do not choose another realm.\nFocus: ${GUIDE_FOCUS[system]}.\nReturn exactly one compact JSON object and no markdown:\n{"nextAction":"one imperative sentence under 18 words"}\nREQUEST: ${text}\nJSON:`;
}

function benchmarkCases(){
  return [
    {id:'learning',text:'I want to understand local watershed testing and practice reading the results.',expected:'living-school',order:['A','D','E','C','B']},
    {id:'build',text:'Help me repair a broken community greenhouse vent and prove the work is complete.',expected:'cerbanimo',order:['C','E','D','B','A']},
    {id:'exchange',text:'We need twelve reclaimed boards and a way to borrow a trailer fairly.',expected:'fellowfare',order:['E','D','A','B','C']},
    {id:'governance',text:'Draft a proposal for how the neighborhood approves shared tool purchases.',expected:'anarchadia',order:['D','B','C','E','A']},
    {id:'reflection',text:'I have too many projects and need to decide what deserves attention first.',expected:'civweave',order:['C','A','B','D','E']}
  ];
}

function report(kind,detail={}){
  try{
    fetch('/api/boot-log',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        schema:'civweave.boot-log.v1',
        time:new Date().toISOString(),
        version:'1.0.30',
        build:'smollm2-route-lock-v137',
        kind:`smollm2-v137:${kind}`,
        url:location.href,
        detail
      }),
      keepalive:true,
      cache:'no-store'
    }).catch(()=>{});
  }catch{}
}

async function runBenchmark(form,button){
  const output=form.querySelector('[data-benchmark-output]');
  const status=form.querySelector('[data-route-panel="bundled"] [data-test-status]');
  if(!output||!status)return;
  button.disabled=true;
  output.hidden=false;
  output.innerHTML='<b>SmolLM2 two-stage trial starting…</b><p>Each request gets a tiny realm selector, then a route-locked action prompt.</p>';
  status.textContent='Running the realm selector and bounded guide prompts…';
  status.className='cw-ai-test-status';
  const startedAt=performance.now();
  try{
    const engine=await adapter();
    const availability=await engine.status();
    if(!availability.available)throw new Error(`The package is incomplete: ${availability.missing.map(item=>item.url).join(', ')}`);
    const cases=benchmarkCases();
    let routeCorrect=0,structuredActions=0;
    const rows=[];
    const telemetry=[];
    for(const spec of cases){
      const routeStarted=performance.now();
      let routeResult,routeError=null;
      try{
        routeResult=await engine.generate({
          messages:[{role:'user',content:classifierPrompt(spec.text,spec.order)}],
          maxNewTokens:4,
          timeoutMs:120000
        });
      }catch(error){routeError=error}
      const routeMs=Math.round(performance.now()-routeStarted);
      const selected=routeError?{code:'',system:'',raw:''}:parseRouteCode(routeResult.text);
      const routePass=selected.system===spec.expected;
      if(routePass)routeCorrect+=1;

      const actionStarted=performance.now();
      let actionResult,actionError=null;
      try{
        actionResult=await engine.generate({
          messages:[{role:'user',content:actionPrompt(spec.text,spec.expected)}],
          maxNewTokens:36,
          timeoutMs:120000
        });
      }catch(error){actionError=error}
      const actionMs=Math.round(performance.now()-actionStarted);
      const action=actionError?{usable:false,nextAction:'',shape:'generation-failed',schemaEcho:false}:normalizeAction(actionResult.text);
      if(action.usable)structuredActions+=1;
      const routeLabel=selected.system?LABELS[selected.system]:'unrecognized';
      const expectedText=routePass?'':` · expected ${LABELS[spec.expected]}`;
      const actionText=action.usable
        ?`<small>${esc(action.nextAction)}</small>`
        :`<small>action ${action.schemaEcho?'schema echo':action.shape}${actionError?`: ${esc(actionError.message)}`:''}</small>`;
      rows.push(`<li class="${routePass&&action.usable?'is-pass':'is-fail'}"><b>${esc(spec.id)}</b>: ${esc(routeLabel)}${expectedText} · selector ${routeMs} ms · action ${actionMs} ms · ${esc(routeResult?.device||actionResult?.device||'unknown')}${actionText}</li>`);
      telemetry.push({
        id:spec.id,
        expected:spec.expected,
        selected:selected.system||null,
        routeCode:selected.code||null,
        routeRaw:safeString(routeResult?.text||routeError?.message,160),
        routePass,
        routeMs,
        actionStructured:action.usable,
        actionShape:action.shape,
        actionMs,
        device:routeResult?.device||actionResult?.device||null
      });
    }
    const elapsedMs=Math.round(performance.now()-startedAt);
    output.innerHTML=`<b>${routeCorrect}/${cases.length} realm selections correct · ${structuredActions}/${cases.length} bounded actions structured</b><p>Total trial time: ${(elapsedMs/1000).toFixed(1)} seconds. Production guide responses use the canonical Civweave route lock even when the selector probe misses.</p><ol>${rows.join('')}</ol>`;
    status.textContent=`Trial complete: ${routeCorrect}/${cases.length} realm selections correct and ${structuredActions}/${cases.length} route-locked actions structured.`;
    status.className=`cw-ai-test-status ${routeCorrect>=4&&structuredActions>=4?'is-ok':'is-error'}`;
    report('benchmark',{routeCorrect,structuredActions,total:cases.length,elapsedMs,results:telemetry});
  }catch(error){
    output.innerHTML=`<b>Trial could not run.</b><p>${esc(error.message)}</p>`;
    status.textContent=`SmolLM2 trial failed: ${error.message}`;
    status.className='cw-ai-test-status is-error';
    report('benchmark-failed',{message:error.message,code:error.code||null});
  }finally{
    button.disabled=false;
  }
}

function installBenchmarkInterceptor(){
  if(globalThis.__civweaveSmolBenchmarkV137)return;
  globalThis.__civweaveSmolBenchmarkV137=true;
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-benchmark]');
    if(!button)return;
    const form=button.closest('[data-smol-settings-form],form');
    if(!form)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    runBenchmark(form,button);
  },true);
}

if(!installRuntimeWrapper())addEventListener('DOMContentLoaded',installRuntimeWrapper,{once:true});
installBenchmarkInterceptor();

globalThis.CivweaveSmolLM2V137={
  model:MODEL_ID,
  parseRouteCode,
  normalizeAction,
  normalizeGuideResult,
  compactGuideRequest,
  benchmarkCases,
  runBenchmark
};
})();
