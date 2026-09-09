(()=>{
'use strict';

const VERSION='1.0.0-guide-generation-tracker-v1-live-pipeline-streams';
const ROOT_ID='cw-persistent-guide-chat-v215';
const STYLE_ID='cw-guide-generation-tracker-v1-style';
const STAGES=Object.freeze([
  {id:'intake',label:'E2B Intake',short:'Intake'},
  {id:'draft',label:'E4B Weave Draft',short:'Draft'},
  {id:'compile',label:'E4B JSON Compile',short:'Compile'},
  {id:'validate',label:'Validate',short:'Check'},
  {id:'repair',label:'E4B Repair',short:'Repair'},
  {id:'saved',label:'Saved',short:'Saved'}
]);
const TERMINAL=new Set(['complete','failed','stopped']);
if(globalThis.CivweaveGuideGenerationTrackerV1?.version===VERSION)return;

const clean=(value,max=50000)=>String(value??'').slice(0,max);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const now=()=>new Date().toISOString();
let state=freshState();
let finalAnimation=null;
let lastFinalFingerprint='';
let installBound=false;

function freshState(){return{
  requestId:`process-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,
  pipelineId:'',kind:'',startedAt:now(),terminal:'',activeStage:'',
  stages:Object.fromEntries(STAGES.map(stage=>[stage.id,{state:'waiting',label:stage.label,model:''}])),
  streams:{draft:'',compile:'',repair:'',final:''},
  counts:{resources:0,specialists:0,gates:0},
  artifactKey:'',finalSource:'',pendingObserved:false
}}
function activeRoot(){return document.getElementById(ROOT_ID)}
function activeArticle(){const root=activeRoot();return root?[...root.querySelectorAll('[data-log] article[data-role="assistant"]')].at(-1)||null:null}
function stageState(id,status,label='',model=''){const row=state.stages[id]||{state:'waiting',label:id,model:''};state.stages[id]={...row,state:status,label:label||row.label,model:model||row.model};if(status==='running'||status==='streaming')state.activeStage=id}
function resetForRequest(){
  if(finalAnimation){try{cancelAnimationFrame(finalAnimation)}catch{}finalAnimation=null}
  state=freshState();lastFinalFingerprint='';
}
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
#${ROOT_ID} .cw-weave-tracker{margin-top:9px;border:1px solid color-mix(in srgb,var(--guide-accent,#d8dde7) 46%,transparent);border-radius:14px;overflow:hidden;background:linear-gradient(145deg,#07111ed9,#101a2bd9);box-shadow:inset 0 0 28px color-mix(in srgb,var(--guide-accent,#d8dde7) 7%,transparent),0 8px 24px #0005;color:#eef6ff}
#${ROOT_ID} .cw-weave-track-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px 10px;border-bottom:1px solid #ffffff14;background:linear-gradient(90deg,color-mix(in srgb,var(--guide-accent,#d8dde7) 14%,transparent),transparent)}
#${ROOT_ID} .cw-weave-track-title{min-width:0}#${ROOT_ID} .cw-weave-track-title strong{display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase}#${ROOT_ID} .cw-weave-track-title span{display:block;margin-top:2px;color:#a9bdd2;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${ROOT_ID} .cw-weave-track-summary{border:1px solid color-mix(in srgb,var(--guide-accent,#d8dde7) 42%,transparent);border-radius:999px;background:#ffffff0b;color:#eef6ff;padding:5px 8px;font:800 10px/1 Inter,system-ui;cursor:pointer}
#${ROOT_ID} .cw-weave-rail{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px;padding:9px 9px 10px}
#${ROOT_ID} .cw-weave-node{position:relative;display:grid;justify-items:center;gap:4px;min-width:0;color:#718399;font-size:8px;font-weight:800;text-align:center}
#${ROOT_ID} .cw-weave-dot{width:13px;height:13px;border:2px solid #425267;border-radius:50%;background:#0b1420;box-shadow:0 0 0 3px #0b1420}
#${ROOT_ID} .cw-weave-node[data-state="complete"]{color:#dfffea}#${ROOT_ID} .cw-weave-node[data-state="complete"] .cw-weave-dot{border-color:#6ff1a6;background:#43c87b;box-shadow:0 0 10px #43c87b80}
#${ROOT_ID} .cw-weave-node[data-state="running"],#${ROOT_ID} .cw-weave-node[data-state="streaming"]{color:#fff}#${ROOT_ID} .cw-weave-node[data-state="running"] .cw-weave-dot,#${ROOT_ID} .cw-weave-node[data-state="streaming"] .cw-weave-dot{border-color:var(--guide-accent,#d8dde7);background:var(--guide-accent,#d8dde7);box-shadow:0 0 0 4px color-mix(in srgb,var(--guide-accent,#d8dde7) 16%,transparent),0 0 18px color-mix(in srgb,var(--guide-accent,#d8dde7) 70%,transparent);animation:cwWeavePulse 1.05s ease-in-out infinite alternate}
#${ROOT_ID} .cw-weave-node[data-state="failed"]{color:#ffd8d8}#${ROOT_ID} .cw-weave-node[data-state="failed"] .cw-weave-dot{border-color:#ff7373;background:#9f3131;box-shadow:0 0 12px #ff5d5d70}
#${ROOT_ID} .cw-weave-node[data-state="skipped"]{opacity:.45}
#${ROOT_ID} .cw-weave-counts{display:flex;flex-wrap:wrap;gap:5px;padding:0 9px 9px}#${ROOT_ID} .cw-weave-chip{padding:4px 7px;border:1px solid #ffffff1b;border-radius:999px;background:#ffffff08;color:#bcd0e4;font-size:9px;font-weight:750}
#${ROOT_ID} .cw-weave-details{border-top:1px solid #ffffff13;padding:9px;background:#020811b0}#${ROOT_ID} .cw-weave-details[hidden]{display:none!important}
#${ROOT_ID} .cw-weave-stream{margin:0 0 9px}#${ROOT_ID} .cw-weave-stream:last-child{margin-bottom:0}#${ROOT_ID} .cw-weave-stream>strong{display:flex;justify-content:space-between;gap:8px;margin-bottom:4px;color:#dfeeff;font-size:9px;letter-spacing:.04em;text-transform:uppercase}#${ROOT_ID} .cw-weave-stream>strong span{color:#8096ad;font-weight:650;text-transform:none;letter-spacing:0}
#${ROOT_ID} .cw-weave-stream pre{max-height:160px;overflow:auto;margin:0;padding:7px 8px;border:1px solid #ffffff12;border-radius:9px;background:#0007;color:#bfe3ff;font:10px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;scrollbar-width:thin}
#${ROOT_ID} .cw-final-streaming::after{content:'▋';display:inline-block;margin-left:2px;color:var(--guide-accent,#d8dde7);animation:cwCursorBlink .65s steps(1,end) infinite}
@keyframes cwWeavePulse{from{transform:scale(.9);opacity:.76}to{transform:scale(1.08);opacity:1}}@keyframes cwCursorBlink{50%{opacity:.15}}
@media(max-width:560px){#${ROOT_ID} .cw-weave-rail{gap:2px;padding-inline:6px}#${ROOT_ID} .cw-weave-node{font-size:7px}#${ROOT_ID} .cw-weave-dot{width:11px;height:11px}#${ROOT_ID} .cw-weave-stream pre{max-height:130px}}
@media(prefers-reduced-motion:reduce){#${ROOT_ID} .cw-weave-node .cw-weave-dot,#${ROOT_ID} .cw-final-streaming::after{animation:none!important}}
`;
  document.head?.append(style);
}
function terminalLabel(){if(state.terminal==='failed')return'Generation failed';if(state.terminal==='stopped')return'Generation stopped';if(state.terminal==='complete')return'Weave ready';const active=STAGES.find(row=>row.id===state.activeStage);return active?active.label:'Preparing pipeline'}
function panelHtml(){
  const rail=STAGES.map(stage=>{const item=state.stages[stage.id]||{state:'waiting'};return`<div class="cw-weave-node" data-stage="${stage.id}" data-state="${esc(item.state)}" title="${esc(item.label||stage.label)}${item.model?` · ${esc(item.model)}`:''}"><i class="cw-weave-dot"></i><span>${esc(stage.short)}</span></div>`}).join('');
  const counts=`<div class="cw-weave-counts"><span class="cw-weave-chip">Resources ${state.counts.resources}</span><span class="cw-weave-chip">Specialists ${state.counts.specialists}</span><span class="cw-weave-chip">Decision gates ${state.counts.gates}</span></div>`;
  const sections=[
    ['draft','Working draft','Shareable planning output — not private chain-of-thought'],
    ['compile','JSON compile','Live E4B compiler output'],
    ['repair','Targeted repair','Only appears when deterministic validation finds gaps'],
    ['final','Final response','User-facing response stream']
  ].map(([key,title,sub])=>`<section class="cw-weave-stream" data-stream="${key}" ${!state.streams[key]&&key==='repair'?'hidden':''}><strong>${esc(title)}<span>${esc(sub)}</span></strong><pre>${esc(state.streams[key]||'Waiting…')}</pre></section>`).join('');
  return`<div class="cw-weave-track-head"><div class="cw-weave-track-title"><strong>Live Weave pipeline</strong><span>${esc(terminalLabel())}${state.kind?` · ${esc(state.kind==='learning'?'Learning Journey':'Quest')}`:''}${state.finalSource?` · ${esc(state.finalSource)}`:''}</span></div><button type="button" class="cw-weave-track-summary" data-weave-expand aria-expanded="false">Show live process</button></div><div class="cw-weave-rail">${rail}</div>${counts}<div class="cw-weave-details" data-weave-details hidden>${sections}</div>`;
}
function ensurePanel(){
  installStyle();const article=activeArticle();if(!article)return null;
  const host=article.children?.[1]||article;let panel=host.querySelector?.(':scope > .cw-weave-tracker');
  if(!panel){panel=document.createElement('div');panel.className='cw-weave-tracker';panel.dataset.pipelineId=state.pipelineId||state.requestId;host.append(panel)}
  const wasOpen=panel.querySelector?.('[data-weave-details]')?.hidden===false;
  panel.innerHTML=panelHtml();
  const details=panel.querySelector('[data-weave-details]'),button=panel.querySelector('[data-weave-expand]');
  if(wasOpen&&details&&button){details.hidden=false;button.setAttribute('aria-expanded','true');button.textContent='Hide live process'}
  return panel;
}
function refreshStream(phase){
  const panel=ensurePanel();if(!panel)return;
  const section=panel.querySelector(`[data-stream="${phase}"]`);if(!section)return;section.hidden=false;
  const pre=section.querySelector('pre');if(pre){pre.textContent=state.streams[phase]||'Waiting…';try{pre.scrollTop=pre.scrollHeight}catch{}}
}
function onIntake(event){
  const detail=event?.detail||{};
  if(detail.phase==='classifying'){
    if(!state.pendingObserved||state.terminal)resetForRequest();
    state.pendingObserved=true;state.kind=detail.route||state.kind;stageState('intake','running','E2B Intake',detail.model||'gemma4-e2b-it-litert-web');ensurePanel();return;
  }
  if(['handoff','answered','ready','gathering'].includes(detail.phase))stageState('intake',detail.phase==='gathering'?'running':'complete','E2B Intake',detail.model||'gemma4-e2b-it-litert-web');
  ensurePanel();
}
function onPipeline(event){
  const detail=event?.detail||{};if(detail.pipelineId)state.pipelineId=detail.pipelineId;if(detail.kind)state.kind=detail.kind;
  const phase=detail.phase,stateName=detail.state||'running';
  if(phase==='pipeline'&&stateName==='start'){stageState('intake','complete');state.pendingObserved=true;ensurePanel();return}
  if(['draft','compile','repair'].includes(phase)){
    stageState(phase,stateName==='streaming'?'streaming':stateName,detail.label,detail.model||'gemma4-e4b-it-litert-web');
    if(detail.token){state.streams[phase]=clean(state.streams[phase]+detail.token,50000);refreshStream(phase)}
    else if(detail.text){state.streams[phase]=clean(detail.text,50000);refreshStream(phase)}
  }
  if(phase==='validate'){
    stageState('validate',stateName==='needs-repair'?'complete':stateName,detail.label||'Validate','deterministic');
    if(stateName==='needs-repair')stageState('repair','running','E4B Targeted Repair','gemma4-e4b-it-litert-web');
    else if(state.stages.repair.state==='waiting')stageState('repair','skipped','Repair not needed');
    state.counts.resources=Number(detail.resourceCount)||0;state.counts.specialists=Number(detail.specialistCount)||0;state.counts.gates=Number(detail.decisionGateCount)||0;
  }
  if(phase==='pipeline'&&TERMINAL.has(stateName)){
    state.terminal=stateName;
    if(stateName==='complete'){stageState('validate','complete');if(state.stages.repair.state==='waiting')stageState('repair','skipped');stageState('saved','complete','Saved');state.artifactKey=detail.artifactKey||''}
    else stageState(state.activeStage||'saved',stateName==='failed'?'failed':'stopped');
    state.counts.resources=Number(detail.resourceCount)||state.counts.resources;state.counts.specialists=Number(detail.specialistCount)||state.counts.specialists;state.counts.gates=Number(detail.decisionGateCount)||state.counts.gates;
  }
  ensurePanel();
}
function latestAssistant(thread){const rows=Array.isArray(thread?.messages)?thread.messages:[];for(let i=rows.length-1;i>=0;i-=1)if(rows[i]?.role==='assistant')return rows[i];return null}
function fingerprint(row,thread){return`${clean(row?.text,200)}|${clean(row?.provider,80)}|${clean(row?.model,120)}|${clean(thread?.updatedAt,80)}`}
function tokenPieces(text){return clean(text,30000).match(/\S+\s*|\s+/g)||[clean(text,30000)]}
function animateFinal(text,row){
  const target=clean(text,30000);if(!target)return;
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const start=()=>{
    const article=activeArticle(),bubble=article?.querySelector?.('.cw350-bubble,.cw237-bubble');if(!bubble)return false;
    ensurePanel();state.finalSource=[clean(row?.provider,100),clean(row?.model,160)].filter(Boolean).join(' · ');state.streams.final='';
    if(reduced){bubble.textContent=target;state.streams.final=target;refreshStream('final');return true}
    const pieces=tokenPieces(target),batch=Math.max(1,Math.ceil(pieces.length/180));let index=0,visible='';bubble.textContent='';bubble.classList.add('cw-final-streaming');
    const tick=()=>{
      const end=Math.min(pieces.length,index+batch);for(;index<end;index+=1)visible+=pieces[index];bubble.textContent=visible;state.streams.final=visible;refreshStream('final');
      if(index<pieces.length){finalAnimation=requestAnimationFrame(tick)}else{bubble.textContent=target;bubble.classList.remove('cw-final-streaming');state.streams.final=target;refreshStream('final');finalAnimation=null}
    };
    finalAnimation=requestAnimationFrame(tick);return true;
  };
  let tries=0;const attempt=()=>{tries+=1;if(!start()&&tries<8)setTimeout(attempt,20)};setTimeout(attempt,0);
}
function onThreadChanged(event){
  const thread=event?.detail?.thread;if(!thread)return;const row=latestAssistant(thread);if(!row)return;
  if(row.pending){
    if(!state.pendingObserved){resetForRequest();state.pendingObserved=true}
    ensurePanel();return;
  }
  const fp=fingerprint(row,thread);if(!state.pendingObserved||fp===lastFinalFingerprint)return;lastFinalFingerprint=fp;
  if(!state.terminal&&state.pipelineId)state.terminal='complete';
  animateFinal(row.text,row);
}
function bind(){
  if(installBound)return;installBound=true;installStyle();
  addEventListener('civweave:weaveling-intake-progress',onIntake);
  addEventListener('civweave:weave-pipeline',onPipeline);
  addEventListener('civweave:realm-guide-thread-changed',onThreadChanged);
  addEventListener('civweave:generation-stop-requested',()=>{state.terminal='stopped';stageState(state.activeStage||'saved','stopped');ensurePanel()});
  addEventListener('civweave:guide-chat-opened',()=>queueMicrotask(ensurePanel));
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.(`#${ROOT_ID} [data-weave-expand]`);if(!button)return;
    const panel=button.closest('.cw-weave-tracker'),details=panel?.querySelector('[data-weave-details]');if(!details)return;
    details.hidden=!details.hidden;button.setAttribute('aria-expanded',details.hidden?'false':'true');button.textContent=details.hidden?'Show live process':'Hide live process';
    if(!details.hidden)for(const pre of details.querySelectorAll('pre'))try{pre.scrollTop=pre.scrollHeight}catch{}
  });
}
function install(){bind();queueMicrotask(ensurePanel);return true}

globalThis.CivweaveGuideGenerationTrackerV1=Object.freeze({
  version:VERSION,install,state:()=>JSON.parse(JSON.stringify(state)),ensurePanel,resetForRequest,
  stages:STAGES,finalResponseStreaming:true,deterministicResponseStreaming:true,expandableLiveProcess:true,privateChainOfThoughtExposed:false
});
install();
})();