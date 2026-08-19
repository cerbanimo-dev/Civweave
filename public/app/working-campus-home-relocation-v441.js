(()=>{
'use strict';
const VERSION='1.0.2-working-campus-home-relocation-v441-browser-pack-import';
const STYLE_ID='cw-working-campus-home-relocation-v441-style';
const NAV_ACTIONS_ID='cw-civweave-primary-actions-v441';
const APP_TAB='app-device';
const BROWSER_PACK_IMPORT_SRC='/app/local-ai/browser-pack-pwa-import-v1.js?v=1.0.0-pwa-import';
if(globalThis.CivweaveHomeRelocationV441?.version===VERSION)return;
const isCivweave=()=>String(document.documentElement?.dataset?.civweaveSystemRoute||document.documentElement?.dataset?.civweaveSystem||'').toLowerCase()==='civweave';
if(!isCivweave())return;
const q=(s,r=document)=>r?.querySelector?.(s)||null;

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
html[data-civweave-system="civweave"] #cw-working-campus-guilds-v243,
html[data-civweave-system="civweave"] #cw-working-campus-map-v243,
html[data-civweave-system="civweave"] #cw-working-campus-downloads-v243,
html[data-civweave-system="civweave"] main.app>header.top>[data-cw160-theme],
html[data-civweave-system-route="civweave"] #cw-working-campus-guilds-v243,
html[data-civweave-system-route="civweave"] #cw-working-campus-map-v243,
html[data-civweave-system-route="civweave"] #cw-working-campus-downloads-v243,
html[data-civweave-system-route="civweave"] main.app>header.top>[data-cw160-theme]{display:none!important}
html[data-civweave-system="civweave"] main.app>header.top,
html[data-civweave-system-route="civweave"] main.app>header.top{grid-template-columns:minmax(0,1fr) auto auto auto!important;grid-template-areas:"brand modes settings review"!important}
html[data-civweave-system="civweave"] main.app>header.top[data-hub-session="true"],
html[data-civweave-system-route="civweave"] main.app>header.top[data-hub-session="true"]{grid-template-areas:"brand modes settings review" "node node node node"!important}
html.cw-themed-system-nav-active[data-cw-themed-current="civweave"] body{padding-bottom:calc(var(--cw-themed-nav-height) + env(safe-area-inset-bottom) + 58px)!important}
#cw-themed-system-nav #${NAV_ACTIONS_ID}{position:absolute;z-index:5;left:50%;bottom:calc(100% + 4px);transform:translateX(-50%);display:flex;align-items:center;justify-content:center;gap:7px;padding:5px;border:1px solid #d6ab4f66;border-radius:14px;background:linear-gradient(180deg,#1a1320f2,#100d17f2);box-shadow:0 5px 16px #0008;white-space:nowrap}
#cw-themed-system-nav #${NAV_ACTIONS_ID} button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-width:96px;min-height:38px;padding:7px 12px;border:1px solid #f2d88755;border-radius:10px;background:#ffffff0c;color:#fff4ce;font:850 13px/1 system-ui,sans-serif;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
#cw-themed-system-nav #${NAV_ACTIONS_ID} button:hover,#cw-themed-system-nav #${NAV_ACTIONS_ID} button:focus-visible{border-color:#8af5d299;background:#8af5d217;outline:none}
#cw-themed-system-nav #${NAV_ACTIONS_ID} .cw-v441-icon{font-size:17px;color:#f3d57c}
#cw-settings-v320 .cw-settings-tabs{grid-template-columns:repeat(4,minmax(0,1fr))!important}
#cw-settings-v320 .cw-v441-app-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
#cw-settings-v320 .cw-v441-app-actions button{min-height:62px;text-align:left}
#cw-settings-v320 .cw-v441-app-actions button small{display:block;margin-top:4px;color:#cbd4ee;font-weight:400;letter-spacing:0}
@media(max-width:700px){
html[data-civweave-system="civweave"] main.app>header.top,html[data-civweave-system-route="civweave"] main.app>header.top{grid-template-columns:minmax(0,1fr) auto!important;grid-template-areas:"brand brand" "modes settings" "review review"!important}
html[data-civweave-system="civweave"] main.app>header.top[data-hub-session="true"],html[data-civweave-system-route="civweave"] main.app>header.top[data-hub-session="true"]{grid-template-areas:"brand brand" "node node" "modes settings" "review review"!important}
#cw-settings-v320 .cw-settings-tabs{grid-template-columns:repeat(2,minmax(0,1fr))!important}#cw-settings-v320 .cw-v441-app-actions{grid-template-columns:1fr}
#cw-themed-system-nav #${NAV_ACTIONS_ID}{bottom:calc(100% + 2px);gap:5px;padding:4px}#cw-themed-system-nav #${NAV_ACTIONS_ID} button{min-width:86px;min-height:36px;padding:6px 10px;font-size:12px}}
`;
  (document.head||document.documentElement).append(style);
}

function hiddenButton(id){return document.getElementById(id)}
function openGuilds(){const button=hiddenButton('cw-working-campus-guilds-v243');if(button){button.click();return true}location.assign('/finder?view=guilds&source=civweave-navbar');return true}
function openMap(){const button=hiddenButton('cw-working-campus-map-v243');if(button){button.click();return true}location.assign('/finder?view=map&source=civweave-navbar');return true}
function openDownloads(){const button=hiddenButton('cw-working-campus-downloads-v243');if(button){button.click();return true}location.assign('/app/index.html?manage=downloads&source=civweave-settings');return true}
function cycleTheme(){const button=q('main.app>header.top [data-cw160-theme]');if(button){button.click();setTimeout(syncThemeLabel,0);return true}return false}
function syncThemeLabel(){const source=q('main.app>header.top [data-cw160-theme]'),target=q('#cw-settings-v320 [data-cw-v441-theme-label]'),label=(source?.textContent||'Theme: System').trim();if(target&&target.textContent!==label)target.textContent=label}

function installNavActions(){
  const nav=q('#cw-themed-system-nav');if(!nav)return false;
  if(q(`#${NAV_ACTIONS_ID}`,nav))return true;
  const actions=document.createElement('div');actions.id=NAV_ACTIONS_ID;actions.setAttribute('role','group');actions.setAttribute('aria-label','Civweave destinations');
  actions.innerHTML='<button type="button" data-cw-v441-nav="guilds" aria-label="Open Guilds"><span class="cw-v441-icon" aria-hidden="true">✥</span><span>Guilds</span></button><button type="button" data-cw-v441-nav="map" aria-label="Open Guild Map"><span class="cw-v441-icon" aria-hidden="true">⌖</span><span>Map</span></button>';
  actions.addEventListener('click',event=>{const action=event.target.closest?.('[data-cw-v441-nav]')?.dataset.cwV441Nav;if(action==='guilds')openGuilds();if(action==='map')openMap()});
  nav.append(actions);nav.dataset.civweavePrimaryActions='guilds-map-v441';return true;
}

function selectAppTab(layer){
  for(const tab of layer.querySelectorAll('[data-settings-tab]'))tab.setAttribute('aria-selected',tab.dataset.settingsTab===APP_TAB?'true':'false');
  for(const panel of layer.querySelectorAll('[data-settings-tab-panel]'))panel.hidden=panel.dataset.settingsTabPanel!==APP_TAB;
}
function installAppSettings(){
  const layer=q('#cw-settings-v320'),form=q('form',layer),tabs=q('.cw-settings-tabs',form);if(!layer||!form||!tabs)return false;
  let tab=q(`[data-settings-tab="${APP_TAB}"]`,tabs);
  if(!tab){tab=document.createElement('button');tab.type='button';tab.setAttribute('role','tab');tab.setAttribute('aria-selected','false');tab.dataset.settingsTab=APP_TAB;tab.textContent='App & device';tab.addEventListener('click',()=>selectAppTab(layer));tabs.append(tab)}
  let panel=q(`[data-settings-tab-panel="${APP_TAB}"]`,form);
  if(!panel){panel=document.createElement('div');panel.className='cw-settings-tab-panel';panel.dataset.settingsTabPanel=APP_TAB;panel.hidden=true;panel.innerHTML='<section class="cw-clean-panel"><div><h3>Appearance &amp; downloads</h3><p>Device-level controls live here instead of taking space from the Current Quest.</p></div><div class="cw-v441-app-actions"><button type="button" data-cw-v441-theme><b data-cw-v441-theme-label>Theme: System</b><small>Cycle system, dark, and light appearance.</small></button><button type="button" data-cw-v441-downloads><b>Downloads &amp; offline storage</b><small>Manage Civweave downloads and offline packs.</small></button></div></section>';
    q('[data-cw-v441-theme]',panel).addEventListener('click',cycleTheme);q('[data-cw-v441-downloads]',panel).addEventListener('click',openDownloads);form.append(panel)}
  syncThemeLabel();return true;
}
function ensureBrowserPackPwaImport(){
  if(globalThis.CivweaveBrowserPackPwaImportV1?.ensureBridge)return true;
  if(document.querySelector('script[data-cw-v441-browser-pack-import]'))return false;
  const script=document.createElement('script');script.src=BROWSER_PACK_IMPORT_SRC;script.async=false;script.dataset.cwV441BrowserPackImport='';
  (document.head||document.documentElement).append(script);return true;
}
function maintain(){if(!isCivweave())return;installStyle();installNavActions();installAppSettings();syncThemeLabel();ensureBrowserPackPwaImport()}
const observer=new MutationObserver(()=>maintain());
function boot(){installStyle();ensureBrowserPackPwaImport();maintain();observer.observe(document.documentElement,{childList:true,subtree:true});for(const delay of [80,300,900,1800,3600])setTimeout(maintain,delay)}
addEventListener('civweave:model-settings-opened',()=>setTimeout(installAppSettings,0));
addEventListener('civweave:settings-ready',()=>setTimeout(installAppSettings,0));
addEventListener('pageshow',maintain);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
globalThis.CivweaveHomeRelocationV441=Object.freeze({version:VERSION,installNavActions,installAppSettings,ensureBrowserPackPwaImport,openGuilds,openMap,openDownloads,cycleTheme,maintain});
})();