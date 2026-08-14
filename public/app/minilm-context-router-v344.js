(()=>{
'use strict';
const VERSION='1.0.0-minilm-context-router-v344';
const ADAPTER='/app/models/all-minilm-l6-v2/adapter.js';
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
  {id:'determined',text:'determined decisive fix build next step action resolve persist'},
  {id:'proud',text:'proud achievement success well done accomplished strong result'},
  {id:'cheering',text:'celebrating victory cheering we did it milestone success'},
  {id:'waving',text:'hello welcome greeting goodbye waving friendly arrival'},
  {id:'pointing',text:'pointing directing look here open tap choose this way instruction'},
  {id:'hopeful',text:'hopeful possible future imagine opportunity improvement optimism'},
  {id:'supportive',text:'supportive encouraging helpful guidance assistance reassurance'}
]);
const VALENCE={neutral:0,happy:.7,excited:.82,laughing:.78,curious:.25,thinking:.05,confused:-.18,surprised:.12,worried:-.65,sad:-.78,determined:.35,proud:.72,cheering:.9,waving:.42,pointing:.08,hopeful:.58,supportive:.52};
const AROUSAL={neutral:.15,happy:.42,excited:.9,laughing:.75,curious:.5,thinking:.35,confused:.48,surprised:.85,worried:.72,sad:.28,determined:.68,proud:.5,cheering:.95,waving:.45,pointing:.4,hopeful:.42,supportive:.32};
let adapterPromise=null,ready=false,warming=null,idleTimer=0,wrappedRuntime=null,lastStatus={available:false,ready:false,source:'cold'};
const clean=(value,max=1800)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const system=value=>SYSTEMS.includes(String(value||''))?String(value):'civweave';
const timeout=(promise,ms)=>Promise.race([promise,new Promise(resolve=>setTimeout(()=>resolve(null),ms))]);
function module(){if(!adapterPromise)adapterPromise=import(ADAPTER).catch(error=>{adapterPromise=null;throw error});return adapterPromise}
function fallbackRoute(text,currentSystem='civweave'){
  const lower=clean(text).toLowerCase();
  const groups=[
    {system:'living-school',words:['learn','study','course','teach','understand','practice','curriculum','lesson','skill','research','explain']},
    {system:'cerbanimo',words:['build','make','code','design','repair','work','project','task','ship','prototype','quest','implement']},
    {system:'fellowfare',words:['buy','find','material','resource','trade','sell','offer','need','inventory','exchange','delivery','borrow']},
    {system:'anarchadia',words:['govern','proposal','vote','rule','community','organize','policy','federation','consent','assembly']}
  ];
  const scored=groups.map(row=>({...row,hits:row.words.filter(word=>lower.includes(word))})).sort((a,b)=>b.hits.length-a.hits.length);
  if(scored[0]?.hits.length)return {system:scored[0].system,mode:MODE[scored[0].system],confidence:Math.min(.94,.58+scored[0].hits.length*.09),evidence:scored[0].hits,source:'rules'};
  return {system:system(currentSystem),mode:/plan|steps|roadmap|what next|how do i/.test(lower)?'Plan':MODE[system(currentSystem)],confidence:.42,evidence:[],source:'rules'};
}
function fallbackEmotion(text,sys='civweave'){
  const t=clean(text).toLowerCase(),hit=re=>re.test(t);let id='neutral';
  if(hit(/\b(cry|tears|heartbreak|grief|mourning|sad|sorry|regret|loss)\b/))id='sad';
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
  else if(hit(/\b(wave|hello|welcome back|greetings)\b/))id='waving';
  else if(hit(/\b(point|look here|this way|open the|tap the|choose the)\b/))id='pointing';
  else if(hit(/\b(hope|possible|imagine|transform|spark)\b/))id='hopeful';
  else if(hit(/\b(happy|glad|great|good news|nice|success)\b/))id='happy';
  return contextFromEmotion(id,{system:sys,confidence:.48,source:'rules'});
}
function contextFromEmotion(id,{system:sys='civweave',confidence=.5,source='rules',score=0,margin=0}={}){
  const expression=id==='supportive'?(sys==='living-school'?'encouraging':sys==='cerbanimo'?'helpful':sys==='fellowfare'?'approving':'happy'):id;
  return {schema:'civweave.emotion-context.v1',system:system(sys),primary:id,expression,valence:VALENCE[id]??0,arousal:AROUSAL[id]??.2,confidence,score,margin,source,model:source==='minilm'?'Xenova/all-MiniLM-L6-v2':null,updatedAt:Date.now()};
}
function scheduleShutdown(){clearTimeout(idleTimer);idleTimer=setTimeout(async()=>{try{(await module()).shutdown('MiniLM semantic idle timeout.')}catch{}ready=false;lastStatus={...lastStatus,ready:false,source:'idle'}},navigator.deviceMemory&&navigator.deviceMemory<4?30000:90000)}
async function warm(){
  if(ready)return true;if(warming)return warming;
  warming=(async()=>{try{const api=await module(),status=await api.status();lastStatus=status;if(!status.available){dispatchEvent(new CustomEvent('civweave:minilm-package-needed',{detail:{version:VERSION,model:'Xenova/all-MiniLM-L6-v2',silentDownload:false}}));return false}await api.prewarm({explicit:true,installIfMissing:false,timeoutMs:45000});ready=true;lastStatus={...status,ready:true,source:'minilm'};scheduleShutdown();dispatchEvent(new CustomEvent('civweave:minilm-context-ready',{detail:{version:VERSION,model:'Xenova/all-MiniLM-L6-v2'}}));return true}catch(error){ready=false;lastStatus={available:false,ready:false,source:'fallback',error:String(error?.message||error)};dispatchEvent(new CustomEvent('civweave:minilm-context-fallback',{detail:{version:VERSION,message:lastStatus.error}}));return false}finally{warming=null}})();
  return warming;
}
async function route(text,{currentSystem='civweave',history=[],room=''}={}){
  const fallback=fallbackRoute(text,currentSystem);if(!ready){void warm();return fallback}
  try{
    const recent=(Array.isArray(history)?history:[]).slice(-3).map(row=>`${row.role||''}: ${clean(row.text||row.content,240)}`).join(' | ');
    const query=clean(`current realm ${system(currentSystem)}. current room ${room}. recent ${recent}. user intent ${text}`,1400);
    const result=await timeout((await module()).rank(query,ROUTES,{limit:5,cacheKey:'civweave-route-prototypes-v344',timeoutMs:2200}),750);if(!result?.matches?.length)return fallback;
    const rows=result.matches.map(row=>({...row,score:Number(row.score||0)+(row.id===system(currentSystem)?.018:0)})).sort((a,b)=>b.score-a.score),top=rows[0],second=rows[1],margin=Number(top.score||0)-Number(second?.score||0);
    if(Number(top.score||0)<.24||margin<.018)return {...fallback,semantic:{top:top.id,score:top.score,margin}};
    scheduleShutdown();return {system:system(top.id),mode:MODE[system(top.id)],confidence:Math.max(.5,Math.min(.96,.58+margin*2.6+(Number(top.score||0)-.24)*.45)),evidence:[`semantic:${top.id}`],source:'minilm',semantic:{score:Number(top.score||0),margin}};
  }catch{return fallback}
}
async function emotion(text,{system:sys='civweave',userText=''}={}){
  const fallback=fallbackEmotion(text,sys);if(!ready){void warm();return fallback}
  try{
    const query=clean(`user ${userText}. assistant ${text}`,1600),result=await timeout((await module()).rank(query,EMOTIONS,{limit:4,cacheKey:'civweave-emotion-prototypes-v344',timeoutMs:2200}),700);if(!result?.matches?.length)return fallback;
    const top=result.matches[0],second=result.matches[1],margin=Number(top.score||0)-Number(second?.score||0);if(Number(top.score||0)<.22||margin<.012)return {...fallback,semantic:{top:top.id,score:top.score,margin}};
    scheduleShutdown();return contextFromEmotion(top.id,{system:sys,confidence:Math.max(.52,Math.min(.95,.6+margin*2.8)),score:Number(top.score||0),margin,source:'minilm'});
  }catch{return fallback}
}
function extractContext(content){const marker='Structured context:\n',start=String(content||'').indexOf(marker);if(start<0)return null;const from=start+marker.length,end=String(content).indexOf('\n\nRespond as JSON',from),raw=String(content).slice(from,end>=0?end:undefined);try{return{context:JSON.parse(raw),start:from,end:end>=0?end:String(content).length}}catch{return null}}
async function enhanceRequest(request){
  if(request?.purpose!=='civweave-guide-response')return request;const messages=Array.isArray(request.messages)?request.messages:[],index=messages.findIndex(row=>typeof row?.content==='string'&&row.content.includes('Structured context:\n'));if(index<0)return request;
  const parsed=extractContext(messages[index].content);if(!parsed?.context)return request;const c=parsed.context,current=system(c.currentContext?.systemId||c.guide?.system),semantic=await route(c.userMessage,{currentSystem:current,history:c.recentConversation,room:c.currentContext?.roomLabel||c.currentContext?.roomId||''});if(semantic.source!=='minilm')return request;
  const prior=c.routingAnswer||{},next={...c,routingAnswer:{...prior,mode:semantic.mode,system:semantic.system,confidence:semantic.confidence,evidence:semantic.evidence,source:'minilm',semantic:semantic.semantic},contextRouter:{model:'Xenova/all-MiniLM-L6-v2',version:VERSION,source:'minilm'}};
  const original=messages[index].content,content=`${original.slice(0,parsed.start)}${JSON.stringify(next)}${original.slice(parsed.end)}`,copy=messages.slice();copy[index]={...messages[index],content};dispatchEvent(new CustomEvent('civweave:semantic-route',{detail:{version:VERSION,...semantic}}));return {...request,messages:copy,__civweaveSemanticRoute:semantic};
}
function installRuntimeInterceptor(){
  const runtime=globalThis.CivweaveModelRuntime;if(!runtime?.generate||runtime.__minilmContextRouterV344)return false;if(wrappedRuntime===runtime)return true;const previous=runtime.generate.bind(runtime);const patched=async request=>previous(await enhanceRequest(request));globalThis.CivweaveModelRuntime={...runtime,generate:patched,__minilmContextRouterV344:true};wrappedRuntime=globalThis.CivweaveModelRuntime;return true;
}
function idleWarm(){const run=()=>{void warm();installRuntimeInterceptor()};if('requestIdleCallback'in globalThis)requestIdleCallback(run,{timeout:5000});else setTimeout(run,2500)}
const api=Object.freeze({version:VERSION,model:'Xenova/all-MiniLM-L6-v2',route,emotion,warm,status:()=>({...lastStatus,version:VERSION,ready}),fallbackRoute,fallbackEmotion,installRuntimeInterceptor,invisibleInfrastructure:true,settingsAutostart:false});
globalThis.CivweaveContextRouterV344=api;installRuntimeInterceptor();let attempts=0;const timer=setInterval(()=>{attempts+=1;if(!globalThis.CivweaveModelRuntime?.__minilmContextRouterV344)installRuntimeInterceptor();if(attempts>160)clearInterval(timer)},250);idleWarm();addEventListener('civweave:model-runtime-ready',installRuntimeInterceptor);addEventListener('civweave:local-model-runtime-ready',installRuntimeInterceptor);addEventListener('pagehide',async()=>{clearInterval(timer);clearTimeout(idleTimer);try{(await module()).shutdown('pagehide')}catch{}},{once:true});dispatchEvent(new CustomEvent('civweave:minilm-context-router-ready',{detail:{version:VERSION,invisibleInfrastructure:true}}));
})();
