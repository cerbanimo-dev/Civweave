(()=>{
'use strict';
const VERSION='1.0.0-rc22.0';
const THREAD_KEY='civweave.quad.thread.v1';
const REVIEW_KEY='civweave.pending.live-handoffs.v1';
const DECISION_KEY='civweave.handoff.decisions.v1';
const ROUTE_KEY='civweave.active.route.v1';
const LIFECYCLE_KEY='civweave.handoff.lifecycle.v1';
const safe=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}};
const save=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const uid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;
const text=v=>String(v??'').replace(/\s+/g,' ').trim();
const clone=v=>JSON.parse(JSON.stringify(v));
const bus=new EventTarget();
const thread=Object.assign({id:uid(),createdAt:new Date().toISOString(),messages:[],context:{activeRecord:null,activeJourney:null,lastScene:'square'}},safe(THREAD_KEY,{}));
function persist(){thread.updatedAt=new Date().toISOString();save(THREAD_KEY,thread);bus.dispatchEvent(new CustomEvent('quad:updated',{detail:snapshot()}));}
function addMessage(role,content,meta={}){const item={id:uid(),role,content:text(content),at:new Date().toISOString(),...meta};thread.messages.push(item);thread.messages=thread.messages.slice(-120);persist();return clone(item)}
function obligations(){const live=window.CivweaveLiveData?.snapshot?.()||{signals:[]};return (live.signals||[]).filter(x=>x.priority>=3).sort((a,b)=>b.priority-a.priority).slice(0,12)}
function search(query){return window.CivweaveLivingWorld?.search?.(query)||window.CivweaveLiveData?.search?.(query)||[]}
function findRecord(id){return window.CivweaveLiveData?.records?.find(r=>r.id===id)||null}
function openResult(id){const r=findRecord(id);if(!r)return {ok:false,error:'Record not found'};thread.context.activeRecord=id;thread.context.lastScene=r.scene||thread.context.lastScene;persist();if(r.scene)window.CivweaveWorld?.render?.(r.scene);else if(r.deepLink)location.href=r.deepLink;return {ok:true,record:clone(r)}}
function journeyFromRecord(recordId){const r=findRecord(recordId);if(!r)return null;const map={living:'learn-and-practice',fellowfare:'meet-a-need',cerbanimo:'build-something',anarchadia:'meet-a-need'};const template=map[r.system]||'build-something';const j=window.CivweaveLivingWorld?.createJourney?.(template,`Continue: ${r.title}`);if(!j)return null;j.sourceRecord={id:r.id,system:r.system,type:r.type,title:r.title,deepLink:r.deepLink};const state=window.CivweaveLivingWorld.state;state.journeys[j.id].sourceRecord=j.sourceRecord;localStorage.setItem('civweave.living-world.v1',JSON.stringify(state));thread.context.activeJourney=j.id;persist();return clone(state.journeys[j.id])}
function stage({target,action,title,payload={},sourceRecord=null}){const item=window.CivweaveLiveData?.stageHandoff?.({target,kind:`civweave.${action}.v1`,title,payload:{...payload,sourceRecord,threadId:thread.id}});if(item){addMessage('system',`Prepared “${item.title}” for review. Nothing has been changed yet.`,{handoffId:item.id});bus.dispatchEvent(new CustomEvent('quad:staged',{detail:item}))}return item}
function pending(){return safe(REVIEW_KEY,[])}
function decisions(){return safe(DECISION_KEY,[])}
function decide(id,decision,note=''){const list=pending(),index=list.findIndex(x=>x.id===id);if(index<0)return null;const item=list[index];list.splice(index,1);save(REVIEW_KEY,list);const result={...item,decision,decisionNote:text(note),decidedAt:new Date().toISOString()};const history=decisions();history.unshift(result);save(DECISION_KEY,history.slice(0,250));if(decision==='approved'){
 const inboxKey=`civweave.approved-handoffs.${item.target}.v1`, inbox=safe(inboxKey,[]);inbox.unshift({...item,status:'approved',approvedAt:result.decidedAt});save(inboxKey,inbox.slice(0,100));
}
addMessage('system',`${decision==='approved'?'Approved':'Rejected'} “${item.title}”.`,{handoffId:id,decision});bus.dispatchEvent(new CustomEvent('quad:decision',{detail:result}));return clone(result)}
function suggestedActions(query,results=[]){const q=text(query).toLowerCase(),top=results[0];const actions=[];if(top)actions.push({kind:'open',label:`Open ${top.title}`,recordId:top.id,scene:top.scene,deepLink:top.deepLink});if(top&&top.system)actions.push({kind:'journey',label:`Build a journey from ${top.title}`,recordId:top.id});
 const target=/learn|course|skill|teach/.test(q)?'living':/need|offer|borrow|food|ride|tool|material/.test(q)?'fellowfare':/proposal|vote|govern|decision|community rule/.test(q)?'anarchadia':'cerbanimo';
 actions.push({kind:'stage',label:`Prepare a ${target==='living'?'learning path':target==='fellowfare'?'resource or care request':target==='anarchadia'?'collective proposal':'project'} for review`,target,action:target==='living'?'create-learning-path':target==='fellowfare'?'create-exchange':target==='anarchadia'?'create-proposal':'create-project',title:text(query).slice(0,100),payload:{intent:text(query)}});return actions.slice(0,4)}
async function plan(query){const obs=obligations(),results=search(query).slice(0,8),actions=suggestedActions(query,results);addMessage('user',query);let intention=window.CivweaveAutonomousSteward?.preflight?.(query)||null;if(!intention&&window.CivweaveModelSteward?.needsModel?.(query)&&window.CivweaveIntentionOrchestrator?.active?.()){const guided=await window.CivweaveModelSteward.replan(query);if(guided?.ok)intention={kind:'model-replan',summary:guided.session.summary,modelSession:guided.session};}if(!intention){const strategic=window.CivweaveStrategySteward?.interpret?.(query)||null;intention=strategic||window.CivweaveIntentionOrchestrator?.converse?.(query)||null;}const response={summary:intention?.summary||(results.length?`I found ${results.length} useful threads across Civweave.`:'I did not find a matching existing thread, so I prepared routes for creating one safely.'),obligations:obs.slice(0,4),results,actions,intention};addMessage('assistant',response.summary,{response,intentionId:intention?.intention?.id||intention?.proposal?.intentionId||intention?.modelSession?.intentionId||null});return response}
function setRoute(from,to,label='Follow the thread'){const route={id:uid(),from,to,label,createdAt:new Date().toISOString()};save(ROUTE_KEY,route);bus.dispatchEvent(new CustomEvent('route:changed',{detail:route}));return route}
function activeRoute(){return safe(ROUTE_KEY,null)}
function clearRoute(){localStorage.removeItem(ROUTE_KEY);bus.dispatchEvent(new CustomEvent('route:changed',{detail:null}))}
function lifecycle(){return safe(LIFECYCLE_KEY,[])}
function snapshot(){return {version:VERSION,thread:clone(thread),pending:pending(),decisions:decisions(),lifecycle:lifecycle(),obligations:obligations(),activeRoute:activeRoute()}}
window.CivweaveActionableQuad={VERSION,bus,snapshot,thread,addMessage,plan,search,openResult,journeyFromRecord,stage,pending,decisions,decide,setRoute,activeRoute,clearRoute,obligations,lifecycle};
})();
