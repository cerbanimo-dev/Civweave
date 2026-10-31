/**
 * Optional campaign controls embedded by the ONE canonical guide-chat surface.
 * Owns no chat transcript, composer, global input handler, or inference runtime.
 * This browser-only author preview cannot establish multiplayer identities.
 */
import {validatePersonaPack} from './persona-library-v1.mjs';
import {importCampaignSnapshot,exportCampaignSnapshot} from './persona-campaign-v1.mjs';
import {createPersonaChatRuntime} from './persona-chat-turn-v1.mjs';

const el=(root,name)=>root.querySelector('[data-persona-'+name+']');
const small=(value,max=400)=>String(value??'').trim().slice(0,max);
const allowedModel=id=>/^[a-zA-Z0-9_.:/-]{1,100}$/.test(id);
export function createPersonaChatControls({root,onModeChange=()=>{}}={}){
 if(!root?.querySelector)throw new TypeError('The existing guide-chat root is required.');
 const button=el(root,'toggle'),panel=el(root,'panel');
 if(!button||!panel)throw new TypeError('Persona chat controls are not mounted in canonical guide chat.');
 let cast=null,campaign=null,session=null,enabled=false,loading=false;
 const status=message=>{const x=el(root,'status');if(x)x.textContent=small(message,1000);};
 const switchOn=value=>{
   enabled=Boolean(value);button.setAttribute('aria-pressed',String(enabled));
   button.textContent=enabled?'Cast: on':'Cast';
   onModeChange(enabled);
 };
 const stop=()=>{session=null;switchOn(false);};
 async function acceptFile(input,limit,label){
   const file=input?.files?.[0];
   if(!file)throw new TypeError('Choose '+label+' JSON file.');
   if(file.size>limit)throw new RangeError(label+' exceeds safe size.');
   return JSON.parse(await file.text());
 }
 function speakers(){
   const control=el(root,'speaker');const selected=control?.value;
   control?.replaceChildren();
   for(const id of campaign?.cast||[]){
     const c=cast.characters.find(row=>row.id===id);
     if(!c)continue;
     const option=document.createElement('option');option.value=id;option.textContent=c.name;control.append(option);
   }
   if(campaign?.cast.includes(selected))control.value=selected;
 }
 async function model(req){
   const runtime=globalThis.CivweaveModelRuntime;
   const cfg=runtime?.readSharedConfig?.('agentic')||runtime?.readSharedConfig?.('interactive');
   if(!cfg?.provider||['manual','deterministic'].includes(cfg.provider))
     throw new Error('Choose an installed local or explicitly consented provider in Civweave AI settings.');
   if(!['ollama','openai-compatible','compatible','local-api'].includes(String(cfg.provider).toLowerCase()))
     throw new Error('Persona role switching currently requires Ollama or an OpenAI-compatible endpoint.');
   if(runtime?.endpointLeavesDevice?.(cfg)&&el(root,'consent')?.checked!==true)
     throw new Error('Explicit per-turn remote manuscript consent is required.');
   const tier=req.modelTier;
   const chosen=el(root,tier==='4b'?'director-model':tier==='2b'?'inner-model':'actor-model');
   const modelId=small(chosen?.value,100);
   if(!allowedModel(modelId))throw new TypeError('Enter the installed '+tier+' model ID.');
   // Reuse the canonical selected-provider inference route. This module does
   // not fetch an endpoint itself, start a second model, or install weights.
   const {runCodeInference}=await import('/creator-suite/shared/code-inference-route-v1.mjs');
   const loaders=await import('/creator-suite/shared/creator-inference-loaders-v1.mjs');
   const reply=await runCodeInference({...cfg,model:modelId},req.messages,{
     selection:loaders.currentCreatorLocalSelection(),
     loadLocal:loaders.loadCreatorLocalRuntime,
     loadServer:loaders.loadCreatorServerRuntime,
     sharedRuntime:runtime,purpose:req.purpose,taskTier:'complex',
     mediaType:'text',maxTokens:Math.min(2048,Math.max(512,req.maxOutputTokens||650)),
     requiresTools:false
   });
   if(reply?.status!=='success'||reply?.fallback?.provider==='deterministic')
     throw new Error('The selected persona model failed; no other model was substituted.');
   if(reply?.actual?.model&&reply.actual.model!==modelId)
     throw new Error('The selected endpoint returned a different model; refusing an unverified persona result.');
   return reply;
 }
 button.addEventListener('click',()=>{panel.hidden=!panel.hidden;});
 el(root,'load').addEventListener('click',async()=>{
   if(loading)return;
   loading=true;stop();
   try{
     // Both files require explicit user selection. Never silently reuse a
     // previous guide's memory or a private browser storage key.
     const p=validatePersonaPack(await acceptFile(el(root,'pack'),1200000,'persona manifest'));
     const s=importCampaignSnapshot(JSON.stringify(await acceptFile(el(root,'save'),200000,'campaign save')),{pack:p});
     cast=p;campaign=s;speakers();
     status('Private '+s.branchId+' loaded for '+s.cast.length+' characters. Use Activate to play; no model requests yet.');
   }catch(error){cast=null;campaign=null;status('Import rejected: '+small(error?.message||error,400));}
   finally{loading=false;}
 });
 el(root,'activate').addEventListener('click',()=>{
   try{
     if(!cast||!campaign)throw new Error('Import matching cast and campaign files first.');
     const owner={kind:'human',principalId:campaign.ownerId};
     // This is specifically a PRIVATE LOCAL AUTHOR preview. User-supplied
     // IDs are never admitted to authenticated multiplayer services.
     session=createPersonaChatRuntime({
       pack:cast,campaign,actor:owner,
       authorize:({actor})=>actor?.kind==='human'&&actor.principalId===campaign.ownerId,
       invokeModel:model
     });
     switchOn(true);
     status('Private preview active in Weaveling chat. Responses are fictional and proposed actions remain unexecuted. Export your save before leaving.');
   }catch(error){stop();status(small(error?.message||error,400));}
 });
 el(root,'end').addEventListener('click',()=>{stop();status('Campaign preview off. Normal guide chat resumed; imported data remains only in this tab.');});
 el(root,'export').addEventListener('click',()=>{
   try{
     const snapshot=session?.snapshot()||campaign;
     if(!snapshot)throw new Error('No campaign loaded.');
     const data=exportCampaignSnapshot(snapshot);
     const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
     const a=document.createElement('a');a.href=url;a.download='persona-campaign-'+snapshot.id.replace(/[^a-zA-Z0-9-]/g,'_')+'.json';
     document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
     status('Private campaign exported. Share only with trusted participants; it includes your dialogue.');
   }catch(error){status('Export failed: '+small(error?.message||error));}
 });
 return Object.freeze({
   active:()=>enabled&&Boolean(session),
   respond:async({text,systemId}={})=>{
     if(!enabled||!session||systemId!=='civweave')throw new Error('Private persona mode is not active in Civweave chat.');
     try{
       const id=el(root,'speaker')?.value;
       status('Playing '+id+' with the selected model; no world actions are authorized.');
       const result=await session.respond({characterId:id,input:small(text,1200)});
       campaign=result.campaign;
       status('Turn '+campaign.turn+' · '+campaign.branchId+' · '+(result.needsRefresh?'4B refresh next cue':'improv ready')+'. Export explicitly to keep progress.');
       return result.packet;
     }finally{if(el(root,'consent'))el(root,'consent').checked=false;}
   },
   dispose:()=>{stop();cast=null;campaign=null;status('Campaign data released from this tab.');}
 });
}
