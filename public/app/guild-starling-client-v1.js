(()=>{
'use strict';
if(globalThis.CivweaveGuildStarlingV1)return;
const VERSION='1.0.0',ROUTE='/api/node/starling',TIMEOUT_MS=15000;
const scopes=new Map(); // A successful authenticated read pins context for this document only.
const clean=(value,max=180)=>typeof value==='string'?value.trim().slice(0,max):'';
const id=value=>typeof value==='string'&&/^[A-Za-z0-9:_-]{1,180}$/.test(value);
const lineId=value=>typeof value==='string'&&/^starling-line:[a-f0-9]{64}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const integer=(value,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
const positive=value=>integer(value)&&value>0;
const count=value=>value===null||integer(value,1000000);
const states=new Set(['reserved','proposed','published','completed','abandoned']);
const bad=message=>{throw new Error(message||'The Guild returned an invalid Collective response.');};
function owner(){return globalThis.CivweaveGuildQuestsV1||null;}
function session(guild){const value=owner()?.sessionForGuild?.(guild);if(!value)throw new Error('Log in to this Guild to use its Collective.');return value;}
const scopeKey=value=>`${value.origin}\n${value.nodeId}\n${value.userId}`;
function requiredId(value,label='identifier'){if(!id(value))throw new TypeError(`A valid ${label} is required.`);return value;}
function requiredLine(value){if(!lineId(value))throw new TypeError('A valid Collective line identifier is required.');return value;}
function revision(value){if(!integer(value))throw new TypeError('A nonnegative expectedRevision is required.');return value;}
function confirmed(value){if(value!==true)throw new TypeError('Explicit confirmation is required before posting to the Guild.');return true;}
function validQuest(value){try{return Boolean(value?.kind==='weave-plan'&&value?.plan?.schema==='civweave.intention-weave.v1'&&owner()?.preview(value));}catch{return false;}}
function validLine(row,guildId){
  if(row?.schema!=='civweave.guild-starling-line.v1'||!lineId(row.id)||row.guildId!==guildId||!id(row.nodeId)||!id(row.userId)||!positive(row.revision)||!states.has(row.state))return false;
  if(row.privateDraft===true)return row.proposal===undefined&&row.publicationId===undefined;
  if(typeof row.title!=='string'||!row.title||row.title.length>240||row.origin!=='ai-generated')return false;
  if(row.proposal!==undefined&&(!validQuest(row.proposal)||!hash(row.proposalHash)))return false;
  if(row.publicationId!==undefined&&!/^guild-quest:[a-f0-9]{64}$/.test(row.publicationId))return false;
  return row.state!=='published'||Boolean(row.publicationId&&row.proposal&&row.confirmedBy===row.userId);
}
function validPassport(row,guildId){return row?.schema==='civweave.guild-passport-claim.v1'&&row.guildId===guildId&&id(row.nodeId)&&id(row.userId)&&/^[A-Za-z0-9:._-]{6,180}$/.test(row.passportId)&&row.consent==='guild-planning'&&row.authority==='authenticated-member-device-claim'&&row.verified===false&&Array.isArray(row.skills)&&row.skills.length<=64&&row.skillsKnown===(row.skills.length>0)&&row.skills.every(skill=>id(skill?.skillId)&&typeof skill.name==='string'&&skill.name.length<=120&&typeof skill.xp==='number'&&Number.isFinite(skill.xp)&&skill.xp>0&&skill.xp<=1e12)&&new Set(row.skills.map(skill=>skill.skillId)).size===row.skills.length&&(!row.accountId||id(row.accountId));}
function validIntention(row,guildId){return row?.schema==='civweave.guild-intention-proposal.v1'&&row.guildId===guildId&&id(row.nodeId)&&id(row.userId)&&typeof row.text==='string'&&row.text.length>0&&row.text.length<=4000&&row.state==='proposed'&&row.adopted===false&&row.authority==='human-proposal'&&positive(row.revision);}
function validPublication(row,guildId,userId){return row?.schema==='civweave.guild-quest-publication.v1'&&/^guild-quest:[a-f0-9]{64}$/.test(row.id)&&row.guildId===guildId&&id(row.nodeId)&&row.authorUserId===userId&&row.status==='published'&&positive(row.revision)&&validQuest(row.quest);}
function policyValid(value){return value?.maxActiveLines===3&&value.maxCreatedPerWindow===6&&value.creationWindowMs===86400000&&value.maxRetainedLines===500&&value.maxIntentionProposalsPerWindow===6&&value.maxPassportSkills===64;}
function validateStatus(packet,current,expectedGuild){
  const context=packet.context;
  if(packet.schema!=='civweave.guild-starling.v1'||packet.nodeId!==current.nodeId||!id(packet.guildId)||expectedGuild&&packet.guildId!==expectedGuild)bad('The Guild returned a different or invalid Collective context.');
  if(!policyValid(packet.policy)||!integer(packet.activeCount,3)||packet.availableSlots!==3-packet.activeCount||!integer(packet.createdInWindow,6)||packet.requiresPostingConfirmation!==true||!Array.isArray(packet.lines)||packet.lines.length>43||packet.lines.some(row=>!validLine(row,packet.guildId))||new Set(packet.lines.map(row=>row.id)).size!==packet.lines.length)bad();
  if(context?.schema!=='civweave.guild-starling-context.v1'||context.guildmasterVerified!==false||context.humanGovernanceRequired!==true||context.drivingIntention!==null||context.heroCount!==null||!count(context.reportedPassportHeroes)||!count(context.claimedPassportCount)||!count(context.knownMemberCount)||!count(context.authoritativeGuildSize)||context.knownMemberCount!==context.authoritativeGuildSize||context.skillAuthority!=='authenticated-member-device-claim'||!Array.isArray(context.passports)||context.passports.length>500||context.passports.some(row=>!validPassport(row,packet.guildId))||context.claimedPassportCount!==context.passports.length||context.reportedPassportHeroes!==(context.passports.length||null)||!Array.isArray(context.intentions)||context.intentions.length>40||context.intentions.some(row=>!validIntention(row,packet.guildId)))bad();
}
function validateMutation(packet,action,input,current,guildId){
  if(['reserve','propose','confirm','abandon'].includes(action)){
    const row=packet.line;if(!validLine(row,guildId)||row.userId!==current.userId||row.privateDraft===true||action!=='reserve'&&row.id!==input.id||typeof packet.idempotent!=='boolean')bad('The Guild returned a different or invalid Collective Quest line.');
    const expected={propose:'proposed',confirm:'published',abandon:'abandoned'}[action];if(expected&&row.state!==expected)bad();
    if(action==='confirm'&&(!validPublication(packet.publication,guildId,current.userId)||packet.publication.id!==row.publicationId||packet.publication.quest.id!==row.proposal.id||row.proposalHash!==input.proposalHash))bad();
  }else if(action==='passport'){
    if(!validPassport(packet.passport,guildId)||packet.passport.userId!==current.userId||packet.passport.passportId!==input.passportId)bad();
  }else if(action==='passport-revoke'){
    if(packet.revoked!==true||typeof packet.idempotent!=='boolean')bad();
  }else if(action==='intention-propose'){
    if(!validIntention(packet.intention,guildId)||packet.intention.userId!==current.userId||packet.intention.text!==input.text||typeof packet.idempotent!=='boolean')bad();
  }
}
async function request(guild,action,input=null){
  const current=session(guild),key=scopeKey(current),known=scopes.get(key),explicit=typeof guild==='object'?clean(guild?.guildId):'',expectedGuild=explicit||known;
  if(globalThis.navigator?.onLine===false)throw new Error('Reconnect to use the Guild Collective. Private drafts remain on this device.');
  if(action!=='status'&&!known)throw new Error('Refresh the Guild Collective before posting or reserving work.');
  if(explicit&&known&&explicit!==known)bad('The selected Guild has a different Collective context.');
  const url=new URL(action==='status'?ROUTE:`${ROUTE}/${action}`,current.origin);url.searchParams.set('nodeId',current.nodeId);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const response=await fetch(url,{method:input?'POST':'GET',cache:'no-store',credentials:'omit',signal:controller.signal,headers:{accept:'application/json',authorization:`Bearer ${current.token}`,'x-civweave-node-id':current.nodeId,...(input?{'content-type':'application/json'}:{})},...(input?{body:JSON.stringify(input)}:{})});
    const packet=await response.json().catch(()=>({}));if(!response.ok||packet.ok!==true){const error=new Error(clean(packet.error,1200)||`Guild returned HTTP ${response.status}.`);error.status=response.status;throw error;}
    if(action==='status'){validateStatus(packet,current,expectedGuild);scopes.set(key,packet.guildId);}else validateMutation(packet,action,input,current,known);
    return packet;
  }catch(error){if(error.name==='AbortError')throw new Error('The Guild Collective did not respond. Retry when it is available.');throw error;}finally{clearTimeout(timer);}
}
async function reserve(guild,value={}){const title=clean(value.title,240);if(!title)throw new TypeError('A Collective Quest line title is required.');return request(guild,'reserve',{title,idempotencyKey:requiredId(value.idempotencyKey,'idempotency key'),mode:value.mode==='autonomous'?'autonomous':'manual'});}
async function propose(guild,value={}){return request(guild,'propose',{id:requiredLine(value.id),expectedRevision:revision(value.expectedRevision),quest:owner()?.preview(value.quest),provider:clean(value.provider,80)||'unknown',model:clean(value.model,180)||'unknown'});}
async function confirm(guild,value={}){const confirmation=confirmed(value.confirmed);if(!hash(value.proposalHash))throw new TypeError('The reviewed proposal hash is required.');return request(guild,'confirm',{id:requiredLine(value.id),expectedRevision:revision(value.expectedRevision),proposalHash:value.proposalHash,confirmed:confirmation});}
async function abandon(guild,value={}){return request(guild,'abandon',{id:requiredLine(value.id),expectedRevision:revision(value.expectedRevision),reason:clean(value.reason,1000)});}
async function passport(guild,value={}){
  if(value.consent!=='guild-planning')throw new TypeError('Explicit Guild planning consent is required to share Passport skills.');
  const passportId=clean(value.passportId);if(!/^[A-Za-z0-9:._-]{6,180}$/.test(passportId))throw new TypeError('A valid Passport identifier is required.');
  if(!Array.isArray(value.skills)||value.skills.length>64)throw new TypeError('Share at most 64 explicit Passport skills.');
  const skills=value.skills.map(row=>{const skillId=requiredId(row?.skillId,'skill identifier');if(typeof row.xp!=='number'||!Number.isFinite(row.xp)||row.xp<0||row.xp>1e12)throw new TypeError('Passport skill XP must be a finite nonnegative number.');return{skillId,name:clean(row.name,120)||skillId,xp:row.xp};});
  if(new Set(skills.map(row=>row.skillId)).size!==skills.length)throw new TypeError('Passport skills must have unique identifiers.');
  return request(guild,'passport',{passportId,consent:'guild-planning',skills});
}
async function passportRevoke(guild,value={}){return request(guild,'passport-revoke',{confirmed:confirmed(value.confirmed)});}
async function intentionpropose(guild,value={}){const text=clean(value.text,4000);if(!text)throw new TypeError('A Guild Intention proposal is required.');return request(guild,'intention-propose',{text,expectedRevision:revision(value.expectedRevision),confirmed:confirmed(value.confirmed)});}
globalThis.CivweaveGuildStarlingV1=Object.freeze({version:VERSION,read:guild=>request(guild,'status'),reserve,propose,confirm,abandon,passport,passportRevoke,revokePassport:passportRevoke,intentionpropose,intentionPropose:intentionpropose});
})();
