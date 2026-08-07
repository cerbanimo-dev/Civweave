(()=>{
'use strict';
const INTENTIONS_KEY='civweave.intentions.v127';
const LINK_KEY='civweave.chat-intention-link.v131';
const DIAGNOSTICS_KEY='civweave.local-diagnostics.v131';
const CHAT_KEYS=/^civweave\.(?:weaveling-chat\.v127|guide-chat\.[^.]+\.v128)$/;
const nativeFetch=globalThis.fetch?.bind(globalThis);
const nativeSetItem=Storage.prototype.setItem;
const parse=(value,fallback)=>{try{const out=JSON.parse(value);return out==null?fallback:out}catch{return fallback}};
const now=()=>new Date().toISOString();

function localDiagnostic(kind,detail={}){
  try{
    const rows=parse(localStorage.getItem(DIAGNOSTICS_KEY),[]),list=Array.isArray(rows)?rows:[];
    list.push({time:now(),kind:String(kind||'event').slice(0,120),detail});
    nativeSetItem.call(localStorage,DIAGNOSTICS_KEY,JSON.stringify(list.slice(-120)));
  }catch{}
}
function telemetryRequest(input){
  try{
    const raw=typeof input==='string'?input:input?.url;
    if(!raw)return false;
    const url=new URL(raw,location.href);
    return url.origin===location.origin&&(url.pathname==='/api/boot-log'||url.pathname==='/api/boot-logs');
  }catch{return false}
}
if(nativeFetch){
  globalThis.fetch=(input,init={})=>{
    if(!telemetryRequest(input))return nativeFetch(input,init);
    const payload=parse(typeof init?.body==='string'?init.body:'',{});
    localDiagnostic(payload.kind||'legacy-telemetry-blocked',payload.detail||{});
    return Promise.resolve(new Response(null,{status:204,statusText:'No Content'}));
  };
}
function savedIntentions(){const value=parse(localStorage.getItem(INTENTIONS_KEY),[]);return Array.isArray(value)?value:[]}
function planState(planId){
  if(!planId)return'';
  const item=savedIntentions().find(row=>row?.id===planId||row?.plan?.id===planId);
  return item?.state||item?.plan?.state||'';
}
function fallbackNext(){
  const items=savedIntentions(),active=items.find(row=>row?.state==='active'),review=items.find(row=>row?.state==='review');
  if(active)return'Next: Attach this conversation to the active intention, or continue that intention from its plan.';
  if(review)return'Next: Review or activate the saved intention, or set this conversation as a new intention.';
  return'Next: Tell me your wish or set an intention.';
}
function conversationLinkKey(chatKey){return`${LINK_KEY}.${String(chatKey).replace(/[^a-z0-9.-]+/gi,'_')}`}
function linkedPlan(rows,chatKey){
  const key=conversationLinkKey(chatKey),discovered=[...rows].reverse().map(row=>row?.planId||row?.approvalGate?.planId||'').find(Boolean);
  if(discovered){nativeSetItem.call(localStorage,key,discovered);return discovered}
  return localStorage.getItem(key)||'';
}
function sanitizeChat(chatKey,value){
  const rows=parse(value,null);if(!Array.isArray(rows))return value;
  const planId=linkedPlan(rows,chatKey),confirmed=['review','active'].includes(planState(planId));
  let changed=false;
  for(const row of rows){
    if(row?.role!=='assistant'||typeof row.text!=='string'||!row.text.includes('\n\nNext:'))continue;
    const rowPlan=row.planId||row.approvalGate?.planId||planId;
    const rowConfirmed=Boolean(rowPlan)&&['review','active'].includes(planState(rowPlan));
    if(rowConfirmed||confirmed)continue;
    const replacement=fallbackNext();
    const next=row.text.replace(/\n\nNext:[\s\S]*?(?=\n\nThis next action|\n\nLocal reflex used|$)/,`\n\n${replacement}`);
    if(next!==row.text){row.text=next;changed=true}
  }
  return changed?JSON.stringify(rows):value;
}
Storage.prototype.setItem=function(key,value){
  const chatKey=String(key),normalized=CHAT_KEYS.test(chatKey)?sanitizeChat(chatKey,String(value)):value;
  return nativeSetItem.call(this,key,normalized);
};
function sweep(){
  try{for(let i=0;i<localStorage.length;i+=1){const key=localStorage.key(i);if(key&&CHAT_KEYS.test(key)){const value=localStorage.getItem(key);nativeSetItem.call(localStorage,key,sanitizeChat(key,value))}}}catch{}
}
sweep();
globalThis.CivweaveLocalFirstPolicy={
  diagnostics:()=>parse(localStorage.getItem(DIAGNOSTICS_KEY),[]),
  clearDiagnostics:()=>localStorage.removeItem(DIAGNOSTICS_KEY),
  linkedPlan:chatKey=>localStorage.getItem(conversationLinkKey(chatKey||'civweave.weaveling-chat.v127'))||'',
  version:'1.0.31'
};
})();
