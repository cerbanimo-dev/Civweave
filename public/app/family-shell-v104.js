(()=>{
'use strict';

import('/app/safe-mode-v1.mjs?v=safe-mode-v1')
  .then(module=>module.default?.install?.())
  .catch(error=>console.warn('[Civweave S.A.F.E.]',error));

const VERSION='1.0.6-family-nav-delegated-v178';
const STATUS_KEY='civweave.family-status.v105';
const SYSTEM_ORDER=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const SYSTEMS={
  civweave:{label:'Civweave',place:'Intention Loom',guide:'Weaveling',site:'/app/working-campus-v156.html',artifact:'/app/assets/ai/weaveling-compass.png',avatar:'/app/assets/ai/weaveling.png'},
  'living-school':{label:'Living School',place:'Learning Map',guide:'Moss',site:'/app/cabinets/living-school/index.html?cabinet=1',artifact:'/app/assets/ai/moss-acorn.png',avatar:'/app/assets/ai/moss.png'},
  cerbanimo:{label:'Cerbanimo',place:'Quest Console',guide:'Kamiya',site:'/app/realm-console-v140.html?system=cerbanimo&cabinet=1',artifact:'/app/assets/ai/kamiya-gift.png',avatar:'/app/assets/ai/kamiya.png'},
  fellowfare:{label:'FellowFare',place:'Exchange Workbench',guide:'Rook',site:'/app/fellowfare-cabinet-v144.html?cabinet=1',artifact:'/app/assets/ai/rook-coin-button.png',avatar:'/app/assets/ai/rook.png'},
  anarchadia:{label:'Anarchadia',place:'Citizen Console',guide:'Merlin',site:'/app/anarchadia-console-v139.html?cabinet=1',artifact:'/app/assets/ai/merlin-hat.png',avatar:'/app/assets/ai/merlin.png'}
};

const CODE_FENCE=/```(?:javascript|js|jsx|typescript|ts|tsx|json|html|css)?\s*([\s\S]*?)```/i;
const GENERATION_REQUEST=/\b(generate|write|rewrite|implement|modify|change|fix|patch|build|create)\b[\s\S]{0,140}\b(code|source|file|component|function|css|html|javascript|typescript|repository|app)\b/i;
const VALIDATION_REQUEST=/\b(validate|verify|check|review|audit|test)\b[\s\S]{0,120}\b(code|source|submission|patch|diff|rails?|criteria)\b/i;

const parse=(value,fallback)=>{try{const out=JSON.parse(value);return out==null?fallback:out}catch{return fallback}};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const array=key=>{const value=parse(localStorage.getItem(key),[]);return Array.isArray(value)?value:[]};
const object=key=>{const value=parse(localStorage.getItem(key),{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}};
const timestamp=item=>Date.parse(item?.updatedAt||item?.createdAt||item?.time||item?.at||item?.savedAt||0)||0;
const nonSeedFellowFare=item=>!/^([tmp]|pr|ag|a|c|ev)[1-9]\d*$/.test(String(item?.id||''));

let loaderPatched=false;
let assistantPatched=false;

function detect(){
  const query=new URLSearchParams(location.search).get('system');
  if(SYSTEMS[query])return query;
  if(document.documentElement.hasAttribute('data-living-school-cabinet')||location.pathname.includes('/cabinets/living-school/'))return'living-school';
  if(location.pathname.includes('fellowfare'))return'fellowfare';
  if(location.pathname.includes('anarchadia'))return'anarchadia';
  if(location.pathname.includes('realm-console-v140.html'))return query==='civweave'?'civweave':'cerbanimo';
  return'civweave';
}

function readStatusStore(){
  const store=object(STATUS_KEY);
  store.visits=store.visits&&typeof store.visits==='object'?store.visits:{};
  return store;
}
function seedVisits(){
  const store=readStatusStore();
  if(!Object.keys(store.visits).length){
    const at=Date.now();
    for(const id of SYSTEM_ORDER)store.visits[id]=at;
    localStorage.setItem(STATUS_KEY,JSON.stringify(store));
  }
  return store;
}
function markVisited(system){
  const store=seedVisits();
  store.visits[system]=Date.now();
  localStorage.setItem(STATUS_KEY,JSON.stringify(store));
}
function actionable(system){
  if(system==='civweave')return array('civweave.intentions.v127').filter(item=>item?.kind==='weave-plan'&&(item.state==='review'||item.plan?.state==='review'));
  if(system==='living-school')return array('civweave.living-school.intake.v152').filter(item=>['ready','review'].includes(item?.status||item?.state));
  if(system==='cerbanimo')return [
    ...array('civweave.cerbanimo.quest-queue.v1').filter(item=>['review','ready','blocked'].includes(item?.state)),
    ...array('civweave.realm-actions.v141').filter(item=>item?.system==='cerbanimo'&&['clarifying','review'].includes(item?.state))
  ];
  if(system==='fellowfare'){
    const native=object('fellowfare.mvp.state.v3');
    const messages=Array.isArray(native.messages)?native.messages.filter(item=>item?.read===false&&nonSeedFellowFare(item)):[];
    return [
      ...array('civweave.fellowfare.resource-queue.v152').filter(item=>['review','ready','blocked'].includes(item?.status||item?.state)),
      ...array('civweave.fellowfare.pending-threads.v1').filter(item=>['draft','review'].includes(item?.status)),
      ...messages
    ];
  }
  const native=object('civweave.anarchadia.citizen-console.v139');
  const proposals=Array.isArray(native.proposals)?native.proposals.filter(item=>['open','review'].includes(item?.state||item?.status)):[];
  return [
    ...proposals,
    ...array('civweave.realm-actions.v141').filter(item=>item?.system==='anarchadia'&&['clarifying','review'].includes(item?.state))
  ];
}
function state(system){
  const actions=actionable(system);
  if(system==='civweave'){
    const active=array('civweave.intentions.v127').some(item=>item?.state==='active'||item?.plan?.state==='active');
    return actions.length?{kind:'attention',label:'Review'}:active?{kind:'active',label:'Active'}:{kind:'ready',label:'Ready'};
  }
  if(system==='living-school'){
    const school=object('civweave.living-school.cabinet.v151').school;
    return actions.length?{kind:'attention',label:'Path ready'}:school?{kind:'active',label:'Learning'}:{kind:'ready',label:'Ready'};
  }
  if(system==='cerbanimo'){
    const active=array('civweave.cerbanimo.quest-queue.v1').some(item=>item?.state==='active')
      ||array('civweave.realm-actions.v141').some(item=>item?.system==='cerbanimo'&&['active','published'].includes(item?.state));
    return actions.length?{kind:'attention',label:'Review'}:active?{kind:'active',label:'Active'}:{kind:'ready',label:'Ready'};
  }
  if(system==='fellowfare'){
    const native=object('fellowfare.mvp.state.v3');
    const active=Array.isArray(native.threads)&&native.threads.some(item=>nonSeedFellowFare(item)&&!['closed','fulfilled','cancelled'].includes(item?.status));
    return actions.length?{kind:'attention',label:'Review'}:active?{kind:'active',label:'Exchange'}:{kind:'ready',label:'Ready'};
  }
  const passport=object('civweave.anarchadia.passport.v152');
  return actions.length?{kind:'attention',label:'Review'}:passport.activeIntentionId?{kind:'active',label:'Active'}:{kind:'ready',label:'Ready'};
}
function status(system){
  const store=seedVisits();
  const last=Number(store.visits[system]||Date.now());
  const items=actionable(system);
  const count=items.filter(item=>timestamp(item)>last).length;
  const live=state(system);
  return{count,state:live.kind,label:live.label,total:items.length};
}
function route(system){
  if(SYSTEMS[system])location.assign(SYSTEMS[system].site);
}

function restoreChatControl(){
  const button=document.querySelector('#cwf104-head [data-cwf-chat]');
  if(!button)return;
  button.setAttribute('aria-label',`Talk to Civweave with Weaveling from ${SYSTEMS[detect()].label}`);
  button.title='Talk to Civweave';
  if(button.querySelector('img'))return;
  button.textContent='';
  const image=document.createElement('img');
  image.src=SYSTEMS.civweave.artifact;
  image.alt='';
  button.append(image);
}
function removeLegacyLaunchers(){
  document.querySelectorAll('#gc153-launcher,.gc153-launcher,[data-civweave-bottom-launcher],[data-weaveling-launcher]').forEach(node=>node.remove());
}
async function openChat(system=detect(),prefill=''){
  const result=globalThis.CivweaveFamilyAILoaderV105?.openChat?.('civweave',{prefill,contextSystem:system});
  restoreChatControl();
  removeLegacyLaunchers();
  return result;
}
function installMerlinitesStyle(){
  if(document.querySelector('link[data-merlinites-shell-v166]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='/app/merlinites-shell-fix-v166.css?v=merlinites-r2';
  link.dataset.merlinitesShellV166='';
  document.head.append(link);
}

function readProvider(){
  const legacy=object('civweave.universal-ai.v127');
  const profiles=object('civweave-model-profiles-v1');
  const interactive=profiles.interactive||legacy;
  return String(interactive?.provider||interactive?.route||'bundled').toLowerCase();
}
function isBundledProvider(){
  return['bundled','packaged','reflex','minilm','local-reflex','smollm2','deterministic','browser',''].includes(readProvider());
}
function railCriteria(system){
  const actions=array('civweave.realm-actions.v141').filter(item=>item?.system===system);
  const action=actions[0]||{};
  const quest=array('civweave.cerbanimo.quest-queue.v1')[0]||{};
  return[
    ...(action.acceptanceCriteria||[]),
    ...(action.checkpoints||[]),
    ...(quest.acceptanceCriteria||[]),
    ...(quest.proofRequirements||[])
  ].filter(Boolean).slice(0,20);
}
function syntaxCheck(code,language='javascript'){
  const kind=String(language||'javascript').toLowerCase();
  try{
    if(/json/.test(kind)){JSON.parse(code);return{ok:true,state:'pass',error:''}}
    if(/^(javascript|js|ecmascript)$/.test(kind)){new Function(code);return{ok:true,state:'pass',error:''}}
    return{ok:null,state:'review',error:`No deterministic ${kind||'unknown'} parser is installed on this device.`};
  }catch(error){
    const message=clean(error.message,600);
    if(/unsafe-eval|content security policy/i.test(message))return{ok:null,state:'review',error:'The browser blocked the local JavaScript parser under its content-security policy.'};
    return{ok:false,state:'fail',error:message};
  }
}
function compilePattern(value,flags='i'){
  try{return value instanceof RegExp?value:new RegExp(String(value),String(flags||'i').replace(/[^gimsuy]/g,''))}catch{return null}
}
function normalizeRail(item,index){
  if(typeof item==='string')return{id:`rail-${index+1}`,label:clean(item,600),type:'advisory'};
  const row=item&&typeof item==='object'?item:{};
  const label=clean(row.label||row.description||row.title||`Rail ${index+1}`,600);
  let type=clean(row.type||row.kind,80).toLowerCase();
  if(!type)type=row.pattern!=null?'required-pattern':row.notPattern!=null||row.forbiddenPattern!=null?'forbidden-pattern':row.maxBytes!=null?'max-bytes':'advisory';
  return{id:clean(row.id,120)||`rail-${index+1}`,label,type,pattern:row.pattern??row.requiredPattern,notPattern:row.notPattern??row.forbiddenPattern,maxBytes:Number(row.maxBytes)||0,flags:clean(row.flags,12)||'i'};
}
function validateCodeRails({code='',language='javascript',criteria=[],rules={}}={}){
  code=clean(code,120000);
  const rails=(Array.isArray(criteria)?criteria:[]).map(normalizeRail).filter(item=>item.label);
  const findings=[];
  const syntax=syntaxCheck(code,language);
  if(!code)findings.push({level:'fail',rail:'submission',message:'No code was submitted.',deterministic:true});
  else findings.push({level:syntax.state,rail:'syntax',message:syntax.ok===true?'The submitted source parses under the available local parser.':syntax.error,deterministic:syntax.ok!==null});

  const forbidden=[...(rules.forbiddenPatterns||[])];
  if(rules.forbidDynamicCode!==false)forbidden.push(/\beval\s*\(/i,/\bnew\s+Function\s*\(/i);
  for(const pattern of forbidden){
    const rx=compilePattern(pattern);
    if(!rx){
      findings.push({level:'review',rail:'forbidden-pattern',message:`A forbidden-pattern rail could not be compiled: ${String(pattern)}`,deterministic:false});
      continue;
    }
    const matched=rx.test(code);
    findings.push({level:matched?'fail':'pass',rail:'forbidden-pattern',message:matched?`Matched forbidden pattern: ${rx}`:`Did not match forbidden pattern: ${rx}`,deterministic:true});
  }

  let deterministicRailCount=0;
  for(const item of rails){
    if(item.type==='required-pattern'){
      const rx=compilePattern(item.pattern,item.flags);
      if(!rx){findings.push({level:'review',rail:item.id,message:`“${item.label}” has an invalid required pattern.`,deterministic:false});continue}
      deterministicRailCount++;
      const matched=rx.test(code);
      findings.push({level:matched?'pass':'fail',rail:item.id,message:matched?`Passed: ${item.label}`:`Failed required pattern: ${item.label}`,deterministic:true});
      continue;
    }
    if(item.type==='forbidden-pattern'){
      const rx=compilePattern(item.notPattern,item.flags);
      if(!rx){findings.push({level:'review',rail:item.id,message:`“${item.label}” has an invalid forbidden pattern.`,deterministic:false});continue}
      deterministicRailCount++;
      const matched=rx.test(code);
      findings.push({level:matched?'fail':'pass',rail:item.id,message:matched?`Failed forbidden pattern: ${item.label}`:`Passed: ${item.label}`,deterministic:true});
      continue;
    }
    if(item.type==='max-bytes'){
      deterministicRailCount++;
      const bytes=new TextEncoder().encode(code).byteLength;
      findings.push({level:bytes<=item.maxBytes?'pass':'fail',rail:item.id,message:bytes<=item.maxBytes?`Passed: ${item.label} (${bytes}/${item.maxBytes} bytes).`:`Failed: ${item.label} (${bytes}/${item.maxBytes} bytes).`,deterministic:true});
      continue;
    }
    findings.push({level:'review',rail:item.id,message:`“${item.label}” is a human-readable rail. It needs a machine-readable test, attached test receipt, or reviewer decision.`,deterministic:false});
  }
  if(!rails.length)findings.push({level:'review',rail:'acceptance-rails',message:'No acceptance rails were supplied with the submission.',deterministic:false});
  else if(!deterministicRailCount)findings.push({level:'review',rail:'acceptance-rails',message:'The supplied acceptance rails are descriptive only. Convert them to machine-readable rules or attach test receipts before approval.',deterministic:false});

  const failed=findings.some(item=>item.level==='fail');
  const review=findings.some(item=>item.level==='review');
  const resultStatus=failed?'fail':review?'review':'pass';
  return{
    schema:'civweave.code-rails-review.v1',
    engine:'merlinites-deterministic-rails',
    authority:'deterministic-static-checks-with-semantic-advisory-only',
    language,
    syntax,
    findings,
    status:resultStatus,
    deterministicRailCount,
    canGenerate:false,
    autoApply:false,
    verified:resultStatus==='pass'&&deterministicRailCount>0,
    nextAction:failed?'Correct the failing deterministic checks before review.':review?'Run the declared tests and attach inspectable evidence for every unresolved rail.':'All declared local checks passed. Preserve the receipts before approval.'
  };
}
function resultText(review){
  const lines=review.findings.slice(0,12).map(item=>`${item.level.toUpperCase()}: ${item.message}`);
  return[`Local rail review: ${review.status.toUpperCase()}.`,...lines,review.nextAction,'MiniLM may help map code or evidence to a rail, but it does not prove correctness or generate a repair.'].join('\n');
}
function patchAssistantBoundary(){
  const api=globalThis.CivweaveAssistantV141;
  if(!api?.respond||api.__cwf104CodeBoundary){
    assistantPatched=Boolean(api?.__cwf104CodeBoundary);
    return;
  }
  const original=api.respond.bind(api);
  api.respond=async options=>{
    const text=clean(options?.text,12000);
    const system=options?.systemId||detect();
    if(isBundledProvider()&&VALIDATION_REQUEST.test(text)){
      const match=text.match(CODE_FENCE);
      const code=match?.[1]||'';
      const review=validateCodeRails({code,language:(text.match(/```([a-z0-9+-]+)/i)||[])[1]||'javascript',criteria:railCriteria(system)});
      return{
        response:{
          answer:resultText(review),
          choice:{mode:'Validate',system,room:'',nextAction:review.nextAction},
          assumptions:['Only explicit local rails and static checks were evaluated.'],
          requiresConsent:false,
          confidence:.98
        },
        provider:'local-rails-validator',
        requestedProvider:'bundled',
        model:'merlinites-code-rails-v1',
        review,
        context:null,
        fallbackFrom:null
      };
    }
    if(isBundledProvider()&&GENERATION_REQUEST.test(text)){
      return{
        response:{
          answer:'The onboard runtime cannot generate or rewrite code. It can validate code you submit against explicit rails, route it to the right review surface, and report missing evidence. Connect an imported LLM route before requesting code generation.',
          choice:{mode:'Validate',system,room:'',nextAction:'Paste the code for local rail validation, or connect an imported LLM in settings.'},
          assumptions:[],
          requiresConsent:false,
          confidence:.99
        },
        provider:'local-capability-boundary',
        requestedProvider:'bundled',
        model:'merlinites-no-generation-contract',
        context:null,
        fallbackFrom:null
      };
    }
    return original(options);
  };
  Object.defineProperty(api,'__cwf104CodeBoundary',{value:true});
  assistantPatched=true;
}
function patchLoader(){
  const api=globalThis.CivweaveFamilyAILoaderV105;
  if(!api||loaderPatched)return;
  const originalEnsure=api.ensure?.bind(api);
  const originalOpenChat=api.openChat?.bind(api);
  if(originalEnsure)api.ensure=async(...args)=>{const value=await originalEnsure(...args);patchAssistantBoundary();return value};
  if(originalOpenChat)api.openChat=(...args)=>{const value=originalOpenChat(...args);restoreChatControl();removeLegacyLaunchers();return value};
  loaderPatched=true;
}
function livingSchoolRecovery(){
  if(detect()!=='living-school')return;
  setTimeout(async()=>{
    const room=document.getElementById('room');
    if(!room||room.children.length||globalThis.LivingSchoolCabinetV151)return;
    try{
      await import('/app/cabinets/living-school/living-school-cabinet-v151.mjs?recovery=merlinites-r3');
    }catch(error){
      room.innerHTML=`<section class="ls-recovery"><small>LOCAL STARTUP RECOVERY</small><h1>Living School did not finish opening.</h1><p>${esc(error.message)}</p><button type="button" data-ls-recovery-reset>Back up and reset this damaged local view</button></section>`;
      room.querySelector('[data-ls-recovery-reset]')?.addEventListener('click',()=>{
        const key='civweave.living-school.cabinet.v151';
        const value=localStorage.getItem(key);
        if(value)localStorage.setItem(`${key}.recovery-backup.${Date.now()}`,value);
        localStorage.removeItem(key);
        location.reload();
      });
    }
  },1200);
}

function build(){
  installMerlinitesStyle();
  const current=detect();
  const item=SYSTEMS[current];
  seedVisits();
  markVisited(current);
  document.documentElement.classList.add('cwf104-active');
  document.documentElement.dataset.civweaveSystem=current;
  document.documentElement.dataset.familyShell='direct';
  document.documentElement.dataset.visualShell='merlinites-r1';
  document.documentElement.dataset.familyNavigationOwner='themed-system-nav-v178';

  // family-shell-v104 owns realm header/status/chat only.
  // Five-system navigation is exclusively owned by themed-system-nav-v178.
  let head=document.getElementById('cwf104-head');
  if(!head){
    head=document.createElement('header');
    head.id='cwf104-head';
    head.className='cwf104-head';
    document.body.append(head);
  }
  head.innerHTML=`<div class="cwf104-realm-mark" aria-hidden="true"><img src="${item.artifact}" alt=""></div><div class="cwf104-title"><small>${esc(item.place)}</small><b>${esc(item.label)}</b></div><div class="cwf104-head-state"><i class="cwf104-dot"></i><span data-cwf-current-state>Ready</span></div><button class="cwf104-chat" type="button" data-cwf-chat aria-label="Talk to Civweave with Weaveling from ${esc(item.label)}"><img src="${SYSTEMS.civweave.artifact}" alt=""></button><button class="cwf104-settings" type="button" data-open-unified-ai-settings aria-label="Open Civweave settings"><span aria-hidden="true">⚙</span></button>`;
  head.querySelector('[data-cwf-chat]').onclick=()=>openChat(current);

  removeLegacyLaunchers();
  patchLoader();
  refresh();
  livingSchoolRecovery();
}
function refresh(){
  removeLegacyLaunchers();
  restoreChatControl();
  patchLoader();
  patchAssistantBoundary();
  const current=detect();
  const currentState=status(current);
  const head=document.getElementById('cwf104-head');
  if(head){
    head.classList.remove('is-ready','is-attention','is-active');
    head.classList.add(`is-${currentState.state}`);
    const label=head.querySelector('[data-cwf-current-state]');
    if(label)label.textContent=currentState.label;
  }
}
function bind(){
  document.addEventListener('click',event=>{
    const target=event.target;
    if(target.closest?.('[data-cwf-chat],[data-action="chat"],[data-guide-chat="civweave"]')){
      event.preventDefault();
      event.stopImmediatePropagation();
      openChat(detect());
    }
  },true);
  addEventListener('storage',refresh);
  addEventListener('focus',refresh);
  addEventListener('civweave:intentions-changed',refresh);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){markVisited(detect());refresh()}});
  document.addEventListener('click',()=>setTimeout(refresh,80),{passive:true});
  setInterval(refresh,30000);
}
function boot(){
  build();
  bind();
  requestAnimationFrame(()=>document.documentElement.dataset.familyReady='true');
}

document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();

globalThis.CivweaveCodeRailsV169={version:'1.0.4',validate:validateCodeRails,canGenerate:false};
globalThis.CivweaveFamilyShellV104={
  version:VERSION,
  systems:SYSTEMS,
  systemOrder:SYSTEM_ORDER,
  detect,
  status,
  state,
  actionable,
  markVisited,
  route,
  refresh,
  openChat,
  validateCodeRails,
  settingsOwner:'settings-gateway-v317',
  settingsInputOwnership:false,
  familyNavigationOwner:'themed-system-nav-v178',
  familyNavigationOwnership:false
};
})();
