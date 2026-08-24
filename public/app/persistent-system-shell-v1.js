(()=>{
'use strict';
const VERSION='1.0.0-persistent-five-system-stage';
const SYSTEMS=new Set(['civweave','living-school','cerbanimo','fellowfare','anarchadia']);
const ROUTES=Object.freeze({
  civweave:['/app/working-campus-v440.html',{}],
  'living-school':['/app/cabinets/living-school/index.html',{cabinet:'1'}],
  cerbanimo:['/app/realm-console-v140.html',{system:'cerbanimo',cabinet:'1'}],
  fellowfare:['/app/fellowfare-cabinet-v144.html',{cabinet:'1'}],
  anarchadia:['/app/anarchadia-console-v139.html',{cabinet:'1'}]
});
const frame=()=>document.getElementById('cw-persistent-system-stage');
const loading=()=>document.getElementById('cw-persistent-system-loading');
const errorBox=()=>document.getElementById('cw-persistent-system-error');
let current='';
let loadToken=0;
let loadTimer=0;

function cleanSystem(value){const id=String(value||'').toLowerCase();return SYSTEMS.has(id)?id:'civweave'}
function contentUrl(system,{feature=''}={}){
  system=cleanSystem(system);const [path,params]=ROUTES[system];const url=new URL(path,location.origin);
  for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
  url.searchParams.set('installed','1');url.searchParams.set('embed','1');url.searchParams.set('persistentShell','1');
  if(feature)url.searchParams.set('feature',String(feature));
  return url;
}
function shellUrl(system,{feature=''}={}){
  const url=new URL('/app/persistent-system-shell-v1.html',location.origin);url.searchParams.set('system',cleanSystem(system));url.searchParams.set('installed','1');if(feature)url.searchParams.set('feature',String(feature));return url;
}
function mark(system){
  current=cleanSystem(system);document.documentElement.dataset.civweaveSystem=current;document.documentElement.dataset.cwThemedCurrent=current;document.documentElement.dataset.persistentSystem=current;
  try{localStorage.setItem('civweave.pending-system-context.v1',current)}catch{}
  try{globalThis.CivweaveFamilyNavigationV178?.syncCurrentSelection?.(current)}catch{}
}
function showLoading(){const node=loading();if(node)node.hidden=false;const error=errorBox();if(error)error.dataset.open='0'}
function hideLoading(){const node=loading();if(node)node.hidden=true}
function showError(message){hideLoading();const node=errorBox();if(node){node.textContent=String(message||'System did not finish loading.');node.dataset.open='1'}}
function navigate(system,{feature='',replace=false,source='persistent-navbar'}={}){
  system=cleanSystem(system);mark(system);const url=shellUrl(system,{feature});history[replace?'replaceState':'pushState']({system,feature},'',`${url.pathname}${url.search}`);
  const target=contentUrl(system,{feature}),host=frame();if(!host)return false;
  const token=++loadToken;showLoading();clearTimeout(loadTimer);loadTimer=setTimeout(()=>{if(token===loadToken)showError(`${system} is taking too long to open.`)},9000);
  host.title=`${system} · Civweave`;host.src=target.href;
  try{dispatchEvent(new CustomEvent('civweave:system-route-changed',{detail:{system,feature,source,version:VERSION,persistent:true}}))}catch{}
  return true;
}
function intercept(event){
  if(event.defaultPrevented||event.button!=null&&event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=event.target?.closest?.('#cw-themed-system-nav a[data-system]');
  if(link){if(link.classList.contains('is-menu-open'))return;event.preventDefault();event.stopImmediatePropagation();navigate(link.dataset.system,{source:'shared-navbar'});return}
  const quick=event.target?.closest?.('#cw-themed-system-nav-menu [data-cw-nav-feature]');
  if(quick){event.preventDefault();event.stopImmediatePropagation();navigate(quick.dataset.cwNavSystem,{feature:quick.dataset.cwNavFeature,source:'shared-navbar-quick'});try{globalThis.CivweaveFamilyNavigationV178?.closeQuickMenu?.({restoreFocus:false})}catch{}}
}
function boot(){
  document.addEventListener('click',intercept,true);
  const host=frame();host?.addEventListener('load',()=>{clearTimeout(loadTimer);hideLoading();const node=errorBox();if(node)node.dataset.open='0'});
  const query=new URLSearchParams(location.search);navigate(cleanSystem(query.get('system')),{feature:query.get('feature')||'',replace:true,source:'shell-boot'});
  addEventListener('popstate',()=>{const query=new URLSearchParams(location.search);navigate(cleanSystem(query.get('system')),{feature:query.get('feature')||'',replace:true,source:'history'});});
}

globalThis.CivweavePersistentSystemShellV1=Object.freeze({version:VERSION,navigate,contentUrl,shellUrl,current:()=>current,systems:[...SYSTEMS],persistentNavbar:true,stage:'iframe-content-only'});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
