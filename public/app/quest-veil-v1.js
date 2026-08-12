(()=>{
'use strict';
if(globalThis.CivweaveQuestVeilV1)return;

const VERSION='1.0.0-quest-veil-v1';
const PROMPT_VERSION='weaveling-quest-veil-writer-v1';
const ENTRY_SCHEMA='civweave.chronicle-entry.quest-veil.v1';
const VEIL_SCHEMA='civweave.quest-veil-state.v1';
const KEYS=Object.freeze({
  campus:'civweave.working-campus.v1',
  intentions:'civweave.intentions.v127',
  chronicle:'civweave.chronicle-ledger.v1.1'
});
const THEMES=Object.freeze([
  {id:'constellation',label:'Constellation',place:'a midnight observatory where new stars join an old sky',symbols:['✦','⋆','✧','⟡']},
  {id:'garden',label:'Garden',place:'a moonlit garden where paths bloom only after they are walked',symbols:['❀','⌁','✿','◌']},
  {id:'forge',label:'Forge',place:'a quiet forge where finished work cools into bright runes',symbols:['◇','◆','⌁','✦']},
  {id:'river',label:'River',place:'a luminous river delta where completed channels meet the sea',symbols:['≈','◒','◌','✧']},
  {id:'archive',label:'Archive',place:'an impossible archive whose shelves rearrange around completed chapters',symbols:['⌑','◫','◇','✦']},
  {id:'lantern',label:'Lantern Road',place:'a lantern road crossing a dark field toward a newly opened gate',symbols:['◉','✧','⌁','◇']}
]);
const REALM_LABEL=Object.freeze({'living-school':'learning','cerbanimo':'making','fellowfare':'exchange','anarchadia':'consent'});
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const list=value=>Array.isArray(value)?value:[];
const clean=(value,max=12000)=>String(value??'').trim().replace(/\s+/g,' ').slice(0,max);
const now=()=>new Date().toISOString();
const clone=value=>{try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}catch{return null}};
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let generating=null;
let observer=null;
const memory=new Map();

function read(key,fallback){return parse(localStorage.getItem(key),fallback)}
function currentPlan(planId=''){
  const campus=read(KEYS.campus,{}),intentions=list(read(KEYS.intentions,[]));
  const requested=clean(planId,240)||clean(campus?.plan?.id,240);
  if(requested){
    const row=intentions.find(item=>item?.kind==='weave-plan'&&(item.id===requested||item.plan?.id===requested));
    if(row?.plan)return clone(row.plan);
    if(campus?.plan?.id===requested)return clone(campus.plan);
  }
  const newest=intentions.filter(item=>item?.kind==='weave-plan'&&item?.plan).sort((a,b)=>Date.parse(b.updatedAt||b.plan?.updatedAt||0)-Date.parse(a.updatedAt||a.plan?.updatedAt||0))[0];
  return clone(campus?.plan||newest?.plan||null);
}
function hash(value){let out=2166136261;for(const char of String(value||'')){out^=char.charCodeAt(0);out=Math.imul(out,16777619)}return out>>>0}
function themeFor(plan){return THEMES[hash(plan?.id||plan?.createdAt||'quest')%THEMES.length]}
function proofSummary(plan){
  const paths=list(plan?.paths),runtime=globalThis.CivweaveProofProgressV158;
  let rows=[];
  try{
    const snapshot=runtime?.proofState?.();
    if(snapshot?.plan?.id===plan?.id)rows=list(snapshot.paths).map(item=>({realm:item?.path?.realm,accepted:item?.result?.complete===true}));
  }catch{}
  if(!rows.length)rows=paths.map(path=>({realm:path?.realm,accepted:path?.proofProgress?.state==='accepted'}));
  const accepted=rows.filter(row=>row.accepted).length,total=rows.length;
  return{accepted,total,allAccepted:total>0&&accepted===total};
}
function veilState(plan){
  const paths=list(plan?.paths),proof=proofSummary(plan),theme=themeFor(plan);
  const completed=paths.filter(path=>path?.status==='completed').length;
  const realmOrder=[...new Set(paths.map(path=>REALM_LABEL[path?.realm]).filter(Boolean))];
  return Object.freeze({
    schema:VEIL_SCHEMA,
    state:plan?.state==='completed'?'complete':'in-progress',
    completion:{completedPaths:completed,totalPaths:paths.length,percent:paths.length?Math.round(completed/paths.length*100):0},
    validation:{acceptedPaths:proof.accepted,totalPaths:proof.total,allAccepted:proof.allAccepted},
    journey:{stages:realmOrder.length?realmOrder:['making'],stageCount:realmOrder.length||1},
    theme:{id:theme.id,label:theme.label,place:theme.place,symbols:[...theme.symbols]},
    privacy:{contextStripped:true,rawEvidenceIncluded:false,sourceTitlesIncluded:false,identitiesIncluded:false,locationsIncluded:false}
  });
}
function eligible(plan){const proof=proofSummary(plan);return Boolean(plan&&plan.state==='completed'&&proof.allAccepted)}
function chronicle(){
  const value=read(KEYS.chronicle,null);
  return value&&typeof value==='object'&&!Array.isArray(value)?{schema:'civweave.chronicle-ledger.v1.1',entries:list(value.entries),updatedAt:value.updatedAt||now()}:{schema:'civweave.chronicle-ledger.v1.1',entries:[],updatedAt:now()};
}
function entryId(planId){return`quest-veil:${clean(planId,220)}`}
function latest(planId){
  const id=entryId(planId),found=chronicle().entries.find(entry=>entry?.id===id&&entry?.kind==='quest-veil');
  if(found)memory.set(id,clone(found));
  return clone(found||memory.get(id)||null);
}
function writeEntry(entry){
  if(!entry?.id)return null;
  const state=chronicle(),created=state.entries.find(item=>item?.id===entry.id)?.createdAt||entry.createdAt||now();
  const safe={...entry,createdAt:created,updatedAt:now()};
  state.entries=[safe,...state.entries.filter(item=>item?.id!==safe.id)].slice(0,500);
  state.updatedAt=safe.updatedAt;
  localStorage.setItem(KEYS.chronicle,JSON.stringify(state));
  memory.set(safe.id,clone(safe));
  dispatchEvent(new CustomEvent('civweave:quest-veil-changed',{detail:{entryId:safe.id,subjectId:safe.subjectId,at:safe.updatedAt}}));
  dispatchEvent(new CustomEvent('civweave:chronicle-changed',{detail:{kind:'quest-veil',entryId:safe.id,at:safe.updatedAt}}));
  return clone(safe);
}
function reassert(planId){const cached=memory.get(entryId(planId));return cached&&!chronicle().entries.some(entry=>entry?.id===cached.id)?writeEntry(cached):clone(cached||null)}

function privateFragments(plan){
  const values=[plan?.title,plan?.wish,plan?.outcome,plan?.profile?.constraints,plan?.governance?.title,plan?.governance?.purpose];
  for(const path of list(plan?.paths)){
    values.push(path?.title,path?.purpose);
    for(const step of list(path?.steps))values.push(step);
    for(const task of list(path?.tasks))values.push(task?.title,task?.deliverable,task?.description);
  }
  const fragments=new Set();
  for(const raw of values){
    const value=clean(raw,1800).toLowerCase();
    if(value.length>=14)fragments.add(value);
    const words=value.split(/\s+/).filter(Boolean);
    for(let size=6;size>=3;size--)for(let i=0;i+size<=words.length;i++){
      const phrase=words.slice(i,i+size).join(' ');
      if(phrase.length>=18)fragments.add(phrase);
    }
  }
  return [...fragments];
}
function safePublicPayload(payload,plan){
  const text=JSON.stringify(payload||{}).toLowerCase();
  if(privateFragments(plan).some(fragment=>text.includes(fragment)))return false;
  const forbiddenKeys=/\b(?:proofids?|evidenceartifacts?|receipts?|validatorids?|identityids?|deviceids?|sourceRef|inlineText)\b/i;
  return !forbiddenKeys.test(JSON.stringify(payload||{}));
}
function writerMessages(state){
  return[
    {role:'system',content:`You are Weaveling in Quest Veil writer mode. Turn ONLY the context-stripped Veil State into a short public-facing allegorical quest chronicle. The Veil State intentionally contains no source proof or real task details. Never infer, reconstruct, guess, name, or hint at the user's real wish, work product, organization, person, place, file, artifact, proof, validator, model, receipt, title, or deliverable. Do not claim what the user literally did. Use the supplied theme and abstract journey stages only. Return JSON only with: title (max 70 chars), story (90-180 words), mapTitle (max 60 chars), mapNodes (3-7 objects with symbol, label, description), imageScene (one visual-art direction under 120 words), and closingLine (max 100 chars). Keep it celebratory but not grandiose. This is fiction derived from validated state, not a disclosure of evidence. Prompt version: ${PROMPT_VERSION}.`},
    {role:'user',content:`Context-stripped Veil State:\n${JSON.stringify(state)}`}
  ];
}
function normalizeOutput(value,state){
  const theme=THEMES.find(item=>item.id===state?.theme?.id)||THEMES[0],raw=value&&typeof value==='object'?value:{};
  const mapNodes=list(raw.mapNodes).slice(0,7).map((node,index)=>({symbol:clean(node?.symbol,8)||theme.symbols[index%theme.symbols.length],label:clean(node?.label,80)||`Waymark ${index+1}`,description:clean(node?.description,260)||'A completed turn in the veiled path.'}));
  return{
    title:clean(raw.title,90),
    story:clean(raw.story,1600),
    mapTitle:clean(raw.mapTitle,90),
    mapNodes,
    imageScene:clean(raw.imageScene||raw.imagePrompt,1400),
    closingLine:clean(raw.closingLine,140)
  };
}
function fallback(state){
  const theme=THEMES.find(item=>item.id===state?.theme?.id)||THEMES[0],count=Math.max(3,Math.min(6,state?.journey?.stageCount+2||4));
  const nodes=Array.from({length:count},(_,index)=>({symbol:theme.symbols[index%theme.symbols.length],label:index===0?'Threshold':index===count-1?'Open Gate':`Waymark ${index}`,description:index===count-1?'The veiled route is complete and ready to become part of the shared chronicle.':'A sealed turn in the route, visible only as progress rather than private proof.'}));
  return{
    title:`The ${theme.label} Route`,
    story:`In ${theme.place}, a traveler followed a route that never displayed the cargo inside their pack. Each waymark brightened only when the underlying work had been accepted. No names, artifacts, explanations, or receipts crossed the veil; the public trail carried only the shape of progress. One by one, the lights joined until the route formed a complete pattern. The path now remains as a small piece of shared folklore: not a claim about what happened behind the curtain, but a record that a real, validated journey reached its chosen threshold.`,
    mapTitle:`Map of the ${theme.label} Route`,
    mapNodes:nodes,
    imageScene:`A symbolic illustration of ${theme.place}; ${count} luminous waymarks connected by fine woven threads, no text labels, no people, no logos, no real-world objects, and no clues about the private task. Dreamlike civic-fantasy field guide aesthetic, intricate but calm.`,
    closingLine:'The path is visible. The proof remains private.'
  };
}
async function ensureHarness(){
  try{await globalThis.CivweaveFamilyAILoaderV105?.ensure?.()}catch{}
  if(globalThis.CivweaveModelRuntime?.generate)return globalThis.CivweaveModelRuntime;
  await new Promise(resolve=>{let ticks=0;const timer=setInterval(()=>{if(globalThis.CivweaveModelRuntime?.generate||++ticks>=40){clearInterval(timer);resolve()}},50)});
  return globalThis.CivweaveModelRuntime||null;
}
async function invokeWriter(state){
  const runtime=await ensureHarness();
  if(!runtime?.generate)throw new Error('Weaveling model runtime unavailable.');
  let config=null;
  try{config=runtime.readSharedConfig?.('interactive')||null}catch{}
  const request={purpose:'civweave-quest-veil-writer-v1',executionProfile:'interactive',context:state,messages:writerMessages(state)};
  if(config)request.config=config;
  const result=await runtime.generate(request);
  if(!['success','fallback'].includes(result?.status))throw new Error(result?.error?.message||`Quest Veil writer ended with ${result?.status||'an error'}.`);
  let value=result?.outputJson;
  if(!value&&typeof result?.outputText==='string'){
    const text=result.outputText.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
    value=parse(text,{story:text});
  }
  return{payload:normalizeOutput(value,state),provider:clean(result?.actual?.provider||config?.provider||config?.route||'weaveling',80),model:clean(result?.actual?.model||config?.model||'',160),status:result?.status||'success'};
}
function buildEntry(plan,state,payload,generation={}){
  return{
    schema:ENTRY_SCHEMA,
    kind:'quest-veil',
    id:entryId(plan.id),
    subjectId:clean(plan.id,220),
    title:payload.title,
    story:payload.story,
    public:{mapTitle:payload.mapTitle,mapNodes:payload.mapNodes,imageScene:payload.imageScene,closingLine:payload.closingLine,theme:state.theme},
    derived:{veilState:state,promptVersion:PROMPT_VERSION,source:'validated-context-stripped-state',rawEvidenceIncluded:false,sourceDetailsIncluded:false},
    generation:{harness:'weaveling',provider:clean(generation.provider,80)||'deterministic-fallback',model:clean(generation.model,160)||null,status:clean(generation.status,40)||'fallback'},
    authority:{system:'civweave',guide:'Weaveling',basis:'validated-state-only'},
    createdAt:now(),
    updatedAt:now()
  };
}
async function generateForPlan(planOrId){
  const plan=typeof planOrId==='object'?clone(planOrId):currentPlan(planOrId);
  if(!eligible(plan))return{status:'not-eligible',entry:null};
  const existing=latest(plan.id);
  if(existing)return{status:'existing',entry:existing};
  const state=veilState(plan);
  let output=null,generation=null;
  try{
    const result=await invokeWriter(state);
    output=result.payload;generation=result;
  }catch{
    output=fallback(state);generation={provider:'deterministic-fallback',model:null,status:'fallback'};
  }
  if(!safePublicPayload(output,plan)){
    output=fallback(state);
    generation={provider:'deterministic-fallback',model:null,status:'privacy-fallback'};
  }
  const entry=buildEntry(plan,state,output,generation);
  if(!safePublicPayload(entry.public,plan)||!safePublicPayload({title:entry.title,story:entry.story},plan))throw new Error('Quest Veil privacy guard rejected the public chronicle entry.');
  return{status:'created',entry:writeEntry(entry)};
}
async function sync(){
  const plan=currentPlan();
  if(!plan){render();return{status:'no-plan'}};
  if(latest(plan.id)){render();return{status:'ready',entry:latest(plan.id)}};
  if(!eligible(plan)){render();return{status:'not-eligible'}};
  const restored=reassert(plan.id);
  if(restored){render();return{status:'restored',entry:restored}};
  if(generating)return generating;
  generating=generateForPlan(plan).then(result=>{render();return result}).finally(()=>{generating=null});
  render(true);
  return generating;
}

function style(){
  if(typeof document==='undefined'||document.getElementById('cw-quest-veil-style-v1'))return;
  const node=document.createElement('style');node.id='cw-quest-veil-style-v1';node.textContent=`
#cw-quest-veil-v1{position:relative;overflow:hidden;margin-top:14px;border:1px solid #ffffff2b;border-radius:18px;padding:16px;background:radial-gradient(circle at 18% 18%,#79d9ff22,transparent 38%),radial-gradient(circle at 82% 10%,#ff8ad522,transparent 36%),radial-gradient(circle at 88% 82%,#ffd76b1d,transparent 36%),linear-gradient(145deg,#0c1730f0,#17142de8);box-shadow:inset 0 0 32px #ffffff08,0 14px 36px #0005}
#cw-quest-veil-v1 small{display:block;color:#98dcff;font-weight:900;letter-spacing:.13em;text-transform:uppercase}#cw-quest-veil-v1 h3{margin:.35rem 0 .55rem;font:700 1.35rem/1.15 Georgia,serif}#cw-quest-veil-v1 p{line-height:1.55}#cw-quest-veil-v1 .cwqv-map{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:12px 0}#cw-quest-veil-v1 .cwqv-node{border:1px solid #ffffff20;border-radius:12px;padding:10px;background:#ffffff08}#cw-quest-veil-v1 .cwqv-node b{display:block;margin-bottom:4px}#cw-quest-veil-v1 .cwqv-symbol{font-size:1.25rem;margin-right:5px}#cw-quest-veil-v1 .cwqv-closing{color:#d8e9ff;font-style:italic}#cw-quest-veil-v1 .cwqv-status{color:#b9c8d9}`;document.head.append(node);
}
function render(pending=false){
  if(typeof document==='undefined')return false;
  const root=document.querySelector('#workspace');if(!root)return false;
  const state=read(KEYS.campus,{}),plan=currentPlan();
  root.querySelector('#cw-quest-veil-v1')?.remove();
  if(state?.view!=='progress'||!plan)return false;
  style();
  const section=document.createElement('section');section.id='cw-quest-veil-v1';section.className='card';section.dataset.questVeil='v1';
  const proof=proofSummary(plan),entry=latest(plan.id);
  if(!proof.allAccepted||plan.state!=='completed'){
    section.innerHTML='<small>Quest Veil</small><h3>Public chronicle still sealed</h3><p class="cwqv-status">Weaveling opens the veil only after the underlying route is complete and its proof is accepted. Until then, no public story is generated.</p>';
    root.append(section);return true;
  }
  if(!entry){
    section.innerHTML=`<small>Quest Veil · Weaveling</small><h3>Weaving the public chronicle…</h3><p class="cwqv-status">${pending?'The validated state is being translated into a context-stripped story.':'The validated route is ready for its context-stripped story.'}</p>`;
    root.append(section);return true;
  }
  const nodes=list(entry.public?.mapNodes).map(node=>`<div class="cwqv-node"><b><span class="cwqv-symbol">${escapeHtml(node.symbol)}</span>${escapeHtml(node.label)}</b><span>${escapeHtml(node.description)}</span></div>`).join('');
  section.innerHTML=`<small>Quest Veil · ${escapeHtml(entry.public?.theme?.label||'Veiled Route')}</small><h3>${escapeHtml(entry.title)}</h3><p>${escapeHtml(entry.story)}</p>${nodes?`<div class="cwqv-map" aria-label="${escapeHtml(entry.public?.mapTitle||'Veiled quest map')}">${nodes}</div>`:''}<p class="cwqv-closing">${escapeHtml(entry.public?.closingLine||'The path is visible. The proof remains private.')}</p>`;
  root.append(section);return true;
}
function watch(){
  if(typeof document==='undefined')return;
  const root=document.querySelector('#workspace');
  if(root&&!observer){observer=new MutationObserver(()=>queueMicrotask(()=>{render();const plan=currentPlan();if(plan&&eligible(plan)&&!latest(plan.id))sync()}));observer.observe(root,{childList:true,subtree:false})}
}
function boot(){style();watch();render();sync().catch(error=>console.warn('[Civweave] Quest Veil sync failed.',error?.message||error))}

if(typeof document!=='undefined'){
  if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  addEventListener('civweave:proof-progress-synced',()=>sync());
  addEventListener('civweave:reward-state-changed',()=>{const plan=currentPlan();if(plan?.id)reassert(plan.id);sync()});
  addEventListener('civweave:working-campus-plan-built',()=>sync());
  addEventListener('focus',()=>{render();sync()});
  addEventListener('storage',event=>{if(Object.values(KEYS).includes(event.key)){render();sync()}});
}

globalThis.CivweaveQuestVeilV1=Object.freeze({VERSION,PROMPT_VERSION,ENTRY_SCHEMA,VEIL_SCHEMA,KEYS,currentPlan,proofSummary,veilState,eligible,latest,generateForPlan,sync,render,safePublicPayload,writerMessages,fallback});
dispatchEvent(new CustomEvent('civweave:quest-veil-ready',{detail:{version:VERSION,promptVersion:PROMPT_VERSION,ledger:KEYS.chronicle}}));
})();
