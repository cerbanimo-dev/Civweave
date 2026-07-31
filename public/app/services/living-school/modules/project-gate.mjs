export const PROJECT_GATE_SCHEMA="living-school-project-gate-1.2";
export const PROJECT_GATE_STATES=new Set([
  "not-started","drafting","ready-to-submit","sending","submitted","under-review",
  "revision-requested","accepted","rejected","handoff-failed","integration-unavailable"
]);
const TERMINAL_TRANSPORT=new Set(["handoff-failed","integration-unavailable"]);
export function defaultProjectGate(){
  return {schema:PROJECT_GATE_SCHEMA,status:"not-started",projectRef:"",projectId:"",projectUrl:"",brief:null,history:[],updatedAt:null,requestId:"",pendingSince:null,submittedAt:null,lastCheckedAt:null,lastReceipt:null,sendAttempts:0,transportState:"idle",lastRefreshError:"",lastRefreshRequestId:"",receiptIds:[],statusRevision:0};
}
export function normalizeProjectGate(saved={},now=Date.now()){
  const gate={...defaultProjectGate(),...(saved&&typeof saved==="object"&&!Array.isArray(saved)?saved:{})};
  gate.schema=PROJECT_GATE_SCHEMA;
  let status=String(gate.status||"not-started").toLowerCase().replaceAll("_","-");
  if(status==="closed")status="rejected";
  if(!PROJECT_GATE_STATES.has(status))status=gate.submittedAt?"submitted":"not-started";
  if(status==="accepted"&&!gate.lastReceipt?.demo&&!gate.lastReceipt?.reviewId&&!gate.lastReceipt?.evidenceRef&&!gate.lastReceipt?.acceptedAt){
    status=gate.submittedAt?"submitted":"integration-unavailable";
    gate.lastRefreshError="An older saved project was marked accepted without an authoritative Cerbanimo review receipt. Acceptance must be verified again.";
  }
  if(status==="sending"&&gate.pendingSince&&now-Date.parse(gate.pendingSince)>45000){
    status="handoff-failed";
    gate.lastRefreshError="The previous handoff did not receive an acknowledgement before Living School reopened.";
  }
  gate.status=status;
  gate.history=Array.isArray(gate.history)?gate.history.slice(-60):[];
  gate.receiptIds=Array.isArray(gate.receiptIds)?[...new Set(gate.receiptIds.map(String))].slice(-80):[];
  gate.statusRevision=Math.max(0,Number.isFinite(Number(gate.statusRevision))?Number(gate.statusRevision):0);
  gate.sendAttempts=Math.max(0,Number.isFinite(Number(gate.sendAttempts))?Number(gate.sendAttempts):0);
  gate.transportState=["idle","sending","refreshing","failed"].includes(gate.transportState)?gate.transportState:(status==="sending"?"sending":TERMINAL_TRANSPORT.has(status)?"failed":"idle");
  return gate;
}
export function canUnlockFinalTest(gate){
  const receipt=gate?.lastReceipt;
  return Boolean(gate?.status==="accepted"&&receipt&&(receipt.demo||receipt.reviewId||receipt.evidenceRef||receipt.acceptedAt));
}
export function applyReceipt(gateInput,receipt,now=new Date().toISOString()){
  const gate=normalizeProjectGate(gateInput);
  if(!receipt||!receipt.receiptId)return {gate,changed:false,reason:"invalid-receipt"};
  if(gate.receiptIds.includes(receipt.receiptId))return {gate,changed:false,reason:"duplicate-receipt"};
  const currentRevision=Number(gate.statusRevision||0),nextRevision=Number(receipt.statusRevision||0);
  if(nextRevision<currentRevision)return {gate,changed:false,reason:"stale-receipt"};
  const status=PROJECT_GATE_STATES.has(receipt.status)?receipt.status:"integration-unavailable";
  const isRefreshFailure=["project-unavailable","integration-error"].includes(receipt.event)&&gate.status!=="sending"&&["submitted","under-review","revision-requested","accepted","rejected"].includes(gate.status);
  gate.receiptIds=[...gate.receiptIds,receipt.receiptId].slice(-80);
  gate.lastCheckedAt=receipt.acknowledgedAt||now;
  gate.lastRefreshRequestId=receipt.requestId||gate.lastRefreshRequestId;
  gate.transportState="idle";
  if(isRefreshFailure){
    gate.lastRefreshError=receipt.detail||"Cerbanimo status could not be refreshed. The last authoritative status was preserved.";
    gate.updatedAt=now;
    gate.history.push({id:`gate-${Date.now()}-refresh`,status:gate.status,note:gate.lastRefreshError,at:now,requestId:receipt.requestId||"",event:receipt.event,transportOnly:true});
    return {gate,changed:true,reason:"refresh-failure-preserved"};
  }
  gate.status=status;
  gate.statusRevision=Math.max(currentRevision,nextRevision);
  gate.lastReceipt=receipt;
  gate.lastRefreshError="";
  gate.requestId=receipt.requestId||gate.requestId;
  gate.projectRef=receipt.projectRef||gate.projectRef;
  gate.projectId=receipt.projectId||gate.projectId;
  gate.projectUrl=receipt.projectUrl||gate.projectUrl;
  if(["submitted","under-review","revision-requested","accepted","rejected"].includes(status))gate.submittedAt=gate.submittedAt||receipt.acknowledgedAt||now;
  gate.pendingSince=null;
  gate.updatedAt=now;
  gate.history.push({id:`gate-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,status,note:receipt.detail||"Cerbanimo returned a project update.",at:now,requestId:receipt.requestId||"",event:receipt.event,receiptId:receipt.receiptId});
  gate.history=gate.history.slice(-60);
  return {gate,changed:true,reason:"applied"};
}
