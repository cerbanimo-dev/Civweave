import {CONCERNS,planAssessment,buildReferenceQuery,normalizeReferenceCards,buildFieldPacket,verificationChecklist,normalizeLocalVisionResult} from './survival-mode.mjs';

const byId=id=>document.getElementById(id);
const concernRoot=byId('concerns');
const form=byId('assessment-form');
const photo=byId('photo');
const preview=byId('preview');
const priority=byId('priority');
const priorityContent=byId('priority-content');
const references=byId('references');
const results=byId('reference-results');
const status=byId('reference-status');
const queryField=byId('reference-query');
const searchButton=byId('search-references');
let objectUrl='';
let currentAssessment=planAssessment();
let lastSourceRows=[];
let visionWorker=null,visionRequest=0,visionPrepared=false,visionInputVersion=0,captionForVersion=-1;

function element(name,text,cls=''){
  const node=document.createElement(name);
  if(text!==undefined)node.textContent=text;
  if(cls)node.className=cls;
  return node;
}
for(const concern of CONCERNS){
  const label=element('label',undefined,'choice');
  const input=document.createElement('input');
  input.type='checkbox';input.name='concerns';input.value=concern.id;
  label.append(input,element('span',concern.label));
  concernRoot.append(label);
}
function revokePreview(){
  visionInputVersion++;
  captionForVersion=-1;
  byId('vision-result').replaceChildren();
  byId('vision-status').textContent='Photo cleared. Earlier model descriptions are no longer associated with this assessment.';
  if(objectUrl)URL.revokeObjectURL(objectUrl);
  objectUrl='';
  photo.value='';
  preview.removeAttribute('src');
  preview.dataset.visible='false';
}
byId('clear-photo').addEventListener('click',revokePreview);
photo.addEventListener('change',()=>{
  visionInputVersion++;
  captionForVersion=-1;
  byId('vision-result').replaceChildren();
  byId('vision-status').textContent='Photo changed. Describe the new photo only after explicit request.';
  if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl='';}
  const file=photo.files?.[0];
  if(!file){preview.removeAttribute('src');preview.dataset.visible='false';return}
  if(!file.type.startsWith('image/')||file.size>12*1024*1024){
    revokePreview();
    status.textContent='Use an image under 12 MB for the temporary preview.';
    return;
  }
  objectUrl=URL.createObjectURL(file);
  preview.src=objectUrl;
  preview.dataset.visible='true';
});
window.addEventListener('pagehide',()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl='';},{once:true});
function inputAssessment(){
  return planAssessment({
    concerns:[...concernRoot.querySelectorAll('input:checked')].map(node=>node.value),
    resources:byId('resources').value.split(','),
    observations:byId('observations').value.split(/\r?\n/),
    photoAttached:Boolean(photo.files?.length)
  });
}
function renderPriority(assessment){
  priorityContent.replaceChildren();
  priorityContent.append(element('p','Priority: '+assessment.priority.toUpperCase(),'risk'));
  priorityContent.append(element('h3','Next safe step'));
  priorityContent.append(element('p',assessment.nextStep));
  priorityContent.append(element('p','Important limitation: '+assessment.caution));
  priorityContent.append(element('p','Evidence: '+assessment.provenance,'muted small'));
  const section=element('section');
  section.append(element('h3','Verification checklist'));
  const list=element('ul');
  for(const line of verificationChecklist({concerns:assessment.reportedConcerns}))list.append(element('li',line));
  section.append(list);
  priorityContent.append(section);
  if(assessment.photoStatus==='not-analyzed'){
    priorityContent.append(element('p','Photo attached: preview only. No object, plant, or hazard was identified from it.','muted'));
  }
  priority.hidden=false;
}
form.addEventListener('submit',event=>{
  event.preventDefault();
  currentAssessment=inputAssessment();
  lastSourceRows=[];
  results.replaceChildren();
  status.textContent='Search again to attach reference excerpts to this assessment.';
  renderPriority(currentAssessment);
  queryField.value=buildReferenceQuery(currentAssessment);
  priority.scrollIntoView({behavior:'auto',block:'start'});
});
function sourceCard(card,upstream){
  const article=element('article',undefined,'source-card');
  article.append(element('h3',card.title));
  article.append(element('small',card.school+' · '+card.tier+' · saved excerpt, not field verification'));
  article.append(element('p',card.excerpt));
  if(card.license)article.append(element('small','License: '+card.license));
  if(card.revision)article.append(element('small',' · Revision: '+card.revision));
  const actions=element('div',undefined,'actions');
  if(card.url){
    const link=element('a','Original source (internet may be required)');
    link.href=card.url;link.target='_blank';link.rel='noopener noreferrer external';
    actions.append(link);
  }
  if(card.key&&upstream?.getArticle){
    const button=element('button','Read saved article','secondary');
    button.type='button';
    button.addEventListener('click',async()=>{
      button.disabled=true;
      try{
        const record=await upstream.getArticle(card.key);
        if(!record?.text)throw new Error('Full article is not stored on this device.');
        const body=element('p',String(record.text).slice(0,25000));
        if(String(record.text).length>25000)body.append(element('span',' [Excerpt truncated in this view.]'));
        article.append(body);
        button.remove();
      }catch(error){
        button.disabled=false;
        article.append(element('p','Cannot open local article: '+String(error?.message||error),'muted'));
      }
    });
    actions.append(button);
  }
  article.append(actions);
  return article;
}
async function search(){
  const query=(queryField.value.trim()||buildReferenceQuery(inputAssessment())).slice(0,250);
  queryField.value=query;
  results.replaceChildren();
  searchButton.disabled=true;
  status.textContent='Searching already-downloaded reference materials on this device…';
  const cards=[];
  const errors=[];
  let upstream=null;
  try{
    try{
      const local=await import('../knowledge-school-runtime-v243.mjs');
      const rows=await local.searchDownloadedKnowledge(query,{limit:6,maxSchools:11});
      cards.push(...normalizeReferenceCards(rows,'foundation'));
    }catch(error){errors.push('Foundation search unavailable: '+String(error?.message||error));}
    try{
      upstream=await import('../knowledge-library-upstream-v1.mjs');
      const rows=await upstream.searchDownloaded(query,{layer:'all',school:'all',limit:6});
      cards.push(...normalizeReferenceCards(rows,'expanded/deep'));
    }catch(error){errors.push('Extended library unavailable: '+String(error?.message||error));}
    const seen=new Set();
    const unique=cards.filter(card=>{
      const key=(card.url||card.title).toLowerCase();
      if(seen.has(key))return false;
      seen.add(key);
      return true;
    }).slice(0,10);
    lastSourceRows=unique.map(card=>({title:card.title,notes:card.excerpt,canonicalUrl:card.url,schoolName:card.school,license:card.license,revision:card.revision,source:card.source,tier:card.tier}));
    for(const card of unique)results.append(sourceCard(card,upstream));
    if(!unique.length)results.append(element('p','No matching locally stored passages were found. Download relevant sources while connected; do not infer safety or identification from an empty search.'));
    status.textContent=unique.length+' saved excerpt(s) found.'+(errors.length?' Some offline indexes were unavailable: '+errors.join(' | '):' Source freshness was not checked online.');
  }finally{searchButton.disabled=false;}
}
searchButton.addEventListener('click',()=>{void search().catch(error=>{
  status.textContent='Local search failed: '+String(error?.message||error);
  searchButton.disabled=false;
});});


// No automatic persistence, location reading, model call, or Guild sharing.
byId('download-field-record').addEventListener('click',()=>{
  const input={
    concerns:[...concernRoot.querySelectorAll('input:checked')].map(node=>node.value),
    resources:byId('resources').value.split(','),
    observations:byId('observations').value.split(/\r?\n/),
    photoAttached:Boolean(photo.files?.length)
  };
  const packet=buildFieldPacket(input,lastSourceRows);
  const blob=new Blob([JSON.stringify(packet,null,2)+'\n'],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='civweave-survival-field-record.json';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});


// Vision is a dormant image-captioning executor, not a second guide or a safety
// owner. Worker starts on explicit button click; it never runs on app bootstrap.
const visionStatus=byId('vision-status'),visionResult=byId('vision-result');
const prepareVision=byId('prepare-vision'),analyzePhoto=byId('analyze-photo'),stopVision=byId('stop-vision');
let visionResolve=null,visionReject=null;
function closeVision(message){
  visionRequest++;
  if(visionWorker){visionWorker.terminate();visionWorker=null;}
  if(visionReject){visionReject(new Error('The local vision worker was stopped.'));visionReject=null;visionResolve=null;}
  visionPrepared=false;
  analyzePhoto.disabled=true;
  prepareVision.disabled=false;
  stopVision.disabled=true;
  if(message)visionStatus.textContent=message;
}
function localVisionWorker(){
  if(visionWorker)return visionWorker;
  const worker=new Worker('/app/survival/vision-worker.mjs',{type:'module',name:'civweave-survival-caption'});
  worker.onmessage=event=>{
    const message=event.data||{};
    if(message.type==='progress'&&message.id===visionRequest){
      visionStatus.textContent=String(message.detail||'Preparing device vision…').slice(0,240);
      return;
    }
    if(message.id!==visionRequest)return;
    if(!visionResolve)return;
    const resolve=visionResolve,reject=visionReject;
    visionResolve=null;visionReject=null;
    if(message.type==='result')resolve(message);
    else reject(new Error(String(message.error||'The device vision model did not complete.').slice(0,320)));
  };
  worker.onerror=event=>{
    const reject=visionReject;
    visionResolve=null;visionReject=null;
    closeVision('Local vision runtime failed. The original assessment remains available.');
    if(reject)reject(new Error('The on-device vision worker failed to load.'));
  };
  visionWorker=worker;stopVision.disabled=false;
  return worker;
}
function sendVision(type,payload={},transfer=[]){
  if(visionResolve)throw new Error('A local vision action is already running.');
  const id=++visionRequest,worker=localVisionWorker();
  return new Promise((resolve,reject)=>{
    visionResolve=resolve;visionReject=reject;
    worker.postMessage({id,type,...payload},transfer);
  });
}
prepareVision.addEventListener('click',async()=>{
  prepareVision.disabled=true;
  visionStatus.textContent='Initializing optional local vision model. No photo is sent while preparing.';
  try{
    const result=await sendVision('prepare',{allowDownload:Boolean(navigator.onLine)});
    if(!result.ok)throw new Error('Vision preparation was not confirmed.');
    visionPrepared=true;
    analyzePhoto.disabled=false;
    visionStatus.textContent='On-device vision model loaded. Choose Describe photo locally to run it.';
  }catch(error){
    closeVision('Vision unavailable: '+String(error?.message||error)+'. Manual assessment remains available.');
  }finally{prepareVision.disabled=false;}
});
stopVision.addEventListener('click',()=>closeVision('Local vision stopped; no image analysis is running.'));
analyzePhoto.addEventListener('click',async()=>{
  const file=photo.files?.[0];
  if(!visionPrepared||!file){visionStatus.textContent='Prepare vision and choose an image first.';return;}
  if(!file.type.startsWith('image/')||file.size>12*1024*1024){
    visionStatus.textContent='Choose a supported photo smaller than 12 MB.';return;
  }
  const inputVersion=visionInputVersion;
  analyzePhoto.disabled=true;
  visionResult.replaceChildren();
  visionStatus.textContent='Describing the selected photo locally. Safety assessment will not change.';
  try{
    const bytes=await file.arrayBuffer();
    if(inputVersion!==visionInputVersion){visionStatus.textContent='Photo changed during preparation; no caption was accepted.';return;}
    const answer=await sendVision('caption',{image:bytes,mime:file.type},[bytes]);
    if(inputVersion!==visionInputVersion){visionStatus.textContent='Photo changed during inference; the stale caption was discarded.';return;}
    const output=normalizeLocalVisionResult({generated_text:answer.caption,model:answer.model,remote:false});
    if(output.status!=='unverified-local-caption')throw new Error('The model did not return an accepted local description.');
    captionForVersion=inputVersion;
    const text=element('p','Unverified visual suggestion: '+output.caption);
    visionResult.append(text,element('p','Do not infer species, edibility, injury status, electricity status, water purity or structural safety from this text.','muted small'));
    visionStatus.textContent='Local caption completed. This does not verify an object or any safety condition.';
  }catch(error){
    visionStatus.textContent='Photo description unavailable: '+String(error?.message||error)+'. Continue using manual observations and downloaded sources.';
  }finally{analyzePhoto.disabled=!visionPrepared;}
});
addEventListener('pagehide',()=>closeVision(),{once:true});
