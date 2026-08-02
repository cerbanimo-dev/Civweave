(()=>{
'use strict';

const MODEL_ID='HuggingFaceTB/SmolLM2-360M-Instruct';
const MODEL_ADAPTER='/app/models/smollm2-360m-instruct/adapter.js';
const CONTRACT_MARKER='COMMONWEAVE_SMALL_MODEL_CONTRACT_V1';
const SYSTEMS=['commonweave','living-school','cerbanimo','fellowfare','anarchadia'];
const MODES={
  'commonweave':'Reflect',
  'living-school':'Learn',
  'cerbanimo':'Build',
  'fellowfare':'Acquire',
  'anarchadia':'Govern'
};
const LABELS={
  'commonweave':'Commonweave',
  'living-school':'Living School',
  'cerbanimo':'Cerbanimo',
  'fellowfare':'FellowFare',
  'anarchadia':'Anarchadia'
};
const SYSTEM_ALIASES={
  'commonweave':['commonweave','weaveling','reflect','reflection','orchestrate','orchestration','prioritize','priority','plan','planning','coordinate'],
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

function safeString(value,max=600){
  return String(value==null?'':value).trim().slice(0,max);
}

function canonicalSystem(value){
  const raw=safeString(value,120).toLowerCase().replace(/[_/]+/g,' ').replace(/\s+/g,' ').trim();
  if(!raw)return '';
  if(SYSTEMS.includes(raw))return raw;
  for(const [system,aliases] of Object.entries(SYSTEM_ALIASES)){
    if(aliases.some(alias=>raw===alias||raw.includes(alias)))return system;
  }
  return '';
}

function canonicalMode(value,system=''){
  const raw=safeString(value,80).toLowerCase();
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
  try{
    JSON.parse(source);
    return source;
  }catch{}
  const starts=[];
  for(let i=0;i<source.length;i+=1){
    if(source[i]==='{'||source[i]==='[')starts.push(i);
  }
  for(const start of starts){
    const open=source[start];
    const close=open==='{'?'}':']';
    let depth=0,quoted=false,escaped=false;
    for(let i=start;i<source.length;i+=1){
      const char=source[i];
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
          const candidate=source.slice(start,i+1);
          try{JSON.parse(candidate);return candidate}catch{break}
        }
      }
    }
  }
  return '';
}

function parseJsonValue(value){
  if(isObject(value)||Array.isArray(value))return value;
  const text=extractJsonText(value);
  if(!text)return null;
  try{return JSON.parse(text)}catch{return null}
}

function isSchemaEcho(value){
  if(!isObject(value))return false;
  const keys=Object.keys(value);
  return Boolean(
    (value.type==='object'||value.type==='array')
    && (isObject(value.properties)||Array.isArray(value.required)||value.items)
    && !('system' in value)
    && !('choice' in value)
    && !('answer' in value)
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

function normalizeRoute(value){
  const parsed=parseJsonValue(value);
  if(!parsed||isSchemaEcho(parsed))return {parsed,usable:false,schemaEcho:Boolean(parsed&&isSchemaEcho(parsed)),system:'',mode:'',nextAction:'',shape:parsed?Object.keys(parsed).join(', '):'not-json'};
  for(const {node,path} of nestedCandidates(parsed)){
    if(!isObject(node))continue;
    const rawSystem=node.system??node.systemId??node.system_id??node.realm??node.destination??node.targetSystem??node.target_system??node.routeSystem??node.route_system;
    const system=canonicalSystem(rawSystem);
    const rawMode=node.mode??node.intent??node.category??node.routeMode??node.route_mode??node.actionType??node.action_type;
    const mode=canonicalMode(rawMode,system);
    const nextAction=safeString(node.nextAction??node.next_action??node.nextStep??node.next_step??node.step??node.recommendation??node.action,240);
    if(system){
      return {parsed,usable:true,schemaEcho:false,system,mode:mode||MODES[system],nextAction,path,shape:Object.keys(node).join(', ')};
    }
  }
  const system=canonicalSystem(firstString(parsed,['system','realm','destination','target','$self']));
  if(system){
    return {
      parsed,usable:true,schemaEcho:false,system,mode:MODES[system],
      nextAction:firstString(parsed,['nextAction','next_action','nextStep','step','recommendation']),
      path:'recursive-string',shape:isObject(parsed)?Object.keys(parsed).join(', '):'array'
    };
  }
  return {
    parsed,usable:false,schemaEcho:false,system:'',mode:'',nextAction:'',
    shape:Array.isArray(parsed)?`array(${parsed.length})`:Object.keys(parsed).join(', ')
  };
}

function findStructuredContext(messages){
  for(const item of (Array.isArray(messages)?messages:[]).slice().reverse()){
    const text=safeString(item?.content??item?.text,50000);
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

function normalizeGuideResult(result,request){
  if(!result||!['bundled-smollm2','bundled','smollm2'].includes(String(result.actual?.provider||'').toLowerCase()))return result;
  const parsed=parseJsonValue(result.outputJson??result.outputText);
  const context=findStructuredContext(request?.messages);
  const route=normalizeRoute(parsed);
  const contextSystem=canonicalSystem(context?.routingAnswer?.system);
  const system=route.system||contextSystem||'commonweave';
  const choiceNode=isObject(parsed?.choice)?parsed.choice:isObject(parsed?.route)?parsed.route:parsed;
  let answer=firstString(parsed,['answer','message','text','summary']);
  const schemaEcho=Boolean(parsed&&isSchemaEcho(parsed));
  if(schemaEcho&&!answer){
    answer=`The onboard model returned its response contract instead of a complete answer. The available routing context points to ${LABELS[system]}.`;
  }
  if(!answer&&request?.purpose==='commonweave-guide-response'){
    answer=`The local model produced a partial response. The next useful route appears to be ${LABELS[system]}.`;
  }
  if(request?.purpose!=='commonweave-guide-response'&&!request?.schema)return result;
  const room=safeString(choiceNode?.room??choiceNode?.roomId??context?.routingAnswer?.room,200);
  const nextAction=route.nextAction||firstString(parsed,['nextAction','next_action','nextStep','step','recommendation'])||`Open ${LABELS[system]} and clarify the smallest visible next step.`;
  const assumptions=Array.isArray(parsed?.assumptions)?parsed.assumptions.map(item=>safeString(item,240)).filter(Boolean).slice(0,8):[];
  if(schemaEcho)assumptions.unshift('The local model echoed the response contract; Commonweave recovered the route from supplied context.');
  else if(route.path&&route.path!=='root')assumptions.unshift(`Commonweave normalized a nested local-model response from ${route.path}.`);
  const normalized={
    answer:answer||`Route this request through ${LABELS[system]}.`,
    choice:{
      mode:route.mode||canonicalMode(choiceNode?.mode,system)||MODES[system],
      system,
      room,
      nextAction
    },
    assumptions:assumptions.slice(0,8),
    requiresConsent:Boolean(parsed?.requiresConsent??parsed?.requires_consent??context?.consent?.consequentialActionDetected),
    confidence:Number.isFinite(Number(parsed?.confidence))?Number(parsed.confidence):Number(context?.routingAnswer?.confidence||0.45)
  };
  return {
    ...result,
    outputJson:normalized,
    outputText:JSON.stringify(normalized),
    structured:{
      ...(result.structured||{}),
      requested:true,
      valid:true,
      normalizedBy:'commonweave-small-model-contract-v1',
      sourceShape:route.shape,
      schemaEchoRecovered:schemaEcho
    },
    diagnostics:[
      ...(Array.isArray(result.diagnostics)?result.diagnostics:[]),
      schemaEcho?'Recovered a SmolLM2 schema echo using supplied Commonweave routing context.':'Normalized SmolLM2 output to the Commonweave guide envelope.'
    ]
  };
}

function guideContract(){
  return `${CONTRACT_MARKER}
Do the user's task. Return data, not a description of a schema. Never output keys named "type", "properties", or "required".
For a Commonweave guide response, output exactly one JSON object shaped like:
{"answer":"one useful plain-language answer","choice":{"mode":"Reflect","system":"commonweave","room":"","nextAction":"one concrete next step"},"assumptions":[],"requiresConsent":false,"confidence":0.7}
Allowed system and mode pairs:
commonweave / Reflect = prioritize, coordinate, plan, or reflect
living-school / Learn = learn, study, research, or practice
cerbanimo / Build = make, repair, implement, or skilled work
fellowfare / Acquire = obtain, trade, borrow, or exchange resources
anarchadia / Govern = proposals, policies, votes, or collective decisions
Use only supplied context. Do not claim external actions occurred.`;
}

function genericContract(){
  return `${CONTRACT_MARKER}
Complete the requested task. When JSON is requested, output the JSON value itself, not JSON Schema and not an explanation of the fields. Never echo keys named "type", "properties", or "required" unless the user explicitly asked for a schema.`;
}

function installRuntimeWrapper(){
  const runtime=globalThis.CommonweaveModelRuntime;
  if(!runtime?.generate||runtime.__smallModelContractV136)return false;
  const previous=runtime.generate.bind(runtime);
  const wrapped=async request=>{
    const incoming=request||{};
    const provider=String(incoming.config?.provider||incoming.config?.route||'').toLowerCase();
    const bundled=['bundled','packaged','smollm2','smollm2-360m-instruct','huggingfacetb/smollm2-360m-instruct'].includes(provider);
    let prepared=incoming;
    if(bundled){
      const contract=incoming.purpose==='commonweave-guide-response'?guideContract():genericContract();
      const messages=Array.isArray(incoming.messages)?incoming.messages:[];
      if(!messages.some(item=>String(item?.content||'').includes(CONTRACT_MARKER))){
        prepared={...incoming,messages:[{role:'system',content:contract},...messages]};
      }
    }
    const result=await previous(prepared);
    return normalizeGuideResult(result,prepared);
  };
  globalThis.CommonweaveModelRuntime={...runtime,generate:wrapped,__smallModelContractV136:true};
  return true;
}

async function adapter(){
  if(!adapterPromise)adapterPromise=import(MODEL_ADAPTER).catch(error=>{adapterPromise=null;throw error});
  return adapterPromise;
}

function benchmarkCases(){
  const routingPrompt=`${CONTRACT_MARKER}
Route the request to exactly one Commonweave system.
Return one compact JSON object only:
{"system":"living-school","mode":"Learn","nextAction":"short action"}
Never output JSON Schema. Never add markdown.
Use these exact pairs:
commonweave / Reflect = prioritize, coordinate, plan, reflect
living-school / Learn = learn, study, research, practice
cerbanimo / Build = make, repair, implement, skilled work
fellowfare / Acquire = obtain, trade, borrow, exchange materials
anarchadia / Govern = proposals, policies, voting, collective decisions
Examples:
Request: "Teach me to identify soil nutrients." Answer: {"system":"living-school","mode":"Learn","nextAction":"Start a soil nutrient practice module."}
Request: "We need lumber and a borrowed trailer." Answer: {"system":"fellowfare","mode":"Acquire","nextAction":"List the lumber need and trailer borrowing terms."}
Request: "Help our block vote on a shared rule." Answer: {"system":"anarchadia","mode":"Govern","nextAction":"Draft the rule and voting process."}`;
  const items=[
    ['learning','I want to understand local watershed testing and practice reading the results.','living-school'],
    ['build','Help me repair a broken community greenhouse vent and prove the work is complete.','cerbanimo'],
    ['exchange','We need twelve reclaimed boards and a way to borrow a trailer fairly.','fellowfare'],
    ['governance','Draft a proposal for how the neighborhood approves shared tool purchases.','anarchadia'],
    ['reflection','I have too many projects and need to decide what deserves attention first.','commonweave']
  ];
  return items.map(([id,text,system])=>({
    id,
    expected:{system,mode:MODES[system]},
    maxNewTokens:56,
    messages:[
      {role:'system',content:routingPrompt},
      {role:'user',content:`Request: ${text}\nAnswer:`}
    ]
  }));
}

function report(kind,detail={}){
  try{
    fetch('/api/boot-log',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        schema:'commonweave.boot-log.v1',
        time:new Date().toISOString(),
        version:'1.0.30',
        build:'smollm2-contract-v136',
        kind:`smollm2-v136:${kind}`,
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
  output.innerHTML='<b>SmolLM2 route trial starting…</b><p>Five compact prompts will run locally. The model stays loaded between prompts.</p>';
  status.textContent='Running the small-model routing contract…';
  status.className='cw-ai-test-status';
  try{
    const engine=await adapter();
    const availability=await engine.status();
    if(!availability.available)throw new Error(`The package is incomplete: ${availability.missing.map(item=>item.url).join(', ')}`);
    const cases=benchmarkCases();
    const trial=await engine.benchmark(cases,{timeoutMs:240000,maxNewTokens:56});
    let jsonParsed=0,usableJson=0,routeCorrect=0;
    const normalizedResults=[];
    const rows=trial.results.map((result,index)=>{
      const spec=cases[index];
      const route=result.ok?normalizeRoute(result.text):{parsed:null,usable:false,schemaEcho:false,system:'',mode:'',nextAction:'',shape:'generation-failed'};
      if(route.parsed)jsonParsed+=1;
      if(route.usable)usableJson+=1;
      const correct=route.system===spec.expected.system;
      if(correct)routeCorrect+=1;
      normalizedResults.push({
        id:spec.id,
        ok:result.ok,
        expected:spec.expected.system,
        actual:route.system||null,
        mode:route.mode||null,
        usable:route.usable,
        schemaEcho:route.schemaEcho,
        shape:route.shape,
        elapsedMs:result.elapsedMs,
        device:result.device||null
      });
      if(!result.ok){
        return `<li class="is-fail"><b>${esc(spec.id)}</b>: failed · ${esc(result.error)} · ${result.elapsedMs} ms</li>`;
      }
      const routeText=route.usable
        ?`${esc(LABELS[route.system])} · ${esc(route.mode||MODES[route.system])}`
        :route.schemaEcho
          ?`schema echo · keys: ${esc(route.shape)}`
          :`unrecognized JSON · keys: ${esc(route.shape||'none')}`;
      const expectedText=correct?'':` · expected ${esc(LABELS[spec.expected.system])}`;
      const action=route.nextAction?`<small>${esc(route.nextAction)}</small>`:'';
      return `<li class="${correct?'is-pass':'is-fail'}"><b>${esc(spec.id)}</b>: ${routeText}${expectedText} · ${result.elapsedMs} ms · ${esc(result.device)}${action}</li>`;
    }).join('');
    output.innerHTML=`<b>${routeCorrect}/${cases.length} routes correct · ${usableJson}/${cases.length} usable JSON</b><p>${jsonParsed}/${cases.length} outputs were parseable JSON. Total trial time: ${(trial.elapsedMs/1000).toFixed(1)} seconds.</p><ol>${rows}</ol>`;
    status.textContent=`Trial complete: ${routeCorrect}/${cases.length} routes correct and ${usableJson}/${cases.length} usable structured responses.`;
    status.className=`cw-ai-test-status ${routeCorrect>=4&&usableJson>=4?'is-ok':'is-error'}`;
    report('benchmark',{
      routeCorrect,
      usableJson,
      jsonParsed,
      total:cases.length,
      elapsedMs:trial.elapsedMs,
      results:normalizedResults
    });
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
  if(globalThis.__commonweaveSmolBenchmarkV136)return;
  globalThis.__commonweaveSmolBenchmarkV136=true;
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

if(!installRuntimeWrapper()){
  addEventListener('DOMContentLoaded',installRuntimeWrapper,{once:true});
}
installBenchmarkInterceptor();

globalThis.CommonweaveSmolLM2V136={
  model:MODEL_ID,
  normalizeRoute,
  normalizeGuideResult,
  benchmarkCases,
  runBenchmark
};
})();
