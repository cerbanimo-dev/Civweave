(()=>{
'use strict';
const VERSION='1.0.7-anarchadia-passport-v193';
if(globalThis.AnarchadiaPassportV193?.version===VERSION)return;
const KEYS={
  console:'civweave.anarchadia.citizen-console.v139',
  rewards:'civweave.rewards.v156',
  domain:'civweave.domain.v156',
  campus:'civweave.working-campus.v1',
  intentions:'civweave.intentions.v127',
  living:'civweave.living-school.cabinet.v151',
  cerbanimo:'cerbanimo.quest-engine.v144',
  fellowfare:'fellowfare.mvp.state.v3'
};
const WATCHED_EVENTS=['civweave:rewards-changed','civweave:reward-bridge','civweave:domain-synced','civweave:proof-progress-synced','civweave:peer-review-recorded'];
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const read=(key,fallback)=>parse(localStorage.getItem(key),fallback);
const list=value=>Array.isArray(value)?value:[];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number=value=>Number.isFinite(Number(value))?Number(value):0;
const clamp=(value,min=0,max=100)=>Math.min(max,Math.max(min,number(value)));
const fmt=new Intl.NumberFormat(undefined,{maximumFractionDigits:1});
const when=value=>{const date=new Date(value||0);return Number.isFinite(date.getTime())?date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:date.getFullYear()===new Date().getFullYear()?undefined:'numeric'}):'local record'};
let queued=false;

function rewardEvents(){
  const value=read(KEYS.rewards,{events:[]});
  return (Array.isArray(value)?value:list(value?.events)).filter(row=>row&&number(row.amount)>0);
}
function balances(events=rewardEvents()){
  const out={xp:0,acorns:0,buttons:0,cotokens:0,skills:{}};
  for(const row of events){
    const amount=number(row.amount),currency=String(row.currency||'').toLowerCase();
    if(currency==='xp'){
      const skill=String(row.skill||'general').trim()||'general';
      out.xp+=amount;out.skills[skill]=(out.skills[skill]||0)+amount;
    }else if(currency==='acorn')out.acorns+=amount;
    else if(currency==='button')out.buttons+=amount;
    else if(currency==='cotoken')out.cotokens+=amount;
  }
  return out;
}
function levelState(xp){
  const total=Math.max(0,number(xp));
  const level=Math.floor(Math.sqrt(total/40))+1;
  const floor=40*Math.pow(level-1,2),ceiling=40*Math.pow(level,2);
  const progress=ceiling>floor?clamp(((total-floor)/(ceiling-floor))*100):100;
  return{level,total,floor,ceiling,progress,remaining:Math.max(0,ceiling-total)};
}
function rankName(level){
  if(level>=16)return'Horizon Keeper';
  if(level>=11)return'System Weaver';
  if(level>=7)return'Commons Builder';
  if(level>=4)return'Threadrunner';
  return'Anarchadian Citizen';
}
function activePlan(){
  const campus=read(KEYS.campus,{});
  if(campus?.plan)return campus.plan;
  const intentions=list(read(KEYS.intentions,[]));
  const item=intentions.find(row=>row?.state==='active'||row?.plan?.state==='active')||intentions.find(row=>row?.kind==='weave-plan'&&row?.state==='review');
  return item?.plan||null;
}
function sourceLabel(system){return({'living-school':'Living School',cerbanimo:'Cerbanimo',fellowfare:'FellowFare',civweave:'Civweave',anarchadia:'Anarchadia'}[system]||String(system||'Local ledger'));}
function currencyMeta(currency){
  return({xp:{glyph:'✦',label:'Skill XP'},acorn:{glyph:'●',label:'Acorn'},button:{glyph:'⊙',label:'Button'},cotoken:{glyph:'⬡',label:'Cotoken'}}[currency]||{glyph:'◆',label:String(currency||'Reward')});
}
function snapshot(){
  const events=rewardEvents(),wallet=balances(events),plan=activePlan(),consoleState=read(KEYS.console,{}),domain=read(KEYS.domain,{}),cerbanimo=read(KEYS.cerbanimo,{});
  return{events,wallet,plan,consoleState,domain,cerbanimo,level:levelState(wallet.xp)};
}
function setText(id,value){const node=document.getElementById(id);if(node)node.textContent=String(value??'');}
function setWidth(id,value){const node=document.getElementById(id);if(node)node.style.width=`${clamp(value)}%`;}
function renderRank(data){
  const orbit=document.getElementById('ac-passport-level-orbit');
  if(orbit)orbit.style.setProperty('--passport-progress',`${data.level.progress/100}turn`);
  setText('ac-passport-level',data.level.level);
  setText('ac-passport-rank',rankName(data.level.level));
  setText('ac-passport-total-xp',`${fmt.format(data.level.total)} total XP`);
  setText('ac-passport-level-progress',`${fmt.format(data.level.remaining)} XP to level ${data.level.level+1}`);
  setText('ac-passport-level-range',`${fmt.format(data.level.floor)} / ${fmt.format(data.level.ceiling)} XP tier`);
  setWidth('ac-passport-xp-bar',data.level.progress);
}
function renderWallet(data){
  setText('ac-passport-wallet-xp',fmt.format(data.wallet.xp));
  setText('ac-passport-wallet-acorns',fmt.format(data.wallet.acorns));
  setText('ac-passport-wallet-buttons',fmt.format(data.wallet.buttons));
  setText('ac-passport-wallet-cotokens',fmt.format(data.wallet.cotokens));
}
function renderSkills(data){
  const host=document.getElementById('ac-passport-skills');if(!host)return;
  const rows=Object.entries(data.wallet.skills).sort((a,b)=>b[1]-a[1]);
  if(!rows.length){host.innerHTML='<div class="ac-empty-passport">No Skill XP receipts yet. Completed Living School modules and validated Cerbanimo work will appear here.</div>';return;}
  host.innerHTML=rows.slice(0,8).map(([skill,xp])=>{
    const level=levelState(xp),systems=[...new Set(data.events.filter(row=>row.currency==='xp'&&String(row.skill||'general')===skill).map(row=>sourceLabel(row.system)))];
    return `<article class="ac-skill-row"><div class="ac-skill-name"><b>${esc(skill)}</b><small>${esc(systems.join(' + ')||'Canonical reward ledger')}</small></div><div class="ac-skill-level"><b>LV ${level.level}</b><small>${fmt.format(xp)} XP</small></div><div class="ac-skill-bar" aria-label="${Math.round(level.progress)} percent through skill level"><span style="width:${level.progress}%"></span></div></article>`;
  }).join('');
}
function pathProgress(path){
  const steps=list(path?.steps),done=list(path?.progress).length;
  if(path?.status==='completed')return 100;
  return steps.length?clamp((done/steps.length)*100):0;
}
function renderPaths(data){
  const host=document.getElementById('ac-passport-paths');if(!host)return;
  const paths=list(data.plan?.paths);
  setText('ac-passport-weave-state',data.plan?String(data.plan.state||'review').toUpperCase():'NO ACTIVE WEAVE');
  if(!data.plan||!paths.length){host.innerHTML='<div class="ac-empty-passport">No active intention paths. Activate a reviewed weave in Civweave and its learning, labor, materials, and civic routes will map here.</div>';return;}
  host.innerHTML=paths.slice(0,6).map(path=>{
    const progress=pathProgress(path),proof=path.proofProgress||{},reason=proof.reason||path.completionCriteria||'Evidence has not been checked yet.';
    return `<article class="ac-path-card"><div class="ac-path-top"><small>${esc(sourceLabel(path.realm))}</small><b>${esc(path.status||data.plan.state||'ready')}</b></div><h4>${esc(path.title||'Untitled path')}</h4><p>${esc(path.purpose||'')}</p><div class="ac-path-meter" aria-label="${Math.round(progress)} percent complete"><span style="width:${progress}%"></span></div><div class="ac-path-proof">${Math.round(progress)}% · ${esc(proof.source?`${sourceLabel(proof.source)} proof: ${reason}`:reason)}</div></article>`;
  }).join('');
}
function achievementRows(data){
  const paths=list(data.plan?.paths),completed=paths.filter(path=>path.status==='completed').length;
  return[
    {glyph:'Ⓐ',title:'Passport Awakened',text:'Citizen identity is active.',unlocked:Boolean(data.consoleState?.passportId)},
    {glyph:'✦',title:'First Skill Thread',text:'Earn any Skill XP.',unlocked:data.wallet.xp>0},
    {glyph:'●',title:'Living Knowledge',text:'Earn an Acorn from learning or validation.',unlocked:data.wallet.acorns>0},
    {glyph:'⊙',title:'Value in Motion',text:'Earn or settle a Button receipt.',unlocked:data.wallet.buttons>0},
    {glyph:'⬡',title:'Vested Builder',text:'Cross the peer-validation Cotoken threshold.',unlocked:data.wallet.cotokens>0},
    {glyph:'↯',title:'Pathbreaker',text:'Complete an evidence-backed weave path.',unlocked:completed>0}
  ];
}
function renderChronicles(data){
  const summary=document.getElementById('ac-passport-chronicle'),host=document.getElementById('ac-passport-achievements');
  if(summary){
    if(data.plan)summary.innerHTML=`<article class="ac-path-card"><div class="ac-path-top"><small>CURRENT STORY CHRONICLE</small><b>${esc(data.plan.state||'review')}</b></div><h4>${esc(data.plan.title||data.plan.wish||'Active intention')}</h4><p>${esc(data.plan.outcome||data.plan.wish||'The current weave is forming its next chapter.')}</p></article>`;
    else summary.innerHTML='<div class="ac-empty-passport">Your first reviewed intention will begin the Chronicle trail.</div>';
  }
  if(host)host.innerHTML=achievementRows(data).map(row=>`<article class="ac-achievement${row.unlocked?'':' is-locked'}"><span class="ac-achievement-glyph">${row.glyph}</span><span><b>${esc(row.title)}</b><small>${esc(row.unlocked?'UNLOCKED · '+row.text:'LOCKED · '+row.text)}</small></span></article>`).join('');
}
function renderReceipts(data){
  const host=document.getElementById('ac-passport-receipts');if(!host)return;
  const rows=[...data.events].sort((a,b)=>Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0)).slice(0,7);
  if(!rows.length){host.innerHTML='<div class="ac-empty-passport">No reward receipts yet. The Passport will mirror canonical ledger events here without minting or rewriting them.</div>';return;}
  host.innerHTML=rows.map(row=>{const meta=currencyMeta(row.currency),skill=row.skill?` · ${row.skill}`:'';return `<article class="ac-receipt"><span class="ac-receipt-glyph">${meta.glyph}</span><span><b>${esc(sourceLabel(row.system))} ${esc(meta.label)}</b><small>${esc(when(row.createdAt))}${esc(skill)} · ${esc(row.phase||row.sourceId||'verified receipt')}</small></span><strong>+${fmt.format(row.amount)}</strong></article>`}).join('');
}
function explicitSupply(data){
  const candidates=[data.domain?.passport?.ownership?.totalCotokenSupply,data.domain?.passport?.ownership?.totalSupply,data.domain?.cotokenSupply,data.cerbanimo?.ownership?.totalCotokenSupply,data.cerbanimo?.ownership?.totalSupply];
  return candidates.map(number).find(value=>value>0)||0;
}
function renderOwnership(data){
  const supply=explicitSupply(data),share=supply>0?clamp((data.wallet.cotokens/supply)*100,0,100):null;
  setText('ac-passport-cotoken-count',`${fmt.format(data.wallet.cotokens)} vested`);
  setText('ac-passport-ownership-share',share==null?'Share awaits a canonical network supply ledger.':`${fmt.format(share)}% of canonical supply (${fmt.format(supply)} total)`);
}
function renderIdentity(data){
  const id=data.consoleState?.passportId||'AC-LOCAL';
  setText('ac-passport-id',id);
  setText('ac-passport-sync-state',`${data.events.length} reward receipt${data.events.length===1?'':'s'} · ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`);
}
function render(){
  const root=document.querySelector('.ac-passport-expanded');if(!root)return null;
  const data=snapshot();
  renderIdentity(data);renderRank(data);renderWallet(data);renderSkills(data);renderPaths(data);renderChronicles(data);renderReceipts(data);renderOwnership(data);
  root.dataset.passportReady='true';
  try{dispatchEvent(new CustomEvent('anarchadia:passport-rendered',{detail:{version:VERSION,level:data.level.level,balances:data.wallet,receiptCount:data.events.length}}))}catch{}
  return data;
}
function queueRender(){if(queued)return;queued=true;(globalThis.requestAnimationFrame||setTimeout)(()=>{queued=false;render()});}
function sync(){
  try{globalThis.CivweaveDomainBridgeV156?.syncCampus?.();globalThis.CivweaveDomainBridgeV156?.syncRewards?.()}catch{}
  return render();
}
function openLedger(){globalThis.AnarchadiaCitizenConsoleV158?.setScreen?.('ledger')}
function bind(){
  document.querySelectorAll('[data-passport-refresh]').forEach(button=>button.addEventListener('click',sync));
  document.querySelector('[data-passport-ledger]')?.addEventListener('click',openLedger);
  addEventListener('storage',event=>{if(Object.values(KEYS).includes(event.key))queueRender()});
  for(const name of WATCHED_EVENTS)addEventListener(name,queueRender);
  addEventListener('pageshow',queueRender);
  render();
}
function boot(){if(document.querySelector('.ac-passport-expanded'))bind()}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();
globalThis.AnarchadiaPassportV193=Object.freeze({version:VERSION,KEYS,snapshot,render,sync,levelState,ledgerAuthority:'display-only',writesCanonicalLedgers:false});
})();
