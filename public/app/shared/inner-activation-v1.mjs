/**
 * Author-side fictional activation controls. A reaction is a bounded self-report,
 * never a tool command or a clinical judgment. Front switches take effect only
 * at turn boundaries. Every layer remains subject to its existing permissions.
 */
export const TRIGGER_SCHEMA='civweave.inner-activation.v1';
export const TRIGGER_POLICY=Object.freeze({
 enabled:true,baseline:10,threshold:70,releaseThreshold:32,
 perTurnDecay:12,maxRisePerTurn:35,maxFallPerTurn:25,
 maxFrontTurns:3,cooldownTurns:2
});
export const TRIGGER_IDS=Object.freeze(['child','teen','adult']);
const integer=(x,lo,hi,f)=>Number.isFinite(Number(x))?Math.max(lo,Math.min(hi,Math.round(Number(x)))):f;
export function normalizeTriggerPolicy(input={}){
 const source=input&&typeof input==='object'?input:{};
 const policy={
  enabled:source.enabled!==false,
  baseline:integer(source.baseline,0,40,TRIGGER_POLICY.baseline),
  threshold:integer(source.threshold,55,95,TRIGGER_POLICY.threshold),
  releaseThreshold:integer(source.releaseThreshold,0,54,TRIGGER_POLICY.releaseThreshold),
  perTurnDecay:integer(source.perTurnDecay,1,35,TRIGGER_POLICY.perTurnDecay),
  maxRisePerTurn:integer(source.maxRisePerTurn,1,35,TRIGGER_POLICY.maxRisePerTurn),
  maxFallPerTurn:integer(source.maxFallPerTurn,1,35,TRIGGER_POLICY.maxFallPerTurn),
  maxFrontTurns:integer(source.maxFrontTurns,1,12,TRIGGER_POLICY.maxFrontTurns),
  cooldownTurns:integer(source.cooldownTurns,0,12,TRIGGER_POLICY.cooldownTurns)
 };
 if(policy.releaseThreshold>=policy.threshold)throw new TypeError('Trigger release must be below its activation threshold.');
 return Object.freeze(policy);
}
export function initialTriggerState(homeFront='adult',policy=TRIGGER_POLICY){
 if(!TRIGGER_IDS.includes(homeFront))throw new TypeError('Unknown home front.');
 const normalized=normalizeTriggerPolicy(policy);
 return {schema:TRIGGER_SCHEMA,homeFront,frontAgentId:homeFront,temporaryFront:null,
  activation:Object.fromEntries(TRIGGER_IDS.map(id=>[id,normalized.baseline])),
  turnsAtFront:0,cooldownRemaining:0,turn:0};
}
export function normalizeTriggerState(source,homeFront='adult',policy=TRIGGER_POLICY){
 const result=initialTriggerState(homeFront,policy);
 if(!source||source.schema!==TRIGGER_SCHEMA)return result;
 result.activation=Object.fromEntries(TRIGGER_IDS.map(id=>[id,integer(source.activation?.[id],0,100,result.activation[id])]));
 result.turnsAtFront=integer(source.turnsAtFront,0,12,0);
 result.cooldownRemaining=integer(source.cooldownRemaining,0,12,0);
 result.turn=integer(source.turn,0,1e9,0);
 result.temporaryFront=TRIGGER_IDS.includes(source.temporaryFront)&&source.temporaryFront!==homeFront?source.temporaryFront:null;
 result.frontAgentId=result.temporaryFront||homeFront;
 return result;
}
export function advanceTriggerState(previous,{reactions={},enabled=TRIGGER_IDS,policy=TRIGGER_POLICY}={}){
 const p=normalizeTriggerPolicy(policy);
 const current=normalizeTriggerState(previous,previous?.homeFront||'adult',p);
 const eligible=new Set(Array.isArray(enabled)?enabled.filter(x=>TRIGGER_IDS.includes(x)):[]);
 const before=current.frontAgentId;
 const next={...current,activation:{...current.activation},turn:current.turn+1};
 if(next.cooldownRemaining>0)next.cooldownRemaining--;
 for(const id of TRIGGER_IDS){
  const raw=typeof reactions[id]==='object'?reactions[id]?.delta:reactions[id];
  const delta=integer(raw,-p.maxFallPerTurn,p.maxRisePerTurn,0);
  next.activation[id]=eligible.has(id)?integer(next.activation[id]-p.perTurnDecay+delta,0,100,p.baseline):p.baseline;
 }
 if(!p.enabled){
  next.temporaryFront=null;next.frontAgentId=next.homeFront;next.turnsAtFront=0;
 }else if(next.temporaryFront){
  next.turnsAtFront++;
  if(!eligible.has(next.temporaryFront)||next.activation[next.temporaryFront]<=p.releaseThreshold||
     next.turnsAtFront>=p.maxFrontTurns){
   next.temporaryFront=null;next.frontAgentId=next.homeFront;next.turnsAtFront=0;
   next.cooldownRemaining=p.cooldownTurns;
  }
 }else if(next.cooldownRemaining===0){
  const candidates=[...eligible].filter(id=>id!==next.homeFront&&next.activation[id]>=p.threshold)
   .sort((a,b)=>next.activation[b]-next.activation[a]||TRIGGER_IDS.indexOf(a)-TRIGGER_IDS.indexOf(b));
  if(candidates.length){
   next.temporaryFront=candidates[0];next.frontAgentId=candidates[0];next.turnsAtFront=0;
  }
 }
 return {state:next,changed:before!==next.frontAgentId,
  transition:before===next.frontAgentId?'unchanged':next.temporaryFront?'temporary-front':'returned-home'};
}
export function manualFront(state,agentId,policy=TRIGGER_POLICY){
 if(!TRIGGER_IDS.includes(agentId))throw new TypeError('Unknown front layer.');
 const result=normalizeTriggerState(state,agentId,policy);
 result.homeFront=agentId;result.temporaryFront=null;result.frontAgentId=agentId;
 result.turnsAtFront=0;result.cooldownRemaining=normalizeTriggerPolicy(policy).cooldownTurns;
 return result;
}
