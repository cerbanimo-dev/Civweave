(()=>{
'use strict';

const VERSION='1.0.41-chat-single-owner-v245-mobile-v248';
const ROOT_ID='cw-persistent-guide-chat-v215';
const SHARED_ROOT_ID='cw-shared-guide-surface-v236';
const LEGACY_STYLE_ID='cw-persistent-guide-chat-style-v215';
const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const LEGACY_TRIGGER_SELECTOR=[
  '[data-cwf-chat]','[data-open-guide-chat]','[data-open-persistent-chat]','[data-action="open-merlin-guide"]',
  '#moss','#compass','.ls-moss','.ls-compass',
  '[data-guide="civweave"]','[data-guide="living-school"]','[data-guide="cerbanimo"]','[data-guide="fellowfare"]','[data-guide="anarchadia"]'
].join(',');
const LEGACY_FORM_SELECTOR='.ch142-chat-form,[data-cwf-form],#weaveling-chat-form,.weaveling-chat-form,#ac-merlin-form,.ac-merlin-form,[data-civweave-legacy-chat-form]';
const GUIDE=Object.freeze({
  civweave:{name:'Weaveling',label:'Civweave',prompt:'You are Weaveling, Civweave’s central guide. Help the user clarify the desired outcome, connect learning, work, resources, and governance, and preserve the user’s authority to revise the route.'},
  'living-school':{name:'Moss',label:'Living School',prompt:'You are Moss, the Living School learning guide. Help the user learn, practice, demonstrate, and validate knowledge with concrete next steps.'},
  cerbanimo:{name:'Kamiya',label:'Cerbanimo',prompt:'You are Kamiya, Cerbanimo’s questwright and skilled-work guide. Help the user plan, build, repair, and ship concrete work while keeping approvals explicit.'},
  fellowfare:{name:'Rook',label:'FellowFare',prompt:'You are Rook, FellowFare’s quartermaster and fair exchange guide. Clarify needs, offers, costs, and practical exchange paths without committing for the user.'},
  anarchadia:{name:'Merlin',label:'Anarchadia',prompt:'You are Merlin, Anarchadia’s civic and automation guide. Help translate desired changes into clear proposals, tests, consent boundaries, and reversible next actions.'}
});

if(globalThis.CivweaveChatSingleOwnerV245?.version===VERSION)return;

const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
let suppressSwitchClickUntil=0;
let suppressedSwitchControl=null;
const sendLocks=new Set();

function workspaceApi(){
  const value=globalThis.CivweavePersistentGuideChatV215;
  return value?.workspace===true&&typeof value.submitText==='function'&&typeof value.switchGuide==='function'?value:null;
}
function realmApi(){return globalThis.CivweaveRealmSessionIntegrityV237}
function threadKey(system){return`civweave.guide-thread.${system}.v237`}
function readThread(system){
  const api=realmApi();
  if(typeof api?.readThread==='function')return api.readThread(system);
  const fallback={schema:'civweave.realm-guide-thread.v237',system,messages:[],open:false,minimized:false,unread:0,updatedAt:null};
  try{const value=parse(localStorage.getItem(threadKey(system)),fallback);return{...fallback,...value,messages:Array.isArray(value?.messages)?value.messages:[]}}catch{return fallback}
}
function writeThread(system,value){
  const api=realmApi();
  if(typeof api?.writeThread==='function')return api.writeThread(system,value);
  const next={...readThread(system),...value,system,messages:Array.isArray(value?.messages)?value.messages.slice(-120):[],updatedAt:now()};
  try{localStorage.setItem(threadKey(system),JSON.stringify(next))}catch{}
  try{dispatchEvent(new CustomEvent('civweave:realm-guide-thread-changed',{detail:{system,updatedAt:next.updatedAt}}))}catch{}
  return next
}
function append(system,row){const thread=readThread(system);thread.messages.push({...row,id:row.id||uid('msg'),at:row.at||now()});return writeThread(system,thread)}
function renderSharedNow(){
  try{globalThis.CivweaveSharedGuideSurfaceV236?.renderTranscript?.()}catch{}
  try{globalThis.CivweaveSharedGuideSurfaceV236?.syncInlineVisibility?.()}catch{}
}
function systemFor(node,api=workspaceApi()){
  const explicit=clean(node?.dataset?.cw242Window||node?.dataset?.guideId||node?.dataset?.guide||node?.dataset?.system||node?.dataset?.contextSystem,80).toLowerCase();
  if(SYSTEMS.includes(explicit))return explicit;
  const shared=node?.closest?.(`#${SHARED_ROOT_ID}`)?.dataset?.system;
  if(SYSTEMS.includes(shared))return shared;
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
  root.dataset.chatEventOwner='v248';
  root.dataset.legacyChatResidue='false';
  return true;
}
function deterministicReply(system,text){
  const guide=GUIDE[system]||GUIDE.civweave,value=clean(text,1200);
  if(system==='living-school')return`Moss kept your message locally. Start by naming the smallest thing you need to understand or demonstrate about “${value}”. I can turn that into a practice-and-evidence path even while the connected model is unavailable.`;
  if(system==='cerbanimo')return`Kamiya kept your message locally. For “${value}”, define the concrete deliverable, what counts as done, and the first dependency you can verify. I can keep shaping the work route while the connected model is unavailable.`;
  if(system==='anarchadia')return`Merlin kept your message locally. For “${value}”, name the change, who is affected, and the test that would prove it worked. Keep activation explicit and reversible.`;
  if(system==='fellowfare')return`Rook kept your message locally. For “${value}”, name the exact need or offer, timing, location, acceptable substitutes, and exchange boundary before publishing anything.`;
  return`${guide.name} kept your message locally. For “${value}”, name the outcome you want first. I can still help separate what must be learned, built, acquired, or agreed before anything is activated.`
}
async function directModelReply(text,system){
  const guide=GUIDE[system]||GUIDE.civweave;
  try{await globalThis.CivweaveFamilyAILoaderV105?.ensure?.()}catch{}
  const runtime=globalThis.CivweaveModelRuntime;
  if(typeof runtime?.generate!=='function')return{answer:deterministicReply(system,text),provider:'deterministic-local'};
  const thread=readThread(system),recent=(thread.messages||[]).filter(row=>!row.pending).slice(-10).map(row=>({role:row.role==='user'?'user':'assistant',content:clean(row.text,5000)}));
  const fallback=()=>deterministicReply(system,text);
  try{
    const result=await runtime.generate({purpose:`${system}-shared-guide-chat-v248`,executionProfile:'interactive',messages:[{role:'system',content:guide.prompt},...recent,{role:'user',content:text}],deterministic:fallback,fallback});
    const answer=clean(result?.outputText,10000);
    if(answer)return{answer,provider:result?.actual?.provider||result?.fallback?.provider||result?.provider||'shared-model',model:result?.actual?.model||result?.model||''};
  }catch{}
  return{answer:fallback(),provider:'deterministic-local'}
}
function needsRecovery(row){
  if(!row||row.role!=='assistant')return false;
  const provider=clean(row.provider,120).toLowerCase(),text=clean(row.text,1200).toLowerCase();
  return provider==='local-recovery'||provider==='local error'||text.includes('could not complete this call')||text.includes('shared assistant runtime is not ready')
}
async function recoverFailedTurn(system,text,beforeCount){
  const thread=readThread(system),messages=Array.isArray(thread.messages)?thread.messages:[];
  let index=-1;
  for(let i=messages.length-1;i>=Math.max(0,beforeCount);i-=1){if(needsRecovery(messages[i])){index=i;break}}
  if(index<0)return false;
  const reply=await directModelReply(text,system);
  messages[index]={...messages[index],guide:system,responderSystem:system,text:reply.answer,provider:reply.provider,model:reply.model||'',pending:false,recoveredBy:'chat-owner-v248',at:now()};
  writeThread(system,{...thread,messages});
  renderSharedNow();
  return true
}
async function submitOwned(text,system,{open=false}={}){
  const value=clean(text,12000),api=workspaceApi();
  if(!value||!SYSTEMS.includes(system)||sendLocks.has(system))return false;
  sendLocks.add(system);
  try{
    if(api){
      api.switchGuide(system,{open});
      const beforeCount=(readThread(system).messages||[]).length;
      const pending=Promise.resolve(api.submitText(value,system));
      queueMicrotask(renderSharedNow);
      const sent=await pending;
      renderSharedNow();
      if(sent!==false)await recoverFailedTurn(system,value,beforeCount);
      return sent!==false
    }
    const thread=readThread(system),pendingId=uid('pending');
    append(system,{role:'user',text:value});
    append(system,{id:pendingId,role:'assistant',guide:system,responderSystem:system,text:`${GUIDE[system].name} is thinking…`,pending:true});
    renderSharedNow();
    const reply=await directModelReply(value,system),latest=readThread(system),index=(latest.messages||[]).findIndex(row=>row.id===pendingId),replacement={id:uid('assistant'),role:'assistant',guide:system,responderSystem:system,text:reply.answer,provider:reply.provider,model:reply.model||'',at:now()};
    if(index>=0)latest.messages[index]=replacement;else latest.messages.push(replacement);
    writeThread(system,latest);renderSharedNow();return true
  }finally{sendLocks.delete(system)}
}
function activateSwitch(control,event){
  const api=workspaceApi();if(!api)return false;
  const system=systemFor(control,api);if(!SYSTEMS.includes(system))return false;
  event?.preventDefault?.();event?.stopImmediatePropagation?.();
  api.switchGuide(system,{open:true});normalizeRoot();renderSharedNow();return true
}
function onPointerDownCapture(event){
  if(!(event.target instanceof Element))return;
  const control=event.target.closest(`#${ROOT_ID} [data-cw242-window],#${ROOT_ID} [data-guide-id]`);
  if(!control)return;
  if(event.pointerType==='mouse'&&event.button!==0)return;
  if(!activateSwitch(control,event))return;
  suppressedSwitchControl=control;suppressSwitchClickUntil=performance.now()+500
}
function onClickCapture(event){
  const api=workspaceApi();
  if(!api||!(event.target instanceof Element))return;
  const target=event.target;
  const switcher=target.closest(`#${ROOT_ID} [data-cw242-window],#${ROOT_ID} [data-guide-id]`);
  if(switcher){
    if(switcher===suppressedSwitchControl&&performance.now()<suppressSwitchClickUntil){event.preventDefault();event.stopImmediatePropagation();return}
    activateSwitch(switcher,event);return
  }
  const full=target.closest(`#${SHARED_ROOT_ID} [data-cwsg-full]`);
  if(full){const system=systemFor(full,api);event.preventDefault();event.stopImmediatePropagation();api.open?.({guide:system});normalizeRoot();return}
  const legacy=target.closest(LEGACY_TRIGGER_SELECTOR);
  if(!legacy||legacy.closest(`#${ROOT_ID}`)||legacy.closest(`#${SHARED_ROOT_ID}`))return;
  const system=systemFor(legacy,api);
  event.preventDefault();event.stopImmediatePropagation();api.open?.({guide:system});normalizeRoot()
}
function onSubmitCapture(event){
  const form=event.target;
  if(!(form instanceof HTMLFormElement))return;
  const api=workspaceApi();
  const canonical=Boolean(api)&&form.matches(`#${ROOT_ID} [data-persistent-form]`);
  const inline=form.matches(`#${SHARED_ROOT_ID} [data-cwsg-form]`);
  const legacy=Boolean(api)&&!canonical&&!inline&&form.matches(LEGACY_FORM_SELECTOR)&&!(form.id==='weaveling-chat-form'&&form.closest('.app'));
  if(!canonical&&!inline&&!legacy)return;
  const input=form.querySelector('textarea,input[type="text"]'),text=clean(input?.value,12000);
  event.preventDefault();event.stopImmediatePropagation();
  if(!text)return;
  const system=inline?systemFor(form,api):canonical?(api.activeWindow?.()||api.pageSystem?.()):systemFor(form,api);
  const button=form.querySelector('button[type="submit"],[data-send]');if(button)button.disabled=true;
  form.dataset.civweaveChatOwner='v248';
  submitOwned(text,system,{open:canonical}).then(sent=>{if(sent!==false&&input)input.value=''}).catch(()=>{}).finally(()=>{if(button)button.disabled=false;renderSharedNow()})
}
function onWorkspaceReady(){queueMicrotask(()=>{normalizeRoot();renderSharedNow()})}
function start(){
  addEventListener('pointerdown',onPointerDownCapture,true);
  addEventListener('click',onClickCapture,true);
  addEventListener('submit',onSubmitCapture,true);
  addEventListener('civweave:guide-workspace-ready',onWorkspaceReady);
  normalizeRoot();
  document.documentElement.dataset.civweaveChatOwner='v248';
  try{dispatchEvent(new CustomEvent('civweave:chat-single-owner-ready',{detail:{version:VERSION,rootId:ROOT_ID,windowCapture:true,pointerSwitch:true,inlineSubmit:true,syntheticClick:false,transportFallback:true,at:now()}}))}catch{}
}
function destroy(){
  removeEventListener('pointerdown',onPointerDownCapture,true);
  removeEventListener('click',onClickCapture,true);
  removeEventListener('submit',onSubmitCapture,true);
  removeEventListener('civweave:guide-workspace-ready',onWorkspaceReady);
  document.documentElement.removeAttribute('data-civweave-chat-owner')
}

start();
globalThis.CivweaveChatSingleOwnerV245=Object.freeze({version:VERSION,normalize:normalizeRoot,submit:submitOwned,destroy,rootId:ROOT_ID,sharedRootId:SHARED_ROOT_ID,policy:'window-capture-v248-canonical-full-inline-owner-no-synthetic-click',transportFallback:'civweave-model-runtime+deterministic'});
})();