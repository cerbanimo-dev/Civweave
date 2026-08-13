(()=>{
'use strict';
const VERSION='1.0.0',PROFILE_KEY='fellowfare.seller-tax-profile.v1',LEDGER_KEY='fellowfare.seller-tax-ledger.v1';
if(globalThis.CivweaveFellowFareTaxRecordsV1?.version===VERSION)return;
const parse=(v,f)=>{try{return JSON.parse(v)??f}catch{return f}},now=()=>new Date().toISOString();
function profile(){const v=parse(localStorage.getItem(PROFILE_KEY),{});return{sellerState:String(v.sellerState||'').toUpperCase().slice(0,2),ratesBps:v.ratesBps&&typeof v.ratesBps==='object'?v.ratesBps:{},assumePhysicalGoodsTaxable:Boolean(v.assumePhysicalGoodsTaxable)}}
function saveProfile(next){const v={schema:'fellowfare.seller-tax-profile.v1',...next,updatedAt:now()};localStorage.setItem(PROFILE_KEY,JSON.stringify(v));return v}
function estimate({amountMinor=0,deliveryState='',taxability='review'}={}){const p=profile(),jurisdiction=String(deliveryState||p.sellerState).toUpperCase().slice(0,2),rateBps=Math.max(0,Math.min(3000,Number(p.ratesBps[jurisdiction])||0)),taxable=/^taxable/.test(String(taxability)),taxMinor=taxable&&Number(amountMinor)>0&&rateBps>0?Math.round(Number(amountMinor)*rateBps/10000):0;return Object.freeze({jurisdiction,amountMinor:Number(amountMinor)||0,taxability,rateBps,taxMinor,estimated:Boolean(taxable&&rateBps>0),sellerCollects:true,sellerRemits:true,fellowfareCollects:false,fellowfareRemits:false})}
function ledger(){const v=parse(localStorage.getItem(LEDGER_KEY),{});return{schema:'fellowfare.seller-tax-ledger.v1',records:Array.isArray(v.records)?v.records:[],updatedAt:v.updatedAt||null}}
function append(record){const l=ledger();if(record?.orderId&&l.records.some(r=>r.orderId===record.orderId))return false;l.records.push({...record,schema:'fellowfare.seller-tax-record.v1',recordedAt:record?.recordedAt||now(),fellowfareCollected:false,fellowfareRemitted:false});l.updatedAt=now();localStorage.setItem(LEDGER_KEY,JSON.stringify(l));return true}
function summary(){const out={};for(const r of ledger().records){const k=r.jurisdiction||'UNKNOWN',x=out[k]||{jurisdiction:k,count:0,salesMinor:0,taxMinor:0};x.count++;x.salesMinor+=Number(r.amountMinor||0);x.taxMinor+=Number(r.taxMinor||0);out[k]=x}return Object.values(out)}
globalThis.CivweaveFellowFareTaxRecordsV1=Object.freeze({version:VERSION,profileKey:PROFILE_KEY,ledgerKey:LEDGER_KEY,profile,saveProfile,estimate,ledger,append,summary,role:'tax-copilot',platformCollectsTax:false,platformRemitsTax:false});
})();
