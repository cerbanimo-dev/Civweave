import {assessHateSpeech} from './anarchadia-hate-speech-v1.js';
import {openTribunalCase,assignJury,publishTribunalToMesh} from './anarchadia-tribunal-v1.js';
import {sha256} from './anarchadia-governance-kernel-v145.js';

export const PUBLIC_MODERATION_SCHEMA='civweave.anarchadia.public-chat-moderation.v1';

export async function moderatePublicChatMessage(input={},options={}){
  const text=String(input.text??input.message??'');if(!text.trim())return {schema:PUBLIC_MODERATION_SCHEMA,flagged:false,reason:'empty-message'};
  const assessment=await assessHateSpeech(text,{languages:options.languages||['en','ja'],threshold:options.threshold,useMiniLM:options.useMiniLM!==false,ranker:options.ranker,contextClassifier:options.contextClassifier});
  const messageHash=await sha256(text),contextHash=input.context?await sha256(typeof input.context==='string'?input.context:JSON.stringify(input.context)):null;
  const result={schema:PUBLIC_MODERATION_SCHEMA,flagged:assessment.matches.length>0,assessment,messageHash,contextHash,caseRecord:null};
  if(!assessment.tribunalEligible)return result;
  await options.evidenceVault?.put?.({messageHash,contextHash,text,context:input.context,access:'tribunal-only'});
  const caseRecord=await openTribunalCase({assessment,accusedActorId:input.actorId,affectedActorIds:input.affectedActorIds||[],regionId:input.regionId||'local',procedure:options.procedure,evidence:[{id:`message:${messageHash.slice(0,24)}`,kind:'public-chat-message',hash:messageHash,contextHash}]});
  if(options.juryCandidates?.length)assignJury(caseRecord,options.juryCandidates,{rng:options.rng});
  result.caseRecord=caseRecord;
  try{globalThis.dispatchEvent?.(new CustomEvent('civweave:anarchadia-tribunal-candidate',{detail:{caseRecord,assessment,messageHash}}))}catch{}
  if(options.publishMesh)result.mesh=await publishTribunalToMesh(caseRecord,{mesh:options.mesh,consent:options.meshConsent||'federated'});
  return result;
}
