const APP_SOURCE='/app/services/anarchadia/src/app.js';
const IMPORTS={
  "'./domain.js'":"'/app/services/anarchadia/src/domain.js'",
  "'./store.js'":"'/app/services/anarchadia/src/store.js'",
  "'./ai.js'":"'/app/services/anarchadia/src/ai.js'",
  "'./export.js'":"'/app/services/anarchadia/src/export.js'"
};
const VISUAL_ROUTE_BLOCK=`const VISUAL_HOST_FOR_ROUTE = {
  workbench:'hall', overview:'observatory', charter:'hub-commons', proposals:'proposal-commons',
  safeguards:'rails', exchange:'federation', ai:'forge', readiness:'observatory', constitution:'ledger'
};
const rawRoute = () => (location.hash || '#hall').slice(1).split('?')[0];
const route = () => VISUAL_ROUTES.has(rawRoute()) ? rawRoute() : (VISUAL_HOST_FOR_ROUTE[rawRoute()] || 'hall');
const visualRequested = true;
const legacyMode = () => false;
try{localStorage.setItem('anarchadia.interface-mode','visual');}catch{}`;
const CABINET_ROUTE_BLOCK=`const VISUAL_HOST_FOR_ROUTE = {
  workbench:'hall', overview:'observatory', charter:'hub-commons', proposals:'proposal-commons',
  safeguards:'rails', exchange:'federation', ai:'forge', readiness:'observatory', constitution:'ledger'
};
const cabinetWorkbench = new URLSearchParams(location.search).get('cabinet') === '1';
const rawRoute = () => (location.hash || '#overview').slice(1).split('?')[0];
const route = () => cabinetWorkbench
  ? (CLASSIC_ROUTES.has(rawRoute()) ? rawRoute() : 'overview')
  : (VISUAL_ROUTES.has(rawRoute()) ? rawRoute() : (VISUAL_HOST_FOR_ROUTE[rawRoute()] || 'hall'));
const visualRequested = !cabinetWorkbench;
const legacyMode = () => cabinetWorkbench;
if(!cabinetWorkbench){try{localStorage.setItem('anarchadia.interface-mode','visual');}catch{}}`;
let loadPromise=null;
function patchSource(source){
  let output=source;
  for(const [before,after] of Object.entries(IMPORTS))output=output.replaceAll(before,after);
  if(!output.includes(VISUAL_ROUTE_BLOCK))throw new Error('The Anarchadia route boundary changed; Cabinet Mode refused to patch an unknown source shape.');
  output=output.replace(VISUAL_ROUTE_BLOCK,CABINET_ROUTE_BLOCK);
  return output;
}
export function loadCabinetWorkbench(){
  if(loadPromise)return loadPromise;
  loadPromise=(async()=>{
    const response=await fetch(APP_SOURCE,{cache:'force-cache'});
    if(!response.ok)throw new Error(`Anarchadia workbench source returned ${response.status}`);
    const source=patchSource(await response.text());
    const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
    try{return await import(url)}finally{setTimeout(()=>URL.revokeObjectURL(url),1000)}
  })();
  return loadPromise;
}
