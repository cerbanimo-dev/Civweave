import {loadTierManifest,loadLayerCatalog,layerStatus,stageCumulative,removeLayerSchools,formatTierBytes} from './knowledge-library-tiers-v1.mjs?v=knowledge-library-tiers-v1';

const REVISION='knowledge-library-tier-installer-v1';
const clean=value=>String(value??'').trim();
const layerOrder=['expanded','deep'];
let mounted=false;

function el(tag,attrs={},text=''){
  const node=document.createElement(tag);
  for(const [key,value] of Object.entries(attrs)){
    if(key==='class')node.className=value;
    else if(key==='dataset')Object.assign(node.dataset,value);
    else if(key==='disabled')node.disabled=Boolean(value);
    else node.setAttribute(key,String(value));
  }
  if(text)node.textContent=text;
  return node;
}
function style(node,css){node.style.cssText=css;return node}
function selected(card){return[...card.querySelectorAll('input[type="checkbox"]:checked')].map(input=>input.value)}
function setMessage(card,message,error=false){const node=card.querySelector('[data-tier-message]');if(node){node.textContent=message;node.style.color=error?'#ffd1d1':'inherit'}}
async function storageCopy(bytes){
  try{const estimate=await navigator.storage?.estimate?.();if(!estimate?.quota)return'';const free=Math.max(0,Number(estimate.quota)-Number(estimate.usage||0));return` · ${formatTierBytes(free)} estimated free`;}catch{return''}
}
async function refreshCard(card,record,catalog){
  const state=await layerStatus(record.slug),bySlug=new Map(state.schools.map(row=>[row.school_slug,row]));
  let selectedBytes=0,saved=0;
  for(const input of card.querySelectorAll('input[type="checkbox"]')){
    const school=catalog.schools.find(row=>row.school_slug===input.value),status=bySlug.get(input.value);if(input.checked)selectedBytes+=Number(school?.zip_bytes||0);if(status?.current)saved++;
    const row=input.closest('label'),badge=row?.querySelector('[data-tier-badge]');if(badge)badge.textContent=status?.current?'saved':status?.staged?'partial':'available';
  }
  const count=selected(card).length,download=card.querySelector('[data-tier-download]'),remove=card.querySelector('[data-tier-remove]'),summary=card.querySelector('[data-tier-summary]');
  if(summary)summary.textContent=`${catalog.article_count.toLocaleString()} additional articles · ${formatTierBytes(catalog.zip_bytes)} total · ${saved}/${catalog.schools.length} schools saved`;
  if(download){download.disabled=!count;download.textContent=count?`Download ${record.name} for ${count} school${count===1?'':'s'} (${formatTierBytes(selectedBytes)})`:`Select schools for ${record.name}`}
  if(remove){remove.disabled=!count;remove.textContent=count?'Remove selected saved layer':'Select schools to remove layer'}
}
async function buildReadyCard(record,catalog){
  const card=style(el('section',{'data-tier-card':record.slug}),`border:1px solid rgba(243,242,223,.24);border-radius:16px;padding:14px;margin:12px 0;background:rgba(9,42,32,.55);display:grid;gap:10px;`);
  card.append(el('strong',{},record.name));
  card.append(el('small',{},`${record.description||''} This is additive: existing Foundation articles are not downloaded again.`));
  card.append(el('div',{'data-tier-summary':'1'},`${catalog.article_count.toLocaleString()} additional articles · ${formatTierBytes(catalog.zip_bytes)}`));
  const list=style(el('div'),`display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:6px;`);
  for(const school of catalog.schools){
    const label=style(el('label'),`display:flex;gap:8px;align-items:flex-start;padding:7px;border-radius:10px;background:rgba(255,255,255,.04);`);
    const input=el('input',{type:'checkbox',value:school.school_slug});input.checked=false;
    const copy=el('span');copy.append(el('span',{},school.school_name),document.createElement('br'),el('small',{},`${Number(school.article_count||0).toLocaleString()} articles · ${formatTierBytes(school.zip_bytes)} · `));
    const badge=el('em',{'data-tier-badge':'1'},'available');copy.lastChild.append(badge);
    label.append(input,copy);list.append(label);input.addEventListener('change',()=>refreshCard(card,record,catalog).catch(()=>{}));
  }
  card.append(list);
  const actions=style(el('div'),`display:flex;gap:8px;flex-wrap:wrap;`),download=el('button',{'data-tier-download':'1',type:'button',disabled:true},'Select schools'),remove=el('button',{'data-tier-remove':'1',type:'button',disabled:true},'Remove selected saved layer');actions.append(download,remove);card.append(actions);
  card.append(el('small',{'data-tier-message':'1'},`Nothing downloads until you select schools and tap Download.${await storageCopy(catalog.zip_bytes)}`));
  download.addEventListener('click',async()=>{const slugs=selected(card);if(!slugs.length)return;download.disabled=true;try{await stageCumulative(record.slug,slugs,{onProgress:progress=>{const name=progress.pack?.school_name||progress.school?.school_name||record.name;setMessage(card,`${progress.phase||'working'} · ${progress.layer||record.slug} · ${name}${progress.total?` · ${progress.completed||0}/${progress.total}`:''}`)}});setMessage(card,`${record.name} saved for the selected schools.`);await refreshCard(card,record,catalog)}catch(error){setMessage(card,error?.message||String(error),true)}finally{download.disabled=false;await refreshCard(card,record,catalog).catch(()=>{})}});
  remove.addEventListener('click',async()=>{const slugs=selected(card);if(!slugs.length)return;remove.disabled=true;try{await removeLayerSchools(record.slug,slugs);setMessage(card,`${record.name} layer removed for the selected schools. Foundation remains intact.`);await refreshCard(card,record,catalog)}catch(error){setMessage(card,error?.message||String(error),true)}finally{remove.disabled=false}});
  await refreshCard(card,record,catalog);return card
}
function buildUnavailableCard(record){const card=style(el('section'),`border:1px dashed rgba(243,242,223,.22);border-radius:16px;padding:14px;margin:12px 0;opacity:.78;`);card.append(el('strong',{},record.name));card.append(el('div',{},record.description||''));card.append(el('small',{},`Vital Level ${record.vital_level} · ${record.cumulative_target_articles.toLocaleString()} cumulative target articles · payload not published in this release yet.`));return card}

export async function mountKnowledgeLibraryTiers(){
  if(mounted)return;const anchor=document.querySelector('#knowledge-school-list');if(!anchor)return;mounted=true;
  const root=style(el('section',{'data-knowledge-library-tiers':REVISION}),`margin:16px 0;padding:14px;border-radius:18px;background:rgba(4,33,25,.58);color:inherit;`);
  root.append(el('h3',{},'Expanded local knowledge'));
  root.append(el('p',{},'Keep the compact Foundation library, or optionally add much larger offline layers by school. Larger tiers are never selected automatically.'));
  anchor.parentNode?.insertBefore(root,anchor);
  try{
    const manifest=await loadTierManifest({refresh:true});
    for(const slug of layerOrder){const record=manifest.layers.find(row=>row.slug===slug);if(!record)continue;if(record.availability!=='ready'){root.append(buildUnavailableCard(record));continue}const catalog=await loadLayerCatalog(slug,{refresh:true});if(catalog)root.append(await buildReadyCard(record,catalog))}
  }catch(error){root.append(el('p',{},`Expanded library catalog unavailable: ${clean(error?.message||error)}`))}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>mountKnowledgeLibraryTiers().catch(console.warn),{once:true});else mountKnowledgeLibraryTiers().catch(console.warn);
