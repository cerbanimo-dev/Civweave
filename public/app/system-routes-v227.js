(()=>{
'use strict';
const VERSION='1.0.104';
const REVISION='five-system-route-contract-v227';
const BOOT_KEY='civweave.install-boundary.boot.v227';
const ROUTES=Object.freeze({
  civweave:Object.freeze({id:'civweave',label:'Civweave',pathname:'/app/working-campus-v156.html',params:Object.freeze({})}),
  'living-school':Object.freeze({id:'living-school',label:'Living School',pathname:'/app/cabinets/living-school/index.html',params:Object.freeze({cabinet:'1'})}),
  cerbanimo:Object.freeze({id:'cerbanimo',label:'Cerbanimo',pathname:'/app/realm-console-v140.html',params:Object.freeze({system:'cerbanimo',cabinet:'1'})}),
  fellowfare:Object.freeze({id:'fellowfare',label:'FellowFare',pathname:'/app/fellowfare-cabinet-v144.html',params:Object.freeze({cabinet:'1'})}),
  anarchadia:Object.freeze({id:'anarchadia',label:'Anarchadia',pathname:'/app/anarchadia-console-v139.html',params:Object.freeze({cabinet:'1'})})
});
const PATH_TO_ID=new Map(Object.values(ROUTES).map(route=>[route.pathname,route.id]));
function normalizePathname(value){
  let pathname=String(value||'/').split(/[?#]/,1)[0]||'/';
  try{pathname=decodeURI(pathname)}catch{}
  if(pathname.length>1&&pathname.endsWith('/'))pathname=pathname.slice(0,-1);
  return pathname;
}
function identify(value=globalThis.location?.pathname||'/'){
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
function urlFor(id,options={}){
  const route=routeFor(id)||ROUTES.civweave;
  const origin=options.origin||globalThis.location?.origin||'https://civweave.invalid';
  const url=new URL(route.pathname,origin);
  for(const [key,value] of Object.entries(route.params))url.searchParams.set(key,value);
  url.searchParams.set('installed','1');
  url.searchParams.set('navigation',REVISION);
  url.searchParams.set('version',String(options.version||VERSION));
  if(options.source)url.searchParams.set('source',String(options.source));
  if(options.weave)url.searchParams.set('weave',String(options.weave));
  if(options.developer)url.searchParams.set('developer','1');
  return url;
}
function navigate(id,options={}){
  authorize();
  const url=urlFor(id,options);
  if(options.replace)globalThis.location?.replace?.(url.href);else globalThis.location?.assign?.(url.href);
  return url.href;
}
function routes(){return Object.values(ROUTES)}
const api=Object.freeze({version:VERSION,revision:REVISION,bootKey:BOOT_KEY,routeFor,routes,identify,isCanonicalPath,authorize,urlFor,navigate});
globalThis.CivweaveSystemRoutesV227=api;
if(typeof document!=='undefined'&&identify()){
  authorize();
  document.documentElement.dataset.civweaveSystemRoute=identify();
}
})();
