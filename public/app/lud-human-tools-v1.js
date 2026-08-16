(()=>{
'use strict';
if(globalThis.CivweaveLudHumanToolsV1)return;
const VERSION='1.1.0-custom-fields';
const CERBANIMO='/app/cerbanimo-quest-engine-v144.js?v=lud-human-tools-v1';
const MESH='/app/local-object-mesh-v146.js?v=lud-human-tools-v1';
const VOTING='/app/proposal-voting-gate-v2.js?v=lud-human-tools-v1';
const LIVING_KEY='civweave.living-school.cabinet.v151';
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const copy=value=>value==null?value:structuredClone(value);
const lines=value=>(Array.isArray(value)?value:clean(value).split(/\r?\n/)).map(row=>clean(row,1200).replace(/^\s*(?:[-*•]|\d+[.)])\s*/,'' )).filter(Boolean);
const provenance=()=>globalThis.CivweaveContentProvenanceV1;
function assertLud(){if(globalThis.CivweaveLudModeV1?.isEnabled?.()!==true)throw new Error('These human-only tools are available from Lud Mode.');return true}
function humanMetadata(kind){const p=provenance();return{civweaveProvenance:p?.humanAuthored?.({sourceSystem:'lud-mode',artifactType:kind})||{schema:'civweave.content-provenance.v1',origin:'human-authored',aiGenerated:false,sourceSystem:'lud-mode',artifactType:kind,createdAt:new Date().toISOString(),humanValidations:[]}}}
function load(src,ready){if(ready?.())return Promise.resolve(ready());return new Promise((resolve,reject)=>{const path=new URL(src,location.href).pathname,existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===path);if(existing){let ticks=0;const timer=setInterval(()=>{const value=ready?.();if(value){clearInterval(timer);resolve(value)}else if(++ticks>160){clearInterval(timer);reject(new Error(`${path} loaded without becoming ready.`))}},50);return}const script=document.createElement('script');script.src=src;script.async=false;script.onload=()=>{const value=ready?.();value?resolve(value):reject(new Error(`${path} loaded without its canonical API.`))};script.onerror=()=>reject(new Error(`Could not load ${path}.`));document.head.append(script)})}
async function cerbanimo(){assertLud();return load(CERBANIMO,()=>globalThis.CivweaveCerbanimoQuestV144)}
async function localMesh(){assertLud();return load(MESH,()=>globalThis.CivweaveLocalMeshV146)}
async function voting(){assertLud();await localMesh();return load(VOTING,()=>globalThis.CivweaveProposalVotingGateV2)}
function livingState(){return parse(localStorage.getItem(LIVING_KEY),{})||{}}
async function createQuest(input={}){
  const engine=await cerbanimo(),details=lines(input.steps||input.details),quest=engine.createQuestFromInput({title:clean(input.title,180),objective:clean(input.objective||input.description,3000),description:clean(input.description,5000),steps:details,acceptanceCriteria:lines(input.acceptanceCriteria),proofRequirements:lines(input.proofRequirements),dueDate:clean(input.dueDate,80),reward:clean(input.reward,300),sequential:input.sequential!==false,source:'lud-human-authored'}),result=engine.addQuest(quest,{activate:true});
  if(result?.ok===false)throw new Error(result.error||'Cerbanimo could not create the Quest.');
  try{dispatchEvent(new CustomEvent('civweave:lud-human-quest-created',{detail:{quest:copy(result?.quest||quest),metadata:humanMetadata('quest')}}))}catch{}return result?.quest||quest
}
function activeQuest(engine){const state=engine.readState?.();return state?.quests?.find(row=>row.id===state.preferences?.activeQuestId)||state?.quests?.find(row=>!['completed','archived'].includes(row.status))||state?.quests?.[0]||null}
async function proposeTask(input={}){
  const engine=await cerbanimo(),gate=await voting(),questId=clean(input.questId,180)||activeQuest(engine)?.id;if(!questId)throw new Error('Create or select a Cerbanimo Quest before adding a task.');
  const addition={title:clean(input.title,180),description:clean(input.description,2400),owner:clean(input.owner,140),dependencies:lines(input.dependencies).map(value=>clean(value,120)),acceptanceCriteria:lines(input.acceptanceCriteria||input.details),proofRequired:input.proofRequired!==false,metadata:humanMetadata('task')};
  const proposal=await gate.createProposal({system:'cerbanimo',containerId:questId,projectId:clean(input.projectId,220)||questId,additionType:'task',addition,eligibleVoters:input.eligibleVoters,votingPolicy:input.votingPolicy});
  await gate.castVote(proposal.proposalId,{decision:'approve'});const quorum=await gate.computeQuorum(proposal.proposalId,{publish:true});let commit=null;if(quorum.passed)commit=await gate.commitCerbanimoTask(proposal.proposalId);
  try{dispatchEvent(new CustomEvent('civweave:lud-human-task-proposed',{detail:{proposal:copy(proposal),quorum:copy(quorum),commit:copy(commit)}}))}catch{}return{proposal,quorum,commit}
}
function lessonBlocks(value,sources=[]){
  const sourceIds=sources.map(row=>row.id);
  return lines(value).map((row,index)=>{const divider=row.indexOf('::'),heading=divider>=0?clean(row.slice(0,divider),300):`Lesson ${index+1}`,content=clean(divider>=0?row.slice(divider+2):row,8000);return{id:`lesson-human-${index+1}`,heading:heading||`Lesson ${index+1}`,content,sourceIds,provenance:'human-authored'}}).filter(row=>row.content)
}
function sourceRows(value){
  return lines(value).map((row,index)=>{const url=/^https?:\/\//i.test(row)?row:'';return{id:`human-source-${index+1}`,title:row,url,provenance:'human-authored'}})
}
async function proposeLearningModule(input={}){
  const gate=await voting(),living=livingState(),schoolId=clean(input.schoolId||input.curriculumId||living?.school?.id,220);if(!schoolId)throw new Error('Living School has no active curriculum to extend.');
  const sources=sourceRows(input.sources),criteria=lines(input.completionCriteria||input.acceptanceCriteria),artifact=clean(input.artifact,1600),practicePrompt=clean(input.practicePrompt,4000),practiceSteps=lines(input.practiceSteps);
  const module={
    id:clean(input.id,180)||`module-human-${Date.now().toString(36)}`,
    title:clean(input.title,220)||'Untitled human module',
    summary:clean(input.summary,1800),
    objective:clean(input.objective||input.description,3000),
    relevance:clean(input.relevance,1800),
    prerequisites:lines(input.prerequisites),
    estimatedEffort:clean(input.estimatedEffort,120),
    artifact,
    completionCriteria:criteria,
    learningObjectives:lines(input.learningObjectives),
    lessonBlocks:lessonBlocks(input.lessonBlocks||input.lesson||input.details,sources),
    practice:{prompt:practicePrompt,steps:practiceSteps,deliverable:artifact,completionCriteria:criteria.join(' ')},
    sources,
    metadata:humanMetadata('learning-module')
  };
  const proposal=await gate.proposeCurriculumModule({schoolId,projectId:clean(input.projectId,220)||schoolId,module,eligibleVoters:input.eligibleVoters,votingPolicy:input.votingPolicy});
  await gate.castVote(proposal.proposalId,{decision:'approve'});const quorum=await gate.computeQuorum(proposal.proposalId,{publish:true});let commit=null;if(quorum.passed)commit=await gate.commitCurriculumModule(proposal.proposalId);
  try{dispatchEvent(new CustomEvent('civweave:lud-human-learning-module-proposed',{detail:{proposal:copy(proposal),quorum:copy(quorum),commit:copy(commit)}}))}catch{}return{proposal,quorum,commit}
}
async function proposalState(){const gate=await voting();return gate.read?.()||null}
const api=Object.freeze({version:VERSION,cerbanimo,localMesh,voting,livingState,createQuest,proposeTask,proposeLearningModule,proposalState});
globalThis.CivweaveLudHumanToolsV1=api;
try{dispatchEvent(new CustomEvent('civweave:lud-human-tools-ready',{detail:{version:VERSION}}))}catch{}
})();
