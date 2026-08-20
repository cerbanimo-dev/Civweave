(()=>{
'use strict';
const VERSION='1.0.163';
const REVISION='five-system-route-contract-v227';
const SHELL_REVISION='persistent-family-shell-v1';
const SHELL_PATH='/app/persistent-family-shell-v1.html';
const BOOT_KEY='civweave.install-boundary.boot.v227';
const CHAT_USAGE_REVISION='guild-chat-usage-v1';
const HOST_SELECTION_KEY='civweave.host-node.selection.v1';
const HOST_ENDPOINT_KEY='federation-finder.physical-node-endpoint';
const HOST_SESSION_KEY='civweave.host-capacity.sessions.v1';
const DEFAULT_NEURONS_PER_CONVERSATION=12;
const GUIDE_THREAD_PREFIX='civweave.guide-thread.v350.';
const GUIDE_SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const ROUTES=Object.freeze({
  civweave:Object.freeze({id:'civweave',label:'Civweave',pathname:'/app/working-campus-v156.html',params:Object.freeze({})}),
  'living-school':Object.freeze({id:'living-school',label:'Living School',pathname:'/app/cabinets/living-school/index.html',params:Object.freeze({cabinet:'1'})}),
  cerbanimo:Object.freeze({id:'cerbanimo',label:'Cerbanimo',pathname:'/app/realm-console-v140.html',params:Object.freeze({system:'cerbanimo',cabinet:'1'})}),
  fellowfare:Object.freeze({id:'fellowfare',label:'FellowFare',pathname:'/app/fellowfare-cabinet-v144.html',params:Object.freeze({cabinet:'1'})}),
  anarchadia:Object.freeze({id:'anarchadia',label:'Anarchadia',pathname:'/app/anarchadia-console-v139.html',params:Object.freeze({cabinet:'1'})})
});
const PATH_TO_ID=new Map(Object.values(ROUTES).map(route=>[route.pathname,route.id]));
PATH_TO_ID.set('/app/civweave-guild-quest-v1.html','civweave');
function normalizePathname(value){
  let pathname=String(value||'/').split(/[?#]/,1)[0]||'/';
  try{pathname=decodeURI(pathname)}catch{}
  if(pathname.length>1&&pathname.endsWith('/'))pathname=pathname.slice(0,-1);
  return pathname;
}
function identify(value=globalThis.location?.pathname||'/'){
  let pathname=value;
  try{pathname=new URL(String(value),globalThis.location?.origin||'https://civweave.invalid').pathname}catch{}
  return PATH_TO_ID.get(normalizePathname(pathname))||'';
}
function routeFor(id){return ROUTES[String(id||'').toLowerCase()]||null}
function isCanonicalPath(value){return Boolean(identify(value))}
function authorize(){
  try{globalThis.sessionStorage?.setItem(BOOT_KEY,'1')}catch{}
  try{globalThis.sessionStorage?.setItem('civweave.install-boundary.boot.v226','1')}catch{}
  return true;
}
function directUrlFor(id,options={}){
  const route=routeFor(id)||ROUTES.civweave;
  const origin=options.origin||globalThis.location?.origin||'https://civweave.invalid';
  const url=new URL(route.pathname,origin);
  for(const [key,value] of Object.entries(route.params))url.searchParams.set(key,value);
  url.searchParams.set('installed','1');
  url.searchParams.set('navigation',REVISION);
  url.searchParams.set('version',String(options.version||VERSION));
  if(options.source)url.searchParams.set('source',String(options.source));
  if(options.weave)url.searchParams.set('weave',String(options.weave));
  if(options.feature)url.searchParams.set('feature',String(options.feature));
  if(options.developer)url.searchParams.set('developer','1');
  if(options.recovery)url.searchParams.set('recovery',String(options.recovery));
  return url;
}
function shellUrlFor(id,options={}){
  const route=routeFor(id)||ROUTES.civweave;
  const origin=options.origin||globalThis.location?.origin||'https://civweave.invalid';
  const url=new URL(SHELL_PATH,origin);
  url.searchParams.set('installed','1');
  url.searchParams.set('system',route.id);
  url.searchParams.set('navigation',REVISION);
  url.searchParams.set('shell',SHELL_REVISION);
  url.searchParams.set('version',String(options.version||VERSION));
  if(options.source)url.searchParams.set('source',String(options.source));
  if(options.weave)url.searchParams.set('weave',String(options.weave));
  if(options.feature)url.searchParams.set('feature',String(options.feature));
  if(options.developer)url.searchParams.set('developer','1');
  if(options.recovery)url.searchParams.set('recovery',String(options.recovery));
  return url;
}
function shouldUseDirect(options={}){
  if(options.direct===true||options.shell===false)return true;
  if(options.shell===true)return false;
  if(typeof window==='undefined')return true;
  return window.self!==window.top;
}
function urlFor(id,options={}){
  return shouldUseDirect(options)?directUrlFor(id,options):shellUrlFor(id,options);
}
function navigate(id,options={}){
  authorize();
  const url=urlFor(id,options);
  if(options.replace)globalThis.location?.replace?.(url.href);else globalThis.location?.assign?.(url.href);
  return url.href;
}
function routes(){return Object.values(ROUTES)}

const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const clean=(value,max=1000)=>String(value??'').trim().slice(0,max);
const finite=value=>Number.isFinite(Number(value))&&Number(value)>=0?Math.floor(Number(value)):null;
function normalizedOrigin(value){try{const url=new URL(clean(value,2000));return url.protocol==='https:'&&!url.username&&!url.password?url.origin:''}catch{return''}}
function selectedGuildRecord(){
  let saved={};
  try{saved=parse(globalThis.localStorage?.getItem(HOST_SELECTION_KEY),{})||{}}catch{}
  const api=globalThis.CivweaveHostNodeSessionV1;
  let apiOrigin='';try{apiOrigin=normalizedOrigin(api?.selectedOrigin?.()||'')}catch{}
  let endpoint='';try{endpoint=normalizedOrigin(globalThis.localStorage?.getItem(HOST_ENDPOINT_KEY)||'')}catch{}
  let origin=normalizedOrigin(saved?.origin)||apiOrigin||endpoint;
  const sessions=capacitySessions();
  let nodeId=clean(saved?.nodeId,180);
  let session=sessions.find(row=>row&&(!row.expiresAt||Date.parse(row.expiresAt)>Date.now())&&((nodeId&&row.nodeId===nodeId)||(origin&&normalizedOrigin(row.origin)===origin)))||null;
  if(!session&&!origin&&!nodeId)session=sessions.find(row=>row&&(!row.expiresAt||Date.parse(row.expiresAt)>Date.now()))||null;
  if(session){origin=origin||normalizedOrigin(session.origin);nodeId=nodeId||clean(session.nodeId,180)}
  return Object.freeze({
    origin,
    nodeId,
    displayName:clean(saved?.displayName,160)||nodeId||'Guild',
    loginMode:clean(saved?.loginMode,80),
    hasGuild:Boolean(origin||nodeId),
    session,
  });
}
function capacitySessions(){
  try{
    const rows=globalThis.CivweaveHostNodeSessionV1?.publicStatus?.()?.sessions;
    if(Array.isArray(rows))return rows;
  }catch{}
  try{
    const stored=parse(globalThis.sessionStorage?.getItem(HOST_SESSION_KEY),{});
    return stored&&typeof stored==='object'?Object.values(stored):[];
  }catch{return[]}
}
function latestGuideUsage(){
  const active=clean(globalThis.CivweaveGuideChatSurfaceV350?.state?.()?.activeSystem,80);
  const systems=[...new Set([active,...GUIDE_SYSTEMS].filter(Boolean))];
  for(const system of systems){
    let thread={};try{thread=parse(globalThis.localStorage?.getItem(`${GUIDE_THREAD_PREFIX}${system}`),{})||{}}catch{}
    const messages=Array.isArray(thread?.messages)?thread.messages:[];
    for(let index=messages.length-1;index>=0;index-=1){
      const row=messages[index]||{},remaining=finite(row.remainingNeurons),turns=finite(row.approximateTurnsLeft);
      if(remaining!=null||turns!=null)return{remainingNeurons:remaining,approximateTurnsLeft:turns,averageNeuronsPerTurn:null,source:'guide-response'};
    }
  }
  return null;
}
function guildUsageSnapshot(){
  const selected=selectedGuildRecord();
  if(!selected.hasGuild)return null;
  const api=globalThis.CivweaveHostNodeSessionV1;
  let telemetry=selected.session?.telemetry||null;
  if(!telemetry)try{telemetry=api?.telemetryFor?.(selected.nodeId||selected.origin)||null}catch{}
  if(!telemetry)telemetry=latestGuideUsage();
  const remainingNeurons=finite(telemetry?.remainingNeurons);
  let approximateTurnsLeft=finite(telemetry?.approximateTurnsLeft);
  const average=finite(telemetry?.averageNeuronsPerTurn)||DEFAULT_NEURONS_PER_CONVERSATION;
  if(approximateTurnsLeft==null&&remainingNeurons!=null)approximateTurnsLeft=Math.max(0,Math.floor(remainingNeurons/Math.max(1,average)));
  return Object.freeze({
    revision:CHAT_USAGE_REVISION,
    guild:selected.displayName,
    origin:selected.origin,
    nodeId:selected.nodeId,
    loginMode:selected.loginMode,
    remainingNeurons,
    approximateTurnsLeft,
    known:remainingNeurons!=null||approximateTurnsLeft!=null,
    source:telemetry?.source||'guild-capacity-session',
  });
}
function amount(value){return value==null?'—':Number(value).toLocaleString()}
function usageText(snapshot){return `${snapshot.guild} · ${amount(snapshot.remainingNeurons)} neurons · ${snapshot.approximateTurnsLeft==null?'—':`≈${amount(snapshot.approximateTurnsLeft)}`} conversations`}
function ensureGuildUsageStyle(){
  if(typeof document==='undefined'||document.getElementById('cw-guild-chat-usage-style-v1'))return;
  const style=document.createElement('style');style.id='cw-guild-chat-usage-style-v1';style.textContent=`
#cw-persistent-guide-chat-v215 [data-civweave-guild-usage]{display:block!important;margin-top:4px!important;color:var(--guide-accent,#d8dde7)!important;font-size:.68rem!important;font-weight:850!important;letter-spacing:.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.95}
#cw-persistent-guide-chat-v215 [data-civweave-guild-usage][data-known="false"]{color:#93a5b9!important;font-weight:700!important}
[data-civweave-inline-guild-usage]{display:block;margin-top:4px;color:#9fb5c8;font-size:.72rem;font-weight:800}
`;
  document.head?.append(style);
}
function syncUsageNode(node,snapshot){
  if(!node)return false;
  node.hidden=!snapshot;
  if(!snapshot)return false;
  const text=usageText(snapshot);if(node.textContent!==text)node.textContent=text;
  node.dataset.known=String(snapshot.known);
  node.dataset.civweaveGuildUsage=CHAT_USAGE_REVISION;
  node.title=snapshot.known?'Guild AI balance. Conversations are an estimate based on current neuron usage.':'This Guild does not currently publish a capacity balance. Civweave will not invent one.';
  node.setAttribute('aria-label',node.title+' '+text);
  return true;
}
function renderGuildUsage(){
  if(typeof document==='undefined')return false;
  ensureGuildUsageStyle();
  const snapshot=guildUsageSnapshot();
  const chat=document.getElementById('cw-persistent-guide-chat-v215');
  if(chat){
    const headerBody=chat.querySelector('header>div');
    if(headerBody){
      let badge=headerBody.querySelector('[data-civweave-guild-usage]');
      if(!badge){badge=document.createElement('span');badge.dataset.civweaveGuildUsage=CHAT_USAGE_REVISION;headerBody.append(badge)}
      syncUsageNode(badge,snapshot);
    }
  }
  const mainStatus=document.getElementById('weaveling-chat-status');
  if(mainStatus?.parentNode){
    let inline=document.querySelector('[data-civweave-inline-guild-usage]');
    if(!inline){inline=document.createElement('small');inline.dataset.civweaveInlineGuildUsage=CHAT_USAGE_REVISION;mainStatus.insertAdjacentElement('afterend',inline)}
    syncUsageNode(inline,snapshot);
  }
  return Boolean(snapshot);
}
async function refreshGuildUsage({network=true}={}){
  const selected=selectedGuildRecord();renderGuildUsage();
  if(!network||!selected.hasGuild)return guildUsageSnapshot();
  const api=globalThis.CivweaveHostNodeSessionV1;
  if(!api)return guildUsageSnapshot();
  let session=null;try{session=api.sessionFor?.(selected.nodeId||selected.origin)||null}catch{}
  if(!session&&selected.loginMode!=='legacy-mobile-selection'&&api.ensureSelected){try{session=await api.ensureSelected()}catch{}}
  if(session&&api.status){try{await api.status(selected.nodeId||selected.origin)}catch{}}
  renderGuildUsage();return guildUsageSnapshot();
}
function installGuildChatUsage(){
  if(typeof document==='undefined'||globalThis.CivweaveGuildChatUsageV1?.revision===CHAT_USAGE_REVISION)return false;
  ensureGuildUsageStyle();
  let queued=false;
  const queue=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;renderGuildUsage()})};
  const observer=new MutationObserver(queue);observer.observe(document.documentElement,{childList:true,subtree:true});
  const liveEvents=['civweave:guide-chat-ready','civweave:guide-chat-state','civweave:host-node-selected','civweave:legacy-mobile-guild-selected','civweave:host-node-session-ready','civweave:host-node-logged-in','civweave:capacity-session-ready','civweave:host-node-health','civweave:ai-neuron-usage','civweave:capacity-session-cleared'];
  for(const name of liveEvents)addEventListener(name,()=>{queue();if(name==='civweave:host-node-session-ready'||name==='civweave:host-node-selected')void refreshGuildUsage({network:true})});
  addEventListener('storage',event=>{if([HOST_SELECTION_KEY,HOST_ENDPOINT_KEY].includes(event.key))void refreshGuildUsage({network:true})});
  addEventListener('pageshow',()=>void refreshGuildUsage({network:true}));
  addEventListener('pagehide',()=>observer.disconnect(),{once:true});
  const api=Object.freeze({revision:CHAT_USAGE_REVISION,snapshot:guildUsageSnapshot,render:renderGuildUsage,refresh:refreshGuildUsage});
  globalThis.CivweaveGuildChatUsageV1=api;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void refreshGuildUsage({network:true}),{once:true});else queueMicrotask(()=>void refreshGuildUsage({network:true}));
  return true;
}

const api=Object.freeze({version:VERSION,revision:REVISION,shellRevision:SHELL_REVISION,shellPath:SHELL_PATH,bootKey:BOOT_KEY,routeFor,routes,identify,isCanonicalPath,authorize,directUrlFor,shellUrlFor,urlFor,navigate,guildUsageRevision:CHAT_USAGE_REVISION,guildUsageSnapshot,renderGuildUsage,refreshGuildUsage});
globalThis.CivweaveSystemRoutesV227=api;
if(typeof document!=='undefined'&&identify()){
  authorize();
  document.documentElement.dataset.civweaveSystemRoute=identify();
  installGuildChatUsage();
}
})();
