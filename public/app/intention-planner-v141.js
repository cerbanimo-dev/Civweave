(()=>{
'use strict';

const VERSION='1.2.0-intention-planner-v141-authored-import';
const INTENTIONS_KEY='civweave.intentions.v127';
const PLAN_SCHEMA='civweave.intention-weave.v1';
const EXPLICIT_PLAN_TRIGGER=/\b(plan|roadmap|routine|program|curriculum|pathway|steps|practice schedule|daily practice|weekly practice|reviewable quest|reviewable weave|set (?:an )?intention)\b|\bteach me\b|\bhelp me learn\b|\bcreate (?:me )?(?:a )?plan\b/i;
const WISH_TRIGGER=/\b(i want|i wish|my wish|my goal|we want|we wish|let'?s|help me)\b/i;
const RETRY_TRIGGER=/\b(retry|try again|one more time|rebuild|build that again|redo)\b/i;
const CORRECTION_TRIGGER=/\b(not (?:a|an|the)|instead(?: of)?|rather than|i mean|correction|change (?:it|that)|revise (?:it|that)|scratch that)\b/i;
const PROJECT_ACTION='(?:learn|make|build|create|write|start|organize|find|change|improve|design|develop|launch|open|set\\s*up|form|run|establish|grow)';
const DIRECT_INTENTION_TRIGGER=new RegExp(`^(?:(?:please|kindly)\\s+)?${PROJECT_ACTION}\\b`,'i');
const INTENT_PROJECT_TRIGGER=new RegExp(`\\b(?:i|we)\\s+(?:want|need|would\\s+like|wish|hope|plan|intend|aim)\\s+to\\s+${PROJECT_ACTION}\\b`,'i');
const COLLECTIVE_PROJECT_TRIGGER=new RegExp(`\\b(?:me\\s+and\\s+(?:my\\s+)?friends|my\\s+friends\\s+and\\s+(?:me|i)|friends?\\s+and\\s+i|our\\s+(?:friends|group|team|family|community)|we)\\b[^.!?]{0,90}\\b${PROJECT_ACTION}\\b`,'i');
const NON_AI_PROVIDER_RE=/^(?:deterministic(?:-local)?|local-contract|bundled|packaged|reflex|minilm|local-reflex|manual|unknown)?$/i;

const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const clean=value=>String(value==null?'':value).trim();
const lower=value=>clean(value).toLowerCase();
const emit=(type,detail={})=>{try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,at:new Date().toISOString(),...detail}}))}catch{}};

function stripGreeting(value=''){
  return clean(value).replace(/^\s*(?:(?:hi|hello|hey|yo|good\s+(?:morning|afternoon|evening))[\s,!;:.-]*)+/i,'').trim();
}
function projectIntent(value=''){
  const text=stripGreeting(value);
  if(!text)return false;
  return EXPLICIT_PLAN_TRIGGER.test(text)||WISH_TRIGGER.test(text)||DIRECT_INTENTION_TRIGGER.test(text)||INTENT_PROJECT_TRIGGER.test(text)||COLLECTIVE_PROJECT_TRIGGER.test(text);
}
function dispatchChanged(items){emit('civweave:intentions-changed',{items})}
function userTurns(history,text){
  const turns=(Array.isArray(history)?history:[]).filter(item=>item?.role==='user').map(item=>clean(item.text||item.content)).filter(Boolean);
  const latest=clean(text);if(latest&&turns.at(-1)!==latest)turns.push(latest);return turns.slice(-24);
}
function activeIntentionTurns(history,text){
  const turns=userTurns(history,text);if(!turns.length)return[];
  const latestIndex=turns.length-1,latest=turns[latestIndex];
  if(projectIntent(latest))return[latest];
  if(CORRECTION_TRIGGER.test(latest)){
    for(let index=latestIndex-1;index>=0;index--)if(projectIntent(turns[index])||EXPLICIT_PLAN_TRIGGER.test(turns[index]))return[turns[index],latest];
    return[latest];
  }
  if(RETRY_TRIGGER.test(latest)){
    for(let index=latestIndex-1;index>=0;index--)if(projectIntent(turns[index]))return[turns[index],latest];
  }
  return[latest];
}
function currentSystem(context={}){return clean(context?.currentContext?.systemId||context?.guide?.system||context?.routingAnswer?.system||'civweave')}
function meaningfulPriorWish(turns){return turns.slice(0,-1).some(projectIntent)}
function shouldCreate({text,history,context,force=false}={}){
  if(force)return true;if(currentSystem(context)!=='civweave')return false;
  const value=clean(text);if(!value)return false;
  if(projectIntent(value)||CORRECTION_TRIGGER.test(value))return true;
  return RETRY_TRIGGER.test(value)&&meaningfulPriorWish(userTurns(history,value));
}
function aiAuthoredPlan(plan){
  const authoring=plan?.authoring,provider=clean(authoring?.provider).toLowerCase();
  return Boolean(plan?.id&&plan?.schema===PLAN_SCHEMA&&authoring?.aiGenerated===true&&authoring?.mode==='model-structured-json'&&provider&&!NON_AI_PROVIDER_RE.test(provider));
}
function authoredImportedPlan(plan){
  const authoring=plan?.authoring,receipt=authoring?.receipt,contract=receipt?.stageContract;
  const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
  const texts=(value,maxItems,maxLength)=>Array.isArray(value)&&value.length>0&&value.length<=maxItems&&value.every(item=>text(item,maxLength));
  const digest=value=>typeof value==='string'&&/^sha256:[a-f0-9]{64}$/.test(value);
  if(!plan?.id||plan.schema!==PLAN_SCHEMA||plan.requiresExplicitActivation!==true||authoring?.mode!=='external-authored-json'||authoring.aiGenerated!==false||authoring.externallyAuthored!==true||authoring.provider!=null||!['human','editor-agent','external-author'].includes(authoring.authorship?.kind))return false;
  if(receipt?.schema!=='civweave.quest-authored-import-receipt.v1'||receipt.kind!=='manual-plan-insert'||receipt.planId!==plan.id||receipt.inferenceInvocations!==0||receipt.validation?.state!=='valid'||receipt.authorization?.state!=='pending'||receipt.execution?.state!=='not-started'||!Number.isInteger(receipt.artifactRevision)||receipt.artifactRevision<1||!digest(receipt.inputDigest)||!digest(contract?.promptDigest)||contract?.sourceModule!=='/extensions/civweave-weaveling-plan-json-v190.js'||contract.revision!==authoring.revision||contract.outputSchema!=='civweave.weaveling-quest-json.v190'||!['subsystems','native-paths'].includes(contract.outputFormat))return false;
  if(!text(plan.title,240)||!text(plan.wish,4000)||!text(plan.outcome,2400)||!texts(plan.assumptions,8,700)||!Array.isArray(plan.paths)||!plan.paths.length||plan.paths.length>4)return false;
  const realmTypes={'living-school':'learning',cerbanimo:'skilled-labor',fellowfare:'material-acquirement',anarchadia:'civic-governance'},realms=new Set(),ids=new Set();
  for(const path of plan.paths){
    if(!text(path.id,120)||ids.has(path.id)||realms.has(path.realm)||realmTypes[path.realm]!==path.type||!text(path.title,240)||!text(path.purpose,1200)||!texts(path.steps,8,700)||!text(path.completionCriteria,1200)||!texts(path.evidence,8,500))return false;
    ids.add(path.id);realms.add(path.realm);
  }
  for(const path of plan.paths)if(path.dependsOn&&(!Array.isArray(path.dependsOn)||path.dependsOn.some(id=>!ids.has(id)||id===path.id)))return false;
  if(plan.governance&&(!text(plan.governance.title,240)||!text(plan.governance.purpose,1200)||!text(plan.governance.reviewQuestion,700)||!Array.isArray(plan.governance.agreements)||plan.governance.agreements.length>8||plan.governance.agreements.some(item=>!text(item,500))))return false;
  return true;
}
function savedItems(){const value=parse(localStorage.getItem(INTENTIONS_KEY),[]);return Array.isArray(value)?value:[]}
function preserveAuthoringHistory(prior,next){
  if(!prior)return;
  const history=prior.authoring?.importHistory;
  if(history!=null&&!Array.isArray(history)){const error=new Error('The saved authored revision history is invalid.');error.code='QUEST_IMPORT_HISTORY_INVALID';throw error}
  if(!prior.authoring?.receipt&&!next.authoring?.receipt&&!history?.length)return;
  const snapshot=structuredClone(prior);if(snapshot.authoring)delete snapshot.authoring.importHistory;
  const revisions=[...(history||[]),{receipt:snapshot.authoring?.receipt||null,plan:snapshot}];
  if(revisions.length>8||JSON.stringify(revisions).length>250000){const error=new Error('The Quest has reached its local authored revision-history limit. Export its saved history before starting a new Quest; no revision was replaced.');error.code='QUEST_IMPORT_HISTORY_LIMIT';throw error}
  next.authoring={...next.authoring,importHistory:revisions};
}
function collectiveLine(plan){return plan?.collective?.id==='starling'?clean(plan.collective.lineId):''}
function existingCollective(items,plan){
  const line=collectiveLine(plan),sameId=items.find(item=>item?.id===plan.id||item?.plan?.id===plan.id);
  if(sameId&&(line||collectiveLine(sameId.plan))&&line!==collectiveLine(sameId.plan)){
    const error=new Error('That Quest ID belongs to a different Collective line.');error.code='QUEST_COLLECTIVE_LINE_CONFLICT';throw error;
  }
  return line?items.find(item=>collectiveLine(item?.plan)===line)||null:null;
}
function persist(plan){
  if(!aiAuthoredPlan(plan)&&!authoredImportedPlan(plan)){
    const error=new Error('Quest persistence requires validated AI-authored structured output.');error.code='QUEST_AI_AUTHORING_REQUIRED';emit('civweave:quest-ai-authority-rejected',{surface:'intention-planner.persist',planId:clean(plan?.id),title:clean(plan?.title)});throw error;
  }
  const items=savedItems(),line=collectiveLine(plan),existing=existingCollective(items,plan),fingerprint=lower(`${plan.title}|${plan.wish}`).slice(0,500),duplicate=existing||(authoredImportedPlan(plan)&&items.find(item=>item?.id===plan.id))||(!line&&items.find(item=>item?.kind==='weave-plan'&&!collectiveLine(item.plan)&&item?.fingerprint===fingerprint&&!['completed','abandoned','archived','cancelled','canceled'].includes(item?.state))),at=new Date().toISOString();
  if(authoredImportedPlan(plan)&&duplicate&&String(duplicate.plan?.state||duplicate.state)!=='review'){const error=new Error('An authored import may revise only a Quest still in REVIEW.');error.code='QUEST_IMPORT_REVISION_CONFLICT';throw error}
  // Re-importing a Collective line must never reset its accepted work, path IDs,
  // or terminal decision. Revisions are editable only while the Quest is REVIEW.
  if(existing&&String(existing.plan?.state||existing.state)!=='review')return existing;
  if(duplicate){
    plan.id=duplicate.id;plan.createdAt=duplicate.plan?.createdAt||duplicate.createdAt||plan.createdAt;plan.updatedAt=at;preserveAuthoringHistory(duplicate.plan,plan);duplicate.plan=plan;duplicate.text=plan.title;duplicate.state='review';duplicate.done=false;duplicate.updatedAt=at;
    localStorage.setItem(INTENTIONS_KEY,JSON.stringify(items.slice(0,100)));dispatchChanged(items);return duplicate;
  }
  const item={id:plan.id,kind:'weave-plan',fingerprint,text:plan.title,state:'review',done:false,createdAt:plan.createdAt||at,updatedAt:plan.updatedAt||at,plan};items.unshift(item);localStorage.setItem(INTENTIONS_KEY,JSON.stringify(items.slice(0,100)));dispatchChanged(items);return item;
}
function restore(plan){
  if(!plan?.id)return null;const items=savedItems(),existing=existingCollective(items,plan)||items.find(item=>item?.id===plan.id||item?.plan?.id===plan.id);if(existing)return existing;
  if(!aiAuthoredPlan(plan)&&!authoredImportedPlan(plan)){emit('civweave:quest-ai-authority-rejected',{surface:'intention-planner.restore',planId:clean(plan?.id),title:clean(plan?.title)});return null}
  const restored=structuredClone(plan);restored.state=restored.state||'review';const at=new Date().toISOString(),item={id:restored.id,kind:'weave-plan',fingerprint:lower(`${restored.title}|${restored.wish}`).slice(0,500),text:restored.title||'Restored Quest',state:restored.state,done:false,createdAt:restored.createdAt||at,updatedAt:at,plan:restored};items.unshift(item);localStorage.setItem(INTENTIONS_KEY,JSON.stringify(items.slice(0,100)));dispatchChanged(items);return item;
}
function abandon(planId,{collectiveLineId,reason=''}={}){
  const items=savedItems(),item=items.find(item=>item?.id===planId||item?.plan?.id===planId),plan=item?.plan,line=clean(collectiveLineId);
  if(!plan||!line||collectiveLine(plan)!==line)return{ok:false,code:'QUEST_COLLECTIVE_LINE_CONFLICT',error:'Abandonment requires the exact saved Collective line and Quest.'};
  if(plan.state==='completed'||item.state==='completed'||globalThis.CivweaveProofProgressV158?.planCompletion?.(plan.id)?.complete===true)return{ok:false,code:'QUEST_ALREADY_COMPLETED',error:'Completed work cannot be rewritten as abandoned.'};
  if(plan.state==='abandoned')return{ok:true,unchanged:true,item,plan};
  const at=new Date().toISOString(),next=structuredClone(plan);next.state='abandoned';next.updatedAt=at;next.abandonedAt=at;next.abandonment={at,collectiveLineId:line,reason:clean(reason).slice(0,1200)};
  item.plan=next;item.state='abandoned';item.done=false;item.updatedAt=at;
  const entries=[[INTENTIONS_KEY,items]],campusKey='civweave.working-campus.v1',inboxKey='civweave.realm-inbox.v1',campus=parse(localStorage.getItem(campusKey),{}),inbox=parse(localStorage.getItem(inboxKey),[]);
  if(campus?.plan?.id===plan.id)entries.push([campusKey,{...campus,plan:next,updatedAt:at}]);
  if(Array.isArray(inbox)&&inbox.some(row=>row?.payload?.weaveId===plan.id))entries.push([inboxKey,inbox.map(row=>row?.payload?.weaveId===plan.id?{...row,status:'abandoned',updatedAt:at}:row)]);
  const before=entries.map(([key])=>[key,localStorage.getItem(key)]);
  try{for(const [key,value] of entries)localStorage.setItem(key,JSON.stringify(value))}catch(error){for(const [key,value] of before.reverse())try{value===null?localStorage.removeItem(key):localStorage.setItem(key,value)}catch{}return{ok:false,code:'QUEST_ABANDON_SAVE_FAILED',error:`The Quest could not be stopped: ${clean(error?.message||error)}`}}
  dispatchChanged(items);emit('civweave:quest-abandoned',{planId:plan.id,collectiveLineId:line,at});return{ok:true,item,plan:next};
}
function format(plan){
  if(!plan)return'';const paths=(plan.paths||[]).map((path,index)=>[`${index+1}. ${clean(path.title)} · ${clean(path.realm)}`,clean(path.purpose),`First step: ${clean(path.steps?.[0])||'Review the AI-generated first checkpoint.'}`,`Completion: ${clean(path.completionCriteria)||'Review the AI-generated completion criterion.'}`].join('\n')).join('\n\n'),governance=plan.governance?`\n\nConsent layer · ${clean(plan.governance.realm||'anarchadia')}\n${clean(plan.governance.purpose)}`:'';
  return[authoredImportedPlan(plan)?`Imported and saved an externally authored Quest for “${clean(plan.title)}.”`:`I generated and saved a reviewable Quest for “${clean(plan.title)}.”`,'','Governing outcome',clean(plan.outcome),'',paths,governance,'','The Quest is in REVIEW. Inspect, revise, or explicitly activate it with the controls below.'].join('\n').trim();
}
function buildPlan(options={}){
  emit('civweave:quest-ai-generation-required',{surface:'intention-planner.buildPlan',text:clean(options?.text)});const error=new Error('Deterministic Quest construction is retired. Generate the Quest with the selected AI model.');error.code='QUEST_AI_AUTHORING_REQUIRED';throw error;
}
function maybeCreate(options={}){
  if(shouldCreate(options))emit('civweave:quest-ai-generation-required',{surface:'intention-planner.maybeCreate',text:clean(options?.text)});return null;
}

globalThis.CivweaveIntentionPlanner={version:VERSION,schema:PLAN_SCHEMA,triggers:{explicit:EXPLICIT_PLAN_TRIGGER,wish:WISH_TRIGGER,direct:DIRECT_INTENTION_TRIGGER,retry:RETRY_TRIGGER,correction:CORRECTION_TRIGGER},stripGreeting,projectIntent,shouldCreate,activeIntentionTurns,aiAuthoredPlan,authoredImportedPlan,buildPlan,maybeCreate,persist,restore,abandon,format,deterministicQuestCreation:false,aiQuestOnly:true};
emit('civweave:intention-planner-ready',{aiQuestOnly:true,deterministicQuestCreation:false});
})();
