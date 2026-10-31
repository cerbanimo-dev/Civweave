(()=>{
'use strict';

const VERSION='guild-symbol-v1.7-unified-guild-access';
const SRC='/app/assets/guild-symbol.png';
const MAP_SRC='/app/assets/map-symbol-v1.png';
const CHAT_SRC='/app/assets/chat-symbol-v1.png';
const GUILD_FINDER_SCRIPT='/app/host-node-installer-lobby-v1.js?v=unified-guild-access-v1';
const STYLE_ID='cw-guild-symbol-v1-style';
const ICON_CLASS='cw-guild-symbol-icon';
const MAP_ICON_CLASS='cw-map-symbol-icon';
const CHAT_ICON_CLASS='cw-chat-symbol-icon';
const GUILD_OVERLAY_ID='cw-nearby-guilds-overlay-v1';
const GUILD_CARD_ID='cw-nearby-guilds-card-v1';
const GUILD_MOUNT_ID='cw-nearby-guilds-mount-v1';
let queued=false;
let guildFinderPromise=null;
let discoveryExpanded=true;
let guildPanelBusy=false;
let activeGuildStatus=null;

function installStyle(doc=document){
  if(!doc?.documentElement||doc.getElementById(STYLE_ID))return;
  const style=doc.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
.${ICON_CLASS},.${MAP_ICON_CLASS},.${CHAT_ICON_CLASS}{display:inline-block;width:1.25em;height:1.25em;object-fit:contain;flex:0 0 auto;vertical-align:-.22em}
.realm-icon.guilds .${ICON_CLASS},.ri.guilds .${ICON_CLASS}{width:100%;height:100%;max-width:2rem;max-height:2rem;vertical-align:middle}
#cw-guild-quest-browser-v1 .cw-gqb-icon .${ICON_CLASS}{width:24px;height:24px;vertical-align:middle}
#cw-working-campus-guilds-v243 .${ICON_CLASS}{width:1.55rem;height:1.55rem}
#cw-working-campus-map-v243 .${MAP_ICON_CLASS},[data-cw-civweave-nav="map"] .${MAP_ICON_CLASS}{width:1.55rem;height:1.55rem;vertical-align:middle}
#cw-working-campus-map-v243 .cw-civweave-nav-icon,[data-cw-civweave-nav="map"] .cw-civweave-nav-icon{display:inline-block!important;width:1.55rem!important;height:1.55rem!important;flex:0 0 1.55rem!important;background:url('${MAP_SRC}') center/contain no-repeat!important;font-size:0!important;line-height:0!important;color:transparent!important;text-shadow:none!important}
#cw-working-campus-map-v243 .cw-civweave-nav-icon>*,[data-cw-civweave-nav="map"] .cw-civweave-nav-icon>*{display:none!important}
#cw-human-chat-standalone-surface-v2 .cwh2-tabs [data-cwh2-tab^="guild:"]{display:inline-flex;align-items:center;gap:6px}
#cw-human-chat-standalone-surface-v2 .cwh2-tabs [data-cwh2-tab^="guild:"] .${ICON_CLASS}{width:18px;height:18px;vertical-align:middle}
#cw-human-message-launcher-v1 .cw-human-face{background:transparent!important;text-shadow:none!important}
#cw-human-message-launcher-v1 .cw-human-face .${CHAT_ICON_CLASS}{width:100%;height:100%;object-fit:contain;border-radius:50%;vertical-align:middle}
#${GUILD_OVERLAY_ID}[hidden]{display:none!important}
#${GUILD_OVERLAY_ID}{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:start center;padding:max(18px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(18px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));background:#020611b8;backdrop-filter:blur(8px);overflow:auto}
#${GUILD_OVERLAY_ID} .cw-nearby-guilds-shell{position:relative;width:min(920px,100%);margin:auto 0;max-height:calc(100dvh - 36px);overflow:auto}
#${GUILD_CARD_ID}{position:relative;isolation:isolate;width:100%;border:1px solid #8af5d25c;border-radius:24px;background:linear-gradient(160deg,#071827f8,#10142af8);box-shadow:0 28px 80px #000d;overflow:hidden}
#${GUILD_CARD_ID} .cw-nearby-guilds-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 18px 12px;border-bottom:1px solid #8af5d22f;background:#081b27e8;color:#effffb}
#${GUILD_CARD_ID} .cw-nearby-guilds-card-head strong{display:block;font:850 16px/1.15 system-ui,sans-serif}
#${GUILD_CARD_ID} .cw-nearby-guilds-card-head small{display:block;margin-top:4px;color:#b7d8d1;font:500 12px/1.3 system-ui,sans-serif}
#${GUILD_OVERLAY_ID} .cw-guild-manage{min-height:44px;padding:7px 12px;border-radius:11px;border:1px solid #87e4c3;background:#16473e;color:#f1fff9;font-weight:800;cursor:pointer}\n#${GUILD_OVERLAY_ID} .cw-nearby-guilds-close{flex:0 0 42px;width:42px;height:42px;border:1px solid #ffffff38;border-radius:999px;background:#07131fee;color:#fff;font:800 24px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 22px #0008}

#${GUILD_OVERLAY_ID} .cw-nearby-guilds-card-head>div{flex:1;min-width:0}
#${GUILD_OVERLAY_ID} [hidden]{display:none!important}
#${GUILD_OVERLAY_ID} .cw-guild-selected{padding:16px 18px;background:linear-gradient(145deg,#0d2a2b,#0c1b30);border-bottom:1px solid #6de0ba35}
#${GUILD_OVERLAY_ID} .cw-guild-selected-head{display:flex;align-items:start;gap:12px;justify-content:space-between;flex-wrap:wrap}
#${GUILD_OVERLAY_ID} .cw-guild-selected h2{margin:3px 0 5px;font:800 clamp(1.05rem,3vw,1.45rem)/1.2 system-ui;color:#f1fffa;overflow-wrap:anywhere}
#${GUILD_OVERLAY_ID} .cw-guild-subtitle{margin:0;color:#b8d6d3;font:.8rem/1.5 system-ui;overflow-wrap:anywhere}
#${GUILD_OVERLAY_ID} .cw-guild-kicker{font:900 .65rem system-ui;letter-spacing:.15em;color:#93e8be;text-transform:uppercase}
#${GUILD_OVERLAY_ID} .cw-guild-statline{display:flex;gap:12px;flex-wrap:wrap;color:#d0e9e1;font:.77rem system-ui;margin-top:11px}
#${GUILD_OVERLAY_ID} .cw-guild-statline b{color:#f0fffb;font-variant-numeric:tabular-nums}
#${GUILD_OVERLAY_ID} .cw-guild-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:13px}
#${GUILD_OVERLAY_ID} .cw-guild-actions button,#${GUILD_OVERLAY_ID} .cw-guild-actions a,#${GUILD_OVERLAY_ID} .cw-guild-discovery button,#${GUILD_OVERLAY_ID} .cw-guild-discovery a{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:8px 13px;border-radius:10px;border:1px solid #80cbb45e;background:#173c43;color:#f1fff9;text-decoration:none;font:700 .82rem system-ui;cursor:pointer}
#${GUILD_OVERLAY_ID} .cw-guild-actions .cw-guild-primary{background:#b3ecd4;color:#09232a}
#${GUILD_OVERLAY_ID} .cw-guild-actions button:disabled{opacity:.5;cursor:wait}
#${GUILD_OVERLAY_ID} .cw-guild-access{margin-top:11px;border:1px solid #79d2b644;border-radius:12px;background:#071a23}
#${GUILD_OVERLAY_ID} .cw-guild-access summary{padding:11px 13px;cursor:pointer;font:750 .83rem system-ui}
#${GUILD_OVERLAY_ID} .cw-guild-access-body{padding:0 13px 13px}
#${GUILD_OVERLAY_ID} .cw-guild-help{color:#a6c8c4;font:.75rem/1.5 system-ui;margin:8px 0}
#${GUILD_OVERLAY_ID} .cw-guild-discovery{border-bottom:1px solid #8de5ef2c;padding:16px}
#${GUILD_OVERLAY_ID} .cw-guild-discovery h2{margin:0 0 6px;font:800 1.1rem system-ui;color:#f3fff9}
#${GUILD_OVERLAY_ID} .cw-guild-discovery p{margin:7px 0;color:#b6d3d6;font:.8rem/1.5 system-ui}
#${GUILD_OVERLAY_ID} .cw-guild-manual{display:grid;gap:7px;margin-top:13px}
#${GUILD_OVERLAY_ID} .cw-guild-manual label{color:#e6fff8;font:750 .8rem system-ui}
#${GUILD_OVERLAY_ID} .cw-guild-manual-row{display:flex;gap:8px;flex-wrap:wrap}
#${GUILD_OVERLAY_ID} .cw-guild-manual input{flex:1 1 190px;min-width:0;min-height:42px;border:1px solid #7ac9b655;border-radius:10px;background:#071b26;color:#fff;padding:8px;font:.82rem system-ui}
#${GUILD_OVERLAY_ID} .cw-guild-saved{display:grid;gap:6px;margin-top:12px}
#${GUILD_OVERLAY_ID} .cw-guild-saved button{justify-content:space-between;text-align:left;width:100%}
#${GUILD_OVERLAY_ID} .cw-guild-discovery-error{color:#ffd9ae!important;min-height:1.5em}
#${GUILD_OVERLAY_ID} .cw-guild-manage{flex:0 0 auto}
#${GUILD_MOUNT_ID}{position:relative;z-index:2;padding:12px}
#${GUILD_MOUNT_ID} .cw-host-node-lobby{margin:0!important;max-width:none!important;position:relative!important;inset:auto!important;transform:none!important;z-index:auto!important}
#${GUILD_MOUNT_ID} #cw-host-node-search{position:relative!important;inset:auto!important;transform:none!important;z-index:auto!important}
@media(max-width:640px){#${GUILD_OVERLAY_ID}{place-items:end center;padding:max(10px,env(safe-area-inset-top)) 0 0}#${GUILD_OVERLAY_ID} .cw-nearby-guilds-shell{width:100%;max-height:calc(100dvh - max(10px,env(safe-area-inset-top)));margin:0}#${GUILD_CARD_ID}{border-radius:24px 24px 0 0}#${GUILD_MOUNT_ID}{padding:8px}}
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
  overlay.dataset.surface='guild-search-card';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-label','Find nearby Civweave Guilds');
  overlay.innerHTML=`<div class="cw-nearby-guilds-shell"><section id="${GUILD_CARD_ID}" aria-label="Guild discovery and access"><header class="cw-nearby-guilds-card-head"><div><strong>Guilds</strong><small>Find a Guild · Choose your home · Manage access</small></div><button class="cw-guild-manage" type="button" data-cw-guild-manage hidden>Guildkeeper console</button><button class="cw-nearby-guilds-close" type="button" aria-label="Close Guilds">×</button></header>
  <section data-cw-guild-ui="selected" class="cw-guild-selected" aria-label="Selected Guild" hidden></section>
  <section data-cw-guild-ui="discovery" class="cw-guild-discovery" aria-label="Discover and choose a Guild">
    <h2>Discover a Guild</h2>
    <p>Search nearby Guilds by open Citizen/Patron seats, join with an invitation, or return to a Guild you have already joined.</p>
    <form class="cw-guild-manual" data-cw-guild-manual>
      <label for="cw-guild-origin-input">Guild HTTPS address or Civweave invitation link</label>
      <div class="cw-guild-manual-row"><input id="cw-guild-origin-input" name="guildOrigin" type="url" inputmode="url" autocomplete="url" placeholder="https://your-guild.workers.dev" required><button type="submit">Inspect Guild</button></div>
    </form>
    <p class="cw-guild-discovery-error" role="status" aria-live="polite" data-cw-guild-feedback></p>
    <div class="cw-guild-saved" data-cw-guild-saved></div>
    <p><a href="/app/index.html#mobile-guild-create">Create or host your own Guild</a></p>
  </section>
  <div id="${GUILD_MOUNT_ID}"></div></section></div>`;
  overlay.addEventListener('click',event=>{const control=event.target.closest?.('[data-guild-ui-action]');if(control){event.preventDefault();void guildAction(control.dataset.guildUiAction,control)}});
  overlay.addEventListener('submit',event=>{const form=event.target.closest?.('[data-cw-guild-manual]');if(form){event.preventDefault();void inspectGuildInvite(form)}});
  overlay.querySelector('.cw-nearby-guilds-close')?.addEventListener('click',()=>closeNearbyGuilds('button'));
  overlay.addEventListener('click',event=>{if(event.target===overlay)closeNearbyGuilds('backdrop')});
  overlay.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeNearbyGuilds('escape')}});
  document.body.append(overlay);
  return overlay;
}

async function ensureGuildFinderRuntime(){
  if(globalThis.CivweaveHostNodeInstallerLobbyV1)return globalThis.CivweaveHostNodeInstallerLobbyV1;
  if(guildFinderPromise)return guildFinderPromise;
  guildFinderPromise=new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(node=>{try{return new URL(node.src,location.href).pathname==='/app/host-node-installer-lobby-v1.js'}catch{return false}});
    const script=existing||document.createElement('script');let settled=false;
    const finish=error=>{
      if(settled)return;settled=true;clearTimeout(timeout);
      script.removeEventListener('load',ready);script.removeEventListener('error',failed);
      if(error){script.remove();reject(error)}else resolve(globalThis.CivweaveHostNodeInstallerLobbyV1);
    };
    const ready=()=>finish(globalThis.CivweaveHostNodeInstallerLobbyV1?null:new Error('Nearby Guild finder did not become ready.'));
    const failed=()=>finish(new Error('Nearby Guild finder could not load.'));
    const timeout=setTimeout(()=>finish(new Error('Nearby Guild finder did not become ready.')),6000);
    script.addEventListener('load',ready,{once:true});script.addEventListener('error',failed,{once:true});
    if(!existing){script.src=GUILD_FINDER_SCRIPT;script.async=true;document.head.append(script)}
  }).catch(error=>{guildFinderPromise=null;throw error});
  return guildFinderPromise;
}

function showGuildFinderState(mount,error=false){
  mount.querySelector('[data-cw-guild-search-state]')?.remove();
  const state=document.createElement('div');state.dataset.cwGuildSearchState=error?'error':'loading';state.setAttribute('role',error?'alert':'status');
  const message=document.createElement('p');message.textContent=error?'Nearby Guild search is unavailable. Try again.':'Loading nearby Guild search…';state.append(message);
  if(error){const retry=document.createElement('button');retry.type='button';retry.dataset.cwGuildSearchRetry='true';retry.textContent='Retry Guild search';retry.addEventListener('click',()=>void openNearbyGuilds());state.append(retry)}
  mount.prepend(state);
}

async function openNearbyGuilds(){
  const overlay=ensureNearbyGuildsOverlay(),mount=overlay.querySelector(`#${GUILD_MOUNT_ID}`);
  overlay.hidden=false;
  if(!mount)return false;
  showGuildFinderState(mount);
  try{
    const api=await ensureGuildFinderRuntime();
    await api.boot?.({mount});
    api.showSearch?.(true);
    const lobby=document.getElementById('cw-host-node-lobby');
    if(!lobby)throw new Error('Nearby Guild finder card was not created.');
    if(lobby.parentElement!==mount)mount.append(lobby);
    mount.querySelector('[data-cw-guild-search-state]')?.remove();
    lobby.dataset.openedFrom='working-campus-guilds-nav';
    lobby.dataset.surface='standalone-guild-search-card';
    overlay.hidden=false;
    requestAnimationFrame(()=>document.getElementById('cw-host-node-search-run')?.focus?.({preventScroll:true}));
    try{dispatchEvent(new CustomEvent('civweave:nearby-guilds-opened',{detail:{source:'working-campus-nav',surface:'standalone-guild-search-card'}}))}catch{}
    return true;
  }catch(error){
    console.warn('[Civweave] Nearby Guild finder could not open in place.',error);
    showGuildFinderState(mount,true);
    return false;
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
