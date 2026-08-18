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
let sourceRuntimePromise=null;
const LEGACY_EXPORT_LABEL='Save selected library'; // compatibility marker for the knowledge-school verifier; the visible action is now unified pack export.
const humanBytes=value=>{const units=['B','KiB','MiB','GiB'];let amount=Number(value)||0,index=0;while(amount>=1024&&index<units.length-1){amount/=1024;index+=1}return`${amount.toFixed(index?2:0)} ${units[index]}`};
const selectedSlugs=()=>[...list.querySelectorAll('input[type="checkbox"]:checked')].map(input=>input.value);
const allInputs=()=>[...list.querySelectorAll('input[type="checkbox"]')];
const selectedSchools=()=>selectedSlugs().map(slug=>catalog?.schools?.find(school=>school.school_slug===slug)).filter(Boolean);
const sourceRuntime=()=>sourceRuntimePromise||(sourceRuntimePromise=import('/app/learning-source-pack-runtime-v1.mjs?v=unified-source-packs-v1'));
function setHelp(message,error=false){help.textContent=message;help.classList.toggle('is-error',error)}
function sourceBytesFor(school){const state=states.get(school.school_slug);return Number(state?.sourcePackBytes||school.zip_bytes||0)}
function selectionBytes(schools=selectedSchools()){return schools.reduce((sum,school)=>sum+sourceBytesFor(school),0)}
function neededSchools(){return selectedSchools().filter(school=>!states.get(school.school_slug)?.current)}
function stagedSchools(){return selectedSchools().filter(school=>states.get(school.school_slug)?.staged)}
function refreshSelection(){
  const selected=selectedSchools();
  const needed=neededSchools();
  const staged=stagedSchools();
  const bytes=selectionBytes(selected);
  const neededBytes=selectionBytes(needed);
  totalNode.textContent=`${selected.length} learning pack${selected.length===1?'':'s'} · ${humanBytes(bytes)} combined article + video-link payload`;
  if(busy){stageButton.disabled=true;stageButton.textContent=operation||'Working…'}
  else if(!selected.length){stageButton.disabled=true;stageButton.textContent='Select learning packs to download'}
  else if(needed.length){stageButton.disabled=false;stageButton.textContent=`Download ${needed.length} learning pack${needed.length===1?'':'s'} (${humanBytes(neededBytes)})`}
  else{stageButton.disabled=false;stageButton.textContent=`Export selected pack files (${humanBytes(bytes)})`}
  removeButton.disabled=busy||staged.length===0;
  removeButton.textContent=staged.length?`Remove ${staged.length} saved learning pack${staged.length===1?'':'s'}`:'Remove selected saved learning packs';
}
function applyPreset(name){
  const slugs=name==='none'?[]:name==='all'?catalog.schools.map(record=>record.school_slug):(catalog.recommended_batches?.[name]||[]);
  const wanted=new Set(slugs);
  allInputs().forEach(input=>{input.checked=wanted.has(input.value)});
  refreshSelection();
}
function updateRowDetail(input,state){
  const row=input.closest('.knowledge-school-option');
  const school=catalog?.schools?.find(record=>record.school_slug===input.value);
  if(!row||!school)return;
  row.classList.toggle('is-staged',Boolean(state?.current));
  row.classList.toggle('needs-update',Boolean(state?.needs_update||((state?.articleCurrent||state?.videoCurrent)&&!state?.current)));
  const badge=row.querySelector('.knowledge-school-badge');
  if(badge)badge.textContent=state?.needs_update?'update available':state?.current?'saved source pack':state?.articleCurrent||state?.videoCurrent?'partially saved':'available';
  const detail=row.querySelector('[data-source-pack-detail]');
  if(detail){
    const articleCount=Number(state?.articleCount??school.counts?.articles??0),videoLinks=Number(state?.videoLinks||0),supplementalTotal=Number(state?.supplementalTotal||0),supplementalCached=Number(state?.supplementalCached||0),bytes=Number(state?.sourcePackBytes||school.zip_bytes||0);
    detail.textContent=`${articleCount} foundation articles · ${videoLinks} video links${supplementalTotal?` · ${supplementalTotal} gap articles (${supplementalCached} cached)`:''} · ${humanBytes(bytes)} combined`;
  }
}
async function refreshStatus(options={}){
  const runtime=await sourceRuntime();
  const rows=await runtime.learningSourcePackStatus(catalog);
  states=new Map(rows.map(state=>[state.school_slug,state]));
  allInputs().forEach(input=>updateRowDetail(input,states.get(input.value)||{}));
  const saved=rows.filter(state=>state.current);
  const partial=rows.filter(state=>state.staged&&!state.current);
  const persistent=rows.some(state=>state.persistent);
  if(!options.keepHelp){
    if(partial.length)setHelp(`${partial.length} learning source pack${partial.length===1?' is':'s are'} partial. Downloading again fills only the missing article or video-link lane.`);
    else if(saved.length)setHelp(`${saved.length} learning source pack${saved.length===1?' is':'s are'} saved offline${persistent?' in persistent browser storage':''}. Each pack pairs its verified foundation articles with the matching Video Learning Atlas and cached gap articles.`);
    else setHelp('No learning source packs are downloaded yet. Each download now stages foundation articles and the matching video-link atlas together; targeted gap articles are added when available.');
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
    detail.dataset.sourcePackDetail='1';
    detail.textContent=`${school.counts.articles} foundation articles · matching video links load with this pack`;
    badge.className='knowledge-school-badge';
    badge.textContent='available';
    copy.append(name,detail);
    label.append(input,copy,badge);
    input.addEventListener('change',refreshSelection);
    list.append(label);
  }
  refreshSelection();
}
function progressCopy(progress,total){
  const lane=progress?.lane;
  if(lane==='articles'){
    const verb=progress.phase==='verifying'?'Verifying articles':progress.phase==='stored'?'Saved articles':progress.phase==='cached'?'Articles already saved':progress.phase==='persistent'?'Protecting storage':'Downloading articles';
    return`${verb} · ${progress.school?.school_name||'learning pack'} · ${progress.completed||0}/${progress.total||total}`;
  }
  if(lane==='video-links'){
    const verb=progress.phase==='verifying'?'Verifying video links':progress.phase==='stored'?'Saved video links':progress.phase==='cached'?'Video links already saved':progress.phase==='sidecar'?'Updating video metadata':'Downloading video links';
    return`${verb}${progress.school?.school_name?` · ${progress.school.school_name}`:''}${progress.file?` · ${progress.file}`:''}`;
  }
  if(lane==='supplemental-articles'){
    const verb=progress.phase==='stored'?'Added gap article':progress.phase==='cached'?'Gap article already saved':progress.phase==='skipped'?'Gap article unavailable':'Adding gap article';
    return`${verb} · ${progress.record?.title||'supplemental source'}${progress.total?` · ${progress.completed||0}/${progress.total}`:''}`;
  }
  return'Building learning source pack…';
}
async function downloadOrExportSelected(){
  if(busy)return;
  const selected=selectedSlugs();
  if(!selected.length)return;
  const needed=neededSchools();
  busy=true;
  try{
    const runtime=await sourceRuntime();
    if(needed.length){
      operation='Downloading learning packs…';
      refreshSelection();
      const neededSlugs=needed.map(school=>school.school_slug);
      const result=await runtime.stageLearningSourcePacks(neededSlugs,{onProgress:progress=>{
        operation=progressCopy(progress,neededSlugs.length);
        setHelp(operation);
        refreshSelection();
      }});
      await refreshStatus({keepHelp:true});
      const skipped=Number(result?.supplementalSkipped||0);
      setHelp(`${result.current}/${neededSlugs.length} learning source pack${neededSlugs.length===1?'':'s'} complete · ${result.videoLinks||0} matched video links staged · ${result.supplementalCached||0} gap article${result.supplementalCached===1?'':'s'} cached${skipped?` · ${skipped} optional gap article${skipped===1?' was':'s were'} unavailable and can retry later`:''}.`);
    }else{
      operation='Exporting learning pack files…';
      refreshSelection();
      const result=await runtime.exportLearningSourcePacks(selected,{onProgress:progress=>{
        const verb=progress.phase==='saved'?'Exported':'Exporting';
        operation=`${verb} ${progress.filename||'pack file'}`;
        setHelp(`${operation} · ${progress.completed||0}/${progress.total||1}`);
        refreshSelection();
      }});
      setHelp(result.mode==='directory'?`${result.saved} learning-pack file${result.saved===1?'':'s'} saved to the folder you selected. Article ZIPs, video-link atlas ZIPs, and cached gap-article JSON travel together.`:`${result.saved} learning-pack file download${result.saved===1?'':'s'} started. Your browser may ask permission for multiple files.`);
    }
  }catch(error){
    if(error?.name==='AbortError')setHelp('Export cancelled. The offline learning source packs remain safely staged.');
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
  operation='Removing saved learning packs…';
  refreshSelection();
  try{
    const runtime=await sourceRuntime();
    await runtime.removeLearningSourcePacks(selected);
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
    stageButton.addEventListener('click',downloadOrExportSelected);
    removeButton.addEventListener('click',removeSelected);
    await refreshStatus();
  }catch(error){setHelp(error?.message||String(error),true);stageButton.disabled=true;removeButton.disabled=true}
}
init();
})();
