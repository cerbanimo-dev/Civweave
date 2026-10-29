/**
 * AI-authored Guild project drafts are proposals, not canonical Quest
 * activations or physical/human task assignments. Deterministic allowlists
 * govern what a language model may assign to itself.
 */
export const STARLING_PROJECT_KIND='civweave.starling-autonomous-project.v1';
export const STARLING_TASK_OUTPUT_KIND='civweave.starling-autonomous-task-output.v1';
export const AI_DRAFT_KINDS=Object.freeze(['outline','writing','analysis','editing','code-draft','curriculum','storyboard','review']);
const AI=new Set(AI_DRAFT_KINDS);
const text=(value,max=1000)=>typeof value==='string'?value.trim().slice(0,max):'';
const physical=/\b(?:pick\s*up\s*(?:litter|trash)|feed\s+(?:the\s+)?(?:animals|cats)|trap\s+(?:the\s+)?cats|physically|buy|purchase|ship|deliver\s+(?:goods|items|packages)|install\s+(?:equipment|fences)|drive|clean\s+(?:the\s+)?(?:streets|sidewalks|park)|collect\s+(?:the\s+)?(?:litter|trash)|conduct\s+an?\s+in.person)\b/i;
export function autonomousTaskPolicy({siloMode=false,verifiedHumanSkills=[]}={}){
  // Opt-in skill claims never prove availability. The trusted Guild skill
  // owner must provide verified and currently available skills.
  const skills=Array.isArray(verifiedHumanSkills)?verifiedHumanSkills.filter(x=>typeof x==='string'&&/^[a-z0-9:_-]{1,90}$/.test(x)).slice(0,100):[];
  return Object.freeze({aiOnly:siloMode===true||skills.length===0,siloMode:siloMode===true,humanSkills:Object.freeze([...new Set(skills)])});
}
export function parseAutonomousProject(textValue){
  if(typeof textValue!=='string'||textValue.length>24000)throw new TypeError('Expected a bounded JSON project draft.');
  const raw=textValue.trim().replace(new RegExp('^\\x60{3}(?:json)?\\s*','i'),'').replace(new RegExp('\\s*\\x60{3}$'),'');
  const parsed=JSON.parse(raw);
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new TypeError('Project draft must be a JSON object.');
  return parsed;
}
export function validateAutonomousProject(raw,{guildId,goal,siloMode=false,verifiedHumanSkills=[]}={}){
  const policy=autonomousTaskPolicy({siloMode,verifiedHumanSkills});
  if(!/^[A-Za-z0-9:_-]{1,180}$/.test(guildId||''))throw new TypeError('A Guild is required.');
  if(text(goal,4000).length<12||!raw||typeof raw!=='object'||Array.isArray(raw))throw new TypeError('A Guild goal and project object are required.');
  const title=text(raw.title,180),outcome=text(raw.outcome,1300);
  if(title.length<7||outcome.length<15)throw new TypeError('A project title and tangible outcome are required.');
  if(physical.test(title)||physical.test(outcome))throw new TypeError('A model-generated physical-work claim cannot be an AI project outcome.');
  if(!Array.isArray(raw.tasks)||raw.tasks.length<1||raw.tasks.length>8)throw new TypeError('Projects require 1–8 bounded tasks.');
  const valid=[],seen=new Set();
  for(const row of raw.tasks){
    const taskTitle=text(row?.title,220),deliverable=text(row?.deliverable,900);
    const assignee=row?.assignee;
    if(taskTitle.length<6||deliverable.length<10||physical.test(taskTitle)||physical.test(deliverable))continue;
    const kind=text(row.kind,40),skill=text(row.requiredSkill,90);
    if(assignee==='ai'){
      if(!AI.has(kind)||!/\b(?:draft|document|text|outline|checklist|proposal|plan|script|notes|report|review|guide|curriculum|source|code|storyboard|specification|list|summary|analysis|copy|material|article)\b/i.test(deliverable))continue;
      const key=taskTitle.toLowerCase();if(seen.has(key))continue;seen.add(key);
      valid.push(Object.freeze({id:'task-'+valid.length,assignee:'ai',kind,title:taskTitle,deliverable,requiredSkill:null,status:'ready'}));
    }else if(assignee==='human'&&!policy.aiOnly&&skill&&policy.humanSkills.includes(skill)){
      const key=taskTitle.toLowerCase();if(seen.has(key))continue;seen.add(key);
      valid.push(Object.freeze({id:'task-'+valid.length,assignee:'human',kind:'human-proposal',title:taskTitle,deliverable,requiredSkill:skill,status:'unassigned-human-review'}));
    }
  }
  if(!valid.some(x=>x.assignee==='ai'))throw new TypeError('The project has no permitted AI-executable drafting tasks.');
  return Object.freeze({
    schema:STARLING_PROJECT_KIND,guildId,goal:text(goal,4000),title,outcome,
    aiOnly:policy.aiOnly,siloMode:policy.siloMode,humanSkillsKnown:policy.humanSkills.length>0,
    tasks:Object.freeze(valid),state:'draft-work',canonicalQuestId:null,reviewRequired:true,
    humanApproved:false,claimsVerified:false,completed:false
  });
}
export function findNextAutonomousTask(projects,outputs){
  const finished=new Set((outputs||[]).filter(x=>x?.projectId&&x?.taskId&&x.reviewRequired===true).map(x=>x.projectId+':'+x.taskId));
  for(const project of projects||[]){
    for(const task of project?.tasks||[]){
      if(task.assignee==='ai'&&!finished.has(project.id+':'+task.id))return Object.freeze({project,task});
    }
  }
  return null;
}
