const SCHEMA='civweave.learning-pack.v1';
const VERSION='1.0.0-learning-pack-runtime-v1';
const INSTALLER='/app/learning-pack-seeds-v1.js?v=learning-packs-v1';
let installerPromise=null;
const loaded=new Map();

const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const list=value=>Array.isArray(value)?value:[];
const copy=value=>globalThis.structuredClone?globalThis.structuredClone(value):JSON.parse(JSON.stringify(value));
const validId=value=>/^[a-z0-9][a-z0-9._:-]{1,159}$/i.test(clean(value,160));
const tokenize=value=>[...new Set(clean(value,3000).toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(word=>word.length>2))].slice(0,40);
const scoreText=(value,tokens)=>{const text=clean(value,12000).toLowerCase();return tokens.reduce((sum,token)=>sum+(text.includes(token)?Math.min(12,token.length+2):0),0)};

function loadClassic(src){
  if(typeof document==='undefined')return Promise.reject(new Error('Learning-pack installer requires a browser document.'));
  return new Promise((resolve,reject)=>{
    const pathname=new URL(src,location.href).pathname;
    const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===pathname);
    if(existing){
      if(globalThis.CivweaveLearningPackSeedsV1)return resolve();
      existing.addEventListener('load',resolve,{once:true});
      existing.addEventListener('error',()=>reject(new Error(`Could not load ${src}`)),{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src=src;script.async=true;
    script.addEventListener('load',resolve,{once:true});
    script.addEventListener('error',()=>reject(new Error(`Could not load ${src}`)),{once:true});
    document.head.append(script);
  });
}
async function installer(){
  if(globalThis.CivweaveLearningPackSeedsV1)return globalThis.CivweaveLearningPackSeedsV1;
  if(!installerPromise)installerPromise=loadClassic(INSTALLER).then(()=>{
    if(!globalThis.CivweaveLearningPackSeedsV1)throw new Error('Learning-pack storage runtime did not initialize.');
    return globalThis.CivweaveLearningPackSeedsV1;
  }).catch(error=>{installerPromise=null;throw error});
  return installerPromise;
}
function normalizeSource(source,index=0){
  const id=clean(source?.id,160)||`source-${index+1}`;
  return{id,title:clean(source?.title,300)||id,kind:clean(source?.kind,80)||'reference',url:clean(source?.url,2400),license:clean(source?.license,120),note:clean(source?.note,2400)};
}
function normalizeSkills(skills){
  return list(skills).map((skill,index)=>typeof skill==='string'
    ?{id:clean(skill,160),label:clean(skill,160),aliases:[]}
    :{id:clean(skill?.id,160)||`skill-${index+1}`,label:clean(skill?.label||skill?.title,240),aliases:list(skill?.aliases).map(value=>clean(value,160)).filter(Boolean).slice(0,20)}
  ).filter(skill=>validId(skill.id)&&skill.label);
}
function normalizeSteps(steps,templateId){
  return list(steps).map((step,index)=>typeof step==='string'
    ?{id:`${templateId}.step-${index+1}`,title:clean(step,500),instructions:'',skillRefs:[],check:'',proof:''}
    :{id:clean(step?.id,180)||`${templateId}.step-${index+1}`,title:clean(step?.title||step?.name,500),instructions:clean(step?.instructions||step?.description,2400),skillRefs:list(step?.skillRefs).map(value=>clean(value,160)).filter(Boolean).slice(0,20),check:clean(step?.check,900),proof:clean(step?.proof,900)}
  ).filter(step=>step.title);
}
function normalizeTaskTemplate(template,index=0){
  const id=clean(template?.id,160)||`task-template-${index+1}`;
  return{
    id,title:clean(template?.title,300)||id,templateKind:clean(template?.templateKind,80)||'practice',
    domain:clean(template?.domain,120),outcome:clean(template?.outcome||template?.objective,3000),
    summary:clean(template?.summary,2400),riskClass:['low','guarded','regulated'].includes(clean(template?.riskClass,40).toLowerCase())?clean(template.riskClass,40).toLowerCase():'low',
    skillRefs:list(template?.skillRefs).map(value=>clean(value,160)).filter(Boolean).slice(0,40),
    occupationRefs:list(template?.occupationRefs).map(value=>clean(value,160)).filter(Boolean).slice(0,40),
    expertGuideRefs:list(template?.expertGuideRefs).map(value=>clean(value,160)).filter(Boolean).slice(0,20),
    learningRefs:list(template?.learningRefs).map(value=>clean(value,160)).filter(Boolean).slice(0,20),
    steps:normalizeSteps(template?.steps,id),
    acceptanceCriteria:list(template?.acceptanceCriteria).map(value=>clean(value,800)).filter(Boolean).slice(0,30),
    proofRequirements:list(template?.proofRequirements).map(value=>clean(value,800)).filter(Boolean).slice(0,30),
    stopConditions:list(template?.stopConditions).map(value=>clean(value,800)).filter(Boolean).slice(0,20),
    commonFailures:list(template?.commonFailures).map(value=>clean(value,800)).filter(Boolean).slice(0,20),
    sourceRefs:list(template?.sourceRefs).map(value=>clean(value,160)).filter(Boolean).slice(0,30),
    requiresAdaptation:template?.requiresAdaptation===true
  };
}
function normalizeLearningUnit(unit,index=0){
  const id=clean(unit?.id,160)||`learning-unit-${index+1}`;
  const rawLevel=clean(unit?.level,40).toLowerCase();
  return{
    id,title:clean(unit?.title,300)||id,capability:clean(unit?.capability||unit?.objective,4000),
    level:['beginner','intermediate','advanced'].includes(rawLevel)?rawLevel:'beginner',
    mode:['guided','just-in-time','browse'].includes(clean(unit?.mode,40))?clean(unit.mode,40):'guided',
    recommendedModuleCount:Math.max(1,Math.min(8,Number(unit?.recommendedModuleCount||unit?.count||4)||4)),
    proof:clean(unit?.proof,3000),
    skillRefs:list(unit?.skillRefs).map(value=>clean(value,160)).filter(Boolean).slice(0,40),
    taskTemplateRefs:list(unit?.taskTemplateRefs).map(value=>clean(value,160)).filter(Boolean).slice(0,30),
    expertGuideRefs:list(unit?.expertGuideRefs).map(value=>clean(value,160)).filter(Boolean).slice(0,20),
    sourceRefs:list(unit?.sourceRefs).map(value=>clean(value,160)).filter(Boolean).slice(0,30)
  };
}
function normalizeExpertGuide(guide,index=0){
  const id=clean(guide?.id,160)||`expert-guide-${index+1}`;
  return{id,title:clean(guide?.title,300)||id,domain:clean(guide?.domain,160),riskPolicy:clean(guide?.riskPolicy,120),
    skillRefs:list(guide?.skillRefs).map(value=>clean(value,160)).filter(Boolean).slice(0,40),
    heuristics:list(guide?.heuristics).map(value=>clean(value,1000)).filter(Boolean).slice(0,40),
    commonFailures:list(guide?.commonFailures).map(value=>clean(value,1000)).filter(Boolean).slice(0,40),
    sourceRefs:list(guide?.sourceRefs).map(value=>clean(value,160)).filter(Boolean).slice(0,30)};
}
function normalizeLaborReference(record,index=0){
  const id=clean(record?.id,180)||`labor-reference-${index+1}`;
  return{
    id,title:clean(record?.title,300)||id,occupationCode:clean(record?.occupationCode||record?.code,80),
    description:clean(record?.description,3000),
    taskStatements:list(record?.taskStatements).map(value=>typeof value==='string'?{id:'',text:clean(value,1600)}:{id:clean(value?.id,120),text:clean(value?.text||value?.task,1600),dwaRefs:list(value?.dwaRefs).map(item=>clean(item,160)).filter(Boolean).slice(0,30)}).filter(row=>row.text).slice(0,300),
    essentialSkills:list(record?.essentialSkills).map(value=>typeof value==='string'?{id:'',label:clean(value,240),value:null}:{id:clean(value?.id,160),label:clean(value?.label||value?.name,240),value:Number.isFinite(Number(value?.value))?Number(value.value):null,scale:clean(value?.scale,80)}).filter(row=>row.label).slice(0,100),
    sourceRefs:list(record?.sourceRefs).map(value=>clean(value,160)).filter(Boolean).slice(0,30)
  };
}
export function normalizePack(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Learning pack must be an object.');
  if(input.schema!==SCHEMA)throw new Error(`Unsupported learning-pack schema: ${clean(input.schema,120)||'missing'}.`);
  const id=clean(input.id,160);if(!validId(id))throw new Error('Learning pack is missing a valid id.');
  const pack={
    schema:SCHEMA,id,version:clean(input.version,80)||'1.0.0',title:clean(input.title,300)||id,
    packType:clean(input.packType,80)||'mixed',audience:list(input.audience).map(value=>clean(value,80)).filter(Boolean).slice(0,10),
    summary:clean(input.summary,4000),license:input.license&&typeof input.license==='object'?copy(input.license):{},
    sources:list(input.sources).map(normalizeSource).filter(source=>source.id),
    skills:normalizeSkills(input.skills),
    expertGuides:list(input.expertGuides).map(normalizeExpertGuide),
    taskTemplates:list(input.taskTemplates).map(normalizeTaskTemplate),
    learningUnits:list(input.learningUnits).map(normalizeLearningUnit),
    laborReferences:list(input.laborReferences).map(normalizeLaborReference),
    generatedAt:clean(input.generatedAt,80),sourceRelease:clean(input.sourceRelease,120)
  };
  return pack;
}
function packRecord(pack){return{pack,skills:new Map(pack.skills.map(row=>[row.id,row])),tasks:new Map(pack.taskTemplates.map(row=>[row.id,row])),learning:new Map(pack.learningUnits.map(row=>[row.id,row])),experts:new Map(pack.expertGuides.map(row=>[row.id,row])),labor:new Map(pack.laborReferences.map(row=>[row.id,row]))}}
export function registerPack(input){
  const pack=normalizePack(input);loaded.set(pack.id,packRecord(pack));
  try{globalThis.dispatchEvent?.(new CustomEvent('civweave:learning-pack-loaded',{detail:{packId:pack.id,title:pack.title,taskTemplates:pack.taskTemplates.length,learningUnits:pack.learningUnits.length,laborReferences:pack.laborReferences.length}}))}catch{}
  return copy(pack);
}
export function unloadPack(packId){return loaded.delete(clean(packId,160))}
export function loadedPacks(){return [...loaded.values()].map(record=>copy(record.pack))}
export async function catalog(){const store=await installer();return store.loadCatalog()}
export async function status(){const store=await installer();return store.status()}
export async function bootstrapCore(){const store=await installer();await store.bootstrapCore();const catalog=await store.loadCatalog();const ids=catalog.packs.filter(record=>record.bundled===true&&record.autoStage!==false&&record.available!==false).map(record=>record.id);for(const id of ids)await loadPack(id,{force:true});return ids}
export async function stage(packIds,options={}){const store=await installer();const result=await store.stage(packIds,options);for(const id of packIds||[])await loadPack(id,{force:true});return result}
export async function remove(packIds){const store=await installer();for(const id of packIds||[])unloadPack(id);return store.remove(packIds)}
export async function loadPack(packId,{force=false}={}){
  const id=clean(packId,160);if(!id)throw new Error('Name a learning pack to load.');
  if(!force&&loaded.has(id))return copy(loaded.get(id).pack);
  const store=await installer(),response=await store.openPack(id);
  if(!response)throw new Error(`Learning pack ${id} is not downloaded on this device.`);
  let text='';
  const encoding=clean(response.headers.get('content-encoding'),80).toLowerCase();
  const url=clean(response.headers.get('x-civweave-pack-file'),500).toLowerCase();
  if(encoding==='gzip'||url.endsWith('.gz')){
    if(typeof DecompressionStream!=='function')throw new Error('This browser cannot unpack compressed learning packs offline.');
    text=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).text();
  }else text=await response.text();
  return registerPack(JSON.parse(text));
}
function searchableRows(record){
  const packId=record.pack.id;
  return[
    ...record.pack.taskTemplates.map(item=>({kind:'task-template',packId,item,id:item.id,title:item.title,text:[item.title,item.domain,item.outcome,item.summary,item.skillRefs.join(' '),item.steps.map(step=>`${step.title} ${step.instructions}`).join(' ')].join(' ')})),
    ...record.pack.learningUnits.map(item=>({kind:'learning-unit',packId,item,id:item.id,title:item.title,text:[item.title,item.capability,item.skillRefs.join(' ')].join(' ')})),
    ...record.pack.expertGuides.map(item=>({kind:'expert-guide',packId,item,id:item.id,title:item.title,text:[item.title,item.domain,item.skillRefs.join(' '),item.heuristics.join(' '),item.commonFailures.join(' ')].join(' ')})),
    ...record.pack.laborReferences.map(item=>({kind:'labor-reference',packId,item,id:item.id,title:item.title,text:[item.title,item.occupationCode,item.description,item.taskStatements.map(row=>row.text).join(' '),item.essentialSkills.map(row=>row.label).join(' ')].join(' ')}))
  ];
}
export function search(query,{kinds=[],packIds=[],limit=20}={}){
  const tokens=tokenize(query),wantedKinds=new Set(list(kinds).map(value=>clean(value,80))),wantedPacks=new Set(list(packIds).map(value=>clean(value,160)));
  const rows=[];
  for(const record of loaded.values()){
    if(wantedPacks.size&&!wantedPacks.has(record.pack.id))continue;
    for(const row of searchableRows(record)){
      if(wantedKinds.size&&!wantedKinds.has(row.kind))continue;
      const score=tokens.length?scoreText(row.text,tokens):1;if(score<=0)continue;
      rows.push({kind:row.kind,packId:row.packId,id:row.id,title:row.title,score,item:copy(row.item)});
    }
  }
  return rows.sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title)).slice(0,Math.max(1,Math.min(100,Number(limit)||20)));
}
export function findItem(itemId,{packId='',kind=''}={}){
  const id=clean(itemId,180),records=packId?[loaded.get(clean(packId,160))].filter(Boolean):[...loaded.values()];
  for(const record of records){
    const maps=kind==='task-template'?[record.tasks]:kind==='learning-unit'?[record.learning]:kind==='expert-guide'?[record.experts]:kind==='labor-reference'?[record.labor]:[record.tasks,record.learning,record.experts,record.labor];
    for(const map of maps){const item=map.get(id);if(item)return{packId:record.pack.id,kind:map===record.tasks?'task-template':map===record.learning?'learning-unit':map===record.experts?'expert-guide':'labor-reference',item:copy(item),pack:copy(record.pack)}}
  }
  return null;
}
function expertContext(template,record){
  return template.expertGuideRefs.map(id=>record.experts.get(id)).filter(Boolean).flatMap(guide=>guide.heuristics.slice(0,5));
}
export function compileTaskTemplate(templateOrId,overrides={}){
  let template,record;
  if(typeof templateOrId==='string'){
    const found=findItem(templateOrId,{packId:overrides.packId||'',kind:'task-template'});if(!found)throw new Error(`Task template ${templateOrId} is not loaded.`);
    template=found.item;record=loaded.get(found.packId);
  }else{
    template=normalizeTaskTemplate(templateOrId);record={experts:new Map()};
  }
  if(template.riskClass==='regulated'&&!overrides.allowRegulatedReference)throw new Error('Regulated task references cannot be turned into executable quests without an explicit qualified workflow.');
  const guideNotes=record?expertContext(template,record):[];
  const detailLines=[
    template.summary,template.outcome&&`Outcome: ${template.outcome}`,
    guideNotes.length?`Expert guidance:\n${guideNotes.map(value=>`- ${value}`).join('\n')}`:'',
    template.steps.some(step=>step.instructions)?`Step notes:\n${template.steps.map((step,index)=>`${index+1}. ${step.title}${step.instructions?`: ${step.instructions}`:''}`).join('\n')}`:'',
    template.stopConditions.length?`Stop conditions:\n${template.stopConditions.map(value=>`- ${value}`).join('\n')}`:''
  ].filter(Boolean);
  const title=clean(overrides.title,180)||template.title;
  const sourceActionId=clean(overrides.sourceActionId,160)||`learning-pack:${template.id}`;
  return{
    title,objective:clean(overrides.objective,3000)||template.outcome||template.title,
    description:clean(overrides.description,5000)||detailLines.join('\n\n'),
    steps:template.steps.map(step=>step.title),
    acceptanceCriteria:list(overrides.acceptanceCriteria).length?list(overrides.acceptanceCriteria):template.acceptanceCriteria,
    proofRequirements:list(overrides.proofRequirements).length?list(overrides.proofRequirements):template.proofRequirements,
    reward:clean(overrides.reward,300),dueDate:clean(overrides.dueDate,80),source:'learning-pack',sourceActionId,
    sequential:overrides.sequential!==false,
    packMetadata:{templateId:template.id,riskClass:template.riskClass,skillRefs:copy(template.skillRefs),expertGuideRefs:copy(template.expertGuideRefs),requiresAdaptation:template.requiresAdaptation}
  };
}
export function compileLearningUnit(unitOrId,overrides={}){
  let unit,found;
  if(typeof unitOrId==='string'){found=findItem(unitOrId,{packId:overrides.packId||'',kind:'learning-unit'});if(!found)throw new Error(`Learning unit ${unitOrId} is not loaded.`);unit=found.item}
  else unit=normalizeLearningUnit(unitOrId);
  const context=[unit.capability,unit.skillRefs.length?`Skills: ${unit.skillRefs.join(', ')}.`:''].filter(Boolean).join('\n');
  return{
    title:clean(overrides.title,240)||unit.title,
    capability:clean(overrides.capability,2400)||context,
    level:clean(overrides.level,40)||unit.level,
    count:Math.max(1,Math.min(8,Number(overrides.count||unit.recommendedModuleCount)||4)),
    mode:clean(overrides.mode,40)||unit.mode,
    proof:clean(overrides.proof,3000)||unit.proof,
    intent:overrides.intent==='revise'?'revise':'new',
    newPath:overrides.intent==='revise'?false:true,
    replaceExisting:overrides.intent==='revise'?false:true,
    packMetadata:{learningUnitId:unit.id,skillRefs:copy(unit.skillRefs),taskTemplateRefs:copy(unit.taskTemplateRefs),expertGuideRefs:copy(unit.expertGuideRefs)}
  };
}
export function laborTaskDraft(referenceOrId,taskId,{packId=''}={}){
  let reference=referenceOrId;
  if(typeof referenceOrId==='string'){const found=findItem(referenceOrId,{packId,kind:'labor-reference'});if(!found)throw new Error(`Labor reference ${referenceOrId} is not loaded.`);reference=found.item}
  const task=reference.taskStatements.find(row=>row.id===taskId)||reference.taskStatements.find(row=>row.text===taskId);
  if(!task)throw new Error('Labor task statement was not found.');
  return normalizeTaskTemplate({
    id:`labor-draft:${reference.occupationCode||reference.id}:${task.id||'task'}`,title:task.text,templateKind:'labor-reference',
    domain:reference.title,outcome:task.text,occupationRefs:[reference.occupationCode].filter(Boolean),
    skillRefs:reference.essentialSkills.map(row=>row.id||row.label).filter(Boolean).slice(0,20),
    riskClass:'guarded',steps:[],acceptanceCriteria:[],proofRequirements:[],
    stopConditions:['This occupational task statement is reference data, not a safe work procedure. Adapt it using current workplace instructions, qualified supervision, and applicable safety requirements.'],
    sourceRefs:reference.sourceRefs,requiresAdaptation:true
  });
}
export const version=VERSION;
export const schema=SCHEMA;
const api={version:VERSION,schema:SCHEMA,normalizePack,registerPack,unloadPack,loadedPacks,catalog,status,bootstrapCore,stage,remove,loadPack,search,findItem,compileTaskTemplate,compileLearningUnit,laborTaskDraft};
try{globalThis.CivweaveLearningPackRuntimeV1=Object.freeze(api)}catch{}
