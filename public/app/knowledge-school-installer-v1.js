(()=>{
'use strict';
const api=window.CommonweaveKnowledgeSchools;
const list=document.querySelector('#knowledge-school-list');
const help=document.querySelector('#knowledge-school-help');
const stageButton=document.querySelector('#stage-knowledge-schools');
const removeButton=document.querySelector('#remove-knowledge-schools');
const totalNode=document.querySelector('#knowledge-school-total');
const presets=document.querySelector('#knowledge-school-presets');
let catalog=null;
let busy=false;
const humanBytes=value=>{const units=['B','KiB','MiB','GiB'];let amount=Number(value)||0,index=0;while(amount>=1024&&index<units.length-1){amount/=1024;index+=1}return`${amount.toFixed(index?2:0)} ${units[index]}`};
const selectedSlugs=()=>[...list.querySelectorAll('input[type="checkbox"]:checked')].map(input=>input.value);
const allInputs=()=>[...list.querySelectorAll('input[type="checkbox"]')];
function setHelp(message,error=false){help.textContent=message;help.classList.toggle('is-error',error)}
function selectionBytes(){return allInputs().filter(input=>input.checked).reduce((sum,input)=>sum+Number(input.dataset.bytes||0),0)}
function refreshSelection(){
  const selected=selectedSlugs();
  const bytes=selectionBytes();
  totalNode.textContent=`${selected.length} school${selected.length===1?'':'s'} · ${humanBytes(bytes)} compressed`;
  stageButton.disabled=busy||selected.length===0;
  removeButton.disabled=busy||selected.length===0;
  stageButton.textContent=busy?'Working…':`Stage selected schools (${humanBytes(bytes)})`;
}
function applyPreset(name){
  const slugs=name==='none'?[]:name==='all'?catalog.schools.map(record=>record.school_slug):(catalog.recommended_batches?.[name]||[]);
  const wanted=new Set(slugs);
  allInputs().forEach(input=>{input.checked=wanted.has(input.value)});
  refreshSelection();
}
async function refreshStatus(){
  const states=await api.status(catalog);
  const bySlug=new Map(states.map(state=>[state.school_slug,state]));
  allInputs().forEach(input=>{
    const row=input.closest('.knowledge-school-option');
    const staged=Boolean(bySlug.get(input.value)?.staged);
    row.classList.toggle('is-staged',staged);
    const badge=row.querySelector('.knowledge-school-badge');
    if(badge)badge.textContent=staged?'staged':'available';
  });
  const stagedCount=states.filter(state=>state.staged).length;
  setHelp(stagedCount?`${stagedCount} school seed${stagedCount===1?' is':'s are'} stored offline and ready for later unpacking.`:'No school seeds are staged yet. The core Commonweave install remains lean.');
}
function render(){
  list.textContent='';
  for(const school of catalog.schools){
    const label=document.createElement('label');
    label.className='knowledge-school-option';
    label.innerHTML=`<input type="checkbox" value="${school.school_slug}" data-bytes="${school.zip_bytes}" checked><span><strong>${school.school_name}</strong><small>${school.counts.articles} articles · ${school.zip_human}</small></span><em class="knowledge-school-badge">available</em>`;
    label.querySelector('input').addEventListener('change',refreshSelection);
    list.append(label);
  }
  refreshSelection();
}
async function stageSelected(){
  if(busy)return;
  busy=true;refreshSelection();
  try{
    const selected=selectedSlugs();
    await api.stage(selected,{onProgress:progress=>{
      const verb=progress.phase==='verifying'?'Verifying':progress.phase==='stored'?'Stored':'Downloading';
      setHelp(`${verb} ${progress.school.school_name} · ${progress.completed}/${progress.total} complete · ${humanBytes(progress.completedBytes)} of ${humanBytes(progress.totalBytes)}`);
    }});
    await refreshStatus();
  }catch(error){setHelp(error?.message||String(error),true)}finally{busy=false;refreshSelection()}
}
async function removeSelected(){
  if(busy)return;
  busy=true;refreshSelection();
  try{await api.remove(selectedSlugs());await refreshStatus()}catch(error){setHelp(error?.message||String(error),true)}finally{busy=false;refreshSelection()}
}
async function init(){
  if(!api){setHelp('The optional school-seed controller did not load.',true);return}
  try{
    catalog=await api.loadCatalog();
    render();
    presets?.addEventListener('click',event=>{const button=event.target.closest('button[data-school-preset]');if(button)applyPreset(button.dataset.schoolPreset)});
    stageButton.addEventListener('click',stageSelected);
    removeButton.addEventListener('click',removeSelected);
    await refreshStatus();
  }catch(error){setHelp(error?.message||String(error),true);stageButton.disabled=true;removeButton.disabled=true}
}
init();
})();
