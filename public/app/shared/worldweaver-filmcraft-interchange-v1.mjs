/**
 * FilmCraft / Creator Suite hand-off and consent-limited Qwen3.5 4B data export.
 *
 * These are portable offline interchange packages, not direct integration with
 * the ArtCraft family, rendered clips, or a completed animated movie.
 */
import {PERFORMANCE_SCHEMA} from './worldweaver-performance-studio-v1.mjs';
import {compilePerformanceScore,compileStageScene} from './worldweaver-stagecraft-v1.mjs?v=threshold-device-review-v2';
const stable=(value)=>{
 let hash=2166136261;
 for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);}
 return hash>>>0;
};
const checked=state=>{
 if(state?.schema!==PERFORMANCE_SCHEMA||!state.project||!['owned','licensed','public-domain'].includes(state.project.rights))
  throw new TypeError('Verified source rights and a valid production are required');
 return state.proposals.filter(s=>s.status==='approved');
};
const vttTime=s=>{
 const ms=Math.round(Math.max(0,s)*1000);
 const hh=Math.floor(ms/3600000),mm=Math.floor(ms/60000)%60,ss=Math.floor(ms/1000)%60;
 return [hh,mm,ss].map(n=>String(n).padStart(2,'0')).join(':')+'.'+String(ms%1000).padStart(3,'0');
};
export function screenplayToVTT(state,sceneId){
 const scene=checked(state).find(s=>s.id===sceneId);
 if(!scene)throw new Error('Scene must be approved before subtitle export');
 const score=compilePerformanceScore(state,sceneId);
 return 'WEBVTT\n\n'+score.events.filter(e=>e.type==='dialogue').map((e,i)=>
  (i+1)+'\n'+vttTime(e.at)+' --> '+vttTime(e.until)+'\n'+
  e.character+': '+e.text.replace(/[\r\n]+/g,' ')+'\n\n').join('');
}
export function exportFilmCraftInterchange(state,{requireScenes=true}={}){
 const scenes=checked(state);
 if(requireScenes&&!scenes.length)throw new Error('No human-approved scenes available for film export');
 const edit=[],mediaRequests=[],subtitles=[];
 let offset=0;
 for(const scene of scenes){
  const score=compilePerformanceScore(state,scene.id);
  // A timeline editor can pair media references when generated assets actually
  // exist. No false clip URLs or imagery/audio are included in this manifest.
  const shotId='shot:'+scene.id+':wide';
  edit.push({sceneId:scene.id,title:scene.title,shotId,track:'visual',
   start:offset,duration:score.seconds,assetId:null,status:'awaiting-visual-media',
   setLocation:scene.set.location,visualDirection:scene.visualDirection,
   characterRefs:state.casts.filter(x=>scene.dialogue.some(l=>l.character===x.character))
    .map(x=>({character:x.character,avatarRef:x.avatarRef,voiceRef:x.voiceRef}))});
  for(const e of score.events){
   if(e.type==='dialogue')edit.push({sceneId:scene.id,track:'dialogue',
    start:offset+e.at,duration:e.until-e.at,character:e.character,
    text:e.text,assetId:null,status:'awaiting-performed-audio'});
   else edit.push({sceneId:scene.id,track:'audience-interaction-marker',
    start:offset+e.at,duration:e.until-e.at,prompt:e.prompt,
    renderedContent:false,requiresConsent:true});
  }
  mediaRequests.push({sceneId:scene.id,kind:'3d-stage-and-animation',
   storyboardStatus:'stage-mockup-only',background:scene.set.location,
   prompt:scene.visualDirection||scene.synopsis,
   assets:[],licenseReviewRequired:true});
  subtitles.push({sceneId:scene.id,filename:'scene-'+scene.id.replace(/[^a-zA-Z0-9_-]/g,'_')+'.vtt',
   content:screenplayToVTT(state,scene.id)});
  offset+=score.seconds;
 }
 return {schema:'civweave.filmcraft-interchange.v1',sourceProject:state.project.id,
  title:state.project.title,sourceTitle:state.project.sourceTitle,rights:state.project.rights,
  seconds:offset,sceneCount:scenes.length,
  editorialStatus:'approved-scripts-await-generated-media',
  editorTarget:'FilmCraft / Civweave Creator Suite video editor via explicit import mapping',
  edit,mediaRequests,subtitles,
  provenance:{sceneIds:scenes.map(s=>s.id),productionRevision:state.revision},
  note:'This is a scene/timeline planning export, NOT a full-length rendered movie or a native FilmCraft project file.'};
}

const trailerCopy=value=>structuredClone(value);
const trailerFields=(value,keys,label)=>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError(label+' must be an object');
 if(Object.keys(value).some(key=>!keys.includes(key)))throw new TypeError('Unexpected '+label+' fields');
};
const trailerText=(value,max,label)=>{
 if(typeof value!=='string'||!value.trim()||value.length>max)throw new TypeError('Invalid '+label+' text');
 return value;
};
const trailerId=(value,label)=>{
 const id=trailerText(value,180,label);
 if(!/^[A-Za-z0-9][A-Za-z0-9:._/-]*$/.test(id)||id.includes('..'))throw new TypeError('Invalid '+label+' reference');
 return id;
};
const trailerList=(value,max,label)=>{
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>max)throw new TypeError('Invalid '+label+' count');
 return value;
};
function trailerRange(value,lower,upper,label){
 if(!Number.isSafeInteger(value.inFrame)||!Number.isSafeInteger(value.outFrame)||value.inFrame<lower||value.outFrame>upper||value.outFrame<=value.inFrame)
  throw new TypeError('Invalid '+label+' frame timing; use a positive half-open range within its shot');
 return {inFrame:value.inFrame,outFrame:value.outFrame};
}
function trailerVector(value){
 trailerFields(value,['x','y','z'],'blocking position');
 if(!['x','y','z'].every(key=>typeof value[key]==='number'&&Number.isFinite(value[key]))||value.x<0||value.x>256||value.y<0||value.y>256||value.z<0||value.z>64)
  throw new TypeError('Invalid blocking position in the provisional region');
 return {x:value.x,y:value.y,z:value.z};
}
function trailerNonoverlap(rows,label,group=()=> 'track'){
 const ends=new Map();
 for(const row of [...rows].sort((a,b)=>a.inFrame-b.inFrame)){
  const key=group(row);if(row.inFrame<(ends.get(key)??0))throw new TypeError('Overlapping '+label+' timing');
  ends.set(key,row.outFrame);
 }
}
const captionText=value=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/[\r\n]+/g,' ');

/** Proposed character design requirements only. These never create cast bindings. */
export function normalizeRigRequirements(rows,{characters}={}){
 const known=new Set(characters??[]),seen=new Set();
 return trailerCopy(trailerList(rows,64,'rig requirements').map(row=>{
  trailerFields(row,['character','bodyType','appearanceNotes','movementNotes','voiceNotes','rigReference','skeleton','proportions'],'rig requirement');
  trailerText(row.character,120,'rig character');
  if(!known.has(row.character))throw new TypeError('Unknown canonical character in rig requirement');
  if(seen.has(row.character))throw new TypeError('Duplicate character rig requirement');seen.add(row.character);
  if(!['humanoid','creature','other'].includes(row.bodyType))throw new TypeError('Unsupported proposed rig body type');
  const result={character:row.character,bodyType:row.bodyType};
  for(const name of ['appearanceNotes','movementNotes','voiceNotes','rigReference'])if(row[name]!==undefined)result[name]=row[name]===''?'':trailerText(row[name],name==='rigReference'?240:1200,'rig '+name);
  if(row.skeleton!==undefined){
   trailerFields(row.skeleton,['controls','notes'],'proposed rig skeleton');const names=new Set();
   const controls=trailerList(row.skeleton.controls,64,'rig skeleton controls').map(control=>{
    trailerFields(control,['name','kind','min','max'],'rig skeleton control');trailerText(control.name,80,'rig control');
    if(names.has(control.name))throw new TypeError('Duplicate rig skeleton control');names.add(control.name);
    if(!['bone','ik','blendshape'].includes(control.kind))throw new TypeError('Unsupported rig skeleton control kind');
    if((control.min===undefined)!==(control.max===undefined))throw new TypeError('Rig control limits require both min and max');
    if(control.min!==undefined&&(!Number.isFinite(control.min)||!Number.isFinite(control.max)||control.min< -360||control.max>360||control.max<control.min))throw new TypeError('Invalid bounded rig control limits');
    return {...control};
   });
   result.skeleton={controls};if(row.skeleton.notes!==undefined)result.skeleton.notes=row.skeleton.notes===''?'':trailerText(row.skeleton.notes,1200,'rig skeleton notes');
  }
  if(row.proportions!==undefined){
   const bounds={heightMeters:[0.05,20],headToBodyRatio:[0.02,1],armSpanMeters:[0.05,40],legToBodyRatio:[0,1]};
   trailerFields(row.proportions,Object.keys(bounds),'proposed rig proportions');result.proportions={};
   for(const [name,value]of Object.entries(row.proportions)){const [min,max]=bounds[name];if(!Number.isFinite(value)||value<min||value>max)throw new TypeError('Invalid bounded rig proportion');result.proportions[name]=value}
  }
  return result;
 }));
}

/**
 * Build a portable, editable, exactly thirty-second trailer REVIEW package.
 * `shots` use global half-open integer frame intervals. This projection never
 * edits production records or grants producer, world, render or import authority.
 * Unapproved scripts retain their status: stagecraft's approval gate is never
 * bypassed by temporarily marking proposals approved. Their staging stays pending.
 * Scene IDs are immutable proposal identities; productionRevision binds their
 * canonical snapshot because the source owner has no independent scene revision.
 */
export function exportArtCraftTrailerPackage(state,options={}){
 trailerFields(options,['title','frameRate','shots','sourceProvenance','rigRequirements'],'trailer option');
 checked(state);
 if(!Number.isSafeInteger(state.revision)||state.revision<1||!Array.isArray(state.sources)||!Array.isArray(state.casts))throw new TypeError('Revisioned canonical production state required');
 const fps=options.frameRate??30;
 if(![24,25,30,48,50,60].includes(fps))throw new TypeError('Use an explicit supported integer frame rate');
 const totalFrames=30*fps,rawShots=trailerList(options.shots,32,'trailer shots');
 if(!rawShots.length)throw new TypeError('At least one trailer shot is required');
 const selectedIds=[...new Set(rawShots.map(shot=>shot?.sceneId))],selected=selectedIds.map(sceneId=>{
  const scene=state.proposals.find(row=>row.id===sceneId);
  if(!scene)throw new RangeError('Unknown trailer scene reference');
  if(!['approved','review-required'].includes(scene.status))throw new Error('A rejected scene cannot enter the trailer review package');
  if(!Array.isArray(scene.sourceIds)||scene.sourceIds.some(id=>!state.sources.some(source=>source.id===id)))throw new Error('Scene source references must resolve to canonical source records');
  return scene;
 });
 if(selected.length>16)throw new TypeError('At most sixteen canonical scenes may enter one trailer package');
 const scores=new Map(),stages=selected.map(scene=>{
  if(scene.status!=='approved')return {sceneId:scene.id,productionRevision:state.revision,status:'awaiting-producer-review',region:null,score:null,worldExecution:false};
  const stage=compileStageScene(state,scene.id),score=compilePerformanceScore(state,scene.id);scores.set(scene.id,score);
  return {sceneId:scene.id,productionRevision:state.revision,status:'provisional-mockup',region:stage.region,cast:stage.cast,approvedStagePlanId:stage.approvedStagePlanId,score,worldExecution:false};
 });
 const jobs=[],captions=[],shotIds=new Set();let end=0;
 function job(kind,shot,details,needsMedia=false){
  const id='trailer-job:'+shot.id+':'+kind+':'+jobs.length;
  jobs.push({...details,id,kind,shotId:shot.id,sceneId:shot.sceneId,productionRevision:state.revision,inFrame:details.inFrame??shot.inFrame,outFrame:details.outFrame??shot.outFrame,status:needsMedia?'missing-media':'proposed',assetId:null,execution:'not-started',reviewRequired:true});
  return id;
 }
 const shots=rawShots.map(raw=>{
  trailerFields(raw,['id','sceneId','inFrame','outFrame','dialogue','propIds','blocking','camera','lighting','sound','screenCues'],'trailer shot');
  const id=trailerId(raw.id,'shot');if(shotIds.has(id))throw new TypeError('Duplicate shot reference');shotIds.add(id);
  const timing=trailerRange(raw,0,totalFrames,'shot');
  if(timing.inFrame!==end)throw new TypeError('Trailer shots must be contiguous with no gaps or overlaps');end=timing.outFrame;
  const scene=selected.find(row=>row.id===raw.sceneId),stage=stages.find(row=>row.sceneId===scene.id),characters=new Set(scene.dialogue.map(line=>line.character));
  const set=stage.approvedStagePlanId?state.stagePlans.find(row=>row.id===stage.approvedStagePlanId).set:scene.set;
  const propIds=raw.propIds===undefined?set.props.map(prop=>prop.id):trailerList(raw.propIds,24,'shot prop references').map(value=>trailerId(value,'prop'));
  if(new Set(propIds).size!==propIds.length||propIds.some(propId=>!set.props.some(prop=>prop.id===propId)))throw new TypeError('Unknown or duplicate scene prop reference');
  const shot={id,sceneId:scene.id,productionRevision:state.revision,...timing,seconds:(timing.outFrame-timing.inFrame)/fps,propIds};
  const dialogue=trailerList(raw.dialogue,16,'shot dialogue').map(cue=>{
   trailerFields(cue,['lineIndex','inFrame','outFrame'],'dialogue cue');
   if(!Number.isSafeInteger(cue.lineIndex)||cue.lineIndex<0||cue.lineIndex>=scene.dialogue.length)throw new TypeError('Unknown canonical dialogue line reference');
   const range=trailerRange(cue,shot.inFrame,shot.outFrame,'dialogue shot'),line=scene.dialogue[cue.lineIndex];
   const scoreLine=scores.get(scene.id)?.events.filter(event=>event.type==='dialogue')[cue.lineIndex],seconds=scoreLine?scoreLine.until-scoreLine.at:line.seconds;
   if(seconds!=null&&Math.abs((range.outFrame-range.inFrame)-seconds*fps)>1e-7)throw new TypeError('Dialogue duration must match the canonical line timing; revise the scene rather than silently retime speech');
   const row={sceneId:scene.id,lineIndex:cue.lineIndex,character:line.character,text:line.text,direction:line.direction,...range,timingStatus:seconds==null?'proposed-needs-audio-conform':'declared-script-timing'};
   captions.push(row);return row;
  });
  trailerNonoverlap(dialogue,'dialogue');
  const blocking=trailerList(raw.blocking,32,'blocking cues').map(cue=>{
   trailerFields(cue,['character','inFrame','outFrame','from','to','action','description'],'blocking cue');
   if(!characters.has(cue.character))throw new TypeError('Unknown scene character in blocking reference');
   if(!['hold','walk','turn','gesture'].includes(cue.action))throw new TypeError('Unsupported basic movement action');
   return {character:cue.character,...trailerRange(cue,shot.inFrame,shot.outFrame,'blocking shot'),from:trailerVector(cue.from),to:trailerVector(cue.to),action:cue.action,description:cue.description==null?'':trailerText(cue.description,600,'blocking direction'),coordinateSpace:'opensim-style-region-meters',execution:'not-started'};
  });
  trailerNonoverlap(blocking,'character movement',cue=>cue.character);
  let camera={framing:'wide',movement:'locked',description:'Proposed establishing shot; refine in the target editor.'};
  if(raw.camera!==undefined){
   trailerFields(raw.camera,['framing','movement','description'],'camera');
   if(!['establishing','wide','medium','close-up','detail','over-shoulder'].includes(raw.camera.framing)||!['locked','pan','tilt','dolly','push-in','pull-out','orbit','tracking'].includes(raw.camera.movement))throw new TypeError('Unsupported camera framing or movement');
   camera={framing:raw.camera.framing,movement:raw.camera.movement,description:trailerText(raw.camera.description,800,'camera direction')};
  }
  const lighting=raw.lighting==null?set.light||'Lighting design requires target-editor review.':trailerText(raw.lighting,800,'lighting direction');
  const soundIds=new Set(),sound=trailerList(raw.sound,12,'sound cues').map(cue=>{
   trailerFields(cue,['id','kind','inFrame','outFrame','description'],'sound cue');
   const soundId=trailerId(cue.id,'sound');if(soundIds.has(soundId))throw new TypeError('Duplicate sound reference');soundIds.add(soundId);
   if(!['music','ambience','effect'].includes(cue.kind))throw new TypeError('Unsupported sound job kind');
   return {id:soundId,kind:cue.kind,...trailerRange(cue,shot.inFrame,shot.outFrame,'sound shot'),description:trailerText(cue.description,1000,'sound direction')};
  });
  const screenCues=trailerList(raw.screenCues,12,'screen cues').map(cue=>{
   trailerFields(cue,['inFrame','outFrame','text'],'screen cue');
   const text=trailerText(cue.text,500,'screen cue');
   if(/<\/?[A-Za-z][^>]*>|javascript:|data:text\/html|(?:^|\s)on\w+\s*=/i.test(text)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))throw new TypeError('Screen cues must be plain text without markup or executable script');
   return {...trailerRange(cue,shot.inFrame,shot.outFrame,'screen cue shot'),text,renderAs:'plain-text'};
  });
  trailerNonoverlap(screenCues,'screen cue');
  const visualJob=job('visual-media',shot,{setSceneId:scene.id,direction:scene.visualDirection||scene.synopsis,propIds},true);
  job('camera',shot,{camera});job('lighting',shot,{lighting});
  for(const cue of blocking)job('rig-animation',shot,{...cue},true);
  for(const cue of dialogue)job('performed-dialogue',shot,{...cue},true);
  for(const cue of sound)job('sound',shot,{...cue,soundCueId:cue.id,soundKind:cue.kind},true);
  for(const cue of screenCues)job('screen-text',shot,{...cue});
  return {...shot,dialogue,blocking,camera,lighting,sound,screenCues,visualAssetId:null,visualJob,status:'review-required'};
 });
 if(end!==totalFrames)throw new TypeError('Trailer shots must cover exactly thirty seconds (30 seconds)');
 const selectedSourceIds=[...new Set(selected.flatMap(scene=>scene.sourceIds))],sourceProvenance=options.sourceProvenance??{};
 trailerFields(sourceProvenance,['manuscriptRef','edition','sourceHash'],'source provenance');
 const suppliedProvenance={};
 if(sourceProvenance.manuscriptRef!==undefined)suppliedProvenance.manuscriptRef=trailerId(sourceProvenance.manuscriptRef,'manuscript');
 if(sourceProvenance.edition!==undefined)suppliedProvenance.edition=trailerText(sourceProvenance.edition,240,'source edition');
 if(sourceProvenance.sourceHash!==undefined){if(typeof sourceProvenance.sourceHash!=='string'||!/^sha256:[a-f0-9]{64}$/.test(sourceProvenance.sourceHash))throw new TypeError('Source hash must be an explicit SHA-256 reference');suppliedProvenance.sourceHash=sourceProvenance.sourceHash;suppliedProvenance.hashVerification='caller-supplied-not-verified-by-exporter'}
 const characters=[...new Set(selected.flatMap(scene=>scene.dialogue.map(line=>line.character)))],rigRequirements=normalizeRigRequirements(options.rigRequirements,{characters});
 const rigBindings=characters.map(character=>{
  const cast=state.casts.find(row=>row.character===character);
  return {character,avatarRef:cast?.avatarRef??null,voiceRef:cast?.voiceRef??null,pilotPrincipalId:cast?.pilotPrincipalId??null,bindingApprovedBy:cast?.approvedBy??null,status:cast?'bound-awaiting-rig-validation':'awaiting-rig-binding',animationExecuted:false};
 });
 const content='WEBVTT\n\n'+captions.sort((a,b)=>a.inFrame-b.inFrame).map((cue,index)=>`${index+1}\n${vttTime(cue.inFrame/fps)} --> ${vttTime(cue.outFrame/fps)}\n${captionText(cue.character+': '+cue.text)}\n\n`).join('');
 const approved=selected.filter(scene=>scene.status==='approved');
 return trailerCopy({schema:'civweave.artcraft-trailer-package.v1',title:options.title===undefined?state.project.title+' · 30-second trailer':trailerText(options.title,240,'trailer title'),sourceProject:state.project.id,seconds:30,frameRate:fps,totalFrames,frameConvention:'half-open [inFrame,outFrame)',reviewStatus:'review-required',producerAuthorization:{status:'pending',authorizedBy:null,scope:'exact-trailer-timeline-and-assets'},nativeArtCraftImportVerified:false,rendered:false,worldExecution:false,
  target:{product:'ArtCraft / FilmCraft',mode:'portable-editorial-handoff',nativeImportMapping:'not-verified'},
  provenance:{sourceProjectId:state.project.id,productionRevision:state.revision,sceneIds:selectedIds,sourceIds:selectedSourceIds,sourceTitle:state.project.sourceTitle,rightsDeclaration:state.project.rights,sources:selectedSourceIds.map(id=>{const row=state.sources.find(source=>source.id===id);return {id:row.id,chapter:row.chapter,sourceRef:row.sourceRef||null,rightsDeclaration:row.rights||state.project.rights}}),...suppliedProvenance,rawManuscriptIncluded:false,audienceContentIncluded:false},
  scenes:selected.map(scene=>{const stage=stages.find(row=>row.sceneId===scene.id),plan=stage.approvedStagePlanId?state.stagePlans.find(row=>row.id===stage.approvedStagePlanId):null;return {sceneId:scene.id,productionRevision:state.revision,reviewStatus:scene.status,title:scene.title,synopsis:scene.synopsis,sourceIds:scene.sourceIds,dialogue:scene.dialogue,set:plan?.set||scene.set,screenplaySet:scene.set,approvedStagePlanId:plan?.id||null,visualDirection:scene.visualDirection}}),
  shots,stages,rigBindings,...(options.rigRequirements===undefined?{}:{rigRequirements}),jobs,missingMedia:jobs.filter(row=>row.status==='missing-media').map(row=>({jobId:row.id,kind:row.kind,shotId:row.shotId,sceneId:row.sceneId,assetId:null,status:'missing'})),
  captions:{filename:'trailer.vtt',format:'webvtt',content,rendered:false},
  filmCraftInterchange:approved.length?exportFilmCraftInterchange({...state,proposals:approved}):null,
  notes:['This is a thirty-second editable review package, not rendered video or a verified native ArtCraft project.','Approved scene compilation remains a provisional stage mockup; review-required proposals are never staged by bypassing approval.','Camera, lighting, voice, sound, animation and screen cues are unexecuted job intents. Actual assets, licenses, rigs and timings need producer and target-editor review.','Source references and supplied hashes are provenance metadata; this exporter does not independently verify a manuscript edition or infer rights.']});
}
function sceneRecord(state,scene){
 const sourceChunks=scene.sourceIds.map(id=>state.sources.find(s=>s.id===id)).filter(Boolean);
 return {
  messages:[
   {role:'system',content:'Adapt a rights-cleared manuscript excerpt into a scene with grounded character dialogue, stage set notes and audience reflection moments. Return JSON only.'},
   {role:'user',content:'Visual brief: '+state.project.visualBrief+'\nSource passages:\n'+JSON.stringify(sourceChunks.map(s=>({chapter:s.chapter,text:s.text.slice(0,8000)})))}
  ],
  response:{slug:scene.slug,title:scene.title,synopsis:scene.synopsis,dialogue:scene.dialogue,
   set:scene.set,moments:scene.moments,visualDirection:scene.visualDirection},
  provenance:{sourceIds:scene.sourceIds,sceneId:scene.id,
   reviewedByHuman:Boolean(scene.reviewedBy),reviewNotes:scene.reviewNotes||'',
   sourceRights:state.project.rights,sourceProjectId:state.project.id},
  task:'screenplay-adaptation'
 };
}
export function exportQwenLoRADataset(state,{trainingAuthorized=false,includeAudience=false}={}){
 const scenes=checked(state);
 if(trainingAuthorized!==true)throw new Error('Explicit source-owner training authorization required');
 if(!scenes.length)throw new Error('No reviewed training examples');
 const examples=scenes.map(s=>sceneRecord(state,s));
 let includedAudience=0;
 if(includeAudience){
  for(const response of state.audience){
   if(response.status!=='retained'||response.consent?.participation!==true||
    response.consent?.training!==true)continue;
   // Deliberately no principal identifier, face/emotion inference, raw audio,
   // hidden user profile or non-consented metadata.
   const scene=scenes.find(x=>x.id===response.sceneId);
   if(!scene)continue;
   const moment=scene.moments.find(m=>m.id===response.momentId);
   if(!moment)continue;
   includedAudience++;
   examples.push({
    messages:[
     {role:'system',content:'Summarize a voluntary audience response for a fictional rehearsal without inferring identity or mental state.'},
     {role:'user',content:moment.prompt}
    ],response:{audienceSuggestion:response.text,interactionMode:moment.mode},
    provenance:{sceneId:scene.id,momentId:moment.id,audienceConsent:true,
     sourceRights:state.project.rights},task:'audience-moment-response'});
  }
 }
 // Group scene-derived records together. No audience response is ever included
 // unless both participant training consent and separate operator opt-in exist.
 const training=[],validation=[];
 for(const example of examples){
  const group=example.provenance.sceneId;
  (stable(group)%5===0?validation:training).push(JSON.stringify(example));
 }
 return {schema:'civweave.qwen-screenplay-sft-v1',modelTarget:'qwen3.5:4b',
  format:'jsonl',training:training.join('\n')+(training.length?'\n':''),
  validation:validation.join('\n')+(validation.length?'\n':''),
  count:examples.length,consentedAudienceIncluded:includedAudience,
  excludedAudience:state.audience.length-includedAudience,
  warnings:[
   'Samples are reviewed screenplay outputs, not fabricated hidden model reasoning.',
   'For a useful LoRA, collect many diverse verified scenes, critique/revision pairs and measured performance outcomes.',
   'Splits are deterministic per scene to reduce train/validation leakage.',
   'This creates dataset files only; no Qwen training job has run. Train and deploy only through consented model tooling.'
  ]};
}
