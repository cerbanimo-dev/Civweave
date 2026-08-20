(()=>{
'use strict';

const VERSION='1.0.164';
const REVISION='five-system-route-contract-v229-single-shell-context';
const SHELL_REVISION='persistent-single-shell-v1';
const SHELL_PATH='/app/working-campus-v156.html';
const PERSISTENT_ACTIONS_SRC='/app/persistent-shell-actions-v1.js?v=1.0.0-direct-shell';
const PERSISTENT_CONTEXT_SRC='/app/persistent-system-context-v1.js?v=1.0.1';
const GUILD_USAGE_SRC='/app/guild-chat-usage-v1.js?v=1.0.0';
const BOOT_KEY='civweave.install-boundary.boot.v227';
const CONTEXT_KEY='civweave.pending-system-context.v1';
const SYSTEMS=Object.freeze([
  Object.freeze({id:'civweave',label:'Civweave'}),
  Object.freeze({id:'living-school',label:'Living School'}),
  Object.freeze({id:'cerbanimo',label:'Cerbanimo'}),
  Object.freeze({id:'fellowfare',label:'FellowFare'}),
  Object.freeze({id:'anarchadia',label:'Anarchadia'})
]);
const SYSTEM_IDS=Object.freeze(SYSTEMS.map(row=>row.id));
const ROUTES=Object.freeze(Object.fromEntries(SYSTEMS.map(row=>[row.id,Object.freeze({...row,pathname:SHELL_PATH,params:Object.freeze(row.id==='civweave'?{}:{context:row.id})})])));
const EXTRA_CANONICAL_PATHS=new Set(['/app/civweave-guild-quest-v1.html']);
if(globalThis.CivweaveSystemRoutesV227?.version===VERSION&&globalThis.CivweaveSystemRoutesV227?.revision===REVISION)return;

function normalizePathname(value){let pathname=String(value||'/').split(/[?#]/,1)[0]||'/';try{pathname=decodeURI(pathname)}catch{}if(pathname.length>1&&pathname.endsWith('/'))pathname=pathname.slice(0,-1);return pathname}
function contextFrom(value){try{const url=new URL(String(value),globalThis.location?.origin||'https://civweave.invalid'),context=String(url.searchParams.get('context')||'').toLowerCase();return SYSTEM_IDS.includes(context)?context:''}catch{return''}}
function identify(value=globalThis.location?.href||globalThis.location?.pathname||'/'){
  let pathname='';try{pathname=new URL(String(value),globalThis.location?.origin||'https://civweave.invalid').pathname}catch{pathname=String(value||'')}
  pathname=normalizePathname(pathname);
  if(pathname===SHELL_PATH)return contextFrom(value)||'civweave';
  if(EXTRA_CANONICAL_PATHS.has(pathname))return'civweave';
  return'';
}
function routeFor(id){return ROUTES[String(id||'').toLowerCase()]||null}
function isCanonicalPath(value){let pathname='';try{pathname=new URL(String(value),globalThis.location?.origin||'https://civweave.invalid').pathname}catch{pathname=String(value||'')};pathname=normalizePathname(pathname);return pathname===SHELL_PATH||EXTRA_CANONICAL_PATHS.has(pathname)}
function authorize(){try{globalThis.sessionStorage?.setItem(BOOT_KEY,'1')}catch{}try{globalThis.sessionStorage?.setItem('civweave.install-boundary.boot.v226','1')}catch{}return true}
function rememberContext(id){const system=String(id||'').toLowerCase();if(!SYSTEM_IDS.includes(system))return false;try{globalThis.localStorage?.setItem(CONTEXT_KEY,system)}catch{}return true}
function directUrlFor(id,options={}){
  const route=routeFor(id)||ROUTES.civweave,origin=options.origin||globalThis.location?.origin||'https://civweave.invalid',url=new URL(SHELL_PATH,origin);
  if(route.id!=='civweave')url.searchParams.set('context',route.id);
  url.searchParams.set('installed','1');url.searchParams.set('navigation',REVISION);url.searchParams.set('version',String(options.version||VERSION));
  if(options.source)url.searchParams.set('source',String(options.source));if(options.weave)url.searchParams.set('weave',String(options.weave));if(options.feature)url.searchParams.set('feature',String(options.feature));if(options.developer)url.searchParams.set('developer','1');if(options.recovery)url.searchParams.set('recovery',String(options.recovery));return url;
}
function shellUrlFor(id,options={}){return directUrlFor(id,options)}
function shouldUseDirect(){return true}
function urlFor(id,options={}){return directUrlFor(id,options)}
function sameShell(){return normalizePathname(globalThis.location?.pathname||'')===SHELL_PATH}
function navigate(id,options={}){
  const system=routeFor(id)?.id||'civweave';authorize();rememberContext(system);
  if(sameShell()){
    try{if(globalThis.CivweavePersistentSystemContextV1?.switchContext?.(system,{source:options.source||'system-routes',open:null,focus:false}))return globalThis.location?.href||urlFor(system,options).href}catch{}
    try{globalThis.dispatchEvent?.(new CustomEvent('civweave:system-context-request',{detail:{system,source:options.source||'system-routes',navigationReload:false}}))}catch{}
    try{const next=new URL(globalThis.location.href);if(system==='civweave')next.searchParams.delete('context');else next.searchParams.set('context',system);globalThis.history?.replaceState?.(globalThis.history.state,'',`${next.pathname}${next.search}${next.hash}`)}catch{}
    return globalThis.location?.href||urlFor(system,options).href;
  }
  const url=urlFor(system,options);if(options.replace)globalThis.location?.replace?.(url.href);else globalThis.location?.assign?.(url.href);return url.href;
}
function routes(){return SYSTEMS.map(row=>ROUTES[row.id])}
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

const api=Object.freeze({version:VERSION,revision:REVISION,shellRevision:SHELL_REVISION,shellPath:SHELL_PATH,bootKey:BOOT_KEY,contextKey:CONTEXT_KEY,systems:SYSTEM_IDS,routeFor,routes,identify,isCanonicalPath,authorize,directUrlFor,shellUrlFor,shouldUseDirect,urlFor,navigate,rememberContext,ensurePersistentShellActions,ensurePersistentSystemContext,ensureGuildUsage,guildUsageRevision:'guild-chat-usage-v1',guildUsageSnapshot,renderGuildUsage,refreshGuildUsage,singlePersistentShell:true,legacyRealmEntrypoints:false,navigationReloadOnSystemSwitch:false});
globalThis.CivweaveSystemRoutesV227=api;
if(typeof document!=='undefined'&&isCanonicalPath(globalThis.location?.href||globalThis.location?.pathname||'')){
  authorize();document.documentElement.dataset.civweaveSystemRoute='civweave';document.documentElement.dataset.civweaveDirectShell='true';document.documentElement.dataset.civweaveSingleSystemShell='v1';
  const requested=contextFrom(globalThis.location?.href||'');if(requested)rememberContext(requested);
  ensurePersistentShellActions();ensurePersistentSystemContext();ensureGuildUsage();
}
})();
