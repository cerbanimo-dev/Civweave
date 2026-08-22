(()=>{
'use strict';
const VERSION='1.0.12-working-campus-home-relocation-v441-navbar-actions-restore';
const STYLE_ID='cw-working-campus-home-relocation-v441-style';
const APP_TAB='app-device';
const BROWSER_PACK_IMPORT_SRC='/app/local-ai/browser-pack-pwa-import-v1.js?v=1.2.0-progress-and-missing-file';
const PERSISTENT_ACTIONS_SRC='/app/persistent-shell-actions-v1.js?v=1.0.6-v440-navbar-actions-restore';
if(globalThis.CivweaveHomeRelocationV441?.version===VERSION)return;
const isCivweave=()=>String(document.documentElement?.dataset?.civweaveSystemRoute||document.documentElement?.dataset?.civweaveSystem||'').toLowerCase()==='civweave';
if(!isCivweave())return;
const q=(s,r=document)=>r?.querySelector?.(s)||null;
let persistentActionsLoading=false;

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
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
#cw-settings-v320 .cw-settings-tabs{grid-template-columns:repeat(4,minmax(0,1fr))!important}
#cw-settings-v320 .cw-v441-app-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
#cw-settings-v320 .cw-v441-app-actions button{min-height:62px;text-align:left}
#cw-settings-v320 .cw-v441-app-actions button small{display:block;margin-top:4px;color:#cbd4ee;font-weight:400;letter-spacing:0}
@media(max-width:700px){
html[data-civweave-system="civweave"] main.app>header.top,html[data-civweave-system-route="civweave"] main.app>header.top{grid-template-columns:minmax(0,1fr) auto!important;grid-template-areas:"brand brand" "modes settings" "review review"!important}
html[data-civweave-system="civweave"] main.app>header.top[data-hub-session="true"],html[data-civweave-system-route="civweave"] main.app>header.top[data-hub-session="true"]{grid-template-areas:"brand brand" "node node" "modes settings" "review review"!important}
#cw-settings-v320 .cw-settings-tabs{grid-template-columns:repeat(2,minmax(0,1fr))!important}#cw-settings-v320 .cw-v441-app-actions{grid-template-columns:1fr}}
`;(document.head||document.documentElement).append(style);
}
function hiddenButton(id){return document.getElementById(id)}
function openDownloads(){const button=hiddenButton('cw-working-campus-downloads-v243');if(button){button.click();return true}location.assign('/app/index.html?manage=downloads&source=civweave-settings');return true}
function cycleTheme(){const button=q('main.app>header.top [data-cw160-theme]');if(button){button.click();setTimeout(syncThemeLabel,0);return true}return false}
function syncThemeLabel(){const source=q('main.app>header.top [data-cw160-theme]'),target=q('#cw-settings-v320 [data-cw-v441-theme-label]'),label=(source?.textContent||'Theme: System').trim();if(target&&target.textContent!==label)target.textContent=label}
function selectAppTab(layer){for(const tab of layer.querySelectorAll('[data-settings-tab]'))tab.setAttribute('aria-selected',tab.dataset.settingsTab===APP_TAB?'true':'false');for(const panel of layer.querySelectorAll('[data-settings-tab-panel]'))panel.hidden=panel.dataset.settingsTabPanel!==APP_TAB}
function installAppSettings(){
  const layer=q('#cw-settings-v320'),form=q('form',layer),tabs=q('.cw-settings-tabs',form);if(!layer||!form||!tabs)return false;
  let tab=q(`[data-settings-tab="${APP_TAB}"]`,tabs);if(!tab){tab=document.createElement('button');tab.type='button';tab.setAttribute('role','tab');tab.setAttribute('aria-selected','false');tab.dataset.settingsTab=APP_TAB;tab.textContent='App & device';tab.addEventListener('click',()=>selectAppTab(layer));tabs.append(tab)}
  let panel=q(`[data-settings-tab-panel="${APP_TAB}"]`,form);if(!panel){panel=document.createElement('div');panel.className='cw-settings-tab-panel';panel.dataset.settingsTabPanel=APP_TAB;panel.hidden=true;panel.innerHTML='<section class="cw-clean-panel"><div><h3>Appearance &amp; downloads</h3><p>Device-level controls live here instead of taking space from the Current Quest.</p></div><div class="cw-v441-app-actions"><button type="button" data-cw-v441-theme><b data-cw-v441-theme-label>Theme: System</b><small>Cycle system, dark, and light appearance.</small></button><button type="button" data-cw-v441-downloads><b>Downloads &amp; offline storage</b><small>Manage Civweave downloads and offline packs.</small></button></div></section>';q('[data-cw-v441-theme]',panel).addEventListener('click',cycleTheme);q('[data-cw-v441-downloads]',panel).addEventListener('click',openDownloads);form.append(panel)}
  syncThemeLabel();return true;
}
function ensureBrowserPackPwaImport(){if(globalThis.CivweaveBrowserPackPwaImportV1?.ensureBridge&&globalThis.CivweaveBrowserPackPwaImportV1?.version?.startsWith?.('1.2.0-'))return true;const target=new URL(BROWSER_PACK_IMPORT_SRC,location.href).href;if([...document.scripts].some(script=>script.src===target))return false;const script=document.createElement('script');script.src=BROWSER_PACK_IMPORT_SRC;script.async=false;script.dataset.cwV441BrowserPackImport='';(document.head||document.documentElement).append(script);return true}
function ensurePersistentActions(){
  const api=globalThis.CivweavePersistentShellActionsV1;
  if(api?.ensureMounted){api.ensureMounted();return true}
  const existing=[...document.scripts].find(script=>String(script.src||'').includes('/app/persistent-shell-actions-v1.js'));
  if(existing||persistentActionsLoading){setTimeout(()=>globalThis.CivweavePersistentShellActionsV1?.ensureMounted?.(),120);return false}
  persistentActionsLoading=true;
  const script=document.createElement('script');script.src=PERSISTENT_ACTIONS_SRC;script.async=false;script.dataset.cwV441PersistentActions='';
  script.onload=()=>{persistentActionsLoading=false;globalThis.CivweavePersistentShellActionsV1?.ensureMounted?.()};
  script.onerror=()=>{persistentActionsLoading=false};
  (document.head||document.documentElement).append(script);return false;
}
function maintain(){if(!isCivweave())return;installStyle();installAppSettings();syncThemeLabel();ensureBrowserPackPwaImport();ensurePersistentActions()}
const observer=new MutationObserver(()=>maintain());
function boot(){installStyle();ensureBrowserPackPwaImport();ensurePersistentActions();maintain();observer.observe(document.documentElement,{childList:true,subtree:true});for(const delay of [80,300,900,1800,3600])setTimeout(maintain,delay)}
addEventListener('civweave:model-settings-opened',()=>setTimeout(installAppSettings,0));addEventListener('civweave:settings-ready',()=>setTimeout(installAppSettings,0));addEventListener('pageshow',maintain);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
globalThis.CivweaveHomeRelocationV441=Object.freeze({version:VERSION,installAppSettings,ensureBrowserPackPwaImport,ensurePersistentActions,openDownloads,cycleTheme,maintain});
})();