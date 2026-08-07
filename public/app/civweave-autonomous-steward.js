(()=>{
'use strict';
const VERSION='1.0.0-rc22.0';
const CLARIFY_KEY='civweave.steward.clarifications.v1';
const POLICY_KEY='civweave.steward.intention-policies.v1';
const CHECKIN_KEY='civweave.steward.checkins.v1';
const MERGE_KEY='civweave.steward.structure-proposals.v1';
const safe=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f))}catch{return f}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const clone=v=>JSON.parse(JSON.stringify(v));
const now=()=>new Date().toISOString();
const uid=p=>`${p}-${crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const text=v=>String(v??'').replace(/\s+/g,' ').trim();
const IO=()=>window.CivweaveIntentionOrchestrator;
const MS=()=>window.CivweaveModelSteward;
const SA=()=>window.CivweaveStewardActions;
const SS=()=>window.CivweaveStrategySteward;
const AP=()=>window.CivweaveAdaptivePlan;
const LD=()=>window.CivweaveLiveData;
const AQ=()=>window.CivweaveActionableQuad;
function clarifications(){return safe(CLARIFY_KEY,[])}
function saveClarification(c){const all=clarifications().filter(x=>x.id!==c.id);all.unshift(c);save(CLARIFY_KEY,all.slice(0,100));dispatchEvent(new CustomEvent('civweave:clarification-updated',{detail:clone(c)}));return clone(c)}
function openClarification(request,one=IO()?.active?.()){
 const questions=SA()?.clarifyNeeded?.(request,one)||[];
 if(!questions.length)return null;
 const existing=clarifications().find(x=>x.intentionId===one?.id&&x.request===text(request)&&x.status==='awaiting-answers');
 if(existing)return clone(existing);
 return saveClarification({id:uid('clarification'),intentionId:one?.id||null,request:text(request),questions,answers:{},status:'awaiting-answers',createdAt:now(),updatedAt:now()});
}
function answerClarification(id,index,answer){const c=clarifications().find(x=>x.id===id);if(!c)return null;c.answers[String(index)]=text(answer);c.updatedAt=now();return saveClarification(c)}
function inferredConstraint(question,answer){const q=text(question).toLowerCase();if(/date|time window|deadline/.test(q))return ['deadline',answer];if(/budget|cost/.test(q))return ['budget',answer];if(/accessibility|energy limits/.test(q))return ['accessibility',answer];if(/available|assigned/.test(q))return ['teamAvailability',answer];return [null,null]}
function applyAnswersToIntention(c){const one=IO()?.list?.().find(x=>x.id===c.intentionId);if(!one)return null;const patch={...(one.constraints||{})};c.questions.forEach((q,i)=>{const a=c.answers[String(i)];if(!a)return;const [k,v]=inferredConstraint(q,a);if(k)patch[k]=v});
 const proposal=IO()?.proposalFor?.(one.id,{constraints:patch},'Use the user’s clarification answers as planning constraints.','Apply clarification constraints');
 c.constraintProposalId=proposal?.id||null;c.status='answered';c.updatedAt=now();saveClarification(c);return proposal;
}
async function resolveClarification(id){const c=clarifications().find(x=>x.id===id);if(!c)return {ok:false,error:'Clarification session not found.'};const missing=c.questions.filter((_,i)=>!text(c.answers[String(i)]));if(missing.length)return {ok:false,error:`${missing.length} clarification answer${missing.length===1?' is':'s are'} still missing.`};applyAnswersToIntention(c);const one=IO()?.list?.().find(x=>x.id===c.intentionId)||IO()?.active?.();const suffix=c.questions.map((q,i)=>`${q} ${c.answers[String(i)]}`).join(' ');const result=await MS()?.replan?.(`${c.request}\nClarifications: ${suffix}`,one,{clarificationId:c.id});if(result?.ok){c.status='resolved';c.modelSessionId=result.session.id;c.updatedAt=now();saveClarification(c)}return result||{ok:false,error:'The structured replanner is unavailable.'};
}
function preflight(request,one=IO()?.active?.()){
 if(!MS()?.needsModel?.(request)||!one)return null;
 const c=openClarification(request,one);
 if(!c)return null;
 return {kind:'clarification',summary:'I need a few constraints before I compare routes.',clarification:clone(c),intention:clone(one)};
}
function policies(){return safe(POLICY_KEY,{})}
function policy(intentionId=IO()?.active?.()?.id){const global=SA()?.notificationPolicy?.()||{};return {...global,severity:4,notifyOn:['deadline','blocker','approval','conflict'],checkinCadenceHours:24,enabled:true,...(policies()[intentionId]||{})}}
function setPolicy(intentionId,patch){const all=policies();all[intentionId]={...policy(intentionId),...clone(patch||{}),updatedAt:now()};save(POLICY_KEY,all);return clone(all[intentionId])}
function intentionSnapshot(one){const strategy=SS()?.snapshot?.(one)||{},adaptive=AP()?.snapshot?.(one)||{};const risks=[...(strategy.escalations||[]),...(adaptive.conflicts||[]).map(x=>({kind:'conflict',priority:5,message:x.message||x.title}))];return {one,strategy,adaptive,risks}}
function shouldContact(one){const p=policy(one.id);if(!p.enabled)return {contact:false,reasons:[]};const {strategy,adaptive,risks}=intentionSnapshot(one),reasons=[];for(const r of risks){if(Number(r.priority||0)>=Number(p.severity||4)&&p.notifyOn.includes(r.kind||'blocker'))reasons.push(r.message||r.title||r.kind)}if(strategy.forecast?.atRisk&&p.notifyOn.includes('deadline'))reasons.push('Forecast indicates deadline risk.');if((adaptive.graph?.nodes||[]).some(n=>n.status==='review')&&p.notifyOn.includes('approval'))reasons.push('A plan step is awaiting review.');return {contact:reasons.length>0,reasons:[...new Set(reasons)]}}
function checkins(){return safe(CHECKIN_KEY,[])}
function createCheckin(one,{force=false}={}){if(!one)return null;const gate=shouldContact(one),p=policy(one.id),all=checkins();const latest=all.find(x=>x.intentionId===one.id);if(!force&&!gate.contact)return null;if(!force&&latest&&Date.now()-new Date(latest.createdAt).getTime()<Number(p.checkinCadenceHours||24)*3600000)return null;const brief=MS()?.executiveBrief?.(one)||null;const item={id:uid('checkin'),intentionId:one.id,title:one.title,severity:Math.max(0,...(brief?.risks||[]).map(x=>Number(x.priority||0))),reasons:gate.reasons,brief,status:'delivered',createdAt:now()};all.unshift(item);save(CHECKIN_KEY,all.slice(0,200));AQ()?.addMessage?.('assistant',`Steward check-in for “${one.title}”: ${gate.reasons.join(' ')||brief?.state?.summary||'A scheduled review is ready.'}`,{intentionId:one.id,checkinId:item.id});dispatchEvent(new CustomEvent('civweave:executive-checkin',{detail:clone(item)}));return clone(item)}
function gapCandidates(one=IO()?.active?.()){
 if(!one)return [];
 const snap=SS()?.snapshot?.(one)||{},queries=[];
 for(const x of snap.gaps?.resources||[])queries.push({gap:'resource',query:x.resource||x.title||x});
 for(const x of snap.gaps?.owners||[])queries.push({gap:'owner',query:x.title||x.stepTitle||'available collaborator'});
 for(const x of snap.gaps?.skills||[])queries.push({gap:'skill',query:x.skill||x.title||x});
 const results=[];
 for(const q of queries.slice(0,10)){for(const r of (LD()?.search?.(text(q.query))||[]).slice(0,4))results.push({...r,gap:q.gap,matchedQuery:text(q.query)})}
 const seen=new Set();return results.filter(r=>{const k=`${r.system}:${r.id}`;if(seen.has(k))return false;seen.add(k);return true}).slice(0,20);
}
function stageGapCandidate(intentionId,recordId,stepId=''){const r=LD()?.records?.find(x=>x.id===recordId);if(!r)return null;return AQ()?.stage?.({target:r.system||'civweave',action:'link-gap-candidate',title:`Link ${r.title} to intention`,sourceRecord:r,payload:{intentionId,stepId,candidate:{id:r.id,title:r.title,type:r.type,system:r.system,deepLink:r.deepLink},reviewRequired:true}})}
function similarity(a,b){const tokens=s=>new Set(text(`${s.title} ${s.intent}`).toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>3));const A=tokens(a),B=tokens(b),inter=[...A].filter(x=>B.has(x)).length,union=new Set([...A,...B]).size;return union?inter/union:0}
function structuralSuggestions(){const list=IO()?.list?.()||[],out=[];for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const score=similarity(list[i],list[j]);if(score>=.32)out.push({id:uid('structure'),kind:'merge',intentionIds:[list[i].id,list[j].id],title:`Merge “${list[i].title}” and “${list[j].title}”`,reason:`The intentions share ${Math.round(score*100)}% of their meaningful language.`,score,status:'suggested',createdAt:now()})}for(const one of list){const steps=one.steps||[],roots=steps.filter(s=>!(s.dependsOn||[]).length);const systems=new Set(steps.map(s=>s.system).filter(Boolean));if(roots.length>=3&&systems.size>=3)out.push({id:uid('structure'),kind:'split',intentionIds:[one.id],title:`Consider splitting “${one.title}”`,reason:`It has ${roots.length} independent roots across ${systems.size} systems.`,score:Math.min(1,roots.length/6),status:'suggested',createdAt:now()})}save(MERGE_KEY,out.slice(0,100));return clone(out)}
function prepareStructure(id){const s=safe(MERGE_KEY,[]).find(x=>x.id===id);if(!s)return null;const list=IO()?.list?.()||[];if(s.kind==='merge'){const selected=s.intentionIds.map(id=>list.find(x=>x.id===id)).filter(Boolean);return IO()?.proposalFor?.(selected[0]?.id,{mergeIntentions:s.intentionIds},s.reason,s.title)}const one=list.find(x=>x.id===s.intentionIds[0]);return IO()?.proposalFor?.(one?.id,{splitIntention:{strategy:'independent-root-branches'}},s.reason,s.title)}
function reconcileBatchToPlan(batchId){const batch=SA()?.reconcileBatches?.().find(x=>x.id===batchId);if(!batch)return null;const committed=batch.actions.filter(a=>['committed','approved','completed'].includes(a.status));const rejected=batch.actions.filter(a=>['rejected','rolled-back','superseded'].includes(a.status));if(!committed.length&&!rejected.length)return null;return IO()?.proposalFor?.(batch.intentionId,{reconcileAmendmentBatch:{batchId,acceptedStepIds:committed.map(x=>x.stepId),rejectedStepIds:rejected.map(x=>x.stepId)}},'Reconcile destination responses from a coordinated amendment batch.','Reconcile destination amendment responses')}
function dashboard(){const list=IO()?.list?.()||[],structures=structuralSuggestions();return {version:VERSION,intentions:list.map(one=>{const snap=intentionSnapshot(one),contact=shouldContact(one),candidates=gapCandidates(one);return {id:one.id,title:one.title,status:one.status,progress:one.health?.progress||0,summary:one.health?.summary||'',forecast:snap.strategy.forecast||null,risks:snap.risks.slice(0,8),nextDecision:(snap.adaptive.conflicts||[])[0]?.message||(snap.strategy.escalations||[])[0]?.message||'',policy:policy(one.id),contact,candidates:candidates.slice(0,6),lastCheckin:checkins().find(x=>x.intentionId===one.id)||null}}),structures,clarifications:clarifications().filter(x=>x.status==='awaiting-answers'),batches:SA()?.reconcileBatches?.()||[],checkins:checkins()};}
function tick(){for(const one of IO()?.list?.()||[])createCheckin(one);}
window.CivweaveAutonomousSteward={VERSION,clarifications,openClarification,answerClarification,resolveClarification,preflight,policies,policy,setPolicy,shouldContact,checkins,createCheckin,gapCandidates,stageGapCandidate,structuralSuggestions,prepareStructure,reconcileBatchToPlan,dashboard,tick};
setInterval(tick,60000);setTimeout(tick,5000);
})();
