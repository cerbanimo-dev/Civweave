/**
 * Worldweaver shared summon contract. VR, desktop and mobile submit the same
 * command; only the authenticated world/invitation owners may acknowledge it.
 * UI-only previews are not world mutations or proof of human presence.
 */
export const SUMMON_KINDS=Object.freeze(['experience','object','actor','npc','person']);
export const CALL_STATES=Object.freeze(['requested','ringing','accepted','joined','declined','unavailable','cancelled']);
const identifier=/^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$/;
const limit=(s,n=180)=>typeof s==='string'?s.trim().slice(0,n):'';
const own=(o,keys,label)=>{
 if(!o||typeof o!=='object'||Array.isArray(o))throw new TypeError(label+' must be an object');
 const extras=Object.keys(o).filter(k=>!keys.includes(k));
 if(extras.length)throw new TypeError(label+' has unsupported fields: '+extras.join(', '));
};
const ref=(v,label)=>{if(!identifier.test(v||''))throw new TypeError(label+' must be a canonical reference');return v};
const copy=x=>JSON.parse(JSON.stringify(x));
export function normalizeSummonItem(item){
 own(item,['kind','id','title','description','avatarAsset','response'],'summon item');
 if(!SUMMON_KINDS.includes(item.kind))throw new TypeError('Unknown summon kind');
 const title=limit(item.title,100);
 if(!title)throw new TypeError('Summon title required');
 const result={kind:item.kind,id:ref(item.id,'Item'),title,description:limit(item.description,320)};
 if(item.avatarAsset!==undefined){
  if(!/^\/app\/assets\/[a-z0-9_/-]+\.(?:png|webp|svg|jpg)$/.test(item.avatarAsset)||item.avatarAsset.includes('..'))throw new TypeError('Only trusted bundled avatar assets are allowed');
  result.avatarAsset=item.avatarAsset;
 }
 if(item.response!==undefined)result.response=limit(item.response,240);
 return Object.freeze(result);
}
export function normalizeDropPosition(x,y,rect){
 if(!rect||!Number.isFinite(rect.width)||!Number.isFinite(rect.height)||rect.width<=0||rect.height<=0||!Number.isFinite(x)||!Number.isFinite(y))
  throw new TypeError('Valid viewport bounds and pointer position required');
 return {u:Math.max(0,Math.min(1,(x-rect.left)/rect.width)),v:Math.max(0,Math.min(1,(y-rect.top)/rect.height))};
}
export function normalizeSummonCommand({item,worldRef,position}){
 const entity=normalizeSummonItem(item);ref(worldRef,'World');
 own(position,['u','v'],'position');
 if(!Number.isFinite(position.u)||!Number.isFinite(position.v)||position.u<0||position.u>1||position.v<0||position.v>1)
  throw new TypeError('Drop position must be normalized viewport coordinates');
 return Object.freeze({
  type:entity.kind==='person'?'world.invite_person':'world.summon',
  kind:entity.kind,entityRef:entity.id,worldRef,position:{u:position.u,v:position.v}
 });
}
const TRANSITIONS=Object.freeze({
 requested:['ringing','accepted','declined','unavailable','cancelled'],
 ringing:['accepted','declined','unavailable','cancelled'],
 accepted:['joined','cancelled','unavailable'],
 joined:[],declined:[],unavailable:[],cancelled:[]
});
/**
 * transport: authenticated backend with invite(command), place(command),
 * optional subscribeInvitations(callback). Event identity/status/response must
 * be authenticated on the backend; caller-controlled profile data is not
 * accepted as a substitute for a recipient's configured response.
 */
export function createWorldweaverSummons({transport=null,clock=()=>new Date().toISOString()}={}){
 let active=true;const calls=new Map(),listeners=new Set();
 const emit=()=>{const snapshot=listCalls();for(const fn of [...listeners])try{fn(snapshot)}catch{}};
 const listCalls=()=>[...calls.values()].map(copy);
 const off=typeof transport?.subscribeInvitations==='function'
  ?transport.subscribeInvitations(event=>{
    if(!active||!event||typeof event!=='object')return;
    const call=calls.get(event.invitationId);
    if(!call||!TRANSITIONS[call.status]?.includes(event.status))return;
    // Events arrive ONLY from the authenticated subscription. Never expose
    // decline/accept controls as the caller's own state transitions.
    call.status=event.status;call.updatedAt=clock();
    if(event.status==='declined')call.response=limit(event.recipientConfiguredResponse,240)||'Sorry, I cannot join right now.';
    if(event.status==='unavailable')call.response='Unable to connect right now.';
    emit();
   }):null;
 async function submit({item,worldRef,position}){
  if(!active)throw new Error('Summon controller is closed');
  const command=normalizeSummonCommand({item,worldRef,position});
  if(command.type==='world.invite_person'){
   if(typeof transport?.invite!=='function')throw new Error('Authenticated invitation service is not connected. No call was sent.');
   const result=await transport.invite(command);
   if(!result||typeof result!=='object'||!identifier.test(result.invitationId||'')||!['requested','ringing'].includes(result.status))
    throw new Error('Invitation service did not acknowledge a valid call.');
   const call={id:result.invitationId,kind:'person',entityRef:command.entityRef,
    title:normalizeSummonItem(item).title,avatarAsset:normalizeSummonItem(item).avatarAsset||null,
    worldRef,status:result.status,position:copy(position),createdAt:clock(),updatedAt:clock(),response:null};
   calls.set(call.id,call);emit();return {type:'invitation',call:copy(call)};
  }
  if(typeof transport?.place!=='function')throw new Error('Authorized world placement service is not connected. Nothing was spawned.');
  const result=await transport.place(command);
  if(!result||!['queued','placed'].includes(result.status))throw new Error('World server did not acknowledge placement.');
  if(result.status==='placed'&&!identifier.test(result.instanceId||''))throw new Error('World placement receipt has no canonical instance ID.');
  return {type:'placement',status:result.status,instanceId:result.instanceId||null,command};
 }
 return Object.freeze({submit,listCalls,subscribe(fn){if(typeof fn!=='function')throw new TypeError('Listener required');listeners.add(fn);fn(listCalls());return()=>listeners.delete(fn)},
 close(){active=false;if(typeof off==='function')off();listeners.clear();calls.clear()}});
}
