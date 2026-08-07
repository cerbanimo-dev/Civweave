(()=>{
'use strict';

const VERSION='1.0.38-chat-single-owner-v245';
const ROOT_ID='cw-persistent-guide-chat-v215';
const LEGACY_STYLE_ID='cw-persistent-guide-chat-style-v215';
const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const LEGACY_TRIGGER_SELECTOR=[
  '[data-cwf-chat]','[data-open-guide-chat]','[data-open-persistent-chat]','[data-action="open-merlin-guide"]',
  '#moss','#compass','.ls-moss','.ls-compass',
  '[data-guide="civweave"]','[data-guide="living-school"]','[data-guide="cerbanimo"]','[data-guide="fellowfare"]','[data-guide="anarchadia"]'
].join(',');
const LEGACY_FORM_SELECTOR='.ch142-chat-form,[data-cwf-form],#weaveling-chat-form,.weaveling-chat-form,#ac-merlin-form,.ac-merlin-form,[data-civweave-legacy-chat-form]';

if(globalThis.CivweaveChatSingleOwnerV245?.version===VERSION)return;

const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
function workspaceApi(){
  const value=globalThis.CivweavePersistentGuideChatV215;
  return value?.workspace===true&&typeof value.submitText==='function'&&typeof value.switchGuide==='function'?value:null;
}
function systemFor(node,api){
  const explicit=clean(node?.dataset?.cw242Window||node?.dataset?.guideId||node?.dataset?.guide||node?.dataset?.system||node?.dataset?.contextSystem,80).toLowerCase();
  if(SYSTEMS.includes(explicit))return explicit;
  if(node?.closest?.('#moss,.ls-moss'))return'living-school';
  if(node?.closest?.('#compass,.ls-compass'))return'civweave';
  if(node?.closest?.('[data-action="open-merlin-guide"],#ac-merlin-form,.ac-merlin-chat'))return'anarchadia';
  const page=api?.pageSystem?.();
  return SYSTEMS.includes(page)?page:'civweave';
}
function canonicalMarkup(){
  return '<header><img data-guide-avatar alt=""><div><small data-window-label></small><strong data-guide-name></strong><span data-guide-role></span></div><button type="button" data-minimize aria-label="Minimize chat">−</button><button type="button" data-close aria-label="Close chat">×</button></header><nav class="cw242-window-switcher" aria-label="Guide chat windows"></nav><div data-log role="log" aria-live="polite"></div><form data-persistent-form><textarea rows="2" maxlength="12000" required></textarea><button data-send type="submit">Send</button></form>';
}
function normalizeRoot(){
  const api=workspaceApi(),root=document.getElementById(ROOT_ID);
  if(!api||!root)return false;
  const legacy=Boolean(root.querySelector('.cwp215-switcher,.cwp215-guide,.cwp215-form,.cwp215-current'));
  const incomplete=!root.querySelector('.cw242-window-switcher')||!root.querySelector('[data-persistent-form] [data-send]')||!root.querySelector('[data-window-label]');
  if(legacy||incomplete){
    const state=api.readState?.()||{},active=api.activeWindow?.()||api.pageSystem?.()||'civweave';
    root.innerHTML=canonicalMarkup();
    document.getElementById(LEGACY_STYLE_ID)?.remove();
    api.switchGuide(active,{open:Boolean(state.open)});
    if(state.minimized)api.minimize?.();
  }
  root.dataset.chatEventOwner='v245';
  root.dataset.legacyChatResidue='false';
  return true;
}
function onClickCapture(event){
  const api=workspaceApi();
  if(!api||!(event.target instanceof Element))return;
  const target=event.target;
  const switcher=target.closest(`#${ROOT_ID} [data-cw242-window],#${ROOT_ID} [data-guide-id]`);
  if(switcher){
    const system=systemFor(switcher,api);
    if(!SYSTEMS.includes(system))return;
    event.preventDefault();event.stopImmediatePropagation();
    api.switchGuide(system,{open:true});
    normalizeRoot();
    return;
  }
  const legacy=target.closest(LEGACY_TRIGGER_SELECTOR);
  if(!legacy||legacy.closest(`#${ROOT_ID}`)||legacy.closest('#cw-shared-guide-surface-v236'))return;
  const system=systemFor(legacy,api);
  event.preventDefault();event.stopImmediatePropagation();
  api.open?.({guide:system});
}
function onSubmitCapture(event){
  const api=workspaceApi(),form=event.target;
  if(!api||!(form instanceof HTMLFormElement))return;
  const canonical=form.matches(`#${ROOT_ID} [data-persistent-form]`);
  const legacy=!canonical&&form.matches(LEGACY_FORM_SELECTOR)&&!(form.id==='weaveling-chat-form'&&form.closest('.app'));
  if(!canonical&&!legacy)return;
  const input=form.querySelector('textarea,input[type="text"]'),text=clean(input?.value,12000);
  event.preventDefault();event.stopImmediatePropagation();
  if(!text)return;
  const system=canonical?(api.activeWindow?.()||api.pageSystem?.()):systemFor(form,api);
  if(!canonical)api.switchGuide(system,{open:false});
  Promise.resolve(api.submitText(text,system)).then(sent=>{if(sent!==false&&input)input.value=''}).catch(()=>{});
}
function onWorkspaceReady(){queueMicrotask(normalizeRoot)}
function start(){
  addEventListener('click',onClickCapture,true);
  addEventListener('submit',onSubmitCapture,true);
  addEventListener('civweave:guide-workspace-ready',onWorkspaceReady);
  normalizeRoot();
  document.documentElement.dataset.civweaveChatOwner='v245';
  try{dispatchEvent(new CustomEvent('civweave:chat-single-owner-ready',{detail:{version:VERSION,rootId:ROOT_ID,windowCapture:true,syntheticClick:false,at:new Date().toISOString()}}))}catch{}
}
function destroy(){
  removeEventListener('click',onClickCapture,true);
  removeEventListener('submit',onSubmitCapture,true);
  removeEventListener('civweave:guide-workspace-ready',onWorkspaceReady);
  document.documentElement.removeAttribute('data-civweave-chat-owner');
}

start();
globalThis.CivweaveChatSingleOwnerV245=Object.freeze({version:VERSION,normalize:normalizeRoot,destroy,rootId:ROOT_ID,policy:'window-capture-canonical-v242-owner-no-synthetic-click'});
})();