/**
 * FilmCraft / Creator Suite hand-off and consent-limited Qwen3.5 4B data export.
 *
 * These are portable offline interchange packages, not direct integration with
 * the ArtCraft family, rendered clips, or a completed animated movie.
 */
import {PERFORMANCE_SCHEMA} from './worldweaver-performance-studio-v1.mjs';
import {compilePerformanceScore} from './worldweaver-stagecraft-v1.mjs';
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
