(()=>{
'use strict';
const REVISION='canonical-campus-startup-v227';
const BRAND_REVISION='compact-shell-v235';
const BRAND_CYCLE_REVISION='day-night-clock-v236';
const BRAND_DAY='/app/logos/civweave-day-logo.jpg';
const BRAND_NIGHT='/app/logos/civweave-night-logo.jpg';
const WEB_ENTRY_REVISION='web-install-entry-v232';
const HUB_REVISION='weaveling-hub-v233';
const FAST_BOOT_REVISION='working-campus-fast-boot-v1';
const COMPILED_PART_COUNT=5;
const STATE_REPAIR_REVISION='working-campus-state-repair-v239-current-quest';
const HUB_SCRIPT='/app/weaveling-hub-v233.js';
const routeScript='/app/system-routes-v227.js?v=1.0.164-single-shell-context';
const required=['conversation','weaveling-chat-form','weaveling-chat-input','workspace','view-title','state-label'];
const controller=new AbortController();
const bootDocument=document.documentElement;
const bootUrl=location.href;
let active=true,brandCycleTimer=0;
function missingRequired(){return required.filter(id=>!document.getElementById(id));}
function liveDocument(){return active&&document.documentElement===bootDocument&&document.documentElement?.isConnected&&document.head?.isConnected&&document.body?.isConnected&&location.href===bootUrl;}
function campusReady(){return liveDocument()&&Boolean(document.querySelector('main.app'))&&missingRequired().length===0;}
function stop(){active=false;controller.abort();if(brandCycleTimer){clearTimeout(brandCycleTimer);brandCycleTimer=0}}
addEventListener('pagehide',stop,{once:true});
addEventListener('beforeunload',stop,{once:true});
function installedDisplay(){return navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches)}
function safeParse(value,fallback){try{return JSON.parse(value)??fallback}catch{return fallback}}
function safeClone(value){try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}catch{return null}}
function recoveredPlan(source={},fallback={}){
  const value=source&&typeof source==='object'?source:{};
  const title=String(value.title||value.text||fallback.title||fallback.text||fallback.wish||'Recovered Quest').trim().slice(0,140)||'Recovered Quest';
  const wish=String(value.wish||fallback.wish||fallback.text||title).trim();
  const paths=Array.isArray(value.paths)?value.paths.filter(Boolean).map(path=>({
    ...path,
    id:path?.id||`recovered-path-${Math.random().toString(36).slice(2,8)}`,
    realm:path?.realm||'cerbanimo',
    title:String(path?.title||'Recovered path'),
    purpose:String(path?.purpose||'Recovered from local state. Review before continuing.'),
    steps:Array.isArray(path?.steps)?path.steps:[],
    progress:Array.isArray(path?.progress)?path.progress:[],
    status:path?.status||'ready'
  })):[];
  const governance=value.governance&&typeof value.governance==='object'?value.governance:{};
  return{
    ...value,
    schema:value.schema||'civweave.intention-weave.v1',
    id:value.id||fallback.id||`recovered-weave-${Date.now().toString(36)}`,
    title,
    wish,
    outcome:String(value.outcome||fallback.outcome||'Recovered from an older local Quest record. Review the route before activation.'),
    state:['review','active','completed'].includes(value.state)?value.state:'review',
    createdAt:value.createdAt||fallback.createdAt||new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    profile:value.profile&&typeof value.profile==='object'?value.profile:{},
    assumptions:Array.isArray(value.assumptions)?value.assumptions:[],
    paths,
    governance:{
      realm:'anarchadia',
      title:String(governance.title||'Recovered passport entry'),
      purpose:String(governance.purpose||'Review recovered participation, boundaries, and commitments before activation.'),
      agreements:Array.isArray(governance.agreements)?governance.agreements:[]
    },
    requiresExplicitActivation:value.requiresExplicitActivation!==false,
    recoveredBy:STATE_REPAIR_REVISION
  };
}
function repairPersistedCampusState(){
  const K='civweave.working-campus.v1',I='civweave.intentions.v127';
  let state=safeParse(localStorage.getItem(K),{});
  if(!state||typeof state!=='object'||Array.isArray(state))state={};
  let ledger=safeParse(localStorage.getItem(I),[]);
  if(!Array.isArray(ledger))ledger=[];
  let changed=false,ledgerChanged=false;
  ledger=ledger.map(row=>{
    if(!row||row.kind!=='weave-plan')return row;
    const existing=row.plan&&typeof row.plan==='object'?row.plan:null;
    const next=recoveredPlan(existing||{},row);
    if(!existing||!existing.title||!Array.isArray(existing.paths)||!existing.governance){ledgerChanged=true;return{...row,text:row.text||next.title,state:row.state||next.state,plan:next,updatedAt:next.updatedAt}}
    return row;
  });
  const planValid=state.plan&&typeof state.plan==='object';
  if(planValid){
    const repaired=recoveredPlan(state.plan,{wish:state.wish});
    if(!state.plan.title||!Array.isArray(state.plan.paths)||!state.plan.governance){state.plan=repaired;changed=true}
  }else if(['review','active'].includes(state.stage)){
    const candidate=ledger.find(row=>row?.kind==='weave-plan'&&row?.plan&&typeof row.plan==='object');
    if(candidate){state.plan=safeClone(candidate.plan)||recoveredPlan(candidate.plan,candidate);state.wish=state.plan.wish||state.wish||'';state.stage=state.plan.state==='review'?'review':'active';changed=true}
    else{state.plan=null;state.stage=String(state.wish||'').trim()?'profile':'wish';changed=true}
  }
  const normalizedView=state.view==='weave'||state.view==='progress'?'quest':state.view;
  if(!['quest','library','campus'].includes(normalizedView)){state.view='quest';changed=true}else if(state.view!==normalizedView){state.view=normalizedView;changed=true}
  if(!Array.isArray(state.conversation)){state.conversation=[];changed=true}
  if(state.stage==='active'&&(!state.plan||!Array.isArray(state.plan.paths))){state.stage=state.plan?'review':(String(state.wish||'').trim()?'profile':'wish');changed=true}
  if(ledgerChanged)try{localStorage.setItem(I,JSON.stringify(ledger.slice(0,100)))}catch{}
  if(changed)try{state.updatedAt=new Date().toISOString();localStorage.setItem(K,JSON.stringify(state))}catch{}
  document.documentElement.dataset.civweaveCampusStateRepair=STATE_REPAIR_REVISION;
  return{changed,ledgerChanged,stage:state.stage||'wish',view:state.view||'quest',hasPlan:Boolean(state.plan)};
}
function installWebEntryPrompt(){
  if(installedDisplay())return false;
  try{if(sessionStorage.getItem('civweave.web-install-prompt.dismissed.v232')==='1')return false}catch{}
  const app=document.querySelector('main.app'),top=document.querySelector('.top');
  if(!app||!top||document.getElementById('cw-web-install-entry-v232'))return false;
  let style=document.getElementById('cw-web-install-entry-style-v232');
  if(!style){
    style=document.createElement('style');
    style.id='cw-web-install-entry-style-v232';
    style.textContent=`
#cw-web-install-entry-v232{position:relative;z-index:3;max-width:1180px;margin:7px auto;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:9px 11px;border:1px solid #8af5d255;border-radius:14px;background:linear-gradient(135deg,#102a3eea,#1e1737e8);box-shadow:0 8px 24px #0005,inset 0 0 18px #8af5d20a}
#cw-web-install-entry-v232[hidden]{display:none!important}#cw-web-install-entry-v232 small{display:block;color:#8af5d2;font-size:8px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}#cw-web-install-entry-v232 strong{display:inline;margin-right:6px;font:700 14px/1.15 Georgia,serif}#cw-web-install-entry-v232 p{display:inline;margin:0;color:#c6d1df;font-size:10.5px;line-height:1.3}
#cw-web-install-entry-v232 .cw-web-install-actions{display:flex;gap:5px;align-items:center;flex-wrap:nowrap;justify-content:flex-end}#cw-web-install-entry-v232 a,#cw-web-install-entry-v232 button{min-height:34px;border-radius:9px;padding:7px 9px;font:800 11px/1 system-ui,sans-serif;text-decoration:none;white-space:nowrap}#cw-web-install-entry-v232 a{border:1px solid #8af5d299;background:linear-gradient(135deg,#8af5d230,#ef8cff2e);color:#fff}#cw-web-install-entry-v232 button{border:1px solid #ffffff24;background:#ffffff0a;color:#dce6ef;cursor:pointer}
@media(max-width:700px){#cw-web-install-entry-v232{grid-template-columns:1fr}#cw-web-install-entry-v232 .cw-web-install-actions{justify-content:stretch}#cw-web-install-entry-v232 a,#cw-web-install-entry-v232 button{flex:1;text-align:center}}
`;
    document.head.append(style);
  }
  const prompt=document.createElement('section');
  prompt.id='cw-web-install-entry-v232';
  prompt.dataset.webInstallEntry=WEB_ENTRY_REVISION;
  prompt.innerHTML='<div><small>Designed to live on your device</small><strong>Install Civweave for the full local and offline campus.</strong><p>You can use Civweave in this browser now. Installing downloads the working campus to your device and keeps the local-first experience available offline.</p></div><div class="cw-web-install-actions"><a data-cw-web-install href="/app/index.html">Install Civweave</a><button data-cw-web-continue type="button">Continue in browser</button></div>';
  const installer=new URL('/app/index.html',location.origin);
  installer.searchParams.set('install','required');
  installer.searchParams.set('next',`${location.pathname}${location.search}${location.hash}`.slice(0,1800));
  prompt.querySelector('[data-cw-web-install]').href=installer.href;
  prompt.querySelector('[data-cw-web-continue]').addEventListener('click',()=>{try{sessionStorage.setItem('civweave.web-install-prompt.dismissed.v232','1')}catch{}prompt.hidden=true});
  top.insertAdjacentElement('afterend',prompt);
  document.documentElement.dataset.civweaveWebEntry=WEB_ENTRY_REVISION;
  return true;
}
function brandAssetForLocalClock(date=new Date()){
  const hour=Number(date?.getHours?.());
  return Number.isFinite(hour)&&hour>=6&&hour<18?BRAND_DAY:BRAND_NIGHT;
}
function nextBrandBoundaryDelay(date=new Date()){
  const nowTime=date.getTime();
  if(!Number.isFinite(nowTime))return 60*60*1000;
  const next=new Date(nowTime),hour=next.getHours();
  if(hour<6)next.setHours(6,0,0,0);
  else if(hour<18)next.setHours(18,0,0,0);
  else{next.setDate(next.getDate()+1);next.setHours(6,0,0,0)}
  return Math.max(1000,next.getTime()-nowTime+250);
}
function syncBrandPresentation(){
  const asset=brandAssetForLocalClock(),phase=asset===BRAND_DAY?'day':'night';
  const brand=document.querySelector('#brand-home img');
  if(brand){
    let current='';
    try{current=new URL(brand.src,location.href).pathname}catch{}
    if(current!==asset)brand.src=asset;
    brand.alt='Civweave';
    brand.dataset.civweaveClockLogo=phase;
  }
  document.documentElement.dataset.civweaveBrandCycle=phase;
  return asset;
}
function scheduleBrandPresentation(){
  if(brandCycleTimer)clearTimeout(brandCycleTimer);
  brandCycleTimer=setTimeout(()=>{brandCycleTimer=0;if(!active)return;syncBrandPresentation();scheduleBrandPresentation()},nextBrandBoundaryDelay());
}
function installBrandPresentation(){
  let manifest=document.querySelector('link[rel="manifest"]');
  if(!manifest){manifest=document.createElement('link');manifest.rel='manifest';manifest.href='/app/manifest.webmanifest';document.head.append(manifest)}
  let icon=document.querySelector('link[rel~="icon"]');
  if(!icon){icon=document.createElement('link');icon.rel='icon';icon.type='image/png';document.head.append(icon)}
  icon.type='image/jpeg';icon.href=syncBrandPresentation();
  syncBrandPresentation();
  scheduleBrandPresentation();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){syncBrandPresentation();scheduleBrandPresentation()}},{signal:controller.signal});
  addEventListener('pageshow',()=>{syncBrandPresentation();scheduleBrandPresentation()},{signal:controller.signal});
  document.documentElement.dataset.civweaveBrandPresentation=BRAND_REVISION;
  document.documentElement.dataset.civweaveBrandCycleRevision=BRAND_CYCLE_REVISION;
}
function installDiagnosticsPolicy(){
  const params=new URLSearchParams(location.search);
  let stored='';
  try{stored=localStorage.getItem('civweave.log-level')||''}catch{}
  const enabled=params.get('diagnostics')==='1'||params.get('cwlog')==='1'||stored==='debug';
  document.documentElement.dataset.civweaveDiagnostics=enabled?'true':'false';
  const button=document.getElementById('diagnostics-button');
  if(button){button.hidden=!enabled;button.setAttribute('aria-hidden',enabled?'false':'true')}
  return enabled;
}
function selectedGuide(){
  const context=globalThis.CivweavePersistentSystemContextV1?.selected?.();
  if(context)return context;
  const active=globalThis.CivweavePersistentGuideChatV215?.state?.().activeSystem;
  return active||'civweave';
}
function installPersistentChatLauncherOwnership(){
  const own=()=>{const system=selectedGuide();try{return globalThis.CivweavePersistentGuideChatV215?.switchGuide?.(system)||false}catch{return false}};
  addEventListener('civweave:persistent-guide-chat-ready',()=>own());
  addEventListener('civweave:system-context-changed',()=>own());
  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;if(!target)return;
    if(target.closest('#cwp215-launcher')){
      const chat=globalThis.CivweavePersistentGuideChatV215;if(!chat?.open)return;
      event.preventDefault();event.stopImmediatePropagation();chat.open({guide:selectedGuide()});return;
    }
    if(target.closest('#cw-persistent-guide-chat-v215 [data-close]'))queueMicrotask(own);
  },true);
  own();
  document.documentElement.dataset.civweaveChatLauncherOwner='persistent-system-context-v1';
}
function installHeaderHitSafety(){
  let style=document.getElementById('cw-working-campus-hit-safety-v238');
  if(!style){style=document.createElement('style');style.id='cw-working-campus-hit-safety-v238';style.textContent=`main.app>.top{position:relative!important;z-index:2147483620!important;pointer-events:auto!important;isolation:isolate}main.app>.top>*{pointer-events:auto!important;position:relative}main.app>.top:after{pointer-events:none!important}#cw-shared-guide-surface-v236{z-index:2!important}#cw-web-install-entry-v232{z-index:3!important}`;document.head.append(style)}
  document.documentElement.dataset.civweaveHeaderHitSafety='v238';
}
function ensureRouteContract(){
  if(globalThis.CivweaveSystemRoutesV227){globalThis.CivweaveSystemRoutesV227.authorize();globalThis.CivweaveSystemRoutesV227.ensurePersistentSystemContext?.();return Promise.resolve(true)}
  return new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname==='/app/system-routes-v227.js');
    const ready=()=>{if(globalThis.CivweaveSystemRoutesV227){globalThis.CivweaveSystemRoutesV227.authorize();globalThis.CivweaveSystemRoutesV227.ensurePersistentSystemContext?.();resolve(true)}else reject(new Error('The five-system route contract loaded without becoming ready.'))};
    if(existing){existing.addEventListener('load',ready,{once:true});existing.addEventListener('error',()=>reject(new Error('The five-system route contract could not load.')),{once:true});return}
    const script=document.createElement('script');script.src=routeScript;script.async=false;script.onload=ready;script.onerror=()=>reject(new Error('The five-system route contract could not load.'));document.head.append(script);
  });
}
function ensureHub(){
  if(globalThis.CivweaveWeavelingHubV233)return Promise.resolve(true);
  return new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===HUB_SCRIPT);
    const ready=()=>globalThis.CivweaveWeavelingHubV233?resolve(true):reject(new Error('The Weaveling observation hub loaded without becoming ready.'));
    if(existing){existing.addEventListener('load',ready,{once:true});existing.addEventListener('error',()=>reject(new Error('The Weaveling observation hub could not load.')),{once:true});return}
    const script=document.createElement('script');script.src=`${HUB_SCRIPT}?v=${HUB_REVISION}`;script.async=false;script.onload=ready;script.onerror=()=>reject(new Error('The Weaveling observation hub could not load.'));document.head.append(script);
  });
}
function afterFirstPaint(task){
  const run=()=>{try{task()}catch(error){console.warn('[Civweave] Post-paint startup task failed.',error)}};
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>requestAnimationFrame(run));else setTimeout(run,0);
}
function scheduleHubHydration(){
  const hydrate=()=>ensureHub().then(()=>{
    document.documentElement.dataset.civweaveHubHydration='ready';
    try{dispatchEvent(new CustomEvent('civweave:working-campus-hub-ready',{detail:{revision:HUB_REVISION,fastBootRevision:FAST_BOOT_REVISION,blocking:false}}))}catch{}
  }).catch(error=>{
    document.documentElement.dataset.civweaveHubHydration='unavailable';
    console.warn('[Civweave] Optional Weaveling hub did not hydrate after startup.',error);
  });
  if(typeof requestIdleCallback==='function')requestIdleCallback(()=>void hydrate(),{timeout:1800});
  else afterFirstPaint(()=>setTimeout(()=>void hydrate(),0));
}
function runCompiledCore(){
/* CIVWEAVE_FAST_BOOT_CORE_START */
(()=>{'use strict';const params=new URLSearchParams(location.search),requested=params.get('system')||'civweave',direct={civweave:'/app/realm-console-v140.html?system=civweave&cabinet=1','living-school':'/app/cabinets/living-school/index.html?cabinet=1',cerbanimo:'/app/realm-console-v140.html?system=cerbanimo&cabinet=1',fellowfare:'/app/fellowfare-cabinet-v144.html?cabinet=1',anarchadia:'/app/anarchadia-console-v139.html?cabinet=1'};if(requested!=='civweave'&&direct[requested]){location.replace(direct[requested]);return}const K='civweave.working-campus.v1',I='civweave.intentions.v127',Q='civweave.realm-inbox.v1',M='civweave.model-route.v1',S='civweave.model-secret.v1',C='civweave.context.v1',H='civweave.active-handoff.v1';const R={'living-school':{name:'Living School',color:'var(--living)',url:direct['living-school']},cerbanimo:{name:'Cerbanimo',color:'var(--cerb)',url:direct.cerbanimo},fellowfare:{name:'FellowFare',color:'var(--fare)',url:direct.fellowfare},anarchadia:{name:'Anarchadia',color:'var(--an)',url:direct.anarchadia}};const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],parse=(v,f)=>{try{return JSON.parse(v)??f}catch{return f}},clean=v=>String(v??'').trim(),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),now=()=>new Date().toISOString(),uid=p=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;let state={stage:'wish',view:'quest',mode:'guided',wish:'',profile:{},plan:null,conversation:[],...parse(localStorage.getItem(K),{})},model={route:'gemini',provider:'gemini',model:'gemini-3.5-flash-lite',endpoint:'https://generativelanguage.googleapis.com/v1beta',consent:false,agenticEnabled:false,agenticModel:'antigravity',...parse(localStorage.getItem(M),{})};if(state.view==='weave'||state.view==='progress')state.view='quest';function save(){state.updatedAt=now();localStorage.setItem(K,JSON.stringify(state));badges()}function say(role,text){state.conversation.push({role,text,at:now()});state.conversation=state.conversation.slice(-20);save();conversation()}function welcome(){if(!state.conversation.length)state.conversation=[{role:'guide',text:'What Quest do you want to begin? Tell me what you want to make true. I will map the learning, skilled work, materials, and agreements it may require.'}]}function conversation(){$('#conversation').innerHTML=state.conversation.map(x=>`<article class="message ${x.role}"><small>${x.role==='guide'?'Weaveling':'You'}</small>${esc(x.text)}</article>`).join('');$('#conversation').scrollTop=$('#conversation').scrollHeight}function signals(text){text=text.toLowerCase();return{game:/game|gameplay|player|sprite|mechanic/.test(text),software:/app|site|software|code|pwa|platform|interface/.test(text),creative:/art|design|story|film|music|visual|write/.test(text),material:/material|resource|tool|equipment|budget|buy|borrow|trade|supply|transport/.test(text),group:/friend|team|group|community|together|collaborat|\bwe\b|\bour\b/.test(text),governance:/consent|agreement|rule|policy|vote|role|approval|boundary/.test(text),repair:/fix|repair|restore|rebuild|recover|broken|bug/.test(text)}}function title(w){return w.replace(/^(i want|i wish|we want|please|help me|let'?s)\s+(to\s+)?/i,'').replace(/[.!?]+$/,'').trim().replace(/^./,c=>c.toUpperCase()).slice(0,120)||'Move this intention forward'}function build(){const s=signals(state.wish),p=state.profile,createdAt=now(),paths=[{id:uid('path'),type:'learning',realm:'living-school',title:s.software?'Learn only what the working slice needs':s.game?'Define the rules and player understanding':'Learn what the intention requires',purpose:'Convert uncertainty into a compact progression tied to real work.',steps:s.software?['Name the user, job, and smallest successful workflow.','Map the current system and the failure blocking the core loop.','Learn only the APIs, data rules, or interaction patterns required by the first repair.','Demonstrate understanding with a tiny working slice.']:['Name the real-world task the learning must unlock.','Separate what is known from what must be practiced.','Complete one guided example.','Demonstrate the skill independently.'],progress:[],status:'ready'},{id:uid('path'),type:'skilled-labor',realm:'cerbanimo',title:s.repair?'Restore the smallest complete core loop':s.game?'Build the first playable vertical slice':'Turn the intention into practiced work',purpose:'Create checkpoints and visible proof.',steps:['Define the smallest observable result.','Build the first complete checkpoint.','Capture evidence of what works and what fails.','Revise the next checkpoint from evidence.'],progress:[],status:'ready'}];if(s.material||s.software||s.game||p.collaboration==='group')paths.push({id:uid('path'),type:'material-acquirement',realm:'fellowfare',title:'Acquire the missing resources and help',purpose:'Turn vague needs into fair requests and offers.',steps:['List required tools, access, people, and quantities.','Mark what can be borrowed, traded, repaired, substituted, or purchased.','Create one precise need or offer.','Confirm logistics, ownership, and return conditions.'],progress:[],status:'ready'});return{schema:'civweave.intention-weave.v1',id:uid('weave'),title:title(state.wish),wish:state.wish,outcome:'Turn the Quest goal into an editable route with visible evidence of progress and a clear next checkpoint.',state:'review',createdAt,updatedAt:createdAt,profile:{...p},assumptions:['The first milestone proves the core loop rather than finishing the whole vision.','Roles and commitments remain revisable before activation.','Evidence supports reflection and adjustment, not personal worth.'],paths:paths.slice(0,3),governance:{realm:'anarchadia',title:s.group||s.governance?'Participation and consent agreement':'Personal passport entry',purpose:'Store the intention, boundaries, roles, and review date without turning them into an obligation.',agreements:['Keep activation explicit.','Preserve the right to revise or stop.','Require consent before spending, publishing, voting, or assigning work.','Set a review date.']},requiresExplicitActivation:true}}function canonical(){if(!state.plan)return;const list=parse(localStorage.getItem(I),[]),item={id:state.plan.id,kind:'weave-plan',text:state.plan.title,state:state.plan.state,done:state.plan.state==='completed',createdAt:state.plan.createdAt,updatedAt:state.plan.updatedAt,plan:structuredClone(state.plan)},n=list.findIndex(x=>x.id===item.id);n<0?list.unshift(item):list[n]=item;localStorage.setItem(I,JSON.stringify(list.slice(0,100)))}function handoffs(){if(!state.plan)return;const packets=state.plan.paths.map(path=>({id:uid('handoff'),schema:'civweave.handoff.v1',source:'civweave',target:path.realm,kind:path.type,title:path.title,status:state.plan.state==='active'?'accepted':'review',payload:{weaveId:state.plan.id,wish:state.plan.wish,path,profile:state.plan.profile,manualReviewRequired:true},createdAt:now()}));packets.push({id:uid('handoff'),schema:'civweave.handoff.v1',source:'civweave',target:'anarchadia',kind:'intention-passport',title:state.plan.governance.title,status:state.plan.state==='active'?'accepted':'review',payload:{weaveId:state.plan.id,wish:state.plan.wish,governance:state.plan.governance,manualReviewRequired:true},createdAt:now()});const old=parse(localStorage.getItem(Q),[]).filter(x=>x.payload?.weaveId!==state.plan.id);localStorage.setItem(Q,JSON.stringify([...packets,...old].slice(0,120)))}function wishView(){return`<section class="card cw-wish-entry"><small class="muted">BEGIN HERE · YOUR INTENTION</small><h2>What do you want to make true?</h2><p>Bring the real thing, even if it is unfinished or hard to explain. Weaveling can help turn it into a reviewable Quest without activating anything yet.</p><div class="field full"><label for="wish-input">Your intention</label><textarea id="wish-input" rows="6" maxlength="8000" placeholder="I want to…">${esc(state.wish||'')}</textarea></div><div class="actions"><button class="btn primary" id="submit-wish" type="button">Continue</button></div><details class="cw-wish-secondary"><summary>What happens next?</summary><p class="muted">You will choose how much you want to learn, how you want to work, and any constraints that matter. Civweave then builds a route for you to review before anything becomes active. Guilds and shared Guild Quests stay available from the Campus when you need them.</p></details></section>`}function profileView(){return`<section class="card"><small class="muted">APTITUDE AND LEARNING CHOICE</small><h2>How should this Quest meet you?</h2><div class="field-grid"><div class="field"><label>Current skill level</label><select id="skill-level"><option value="new">New to most of it</option><option value="learning">Some practice</option><option value="comfortable">Comfortable</option><option value="expert">Expert, verify edges</option></select></div><div class="field"><label>Learning mode</label><select id="learning-mode"><option value="practice">Practice while doing</option><option value="learn">Learn first, then build</option><option value="execute">Move into execution</option></select></div><div class="field"><label>Who is involved?</label><select id="collaboration-mode"><option value="solo">Mostly me</option><option value="group">Friends, team, or community</option></select></div><div class="field"><label>Available rhythm</label><select id="weekly-hours"><option>1-2</option><option selected>3-5</option><option>6-10</option><option>10+</option></select></div><div class="field full"><label>Important constraints</label><textarea id="constraints" placeholder="Budget, accessibility, tools, deadlines, safety…"></textarea></div></div><div class="actions"><button class="btn" id="back-wish">Revise Quest</button><button class="btn primary" id="build-plan">Build reviewable Quest</button></div></section>`}function pathCard(path,i,active=false){return`<article class="path" style="--accent:${R[path.realm].color}"><small>${i+1} · ${esc(R[path.realm].name)} · ${esc(path.status)}</small><h3>${esc(path.title)}</h3><p>${esc(path.purpose)}</p>${active?path.steps.map((step,n)=>`<label class="step ${path.progress.includes(n)?'done':''}"><input type="checkbox" data-step="${path.id}:${n}" ${path.progress.includes(n)?'checked':''}><span>${esc(step)}</span></label>`).join(''):`<ol>${path.steps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol><div class="path-tools"><button data-remove="${path.id}">Remove path</button></div>`}</article>`}function reviewView(){return`<section class="card"><small class="muted">REVIEW QUEST · NOT ACTIVE</small><h2>${esc(state.plan.title)}</h2><p>${esc(state.plan.outcome)}</p>${state.plan.paths.map((p,i)=>pathCard(p,i)).join('')}<article class="path" style="--accent:var(--an)"><small>PASSPORT AND CONSENT</small><h3>${esc(state.plan.governance.title)}</h3><p>${esc(state.plan.governance.purpose)}</p><ol>${state.plan.governance.agreements.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></article><div class="actions"><button class="btn" id="revise-plan">Revise Quest</button><button class="btn primary" id="activate-plan" ${state.plan.paths.length?'':'disabled'}>Activate Quest</button></div></section>`}function next(){for(const p of state.plan?.paths||[])for(let i=0;i<p.steps.length;i++)if(!p.progress.includes(i))return{p,i,step:p.steps[i]}}function questModeControls(){return`<section class="quest-mode" aria-label="Quest navigation style"><div><small class="muted">HOW WEAVELING GUIDES THIS QUEST</small><h3>Choose how much structure you want.</h3></div><div class="quest-mode-actions" role="group" aria-label="Quest navigation style"><button class="btn ${state.mode==='guided'?'primary':''}" type="button" data-quest-mode="guided" aria-pressed="${state.mode==='guided'}">Guided rails</button><button class="btn ${state.mode==='roam'?'primary':''}" type="button" data-quest-mode="roam" aria-pressed="${state.mode==='roam'}">Free roam</button></div><p class="muted">Guided rails keeps the next useful checkpoint prominent. Free roam keeps the Quest intact while you choose your own route.</p></section>`}function activeView(){const n=next(),done=state.plan.paths.reduce((a,p)=>a+p.progress.length,0),total=state.plan.paths.reduce((a,p)=>a+p.steps.length,0);return`<section class="card"><small class="muted">${state.plan.state==='completed'?'QUEST COMPLETE':`ACTIVE QUEST · ${done} OF ${total} CHECKPOINTS`}</small><h2>${esc(state.plan.title)}</h2>${questModeControls()}${n&&state.mode==='guided'?`<button class="next" data-open="${n.p.realm}"><small>Next rail · ${esc(R[n.p.realm].name)}</small><strong>${esc(n.step)}</strong></button>`:n?`<p class="muted">Free roam is active. Choose any unfinished checkpoint below; Weaveling will keep the Quest state together.</p>`:''}${state.plan.paths.map((p,i)=>pathCard(p,i,true)).join('')}<article class="path" style="--accent:var(--an)"><small>ANARCHADIA · PASSPORT</small><h3>${esc(state.plan.governance.title)}</h3><button class="btn" data-open="anarchadia">Open</button></article></section>`}function libraryView(){const plans=parse(localStorage.getItem(I),[]).filter(x=>x.kind==='weave-plan');return`<section class="card"><small class="muted">LOCAL QUEST LIBRARY</small><h2>Saved Quests</h2><div class="library">${plans.length?plans.map(x=>`<article><h3>${esc(x.plan.title)}</h3><p class="muted">${esc(x.plan.outcome)}</p><button class="btn" data-load="${x.id}">Open Quest</button></article>`).join(''):'<div class="empty">No saved Quests yet.</div>'}</div></section>`}function campusView(){return`<section class="card"><small class="muted">FIVE CONNECTED SYSTEMS</small><h2>Explore without losing the Quest.</h2><p>Each realm remains independently usable. Civweave carries the active Quest, model route, and reviewable handoffs you approve.</p>${Object.entries(R).map(([id,r])=>`<button class="next" data-open="${id}"><strong>${r.name}</strong></button>`).join('')}</section>`}function render(){welcome();conversation();if(state.view==='weave'||state.view==='progress')state.view='quest';$('#state-label').textContent=state.plan?state.plan.state:'Local draft';$('#view-title').textContent={quest:'Current Quest',library:'Quest Library',campus:'Campus'}[state.view]||'Current Quest';let html=state.view==='library'?libraryView():state.view==='campus'?campusView():state.stage==='profile'?profileView():state.stage==='review'?reviewView():state.stage==='active'?activeView():wishView();$('#workspace').innerHTML=html;bind();$$('[data-view]').forEach(b=>b.classList.toggle('active',(b.dataset.view==='weave'||b.dataset.view==='progress'?'quest':b.dataset.view)===state.view));badges();save()}function bind(){$('#submit-wish')?.addEventListener('click',()=>{const w=clean($('#wish-input').value);if(!w)return;state.wish=w;state.stage='profile';state.view='quest';say('user',w);say('guide','Tell me how much you want to learn, how you want to work, and what constraints matter.');render()});$('#back-wish')?.addEventListener('click',()=>{state.stage='wish';state.view='quest';render()});$('#build-plan')?.addEventListener('click',()=>{state.profile={skill:$('#skill-level').value,learning:$('#learning-mode').value,collaboration:$('#collaboration-mode').value,hours:$('#weekly-hours').value,constraints:clean($('#constraints').value)};state.plan=build();state.stage='review';state.view='quest';canonical();handoffs();say('guide',`I built a reviewable Quest with ${state.plan.paths.length} practical paths and an Anarchadia passport layer. Nothing is active yet.`);render()});$('#activate-plan')?.addEventListener('click',()=>{state.plan.state='active';state.plan.updatedAt=now();state.stage='active';state.view='quest';canonical();handoffs();say('guide','The Quest is active. I can keep the next rail prominent, or you can roam freely without losing the Quest state.');render()});$('#revise-plan')?.addEventListener('click',()=>{state.plan=null;state.stage='wish';state.view='quest';render()});$$('[data-quest-mode]').forEach(b=>b.addEventListener('click',()=>{state.mode=b.dataset.questMode==='roam'?'roam':'guided';save();render()}));$$('[data-remove]').forEach(b=>b.addEventListener('click',()=>{state.plan.paths=state.plan.paths.filter(p=>p.id!==b.dataset.remove);canonical();handoffs();render()}));$$('[data-step]').forEach(c=>c.addEventListener('change',()=>{const [id,n]=c.dataset.step.split(':'),p=state.plan.paths.find(x=>x.id===id),i=Number(n);p.progress=c.checked?[...new Set([...p.progress,i])]:p.progress.filter(x=>x!==i);p.status=p.progress.length===p.steps.length?'completed':p.progress.length?'active':'ready';if(state.plan.paths.every(x=>x.status==='completed'))state.plan.state='completed';state.plan.updatedAt=now();canonical();handoffs();render()}));$$('[data-open]').forEach(b=>b.addEventListener('click',()=>openRealm(b.dataset.open)));$$('[data-load]').forEach(b=>b.addEventListener('click',()=>{const item=parse(localStorage.getItem(I),[]).find(x=>x.id===b.dataset.load);if(item){state.plan=structuredClone(item.plan);state.wish=state.plan.wish;state.stage=state.plan.state==='review'?'review':'active';state.view='quest';render()}}))}function badges(){return true}function openRealm(id){const realm=R[id];if(!realm)return;const inbox=parse(localStorage.getItem(Q),[]).filter(x=>x.target===id&&x.payload?.weaveId===state.plan?.id),context={type:'civweave:context',version:'1.1',model,privacy:{automaticCrossAppEffects:false,secretsShared:false,handoffsRequireReview:true},intention:state.plan?{id:state.plan.id,title:state.plan.title,wish:state.plan.wish,outcome:state.plan.outcome,state:state.plan.state}:null};localStorage.setItem(C,JSON.stringify(context));localStorage.setItem(H,JSON.stringify({target:id,weaveId:state.plan?.id||'',wish:state.plan?.wish||state.wish,plan:state.plan,packets:inbox,preparedAt:now()}));const routes=globalThis.CivweaveSystemRoutesV227;if(routes?.navigate){routes.navigate(id,{version:'1.0.163',source:'civweave',weave:state.plan?.id||''});return}const url=new URL(realm.url,location.origin);if(state.plan?.id)url.searchParams.set('weave',state.plan.id);url.searchParams.set('source','civweave');url.searchParams.set('installed','1');url.searchParams.set('navigation','five-system-route-contract-v227');location.assign(url.href)}function toast(text){const t=$('#toast');t.textContent=text;t.hidden=false;setTimeout(()=>t.hidden=true,2600)}function exportPlan(){if(!state.plan)return toast('Create a Quest first.');const blob=new Blob([JSON.stringify({schema:'civweave.portable-weave.v1',exportedAt:now(),plan:state.plan},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='civweave-quest.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}

function sharedModelSnapshot(detail){const profiles=parse(localStorage.getItem('civweave-model-profiles-v1'),{}),legacy=parse(localStorage.getItem('civweave.universal-ai.v127'),{}),interactive=detail?.interactive||profiles.interactive||legacy||{route:'deterministic',provider:'deterministic',model:'civweave-deterministic-v175',endpoint:'',externalConsent:false};return{...model,...interactive,route:interactive.route||interactive.provider||'deterministic',provider:interactive.provider||interactive.route||'deterministic',consent:Boolean(detail?.consent??legacy.consent??interactive.externalConsent),agenticEnabled:Boolean(detail?.agenticEnabled??profiles.agenticEnabled??legacy.agenticEnabled),agenticModel:detail?.agentic?.model||profiles.agentic?.model||model.agenticModel||'antigravity'}}
function selectedLocalModel(){const live=globalThis.CivweaveLocalModelDownloadV266?.selection?.();if(live?.active&&live.id)return live;return parse(localStorage.getItem('civweave.local-ai.selection.v266'),{active:false,id:null})}
function syncModelState(detail){model=sharedModelSnapshot(detail);return model}
function ensureRuntimeScript(src,ready){if(ready?.())return Promise.resolve(true);return new Promise((resolve,reject)=>{const path=new URL(src,location.href).pathname,existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===path);if(existing){if(ready?.())return resolve(true);existing.addEventListener('load',()=>ready?.()?resolve(true):reject(new Error(`${path} loaded without becoming ready.`)),{once:true});existing.addEventListener('error',()=>reject(new Error(`Could not load ${path}.`)),{once:true});return}const script=document.createElement('script');script.src=`${src}${src.includes('?')?'&':'?'}stability=dom-ready-v282`;script.async=false;script.onload=()=>ready?.()?resolve(true):reject(new Error(`${path} loaded without becoming ready.`));script.onerror=()=>reject(new Error(`Could not load ${path}.`));document.head.append(script)})}
async function ensureDownloadedLocalAISettings(){await ensureRuntimeScript('/app/local-ai/bootstrap-v266.js?v=1.0.83-v282',()=>globalThis.CivweaveLocalAIBootstrapV266?.version==='1.0.83-local-ai-bootstrap-v282-inference-health');const bootstrap=globalThis.CivweaveLocalAIBootstrapV266;if(!bootstrap?.ready)throw new Error('The downloaded local AI bootstrap is unavailable.');const ready=await bootstrap.ready;const capable=Boolean(globalThis.CivweaveLocalModelDownloadV266?.status&&globalThis.CivweaveLocalModelDownloadV266?.selection&&globalThis.CivweaveLocalModelRegistryV266?.installable&&globalThis.CivweaveLocalModelRuntimeV266?.canonicalCausalLM===true&&globalThis.CivweaveLocalModelBridgeV266?.patch&&globalThis.CivweaveLocalAISettingsV266?.enhance);if(!ready||!capable)throw new Error('Downloaded local AI did not become ready.');return true}
function hasResponseLayer(flag){let fn=globalThis.CivweaveAssistantV141?.respond,depth=0;while(typeof fn==='function'&&depth<12){if(fn[flag])return true;fn=fn.__prior;depth++}return false}
const WEAVELING_ORCHESTRATOR_VERSION='1.2.0-weaveling-plan-json-v190-ai-quest-intent';
const WEAVELING_ORCHESTRATOR_SRC='/extensions/civweave-weaveling-plan-json-v190.js?v=1.2.0-ai-quest-intent';
let orchestratorPromise=null;
function currentWeavelingOrchestrator(){const api=globalThis.CivweaveWeavelingPlanJsonV190;return api?.version===WEAVELING_ORCHESTRATOR_VERSION&&api?.install&&api?.createModelPlan&&api?.planIntent?api:null}
function ensureWeavelingOrchestrator(){const ready=currentWeavelingOrchestrator();if(ready){if(!hasResponseLayer('__weavelingPlanJsonV190'))ready.install();return Promise.resolve(true)}if(orchestratorPromise)return orchestratorPromise;orchestratorPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=WEAVELING_ORCHESTRATOR_SRC;script.async=false;script.onload=()=>{const api=currentWeavelingOrchestrator();if(!api){orchestratorPromise=null;reject(new Error(`The Weaveling structured Quest orchestrator did not provide ${WEAVELING_ORCHESTRATOR_VERSION}.`));return}if(!hasResponseLayer('__weavelingPlanJsonV190'))api.install();resolve(true)};script.onerror=()=>{orchestratorPromise=null;reject(new Error('The Weaveling structured Quest orchestrator could not load.'))};document.head.append(script)});return orchestratorPromise}
let memoryPromise=null;
async function loadMemoryScript(src,ready){if(ready?.())return true;return new Promise((resolve,reject)=>{const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===src);if(existing){if(ready?.())resolve(true);else existing.addEventListener('load',()=>ready?.()?resolve(true):reject(new Error(`${src} loaded without its runtime.`)),{once:true});return}const script=document.createElement('script');script.src=`${src}?v=1.0.7-v191`;script.async=false;script.onload=()=>ready?.()?resolve(true):reject(new Error(`${src} loaded without its runtime.`));script.onerror=()=>reject(new Error(`Could not load ${src}.`));document.head.append(script)})}
function ensureWeavelingMemory(){if(globalThis.CivweaveWeavelingMemoryV191&&globalThis.CivweaveWeavelingMemoryBridgeV191){if(!globalThis.CivweaveAssistantV141?.respond?.__weavelingMemoryV191)globalThis.CivweaveWeavelingMemoryBridgeV191.install();return Promise.resolve(true)}if(memoryPromise)return memoryPromise;memoryPromise=(async()=>{await loadMemoryScript('/app/weaveling-memory-v191.js',()=>globalThis.CivweaveWeavelingMemoryV191);await loadMemoryScript('/app/weaveling-memory-bridge-v191.js',()=>globalThis.CivweaveWeavelingMemoryBridgeV191);if(!globalThis.CivweaveAssistantV141?.respond?.__weavelingMemoryV191)globalThis.CivweaveWeavelingMemoryBridgeV191.install();return true})().catch(error=>{memoryPromise=null;throw error});return memoryPromise}
function aiQuestResult(result){if(!result?.plan)return false;if(result?.planControl?.ok===true)return true;return result?.questAuthoring?.aiGenerated===true&&result?.plan?.authoring?.aiGenerated===true&&result?.plan?.authoring?.mode==='model-structured-json'}
function syncPlanResult(result){if(!aiQuestResult(result))return;state.plan=structuredClone(result.plan);state.wish=state.plan.wish||state.wish;state.stage=state.plan.state==='active'?'active':'review';state.view='quest';canonical();handoffs()}
let weavelingBusy=false;
function setWeavelingBusy(busy,status='Local working memory · durable project memory'){weavelingBusy=busy;const form=$('#weaveling-chat-form'),input=$('#weaveling-chat-input'),button=$('#weaveling-chat-send'),output=$('#weaveling-chat-status');form?.classList.toggle('is-busy',busy);if(input)input.disabled=busy;if(button){button.disabled=busy;button.textContent=busy?'Sending…':'Send'}if(output)output.textContent=status}
function localInferenceProgress(event){if(!weavelingBusy)return;const d=event?.detail||{},output=$('#weaveling-chat-status');if(!output)return;const phase=String(d.phase||'').replace(/^local-model-progress$/,'working').replaceAll('-',' '),pct=Number.isFinite(Number(d.progress))?` · ${Math.round(Number(d.progress)*100)}%`:'';output.textContent=`${d.model||'Downloaded model'} · ${phase}${pct}`}
async function sendWeaveling(event){event.preventDefault();if(weavelingBusy)return;const input=$('#weaveling-chat-input'),text=clean(input?.value);if(!text)return;say('user',text);input.value='';setWeavelingBusy(true,'Weaveling is reading working memory, durable project memory, and the selected AI route…');try{const loader=globalThis.CivweaveFamilyAILoaderV105;if(!loader?.ensure)throw new Error('The shared guide loader is unavailable.');await loader.ensure();const localSelection=selectedLocalModel();if(localSelection.active){await ensureDownloadedLocalAISettings();if(!globalThis.CivweaveLocalModelBridgeV266?.patch?.())throw new Error('The selected downloaded model could not attach to the interactive model runtime.')}await ensureWeavelingOrchestrator();await ensureWeavelingMemory();const assistant=globalThis.CivweaveAssistantV141;if(!assistant?.respond)throw new Error('The shared guide runtime did not become ready.');const history=state.conversation.slice(-24).map(item=>({role:item.role==='guide'?'assistant':'user',text:item.text})),result=await assistant.respond({text,systemId:'civweave',history});if(localSelection.active&&result?.provider==='local-contract'){const label=globalThis.CivweaveLocalModelRegistryV266?.byId?.(localSelection.id)?.label||localSelection.id,reason=clean(result?.fallbackFrom?.reason||'',320);throw new Error(`${label} is selected, but its on-device inference call failed${reason?`: ${reason}`:''}. Civweave did not substitute deterministic chat.`)}const answer=clean(result?.response?.answer||'Weaveling returned no text.'),next=clean(result?.response?.choice?.nextAction),reply=next?`${answer}\n\nNext: ${next}`:answer;syncPlanResult(result);say('guide',reply);render();const memory=globalThis.CivweaveWeavelingMemoryV191,status=memory?`${memory.readLong().length} durable memories · ${result?.provider||model.provider||'deterministic'}${result?.model?` · ${result.model}`:''}`:`${result?.provider||model.provider||'deterministic'}${result?.model?` · ${result.model}`:''}`;setWeavelingBusy(false,status)}catch(error){say('guide',`Weaveling could not complete this call: ${error.message}`);setWeavelingBusy(false,'The call did not complete. Your message remains in local history.')}finally{input?.focus()}}
function openWorkingCampusView(view='quest'){const target=view==='weave'||view==='progress'?'quest':String(view||'quest');if(!['quest','library','campus'].includes(target))return false;state.view=target;render();return true}
function openCampusMap(){openWorkingCampusView('campus');requestAnimationFrame(()=>document.querySelector('#workspace')?.scrollIntoView?.({behavior:'smooth',block:'start'}));return true}
function registerCampusMap(){const existing=globalThis.CivweaveMapSystem;if(!existing?.open)globalThis.CivweaveMapSystem=Object.freeze({version:'1.0.60-working-campus-map-v267',open:openCampusMap});globalThis.CivweaveMapLaunchV243?.register?.({open:openCampusMap});dispatchEvent(new CustomEvent('civweave:map-ready',{detail:{open:openCampusMap,source:'working-campus-v267'}}));return true}
addEventListener('civweave:map-open-request',event=>{if(!event?.detail)return;event.detail.handled=true;event.detail.open=openCampusMap;event.preventDefault();openCampusMap()});
addEventListener('civweave:working-campus-view-request',event=>{const detail=event?.detail||{};if(openWorkingCampusView(detail.view)){detail.handled=true;detail.opened=true}});
addEventListener('civweave:local-model-selection',event=>{syncModelState();const local=event.detail;if(local?.active)toast(`${globalThis.CivweaveLocalModelRegistryV266?.byId?.(local.id)?.label||local.id} selected for interactive chat.`)});
addEventListener('civweave:local-model-inference-progress',localInferenceProgress);
$('#brand-home').addEventListener('click',()=>openWorkingCampusView('quest'));$('#weaveling-chat-form')?.addEventListener('submit',sendWeaveling);addEventListener('civweave:model-settings-saved',event=>{syncModelState(event.detail);toast('Civweave AI settings saved for every guide.')});$('#export-button').addEventListener('click',exportPlan);globalThis.CivweaveWorkingCampusV156=Object.freeze({version:'1.0.164-ai-quest-provenance-v434',openView:openWorkingCampusView,openQuest:()=>openWorkingCampusView('quest'),openLibrary:()=>openWorkingCampusView('library'),openCampus:()=>openWorkingCampusView('campus'),currentView:()=>state.view,questMode:()=>state.mode,legacyNavigationControls:false,aiQuestProvenanceRequired:true});void ensureRuntimeScript('/app/usability-progressive-disclosure-v1.js?v=1.0.0',()=>globalThis.CivweaveProgressiveDisclosureV1).catch(()=>{});syncModelState();render();registerCampusMap()})();
/* CIVWEAVE_FAST_BOOT_CORE_END */
}
async function boot(){
  if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true,signal:controller.signal}));
  installBrandPresentation();installDiagnosticsPolicy();installHeaderHitSafety();repairPersistedCampusState();installWebEntryPrompt();
  if(!campusReady())throw new Error(`Working Campus DOM contract is incomplete: ${missingRequired().join(', ')||'campus root'}.`);
  await ensureRouteContract();
  installPersistentChatLauncherOwnership();
  if(!liveDocument())throw new DOMException('Working Campus navigation interrupted startup.','AbortError');
  runCompiledCore();
  document.documentElement.dataset.civweaveCampusRuntime='ready';
  document.documentElement.dataset.civweaveFastBoot=FAST_BOOT_REVISION;
  dispatchEvent(new CustomEvent('civweave:working-campus-runtime-ready',{detail:{revision:REVISION,fastBootRevision:FAST_BOOT_REVISION,brandRevision:BRAND_REVISION,brandCycleRevision:BRAND_CYCLE_REVISION,webEntryRevision:WEB_ENTRY_REVISION,hubRevision:HUB_REVISION,stateRepairRevision:STATE_REPAIR_REVISION,parts:COMPILED_PART_COUNT,coreDelivery:'compiled-single-asset',runtimeSourceFetches:0,runtimeStringCompilation:false,hubBlocking:false,at:new Date().toISOString(),policy:'canonical-core-only-single-shell-context',questStatePolicy:'current-quest-single-surface'}}));
  scheduleHubHydration();
}
boot().catch(error=>{
  if(!active||error?.name==='AbortError')return;console.error('[Civweave] Working Campus failed to start.',error);const node=document.querySelector('#workspace');if(node)node.innerHTML=`<section class="card"><h2>Working Campus could not start</h2><p>${String(error.message||error)}</p><button class="btn" onclick="location.reload()">Retry</button></section>`;
});
})();
