(()=>{
'use strict';

const VERSION='1.0.30-fellowfare-shared-guide-bridge-v236';
const SHARED_KEY='civweave.persistent-guide-chat.v214';
const FORM_SELECTOR='[data-ffc-rook-form]';
const INPUT_SELECTOR='[data-ffc-rook-input]';
const LOG_SELECTOR='[data-ffc-rook-log]';
const STATUS_SELECTOR='[data-ffc-rook-status]';
const CHAT_LOG_SELECTOR='#cw-persistent-guide-chat-v215 [data-log]';

if(globalThis.CivweaveFellowFareSharedGuideBridgeV236?.version===VERSION)return;

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const clean=(value,max=6000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
let bound=false;
let logObserver=null;

function readState(){
  const api=globalThis.CivweavePersistentGuideChatV215;
  if(api?.readState)return api.readState();
  try{return parse(localStorage.getItem(SHARED_KEY),{})}catch{return{}}
}

function rookRows(){
  const messages=Array.isArray(readState()?.messages)?readState().messages:[];
  const rows=[];
  for(let index=messages.length-1;index>=0&&rows.length<12;index-=1){
    const row=messages[index]||{};
    if(row.role==='user'||row.guide==='fellowfare'||row.responderSystem==='fellowfare')rows.push(row);
  }
  return rows.reverse();
}

function render(){
  const log=document.querySelector(LOG_SELECTOR);
  if(!log)return false;
  const rows=rookRows();
  if(!rows.length){
    log.innerHTML='<article class="ffc144-rook-message rook"><small>Rook</small>Name the need or offer. I’ll help you find the cleanest flight path, show the real costs, and keep the terms fair.</article>';
  }else{
    log.innerHTML=rows.map(row=>{
      const user=row.role==='user';
      return `<article class="ffc144-rook-message ${user?'user':'rook'}"><small>${user?'You':'Rook'}</small>${esc(clean(row.text,6000))}</article>`;
    }).join('');
  }
  log.scrollTop=log.scrollHeight;
  const status=document.querySelector(STATUS_SELECTOR);
  if(status&&!status.dataset.cwRookPending)status.textContent='Rook’s workbench and bottom-right guide use one shared conversation. Nothing is published or committed automatically.';
  return true;
}

async function onSubmit(event){
  const form=event.target;
  if(!(form instanceof HTMLFormElement)||!form.matches(FORM_SELECTOR))return;
  const shared=globalThis.CivweaveSharedGuideSurfaceV236;
  if(!shared?.submitInline)return;
  const input=form.querySelector(INPUT_SELECTOR)||document.querySelector(INPUT_SELECTOR);
  const value=clean(input?.value,8000);
  if(!value)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const submit=form.querySelector('button[type="submit"]');
  const status=document.querySelector(STATUS_SELECTOR);
  if(submit)submit.disabled=true;
  if(status){status.dataset.cwRookPending='true';status.textContent='Rook is answering in the shared guide thread…'}
  try{
    const sent=await shared.submitInline(value);
    if(sent&&input)input.value='';
    render();
  }finally{
    if(submit)submit.disabled=false;
    if(status){delete status.dataset.cwRookPending;status.textContent='Rook’s workbench and bottom-right guide use one shared conversation. Nothing is published or committed automatically.'}
    input?.focus();
  }
}

function observePersistentLog(){
  logObserver?.disconnect();
  const log=document.querySelector(CHAT_LOG_SELECTOR);
  if(!log)return false;
  logObserver=new MutationObserver(render);
  logObserver.observe(log,{childList:true,subtree:true,characterData:true});
  return true;
}

function bind(){
  const form=document.querySelector(FORM_SELECTOR);
  if(!form)return false;
  if(!bound){
    bound=true;
    form.dataset.cwSharedGuideBridge='v236';
    document.addEventListener('submit',onSubmit,true);
    addEventListener('storage',event=>{if(event.key===SHARED_KEY)render()});
    addEventListener('civweave:persistent-guide-chat-ready',()=>{observePersistentLog();render()});
  }
  observePersistentLog();
  render();
  document.documentElement.dataset.civweaveFellowfareGuideBridge='v236';
  return true;
}

function mount(){
  if(bind())return;
  const observer=new MutationObserver(()=>{if(bind())observer.disconnect()});
  observer.observe(document.documentElement,{childList:true,subtree:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
else mount();

globalThis.CivweaveFellowFareSharedGuideBridgeV236=Object.freeze({version:VERSION,bind,render,rookRows});
})();
