/**
 * Worldweaver film bones: one canonical scene source, bounded directed shots,
 * deterministic reel assembly and consent-limited evidence-based training.
 * No Gemini calls, ArtCraft jobs, source uploads or Codex approvals occur here.
 */
import {PERFORMANCE_SCHEMA} from './worldweaver-performance-studio-v1.mjs';
export const FILM_BONES_SCHEMA='civweave.film-bones.v1';
export const SHOT_BATCH_SCHEMA='civweave.film-shot-batch.v1';
export const TRAINING_SCHEMA='civweave.film-director-training.v1';
export const SHOT_FPS=24;
const ids=/^[a-zA-Z0-9][a-zA-Z0-9:._/-]{0,179}$/;
const sizes=['extreme-wide','wide','medium','medium-close','close-up','extreme-close'];
const moves=['locked','pan','tilt','dolly','truck','crane','orbit','handheld'];
const object=(o,label,keys)=>{
 if(!o||typeof o!=='object'||Array.isArray(o))throw new TypeError(label+' must be an object');
 const extra=Object.keys(o).filter(k=>!keys.includes(k));
 if(extra.length)throw new TypeError('Unexpected '+label+' fields: '+extra.join(', '));
 return o;
};
const str=(s,label,n=600)=>{if(typeof s!=='string'||!s.trim()||s.length>n)throw new TypeError('Invalid '+label);return s.trim();};
const optional=(s,label,n=600)=>s==null?'':str(s,label,n);
const ref=(s,label)=>{s=str(s,label,180);if(!ids.test(s)||s.includes('..'))throw new TypeError('Invalid '+label);return s;};
const arr=(v,label,max,min=0)=>{if(!Array.isArray(v)||v.length<min||v.length>max)throw new TypeError('Invalid '+label+' count');return v;};
const point=(p,label)=>{
 object(p,label,['x','y','z']);
 for(const k of ['x','y','z'])if(typeof p[k]!=='number'||!Number.isFinite(p[k])||Math.abs(p[k])>1000)throw new TypeError('Invalid '+label+'.'+k);
 return {...p};
};
const requireState=state=>{
 if(state?.schema!==PERFORMANCE_SCHEMA||!state.project||!['owned','licensed','public-domain'].includes(state.project.rights))
  throw new Error('Rights-cleared production required');
 return state;
};
const reviewedScene=(state,id)=>{
 requireState(state);
 const scene=state.proposals.find(x=>x.id===id);
 if(!scene||scene.status!=='approved'||!scene.reviewedBy)
  throw new Error('Scene needs authenticated human approval before film planning');
 return scene;
};
export function validateShotBatch(state,batch){
 object(batch,'shot batch',['schema','sceneId','productionRevision','shots','draftProvider','draftModel','receiptId']);
 if(batch.schema!==SHOT_BATCH_SCHEMA)throw new TypeError('Invalid shot batch schema');
 const scene=reviewedScene(state,ref(batch.sceneId,'scene ID'));
 if(!Number.isSafeInteger(batch.productionRevision)||batch.productionRevision<1||
  batch.productionRevision>state.revision)throw new Error('Invalid production revision');
 const cast=new Set(scene.dialogue.map(l=>l.character)),allowedSources=new Set(scene.sourceIds),seen=new Set();
 const shots=arr(batch.shots,'shots',24,1).map((shot,i)=>{
  object(shot,'shot',['id','durationFrames','storyBeat','action','camera','blocking','continuity','soundReference','sourceIds','authorInsightIds']);
  const id=ref(shot.id,'shot ID');
  if(seen.has(id))throw new Error('Duplicate shot ID');seen.add(id);
  if(!Number.isInteger(shot.durationFrames)||shot.durationFrames<48||shot.durationFrames>360)
   throw new Error('Shot duration must be 2–15 seconds at 24 fps');
  const c=object(shot.camera,'camera',['size','move','lensMm','start','end','focus']);
  if(!sizes.includes(c.size)||!moves.includes(c.move)||!Number.isFinite(c.lensMm)||
   c.lensMm<12||c.lensMm>200)throw new Error('Invalid camera grammar');
  const focus=c.focus==null?null:ref(c.focus,'camera focus');
  if(focus&&!cast.has(focus))throw new Error('Camera focuses on an actor absent from approved scene');
  const blocking=arr(shot.blocking,'blocking',24).map(b=>{
   object(b,'actor blocking',['character','from','to','gesture','purpose']);
   const character=ref(b.character,'actor');
   if(!cast.has(character))throw new Error('Blocking mentions actor absent from approved scene');
   return {character,from:point(b.from,'actor start'),to:point(b.to,'actor end'),
    gesture:optional(b.gesture,'gesture',200),purpose:str(b.purpose,'intention',260)};
  });
  if(new Set(blocking.map(b=>b.character)).size!==blocking.length)throw new Error('Duplicate actor blocking');
  const k=object(shot.continuity,'continuity',['incoming','outgoing','props','light']);
  const s=object(shot.soundReference,'reference audio',['ambience','foley','music','dialogue']);
  const sources=arr(shot.sourceIds,'shot source references',3,1).map(x=>ref(x,'source ID'));
  if(sources.some(x=>!allowedSources.has(x)))throw new Error('Shot cites excerpt absent from approved scene');
  const authorInsightIds=arr(shot.authorInsightIds??[],'insight references',32).map(x=>ref(x,'insight ID'));
  return {id,sceneId:scene.id,order:i,durationFrames:shot.durationFrames,
   storyBeat:str(shot.storyBeat,'story beat',240),action:str(shot.action,'action',1000),
   camera:{size:c.size,move:c.move,lensMm:c.lensMm,start:point(c.start,'camera start'),
    end:point(c.end,'camera end'),focus},
   blocking,continuity:{incoming:str(k.incoming,'continuity in',420),
    outgoing:str(k.outgoing,'continuity out',420),props:arr(k.props,'props',24).map(x=>str(x,'prop',100)),
    light:str(k.light,'lighting',220)},
   soundReference:{ambience:optional(s.ambience,'ambience',300),
    foley:optional(s.foley,'foley',300),music:optional(s.music,'music',300),
    dialogue:optional(s.dialogue,'dialogue',300),status:'temporary-reference-only',
    finalAudioAuthority:'human-directed-replacement'},
   sourceIds:sources,authorInsightIds,assetRef:null,renderStatus:'not-rendered'};
 });
 return {schema:SHOT_BATCH_SCHEMA,sceneId:scene.id,productionRevision:batch.productionRevision,
  draftProvider:batch.draftProvider?str(batch.draftProvider,'draft provider',80):'unverified-manual',
  draftModel:batch.draftModel?str(batch.draftModel,'model',100):'not-recorded',
  receiptId:batch.receiptId?ref(batch.receiptId,'receipt'):null,shots};
}
/**
 * The caller owns real selected-model inference/streaming/rate limits.
 * Do not send unpublished source text: this prompt contains only the approved
 * scene and individually approved author-insight notes, after remote consent.
 */
export function makeGeminiShotTask(state,sceneId,{insights=[],selectedModel,remoteSourceConsent=false}={}){
 const scene=reviewedScene(state,sceneId);
 if(remoteSourceConsent!==true)throw new Error('Explicit Gemini transmission consent required');
 const model=str(selectedModel,'selected Gemini model',100);
 if(!/^gemini[-\w.]+$/i.test(model))throw new Error('Selected model must be a Gemini model');
 const notes=arr(insights,'author insights',32).map(i=>{
  object(i,'author insight',['id','note','approvedForModel']);
  return {id:ref(i.id,'insight ID'),note:str(i.note,'insight note',1000),
   approvedForModel:i.approvedForModel===true};
 }).filter(i=>i.approvedForModel);
 const example={id:'shot_001',durationFrames:120,storyBeat:'Visible turning point',action:'A single playable action',
  camera:{size:'wide',move:'dolly',lensMm:35,start:{x:0,y:-8,z:2},end:{x:0,y:-6,z:2},focus:null},
  blocking:[{character:scene.dialogue[0].character,from:{x:0,y:0,z:0},
   to:{x:1,y:0,z:0},gesture:'turn',purpose:'answer the invitation'}],
  continuity:{incoming:'Start state',outgoing:'End state',props:[],light:'Window light'},
  soundReference:{ambience:'Room tone',foley:'Footsteps',music:'Temp mood reference',dialogue:'Temp delivery'},
  sourceIds:scene.sourceIds.slice(0,1),authorInsightIds:notes.map(n=>n.id).slice(0,1)};
 return {schema:'civweave.film-gemini-shot-task.v1',provider:'gemini',model,
  purpose:'worldweaver-film-shot-proposals',productionRevision:state.revision,sceneId,
  format:'json',maxShots:24,messages:[
   {role:'system',content:'Draft bounded, filmable, original shots for this approved screenplay. Return strict JSON only. Do not invent canon, source IDs, scene approvals, actual renders or ArtCraft import support. Escalate complex story interpretation and technical design issues to the editor rather than improvising false certainty.'},
   {role:'user',content:JSON.stringify({schema:SHOT_BATCH_SCHEMA,scene:{
    id:scene.id,title:scene.title,synopsis:scene.synopsis,sourceIds:scene.sourceIds,
    dialogue:scene.dialogue,set:scene.set,visualDirection:scene.visualDirection},
    approvedAuthorInsights:notes,example,productionRevision:state.revision,
    rules:['Return schema, sceneId, productionRevision and 1–24 shots','24fps; 48–360 frames per shot',
     'One principal action and camera move per shot','Show objective actor positions and eye-lines',
     'No invented source or unauthorized inner thoughts','Preserve screen direction, props and lighting',
     'Keep references limited to provided source/insight IDs']})}
  ],notes:'Record actual Gemini request, stream, completion and provider receipt separately.'};
}
export function assembleFilmBones(state,batches,{targetMinutes=90}={}){
 requireState(state);
 if(!Number.isFinite(targetMinutes)||targetMinutes<1||targetMinutes>240)throw new TypeError('Invalid runtime target');
 arr(batches,'shot batches',1000,1);
 const approved=state.proposals.filter(s=>s.status==='approved'&&s.reviewedBy);
 const order=new Map(approved.map((s,i)=>[s.id,i]));
 const shots=[],seen=new Set(),covered=new Set();let prev=-1,atFrame=0;
 for(const input of batches){
  const batch=validateShotBatch(state,input),sceneIndex=order.get(batch.sceneId);
  if(sceneIndex<prev)throw new Error('Scene batches must follow approved screenplay order');
  prev=sceneIndex;covered.add(batch.sceneId);
  for(const shot of batch.shots){
   if(seen.has(shot.id))throw new Error('Duplicate global shot ID');seen.add(shot.id);
   if(shots.length>=12000)throw new Error('Feature sequence exceeds shot cap');
   shots.push({...shot,order:shots.length,startFrame:atFrame,endFrame:atFrame+shot.durationFrames,
    artcraft:{type:'shot-direction-manifest',nativeImportVerified:false,
     prompt:[shot.camera.size+' shot, '+shot.camera.move+' camera, '+shot.camera.lensMm+'mm lens.',
      'Action: '+shot.action,'Blocking: '+shot.blocking.map(b=>b.character+' from '+
       JSON.stringify(b.from)+' to '+JSON.stringify(b.to)+'; '+b.gesture).join('; '),
      'Lighting: '+shot.continuity.light,'Continuity out: '+shot.continuity.outgoing,
      'Temporary audio: expressive ambience, foley and dramatic sound as reference only. Final dialogue, effects and music are human directed and rebuilt.'].join('\n')}});
   atFrame+=shot.durationFrames;
  }
 }
 const targetFrames=Math.round(targetMinutes*60*SHOT_FPS),
  missingScenes=approved.filter(s=>!covered.has(s.id)).map(s=>s.id);
 return {schema:FILM_BONES_SCHEMA,projectId:state.project.id,title:state.project.title,
  sourceRevision:state.revision,sourceRights:state.project.rights,
  editorTarget:'ArtCraft shot-direction handoff (not native project import)',fps:SHOT_FPS,
  estimatedSeconds:atFrame/SHOT_FPS,targetSeconds:targetFrames/SHOT_FPS,
  missingSeconds:Math.max(0,targetFrames-atFrame)/SHOT_FPS,approvedSceneCount:approved.length,
  coveredSceneCount:covered.size,missingScenes,status:missingScenes.length||atFrame<targetFrames?
   'incomplete-movie-bones':'full-runtime-bones-awaiting-direction-review',
  soundPolicy:{generatedSound:'best-effort-temporary-reference',
   finalSound:'human-directed-separate-dialogue-foley-ambience-music',
   preserveReferenceAudio:true,useReferenceAudioInFinalMix:false},
  shotCount:shots.length,shots,
  disclaimers:['Shot prompts are directions, not rendered media','No native ArtCraft importer is verified',
   'Actual render receipts must come from the renderer','Target length is not license to invent filler']};
}
export function makeCodexFilmTask({repo='cerbanimo-dev/Civweave',branch,baseCommit,goal,inputs=[],acceptance=[]}={}){
 const b=ref(branch,'branch'),sha=str(baseCommit,'base commit',80);
 if(!/^[a-f0-9]{40}$/.test(sha))throw new Error('Codex task needs a verified base commit SHA');
 return {schema:'civweave.codex-film-review-task.v1',repo:ref(repo,'repo'),branch:b,baseCommit:sha,
  role:'implementation-editor-and-test-operator-not-human-authority',goal:str(goal,'goal',900),
  inputs:arr(inputs,'input refs',30).map(x=>ref(x,'input artifact')),
  acceptance:arr(acceptance,'acceptance checks',30,1).map(x=>str(x,'check',350)),
  workflow:['claim with identity and source revision','add failing test','implement in canonical Worldweaver owner',
   'run tests; attach real receipts','submit patch with SHA-256 and wait for explicit apply',
   'record actual applied commit and host acknowledgement'],
  escalationTriggers:['unknown ArtCraft import mapping','ambiguous author intent or chronology',
   'unverified renderer effects','model diverges from source','privacy, rights or budget uncertainty'],
  status:'unassigned',humanApproval:false};
}
const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0;};
/**
 * Training examples are fully observed approved work. No private chain of
 * thought, invented model results, raw manuscripts or non-consenting audiences.
 */
export function exportCivweaveFilmTraining(records,{ownerTrainingAuthorization=false}={}){
 if(ownerTrainingAuthorization!==true)throw new Error('Source-owner training opt-in required');
 const examples=arr(records,'reviewed records',10000).map(r=>{
  object(r,'training record',['projectId','sceneId','sourceDigest','rights','trainingConsent',
   'model','modelReceipt','operatorPatch','humanReview','input','approvedOutput']);
  if(r.trainingConsent!==true||!['owned','licensed','public-domain'].includes(r.rights))
   throw new Error('Training record lacks rights and opt-in');
  if(!/^sha256:[a-f0-9]{64}$/.test(r.sourceDigest))throw new Error('Cryptographic source digest required');
  if(r.model?.provider!=='gemini'||!r.model.name||!r.modelReceipt?.id||r.modelReceipt.status!=='success')
   throw new Error('Actual Gemini inference receipt required');
  if(!/^[a-f0-9]{40}$/.test(r.operatorPatch?.commitSha||'')||r.operatorPatch.status!=='applied')
   throw new Error('Applied Codex patch receipt required');
  if(r.humanReview?.decision!=='approved'||!r.humanReview?.reviewerRef)
   throw new Error('Human producer approval required');
  return {projectId:ref(r.projectId,'project'),sceneId:ref(r.sceneId,'scene'),
   sourceDigest:r.sourceDigest,task:'film-shot-direction',
   messages:[{role:'system',content:'Plan an original cinematic shot with explicit timing, camera and actor blocking. Preserve approved source and raise ambiguity.'},
    {role:'user',content:str(r.input,'sanitized brief',12000)}],
   response:str(r.approvedOutput,'approved shot plan',24000),
   provenance:{sourceRights:r.rights,geminiModel:str(r.model.name,'model',100),
    geminiReceiptId:ref(r.modelReceipt.id,'receipt'),codexAppliedCommit:r.operatorPatch.commitSha,
    producerReviewRef:ref(r.humanReview.reviewerRef,'review')}};
 });
 const train=[],valid=[];
 for(const e of examples)(hash(e.projectId)%5===0?valid:train).push(JSON.stringify(e));
 return {schema:TRAINING_SCHEMA,format:'jsonl',training:train.join('\n')+(train.length?'\n':''),
  validation:valid.join('\n')+(valid.length?'\n':''),count:examples.length,
  grouping:'project-id; prevent scene leakage',containsRawManuscript:false,
  containsPrivateReasoning:false,includesAudienceData:false,
  note:'This is an observed, rights-cleared dataset export, not a fine-tuned model.'};
}
