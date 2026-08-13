(()=>{
'use strict';
const VERSION='1.0.5-anarchadia-v158-consensus-aware';
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
function showDialog(dialog){if(!dialog)return;if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','')}
function closeDialog(dialog){if(!dialog)return;if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open')}

function defaultState(){
  return {schema:'civweave.anarchadia-console.v1',passportId:`AC-${crypto?.randomUUID?.().slice(0,8).toUpperCase()||Math.random().toString(36).slice(2,10).toUpperCase()}`,proposals:[],ledger:[{id:uid('evt'),time:now(),kind:'console-ready',detail:'Citizen console initialized locally.'}],settings:{autoRun:true}};
}
let state=load();
let requestKind='feature';
let renderQueued=false;
let modelStatusTicket=0;
let merlinBusy=false;
const runningPipelines=new Set();

function load(){const saved=parse(localStorage.getItem(STORAGE_KEY),null);return saved?.schema==='civweave.anarchadia-console.v1'?saved:defaultState()}
function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function queueRender(){if(renderQueued)return;renderQueued=true;frame(()=>{renderQueued=false;renderAll()})}
function save(kind,detail,proposalId=null,{render=true}={}){if(kind)state.ledger.unshift({id:uid('evt'),time:now(),kind,detail,proposalId});state.ledger=state.ledger.slice(0,250);persist();if(render)queueRender()}
function proposal(id){return state.proposals.find(item=>item.id===id)}
function currentScreen(){return $('#ac-app')?.dataset.screen||'home'}
function setScreen(name){const app=$('#ac-app');if(!app)return;app.dataset.screen=name;$$('.ac-screen').forEach(node=>node.hidden=node.dataset.screen!==name);const home=name==='home';$$('.ac-passport,.ac-grid,.ac-pulse').forEach(node=>node.hidden=!home);queueRender();window.scrollTo({top:0,behavior:'auto'})}
function toast(message){const node=$('#ac-toast');if(!node)return;node.textContent=message;node.hidden=false;clearTimeout(node._timer);node._timer=setTimeout(()=>node.hidden=true,2600)}
function badge(p){const blocked=p.status==='blocked'||p.status==='failed';const ready=p.stage==='preview-ready';const governed=p.status==='awaiting-consensus';return `<span class="ac-badge ${blocked?'is-blocked':ready?'is-ready':'is-working'}">${esc(governed?`${p.authority?.level||'hub'} consensus`:blocked?p.status:ready?'preview ready':p.stage)}</span>`}
function stageIndex(p){return Math.max(0,STAGES.indexOf(p.stage))}
function stageTrack(p){const active=stageIndex(p);return `<div class="ac-pipeline-track">${STAGES.map((stage,index)=>`<span class="ac-stage ${p.failedStage===stage?'is-failed':index<active||p.stage==='preview-ready'?'is-done':index===active?'is-active':''}">${esc(stage.replaceAll('-',' '))}</span>`).join('')}</div>`}
function railMarkup(p){return `<div class="ac-rail-list">${(p.rails||[]).map(item=>`<div class="ac-rail ${item.pass?'is-pass':'is-fail'}"><b>${item.pass?'✓':'!'}</b><span><strong>${esc(item.label)}</strong>${item.note?`<br><small>${esc(item.note)}</small>`:''}</span></div>`).join('')}</div>`}
function proposalCard(p){const busy=runningPipelines.has(p.id);return `<article class="ac-card"><header><div><small>${esc(p.kind)} · ${esc(p.area)}</small><h3>${esc(p.title)}</h3></div>${badge(p)}</header><p>${esc(p.problem)}</p>${stageTrack(p)}<div class="ac-card-actions"><button type="button" data-open-pipeline="${p.id}">STEWARDSHIP</button>${p.preview?.srcdoc?`<button type="button" data-preview="${p.id}">PREVIEW</button>`:''}<button type="button" data-rerun="${p.id}" ${busy||p.status==='awaiting-consensus'?'disabled':''}>${busy?'RUNNING…':'RUN AGAIN'}</button></div></article>`}
function renderProposals(){const node=$('#ac-proposal-list');if(!node)return;const rows=state.proposals.slice(0,80);node.innerHTML=rows.length?rows.map(proposalCard).join(''):'<div class="ac-empty">No proposals yet. Submit a bugfix or feature request to wake the pipeline.</div>'}
function renderLedger(){const node=$('#ac-ledger');if(!node)return;const rows=state.ledger.slice(0,120);node.innerHTML=rows.length?rows.map(item=>`<article class="ac-ledger-entry"><time>${esc(new Date(item.time).toLocaleString())}</time><div><b>${esc(item.kind)}</b><p>${esc(item.detail)}</p></div></article>`).join(''):'<div class="ac-empty">No receipts yet.</div>'}
function pipelineCard(p){const busy=runningPipelines.has(p.id),notes=(p.pipeline||[]).slice(-40).reverse().map(item=>`<li><b>${esc(item.stage)}</b> · ${esc(item.note)}</li>`).join('');return `<article class="ac-pipeline-card"><header><div><small>${esc(p.kind)} · ${esc(p.id)}</small><h3>${esc(p.title)}</h3></div>${badge(p)}</header>${stageTrack(p)}${railMarkup(p)}<p>${esc(p.semanticReview||'Semantic review has not run yet.')}</p><ul>${notes}</ul><div class="ac-card-actions"><button type="button" data-rerun="${p.id}" ${busy||p.status==='awaiting-consensus'?'disabled':''}>${busy?'RUNNING…':p.status==='awaiting-consensus'?'CONSENSUS REQUIRED':'RUN PIPELINE'}</button>${p.preview?.srcdoc?`<button type="button" data-preview="${p.id}">OPEN PREVIEW</button>`:''}</div></article>`}
function renderPipelines(){const node=$('#ac-pipeline-list');if(!node)return;const rows=state.proposals.slice(0,80);node.innerHTML=rows.length?rows.map(pipelineCard).join(''):'<div class="ac-empty">The pipeline is waiting for a request.</div>'}
function renderObservatory(){
  const node=$('#ac-observatory');if(!node)return;
  const total=state.proposals.length,ready=state.proposals.filter(p=>p.stage==='preview-ready').length,blocked=state.proposals.filter(p=>['blocked','failed'].includes(p.status)).length,governed=state.proposals.filter(p=>p.status==='awaiting-consensus').length,readiness=total?Math.round((ready/total)*100):100;
  node.innerHTML=`<div class="ac-observe-grid"><article class="ac-observe-card"><h3>Pipeline readiness</h3><div class="ac-meter"><span style="width:${readiness}%"></span></div><p>${readiness}% of submitted changes have a validated sandbox preview.</p></article><article class="ac-observe-card"><h3>Rail pressure</h3><p><b class="${blocked?'ac-error':'ac-ok'}">${blocked}</b> blocked or failed requests.</p></article><article class="ac-observe-card"><h3>Consensus queue</h3><p><b>${governed}</b> shared change${governed===1?'':'s'} awaiting legitimate quorum.</p></article><article class="ac-observe-card"><h3>Model posture</h3><p id="ac-model-posture">Checking the local semantic reflex…</p></article></div><div class="ac-rail-list">${RAILS.map(rail=>`<div class="ac-rail is-pass"><b>◆</b><span><strong>${esc(rail.label)}</strong><br><small>Applied before preview installation.</small></span></div>`).join('')}</div>`;
  modelStatus(++modelStatusTicket);
}
async function modelStatus(ticket){const node=$('#ac-model-posture');if(!node)return;try{const runtime=globalThis.CivweaveReflexRuntime||parent?.CivweaveReflexRuntime,status=await runtime?.status?.();if(ticket!==modelStatusTicket||!node.isConnected)return;node.textContent=status?.available?'MiniLM semantic retrieval is ready.':'Lexical rails are active while the semantic package warms.'}catch{if(ticket===modelStatusTicket&&node.isConnected)node.textContent='Lexical rails are active; semantic retrieval is optional.'}}
function renderPulse(){const total=state.proposals.length,ready=state.proposals.filter(p=>p.stage==='preview-ready').length,governed=state.proposals.filter(p=>p.status==='awaiting-consensus').length;$('#ac-passport-id').textContent=state.passportId;$('#ac-proposal-count').textContent=String(total);$('#ac-participation').textContent=total?`${Math.round((ready/total)*100)}%`:'0%';$('#ac-momentum').textContent=governed?'QUORUM':total?(ready===total?'READY':ready?'WORKING':'REVIEW'):'IDLE'}
function renderAll(){renderPulse();const screen=currentScreen();if(screen==='proposals')renderProposals();if(screen==='ledger')renderLedger();if(screen==='automation')renderPipelines();if(screen==='observatory')renderObservatory()}
function record(p,stage,note){p.stage=stage;p.pipeline=p.pipeline||[];p.pipeline.push({time:now(),stage,note});p.updatedAt=now();save(`pipeline:${stage}`,`${p.title}: ${note}`,p.id)}
function railCheck(p){const results=RAILS.map(rail=>{const pass=Boolean(rail.check(p));return{id:rail.id,label:rail.label,pass,note:pass?'Pass':'Needs revision before automation may continue.'}});p.rails=results;return results.every(item=>item.pass)}
function assessProposal(p){const results=RAILS.map(rail=>{const pass=Boolean(rail.check(p));return{id:rail.id,label:rail.label,pass,note:pass?'Pass':'Resolve this rail before work can begin.'}});return{passed:results.every(item=>item.pass),results,blocking:results.filter(item=>!item.pass)}}
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
  const runtime=globalThis.CivweaveModelRuntime||parent?.CivweaveModelRuntime,config=runtime?.readSharedConfig?.('agentic');
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
  if(runningPipelines.has(id))return;
  const p=proposal(id);if(!p)return;
  if(p.authority?.requiresConsensus&&p.authority?.consensusState!=='adopted'){p.status='awaiting-consensus';save('proposal-consensus-required',`${p.title} cannot enter code generation before ${p.authority.level} consensus is adopted.`,p.id);return}
  runningPipelines.add(id);p.status='working';p.failedStage=null;queueRender();
  try{
    record(p,'intake','Request accepted into the local accountable-automation queue.');await sleep(90);
    record(p,'rail-check','Running deterministic rails and local semantic review.');p.semanticReview=await semanticReview(p);if(!railCheck(p)){p.status='blocked';p.failedStage='rail-check';save('proposal-blocked',`${p.title} is blocked by one or more rails.`,p.id);return}await sleep(90);
    record(p,'code-generation','Generating a bounded patch with the configured provider or safe local scaffolder.');p.patch=await providerPatch(p);await sleep(90);
    record(p,'validation','Validating generated paths, sizes, APIs, network behavior, and authority boundaries.');const validation=validatePatch(p.patch);p.validation=validation;if(!validation.valid){p.status='failed';p.failedStage='validation';save('proposal-validation-failed',`${p.title}: ${validation.errors.join('; ')}`,p.id);return}await sleep(90);
    record(p,'sandbox-install','Installing generated files into an isolated browser preview.');p.preview={srcdoc:srcdoc(p.patch.preview),installedAt:now(),generator:p.patch.generator||'configured-provider'};await sleep(90);
    p.status='preview-ready';record(p,'preview-ready','Sandbox preview installed. Production remains unchanged until an explicit community decision.');setScreen('automation');toast('Preview ready. Open it when you are ready to inspect it.');
  }finally{runningPipelines.delete(id);queueRender()}
}
function openPreview(id){const p=proposal(id);if(!p?.preview?.srcdoc)return;$('#ac-preview-title').textContent=p.title;$('#ac-preview-frame').srcdoc=p.preview.srcdoc;const dialog=$('#ac-preview-dialog');if(dialog&&!dialog.open)showDialog(dialog)}
function signalVote(id){const p=proposal(id);if(!p)return;p.voteSignal=!p.voteSignal;save('vote-signal',`${p.title}: local non-binding support signal ${p.voteSignal?'recorded':'removed'}.`,p.id)}
function openHub(){save('hub-vote-opened','Navigating to the Anarchadia proposal hub.',null,{render:false});try{if(window.parent&&window.parent!==window)window.parent.location.href=HUB_PROPOSALS;else location.href=HUB_PROPOSALS}catch{location.href=HUB_PROPOSALS}}
function startRequest(kind){requestKind=kind;const form=$('#ac-request-form');form.reset();form.kind.value=kind;$('#ac-request-kicker').textContent=kind==='bugfix'?'BUGFIX INTAKE':'FEATURE INTAKE';$('#ac-request-title').textContent=kind==='bugfix'?'Report a bugfix':'Request a feature';setScreen('request')}
function submitRequest(event){event.preventDefault();const data=new FormData(event.currentTarget),acceptance=String(data.get('acceptance')||'').split(/\n+/).map(v=>v.trim()).filter(Boolean),p={id:uid('proposal'),kind:String(data.get('kind')||requestKind),title:String(data.get('title')||'').trim(),problem:String(data.get('problem')||'').trim(),expected:String(data.get('expected')||'').trim(),area:String(data.get('area')||'Anarchadia'),impact:String(data.get('impact')||'auto'),acceptance,risk:String(data.get('risk')||'').trim(),evidence:String(data.get('evidence')||'').trim(),status:'review',stage:'intake',pipeline:[],createdAt:now(),updatedAt:now()};state.proposals.unshift(p);save('proposal-created',`${p.kind}: ${p.title}`,p.id);setScreen('automation')}

function readChat(){const rows=parse(localStorage.getItem(CHAT_KEY),[]);return Array.isArray(rows)?rows:[]}
function writeChat(rows){localStorage.setItem(CHAT_KEY,JSON.stringify(rows.slice(-100)))}
function initialChat(){return{role:'assistant',text:'I’m Merlin, Anarchadia’s civic and automation guide. Tell me what should change, what stakes are real, and how success should be tested.'}}
function renderMerlinChat(){const log=$('#ac-merlin-log'),button=$('#ac-merlin-send'),status=$('#ac-merlin-status');if(!log)return;const rows=readChat(),list=rows.length?rows:[initialChat()];log.innerHTML=list.slice(-40).map(row=>`<article class="ac-merlin-message ${row.role==='user'?'is-user':'is-merlin'}${row.pending?' is-pending':''}${row.error?' is-error':''}"><p>${esc(row.text)}</p>${row.provider?`<small>${esc(row.provider)}${row.model?` · ${esc(row.model)}`:''}</small>`:''}</article>`).join('');log.scrollTop=log.scrollHeight;if(button){button.disabled=merlinBusy;button.textContent=merlinBusy?'THINKING…':'SEND'}if(status)status.textContent=merlinBusy?'Merlin is checking rails, assumptions, and next actions.':'Local history · shared model settings'}
async function sendMerlin(event){event.preventDefault();if(merlinBusy)return;const input=$('#ac-merlin-input'),text=String(input?.value||'').trim().slice(0,8000);if(!text)return;const rows=readChat(),pendingId=uid('merlin');rows.push({role:'user',text},{role:'assistant',id:pendingId,text:'Merlin is translating the request into plain mechanics and accountable next actions…',pending:true});writeChat(rows);input.value='';merlinBusy=true;renderMerlinChat();try{await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();const api=globalThis.CivweaveGuideChatV153;if(!api?.ask)throw new Error('The shared guide runtime did not become ready.');const reply=await api.ask('anarchadia',text,rows),latest=readChat(),index=latest.findIndex(row=>row.id===pendingId);if(index>=0)latest[index]=reply;else latest.push(reply);writeChat(latest)}catch(error){const latest=readChat(),index=latest.findIndex(row=>row.id===pendingId),reply={role:'assistant',text:`Merlin could not complete this call: ${error.message}`,error:true};if(index>=0)latest[index]=reply;else latest.push(reply);writeChat(latest)}finally{merlinBusy=false;renderMerlinChat();input?.focus()}}
async function openFullMerlin(){try{await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();globalThis.CivweaveGuideChatV153?.open?.('anarchadia')}catch(error){toast(error.message)}}
function click(event){const target=event.target.closest('button,[data-action]');if(!target)return;if(target.dataset.screenTarget){setScreen(target.dataset.screenTarget);return}if(target.dataset.requestKind){startRequest(target.dataset.requestKind);return}if(target.dataset.action==='vote-hub'){globalThis.AnarchadiaConsensusV145?.showIntentions?.();return}if(target.dataset.action==='open-merlin-guide'){openFullMerlin();return}if(target.dataset.preview){openPreview(target.dataset.preview);return}if(target.dataset.rerun){runPipeline(target.dataset.rerun);return}if(target.dataset.openPipeline){setScreen('automation');return}if(target.matches('[data-close-preview]')){closeDialog($('#ac-preview-dialog'));return}}

document.addEventListener('click',click);
$('#ac-request-form').addEventListener('submit',submitRequest);
$('#ac-preview-dialog').addEventListener('click',event=>{if(event.target===$('#ac-preview-dialog'))closeDialog(event.target)});
$('#ac-merlin-form').addEventListener('submit',sendMerlin);
addEventListener('storage',event=>{if(event.key===CHAT_KEY)renderMerlinChat();if(event.key===STORAGE_KEY&&event.newValue){state=parse(event.newValue,state);queueRender()}});
addEventListener('anarchadia:console-changed',event=>{state=parse(event.detail?.serialized||localStorage.getItem(STORAGE_KEY),state);queueRender()});
renderAll();setScreen('home');renderMerlinChat();
globalThis.AnarchadiaCitizenConsoleV158={version:VERSION,setScreen,runPipeline,assessProposal,render:queueRender,openMerlin:openFullMerlin,toast};
})();
