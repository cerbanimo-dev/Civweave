import {VERSION,STORAGE_KEY,OUTBOX_KEY,newDraft,validateDraft,livingSchoolPlan,guildBundle,normaliseSource,normaliseMedia,externalUrl,videoEmbed,downloadableJson} from './living-library-seedling-core-v1.mjs';
import {stageManualDraft,stageBundleForReview} from './living-library-seedling-bridge-v1.mjs';

const el=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=(key,f)=>{try{return JSON.parse(localStorage.getItem(key))||f}catch{return f}};
const stored=read(STORAGE_KEY,null);
let draft=stored?.id&&Array.isArray(stored.modules)?stored:newDraft(),researchResults=[];
const now=()=>new Date().toISOString();
const status=(message)=>{el('status').textContent=message};
function save(){draft.updatedAt=now();try{localStorage.setItem(STORAGE_KEY,JSON.stringify(draft))}catch(error){status('Draft storage failed: '+String(error?.message||error))}preview()}
function getFields(){for(const key of ['title','capability','level','mode','proof'])draft[key]=el(key).value.trim()}
function renderFields(){for(const key of ['title','capability','level','mode','proof'])el(key).value=draft[key]||''}
function renderModules(){
 el('modules').replaceChildren();
 draft.modules.forEach((module,index)=>{
  const box=document.createElement('div');box.className='module';
  box.innerHTML='<div class="module-header"><h3>Module '+(index+1)+'</h3><button type="button" data-remove-module="'+index+'">Remove</button></div>'+
  ['title','focus','outcome'].map(key=>'<label>'+({title:'Title',focus:'Learning focus',outcome:'Observable demonstration'}[key])+'</label><textarea maxlength="'+({title:220,focus:900,outcome:900}[key])+'" data-module="'+index+'" data-field="'+key+'"></textarea>').join('');
  box.querySelectorAll('textarea').forEach(n=>{n.value=module[n.dataset.field]||'';n.addEventListener('input',()=>{module[n.dataset.field]=n.value;save()})});
  box.querySelector('[data-remove-module]').addEventListener('click',()=>{if(draft.modules.length<=3)return status('The canonical Learning Journey review plan needs at least three modules.');const removed=draft.modules.splice(index,1)[0];for(const row of [...draft.sources,...draft.media])if(row.moduleId===removed.id)row.moduleId='';renderModules();renderSources();renderMedia();save()});
  el('modules').append(box);
 });
 const choices=draft.modules.map((m,i)=>'<option value="'+esc(m.id)+'">'+(i+1)+'. '+esc(m.title||'Untitled module')+'</option>').join('');
 for(const id of ['media-module','source-module']){const current=el(id).value;el(id).innerHTML='<option value="">General</option>'+choices;el(id).value=draft.modules.some(m=>m.id===current)?current:'';}
}
function renderSources(){
 el('sources').replaceChildren();
 for(const source of draft.sources){
  const box=document.createElement('div');box.className='entry';
  const link=document.createElement('a');link.href=source.url;link.textContent=source.title;link.rel='noopener noreferrer';link.target='_blank';
  const heading=document.createElement('div');heading.className='entry-head';heading.append(link);
  const remove=document.createElement('button');remove.className='remove';remove.textContent='Remove';remove.addEventListener('click',()=>{draft.sources=draft.sources.filter(row=>row.id!==source.id);renderSources();save()});heading.append(remove);box.append(heading);
  const note=document.createElement('div');note.className='subtle';note.textContent=[source.type,source.creator,source.publisher,draft.modules.find(m=>m.id===source.moduleId)?.title,source.notes].filter(Boolean).join(' · ');box.append(note);el('sources').append(box);
 }
}
function renderMedia(){
 el('media').replaceChildren();
 for(const medium of draft.media){
  const box=document.createElement('div');box.className='entry';
  const heading=document.createElement('div');heading.className='entry-head';
  const label=document.createElement('a');label.textContent=medium.title||medium.url;label.href=medium.url;label.target='_blank';label.rel='noopener noreferrer';heading.append(label);
  const remove=document.createElement('button');remove.className='remove';remove.textContent='Remove';remove.addEventListener('click',()=>{draft.media=draft.media.filter(row=>row.id!==medium.id);renderMedia();save()});heading.append(remove);box.append(heading);
  const note=document.createElement('div');note.className='subtle';note.textContent=medium.kind+' · '+(draft.modules.find(m=>m.id===medium.moduleId)?.title||'General')+' · '+(medium.credit||'attribution not entered');box.append(note);el('media').append(box)
 }
}
function preview(){
 const container=el('preview');container.replaceChildren();
 const title=document.createElement('h3');title.textContent=draft.title||'Untitled Learning Journey';container.append(title);
 for(const [key,name] of [['capability','Capability'],['proof','Proof of capability']]){const p=document.createElement('p');const b=document.createElement('strong');b.textContent=name+': ';p.append(b,document.createTextNode(draft[key]||'Not defined'));container.append(p)}
 const rule=document.createElement('hr');container.append(rule);
 draft.modules.forEach((m,i)=>{const h=document.createElement('h4');h.textContent=(i+1)+'. '+(m.title||'Untitled module');container.append(h);for(const key of ['focus','outcome']){const p=document.createElement('p');p.textContent=(key==='focus'?'Focus: ':'Demonstrate: ')+(m[key]||'Not set');container.append(p)}
 for(const medium of draft.media.filter(media=>media.moduleId===m.id))mediaPreview(medium,container);
 });
 for(const medium of draft.media.filter(m=>!m.moduleId))mediaPreview(medium,container);
 if(draft.sources.length){const h=document.createElement('h4');h.textContent='Sources';container.append(h);const list=document.createElement('ol');for(const source of draft.sources){const item=document.createElement('li');const a=document.createElement('a');a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=source.title;item.append(a);list.append(item)}container.append(list)}
}
function mediaPreview(medium,container){
 const figure=document.createElement('figure');
 if(medium.kind==='image'){
  const img=document.createElement('img');img.src=medium.url;img.alt=medium.title||'Linked image';img.loading='lazy';img.referrerPolicy='no-referrer';figure.append(img);
 }else{
  const embed=videoEmbed(medium.url);
  if(embed){const iframe=document.createElement('iframe');iframe.src=embed;iframe.title=medium.title||'Embedded video';iframe.loading='lazy';iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.allow='fullscreen; encrypted-media; picture-in-picture';iframe.setAttribute('sandbox','allow-scripts allow-same-origin allow-presentation');figure.append(iframe)}
  else{const link=document.createElement('a');link.href=medium.url;link.textContent='Watch linked video';link.target='_blank';link.rel='noopener noreferrer';figure.append(link)}
 }
 const caption=document.createElement('figcaption');caption.textContent=[medium.title,medium.credit,medium.rights].filter(Boolean).join(' · ');figure.append(caption);container.append(figure)
}
function output(filename,data){
 const blob=new Blob([downloadableJson(data)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),10_000);
}
function valid(){getFields();save();const errors=validateDraft(draft);if(errors.length){status('Needs attention:\n• '+errors.join('\n• '));return false}status('Validated: '+draft.modules.length+' modules, '+draft.sources.length+' sources, '+draft.media.length+' media references. This is a review draft, not approved Living School content.');return true}
function stageForMoss(bundle=null,source='manual-editor'){
 if(!bundle){getFields();save()}
 try{
  if(!bundle&&!valid())return false;
  const perform=replace=>{
   const result=bundle?stageBundleForReview(bundle,{replace,origin:source}):stageManualDraft(draft,{replace});
   status('Staged “'+result.planTitle+'” for canonical Moss REVIEW. '+result.sourceCount+' sources and '+result.mediaCount+' media entries are preserved in the Seedling evidence record. No lessons have been generated or approved. Open Civweave → Moss → “Review plan”.');return true;
  };
  try{return perform(false)}
  catch(error){
   if(!/Another Living School plan is awaiting review/.test(String(error.message||error)))throw error;
   if(!confirm('Another Learning Journey is pending review. Export that plan before replacing it. Replace the pending unapproved plan with this one?'))return false;
   return perform(true);
  }
 }catch(error){status('Moss staging rejected: '+String(error.message||error));return false}
}
function reset(){if(!confirm('Start a new Learning Journey? The current local draft will be replaced; export it first if needed.'))return;draft=newDraft();researchResults=[];el('search-results').replaceChildren();renderAll();save();status('Started a new local draft.')}
async function searchIndex(which){
 const query=el('search').value.trim();if(query.length<3)return status('Enter at least three search characters.');
 const button=el(which==='wikipedia'?'search-wikipedia':'search-openalex');button.disabled=true;status('Searching public '+which+' index…');
 try{
  let items=[];
  if(which==='wikipedia'){
   const url='https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch='+encodeURIComponent(query)+'&gsrlimit=8&prop=info&inprop=url&format=json&origin=*';
   const response=await fetch(url);if(!response.ok)throw Error('Wikipedia returned HTTP '+response.status);const payload=await response.json();
   items=Object.values(payload.query?.pages||{}).map(p=>({title:p.title,url:p.fullurl||'https://en.wikipedia.org/wiki/'+encodeURIComponent(p.title.replaceAll(' ','_')),creator:'',publisher:'Wikipedia',type:'reference'}));
  }else{
   const response=await fetch('https://api.openalex.org/works?search='+encodeURIComponent(query)+'&per-page=8');
   if(!response.ok)throw Error('OpenAlex returned HTTP '+response.status);const payload=await response.json();
   items=(payload.results||[]).filter(x=>x.primary_location?.landing_page_url||x.doi).map(x=>({title:x.display_name,url:x.primary_location?.landing_page_url||x.doi,creator:(x.authorships||[]).slice(0,3).map(a=>a.author?.display_name).filter(Boolean).join(', '),publisher:x.primary_location?.source?.display_name||'OpenAlex',type:'research'}))
  }
  researchResults=items.filter(s=>externalUrl(s.url));renderResults();status('Found '+researchResults.length+' suggestions. Add sources explicitly after reviewing their relevance.');
 }catch(error){status('Research lookup unavailable: '+String(error?.message||error)+'. You can still add URLs manually.')}finally{button.disabled=false}
}
function renderResults(){const box=el('search-results');box.replaceChildren();for(const [i,source] of researchResults.entries()){const card=document.createElement('div');card.className='source-card';const a=document.createElement('a');a.textContent=source.title;a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';card.append(a);const p=document.createElement('div');p.className='subtle';p.textContent=source.publisher+' '+(source.creator||'');card.append(p);const b=document.createElement('button');b.textContent='Use this citation';b.addEventListener('click',()=>{el('source-title').value=source.title;el('source-url').value=source.url;el('source-author').value=source.creator||'';el('source-type').value=source.type;status('Citation fields populated. Inspect and click Add cited source to save it.')});card.append(b);box.append(card)}}
const textOnly=value=>String(value??'').replace(/<[^>]*>/g,' ').replace(/&amp;/gi,'&').replace(/&nbsp;/gi,' ').replace(/&#39;/g,"'").replace(/&quot;/gi,'"').replace(/\\s+/g,' ').trim();
async function searchCommons(){
 const query=el('media-search').value.trim();
 if(query.length<3)return status('Enter at least three search characters for image discovery.');
 const button=el('search-commons');button.disabled=true;status('Searching Wikimedia Commons...');
 try{
  const searchParams=new URLSearchParams({action:'query',generator:'search',gsrsearch:query,gsrnamespace:'6',gsrlimit:'8',prop:'imageinfo',iiprop:'url|extmetadata|mime',iiurlwidth:'280',format:'json',origin:'*'});
  const response=await fetch('https://commons.wikimedia.org/w/api.php?'+searchParams.toString());
  if(!response.ok)throw Error('Wikimedia Commons returned HTTP '+response.status);
  const data=await response.json(),results=Object.values(data.query?.pages||{}).filter(p=>p.imageinfo?.[0]?.mime?.startsWith('image/'));
  const root=el('media-results');root.replaceChildren();
  for(const item of results){
   const info=item.imageinfo[0],mediaUrl=externalUrl(info.url),thumb=externalUrl(info.thumburl||info.url);
   if(!mediaUrl)continue;
   const license=textOnly(info.extmetadata?.LicenseShortName?.value||'');
   const credit=textOnly(info.extmetadata?.Artist?.value||'');
   const sourcePage=externalUrl(info.descriptionurl);
   const card=document.createElement('div');card.className='entry';
   if(thumb){const img=document.createElement('img');img.loading='lazy';img.referrerPolicy='no-referrer';img.src=thumb;img.alt=item.title;img.style.cssText='width:125px;max-height:110px;object-fit:contain;float:left;margin-right:12px';card.append(img)}
   const label=document.createElement('div');label.textContent=item.title.replace(/^File:/,'');card.append(label);
   const meta=document.createElement('p');meta.className='subtle';meta.textContent=(license||'License review required')+' · '+(credit||'Creator unverified').slice(0,140);card.append(meta);
   if(sourcePage){const link=document.createElement('a');link.href=sourcePage;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Inspect original, author and license';card.append(link)}
   const use=document.createElement('button');use.textContent='Use image reference';use.type='button';
   use.addEventListener('click',()=>{el('media-type').value='image';el('media-url').value=mediaUrl;el('media-title').value=item.title.replace(/^File:/,'');el('media-credit').value=credit.slice(0,250);el('media-rights').value=(license||'Verify license')+(sourcePage?' · '+sourcePage:'');status('Image reference selected. Review license, creator and image content before adding.')});
   card.append(document.createElement('br'),use);root.append(card)
  }
  status(results.length+' Commons image reference(s) found. You must inspect the original license and select the image.');
 }catch(error){status('Image search unavailable: '+String(error?.message||error)+'. Add a URL manually instead.')}
 finally{button.disabled=false}
}
function addSource(){try{if(draft.sources.length>=40)throw Error('Maximum 40 sources per Learning Journey.');const row=normaliseSource({title:el('source-title').value,url:el('source-url').value,creator:el('source-author').value,notes:el('source-notes').value,type:el('source-type').value,moduleId:el('source-module').value});draft.sources.push(row);for(const id of ['source-title','source-url','source-author','source-notes'])el(id).value='';renderSources();save();status('Added source citation. Its claims and licensing remain for human verification.')}catch(e){status(e.message)}}
function addMedia(){try{if(draft.media.length>=28)throw Error('Maximum 28 media references.');const row=normaliseMedia({kind:el('media-type').value,url:el('media-url').value,title:el('media-title').value,credit:el('media-credit').value,rights:el('media-rights').value,moduleId:el('media-module').value});draft.media.push(row);for(const id of ['media-url','media-title','media-credit','media-rights'])el(id).value='';renderMedia();save();status('Attached media reference. For offline X4 Pro use, convert and package an appropriately licensed local copy separately.')}catch(e){status(e.message)}}
function selectedGuild(){
 const selected=read('civweave.host-node.selection.v1',{});
 let origin='';try{origin=new URL(selected.origin||'').origin}catch{}
 const nodeId=String(selected.nodeId||'').trim();
 const credentials=read('civweave.host-node.credentials.v1',{});
 const session=credentials[origin+'#'+nodeId]||credentials[origin]||{};
 if(!origin||!nodeId||!session.userId||!session.credential||selected.loginMode==='legacy-mobile-selection')return null;
 return {guildId:nodeId,origin,displayName:selected.displayName||nodeId,userId:session.userId};
}
function renderGuild(){const selected=selectedGuild();const p=el('guild-context');p.textContent=selected?'Selected Guild: '+selected.displayName+' ('+selected.guildId+'). Logged-in session found.':'No authenticated Guild session found in this browser. Log into a Guild in the main Civweave app, then return here on the same origin.';el('send-guild').disabled=!selected}
async function ensureMesh(){
 if(globalThis.CivweaveLocalMeshV146)return globalThis.CivweaveLocalMeshV146;
 await new Promise((resolve,reject)=>{const tag=document.createElement('script');tag.src='/app/local-object-mesh-v146.js';tag.onload=resolve;tag.onerror=()=>reject(Error('Signed local mesh could not load.'));document.head.append(tag)});
 if(!globalThis.CivweaveLocalMeshV146?.createObject)throw Error('Signed mesh API missing.');
 return globalThis.CivweaveLocalMeshV146;
}
async function sendGuild(){
 getFields();save();const guild=selectedGuild();if(!guild)return status('Select and authenticate to a real Guild in the main Civweave app first.');
 if(!valid())return;
 if(!confirm('Submit this sourced Learning Journey for review to '+guild.displayName+'? This shares the plan, citations and media URLs with the Guild.'))return;
 const button=el('send-guild');button.disabled=true;
 try{
  const bundle=guildBundle({...draft,guildId:guild.guildId});
  if(new TextEncoder().encode(JSON.stringify(bundle)).length>900000)throw Error('Bundle too large for the Guild relay.');
  const existing=read(OUTBOX_KEY,{});
  const revisionBytes=new TextEncoder().encode(JSON.stringify({title:draft.title,capability:draft.capability,level:draft.level,mode:draft.mode,proof:draft.proof,modules:draft.modules,sources:draft.sources,media:draft.media}));
  const revisionHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',revisionBytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
  const key=guild.guildId+':'+draft.id+':'+revisionHash;
  if(existing[key])throw Error('This revision has already been signed and queued. Revise it before sending again.');
  const mesh=await ensureMesh();
  const group='guild:'+guild.guildId;mesh.configure({groups:[group]});
  const object=await mesh.createObject({kind:'civweave.seedling.guild-learning-submission.v1',purpose:'Human-authored Living School plan for Guild review; not approved or published.',consent:'group',audience:[group],hopLimit:4,publish:true,priority:70,payload:bundle});
  existing[key]={id:object.id,guildId:guild.guildId,status:'signed-local-outbox',queuedAt:now()};
  localStorage.setItem(OUTBOX_KEY,JSON.stringify(existing));
  let delivery='Signed and queued locally for '+guild.displayName+'. Guild receipt NOT confirmed.';
  try{
   const pocket=await import('./pocket-guild-node-v1.mjs');
   const service=pocket.CivweavePocketGuildNodeV1,configuration=service.state();
   if(configuration?.guildId===guild.guildId&&configuration?.primaryOrigin&&configuration?.membershipKey){
    const sync=await service.syncPrimary();
    const latest=service.state();
    const ack='delivery:'+object.id+':'+object.revisionHash;
    if(sync?.ok&&latest?.primaryAcks?.[ack]){delivery='Cloud Guild relay acknowledged the signed submission. Guild review and Living School import are still pending.';existing[key].status='cloud-relay-acknowledged';localStorage.setItem(OUTBOX_KEY,JSON.stringify(existing))}
    else delivery+=' Relay sync status: '+(sync?.status||'not-acknowledged');
   } else delivery+=' Configure a Pocket Guild primary relay, or use a live peer, to deliver it.';
  }catch(err){delivery+=' Relay not confirmed: '+String(err?.message||err)}
  el('guild-result').textContent=delivery;status('Guild submission object: '+object.id+'. '+delivery)
 }catch(error){status('Guild send failed: '+String(error?.message||error));el('guild-result').textContent='Send failed; no confirmed Guild receipt.'}
 finally{renderGuild()}
}
async function refreshGuildInbox(){
 const target=el('guild-inbox'),guild=selectedGuild();
 target.textContent='Reading the local signed Guild mesh…';
 if(!guild){target.textContent='Select and authenticate with a Guild in Civweave first.';return}
 try{
  const mesh=await ensureMesh();const pocket=await import('./pocket-guild-node-v1.mjs');
  const service=pocket.CivweavePocketGuildNodeV1,config=service.state();
  let syncNote='No cloud relay attached; displaying local mesh only.';
  if(config?.guildId===guild.guildId&&config?.primaryOrigin&&config?.membershipKey){
   const synced=await service.syncPrimary();syncNote=synced.ok?'Cloud relay synchronized; local mesh now includes fetched objects.':'Cloud sync unsuccessful: '+(synced.error||synced.status);
  }
  const all=await mesh.listObjects(),rows=(all||[]).filter(o=>o?.kind==='civweave.seedling.guild-learning-submission.v1'&&o?.consent==='group'&&o?.audience?.includes('guild:'+guild.guildId)&&o?.payload?.guildId===guild.guildId).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,30);
  target.replaceChildren();const msg=document.createElement('p');msg.textContent=syncNote+' '+rows.length+' signed submission(s) found.';target.append(msg);
  for(const object of rows){
   const bundle=object.payload;const wrapper=document.createElement('details');wrapper.className='entry';
   const summary=document.createElement('summary');summary.textContent=(bundle.title||'Untitled')+' · '+(bundle.createdAt||object.createdAt||'');wrapper.append(summary);
   const doc=document.createElement('div');doc.className='subtle';
   const cap=document.createElement('p');cap.textContent='Learning goal: '+(bundle.plan?.request?.capability||'');doc.append(cap);
   const modules=document.createElement('ol');for(const module of bundle.plan?.modules||[]){const li=document.createElement('li');li.textContent=(module.title||'')+' — '+(module.outcome||'');modules.append(li)}doc.append(modules);
   const citations=document.createElement('p');citations.textContent='Sources ('+(bundle.sourceCatalog||[]).length+'):';doc.append(citations);
   for(const source of bundle.sourceCatalog||[]){if(!externalUrl(source.url))continue;const a=document.createElement('a');a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=source.title||source.url;doc.append(a,document.createElement('br'))}
   const note=document.createElement('p');note.textContent='Signed community object '+object.id+'. Review required; not approved, published, or materialized by Living School.';doc.append(note);
   const stageButton=document.createElement('button');stageButton.type='button';stageButton.textContent='Stage in Moss for review';stageButton.addEventListener('click',async()=>{
    try{
     const verification=await mesh.validateObject(object);
     if(!verification?.ok)throw Error('The Guild object failed signature verification: '+(verification?.error||'unknown'));
     if(!confirm('Import “'+(bundle.title||'Untitled')+'” from '+guild.displayName+' into Moss as an unapproved plan?'))return;
     stageForMoss(bundle,'signed-guild-mesh');
    }catch(error){status('Guild plan import rejected: '+String(error.message||error))}
   });doc.append(stageButton);
   wrapper.append(doc);target.append(wrapper);
  }
 }catch(error){target.textContent='Unable to read Guild submissions: '+String(error?.message||error)}
}
function renderAll(){renderFields();renderModules();renderSources();renderMedia();renderGuild();preview()}
for(const key of ['title','capability','level','mode','proof'])el(key).addEventListener('input',()=>{draft[key]=el(key).value;save()});
el('add-module').addEventListener('click',()=>{if(draft.modules.length>=8)return status('Maximum eight modules.');draft.modules.push({id:'module-'+crypto.randomUUID(),title:'',focus:'',outcome:''});renderModules();save()});
el('search-commons').addEventListener('click',searchCommons);
el('add-source').addEventListener('click',addSource);el('add-media').addEventListener('click',addMedia);
el('search-wikipedia').addEventListener('click',()=>searchIndex('wikipedia'));el('search-openalex').addEventListener('click',()=>searchIndex('openalex'));
el('validate').addEventListener('click',valid);
el('stage-moss').addEventListener('click',()=>stageForMoss());
el('export-plan').addEventListener('click',()=>{if(valid())output('seedling-living-school-plan.json',livingSchoolPlan(draft))});
el('export-bundle').addEventListener('click',()=>{if(valid())output('seedling-guild-learning-bundle.json',guildBundle(draft))});
el('send-guild').addEventListener('click',sendGuild);
el('refresh-guild').addEventListener('click',refreshGuildInbox);el('reset').addEventListener('click',reset);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderGuild()});
renderAll();status('Seedling Edition '+VERSION+' · Local draft restored. Verify sources before sharing.');
