(()=>{
'use strict';
const VERSION='1.2.0-worldweaver-workspace';
const NAV_ID='cw-themed-system-nav';
const ACTIONS_ID='cw-persistent-shell-actions-v1';
const STYLE_ID='cw-persistent-shell-actions-v1-style';
const GUILD_SRC='/app/assets/guild-symbol.png';
const MAP_SRC='/app/assets/map-symbol-v1.png';
const SURVIVAL_PATH='/app/survival/index.html';
const WORLDWEAVER_PATH='/app/worldweaver/index.html';
const CONTEXT_KEY='civweave.pending-system-context.v1';
const SYSTEMS=new Set(['civweave','living-school','cerbanimo','fellowfare','anarchadia']);
const RETIRED_PATHS=Object.freeze({
  '/app/fullscreen-family-v104.html':'civweave',
  '/app/persistent-family-shell-v1.html':'civweave'
});
const GUILD_RUNTIME_SRC='/app/guild-symbol-v1.js?v=guild-symbol-v1.6-in-shell-guild-search';
let guildRuntimePromise=null;
let legacyRouteBound=false;
let observedNav=null;

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
#${NAV_ID} .cw-nav-utilities{grid-template-columns:repeat(6,minmax(0,1fr))}
#${NAV_ID} .cw-nav-tools{grid-column:6}
#${NAV_ID} #${ACTIONS_ID}{grid-column:1/span 5;grid-row:1;min-width:0;display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr));align-items:stretch;gap:4px;pointer-events:auto}
#${NAV_ID} #${ACTIONS_ID} button{all:unset;box-sizing:border-box;display:inline-flex!important;align-items:center;justify-content:center;gap:6px;min-width:0;min-height:36px;padding:4px 6px;border:1px solid #f2d88755;border-radius:8px;background:#ffffff0a;color:#fff4ce;font:700 12px/1.1 system-ui,sans-serif;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
#${NAV_ID} #${ACTIONS_ID} button:hover,#${NAV_ID} #${ACTIONS_ID} button:focus-visible{border-color:#8af5d299;background:#8af5d217;outline:none}
#${NAV_ID} #${ACTIONS_ID} img{display:block;width:18px;height:18px;object-fit:contain;flex:0 0 18px}
@media(max-width:680px){#${NAV_ID} #${ACTIONS_ID}{gap:2px}#${NAV_ID} #${ACTIONS_ID} button{gap:3px;padding:3px 2px;font-size:10px;min-height:44px}#${NAV_ID} #${ACTIONS_ID} img{width:14px;height:14px;flex-basis:14px}}
@media(max-width:480px){#${NAV_ID} #${ACTIONS_ID} img{display:none}}
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
function guildLauncherState(failed=false){const button=document.querySelector('[data-cw-persistent-action="guilds"]');if(!button)return;const label=button.querySelector('span');if(label)label.textContent=failed?'Retry Guilds':'Guilds';button.setAttribute('aria-label',failed?'Guild search unavailable. Try again.':'Find nearby Guilds');if(failed)button.title='Guild search could not load. Select Retry Guilds to try again.';else button.removeAttribute('title')}
function ensureGuildRuntime(){
  if(globalThis.CivweaveGuildSymbolV1?.openNearbyGuilds)return Promise.resolve(globalThis.CivweaveGuildSymbolV1);if(guildRuntimePromise)return guildRuntimePromise;
  guildRuntimePromise=new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(node=>{try{return new URL(node.src,location.href).pathname==='/app/guild-symbol-v1.js'}catch{return false}}),script=existing||document.createElement('script');let settled=false;
    const finish=error=>{if(settled)return;settled=true;clearTimeout(timeout);script.removeEventListener('load',ready);script.removeEventListener('error',failed);if(error){script.remove();reject(error)}else resolve(globalThis.CivweaveGuildSymbolV1)};
    const ready=()=>finish(globalThis.CivweaveGuildSymbolV1?.openNearbyGuilds?null:new Error('Guild finder runtime did not become ready.'));
    const failed=()=>finish(new Error('Guild finder runtime failed to load.'));
    const timeout=setTimeout(()=>finish(new Error('Guild finder runtime did not become ready.')),6000);
    script.addEventListener('load',ready,{once:true});script.addEventListener('error',failed,{once:true});
    if(!existing){script.src=GUILD_RUNTIME_SRC;script.async=true;script.dataset.cwPersistentShellGuildRuntime=VERSION;(document.head||document.documentElement).append(script)}
  }).catch(error=>{guildRuntimePromise=null;throw error});return guildRuntimePromise
}
async function openGuilds(){try{const api=await ensureGuildRuntime(),opened=await api.openNearbyGuilds();if(opened)guildLauncherState();return Boolean(opened)}catch(error){console.warn('[Civweave] Guild search could not load in the current app.',error);guildLauncherState(true);return false}}
let starlingRuntimePromise=null;
async function openStarling(){
  try{
    if(!globalThis.CivweaveStarlingIntegrationV1){
      if(!starlingRuntimePromise)starlingRuntimePromise=new Promise((resolve,reject)=>{const script=document.createElement('script'),timer=setTimeout(()=>{script.remove();reject(new Error('Collective did not load.'))},12000);script.src='/app/starling-integration-v1.js?v=1.0.0';script.onload=()=>{clearTimeout(timer);resolve()};script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error('Collective could not load.'))};document.head.append(script)}).catch(error=>{starlingRuntimePromise=null;throw error});
      await starlingRuntimePromise;
    }
    await globalThis.CivweaveStarlingIntegrationV1.open();return true;
  }catch(error){const button=document.querySelector('[data-cw-persistent-action="starling"]');if(button){button.textContent='Retry Collective';button.title=String(error?.message||error)}return false}
}
function openMap(){location.assign('/finder?view=map&source=persistent-shell');return true}
function openSurvival(){location.assign(SURVIVAL_PATH);return true}
function openWorldweaver(){location.assign(WORLDWEAVER_PATH);return true}

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
  document.getElementById('cw-civweave-primary-actions-v441')?.remove();actions=document.createElement('div');actions.id=ACTIONS_ID;actions.setAttribute('role','group');actions.setAttribute('aria-label','Guild, map, survival, Collective, and Worldweaver tools');actions.innerHTML=`<button type="button" data-cw-persistent-action="guilds" data-cw-civweave-nav="guilds" aria-label="Find nearby Guilds"><img src="${GUILD_SRC}" alt="" aria-hidden="true"><span>Guilds</span></button><button type="button" data-cw-persistent-action="map" data-cw-civweave-nav="map" aria-label="Open Guild Map"><img src="${MAP_SRC}" alt="" aria-hidden="true"><span>Map</span></button><button type="button" data-cw-persistent-action="survival" aria-label="Open Survival Mode">Survival</button><button type="button" data-cw-persistent-action="starling" aria-label="Open Starling Collective">Collective</button><button type="button" data-cw-persistent-action="worldweaver" aria-label="Open Worldweaver worldbuilding workspace" title="Worldweaver">Worlds</button>`;actions.addEventListener('click',event=>{const action=event.target.closest?.('[data-cw-persistent-action]')?.dataset.cwPersistentAction;if(action==='guilds'){event.preventDefault();void openGuilds()}else if(action==='map'){event.preventDefault();openMap()}else if(action==='survival'){event.preventDefault();openSurvival()}else if(action==='starling'){event.preventDefault();void openStarling()}else if(action==='worldweaver'){event.preventDefault();openWorldweaver()}});utilities.prepend(actions);nav.dataset.persistentActions='guilds-map-survival-collective-worldweaver-v1';return true
}
const observer=new MutationObserver(records=>{if(records.some(record=>[...record.addedNodes,...record.removedNodes].some(node=>node?.nodeType===1&&(node.id===NAV_ID||node.querySelector?.(`#${NAV_ID}`)))))ensureMounted()});
function boot(){bindLegacyRoutes();ensureMounted();const target=document.body||document.documentElement;observer.observe(target,{childList:true,subtree:false});for(const delay of [80,300,900,1800])setTimeout(ensureMounted,delay)}
addEventListener('pageshow',ensureMounted);addEventListener('focus',ensureMounted);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
globalThis.CivweavePersistentShellActionsV1=Object.freeze({version:VERSION,ensureMounted,openGuilds,openMap,openSurvival,openStarling,openWorldweaver,legacySystemFor,switchLegacyRoute,retiredRealmEntrypoints:false,canonicalRealmInterception:false,observerScope:'body-direct-children+navbar-childlist',utilityRow:'cw-nav-utilities'});
})();
