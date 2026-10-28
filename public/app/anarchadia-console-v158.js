(()=>{
'use strict';
const VERSION='1.0.10-civic-work-map';
const STORAGE_KEY='civweave.anarchadia.citizen-console.v139';
const CHAT_KEY='civweave.guide-chat.anarchadia.v153';
const HUB_PROPOSALS='/lite/?system=anarchadia&room=anarchadia.proposals#proposals';
const STAGES=['intake','rail-check','code-generation','validation','sandbox-install','preview-ready'];
const RAILS=[
  {id:'clear-scope',label:'Clear scope and expected result',check:p=>Boolean(p.title&&p.problem&&p.expected)},
  {id:'testable',label:'At least one testable acceptance criterion',check:p=>p.acceptance.length>0},
  {id:'consent',label:'Consequential effects are declared',check:p=>!/(publish|delete|spend|send|vote|install|deploy|share personal|collect personal)/i.test(`${p.problem} ${p.expected}`)||Boolean(p.risk)},
  {id:'no-hidden-authority',label:'No hidden authority or automatic consensus claim',check:p=>!/(binding vote without|automatic authority|bypass consent|force approve|silent install)/i.test(`${p.problem} ${p.expected} ${p.risk}`)},
  {id:'bounded-code',label:'Generated code remains inside the sandbox allowlist',check:p=>p.area!=='Unknown'}
];
const ALLOWED_EXT=/\.(html|css|js|json|md)$/i;
const FORBIDDEN_CODE=[/\beval\s*\(/i,/new\s+Function\s*\(/i,/document\.cookie/i,/localStorage\.clear\s*\(/i,/fetch\s*\(\s*['"]https?:\/\//i,/window\.top\.location\s*=/i,/innerHTML\s*=\s*[^`'"<]/i];
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const now=()=>new Date().toISOString();
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed??fallback}catch{return fallback}};
const frame=globalThis.requestAnimationFrame||((callback)=>setTimeout(callback,16));

function defaultState(){
  return {schema:'civweave.anarchadia-console.v1',passportId:`AC-${crypto?.randomUUID?.().slice(0,8).toUpperCase()||Math.random().toString(36).slice(2,10).toUpperCase()}`,proposals:[],ledger:[{id:uid('evt'),time:now(),kind:'console-ready',detail:'Citizen console initialized locally.'}],settings:{autoRun:true}};
}
let state=load();
let requestKind='feature';
let renderQueued=false;
let modelStatusTicket=0;
let merlinBusy=false;
const runningPipelines=new Set();
let civicVault={status:'idle',data:null};
let civicVaultRead=null;

function load(){const saved=parse(localStorage.getItem(STORAGE_KEY),null);return saved?.schema==='civweave.anarchadia-console.v1'?saved:defaultState()}
function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function queueRender(){if(renderQueued)return;renderQueued=true;frame(()=>{renderQueued=false;renderAll()})}
function save(kind,detail,proposalId=null,{render=true}={}){if(kind)state.ledger.unshift({id:uid('evt'),time:now(),kind,detail,proposalId});state.ledger=state.ledger.slice(0,250);persist();if(render)queueRender()}
function proposal(id){return state.proposals.find(item=>item.id===id)}
function currentScreen(){return $('#ac-app')?.dataset.screen||'home'}
function setScreen(name){const app=$('#ac-app');if(!app)return;app.dataset.screen=name;$$('.ac-screen').forEach(node=>node.hidden=node.dataset.screen!==name);const home=name==='home';$$('.ac-passport,.ac-grid,.ac-pulse').forEach(node=>node.hidden=!home);queueRender();window.scrollTo({top:0,behavior:'auto'})}
function toast(message){const node=$('#ac-toast');if(!node)return;node.textContent=message;node.hidden=false;clearTimeout(node._timer);node._timer=setTimeout(()=>node.hidden=true,2600)}
function badge(p){const blocked=p.status==='blocked'||p.status==='failed';const ready=p.stage==='preview-ready';return `<span class="ac-badge ${blocked?'is-blocked':ready?'is-ready':'is-working'}">${esc(blocked?p.status:ready?'preview ready':p.stage)}</span>`}
function stageIndex(p){return Math.max(0,STAGES.indexOf(p.stage))}
function stageTrack(p){const active=stageIndex(p);return `<div class="ac-pipeline-track">${STAGES.map((stage,index)=>`<span class="ac-stage ${p.failedStage===stage?'is-failed':index<active||p.stage==='preview-ready'?'is-done':index===active?'is-active':''}">${esc(stage.replaceAll('-',' '))}</span>`).join('')}</div>`}
function railMarkup(p){return `<div class="ac-rail-list">${(p.rails||[]).map(item=>`<div class="ac-rail ${item.pass?'is-pass':'is-fail'}"><b>${item.pass?'✓':'!'}</b><span><strong>${esc(item.label)}</strong>${item.note?`<br><small>${esc(item.note)}</small>`:''}</span></div>`).join('')}</div>`}
function proposalCard(p){const busy=runningPipelines.has(p.id);return `<article class="ac-card"><header><div><small>${esc(p.kind)} · ${esc(p.area)}</small><h3>${esc(p.title)}</h3></div>${badge(p)}</header><p>${esc(p.problem)}</p>${stageTrack(p)}<div class="ac-card-actions"><button type="button" data-open-pipeline="${p.id}">PIPELINE</button>${p.preview?.srcdoc?`<button type="button" data-preview="${p.id}">PREVIEW</button>`:''}<button type="button" data-signal-vote="${p.id}">${p.voteSignal?'SUPPORT SIGNALLED':'VOTE!'}</button><button type="button" data-rerun="${p.id}" ${busy?'disabled':''}>${busy?'RUNNING…':'RUN AGAIN'}</button></div></article>`}
function renderProposals(){const node=$('#ac-proposal-list');if(!node)return;const rows=state.proposals.slice(0,80);node.innerHTML=rows.length?rows.map(proposalCard).join(''):'<div class="ac-empty">No proposals yet. Submit a bugfix or feature request to wake the pipeline.</div>'}
function renderLedger(){const node=$('#ac-ledger');if(!node)return;const rows=state.ledger.slice(0,120);node.innerHTML=rows.length?rows.map(item=>`<article class="ac-ledger-entry"><time>${esc(new Date(item.time).toLocaleString())}</time><div><b>${esc(item.kind)}</b><p>${esc(item.detail)}</p></div></article>`).join(''):'<div class="ac-empty">No receipts yet.</div>'}
function pipelineCard(p){const busy=runningPipelines.has(p.id),notes=(p.pipeline||[]).slice(-40).reverse().map(item=>`<li><b>${esc(item.stage)}</b> · ${esc(item.note)}</li>`).join('');return `<article class="ac-pipeline-card"><header><div><small>${esc(p.kind)} · ${esc(p.id)}</small><h3>${esc(p.title)}</h3></div>${badge(p)}</header>${stageTrack(p)}${railMarkup(p)}<p>${esc(p.semanticReview||'Semantic review has not run yet.')}</p><ul>${notes}</ul><div class="ac-card-actions"><button type="button" data-rerun="${p.id}" ${busy?'disabled':''}>${busy?'RUNNING…':'RUN PIPELINE'}</button>${p.preview?.srcdoc?`<button type="button" data-preview="${p.id}">OPEN PREVIEW</button>`:''}<button type="button" data-signal-vote="${p.id}">VOTE!</button></div></article>`}
function renderPipelines(){const node=$('#ac-pipeline-list');if(!node)return;const rows=state.proposals.slice(0,80);node.innerHTML=rows.length?rows.map(pipelineCard).join(''):'<div class="ac-empty">The pipeline is waiting for a request.</div>'}
function renderObservatory(){
  const node=$('#ac-observatory');if(!node)return;
  const total=state.proposals.length,ready=state.proposals.filter(p=>p.stage==='preview-ready').length,blocked=state.proposals.filter(p=>['blocked','failed'].includes(p.status)).length,votes=state.proposals.filter(p=>p.voteSignal).length,readiness=total?Math.round((ready/total)*100):100;
  node.innerHTML=`<div class="ac-observe-grid"><article class="ac-observe-card"><h3>Pipeline readiness</h3><div class="ac-meter"><span style="width:${readiness}%"></span></div><p>${readiness}% of submitted changes have a validated sandbox preview.</p></article><article class="ac-observe-card"><h3>Rail pressure</h3><p><b class="${blocked?'ac-error':'ac-ok'}">${blocked}</b> blocked or failed proposals.</p></article><article class="ac-observe-card"><h3>Community attention</h3><p>${votes} proposal${votes===1?'':'s'} carrying a local support signal.</p></article><article class="ac-observe-card"><h3>Model posture</h3><p id="ac-model-posture">Checking the local semantic reflex…</p></article></div><div class="ac-rail-list">${RAILS.map(rail=>`<div class="ac-rail is-pass"><b>◆</b><span><strong>${esc(rail.label)}</strong><br><small>Applied before preview installation.</small></span></div>`).join('')}</div>`;
  modelStatus(++modelStatusTicket);
}
async function modelStatus(ticket){const node=$('#ac-model-posture');if(!node)return;try{const runtime=globalThis.CivweaveReflexRuntime||parent?.CivweaveReflexRuntime,status=await runtime?.status?.();if(ticket!==modelStatusTicket||!node.isConnected)return;node.textContent=status?.available?'MiniLM semantic retrieval is ready.':'Lexical rails are active while the semantic package warms.'}catch{if(ticket===modelStatusTicket&&node.isConnected)node.textContent='Lexical rails are active; semantic retrieval is optional.'}}
async function refreshCivicVault(){
  if(civicVaultRead)return civicVaultRead;
  civicVault={status:'loading',data:null};queueRender();
  // Read the canonical governance vault. The console never writes, normalizes,
  // imports a candidate, or creates a second authority store for this map.
  civicVaultRead=import('./anarchadia-governance-store-v145.js').then(api=>api.loadGovernanceState()).then(data=>{
    if(data&&data.schema!=='civweave.anarchadia-governance.v145')throw new Error('Unrecognized governance vault.');
    civicVault={status:'ready',data};
  }).catch(()=>{civicVault={status:'unavailable',data:null}}).finally(()=>{civicVaultRead=null;queueRender()});
  return civicVaultRead;
}
function civicOutcome(){
  for(const receipt of state.ledger.slice(0,250)){
    const outcome=receipt.kind==='preview-kept'?'accepted':receipt.kind==='preview-reverted'?'revision':'';
    if(!outcome||!receipt.id||!receipt.proposalId)continue;
    const item=proposal(receipt.proposalId),decision=item?.previewDecision;
    if(!decision||decision.state!==(outcome==='accepted'?'accepted':'reverted'))continue;
    const decidedAt=Date.parse(decision.at),recordedAt=Date.parse(receipt.time);
    if(!Number.isFinite(decidedAt)||!Number.isFinite(recordedAt)||recordedAt<decidedAt)continue;
    return{guide:'anarchadia',outcome,receiptId:receipt.id,label:outcome==='accepted'?'Preview kept':'Preview returned for changes',title:String(item.title||'Change request').slice(0,160),note:outcome==='accepted'?'The candidate is selected. Governed adoption and publication still require their own decisions.':'The generated candidate was discarded and the request returned to review.',scope:'Device-local preview decision',progressText:outcome==='accepted'?'Selected candidate · governance remains separate':'Back in review · current look retained',fresh:false,art:globalThis.CivweaveLudModeV1?.isEnabled?.()!==true&&document.documentElement.dataset.civweaveOperatingMode!=='lud'};
  }
  return null;
}
function civicStage({id,label,count,note,icon,control,tone=''}){
  return `<li class="ac-civic-node ${tone}" data-civic-stage="${id}"><button type="button" ${control}><span class="ac-civic-node-head"><span class="ac-civic-glyph" aria-hidden="true">${icon}</span><b data-civic-count>${count}</b></span><strong>${label}</strong><small>${esc(note)}</small><span class="ac-civic-open">Open <span aria-hidden="true">↗</span></span></button></li>`;
}
function renderCivicOutcome(){
  const host=$('#ac-civic-outcome'),scene=globalThis.CivweaveGuideOutcomeSceneV1;if(!host)return;
  const spec=civicOutcome();host.hidden=!spec||!scene?.render;
  if(host.hidden){host.replaceChildren();return}
  const next=document.createElement('div');next.innerHTML=scene.render(spec);scene.preserve?.(host,next);host.replaceChildren(...next.childNodes);scene.bind?.(host);
}
function renderCivicFlow(){
  const node=$('#ac-civic-flow');if(!node)return;
  if(civicVault.status==='idle')void refreshCivicVault();
  const rows=state.proposals,needsReview=rows.filter(p=>['draft','review','reverted','blocked','failed'].includes(p.status)||p.previewDecision?.state==='reverted'),blocked=rows.filter(p=>['blocked','failed'].includes(p.status)),previews=rows.filter(p=>Boolean(p.preview?.srcdoc)),kept=previews.filter(p=>p.previewDecision?.state==='accepted'),working=rows.filter(p=>runningPipelines.has(p.id)||p.status==='working');
  const known=civicVault.status==='ready',vault=civicVault.data,list=key=>Array.isArray(vault?.[key])?vault[key]:[],ballots=list('ballots'),open=ballots.filter(b=>b.status==='open'),closed=ballots.filter(b=>b.status==='closed'),packets=list('executionPackets'),unknown='—';
  const latest=rows.slice().sort((a,b)=>(Date.parse(b.updatedAt||b.createdAt)||0)-(Date.parse(a.updatedAt||a.createdAt)||0))[0];
  const decisionNote=known?`${closed.filter(b=>b.outcome?.outcome==='adopted').length} adopted · ${closed.filter(b=>b.outcome?.outcome==='not-adopted').length} not adopted · ${closed.filter(b=>b.outcome?.outcome==='no-quorum').length} no quorum`:'Read the governance vault to inspect decisions';
  const stages=[
    {id:'requests',label:'Requests',count:rows.length,note:rows.length?'Saved on this device':'No requests yet',icon:'✎',control:'data-screen-target="proposals"'},
    {id:'review',label:'Review',count:needsReview.length,note:blocked.length?`${blocked.length} blocked or failed · inspect reasons`:'Explicit approval before generation',icon:'◇',control:'data-screen-target="automation"',tone:blocked.length?'is-blocked':''},
    {id:'previews',label:'Previews',count:previews.length,note:`${kept.length} kept · ${working.length} generating`,icon:'▣',control:'data-screen-target="automation"'},
    {id:'ballots',label:'Open ballots',count:known?open.length:unknown,note:known?(open.length?'Frozen revision · review before voting':'No ballots open'):'Governance vault not yet read',icon:'⚖',control:'data-ag145-open data-ag145-view="ballots"',tone:known?'':'is-unknown'},
    {id:'decisions',label:'Recorded decisions',count:known?closed.length:unknown,note:decisionNote,icon:'▤',control:'data-ag145-open data-ag145-view="ballots"',tone:known?'':'is-unknown'},
    {id:'execution',label:'Prepared packets',count:known?packets.length:unknown,note:'Preparation is separate from execution',icon:'⌘',control:'data-ag145-open data-ag145-view="execution"',tone:known?'':'is-unknown'}
  ];
  const next=document.createElement('div');
  next.innerHTML=`<header class="ac-civic-head"><div><small>ANARCHADIA · WORK MAP</small><h2>Civic work in motion</h2><p>Follow a request from local review to a governed decision.</p></div><div class="ac-civic-head-actions"><button type="button" data-request-kind="feature">New request</button><button type="button" data-civic-refresh ${civicVault.status==='loading'?'disabled':''}>${civicVault.status==='loading'?'Reading…':civicVault.status==='unavailable'?'Retry vault':'Refresh'}</button></div></header>
    <div class="ac-civic-scopes"><span>Device-local request &amp; preview</span><span>Governance vault · this device</span></div>
    <ol class="ac-civic-track" aria-label="Civic workflow stages">${stages.map(civicStage).join('')}</ol>
    <p class="ac-civic-boundary">A kept preview is a candidate. Importing it into Governance, voting, consent, and publication are separate explicit steps.</p>
    <div class="ac-civic-next"><div><small>${latest?'LATEST REQUEST':'START A CHANGE'}</small><strong>${latest?esc(String(latest.title||'Untitled request').slice(0,160)):'What could work better?'}</strong><p>${latest?'Open the pipeline to inspect its review, safeguards, and next action.':'Describe the problem and the result you want. Review it before generation begins.'}</p></div><button type="button" ${latest?'data-screen-target="automation"':'data-request-kind="feature"'}>${latest?'Open pipeline':'New request'}</button></div>
    <div class="ac-civic-footer"><span role="status">${civicVault.status==='unavailable'?'Governance vault unavailable. Counts are unknown.':known?`${list('changeSets').length} governed changes · ${packets.length} prepared packets`:'Reading governance vault…'}</span><button type="button" data-ag145-open data-ag145-view="changes">Governed changes ↗</button><button type="button" data-ag145-open data-ag145-view="federation">Federation receipts ↗</button></div>`;
  node.replaceChildren(...next.childNodes);
}
function renderPulse(){const passport=$('#ac-passport-id');if(passport)passport.textContent=state.passportId;if(currentScreen()==='home')renderCivicFlow()}
function renderAll(){renderPulse();renderCivicOutcome();const screen=currentScreen();if(screen==='proposals')renderProposals();if(screen==='ledger')renderLedger();if(screen==='automation')renderPipelines();if(screen==='observatory')renderObservatory()}
function record(p,stage,note){p.stage=stage;p.pipeline=p.pipeline||[];p.pipeline.push({time:now(),stage,note});p.updatedAt=now();save(`pipeline:${stage}`,`${p.title}: ${note}`,p.id)}
function railCheck(p){const results=RAILS.map(rail=>{const pass=Boolean(rail.check(p));return{id:rail.id,label:rail.label,pass,note:pass?'Pass':'Needs revision before automation may continue.'}});p.rails=results;return results.every(item=>item.pass)}
async function semanticReview(p){
  const reflex=globalThis.CivweaveReflexRuntime||parent?.CivweaveReflexRuntime;
  if(!reflex?.respond)return 'Deterministic rails completed. The semantic matcher is still warming.';
  try{
    const result=await Promise.race([reflex.respond({purpose:'anarchadia-rail-review',config:{provider:'bundled'},context:{schema:'civweave.structured-context.v1',userMessage:`${p.kind}: ${p.title}\n${p.problem}\nExpected: ${p.expected}`,routingAnswer:{system:'anarchadia',mode:'Govern',room:'anarchadia.automation'},consent:{consequentialActionDetected:true}},messages:[]}),sleep(500).then(()=>null)]);
    return result?.outputJson?.answer||'Semantic review continues in the background; deterministic rails remain authoritative.';
  }catch{return 'Semantic review was unavailable; deterministic rails remain authoritative.'}
}
function deterministicPatch(p){
  const criteria=p.acceptance.map(item=>`<li>${esc(item)}</li>`).join('');
  const html=`<main class="change"><header><small>REQUEST-SUMMARY SCAFFOLD</small><h1>${esc(p.title)}</h1><p>This scaffold records the request. It does not implement the requested feature.</p></header><section><h2>Problem</h2><p>${esc(p.problem)}</p></section><section><h2>Expected result</h2><p>${esc(p.expected)}</p></section><section><h2>Acceptance</h2><ul>${criteria}</ul></section><button id="prove">Record local proof</button><output id="receipt" aria-live="polite"></output></main>`;
  const css=`:root{font-family:system-ui;color:#f7f2ea;background:#07090d}.change{max-width:760px;margin:auto;padding:32px}.change header{border-bottom:2px solid #ff2f87}.change small{color:#1fd8ff}.change h1{color:#ff2f87}.change section{margin:18px 0;padding:16px;border:1px solid #333;background:#0d131b}.change button{padding:12px 16px;border:1px solid #8dff2b;background:#08110a;color:#8dff2b;font-weight:800}.change output{display:block;margin-top:12px;color:#ffc21a}`;
  const js=`document.querySelector('#prove').addEventListener('click',()=>{document.querySelector('#receipt').textContent='Preview proof recorded locally at '+new Date().toLocaleTimeString()+'. No external action occurred.'});`;
  return compilePreviewPatch({summary:`Request-summary scaffold for ${p.area}. This does not implement the requested feature.`,preview:{html,css,js}},'civweave-safe-scaffolder');
}
function compilePreviewPatch(output,generator){
  const source=output?.preview;
  if(typeof output?.summary!=='string'||!source||typeof source.html!=='string'||!source.html.trim()||typeof source.css!=='string'||typeof source.js!=='string')throw new Error('The selected model did not return the required summary and preview HTML, CSS, and JS.');
  const preview={html:source.html,css:source.css,js:source.js};
  // Validation, governance export, and the sandbox use these exact sources.
  // The model authors each source once; it cannot supply competing file content.
  const files=[{path:'preview/index.html',content:preview.html},{path:'preview/styles.css',content:preview.css},{path:'preview/app.js',content:preview.js}];
  return {...output,preview,files,generator};
}
async function providerPatch(p){
  const sharedRuntime=()=>typeof globalThis.CivweaveModelRuntime?.generate==='function'?globalThis.CivweaveModelRuntime:parent?.CivweaveModelRuntime||globalThis.CivweaveModelRuntime;
  let runtime=sharedRuntime();
  if(typeof runtime?.generate!=='function'){await (globalThis.CivweaveFamilyAILoaderV105||parent?.CivweaveFamilyAILoaderV105)?.ensure?.();runtime=sharedRuntime()}
  const config=runtime?.readSharedConfig?.('agentic')||runtime?.readSharedConfig?.('interactive');
  if(!config)throw new Error('Select a model in shared Settings before generating this preview.');
  if(['bundled','packaged','reflex','minilm','local-reflex'].includes(String(config.provider||config.route||'').toLowerCase()))return deterministicPatch(p);
  if(typeof runtime?.generate!=='function')throw new Error('The shared model runtime is unavailable.');
  const schema={type:'object',additionalProperties:false,required:['summary','preview'],properties:{summary:{type:'string'},preview:{type:'object',additionalProperties:false,required:['html','css','js'],properties:{html:{type:'string'},css:{type:'string'},js:{type:'string'}}}}};
  const proposal=Object.fromEntries(['kind','title','problem','expected','area','acceptance','risk','evidence'].map(key=>[key,p[key]]));
  // This compiled candidate has native validation and a human Keep/Revert gate.
  // A generic assistant reply review must not replace it with a second answer.
  const result=await runtime.generate({purpose:'anarchadia-code-generation',executionProfile:'agentic',config,schema,__civweaveSkipResponseRouter:true,...(String(config.provider||config.route||'').toLowerCase()==='ollama'?{think:false}:{}),context:{proposal,rails:RAILS.map(r=>r.label),constraints:['Return only bounded preview HTML, CSS, and JS.','No network calls.','No eval or dynamic Function.','No automatic production publishing.','No identity, authority, or consensus claims.']},messages:[{role:'system',content:'Generate a self-contained HTML/CSS/JS sandbox preview that implements the supplied change request and its acceptance criteria with no external dependencies. Implement the requested interaction with the actual working behavior. Return JSON containing only summary and preview, with preview.html, preview.css, and preview.js. Write each source once in those preview fields; do not return a files array or duplicate the code. Do not substitute a request summary or claim the change is installed in production.'},{role:'user',content:JSON.stringify(proposal)}]});
  if(result?.status!=='success')throw new Error(cleanProviderError(result));
  return compilePreviewPatch(result.outputJson,'configured-provider');
}
function cleanProviderError(result){const reason=result?.error?.message||result?.error||result?.message;return typeof reason==='string'?reason.slice(0,1600):'The selected model could not generate the preview.'}
function validatePatch(patch){
  const errors=[];if(!patch?.files?.length)errors.push('No files were generated.');
  for(const file of patch?.files||[]){if(!ALLOWED_EXT.test(file.path))errors.push(`Disallowed file type: ${file.path}`);if(file.content.length>120000)errors.push(`File exceeds preview limit: ${file.path}`);for(const rule of FORBIDDEN_CODE)if(rule.test(file.content))errors.push(`Forbidden code pattern in ${file.path}: ${rule}`)}
  if(!patch?.preview?.html)errors.push('Preview HTML is missing.');return {valid:errors.length===0,errors};
}
function srcdoc(preview){return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${preview.css||''}</style></head><body>${preview.html||''}<script>${String(preview.js||'').replace(/<\/script/gi,'<\\/script')}<\/script></body></html>`}
async function runPipeline(id){
  if(runningPipelines.has(id))return;
  const p=proposal(id);if(!p)return;
  runningPipelines.add(id);delete p.patch;delete p.preview;delete p.validation;delete p.previewDecision;delete p.lastError;p.status='working';p.failedStage=null;queueRender();
  try{
    record(p,'intake','Request accepted into the local accountable-automation queue.');await sleep(90);
    record(p,'rail-check','Running deterministic rails and local semantic review.');p.semanticReview=await semanticReview(p);if(!railCheck(p)){p.status='blocked';p.failedStage='rail-check';save('proposal-blocked',`${p.title} is blocked by one or more rails.`,p.id);return}await sleep(90);
    record(p,'code-generation','Generating the approved preview with the selected model.');p.patch=await providerPatch(p);await sleep(90);
    record(p,'validation','Validating generated paths, sizes, APIs, network behavior, and authority boundaries.');const validation=validatePatch(p.patch);p.validation=validation;if(!validation.valid){p.status='failed';p.failedStage='validation';save('proposal-validation-failed',`${p.title}: ${validation.errors.join('; ')}`,p.id);return}await sleep(90);
    record(p,'sandbox-install','Installing generated files into an isolated browser preview.');p.preview={srcdoc:srcdoc(p.patch.preview),installedAt:now(),generator:p.patch.generator||'configured-provider'};await sleep(90);
    p.status='preview-ready';record(p,'preview-ready',p.patch.generator==='civweave-safe-scaffolder'?'Request-summary scaffold installed from the selected bundled provider. The requested feature has not been implemented.':'Sandbox preview installed. Production remains unchanged until an explicit community decision.');setScreen('automation');toast(p.patch.generator==='civweave-safe-scaffolder'?'Request-summary scaffold ready. Inspect its limits before keeping it.':'Preview ready. Open it when you are ready to inspect it.');return{ok:true,proposal:p};
  }catch(error){p.status='failed';p.failedStage=p.stage;p.lastError=String(error?.message||error).slice(0,1600);record(p,p.failedStage,`Preview generation failed: ${p.lastError}`);toast(`Preview generation failed: ${p.lastError}`);return{ok:false,error:p.lastError,proposal:p}}finally{runningPipelines.delete(id);queueRender()}
}
function openPreview(id){const p=proposal(id);if(!p?.preview?.srcdoc)return;$('#ac-preview-title').textContent=p.title;$('#ac-preview-frame').srcdoc=p.preview.srcdoc;const dialog=$('#ac-preview-dialog');if(dialog&&!dialog.open)dialog.showModal?.()}
function signalVote(id){const p=proposal(id);if(!p)return;p.voteSignal=!p.voteSignal;save('vote-signal',`${p.title}: local non-binding support signal ${p.voteSignal?'recorded':'removed'}.`,p.id)}
function openHub(){save('hub-vote-opened','Navigating to the Anarchadia proposal hub.',null,{render:false});try{if(window.parent&&window.parent!==window)window.parent.location.href=HUB_PROPOSALS;else location.href=HUB_PROPOSALS}catch{location.href=HUB_PROPOSALS}}
function startRequest(kind){requestKind=kind;const form=$('#ac-request-form');form.reset();const kindField=form.elements.namedItem('kind');if(kindField)kindField.value=kind;$('#ac-request-kicker').textContent=kind==='bugfix'?'BUGFIX INTAKE':'FEATURE INTAKE';$('#ac-request-title').textContent=kind==='bugfix'?'Report a bugfix':'Request a feature';setScreen('request')}
function submitRequest(event){event.preventDefault();const data=new FormData(event.currentTarget),acceptance=String(data.get('acceptance')||'').split(/\n+/).map(v=>v.trim()).filter(Boolean),p={id:uid('proposal'),kind:String(data.get('kind')||requestKind),title:String(data.get('title')||'').trim(),problem:String(data.get('problem')||'').trim(),expected:String(data.get('expected')||'').trim(),area:String(data.get('area')||'Civweave'),acceptance,risk:String(data.get('risk')||'').trim(),evidence:String(data.get('evidence')||'').trim(),status:'draft',stage:'intake',pipeline:[],createdAt:now(),updatedAt:now(),voteSignal:false};state.proposals.unshift(p);save('proposal-created',`${p.kind}: ${p.title}`,p.id);setScreen('automation');if(data.get('autoRun'))runPipeline(p.id)}

function readChat(){const rows=parse(localStorage.getItem(CHAT_KEY),[]);return Array.isArray(rows)?rows:[]}
function writeChat(rows){localStorage.setItem(CHAT_KEY,JSON.stringify(rows.slice(-100)))}
function initialChat(){return{role:'assistant',text:'I’m Merlin, Anarchadia’s civic and automation guide. Tell me what should change, what stakes are real, and how success should be tested.'}}
function renderMerlinChat(){const log=$('#ac-merlin-log'),button=$('#ac-merlin-send'),status=$('#ac-merlin-status');if(!log)return;const rows=readChat(),list=rows.length?rows:[initialChat()];log.innerHTML=list.slice(-40).map(row=>`<article class="ac-merlin-message ${row.role==='user'?'is-user':'is-merlin'}${row.pending?' is-pending':''}${row.error?' is-error':''}"><p>${esc(row.text)}</p>${row.provider?`<small>${esc(row.provider)}${row.model?` · ${esc(row.model)}`:''}</small>`:''}</article>`).join('');log.scrollTop=log.scrollHeight;if(button){button.disabled=merlinBusy;button.textContent=merlinBusy?'THINKING…':'SEND'}if(status)status.textContent=merlinBusy?'Merlin is checking rails, assumptions, and next actions.':'Local history · shared model settings'}
async function sendMerlin(event){event.preventDefault();if(merlinBusy)return;const input=$('#ac-merlin-input'),text=String(input?.value||'').trim().slice(0,8000);if(!text)return;const rows=readChat(),pendingId=uid('merlin');rows.push({role:'user',text},{role:'assistant',id:pendingId,text:'Merlin is translating the request into plain mechanics and accountable next actions…',pending:true});writeChat(rows);input.value='';merlinBusy=true;renderMerlinChat();try{await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();const api=globalThis.CivweaveGuideChatV153;if(!api?.ask)throw new Error('The shared guide runtime did not become ready.');const reply=await api.ask('anarchadia',text,rows),latest=readChat(),index=latest.findIndex(row=>row.id===pendingId);if(index>=0)latest[index]=reply;else latest.push(reply);writeChat(latest)}catch(error){const latest=readChat(),index=latest.findIndex(row=>row.id===pendingId),reply={role:'assistant',text:`Merlin could not complete this call: ${error.message}`,error:true};if(index>=0)latest[index]=reply;else latest.push(reply);writeChat(latest)}finally{merlinBusy=false;renderMerlinChat();input?.focus()}}
async function openFullMerlin(){try{await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();globalThis.CivweaveGuideChatV153?.open?.('anarchadia')}catch(error){toast(error.message)}}
function click(event){const target=event.target.closest('button,[data-action]');if(!target)return;if(target.hasAttribute('data-civic-refresh')){void refreshCivicVault();return}if(target.dataset.screenTarget){setScreen(target.dataset.screenTarget);return}if(target.dataset.requestKind){startRequest(target.dataset.requestKind);return}if(target.dataset.action==='vote-hub'){openHub();return}if(target.dataset.action==='open-merlin-guide'){openFullMerlin();return}if(target.dataset.preview){openPreview(target.dataset.preview);return}if(target.dataset.rerun){runPipeline(target.dataset.rerun);return}if(target.dataset.openPipeline){setScreen('automation');return}if(target.dataset.signalVote){signalVote(target.dataset.signalVote);return}if(target.matches('[data-close-preview]')){$('#ac-preview-dialog')?.close();return}}

document.addEventListener('click',click);
$('#ac-request-form').addEventListener('submit',submitRequest);
$('#ac-preview-dialog').addEventListener('click',event=>{if(event.target===$('#ac-preview-dialog'))event.target.close()});
$('#ac-merlin-form').addEventListener('submit',sendMerlin);
addEventListener('storage',event=>{if(event.key===CHAT_KEY)renderMerlinChat();if(event.key===STORAGE_KEY&&event.newValue){state=parse(event.newValue,state);queueRender()}});
renderAll();setScreen('home');renderMerlinChat();
globalThis.AnarchadiaCitizenConsoleV158={version:VERSION,setScreen,runPipeline,render:queueRender,openMerlin:openFullMerlin};
})();
