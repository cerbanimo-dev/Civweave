(()=>{
'use strict';
if(globalThis.CivweaveHubPeerBootstrapV1)return;
const VERSION='1.0.0',STORE='civweave.hub-peer-mesh.v1';
const parse=(v,f)=>{try{return JSON.parse(v)??f}catch{return f}},clean=(v,n=2000)=>String(v??'').trim().slice(0,n);
function state(){return parse(localStorage.getItem(STORE),{known:{},trust:{},jobs:{},receipts:{},settings:{}})}
function coreOrigins(){const configured=clean(localStorage.getItem('civweave.core-api-origin'),2000),rows=[location.origin,configured,'https://api.commonweave.earth'];return[...new Set(rows.filter(Boolean))]}
async function fetchDirectory(){let lastError=null;for(const origin of coreOrigins()){try{const url=new URL('/api/federation/peers',origin),response=await fetch(url,{headers:{accept:'application/json'},cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);const data=await response.json();if(Array.isArray(data.peers))return{origin,peers:data.peers}}catch(e){lastError=e}}throw lastError||new Error('No federation directory reachable.')}
async function sync(){try{const result=await fetchDirectory(),s=state();for(const row of result.peers){if(!row?.hubId)continue;s.known[row.hubId]={schema:'civweave.hub-presence.v1',hubId:row.hubId,displayName:row.displayName||row.hubId,publicOrigin:row.publicOrigin,visibility:row.visibility,status:'online',capabilities:row.capabilities||{},expiresAt:row.expiresAt,lastSeen:row.updatedAt||new Date().toISOString(),trust:s.trust?.[row.hubId]||'neutral',bootstrapOrigin:result.origin}}localStorage.setItem(STORE,JSON.stringify(s));try{dispatchEvent(new CustomEvent('civweave:hub-peer-state',{detail:s}))}catch{}return result}catch(error){return{origin:null,peers:[],error:String(error?.message||error)}}}
function boot(){void sync();addEventListener('online',sync);setInterval(sync,120000)}
const api=Object.freeze({version:VERSION,sync,fetchDirectory});globalThis.CivweaveHubPeerBootstrapV1=api;document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
