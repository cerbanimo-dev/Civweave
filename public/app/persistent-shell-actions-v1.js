(()=>{
'use strict';
const VERSION='1.0.8-reserved-navigation-utilities';
const NAV_ID='cw-themed-system-nav';
const ACTIONS_ID='cw-persistent-shell-actions-v1';
const STYLE_ID='cw-persistent-shell-actions-v1-style';
const GUILD_SRC='/app/assets/guild-symbol.png';
const MAP_SRC='/app/assets/map-symbol-v1.png';
const SURVIVAL_PATH='/app/survival/index.html';
const CONTEXT_KEY='civweave.pending-system-context.v1';
const SYSTEMS=new Set(['civweave','living-school','cerbanimo','fellowfare','anarchadia']);
const RETIRED_PATHS=Object.freeze({
  '/app/fullscreen-family-v104.html':'civweave',
  '/app/persistent-family-shell-v1.html':'civweave'
});
const GUILD_RUNTIME_SRC='/app/guild-symbol-v1.js?v=guild-symbol-v1.5-standalone-guild-search-card';
let guildRuntimePromise=null;
let legacyRouteBound=false;
let observedNav=null;

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
#${NAV_ID} #${ACTIONS_ID}{grid-column:1/span 3;grid-row:1;min-width:0;display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));align-items:stretch;gap:4px;pointer-events:auto}
#${NAV_ID} #${ACTIONS_ID} button{all:unset;box-sizing:border-box;display:inline-flex!important;align-items:center;justify-content:center;gap:6px;min-width:0;min-height:36px;padding:4px 6px;border:1px solid #f2d88755;border-radius:8px;background:#ffffff0a;color:#fff4ce;font:700 12px/1.1 system-ui,sans-serif;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
#${NAV_ID} #${ACTIONS_ID} button:hover,#${NAV_ID} #${ACTIONS_ID} button:focus-visible{border-color:#8af5d299;background:#8af5d217;outline:none}
#${NAV_ID} #${ACTIONS_ID} img{display:block;width:18px;height:18px;object-fit:contain;flex:0 0 18px}
@media(max-width:680px){#${NAV_ID} #${ACTIONS_ID} button{gap:4px;padding:4px;font-size:11px}#${NAV_ID} #${ACTIONS_ID} img{width:16px;height:16px;flex-basis:16px}}
`;
  (document.head||document.documentElement).append(style);
}
function rememberContext(system){if(!SYSTEMS.has(system))return false;try{localStorage.setItem(CONTEXT_KEY,system)}catch{}return true}
function legacySystemFor(value){let url;try{url=new URL(String(value||''),location.href)}catch{return''}const system=RETIRED_PATHS[url.pathname]||'';if(!system)return'';const explicit=String(url.searchParams.get('system')||url.searchParams.get('context')||'').toLowerCase();return SYSTEMS.has(explicit)?explicit:system}
function switchLegacyRoute(system,source='retired-shell-link'){
  if(!SYSTEMS.has(system))return false;rememberContext(system);
  try{const routes=globalThis.CivweaveSystemRoutesV227;if(routes?.navigate){routes.navigate(system,{source});return true}}catch{}
  const fallback={civweave:'/app/working-campus-v440.html','living-school':'/app/cabinets/living-school/index.html?cabinet=1',cerbanimo:'/app/realm-console-v140.html?system=cerbanimo&cabinet=1',fellowfare:'/app/fellowfare-cabinet-v144.html?cabinet=1',anarchadia:'/app/anarchadia-console-v139.html?cabinet=1'}[system];
  const target=new URL(fallback||'/app/working-campus-v440.html',location.origin);target.searchParams.set('installed','1');target.searchParams.set('source',source);location.assign(target.href);return true
}
function interceptRetiredShellRoute(event){if(event.defaultPrevented||event.button!=null&&event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const link=event.target?.closest?.('a[href]');if(!link)return;const system=legacySystemFor(link.href);if(!system)return;event.preventDefault();event.stopImmediatePropagation();switchLegacyRoute(system,'retired-shell-link')}
function bindLegacyRoutes(){if(legacyRouteBound)return true;legacyRouteBound=true;document.addEventListener('click',interceptRetiredShellRoute,true);return true}
function guildFallback(){const target=new URL('/app/index.html',location.origin);target.searchParams.set('manage','guilds');target.searchParams.set('source','persistent-shell');target.hash='cw-host-node-lobby';location.assign(`${target.pathname}${target.search}${target.hash}`);return true}
function ensureGuildRuntime(){
  if(globalThis.CivweaveGuildSymbolV1?.openNearbyGuilds)return Promise.resolve(globalThis.CivweaveGuildSymbolV1);if(guildRuntimePromise)return guildRuntimePromise;
  guildRuntimePromise=new Promise((resolve,reject)=>{let script=[...document.scripts].find(node=>String(node.src||'').includes('/app/guild-symbol-v1.js'));const ready=()=>globalThis.CivweaveGuildSymbolV1?.openNearbyGuilds?resolve(globalThis.CivweaveGuildSymbolV1):reject(new Error('Guild finder runtime did not become ready.'));if(script){if(globalThis.CivweaveGuildSymbolV1?.openNearbyGuilds)return resolve(globalThis.CivweaveGuildSymbolV1);script.addEventListener('load',ready,{once:true});script.addEventListener('error',()=>reject(new Error('Guild finder runtime failed to load.')),{once:true});setTimeout(ready,2500);return}script=document.createElement('script');script.src=GUILD_RUNTIME_SRC;script.async=true;script.dataset.cwPersistentShellGuildRuntime=VERSION;script.onload=ready;script.onerror=()=>reject(new Error('Guild finder runtime failed to load.'));(document.head||document.documentElement).append(script)}).catch(error=>{guildRuntimePromise=null;throw error});return guildRuntimePromise
}
async function openGuilds(){try{const api=await ensureGuildRuntime();await api.openNearbyGuilds();return true}catch(error){console.warn('[Civweave] Persistent Guild action fell back to the Guild lobby.',error);return guildFallback()}}
function openMap(){location.assign('/finder?view=map&source=persistent-shell');return true}
function openSurvival(){location.assign(SURVIVAL_PATH);return true}

const navObserver=new MutationObserver(()=>{
  if(!observedNav||!observedNav.isConnected){observedNav=null;ensureMounted();return}
  if(!observedNav.querySelector(`.cw-nav-utilities #${ACTIONS_ID}`))ensureMounted();
});
function bindNavObserver(nav){
  if(observedNav===nav)return Boolean(nav);
  navObserver.disconnect();observedNav=nav||null;
  if(observedNav)navObserver.observe(observedNav,{childList:true,subtree:true});
  return Boolean(observedNav);
}
function ensureMounted(){
  installStyle();bindLegacyRoutes();const nav=document.getElementById(NAV_ID);if(!nav){bindNavObserver(null);return false}bindNavObserver(nav);const utilities=nav.querySelector('.cw-nav-utilities');if(!utilities)return false;let actions=document.getElementById(ACTIONS_ID);if(actions){if(actions.parentElement!==utilities)utilities.prepend(actions);return true}
  document.getElementById('cw-civweave-primary-actions-v441')?.remove();actions=document.createElement('div');actions.id=ACTIONS_ID;actions.setAttribute('role','group');actions.setAttribute('aria-label','Guild, map, and survival tools');actions.innerHTML=`<button type="button" data-cw-persistent-action="guilds" data-cw-civweave-nav="guilds" aria-label="Find nearby Guilds"><img src="${GUILD_SRC}" alt="" aria-hidden="true"><span>Guilds</span></button><button type="button" data-cw-persistent-action="map" data-cw-civweave-nav="map" aria-label="Open Guild Map"><img src="${MAP_SRC}" alt="" aria-hidden="true"><span>Map</span></button><button type="button" data-cw-persistent-action="survival" aria-label="Open Survival Mode">Survival</button>`;actions.addEventListener('click',event=>{const action=event.target.closest?.('[data-cw-persistent-action]')?.dataset.cwPersistentAction;if(action==='guilds'){event.preventDefault();void openGuilds()}else if(action==='map'){event.preventDefault();openMap()}else if(action==='survival'){event.preventDefault();openSurvival()}});utilities.prepend(actions);nav.dataset.persistentActions='guilds-map-survival-all-systems-v1';return true
}
const observer=new MutationObserver(records=>{if(records.some(record=>[...record.addedNodes,...record.removedNodes].some(node=>node?.nodeType===1&&(node.id===NAV_ID||node.querySelector?.(`#${NAV_ID}`)))))ensureMounted()});
function boot(){bindLegacyRoutes();ensureMounted();const target=document.body||document.documentElement;observer.observe(target,{childList:true,subtree:false});for(const delay of [80,300,900,1800])setTimeout(ensureMounted,delay)}
addEventListener('pageshow',ensureMounted);addEventListener('focus',ensureMounted);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
globalThis.CivweavePersistentShellActionsV1=Object.freeze({version:VERSION,ensureMounted,openGuilds,openMap,openSurvival,legacySystemFor,switchLegacyRoute,retiredRealmEntrypoints:false,canonicalRealmInterception:false,observerScope:'body-direct-children+navbar-childlist',utilityRow:'cw-nav-utilities'});
})();
