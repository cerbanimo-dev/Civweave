(()=>{
'use strict';

const VERSION='guild-symbol-v1.3-purpose-icons';
const SRC='/app/assets/guild-symbol.png';
const MAP_SRC='/app/assets/map-symbol-v1.png';
const CHAT_SRC='/app/assets/chat-symbol-v1.png';
const GUILD_FINDER_SCRIPT='/app/host-node-installer-lobby-v1.js?v=working-campus-nearby-guilds-v1';
const STYLE_ID='cw-guild-symbol-v1-style';
const ICON_CLASS='cw-guild-symbol-icon';
const MAP_ICON_CLASS='cw-map-symbol-icon';
const CHAT_ICON_CLASS='cw-chat-symbol-icon';
const GUILD_OVERLAY_ID='cw-nearby-guilds-overlay-v1';
let queued=false;
let guildFinderPromise=null;

function installStyle(doc=document){
  if(!doc?.documentElement||doc.getElementById(STYLE_ID))return;
  const style=doc.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
.${ICON_CLASS},.${MAP_ICON_CLASS},.${CHAT_ICON_CLASS}{display:inline-block;width:1.25em;height:1.25em;object-fit:contain;flex:0 0 auto;vertical-align:-.22em}
.realm-icon.guilds .${ICON_CLASS},.ri.guilds .${ICON_CLASS}{width:100%;height:100%;max-width:2rem;max-height:2rem;vertical-align:middle}
#cw-guild-quest-browser-v1 .cw-gqb-icon .${ICON_CLASS}{width:24px;height:24px;vertical-align:middle}
#cw-working-campus-guilds-v243 .${ICON_CLASS}{width:1.55rem;height:1.55rem}
#cw-working-campus-map-v243 .${MAP_ICON_CLASS},#cw-civweave-primary-actions-v1 [data-cw-civweave-nav="map"] .${MAP_ICON_CLASS}{width:1.55rem;height:1.55rem;vertical-align:middle}
#cw-human-chat-standalone-surface-v2 .cwh2-tabs [data-cwh2-tab^="guild:"]{display:inline-flex;align-items:center;gap:6px}
#cw-human-chat-standalone-surface-v2 .cwh2-tabs [data-cwh2-tab^="guild:"] .${ICON_CLASS}{width:18px;height:18px;vertical-align:middle}
#cw-human-message-launcher-v1 .cw-human-face{background:transparent!important;text-shadow:none!important}
#cw-human-message-launcher-v1 .cw-human-face .${CHAT_ICON_CLASS}{width:100%;height:100%;object-fit:contain;border-radius:50%;vertical-align:middle}
#${GUILD_OVERLAY_ID}[hidden]{display:none!important}
#${GUILD_OVERLAY_ID}{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:max(14px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(14px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));background:#020611d8;backdrop-filter:blur(10px);overflow:auto}
#${GUILD_OVERLAY_ID} .cw-nearby-guilds-shell{position:relative;width:min(920px,100%);max-height:calc(100dvh - 28px);overflow:auto;border-radius:24px;box-shadow:0 28px 80px #000d}
#${GUILD_OVERLAY_ID} .cw-nearby-guilds-close{position:sticky;z-index:5;top:8px;float:right;margin:8px 8px -52px 0;width:42px;height:42px;border:1px solid #ffffff38;border-radius:999px;background:#07131fee;color:#fff;font:800 24px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 22px #0008}
#${GUILD_OVERLAY_ID} .cw-host-node-lobby{margin:0!important;max-width:none!important}
@media(max-width:640px){#${GUILD_OVERLAY_ID}{place-items:end center;padding:0}#${GUILD_OVERLAY_ID} .cw-nearby-guilds-shell{width:100%;max-height:calc(100dvh - max(10px,env(safe-area-inset-top)));border-radius:24px 24px 0 0}#${GUILD_OVERLAY_ID} .cw-host-node-lobby{border-radius:24px 24px 0 0!important}}
`;
  (doc.head||doc.documentElement).append(style);
}

function makeIcon(doc=document,src=SRC,extraClass=''){
  const img=doc.createElement('img');
  img.src=src;
  img.alt='';
  img.className=[ICON_CLASS,extraClass].filter(Boolean).join(' ');
  img.setAttribute('aria-hidden','true');
  img.decoding='async';
  return img;
}

function replaceSlot(slot,src=SRC,kind='guild'){
  if(!slot)return false;
  const doc=slot.ownerDocument||document;
  installStyle(doc);
  const className=kind==='map'?MAP_ICON_CLASS:kind==='chat'?CHAT_ICON_CLASS:ICON_CLASS;
  const marker=kind==='map'?'cwMapSymbol':kind==='chat'?'cwChatSymbol':'cwGuildSymbol';
  if(slot.dataset?.[marker]==='1'){
    const image=slot.tagName==='IMG'?slot:slot.querySelector?.('img');
    if(image&&new URL(image.src,location.href).pathname===new URL(src,location.href).pathname)return false;
  }
  if(slot.tagName==='IMG'){
    slot.src=src;
    slot.alt='';
    slot.classList.remove(MAP_ICON_CLASS,CHAT_ICON_CLASS);
    slot.classList.add(ICON_CLASS,className);
    slot.setAttribute('aria-hidden','true');
  }else{
    slot.replaceChildren(makeIcon(doc,src,className));
    slot.setAttribute('aria-hidden','true');
  }
  slot.dataset[marker]='1';
  if(kind!=='guild')delete slot.dataset.cwGuildSymbol;
  return true;
}

function replaceLeadingFlag(node){
  if(!node||node.dataset?.cwGuildSymbol==='1')return false;
  const text=String(node.textContent||'').trim();
  if(!/^\s*[⚑⚐]\s*/.test(text)||! /\bguilds?\b/i.test(text))return false;
  const label=text.replace(/^\s*[⚑⚐]\s*/,'');
  const doc=node.ownerDocument||document;
  installStyle(doc);
  node.replaceChildren(makeIcon(doc),doc.createTextNode(` ${label}`));
  node.dataset.cwGuildSymbol='1';
  return true;
}

function ensureGuildChatSymbol(control){
  if(!control||control.dataset?.cwGuildSymbol==='1')return false;
  const threadId=String(control.dataset?.cwh2Tab||control.dataset?.humanThread||control.dataset?.threadId||'');
  if(!threadId.startsWith('guild:'))return false;
  const label=String(control.textContent||'Guild chat').trim()||'Guild chat';
  const doc=control.ownerDocument||document;
  installStyle(doc);
  control.replaceChildren(makeIcon(doc),doc.createTextNode(label));
  control.dataset.cwGuildSymbol='1';
  return true;
}

function ensureChatLauncher(doc=document){
  const face=doc.querySelector?.('#cw-human-message-launcher-v1 .cw-human-face');
  if(!face)return false;
  const current=face.querySelector(`img.${CHAT_ICON_CLASS}`);
  if(current&&face.children.length===1&&new URL(current.src,location.href).pathname===new URL(CHAT_SRC,location.href).pathname)return true;
  face.replaceChildren(makeIcon(doc,CHAT_SRC,CHAT_ICON_CLASS));
  face.dataset.cwChatSymbol='launcher';
  delete face.dataset.cwGuildSymbol;
  return true;
}

function ensureMapSymbols(doc=document){
  let changed=false;
  doc.querySelectorAll?.('#cw-working-campus-map-v243,[data-cw-civweave-nav="map"]').forEach(control=>{
    control.setAttribute('aria-label','Open Map');
    let slot=[...(control.children||[])].find(child=>child.classList?.contains('cw-civweave-nav-icon')||child.getAttribute?.('aria-hidden')==='true');
    if(!slot){slot=doc.createElement('span');slot.className='cw-civweave-nav-icon';slot.setAttribute('aria-hidden','true');control.prepend(slot)}
    if(replaceSlot(slot,MAP_SRC,'map'))changed=true;
  });
  return changed;
}

function isMapControl(control){
  if(!control)return false;
  if(control.id==='cw-working-campus-map-v243')return true;
  if(control.dataset?.cwCivweaveNav==='map')return true;
  return false;
}

function closeNearbyGuilds(reason='close'){
  const overlay=document.getElementById(GUILD_OVERLAY_ID);
  if(!overlay||overlay.hidden)return false;
  overlay.hidden=true;
  try{dispatchEvent(new CustomEvent('civweave:nearby-guilds-closed',{detail:{reason}}))}catch{}
  return true;
}

function ensureNearbyGuildsOverlay(){
  let overlay=document.getElementById(GUILD_OVERLAY_ID);
  if(overlay)return overlay;
  installStyle(document);
  overlay=document.createElement('section');
  overlay.id=GUILD_OVERLAY_ID;
  overlay.hidden=true;
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-label','Find nearby Civweave Guilds');
  overlay.innerHTML='<div class="cw-nearby-guilds-shell"><button class="cw-nearby-guilds-close" type="button" aria-label="Close nearby Guilds">×</button></div>';
  overlay.querySelector('.cw-nearby-guilds-close')?.addEventListener('click',()=>closeNearbyGuilds('button'));
  overlay.addEventListener('click',event=>{if(event.target===overlay)closeNearbyGuilds('backdrop')});
  overlay.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeNearbyGuilds('escape')}});
  document.body.append(overlay);
  return overlay;
}

function waitForGuildFinderRuntime(timeout=6000){
  return new Promise((resolve,reject)=>{
    const started=Date.now();
    const tick=()=>{
      const api=globalThis.CivweaveHostNodeInstallerLobbyV1;
      if(api){resolve(api);return}
      if(Date.now()-started>timeout){reject(new Error('Nearby Guild finder did not become ready.'));return}
      setTimeout(tick,50);
    };
    tick();
  });
}

async function ensureGuildFinderRuntime(){
  if(globalThis.CivweaveHostNodeInstallerLobbyV1)return globalThis.CivweaveHostNodeInstallerLobbyV1;
  if(guildFinderPromise)return guildFinderPromise;
  guildFinderPromise=(async()=>{
    let script=[...document.scripts].find(node=>{try{return new URL(node.src,location.href).pathname==='/app/host-node-installer-lobby-v1.js'}catch{return false}});
    if(!script){script=document.createElement('script');script.src=GUILD_FINDER_SCRIPT;script.async=true;document.head.append(script)}
    return waitForGuildFinderRuntime();
  })().catch(error=>{guildFinderPromise=null;throw error});
  return guildFinderPromise;
}

function nearbyGuildsFallback(){
  const target=new URL('/app/index.html',location.origin);
  target.searchParams.set('manage','guilds');
  target.searchParams.set('source','working-campus-nav');
  target.hash='cw-host-node-lobby';
  location.assign(`${target.pathname}${target.search}${target.hash}`);
  return true;
}

async function openNearbyGuilds(){
  try{
    const overlay=ensureNearbyGuildsOverlay();
    overlay.hidden=false;
    const api=await ensureGuildFinderRuntime();
    await api.boot?.();
    api.showSearch?.(true);
    const lobby=document.getElementById('cw-host-node-lobby');
    if(!lobby)throw new Error('Nearby Guild finder card was not created.');
    const shell=overlay.querySelector('.cw-nearby-guilds-shell');
    if(lobby.parentElement!==shell)shell.append(lobby);
    lobby.dataset.openedFrom='working-campus-guilds-nav';
    overlay.hidden=false;
    requestAnimationFrame(()=>document.getElementById('cw-host-node-search-run')?.focus?.({preventScroll:true}));
    try{dispatchEvent(new CustomEvent('civweave:nearby-guilds-opened',{detail:{source:'working-campus-nav'}}))}catch{}
    return true;
  }catch(error){
    console.warn('[Civweave] Nearby Guild finder could not open in place.',error);
    closeNearbyGuilds('fallback');
    return nearbyGuildsFallback();
  }
}

function installGuildNavigationBehavior(doc=document){
  if(doc!==document||doc.documentElement.dataset.cwNearbyGuildsNav==='1')return;
  doc.documentElement.dataset.cwNearbyGuildsNav='1';
  doc.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target.closest?.('[data-cw-civweave-nav="guilds"],#cw-working-campus-guilds-v243'):null;
    if(!target)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void openNearbyGuilds();
  },true);
}

function enhance(doc=document){
  if(!doc?.querySelectorAll)return;
  installStyle(doc);

  ensureChatLauncher(doc);
  ensureMapSymbols(doc);
  doc.querySelectorAll('.realm-icon.guilds,.ri.guilds,[data-realm="guild"] .realm-icon,[data-realm="guilds"] .realm-icon,#cw-guild-quest-browser-v1 .cw-gqb-icon').forEach(slot=>replaceSlot(slot,SRC,'guild'));
  doc.querySelectorAll('[data-cwh2-tab^="guild:"],[data-human-thread^="guild:"],[data-thread-id^="guild:"]').forEach(ensureGuildChatSymbol);

  doc.querySelectorAll('.mode-text,button,a,[role="button"],[role="menuitem"],summary').forEach(control=>{
    if(isMapControl(control))return;
    const label=String(control.getAttribute?.('aria-label')||control.textContent||'');
    if(!/\bguilds?\b/i.test(label))return;
    if(ensureGuildChatSymbol(control))return;
    if(replaceLeadingFlag(control))return;
    const direct=[...(control.children||[])].find(child=>{
      if(child.classList?.contains(ICON_CLASS))return false;
      if(/\bguilds?\b/i.test(String(child.textContent||'')))return false;
      return child.matches?.('img,svg,.icon,[class~="icon"],[class*="-icon"],[aria-hidden="true"]');
    });
    if(direct)replaceSlot(direct,SRC,'guild');
  });

  doc.querySelectorAll('iframe').forEach(wireFrame);
  installGuildNavigationBehavior(doc);
}

function schedule(doc=document){
  if(queued)return;
  queued=true;
  (doc.defaultView?.requestAnimationFrame||requestAnimationFrame)(()=>{
    queued=false;
    enhance(doc);
  });
}

function wireFrame(frame){
  if(!frame||frame.dataset?.cwGuildSymbolFrame==='1')return;
  frame.dataset.cwGuildSymbolFrame='1';
  const sync=()=>{try{wire(frame.contentDocument)}catch{}};
  frame.addEventListener('load',sync);
  sync();
}

function wire(doc=document){
  if(!doc?.documentElement)return;
  enhance(doc);
  if(doc.documentElement.dataset.cwGuildSymbolObserver==='1')return;
  doc.documentElement.dataset.cwGuildSymbolObserver='1';
  const observer=new MutationObserver(()=>schedule(doc));
  observer.observe(doc.documentElement,{childList:true,subtree:true,characterData:true});
}

function start(){wire(document)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();

globalThis.CivweaveGuildSymbolV1=Object.freeze({version:VERSION,src:SRC,mapSrc:MAP_SRC,chatSrc:CHAT_SRC,refresh:()=>enhance(document),openNearbyGuilds,closeNearbyGuilds});
})();