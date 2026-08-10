import{ensureLivingSchool,FALLBACK_VIDEO_URL}from'./video-learning-contract-v1.mjs?v=video-atlas-v1';

const REVISION='living-school-video-generation-guard-v1';
const CURRICULUM_PURPOSE='living-school-research-grounded-curriculum-v218.1';

export async function installLivingSchoolVideoGenerationGuardV1(){
  if(globalThis.CivweaveLivingSchoolVideoGenerationGuardV1?.installed)return globalThis.CivweaveLivingSchoolVideoGenerationGuardV1;
  await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();
  const runtime=globalThis.CivweaveModelRuntime;
  if(!runtime?.generate)throw new Error('The shared model runtime is unavailable for the Living School video generation guard.');
  if(runtime.livingSchoolVideoGenerationGuardRevision===REVISION)return runtime;
  const originalGenerate=runtime.generate.bind(runtime);
  const generate=async request=>{
    let next=request;
    if(request?.purpose===CURRICULUM_PURPOSE){
      const addition=[
        'REQUIRED VIDEO COMPANION CONTRACT:',
        'Every curriculum module must leave generation with at least one YouTube video companion.',
        'Prefer a genuinely relevant video from the local Video Learning Atlas. The application will resolve the final URL deterministically after generation.',
        `If no relevant catalog video exists, the required fallback is ${FALLBACK_VIDEO_URL}.`,
        'Do not omit the media requirement merely because the model cannot browse YouTube.'
      ].join('\n');
      const messages=Array.isArray(request.messages)?request.messages.map(message=>({...message})):[];
      let index=-1;for(let i=messages.length-1;i>=0;i--){if(messages[i]?.role==='user'){index=i;break}}
      if(index>=0)messages[index]={...messages[index],content:`${messages[index].content||''}\n\n${addition}`};else messages.push({role:'user',content:addition});
      next={...request,messages,context:{...(request.context||{}),videoCompanionRequired:true,videoFallbackUrl:FALLBACK_VIDEO_URL}};
    }
    const result=await originalGenerate(next);
    if(request?.purpose!==CURRICULUM_PURPOSE||result?.status!=='success'||!Array.isArray(result?.outputJson?.modules))return result;
    const output=typeof structuredClone==='function'?structuredClone(result.outputJson):JSON.parse(JSON.stringify(result.outputJson));
    await ensureLivingSchool(output);
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
