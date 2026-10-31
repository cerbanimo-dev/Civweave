(()=>{
'use strict';
if(globalThis.CivweaveStarlingIntegrationV1)return;
let pending=null,scope=null;
const deps=[
 ['/app/shared/civweave-passport-identity-v1.js?v=1.0.0',()=>globalThis.CivweavePassportIdentityV1],
 ['/app/cw-reward-ledger-v2.js?v=2.1.1',()=>globalThis.CivweaveCanonicalRewardsV2],
 ['/app/host-node-session-v1.js?v=1.0.0',()=>globalThis.CivweaveHostNodeSessionV1],
 ['/app/guild-quest-client-v1.js?v=1.0.1-quest-map-dependencies',()=>globalThis.CivweaveGuildQuestsV1],
 ['/app/guild-starling-client-v1.js?v=1.0.0',()=>globalThis.CivweaveGuildStarlingV1],
 ['/app/starling-collective-v1.js?v=1.0.0',()=>globalThis.CivweaveStarlingCollectiveV1]
];
function load([src,ready]){
 if(ready())return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const script=document.createElement('script');let settled=false;
  const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);script.onload=null;script.onerror=null;if(error){script.remove();reject(error)}else resolve()};
  const timer=setTimeout(()=>finish(new Error('Collective assets did not finish loading. Retry when available.')),12000);
  script.src=src;script.onload=()=>finish(ready()?null:new Error('Collective capability did not become ready.'));script.onerror=()=>finish(new Error('Collective asset could not load.'));document.head.append(script);
 });
}
async function selected(){
 const active=await globalThis.CivweaveHostNodeSessionV1?.ensureSelected?.();
 if(!active?.nodeId||!active?.userId)throw new Error('Log in to a Guild first. Local planning remains available.');
 return {nodeId:active.nodeId,userId:active.userId,origin:active.origin};
}
async function bound(){
 if(!scope)throw new Error('Connect and inspect the selected Guild before sharing.');
 const current=await selected();
 if(current.nodeId!==scope.nodeId||current.origin!==scope.origin||current.userId!==scope.userId)throw new Error('The selected Guild or member changed. Reconnect and review before sharing.');
 return scope.nodeId;
}
const row=value=>value?.line||value;
const transport=Object.freeze({
 async read(){const chosen=await selected(),packet=await globalThis.CivweaveGuildStarlingV1.read(chosen.nodeId);scope=chosen;return {...packet,...packet.context,guildId:packet.guildId,memberUserId:chosen.userId,source:'authenticated-guild',limits:packet.policy};},
 async reserve({lineId,title}){return globalThis.CivweaveGuildStarlingV1.reserve(await bound(),{idempotencyKey:lineId,title});},
 async propose({reservation,quest,provider,model}){return globalThis.CivweaveGuildStarlingV1.propose(await bound(),{id:row(reservation).id,expectedRevision:row(reservation).revision,quest,provider,model});},
 async confirm({reservation,expectedRevision,proposalHash,confirmed}){return globalThis.CivweaveGuildStarlingV1.confirm(await bound(),{id:row(reservation).id,expectedRevision,proposalHash,confirmed});},
 async abandon({reservation,reason}){return globalThis.CivweaveGuildStarlingV1.abandon(await bound(),{id:row(reservation).id,expectedRevision:row(reservation).revision,reason});},
 async passport(input){return globalThis.CivweaveGuildStarlingV1.passport(await bound(),input);},
 async intentionPropose(input){return globalThis.CivweaveGuildStarlingV1.intentionPropose(await bound(),input);},
 async revokePassport(input){return globalThis.CivweaveGuildStarlingV1.revokePassport(await bound(),input);}
});
async function ready(){
 if(pending)return pending;
 pending=(async()=>{
  if(!document.querySelector('link[data-cw-starling-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/app/starling-collective-v1.css?v=1.0.0';link.dataset.cwStarlingStyle='1';document.head.append(link);}
  // Loading capability code is inert: no model, planning, sharing or publication.
  for(const dependency of deps)await load(dependency);
  globalThis.CivweaveStarlingCollectiveV1.configure({guildTransport:transport});
  return globalThis.CivweaveStarlingCollectiveV1;
 })().catch(error=>{pending=null;throw error});return pending;
}
async function openCommuneFirst(){
 const api=await ready();
 // The authenticated Guild transport is read-only until a separate, confirmed action.
 // Keep the local planning workbench available without a selected Guild.
 try{
  const selectedGuild=await api.connectGuild();
  const guildId=selectedGuild?.guildId;
  if(typeof guildId==='string'&&guildId){
   const module=await import('/app/starling-lounge-v1.mjs?v=commune-hud-r2');
   return module.CivweaveStarlingLoungeV1.open({id:guildId,name:'Selected Guild'});
  }
 }catch(error){
  // The legacy local planning UI remains the fallback if Guild access is absent
  // or the visual renderer is unavailable; never fabricate a Guild session.
 }
 return api.open();
}
globalThis.CivweaveStarlingIntegrationV1=Object.freeze({version:'1.1.0',open:openCommuneFirst,openPlanner:async()=>{const api=await ready();return api.open()}});

})();
