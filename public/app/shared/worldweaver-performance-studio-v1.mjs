/**
 * Worldweaver Performance Studio v1.
 * Authoritative local production state for adaptation, rehearsal, and consented
 * audience participation. This is NOT a film renderer or an OpenSim server.
 *
 * Trust comes exclusively from an injected host authorize callback. A model or
 * browser cannot self-assert permission to publish, finalize, or train on data.
 */
export const PERFORMANCE_SCHEMA='civweave.performance-studio.v1';
export const STAGE_LIMITS=Object.freeze({sourceChunks:50,sourceChars:12000,scenes:120,lines:80,characters:24,
  cast:20,props:24,beats:20,feedback:250,feedbackChars:1200,history:700});
const clone=x=>JSON.parse(JSON.stringify(x));
const only=(v,keys,label)=>{
 if(!v||typeof v!=='object'||Array.isArray(v))throw new TypeError(label+' must be an object');
 const unexpected=Object.keys(v).filter(k=>!keys.includes(k));
 if(unexpected.length)throw new TypeError('Unexpected '+label+' fields: '+unexpected.join(', '));
};
const bounded=(v,n,label)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>n)throw new TypeError('Invalid '+label);return v.trim();};
const optional=(v,n,label)=>v==null?'':bounded(v,n,label);
const identifier=(v,label)=>{const x=bounded(v,180,label);if(!/^[a-zA-Z0-9][a-zA-Z0-9:._/-]*$/.test(x)||x.includes('..'))throw new TypeError('Invalid '+label);return x;};
const colour=(v)=>{if(typeof v!=='string'||!/^#[0-9a-fA-F]{6}$/.test(v))throw new TypeError('Invalid color');return v.toLowerCase();};
const number=(v,lo,hi,label)=>{if(!Number.isFinite(v)||v<lo||v>hi)throw new TypeError('Invalid '+label);return v;};
const arr=(v,max,label,min=0)=>{if(!Array.isArray(v)||v.length<min||v.length>max)throw new TypeError('Invalid '+label+' count');return v;};
const unique=(xs,label)=>{const set=new Set(xs);if(set.size!==xs.length)throw new TypeError('Duplicate '+label);};
const RIGHTS=['owned','licensed','public-domain'];
const cloneItem=(x)=>clone(x);
function validateDialogue(raw){
 return arr(raw,STAGE_LIMITS.lines,'dialogue',1).map((line,i)=>{
  only(line,['character','text','direction','seconds'],'dialogue line');
  return {character:identifier(line.character,'character'),text:bounded(line.text,1300,'dialogue text'),
    direction:optional(line.direction,180,'acting direction'),seconds:line.seconds==null?null:number(line.seconds,1,90,'line duration')};
 });
}
function validateSet(raw){
 only(raw,['location','mood','color','props','light','ambience'],'set');
 const props=arr(raw.props??[],STAGE_LIMITS.props,'props').map(p=>{
  only(p,['id','name','shape','x','y','height','width','depth','color'],'prop');
  const shape=bounded(p.shape,25,'prop shape');
  if(!['box','cylinder'].includes(shape))throw new TypeError('Unsupported stage shape');
  return {id:identifier(p.id,'prop'),name:bounded(p.name,100,'prop name'),shape,
    x:number(p.x,-75,75,'prop x'),y:number(p.y,-75,75,'prop y'),
    height:number(p.height,.1,30,'prop height'),width:number(p.width,.1,35,'prop width'),
    depth:number(p.depth,.1,35,'prop depth'),color:colour(p.color)};
 });
 unique(props.map(p=>p.id),'prop');
 return {location:bounded(raw.location,100,'location'),
  mood:bounded(raw.mood,240,'mood'),color:colour(raw.color),
  props,light:optional(raw.light,200,'lighting'),ambience:optional(raw.ambience,250,'ambience')};
}
function validateMoments(raw){
 const moments=arr(raw??[],STAGE_LIMITS.beats,'participation moments').map(m=>{
  only(m,['id','afterLine','prompt','mode','use','maxSeconds'],'moment');
  const mode=bounded(m.mode,30,'moment mode');
  if(!['reflection','question','improv-suggestion','reaction'].includes(mode))throw new TypeError('Unsupported participation mode');
  return {id:identifier(m.id,'moment ID'),afterLine:number(m.afterLine,0,STAGE_LIMITS.lines-1,'afterLine'),
   prompt:bounded(m.prompt,250,'audience prompt'),mode,
   use:optional(m.use,300,'participation use'),maxSeconds:m.maxSeconds==null?45:number(m.maxSeconds,5,180,'moment duration')};
 });
 unique(moments.map(x=>x.id),'moment IDs');
 return moments;
}
function validateScene(raw,sourceIds){
 only(raw,['title','slug','synopsis','sourceIds','dialogue','set','moments','runtimeSeconds','visualDirection'],'scene');
 const sources=arr(raw.sourceIds,10,'source references',1).map(id=>identifier(id,'source'));
 unique(sources,'source IDs');
 if(sources.some(id=>!sourceIds.has(id)))throw new TypeError('Scene refers to an unknown manuscript chunk');
 const dialogue=validateDialogue(raw.dialogue);
 const moments=validateMoments(raw.moments);
 if(moments.some(m=>m.afterLine>=dialogue.length))throw new TypeError('Participation moment is after an unknown line');
 const characters=[...new Set(dialogue.map(x=>x.character))];
 if(characters.length>STAGE_LIMITS.cast)throw new TypeError('Cast size limit exceeded');
 return {title:bounded(raw.title,140,'scene title'),slug:identifier(raw.slug,'scene slug'),
  synopsis:bounded(raw.synopsis,1100,'synopsis'),sourceIds:sources,dialogue,
  set:validateSet(raw.set),moments,runtimeSeconds:raw.runtimeSeconds==null?
   dialogue.reduce((sum,l)=>sum+(l.seconds||Math.max(3,Math.ceil(l.text.length/16))),0):
   number(raw.runtimeSeconds,5,3600,'runtime'),visualDirection:optional(raw.visualDirection,800,'visual direction')};
}
function checkActor(actor){
 if(!actor||typeof actor!=='object'||!['human','model','runtime','audience'].includes(actor.kind)||
  !actor.principalId||typeof actor.principalId!=='string')throw new TypeError('Externally verified actor required');
}
function makeReceipt(action,actor,time,revision){return {revision,action,actorKind:actor.kind,principalId:actor.principalId,at:time};}
export function createPerformanceStudio({id,clock,authorize,initialState}={}){
 if(typeof id!=='function'||typeof clock!=='function'||typeof authorize!=='function')
  throw new TypeError('Trusted id, clock and authorization adapters required');
 let state=initialState?clone(initialState):{
  schema:PERFORMANCE_SCHEMA,revision:0,project:null,sources:[],proposals:[],stagePlans:[],casts:[],rehearsals:[],audience:[],journal:[]};
 if(state.stagePlans===undefined)state.stagePlans=[];
 if(state.schema!==PERFORMANCE_SCHEMA||!Array.isArray(state.proposals)||!Array.isArray(state.audience)||!Array.isArray(state.stagePlans))
  throw new TypeError('Invalid production state');
 const find=(coll,k,label)=>{const v=coll.find(x=>x.id===k);if(!v)throw new RangeError('Unknown '+label);return v;};
 function dispatch(command,actor){
  checkActor(actor);
  if(!command||typeof command.type!=='string')throw new TypeError('Missing production command');
  if(!authorize({actor,command:clone(command),state:clone(state)}))
   throw new Error('Production command not authorized by host');
  const next=clone(state),at=clock();
  const receipt={type:command.type},type=command.type;
  if(type==='create-project'){
   only(command,['type','title','sourceTitle','rights','visualBrief'],'project');
   if(next.project)throw new Error('Production project already exists');
   if(!RIGHTS.includes(command.rights))throw new TypeError('Explicit licensed/owned/public domain rights required');
   next.project={id:id(),title:bounded(command.title,180,'production title'),
    sourceTitle:bounded(command.sourceTitle,180,'source title'),rights:command.rights,
    visualBrief:bounded(command.visualBrief,1500,'original visual brief'),status:'development',createdAt:at};
   receipt.project=clone(next.project);
  }else{
   if(!next.project)throw new Error('Create a project first');
   if(type==='add-source'){
    only(command,['type','chapter','text','sourceRef'],'source');
    if(actor.kind!=='human')throw new Error('Manuscript import requires a human');
    if(next.sources.length>=STAGE_LIMITS.sourceChunks)throw new TypeError('Source chunk limit reached');
    const entry={id:id(),chapter:bounded(command.chapter,120,'chapter'),
     text:bounded(command.text,STAGE_LIMITS.sourceChars,'manuscript chunk'),
     sourceRef:optional(command.sourceRef,180,'source reference'),
     rights:next.project.rights,addedAt:at};
    next.sources.push(entry);receipt.source={id:entry.id,chapter:entry.chapter};
   }else if(type==='propose-scenes'){
    only(command,['type','scenes'],'scene proposal batch');
    const raws=arr(command.scenes,actor.kind==='model'?3:16,'scenes',1);
    if(next.proposals.length+raws.length>STAGE_LIMITS.scenes)throw new TypeError('Scene count limit');
    const sourceIds=new Set(next.sources.map(s=>s.id));
    const existing=new Set(next.proposals.map(x=>x.slug));
    const proposed=raws.map(raw=>validateScene(raw,sourceIds));
    for(const item of proposed){
     if(existing.has(item.slug))throw new TypeError('Scene slug already exists; revisions require a new proposal');
     existing.add(item.slug);
    }
    receipt.proposals=[];
    for(const scene of proposed){
     const entry={...scene,id:id(),status:'review-required',
      proposedBy:actor.principalId,actorKind:actor.kind,createdAt:at,reviewedAt:null};
     next.proposals.push(entry);receipt.proposals.push(entry.id);
    }
   }else if(type==='review-scene'){
    only(command,['type','sceneId','decision','notes'],'scene review');
    if(actor.kind!=='human')throw new Error('Only humans can approve screenplay scenes');
    const scene=find(next.proposals,command.sceneId,'scene');
    if(scene.status!=='review-required')throw new Error('Scene already reviewed');
    if(!['approved','rejected'].includes(command.decision))throw new TypeError('Invalid review decision');
    scene.status=command.decision;scene.reviewedAt=at;scene.reviewedBy=actor.principalId;
    scene.reviewNotes=bounded(command.notes,700,'review notes');
    receipt.sceneId=scene.id;receipt.decision=scene.status;
   }else if(type==='propose-stage'){
    only(command,['type','sceneId','set','note'],'stage proposal');
    const scene=find(next.proposals,command.sceneId,'scene');
    if(scene.status!=='approved')throw new Error('Screenplay must be approved before set replanning');
    if(next.stagePlans.length>=300)throw new TypeError('Stage revision history limit reached');
    if(next.stagePlans.some(p=>p.sceneId===scene.id&&p.status==='review-required'))
     throw new Error('Resolve pending stage review before proposing another');
    const record={id:id(),sceneId:scene.id,set:validateSet(command.set),
     note:bounded(command.note,700,'set revision rationale'),status:'review-required',
     proposedBy:actor.principalId,actorKind:actor.kind,createdAt:at,reviewedAt:null};
    next.stagePlans.push(record);receipt.stagePlan=record.id;
   }else if(type==='review-stage'){
    only(command,['type','stagePlanId','decision','notes'],'stage review');
    if(actor.kind!=='human')throw new Error('Stage set approval is human only');
    const record=find(next.stagePlans,command.stagePlanId,'stage plan');
    if(record.status!=='review-required')throw new Error('Stage plan already reviewed');
    if(!['approved','rejected'].includes(command.decision))throw new TypeError('Invalid stage decision');
    record.status=command.decision;record.reviewedBy=actor.principalId;
    record.reviewedAt=at;record.reviewNotes=bounded(command.notes,700,'set review notes');
    receipt.stagePlan=record.id;receipt.decision=record.status;
   }else if(type==='assign-cast'){
    only(command,['type','character','avatarRef','pilotPrincipalId','voiceRef'],'cast');
    if(actor.kind!=='human')throw new Error('Cast bindings require human review');
    const char=identifier(command.character,'character');
    if(next.casts.length>=STAGE_LIMITS.cast&&!next.casts.some(c=>c.character===char))throw new TypeError('Too many cast roles');
    const cast={character:char,avatarRef:identifier(command.avatarRef,'avatar reference'),
     pilotPrincipalId:identifier(command.pilotPrincipalId,'pilot principal'),
     voiceRef:command.voiceRef?identifier(command.voiceRef,'voice reference'):null,
     approvedBy:actor.principalId};
    next.casts=next.casts.filter(c=>c.character!==char).concat(cast);
    receipt.cast=char;
   }else if(type==='start-rehearsal'){
    only(command,['type','sceneId'],'rehearsal');
    if(actor.kind!=='human')throw new Error('Rehearsal start requires human authorization');
    const scene=find(next.proposals,command.sceneId,'scene');
    if(scene.status!=='approved')throw new Error('Review and approve the screenplay first');
    if(next.rehearsals.some(r=>r.status==='running'))throw new Error('Another rehearsal is active');
    const run={id:id(),sceneId:scene.id,status:'running',startedAt:at,events:[],finishedAt:null};
    next.rehearsals.push(run);receipt.rehearsal=run.id;
   }else if(type==='perform-cue'){
    only(command,['type','rehearsalId','lineIndex','outcome','notes'],'cue');
    const run=find(next.rehearsals,command.rehearsalId,'rehearsal');
    if(run.status!=='running')throw new Error('Rehearsal is not running');
    const scene=find(next.proposals,run.sceneId,'scene');
    const index=number(command.lineIndex,0,scene.dialogue.length-1,'line index');
    if(run.events.length>=500)throw new TypeError('Rehearsal event cap reached');
    if(!['played','skipped','interrupted'].includes(command.outcome))throw new TypeError('Invalid cue result');
    run.events.push({type:'cue',index,outcome:command.outcome,
     actorKind:actor.kind,notes:optional(command.notes,250,'cue notes'),at});
    receipt.rehearsal=run.id;
   }else if(type==='finish-rehearsal'){
    only(command,['type','rehearsalId'],'rehearsal finish');
    if(actor.kind!=='human')throw new Error('Human must close rehearsal');
    const run=find(next.rehearsals,command.rehearsalId,'rehearsal');
    if(run.status!=='running')throw new Error('Rehearsal not running');
    run.status='finished';run.finishedAt=at;receipt.rehearsal=run.id;
   }else if(type==='submit-audience'){
    only(command,['type','rehearsalId','momentId','kind','text','consent'],'audience response');
    if(actor.kind!=='audience')throw new Error('Audience entries require verified audience principals');
    only(command.consent,['participation','training'],'consent');
    if(command.consent.participation!==true)throw new Error('Participation consent required');
    if(typeof command.consent.training!=='boolean')throw new TypeError('Explicit training consent choice required');
    const run=find(next.rehearsals,command.rehearsalId,'rehearsal');
    if(run.status!=='running')throw new Error('Audience may respond only during a live rehearsal');
    const scene=find(next.proposals,run.sceneId,'scene'),moment=scene.moments.find(m=>m.id===command.momentId);
    if(!moment)throw new RangeError('Unknown audience invitation moment');
    if(!['text','transcript','reaction'].includes(command.kind))throw new TypeError('Unsupported response type');
    if(next.audience.length>=STAGE_LIMITS.feedback)throw new TypeError('Audience feedback limit');
    const response={id:id(),rehearsalId:run.id,sceneId:scene.id,momentId:moment.id,
     kind:command.kind,text:bounded(command.text,STAGE_LIMITS.feedbackChars,'feedback'),
     principalId:actor.principalId,consent:{participation:true,training:command.consent.training},
     status:'retained',receivedAt:at};
    next.audience.push(response);receipt.responseId=response.id;
   }else if(type==='withdraw-audience'){
    only(command,['type','responseId'],'audience withdrawal');
    const response=find(next.audience,command.responseId,'audience response');
    if(actor.kind!=='human'&&!(actor.kind==='audience'&&actor.principalId===response.principalId))
     throw new Error('Only the participant or authorized human moderator may withdraw');
    if(response.status!=='retained')throw new Error('Response already withdrawn');
    response.status='withdrawn';response.text='';response.principalId='';
    response.consent={participation:false,training:false};response.withdrawnAt=at;
    receipt.withdrawn=response.id;
   }else throw new TypeError('Unknown production command type');
  }
  next.revision++;
  next.journal.push(makeReceipt(type,actor,at,next.revision));
  if(next.journal.length>STAGE_LIMITS.history)next.journal.shift();
  state=next;
  return clone({...receipt,revision:next.revision});
 }
 return Object.freeze({dispatch,snapshot:()=>clone(state)});
}
/** Read-only state subsets are appropriate for model prompts and event logs.
 * Never send full private manuscript or audience responses to unrelated models.
 */
export function performanceObservation(state){
 if(state?.schema!==PERFORMANCE_SCHEMA)throw new TypeError('Invalid performance state');
 return {schema:PERFORMANCE_SCHEMA,revision:state.revision,project:state.project&&
  {id:state.project.id,title:state.project.title,rights:state.project.rights,status:state.project.status},
  sources:state.sources.map(x=>({id:x.id,chapter:x.chapter,characters:x.text.length})),
  scenes:state.proposals.map(x=>({id:x.id,title:x.title,status:x.status,sourceIds:x.sourceIds,
   lines:x.dialogue.length,moments:x.moments.length})),
  cast:state.casts.map(x=>({character:x.character,avatarRef:x.avatarRef})),
  stagePlans:state.stagePlans.map(p=>({id:p.id,sceneId:p.sceneId,status:p.status})),
  activeRehearsal:state.rehearsals.find(x=>x.status==='running')?.id||null,
  audienceCounts:{received:state.audience.filter(x=>x.status==='retained').length,
   trainingEligible:state.audience.filter(x=>x.status==='retained'&&x.consent.training).length}};
}
