import{resolveRelevantVideo,youtubeEmbedUrl,FALLBACK_VIDEO_URL}from'./video-learning-contract-v1.mjs?v=video-atlas-v1';

const REVISION='cerbanimo-video-task-contract-v1';
const clean=(value,max=6000)=>String(value??'').trim().slice(0,max);
let applying=false;

function engine(){return globalThis.CivweaveCerbanimoQuestV144||null;}
function hasValidVideo(task){return Boolean(task?.video?.url&&youtubeEmbedUrl(task.video.url));}
async function ensureTaskVideos(){
  const api=engine();if(!api?.readState||!api?.writeState||applying)return false;
  applying=true;
  try{
    const state=api.readState();let changed=false;
    for(const quest of state.quests||[]){
      for(const task of quest.tasks||[]){
        if(hasValidVideo(task))continue;
        task.video=await resolveRelevantVideo(`${quest.title||''} ${quest.objective||''} ${task.title||''} ${task.description||''} ${(task.acceptanceCriteria||[]).join(' ')}`);
        task.videoContract={revision:REVISION,required:1,fallbackUrl:FALLBACK_VIDEO_URL,checkedAt:new Date().toISOString()};
        changed=true;
      }
    }
    if(changed)api.writeState(state);
    document.documentElement.dataset.cerbanimoVideoContract='required-per-task';
    return changed;
  }finally{applying=false;}
}
function card(video,index){
  const src=youtubeEmbedUrl(video?.url);if(!src)return null;
  const section=document.createElement('section');section.className='cq144-video-contract';section.dataset.videoContract=REVISION;section.style.cssText='margin:12px 0;padding:10px;border:1px solid currentColor;border-radius:12px;display:grid;gap:8px;';
  const title=document.createElement('b');title.textContent=`Required task video${index!=null?` ${index+1}`:''}`;
  const frame=document.createElement('iframe');frame.src=src;frame.title=clean(video?.title,240)||'Required task video';frame.loading='lazy';frame.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';frame.style.cssText='width:100%;aspect-ratio:16/9;border:0;border-radius:9px;background:#000;';
  const note=document.createElement('small');note.textContent=`${clean(video?.title,240)||'Video companion'}${video?.reason?` · ${clean(video.reason,500)}`:''}`;
  section.append(title,frame,note);return section;
}
function renderTaskCards(){
  const api=engine();if(!api?.readState)return;
  const state=api.readState(),tasks=new Map();
  for(const quest of state.quests||[])for(const task of quest.tasks||[])tasks.set(task.id,task);
  document.querySelectorAll('.cq144-task[data-task-id]').forEach((node,index)=>{
    if(node.querySelector('[data-video-contract]'))return;
    const task=tasks.get(node.dataset.taskId);if(!task?.video)return;
    const embed=card(task.video,index);if(embed)node.querySelector('header')?.insertAdjacentElement('afterend',embed);
  });
}
async function reconcile(){await ensureTaskVideos();renderTaskCards();}
function install(){
  if(document.documentElement.dataset.cerbanimoVideoTaskContract===REVISION)return;
  document.documentElement.dataset.cerbanimoVideoTaskContract=REVISION;
  addEventListener('cerbanimo:quest-engine-changed',()=>queueMicrotask(reconcile));
  const observer=new MutationObserver(()=>queueMicrotask(renderTaskCards));observer.observe(document.documentElement,{subtree:true,childList:true});
  const timer=setInterval(()=>{if(engine()){clearInterval(timer);reconcile();}},100);setTimeout(()=>clearInterval(timer),10000);
}
install();
globalThis.CerbanimoVideoTaskContractV1=Object.freeze({revision:REVISION,fallbackUrl:FALLBACK_VIDEO_URL,reconcile,ensureTaskVideos});
