(()=>{
'use strict';
const VERSION='1.1.0-minilm-context-router-v344-avatar-hardening';
const ADAPTER='/app/models/all-minilm-l6-v2/adapter.js';
const MODEL='Xenova/all-MiniLM-L6-v2';
const LOCAL_AI_POLICY=Object.freeze({basicPhoneDefault:'HuggingFaceTB/SmolLM2-360M-Instruct',contextRouter:MODEL,avatarContext:MODEL,smollm2ImagePicker:false});
const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const MODE={civweave:'Reflect','living-school':'Learn',cerbanimo:'Build',fellowfare:'Acquire',anarchadia:'Govern'};
const ROUTES=Object.freeze([
  {id:'living-school',text:'learn understand study research practice lesson curriculum explain teach test knowledge skill education training'},
  {id:'cerbanimo',text:'build make implement code repair design project task work create prototype ship service accomplishment production'},
  {id:'fellowfare',text:'find acquire buy sell trade offer need resource material inventory borrow delivery marketplace exchange product'},
  {id:'anarchadia',text:'govern vote proposal policy rule consent assembly community civic federation collective decision public process'},
  {id:'civweave',text:'reflect plan prioritize coordinate several domains decide what next orchestrate intention wish cross realm strategy'}
]);
const EMOTIONS=Object.freeze([
  {id:'neutral',text:'calm neutral matter of fact steady ordinary informational'},
  {id:'happy',text:'happy pleased glad positive good news warm satisfaction'},
  {id:'excited',text:'excited enthusiastic energized amazing fantastic thrilled'},
  {id:'laughing',text:'laughing humorous funny joke playful laughter'},
  {id:'curious',text:'curious wondering questioning exploring asking what if interested'},
  {id:'thinking',text:'thinking analyzing comparing reasoning considering tradeoffs focused'},
  {id:'confused',text:'confused unclear uncertain ambiguous cannot tell puzzled'},
  {id:'surprised',text:'surprised unexpected sudden astonishing wow shock'},
  {id:'worried',text:'worried concerned warning risk danger failure broken problem caution'},
  {id:'sad',text:'sad disappointed regret loss grief unfortunate sympathy'},
  {id:'crying',text:'crying tears grief devastated sobbing overwhelmed sadness'},
  {id:'shy',text:'shy bashful embarrassed blushing hesitant modest'},
  {id:'determined',text:'determined decisive fix build next step action resolve persist'},
  {id:'proud',text:'proud achievement success well done accomplished strong result'},
  {id:'mischievous',text:'mischievous playful clever teasing wink impish'},
  {id:'sleepy',text:'sleepy tired resting nap exhausted quiet low energy'},
  {id:'cheering',text:'celebrating victory cheering we did it milestone success'},
  {id:'waving',text:'hello welcome greeting goodbye waving friendly arrival'},
  {id:'pointing',text:'pointing directing look here open tap choose this way instruction'},
  {id:'magical',text:'magical wizard spell wonder sparkle transformation alchemy conjure'},
  {id:'hopeful',text:'hopeful possible future imagine opportunity improvement optimism'},
  {id:'supportive',text:'supportive encouraging helpful guidance assistance reassurance'}
]);
const VALENCE={neutral:0,happy:.7,excited:.82,laughing:.78,curious:.25,thinking:.05,confused:-.18,surprised:.12,worried:-.65,sad:-.78,crying:-.9,shy:.05,determined:.35,proud:.72,mischievous:.4,sleepy:.02,cheering:.9,waving:.42,pointing:.08,magical:.62,hopeful:.58,supportive:.52};
const AROUSAL={neutral:.15,happy:.42,excited:.9,laughing:.75,curious:.5,thinking:.35,confused:.48,surprised:.85,worried:.72,sad:.28,crying:.55,shy:.3,determined:.68,proud:.5,mischievous:.62,sleepy:.08,cheering:.95,waving:.45,pointing:.4,magical:.74,hopeful:.42,supportive:.32};
const perf={bootAt:performance.now(),coldStartMs:[],routeMs:[],emotionMs:[],workerStarts:0,workerStops:0,activeSince:0,activeMs:0,lastMemory:null,lastStopReason:'',fallbackRoutes:0,fallbackEmotions:0};
let adapterPromise=null,ready=false,warming=null,idleTimer=0,wrappedRuntime=null,lastStatus={available:false,ready:false,source:'cold'};
const clean=(value,max=1800)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const system=value=>SYSTEMS.includes(String(value||''))?String(value):'civweave';
const now=()=>performance.now();
const cheapPhone=()=>Boolean((Number(navigator.deviceMemory||0)&&navigator.deviceMemory<=4)||(Number(navigator.hardwareConcurrency||0)&&navigator.hardwareConcurrency<=4));
const workerIdleBudget=()=>cheapPhone()?12000:45000;
const timeout=(promise,ms)=>Promise.race([promise,new Promise(resolve=>setTimeout(()=>resolve(null),ms))]);
function memorySample(){const m=performance?.memory;perf.lastMemory=m?{usedJSHeapSize:Number(m.usedJSHeapSize||0),totalJSHeapSize:Number(m.totalJSHeapSize||0),jsHeapSizeLimit:Number(m.jsHeapSizeLimit||0)}:null;return perf.lastMemory}
function module(){if(!adapterPromise)adapterPromise=import(ADAPTER).catch(error=>{adapterPromise=null;throw error});return adapterPromise}
function fallbackRoute(text,currentSystem='civweave'){
  perf.fallbackRoutes+=1;const lower=clean(text).toLowerCase();
  const groups=[
    {system:'living-school',words:['learn','study','course','teach','understand','practice','curriculum','lesson','skill','research','explain']},
    {system:'cerbanimo',words:['build','make','code','design','repair','work','project','task','ship','prototype','quest','implement']},
    {system:'fellowfare',words:['buy','find','material','resource','trade','sell','offer','need','inventory','exchange','delivery','borrow']},
    {system:'anarchadia',words:['govern','proposal','vote','rule','community','organize','policy','federation','consent','assembly']}
  ];
  const scored=groups.map(row=>({...row,hits:row.words.filter(word=>lower.includes(word))})).sort((a,b)=>b.hits.length-a.hits.length);
  if(scored[0]?.hits.length)return {system:scored[0].system,mode:MODE[scored[0].system],confidence:Math.min(.94,.58+scored[0].hits.length*.09),evidence:scored[0].hits,source:'rules'};
  return {system:system(currentSystem),mode:/plan|steps|roadmap|what next|how do i/.test(lower)?'Plan':MODE[system(currentSystem)],confidence:.42,evidence:[],source:'rules'}
}
function fallbackEmotion(text,sys='civweave'){
  perf.fallbackEmotions+=1;const t=clean(text).toLowerCase(),hit=re=>re.test(t);let id='neutral';
  if(hit(/\b(cry|crying|tears|heartbreak|grief|mourning)\b/))id='crying';
  else if(hit(/\b(sad|sorry|regret|loss|disappoint)\b/))id='sad';
  else if(hit(/\b(warn|careful|risk|danger|unsafe|concern|worry|problem|issue|failure|crash|broken)\b/))id='worried';
  else if(hit(/\b(confus|unclear|ambiguous|not sure|uncertain|cannot tell)\b/))id='confused';
  else if(hit(/\b(surpris|unexpected|suddenly|wow)\b/)||/!{2,}/.test(t))id='surprised';
  else if(hit(/\b(lol|haha|funny|hilarious|laugh)\b/))id='laughing';
  else if(hit(/\b(celebrat|victory|we did it|nailed it|hooray)\b/))id='cheering';
  else if(hit(/\b(excited|amazing|fantastic|excellent|awesome|love this|brilliant)\b/))id='excited';
  else if(hit(/\b(consider|think|reason|evaluate|compare|tradeoff|inspect|analyz|weigh)\b/))id='thinking';
  else if(hit(/\b(curious|wonder|what if|how might)\b/)||/\?$/.test(t))id='curious';
  else if(hit(/\b(determined|next step|build|ship it|fix this|make it happen)\b/))id='determined';
  else if(hit(/\b(proud|well done|great work|achievement)\b/))id='proud';
  else if(hit(/\b(playful|wink|teasing|clever little)\b/))id='mischievous';
  else if(hit(/\b(shy|bashful|embarrass|blush)\b/))id='shy';
  else if(hit(/\b(sleep|sleepy|rest|tired|nap)\b/))id='sleepy';
  else if(hit(/\b(wave|hello|welcome back|greetings)\b/))id='waving';
  else if(hit(/\b(point|look here|this way|open the|tap the|choose the)\b/))id='pointing';
  else if(hit(/\b(magic|magical|wizard|spell|sparkle|conjure|alchemy)\b/))id='magical';
  else if(hit(/\b(hope|possible|imagine|transform|spark)\b/))id='hopeful';
  else if(hit(/\b(happy|glad|great|good news|nice|success)\b/))id='happy';
  return contextFromEmotion(id,{system:sys,confidence:.48,source:'rules'})
}
function contextFromEmotion(id,{system:sys='civweave',confidence=.5,source='rules',score=0,margin=0}={}){
  let expression=id==='supportive'?(sys==='living-school'?'encouraging':sys==='cerbanimo'?'helpful':sys==='fellowfare'?'approving':'happy'):id;
  if(id==='crying'&&sys==='civweave')expression='sad';
  if(id==='magical'&&!['civweave','anarchadia'].includes(sys))expression='excited';
  if(id==='hopeful'&&sys!=='civweave')expression='happy';
  return {schema:'civweave.emotion-context.v1',system:system(sys),primary:id,expression,valence:VALENCE[id]??0,arousal:AROUSAL[id]??.2,confidence,score,margin,source,model:source==='minilm'?MODEL:null,updatedAt:Date.now()}
}
async function stop(reason='idle'){
  clearTimeout(idleTimer);idleTimer=0;
  try{(await module()).shutdown(`MiniLM semantic ${reason}.`)}catch{}
  if(ready){perf.workerStops+=1;if(perf.activeSince)perf.activeMs+=Math.max(0,now()-perf.activeSince)}
  perf.activeSince=0;perf.lastStopReason=reason;ready=false;lastStatus={...lastStatus,ready:false,source:reason};memorySample();
  dispatchEvent(new CustomEvent('civweave:minilm-context-stopped',{detail:{version:VERSION,reason,workerIdleBudgetMs:workerIdleBudget()}}))
}
function scheduleShutdown(){clearTimeout(idleTimer);idleTimer=setTimeout(()=>void stop('idle-budget'),workerIdleBudget())}
async function packageStatus(){
  try{const status=await (await module()).status();lastStatus={...status,ready:Boolean(ready),source:ready?'minilm':'package'};return status}
  catch(error){lastStatus={available:false,ready:false,source:'status-error',error:String(error?.message||error)};return lastStatus}
}
async function install({onProgress}={}){
  const api=await module(),status=await api.install({onProgress});lastStatus=status;dispatchEvent(new CustomEvent('civweave:minilm-package-installed',{detail:{version:VERSION,model:MODEL}}));return status
}
async function warm(){
  if(ready){scheduleShutdown();return true}if(warming)return warming;
  warming=(async()=>{
    try{
      const api=await module(),status=await api.status();lastStatus=status;
      if(!status.available){dispatchEvent(new CustomEvent('civweave:minilm-package-needed',{detail:{version:VERSION,model:MODEL,silentDownload:false}}));return false}
      const started=now();await api.prewarm({explicit:true,installIfMissing:false,timeoutMs:45000});const elapsed=now()-started;
      perf.coldStartMs.push(elapsed);if(perf.coldStartMs.length>24)perf.coldStartMs.shift();perf.workerStarts+=1;perf.activeSince=now();
      ready=true;lastStatus={...status,ready:true,source:'minilm'};scheduleShutdown();memorySample();
      dispatchEvent(new CustomEvent('civweave:minilm-context-ready',{detail:{version:VERSION,model:MODEL,coldStartMs:Math.round(elapsed)}}));return true
    }catch(error){
      ready=false;lastStatus={available:false,ready:false,source:'fallback',error:String(error?.message||error)};
      dispatchEvent(new CustomEvent('civweave:minilm-context-fallback',{detail:{version:VERSION,message:lastStatus.error}}));return false
    }finally{warming=null}
  })();
  return warming
}
async function route(text,{currentSystem='civweave',history=[],room=''}={}){
  const fallback=fallbackRoute(text,currentSystem);if(!ready){void warm();return fallback}
  try{
    const recent=(Array.isArray(history)?history:[]).slice(-3).map(row=>`${row.role||''}: ${clean(row.text||row.content,240)}`).join(' | ');
    const query=clean(`current realm ${system(currentSystem)}. current room ${room}. recent ${recent}. user intent ${text}`,1400),started=now();
    const result=await timeout((await module()).rank(query,ROUTES,{limit:5,cacheKey:'civweave-route-prototypes-v344',timeoutMs:2200}),750);
    perf.routeMs.push(now()-started);if(perf.routeMs.length>120)perf.routeMs.shift();
    if(!result?.matches?.length)return fallback;
    const rows=result.matches.map(row=>({...row,score:Number(row.score||0)+(row.id===system(currentSystem)?.018:0)})).sort((a,b)=>b.score-a.score),top=rows[0],second=rows[1],margin=Number(top.score||0)-Number(second?.score||0);
    if(Number(top.score||0)<.24||margin<.018)return {...fallback,semantic:{top:top.id,score:top.score,margin}};
    scheduleShutdown();memorySample();return {system:system(top.id),mode:MODE[system(top.id)],confidence:Math.max(.5,Math.min(.96,.58+margin*2.6+(Number(top.score||0)-.24)*.45)),evidence:[`semantic:${top.id}`],source:'minilm',semantic:{score:Number(top.score||0),margin}}
  }catch{return fallback}
}
async function emotion(text,{system:sys='civweave',userText=''}={}){
  const fallback=fallbackEmotion(text,sys);if(!ready){void warm();return fallback}
  try{
    const query=clean(`user ${userText}. assistant ${text}`,1600),started=now();
    const result=await timeout((await module()).rank(query,EMOTIONS,{limit:4,cacheKey:'civweave-emotion-prototypes-v344-hardening',timeoutMs:1600}),650);
    perf.emotionMs.push(now()-started);if(perf.emotionMs.length>120)perf.emotionMs.shift();
    if(!result?.matches?.length)return fallback;
    const top=result.matches[0],second=result.matches[1],margin=Number(top.score||0)-Number(second?.score||0);
    if(Number(top.score||0)<.22||margin<.012)return {...fallback,semantic:{top:top.id,score:top.score,margin}};
    scheduleShutdown();memorySample();return contextFromEmotion(top.id,{system:sys,confidence:Math.max(.52,Math.min(.95,.6+margin*2.8)),score:Number(top.score||0),margin,source:'minilm'})
  }catch{return fallback}
}
function extractContext(content){const marker='Structured context:\n',start=String(content||'').indexOf(marker);if(start<0)return null;const from=start+marker.length,end=String(content).indexOf('\n\nRespond as JSON',from),raw=String(content).slice(from,end>=0?end:undefined);try{return{context:JSON.parse(raw),start:from,end:end>=0?end:String(content).length}}catch{return null}}
async function enhanceRequest(request){
  if(request?.purpose!=='civweave-guide-response')return request;const messages=Array.isArray(request.messages)?request.messages:[],index=messages.findIndex(row=>typeof row?.content==='string'&&row.content.includes('Structured context:\n'));if(index<0)return request;
  const parsed=extractContext(messages[index].content);if(!parsed?.context)return request;
  const c=parsed.context,current=system(c.currentContext?.systemId||c.guide?.system),semantic=await route(c.userMessage,{currentSystem:current,history:c.recentConversation,room:c.currentContext?.roomLabel||c.currentContext?.roomId||''});if(semantic.source!=='minilm')return request;
  const prior=c.routingAnswer||{},next={...c,routingAnswer:{...prior,mode:semantic.mode,system:semantic.system,confidence:semantic.confidence,evidence:semantic.evidence,source:'minilm',semantic:semantic.semantic},contextRouter:{model:MODEL,version:VERSION,source:'minilm'}};
  const original=messages[index].content,content=`${original.slice(0,parsed.start)}${JSON.stringify(next)}${original.slice(parsed.end)}`,copy=messages.slice();copy[index]={...messages[index],content};
  dispatchEvent(new CustomEvent('civweave:semantic-route',{detail:{version:VERSION,...semantic}}));return {...request,messages:copy,__civweaveSemanticRoute:semantic}
}
function installRuntimeInterceptor(){
  const runtime=globalThis.CivweaveModelRuntime;if(!runtime?.generate||runtime.__minilmContextRouterV344)return false;if(wrappedRuntime===runtime)return true;
  const previous=runtime.generate.bind(runtime),patched=async request=>previous(await enhanceRequest(request));globalThis.CivweaveModelRuntime={...runtime,generate:patched,__minilmContextRouterV344:true};wrappedRuntime=globalThis.CivweaveModelRuntime;return true
}
function performanceSnapshot(){
  const avg=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length*10)/10:null;
  return{version:VERSION,cheapPhone:cheapPhone(),workerIdleBudgetMs:workerIdleBudget(),coldStartAvgMs:avg(perf.coldStartMs),routeAvgMs:avg(perf.routeMs),emotionAvgMs:avg(perf.emotionMs),workerStarts:perf.workerStarts,workerStops:perf.workerStops,workerActiveMs:Math.round(perf.activeMs+(ready&&perf.activeSince?now()-perf.activeSince:0)),lastStopReason:perf.lastStopReason,memory:memorySample(),batteryProxy:'worker active time + bounded semantic latency + aggressive cheap-phone idle shutdown',startupPolicy:'dormant-until-first-semantic-use'}
}
const api=Object.freeze({version:VERSION,model:MODEL,route,emotion,warm,install,packageStatus,shutdown:stop,status:()=>({...lastStatus,version:VERSION,ready}),performance:performanceSnapshot,fallbackRoute,fallbackEmotion,installRuntimeInterceptor,localAIPolicy:LOCAL_AI_POLICY,invisibleInfrastructure:true,settingsAutostart:false,startupDormant:true});
globalThis.CivweaveContextRouterV344=api;globalThis.CivweaveLocalAIPolicyV344=LOCAL_AI_POLICY;
dispatchEvent(new CustomEvent('civweave:local-ai-policy-ready',{detail:LOCAL_AI_POLICY}));
installRuntimeInterceptor();let attempts=0;const timer=setInterval(()=>{attempts+=1;if(!globalThis.CivweaveModelRuntime?.__minilmContextRouterV344)installRuntimeInterceptor();if(attempts>160)clearInterval(timer)},250);
addEventListener('civweave:model-runtime-ready',installRuntimeInterceptor);addEventListener('civweave:local-model-runtime-ready',installRuntimeInterceptor);
addEventListener('pagehide',()=>{clearInterval(timer);clearTimeout(idleTimer);void stop('pagehide')},{once:true});
dispatchEvent(new CustomEvent('civweave:minilm-context-router-ready',{detail:{version:VERSION,invisibleInfrastructure:true,startupDormant:true}}));
})();