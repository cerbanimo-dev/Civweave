(()=>{
'use strict';
const VERSION='1.0.0-rc22.1';
const PREF_KEY='civweave.portfolio.preferences.v1';
const CLAIM_KEY='civweave.portfolio.resource-claims.v1';
const CONSENT_KEY='civweave.portfolio.consent-requests.v1';
const BRIEF_KEY='civweave.portfolio.briefs.v1';
const HISTORY_KEY='civweave.portfolio.history.v1';
const safe=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f))}catch{return f}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const clone=v=>JSON.parse(JSON.stringify(v));
const text=v=>String(v??'').replace(/\s+/g,' ').trim();
const now=()=>new Date().toISOString();
const uid=p=>`${p}-${crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const IO=()=>window.CivweaveIntentionOrchestrator;
const SS=()=>window.CivweaveStrategySteward;
const AS=()=>window.CivweaveAutonomousSteward;
const LD=()=>window.CivweaveLiveData;
const AQ=()=>window.CivweaveActionableQuad;
const AP=()=>window.CivweaveAdaptivePlan;
function preferences(){return {rankWeights:{suitability:30,availability:20,trust:15,distance:10,cost:15,accessibility:10},briefCadence:'weekly',...safe(PREF_KEY,{})}}
function setPreferences(patch){const next={...preferences(),...clone(patch||{}),updatedAt:now()};save(PREF_KEY,next);return clone(next)}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f}
function dateMs(v){const n=Date.parse(v||'');return Number.isFinite(n)?n:null}
function tokens(v){return new Set(text(v).toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>2))}
function overlap(a,b){const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;const n=[...A].filter(x=>B.has(x)).length;return n/Math.max(1,new Set([...A,...B]).size)}
function rawRecord(recordId){return (LD()?.records||[]).find(x=>x.id===recordId)||null}
function scoreCandidate(candidate,context={}){
 const raw=rawRecord(candidate.id)?.raw||candidate.raw||{};
 const q=text(`${context.query||''} ${context.step?.title||''} ${context.intention?.title||''}`);
 const suitability=Math.min(100,Math.round((overlap(q,`${candidate.title} ${candidate.subtitle||''} ${(candidate.tags||[]).join(' ')}`)*130)+(candidate.score||0)*3));
 const status=text(candidate.status).toLowerCase();
 const availability=/available|open|active|forming|current|offered/.test(status)?90:/pending|reserved|review/.test(status)?45:/complete|closed|fulfilled|cancel/.test(status)?10:60;
 const trust=Math.max(0,Math.min(100,num(raw.trustScore??raw.reputation??raw.rating,50)));
 const distanceRaw=num(raw.distanceMiles??raw.distance??raw.miles,NaN);const distance=Number.isFinite(distanceRaw)?Math.max(0,100-Math.min(100,distanceRaw*8)):55;
 const costRaw=num(raw.cost??raw.price??raw.amount,NaN);const budget=num(context.intention?.constraints?.budget,NaN);const cost=Number.isFinite(costRaw)?(Number.isFinite(budget)&&budget>0?Math.max(0,100-(costRaw/budget)*100):Math.max(10,100-Math.min(90,costRaw))):60;
 const accessText=text(`${raw.accessibility||''} ${candidate.subtitle||''}`).toLowerCase();const need=text(context.intention?.constraints?.accessibility).toLowerCase();const accessibility=need?(accessText&&overlap(need,accessText)>.08?95:45):(accessText?80:60);
 const weights=preferences().rankWeights,total=Object.values(weights).reduce((a,b)=>a+num(b),0)||1;
 const score=Math.round((suitability*weights.suitability+availability*weights.availability+trust*weights.trust+distance*weights.distance+cost*weights.cost+accessibility*weights.accessibility)/total);
 return {...candidate,rank:{score,suitability,availability,trust,distance,cost,accessibility},explanation:[`Suitability ${suitability}`,`Availability ${availability}`,`Trust ${trust}`,`Distance ${distance}`,`Cost fit ${cost}`,`Accessibility ${accessibility}`]};
}
function rankedGapCandidates(one=IO()?.active?.()){
 if(!one)return[];const base=AS()?.gapCandidates?.(one)||[];
 return base.map(c=>scoreCandidate(c,{query:c.matchedQuery,intention:one})).sort((a,b)=>b.rank.score-a.rank.score);
}
function claims(){return safe(CLAIM_KEY,[])}
function saveClaim(item){const all=claims().filter(x=>x.id!==item.id);all.unshift(item);save(CLAIM_KEY,all.slice(0,400));dispatchEvent(new CustomEvent('civweave:portfolio-claim',{detail:clone(item)}));return clone(item)}
function reserveCandidate(intentionId,recordId,{quantity=1,until=null,note=''}={}){
 const record=(LD()?.records||[]).find(x=>x.id===recordId);if(!record)return {ok:false,error:'Candidate record not found.'};
 const competing=claims().filter(x=>x.recordId===recordId&&x.status==='reserved'&&x.intentionId!==intentionId);
 const item={id:uid('claim'),intentionId,recordId,system:record.system,title:record.title,quantity:num(quantity,1),until:until||null,note:text(note),status:competing.length?'contested':'reserved',competingClaimIds:competing.map(x=>x.id),createdAt:now(),updatedAt:now()};
 saveClaim(item);return {ok:true,claim:item,competing};
}
function releaseClaim(id){const item=claims().find(x=>x.id===id);if(!item)return null;item.status='released';item.updatedAt=now();return saveClaim(item)}
function consentRequests(){return safe(CONSENT_KEY,[])}
function requestConsent({intentionId,stepId='',person,role='',message='',expiresHours=72}){
 const item={id:uid('consent'),intentionId,stepId,person:clone(person||{}),role:text(role),message:text(message||`Would you be willing to help with this intention${role?` as ${role}`:''}?`),status:'requested',createdAt:now(),expiresAt:new Date(Date.now()+num(expiresHours,72)*3600000).toISOString()};
 const all=consentRequests();all.unshift(item);save(CONSENT_KEY,all.slice(0,300));
 AQ()?.stage?.({target:person?.system||'civweave',action:'request-collaborator-consent',title:`Ask ${person?.title||person?.name||'a collaborator'} to participate`,payload:item});
 dispatchEvent(new CustomEvent('civweave:consent-requested',{detail:clone(item)}));return clone(item);
}
function respondConsent(id,status,note=''){const all=consentRequests(),item=all.find(x=>x.id===id);if(!item)return null;item.status=['accepted','declined','expired','cancelled'].includes(status)?status:'declined';item.responseNote=text(note);item.respondedAt=now();save(CONSENT_KEY,all);return clone(item)}
function intentionResources(one){const snap=SS()?.snapshot?.(one)||{};const assoc=snap.associations||{};return {people:assoc.people||[],resources:assoc.resources||[],skills:assoc.skills||[],records:assoc.records||[],steps:one.steps||[]}}
function portfolioSnapshot(){
 const intentions=IO()?.list?.()||[],rows=intentions.map(one=>{const strategy=SS()?.snapshot?.(one)||{},adaptive=AP()?.snapshot?.(one)||{},resources=intentionResources(one);return {id:one.id,title:one.title,status:one.status||'active',priority:num(one.priority||one.constraints?.priority,3),progress:num(one.health?.progress),deadline:one.constraints?.deadline||strategy.forecast?.deadline||null,forecast:strategy.forecast||{},risks:[...(strategy.escalations||[]),...(adaptive.conflicts||[])],...resources}});
 const shared=[],collisions=[],peopleLoad={};
 for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
  const a=rows[i],b=rows[j],sameResources=a.resources.filter(x=>b.resources.some(y=>text(y.id||y.title||y)===text(x.id||x.title||x))),samePeople=a.people.filter(x=>b.people.some(y=>text(y.id||y.name||y.title||y)===text(x.id||x.name||x.title||x))),sameSkills=a.skills.filter(x=>b.skills.some(y=>text(y.id||y.name||y.title||y)===text(x.id||x.name||x.title||x)));
  if(sameResources.length||samePeople.length||sameSkills.length)shared.push({a:a.id,b:b.id,aTitle:a.title,bTitle:b.title,resources:sameResources,people:samePeople,skills:sameSkills});
  const ad=dateMs(a.deadline),bd=dateMs(b.deadline);if(ad&&bd&&Math.abs(ad-bd)<7*86400000&&(samePeople.length||sameResources.length))collisions.push({kind:'schedule-resource',severity:4,a:a.id,b:b.id,title:`${a.title} and ${b.title} converge on the same week`,people:samePeople,resources:sameResources});
 }
 for(const row of rows)for(const p of row.people){const k=text(p.id||p.name||p.title||p);if(!k)continue;(peopleLoad[k]??=[]).push(row.id)}
 const overload=Object.entries(peopleLoad).filter(([,ids])=>ids.length>=3).map(([person,ids])=>({person,intentionIds:ids,severity:Math.min(5,ids.length),title:`${person} appears across ${ids.length} intentions`}));
 const activeClaims=claims().filter(x=>['reserved','contested'].includes(x.status));
 return {version:VERSION,generatedAt:now(),intentions:rows,shared,collisions,overload,claims:activeClaims,consents:consentRequests().filter(x=>x.status==='requested'),health:{attention:rows.filter(x=>x.risks.length||x.forecast?.atRisk).length,deadlineRisk:rows.filter(x=>x.forecast?.atRisk).length,collisions:collisions.length,overloadedPeople:overload.length,contestedResources:activeClaims.filter(x=>x.status==='contested').length}};
}
function recommendations(snapshot=portfolioSnapshot()){
 const out=[];
 for(const c of snapshot.collisions)out.push({id:uid('recommendation'),kind:'sequence',priority:5,title:`Sequence ${c.title}`,reason:'Shared people or resources collide near the same deadline.',intentionIds:[c.a,c.b]});
 for(const o of snapshot.overload)out.push({id:uid('recommendation'),kind:'delegate',priority:o.severity,title:`Delegate work currently concentrated on ${o.person}`,reason:`This collaborator appears in ${o.intentionIds.length} monitored intentions.`,intentionIds:o.intentionIds});
 for(const s of snapshot.shared.filter(x=>x.resources.length))out.push({id:uid('recommendation'),kind:'coordinate-resource',priority:4,title:`Coordinate shared resources between ${s.aTitle} and ${s.bTitle}`,reason:'Both intentions depend on at least one matching resource.',intentionIds:[s.a,s.b]});
 const low=snapshot.intentions.filter(x=>x.priority<=2&&x.progress<35),high=snapshot.intentions.filter(x=>x.priority>=4&&x.forecast?.atRisk);if(low.length&&high.length)out.push({id:uid('recommendation'),kind:'pause',priority:5,title:`Pause ${low[0].title} to protect ${high[0].title}`,reason:'A lower-priority intention is competing with a high-priority intention at risk.',intentionIds:[low[0].id,high[0].id]});
 return out.sort((a,b)=>b.priority-a.priority).slice(0,24);
}
function prepareRecommendation(rec){
 const list=IO()?.list?.()||[];if(!rec)return null;
 if(rec.kind==='pause')return IO()?.proposalFor?.(rec.intentionIds[0],{status:'paused',portfolioReason:rec.reason},rec.reason,rec.title);
 if(rec.kind==='sequence')return IO()?.proposalFor?.(rec.intentionIds[1],{portfolioSequenceAfter:rec.intentionIds[0]},rec.reason,rec.title);
 if(rec.kind==='delegate')return IO()?.proposalFor?.(rec.intentionIds[0],{portfolioDelegationNeeded:true,overloadedPerson:rec.title},rec.reason,rec.title);
 return AQ()?.stage?.({target:'civweave',action:'coordinate-portfolio-dependency',title:rec.title,payload:{...rec,reviewRequired:true}});
}
function negotiatePriority(message){
 const q=text(message).toLowerCase(),snap=portfolioSnapshot(),recs=recommendations(snap);
 if(!/(priority|prioritize|pause|sequence|portfolio|too much|overload|all my plans|which intention|what should i focus)/.test(q))return null;
 const ranked=[...snap.intentions].sort((a,b)=>{const ar=(a.forecast?.atRisk?30:0)+a.priority*10+(100-a.progress)*.2+a.risks.length*5;const br=(b.forecast?.atRisk?30:0)+b.priority*10+(100-b.progress)*.2+b.risks.length*5;return br-ar});
 const top=ranked[0];return {kind:'portfolio-guidance',summary:top?`I would protect “${top.title}” first. ${top.forecast?.atRisk?'Its forecast is at risk. ':''}${recs[0]?.reason||'It currently carries the strongest combined priority and attention signal.'}`:'There are no monitored intentions to compare yet.',snapshot:snap,recommendations:recs.slice(0,5),ranked:ranked.slice(0,8)};
}
function briefs(){return safe(BRIEF_KEY,[])}
function generateBrief({period='weekly',force=false}={}){
 const snap=portfolioSnapshot(),recs=recommendations(snap),all=briefs(),latest=all[0],hours=period==='daily'?24:168;if(!force&&latest&&Date.now()-dateMs(latest.createdAt)<hours*3600000)return clone(latest);
 const decisions=recs.filter(x=>x.priority>=4).slice(0,5),brief={id:uid('portfolio-brief'),period,createdAt:now(),health:snap.health,headline:`${snap.intentions.length} monitored intentions · ${snap.health.attention} need attention · ${decisions.length} decisions recommended`,materialChanges:snap.intentions.filter(x=>x.risks.length||x.forecast?.atRisk).map(x=>({id:x.id,title:x.title,progress:x.progress,atRisk:!!x.forecast?.atRisk,risks:x.risks.slice(0,3)})),decisions,recommendation:decisions[0]||null};all.unshift(brief);save(BRIEF_KEY,all.slice(0,100));if(force||decisions.length)AQ()?.addMessage?.('assistant',`Portfolio brief: ${brief.headline}${brief.recommendation?` Recommended next decision: ${brief.recommendation.title}.`:''}`,{portfolioBriefId:brief.id});return clone(brief);
}
function recordHistory(type,payload){const all=safe(HISTORY_KEY,[]);all.unshift({id:uid('portfolio-event'),type,payload:clone(payload),at:now()});save(HISTORY_KEY,all.slice(0,500))}
function tick(){const pref=preferences();generateBrief({period:pref.briefCadence||'weekly'});for(const c of consentRequests()){if(c.status==='requested'&&dateMs(c.expiresAt)<Date.now())respondConsent(c.id,'expired')}}
window.CivweavePortfolioIntelligence={VERSION,preferences,setPreferences,scoreCandidate,rankedGapCandidates,claims,reserveCandidate,releaseClaim,consentRequests,requestConsent,respondConsent,portfolioSnapshot,recommendations,prepareRecommendation,negotiatePriority,briefs,generateBrief,recordHistory,tick};
const originalPlan=()=>AQ()?.plan;setTimeout(()=>{const aq=AQ();if(!aq||aq.__portfolioWrapped)return;const base=aq.plan.bind(aq);aq.plan=async q=>{const portfolio=negotiatePriority(q);if(portfolio){aq.addMessage?.('user',q);aq.addMessage?.('assistant',portfolio.summary,{response:{summary:portfolio.summary,intention:portfolio},portfolio:true});return {summary:portfolio.summary,obligations:[],results:[],actions:[],intention:portfolio}}return base(q)};aq.__portfolioWrapped=true},0);
setInterval(tick,300000);setTimeout(tick,8000);
})();
