const REVISION='cerbanimo-video-task-contract-v1.1-lazy';
const CONTRACT='./video-learning-contract-v1.mjs?v=video-atlas-v1';
const FALLBACK_VIDEO_URL='https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const clean=(value,max=6000)=>String(value??'').trim().slice(0,max);
let applying=false,contractPromise=null,harnessPromise=null;

function engine(){return globalThis.CivweaveCerbanimoQuestV144||null;}
function contract(){if(!contractPromise)contractPromise=import(CONTRACT);return contractPromise;}
function youtubeId(value){try{const url=new URL(clean(value,600));if(url.hostname==='youtu.be')return clean(url.pathname.split('/').filter(Boolean)[0],20);if(url.hostname.endsWith('youtube.com')){if(url.pathname==='/watch')return clean(url.searchParams.get('v'),20);return clean(url.pathname.match(/^\/(?:embed|shorts)\/([\w-]{11})/)?.[1],20)}}catch{}return'';}
function youtubeEmbedUrl(value){const id=youtubeId(value);return/^[\w-]{11}$/.test(id)?`https://www.youtube-nocookie.com/embed/${id}`:'';}
function hasValidVideo(task){return Boolean(task?.video?.url&&youtubeEmbedUrl(task.video.url));}
function locateTask(state,taskId){for(const quest of state?.quests||[]){const task=(quest.tasks||[]).find(item=>item.id===taskId);if(task)return{quest,task}}return null;}
async function ensureTaskVideo(taskId){
  const api=engine();if(!api?.readState||!api?.writeState||applying)return false;
  const state=api.readState(),found=locateTask(state,taskId);if(!found||hasValidVideo(found.task))return false;
  applying=true;
  try{
    const media=await contract();
    found.task.video=await media.resolveRelevantVideo(`${found.quest.title||''} ${found.quest.objective||''} ${found.task.title||''} ${found.task.description||''} ${(found.task.acceptanceCriteria||[]).join(' ')}`);
    found.task.videoContract={revision:REVISION,required:1,fallbackUrl:media.FALLBACK_VIDEO_URL||FALLBACK_VIDEO_URL,checkedAt:new Date().toISOString()};
    api.writeState(state);document.documentElement.dataset.cerbanimoVideoContract='required-per-task';return true;
  }finally{applying=false;}
}
async function ensureTaskVideos(){
  const api=engine();if(!api?.readState||!api?.writeState||applying)return false;
  applying=true;
  try{
    const state=api.readState(),media=await contract();let changed=false;
    for(const quest of state.quests||[]){for(const task of quest.tasks||[]){if(hasValidVideo(task))continue;task.video=await media.resolveRelevantVideo(`${quest.title||''} ${quest.objective||''} ${task.title||''} ${task.description||''} ${(task.acceptanceCriteria||[]).join(' ')}`);task.videoContract={revision:REVISION,required:1,fallbackUrl:media.FALLBACK_VIDEO_URL||FALLBACK_VIDEO_URL,checkedAt:new Date().toISOString()};changed=true;}}
    if(changed)api.writeState(state);document.documentElement.dataset.cerbanimoVideoContract='required-per-task';return changed;
  }finally{applying=false;}
}
function card(video,index){
  const src=youtubeEmbedUrl(video?.url);if(!src)return null;
  const section=document.createElement('section');section.className='cq144-video-contract';section.dataset.videoContract=REVISION;section.style.cssText='margin:12px 0;padding:10px;border:1px solid currentColor;border-radius:12px;display:grid;gap:8px;';
  const title=document.createElement('b');title.textContent=`Required task video${index!=null?` ${index+1}`:''}`;
  const frame=document.createElement('iframe');frame.src=src;frame.title=clean(video?.title,240)||'Required task video';frame.loading='lazy';frame.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';frame.style.cssText='width:100%;aspect-ratio:16/9;border:0;border-radius:9px;background:#000;';
  const note=document.createElement('small');note.textContent=`${clean(video?.title,240)||'Video companion'}${video?.reason?` · ${clean(video.reason,500)}`:''}`;section.append(title,frame,note);return section;
}
function renderTaskCards(){
  const api=engine();if(!api?.readState)return;const state=api.readState(),tasks=new Map();for(const quest of state.quests||[])for(const task of quest.tasks||[])tasks.set(task.id,task);
  document.querySelectorAll('.cq144-task[data-task-id]').forEach((node,index)=>{if(node.querySelector('[data-video-contract]'))return;const task=tasks.get(node.dataset.taskId);if(!task?.video)return;const embed=card(task.video,index);if(embed)node.querySelector('header')?.insertAdjacentElement('afterend',embed);});
}
async function reconcile({hydrate=false}={}){if(hydrate)await ensureTaskVideos();renderTaskCards();}
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
