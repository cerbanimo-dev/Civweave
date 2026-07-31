(()=>{
'use strict';
const VERSION='1.0.0-rc22.2';
const SCENARIO_KEY='commonweave.portfolio.scenarios.v1';
const COMMITMENT_KEY='commonweave.portfolio.commitments.v1';
const CAPACITY_KEY='commonweave.portfolio.capacity.v1';
const BUDGET_KEY='commonweave.portfolio.budgets.v1';
const AGENDA_KEY='commonweave.portfolio.agendas.v1';
const safe=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f))}catch{return f}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const clone=v=>JSON.parse(JSON.stringify(v));
const text=v=>String(v??'').replace(/\s+/g,' ').trim();
const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const now=()=>new Date().toISOString();
const uid=p=>`${p}-${crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const PI=()=>window.CommonweavePortfolioIntelligence;
const IO=()=>window.CommonweaveIntentionOrchestrator;
const AQ=()=>window.CommonweaveActionableQuad;
const MS=86400000;
function scenarios(){return safe(SCENARIO_KEY,[])}
function commitments(){return safe(COMMITMENT_KEY,[])}
function capacities(){return safe(CAPACITY_KEY,{people:{},resources:{},spaces:{},vehicles:{},updatedAt:null})}
function budgets(){return safe(BUDGET_KEY,{money:null,hours:null,labor:null,energy:null,credits:null,updatedAt:null})}
function setBudgets(patch){const next={...budgets(),...clone(patch||{}),updatedAt:now()};save(BUDGET_KEY,next);dispatchEvent(new CustomEvent('commonweave:portfolio-budget',{detail:clone(next)}));return clone(next)}
function setCapacity(kind,id,entry){const all=capacities();if(!all[kind])all[kind]={};all[kind][id]={...(all[kind][id]||{}),...clone(entry||{}),id,kind,updatedAt:now()};all.updatedAt=now();save(CAPACITY_KEY,all);dispatchEvent(new CustomEvent('commonweave:portfolio-capacity',{detail:clone(all[kind][id])}));return clone(all[kind][id])}
function createCommitment({intentionId,stepId='',kind='person',subjectId='',subjectTitle='',quantity=1,startAt=null,endAt=null,status='tentative',source='commonweave',terms={}}){
 const item={id:uid('commitment'),intentionId,stepId,kind,subjectId,text:subjectTitle,quantity:num(quantity,1),startAt,endAt,status,source,terms:clone(terms),createdAt:now(),updatedAt:now(),history:[{status,at:now(),source}]};
 const all=commitments();all.unshift(item);save(COMMITMENT_KEY,all.slice(0,800));dispatchEvent(new CustomEvent('commonweave:commitment',{detail:clone(item)}));return clone(item);
}
function updateCommitment(id,status,patch={}){const all=commitments(),item=all.find(x=>x.id===id);if(!item)return null;item.status=status;Object.assign(item,clone(patch));item.updatedAt=now();item.history=[...(item.history||[]),{status,at:item.updatedAt,note:text(patch.note),source:patch.source||'commonweave'}];save(COMMITMENT_KEY,all);dispatchEvent(new CustomEvent('commonweave:commitment',{detail:clone(item)}));return clone(item)}
function activeCommitments(){return commitments().filter(x=>['tentative','requested','accepted','partial','confirmed'].includes(x.status))}
function intentionDemand(row){
 const remaining=Math.max(0,100-num(row.progress));
 const duration=num(row.forecast?.remainingWorkDays,Math.max(1,Math.ceil(remaining/12)));
 const people=Math.max(1,(row.people||[]).length||Math.ceil(duration/5));
 const resources=Math.max(0,(row.resources||[]).length);
 const money=num(row.constraints?.budget??row.forecast?.estimatedCost,resources*35+duration*12);
 const labor=Math.max(1,Math.round(duration*1.4));
 const energy=Math.max(1,Math.round((duration+row.risks.length*2)*1.1));
 return {duration,people,resources,money,labor,energy,credits:num(row.constraints?.credits,0)};
}
function baseSnapshot(){return PI()?.portfolioSnapshot?.()||{intentions:[],collisions:[],overload:[],claims:[],health:{}}}
function simulate(change={}){
 const base=baseSnapshot(),rows=clone(base.intentions||[]),type=change.type||'prioritize',target=change.intentionId||rows[0]?.id;
 const notes=[];let freed={money:0,labor:0,energy:0,days:0,people:0},cost={money:0,labor:0,energy:0,days:0};
 for(const row of rows){row._demand=intentionDemand(row);if(row.id===target){if(type==='prioritize'){row.priority=Math.min(5,num(row.priority,3)+1);row.forecast.atRisk=false;row.forecast.remainingWorkDays=Math.max(1,Math.round(row._demand.duration*.8));cost.labor+=Math.ceil(row._demand.labor*.15);cost.energy+=Math.ceil(row._demand.energy*.1);notes.push(`Concentrates attention on ${row.title}.`)}if(type==='delay'){const days=num(change.days,7);row.deadline=row.deadline?new Date(Date.parse(row.deadline)+days*MS).toISOString():null;row.forecast.atRisk=false;freed.days+=days;notes.push(`Moves ${row.title} by ${days} days.`)}if(type==='pause'){row.status='paused';freed.money+=row._demand.money;freed.labor+=row._demand.labor;freed.energy+=row._demand.energy;freed.people+=row._demand.people;notes.push(`Pauses ${row.title} and releases its tentative capacity.`)}if(type==='delegate'){const amount=Math.max(1,num(change.amount,1));row.people=[...(row.people||[]),...Array.from({length:amount},(_,i)=>({name:`Unassigned delegate ${i+1}`}))];freed.labor+=Math.ceil(row._demand.labor*.25);notes.push(`Moves part of ${row.title} to additional collaborators.`)}}}
 const active=rows.filter(x=>x.status!=='paused'),deadlineRisk=active.filter(x=>x.forecast?.atRisk).length;
 const collisions=Math.max(0,num(base.health?.collisions)-((type==='pause'||type==='delay')?1:0));
 const overload=Math.max(0,num(base.health?.overloadedPeople)-((type==='delegate'||type==='pause')?1:0));
 const result={id:uid('scenario'),createdAt:now(),change:clone(change),target,baseline:{health:clone(base.health),intentions:base.intentions.map(x=>({id:x.id,title:x.title,status:x.status,priority:x.priority,progress:x.progress,forecast:x.forecast}))},projected:{intentions:rows,health:{...base.health,deadlineRisk,collisions,overloadedPeople:overload,attention:Math.max(0,num(base.health?.attention)-((type==='pause'||type==='prioritize')?1:0))}},freed,cost,notes,summary:`${type} scenario: ${notes.join(' ')} Projected deadline risks ${num(base.health?.deadlineRisk)} → ${deadlineRisk}; collisions ${num(base.health?.collisions)} → ${collisions}.`};
 const all=scenarios();all.unshift(result);save(SCENARIO_KEY,all.slice(0,100));dispatchEvent(new CustomEvent('commonweave:portfolio-scenario',{detail:clone(result)}));return clone(result);
}
function prepareScenario(scenario){if(!scenario)return null;return AQ()?.stage?.({target:'commonweave',action:'apply-portfolio-scenario',title:`Apply portfolio scenario: ${scenario.change.type}`,payload:{scenarioId:scenario.id,change:scenario.change,summary:scenario.summary,projected:scenario.projected,reviewRequired:true}})}
function forecast(){
 const snap=baseSnapshot(),caps=capacities(),b=budgets(),commits=activeCommitments(),rows=snap.intentions.map(row=>({id:row.id,title:row.title,demand:intentionDemand(row),priority:row.priority,progress:row.progress,atRisk:!!row.forecast?.atRisk}));
 const totals=rows.reduce((a,x)=>{for(const k of ['money','labor','energy','credits'])a[k]+=num(x.demand[k]);a.hours+=num(x.demand.duration)*8;return a},{money:0,labor:0,energy:0,credits:0,hours:0});
 const pressure={};for(const k of Object.keys(totals)){const limit=num(b[k],0);pressure[k]={demand:totals[k],limit:limit||null,ratio:limit?totals[k]/limit:null,over:limit?Math.max(0,totals[k]-limit):0}}
 const expiring=commits.filter(x=>x.endAt&&Date.parse(x.endAt)<Date.now()+7*MS);
 const unconfirmed=commits.filter(x=>['tentative','requested','partial'].includes(x.status));
 return {generatedAt:now(),rows,totals,pressure,capacities:caps,commitments:commits,signals:[...Object.entries(pressure).filter(([,x])=>x.ratio>1).map(([k,x])=>({kind:'budget-pressure',severity:5,title:`${k} demand exceeds portfolio limit by ${Math.round(x.over)}`})),...expiring.map(x=>({kind:'expiring-commitment',severity:4,title:`${x.text||x.subjectId} becomes unavailable soon`})),...unconfirmed.map(x=>({kind:'unconfirmed',severity:3,title:`${x.text||x.subjectId} is not yet confirmed for an intention`}))]};
}
function weeklyAgenda({days=7,startDate=new Date()}={}){
 const snap=baseSnapshot(),f=forecast(),items=[];let cursor=new Date(startDate);cursor.setHours(9,0,0,0);
 const ranked=[...snap.intentions].sort((a,b)=>(b.priority-a.priority)+(b.forecast?.atRisk?2:0)-(a.forecast?.atRisk?2:0));
 for(let d=0;d<days;d++){
  const date=new Date(cursor.getTime()+d*MS);const weekday=date.getDay();const capacity=weekday===0||weekday===6?2:4;let slots=capacity;
  for(const row of ranked){if(slots<=0||row.status==='paused'||num(row.progress)>=100)continue;const minutes=row.forecast?.atRisk?90:60;items.push({id:uid('agenda'),date:date.toISOString().slice(0,10),start:`${String(9+(capacity-slots)*2).padStart(2,'0')}:00`,minutes,intentionId:row.id,title:row.title,activity:row.forecast?.atRisk?'Protect critical path':'Advance next viable step',priority:row.priority,energy:row.forecast?.atRisk?'high':'medium'});slots--;}
 }
 const agenda={id:uid('weekly-agenda'),createdAt:now(),startDate:new Date(startDate).toISOString(),days,items,signals:f.signals,summary:`${items.length} focus blocks across ${days} days, weighted toward priority and deadline risk.`};const all=safe(AGENDA_KEY,[]);all.unshift(agenda);save(AGENDA_KEY,all.slice(0,30));return clone(agenda);
}
function agendas(){return safe(AGENDA_KEY,[])}
function negotiate(message){const q=text(message).toLowerCase();if(!/(what happens|scenario|simulate|if i prioritize|if i pause|move the deadline|weekly agenda|plan my week|capacity|budget pressure)/.test(q))return null;let result;if(/agenda|plan my week/.test(q))result={kind:'agenda',agenda:weeklyAgenda()};else if(/capacity|budget/.test(q))result={kind:'forecast',forecast:forecast()};else{const snap=baseSnapshot(),target=snap.intentions.find(x=>q.includes(text(x.title).toLowerCase()))?.id||snap.intentions[0]?.id;const type=/pause/.test(q)?'pause':/delay|move the deadline/.test(q)?'delay':/delegate/.test(q)?'delegate':'prioritize';result={kind:'scenario',scenario:simulate({type,intentionId:target,days:7})}}return result}
window.CommonweavePredictivePortfolio={VERSION,scenarios,commitments,capacities,budgets,setBudgets,setCapacity,createCommitment,updateCommitment,activeCommitments,simulate,prepareScenario,forecast,weeklyAgenda,agendas,negotiate};
setTimeout(()=>{const aq=AQ();if(!aq||aq.__predictiveWrapped)return;const base=aq.plan.bind(aq);aq.plan=async q=>{const out=negotiate(q);if(!out)return base(q);aq.addMessage?.('user',q);const summary=out.scenario?.summary||out.agenda?.summary||(out.forecast?.signals?.length?`${out.forecast.signals.length} portfolio pressure signals need attention.`:'Portfolio capacity is currently within configured limits.');aq.addMessage?.('assistant',summary,{predictivePortfolio:out});return {summary,obligations:[],results:[],actions:[],intention:out}};aq.__predictiveWrapped=true},50);
})();
