(()=>{
'use strict';
const VERSION='1.2.23-guide-generation-tracker-v1-universal-artifact-rail';
const REVISION='1.3.4-universal-structured-artifact-lifecycle';
const ROOT_ID='cw-persistent-guide-chat-v215';
const STYLE_ID='cw-guide-generation-tracker-v1-style';
const STAGES=Object.freeze([
  {id:'intake',label:'Model intake',short:'Intake'},
  {id:'draft',label:'Plan Draft',short:'Draft'},
  {id:'compile',label:'Model JSON Compile',short:'Compile'},
  {id:'validate',label:'Validate',short:'Check'},
  {id:'repair',label:'Plan Repair',short:'Repair'},
  {id:'saved',label:'Saved',short:'Saved'}
]);
const TERMINAL=new Set(['complete','failed','stopped']);
const clean=(value,max=50000)=>String(value??'').slice(0,max);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const now=()=>Date.now();
let state=freshState(),lastFinalFingerprint='',bound=false;
const consumedLifecycleIds=new Set(),panelMarkup=new WeakMap();
let replayingLifecycle=false,replayNeedsPanel=false;
function bus(){
  // Tracker lives in the campus iframe, but v2/probe lives in parent shell.
  try{
    const parent=globalThis.parent;
    if(parent&&parent!==globalThis&&parent.location?.origin===globalThis.location?.origin){
      const api=parent.CivweaveGenerationLifecycleV2||parent.CivweaveGenerationLifecycleV1;
      if(typeof api?.probeLocalModel==='function')return api;
    }
  }catch{}
  return globalThis.CivweaveGenerationLifecycleV2||globalThis.CivweaveGenerationLifecycleV1||null;
}
function embeddedGGUFSelection(){
  try {
    const saved=JSON.parse(localStorage.getItem('civweave.mobile.gguf-primary.v2')||'null');
    const profiles=JSON.parse(localStorage.getItem('civweave-model-profiles-v1')||'null');
    const active=profiles?.interactive||JSON.parse(localStorage.getItem('civweave.universal-ai.v127')||'null');
    if(saved?.enabled===true&&saved.engine==='wllama'&&saved.model&&
       active?.model===saved.model&&
       (active?.provider==='openai-compatible'||active?.route==='openai-compatible'))
      return saved;
  }catch{}
  return null;
}
async function browserGGUFProbe({timeoutMs=480000,onStatus=()=>{}}={}){
  const selected=embeddedGGUFSelection();
  if(!selected)return{ok:false,code:'GGUF_PROBE_NOT_SELECTED',message:'The currently selected AI does not match the saved browser GGUF selection. Re-select the imported GGUF in Settings; downloaded weights remain untouched.'};
  const started=Date.now(),controller=new AbortController();
  let timer=null,firstTokenAt=null,phase='preparing',text='';
  try {
    const gguf=await import('/app/local-ai/browser-gguf-v1.js?v=embedded-gguf-v6-moss-timeout-probe');
    if(gguf.current()?.model!==selected.model)
      return{ok:false,model:selected.model,code:'GGUF_PROBE_PREFERENCE_MISMATCH',message:'The browser GGUF preference changed before the probe. Open Settings and select the cached import.'};
    timer=setTimeout(()=>controller.abort(new DOMException('GGUF inference test exceeded its eight-minute device budget.','TimeoutError')),timeoutMs);
    const result=await gguf.generate({
      model:selected.model,
      messages:[{role:'user',content:'Reply with exactly the word READY.'}],
      maxTokens:24,temperature:0.1,structured:false,signal:controller.signal,
      onToken:(delta,full)=>{if(firstTokenAt==null)firstTokenAt=Date.now();text=full;onStatus('GGUF first visible text: '+clean(full,100))},
      onPhase:(name,details)=>{phase=name;onStatus('GGUF '+name+(details?.backend?' · '+details.backend:'')+(details?.reason?' · '+clean(details.reason,180):''))}
    });
    return{ok:Boolean(result?.text?.trim()),model:selected.model,phase,code:result?.text?.trim()?'OK':'GGUF_PROBE_EMPTY',output:clean(result?.text,160),firstTokenMs:firstTokenAt==null?null:firstTokenAt-started,elapsedMs:Date.now()-started};
  }catch(error){
    return{ok:false,model:selected.model,phase,code:error?.code||'GGUF_PROBE_FAILED',
      message:clean(error?.message||error,500),elapsedMs:Date.now()-started,
      timedOut:controller.signal.aborted&&controller.signal.reason?.name==='TimeoutError'};
  }finally{if(timer!==null)clearTimeout(timer)}
}
function emptyArtifacts(){return{learningPlan:false,endeavour:false,manifest:false,proposal:false}}
function inferArtifacts(text='',route=''){return bus()?.inferArtifacts?.(text,route)||{...emptyArtifacts(),learningPlan:route==='learning',endeavour:route==='quest'}}
function mergeArtifacts(base={},extra={}){return bus()?.mergeArtifacts?.(base,extra)||{learningPlan:Boolean(base.learningPlan||extra.learningPlan),endeavour:Boolean(base.endeavour||extra.endeavour),manifest:Boolean(base.manifest||extra.manifest),proposal:Boolean(base.proposal||extra.proposal)}}
function artifactName(){return state.kind==='quest'?'Quest':state.kind==='endeavour'?'Endeavor':state.kind==='manifest'?'Manifest':state.kind==='governance'?'Proposal':bus()?.artifactName?.(state.artifacts)||'Generation'}
function freshState(){return{
  requestId:`process-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,pipelineId:'',guideSystem:'',messageId:'',startedMs:now(),terminal:'',nativeFormal:false,activeStage:'',showPipeline:false,expanded:true,pendingObserved:false,pendingKey:'',kind:'',artifacts:emptyArtifacts(),
  stages:Object.fromEntries(STAGES.map(stage=>[stage.id,{state:'waiting',label:stage.label,model:''}])),streams:{intake:'',draft:'',compile:'',repair:'',final:''},runtimePhase:'',errorDetail:'',executionModel:'',probeBusy:false,probeStatus:'',counts:{resources:0,specialists:0,gates:0},artifactKey:'',finalSource:''
}}
function activeRoot(){return document.getElementById(ROOT_ID)}
function currentGuide(){return clean(activeRoot()?.dataset?.guide||globalThis.CivweaveGuideChatSurfaceV350?.activeWindow?.()||'',80)}
function activeArticle(){const root=activeRoot();if(!root||state.guideSystem&&currentGuide()&&state.guideSystem!==currentGuide())return null;const rows=[...root.querySelectorAll('[data-log] article[data-role="assistant"]')];return state.messageId?rows.find(row=>row.dataset?.messageId===state.messageId)||null:rows.at(-1)||null}
function stageState(id,status,label='',model=''){const row=state.stages[id]||{state:'waiting',label:id,model:''};state.stages[id]={...row,state:status,label:label||row.label,model:model||row.model};if(['running','streaming','queued'].includes(status))state.activeStage=id;if(model)state.executionModel=model}
function resetForRequest({text='',route='',pendingKey='',startedMs=now(),system='',messageId=''}={}){state=freshState();consumedLifecycleIds.clear();state.guideSystem=clean(system||currentGuide(),80);state.messageId=clean(messageId,180);state.startedMs=startedMs;state.pendingKey=pendingKey;state.artifacts=inferArtifacts(text,route);state.showPipeline=true;state.pendingObserved=true;state.streams.intake=clean('Current request (application-derived; not model output): '+clean(text,6000),8000);stageState('intake','queued','Waiting for model route');lastFinalFingerprint=''}
function updateArtifacts(detail={}){
  const route=detail.route||detail.kind||'';
  if(detail.artifactSet||detail.artifacts)state.artifacts=mergeArtifacts(state.artifacts,bus()?.normalizeArtifacts?.(detail.artifactSet||detail.artifacts)||emptyArtifacts());
  if(route==='learning')state.artifacts.learningPlan=true;
  if(Number(detail.resourceCount)>0)state.artifacts.manifest=true;
  if(Number(detail.decisionGateCount)>0)state.artifacts.proposal=true;
  if(route==='quest'&&!Object.values(state.artifacts).some(Boolean))state.artifacts=mergeArtifacts(state.artifacts,{learningPlan:true,endeavour:true,manifest:true});
}
function installStyle(){if(document.getElementById(STYLE_ID))return;const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
#${ROOT_ID} .cw-weave-tracker{margin-top:9px;border:1px solid color-mix(in srgb,var(--guide-accent,#d8dde7) 46%,transparent);border-radius:14px;overflow:hidden;background:linear-gradient(145deg,#07111ed9,#101a2bd9);box-shadow:inset 0 0 28px color-mix(in srgb,var(--guide-accent,#d8dde7) 7%,transparent),0 8px 24px #0005;color:#eef6ff}
#${ROOT_ID} .cw-weave-track-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px 10px;border-bottom:1px solid #ffffff14;background:linear-gradient(90deg,color-mix(in srgb,var(--guide-accent,#d8dde7) 14%,transparent),transparent)}
#${ROOT_ID} .cw-weave-track-title{min-width:0}#${ROOT_ID} .cw-weave-track-title strong{display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase}#${ROOT_ID} .cw-weave-track-title span{display:block;margin-top:2px;color:#a9bdd2;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${ROOT_ID} .cw-weave-track-summary{border:1px solid color-mix(in srgb,var(--guide-accent,#d8dde7) 42%,transparent);border-radius:999px;background:#ffffff0b;color:#eef6ff;padding:5px 8px;font:800 10px/1 Inter,system-ui;cursor:pointer}
#${ROOT_ID} .cw-weave-rail{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px;padding:9px 9px 10px}#${ROOT_ID} .cw-weave-node{position:relative;display:grid;justify-items:center;gap:4px;min-width:0;color:#718399;font-size:8px;font-weight:800;text-align:center}#${ROOT_ID} .cw-weave-dot{width:13px;height:13px;border:2px solid #425267;border-radius:50%;background:#0b1420;box-shadow:0 0 0 3px #0b1420}
#${ROOT_ID} .cw-weave-node[data-state="queued"]{color:#b6c7d8}#${ROOT_ID} .cw-weave-node[data-state="queued"] .cw-weave-dot{border-color:#7f92a7;background:#273648}
#${ROOT_ID} .cw-weave-node[data-state="complete"]{color:#dfffea}#${ROOT_ID} .cw-weave-node[data-state="complete"] .cw-weave-dot{border-color:#6ff1a6;background:#43c87b;box-shadow:0 0 10px #43c87b80}
#${ROOT_ID} .cw-weave-node[data-state="running"],#${ROOT_ID} .cw-weave-node[data-state="streaming"]{color:#fff}#${ROOT_ID} .cw-weave-node[data-state="running"] .cw-weave-dot,#${ROOT_ID} .cw-weave-node[data-state="streaming"] .cw-weave-dot{border-color:var(--guide-accent,#d8dde7);background:var(--guide-accent,#d8dde7);box-shadow:0 0 0 4px color-mix(in srgb,var(--guide-accent,#d8dde7) 16%,transparent),0 0 18px color-mix(in srgb,var(--guide-accent,#d8dde7) 70%,transparent);animation:cwGenerationPulse 1.05s ease-in-out infinite alternate}
#${ROOT_ID} .cw-weave-node[data-state="failed"]{color:#ffd8d8}#${ROOT_ID} .cw-weave-node[data-state="failed"] .cw-weave-dot{border-color:#ff7373;background:#9f3131;box-shadow:0 0 12px #ff5d5d70}#${ROOT_ID} .cw-weave-node[data-state="stopped"]{color:#ffe3aa}#${ROOT_ID} .cw-weave-node[data-state="stopped"] .cw-weave-dot{border-color:#ffc35d;background:#7a5417}#${ROOT_ID} .cw-weave-node[data-state="skipped"]{opacity:.36}
#${ROOT_ID} .cw-weave-counts{display:flex;flex-wrap:wrap;gap:5px;padding:0 9px 9px}#${ROOT_ID} .cw-weave-chip{padding:4px 7px;border:1px solid #ffffff1b;border-radius:999px;background:#ffffff08;color:#bcd0e4;font-size:9px;font-weight:750}#${ROOT_ID} .cw-weave-details{border-top:1px solid #ffffff13;padding:9px;background:#020811b0}#${ROOT_ID} .cw-weave-details[hidden]{display:none!important}
#${ROOT_ID} .cw-weave-probe{padding:8px;margin-top:9px;border:1px solid #ffffff25;border-radius:10px;font:11px/1.45 system-ui}#${ROOT_ID} .cw-weave-probe button{border:1px solid #8eb1cf70;background:#102d43;color:#e2f2ff;border-radius:8px;padding:7px 9px;margin:2px 6px 2px 0;cursor:pointer}#${ROOT_ID} .cw-weave-probe p{margin:5px 0 0;white-space:normal;overflow-wrap:anywhere;color:#b0cfe2}
#${ROOT_ID} .cw-weave-stream{margin:0 0 9px}#${ROOT_ID} .cw-weave-stream:last-child{margin-bottom:0}#${ROOT_ID} .cw-weave-stream>strong{display:flex;justify-content:space-between;gap:8px;margin-bottom:4px;color:#dfeeff;font-size:9px;letter-spacing:.04em;text-transform:uppercase}#${ROOT_ID} .cw-weave-stream>strong span{color:#8096ad;font-weight:650;text-transform:none;letter-spacing:0}#${ROOT_ID} .cw-weave-error{white-space:pre-wrap;overflow-wrap:anywhere;color:#ffbdbd;font:10px/1.4 ui-monospace,monospace;margin:0 0 8px}#${ROOT_ID} .cw-weave-stream pre{max-height:160px;overflow:auto;margin:0;padding:7px 8px;border:1px solid #ffffff12;border-radius:9px;background:#0007;color:#bfe3ff;font:10px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;scrollbar-width:thin}
@keyframes cwGenerationPulse{from{transform:scale(.9);opacity:.76}to{transform:scale(1.08);opacity:1}}@media(max-width:560px){#${ROOT_ID} .cw-weave-rail{gap:2px;padding-inline:6px}#${ROOT_ID} .cw-weave-node{font-size:7px}#${ROOT_ID} .cw-weave-dot{width:11px;height:11px}#${ROOT_ID} .cw-weave-stream pre{max-height:130px}}@media(prefers-reduced-motion:reduce){#${ROOT_ID} .cw-weave-node .cw-weave-dot{animation:none!important}}`;
 document.head?.append(style)}
function probeStyles(){return ''}
function terminalLabel(){const name=artifactName();if(state.terminal==='failed')return`${name} failed`;if(state.terminal==='stopped')return`${name} stopped`;if(state.terminal==='complete')return`${name} ready`;const active=STAGES.find(row=>row.id===state.activeStage);return active?active.label:`Preparing ${name}`}
function panelHtml(){
  const rail=STAGES.map(stage=>{const item=state.stages[stage.id]||{state:'waiting'};return`<div class="cw-weave-node" data-stage="${stage.id}" data-state="${esc(item.state)}" title="${esc(item.label||stage.label)}${item.model?` · ${esc(item.model)}`:''}"><i class="cw-weave-dot"></i><span>${esc(stage.short)}</span></div>`}).join('');
  const counts=`<div class="cw-weave-counts"><span class="cw-weave-chip">Resources ${state.counts.resources}</span><span class="cw-weave-chip">Specialists ${state.counts.specialists}</span><span class="cw-weave-chip">Decision gates ${state.counts.gates}</span></div>`;
  const sections=[['intake','Model intake (raw)',state.nativeFormal?'Application-derived goal/routing (not generated by model)':'Visible generated JSON routing output'],['draft','Working draft','Shareable generated plan (not internal reasoning)'],['compile','JSON compile','Actual generated compiler output'],['repair','Targeted repair','Only when structural validation requests it'],['final','Final response','User-facing response']].map(([key,title,sub])=>`<section class="cw-weave-stream" data-stream="${key}" ${!state.streams[key]&&key==='repair'?'hidden':''}><strong>${esc(title)}<span>${esc(sub)}</span></strong><pre>${esc(state.streams[key]||(state.stages[key]?.state==='skipped'?(key==='repair'?'No repair necessary.':'Not required for this route.'):state.stages[key]?.state==='waiting'||state.stages[key]?.state==='queued'?'Not reached.':state.terminal==='failed'?'No visible text emitted at this stage.':'Waiting for model output…'))}</pre></section>`).join('');
  const detail=state.errorDetail?`<pre class="cw-weave-error">${esc(state.errorDetail)}</pre>`:'';
  const embeddedGGUF=embeddedGGUFSelection();
  const probe=state.terminal==='failed'?`<div class="cw-weave-probe"><button type="button" data-weave-probe ${state.probeBusy?'disabled':''}>${state.probeBusy?'Testing model…':embeddedGGUF?'Test selected GGUF inference':'Test local inference'}</button>${embeddedGGUF?'':`<button type="button" data-weave-worker-probe ${state.probeBusy?'disabled':''}>Test isolated GPU worker (LiteRT)</button>`}<button type="button" data-weave-runtime-restart title="Reloads the app shell without deleting model data.">Reload Civweave</button><p>${esc(state.probeStatus||(embeddedGGUF?'Minimal GGUF/Wllama generation, independent of Moss. Cold-loading may take several minutes; no LiteRT test is involved.':'Minimal one-word LiteRT GPU test, independent of Moss and the JSON compiler.'))}</p></div>`:'';
  const model=state.executionModel?` · Model ${state.executionModel}`:'';const runtime=state.runtimePhase?` · Runtime: ${state.runtimePhase}`:'';
  return`<div class="cw-weave-track-head"><div class="cw-weave-track-title"><strong>Live ${esc(artifactName())}</strong><span>${esc(terminalLabel())}${esc(model)}${esc(runtime)}${state.finalSource?` · ${esc(state.finalSource)}`:''}</span></div><button type="button" class="cw-weave-track-summary" data-weave-expand aria-expanded="${state.expanded?'true':'false'}">${state.expanded?'Hide live process':'Show live process'}</button></div><div class="cw-weave-rail">${rail}</div>${counts}<div class="cw-weave-details" data-weave-details ${state.expanded?'':'hidden'}>${detail}${sections}${probe}</div>`
}
function existingPanel(){const article=activeArticle(),host=article?.children?.[1]||article;return host?.querySelector?.(':scope > .cw-weave-tracker')||null}
function ensurePanel(){if(replayingLifecycle){replayNeedsPanel=true;return existingPanel()}installStyle();if(!state.showPipeline){existingPanel()?.remove?.();return null}const article=activeArticle();if(!article)return null;const host=article.children?.[1]||article;let panel=host.querySelector?.(':scope > .cw-weave-tracker');if(!panel){panel=document.createElement('div');panel.className='cw-weave-tracker';panel.dataset.pipelineId=state.pipelineId||state.requestId;host.append(panel)}const markup=panelHtml();if(panelMarkup.get(panel)!==markup){panel.innerHTML=markup;panelMarkup.set(panel,markup)}return panel}
function refreshStream(phase){if(!state.showPipeline)return;const panel=ensurePanel();if(!panel||replayingLifecycle)return;const section=panel.querySelector(`[data-stream="${phase}"]`);if(!section)return;section.hidden=false;const pre=section.querySelector('pre');if(pre){const text=state.streams[phase]||'Waiting…';if(pre.textContent!==text)pre.textContent=text;try{pre.scrollTop=pre.scrollHeight}catch{}}}
function setRuntimeStage(detail={}){const stage=detail.stage||bus()?.stageId?.(detail.label)||'draft',status=detail.state==='start'?'running':detail.state;if(!state.showPipeline){state.showPipeline=true;state.pendingObserved=true}if(stage==='draft'&&state.stages.intake.state==='queued')stageState('intake','complete');stageState(stage,status||'running',detail.label||STAGES.find(row=>row.id===stage)?.label,detail.model||'');if(status==='complete'&&stage==='intake'&&state.stages.draft.state==='waiting')stageState('draft','queued','Waiting for draft');if(status==='failed'){state.terminal='failed'}if(status==='stopped'){state.terminal='stopped'}ensurePanel()}
function applyIntake(detail={}){
  if(detail.origin==='native-local-api')state.nativeFormal=true;
  state.showPipeline=true;state.pendingObserved=true;updateArtifacts(detail);
  const model=detail.model||'gemma4-local-it-litert-web',phase=detail.phase;
  if(phase==='classifying'||phase==='gathering')stageState('intake','running','Model intake',model);
  if(phase==='streaming'){
    stageState('intake','streaming','Model intake',model);
    if(detail.token)state.streams.intake=clean(state.streams.intake+detail.token,50000);
  }
  if(phase==='complete'&&typeof detail.outputText==='string'){
    state.streams.intake=clean(detail.outputText,50000);
    stageState('intake','complete','Model intake',model);
  }
  if(['handoff','ready','answered'].includes(phase))stageState('intake','complete','Model intake',model);
  if(phase==='failed'){
    state.terminal='failed';stageState('intake','failed','Model intake failed',model);
    if(typeof detail.outputText==='string')state.streams.intake=clean(detail.outputText,50000);
    state.errorDetail=[detail.code,detail.error,detail.rawDiagnostics?JSON.stringify(detail.rawDiagnostics):''].filter(Boolean).join(' · ');
  }
  if(detail.route==='ordinary'||phase==='answered'){state.terminal='complete';for(const id of ['draft','compile','validate','repair','saved'])if(state.stages[id].state==='waiting')stageState(id,'skipped')}
  ensurePanel();
}
function applyPipeline(detail={}){
  if(detail.phase==='install')return;
  if(detail.origin==='native-local-api')state.nativeFormal=true;
  state.showPipeline=true;state.pendingObserved=true;updateArtifacts(detail);if(detail.pipelineId)state.pipelineId=detail.pipelineId;
  const phase=detail.phase,status=detail.state||'running',model=detail.model||'gemma4-local-it-litert-web';
  if(phase==='pipeline'&&status==='start'){if(state.stages.intake.state==='waiting')stageState('intake','skipped','Intake event not observed');else if(['queued','running'].includes(state.stages.intake.state))stageState('intake','complete');stageState('draft','queued','Waiting for draft',model);ensurePanel();return}
  if(['draft','compile','repair'].includes(phase)){
    stageState(phase,status==='streaming'?'streaming':status,phase==='draft'?'Plan Draft':detail.label,model);
    if(detail.token)state.streams[phase]=clean(state.streams[phase]+detail.token,50000);
    else if(typeof detail.text==='string')state.streams[phase]=clean(detail.text,50000);
    if(status==='failed'){state.terminal='failed';state.errorDetail=[detail.code,detail.message,detail.rawDiagnostics?JSON.stringify(detail.rawDiagnostics):''].filter(Boolean).join(' · ')}
  }
  if(phase==='validate'){
    stageState('validate',status==='needs-repair'?'complete':status,detail.label||'Validate','deterministic');
    if(status==='needs-repair')stageState('repair','running','Plan Repair',model);
    else if(state.stages.repair.state==='waiting')stageState('repair','skipped','Repair not needed');
    state.counts.resources=Number(detail.resourceCount)||0;state.counts.specialists=Number(detail.specialistCount)||0;state.counts.gates=Number(detail.decisionGateCount)||0;updateArtifacts(detail);
    if(Array.isArray(detail.errors)&&detail.errors.length)state.errorDetail=detail.errors.join(' · ');
  }
  if(phase==='pipeline'&&TERMINAL.has(status)){
    state.terminal=status;
    if(status==='complete'){if(state.stages.validate.state==='waiting')stageState('validate','complete');if(state.stages.repair.state==='waiting')stageState('repair','skipped');stageState('saved','complete','Saved');state.artifactKey=detail.artifactKey||''}
    else{stageState(state.activeStage||'saved',status);state.errorDetail=[state.errorDetail,detail.message].filter(Boolean).join(' · ')}
    state.counts.resources=Number(detail.resourceCount)||state.counts.resources;state.counts.specialists=Number(detail.specialistCount)||state.counts.specialists;state.counts.gates=Number(detail.decisionGateCount)||state.counts.gates;updateArtifacts(detail)
  }
  ensurePanel();
}
function applyLifecycle(row={}){const id=clean(row.id,180);if(id){if(consumedLifecycleIds.has(id))return;consumedLifecycleIds.add(id);if(consumedLifecycleIds.size>256)consumedLifecycleIds.delete(consumedLifecycleIds.values().next().value)}if(Number(row.at)&&Number(row.at)<state.startedMs-1500)return;const type=row.type,detail=row.detail||{};if(type==='civweave:local-model-stage-progress'){
    const label=clean(detail.stage,180),stage=/intake/i.test(label)?'intake':/repair/i.test(label)?'repair':/compil|json/i.test(label)?'compile':'draft';
    state.runtimePhase=clean(detail.phase,100).replaceAll('-',' ');
    state.showPipeline=true;state.pendingObserved=true;
    if(['waiting','queued','running'].includes(state.stages[stage]?.state))stageState(stage,'running',label||'Model Local Generation',detail.model||'');
    ensurePanel();
  }else if(type==='civweave:litert-gemma4-failed'){
    state.runtimePhase='failed: '+clean(detail.code||'local engine error',110);
    state.errorDetail=[detail.message,detail.rawDiagnostics?JSON.stringify(detail.rawDiagnostics):''].filter(Boolean).join(' · ');
    ensurePanel();
  }else if(type==='civweave:weaveling-intake-progress')applyIntake(detail);else if(type==='civweave:weave-pipeline')applyPipeline(detail);else if(type==='runtime-stage')setRuntimeStage(detail);else if(type==='runtime-token'){const phase=detail.stage||'draft';if(['draft','compile','repair'].includes(phase)){stageState(phase,'streaming',detail.label,detail.model);if(detail.text){state.streams[phase]=clean(state.streams[phase]+detail.text,50000);refreshStream(phase)}}}else if(type==='civweave:litert-gemma4-progress'&&detail.phase==='generating'){const model=clean(detail.model,120);setRuntimeStage({stage:state.stages.intake.state==='running'?'intake':state.stages.draft.state==='waiting'?'draft':state.activeStage||'draft',state:'running',model,label:state.stages.intake.state==='running'?'Model intake':'Local generation'})}else if(type==='civweave:generation-stop-requested'||type==='civweave:generation-cancelled'||type==='runtime-stop'){state.terminal='stopped';stageState(state.activeStage||'intake','stopped');ensurePanel()}}
// A single-pass Moss JSON request is not the older multi-model Weave
// pipeline. Track real provider bytes and leave Saved to the Moss capability.
function applyNativeFormalModelEvent(detail={}){
  if(detail?.origin!=='native-local-api')return;
  // Formal creation events report actual completed stages. An application-
  // derived intake is labeled as such; unvalidated JSON stays in RAW.
  if(detail.phase==='complete'||detail.phase==='classifying')applyIntake(detail);
}
function applyLearningPlanModelEvent(detail={}){
  if(detail.purpose!=='living-school-learning-plan-review-v2')return false;
  state.showPipeline=true;state.pendingObserved=true;
  state.artifacts=mergeArtifacts(state.artifacts,{learningPlan:true});
  const model=clean(detail.model||'',240),phase=detail.phase;
  if(['connecting','generating','background'].includes(phase)){
    stageState('intake','running','Model JSON response',model);
    state.runtimePhase=phase;
  }else if(phase==='partial'){
    stageState('intake','streaming','Visible model JSON',model);
    if(typeof detail.accumulatedText==='string')state.streams.intake=clean(detail.accumulatedText,50000);
    else if(detail.text)state.streams.intake=clean(state.streams.intake+detail.text,50000);
    state.runtimePhase=detail.complete?'Model output complete':'Receiving model text';
    refreshStream('intake');return true;
  }else if(phase==='validating'||phase==='completed'){
    stageState('intake','complete','Model JSON received',model);
    if(state.stages.draft.state==='waiting'||state.stages.draft.state==='queued')
      stageState('draft','complete','Plan output received',model);
    if(state.stages.compile.state==='waiting')
      stageState('compile','skipped','Single-pass JSON; no second compiler');
    stageState('validate','running','Validating plan JSON and topic');
  }else if(phase==='repairing'){
    stageState('repair','running','Model JSON repair',model);
  }else if(phase==='failed'){
    state.terminal='failed';
    stageState(state.activeStage||'intake','failed','Provider rejected plan',model);
    state.errorDetail=clean(detail.error?.message||detail.error||'Provider generation failed.',1200);
  }
  ensurePanel();return true;
}
function applyLearningPlanProgress(detail={}){
  state.showPipeline=true;state.pendingObserved=true;
  state.artifacts=mergeArtifacts(state.artifacts,{learningPlan:true});
  const phase=detail.phase;
  if(phase==='started'){
    stageState('intake','running','Model JSON response',detail.model||'');
  }else if(phase==='received'){
    if(typeof detail.text==='string'&&detail.text){
      state.streams.intake=clean(detail.text,50000);
      state.streams.draft=clean(detail.text,50000);
    }
    stageState('intake','complete','Model JSON received');
    stageState('draft','complete','Plan output received (unverified)');
    if(state.stages.compile.state==='waiting')stageState('compile','skipped','Single-pass JSON; no second compiler');
    stageState('validate','running','Checking schema and current goal');
  }else if(phase==='validated'){
    state.streams.draft=clean(detail.draft,50000);
    stageState('validate','complete','Schema and topic match');
    if(state.stages.repair.state==='waiting')stageState('repair','skipped','No repair needed');
    stageState('saved','queued','Waiting for persistence');
  }else if(phase==='saved'){
    state.terminal='complete';
    stageState('saved','complete','Plan saved for review');
    state.errorDetail='';
  }else if(phase==='failed'){
    state.terminal='failed';
    const failedAt=detail.stage==='validate'?'validate':'intake';
    stageState(failedAt,'failed',failedAt==='validate'?'Plan validation rejected':'Plan generation failed');
    if(state.stages.repair.state==='waiting')stageState('repair','skipped','No repair executed');
    state.errorDetail=clean(detail.message||'Plan generation failed.',1200);
  }
  ensurePanel();
}
// Shared structured-artifact lifecycle: Quest, Learning Journey, Endeavor,
 // Manifest and Proposal generators all use the same honest progress rail.
 // A single structured JSON model call has no fictional draft/compile agents.
 function applyStructuredArtifactProgress(detail={}){
   if(!detail||!['quest','learning','endeavour','manifest','governance','curriculum'].includes(detail.artifact))return false;
   const system=clean(detail.system||'',90);
   if(state.guideSystem&&system&&system!==state.guideSystem)return false;
   if(!state.pendingObserved||state.terminal)return false;
   const phase=clean(detail.phase,90),model=clean(detail.model||'',180);
   state.kind=detail.artifact==='curriculum'?'learning':detail.artifact;
   state.showPipeline=true;
   if(detail.artifact==='quest')state.artifacts=mergeArtifacts(state.artifacts,{endeavour:true});
   if(['started','generating','streaming'].includes(phase)){
     stageState('intake','complete','Current request and route (app-derived)');
     if(state.stages.compile.state==='waiting')stageState('compile','skipped','One schema-constrained JSON request');
     if(phase==='streaming'){
       stageState('draft','streaming','Receiving visible JSON',model);
       if(typeof detail.accumulatedText==='string')state.streams.draft=clean(detail.accumulatedText,50000);
       else if(detail.text)state.streams.draft=clean(state.streams.draft+detail.text,50000);
       state.runtimePhase='Receiving JSON · '+(Number(detail.characters)||state.streams.draft.length)+' characters';
       refreshStream('draft');
     }else{
       stageState('draft',phase==='started'?'queued':'running',detail.label||'Model generating structured draft',model);
       state.runtimePhase=phase==='started'?'Preparing schema':'Awaiting visible model output';
     }
   }else if(phase==='validating'){
     stageState('draft','complete','Model JSON received',model);
     if(state.stages.compile.state==='waiting')stageState('compile','skipped','Single-pass JSON schema');
     stageState('validate','running',detail.label||'Checking JSON and route constraints');
   }else if(phase==='validated'){
     stageState('validate','complete','Structured artifact validated');
     if(state.stages.repair.state==='waiting')stageState('repair','skipped','No repair required');
     stageState('saved','queued','Persisting REVIEW artifact');
   }else if(phase==='repairing'){
     stageState('repair','running','Model-assisted structural repair',model);
     state.runtimePhase='Repairing invalid JSON';
   }else if(phase==='saved'){
     if(state.stages.validate.state!=='complete')stageState('validate','complete','Structure validated');
     if(state.stages.repair.state==='waiting')stageState('repair','skipped','No repair required');
     stageState('saved','complete','Saved for REVIEW');
     state.terminal='complete';state.errorDetail='';
   }else if(phase==='failed'||phase==='stopped'){
     state.terminal=phase;
     stageState(state.activeStage||'draft',phase,phase==='failed'?'Structured generation failed':'Generation stopped');
     state.errorDetail=clean(detail.message||detail.reason||'The structured model request did not finish.',1600);
   }
   ensurePanel();return true;
 }
 function connectedWindows(){
  const found=[globalThis];
  try{
    const parent=globalThis.parent;
    if(parent&&parent!==globalThis&&parent.location.origin===globalThis.location.origin){
      found.unshift(parent);
      for(const frame of parent.document.querySelectorAll('iframe')){
        try{
          const child=frame.contentWindow;
          if(child&&child.location.origin===globalThis.location.origin&&!found.includes(child))found.push(child);
        }catch{}
      }
    }
  }catch{}
  return found;
}
async function directLocalProbe({timeoutMs=90000}={}){
  const windows=connectedWindows();
  let candidate=null,model='';
  for(const win of windows){
    try{
      const id=win.CivweaveLocalGenerationModelPolicyV1?.resolve?.('deep');
      if(id&&!model)model=id;
      const runtime=win.CivweaveLiteRTGemma4FastRuntimeV1;
      if(typeof runtime?.runFast==='function'){
        const row={win,runtime,id:id||model||''};
        if(!candidate||runtime.state?.()?.engineReady)candidate=row;
      }
    }catch{}
  }
  if(!candidate)return{ok:false,model,code:'LOCAL_PROBE_RUNTIME_MISSING',message:'No LiteRT runtime was initialized in the shell or campus. This is a local runtime loading failure.'};
  const api=candidate.runtime;
  const chosenModel=model||candidate.id;
  if(!chosenModel)return{ok:false,code:'LOCAL_PROBE_MODEL_UNSELECTED',message:'The selected planning model cannot be resolved.'};
  const gpuState=api.state?.()||{};
  if(gpuState.gpuQuarantine)return{ok:false,model:chosenModel,code:'CIVWEAVE_LOCAL_GPU_RESTART_REQUIRED',phase:gpuState.gpuQuarantine.phase,message:'The local GPU session is quarantined. An in-app reload might not reset the GPU; completely close or force-stop Civweave before another test. Do not clear app storage or downloaded models.',restartRequired:true};
  if(gpuState.generationActive)return{ok:false,model:chosenModel,code:'LOCAL_PROBE_ENGINE_BUSY',phase:'busy',message:'An earlier GPU inference is still active. Restart the persistent app runtime.'};
  const started=Date.now();let phase='checking-model',firstTokenAt=null,output='',settled=false,timer=null;
  const timeout=new Promise((_,reject)=>{
    timer=setTimeout(()=>{
      if(settled)return;
      try{api.cancel?.('no-first-token')}catch{}
      reject(Object.assign(new Error('The minimal prompt also produced no response. This isolates the problem to local GPU inference, not Moss.'),{code:'LOCAL_PROBE_FIRST_TOKEN_TIMEOUT',executionModel:chosenModel}));
    },Math.max(20000,Math.min(150000,timeoutMs)));
  });
  try{
    const result=await Promise.race([api.runFast({
      __civweaveStage:'Local inference probe',__civweaveProbe:true,
      systemPrompt:'Respond using exactly one word: READY.',
      messages:[{role:'user',content:'Say READY.'}],
      maxNewTokens:32,structuredTool:null,
      onProgress:event=>{phase=String(event?.phase||phase).slice(0,100)},
      onToken:token=>{firstTokenAt??=Date.now();output+=String(token?.text||'')}
    },chosenModel),timeout]);
    settled=true;clearTimeout(timer);
    const answer=String(result?.outputText||output).trim();
    return{ok:Boolean(answer),model:result?.model?.id||chosenModel,code:answer?'OK':'LOCAL_PROBE_EMPTY_RESPONSE',phase,output:answer.slice(0,160),firstTokenMs:firstTokenAt==null?null:firstTokenAt-started,elapsedMs:Date.now()-started};
  }catch(error){
    settled=true;clearTimeout(timer);
    return{ok:false,model:error?.executionModel||chosenModel,code:error?.code||'LOCAL_PROBE_FAILED',phase,message:String(error?.message||error).slice(0,350),elapsedMs:Date.now()-started,restartRequired:Boolean(error?.restartRequired)};
  }
}
async function isolatedWorkerProbe({timeoutMs=180000,onStatus=()=>{}}={}){
  if(typeof Worker!=='function')return{ok:false,code:'WORKER_UNSUPPORTED',phase:'startup',message:'Dedicated workers are unavailable in this browser.'};
  const windows=connectedWindows();
  let model='',modelUrl='';
  for(const win of windows){
    try{
      const id=win.CivweaveLocalGenerationModelPolicyV1?.resolve?.('deep');
      const extension=win.CivweaveGemma4LiteRTFastExtensionV1;
      const info=Object.values(extension?.models||{}).find(item=>item.id===id);
      if(!info)continue;
      model=id;
      modelUrl=win.CivweaveLocalModelRegistryV266?.directUrl?.(id,info.artifact)||new URL('https://huggingface.co/'+info.repo+'/resolve/'+info.revision+'/'+info.artifact).href;
      break;
    }catch{}
  }
  if(!modelUrl)return{ok:false,code:'WORKER_MODEL_METADATA_MISSING',phase:'setup',message:'Cannot resolve the installed E4B model cache key without changing the selected model.'};
  let persistence='unavailable',quota=null;
  try{
    const storage=globalThis.navigator?.storage;
    if(storage?.persisted)persistence=(await storage.persisted())?'granted':'not-granted';
    if(storage?.persist&&persistence!=='granted')persistence=(await storage.persist())?'granted':'denied';
    if(storage?.estimate){const usage=await storage.estimate();quota={usage:usage.usage,quota:usage.quota}}
  }catch{}
  return new Promise(resolve=>{
    let worker=null,finished=false,phase='startup',visible='',timer=null,started=Date.now();
    const finish=result=>{
      if(finished)return;finished=true;
      if(timer)clearTimeout(timer);
      try{worker?.terminate()}catch{}
      resolve({model,storagePersistence:persistence,storageEstimate:quota,elapsedMs:Date.now()-started,...result});
    };
    try{
      worker=new Worker('/app/local-ai/litert-gpu-worker-smoke-v1.js?v=1.0.14-both-artifacts-limit-gate',{type:'classic'});
      worker.onmessage=event=>{
        const detail=event.data||{};
        phase=String(detail.phase||phase);
        if(detail.status==='phase'){onStatus('GPU worker · '+phase+' · '+detail.elapsedMs+'ms'+(detail.target?' · '+detail.url+' → '+detail.target:''));return}
        if(detail.status==='gpu-limits'){onStatus('GPU storage binding max '+Math.round((detail.maxStorageBufferBindingSize||0)/1048576)+' MiB · testing '+detail.engineContextTokens+'-token engine');return}
        if(detail.status==='gpu-fatal'){finish({ok:false,code:detail.code,phase:'webgpu-binding-limit',message:detail.message,maximumBindingBytes:detail.maximumBindingBytes,requiredBindingBytes:detail.requiredBindingBytes});return}
        if(detail.status==='gpu-lost'||detail.status==='gpu-warning'){onStatus('GPU runtime · '+detail.status+' · '+String(detail.message||detail.reason||'').slice(0,150));return}
        if(detail.status==='heartbeat'){onStatus('GPU worker heartbeat · '+Math.round((detail.sinceSubmissionMs||0)/1000)+'s after prompt · '+detail.chunks+' raw chunks');return}
        if(detail.status==='asset'){onStatus('WASM asset: '+(detail.valid===false?'INVALID':'response')+' · '+String(detail.url||'').slice(-140)+' · HTTP '+detail.httpStatus+' · '+detail.mime);return}
        if(detail.status==='token'){visible+=String(detail.text||'');onStatus('GPU worker token: '+visible.slice(0,120));return}
        if(detail.status==='complete'){finish({ok:Boolean(visible&&detail.visibleTextDeltas>0),code:visible&&detail.visibleTextDeltas>0?'OK':'WORKER_EMPTY_OUTPUT',phase,output:visible.slice(0,160),workerElapsedMs:detail.elapsedMs,chunks:detail.chunks});return}
        if(detail.status==='error')finish({ok:false,code:detail.code||'WORKER_GPU_ERROR',phase,message:(detail.message||'Worker inference failed.')+(detail.assetUrl?' · '+detail.assetUrl+' · HTTP '+detail.httpStatus+' '+detail.mime:'')+(detail.rawShapes?' · stream shapes '+JSON.stringify(detail.rawShapes):''),workerGpu:detail.workerGpu,jspi:detail.jspi});
      };
      worker.onerror=e=>finish({ok:false,code:'WORKER_SCRIPT_ERROR',phase,message:String(e?.message||'The GPU worker could not load.').slice(0,300)});
      timer=setTimeout(()=>finish({ok:false,code:'WORKER_GPU_TEST_TIMEOUT',phase,message:'The isolated worker stopped reporting progress. The worker was terminated without altering any model files.'}),Math.max(30000,timeoutMs));
      worker.postMessage({modelId:model,modelUrl,mode:'bounded-stream',contextTokens:/^gemma4-e4b/i.test(model)?512:2048});
    }catch(error){finish({ok:false,code:'WORKER_START_FAILED',phase,message:String(error?.message||error).slice(0,350)})}
  });
}
async function isolatedWorkerClick(){
  if(embeddedGGUFSelection()){state.probeStatus='The isolated LiteRT worker test does not apply to the imported GGUF. Use Test selected GGUF inference.';ensurePanel();return}
  if(state.probeBusy)return;
  state.probeBusy=true;
  state.probeStatus='Checking the same cached E4B model in a separate GPU worker; no model download…';
  ensurePanel();
  try{
    const result=await isolatedWorkerProbe({onStatus:message=>{state.probeStatus=message;ensurePanel()}});
    state.probeStatus=(result.ok?'PASS':'FAIL')+' · isolated worker · '+result.code+' · '+result.phase+' · '+(result.output||result.message||'No generated text')+' · storage '+result.storagePersistence+' · elapsed '+result.elapsedMs+'ms';
  }catch(error){state.probeStatus='Worker diagnostic error: '+clean(error?.message||error,350)}
  finally{state.probeBusy=false;ensurePanel()}
}

async function probeClick(){
  if(state.probeBusy)return;
  const api=bus();
  const probe=embeddedGGUFSelection()?browserGGUFProbe:typeof api?.probeLocalModel==='function'?options=>api.probeLocalModel(options):directLocalProbe;
  state.probeBusy=true;state.probeStatus=embeddedGGUFSelection()?'Preparing exact imported GGUF for a short browser inference test; no downloads or LiteRT…':'Running short LiteRT GPU inference outside the learning pipeline…';ensurePanel();
  try{
    const result=await probe({timeoutMs:embeddedGGUFSelection()?480000:90000,onStatus:message=>{state.probeStatus=message;ensurePanel()}});
    state.probeStatus=result.ok
      ?`PASS · ${result.model} · first token ${Math.round(result.firstTokenMs??result.elapsedMs)} ms · answer: ${result.output}`
      :`FAIL · ${result.code} · ${result.phase||''} · ${result.message||'No visible model output.'} ${!embeddedGGUFSelection()&&(result.restartRequired||/GPU|QUEUE|BUSY/.test(result.code||''))?'Fully close or force-stop the app before retrying.':''}`;
  }catch(error){state.probeStatus=`Probe error: ${clean(error?.message||error,400)}`}
  finally{state.probeBusy=false;ensurePanel()}
}
function latestRole(thread,role){const rows=Array.isArray(thread?.messages)?thread.messages:[];for(let i=rows.length-1;i>=0;i-=1)if(rows[i]?.role===role)return rows[i];return null}
function latestAssistant(thread){return latestRole(thread,'assistant')}
function fingerprint(row,thread){return`${clean(row?.text,200)}|${clean(row?.provider,80)}|${clean(row?.model,120)}|${clean(thread?.updatedAt,80)}`}
function recordFinal(text,row){
  // The shared chat surface has already rendered the response. Track its
  // final metadata without clearing, rewriting, or replaying that answer.
  state.finalSource=[clean(row?.provider,100),clean(row?.model,160)].filter(Boolean).join(' · ');
  state.streams.final=clean(text,30000);
}
function replayLifecycle(){if(replayingLifecycle)return;replayingLifecycle=true;replayNeedsPanel=false;try{const rows=bus()?.history?.()||[];for(const row of rows)applyLifecycle(row)}finally{replayingLifecycle=false;if(replayNeedsPanel)ensurePanel();replayNeedsPanel=false}}
function onThreadChanged(event){
  const thread=event?.detail?.thread;if(!thread)return;const row=latestAssistant(thread);if(!row)return;
  const system=clean(event?.detail?.system||row.guide||row.responderSystem||currentGuide(),80);
  if(row.pending){
    // Restoring an old saved chat is not a new generation. Its pending row
    // must not adopt another guide's recent lifecycle history.
    if(globalThis.CivweaveGuideChatSurfaceV350?.state?.()?.busy===false)return;
    const user=latestRole(thread,'user'),key=`${clean(user?.text,500)}|${clean(user?.createdAt||user?.at||thread.updatedAt,80)}`;
    if(!state.pendingObserved||state.pendingKey!==key||state.terminal){const stamp=Date.parse(user?.createdAt||user?.at||'')||Date.parse(thread?.updatedAt||'')||now();resetForRequest({text:user?.text||'',pendingKey:key,startedMs:stamp,system,messageId:row.id});replayLifecycle()}
    ensurePanel();return;
  }
  if(state.guideSystem&&system&&state.guideSystem!==system||state.messageId&&row.id&&state.messageId!==row.id)return;
  const fp=fingerprint(row,thread);if(!state.pendingObserved||fp===lastFinalFingerprint)return;lastFinalFingerprint=fp;
  if(!state.terminal&&state.showPipeline)state.terminal=/could not|failed|error|no learning content was generated/i.test(clean(row.text,6000))?'failed':'complete';
  recordFinal(row.text,row);ensurePanel();
}
function bind(){if(bound)return;bound=true;installStyle();bus()?.install?.();addEventListener('civweave:generation-lifecycle',event=>applyLifecycle(event?.detail||{}));
  addEventListener('civweave:weaveling-intake-progress',event=>{
    if(event?.detail?.origin==='native-local-api')applyIntake(event.detail);
  });
  addEventListener('civweave:weave-pipeline',event=>{
    if(event?.detail?.origin==='native-local-api')applyPipeline(event.detail);
  });addEventListener('civweave:model-event',event=>{
  const detail=event?.detail||{};if(applyLearningPlanModelEvent(detail))return;const selected=embeddedGGUFSelection();
  if(!selected||detail.model!==selected.model)return;
  if(detail.phase==='partial'&&detail.backend==='browser-gguf'){
    // Show only visible generated text. Hidden thinking content is never
    // included in these deltas. JSON will be validated before saving.
    state.pendingObserved=true;state.showPipeline=true;
    stageState('intake','streaming','GGUF visible JSON draft',selected.model);
    state.streams.intake=clean(detail.accumulatedText??state.streams.intake+String(detail.text||''),50000);
    refreshStream('intake');return;
  }
  if(detail.phase!=='gguf-browser-phase')return;
  const stage=clean(detail.stage||'working',80),backend=clean(detail.backend||'',50);
  state.runtimePhase='GGUF · '+stage+(backend?' · '+backend:'');
  if(stage==='failed'&&detail.reason)state.errorDetail='GGUF '+clean(detail.reason,400);
  ensurePanel();
});addEventListener('civweave:moss-learning-plan-progress',event=>applyLearningPlanProgress(event?.detail||{}));if(!bus()){addEventListener('civweave:weaveling-intake-progress',event=>applyIntake(event?.detail||{}));addEventListener('civweave:weave-pipeline',event=>applyPipeline(event?.detail||{}))}addEventListener('civweave:structured-artifact-progress',event=>applyStructuredArtifactProgress(event?.detail||{}));addEventListener('civweave:realm-guide-thread-changed',onThreadChanged);addEventListener('civweave:guide-chat-opened',()=>queueMicrotask(()=>{ensurePanel();replayLifecycle()}));document.addEventListener('click',event=>{const button=event.target?.closest?.(`#${ROOT_ID} [data-weave-expand]`);if(!button)return;const panel=button.closest('.cw-weave-tracker'),details=panel?.querySelector('[data-weave-details]');if(!details)return;details.hidden=!details.hidden;state.expanded=!details.hidden;button.setAttribute('aria-expanded',details.hidden?'false':'true');button.textContent=details.hidden?'Show live process':'Hide live process';if(!details.hidden)for(const pre of details.querySelectorAll('pre'))try{pre.scrollTop=pre.scrollHeight}catch{}});document.addEventListener('click',event=>{
  if(event.target?.closest?.(`#${ROOT_ID} [data-weave-probe]`)){void probeClick();return}
  if(event.target?.closest?.(`#${ROOT_ID} [data-weave-worker-probe]`)){void isolatedWorkerClick();return}
  if(event.target?.closest?.(`#${ROOT_ID} [data-weave-runtime-restart]`)){
    state.probeStatus='Reloading Civweave; if the GPU stays quarantined, fully close or force-stop the installed app before testing…';ensurePanel();
    try{
      const parent=globalThis.parent;
      if(parent&&parent!==globalThis&&parent.location?.origin===globalThis.location?.origin){parent.location.reload();return}
    }catch{}
    try{globalThis.location?.reload?.()}catch{}
  }
})}
function install(){bind();bus()?.install?.();replayLifecycle();if(state.showPipeline)queueMicrotask(ensurePanel);return true}
globalThis.CivweaveGuideGenerationTrackerV1=Object.freeze({version:VERSION,revision:REVISION,install,state:()=>JSON.parse(JSON.stringify(state)),ensurePanel,resetForRequest,artifactName,stages:STAGES,finalResponseStreaming:false,deterministicResponseStreaming:false,automaticFinalReplay:false,finalResponseOwner:'guide-chat-surface-v350',expandableLiveProcess:true,privateChainOfThoughtExposed:false,pipelineOnlyWhenActive:true,dynamicArtifactNaming:true,crossFrameLifecycle:true});
install();
})();
