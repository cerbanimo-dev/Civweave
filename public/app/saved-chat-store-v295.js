(()=>{
'use strict';
const VERSION='1.0.164-saved-chat-store-v352',SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'],KEY='civweave.guide-saved-chats.v295';
if(globalThis.CivweaveSavedChatStoreV295?.version===VERSION)return;
const parse=(v,d)=>{try{return JSON.parse(v)??d}catch{return d}},now=()=>new Date().toISOString(),uid=()=>`chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,clean=(v,n=34)=>String(v??'').trim().slice(0,n);
const threadKeys=system=>[`civweave.guide-thread.${system}.v237`,`civweave.guide-thread.v350.${system}`];
const emptyThread=system=>({schema:'civweave.realm-guide-thread.v237',system,messages:[],open:false,minimized:false,unread:0,updatedAt:null});
function fallbackReadThread(system){
  const rows=[];
  for(const key of threadKeys(system))try{const value=parse(localStorage.getItem(key),null);if(value&&Array.isArray(value.messages))rows.push({...emptyThread(system),...value,system,messages:value.messages.slice(-120)})}catch{}
  rows.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
  return rows[0]||emptyThread(system);
}
function fallbackWriteThread(system,value){
  const next={...emptyThread(system),...(value||{}),system,messages:Array.isArray(value?.messages)?value.messages.slice(-120):[],updatedAt:now()};
  for(const key of threadKeys(system))try{localStorage.setItem(key,JSON.stringify(next))}catch{}
  try{dispatchEvent(new CustomEvent('civweave:realm-guide-thread-changed',{detail:{system,thread:next,updatedAt:next.updatedAt,source:'saved-chat-store-v352'}}))}catch{}
  return next;
}
function api(){const realm=globalThis.CivweaveRealmSessionIntegrityV237;if(realm?.readThread&&realm?.writeThread)return realm;return{readThread:fallbackReadThread,writeThread:fallbackWriteThread}}
function read(){const v=parse(localStorage.getItem(KEY),null);return v?.systems?v:{schema:'civweave.saved-guide-chats.v1',systems:{}}}
function save(v){try{localStorage.setItem(KEY,JSON.stringify({...v,updatedAt:now()}))}catch{}}
function title(messages=[],fallback='New chat'){const row=messages.find(x=>x?.role==='user'&&clean(x.text)),t=clean(row?.text).replace(/\s+/g,' ');return t?(t.length>31?`${t.slice(0,30)}…`:t):fallback}
function ensure(system){const store=read();let state=store.systems[system];if(!state?.chats?.length){const t=api().readThread(system)||{messages:[]},chat={id:uid(),title:title(t.messages),messages:(t.messages||[]).slice(-120),createdAt:now(),updatedAt:now()};state={activeId:chat.id,chats:[chat]};store.systems[system]=state;save(store)}if(!state.chats.some(x=>x.id===state.activeId)){state.activeId=state.chats[0].id;store.systems[system]=state;save(store)}return{store,state}}
function snapshot(system){if(!SYSTEMS.includes(system))return false;const a=api(),{store,state}=ensure(system),thread=a.readThread(system),i=state.chats.findIndex(x=>x.id===state.activeId);if(i<0)return false;const old=state.chats[i],messages=(thread?.messages||[]).slice(-120);state.chats[i]={...old,title:title(messages,old.title),messages,updatedAt:thread?.updatedAt||now()};state.chats=state.chats.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))).slice(0,18);store.systems[system]=state;save(store);return true}
function select(system,id){if(!SYSTEMS.includes(system))return false;const a=api();snapshot(system);const {store,state}=ensure(system),chat=state.chats.find(x=>x.id===id);if(!chat)return false;state.activeId=id;store.systems[system]=state;save(store);a.writeThread(system,{...a.readThread(system),messages:chat.messages.slice(-120),unread:0,open:true,minimized:false});return true}
function create(system){if(!SYSTEMS.includes(system))return false;const a=api();snapshot(system);const {store,state}=ensure(system),chat={id:uid(),title:'New chat',messages:[],createdAt:now(),updatedAt:now()};state.activeId=chat.id;state.chats=[chat,...state.chats].slice(0,18);store.systems[system]=state;save(store);a.writeThread(system,{...a.readThread(system),messages:[],unread:0,open:true,minimized:false});return chat}
addEventListener('civweave:realm-guide-thread-changed',e=>{if(SYSTEMS.includes(e.detail?.system))snapshot(e.detail.system)});
globalThis.CivweaveSavedChatStoreV295=Object.freeze({version:VERSION,revision:'thread-api-fallback-v352',systems:SYSTEMS,key:KEY,read,ensure,snapshot,select,create,deferredInit:true,threadFallback:true});
})();
