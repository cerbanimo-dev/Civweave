import {actions as legacyActions} from './cabinets/living-school/living-school-cleanroom-actions-v218.mjs';
import {state,persist,toast,progressFor,fields,clean,generateSchool} from './cabinets/living-school/living-school-cleanroom-core-v218.mjs';
import {researchCapability} from './living-school-local-research-v243.mjs?v=source-sanitize-v256';

const busyLabel=(target,label)=>{target.disabled=true;target.textContent=label};
const stage=(handler,name,detail={})=>{try{handler?.(name,detail)}catch{}};

export async function generateCurriculumFromData(input={},options={}){
  const data={
    title:clean(input.title,240),
    capability:clean(input.capability,2400),
    level:clean(input.level,80)||'beginner',
    count:input.count||4,
    mode:clean(input.mode,80)||'guided',
    modelRoute:clean(input.modelRoute,120)||'shared',
    proof:clean(input.proof,3000)||'A working artifact, explanation, and independent receipt.'
  };
  if(!data.capability)throw new Error('Name an observable capability.');
  const source=clean(options.source,120)||'living-school-workbench';
  const before=state();
  before.pathContext={...(before.pathContext||{}),title:data.title||before.school?.title||before.pathContext?.title||'',capability:data.capability,proof:data.proof,source};
  persist('living-school-curriculum-requested',{source,title:data.title,capability:data.capability,level:data.level,count:Number(data.count)||4,mode:data.mode,modelRoute:data.modelRoute});

  stage(options.onStage,'researching',{capability:data.capability});
  const packet=await researchCapability(data.capability,{force:false});
  persist('living-school-research-ready',{capability:data.capability,mode:packet.mode,sourceCount:packet.sources?.length||state().research?.sourceCount||0,reused:Boolean(packet.reused),source});

  stage(options.onStage,'generating',{capability:data.capability,researchMode:packet.mode});
  const s=state(),school=await generateSchool(data),old=s.school?.modules||[],nextProgress={};
  school.modules.forEach((item,index)=>nextProgress[item.id]=s.progress[old[index]?.id]||progressFor(item.id));
  const actualModelRoute=school.generation?.fallback?'deterministic':data.modelRoute;
  s.school=school;
  s.activeModuleId=school.modules[0].id;
  s.progress=nextProgress;
  s.settings={...s.settings,modelRoute:actualModelRoute,mode:data.mode};
  s.visualInspection=null;
  persist('curriculum-generated',{schoolId:school.id,researchMode:s.research?.mode||'none',sourceCount:s.sources.length,formatContract:school.generation.formatContract,fallback:Boolean(school.generation.fallback),generationError:clean(school.generation?.error,800),requestedModelRoute:data.modelRoute,actualModelRoute,source});
  toast(school.generation.fallback?`Moss used the deterministic local compiler after shared AI failed: ${school.generation.error||'shared generation unavailable'}`:'Moss researched first and generated the formatted curriculum with shared AI.');
  stage(options.onStage,'complete',{schoolId:school.id,moduleCount:school.modules.length,requestedModelRoute:data.modelRoute,actualModelRoute,fallback:Boolean(school.generation?.fallback)});
  return school;
}

export const actions={...legacyActions,
  'research-sources':async target=>{
    const data=fields(target,['capability']);
    if(!clean(data.capability))throw new Error('Name an observable capability.');
    busyLabel(target,'Researching sources…');
    const packet=await researchCapability(data.capability,{force:true});
    persist('living-school-research-completed',{capability:data.capability,mode:packet.mode,sourceCount:packet.sources?.length||0,provider:packet.provider,model:packet.model,flag:packet.flag});
    if(packet.mode==='live-agentic')toast(`Research complete: ${packet.sources.length} live sources.`);
    else if(packet.mode==='local-downloaded')toast(`Research complete: ${packet.sources.length} clean downloaded local passages.`);
    else toast(`Research complete with ${String(packet.flag||packet.mode).toLowerCase()}.`);
  },
  'generate-curriculum':async target=>{
    const data=fields(target,['title','capability','level','count','mode','modelRoute','proof']);
    if(!clean(data.capability))throw new Error('Name an observable capability.');
    busyLabel(target,state().school?'Researching before regeneration…':'Researching before generation…');
    await generateCurriculumFromData(data,{source:'living-school-workbench',onStage:name=>{if(name==='generating')target.textContent=state().school?'Regenerating curriculum…':'Generating curriculum…'}});
  }
};
