(()=>{
'use strict';
if(globalThis.CivweavePassportIdentityV1)return;

const VERSION='1.0.0';
const STORAGE_KEY='civweave.anarchadia.citizen-console.v139';
const SCHEMA='civweave.anarchadia-console.v1';
const clean=(value,max=180)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const now=()=>new Date().toISOString();
const clone=value=>value==null?value:structuredClone(value);

function createPassportId(){
  const token=crypto?.randomUUID?.().slice(0,8).toUpperCase()||Math.random().toString(36).slice(2,10).toUpperCase();
  return `AC-${token}`;
}

function normalize(saved){
  const source=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{};
  const passportId=clean(source.passportId)||createPassportId();
  return {
    ...source,
    schema:SCHEMA,
    passportId,
    proposals:Array.isArray(source.proposals)?source.proposals:[],
    ledger:Array.isArray(source.ledger)&&source.ledger.length?source.ledger:[{id:uid('evt'),time:now(),kind:'console-ready',detail:'Citizen Passport initialized locally.'}],
    settings:source.settings&&typeof source.settings==='object'&&!Array.isArray(source.settings)?source.settings:{autoRun:true},
  };
}

function ensure(){
  let saved=null;
  try{saved=parse(localStorage.getItem(STORAGE_KEY),null)}catch{}
  const next=normalize(saved);
  const changed=!saved||saved.schema!==next.schema||clean(saved.passportId)!==next.passportId||!Array.isArray(saved.proposals)||!Array.isArray(saved.ledger)||!saved.settings;
  if(changed){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next))}catch{}}
  try{dispatchEvent(new CustomEvent('civweave:passport-ready',{detail:{version:VERSION,passportId:next.passportId,created:!clean(saved?.passportId)}}))}catch{}
  return clone(next);
}

function passportId(){return ensure().passportId}
function snapshot(){return ensure()}

const api=Object.freeze({version:VERSION,storageKey:STORAGE_KEY,schema:SCHEMA,ensure,passportId,snapshot});
globalThis.CivweavePassportIdentityV1=api;
ensure();
})();
