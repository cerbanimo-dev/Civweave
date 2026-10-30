/**
 * Provider-neutral one-turn screenplay adaptation and bounded feedback loop.
 * A configured caller provides a real selected Civweave model adapter. The model
 * cannot approve its own screenplay, access unauthorized chunks, use a Guild
 * budget without host consent, or trigger production/publishing by itself.
 */
import {PERFORMANCE_SCHEMA} from './worldweaver-performance-studio-v1.mjs';
const decode=result=>{
 let raw=result?.outputJson??result?.scenes??result?.outputText??result?.text??result;
 if(Array.isArray(raw))return {scenes:raw};
 if(typeof raw==='string'){
  if(raw.length>36000)throw new TypeError('Model output too long');
  const trimmed=raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  try{raw=JSON.parse(trimmed)}catch{throw new TypeError('Model must return strict screenplay JSON')}
 }
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>k!=='scenes'))
  throw new TypeError('Model response must contain only scenes');
 return raw;
};
export function productionPrompt(state,sourceIds,{objective='Adapt this selection into a visually filmable screenplay scene.',maxScenes=3}={}){
 if(state?.schema!==PERFORMANCE_SCHEMA)throw new TypeError('Production state required');
 if(!Number.isInteger(maxScenes)||maxScenes<1||maxScenes>3)throw new TypeError('Small-model proposal batch must contain 1–3 scenes');
 const refs=sourceIds.map(id=>state.sources.find(s=>s.id===id));
 if(refs.length<1||refs.length>3||refs.some(x=>!x))throw new RangeError('Choose 1–3 actual manuscript excerpts');
 const segments=refs.map(x=>({id:x.id,chapter:x.chapter,text:x.text.slice(0,6000)}));
 return [
  {role:'system',content:'You are an original screenplay adaptation editor using a tracked tool. Return strict JSON only. Do not claim to have built 3D rigs, generated video, or actually performed the scene. You propose drafts for human approval.'},
  {role:'user',content:[
   'Produce up to '+maxScenes+' reviewable screenplay scenes. Use the provided source excerpts only; if material is missing, preserve uncertainty.',
   'Objective: '+String(objective).slice(0,1000),
   'Visual direction (original description, not a copied studio style): '+state.project.visualBrief,
   'Valid JSON object only: {"scenes":[{"slug":"chapter-a-scene-1","title":"Scene title","synopsis":"What happens","sourceIds":["exact-id"],"dialogue":[{"character":"character-id","text":"Spoken line","direction":"Gesture","seconds":8}],"set":{"location":"Stage area","mood":"Mood","color":"#445566","props":[{"id":"chair-1","name":"Chair","shape":"box","x":0,"y":0,"height":1,"width":1,"depth":1,"color":"#aa8877"}],"light":"warm backlight","ambience":"natural wind"},"moments":[{"id":"moment-1","afterLine":0,"prompt":"What might the character try?","mode":"reflection","use":"Pause without changing the established plot","maxSeconds":30}],"visualDirection":"Original scene art direction"}]}',
   'No executable scripts, direct app permissions, external research claims, identity inference, or actual audience data.',
   'Keep output bounded and screenplay dialogue original. Do not include hidden model deliberation.',
   'Source passages: '+JSON.stringify(segments)
  ].join('\n')}
 ];
}
export async function proposeScreenplayViaModel({studio,actor,sourceIds,objective,invokeModel,signal}={}){
 if(!studio?.snapshot||!studio?.dispatch||actor?.kind!=='model'||typeof invokeModel!=='function')
  throw new TypeError('Selected model invoker and externally verified model actor required');
 const initial=studio.snapshot(),revision=initial.revision;
 const messages=productionPrompt(initial,sourceIds,{objective,maxScenes:3});
 const result=await invokeModel({messages,format:'json',purpose:'worldweaver-adaptation-proposal',
  maxOutputTokens:2700,signal,revision});
 if(signal?.aborted)throw new Error('Adaptation generation cancelled');
 if(studio.snapshot().revision!==revision)throw new Error('Project changed while model generated; no stale script proposals accepted');
 if(result?.status&&result.status!=='success')throw new Error('Inference did not complete successfully');
 const parsed=decode(result);
 return studio.dispatch({type:'propose-scenes',scenes:parsed.scenes},actor);
}

/** A bounded set-change proposal. The result is reviewed by a human before a
 * stage renderer or OpenSimulator adapter receives any geometry updates.
 */
export async function proposeStageViaModel({studio,actor,sceneId,invokeModel,signal}={}){
 if(!studio?.snapshot||!studio?.dispatch||actor?.kind!=='model'||typeof invokeModel!=='function')
  throw new TypeError('Model and authenticated production studio required');
 const initial=studio.snapshot(),revision=initial.revision;
 const scene=initial.proposals.find(x=>x.id===sceneId);
 if(!scene||scene.status!=='approved')throw new Error('An approved screenplay is needed for stage redesign');
 const approved=initial.stagePlans?.filter(x=>x.sceneId===sceneId&&x.status==='approved').at(-1);
 const currentSet=approved?.set??scene.set;
 const response=await invokeModel({purpose:'worldweaver-stage-replan',format:'json',
  maxOutputTokens:1500,signal,revision,messages:[
   {role:'system',content:'You are a film stage designer. Return ONLY JSON {"set":{...},"note":"reason"}, never executable OpenSimulator or browser code. This is a proposal for human approval, not a live stage edit.'},
   {role:'user',content:'Design a simpler or more dramatic original physical stage arrangement from the approved screenplay. Preserve all dialogue and source intent. Existing set: '+JSON.stringify(currentSet)+
    '\nScene synopsis: '+scene.synopsis+'\nVisual direction: '+scene.visualDirection+
    '\nReturn a set with keys location,mood,color,props,light,ambience. Each prop has id,name,shape (box/cylinder),x,y,height,width,depth,color. Coordinates x/y -75..75, dimensions .1..35 meters and height .1..30, hex colors, up to 24 props. No unlicensed assets or third-party characters.'}
  ]});
 if(signal?.aborted)throw new Error('Stage redesign cancelled');
 if(studio.snapshot().revision!==revision)throw new Error('Project changed while model designed the stage');
 if(response?.status&&response.status!=='success')throw new Error('Stage inference failed');
 let raw=response?.outputJson??response?.outputText??response?.text??response;
 if(typeof raw==='string'){
  if(raw.length>24000)throw new TypeError('Stage proposal output too long');
  try{raw=JSON.parse(raw.trim())}catch{throw new TypeError('Model must return JSON for stage proposal')}
 }
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||!raw.set||
  Object.keys(raw).some(k=>!['set','note'].includes(k)))throw new TypeError('Expected stage set proposal JSON');
 return studio.dispatch({type:'propose-stage',sceneId,set:raw.set,
  note:String(raw.note||'Proposed stage geometry revision').slice(0,700)},actor);
}
