(()=>{
'use strict';

const VERSION='1.0.0-installer-ai-pack-browser-downloads-v1';
const REGISTRY_SRC='/app/local-ai/model-registry-v266.js?v=installer-browser-pack-v1';
const PACKS_SRC='/app/local-ai/model-packs-v1.js?v=installer-browser-pack-v1';
const GENERATIVE_CACHE='civweave-model-generative-v266';
const SPECIALIZED_CACHE='civweave-specialized-model-packs-v1';
const PENDING_KEY='civweave.ai-pack.browser-downloads.v1';
const LARGE_BYTES=32*1024*1024;
const MAX_HEAD_WORKERS=4;
if(globalThis.CivweaveInstallerAiPackDownloadsV1?.version===VERSION)return;

const clean=(value,max=240)=>String(value??'').trim().slice(0,max);
const fmt=bytes=>{const n=Number(bytes)||0;return n>=1e9?`${(n/1e9).toFixed(n>=10e9?1:2)} GB`:n>=1e6?`${(n/1e6).toFixed(n>=100e6?0:1)} MB`:`${Math.max(1,Math.round(n/1e3))} KB`};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const parse=(value,fallback={})=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const basename=path=>decodeURIComponent(String(path||'').split('/').pop()||'model-file');
const cacheFor=kind=>kind==='specialized'?SPECIALIZED_CACHE:GENERATIVE_CACHE;
const forceDownload=url=>{const next=new URL(url,location.href);next.searchParams.set('download','true');return next.href};
const normalizeFilename=name=>String(name||'').replace(/\s*\(\d+\)(?=\.[^.]+$|$)/,'').replace(/\s+-\s+copy(?=\.[^.]+$|$)/i,'');
const guessType=path=>/\.json$/i.test(path)?'application/json':/\.txt$|\.jinja$/i.test(path)?'text/plain; charset=utf-8':'application/octet-stream';

function loadScript(src,marker,test){
  if(test())return Promise.resolve(true);
  return new Promise((resolve,reject)=>{
    const existing=document.querySelector(`script[data-civweave-ai-pack-runtime="${marker}"]`);
    if(existing){existing.addEventListener('load',()=>resolve(test()),{once:true});existing.addEventListener('error',()=>reject(new Error(`Could not load ${marker}.`)),{once:true});return}
    const script=document.createElement('script');
    script.src=src;script.async=false;script.dataset.civweaveAiPackRuntime=marker;
    script.onload=()=>test()?resolve(true):reject(new Error(`${marker} loaded without its Civweave runtime.`));
    script.onerror=()=>reject(new Error(`Could not load ${marker}.`));
    document.head.append(script);
  });
}
async function ensureCatalog(){
  await loadScript(REGISTRY_SRC,'model-registry',()=>Boolean(globalThis.CivweaveLocalModelRegistryV266));
  await loadScript(PACKS_SRC,'model-packs',()=>Boolean(globalThis.CivweaveLocalModelPacksV1));
  return{registry:globalThis.CivweaveLocalModelRegistryV266,packs:globalThis.CivweaveLocalModelPacksV1};
}

function recordsFor(pack,registry,packs){
  const rows=[];
  for(const componentId of pack.installOrder||[]){
    const specialized=packs.specialized?.[componentId];
    if(specialized){
      for(const art of specialized.artifacts||[]){
        rows.push({kind:'specialized',componentId,label:specialized.label,path:art.path,url:packs.assetUrl(componentId,art.path),minBytes:Number(art.minBytes||1),sizeBytes:Number(art.sizeBytes||0),required:true});
      }
      continue;
    }
    const model=registry.byId?.(componentId);
    if(!model)continue;
    for(const art of model.artifacts||[]){
      if(!art.required)continue;
      rows.push({kind:'generative',componentId,label:model.label,path:art.path,url:registry.directUrl(model,art.path),minBytes:Number(art.minBytes||1),sizeBytes:Number(art.sizeBytes||0),required:true});
    }
  }
  return rows.map((row,index)=>({...row,index,basename:basename(row.path),large:Math.max(row.sizeBytes,row.minBytes)>=LARGE_BYTES}));
}

async function expectedLength(record){
  if(record.sizeBytes>0)return record.sizeBytes;
  try{
    const response=await fetch(record.url,{method:'HEAD',cache:'no-store',redirect:'follow'});
    if(!response.ok)return 0;
    return Number(response.headers.get('content-length')||response.headers.get('x-linked-size')||response.headers.get('x-xet-file-size')||0);
  }catch{return 0}
}
async function hydrateExpected(records,onProgress){
  let cursor=0,done=0;
  const out=records.map(row=>({...row,expectedBytes:Number(row.sizeBytes||0)}));
  const workers=Array.from({length:Math.min(MAX_HEAD_WORKERS,out.length)},async()=>{
    while(cursor<out.length){
      const index=cursor++;
      out[index].expectedBytes=await expectedLength(out[index]);
      done+=1;onProgress?.(done,out.length);
    }
  });
  await Promise.all(workers);
  return out;
}

function pendingMap(){return parse(localStorage.getItem(PENDING_KEY),{})}
function savePending(packId,value){
  const map=pendingMap();map[packId]=value;localStorage.setItem(PENDING_KEY,JSON.stringify(map));return value;
}
function pending(packId){return pendingMap()[packId]||null}

function addStyle(){
  if(document.querySelector('style[data-civweave-ai-pack-browser-style]'))return;
  const style=document.createElement('style');style.dataset.civweaveAiPackBrowserStyle='';
  style.textContent=`
    .cw-ai-pack-browser{max-width:980px;margin:18px auto;padding:18px;border:1px solid #8de5ef55;border-radius:18px;background:linear-gradient(145deg,#071923ef,#11162cef);color:#efffff;box-shadow:0 20px 70px #0005}
    .cw-ai-pack-browser h2,.cw-ai-pack-browser h3{margin:.15em 0 .45em}.cw-ai-pack-browser p{color:#b9cbd1;line-height:1.5}.cw-ai-pack-eyebrow{display:block;color:#8de5ef;font-size:.7rem;font-weight:900;letter-spacing:.11em;text-transform:uppercase}
    .cw-ai-pack-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:14px}.cw-ai-pack-card{display:grid;align-content:start;gap:9px;padding:15px;border:1px solid #8de5ef33;border-radius:15px;background:#06131dcc}.cw-ai-pack-card[data-pack="premier-phone"]{border-color:#d69cff66}.cw-ai-pack-card[data-pack="server-quality"]{border-color:#f1c85f66}
    .cw-ai-pack-target,.cw-ai-pack-storage{font-size:.78rem;color:#cbd8dc}.cw-ai-pack-actions{display:flex;gap:8px;flex-wrap:wrap}.cw-ai-pack-actions button,.cw-ai-pack-actions a,.cw-ai-pack-import-label{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:8px 11px;border:1px solid #8de5ef66;border-radius:10px;background:#12303a;color:#efffff;text-decoration:none;font:850 .82rem system-ui,sans-serif;cursor:pointer}.cw-ai-pack-actions button.primary{border-color:#e8c96b77;background:#604817}.cw-ai-pack-actions button:disabled{opacity:.55;cursor:wait}
    .cw-ai-pack-detail{grid-column:1/-1;margin-top:4px;padding:14px;border:1px solid #8de5ef33;border-radius:14px;background:#041019cc}.cw-ai-pack-detail[hidden]{display:none!important}.cw-ai-pack-status{min-height:1.4em;margin:0;color:#d4e5e8;font-size:.82rem}.cw-ai-pack-status[data-state="failed"]{color:#ffd08a}.cw-ai-pack-status[data-state="ready"]{color:#9bdd91}
    .cw-ai-pack-files{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:10px 0;padding:0;list-style:none}.cw-ai-pack-files a{display:flex;justify-content:space-between;gap:8px;padding:8px 9px;border:1px solid #8de5ef2e;border-radius:9px;background:#07151f;color:#dffcff;text-decoration:none;font-size:.76rem}.cw-ai-pack-files small{color:#9fb3b9;white-space:nowrap}.cw-ai-pack-note{font-size:.76rem;color:#aebfc4}.cw-ai-pack-import{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px}.cw-ai-pack-import input{position:absolute;inline-size:1px;block-size:1px;opacity:0;pointer-events:none}
    @media(max-width:850px){.cw-ai-pack-grid{grid-template-columns:1fr}.cw-ai-pack-files{grid-template-columns:1fr}.cw-ai-pack-browser{margin:14px 0;padding:14px}}
  `;
  document.head.append(style);
}

function setStatus(detail,text,state=''){
  const el=detail.querySelector('.cw-ai-pack-status');if(!el)return;el.textContent=text;el.dataset.state=state;
}
function linkFor(record){
  const link=document.createElement('a');link.href=forceDownload(record.url);link.download=record.basename;link.rel='noopener';
  const name=document.createElement('span');name.textContent=`${record.label} · ${record.basename}`;
  const size=document.createElement('small');size.textContent=fmt(record.expectedBytes||record.sizeBytes||record.minBytes);
  link.append(name,size);return link;
}

async function preparePack(pack,card,detail){
  const button=card.querySelector('[data-cw-ai-pack-prepare]');button.disabled=true;setStatus(detail,'Preparing the browser download list…');
  try{
    const {registry,packs}=await ensureCatalog();
    const all=recordsFor(pack,registry,packs),large=all.filter(row=>row.large);
    const hydrated=await hydrateExpected(large,(done,total)=>setStatus(detail,`Checking file sizes · ${done}/${total}`));
    const receipt=savePending(pack.id,{version:1,packId:pack.id,label:pack.label,createdAt:now(),origin:location.origin,largeThreshold:LARGE_BYTES,large:hydrated.map(({kind,componentId,label,path,url,minBytes,sizeBytes,expectedBytes,basename})=>({kind,componentId,label,path,url,minBytes,sizeBytes,expectedBytes,basename}))});
    renderPrepared(pack,detail,receipt);
  }catch(error){setStatus(detail,String(error?.message||error),'failed')}finally{button.disabled=false}
}

function renderPrepared(pack,detail,receipt){
  detail.hidden=false;detail.dataset.pack=pack.id;
  const list=detail.querySelector('.cw-ai-pack-files');list.replaceChildren(...(receipt.large||[]).map(record=>{const li=document.createElement('li');li.append(linkFor(record));return li}));
  const total=(receipt.large||[]).reduce((sum,row)=>sum+Number(row.expectedBytes||row.sizeBytes||row.minBytes||0),0);
  setStatus(detail,`${receipt.large.length} large files · about ${fmt(total)}. These go through the browser's normal download manager.`);
  detail.querySelector('[data-cw-ai-pack-queue]').dataset.packId=pack.id;
  detail.querySelector('[data-cw-ai-pack-import]').dataset.packId=pack.id;
  detail.querySelector('[data-cw-ai-pack-file-input]').dataset.packId=pack.id;
  detail.querySelector('.cw-ai-pack-note').textContent=`You can close Civweave while these files download. If the browser asks to allow multiple downloads, allow it once. Reopen this page afterward and choose the downloaded files to import them into Civweave's local model storage.`;
}

async function queueDownloads(packId,detail){
  const receipt=pending(packId);if(!receipt?.large?.length){setStatus(detail,'Prepare this pack first.','failed');return}
  const button=detail.querySelector('[data-cw-ai-pack-queue]');button.disabled=true;
  setStatus(detail,`Sending ${receipt.large.length} files to the browser download manager…`);
  try{
    for(let i=0;i<receipt.large.length;i++){
      const record=receipt.large[i],link=document.createElement('a');link.href=forceDownload(record.url);link.download=record.basename;link.rel='noopener';link.style.display='none';document.body.append(link);link.click();link.remove();
      setStatus(detail,`Queued ${i+1}/${receipt.large.length} · ${record.basename}`);await sleep(300);
    }
    savePending(packId,{...receipt,queuedAt:now()});
    setStatus(detail,'Downloads queued. You can leave this page; return when the browser says they are complete.','ready');
  }finally{button.disabled=false}
}

function candidateScore(file,record){
  const normalized=normalizeFilename(file.name),target=normalizeFilename(record.basename);
  if(normalized!==target)return Infinity;
  const size=Number(file.size||0),min=Number(record.minBytes||0),expected=Number(record.expectedBytes||record.sizeBytes||0);
  if(min&&size<min*.97)return Infinity;
  if(expected){const ratio=Math.abs(size-expected)/Math.max(1,expected);if(ratio>.08)return Infinity;return ratio}
  return Math.abs(size-min)/Math.max(1,min)+.2;
}
function assignFiles(files,records){
  const candidates=[];
  files.forEach((file,fileIndex)=>records.forEach((record,recordIndex)=>{const score=candidateScore(file,record);if(Number.isFinite(score))candidates.push({file,fileIndex,record,recordIndex,score})}));
  candidates.sort((a,b)=>a.score-b.score);
  const usedFiles=new Set(),usedRecords=new Set(),matches=[];
  for(const candidate of candidates){if(usedFiles.has(candidate.fileIndex)||usedRecords.has(candidate.recordIndex))continue;usedFiles.add(candidate.fileIndex);usedRecords.add(candidate.recordIndex);matches.push(candidate)}
  return{matches,missing:records.filter((_,index)=>!usedRecords.has(index)),unused:files.filter((_,index)=>!usedFiles.has(index))};
}
async function putFile(record,file){
  const cache=await caches.open(cacheFor(record.kind));
  const headers=new Headers({'content-type':file.type||guessType(record.path),'content-length':String(file.size),'x-civweave-imported':'browser-download-v1'});
  await cache.put(record.url,new Response(file,{status:200,headers}));
}
async function cached(record){
  const cache=await caches.open(cacheFor(record.kind)),response=await cache.match(record.url);
  if(!response?.ok)return false;
  const bytes=Number(response.headers.get('content-length')||0);return !bytes||bytes>=Number(record.minBytes||0);
}
async function fetchSmall(record){
  if(await cached(record))return true;
  const response=await fetch(record.url,{cache:'no-store',redirect:'follow'});
  if(!response.ok)throw new Error(`${record.label} · ${record.path} returned HTTP ${response.status}.`);
  const type=String(response.headers.get('content-type')||'').toLowerCase();if(type.includes('text/html'))throw new Error(`${record.label} · ${record.path} returned HTML instead of model data.`);
  const declared=Number(response.headers.get('content-length')||0);if(declared&&declared<Number(record.minBytes||0))throw new Error(`${record.label} · ${record.path} was incomplete.`);
  if(/\.json$/i.test(record.path)){try{JSON.parse(await response.clone().text())}catch{throw new Error(`${record.label} · ${record.path} was not valid JSON.`)}}
  const cache=await caches.open(cacheFor(record.kind));await cache.put(record.url,response);return true;
}

async function importPack(packId,files,detail){
  if(!('caches'in globalThis)){setStatus(detail,'Cache Storage is unavailable in this browser.','failed');return}
  const receipt=pending(packId);if(!receipt?.large?.length){setStatus(detail,'Prepare this pack first so Civweave knows which downloads belong to it.','failed');return}
  const selected=[...files];if(!selected.length)return;
  const assigned=assignFiles(selected,receipt.large);
  if(assigned.missing.length){
    const missing=assigned.missing.slice(0,3).map(row=>row.basename).join(', '),more=assigned.missing.length>3?` +${assigned.missing.length-3} more`:'';
    setStatus(detail,`Still missing ${assigned.missing.length} large download${assigned.missing.length===1?'':'s'}: ${missing}${more}. Select the completed browser downloads and try again.`,'failed');return;
  }
  const input=detail.querySelector('[data-cw-ai-pack-file-input]'),label=detail.querySelector('[data-cw-ai-pack-import]');input.disabled=true;label.setAttribute('aria-disabled','true');
  try{
    let done=0;
    for(const match of assigned.matches){await putFile(match.record,match.file);done+=1;setStatus(detail,`Importing browser downloads · ${done}/${assigned.matches.length}`)}
    const {registry,packs}=await ensureCatalog(),pack=packs.byId(packId),all=recordsFor(pack,registry,packs),small=all.filter(row=>!row.large);
    for(let i=0;i<small.length;i++){setStatus(detail,`Finishing small support files · ${i+1}/${small.length}`);await fetchSmall(small[i])}
    const incomplete=[];for(const record of all)if(!(await cached(record)))incomplete.push(record);
    if(incomplete.length)throw new Error(`${incomplete.length} pack file${incomplete.length===1?' is':'s are'} still missing after import.`);
    savePending(packId,{...receipt,importedAt:now(),completed:true});
    setStatus(detail,`${pack.label} is installed in Civweave local storage. You can delete the browser-downloaded copies after confirming the pack in Civweave.`,'ready');
    const open=detail.querySelector('[data-cw-ai-pack-open]');open.hidden=false;
  }catch(error){setStatus(detail,String(error?.message||error),'failed')}finally{input.disabled=false;label.removeAttribute('aria-disabled');input.value=''}
}

function detailTemplate(){
  const detail=document.createElement('div');detail.className='cw-ai-pack-detail';detail.hidden=true;
  const status=document.createElement('p');status.className='cw-ai-pack-status';status.setAttribute('role','status');status.textContent='Prepare a pack to see its browser download files.';
  const actions=document.createElement('div');actions.className='cw-ai-pack-actions';
  const queue=document.createElement('button');queue.type='button';queue.className='primary';queue.dataset.cwAiPackQueue='';queue.textContent='Queue large files in browser';
  const input=document.createElement('input');input.type='file';input.multiple=true;input.dataset.cwAiPackFileInput='';
  const importLabel=document.createElement('label');importLabel.className='cw-ai-pack-import-label';importLabel.dataset.cwAiPackImport='';importLabel.textContent='Import finished downloads';importLabel.append(input);
  const open=document.createElement('a');open.href='/app/pwa-start-v436.html?installed=1&system=civweave&source=ai-pack-browser-import-v1';open.dataset.cwAiPackOpen='';open.textContent='Open Civweave';open.hidden=true;
  actions.append(queue,importLabel,open);
  const note=document.createElement('p');note.className='cw-ai-pack-note';
  const list=document.createElement('ul');list.className='cw-ai-pack-files';
  detail.append(status,actions,note,list);return detail;
}

async function build(){
  if(location.pathname!=='/app/index.html'||document.querySelector('[data-civweave-ai-pack-browser]'))return false;
  addStyle();
  const main=document.querySelector('main.gateway');if(!main)return false;
  const section=document.createElement('section');section.className='cw-ai-pack-browser';section.dataset.civweaveAiPackBrowser='';section.setAttribute('aria-labelledby','cw-ai-pack-browser-title');
  const eyebrow=document.createElement('small');eyebrow.className='cw-ai-pack-eyebrow';eyebrow.textContent='OPTIONAL ROAD PACK · LOCAL AI';
  const title=document.createElement('h2');title.id='cw-ai-pack-browser-title';title.textContent='Let the browser carry the long AI downloads.';
  const intro=document.createElement('p');intro.innerHTML='Choose an AI pack here when you do not want Civweave itself held open for a multi-gigabyte transfer. <strong>The large model files use the browser\'s normal download manager</strong>; after they finish, return here once to import them into Civweave local storage.';
  const grid=document.createElement('div');grid.className='cw-ai-pack-grid';
  section.append(eyebrow,title,intro,grid);
  const installCard=document.querySelector('.install-card.quest-threshold');if(installCard)installCard.insertAdjacentElement('afterend',section);else main.prepend(section);
  try{
    const {packs}=await ensureCatalog();
    for(const pack of packs.catalogue()){
      const card=document.createElement('article');card.className='cw-ai-pack-card';card.dataset.pack=pack.id;
      const badge=document.createElement('small');badge.className='cw-ai-pack-eyebrow';badge.textContent=pack.id==='minimum-spec'?'SMALLEST COMPLETE PACK':pack.id==='premier-phone'?'PHONE-LOCAL PACK':'GUILD / SERVER PACK';
      const h=document.createElement('h3');h.textContent=pack.label;
      const target=document.createElement('div');target.className='cw-ai-pack-target';target.textContent=pack.target;
      const storage=document.createElement('div');storage.className='cw-ai-pack-storage';storage.textContent=pack.storage;
      const summary=document.createElement('p');summary.textContent=pack.summary;
      const actions=document.createElement('div');actions.className='cw-ai-pack-actions';
      const prepare=document.createElement('button');prepare.type='button';prepare.className='primary';prepare.dataset.cwAiPackPrepare='';prepare.textContent='Prepare browser downloads';
      actions.append(prepare);card.append(badge,h,target,storage,summary,actions);grid.append(card);
      const detail=detailTemplate();grid.append(detail);
      prepare.addEventListener('click',()=>preparePack(pack,card,detail));
      detail.querySelector('[data-cw-ai-pack-queue]').addEventListener('click',()=>queueDownloads(pack.id,detail));
      detail.querySelector('[data-cw-ai-pack-file-input]').addEventListener('change',event=>importPack(pack.id,event.currentTarget.files,detail));
      const saved=pending(pack.id);if(saved?.large?.length)renderPrepared(pack,detail,saved);
      if(saved?.completed){setStatus(detail,`${pack.label} was imported into Civweave local storage on this browser.`,'ready');detail.querySelector('[data-cw-ai-pack-open]').hidden=false}
    }
  }catch(error){
    const status=document.createElement('p');status.className='cw-ai-pack-status';status.dataset.state='failed';status.textContent=`AI pack catalogue did not load: ${String(error?.message||error)}`;grid.append(status);
  }
  return true;
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build,{once:true});else build();
globalThis.CivweaveInstallerAiPackDownloadsV1=Object.freeze({version:VERSION,build,ensureCatalog,recordsFor,largeThreshold:LARGE_BYTES,pendingKey:PENDING_KEY,generativeCache:GENERATIVE_CACHE,specializedCache:SPECIALIZED_CACHE});
})();
