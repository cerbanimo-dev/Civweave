(()=>{
'use strict';
const VERSION='1.0.6-living-school-paths-v213-direct-controls';
if(globalThis.LivingSchoolPathsV160?.version===VERSION)return;
const STATE_KEY='commonweave.living-school.cabinet.v151';
const INTAKE_KEY='commonweave.living-school.intake.v152';
const INTENTION_KEY='commonweave.intentions.v127';
const LIBRARY_KEY='commonweave.living-school.path-library.v160';
const frame=globalThis.requestAnimationFrame||((callback)=>setTimeout(callback,16));
const clean=(value,max=6000)=>String(value??'').trim().slice(0,max);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const now=()=>new Date().toISOString();
let generating=false,patchQueued=false,actionRunning=false;
function readJson(key,fallback){try{const value=localStorage.getItem(key);return value===null?fallback:(JSON.parse(value)??fallback)}catch{return fallback}}
function writeJson(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
function array(key){const value=readJson(key,[]);return Array.isArray(value)?value:[]}
function state(){return readJson(STATE_KEY,null)}
function library(){const value=readJson(LIBRARY_KEY,{});return{activePathId:clean(value?.activePathId,180),snapshots:value?.snapshots&&typeof value.snapshots==='object'&&!Array.isArray(value.snapshots)?value.snapshots:{},updatedAt:clean(value?.updatedAt,80)}}
function saveLibrary(value){value.updatedAt=now();writeJson(LIBRARY_KEY,value);return value}
function pathRecords(){
  const map=new Map();
  for(const item of array(INTAKE_KEY)){
    if(!item||typeof item!=='object')continue;
    const id=clean(item.sourcePlanId||item.intentionId||item.id,180);if(!id)continue;
    map.set(id,{id,title:clean(item.title||item.capability||'Learning path',180),capability:clean(item.purpose||item.capability||item.title,1200),proof:clean(item.completionCriteria||item.proof||'A fresh demonstration and reviewable evidence.',2000),steps:Array.isArray(item.steps)?item.steps:[],source:'Living School intake',state:clean(item.status||item.state||'ready',80)});
  }
  for(const item of array(INTENTION_KEY)){
    if(!item||typeof item!=='object')continue;
    const plan=item.plan&&typeof item.plan==='object'?item.plan:item;
    const candidates=Array.isArray(plan.paths)?plan.paths:(plan.paths&&typeof plan.paths==='object'?Object.values(plan.paths):[]);
    const path=candidates.find(candidate=>candidate&&candidate.realm==='living-school');if(!path)continue;
    const id=clean(plan.id||item.id,180);if(!id||map.has(id))continue;
    map.set(id,{id,title:clean(path.title||plan.title||'Learning path',180),capability:clean(path.purpose||plan.outcome||plan.wish||path.title,1200),proof:clean(path.completionCriteria||plan.completionCriteria||'A fresh demonstration and reviewable evidence.',2000),steps:Array.isArray(path.steps)?path.steps:[],source:'Commonweave intention',state:clean(plan.state||item.state||'review',80)});
  }
  const current=state();
  if(current?.school){
    const id=clean(current.activePathId||current.pathContext?.id||`school:${current.school.id}`,180);
    if(id&&!map.has(id))map.set(id,{id,title:clean(current.school.title||'Current learning path',180),capability:clean(current.school.capability,1200),proof:clean(current.school.proof,2000),steps:[],source:'Current Living School record',state:'active'});
  }
  return[...map.values()];
}
function selectedPathId(){const select=document.querySelector?.('[data-ls160-path-select]'),lib=library(),current=state();return clean(select?.value||current?.activePathId||current?.pathContext?.id||lib.activePathId||pathRecords()[0]?.id,180)}
function pathById(id){return pathRecords().find(path=>path.id===id)||null}
function dispatchState(next,oldValue,text){
  let storageSent=false;
  try{
    const event=new Event('storage');
    Object.defineProperties(event,{key:{value:STATE_KEY},oldValue:{value:oldValue},newValue:{value:text},url:{value:location.href},storageArea:{value:localStorage}});
    dispatchEvent(event);storageSent=true;
  }catch(error){console.warn('[Living School] same-page state event failed',error)}
  try{dispatchEvent(new CustomEvent('living-school:state-replaced',{detail:{key:STATE_KEY,state:next}}))}catch{}
  return storageSent;
}
function writeState(next){const oldValue=(()=>{try{return localStorage.getItem(STATE_KEY)||''}catch{return''}})(),text=JSON.stringify(next);try{localStorage.setItem(STATE_KEY,text)}catch(error){throw new Error(`Living School could not save this path: ${error.message}`)}dispatchState(next,oldValue,text);return next}
function saveCurrentSnapshot(){const current=state();if(!current)return;const lib=library(),id=clean(current.activePathId||current.pathContext?.id||lib.activePathId,180);if(id)lib.snapshots[id]=current;saveLibrary(lib)}
function toast(message){const node=document.querySelector?.('#toast');if(!node)return;node.textContent=clean(message,1000);node.hidden=false;clearTimeout(node._ls213);node._ls213=setTimeout(()=>node.hidden=true,5000)}
function queuePathbar(){if(patchQueued)return;patchQueued=true;frame(()=>{patchQueued=false;ensurePathbar()})}
function activatePath(id){
  const path=pathById(id);if(!path){toast('That learning path is no longer available.');return false}
  saveCurrentSnapshot();
  const current=state()||{},lib=library(),saved=lib.snapshots[id];
  const next=saved?{...saved,activePathId:id,pathContext:path,room:'desk'}:{...current,room:'desk',school:null,sources:[],activeModuleId:'module-1',progress:{},constellation:{},practicum:null,projectGate:null,handoff:null,receipts:[],final:null,credential:null,activePathId:id,pathContext:path,events:[...(current.events||[]),{id:`evt-${Date.now().toString(36)}`,type:'learning-path-selected',detail:{pathId:id,title:path.title},at:now()}].slice(-200)};
  lib.activePathId=id;lib.snapshots[id]=next;saveLibrary(lib);writeState(next);
  globalThis.LivingSchoolWorkbenchV158?.render?.();queuePathbar();toast(`Using learning path: ${path.title}`);return true;
}
function pathbarData(){const paths=pathRecords(),current=state(),lib=library();let active=clean(current?.activePathId||current?.pathContext?.id||lib.activePathId||paths[0]?.id,180);if(active&&!paths.some(path=>path.id===active))active=paths[0]?.id||'';const activePath=paths.find(path=>path.id===active)||null;const signature=JSON.stringify({active,paths:paths.map(path=>[path.id,path.title,path.state]),capability:activePath?.capability||'',schoolId:current?.school?.id||'',schoolUpdated:current?.school?.updatedAt||''});return{paths,active,activePath,signature}}
function pathbarMarkup(data){const {paths,active,activePath,signature}=data;return`<section class="ls160-pathbar" data-ls160-signature="${esc(signature)}" aria-label="Active intention and learning path"><div><small>ACTIVE INTENTION / LEARNING PATH</small><select data-ls160-path-select>${paths.length?paths.map(path=>`<option value="${esc(path.id)}" ${path.id===active?'selected':''}>${esc(path.title)} · ${esc(path.state)}</option>`).join(''):'<option value="">No routed learning paths yet</option>'}</select><p>${esc(activePath?.capability||'Choose a Commonweave intention or Living School intake, then generate its curriculum.')}</p></div><div><button type="button" data-ls160-use ${paths.length?'':'disabled'}>Use path</button><button type="button" data-ls160-view>View curriculum</button><button type="button" data-ls160-generate>Generate curriculum</button></div></section>`}
function ensurePathbar(){
  const shell=document.querySelector?.('.lsw-shell')||document.querySelector?.('#ls-generated-workbench');if(!shell)return;
  const data=pathbarData(),old=shell.querySelector?.('.ls160-pathbar');
  if(old?.dataset?.ls160Signature===data.signature)return;
  const selected=clean(old?.querySelector?.('[data-ls160-path-select]')?.value,180);
  const holder=document.createElement?.('template');if(!holder)return;holder.innerHTML=pathbarMarkup(data);
  const fresh=holder.content?.firstElementChild;if(!fresh)return;
  if(selected&&data.paths.some(path=>path.id===selected)){const select=fresh.querySelector('[data-ls160-path-select]');if(select)select.value=selected}
  if(old)old.replaceWith(fresh);else shell.prepend(fresh);
}
function safeOpenDialog(dialog){if(dialog.open)return true;try{dialog.showModal();return true}catch{}try{dialog.show();return true}catch{}try{dialog.setAttribute('open','');return true}catch{return false}}
function openGenerator(){
  const dialog=document.querySelector?.('#instrument-dialog'),content=document.querySelector?.('#instrument-content'),current=state()||{},path=pathById(selectedPathId())||current.pathContext||{},school=current.school||{};
  if(!dialog||!content){toast('The curriculum form is still opening.');return false}
  content.innerHTML=`<h2 id="instrument-title">Generate curriculum</h2><form class="ls-form ls160-generator" data-ls160-generate-form><label>Learning path title<input name="title" required value="${esc(school.title||path.title||'')}"></label><label>Observable capability<textarea name="capability" required>${esc(school.capability||path.capability||'')}</textarea></label><div class="ls-row"><label>Level<select name="level"><option>beginner</option><option ${school.level==='intermediate'?'selected':''}>intermediate</option><option ${school.level==='advanced'?'selected':''}>advanced</option></select></label><label>Modules<input name="count" type="number" min="1" max="8" value="${school.modules?.length||4}"></label></div><div class="ls-row"><label>Mode<select name="mode"><option>guided</option><option>just-in-time</option><option>browse</option><option>creator</option></select></label><label>Generation route<select name="modelRoute"><option value="shared">Shared Commonweave AI</option><option value="deterministic">Deterministic local compiler</option></select></label></div><label>Proof contract<textarea name="proof">${esc(school.proof||path.proof||'A working artifact, explanation, and independent receipt.')}</textarea></label><label class="ls160-research-toggle"><input type="checkbox" name="researchOnline" value="yes"><span><b>Research public sources first</b><small>Crossref and Wikipedia results, links, and excerpts will be stored with this curriculum.</small></span></label><button class="ls-primary" type="submit">Generate and open curriculum</button></form>`;
  if(!safeOpenDialog(dialog)){toast('The curriculum editor could not open.');return false}
  frame(()=>content.querySelector?.('input,textarea,select')?.focus?.());return true;
}
async function waitForGeneration(){for(let attempt=0;attempt<24;attempt++){if(globalThis.LivingSchoolWorkbenchV158?.generate)return globalThis.LivingSchoolWorkbenchV158;await new Promise(resolve=>setTimeout(resolve,50))}throw new Error('Living School generation runtime did not become ready.')}
function defaultProgress(school){return Object.fromEntries((school.modules||[]).map(module=>[module.id,{lessonComplete:false,assessmentPassed:false,attempts:[],evidence:[]}]))}
function anchors(sources,index){if(!sources.length)return[];return[sources[index%sources.length],sources[(index+1)%sources.length]].filter((source,pos,list)=>source&&list.findIndex(item=>(item.url||item.id)===(source.url||source.id))===pos).map(source=>({title:source.title,url:source.url,provider:source.provider,quality:source.quality,excerpt:clean(source.notes,900)}))}
async function generate(form){
  if(generating)return;generating=true;
  const button=form.querySelector?.('button[type="submit"]'),original=button?.textContent||'Generate and open curriculum';if(button){button.disabled=true;button.textContent='Generating curriculum…'}
  try{
    const current=state();if(!current)throw new Error('Living School state is unavailable.');
    const data=Object.fromEntries(new FormData(form).entries()),path=pathById(selectedPathId())||current.pathContext||{},workbench=await waitForGeneration();let nextState={...current},research=null;
    if(data.researchOnline==='yes'){
      if(button)button.textContent='Researching sources…';
      if(!globalThis.LivingSchoolRuntimeStabilityV159?.research)throw new Error('The public research tool is not ready.');
      research=await globalThis.LivingSchoolRuntimeStabilityV159.research(data.capability);
      if(!research.sources?.length)throw new Error('No public research records were returned.');
      nextState.sources=[...(current.sources||[]),...research.sources].filter((source,index,list)=>list.findIndex(item=>(item.url||item.id)===(source.url||source.id))===index).slice(-80);
    }
    if(button)button.textContent='Building readable modules…';
    const school=await workbench.generate({...data,modelRoute:data.modelRoute||'shared'},nextState);
    if(research){school.researchPack=research.sources;school.generation={...(school.generation||{}),research:{status:'researched',query:research.query,sourceCount:research.sources.length,providers:research.providers,fetchedAt:research.fetchedAt,errors:research.errors}};school.modules=school.modules.map((module,index)=>({...module,researchAnchors:anchors(research.sources,index)}))}
    nextState={...nextState,school,activeModuleId:school.modules?.[0]?.id||'module-1',progress:defaultProgress(school),room:'map',activePathId:path.id||current.activePathId||'',pathContext:path.id?path:current.pathContext,events:[...(nextState.events||[]),{id:`evt-${Date.now().toString(36)}`,type:research?'curriculum-researched-and-generated':'curriculum-generated-direct',detail:{pathId:path.id||'',schoolId:school.id,moduleCount:school.modules?.length||0},at:now()}].slice(-200)};
    writeState(nextState);const lib=library(),id=nextState.activePathId||`school:${school.id}`;lib.activePathId=id;lib.snapshots[id]=nextState;saveLibrary(lib);
    try{document.querySelector?.('#instrument-dialog')?.close?.()}catch{}
    globalThis.LivingSchoolWorkbenchV158?.render?.();queuePathbar();frame(()=>viewCurriculum());
    toast(research?`Researched ${research.sources.length} sources and opened the curriculum.`:'Curriculum generated and opened.');
  }catch(error){toast(`Curriculum generation did not complete: ${clean(error.message,800)}`)}
  finally{generating=false;if(button){button.disabled=false;button.textContent=original}}
}
function focusCurriculum(attempt=0){
  const target=document.querySelector?.('.lsw-course-head,.lsw-reader,#ls-generated-workbench');
  if(target){target.scrollIntoView?.({behavior:'auto',block:'start'});return true}
  if(attempt<12){frame(()=>focusCurriculum(attempt+1));return false}
  toast('The curriculum reader did not mount.');return false;
}
function viewCurriculum(){
  const current=state();if(!current?.school)return openGenerator();
  const drawer=document.querySelector?.('#drawer');if(drawer)drawer.hidden=true;
  try{document.querySelector?.('#instrument-dialog')?.close?.()}catch{}
  globalThis.LivingSchoolWorkbenchV158?.render?.();queuePathbar();frame(()=>focusCurriculum());
  return true;
}
function runAction(label,action){if(actionRunning)return;actionRunning=true;try{action()}catch(error){console.error(`[Living School] ${label} failed`,error);toast(`${label} could not complete: ${clean(error.message,600)}`)}finally{(globalThis.queueMicrotask||((callback)=>Promise.resolve().then(callback)))(()=>{actionRunning=false})}}
function handleClick(event){
  const target=event.target?.closest?.('[data-ls160-use],[data-ls160-view],[data-ls160-generate]');if(!target)return;
  event.preventDefault();event.stopPropagation();
  if(target.matches('[data-ls160-use]'))return runAction('Use path',()=>activatePath(selectedPathId()));
  if(target.matches('[data-ls160-view]'))return runAction('View curriculum',viewCurriculum);
  runAction('Generate curriculum',openGenerator);
}
function handleSubmit(event){const form=event.target;if(!form?.matches?.('[data-ls160-generate-form]'))return;event.preventDefault();event.stopPropagation();generate(form)}
function relevantMutation(records){return Array.from(records||[]).some(record=>[...(record.addedNodes||[]),...(record.removedNodes||[])].some(node=>node?.nodeType===1&&(node.matches?.('.lsw-shell,#ls-generated-workbench')||node.querySelector?.('.lsw-shell,#ls-generated-workbench'))))}
function installObserver(){const root=document.querySelector?.('#stage')||document.body;if(!root||typeof MutationObserver!=='function')return;new MutationObserver(records=>{if(relevantMutation(records))queuePathbar()}).observe(root,{childList:true,subtree:true})}
document.addEventListener?.('click',handleClick,true);document.addEventListener?.('submit',handleSubmit,true);
addEventListener?.('storage',event=>{if([STATE_KEY,INTAKE_KEY,INTENTION_KEY,LIBRARY_KEY].includes(event.key))queuePathbar()});
addEventListener?.('living-school:state-replaced',queuePathbar);addEventListener?.('commonweave:intentions-changed',queuePathbar);
function boot(){installObserver();queuePathbar()}
document.readyState==='loading'?addEventListener?.('DOMContentLoaded',boot,{once:true}):boot();
globalThis.LivingSchoolPathsV160={version:VERSION,paths:pathRecords,activatePath,openGenerator,viewCurriculum,generate,refresh:queuePathbar};
})();
