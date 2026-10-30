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
