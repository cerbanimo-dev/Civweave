const SCHEMA='civweave.anarchadia-governance.v145';
const CHANGE_SCHEMA='civweave.anarchadia-change-set.v1';
const BALLOT_SCHEMA='civweave.anarchadia-ballot.v1';
const AUTH_SCHEMA='civweave.anarchadia-execution-authorization.v1';
const PACKET_SCHEMA='civweave.anarchadia-execution-packet.v1';
const CREDENTIAL_SCHEMA='civweave.anarchadia-credential.v1';
const OUTCOME_SCHEMA='civweave.anarchadia-node-outcome.v1';
const CONSENT_SCHEMA='civweave.anarchadia-consent.v1';
const DISSENT_SCHEMA='civweave.anarchadia-dissent.v1';
const INTENTION_SCHEMA='civweave.anarchadia-intention-plan.v1';
const CONSENSUS_SCHEMA='civweave.anarchadia-consensus-round.v1';
export const GOVERNANCE_VERSION='1.0.0';
export const CHOICES=['approve','reject','abstain','request-amendment'];
export const CONSENSUS_LEVELS=['individual','hub','region','mesh'];
export const CONSENSUS_CHOICES=['support','oppose','abstain','amend'];
export const CHANGE_STATES=['draft','rails-checked','deliberating','frozen','voting','outcome-declared','authorized','queued','prepared','released','verified','rolled-back','rejected','expired','withdrawn','contested'];
const TRANSITIONS={
  draft:['rails-checked','withdrawn'],
  'rails-checked':['deliberating','draft','withdrawn'],
  deliberating:['frozen','draft','withdrawn'],
  frozen:['voting','deliberating','withdrawn'],
  voting:['outcome-declared','contested','expired'],
  'outcome-declared':['authorized','rejected','contested'],
  authorized:['queued','expired','contested'],
  queued:['prepared','contested','expired'],
  prepared:['released','rolled-back','contested'],
  released:['verified','rolled-back','contested'],
  verified:['rolled-back'],
  contested:['deliberating','rolled-back','withdrawn']
};
const DENIED_PATHS=[/^\.git(?:\/|$)/i,/^node_modules(?:\/|$)/i,/^data(?:\/|$)/i,/(^|\/)\.env(?:\.|$)/i,/(^|\/)(?:secrets?|credentials?)(?:\/|\.|$)/i];
const ALLOWED_ROOTS=[/^public\//,/^scripts\//,/^server\//,/^tests?\//,/^package(?:-lock)?\.json$/,/^server[^/]*\.mjs$/,/^README(?:\.[^/]*)?$/];
const FORBIDDEN_CODE=[/\beval\s*\(/i,/new\s+Function\s*\(/i,/document\.cookie/i,/localStorage\.clear\s*\(/i,/window\.top\.location\s*=/i,/child_process\.(?:exec|execSync)\s*\(\s*[^)]*\+/i];
const encoder=new TextEncoder();
const now=()=>new Date().toISOString();
const id=prefix=>`${prefix}-${globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
const clone=value=>globalThis.structuredClone?globalThis.structuredClone(value):JSON.parse(JSON.stringify(value));
function normalized(value){
  if(Array.isArray(value))return value.map(normalized);
  if(value&&typeof value==='object'){
    const out={};
    for(const key of Object.keys(value).sort()){
      if(value[key]!==undefined)out[key]=normalized(value[key]);
    }
    return out;
  }
  return value;
}
export function canonicalJson(value){return JSON.stringify(normalized(value))}
function base64url(bytes){
  let binary='';for(const byte of new Uint8Array(bytes))binary+=String.fromCharCode(byte);
  const raw=typeof btoa==='function'?btoa(binary):Buffer.from(binary,'binary').toString('base64');
  return raw.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function fromBase64url(value){
  const padded=String(value).replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((String(value).length+3)%4);
  const binary=typeof atob==='function'?atob(padded):Buffer.from(padded,'base64').toString('binary');
  return Uint8Array.from(binary,char=>char.charCodeAt(0));
}
export async function sha256(value){
  const bytes=typeof value==='string'?encoder.encode(value):value;
  return base64url(await crypto.subtle.digest('SHA-256',bytes));
}
export function newGovernanceState(){
  return {schema:SCHEMA,version:GOVERNANCE_VERSION,node:null,credentials:[],groups:[],trustedNodes:[],intentionPlans:[],consensusRounds:[],changeSets:[],ballots:[],consents:[],dissents:[],nodeOutcomes:[],authorizations:[],executionPackets:[],audit:[]};
}
export function normalizeGovernanceState(input){
  const state=input?.schema===SCHEMA?clone(input):newGovernanceState();
  for(const key of ['credentials','groups','trustedNodes','intentionPlans','consensusRounds','changeSets','ballots','consents','dissents','nodeOutcomes','authorizations','executionPackets','audit'])if(!Array.isArray(state[key]))state[key]=[];
  state.schema=SCHEMA;state.version=GOVERNANCE_VERSION;return state;
}
export function audit(state,action,detail={}){
  state.audit.unshift({id:id('audit'),at:now(),action,detail});
  state.audit=state.audit.slice(0,500);return state;
}
export async function createCredential(label,kind='member',scope='local'){
  const keyPair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const publicKey=await crypto.subtle.exportKey('jwk',keyPair.publicKey);
  const fingerprint=(await sha256(canonicalJson(publicKey))).slice(0,22);
  const record={schema:CREDENTIAL_SCHEMA,id:`${kind}-${fingerprint}`,label:String(label||kind).slice(0,120),kind,scope,publicKey,fingerprint,createdAt:now(),status:'active'};
  return {record,privateKey:keyPair.privateKey};
}
export async function signPayload(privateKey,payload){
  const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},privateKey,encoder.encode(canonicalJson(payload)));
  return base64url(signature);
}
export async function verifySignature(publicKey,payload,signature){
  try{
    const key=await crypto.subtle.importKey('jwk',publicKey,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
    return await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,fromBase64url(signature),encoder.encode(canonicalJson(payload)));
  }catch{return false}
}
function cleanFiles(files=[]){
  return files.slice(0,50).map(file=>({path:String(file.path||'').replace(/\\/g,'/').replace(/^\/+/,'').slice(0,240),content:String(file.content??''),delete:Boolean(file.delete)}));
}
function changeHashPayload(change){
  return {schema:CHANGE_SCHEMA,id:change.id,revision:change.revision,title:change.title,request:change.request,area:change.area,baseCommit:change.baseCommit,targetBranch:change.targetBranch,files:change.files,acceptance:change.acceptance,rollback:change.rollback,risk:change.risk,consentRequirements:change.consentRequirements,railPolicyVersion:change.railPolicyVersion};
}
export async function hashChangeSet(change){return sha256(canonicalJson(changeHashPayload(change)))}
export async function createChangeSet(input={}){
  const change={schema:CHANGE_SCHEMA,id:input.id||id('change'),revision:1,title:String(input.title||'Untitled change').slice(0,160),request:String(input.request||'').slice(0,12000),area:String(input.area||'Civweave').slice(0,100),baseCommit:String(input.baseCommit||'').trim(),targetBranch:String(input.targetBranch||'').trim(),files:cleanFiles(input.files),acceptance:(Array.isArray(input.acceptance)?input.acceptance:String(input.acceptance||'').split('\n')).map(x=>String(x).trim()).filter(Boolean).slice(0,40),rollback:String(input.rollback||'').slice(0,6000),risk:String(input.risk||'').slice(0,6000),consentRequirements:(input.consentRequirements||[]).map(x=>String(x).trim()).filter(Boolean).slice(0,30),railPolicyVersion:'anarchadia-rails.v145',state:'draft',rails:[],createdAt:now(),updatedAt:now()};
  change.revisionHash=await hashChangeSet(change);return change;
}
export async function reviseChangeSet(change,patch={}){
  const next={...clone(change),...patch,revision:Number(change.revision||1)+1,state:'draft',rails:[],updatedAt:now()};
  if(patch.files)next.files=cleanFiles(patch.files);
  if(patch.acceptance)next.acceptance=(Array.isArray(patch.acceptance)?patch.acceptance:String(patch.acceptance).split('\n')).map(x=>String(x).trim()).filter(Boolean);
  next.revisionHash=await hashChangeSet(next);return next;
}
function rail(id,label,status,note){return{id,label,status,note}}
export function evaluateRails(change){
  const files=cleanFiles(change.files);
  const exactBase=/^[a-f0-9]{40}$/i.test(change.baseCommit);
  const branch=/^agent\/anarchadia-[a-z0-9._/-]{3,120}$/i.test(change.targetBranch)&&!/(^|\/)(main|master)$/i.test(change.targetBranch);
  const badPaths=files.filter(file=>!file.path||DENIED_PATHS.some(rule=>rule.test(file.path))||!ALLOWED_ROOTS.some(rule=>rule.test(file.path)));
  const oversized=files.filter(file=>!file.delete&&file.content.length>240000);
  const forbidden=files.flatMap(file=>FORBIDDEN_CODE.filter(rule=>rule.test(file.content)).map(rule=>`${file.path}: ${rule}`));
  const dangerous=files.some(file=>/^\.github\/workflows\//.test(file.path)||/^(?:server|scripts\/).*(?:deploy|release|executor)/i.test(file.path));
  const rails=[
    rail('exact-base','Exact immutable base commit',exactBase?'pass':'block',exactBase?'40-character commit SHA recorded.':'Replace the moving branch name with the exact 40-character base commit.'),
    rail('branch-only','Branch-only target',branch?'pass':'block',branch?'Target is an isolated Anarchadia agent branch.':'Target must match agent/anarchadia-* and cannot be main or master.'),
    rail('bounded-files','Bounded allowlisted file set',files.length&&files.length<=50&&!badPaths.length?'pass':'block',badPaths.length?`Blocked paths: ${badPaths.map(x=>x.path||'[blank]').join(', ')}`:`${files.length} file record(s).`),
    rail('bounded-size','Per-file size limits',!oversized.length?'pass':'block',oversized.length?`Oversized: ${oversized.map(x=>x.path).join(', ')}`:'Every file is within 240 KB.'),
    rail('static-safety','Forbidden-code scan',!forbidden.length?'pass':'block',forbidden.length?forbidden.join('; '):'No blocked dynamic-code, credential, or destructive-storage pattern found.'),
    rail('acceptance','Testable acceptance criteria',change.acceptance?.length?'pass':'block',change.acceptance?.length?`${change.acceptance.length} criterion/criteria recorded.`:'At least one observable acceptance criterion is required.'),
    rail('rollback','Rollback path',String(change.rollback||'').trim()?'pass':'block',String(change.rollback||'').trim()?'Rollback instructions recorded.':'A concrete rollback path is required.'),
    rail('risk-consent','Risk and consent declaration',String(change.risk||'').trim()?'pass':'review',String(change.risk||'').trim()?'Risk notes are recorded.':'Risk is undeclared; human review is required.'),
    rail('sensitive-surface','Sensitive execution surface',dangerous?'review':'pass',dangerous?'Server, release, workflow, or executor changes require explicit human review.':'No sensitive execution surface detected.')
  ];
  return {policy:'anarchadia-rails.v145',results:rails,blocking:rails.filter(x=>x.status==='block'),review:rails.filter(x=>x.status==='review'),passed:rails.every(x=>x.status!=='block')};
}
export function applyRails(change){
  const result=evaluateRails(change);change.rails=result.results;change.state=result.passed?'rails-checked':'draft';change.updatedAt=now();return result;
}
export function transitionChangeSet(change,next){
  if(!CHANGE_STATES.includes(next))throw new Error(`Unknown change state ${next}`);
  if(change.state===next)return change;
  if(!(TRANSITIONS[change.state]||[]).includes(next))throw new Error(`Cannot move ${change.state} to ${next}`);
  change.state=next;change.updatedAt=now();return change;
}
export function createGroup(input={}){
  return {schema:'civweave.anarchadia-group.v1',id:input.id||id('group'),name:String(input.name||'Unnamed group').slice(0,120),charter:String(input.charter||'').slice(0,8000),memberIds:[...new Set(input.memberIds||[])],procedure:{quorum:Number(input.quorum??0.5),threshold:Number(input.threshold??0.5),allowReplacement:input.allowReplacement!==false},createdAt:now(),status:'active'};
}

function normalizeRealm(value){
  const realm=String(value||'').trim().toLowerCase().replace(/[_\s]+/g,'-');
  if(['living','living-academy','living-school'].includes(realm))return'living-school';
  if(['fellow-fare','fellowfare'].includes(realm))return'fellowfare';
  if(['commonweave','civweave'].includes(realm))return'civweave';
  return realm||'anarchadia';
}
export function intentionAuthorityPath(input={}){
  const realms=[...new Set((Array.isArray(input.realms)?input.realms:[input.realm]).filter(Boolean).map(normalizeRealm))];
  const requested=String(input.reach||input.requestedReach||'auto').toLowerCase();
  if(realms.length===1&&realms[0]==='living-school')return['individual'];
  const crossRealm=realms.length>1||Boolean(input.crossEffecting);
  if(requested==='mesh'||crossRealm)return['hub','region','mesh'];
  if(requested==='region')return['hub','region'];
  if(requested==='individual'&&!realms.some(realm=>['cerbanimo','fellowfare'].includes(realm)))return['individual'];
  return['hub'];
}
function intentionHashPayload(plan){
  return {schema:INTENTION_SCHEMA,id:plan.id,revision:plan.revision,title:plan.title,summary:plan.summary,realms:plan.realms,creatorId:plan.creatorId,authorityPath:plan.authorityPath,sourceKind:plan.sourceKind,sourceProposalId:plan.sourceProposalId,successSignals:plan.successSignals,risks:plan.risks};
}
export async function hashIntentionPlan(plan){return sha256(canonicalJson(intentionHashPayload(plan)))}
export async function createIntentionPlan(input={}){
  const realms=[...new Set((Array.isArray(input.realms)?input.realms:[input.realm||'anarchadia']).filter(Boolean).map(normalizeRealm))];
  const authorityPath=intentionAuthorityPath({...input,realms});
  const createdAt=now(),individual=authorityPath.length===1&&authorityPath[0]==='individual';
  const plan={schema:INTENTION_SCHEMA,id:input.id||id('intention'),revision:1,title:String(input.title||'Untitled intention').slice(0,180),summary:String(input.summary||input.description||'').slice(0,12000),realms,creatorId:String(input.creatorId||'local-citizen').slice(0,180),authorityPath,activeLevel:individual?'individual':'hub',state:individual?'adopted':'hub-deliberation',sourceKind:String(input.sourceKind||'intention').slice(0,80),sourceProposalId:String(input.sourceProposalId||'').slice(0,220),successSignals:(Array.isArray(input.successSignals)?input.successSignals:String(input.successSignals||'').split('\n')).map(value=>String(value).trim()).filter(Boolean).slice(0,30),risks:String(input.risks||'').slice(0,6000),decisions:individual?[{level:'individual',outcome:'adopted',decidedAt:createdAt,reason:'Living School paths remain individually governed.'}]:[],createdAt,updatedAt:createdAt};
  plan.revisionHash=await hashIntentionPlan(plan);return plan;
}
export async function openConsensusRound(plan,input={}){
  if(plan?.schema!==INTENTION_SCHEMA)throw new Error('A valid intention plan is required.');
  const level=String(input.level||plan.activeLevel||'hub');
  if(!plan.authorityPath.includes(level)||level==='individual')throw new Error('This level is not part of the plan authority path.');
  if(level!==plan.activeLevel)throw new Error(`The ${plan.activeLevel} round must resolve before ${level}.`);
  const electorate=(input.electorate||[]).map(actor=>({actorId:actor.id||actor.actorId,label:actor.label||actor.name||actor.id,kind:actor.kind||'member',publicKey:actor.publicKey})).filter(actor=>actor.actorId&&actor.publicKey);
  if(!electorate.length)throw new Error(`The ${level} round requires at least one credentialed participant.`);
  const snapshotHash=await sha256(canonicalJson(electorate));
  return {schema:CONSENSUS_SCHEMA,id:id('consensus'),planId:plan.id,planRevisionHash:plan.revisionHash,level,electorate,snapshotHash,procedure:{quorum:Math.min(1,Math.max(0,Number(input.quorum??0.6))),threshold:Math.min(1,Math.max(0,Number(input.threshold??0.67)))},choices:CONSENSUS_CHOICES,positions:[],status:'open',openedAt:now(),closedAt:null,outcome:null};
}
function consensusPositionPayload(round,actorId,choice,sequence,castAt,note=''){
  return {schema:'civweave.anarchadia-consensus-position.v1',roundId:round.id,planId:round.planId,planRevisionHash:round.planRevisionHash,snapshotHash:round.snapshotHash,level:round.level,actorId,choice,sequence,castAt,note};
}
export async function castConsensusPosition(round,credential,privateKey,choice,note=''){
  if(round.status!=='open')throw new Error('This consensus round is closed.');
  if(!CONSENSUS_CHOICES.includes(choice))throw new Error('Unsupported consensus position.');
  if(!round.electorate.some(actor=>actor.actorId===credential.id))throw new Error('This credential is not in the frozen electorate.');
  const prior=round.positions.find(position=>position.actorId===credential.id),castAt=now(),sequence=Number(prior?.sequence||0)+1;
  const payload=consensusPositionPayload(round,credential.id,choice,sequence,castAt,String(note||'').slice(0,2000));
  const position={...payload,publicKey:credential.publicKey,signature:await signPayload(privateKey,payload)};
  round.positions=round.positions.filter(item=>item.actorId!==credential.id);round.positions.push(position);return position;
}
export async function verifyConsensusPosition(round,position){
  const eligible=round.electorate.find(actor=>actor.actorId===position.actorId);
  if(!eligible||canonicalJson(eligible.publicKey)!==canonicalJson(position.publicKey))return false;
  return verifySignature(position.publicKey,consensusPositionPayload(round,position.actorId,position.choice,position.sequence,position.castAt,position.note),position.signature);
}
export function tallyConsensusRound(round){
  const totals=Object.fromEntries(CONSENSUS_CHOICES.map(choice=>[choice,0]));
  for(const position of round.positions||[])if(totals[position.choice]!==undefined)totals[position.choice]+=1;
  const eligible=round.electorate.length,cast=round.positions.length,remaining=Math.max(0,eligible-cast),participation=eligible?cast/eligible:0;
  const decisive=totals.support+totals.oppose+totals.amend,approval=decisive?totals.support/decisive:0;
  const maxApproval=decisive+remaining?(totals.support+remaining)/(decisive+remaining):1;
  const quorumMet=participation>=round.procedure.quorum,thresholdMet=approval>=round.procedure.threshold;
  const neededForQuorum=Math.max(0,Math.ceil(eligible*round.procedure.quorum)-cast);
  const denominator=1-round.procedure.threshold;
  const neededForThreshold=thresholdMet?0:denominator<=0?remaining+1:Math.max(0,Math.ceil((round.procedure.threshold*decisive-totals.support)/denominator));
  const plausible=cast<eligible&&neededForQuorum<=remaining&&neededForThreshold<=remaining;
  const outcome=quorumMet&&thresholdMet?'ready-to-adopt':cast===eligible?(quorumMet?'not-adopted':'no-quorum'):plausible?'forming':'stalled';
  return {eligible,cast,remaining,participation,approval,maxApproval,quorumMet,thresholdMet,neededForQuorum,neededForThreshold,plausible,totals,outcome};
}
export async function closeConsensusRound(round,plan){
  if(round.status!=='open')return round.outcome;
  if(plan.revisionHash!==round.planRevisionHash)throw new Error('The intention changed after this round opened.');
  for(const position of round.positions)if(!await verifyConsensusPosition(round,position))throw new Error(`Invalid consensus signature for ${position.actorId}.`);
  const tally=tallyConsensusRound(round),outcome=tally.quorumMet&&tally.thresholdMet?'adopted':tally.quorumMet?'not-adopted':'no-quorum';
  round.status='closed';round.closedAt=now();round.outcome={...tally,outcome,hash:await sha256(canonicalJson({...tally,outcome}))};
  plan.decisions=Array.isArray(plan.decisions)?plan.decisions:[];plan.decisions.push({level:round.level,outcome,roundId:round.id,roundHash:round.outcome.hash,decidedAt:round.closedAt});
  const index=plan.authorityPath.indexOf(round.level),next=outcome==='adopted'?plan.authorityPath[index+1]:null;
  if(next){plan.activeLevel=next;plan.state=`${next}-deliberation`}else if(outcome==='adopted'){plan.state='adopted'}else{plan.state='stalled'}
  plan.updatedAt=now();return round.outcome;
}
export async function openBallot(change,input={}){
  if(!['frozen','voting'].includes(change.state))throw new Error('Freeze the exact change revision before opening a ballot.');
  const electorate=(input.electorate||[]).map(actor=>({actorId:actor.id||actor.actorId,label:actor.label||actor.name||actor.id,kind:actor.kind||input.kind||'member',publicKey:actor.publicKey})).filter(x=>x.actorId&&x.publicKey);
  if(!electorate.length)throw new Error('A ballot requires at least one credentialed electorate member.');
  const snapshotHash=await sha256(canonicalJson(electorate));
  const ballot={schema:BALLOT_SCHEMA,id:id('ballot'),changeSetId:change.id,revisionHash:change.revisionHash,kind:input.kind==='federation'?'federation':'group',constituencyId:String(input.constituencyId||''),electorate,snapshotHash,procedure:{quorum:Math.min(1,Math.max(0,Number(input.quorum??0.5))),threshold:Math.min(1,Math.max(0,Number(input.threshold??0.5))),closesAt:input.closesAt||null},choices:CHOICES,votes:[],status:'open',openedAt:now(),closedAt:null,outcome:null};
  change.state='voting';change.updatedAt=now();return ballot;
}
function ballotVotePayload(ballot,actorId,choice,sequence,castAt,note=''){
  return {schema:'civweave.anarchadia-ballot-choice.v1',ballotId:ballot.id,changeSetId:ballot.changeSetId,revisionHash:ballot.revisionHash,snapshotHash:ballot.snapshotHash,actorId,choice,sequence,castAt,note};
}
export async function castBallot(ballot,credential,privateKey,choice,note=''){
  if(ballot.status!=='open')throw new Error('Ballot is closed.');
  if(!CHOICES.includes(choice))throw new Error('Unsupported ballot choice.');
  const eligible=ballot.electorate.find(x=>x.actorId===credential.id);
  if(!eligible)throw new Error('Credential is not in the frozen electorate snapshot.');
  const prior=ballot.votes.find(x=>x.actorId===credential.id);
  const castAt=now(),sequence=Number(prior?.sequence||0)+1;
  const payload=ballotVotePayload(ballot,credential.id,choice,sequence,castAt,String(note||'').slice(0,2000));
  const signature=await signPayload(privateKey,payload);
  const vote={...payload,signature,publicKey:credential.publicKey};
  ballot.votes=ballot.votes.filter(x=>x.actorId!==credential.id);ballot.votes.push(vote);return vote;
}
export async function verifyBallotVote(ballot,vote){
  const eligible=ballot.electorate.find(x=>x.actorId===vote.actorId);
  if(!eligible||canonicalJson(eligible.publicKey)!==canonicalJson(vote.publicKey))return false;
  const payload=ballotVotePayload(ballot,vote.actorId,vote.choice,vote.sequence,vote.castAt,vote.note);
  return verifySignature(vote.publicKey,payload,vote.signature);
}
export function tallyBallot(ballot){
  const totals=Object.fromEntries(CHOICES.map(x=>[x,0]));
  for(const vote of ballot.votes)if(totals[vote.choice]!==undefined)totals[vote.choice]+=1;
  const eligible=ballot.electorate.length,cast=ballot.votes.length,participation=eligible?cast/eligible:0;
  const decisive=totals.approve+totals.reject+totals['request-amendment'];
  const approval=decisive?totals.approve/decisive:0;
  const quorumMet=participation>=ballot.procedure.quorum;
  const thresholdMet=approval>=ballot.procedure.threshold;
  const outcome=quorumMet&&thresholdMet?'adopted':quorumMet?'not-adopted':'no-quorum';
  return {eligible,cast,participation,approval,quorumMet,thresholdMet,totals,outcome};
}
export async function closeBallot(ballot,change){
  if(ballot.status!=='open')return ballot.outcome;
  for(const vote of ballot.votes)if(!await verifyBallotVote(ballot,vote))throw new Error(`Invalid ballot signature for ${vote.actorId}`);
  const result=tallyBallot(ballot);ballot.status='closed';ballot.closedAt=now();ballot.outcome={...result,hash:await sha256(canonicalJson(result))};
  if(change){if(change.revisionHash!==ballot.revisionHash)throw new Error('Ballot revision no longer matches the change.');change.state='outcome-declared';change.updatedAt=now()}
  return ballot.outcome;
}
export async function recordConsent(input,credential,privateKey){
  const payload={schema:CONSENT_SCHEMA,id:id('consent'),changeSetId:input.changeSetId,revisionHash:input.revisionHash,actorId:credential.id,scope:String(input.scope||'').slice(0,500),decision:input.decision==='denied'?'denied':'granted',conditions:String(input.conditions||'').slice(0,3000),recordedAt:now()};
  return {...payload,publicKey:credential.publicKey,signature:await signPayload(privateKey,payload)};
}
export async function verifyConsent(receipt){const {signature,publicKey,...payload}=receipt;return verifySignature(publicKey,payload,signature)}
export async function createDissent(input,credential=null,privateKey=null){
  const payload={schema:DISSENT_SCHEMA,id:id('dissent'),changeSetId:input.changeSetId,revisionHash:input.revisionHash,actorId:credential?.id||'withheld',disclosure:input.disclosure||'anonymous-summary',text:String(input.text||'').slice(0,8000),conditions:String(input.conditions||'').slice(0,4000),blocking:Boolean(input.blocking),recordedAt:now()};
  if(!credential||!privateKey)return {...payload,publicKey:null,signature:null};
  return {...payload,publicKey:credential.publicKey,signature:await signPayload(privateKey,payload)};
}
export async function createNodeOutcome(ballot,nodeCredential,privateKey){
  if(ballot.status!=='closed')throw new Error('Close the local ballot before creating a node outcome.');
  const payload={schema:OUTCOME_SCHEMA,id:id('node-outcome'),nodeId:nodeCredential.id,ballotId:ballot.id,changeSetId:ballot.changeSetId,revisionHash:ballot.revisionHash,electorateSnapshotHash:ballot.snapshotHash,outcome:ballot.outcome,declaredAt:now()};
  return {...payload,publicKey:nodeCredential.publicKey,signature:await signPayload(privateKey,payload)};
}
export async function verifyNodeOutcome(outcome,trustedNode=null){
  const {signature,publicKey,...payload}=outcome;
  if(trustedNode&&canonicalJson(trustedNode.publicKey)!==canonicalJson(publicKey))return false;
  return verifySignature(publicKey,payload,signature);
}
function authorizationPayload(auth){const {signature,publicKey,...payload}=auth;return payload}
export async function issueExecutionAuthorization(change,ballot,consents,nodeCredential,privateKey,input={}){
  if(change.revisionHash!==await hashChangeSet(change))throw new Error('Change hash is stale or altered.');
  const rails=evaluateRails(change);if(!rails.passed)throw new Error(`Blocked rails: ${rails.blocking.map(x=>x.label).join(', ')}`);
  if(ballot?.status!=='closed'||ballot.revisionHash!==change.revisionHash||ballot.outcome?.outcome!=='adopted')throw new Error('A closed adopted ballot for this exact revision is required.');
  const validConsents=[];
  for(const receipt of consents||[])if(receipt.changeSetId===change.id&&receipt.revisionHash===change.revisionHash&&await verifyConsent(receipt))validConsents.push(receipt);
  for(const scope of change.consentRequirements||[])if(!validConsents.some(x=>x.scope===scope&&x.decision==='granted'))throw new Error(`Missing required consent: ${scope}`);
  const issuedAt=now(),expiresAt=input.expiresAt||new Date(Date.now()+24*60*60*1000).toISOString();
  const payload={schema:AUTH_SCHEMA,id:id('authorization'),changeSetId:change.id,changeHash:change.revisionHash,baseCommit:change.baseCommit,targetBranch:change.targetBranch,executionMode:'branch-only',railsDigest:await sha256(canonicalJson(rails.results)),ballotId:ballot.id,ballotOutcomeHash:ballot.outcome.hash,issuedBy:nodeCredential.id,issuedAt,expiresAt,rollback:change.rollback,healthChecks:input.healthChecks||['npm run check'],rollout:'prepare-branch-only'};
  const authorization={...payload,publicKey:nodeCredential.publicKey,signature:await signPayload(privateKey,payload)};
  change.state='authorized';change.updatedAt=now();return authorization;
}
export async function verifyExecutionAuthorization(auth){
  if(auth?.schema!==AUTH_SCHEMA||auth.executionMode!=='branch-only'||!/^agent\/anarchadia-/i.test(auth.targetBranch)||!/^[a-f0-9]{40}$/i.test(auth.baseCommit)||Date.parse(auth.expiresAt)<=Date.now())return false;
  return verifySignature(auth.publicKey,authorizationPayload(auth),auth.signature);
}
export async function createExecutionPacket(change,ballot,authorization,dissents=[]){
  const packet={schema:PACKET_SCHEMA,id:id('execution'),changeSet:clone(change),ballot:{id:ballot.id,revisionHash:ballot.revisionHash,snapshotHash:ballot.snapshotHash,outcome:ballot.outcome},authorization:clone(authorization),dissents:clone(dissents.filter(x=>x.changeSetId===change.id&&x.revisionHash===change.revisionHash)),createdAt:now()};
  packet.packetHash=await sha256(canonicalJson({...packet,packetHash:undefined}));return packet;
}
export async function validateExecutionPacket(packet){
  const errors=[];
  if(packet?.schema!==PACKET_SCHEMA)errors.push('Wrong packet schema.');
  const change=packet?.changeSet,auth=packet?.authorization;
  if(!change||change.schema!==CHANGE_SCHEMA)errors.push('Missing change set.');
  else if(change.revisionHash!==await hashChangeSet(change))errors.push('Change hash mismatch.');
  if(!auth||auth.changeHash!==change?.revisionHash)errors.push('Authorization is not bound to this change hash.');
  else if(!await verifyExecutionAuthorization(auth))errors.push('Authorization signature, expiry, base commit, or target branch is invalid.');
  const rails=change?evaluateRails(change):null;if(rails&&!rails.passed)errors.push(...rails.blocking.map(x=>`Rail blocked: ${x.label}`));
  const expected=packet?await sha256(canonicalJson({...packet,packetHash:undefined})):'';if(packet?.packetHash!==expected)errors.push('Packet hash mismatch.');
  return {valid:errors.length===0,errors,rails};
}
export const schemas={SCHEMA,CHANGE_SCHEMA,BALLOT_SCHEMA,AUTH_SCHEMA,PACKET_SCHEMA,CREDENTIAL_SCHEMA,OUTCOME_SCHEMA,CONSENT_SCHEMA,DISSENT_SCHEMA,INTENTION_SCHEMA,CONSENSUS_SCHEMA};
