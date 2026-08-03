(()=>{
'use strict';
const frame=document.querySelector('#ffc144-workbench');
const loading=document.querySelector('[data-ffc-loading]');
const status=document.querySelector('[data-ffc-status]');
const tabs=[...document.querySelectorAll('[data-ffc-command]')];
const AI_KEY='commonweave.universal-ai.v127';
const MODEL_KEY='commonweave-shared-model';
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};

function modelContext(){
  const model=parse(localStorage.getItem(AI_KEY),parse(localStorage.getItem(MODEL_KEY),{}))||{};
  return{
    type:'commonweave:context',
    contractVersion:'commonweave.context.v1',
    sourceApplication:'commonweave',
    targetApplication:'fellowfare',
    model,
    modelSettings:model,
    privacy:{secretsShared:false},
    automaticEffect:false
  };
}
function send(command,payload={}){
  if(!frame?.contentWindow)return;
  frame.contentWindow.postMessage({type:'fellowfare:cabinet-command',command,payload,automaticEffect:false},location.origin);
  tabs.forEach(button=>button.toggleAttribute('aria-current',button.dataset.ffcCommand===command));
  status.textContent=`Opened ${command==='inbox'?'the exchange desk':command}.`;
}
function capabilityCommand(id){
  const value=String(id||'').toLowerCase();
  if(value.includes('post-offer'))return['compose',{mode:'offer'}];
  if(value.includes('post-need')||value.includes('borrow')||value.includes('request'))return['compose',{mode:'need'}];
  if(/assembly|collective|group|circle/.test(value))return['assemblies',{}];
  if(/agreement|settle|repair|milestone|evidence|trust|message|inbox|fulfill|confirm|accept/.test(value))return['inbox',{}];
  if(/loom|match|fair|signal|provider|demand|review/.test(value))return['loom',{}];
  if(/profile|wallet|button|export|import|backup|privacy|setting/.test(value))return['profile',{}];
  return['market',{}];
}
function sendContext(){
  frame?.contentWindow?.postMessage(modelContext(),location.origin);
}
function interceptCapability(event){
  const button=event.target.closest?.('[data-ch142-capability]');
  if(!button)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const [command,payload]=capabilityCommand(button.dataset.ch142Capability);
  send(command,{...payload,capabilityId:button.dataset.ch142Capability});
  document.querySelector('.ch142-features')?.removeAttribute('open');
}

document.addEventListener('click',event=>{
  const tab=event.target.closest('[data-ffc-command]');
  if(tab)send(tab.dataset.ffcCommand);
},true);
document.addEventListener('click',interceptCapability,true);

frame?.addEventListener('load',()=>{
  loading.hidden=true;
  status.textContent='Full FellowFare market, agreement ledger, repair path, trust, and portability tools are ready.';
  sendContext();
});
addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame?.contentWindow||!event.data||typeof event.data!=='object')return;
  if(event.data.type==='fellowfare:cabinet-ready'){
    loading.hidden=true;
    status.textContent='FellowFare exchange ledger ready inside Cabinet Mode.';
    sendContext();
  }
  if(event.data.type==='commonweave:action-signal'&&event.data.title)status.textContent=clean(event.data.title,180);
  if(event.data.type==='commonweave:navigation-receipt'&&event.data.detail)status.textContent=clean(event.data.detail,180);
});
addEventListener('storage',event=>{if([AI_KEY,MODEL_KEY].includes(event.key))sendContext()});
})();
