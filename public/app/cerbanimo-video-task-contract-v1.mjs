const REVISION='cerbanimo-video-task-contract-v1.4-display-admission';
const CONTRACT='./video-learning-contract-v1.mjs?v=video-atlas-v1-distinctive-topics';
const FALLBACK_VIDEO_URL='https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const clean=(value,max=6000)=>String(value??'').trim().slice(0,max);
let applying=false,contractPromise=null,harnessPromise=null;

function engine(){return globalThis.CivweaveCerbanimoQuestV144||null;}
function contract(){if(!contractPromise)contractPromise=import(CONTRACT);return contractPromise;}
function youtubeId(value){try{const url=new URL(clean(value,600));if(url.hostname==='youtu.be')return clean(url.pathname.split('/').filter(Boolean)[0],20);if(url.hostname.endsWith('youtube.com')){if(url.pathname==='/watch')return clean(url.searchParams.get('v'),20);return clean(url.pathname.match(/^\/(?:embed|shorts)\/([\w-]{11})/)?.[1],20)}}catch{}return'';}
function youtubeEmbedUrl(value){const id=youtubeId(value);return/^[\w-]{11}$/.test(id)?`https://www.youtube-nocookie.com/embed/${id}`:'';}
function hasValidVideo(task){return Boolean(task?.video?.url&&youtubeEmbedUrl(task.video.url));}
function hasCurrentVideo(task,query){return hasValidVideo(task)&&task.videoContract?.revision===REVISION&&task.videoContract?.query===query;}
function locateTask(state,taskId){for(const quest of state?.quests||[]){const task=(quest.tasks||[]).find(item=>item.id===taskId);if(task)return{quest,task}}return null;}
function videoQuery(quest,task){return`${quest.title||''} ${quest.objective||''} ${task.title||''} ${task.description||''} ${(task.acceptanceCriteria||[]).join(' ')}`;}
function saveResolvedVideos(api,results,media){
  const current=api.readState();let changed=false;
  for(const result of results){
    const quest=current.quests?.find(item=>item.id===result.questId),task=quest?.tasks?.find(item=>item.id===result.taskId);
    if(!task||videoQuery(quest,task)!==result.query||hasCurrentVideo(task,result.query)||!hasValidVideo(result)||!media.mediaMatchesTopic(result.video,result.query))continue;
    // Preserve a relevant companion selected while lookup was pending, along
    // with every task transition and proof in the current engine snapshot.
    task.video=hasValidVideo(task)&&media.mediaMatchesTopic(task.video,result.query)?task.video:result.video;task.videoContract=result.videoContract;changed=true;
  }
  if(changed){api.writeState(current);document.documentElement.dataset.cerbanimoVideoContract='required-per-task';}
  return changed;
}
async function ensureTaskVideo(taskId){
  const api=engine();if(!api?.readState||!api?.writeState||applying)return false;
  const state=api.readState(),found=locateTask(state,taskId);if(!found||hasCurrentVideo(found.task,videoQuery(found.quest,found.task)))return false;
  applying=true;
  try{
    const query=videoQuery(found.quest,found.task),media=await contract(),video=hasValidVideo(found.task)&&media.mediaMatchesTopic(found.task.video,query)?found.task.video:await media.resolveRelevantVideo(query);
    return saveResolvedVideos(api,[{questId:found.quest.id,taskId:found.task.id,query,video,videoContract:{revision:REVISION,query,required:1,fallbackUrl:media.FALLBACK_VIDEO_URL||FALLBACK_VIDEO_URL,checkedAt:new Date().toISOString()}}],media);
  }finally{applying=false;}
}
async function ensureTaskVideos(){
  const api=engine();if(!api?.readState||!api?.writeState||applying)return false;
  applying=true;
  try{
    const state=api.readState(),media=await contract(),results=[];
    for(const quest of state.quests||[]){for(const task of quest.tasks||[]){const query=videoQuery(quest,task);if(hasCurrentVideo(task,query))continue;const video=hasValidVideo(task)&&media.mediaMatchesTopic(task.video,query)?task.video:await media.resolveRelevantVideo(query);results.push({questId:quest.id,taskId:task.id,query,video,videoContract:{revision:REVISION,query,required:1,fallbackUrl:media.FALLBACK_VIDEO_URL||FALLBACK_VIDEO_URL,checkedAt:new Date().toISOString()}});}}
    return saveResolvedVideos(api,results,media);
  }finally{applying=false;}
}
function card(video,index,{unavailable='',fallback=false}={}){
  const src=youtubeEmbedUrl(video?.url);if(!src&&!unavailable)return null;
  const section=document.createElement('section');section.className='cq144-video-contract';section.dataset.videoContract=REVISION;section.style.cssText='margin:12px 0;padding:10px;border:1px solid currentColor;border-radius:12px;display:grid;gap:8px;';
  const title=document.createElement('b');title.textContent=`Required task video${index!=null?` ${index+1}`:''}`;
  section.append(title);
  if(unavailable){const status=document.createElement('p');status.setAttribute('role','status');status.textContent=unavailable;section.append(status)}
  else{const frame=document.createElement('iframe');frame.src=src;frame.title=clean(video?.title,240)||'Required task video';frame.loading='lazy';frame.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';frame.style.cssText='width:100%;aspect-ratio:16/9;border:0;border-radius:9px;background:#000;';section.append(frame)}
  const note=document.createElement('small');note.textContent=`${unavailable?'Saved video: ':''}${clean(video?.title,240)||'Video companion'}${!unavailable&&video?.reason?` · ${clean(video.reason,500)}`:''}`;section.append(note);
  if(src){const direct=document.createElement('a');direct.href=`https://www.youtube.com/watch?v=${youtubeId(video.url)}`;direct.target='_blank';direct.rel='noopener noreferrer';direct.textContent=fallback?'Optional fallback video':unavailable?'Open saved video directly':'Open video directly on YouTube';section.append(direct)}
  return section;
}
async function renderTaskCards(){
  const api=engine();if(!api?.readState)return false;
  const nodes=[...document.querySelectorAll('.cq144-task[data-task-id]')];if(!nodes.length)return false;
  const state=api.readState(),tasks=new Map();for(const quest of state.quests||[])for(const task of quest.tasks||[])tasks.set(task.id,{quest,task});
  if(!nodes.some(node=>tasks.get(node.dataset.taskId)?.task.video))return false;
  let media=null;try{media=await contract()}catch{}
  nodes.forEach((node,index)=>{
    if(!node.isConnected)return;const found=tasks.get(node.dataset.taskId);if(!found?.task.video)return;
    const {quest,task}=found,query=videoQuery(quest,task),video=task.video;
    const signature=JSON.stringify([REVISION,query,clean(video.url,600),clean(video.title,240),clean(video.description||video.catalog_description,5000),clean(video.source,120),clean(video.reason,600),Boolean(media)]);
    const previous=node.querySelector('.cq144-video-contract[data-video-contract]');if(previous?.dataset.videoAdmission===signature)return;previous?.remove();
    const fallback=youtubeId(video.url)===youtubeId(FALLBACK_VIDEO_URL),relevant=!fallback&&hasValidVideo(task)&&media?.mediaMatchesTopic(video,query);
    const automatic=video.source==='civweave-video-atlas'||/Matched the local Video Learning Atlas/i.test(video.reason||'');
    const unavailable=relevant?'':fallback?'No relevant task video was found. The optional fallback is not a topic match.':!media?'Video relevance could not be checked. The saved companion has not been loaded.':automatic?'The saved automatic video does not match this task and has not been loaded.':'This saved video could not be verified against this task and has not been loaded.';
    const embed=card(video,index,{unavailable,fallback});if(embed){embed.dataset.videoAdmission=signature;node.querySelector('header')?.insertAdjacentElement('afterend',embed)}
  });
  return true;
}
async function reconcile({hydrate=false}={}){if(hydrate)await ensureTaskVideos();return renderTaskCards();}
async function installHarness(){if(!harnessPromise)harnessPromise=contract().then(media=>media.installCerbanimoHarness()).catch(error=>{harnessPromise=null;throw error});return harnessPromise;}
function relevantMutation(records){return records.some(record=>Array.from(record.addedNodes||[]).some(node=>node?.nodeType===1&&(node.matches?.('.cq144-task[data-task-id]')||node.querySelector?.('.cq144-task[data-task-id]'))));}
function install(){
  if(document.documentElement.dataset.cerbanimoVideoTaskContract===REVISION)return;document.documentElement.dataset.cerbanimoVideoTaskContract=REVISION;
  addEventListener('cerbanimo:quest-engine-changed',()=>queueMicrotask(renderTaskCards));
  addEventListener('civweave:assistant-runtime-ready',()=>installHarness().catch(error=>console.warn('[Cerbanimo video harness]',error)));
  document.addEventListener('click',event=>{const action=event.target.closest?.('[data-cq-action]'),task=action?.closest?.('.cq144-task[data-task-id]');if(!task)return;ensureTaskVideo(task.dataset.taskId).then(renderTaskCards).catch(error=>console.warn('[Cerbanimo task video]',error));},true);
  const root=document.querySelector('#rc-app')||document.documentElement,observer=new MutationObserver(records=>{if(relevantMutation(records))queueMicrotask(renderTaskCards)});observer.observe(root,{subtree:true,childList:true});
  renderTaskCards();
}
install();
globalThis.CerbanimoVideoTaskContractV1=Object.freeze({revision:REVISION,fallbackUrl:FALLBACK_VIDEO_URL,reconcile,ensureTaskVideo,ensureTaskVideos,installHarness,aiHarness:'lazy-on-assistant-runtime'});
