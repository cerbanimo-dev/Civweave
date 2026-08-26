(()=>{
'use strict';
const VERSION='2.0.0-living-school-active-run-ui-v2-provider-neutral';
const GENERATE='[data-ls-action="generate-curriculum"]';
const REPORT='#lsc220-generation-recovery';
const RAIL_ID='lsc-living-school-generation-run-rail';
const STYLE_ID='lsc-living-school-generation-run-style-v2';
const MODEL_EVENT='civweave:model-event';
const STAGE_EVENT='civweave:living-school-curriculum-stage';
let queued=false,wasRunning=false,session=null,selectedRun=-1,runTimer=0;
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const nowMs=()=>Date.now();
const livingSchoolPurpose=value=>/^living-school-/.test(clean(value,220).toLowerCase());
function active(button){
  if(!button)return false;
  const label=String(button.textContent||'');
  return button.getAttribute('aria-busy')==='true'||(button.disabled&&/researching|generating|regenerating|completing/i.test(label));
}
function selectedRuntime(){
  let config={};try{config=globalThis.CivweaveModelRuntime?.readSharedConfig?.('interactive')||{}}catch{}
  return{provider:clean(config.provider||config.route||config.engine,120),model:clean(config.model,220)};
}
function providerLabel(value){
  const provider=clean(value,120).toLowerCase();
  if(provider==='cloudflare-workers-ai'||provider==='workers-ai')return'Cloudflare Workers AI';
  if(provider==='hosted')return'Cloud inference';
  if(provider==='openai-compatible')return'OpenAI-compatible';
  if(provider==='ollama')return'Ollama';
  if(provider==='browser')return'Browser model';
  if(provider==='deterministic')return'Local deterministic';
  if(provider==='manual')return'Manual exchange';
  return clean(value,120)||'Selected provider';
}
function formatElapsed(ms){const seconds=Math.max(0,Math.floor((Number(ms)||0)/1000)),minutes=Math.floor(seconds/60),rest=seconds%60;return`${minutes}:${String(rest).padStart(2,'0')}`}
function purposeLabel(purpose){
  const value=clean(purpose,220).toLowerCase();
  if(value.includes('research-grounded-curriculum'))return'Curriculum design';
  if(value.includes('live-source-research'))return'Live source research';
  if(value.includes('local-source-synthesis'))return'Source synthesis';
  if(value.includes('structure-single'))return'Module structure';
  if(value.includes('quiz'))return'Assessment completion';
  if(value.includes('video'))return'Video review';
  if(value.includes('safe-admission'))return'S.A.F.E. admission review';
  return clean(value.replace(/^living-school-/,'').replace(/^civweave-/,'').replace(/-v\d+(?:\.\d+)?$/,'').replace(/-/g,' '),96)||'Generation support call';
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
  style.textContent=`#${RAIL_ID}{margin-top:14px;padding:13px 14px;border:1px solid rgba(111,226,163,.35);border-radius:14px;background:linear-gradient(145deg,rgba(5,34,27,.96),rgba(5,21,24,.95));box-shadow:inset 0 1px 0 rgba(255,255,255,.035);color:#e9f7ed}#${RAIL_ID}[hidden]{display:none!important}#${RAIL_ID} .lsc-run-head{display:flex;align-items:center;justify-content:space-between;gap:12px}#${RAIL_ID} .lsc-run-head b{font-size:.83rem;letter-spacing:.04em;text-transform:uppercase;color:#c8f4d8}#${RAIL_ID} .lsc-run-time{font:700 .78rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;color:#9edcb5}#${RAIL_ID} .lsc-run-phase{margin-top:5px;font-size:.92rem;font-weight:780;color:#f4efd2}#${RAIL_ID} .lsc-run-dots{display:flex;align-items:center;gap:9px;min-height:28px;margin:9px 0 6px;overflow-x:auto;scrollbar-width:thin}#${RAIL_ID} .lsc-run-dot{appearance:none;display:block;flex:0 0 auto;width:14px;height:14px;padding:0;border:2px solid rgba(183,221,194,.58);border-radius:50%;background:rgba(216,238,220,.12);box-shadow:none;cursor:pointer}#${RAIL_ID} .lsc-run-dot.is-active{border-color:#f2d67f;background:#4f8e66;box-shadow:0 0 0 5px rgba(242,214,127,.10),0 0 20px rgba(111,226,163,.28);animation:lscRunPulseV2 1.25s ease-in-out infinite}#${RAIL_ID} .lsc-run-dot.is-complete{border-color:#7ce1a2;background:#376f50}#${RAIL_ID} .lsc-run-dot.is-failed{border-color:#ff988a;background:#7b3d3b}#${RAIL_ID} .lsc-run-dot.is-selected{outline:2px solid rgba(244,239,210,.62);outline-offset:3px}#${RAIL_ID} .lsc-run-detail{font-size:.78rem;line-height:1.42;color:#cfe2d5;min-height:1.15em}#${RAIL_ID} .lsc-run-detail strong{color:#f6f0d5}#${RAIL_ID} .lsc-run-summary{margin-top:4px;font-size:.72rem;color:#8eb9a0}#${RAIL_ID} .lsc-run-legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;font-size:.68rem;color:#84ad95}@keyframes lscRunPulseV2{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}@media(max-width:560px){#${RAIL_ID}{padding:12px}#${RAIL_ID} .lsc-run-phase{font-size:.86rem}}@media(prefers-reduced-motion:reduce){#${RAIL_ID} .lsc-run-dot.is-active{animation:none}}`;
  document.head.append(style);
}
function ensureRail(){
  let rail=document.getElementById(RAIL_ID);if(rail)return rail;
  const button=document.querySelector(GENERATE),anchor=button?.closest?.('.lsc218-panel')||button?.parentElement||document.getElementById('living-school-root');
  if(!anchor)return null;
  rail=document.createElement('section');rail.id=RAIL_ID;rail.hidden=true;rail.setAttribute('role','status');rail.setAttribute('aria-live','polite');anchor.append(rail);return rail;
}
function beginSession(phase='Preparing generation'){
  if(session?.status==='running'){session.phase=phase||session.phase;return session}
  const selected=selectedRuntime();
  session={id:`ls-run-${nowMs().toString(36)}`,startedAt:nowMs(),endedAt:0,status:'running',phase,stage:'',runs:[],provider:selected.provider,model:selected.model,initialReportText:clean(document.querySelector(REPORT)?.textContent,1200)};
  selectedRun=-1;document.documentElement.dataset.livingSchoolRunRailActive='true';startTimer();renderRail();return session;
}
function startTimer(){if(runTimer)return;runTimer=setInterval(()=>{if(session?.status==='running')renderElapsed();else{clearInterval(runTimer);runTimer=0}},1000)}
function stopTimer(){if(runTimer){clearInterval(runTimer);runTimer=0}}
function renderElapsed(){const rail=document.getElementById(RAIL_ID);if(!rail||!session)return;const elapsed=rail.querySelector('.lsc-run-time');if(elapsed)elapsed.textContent=formatElapsed((session.endedAt||nowMs())-session.startedAt)}
function finishSession(status='complete'){
  if(!session||session.status!=='running')return;
  const end=nowMs();for(const run of session.runs)if(run.status==='active'){run.status=status==='complete'?'complete':'failed';run.endedAt=end}
  session.status=status;session.endedAt=end;
  if(status==='complete')session.phase='Curriculum ready';
  else if(status==='partial')session.phase='Partial curriculum generated';
  else if(status==='preflight')session.phase='Stopped before provider call';
  else session.phase='Generation stopped';
  delete document.documentElement.dataset.livingSchoolRunRailActive;stopTimer();renderRail();
}
function runDetailMarkup(run){
  if(!run){
    const provider=providerLabel(session?.provider),model=clean(session?.model,180);
    if(session?.status==='running')return`Waiting for ${provider}${model?` · ${model}`:''}…`;
    return session?.status==='preflight'?'No provider call started.':'No model call was recorded.';
  }
  const route=providerLabel(run.provider),model=clean(run.model,180),status=run.status==='active'?`running · ${formatElapsed(nowMs()-run.startedAt)}`:run.status==='failed'?`failed${run.errorCode?` · ${run.errorCode}`:''}`:`complete · ${formatElapsed((run.endedAt||run.startedAt)-run.startedAt)}`;
  return`<strong>${route}${model?` · ${model}`:''}</strong> · ${purposeLabel(run.purpose)}${run.nested?' · nested':''} · ${status}`;
}
function summaryMarkup(){
  const runs=session?.runs||[],activeCount=runs.filter(run=>run.status==='active').length,providers=[...new Set(runs.map(run=>providerLabel(run.provider)).filter(Boolean))];
  const parts=[`${runs.length} model call${runs.length===1?'':'s'}`];if(providers.length)parts.push(providers.join(' + '));else if(session?.provider)parts.push(providerLabel(session.provider));if(activeCount)parts.push(`${activeCount} active`);return parts.join(' · ');
}
function renderRail(){
  installRailStyle();const rail=ensureRail();if(!rail)return;
  if(!session){rail.hidden=true;return}rail.hidden=false;
  const runs=session.runs||[],picked=runs[selectedRun>=0&&selectedRun<runs.length?selectedRun:runs.length-1]||null;
  rail.innerHTML=`<div class="lsc-run-head"><b>Generation run</b><span class="lsc-run-time">${formatElapsed((session.endedAt||nowMs())-session.startedAt)}</span></div><div class="lsc-run-phase">${clean(session.phase,180)}</div><div class="lsc-run-dots" role="list" aria-label="Model calls">${runs.map((run,index)=>`<button type="button" class="lsc-run-dot is-${run.status}${index===(selectedRun>=0?selectedRun:runs.length-1)?' is-selected':''}" data-lsc-run-index="${index}" role="listitem" aria-label="Run ${index+1}: ${providerLabel(run.provider)}, ${clean(run.model,180)||'selected model'}, ${purposeLabel(run.purpose)}, ${run.status}"></button>`).join('')}</div><div class="lsc-run-detail">${runDetailMarkup(picked)}</div><div class="lsc-run-summary">${summaryMarkup()}</div><div class="lsc-run-legend"><span>One dot = one shared runtime request</span><span>Provider and model come from Civweave Settings/runtime routing</span></div>`;
  const dots=rail.querySelector('.lsc-run-dots');if(dots)dots.scrollLeft=dots.scrollWidth;
}
function updatePhase(value){const next=clean(value,180);if(!session||!next||session.phase===next)return;session.phase=next;const node=document.getElementById(RAIL_ID)?.querySelector?.('.lsc-run-phase');if(node)node.textContent=next}
function onModelEvent(event){
  const detail=event?.detail||{},requestId=clean(detail.requestId,180),phase=clean(detail.phase,80).toLowerCase(),purpose=clean(detail.purpose,220);
  const button=document.querySelector(GENERATE),running=active(button),relevant=running||session?.status==='running'||livingSchoolPurpose(purpose);
  if(!requestId||!relevant)return;
  beginSession(session?.phase||'Generating curriculum');
  const provider=clean(detail.provider,120),model=clean(detail.model,180);if(provider)session.provider=provider;if(model)session.model=model;
  let run=session.runs.find(item=>item.callId===requestId);
  const terminal=['completed','failed','cancelled'].includes(phase);
  if(!run&&!terminal){run={index:session.runs.length,callId:requestId,provider,model,purpose,startedAt:Date.parse(detail.at)||nowMs(),endedAt:0,status:'active',nested:!livingSchoolPurpose(purpose),errorCode:''};session.runs.push(run);selectedRun=run.index}
  if(run){if(provider)run.provider=provider;if(model)run.model=model;if(purpose)run.purpose=purpose;if(terminal){run.status=phase==='completed'&&clean(detail.status,80).toLowerCase()!=='provider-error'?'complete':'failed';run.endedAt=Date.parse(detail.at)||nowMs();run.errorCode=clean(detail.error?.code||detail.errorCode,160)}}
  renderRail();
}
function onStage(event){const stage=clean(event?.detail?.stage,120);if(!stage)return;beginSession(phaseLabel(stage));session.stage=stage;session.phase=phaseLabel(stage);if(stage==='complete')finishSession('complete');else renderRail()}
function sync(){
  queued=false;const button=document.querySelector(GENERATE),report=document.querySelector(REPORT),running=active(button),root=document.documentElement;
  if(report){if(report.hidden!==running)report.hidden=running;report.dataset.previousRunWhileGenerating=running?'true':'false'}
  root.dataset.livingSchoolGenerationActive=running?'true':'false';
  if(running&&!wasRunning)beginSession('Preparing generation');
  if(running&&session?.status==='running'){
    const label=clean(button?.textContent,240).toLowerCase();if(label.includes('researching'))updatePhase('Researching sources');else if(label.includes('completing'))updatePhase('Completing assessments');else if(label.includes('generating')||label.includes('regenerating'))updatePhase('Generating curriculum');
  }else if(!running&&wasRunning&&session?.status==='running'&&session.stage!=='complete'){
    if(!(session.runs||[]).length)finishSession('preflight');else{const recovery=clean(root.dataset.livingSchoolGenerationRecovery,40).toLowerCase();if(recovery==='partial')finishSession('partial');else if(recovery==='complete')finishSession('complete');else finishSession('stopped')}
  }
  wasRunning=running;if(session&&!document.getElementById(RAIL_ID))renderRail();
}
function schedule(){if(queued)return;queued=true;queueMicrotask(sync)}
function install(){
  if(!document.body)return false;
  installRailStyle();new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-busy','disabled']});
  addEventListener(MODEL_EVENT,onModelEvent);addEventListener(STAGE_EVENT,onStage);
  document.addEventListener('click',event=>{const dot=event.target?.closest?.('[data-lsc-run-index]');if(!dot)return;selectedRun=Number(dot.dataset.lscRunIndex);renderRail()},true);
  sync();return true;
}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',install,{once:true});else install();
globalThis.CivweaveLivingSchoolActiveRunUIV2=Object.freeze({version:VERSION,sync,renderRail,onModelEvent,onStage,providerLabel,get session(){return session}});
globalThis.CivweaveLivingSchoolActiveRunUIV1=globalThis.CivweaveLivingSchoolActiveRunUIV2;
})();
