export const CONTRACT_VERSION = "civweave.cerbanimo-project.v1";
export const PROJECT_STATES = new Set([
  "not-started","drafting","ready-to-submit","sending","submitted","under-review",
  "revision-requested","accepted","rejected","handoff-failed","integration-unavailable"
]);
export const RECEIPT_TYPES = new Set([
  "civweave:project-handoff-accepted","civweave:project-handoff-rejected",
  "civweave:project-created","civweave:project-linked","civweave:project-status-returned",
  "civweave:project-evidence-submitted","civweave:project-review-pending",
  "civweave:project-revision-requested","civweave:project-accepted",
  "civweave:project-rejected","civweave:project-unavailable",
  "civweave:project-integration-error"
]);
export const RECEIPT_EVENTS = new Set([
  "handoff-accepted","handoff-rejected","project-created","project-linked","status-returned",
  "evidence-submitted","review-pending","revision-requested","project-accepted","project-rejected",
  "project-unavailable","integration-error"
]);
const DEFAULTS={
  "civweave:project-handoff-accepted":{event:"handoff-accepted",status:"submitted"},
  "civweave:project-handoff-rejected":{event:"handoff-rejected",status:"rejected"},
  "civweave:project-created":{event:"project-created",status:"submitted"},
  "civweave:project-linked":{event:"project-linked",status:"submitted"},
  "civweave:project-status-returned":{event:"status-returned"},
  "civweave:project-evidence-submitted":{event:"evidence-submitted",status:"under-review"},
  "civweave:project-review-pending":{event:"review-pending",status:"under-review"},
  "civweave:project-revision-requested":{event:"revision-requested",status:"revision-requested"},
  "civweave:project-accepted":{event:"project-accepted",status:"accepted"},
  "civweave:project-rejected":{event:"project-rejected",status:"rejected"},
  "civweave:project-unavailable":{event:"project-unavailable",status:"integration-unavailable"},
  "civweave:project-integration-error":{event:"integration-error",status:"integration-unavailable"}
};
const ID=/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,159}$/;
const clean=(value,limit=160)=>String(value??"").trim().slice(0,limit);
const cleanId=(value,fallback="")=>{const result=clean(value,160);return ID.test(result)?result:fallback};
const revision=value=>{const number=Number(value);return Number.isInteger(number)&&number>=0?Math.min(number,Number.MAX_SAFE_INTEGER):0};
export function normalizeProjectStatus(value){
  const status=clean(value,80).toLowerCase().replaceAll("_","-");
  return PROJECT_STATES.has(status)?status:"integration-unavailable";
}
export function createProjectHandoffRequest({requestId,schoolId,moduleId="final-project",learnerId,projectRef,title,creativeIntention,project}){
  const request={
    type:"civweave:project-handoff-requested",contractVersion:CONTRACT_VERSION,
    requestId:cleanId(requestId),schoolId:cleanId(schoolId),moduleId:cleanId(moduleId,"final-project"),
    learnerId:cleanId(learnerId,"local-learner"),projectRef:cleanId(projectRef),timestamp:new Date().toISOString(),
    sourceApplication:"living-school",title:clean(title,220)||"Living School final project",
    creativeIntention:clean(creativeIntention,4000),project:project&&typeof project==="object"&&!Array.isArray(project)?project:null
  };
  if(!request.requestId||!request.schoolId||!request.projectRef||!request.project)throw new Error("The Cerbanimo handoff is missing a valid request, school, project reference, or project packet.");
  return request;
}
export function createProjectStatusRequest({requestId,schoolId,moduleId="final-project",learnerId,projectRef}){
  const request={
    type:"civweave:project-status-requested",contractVersion:CONTRACT_VERSION,
    requestId:cleanId(requestId),schoolId:cleanId(schoolId),moduleId:cleanId(moduleId,"final-project"),
    learnerId:cleanId(learnerId,"local-learner"),projectRef:cleanId(projectRef),timestamp:new Date().toISOString(),sourceApplication:"living-school"
  };
  if(!request.requestId||!request.schoolId||!request.projectRef)throw new Error("The Cerbanimo status request is missing a valid request, school, or project reference.");
  return request;
}
export function normalizeProjectReceipt(payload={}){
  if(!payload||typeof payload!=="object"||Array.isArray(payload))return null;
  if(payload.contractVersion!==CONTRACT_VERSION)return null;
  const type=String(payload.type||"");
  if(!RECEIPT_TYPES.has(type))return null;
  const requestId=cleanId(payload.requestId),schoolId=cleanId(payload.schoolId),projectRef=cleanId(payload.projectRef);
  if(!requestId||!schoolId||!projectRef)return null;
  const defaults=DEFAULTS[type]||{};
  const suppliedEvent=clean(payload.event,80).toLowerCase();
  const event=RECEIPT_EVENTS.has(suppliedEvent)?suppliedEvent:defaults.event||"status-returned";
  const status=payload.status?normalizeProjectStatus(payload.status):defaults.status||"integration-unavailable";
  if(status==="accepted"&&!payload.demo&&!payload.reviewId&&!payload.evidenceRef&&!payload.acceptedAt)return null;
  let projectUrl="";
  try{const base=globalThis.location?.href||"https://civweave.local/";const url=new URL(String(payload.projectUrl||""),base);if(["http:","https:"].includes(url.protocol))projectUrl=url.href;}catch{}
  const acknowledgedAt=clean(payload.acknowledgedAt,80)||new Date().toISOString();
  const statusRevision=revision(payload.statusRevision);
  const receiptId=cleanId(payload.receiptId)||cleanId(`receipt:${projectRef}:${status}:${statusRevision}`,`receipt:${projectRef}`);
  return{
    type,event,receiptId,statusRevision,contractVersion:CONTRACT_VERSION,requestId,schoolId,
    moduleId:cleanId(payload.moduleId,"final-project"),learnerId:cleanId(payload.learnerId,"local-learner"),projectRef,
    status,detail:clean(payload.detail,1800)||"Cerbanimo returned a project update.",projectId:cleanId(payload.projectId),
    projectUrl,proposalId:cleanId(payload.proposalId),questId:cleanId(payload.questId),reviewId:cleanId(payload.reviewId),
    evidenceRef:cleanId(payload.evidenceRef),reviewFeedback:clean(payload.reviewFeedback,2400),acceptedAt:clean(payload.acceptedAt,80),
    acknowledgedAt,lastEventAt:clean(payload.lastEventAt,80)||acknowledgedAt,demo:Boolean(payload.demo)
  };
}
export function receiptUnlocksFinalTest(receipt){return Boolean(receipt&&receipt.status==="accepted"&&(receipt.demo||receipt.reviewId||receipt.evidenceRef||receipt.acceptedAt));}
export function sameReceipt(left,right){
  if(!left||!right)return false;
  if(left.receiptId&&right.receiptId)return left.receiptId===right.receiptId;
  return left.projectRef===right.projectRef&&left.status===right.status&&Number(left.statusRevision||0)===Number(right.statusRevision||0)&&left.acknowledgedAt===right.acknowledgedAt;
}
export function receiptIsNewer(receipt,previous){
  if(!previous)return true;
  if(sameReceipt(receipt,previous))return false;
  const nextRevision=Number(receipt?.statusRevision||0),previousRevision=Number(previous?.statusRevision||0);
  if(nextRevision!==previousRevision)return nextRevision>previousRevision;
  return Date.parse(receipt?.lastEventAt||receipt?.acknowledgedAt||0)>=Date.parse(previous?.lastEventAt||previous?.acknowledgedAt||0);
}
