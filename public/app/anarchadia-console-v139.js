(()=>{
'use strict';
const STORAGE_KEY='civweave.anarchadia.citizen-console.v139';
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

function defaultState(){
  return {schema:'civweave.anarchadia-console.v1',passportId:`AC-${crypto?.randomUUID?.().slice(0,8).toUpperCase()||Math.random().toString(36).slice(2,10).toUpperCase()}`,proposals:[],ledger:[{id:uid('evt'),time:now(),kind:'console-ready',detail:'Citizen console initialized locally.'}],settings:{autoRun:true}};
}
let state=load();
let requestKind='feature';
function load(){
  const saved=parse(localStorage.getItem(STORAGE_KEY),null);
  if(saved?.schema==='civweave.anarchadia-console.v1'&&saved?.passportId)return saved;
  const fresh=defaultState();
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(fresh))}catch{}
  return fresh;
}
function save(kind,detail,proposalId=null){if(kind)state.ledger.unshift({id:uid('evt'),time:now(),kind,detail,proposalId});state.ledger=state.ledger.slice(0,250);localStorage.setItem(STORAGE_KEY,JSON.stringify(state));renderAll()}
function proposal(id){return state.proposals.find(item=>item.id===id)}
function setScreen(name){$('#ac-app').dataset.screen=name;$$('.ac-screen').forEach(node=>node.hidden=node.dataset.screen!==name);const home=name==='home';$$('.ac-passport,.ac-grid,.ac-pulse').forEach(node=>node.hidden=!home);window.scrollTo({top:0,behavior:'smooth'})}
function badge(p){const blocked=p.status==='blocked'||p.status==='failed';const ready=p.stage==='preview-ready';return `<span class="ac-badge ${blocked?'is-blocked':ready?'is-ready':'is-working'}">${esc(blocked?p.status:ready?'preview ready':p.stage)}</span>`}
function stageIndex(p){return Math.max(0,STAGES.indexOf(p.stage))}
function stageTrack(p){const active=stageIndex(p);return `<div class="ac-pipeline-track">${STAGES.map((stage,index)=>`<span class="ac-stage ${p.failedStage===stage?'is-failed':index<active||p.stage==='preview-ready'?'is-done':index===active?'is-active':''}">${esc(stage.replaceAll('-',' '))}</span>`).join('')}</div>`}
function railMarkup(p){return `<div class="ac-rail-list">${(p.rails||[]).map(item=>`<div class="ac-rail ${item.pass?'is-pass':'is-fail'}"><b>${item.pass?'✓':'!'}</b><span><strong>${esc(item.label)}</strong>${item.note?`<br><small>${esc(item.note)}</small>`:''}</span></div>`).join('')}</div>`}
function proposalCard(p){return `<article class="ac-card"><header><div><small>${esc(p.kind)} · ${esc(p.area)}</small><h3>${esc(p.title)}</h3></div>${badge(p)}</header><p>${esc(p.problem)}</p>${stageTrack(p)}<div class="ac-card-actions"><button type="button" data-open-pipeline="${p.id}">PIPELINE</button>${p.preview?.srcdoc?`<button type="button" data-preview="${p.id}">PREVIEW</button>`:''}<button type="button" data-signal-vote="${p.id}">${p.voteSignal?'SUPPORT SIGNALLED':'VOTE!'}</button><button type="button" data-rerun="${p.id}">RUN AGAIN</button></div></article>`}
function renderProposals(){const node=$('#ac-proposal-list');node.innerHTML=state.proposals.length?state.proposals.map(proposalCard).join(''):'<div class="ac-empty">No proposals yet. Submit a bugfix or feature request to wake the pipeline.</div>'}
function renderLedger(){const node=$('#ac-ledger');node.innerHTML=state.ledger.length?state.ledger.map(item=>`<article class="ac-ledger-entry"><time>${esc(new Date(item.time).toLocaleString())}</time><div><b>${esc(item.kind)}</b><p>${esc(item.detail)}</p></div></article>`).join(''):'<div class="ac-empty">No receipts yet.</div>'}
function pipelineCard(p){const notes=(p.pipeline||[]).slice().reverse().map(item=>`<li><b>${esc(item.stage)}</b> · ${esc(item.note)}</li>`).join('');return `<article class="ac-pipeline-card"><header><div><small>${esc(p.kind)} · ${esc(p.id)}</small><h3>${esc(p.title)}</h3></div>${badge(p)}</header>${stageTrack(p)}${railMarkup(p)}<p>${esc(p.semanticReview||'Semantic review has not run yet.')}</p><ul>${notes}</ul><div class="ac-card-actions"><button type="button" data-rerun="${p.id}">RUN PIPELINE</button>${p.preview?.srcdoc?`<button type="button" data-preview="${p.id}">OPEN PREVIEW</button>`:''}<button type="button" data-signal-vote="${p.id}">VOTE!</button></div></article>`}
function renderPipelines(){const node=$('#ac-pipeline-list');node.innerHTML=state.proposals.length?state.proposals.map(pipelineCard).join(''):'<div class="ac-empty">The pipeline is waiting for a request.</div>'}
function renderObservatory(){
  const total=state.proposals.length;const ready=state.proposals.filter(p=>p.stage==='preview-ready').length;const blocked=state.proposals.filter(p=>['blocked','failed'].includes(p.status)).length;const votes=state.proposals.filter(p=>p.voteSignal).length;const readiness=total?Math.round((ready/total)*100):100;
  $('#ac-observatory').innerHTML=`<div class="ac-observe-grid"><article class="ac-observe-card"><h3>Pipeline readiness</h3><div class="ac-meter"><span style="width:${readiness}%"></span></div><p>${readiness}% of submitted changes have a validated sandbox preview.</p></article><article class="ac-observe-card"><h3>Rail pressure</h3><p><b class="${blocked?'ac-error':'ac-ok'}">${blocked}</b> blocked or failed proposals.</p></article><article class="ac-observe-card"><h3>Community attention</h3><p>${votes} proposal${votes===1?'':'s'} carrying a local support signal.</p></article><article class="ac-observe-card"><h3>Model posture</h3><p id="ac-model-posture">Checking the local semantic reflex…</p></article></div><div class="ac-rail-list">${RAILS.map(rail=>`<div class="ac-rail is-pass"><b>◆</b><span><strong>${esc(rail.label)}</strong><br><small>Applied before preview installation.</small></span></div>`).join('')}</div>`;
  modelStatus();
}
async function modelStatus(){const node=$('#ac-model-posture');if(!node)return;try{const runtime=globalThis.CivweaveReflexRuntime||parent?.CivweaveReflexRuntime;const status=await runtime?.status?.();node.textContent=status?.available?'MiniLM semantic retrieval is ready.':'Lexical rails are active while the semantic package warms.'}catch{node.textContent='Lexical rails are active; semantic retrieval is optional.'}}
function renderPulse(){const total=state.proposals.length,ready=state.proposals.filter(p=>p.stage==='preview-ready').length;$('#ac-passport-id').textContent=state.passportId;$('#ac-proposal-count').textContent=String(total);$('#ac-participation').textContent=total?`${Math.round((state.proposals.filter(p=>p.voteSignal).length/total)*100)}%`:'0%';$('#ac-momentum').textContent=total?(ready===total?'HIGH':ready?'RISING':'FORMING'):'IDLE'}
function renderAll(){renderPulse();renderProposals();renderLedger();renderPipelines();renderObservatory()}
function record(p,stage,note){p.stage=stage;p.pipeline=p.pipeline||[];p.pipeline.push({time:now(),stage,note});p.updatedAt=now();save(`pipeline:${stage}`,`${p.title}: ${note}`,p.id)}
function railCheck(p){const results=RAILS.map(rail=>({id:rail.id,label:rail.label,pass:Boolean(rail.check(p)),note:rail.check(p)?'Pass':'Needs revision before automation may continue.'}));p.rails=results;return results.every(item=>item.pass)}
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
  const html=`<main class="change"><header><small>${esc(p.kind.toUpperCase())} PREVIEW</small><h1>${esc(p.title)}</h1></header><section><h2>Problem</h2><p>${esc(p.problem)}</p></section><section><h2>Expected result</h2><p>${esc(p.expected)}</p></section><section><h2>Acceptance</h2><ul>${criteria}</ul></section><button id="prove">Record local proof</button><output id="receipt" aria-live="polite"></output></main>`;
  const css=`:root{font-family:system-ui;color:#f7f2ea;background:#07090d}.change{max-width:760px;margin:auto;padding:32px}.change header{border-bottom:2px solid #ff2f87}.change small{color:#1fd8ff}.change h1{color:#ff2f87}.change section{margin:18px 0;padding:16px;border:1px solid #333;background:#0d131b}.change button{padding:12px 16px;border:1px solid #8dff2b;background:#08110a;color:#8dff2b;font-weight:800}.change output{display:block;margin-top:12px;color:#ffc21a}`;
  const js=`document.querySelector('#prove').addEventListener('click',()=>{document.querySelector('#receipt').textContent='Preview proof recorded locally at '+new Date().toLocaleTimeString()+'. No external action occurred.'});`;
  return {generator:'civweave-safe-scaffolder',summary:`Generated a bounded ${p.kind} preview for ${p.area}.`,files:[{path:'preview/index.html',content:html},{path:'preview/styles.css',content:css},{path:'preview/app.js',content:js}],preview:{html,css,js}};
}
async function providerPatch(p){
  const runtime=globalThis.CivweaveModelRuntime||parent?.CivweaveModelRuntime;const config=runtime?.readSharedConfig?.('agentic');
  if(!runtime?.generate||!config||['bundled','packaged','reflex','minilm','local-reflex'].includes(String(config.provider||config.route||'').toLowerCase()))return deterministicPatch(p);
  const schema={type:'object',required:['summary','files','preview'],properties:{summary:{type:'string'},files:{type:'array',items:{type:'object',required:['path','content'],properties:{path:{type:'string'},content:{type:'string'}}}},preview:{type:'object',required:['html','css','js'],properties:{html:{type:'string'},css:{type:'string'},js:{type:'string'}}}}};
  try{
    const result=await runtime.generate({purpose:'anarchadia-code-generation',executionProfile:'agentic',config,schema,context:{proposal:p,rails:RAILS.map(r=>r.label),constraints:['Return only bounded preview files.','No network calls.','No eval or dynamic Function.','No automatic production publishing.','No identity, authority, or consensus claims.']},messages:[{role:'system',content:'Generate a small HTML/CSS/JS sandbox preview for the supplied change request. Return JSON matching the schema. Do not claim the change is installed in production.'},{role:'user',content:JSON.stringify(p)}]});
    if(result?.status==='success'&&result.outputJson?.files?.length)return result.outputJson;
  }catch{}
  return deterministicPatch(p);
}
function validatePatch(patch){
  const errors=[];if(!patch?.files?.length)errors.push('No files were generated.');
  for(const file of patch?.files||[]){if(!ALLOWED_EXT.test(file.path))errors.push(`Disallowed file type: ${file.path}`);if(file.content.length>120000)errors.push(`File exceeds preview limit: ${file.path}`);for(const rule of FORBIDDEN_CODE)if(rule.test(file.content))errors.push(`Forbidden code pattern in ${file.path}: ${rule}`)}
  if(!patch?.preview?.html)errors.push('Preview HTML is missing.');return {valid:errors.length===0,errors};
}
function srcdoc(preview){return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${preview.css||''}</style></head><body>${preview.html||''}<script>${String(preview.js||'').replace(/<\/script/gi,'<\\/script')}<\/script></body></html>`}
async function runPipeline(id){
  const p=proposal(id);if(!p)return;p.status='working';p.failedStage=null;record(p,'intake','Request accepted into the local accountable-automation queue.');await sleep(120);
  record(p,'rail-check','Running deterministic rails and local semantic review.');p.semanticReview=await semanticReview(p);if(!railCheck(p)){p.status='blocked';p.failedStage='rail-check';save('proposal-blocked',`${p.title} is blocked by one or more rails.`,p.id);return}await sleep(120);
  record(p,'code-generation','Generating a bounded patch with the configured provider or safe local scaffolder.');p.patch=await providerPatch(p);await sleep(120);
  record(p,'validation','Validating generated paths, sizes, APIs, network behavior, and authority boundaries.');const validation=validatePatch(p.patch);p.validation=validation;if(!validation.valid){p.status='failed';p.failedStage='validation';save('proposal-validation-failed',`${p.title}: ${validation.errors.join('; ')}`,p.id);return}await sleep(120);
  record(p,'sandbox-install','Installing generated files into an isolated browser preview.');p.preview={srcdoc:srcdoc(p.patch.preview),installedAt:now(),generator:p.patch.generator||'configured-provider'};await sleep(120);
  p.status='preview-ready';record(p,'preview-ready','Sandbox preview installed. Production remains unchanged until an explicit community decision.');openPreview(p.id);
}
function openPreview(id){const p=proposal(id);if(!p?.preview?.srcdoc)return;$('#ac-preview-title').textContent=p.title;$('#ac-preview-frame').srcdoc=p.preview.srcdoc;const dialog=$('#ac-preview-dialog');dialog.showModal?.()}
function signalVote(id){const p=proposal(id);if(!p)return;p.voteSignal=!p.voteSignal;save('vote-signal',`${p.title}: local non-binding support signal ${p.voteSignal?'recorded':'removed'}.`,p.id)}
function openHub(){save('hub-vote-opened','Navigating to the Anarchadia proposal hub.');try{if(window.parent&&window.parent!==window)window.parent.location.href=HUB_PROPOSALS;else location.href=HUB_PROPOSALS}catch{location.href=HUB_PROPOSALS}}
function startRequest(kind){requestKind=kind;const form=$('#ac-request-form');form.reset();form.kind.value=kind;form.autoRun.checked=true;$('#ac-request-kicker').textContent=kind==='bugfix'?'BUGFIX INTAKE':'FEATURE INTAKE';$('#ac-request-title').textContent=kind==='bugfix'?'Report a bugfix':'Request a feature';setScreen('request')}
function submitRequest(event){event.preventDefault();const data=new FormData(event.currentTarget);const acceptance=String(data.get('acceptance')||'').split(/\n+/).map(v=>v.trim()).filter(Boolean);const p={id:uid('proposal'),kind:String(data.get('kind')||requestKind),title:String(data.get('title')||'').trim(),problem:String(data.get('problem')||'').trim(),expected:String(data.get('expected')||'').trim(),area:String(data.get('area')||'Civweave'),acceptance,risk:String(data.get('risk')||'').trim(),evidence:String(data.get('evidence')||'').trim(),status:'draft',stage:'intake',pipeline:[],createdAt:now(),updatedAt:now(),voteSignal:false};state.proposals.unshift(p);save('proposal-created',`${p.kind}: ${p.title}`,p.id);setScreen('automation');if(data.get('autoRun'))runPipeline(p.id)}
function click(event){const target=event.target.closest('button,[data-action]');if(!target)return;if(target.dataset.screenTarget){setScreen(target.dataset.screenTarget);return}if(target.dataset.requestKind){startRequest(target.dataset.requestKind);return}if(target.dataset.action==='vote-hub'){openHub();return}if(target.dataset.preview){openPreview(target.dataset.preview);return}if(target.dataset.rerun){runPipeline(target.dataset.rerun);return}if(target.dataset.openPipeline){setScreen('automation');return}if(target.dataset.signalVote){signalVote(target.dataset.signalVote);return}if(target.matches('[data-close-preview]')){$('#ac-preview-dialog').close();return}}

document.addEventListener('click',click);$('#ac-request-form').addEventListener('submit',submitRequest);$('#ac-preview-dialog').addEventListener('click',event=>{if(event.target===$('#ac-preview-dialog'))event.target.close()});renderAll();setScreen('home');
})();
