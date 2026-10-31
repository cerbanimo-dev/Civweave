/**
 * Optional campaign controls embedded by the ONE canonical guide-chat surface.
 * Owns no chat transcript, composer, global input handler, or inference runtime.
 * This browser-only author preview cannot establish multiplayer identities.
 */
import {validatePersonaPack} from './persona-library-v1.mjs';
import {createPersonaCampaign,importCampaignSnapshot,exportCampaignSnapshot} from './persona-campaign-v1.mjs';
import {createPersonaChatRuntime} from './persona-chat-turn-v1.mjs';
import {createGuildPersonaClient} from './guild-persona-client-v1.mjs';

const el=(root,name)=>root.querySelector('[data-persona-'+name+']');
const small=(value,max=400)=>String(value??'').trim().slice(0,max);
const allowedModel=id=>/^[a-zA-Z0-9_.:/-]{1,100}$/.test(id);
export function createPersonaChatControls({root,onModeChange=()=>{}}={}){
 if(!root?.querySelector)throw new TypeError('The existing guide-chat root is required.');
 const button=el(root,'toggle'),panel=el(root,'panel');
 if(!button||!panel)throw new TypeError('Persona chat controls are not mounted in canonical guide chat.');
 let cast=null,campaign=null,session=null,guildRoom=null,enabled=false,loading=false;
 const guildClient=createGuildPersonaClient();
 const status=message=>{const x=el(root,'status');if(x)x.textContent=small(message,1000);};
 const switchOn=value=>{
   enabled=Boolean(value);button.setAttribute('aria-pressed',String(enabled));
   button.textContent=enabled?'Cast: on':'Cast';
   onModeChange(enabled);
 };
 const stop=()=>{session=null;guildRoom=null;switchOn(false);};
 const guildStatus=message=>{const x=el(root,'guild-status');if(x)x.textContent=small(message,800);};
 async function acceptFile(input,limit,label){
   const file=input?.files?.[0];
   if(!file)throw new TypeError('Choose '+label+' JSON file.');
   if(file.size>limit)throw new RangeError(label+' exceeds safe size.');
   return JSON.parse(await file.text());
 }
 function showWillpower(){
   const current=guildRoom||session?.snapshot()||campaign;
   const pool=current?.willpower,display=el(root,'willpower'),control=el(root,'control');
   if(display)display.textContent=pool?
     'Shared willpower: '+pool.points+'/'+pool.max+' · +1 per '+pool.renewEvery+' accepted turns':
     'Load a campaign to view shared willpower.';
   if(control){
     for(const option of control.options){
       if(option.value==='both')option.disabled=!pool||pool.points<2;
       else if(option.value==='landry'||option.value==='delia')
         option.disabled=!pool||pool.points<1;
     }
     if(control.selectedOptions[0]?.disabled)control.value='';
   }
 }
 function showGuildRoom(){
   const role=el(root,'guild-seat-role'),prior=role?.value;
   role?.replaceChildren();
   for(const id of guildRoom?.cast||[]){
     const option=document.createElement('option');option.value=id;
     option.textContent=cast?.characters?.find(row=>row.id===id)?.name||id;
     role?.append(option);
   }
   if(guildRoom?.cast.includes(prior))role.value=prior;
   const timeline=el(root,'guild-timeline');
   if(timeline)timeline.textContent=guildRoom?.events?.length?
     guildRoom.events.slice(-20).map(e=>e.id+' · '+e.type+' · '+
       (e.type==='player-cue'?e.actorId+': '+small(e.text,250):
        e.type==='assign-player'?e.playerId+' as '+e.roleId:
        e.type==='npc-proposal'?e.characterId+': pending world action':
        e.type==='resolve-proposal'?e.outcome+' (trusted receipt)':
        e.type==='rehearsal-preview'?e.characterId+': '+small(e.speech,250):
        e.characterId||'')).join('\n'):
     'No shared turns recorded.';
 }
 function castSelector(){
   const control=el(root,'cast-list');const previously=new Set(
     Array.from(control?.selectedOptions||[]).map(x=>x.value));
   control?.replaceChildren();
   for(const row of cast?.characters||[]){
     const opt=document.createElement('option');
     opt.value=row.id;opt.textContent=row.name;
     opt.selected=previously.has(row.id)||(previously.size===0&&['landry','delia'].includes(row.id));
     control?.append(opt);
   }
   if(control&&!control.selectedOptions.length&&control.options.length)control.options[0].selected=true;
 }
 function speakers(){
   const control=el(root,'speaker');const selected=control?.value;
   control?.replaceChildren();
   for(const id of campaign?.cast||[]){
     const c=cast?.characters?.find(row=>row.id===id);
     if(!c&&!guildRoom)continue;
     const option=document.createElement('option');option.value=id;option.textContent=c?.name||id;control.append(option);
   }
   if(campaign?.cast.includes('landry')&&campaign?.cast.includes('delia')){
     const option=document.createElement('option');option.value='landry-delia';
     option.textContent='Landry + Delia (split mind)';control.append(option);
   }
   if(campaign?.cast.includes(selected)||selected==='landry-delia'&&campaign?.cast.includes('landry')&&campaign?.cast.includes('delia'))
     control.value=selected;
   if(el(root,'control'))el(root,'control').hidden=control.value!=='landry-delia';
   showWillpower();
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
 el(root,'inspect').addEventListener('click',async()=>{
   if(loading)return;
   loading=true;
   try{
     const p=validatePersonaPack(await acceptFile(el(root,'pack'),1200000,'persona manifest'));
     stop();cast=p;campaign=null;castSelector();showWillpower();
     status('Cast loaded: '+p.characters.length+' identities. Choose a scene, story stage and cast, then create a private what-if campaign.');
   }catch(error){status('Cast import rejected: '+small(error?.message||error,400));}
   finally{loading=false;}
 });
 el(root,'new').addEventListener('click',async()=>{
   if(loading)return;
   loading=true;
   try{
     const p=cast||validatePersonaPack(await acceptFile(el(root,'pack'),1200000,'persona manifest'));
     const selected=Array.from(el(root,'cast-list')?.selectedOptions||[]).map(o=>o.value);
     if(!selected.length)throw new TypeError('Read the cast and select at least one character.');
     const stage=Number(el(root,'stage')?.value);
     if(!Number.isInteger(stage)||stage<0||stage>99999)throw new TypeError('Story stage must be 0–99999.');
     const scenario=small(el(root,'scenario')?.value,8000);
     if(!scenario)throw new TypeError('Describe the new scenario before starting.');
     const sessionId=crypto.randomUUID();
     const next=createPersonaCampaign({pack:p,id:'local:'+sessionId,
       title:'Private what-if rehearsal',ownerId:'local:author',
       branchId:'what-if:'+sessionId,stage,scenario,cast:selected});
     stop();cast=p;campaign=next;speakers();showWillpower();
     status('New private '+next.branchId+' created with '+selected.length+' characters. Activate, then use the existing Weaveling composer.');
   }catch(error){status('New campaign rejected: '+small(error?.message||error,400));}
   finally{loading=false;}
 });
 el(root,'speaker').addEventListener('change',()=>{
   if(el(root,'control'))el(root,'control').hidden=el(root,'speaker').value!=='landry-delia';
 });
 el(root,'load').addEventListener('click',async()=>{
   if(loading)return;
   loading=true;stop();
   try{
     // Both files require explicit user selection. Never silently reuse a
     // previous guide's memory or a private browser storage key.
     const p=validatePersonaPack(await acceptFile(el(root,'pack'),1200000,'persona manifest'));
     const s=importCampaignSnapshot(JSON.stringify(await acceptFile(el(root,'save'),200000,'campaign save')),{pack:p});
     cast=p;campaign=s;castSelector();
     for(const opt of el(root,'cast-list')?.options||[])opt.selected=s.cast.includes(opt.value);
     if(el(root,'stage'))el(root,'stage').value=String(s.stage);
     if(el(root,'scenario'))el(root,'scenario').value=s.scenario;
     speakers();
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
     switchOn(true);showWillpower();
     status('Private preview active in Weaveling chat. Responses are fictional and proposed actions remain unexecuted. Export your save before leaving.');
   }catch(error){stop();status(small(error?.message||error,400));}
 });
 // This is a real authenticated Guild write, distinct from local model preview.
 // No source archive, private director prompt or unseen memory is uploaded.
 el(root,'guild-host').addEventListener('click',async()=>{
   if(loading)return;loading=true;
   try{
     if(!cast||!campaign)throw new Error('Create a private scene and choose its cast first.');
     if(el(root,'guild-consent')?.checked!==true)throw new Error('Confirm sharing the scene description with the selected Guild.');
     const result=await guildClient.create({pack:cast,cast:campaign.cast,
       title:campaign.title,stage:campaign.stage,scenario:campaign.scenario,confirmedShare:true});
     stop();guildRoom=result.room;campaign=result.room;session=null;
     if(el(root,'guild-room'))el(root,'guild-room').value=guildRoom.id;
     speakers();switchOn(true);showWillpower();showGuildRoom();
     guildStatus('Hosted on '+result.scope.nodeId+' as '+result.scope.userId+'. Room '+guildRoom.id+
      '. The room is private to authorized seats; assign players before they join.');
     status('Guild campaign active: model NPCs are NOT automatically run by the server. Player turns use authenticated Guild storage.');
   }catch(error){guildStatus('Guild hosting failed: '+small(error?.message||error));}
   finally{if(el(root,'guild-consent'))el(root,'guild-consent').checked=false;loading=false;}
 });
 el(root,'guild-join').addEventListener('click',async()=>{
   if(loading)return;loading=true;
   try{
     const id=el(root,'guild-room')?.value?.trim();
     const result=await guildClient.snapshot(id);
     stop();guildRoom=result.room;campaign=result.room;session=null;
     speakers();switchOn(true);showWillpower();
     guildStatus('Joined authenticated room '+guildRoom.id+' on '+result.scope.nodeId+
       '. Only server-approved members may read and submit turns.');
     status('Guild shared mode: submit player cues through this Weaveling chat. No model actions are automatically executed.');
   }catch(error){guildStatus('Guild join failed: '+small(error?.message||error));}
   finally{loading=false;}
 });
 el(root,'guild-assign').addEventListener('click',async()=>{
   if(loading)return;loading=true;
   try{
     if(!guildRoom)throw new Error('Host or join a shared Guild room first.');
     const userId=small(el(root,'guild-seat-user')?.value,90);
     const roleId=el(root,'guild-seat-role')?.value;
     if(!/^[A-Za-z0-9:_-]{1,90}$/.test(userId))throw new TypeError('Enter a valid Guild member ID.');
     if(!guildRoom.cast.includes(roleId))throw new TypeError('Choose a character seat in the current scene.');
     const result=await guildClient.dispatch(guildRoom.id,guildRoom.revision,{
       type:'assign-player',playerId:'member:'+userId,roleId
     });
     guildRoom=result.room;campaign=guildRoom;showWillpower();showGuildRoom();
     guildStatus('Assigned '+roleId+' to '+userId+'. Share room ID '+guildRoom.id+
       ' with this Guild member so they can join.');
   }catch(error){guildStatus('Seat assignment failed: '+small(error?.message||error,500));}
   finally{loading=false;}
 });
 el(root,'guild-refresh').addEventListener('click',async()=>{
   if(loading)return;loading=true;
   try{
     const id=guildRoom?.id||el(root,'guild-room')?.value?.trim();
     const result=await guildClient.snapshot(id);
     guildRoom=result.room;campaign=result.room;showWillpower();showGuildRoom();
     if(guildRoom)guildStatus('Server revision '+guildRoom.revision+' · '+guildRoom.events.length+
       ' accepted events · shared turn '+guildRoom.turn+'.');
   }catch(error){guildStatus('Refresh failed: '+small(error?.message||error));}
   finally{loading=false;}
 });
 el(root,'end').addEventListener('click',()=>{stop();showWillpower();
   guildStatus('Not connected. Shared Guild records remain on their server.');showGuildRoom();
   status('Campaign preview off. Normal guide chat resumed; imported data remains only in this tab.');});
 el(root,'export').addEventListener('click',()=>{
   try{
     const snapshot=guildRoom||session?.snapshot()||campaign;
     if(!snapshot)throw new Error('No campaign loaded.');
     const data=exportCampaignSnapshot(snapshot);
     const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
     const a=document.createElement('a');a.href=url;a.download='persona-campaign-'+snapshot.id.replace(/[^a-zA-Z0-9-]/g,'_')+'.json';
     document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
     status('Private campaign exported. Share only with trusted participants; it includes your dialogue.');
   }catch(error){status('Export failed: '+small(error?.message||error));}
 });
 return Object.freeze({
   active:()=>enabled&&Boolean(session||guildRoom),
   respond:async({text,systemId}={})=>{
     if(!enabled||(!session&&!guildRoom)||systemId!=='civweave')throw new Error('Persona campaign is not active in Civweave chat.');
     try{
       if(guildRoom){
         const result=await guildClient.dispatch(guildRoom.id,guildRoom.revision,{type:'player-cue',text:small(text,1200)});
         guildRoom=result.room;campaign=guildRoom;showWillpower();showGuildRoom();
         guildStatus('Guild accepted turn '+guildRoom.turn+' at revision '+guildRoom.revision+'.');
         return {provider:'guild-persona-session',model:'none',
           response:{answer:'Your player action was recorded in the authenticated Guild campaign (turn '+guildRoom.turn+'). It is not yet an NPC reaction or a confirmed world action. Refresh to see other players’ moves.',
             choice:{mode:'Play',system:'civweave',nextAction:'Continue playing or refresh the shared session.'}},
           context:{guide:{system:'civweave'},capability:'guild-persona-campaign'}};
       }
       const id=el(root,'speaker')?.value;
       status('Playing '+id+' with the selected model; no world actions are authorized.');
       const selectedControl=id==='landry-delia'?el(root,'control')?.value||null:null;
       const deviation=el(root,'deviation')?.checked===true;
       const result=await session.respond({characterId:id,input:small(text,1200),
         directControl:selectedControl,worldChanged:deviation});
       if(el(root,'deviation'))el(root,'deviation').checked=false;
       campaign=result.campaign;showWillpower();
       const spent=result.packet?.persona?.overrideSpends?.length||0;
       const remaining=result.packet?.persona?.remainingWillpower;
       status('Turn '+campaign.turn+' · '+campaign.branchId+
         (spent?' · '+spent+' override'+(spent===1?'':'s')+' used · willpower '+remaining+'/'+campaign.willpower.max:'')+
         ' · '+(result.needsRefresh?'4B refresh next cue':'improv ready')+'. Export explicitly to keep progress.');
       return result.packet;
     }finally{if(el(root,'consent'))el(root,'consent').checked=false;}
   },
   dispose:()=>{stop();cast=null;campaign=null;showWillpower();guildStatus('Disconnected.');status('Campaign data released from this tab.');}
 });
}
