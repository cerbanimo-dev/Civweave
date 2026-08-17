(()=>{
'use strict';
const VERSION='1.0.5-anarchadia-runtime-stability-v159-quest-paths';
if(globalThis.AnarchadiaRuntimeStabilityV159?.version===VERSION)return;
const STORAGE_KEY='civweave.anarchadia.citizen-console.v139';
const LOADER_SRC='/app/family-ai-loader-v105.js?v=headless-canonical-r1';
const QUEST_KEYS={campus:'civweave.working-campus.v1',intentions:'civweave.intentions.v127',inbox:'civweave.realm-inbox.v1',handoff:'civweave.active-handoff.v1'};
let loaderPromise=null;
const clean=(value,max=12000)=>String(value??'').slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const list=value=>Array.isArray(value)?value:[];
function compactLegacyState(){
  const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return;
  const state=parse(raw,null);if(!state||state.schema!=='civweave.anarchadia-console.v1')return;
  let changed=raw.length>1500000;
  const proposals=(Array.isArray(state.proposals)?state.proposals:[]).slice(0,80).map(proposal=>{
    const next={...proposal};
    for(const key of ['title','problem','expected','risk','evidence','semanticReview'])if(next[key]!=null){const clipped=clean(next[key],key==='title'?160:12000);if(clipped!==next[key])changed=true;next[key]=clipped}
    next.acceptance=(Array.isArray(next.acceptance)?next.acceptance:[]).slice(0,50).map(value=>clean(value,800));
    next.pipeline=(Array.isArray(next.pipeline)?next.pipeline:[]).slice(-40).map(item=>({...item,note:clean(item?.note,1600)}));
    if(next.patch?.files){next.patch={...next.patch,files:next.patch.files.slice(0,20).map(file=>({...file,path:clean(file?.path,300),content:clean(file?.content,120000)}))}}
    if(next.preview?.srcdoc?.length>350000){next.preview={...next.preview,srcdoc:clean(next.preview.srcdoc,350000)};changed=true}
    return next;
  });
  if(proposals.length!==(state.proposals||[]).length)changed=true;
  const ledger=(Array.isArray(state.ledger)?state.ledger:[]).slice(0,250).map(item=>({...item,detail:clean(item?.detail,2400)}));
  if(ledger.length!==(state.ledger||[]).length)changed=true;
  if(!changed)return;
  try{localStorage.setItem(`${STORAGE_KEY}.quarantine.${Date.now()}`,raw.slice(0,2000000))}catch{}
  localStorage.setItem(STORAGE_KEY,JSON.stringify({...state,proposals,ledger,compactedAt:new Date().toISOString()}));
}
function actualLoader(){const api=globalThis.CivweaveFamilyAILoaderV105;return api&&!api.__anarchadiaLazyProxy&&typeof api.ensure==='function'&&typeof api.openChat==='function'?api:null}
function loadFamily(){
  const ready=actualLoader();if(ready)return Promise.resolve(ready);if(loaderPromise)return loaderPromise;
  loaderPromise=new Promise((resolve,reject)=>{const existing=[...document.scripts].find(script=>script.src&&new URL(script.src).pathname==='/app/family-ai-loader-v105.js');const script=existing||document.createElement('script');let attempts=0;const timer=setInterval(()=>{const api=actualLoader();if(api){clearInterval(timer);resolve(api)}else if(attempts++>240){clearInterval(timer);reject(new Error('Civweave AI loader did not become ready.'))}},50);if(!existing){script.src=LOADER_SRC;script.async=false;script.onerror=()=>{clearInterval(timer);reject(new Error('Civweave AI loader could not be loaded.'))};document.head.append(script)}}).catch(error=>{loaderPromise=null;throw error});return loaderPromise;
}
const proxy={
  __anarchadiaLazyProxy:true,
  version:'anarchadia-lazy-loader-v159-canonical-chat',
  ensure:async()=>{const api=await loadFamily();return api.ensure()},
  warm:async()=>{const api=await loadFamily();return api.warm?.()||api.ensure()},
  openChat:async(...args)=>{const api=await loadFamily();return api.openChat(...args)},
  openSettings:async launcher=>globalThis.CivweaveSettingsGatewayV317?.open?.(launcher)||null,
  reset:()=>{loaderPromise=null}
};
if(!actualLoader())globalThis.CivweaveFamilyAILoaderV105=proxy;
async function askMerlin(_system,text,rows=[]){
  const api=await loadFamily();await api.ensure();
  const assistant=globalThis.CivweaveAssistantV141;if(!assistant?.respond)throw new Error('The shared assistant runtime did not become ready.');
  const history=(Array.isArray(rows)?rows:[]).filter(row=>!row.pending).slice(-14);
  history.push({role:'system',text:'You are Merlin, Anarchadia’s guide. Reflect intent, mark assumptions, translate civic or technical language into plain mechanics, and close with a concrete next action. Never claim authority or consensus.'});
  const result=await assistant.respond({text,systemId:'anarchadia',history});
  const answer=clean(result.response?.answer||'Merlin returned no text.',12000),next=clean(result.response?.choice?.nextAction,800);
  return{role:'assistant',text:next?`${answer}\n\nNext: ${next}`:answer,provider:result.provider,model:result.model};
}
function openGovernance(proposalId=''){location.assign(`/app/anarchadia-governance-v145.html${proposalId?`?proposal=${encodeURIComponent(proposalId)}`:''}`)}
function openWorkbench(route='workbench'){location.assign(`/app/services/anarchadia/workbench.html?cabinet=1#${encodeURIComponent(route)}`)}
function currentQuestPlan(){
  const campus=parse(localStorage.getItem(QUEST_KEYS.campus),{});
  if(campus?.plan)return campus.plan;
  const intentions=list(parse(localStorage.getItem(QUEST_KEYS.intentions),[]));
  return intentions.find(item=>item?.state==='active'||item?.plan?.state==='active')?.plan||intentions.find(item=>item?.kind==='weave-plan'&&item?.state==='review')?.plan||null;
}
function realmLabel(realm){return({'living-school':'Living School',cerbanimo:'Cerbanimo',fellowfare:'FellowFare',anarchadia:'Anarchadia'}[realm]||String(realm||'Realm'))}
function prepareQuestHandoff(plan,path){
  if(!plan?.id||!path?.id)return false;
  const inbox=list(parse(localStorage.getItem(QUEST_KEYS.inbox),[])).filter(packet=>packet?.payload?.weaveId===plan.id&&packet?.target===path.realm);
  const handoff={target:path.realm,pathId:path.id,weaveId:plan.id,wish:plan.wish||'',plan,packets:inbox,preparedAt:new Date().toISOString(),source:'anarchadia-passport-v159'};
  try{localStorage.setItem(QUEST_KEYS.handoff,JSON.stringify(handoff));return true}catch{return false}
}
function openQuestPath(plan,path){
  if(!plan||!path)return false;
  prepareQuestHandoff(plan,path);
  const query=`weave=${encodeURIComponent(plan.id)}&path=${encodeURIComponent(path.id)}&source=anarchadia-passport`;
  const realm=String(path.realm||'').toLowerCase();
  if(realm==='anarchadia'){location.assign(`/app/services/anarchadia/workbench.html?cabinet=1&${query}#overview`);return true}
  if(realm==='living-school'){location.assign(`/app/cabinets/living-school/index.html?cabinet=1&${query}`);return true}
  if(realm==='cerbanimo'){location.assign(`/app/realm-console-v140.html?system=cerbanimo&cabinet=1&${query}`);return true}
  if(realm==='fellowfare'){location.assign(`/app/fellowfare-cabinet-v144.html?cabinet=1&${query}`);return true}
  return false;
}
function installQuestActionStyle(){
  if(document.getElementById('ac-quest-action-style-v159'))return;
  const style=document.createElement('style');style.id='ac-quest-action-style-v159';style.textContent=`#ac-passport-paths .ac-path-card .ac-quest-path-action{width:100%;min-height:38px;margin-top:10px;border:1px solid #ff4aa466;border-radius:10px;background:linear-gradient(135deg,#ff2b911f,#f6d35412);color:inherit;font:800 11px/1 system-ui;letter-spacing:.05em;text-transform:uppercase;cursor:pointer}#ac-passport-paths .ac-path-card .ac-quest-path-action:active{transform:translateY(1px)}`;document.head.append(style);
}
function mountQuestPathActions(){
  const host=document.getElementById('ac-passport-paths'),plan=currentQuestPlan();if(!host||!plan)return false;
  const paths=list(plan.paths),cards=[...host.querySelectorAll('.ac-path-card')];if(!paths.length||!cards.length)return false;
  installQuestActionStyle();
  cards.forEach((card,index)=>{
    const path=paths[index];if(!path?.id||card.querySelector('.ac-quest-path-action'))return;
    const button=document.createElement('button');button.type='button';button.className='ac-quest-path-action';button.dataset.questPathId=path.id;button.textContent=path.realm==='anarchadia'?'Work this Anarchadia path':`Open in ${realmLabel(path.realm)}`;
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openQuestPath(plan,path)});
    card.append(button);
  });
  return true;
}
document.addEventListener('click',event=>{
  const governed=event.target.closest?.('[data-ag145-open]');if(governed){event.preventDefault();event.stopImmediatePropagation();openGovernance(governed.dataset.ag145Open||'');return}
  const workbench=event.target.closest?.('[data-anarchadia-workbench]');if(workbench){event.preventDefault();event.stopImmediatePropagation();openWorkbench(workbench.dataset.anarchadiaWorkbench||'workbench');return}
  if(event.target.closest?.('[data-cwf-chat]')&&!actualLoader()){event.preventDefault();event.stopImmediatePropagation();proxy.openChat('anarchadia',{contextSystem:'anarchadia'});return}
},true);
addEventListener('anarchadia:passport-rendered',()=>queueMicrotask(mountQuestPathActions));
addEventListener('civweave:intentions-changed',()=>queueMicrotask(mountQuestPathActions));
if(document.readyState==='loading')addEventListener('DOMContentLoaded',()=>setTimeout(mountQuestPathActions,0),{once:true});else setTimeout(mountQuestPathActions,0);
globalThis.AnarchadiaRuntimeStabilityV159={version:VERSION,loadFamily,compactLegacyState,askMerlin,openQuestPath,mountQuestPathActions,settingsInputOwnership:false,settingsOwner:'settings-gateway-v317'};
})();