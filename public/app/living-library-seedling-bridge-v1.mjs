import {livingSchoolPlan,guildBundle,validateDraft,externalUrl} from './living-library-seedling-core-v1.mjs';

export const REVIEW_PLAN_KEY='civweave.chat.capability.pending.living-school.plan.v1';
export const EVIDENCE_PREFIX='civweave.seedling.living-school-evidence.v1.';
export const STAGED_KEY='civweave.seedling.staged-plan.v1';
const clean=(v,n=3000)=>String(v??'').trim().slice(0,n);
const parse=(v)=>{try{return JSON.parse(v)}catch{return null}};
const safeArray=(a,max)=>Array.isArray(a)?a.slice(0,max):[];
const fields=['title','focus','outcome'];
function assertReviewPlan(plan){
 if(plan?.schema!=='civweave.learning-journey-plan.v2'||plan.state!=='review'||plan.approvedAt!=null||plan.requiresExplicitApproval!==true)throw Error('Only an unapproved Living School v2 REVIEW plan can be staged.');
 const r=plan.request||{},mods=plan.modules;
 if(!clean(plan.id,180)||clean(r.title,240).length<3||clean(r.capability,2400).length<8||clean(r.proof,3000).length<8)throw Error('The plan is missing the title, learning goal, proof or ID.');
 if(!Array.isArray(mods)||mods.length<3||mods.length>8||mods.some(m=>fields.some(k=>!clean(m?.[k],900))))throw Error('The plan must have 3–8 complete modules.');
 if(Number(r.count)!==mods.length||!Array.isArray(r.outline)||r.outline.length!==mods.length)throw Error('The plan outline/count does not match its modules.');
 return plan;
}
export function validateSubmission(bundle){
 if(bundle?.schema!=='civweave.seedling.guild-learning-submission.v1'||bundle.status!=='review-requested'||bundle.userApprovalRequired!==true)throw Error('This is not a Seedling Guild review submission.');
 const plan=assertReviewPlan(bundle.plan);
 if(bundle.kind!=='learning-journey-plan'||bundle.sourceSystem!=='living-school')throw Error('The submission is not a Living School Learning Journey.');
 if(!Array.isArray(bundle.sourceCatalog)||bundle.sourceCatalog.length>40||!Array.isArray(bundle.mediaCatalog)||bundle.mediaCatalog.length>28)throw Error('Invalid supporting materials.');
 for(const s of bundle.sourceCatalog)if(!externalUrl(s.url))throw Error('Unsafe or missing source URL.');
 for(const m of bundle.mediaCatalog)if(!externalUrl(m.url)||!['image','video'].includes(m.kind))throw Error('Invalid image or video metadata.');
 return plan;
}
export function stageBundleForReview(bundle,{storage=localStorage,replace=false,origin='manual-editor'}={}){
 const plan=validateSubmission(bundle);
 const active=parse(storage.getItem(REVIEW_PLAN_KEY));
 if(active?.id&&active.state!=='denied'&&active.state!=='revision-requested'&&(active.id!==plan.id||active.state!=='review')&&!replace){
  throw new Error('Another Living School plan is awaiting review or approval. Export it or explicitly replace it first.');
 }
 if(active?.state==='approved')throw new Error('An approved Living School plan cannot be replaced through Seedling. Complete or discard it in Moss first.');
 const existingEvidence=parse(storage.getItem(EVIDENCE_PREFIX+plan.id));
 const evidence={
  schema:'civweave.seedling.learning-journey-evidence.v1',planId:plan.id,bundleId:clean(bundle.id,180),guildId:clean(bundle.guildId,180)||null,origin:clean(origin,100),
  importedAt:new Date().toISOString(),
  sourceCatalog:safeArray(bundle.sourceCatalog,40),mediaCatalog:safeArray(bundle.mediaCatalog,28),
  independentVerificationRequired:true,mediaDownloadsIncluded:false
 };
 const previousPlan=storage.getItem(REVIEW_PLAN_KEY),previousEvidence=storage.getItem(EVIDENCE_PREFIX+plan.id),previousStaged=storage.getItem(STAGED_KEY);
 try {
  // Save supporting evidence first; only then publish a plan for Moss to review.
  storage.setItem(EVIDENCE_PREFIX+plan.id,JSON.stringify(evidence));
  storage.setItem(REVIEW_PLAN_KEY,JSON.stringify(plan));
  storage.setItem(STAGED_KEY,JSON.stringify({schema:'civweave.seedling.staged-review.v1',planId:plan.id,source:origin,stagedAt:evidence.importedAt}));
  const persisted=parse(storage.getItem(REVIEW_PLAN_KEY));
  if(persisted?.id!==plan.id||persisted.state!=='review')throw new Error('Living School review storage did not retain the plan.');
 }catch(error){
  for(const [key,value] of [[REVIEW_PLAN_KEY,previousPlan],[EVIDENCE_PREFIX+plan.id,previousEvidence],[STAGED_KEY,previousStaged]])try{value==null?storage.removeItem(key):storage.setItem(key,value)}catch{}
  throw error;
 }
 try{globalThis.dispatchEvent?.(new CustomEvent('civweave:living-school-pending-plan-review',{detail:{id:plan.id,state:'review',capability:plan.request.capability,source:'seedling'}}))}catch{}
 return {planId:plan.id,planTitle:plan.request.title,sourceCount:evidence.sourceCatalog.length,mediaCount:evidence.mediaCatalog.length,previousEvidence:existingEvidence?.importedAt||null,state:'review'};
}
export function stageManualDraft(draft,options={}){
 const errors=validateDraft(draft);if(errors.length)throw new Error(errors.join(' '));
 return stageBundleForReview(guildBundle(draft),{...options,origin:'manual-editor'});
}
export function evidenceForPlan(planId,{storage=localStorage}={}){
 const data=parse(storage.getItem(EVIDENCE_PREFIX+clean(planId,180)));
 return data?.schema==='civweave.seedling.learning-journey-evidence.v1'&&data.planId===planId?data:null;
}
