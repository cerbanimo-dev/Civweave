(()=>{
'use strict';
const VERSION='1.1.0-fellowfare-market-v2';
const BUS=new EventTarget();
const CACHE={updatedAt:null,records:[],signals:[],counts:{},systems:{},anarchadiaPending:true};
const safeJson=(key,fallback=null)=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}};
const text=v=>String(v??'').replace(/\s+/g,' ').trim();
const arr=v=>Array.isArray(v)?v:[];
const titleOf=(v,f='Untitled')=>text(v?.title||v?.name||v?.label||v?.subject||v?.description||f).slice(0,180);
const idOf=(v,prefix,index)=>text(v?.id||v?.questId||v?.taskId||v?.curriculumId||v?.proposalId||`${prefix}-${index}`);
const normalize=(system,type,item,index,extra={})=>({
 id:`${system}:${type}:${idOf(item,type,index)}`,system,type,sourceId:idOf(item,type,index),
 title:titleOf(item,`${type} ${index+1}`),subtitle:text(item?.description||item?.summary||item?.status||item?.category||extra.subtitle||''),
 status:text(item?.status||extra.status||'active').toLowerCase(),updatedAt:item?.updatedAt||item?.createdAt||item?.savedAt||null,
 deepLink:extra.deepLink||`services/${system==='living'?'living-school':system}/index.html`,scene:extra.scene||null,
 tags:[system,type,text(item?.category),text(item?.kind),text(item?.mode),text(item?.status),...(extra.tags||[])].filter(Boolean),raw:item
});
function cerbanimo(){
 const s=safeJson('cerbanimo-pocket-constellary-v0.6',{}), out=[];
 const groups=[['project',s.projects||s.constellations||[],'cerbanimo'],['quest',s.quests||[],'cerbanimo'],['task',s.tasks||[],'cerbanimo'],['proposal',s.proposals||[],'dispatch'],['evidence',s.evidence||s.evidenceItems||[],'archive']];
 groups.forEach(([type,items,scene])=>arr(items).forEach((x,i)=>out.push(normalize('cerbanimo',type,x,i,{scene,deepLink:`services/cerbanimo/index.html#${type}/${idOf(x,type,i)}`}))));
 if(s.activeQuest)out.push(normalize('cerbanimo','active quest',s.activeQuest,0,{scene:'dispatch'}));
 return {state:s,records:out};
}
function living(){
 const s=safeJson('living-academy-v19-state',{}), out=[];
 const groups=[['curriculum',s.curricula||s.curriculum?[].concat(s.curricula||s.curriculum):[],'gardens'],['course',s.courses||s.paths||[],'gardens'],['practicum',s.practica||s.practicums||[],'workshop'],['challenge',s.challenges||[],'festival'],['credential',s.credentials||s.badges||[],'chronicle']];
 groups.forEach(([type,items,scene])=>arr(items).filter(Boolean).forEach((x,i)=>out.push(normalize('living',type,x,i,{scene,deepLink:`services/living-school/index.html#${type}/${idOf(x,type,i)}`}))));
 const learner=s.learner||{}; if(learner.currentGoal||learner.name) out.push(normalize('living','learner',learner,0,{scene:'home',subtitle:learner.currentGoal||'Learner profile'}));
 return {state:s,records:out};
}
function fellowfare(){
 const market=safeJson('fellowfare.marketplace.v2',{}),legacy=safeJson('fellowfare.mvp.state.v3',safeJson('fellowfare.mvp.state.v2',safeJson('fellowfare.mvp.state.v1',{}))),out=[];
 const demoTitles=new Set(['Pickup truck and hauling help','Reclaimed windows for greenhouse build','Weekly local bread buying circle','Two hours of household reset help','Shared workshop space one evening a week','Flyer and one-page web design']);
 const listedSourceIds=new Set();
 arr(market.listings).forEach((x,i)=>{listedSourceIds.add(text(x?.source?.sourceId));out.push(normalize('fellowfare','listing',x,i,{scene:'festival',deepLink:`services/fellowfare/index.html#listing/${idOf(x,'listing',i)}`,tags:[text(x?.kind),text(x?.source?.system)]}))});
 arr(market.orders).forEach((x,i)=>out.push(normalize('fellowfare','arrangement',x,i,{scene:'archive',deepLink:`services/fellowfare/index.html#arrangement/${idOf(x,'arrangement',i)}`})));
 [['listing',legacy.threads||[],'festival'],['proposal',legacy.proposals||[],'dispatch'],['agreement',legacy.agreements||[],'archive'],['assembly',legacy.assemblies||[],'festival'],['message',legacy.messages||[],'dispatch']].forEach(([type,items,scene])=>arr(items).filter(x=>!(type==='listing'&&(demoTitles.has(x?.title)||listedSourceIds.has(text(x?.id))))).forEach((x,i)=>out.push(normalize('fellowfare',type,x,i,{scene,deepLink:`services/fellowfare/index.html#${type}/${idOf(x,type,i)}`}))));
 return {state:{marketplace:market,legacy},records:out};
}
function openAnarchadia(){return new Promise(resolve=>{
 if(!indexedDB){resolve({state:{},records:[]});return}
 const req=indexedDB.open('anarchadia-charter-forge',1); req.onerror=()=>resolve({state:{},records:[]});
 req.onsuccess=()=>{const db=req.result; if(!db.objectStoreNames.contains('workspace')){db.close();resolve({state:{},records:[]});return}
 const tx=db.transaction('workspace','readonly'),get=tx.objectStore('workspace').get('active');
 get.onerror=()=>resolve({state:{},records:[]}); get.onsuccess=()=>{const s=get.result||{},out=[];
 [['proposal',s.proposals||[],'dispatch'],['outcome',s.outcomes||[],'archive'],['amendment',s.amendments||[],'archive'],['workgroup',s.civicSystem?.workgroups||[],'workshop'],['bulletin',s.civicSystem?.bulletins||[],'dispatch'],['experiment',s.civicSystem?.experiments||[],'frontier']].forEach(([type,items,scene])=>arr(items).forEach((x,i)=>out.push(normalize('anarchadia',type,x,i,{scene,deepLink:`services/anarchadia/index.html#${type}/${idOf(x,type,i)}`}))));
 db.close();resolve({state:s,records:out});};};
 })}
function signalFor(r){
 const st=r.status||''; let priority=0,kind='activity';
 if(/urgent|blocked|appeal|failed|overdue|needs.?review|pending/.test(st)){priority=3;kind='attention'}
 else if(/active|current|forming|open|submitted/.test(st)){priority=2;kind='active'}
 else if(/complete|settled|ratified|passed/.test(st)){priority=1;kind='milestone'}
 if(r.type==='message'&&r.raw?.read===false){priority=4;kind='message'}
 return priority?{id:`signal:${r.id}`,system:r.system,kind,priority,title:r.title,detail:r.subtitle,status:r.status,scene:r.scene,deepLink:r.deepLink,recordId:r.id}:null;
}
function compile(systems){
 const records=Object.values(systems).flatMap(x=>x.records||[]),signals=records.map(signalFor).filter(Boolean).sort((a,b)=>b.priority-a.priority).slice(0,80);
 const counts={total:records.length,attention:signals.filter(x=>x.priority>=3).length,active:signals.filter(x=>x.kind==='active').length,milestones:signals.filter(x=>x.kind==='milestone').length};
 for(const name of ['cerbanimo','living','fellowfare','anarchadia'])counts[name]=records.filter(r=>r.system===name).length;
 Object.assign(CACHE,{updatedAt:new Date().toISOString(),records,signals,counts,systems,anarchadiaPending:false});
 BUS.dispatchEvent(new CustomEvent('live-data:updated',{detail:snapshot()})); return snapshot();
}
async function refresh(){const systems={cerbanimo:cerbanimo(),living:living(),fellowfare:fellowfare(),anarchadia:await openAnarchadia()};return compile(systems)}
function snapshot(){return {version:VERSION,updatedAt:CACHE.updatedAt,records:CACHE.records.map(stripRaw),signals:CACHE.signals.map(x=>({...x})),counts:{...CACHE.counts},systems:Object.fromEntries(Object.entries(CACHE.systems).map(([k,v])=>[k,{recordCount:v.records?.length||0,hasState:!!Object.keys(v.state||{}).length}]))}}
function stripRaw(r){const {raw,...safe}=r;return safe}
function search(query){const terms=text(query).toLowerCase().split(/\s+/).filter(Boolean);if(!terms.length)return[];return CACHE.records.map(r=>{const hay=[r.title,r.subtitle,r.system,r.type,r.status,...r.tags].join(' ').toLowerCase();const score=terms.reduce((n,t)=>n+(hay.includes(t)?2:0)+(r.title.toLowerCase().includes(t)?3:0),0);return {r,score}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,40).map(({r,score})=>({...stripRaw(r),score:score+5}));}
function scenePulse(scene){const signals=CACHE.signals.filter(x=>x.scene===scene);return {scene,attention:signals.filter(x=>x.priority>=3).length,active:signals.filter(x=>x.kind==='active').length,milestones:signals.filter(x=>x.kind==='milestone').length,signals:signals.slice(0,6)}}
function stageHandoff({target,kind='civweave.live-handoff.v1',title,payload={}}){const key='civweave.pending.live-handoffs.v1',list=safeJson(key,[]),item={id:crypto.randomUUID?.()||String(Date.now()),target,kind,title:text(title||'Civweave handoff'),payload,createdAt:new Date().toISOString(),status:'review-required'};list.unshift(item);localStorage.setItem(key,JSON.stringify(list.slice(0,100)));BUS.dispatchEvent(new CustomEvent('live-data:handoff',{detail:item}));return item}
window.addEventListener('storage',e=>{if(e.key&&/cerbanimo|living|fellowfare|civweave/.test(e.key))refresh()});
window.CivweaveLiveData={VERSION,bus:BUS,refresh,snapshot,search,scenePulse,stageHandoff,get records(){return CACHE.records},get signals(){return CACHE.signals},get counts(){return CACHE.counts}};
refresh(); setInterval(refresh,30000);
})();
