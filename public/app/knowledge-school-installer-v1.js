(()=>{
'use strict';
const api=window.CivweaveKnowledgeSchools;
const list=document.querySelector('#knowledge-school-list');
const help=document.querySelector('#knowledge-school-help');
const stageButton=document.querySelector('#stage-knowledge-schools');
const removeButton=document.querySelector('#remove-knowledge-schools');
const totalNode=document.querySelector('#knowledge-school-total');
const presets=document.querySelector('#knowledge-school-presets');
let catalog=null;
let busy=false;
let states=new Map();
let operation='';
const humanBytes=value=>{const units=['B','KiB','MiB','GiB'];let amount=Number(value)||0,index=0;while(amount>=1024&&index<units.length-1){amount/=1024;index+=1}return`${amount.toFixed(index?2:0)} ${units[index]}`};
const selectedSlugs=()=>[...list.querySelectorAll('input[type="checkbox"]:checked')].map(input=>input.value);
const allInputs=()=>[...list.querySelectorAll('input[type="checkbox"]')];
const selectedSchools=()=>selectedSlugs().map(slug=>catalog?.schools?.find(school=>school.school_slug===slug)).filter(Boolean);
function setHelp(message,error=false){help.textContent=message;help.classList.toggle('is-error',error)}
function selectionBytes(schools=selectedSchools()){return schools.reduce((sum,school)=>sum+Number(school.zip_bytes||0),0)}
function neededSchools(){return selectedSchools().filter(school=>!states.get(school.school_slug)?.current)}
function stagedSchools(){return selectedSchools().filter(school=>states.get(school.school_slug)?.staged)}
function refreshSelection(){
  const selected=selectedSchools();
  const needed=neededSchools();
  const staged=stagedSchools();
  const bytes=selectionBytes(selected);
  const neededBytes=selectionBytes(needed);
  totalNode.textContent=`${selected.length} school${selected.length===1?'':'s'} · ${humanBytes(bytes)} compressed`;
  if(busy){stageButton.disabled=true;stageButton.textContent=operation||'Working…'}
  else if(!selected.length){stageButton.disabled=true;stageButton.textContent='Select schools to download'}
  else if(needed.length){stageButton.disabled=false;stageButton.textContent=`Download ${needed.length} school${needed.length===1?'':'s'} (${humanBytes(neededBytes)})`}
  else{stageButton.disabled=false;stageButton.textContent=`Save selected library (${humanBytes(bytes)})`}
  removeButton.disabled=busy||staged.length===0;
  removeButton.textContent=staged.length?`Remove ${staged.length} saved school${staged.length===1?'':'s'}`:'Remove selected saved schools';
}
function applyPreset(name){
  const slugs=name==='none'?[]:name==='all'?catalog.schools.map(record=>record.school_slug):(catalog.recommended_batches?.[name]||[]);
  const wanted=new Set(slugs);
  allInputs().forEach(input=>{input.checked=wanted.has(input.value)});
  refreshSelection();
}
async function refreshStatus(options={}){
  const rows=await api.status(catalog);
  states=new Map(rows.map(state=>[state.school_slug,state]));
  allInputs().forEach(input=>{
    const row=input.closest('.knowledge-school-option');
    const state=states.get(input.value)||{};
    row.classList.toggle('is-staged',Boolean(state.current));
    row.classList.toggle('needs-update',Boolean(state.needs_update));
    const badge=row.querySelector('.knowledge-school-badge');
    if(badge)badge.textContent=state.needs_update?'update available':state.current?'saved offline':'available';
  });
  const saved=rows.filter(state=>state.current);
  const updates=rows.filter(state=>state.needs_update);
  const persistent=rows.some(state=>state.persistent);
  if(!options.keepHelp){
    if(updates.length)setHelp(`${updates.length} saved school${updates.length===1?' has':'s have'} a newer package available. Only those updates will download.`);
    else if(saved.length)setHelp(`${saved.length} school${saved.length===1?' is':'s are'} saved offline${persistent?' in persistent browser storage':''}. App updates will preserve this library.`);
    else setHelp('No schools are downloaded yet. The Civweave app remains lean until you choose them.');
  }
  refreshSelection();
  return rows;
}
function render(){
  list.textContent='';
  for(const school of catalog.schools){
    const label=document.createElement('label');
    label.className='knowledge-school-option';
    const input=document.createElement('input');
    input.type='checkbox';
    input.value=school.school_slug;
    input.dataset.bytes=String(school.zip_bytes||0);
    input.checked=true;
    const copy=document.createElement('span');
    const name=document.createElement('strong');
    const detail=document.createElement('small');
    const badge=document.createElement('em');
    name.textContent=school.school_name;
    detail.textContent=`${school.counts.articles} articles · ${school.zip_human}`;
    badge.className='knowledge-school-badge';
    badge.textContent='available';
    copy.append(name,detail);
    label.append(input,copy,badge);
    input.addEventListener('change',refreshSelection);
    list.append(label);
  }
  refreshSelection();
}
async function downloadOrSaveSelected(){
  if(busy)return;
  const selected=selectedSlugs();
  if(!selected.length)return;
  const needed=neededSchools();
  busy=true;
  try{
    if(needed.length){
      operation='Downloading library…';
      refreshSelection();
      const neededSlugs=needed.map(school=>school.school_slug);
      await api.stage(neededSlugs,{onProgress:progress=>{
        const verb=progress.phase==='verifying'?'Verifying':progress.phase==='stored'?'Saved':progress.phase==='cached'?'Already saved':progress.phase==='persistent'?'Protecting storage':'Downloading';
        const school=progress.school?.school_name||'library';
        operation=`${verb} ${school}`;
        setHelp(`${verb} ${school} · ${progress.completed||0}/${progress.total||neededSlugs.length} complete${progress.totalBytes?` · ${humanBytes(progress.completedBytes)} of ${humanBytes(progress.totalBytes)}`:''}`);
        refreshSelection();
      }});
      await refreshStatus({keepHelp:true});
      const rows=[...states.values()].filter(state=>neededSlugs.includes(state.school_slug));
      const persistent=rows.some(state=>state.persistent);
      setHelp(`${rows.length} school${rows.length===1?' is':'s are'} now saved offline${persistent?' in persistent browser storage':''}. Tap Save selected library to also export ZIP copies.`);
    }else{
      operation='Saving library copies…';
      refreshSelection();
      const result=await api.save(selected,{onProgress:progress=>{
        const verb=progress.phase==='saved'?'Saved':'Saving';
        operation=`${verb} ${progress.school?.school_name||'library'}`;
        setHelp(`${verb} ${progress.school?.school_name||'library'} · ${progress.completed||0}/${progress.total||selected.length}`);
        refreshSelection();
      }});
      setHelp(result.mode==='directory'?`${result.saved} school ZIP${result.saved===1?'':'s'} saved to the folder you selected.`:`${result.saved} school ZIP download${result.saved===1?'':'s'} started. Your browser may ask permission for multiple files.`);
    }
  }catch(error){
    if(error?.name==='AbortError')setHelp('Save cancelled. The offline library remains safely staged.');
    else setHelp(error?.message||String(error),true);
  }finally{
    busy=false;
    operation='';
    await refreshStatus({keepHelp:true}).catch(()=>{});
    refreshSelection();
  }
}
async function removeSelected(){
  if(busy)return;
  const selected=selectedSlugs();
  busy=true;
  operation='Removing saved schools…';
  refreshSelection();
  try{
    await api.remove(selected);
    await refreshStatus();
  }catch(error){setHelp(error?.message||String(error),true)}finally{busy=false;operation='';refreshSelection()}
}
async function init(){
  if(!api){setHelp('The optional school library controller did not load.',true);return}
  try{
    await api.migrateLegacyCaches();
    catalog=await api.loadCatalog();
    render();
    presets?.addEventListener('click',event=>{const button=event.target.closest('button[data-school-preset]');if(button)applyPreset(button.dataset.schoolPreset)});
    stageButton.addEventListener('click',downloadOrSaveSelected);
    removeButton.addEventListener('click',removeSelected);
    await refreshStatus();
  }catch(error){setHelp(error?.message||String(error),true);stageButton.disabled=true;removeButton.disabled=true}
}
init();
})();
