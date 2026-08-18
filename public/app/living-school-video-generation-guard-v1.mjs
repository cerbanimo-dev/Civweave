import{ensureLivingSchool,ensureModuleVideo,FALLBACK_VIDEO_URL}from'./video-learning-contract-v1.mjs?v=video-atlas-v1';
import{offerMediaPacksBeforeCurriculum}from'./living-school-media-pack-recommender-v1.mjs?v=unified-source-packs-v1';
import safeMode,{validateAdmission,safeModeError}from'./safe-mode-v1.mjs?v=safe-mode-v1';

const REVISION='living-school-video-generation-guard-v1.2-unified-source-packs';
const CURRICULUM_PURPOSE='living-school-research-grounded-curriculum-v218.1';
const SUBJECT_STOP=new Set(['about','after','again','also','basic','basics','beginner','build','building','capability','complete','course','create','creating','curriculum','foundation','foundations','guide','guided','help','intro','introduction','learn','learning','lesson','make','module','people','practice','practical','read','skill','skills','study','teach','teaching','through','understand','using','vocabulary','want','with','your']);
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);

function subjectWords(value){return[...new Set(clean(value,5000).toLowerCase().split(/[^a-z0-9]+/).filter(word=>word.length>3&&!SUBJECT_STOP.has(word)))].slice(0,18)}
function mediaSupportsSubject(media,subject){
  if(!media||media.url===FALLBACK_VIDEO_URL)return true;
  const signals=subjectWords(subject);if(!signals.length)return Number(media.score||0)>=18;
  const evidence=clean(`${media.title||''} ${media.description||''} ${media.creator||''}`,10000).toLowerCase();
  return signals.some(word=>evidence.includes(word));
}
function fallbackMedia(reason='No sufficiently relevant video survived the subject relevance gate.'){
  return{kind:'youtube',url:FALLBACK_VIDEO_URL,title:'Fallback video companion',creator:'',description:'',reason,source:'required-fallback',score:0};
}
async function enforceSubjectVideos(output,subject,schoolSlug=''){
  if(!Array.isArray(output?.modules))return output;
  for(const module of output.modules){
    const probe={...module,video:null,videos:[],objective:`${clean(subject,2200)}. ${clean(module?.objective,2200)}`,summary:`Subject: ${clean(subject,1200)}. ${clean(module?.summary,2200)}`};
    await ensureModuleVideo(probe,{schoolSlug});
    const selected=mediaSupportsSubject(probe.video,subject)?probe.video:fallbackMedia(`The available video candidate did not explicitly match “${clean(subject,180)}”, so Civweave failed closed to the required fallback.`);
    module.video=selected;module.videos=[selected];
  }
  await ensureLivingSchool(output,{schoolSlug});
  output.videoContract={...(output.videoContract||{}),subjectGate:{revision:REVISION,subject:clean(subject,500),failClosedToFallback:true}};
  return output;
}

export async function installLivingSchoolVideoGenerationGuardV1(){
  if(globalThis.CivweaveLivingSchoolVideoGenerationGuardV1?.installed)return globalThis.CivweaveLivingSchoolVideoGenerationGuardV1;
  await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();
  const runtime=globalThis.CivweaveModelRuntime;
  if(!runtime?.generate)throw new Error('The shared model runtime is unavailable for the Living School video generation guard.');
  if(runtime.livingSchoolVideoGenerationGuardRevision===REVISION)return runtime;
  const originalGenerate=runtime.generate.bind(runtime);
  const generate=async request=>{
    let next=request;
    let packOffer=null;
    if(request?.purpose===CURRICULUM_PURPOSE){
      const subject=clean(request?.context?.capability||request?.messages?.findLast?.(message=>message?.role==='user')?.content,2400);
      try{packOffer=await offerMediaPacksBeforeCurriculum(subject,{limit:3})}catch{}
      const addition=[
        'REQUIRED VIDEO COMPANION CONTRACT:',
        'Every curriculum module must leave generation with at least one video companion.',
        'The final resolver must require an explicit semantic match to the curriculum capability, not merely generic learning words such as foundations, vocabulary, practice, or evidence.',
        'Prefer a genuinely relevant rights-cleared local/mesh video, then a genuinely relevant Video Learning Atlas entry.',
        `If no relevant candidate survives the subject gate, the required fallback is ${FALLBACK_VIDEO_URL}.`,
        'Do not omit the media requirement merely because the model cannot browse video sources.'
      ].join('\n');
      const messages=Array.isArray(request.messages)?request.messages.map(message=>({...message})):[];
      let index=-1;for(let i=messages.length-1;i>=0;i--){if(messages[i]?.role==='user'){index=i;break}}
      if(index>=0)messages[index]={...messages[index],content:`${messages[index].content||''}\n\n${addition}`};else messages.push({role:'user',content:addition});
      next={...request,messages,context:{...(request.context||{}),videoCompanionRequired:true,videoFallbackUrl:FALLBACK_VIDEO_URL,mediaPackRecommendations:packOffer?.recommendations||[]}};
    }
    const result=await originalGenerate(next);
    if(request?.purpose!==CURRICULUM_PURPOSE||result?.status!=='success'||!Array.isArray(result?.outputJson?.modules))return result;
    const output=typeof structuredClone==='function'?structuredClone(result.outputJson):JSON.parse(JSON.stringify(result.outputJson));
    const subject=clean(request?.context?.capability||output?.capability||output?.title,2400);
    await enforceSubjectVideos(output,subject);
    if(safeMode.read().enabled){
      for(const module of output.modules){
        const video=module?.video;
        if(video?.url===FALLBACK_VIDEO_URL)continue;
        if(video?.safeAdmission?.admitted)continue;
        const evidence=[video?.title,video?.creator,video?.description,video?.reason].filter(Boolean).join('\n');
        if(evidence.length<80)throw safeModeError(`video for “${module?.title||'module'}”`,{ai:{categories:['insufficient-video-evidence']}});
        const review=await validateAdmission(originalGenerate,{title:video?.title,creator:video?.creator,description:video?.description,reason:video?.reason,source:video?.source,url:video?.url},{kind:'video'});
        if(!review.admitted)throw safeModeError(`video “${video?.title||'Untitled'}”`,review);
        module.video={...video,safeAdmission:review};module.videos=[module.video];
      }
      output.videoContract={...(output.videoContract||{}),safeMode:{revision:safeMode.revision,admission:'deterministic-plus-ai',failClosed:true}};
    }
    return{...result,outputJson:output,outputText:JSON.stringify(output)};
  };
  const wrapped=Object.freeze({...runtime,generate,generateInteractive:request=>generate({...request,executionProfile:'interactive'}),generateAgentic:request=>generate({...request,executionProfile:'agentic'}),livingSchoolVideoGenerationGuardRevision:REVISION});
  globalThis.CivweaveModelRuntime=wrapped;
  const api=Object.freeze({installed:true,revision:REVISION,requiredPerModule:1,fallbackUrl:FALLBACK_VIDEO_URL,purpose:CURRICULUM_PURPOSE});
  globalThis.CivweaveLivingSchoolVideoGenerationGuardV1=api;
  try{dispatchEvent(new CustomEvent('civweave:living-school-video-generation-guard-ready',{detail:api}))}catch{}
  return api;
}

export default installLivingSchoolVideoGenerationGuardV1;
