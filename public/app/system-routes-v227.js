(()=>{
'use strict';

const VERSION='1.0.164';
const REVISION='five-system-route-contract-v227';
const SHELL_REVISION='direct-first-class-routes-v1';
const SHELL_PATH='/app/working-campus-v156.html';
const PERSISTENT_ACTIONS_SRC='/app/persistent-shell-actions-v1.js?v=1.0.5-direct-routes';
const PERSISTENT_CONTEXT_SRC='/app/persistent-system-context-v1.js?v=1.0.3-direct-routes';
const GUILD_USAGE_SRC='/app/guild-chat-usage-v1.js?v=1.0.0';
const BOOT_KEY='civweave.install-boundary.boot.v227';
const CONTEXT_KEY='civweave.pending-system-context.v1';
const ROUTES=Object.freeze({
  civweave:Object.freeze({id:'civweave',label:'Civweave',pathname:'/app/working-campus-v156.html',params:Object.freeze({})}),
  'living-school':Object.freeze({id:'living-school',label:'Living School',pathname:'/app/cabinets/living-school/index.html',params:Object.freeze({cabinet:'1'})}),
  cerbanimo:Object.freeze({id:'cerbanimo',label:'Cerbanimo',pathname:'/app/realm-console-v140.html',params:Object.freeze({system:'cerbanimo',cabinet:'1'})}),
  fellowfare:Object.freeze({id:'fellowfare',label:'FellowFare',pathname:'/app/fellowfare-cabinet-v144.html',params:Object.freeze({cabinet:'1'})}),
  anarchadia:Object.freeze({id:'anarchadia',label:'Anarchadia',pathname:'/app/anarchadia-console-v139.html',params:Object.freeze({cabinet:'1'})})
});
const SYSTEM_IDS=Object.freeze(Object.keys(ROUTES));
const PATH_TO_ID=new Map(Object.values(ROUTES).map(route=>[route.pathname,route.id]));
PATH_TO_ID.set('/app/civweave-guild-quest-v1.html','civweave');
if(globalThis.CivweaveSystemRoutesV227?.version===VERSION&&globalThis.CivweaveSystemRoutesV227?.revision===REVISION)return;

function normalizePathname(value){
  let pathname=String(value||'/').split(/[?#]/,1)[0]||'/';
  try{pathname=decodeURI(pathname)}catch{}
  if(pathname.length>1&&pathname.endsWith('/'))pathname=pathname.slice(0,-1);
  return pathname;
}
function identify(value=globalThis.location?.href||globalThis.location?.pathname||'/'){
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
function rememberContext(id){
  const system=String(id||'').toLowerCase();if(!SYSTEM_IDS.includes(system))return false;
  try{globalThis.localStorage?.setItem(CONTEXT_KEY,system)}catch{}
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
function shellUrlFor(id,options={}){return directUrlFor(id,options)}
function shouldUseDirect(){return true}
function urlFor(id,options={}){return directUrlFor(id,options)}
function navigate(id,options={}){
  const system=routeFor(id)?.id||'civweave';
  authorize();rememberContext(system);
  const url=urlFor(system,options);
  if(options.replace)globalThis.location?.replace?.(url.href);else globalThis.location?.assign?.(url.href);
  return url.href;
}
function routes(){return Object.values(ROUTES)}
function legacyRequestedSystem(value=globalThis.location?.href||''){
  try{
    const url=new URL(String(value),globalThis.location?.origin||'https://civweave.invalid');
    if(normalizePathname(url.pathname)!==SHELL_PATH)return'';
    const requested=String(url.searchParams.get('context')||url.searchParams.get('system')||'').toLowerCase();
    return SYSTEM_IDS.includes(requested)?requested:'';
  }catch{return''}
}
function ensureScript(src,ready,name){
  if(typeof document==='undefined')return false;if(ready?.())return true;
  const path=new URL(src,globalThis.location?.href||'https://civweave.invalid').pathname;
  if([...document.scripts].some(script=>{try{return new URL(script.src,globalThis.location?.href||'https://civweave.invalid').pathname===path}catch{return false}}))return false;
  const script=document.createElement('script');script.src=src;script.async=false;if(name)script.dataset[name]='v1';(document.head||document.documentElement).append(script);return true;
}
function ensurePersistentShellActions(){if(globalThis.CivweavePersistentShellActionsV1?.ensureMounted){globalThis.CivweavePersistentShellActionsV1.ensureMounted();return true}return ensureScript(PERSISTENT_ACTIONS_SRC,()=>Boolean(globalThis.CivweavePersistentShellActionsV1),'civweavePersistentShellActions')}
function ensurePersistentSystemContext(){return ensureScript(PERSISTENT_CONTEXT_SRC,()=>Boolean(globalThis.CivweavePersistentSystemContextV1?.owner),'civweavePersistentSystemContext')}
function ensureGuildUsage(){return ensureScript(GUILD_USAGE_SRC,()=>Boolean(globalThis.CivweaveGuildChatUsageV1),'civweaveGuildChatUsage')}
function guildUsageSnapshot(){return globalThis.CivweaveGuildChatUsageV1?.snapshot?.()||null}
function renderGuildUsage(){return Boolean(globalThis.CivweaveGuildChatUsageV1?.render?.())}
async function refreshGuildUsage(options){ensureGuildUsage();return await globalThis.CivweaveGuildChatUsageV1?.refresh?.(options)||guildUsageSnapshot()}

const api=Object.freeze({version:VERSION,revision:REVISION,shellRevision:SHELL_REVISION,shellPath:SHELL_PATH,bootKey:BOOT_KEY,contextKey:CONTEXT_KEY,systems:SYSTEM_IDS,routeFor,routes,identify,isCanonicalPath,authorize,directUrlFor,shellUrlFor,shouldUseDirect,urlFor,navigate,rememberContext,legacyRequestedSystem,ensurePersistentShellActions,ensurePersistentSystemContext,ensureGuildUsage,guildUsageRevision:'guild-chat-usage-v1',guildUsageSnapshot,renderGuildUsage,refreshGuildUsage,singlePersistentShell:false,legacyRealmEntrypoints:true,navigationReloadOnSystemSwitch:true});
globalThis.CivweaveSystemRoutesV227=api;
if(typeof document!=='undefined'&&isCanonicalPath(globalThis.location?.href||globalThis.location?.pathname||'')){
  authorize();
  const current=identify();
  document.documentElement.dataset.civweaveSystemRoute=current||'civweave';
  document.documentElement.dataset.civweaveDirectShell='true';
  try{delete document.documentElement.dataset.civweaveSingleSystemShell}catch{}
  const legacy=legacyRequestedSystem();
  if(current==='civweave'&&legacy&&legacy!=='civweave'){
    rememberContext(legacy);
    const target=urlFor(legacy,{source:'single-shell-migration',recovery:'direct-route-restoration'});
    globalThis.location?.replace?.(target.href);
    return;
  }
  if(current)rememberContext(current);
  ensurePersistentShellActions();ensurePersistentSystemContext();ensureGuildUsage();
}
})();