import {CONCERNS,planAssessment,buildReferenceQuery,normalizeReferenceCards} from './survival-mode.mjs';

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
  if(objectUrl)URL.revokeObjectURL(objectUrl);
  objectUrl='';
  photo.value='';
  preview.removeAttribute('src');
  preview.dataset.visible='false';
}
byId('clear-photo').addEventListener('click',revokePreview);
photo.addEventListener('change',()=>{
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
  if(assessment.photoStatus==='not-analyzed'){
    priorityContent.append(element('p','Photo attached: preview only. No object, plant, or hazard was identified from it.','muted'));
  }
  priority.hidden=false;
}
form.addEventListener('submit',event=>{
  event.preventDefault();
  currentAssessment=inputAssessment();
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
    for(const card of unique)results.append(sourceCard(card,upstream));
    if(!unique.length)results.append(element('p','No matching locally stored passages were found. Download relevant sources while connected; do not infer safety or identification from an empty search.'));
    status.textContent=unique.length+' saved excerpt(s) found.'+(errors.length?' Some offline indexes were unavailable: '+errors.join(' | '):' Source freshness was not checked online.');
  }finally{searchButton.disabled=false;}
}
searchButton.addEventListener('click',()=>{void search().catch(error=>{
  status.textContent='Local search failed: '+String(error?.message||error);
  searchButton.disabled=false;
});});
