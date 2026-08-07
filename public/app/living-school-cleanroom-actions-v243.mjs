import {actions as legacyActions} from './cabinets/living-school/living-school-cleanroom-actions-v218.mjs';
import {state,persist,toast,progressFor,fields,clean,generateSchool} from './cabinets/living-school/living-school-cleanroom-core-v218.mjs';
import {researchCapability} from './living-school-local-research-v243.mjs';

const busyLabel=(target,label)=>{target.disabled=true;target.textContent=label};

export const actions={...legacyActions,
  'research-sources':async target=>{
    const data=fields(target,['capability']);
    if(!clean(data.capability))throw new Error('Name an observable capability.');
    busyLabel(target,'Researching sources…');
    const packet=await researchCapability(data.capability,{force:true});
    persist('living-school-research-completed',{capability:data.capability,mode:packet.mode,sourceCount:packet.sources?.length||0,provider:packet.provider,model:packet.model,flag:packet.flag});
    if(packet.mode==='live-agentic')toast(`Research complete: ${packet.sources.length} live sources.`);
    else if(packet.mode==='local-downloaded')toast(`Research complete: ${packet.sources.length} downloaded local sources.`);
    else toast(`Research complete with ${String(packet.flag||packet.mode).toLowerCase()}.`);
  },
  'generate-curriculum':async target=>{
    const data=fields(target,['title','capability','level','count','mode','modelRoute','proof']);
    if(!clean(data.capability))throw new Error('Name an observable capability.');
    busyLabel(target,state().school?'Researching before regeneration…':'Researching before generation…');
    const packet=await researchCapability(data.capability,{force:false});
    persist('living-school-research-ready',{capability:data.capability,mode:packet.mode,sourceCount:packet.sources?.length||state().research?.sourceCount||0,reused:Boolean(packet.reused)});
    target.textContent=state().school?'Regenerating curriculum…':'Generating curriculum…';
    const s=state(),school=await generateSchool(data),old=s.school?.modules||[],nextProgress={};
    school.modules.forEach((item,index)=>nextProgress[item.id]=s.progress[old[index]?.id]||progressFor(item.id));
    s.school=school;s.activeModuleId=school.modules[0].id;s.progress=nextProgress;s.settings={...s.settings,modelRoute:data.modelRoute,mode:data.mode};s.visualInspection=null;
    persist('curriculum-generated',{schoolId:school.id,researchMode:s.research?.mode||'none',sourceCount:s.sources.length,formatContract:school.generation.formatContract,fallback:school.generation.fallback});
    toast(school.generation.fallback?`Moss built a complete local fallback after research: ${school.generation.error||'shared generation unavailable'}`:'Moss researched first and generated the formatted curriculum.');
  }
};
