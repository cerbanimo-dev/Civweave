/** Local file adapter for the canonical Performance Studio. No inference or approval. */
import {createPerformanceStudio} from './worldweaver-performance-studio-v1.mjs';
import {exportArtCraftTrailerPackage,normalizeRigRequirements} from './worldweaver-filmcraft-interchange-v1.mjs?v=threshold-device-review-v1';
export {normalizeRigRequirements};
export const TRAILER_AUTHORING_SCHEMA='civweave.trailer-authoring.v1';
export const MAX_TRAILER_AUTHORING_BYTES=2*1024*1024;
const copy=value=>structuredClone(value);
export const TRAILER_DEVICE_REVIEW_SCHEMA='civweave.trailer-device-review.v1';
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}return value};
const bounded=value=>{if(new TextEncoder().encode(JSON.stringify(value)).byteLength>MAX_TRAILER_AUTHORING_BYTES)throw new TypeError('Bounded review history exceeds 2 MiB; explicitly export before starting another review');return value};

/** Plain data file projections share canonical validation; no media is executed. */
export function buildTrailerFileViews({state,trailer,overlay}={}){
 const pkg=exportArtCraftTrailerPackage(state,trailer),json=value=>JSON.stringify(value,null,2);
 const file=(id,filename,mimeType,content,editKind=null)=>({id,filename,mimeType,content,editable:editKind!==null,editKind});
 const script=pkg.scenes.map(scene=>[scene.title,scene.synopsis,'Set: '+scene.set.location,'Light: '+scene.set.light,...scene.dialogue.map(line=>line.character+': '+line.text+(line.direction?' ('+line.direction+')':''))].join('\n')).join('\n\n');
 return freeze(bounded([
  file('metadata','production-metadata.json','application/json',json({schema:pkg.schema,title:pkg.title,sourceProject:pkg.sourceProject,provenance:pkg.provenance,seconds:pkg.seconds,frameRate:pkg.frameRate,totalFrames:pkg.totalFrames,producerAuthorization:pkg.producerAuthorization,worldExecution:false,rendered:false,nativeArtCraftImportVerified:false})),
  file('script','screenplay.txt','text/plain',script,'reimport-authoring'),
  file('captions',pkg.captions.filename,'text/vtt',pkg.captions.content,'reimport-authoring'),
  file('camera','camera-lighting.json','application/json',json(pkg.shots.map(shot=>({shotId:shot.id,inFrame:shot.inFrame,outFrame:shot.outFrame,camera:shot.camera,lighting:shot.lighting}))),'replace-plan'),
  file('audio','audio-cues.json','application/json',json(pkg.shots.map(shot=>({shotId:shot.id,dialogue:shot.dialogue,sound:shot.sound}))),'replace-plan'),
  file('jobs','production-jobs.json','application/json',json({jobs:pkg.jobs,missingMedia:pkg.missingMedia,execution:'not-started'})),
  file('blocking','blocking-cues.json','application/json',json(pkg.shots.map(shot=>({shotId:shot.id,blocking:shot.blocking}))),'replace-blocking'),
  file('rig-requirements','rig-requirements.json','application/json',json({status:'proposed-only',requirements:pkg.rigRequirements??[],bindingAuthority:false}),'set-rig-requirements'),
  file('plan','trailer-plan.json','application/json',json(trailer),'replace-plan'),
  file('package','trailer-review-package.json','application/json',json(pkg)),
  ...(overlay===undefined?[]:[file('review-history','production-overlay.json','application/json',json(savedReviewMetadata(overlay,pkg)))])
 ]));
}

/**
 * A bounded memory-only editorial session. Every accepted revision retains its
 * prior plan, validates through the canonical exporter and requires the exact
 * visible revision. History contains proposed output, never manuscript passages.
 */
export function createTrailerDeviceReview({state,trailer,receipt=null,clock=()=>new Date().toISOString(),id}={}){
 let production=copy(state),plan=copy(trailer),pkg=exportArtCraftTrailerPackage(production,plan),revision=1;
 let latestReceipt=copy(receipt),history=[{revision,productionRevision:production.revision,kind:'imported-plan',recordedAt:clock(),plan:copy(plan),package:copy(pkg)}];
 const projectSnapshot=(currentState,currentPlan,currentPackage,currentRevision,currentHistory)=>freeze(copy(bounded({schema:TRAILER_DEVICE_REVIEW_SCHEMA,revision:currentRevision,productionRevision:currentState.revision,plan:currentPlan,package:currentPackage,rigRequirements:currentPackage.rigRequirements??[],history:currentHistory,authenticatedProducer:false,producerAuthorization:'pending',execution:'not-started',persistence:'memory-only'})));
 const snapshot=()=>projectSnapshot(production,plan,pkg,revision,history);
 snapshot();
 // These two cloned reads are for the trusted, local lab session only. Neither
 // private production state nor manuscript passages enter snapshot/file history.
 return Object.freeze({snapshot,productionSnapshot:()=>copy(production),importReceipt:()=>copy(latestReceipt),files:()=>buildTrailerFileViews({state:production,trailer:plan,overlay:snapshot()}),applyPatch(patch){
  fields(patch,['type','expectedRevision','shotId','cueIndex','cue','rigRequirements','trailer','authoring'],'authored review patch');
  if(!Number.isSafeInteger(patch.expectedRevision)||patch.expectedRevision!==revision)throw new Error('The device review revision changed; reload the current revision before applying this edit');
  if(history.length>=32)throw new Error('The bounded review history is full; explicitly export before starting another review');
  let nextState=production,nextPlan=copy(plan),nextReceipt=latestReceipt;
  if(patch.type==='replace-plan'){
   fields(patch,['type','expectedRevision','trailer'],'replace plan patch');nextPlan=copy(patch.trailer);
  }else if(patch.type==='replace-blocking'){
   fields(patch,['type','expectedRevision','shotId','cueIndex','cue'],'replace blocking patch');
   const shot=nextPlan.shots.find(row=>row.id===patch.shotId);
   if(!shot||!Number.isSafeInteger(patch.cueIndex)||patch.cueIndex<0||patch.cueIndex>=(shot.blocking?.length??0))throw new TypeError('Unknown existing blocking cue reference');
   shot.blocking[patch.cueIndex]=copy(patch.cue);
  }else if(patch.type==='set-rig-requirements'){
   fields(patch,['type','expectedRevision','rigRequirements'],'rig requirements patch');nextPlan.rigRequirements=copy(patch.rigRequirements);
  }else if(patch.type==='reimport-authoring'){
   fields(patch,['type','expectedRevision','authoring'],'reimport authoring patch');
   const imported=importTrailerAuthoring(patch.authoring,{clock,...(id?{id}:{})});nextState=imported.state;nextPlan=imported.trailer;nextReceipt=imported.receipt;
  }else throw new TypeError('Unsupported authored review patch');
  const nextPackage=exportArtCraftTrailerPackage(nextState,nextPlan),nextRevision=revision+1;
  const nextHistory=[...history,{revision:nextRevision,productionRevision:nextState.revision,kind:patch.type,recordedAt:clock(),plan:copy(nextPlan),package:copy(nextPackage)}];
  const nextSnapshot=projectSnapshot(nextState,nextPlan,nextPackage,nextRevision,nextHistory);
  production=copy(nextState);plan=nextPlan;pkg=nextPackage;history=nextHistory;revision=nextRevision;latestReceipt=copy(nextReceipt);return nextSnapshot;
 }});
}

function savedReviewMetadata(reviewData,packageData){
 fields(reviewData,['schema','revision','productionRevision','plan','package','rigRequirements','history','authenticatedProducer','producerAuthorization','execution','persistence'],'device review snapshot');
 if(reviewData.schema!==TRAILER_DEVICE_REVIEW_SCHEMA||!Number.isSafeInteger(reviewData.revision)||reviewData.revision<1||reviewData.productionRevision!==packageData.provenance.productionRevision||reviewData.authenticatedProducer!==false||reviewData.producerAuthorization!=='pending'||reviewData.execution!=='not-started')throw new TypeError('A current pending, unauthenticated device review snapshot is required');
 const withoutReceipt=value=>{const {localImportReceipt,...rest}=value??{};return rest};
 if(JSON.stringify(withoutReceipt(reviewData.package))!==JSON.stringify(withoutReceipt(packageData)))throw new TypeError('The saved review revision must match the exact exported package');
 const characters=packageData.rigBindings.map(row=>row.character),rigRequirements=normalizeRigRequirements(reviewData.rigRequirements,{characters});
 if(JSON.stringify(rigRequirements)!==JSON.stringify(packageData.rigRequirements??[]))throw new TypeError('Rig requirements must match the exported package');
 const history=list(reviewData.history,1,32,'review revision history').map((row,index)=>{
  fields(row,['revision','productionRevision','kind','recordedAt','plan','package'],'review history entry');
  if(row.revision!==index+1||!Number.isSafeInteger(row.productionRevision)||row.productionRevision<1||!['imported-plan','replace-plan','replace-blocking','set-rig-requirements','reimport-authoring'].includes(row.kind)||typeof row.recordedAt!=='string'||row.recordedAt.length>80)throw new TypeError('Invalid review revision provenance');
  fields(row.plan,['title','frameRate','shots','sourceProvenance','rigRequirements'],'historical trailer plan');
  fields(row.plan.sourceProvenance,['manuscriptRef','edition','sourceHash'],'historical source provenance');
  const pkg=row.package;
  fields(pkg,['schema','title','sourceProject','seconds','frameRate','totalFrames','frameConvention','reviewStatus','producerAuthorization','nativeArtCraftImportVerified','rendered','worldExecution','target','provenance','scenes','shots','stages','rigBindings','rigRequirements','jobs','missingMedia','captions','filmCraftInterchange','notes'],'historical exported package');
  if(pkg.schema!=='civweave.artcraft-trailer-package.v1'||pkg.producerAuthorization?.status!=='pending'||pkg.producerAuthorization.authorizedBy!==null||pkg.rendered!==false||pkg.worldExecution!==false||pkg.nativeArtCraftImportVerified!==false||pkg.provenance?.rawManuscriptIncluded!==false||pkg.provenance?.audienceContentIncluded!==false||pkg.provenance.productionRevision!==row.productionRevision)throw new TypeError('Historical packages must remain source-free, pending and unexecuted');
  fields(pkg.provenance,['sourceProjectId','productionRevision','sceneIds','sourceIds','sourceTitle','rightsDeclaration','sources','manuscriptRef','edition','sourceHash','hashVerification','rawManuscriptIncluded','audienceContentIncluded'],'historical package provenance');
  for(const source of list(pkg.provenance.sources,1,50,'historical source references'))fields(source,['id','chapter','sourceRef','rightsDeclaration'],'historical source reference');
  for(const scene of list(pkg.scenes,1,16,'historical scene outputs'))fields(scene,['sceneId','productionRevision','reviewStatus','title','synopsis','sourceIds','dialogue','set','screenplaySet','approvedStagePlanId','visualDirection'],'historical scene output');
  return copy(row);
 });
 if(history.length!==reviewData.revision||history.at(-1).productionRevision!==reviewData.productionRevision)throw new TypeError('Incomplete review revision provenance');
 if(JSON.stringify(withoutReceipt(history.at(-1).package))!==JSON.stringify(withoutReceipt(packageData))||JSON.stringify(history.at(-1).plan)!==JSON.stringify(reviewData.plan))throw new TypeError('The last history snapshot must match the exact current review revision');
 return bounded({schema:TRAILER_DEVICE_REVIEW_SCHEMA,revision:reviewData.revision,productionRevision:reviewData.productionRevision,rigRequirements,history,authenticatedProducer:false,producerAuthorization:'pending',execution:'not-started'});
}
/** Persist an immutable exported review snapshot in the existing Creator store. */
export async function saveTrailerReviewArtifact({store,runRef,packageData,reviewData,crypto=globalThis.crypto,clock=()=>new Date().toISOString()}={}){
 if(!store?.getArtifact||!store?.putArtifact)throw new Error('The canonical Creator artifact store is unavailable');
 if(typeof runRef!=='string'||!runRef.startsWith('creation-run:')||runRef.length>180)throw new TypeError('A saved creation run reference is required');
 const run=await store.getArtifact(runRef);
 if(run?.schema!=='civweave.creation-run.v1'||run.state!=='edited'||!run.passes?.some(pass=>pass.kind==='editorial-revision'))throw new Error('Use an editorially revised canonical creation run');
 if(packageData?.schema!=='civweave.artcraft-trailer-package.v1'||packageData.seconds!==30||packageData.totalFrames!==30*packageData.frameRate||packageData.producerAuthorization?.status!=='pending'||packageData.rendered!==false||packageData.worldExecution!==false||packageData.nativeArtCraftImportVerified!==false||packageData.provenance?.rawManuscriptIncluded!==false)throw new Error('Only a pending, unexecuted thirty-second review export may be saved here');
 if(!run.sourceRef?.hash||packageData.provenance.sourceHash!==run.sourceRef.hash)throw new Error('The trailer source hash does not match the creation run');
 const snapshot=copy(packageData),serialized=JSON.stringify(snapshot);
 if(new TextEncoder().encode(serialized).byteLength>MAX_TRAILER_AUTHORING_BYTES)throw new TypeError('Bounded review export exceeds 2 MiB');
 const digest='sha256:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(serialized))),v=>v.toString(16).padStart(2,'0')).join('');
 const id='production-export:'+crypto.randomUUID(),artifact={schema:'civweave.creator-export-artifact.v1',id,kind:'worldweaver-trailer-review',creationRunRef:run.id,creationRunRevision:run.revision,documentRef:run.artifactRef,documentRevision:run.artifactRevision,contentDigest:digest,createdAt:clock(),package:snapshot,authorization:'pending',execution:'not-started'};
 if(reviewData!==undefined)artifact.review=savedReviewMetadata(reviewData,snapshot);
 bounded(artifact);
 await store.putArtifact(artifact);
 return {artifactRef:id,contentDigest:digest,creationRunRef:run.id,creationRunRevision:run.revision,documentRevision:run.artifactRevision,sourceHash:run.sourceRef.hash,...(artifact.review?{reviewRevision:artifact.review.revision}:{}),producerAuthorization:'pending',execution:'not-started',persisted:true};
}
function fields(value,allowed,label){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError(label+' must be an object');
 if(Object.keys(value).some(key=>!allowed.includes(key)))throw new TypeError('Unexpected '+label+' fields');
}
function key(value,label){if(typeof value!=='string'||!/^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$/.test(value)||value.includes('..'))throw new TypeError('Invalid '+label+' key');return value;}
function list(value,min,max,label){if(!Array.isArray(value)||value.length<min||value.length>max)throw new TypeError('Invalid bounded '+label+' count');return value;}

/**
 * Accept the documented authoring format, never a pre-approved production dump.
 * The existing owner currently requires kind=human for source intake. The fixed
 * local actor below is explicitly synthetic/unverified and grants source intake
 * only; it is not authenticated producer approval. Editorial proposals use a
 * model/editor-agent principal, in the owner's existing three-scene batches.
 * The temporary studio is returned only after the exact trailer passes export
 * validation, so callers can replace a lab session atomically after explicit UI
 * consent. No source text is written to a DB or sent over the network here.
 */
export function importTrailerAuthoring(raw,{id=()=>crypto.randomUUID(),clock=()=>new Date().toISOString()}={}){
 const serialized=typeof raw==='string'?raw:JSON.stringify(raw);
 if(typeof serialized!=='string'||new TextEncoder().encode(serialized).byteLength>MAX_TRAILER_AUTHORING_BYTES)throw new TypeError('Private authoring file is too large; use at most 2 MiB');
 let input;try{input=JSON.parse(serialized)}catch{throw new TypeError('Authoring file must be valid JSON')}
 fields(input,['schema','project','sourceProvenance','sources','scenes','trailer'],'authoring format');
 if(input.schema!==TRAILER_AUTHORING_SCHEMA)throw new TypeError('Unsupported trailer authoring schema');
 fields(input.project,['title','sourceTitle','rights','visualBrief'],'project');
 fields(input.sourceProvenance,['manuscriptRef','sourceHash','edition'],'source provenance');
 key(input.sourceProvenance.manuscriptRef,'manuscript reference');
 if(typeof input.sourceProvenance.sourceHash!=='string'||!/^sha256:[a-f0-9]{64}$/.test(input.sourceProvenance.sourceHash))throw new TypeError('An explicit source SHA-256 hash is required');
 fields(input.trailer,['title','frameRate','shots','rigRequirements'],'trailer');
 const sources=list(input.sources,1,50,'source references'),scenes=list(input.scenes,1,16,'scenes');list(input.trailer.shots,1,32,'shots');
 const sourceActor={kind:'human',principalId:'lab:unverified-source-intake',verified:false},editorActor={kind:'model',principalId:'lab:editor-agent-authoring-import',verified:false};
 const studio=createPerformanceStudio({id,clock,authorize:({actor,command})=>
  actor.principalId===sourceActor.principalId&&actor.kind==='human'&&['create-project','add-source'].includes(command.type)||
  actor.principalId===editorActor.principalId&&actor.kind==='model'&&command.type==='propose-scenes'});
 studio.dispatch({type:'create-project',...copy(input.project)},sourceActor);
 const sourceMap=new Map(),sceneMap=new Map(),sceneDefinitions=[];
 for(const row of sources){
  fields(row,['key','chapter','text','sourceRef'],'source');const symbolic=key(row.key,'source');if(sourceMap.has(symbolic))throw new TypeError('Duplicate source key');
  const receipt=studio.dispatch({type:'add-source',chapter:row.chapter,text:row.text,...(row.sourceRef===undefined?{}:{sourceRef:row.sourceRef})},sourceActor);sourceMap.set(symbolic,receipt.source.id);
 }
 const sceneKeys=new Set();
 for(const row of scenes){
  fields(row,['key','title','synopsis','sourceKeys','dialogue','set','moments','runtimeSeconds','visualDirection'],'scene');
  const symbolic=key(row.key,'scene');if(sceneKeys.has(symbolic))throw new TypeError('Duplicate scene key');sceneKeys.add(symbolic);
  const refs=list(row.sourceKeys,1,10,'scene source keys').map(value=>{key(value,'source');if(!sourceMap.has(value))throw new TypeError('Unknown source key');return sourceMap.get(value)});
  const {key:_key,sourceKeys:_sources,...definition}=row;
  sceneDefinitions.push({symbolic,definition:{...copy(definition),slug:symbolic,sourceIds:refs,moments:row.moments??[]}});
 }
 for(let offset=0;offset<sceneDefinitions.length;offset+=3){
  const batch=sceneDefinitions.slice(offset,offset+3),receipt=studio.dispatch({type:'propose-scenes',scenes:batch.map(row=>row.definition)},editorActor);
  batch.forEach((row,index)=>sceneMap.set(row.symbolic,receipt.proposals[index]));
 }
 const state=studio.snapshot(),ids=[state.project.id,...state.sources.map(row=>row.id),...state.proposals.map(row=>row.id)];
 if(new Set(ids).size!==ids.length)throw new TypeError('Duplicate canonical identifiers from the local identity adapter');
 const shots=input.trailer.shots.map(row=>{
  fields(row,['id','sceneKey','inFrame','outFrame','dialogue','propIds','blocking','camera','lighting','sound','screenCues'],'authoring shot');
  if(!sceneMap.has(row.sceneKey))throw new TypeError('Unknown scene key');
  const {sceneKey:_scene,...shot}=row;return {...copy(shot),sceneId:sceneMap.get(row.sceneKey)};
 });
 const trailer={...copy(input.trailer),shots,sourceProvenance:copy(input.sourceProvenance)};
 const packageData=exportArtCraftTrailerPackage(state,trailer);
 const receipt={schema:'civweave.trailer-authoring-import.v1',sourceSchema:TRAILER_AUTHORING_SCHEMA,sourceProjectId:state.project.id,productionRevision:state.revision,importedAt:clock(),authenticatedProducer:false,producerAuthorization:'pending',sourceIntakeIdentity:{principalId:sourceActor.principalId,kind:sourceActor.kind,verified:false,scope:'synthetic-lab-source-intake-only'},editorialIdentity:{principalId:editorActor.principalId,kind:editorActor.kind,verified:false},sceneMap:Object.fromEntries(sceneMap),sourceMap:Object.fromEntries(sourceMap),inferenceInvocations:0,sourceRights:'caller-declared-not-independently-verified',persistence:'memory-only-until-explicit-private-file-export'};
 return {state,trailer,receipt,package:{...packageData,localImportReceipt:copy(receipt)}};
}
