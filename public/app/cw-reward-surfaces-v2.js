(()=>{
'use strict';
if(globalThis.CivweaveRewardSurfacesV2)return;
const api=globalThis.CivweaveCanonicalRewardsV2;if(!api)throw Error('Canonical reward ledger must load before surfaces.');
const V='2.1.0',TREE_KEY='living-school.skill-tree.v2';let queued=false,verifyTicket=0;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c])),num=v=>Number.isFinite(Number(v))?Number(v):0,fmt=v=>new Intl.NumberFormat(undefined,{maximumFractionDigits:1}).format(num(v));
const signedAmount=entry=>entry?.operation==='burn'?-Math.abs(num(entry.amount)):num(entry.amount);
const currentAccountId=()=>document.documentElement?.dataset?.passportAccountId||document.body?.dataset?.passportAccountId||'passport:local';
function setText(id,value){const node=document.getElementById(id);if(node)node.textContent=String(value)}
function calculatePassportFromLedger(ledger=api.readLedger(),options={}){
  const accountId=String(options.accountId||'passport:local'),all=Array.isArray(ledger?.entries)?ledger.entries:[],entries=all.filter(entry=>String(entry.accountId||'passport:local')===accountId);
  const data={schema:'anarchadia.passport-ledger-projection.v2',authority:'civweave.reward-ledger.v2',accountId,skillXp:0,acorns:0,buttons:0,skills:{},entries,ledgerUpdatedAt:ledger?.updatedAt};
  for(const entry of data.entries){
    const amount=signedAmount(entry);
    if(entry.assetType==='skill-xp'){
      const skillId=api.skillSlug(entry.skillId||entry.skillName||'general-practice');
      const row=data.skills[skillId]||(data.skills[skillId]={skillId,name:entry.skillName||skillId,xp:0,learningXp:0,doingXp:0,otherXp:0,receipts:0});
      row.xp+=amount;row.receipts+=1;
      if(entry.sourceKind==='learning')row.learningXp+=amount;else if(entry.sourceKind==='doing')row.doingXp+=amount;else row.otherXp+=amount;
      data.skillXp+=amount;
    }else if(entry.assetType==='acorn')data.acorns+=amount;
    else if(entry.assetType==='button')data.buttons+=amount;
  }
  for(const row of Object.values(data.skills)){
    row.xp=Math.max(0,Number(row.xp.toFixed(2)));
    row.learningXp=Number(row.learningXp.toFixed(2));
    row.doingXp=Number(row.doingXp.toFixed(2));
    row.otherXp=Number(row.otherXp.toFixed(2));
    Object.assign(row,api.levelState(row.xp));
  }
  data.skillXp=Math.max(0,Number(data.skillXp.toFixed(2)));
  data.acorns=Math.max(0,Number(data.acorns.toFixed(2)));
  data.buttons=Math.max(0,Number(data.buttons.toFixed(2)));
  return data;
}
function writeTree(){const accountId=currentAccountId(),skills=api.livingTreeProjection(accountId),state={schema:'living-school.skill-tree.v2',authority:'civweave.reward-ledger.v2',accountId,skills,updatedAt:new Date().toISOString()};localStorage.setItem(TREE_KEY,JSON.stringify(state));try{dispatchEvent(new CustomEvent('living-school:skill-tree-updated',{detail:state}))}catch{}return state}
function renderTree(){const state=writeTree();for(const host of document.querySelectorAll('[data-living-tree-skills],[data-ls-skill-tree]')){host.innerHTML=state.skills.length?state.skills.map(row=>`<article class="ls-skill-tree-node" data-skill-id="${esc(row.skillId||row.id)}"><header><b>${esc(row.name)}</b><strong>LV ${row.level}</strong></header><small>${fmt(row.xp)} Skill XP · ${fmt(row.learningXp)} learning + ${fmt(row.doingXp)} doing</small><div class="ls-skill-tree-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(row.progress)}"><span style="width:${row.progress}%"></span></div><small>${fmt(row.remaining)} XP to level ${row.level+1}</small></article>`).join(''):'<div class="ls-empty">Complete a lesson or validated task to grow the Living Tree.</div>'}}
function renderPassport(){
  if(!document.getElementById('ac-passport-wallet-xp'))return;
  const ledger=api.readLedger(),accountId=currentAccountId(),data=calculatePassportFromLedger(ledger,{accountId});
  setText('ac-passport-wallet-xp',fmt(data.skillXp));setText('ac-passport-wallet-acorns',fmt(data.acorns));setText('ac-passport-wallet-buttons',fmt(data.buttons));setText('ac-passport-total-xp',`${fmt(data.skillXp)} total Skill XP`);
  const skills=document.getElementById('ac-passport-skills');if(skills){const rows=Object.values(data.skills).sort((a,b)=>b.xp-a.xp);skills.innerHTML=rows.length?rows.slice(0,12).map(row=>`<article class="ac-skill-row" data-canonical-skill="${esc(row.skillId)}"><div class="ac-skill-name"><b>${esc(row.name)}</b><small>${fmt(row.learningXp)} learning + ${fmt(row.doingXp)} doing XP</small></div><div class="ac-skill-level"><b>LV ${row.level}</b><small>${fmt(row.xp)} XP · ${fmt(row.remaining)} to next</small></div><div class="ac-skill-bar" aria-label="${Math.round(row.progress)} percent through skill level"><span style="width:${row.progress}%"></span></div></article>`).join(''):'<div class="ac-empty-passport">No canonical Skill XP receipts yet. Learning and validated work will grow the Living Tree here.</div>'}
  const receipts=document.getElementById('ac-passport-receipts');if(receipts){const rows=[...data.entries].sort((a,b)=>Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0)).slice(0,10);receipts.innerHTML=rows.length?rows.map(row=>{const amount=signedAmount(row),glyph=row.assetType==='skill-xp'?'✦':row.assetType==='acorn'?'●':'⊙',label=row.assetType==='skill-xp'?`Skill XP · ${row.skillName||row.skillId}`:row.assetType==='acorn'?'Acorn':'Button',sign=amount>=0?'+':'';return`<article class="ac-receipt" data-canonical-hash="${esc(row.hash)}"><span class="ac-receipt-glyph">${glyph}</span><span><b>${esc(label)}</b><small>${esc(row.sourceSystem)} · ${esc(row.sourceKind)} · ${esc(row.operation||'earn')} · ${esc(row.hash?.slice(0,20)||'pending')}</small></span><strong>${sign}${fmt(amount)}</strong></article>`}).join(''):'<div class="ac-empty-passport">No canonical reward receipts yet.</div>'}
  const ticket=++verifyTicket;setText('ac-passport-sync-state',`Calculating from ${data.entries.length} signed ledger entr${data.entries.length===1?'y':'ies'}…`);
  api.verifyLedger(ledger).then(status=>{if(ticket!==verifyTicket)return;setText('ac-passport-sync-state',status.ok?`Verified and calculated from ${status.entryCount} signed ledger entr${status.entryCount===1?'y':'ies'}`:`Ledger integrity warning · ${status.errors.length} failed check${status.errors.length===1?'':'s'}`)}).catch(()=>{if(ticket===verifyTicket)setText('ac-passport-sync-state','Ledger verification unavailable')});
}
function render(){renderTree();renderPassport()}
function queue(){if(queued)return;queued=true;(requestAnimationFrame||setTimeout)(()=>{queued=false;render()},0)}
const scripts=['/app/civweave-ledger-contract-v1.js?v=1.0.1','/app/cw-reward-ledger-v2.js?v=2.1.0','/app/cw-reward-receivers-v2.js?v=2.1.0','/app/cw-reward-legacy-bridge-v2.js?v=2.0.0','/app/cw-reward-surfaces-v2.js?v=2.1.0'];
function inject(frame){const apply=async()=>{try{const doc=frame.contentDocument;if(!doc?.documentElement||doc.querySelector('script[data-cw-rewards-v2="surfaces"]'))return;for(const src of scripts){const kind=src.includes('ledger-contract')?'ledger-contract':src.includes('reward-ledger')?'ledger':src.includes('receivers')?'receivers':src.includes('legacy-bridge')?'legacy-bridge':'surfaces';if(doc.querySelector(`script[data-cw-rewards-v2="${kind}"]`))continue;await new Promise((resolve,reject)=>{const s=doc.createElement('script');s.src=src;s.dataset.cwRewardsV2=kind;s.onload=resolve;s.onerror=reject;(doc.head||doc.documentElement).append(s)})}}catch{}};frame.addEventListener('load',apply);apply()}
function frames(){const scan=root=>{if(root?.matches?.('iframe'))inject(root);root?.querySelectorAll?.('iframe').forEach(inject)};scan(document);new MutationObserver(records=>records.forEach(r=>[...r.addedNodes].forEach(n=>n?.nodeType===1&&scan(n)))).observe(document.documentElement,{childList:true,subtree:true})}
function boot(){render();frames();addEventListener('civweave:canonical-rewards-changed',queue);addEventListener('storage',e=>{if(e.key===api.storageKey)queue()});new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true})}
globalThis.CivweaveRewardSurfacesV2=Object.freeze({version:V,treeStorageKey:TREE_KEY,calculatePassportFromLedger,render,renderPassport,renderLivingTree:renderTree,writeLivingTreeProjection:writeTree,currentAccountId,signedAmount});
document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
