(()=>{
'use strict';
const VERSION='1.0.1-direct-shell-all-systems';
const NAV_ID='cw-themed-system-nav';
const ACTIONS_ID='cw-persistent-shell-actions-v1';
const STYLE_ID='cw-persistent-shell-actions-v1-style';
const GUILD_SRC='/app/assets/guild-symbol.png';
const MAP_SRC='/app/assets/map-symbol-v1.png';
const GUILD_RUNTIME_SRC='/app/guild-symbol-v1.js?v=guild-symbol-v1.5-standalone-guild-search-card';
let guildRuntimePromise=null;

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
html.cw-themed-system-nav-active body{padding-bottom:calc(var(--cw-themed-nav-height) + env(safe-area-inset-bottom) + 58px)!important}
#${NAV_ID} #${ACTIONS_ID}{position:absolute;z-index:6;left:50%;bottom:calc(100% + 4px);transform:translateX(-50%);display:flex!important;align-items:center;justify-content:center;gap:7px;padding:5px;border:1px solid #d6ab4f66;border-radius:14px;background:linear-gradient(180deg,#1a1320f2,#100d17f2);box-shadow:0 5px 16px #0008;white-space:nowrap;pointer-events:auto}
#${NAV_ID} #${ACTIONS_ID} button{all:unset;box-sizing:border-box;display:inline-flex!important;align-items:center;justify-content:center;gap:7px;min-width:96px;min-height:38px;padding:7px 12px;border:1px solid #f2d88755;border-radius:10px;background:#ffffff0c;color:#fff4ce;font:850 13px/1 system-ui,sans-serif;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
#${NAV_ID} #${ACTIONS_ID} button:hover,#${NAV_ID} #${ACTIONS_ID} button:focus-visible{border-color:#8af5d299;background:#8af5d217;outline:none}
#${NAV_ID} #${ACTIONS_ID} img{display:block;width:1.55rem;height:1.55rem;object-fit:contain;flex:0 0 1.55rem}
@media(max-width:700px){#${NAV_ID} #${ACTIONS_ID}{bottom:calc(100% + 2px);gap:5px;padding:4px}#${NAV_ID} #${ACTIONS_ID} button{min-width:86px;min-height:36px;padding:6px 10px;font-size:12px}}
`;
  (document.head||document.documentElement).append(style);
}

function guildFallback(){
  const target=new URL('/app/index.html',location.origin);
  target.searchParams.set('manage','guilds');
  target.searchParams.set('source','persistent-shell');
  target.hash='cw-host-node-lobby';
  location.assign(`${target.pathname}${target.search}${target.hash}`);
  return true;
}

function ensureGuildRuntime(){
  if(globalThis.CivweaveGuildSymbolV1?.openNearbyGuilds)return Promise.resolve(globalThis.CivweaveGuildSymbolV1);
  if(guildRuntimePromise)return guildRuntimePromise;
  guildRuntimePromise=new Promise((resolve,reject)=>{
    let script=[...document.scripts].find(node=>String(node.src||'').includes('/app/guild-symbol-v1.js'));
    const ready=()=>globalThis.CivweaveGuildSymbolV1?.openNearbyGuilds?resolve(globalThis.CivweaveGuildSymbolV1):reject(new Error('Guild finder runtime did not become ready.'));
    if(script){if(globalThis.CivweaveGuildSymbolV1?.openNearbyGuilds)return resolve(globalThis.CivweaveGuildSymbolV1);script.addEventListener('load',ready,{once:true});script.addEventListener('error',()=>reject(new Error('Guild finder runtime failed to load.')),{once:true});setTimeout(ready,2500);return}
    script=document.createElement('script');script.src=GUILD_RUNTIME_SRC;script.async=true;script.dataset.cwPersistentShellGuildRuntime=VERSION;script.onload=ready;script.onerror=()=>reject(new Error('Guild finder runtime failed to load.'));(document.head||document.documentElement).append(script);
  }).catch(error=>{guildRuntimePromise=null;throw error});
  return guildRuntimePromise;
}

async function openGuilds(){
  try{const api=await ensureGuildRuntime();await api.openNearbyGuilds();return true}catch(error){console.warn('[Civweave] Persistent Guild action fell back to the Guild lobby.',error);return guildFallback()}
}
function openMap(){location.assign('/finder?view=map&source=persistent-shell');return true}

function ensureMounted(){
  installStyle();
  const nav=document.getElementById(NAV_ID);if(!nav)return false;
  let actions=document.getElementById(ACTIONS_ID);
  if(actions&&actions.parentElement===nav)return true;
  document.getElementById('cw-civweave-primary-actions-v441')?.remove();
  actions=document.createElement('div');actions.id=ACTIONS_ID;actions.setAttribute('role','group');actions.setAttribute('aria-label','Guild and map');
  actions.innerHTML=`<button type="button" data-cw-persistent-action="guilds" data-cw-civweave-nav="guilds" aria-label="Find nearby Guilds"><img src="${GUILD_SRC}" alt="" aria-hidden="true"><span>Guilds</span></button><button type="button" data-cw-persistent-action="map" data-cw-civweave-nav="map" aria-label="Open Guild Map"><img src="${MAP_SRC}" alt="" aria-hidden="true"><span>Map</span></button>`;
  actions.addEventListener('click',event=>{const action=event.target.closest?.('[data-cw-persistent-action]')?.dataset.cwPersistentAction;if(action==='guilds'){event.preventDefault();void openGuilds()}else if(action==='map'){event.preventDefault();openMap()}});
  nav.append(actions);nav.dataset.persistentActions='guilds-map-all-systems-v1';return true;
}

const observer=new MutationObserver(()=>ensureMounted());
function boot(){ensureMounted();observer.observe(document.documentElement,{childList:true,subtree:true});for(const delay of [80,300,900,1800])setTimeout(ensureMounted,delay)}
addEventListener('pageshow',ensureMounted);addEventListener('focus',ensureMounted);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
globalThis.CivweavePersistentShellActionsV1=Object.freeze({version:VERSION,ensureMounted,openGuilds,openMap});
})();
