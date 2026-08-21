(()=>{
'use strict';

const VERSION='1.0.2-guild-chat-usage-v1-mobile-session-upgrade';
const REVISION='guild-chat-usage-v1-mobile-session-upgrade';
const HOST_SELECTION_KEY='civweave.host-node.selection.v1';
const HOST_ENDPOINT_KEY='federation-finder.physical-node-endpoint';
const HOST_SESSION_KEY='civweave.host-capacity.sessions.v1';
const DEFAULT_NEURONS_PER_CONVERSATION=12;
const GUIDE_THREAD_PREFIX='civweave.guide-thread.v350.';
const GUIDE_SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
if(globalThis.CivweaveGuildChatUsageV1?.version===VERSION)return;

const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const clean=(value,max=1000)=>String(value??'').trim().slice(0,max);
const finite=value=>Number.isFinite(Number(value))&&Number(value)>=0?Math.floor(Number(value)):null;
function normalizedOrigin(value){try{const url=new URL(clean(value,2000));return url.protocol==='https:'&&!url.username&&!url.password?url.origin:''}catch{return''}}
function capacitySessions(){
  try{const rows=globalThis.CivweaveHostNodeSessionV1?.publicStatus?.()?.sessions;if(Array.isArray(rows))return rows}catch{}
  try{const stored=parse(globalThis.sessionStorage?.getItem(HOST_SESSION_KEY),{});return stored&&typeof stored==='object'?Object.values(stored):[]}catch{return[]}
}
function selectedGuildRecord(){
  let saved={};try{saved=parse(globalThis.localStorage?.getItem(HOST_SELECTION_KEY),{})||{}}catch{}
  const api=globalThis.CivweaveHostNodeSessionV1;
  let apiOrigin='';try{apiOrigin=normalizedOrigin(api?.selectedOrigin?.()||'')}catch{}
  let endpoint='';try{endpoint=normalizedOrigin(globalThis.localStorage?.getItem(HOST_ENDPOINT_KEY)||'')}catch{}
  let origin=normalizedOrigin(saved?.origin)||apiOrigin||endpoint;
  const sessions=capacitySessions();let nodeId=clean(saved?.nodeId,180);
  let session=sessions.find(row=>row&&(!row.expiresAt||Date.parse(row.expiresAt)>Date.now())&&((nodeId&&row.nodeId===nodeId)||(origin&&normalizedOrigin(row.origin)===origin)))||null;
  if(!session&&!origin&&!nodeId)session=sessions.find(row=>row&&(!row.expiresAt||Date.parse(row.expiresAt)>Date.now()))||null;
  if(session){origin=origin||normalizedOrigin(session.origin);nodeId=nodeId||clean(session.nodeId,180)}
  return Object.freeze({origin,nodeId,displayName:clean(saved?.displayName,160)||nodeId||'Guild',loginMode:clean(saved?.loginMode,80),hasGuild:Boolean(origin||nodeId),session});
}
function latestGuideUsage(){
  const active=clean(globalThis.CivweaveGuideChatSurfaceV350?.state?.()?.activeSystem,80),systems=[...new Set([active,...GUIDE_SYSTEMS].filter(Boolean))];
  for(const system of systems){
    let thread={};try{thread=parse(globalThis.localStorage?.getItem(`${GUIDE_THREAD_PREFIX}${system}`),{})||{}}catch{}
    const messages=Array.isArray(thread?.messages)?thread.messages:[];
    for(let index=messages.length-1;index>=0;index-=1){const row=messages[index]||{},remaining=finite(row.remainingNeurons),turns=finite(row.approximateTurnsLeft);if(remaining!=null||turns!=null)return{remainingNeurons:remaining,approximateTurnsLeft:turns,averageNeuronsPerTurn:null,source:'guide-response'}}
  }
  return null;
}
function snapshot(){
  const selected=selectedGuildRecord();if(!selected.hasGuild)return null;
  const api=globalThis.CivweaveHostNodeSessionV1;let telemetry=selected.session?.telemetry||null;
  if(!telemetry)try{telemetry=api?.telemetryFor?.(selected.nodeId||selected.origin)||null}catch{}
  if(!telemetry&&selected.session)telemetry=latestGuideUsage();
  const remainingNeurons=finite(telemetry?.remainingNeurons);let approximateTurnsLeft=finite(telemetry?.approximateTurnsLeft);
  const measuredAverage=Number(telemetry?.averageNeuronsPerTurn),average=Number.isFinite(measuredAverage)&&measuredAverage>0?measuredAverage:DEFAULT_NEURONS_PER_CONVERSATION;
  if(approximateTurnsLeft==null&&remainingNeurons!=null)approximateTurnsLeft=Math.max(0,Math.floor(remainingNeurons/average));
  return Object.freeze({revision:REVISION,guild:selected.displayName,origin:selected.origin,nodeId:selected.nodeId,loginMode:selected.loginMode,remainingNeurons,approximateTurnsLeft,known:remainingNeurons!=null||approximateTurnsLeft!=null,source:telemetry?.source||'guild-capacity-session'});
}
const amount=value=>value==null?'—':Number(value).toLocaleString();
const usageText=value=>`${value.guild} · ${amount(value.remainingNeurons)} neurons · ${value.approximateTurnsLeft==null?'—':`≈${amount(value.approximateTurnsLeft)}`} conversations`;
function ensureStyle(){
  if(typeof document==='undefined'||document.getElementById('cw-guild-chat-usage-style-v1'))return;
  const style=document.createElement('style');style.id='cw-guild-chat-usage-style-v1';style.textContent=`#cw-persistent-guide-chat-v215 [data-civweave-guild-usage]{display:block!important;margin-top:4px!important;color:var(--guide-accent,#d8dde7)!important;font-size:.68rem!important;font-weight:850!important;letter-spacing:.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.95}#cw-persistent-guide-chat-v215 [data-civweave-guild-usage][data-known="false"]{color:#93a5b9!important;font-weight:700!important}[data-civweave-inline-guild-usage]{display:block;margin-top:4px;color:#9fb5c8;font-size:.72rem;font-weight:800}`;document.head?.append(style);
}
function syncNode(node,value){if(!node)return false;node.hidden=!value;if(!value)return false;const text=usageText(value);if(node.textContent!==text)node.textContent=text;node.dataset.known=String(value.known);node.dataset.civweaveGuildUsage=REVISION;node.title=value.known?'Guild AI balance. Conversations are an estimate based on current neuron usage.':'This Guild does not currently publish a capacity balance. Civweave will not invent one.';node.setAttribute('aria-label',node.title+' '+text);return true}
function render(){
  if(typeof document==='undefined')return false;ensureStyle();const value=snapshot(),chat=document.getElementById('cw-persistent-guide-chat-v215');
  if(chat){const headerBody=chat.querySelector('header>div');if(headerBody){let badge=headerBody.querySelector('[data-civweave-guild-usage]');if(!badge){badge=document.createElement('span');badge.dataset.civweaveGuildUsage=REVISION;headerBody.append(badge)}syncNode(badge,value)}}
  const mainStatus=document.getElementById('weaveling-chat-status');if(mainStatus?.parentNode){let inline=document.querySelector('[data-civweave-inline-guild-usage]');if(!inline){inline=document.createElement('small');inline.dataset.civweaveInlineGuildUsage=REVISION;mainStatus.insertAdjacentElement('afterend',inline)}syncNode(inline,value)}
  return Boolean(value);
}
async function refresh({network=true}={}){
  const selected=selectedGuildRecord();render();if(!network||!selected.hasGuild)return snapshot();const api=globalThis.CivweaveHostNodeSessionV1;if(!api)return snapshot();
  let session=null;try{session=api.sessionFor?.(selected.nodeId)||api.sessionFor?.(selected.origin)||null}catch{}
  if(!session&&api.ensureSelected)try{session=await api.ensureSelected()}catch{}
  if(session&&api.status)try{await api.status(session.nodeId||session.origin||selected.origin)}catch{}
  render();const value=snapshot();try{dispatchEvent(new CustomEvent('civweave:guild-chat-usage-refreshed',{detail:value}))}catch{}return value;
}
function install(){
  if(typeof document==='undefined')return false;ensureStyle();let queued=false;const queue=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;render()})};
  const observer=typeof MutationObserver==='function'?new MutationObserver(queue):null;observer?.observe(document.documentElement,{childList:true,subtree:true});
  const liveEvents=['civweave:guide-chat-ready','civweave:guide-chat-state','civweave:host-node-selected','civweave:legacy-mobile-guild-selected','civweave:host-node-session-ready','civweave:host-node-logged-in','civweave:capacity-session-ready','civweave:host-node-health','civweave:ai-neuron-usage','civweave:capacity-session-cleared'];
  for(const name of liveEvents)addEventListener(name,()=>{queue();if(name==='civweave:host-node-session-ready'||name==='civweave:host-node-selected'||name==='civweave:legacy-mobile-guild-selected')void refresh({network:true})});
  addEventListener('storage',event=>{if([HOST_SELECTION_KEY,HOST_ENDPOINT_KEY].includes(event.key))void refresh({network:true})});addEventListener('pageshow',()=>void refresh({network:true}));addEventListener('pagehide',()=>observer?.disconnect(),{once:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void refresh({network:true}),{once:true});else queueMicrotask(()=>void refresh({network:true}));return true;
}

const api=Object.freeze({version:VERSION,revision:REVISION,snapshot,render,refresh,install,selectedGuildRecord});
globalThis.CivweaveGuildChatUsageV1=api;install();
})();
