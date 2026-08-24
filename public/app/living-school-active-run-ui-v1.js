(()=>{
'use strict';
const VERSION='1.2.0-living-school-active-run-ui-v1-generation-rail';
const GENERATE='[data-ls-action="generate-curriculum"]';
const REPORT='#lsc220-generation-recovery';
const PACK_DIALOG='dialog[data-living-school-media-pack-offer]';
const PACK_CHECK_ATTR='livingSchoolPackOfferCheck';
const RAIL_ID='lsc-living-school-generation-run-rail';
const STYLE_ID='lsc-living-school-generation-run-style';
const ROUTING_NOTICE_ID='cw-gemini-task-tier-notice-v213';
const ROUTE_EVENT='civweave:gemini-task-tier-selected';
const STAGE_EVENT='civweave:living-school-curriculum-stage';
let queued=false;
let packOfferToken=0;
let wasRunning=false;
let session=null;
let selectedRun=-1;
let runTimer=0;
let lastRouteSignature='';
let lastRouteAt=0;
const nowMs=()=>Date.now();
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
function active(button){
  if(!button)return false;
  const label=String(button.textContent||'');
  return button.getAttribute('aria-busy')==='true'||(button.disabled&&/researching|generating|regenerating|completing/i.test(label));
}
function isLivingSchoolPurpose(value){return /^living-school-/.test(clean(value,220).toLowerCase())}
function formatElapsed(ms){const seconds=Math.max(0,Math.floor((Number(ms)||0)/1000)),minutes=Math.floor(seconds/60),rest=seconds%60;return`${minutes}:${String(rest).padStart(2,'0')}`}
function modelLabel(model,tier=''){
  const value=clean(model,180).toLowerCase();
  if(value.includes('3.7'))return'Gemini 3.7 Flash';
  if(value.includes('3.5'))return'Gemini 3.5 Flash';
  if(value.includes('flash-lite'))return'Gemini 3.1 Flash-Lite';
  if(value)return clean(model,180);
  return tier==='complex'?'Gemini 3.7 Flash':'Gemini Lite';
}
function purposeLabel(purpose){
  const value=clean(purpose,220).toLowerCase();
  if(value.includes('research-grounded-curriculum'))return'Curriculum design';
  if(value.includes('training-data-research-fallback'))return'Research fallback';
  if(value.includes('local-source-synthesis'))return'Source synthesis';
  if(value.includes('structure-single'))return'Module structure';
  if(value.includes('module-depth-expansion'))return'Lesson expansion';
  if(value.includes('quiz-delta-completion'))return'Quiz completion';
  if(value.includes('quiz-question-contract-repair'))return'Quiz repair';
  return clean(value.replace(/^living-school-/,'').replace(/-v\d+(?:\.\d+)?$/,'').replace(/-/g,' '),80)||'Living School generation';
}
function phaseLabel(stage){
  const value=clean(stage,120).toLowerCase();
  if(value==='researching')return'Researching sources';
  if(value==='generating')return'Generating curriculum';
  if(value==='repairing-quiz')return'Completing assessments';
  if(value==='complete')return'Curriculum ready';
  if(value.includes('research'))return'Researching';
  if(value.includes('structur'))return'Building modules';
  if(value.includes('video'))return'Resolving video companions';
  return value?value.replace(/-/g,' '):'Preparing generation';
}
function installRailStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;
  style.textContent=`
#${RAIL_ID}{margin-top:14px;padding:13px 14px;border:1px solid rgba(111,226,163,.35);border-radius:14px;background:linear-gradient(145deg,rgba(5,34,27,.96),rgba(5,21,24,.95));box-shadow:inset 0 1px 0 rgba(255,255,255,.035);color:#e9f7ed}
#${RAIL_ID}[hidden]{display:none!important}
#${RAIL_ID} .lsc-run-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
#${RAIL_ID} .lsc-run-head b{font-size:.83rem;letter-spacing:.04em;text-transform:uppercase;color:#c8f4d8}
#${RAIL_ID} .lsc-run-time{font:700 .78rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;color:#9edcb5}
#${RAIL_ID} .lsc-run-phase{margin-top:5px;font-size:.92rem;font-weight:780;color:#f4efd2}
#${RAIL_ID} .lsc-run-dots{display:flex;align-items:center;gap:9px;min-height:34px;margin:10px 0 7px;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:thin}
#${RAIL_ID} .lsc-run-dot{appearance:none;display:block;flex:0 0 auto;width:12px;height:12px;padding:0;border:2px solid rgba(183,221,194,.58);border-radius:50%;background:rgba(216,238,220,.12);box-shadow:none;cursor:pointer;transition:transform .16s ease,background .16s ease,border-color .16s ease,box-shadow .16s ease}
#${RAIL_ID} .lsc-run-dot.is-complex{width:23px;height:23px;border-width:3px}
#${RAIL_ID} .lsc-run-dot.is-active{border-color:#f2d67f;background:#4f8e66;box-shadow:0 0 0 5px rgba(242,214,127,.10),0 0 20px rgba(111,226,163,.28);animation:lscRunPulse 1.25s ease-in-out infinite}
#${RAIL_ID} .lsc-run-dot.is-complete{border-color:#7ce1a2;background:#376f50}
#${RAIL_ID} .lsc-run-dot.is-failed{border-color:#ff988a;background:#7b3d3b}
#${RAIL_ID} .lsc-run-dot.is-selected{outline:2px solid rgba(244,239,210,.62);outline-offset:3px}
#${RAIL_ID} .lsc-run-detail{font-size:.78rem;line-height:1.42;color:#cfe2d5;min-height:1.15em}
#${RAIL_ID} .lsc-run-detail strong{color:#f6f0d5}
#${RAIL_ID} .lsc-run-summary{margin-top:4px;font-size:.72rem;color:#8eb9a0}
#${RAIL_ID} .lsc-run-legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;font-size:.68rem;color:#84ad95}
#${RAIL_ID} .lsc-run-legend span{display:inline-flex;align-items:center;gap:6px}
#${RAIL_ID} .lsc-run-key{display:inline-block;width:8px;height:8px;border:1px solid currentColor;border-radius:50%}
#${RAIL_ID} .lsc-run-key.is-big{width:14px;height:14px;border-width:2px}
@keyframes lscRunPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
@media(max-width:560px){#${RAIL_ID}{padding:12px}#${RAIL_ID} .lsc-run-dots{gap:8px}#${RAIL_ID} .lsc-run-phase{font-size:.86rem}}
@media(prefers-reduced-motion:reduce){#${RAIL_ID} .lsc-run-dot.is-active{animation:none}}
`;
  document.head.append(style);
}
function ensureRail(){
  let rail=document.getElementById(RAIL_ID);if(rail)return rail;
  const button=document.querySelector(GENERATE),anchor=button?.closest?.('.lsc218-panel')||button?.parentElement||document.getElementById('living-school-root');
  if(!anchor)return null;
  rail=document.createElement('section');rail.id=RAIL_ID;rail.hidden=true;rail.setAttribute('role','status');rail.setAttribute('aria-live','polite');
  anchor.append(rail);return rail;
}
function beginSession(phase='Preparing generation'){
  if(session?.status==='running'){session.phase=phase||session.phase;return session}
  session={id:`ls-run-${nowMs().toString(36)}`,startedAt:nowMs(),endedAt:0,status:'running',phase:phase||'Preparing generation',stage:'',runs:[],initialReportText:clean(document.querySelector(REPORT)?.textContent,1200)};
  selectedRun=-1;
  document.documentElement.dataset.livingSchoolRunRailActive='true';
  startTimer();renderRail();return session;
}
function startTimer(){if(runTimer)return;runTimer=setInterval(()=>{if(session?.status==='running')updateElapsedOnly();else{clearInterval(runTimer);runTimer=0}},1000)}
function stopTimer(){if(runTimer){clearInterval(runTimer);runTimer=0}}
function updateElapsedOnly(){
  const rail=document.getElementById(RAIL_ID);if(!rail||!session)return;
  const elapsed=rail.querySelector('.lsc-run-time');if(elapsed)elapsed.textContent=formatElapsed((session.endedAt||nowMs())-session.startedAt);
  const detail=rail.querySelector('.lsc-run-detail'),run=session.runs[selectedRun>=0?selectedRun:session.runs.length-1];
  if(detail&&run?.status==='active')detail.innerHTML=runDetailMarkup(run);
}
function finishSession(status='complete'){
  if(!session||session.status!=='running')return;
  const activeRun=session.runs.findLast?.(run=>run.status==='active')||[...session.runs].reverse().find(run=>run.status==='active');
  if(activeRun){activeRun.status=status==='stopped'?'failed':'complete';activeRun.endedAt=nowMs()}
  session.status=status;session.endedAt=nowMs();
  if(status==='complete')session.phase='Curriculum ready';
  else if(status==='partial')session.phase='Partial curriculum generated';
  else if(status==='ended')session.phase='Generation finished';
  else if(status==='stopped')session.phase='Generation stopped';
  delete document.documentElement.dataset.livingSchoolRunRailActive;
  stopTimer();renderRail();
}
function runDetailMarkup(run){
  if(!run)return session?.status==='running'?'Waiting for the first model call…':'No provider calls were recorded.';
  const status=run.status==='active'?`running · ${formatElapsed(nowMs()-run.startedAt)}`:run.status==='failed'?'failed':'complete';
  return`<strong>${modelLabel(run.model,run.tier)}</strong> · ${purposeLabel(run.purpose)} · ${status}`;
}
function summaryMarkup(){
  const runs=session?.runs||[],complex=runs.filter(run=>run.tier==='complex').length,lite=runs.length-complex;
  const parts=[];if(complex)parts.push(`${complex} 3.7 design${complex===1?'':' calls'}`);if(lite)parts.push(`${lite} Lite/follow-up${lite===1?'':' calls'}`);parts.push(`${runs.length} model call${runs.length===1?'':'s'}`);
  return parts.join(' · ');
}
function renderRail(){
  installRailStyle();const rail=ensureRail();if(!rail)return;
  if(!session){rail.hidden=true;return}
  rail.hidden=false;
  const runs=session.runs||[],picked=runs[selectedRun>=0&&selectedRun<runs.length?selectedRun:runs.length-1]||null;
  rail.innerHTML=`<div class="lsc-run-head"><b>Generation run</b><span class="lsc-run-time">${formatElapsed((session.endedAt||nowMs())-session.startedAt)}</span></div><div class="lsc-run-phase">${clean(session.phase,180)}</div><div class="lsc-run-dots" role="list" aria-label="Model calls">${runs.map((run,index)=>`<button type="button" class="lsc-run-dot ${run.tier==='complex'?'is-complex':'is-lite'} is-${run.status}${index===(selectedRun>=0?selectedRun:runs.length-1)?' is-selected':''}" data-lsc-run-index="${index}" role="listitem" aria-label="Run ${index+1}: ${modelLabel(run.model,run.tier)}, ${purposeLabel(run.purpose)}, ${run.status}"></button>`).join('')}</div><div class="lsc-run-detail">${runDetailMarkup(picked)}</div><div class="lsc-run-summary">${summaryMarkup()}</div><div class="lsc-run-legend"><span><i class="lsc-run-key is-big"></i>3.7 / complex design</span><span><i class="lsc-run-key"></i>Lite / follow-up</span></div>`;
  const dots=rail.querySelector('.lsc-run-dots');if(dots)dots.scrollLeft=dots.scrollWidth;
}
function updatePhaseOnly(value){const next=clean(value,180);if(!session||!next||session.phase===next)return;session.phase=next;const node=document.getElementById(RAIL_ID)?.querySelector?.('.lsc-run-phase');if(node)node.textContent=next}
function suppressRoutingNotice(){
  const hide=()=>{const notice=document.getElementById(ROUTING_NOTICE_ID);if(notice)notice.hidden=true};
  queueMicrotask(hide);setTimeout(hide,0);
}
function onRouteSelected(event){
  const detail=event?.detail||{};if(!isLivingSchoolPurpose(detail.purpose))return;
  suppressRoutingNotice();
  const signature=[clean(detail.purpose,220),clean(detail.model,180),clean(detail.tier,40),clean(detail.reason,220)].join('|'),time=nowMs();
  if(signature===lastRouteSignature&&time-lastRouteAt<350)return;
  lastRouteSignature=signature;lastRouteAt=time;
  beginSession(session?.phase||'Generating curriculum');
  const previous=[...session.runs].reverse().find(run=>run.status==='active');if(previous){previous.status='complete';previous.endedAt=time}
  const run={index:session.runs.length,tier:clean(detail.tier,40)==='complex'?'complex':'small',model:clean(detail.model,180),purpose:clean(detail.purpose,220),reason:clean(detail.reason,220),startedAt:time,endedAt:0,status:'active'};
  session.runs.push(run);selectedRun=run.index;renderRail();
}
function onStage(event){
  const detail=event?.detail||{},stage=clean(detail.stage,120);if(!stage)return;
  beginSession(phaseLabel(stage));session.stage=stage;session.phase=phaseLabel(stage);
  if(stage==='complete'){finishSession('complete');return}
  renderRail();
}
function sync(){
  queued=false;
  const button=document.querySelector(GENERATE),report=document.querySelector(REPORT),running=active(button);
  if(report){
    if(report.hidden!==running)report.hidden=running;
    const next=running?'true':'false';
    if(report.dataset.previousRunWhileGenerating!==next)report.dataset.previousRunWhileGenerating=next;
  }
  const root=document.documentElement,next=running?'true':'false';
  if(root.dataset.livingSchoolGenerationActive!==next)root.dataset.livingSchoolGenerationActive=next;
  if(running&&!wasRunning)beginSession('Preparing generation');
  if(running&&session?.status==='running'){
    const label=clean(button?.textContent,240).toLowerCase();
    if(label.includes('researching'))updatePhaseOnly('Researching sources');
    else if(label.includes('completing'))updatePhaseOnly('Completing assessments');
    else if(label.includes('generating')||label.includes('regenerating'))updatePhaseOnly('Generating curriculum');
  }
  else if(!running&&wasRunning&&session?.status==='running'&&session.stage!=='complete'){
    const reportText=clean(document.querySelector(REPORT)?.textContent,1200),changed=Boolean(reportText&&reportText!==session.initialReportText),recovery=clean(root.dataset.livingSchoolGenerationRecovery,40).toLowerCase();
    if(changed&&recovery==='complete')finishSession('complete');
    else if(changed&&recovery==='partial')finishSession('partial');
    else if(changed&&recovery==='failed')finishSession('stopped');
    else finishSession('ended');
  }
  wasRunning=running;
  if(session&&!document.getElementById(RAIL_ID))renderRail();
}
function schedule(){if(queued)return;queued=true;queueMicrotask(sync)}
const observer=new MutationObserver(schedule);
function foundationReadyFromRecommendation(pack){return Boolean(pack?.foundationReady===true||pack?.sourcePackCurrent===true||pack?.alreadyDownloaded===true)}
async function canonicalFoundationReady(pack){
  const slugs=Array.isArray(pack?.sourceSchoolSlugs)?[...new Set(pack.sourceSchoolSlugs.map(value=>String(value||'').trim()).filter(Boolean))]:[];
  if(!slugs.length)return false;
  const store=globalThis.CivweaveKnowledgeSchools;
  if(!store?.status)return false;
  try{
    const rows=await store.status(),bySlug=new Map((Array.isArray(rows)?rows:[]).map(row=>[row.school_slug,row]));
    return slugs.every(slug=>bySlug.get(slug)?.current===true);
  }catch(error){console.warn('[Living School pack authority]',error);return false}
}
function continuePastPackDialog(){
  const dialog=document.querySelector(PACK_DIALOG);
  if(!dialog)return false;
  const button=[...dialog.querySelectorAll('button')].find(node=>/continue to curriculum/i.test(String(node.textContent||'')));
  if(!button)return false;
  button.click();
  return true;
}
async function suppressRedundantPackOffer(event){
  const token=++packOfferToken,recommendations=Array.isArray(event?.detail?.recommendations)?event.detail.recommendations:[],primary=recommendations[0];
  if(!primary)return;
  document.documentElement.dataset[PACK_CHECK_ATTR]='true';
  try{
    const ready=foundationReadyFromRecommendation(primary)||await canonicalFoundationReady(primary);
    if(token!==packOfferToken||!ready)return;
    for(let attempt=0;attempt<12;attempt++){
      if(continuePastPackDialog()){
        document.documentElement.dataset.livingSchoolPackOfferSuppressed='foundation-ready-primary';
        return;
      }
      await new Promise(resolve=>setTimeout(resolve,16));
    }
  }finally{
    if(token===packOfferToken)delete document.documentElement.dataset[PACK_CHECK_ATTR];
  }
}
function installPackOfferAuthority(){
  if(document.getElementById('living-school-pack-offer-authority-style'))return;
  const style=document.createElement('style');
  style.id='living-school-pack-offer-authority-style';
  style.textContent='html[data-living-school-pack-offer-check="true"] dialog[data-living-school-media-pack-offer]{visibility:hidden!important}';
  document.head.append(style);
  addEventListener('civweave:living-school-media-pack-recommendations',event=>{suppressRedundantPackOffer(event).catch(error=>console.warn('[Living School pack offer guard]',error))});
}
function install(){
  if(!document.body)return false;
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-busy','disabled']});
  installPackOfferAuthority();installRailStyle();
  addEventListener(ROUTE_EVENT,onRouteSelected);
  addEventListener(STAGE_EVENT,onStage);
  document.addEventListener('click',event=>{const dot=event.target?.closest?.('[data-lsc-run-index]');if(!dot)return;selectedRun=Number(dot.dataset.lscRunIndex);const rail=document.getElementById(RAIL_ID),run=session?.runs?.[selectedRun];rail?.querySelectorAll?.('.lsc-run-dot').forEach(node=>node.classList.toggle('is-selected',Number(node.dataset.lscRunIndex)===selectedRun));const detail=rail?.querySelector?.('.lsc-run-detail');if(detail)detail.innerHTML=runDetailMarkup(run)},true);
  sync();return true;
}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',install,{once:true});else install();
globalThis.CivweaveLivingSchoolActiveRunUIV1=Object.freeze({version:VERSION,sync,renderRail,onRouteSelected,onStage,canonicalFoundationReady,suppressRedundantPackOffer,get session(){return session}});
})();
