(()=>{
'use strict';
const VERSION='1.0.0';
if(globalThis.CivweaveFellowFareSellerBookkeepingV1?.version===VERSION)return;
const clean=(v,n=500)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function ratesText(v){return Object.entries(v||{}).map(([state,bps])=>`${state}=${Number(bps)/100}`).join(', ')}
function parseRates(text){const out={};for(const chunk of String(text||'').split(',')){const [state,rate]=chunk.split('=').map(x=>x.trim()),n=Number(rate);if(/^[A-Z]{2}$/i.test(state)&&Number.isFinite(n)&&n>=0&&n<=30)out[state.toUpperCase()]=Math.round(n*100)}return out}
function download(name,text,type){const blob=new Blob([text],{type}),href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(href),1000)}
function render(){
 if((document.body.dataset.ffRoute||location.hash.slice(1))!=='profile')return;
 if(document.querySelector('#ffSellerBookkeeping'))return;
 const api=globalThis.CivweaveFellowFareTaxRecordsV1,main=document.querySelector('#main');
 if(!api||!main)return;
 const p=api.profile(),summary=api.summary(),section=document.createElement('section');
 section.id='ffSellerBookkeeping';section.className='ff-fulfillment-merchant';
 section.innerHTML=`<div class="ffv2-section-head"><div><p class="ffv2-eyebrow">SELLER RECORDS</p><h2>Goods jurisdiction assistant</h2><p>Save your seller location and known local rates. FellowFare can estimate what your own payment method should collect and keep records by jurisdiction.</p></div></div>
 <form data-ff-seller-record-settings>
  <label>Seller state<input name="sellerState" maxlength="2" value="${esc(p.sellerState)}" placeholder="NY"></label>
  <label>Known combined rates by delivery state<input name="rates" value="${esc(ratesText(p.ratesBps))}" placeholder="NY=8, NJ=6.625"></label>
  <label><span><input type="checkbox" name="assumeTaxable" ${p.assumePhysicalGoodsTaxable?'checked':''}> Use an ordinary-physical-goods taxable estimate unless the listing says exempt or needs category review</span></label>
  <button type="submit">Save seller record settings</button>
 </form>
 <div class="ffv2-card-actions"><button type="button" data-ff-record-export="csv">Export CSV</button><button type="button" class="quiet" data-ff-record-export="json">Export JSON</button></div>
 <div data-ff-record-summary>${summary.length?summary.map(row=>`<p><strong>${esc(row.jurisdiction)}</strong> · $${(Number(row.salesMinor||0)/100).toFixed(2)} recorded sales · $${(Number(row.taxMinor||0)/100).toFixed(2)} estimated seller-collected tax · ${Number(row.count||0)} record${Number(row.count||0)===1?'':'s'}</p>`).join(''):'<p>No seller-confirmed goods records yet.</p>'}</div>
 <small>This is seller-side assistance and bookkeeping, not a filing determination. The seller's own payment method collects the purchase price and any applicable tax. FellowFare does not collect or remit either amount.</small>`;
 main.append(section);
}
function save(event){
 const form=event.target,api=globalThis.CivweaveFellowFareTaxRecordsV1;if(!form?.matches?.('[data-ff-seller-record-settings]')||!api)return;
 event.preventDefault();api.saveProfile({sellerState:clean(form.elements.sellerState?.value,2).toUpperCase(),ratesBps:parseRates(form.elements.rates?.value),assumePhysicalGoodsTaxable:Boolean(form.elements.assumeTaxable?.checked)});
 document.querySelector('#ffSellerBookkeeping')?.remove();render();
}
function click(event){
 const button=event.target.closest?.('[data-ff-record-export]'),api=globalThis.CivweaveFellowFareTaxRecordsV1;if(!button||!api)return;
 event.preventDefault();const day=new Date().toISOString().slice(0,10);
 if(button.dataset.ffRecordExport==='json')download(`fellowfare-seller-records-${day}.json`,JSON.stringify(api.exportData(),null,2),'application/json');
 else download(`fellowfare-seller-records-${day}.csv`,api.exportCsv(),'text/csv');
}
function start(){document.addEventListener('submit',save,true);document.addEventListener('click',click,true);addEventListener('hashchange',()=>requestAnimationFrame(render));addEventListener('fellowfare:tax-ledger-changed',()=>{document.querySelector('#ffSellerBookkeeping')?.remove();requestAnimationFrame(render)});render()}
globalThis.CivweaveFellowFareSellerBookkeepingV1=Object.freeze({version:VERSION,render,role:'seller-records-ui',platformCollectsGoodsPayment:false,platformCollectsTax:false});
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
