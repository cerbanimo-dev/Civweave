(()=>{
'use strict';
const VERSION='1.1.0-guild-party-chat';
if(globalThis.CivweaveLudGameUiV1?.version===VERSION)return;

const text=(id,value)=>{const node=document.getElementById(id);if(node&&value!=null)node.textContent=String(value)};
const clean=value=>String(value??'').trim();
const node=id=>document.getElementById(id);

function passport(){
  try{return clean(globalThis.CivweavePassportIdentityV1?.passportId?.())||'Local Passport'}catch{return'Local Passport'}
}
function guild(){
  try{
    const api=globalThis.CivweaveHostNodeSessionV1,status=api?.publicStatus?.()||{},session=Array.isArray(status.sessions)?status.sessions.find(row=>row?.active):null;
    if(session)return{label:clean(session.nodeId)||'Guild joined',state:'joined'};
    if(status.selectedOrigin)return{label:'Guild selected',state:'selected'};
  }catch{}
  return{label:'Find a Guild',state:'open'};
}
function chat(){return globalThis.CivweaveLudGuildPartyChatV1||null}
function renderHud(){
  const passportId=passport(),guildState=guild();
  text('lud-hud-passport',passportId);
  text('lud-passport-id',passportId);
  text('lud-hud-guild',guildState.label);
  const guildNode=node('lud-hud-guild');if(guildNode)guildNode.dataset.state=guildState.state;
  return{passportId,guild:guildState};
}
async function renderPassportChatIdentity(){
  const api=chat();if(!api?.publicIdentity)return null;
  try{
    const [identity,history]=await Promise.all([api.publicIdentity(),api.verifyPassportHistory?.()]);
    text('lud-public-name',identity?.publicName||'Public name unavailable');
    text('lud-public-key',identity?.keyId?`${identity.keyId} · generation ${identity.generation||1}`:'Public key unavailable');
    text('lud-passport-key-history',history?.ok?`${history.count||1} public key${history.count===1?'':'s'} in predecessor-signed history.`:'Public key history needs repair.');
    return identity;
  }catch(error){text('lud-public-name','Public name unavailable');text('lud-passport-key-history',clean(error?.message)||'Public key history unavailable.');return null}
}
function selectedChannel(){return clean(node('lud-chat-channel')?.value)}
function channelLabel(room){const kind=room?.kind==='guild'?'Guild Hall':'Party';return`${kind} · ${clean(room?.title)||kind}`}
function renderChatChannels(preferred=''){
  const api=chat(),select=node('lud-chat-channel');if(!api||!select)return[];
  try{api.ensureGuildChannel?.();api.ensurePartyChannels?.()}catch{}
  const rooms=api.channels?.()||[],prior=preferred||selectedChannel();select.replaceChildren();
  if(!rooms.length){const option=document.createElement('option');option.value='';option.textContent='No chats joined yet';select.append(option)}
  for(const room of rooms){const option=document.createElement('option');option.value=room.id;option.textContent=channelLabel(room);select.append(option)}
  if(rooms.some(room=>room.id===prior))select.value=prior;else if(rooms[0])select.value=rooms[0].id;
  renderChatMessages();renderChatRoute();return rooms
}
function formatTime(value){try{return new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(new Date(value))}catch{return''}}
function renderChatMessages(){
  const api=chat(),stream=node('lud-chat-messages'),channelId=selectedChannel();if(!stream)return[];const rows=channelId&&api?.messages?api.messages(channelId):[];stream.replaceChildren();
  if(!rows.length){const empty=document.createElement('div');empty.className='chat-empty';empty.textContent=channelId?'No messages here yet.':'Join a Guild, join a Party, or accept a Passport invite to open a chat.';stream.append(empty);return[]}
  for(const row of rows){const item=document.createElement('article');item.className='chat-message';const header=document.createElement('header'),author=document.createElement('strong'),time=document.createElement('small'),body=document.createElement('p');author.textContent=clean(row?.author?.publicName)||'Unknown Hero';time.textContent=formatTime(row?.createdAt);body.textContent=String(row?.body??'');header.append(author,time);item.append(header,body);stream.append(item)}
  stream.scrollTop=stream.scrollHeight;return rows
}
function renderChatRoute(){
  const api=chat(),room=api?.channel?.(selectedChannel()),mesh=globalThis.CivweaveLocalMeshV146?.status?.()||{},verified=(mesh.sessions||[]).filter(row=>row?.peerVerified).length,outbox=api?.guildOutboxStatus?.()?.pending||0,guildState=guild();
  const parts=[];if(room)parts.push(room.access==='invited'?'Passport invite':'Membership');parts.push(verified?`${verified} verified mesh peer${verified===1?'':'s'}`:'mesh ready when a peer connects');parts.push(guildState.state==='joined'?'Guild relay connected':'no direct Guild relay');if(outbox)parts.push(`${outbox} Guild message${outbox===1?'':'s'} queued`);text('lud-chat-route',parts.join(' · '));return parts
}
async function refreshChat(){const api=chat();if(!api)return false;try{await api.flushGuildOutbox?.();await api.pollGuild?.();renderChatChannels(selectedChannel());return true}catch(error){text('lud-chat-status',clean(error?.message)||'Chat refresh failed.');return false}}
async function sendChat(event){
  event.preventDefault();const api=chat(),channelId=selectedChannel(),input=node('lud-chat-message');if(!api||!channelId||!input)return;text('lud-chat-status','Sending…');
  try{const result=await api.send(channelId,input.value),routes=[];if(result?.mesh?.ok)routes.push(`mesh ×${result.mesh.peers||1}`);if(result?.guild?.ok)routes.push('Guild relay');else if(result?.guild?.queued)routes.push('Guild relay queued');if(!routes.length)routes.push('saved locally; waiting for a route');input.value='';renderChatMessages();renderChatRoute();text('lud-chat-status',`Sent by ${routes.join(' + ')}.`)}catch(error){text('lud-chat-status',clean(error?.message)||'Message could not be sent.')}
}
async function cyclePassportKey(){
  const api=chat(),button=node('lud-cycle-passport-key');if(!api?.cyclePassportKey)return;if(button)button.disabled=true;text('lud-passport-key-history','Cycling public key…');
  try{const identity=await api.cyclePassportKey();await renderPassportChatIdentity();text('lud-chat-status',`New public chat name: ${identity.publicName}. Previous public keys remain in the signed history.`)}catch(error){text('lud-chat-status',clean(error?.message)||'Passport key could not be cycled.')}finally{if(button)button.disabled=false}
}
async function createChatInvite(){
  const api=chat(),channelId=selectedChannel(),output=node('lud-chat-invite-token');if(!api?.createInvite||!channelId||!output)return;
  try{output.value=await api.createInvite(channelId);output.focus();output.select();text('lud-chat-status','Signed Passport chat invite created.') }catch(error){text('lud-chat-status',clean(error?.message)||'Invite could not be created.')}
}
async function acceptChatInvite(event){
  event.preventDefault();const api=chat(),input=node('lud-chat-invite-input');if(!api?.acceptInvite||!input)return;
  try{const room=await api.acceptInvite(input.value);input.value='';renderChatChannels(room.id);text('lud-chat-status',`Joined ${channelLabel(room)} by signed Passport invite.`)}catch(error){text('lud-chat-status',clean(error?.message)||'Invite could not be accepted.')}
}
function bindChatControls(){
  node('lud-cycle-passport-key')?.addEventListener('click',cyclePassportKey);
  node('lud-chat-channel')?.addEventListener('change',()=>{renderChatMessages();renderChatRoute()});
  node('lud-chat-refresh')?.addEventListener('click',refreshChat);
  node('lud-chat-form')?.addEventListener('submit',sendChat);
  node('lud-chat-create-invite')?.addEventListener('click',createChatInvite);
  node('lud-chat-accept-form')?.addEventListener('submit',acceptChatInvite);
}
function markReady(){
  document.documentElement.dataset.ludUi='game-v1';
  if(document.body)document.body.dataset.ludReady='true';
}
function pressed(event,value){
  const target=event.target?.closest?.('button,a.button');
  if(!target)return;
  if(value)target.dataset.pressed='true';else delete target.dataset.pressed;
}
function boot(){markReady();renderHud();bindChatControls();void renderPassportChatIdentity();renderChatChannels()}

addEventListener('civweave:passport-ready',()=>{renderHud();void renderPassportChatIdentity()});
addEventListener('civweave:passport-chat-key-rotated',()=>void renderPassportChatIdentity());
addEventListener('civweave:capacity-session-ready',()=>{renderHud();renderChatChannels(selectedChannel())});
addEventListener('civweave:capacity-session-cleared',()=>{renderHud();renderChatRoute()});
addEventListener('civweave:host-node-selected',renderHud);
addEventListener('civweave:lud-chat-ready',()=>{void renderPassportChatIdentity();renderChatChannels(selectedChannel())});
addEventListener('civweave:lud-chat-channel-joined',()=>renderChatChannels(selectedChannel()));
addEventListener('civweave:lud-chat-channel-left',()=>renderChatChannels(selectedChannel()));
addEventListener('civweave:lud-chat-message',event=>{if(event?.detail?.message?.channelId===selectedChannel())renderChatMessages();renderChatRoute()});
addEventListener('civweave:lud-chat-guild-queued',renderChatRoute);
addEventListener('civweave:mesh',renderChatRoute);
addEventListener('pointerdown',event=>pressed(event,true),{passive:true});
addEventListener('pointerup',event=>pressed(event,false),{passive:true});
addEventListener('pointercancel',event=>pressed(event,false),{passive:true});
addEventListener('blur',()=>document.querySelectorAll('[data-pressed="true"]').forEach(item=>delete item.dataset.pressed));
if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();

globalThis.CivweaveLudGameUiV1=Object.freeze({version:VERSION,renderHud,renderPassportChatIdentity,renderChatChannels,renderChatMessages,renderChatRoute,refreshChat,status:()=>({passportId:passport(),guild:guild(),chat:selectedChannel()})});
})();