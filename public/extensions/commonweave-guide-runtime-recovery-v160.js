(()=>{
'use strict';
const VERSION='160.0-guide-runtime-recovery';
if(globalThis.CommonweaveGuideRuntimeRecoveryV160?.version===VERSION)return;
const PERSIST_KEY='commonweave-model-persistent-secrets-v160';
const SESSION_KEY='commonweave-model-session';
const RUNTIME_SECRET_KEY='commonweave-model-secrets-v1';
const SYSTEMS=new Set(['commonweave','living-school','cerbanimo','fellowfare','anarchadia']);
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const isCerbanimo=()=>new URLSearchParams(location.search).get('system')==='cerbanimo';
let settingsPatchQueued=false,cerbanimoPatchQueued=false,cerbanimoObserver=null;

function safeGet(storage,key){try{return storage?.getItem?.(key)||''}catch{return''}}
function safeSet(storage,key,value){try{storage?.setItem?.(key,value);return true}catch{return false}}
function safeRemove(storage,key){try{storage?.removeItem?.(key)}catch{}}
function restoreSecrets(){
  const saved=parse(safeGet(localStorage,PERSIST_KEY),null);
  if(!saved||typeof saved!=='object')return false;
  if(saved.session&&!safeGet(sessionStorage,SESSION_KEY))safeSet(sessionStorage,SESSION_KEY,JSON.stringify(saved.session));
  const current=parse(safeGet(sessionStorage,RUNTIME_SECRET_KEY),{}),persisted=saved.secrets&&typeof saved.secrets==='object'?saved.secrets:{};
  const merged={...persisted,...current};
  if(Object.keys(merged).length)safeSet(sessionStorage,RUNTIME_SECRET_KEY,JSON.stringify(merged));
  return Boolean(saved.session?.apiKey||Object.values(merged).some(item=>item?.apiKey));
}
function persistSecrets(){
  const session=parse(safeGet(sessionStorage,SESSION_KEY),{}),secrets=parse(safeGet(sessionStorage,RUNTIME_SECRET_KEY),{});
  const hasKey=Boolean(session?.apiKey||Object.values(secrets).some(item=>item?.apiKey));
  if(!hasKey){safeRemove(localStorage,PERSIST_KEY);return false}
  return safeSet(localStorage,PERSIST_KEY,JSON.stringify({schema:'commonweave.device-model-secrets.v1',session,secrets,savedAt:new Date().toISOString()}));
}
function forgetSecrets(){
  safeRemove(localStorage,PERSIST_KEY);safeRemove(sessionStorage,SESSION_KEY);safeRemove(sessionStorage,RUNTIME_SECRET_KEY);
  dispatchEvent(new CustomEvent('commonweave:model-secret-forgotten',{detail:{version:VERSION,at:new Date().toISOString()}}));
  queueSettingsPatch();
}
function hasSavedSecret(){
  const saved=parse(safeGet(localStorage,PERSIST_KEY),{}),session=parse(safeGet(sessionStorage,SESSION_KEY),{}),secrets=parse(safeGet(sessionStorage,RUNTIME_SECRET_KEY),{});
  return Boolean(saved?.session?.apiKey||session?.apiKey||Object.values(saved?.secrets||{}).some(item=>item?.apiKey)||Object.values(secrets).some(item=>item?.apiKey));
}
function patchSettings(){
  settingsPatchQueued=false;
  const stored=hasSavedSecret();
  document.querySelectorAll('[data-unified-model-settings],[data-smol-settings-form]').forEach(form=>{
    const note=form.querySelector('[data-secret-note]');
    if(note)note.textContent=stored?'A credential is stored on this device and restored when the app reopens.':'No device-stored credential is present.';
    const footer=[...form.querySelectorAll('footer p,p')].find(node=>/credentials|api keys|session storage|session-only/i.test(node.textContent||''));
    if(footer)footer.textContent='Provider preferences and credentials are stored only on this device. Credentials are excluded from exports, handoffs, and offline seeds.';
    if(!form.querySelector('[data-cw160-forget-key]')){
      const button=document.createElement('button');button.type='button';button.dataset.cw160ForgetKey='';button.className='cw-ai-forget-key';button.textContent='Forget saved key';button.hidden=!stored;
      const actions=form.querySelector('footer .cw-ai-actions,menu.cw-ai-actions,.cw-ai-form-footer .cw-ai-actions')||form;
      actions.append(button);
    }else form.querySelector('[data-cw160-forget-key]').hidden=!stored;
  });
}
function queueSettingsPatch(){if(settingsPatchQueued)return;settingsPatchQueued=true;queueMicrotask(patchSettings)}

async function ensureGuideRuntime(){
  if(globalThis.CommonweaveAssistantV141?.respond)return globalThis.CommonweaveAssistantV141;
  const loader=globalThis.CommonweaveFamilyAILoaderV105;
  if(!loader?.ensure)throw new Error('The shared guide loader is unavailable.');
  await loader.ensure();
  if(!globalThis.CommonweaveAssistantV141?.respond)throw new Error('The shared guide runtime did not become ready.');
  return globalThis.CommonweaveAssistantV141;
}
async function legacyAsk(system,text,rows=[]){
  const systemId=SYSTEMS.has(system)?system:'commonweave',assistant=await ensureGuideRuntime();
  const result=await assistant.respond({text:clean(text,8000),systemId,history:Array.isArray(rows)?rows.filter(row=>!row?.pending):[]});
  const answer=clean(result?.response?.answer||'The guide returned no text.'),next=clean(result?.response?.choice?.nextAction,500);
  return{role:'assistant',text:next?`${answer}\n\nNext: ${next}`:answer,provider:result?.provider||'',model:result?.model||'',approvalGate:result?.response?.approvalGate||null,planSnapshot:result?.plan?structuredClone(result.plan):null,actionSnapshot:result?.action?structuredClone(result.action):null};
}
function installLegacyGuideBridge(){
  globalThis.CommonweaveGuideChatV153={version:`compat-${VERSION}`,ask:legacyAsk,open:(system='commonweave')=>globalThis.CommonweaveFamilyAILoaderV105?.openChat?.('commonweave',{contextSystem:SYSTEMS.has(system)?system:'commonweave'})};
}

async function retryDirectGuideSubmit(event){
  const form=event.target.closest?.('[data-ch142-form]');
  if(!form||globalThis.CommonweaveAssistantV141?.respond||form.dataset.cw160Retrying==='true')return;
  event.preventDefault();event.stopImmediatePropagation();form.dataset.cw160Retrying='true';
  const button=form.querySelector('button[type="submit"],button:not([type])');if(button)button.disabled=true;
  try{await ensureGuideRuntime();form.dataset.cw160Retrying='ready';if(typeof form.requestSubmit==='function')form.requestSubmit();else form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))}
  catch(error){form.dataset.cw160Retrying='';if(button)button.disabled=false;const band=form.closest('.ch142-control-band'),log=band?.querySelector('[data-ch142-log],[data-cwf-log]');if(log)log.insertAdjacentHTML('beforeend',`<article class="ch142-message is-guide"><p>${esc(`The guide could not load: ${error.message}`)}</p></article>`)}
}

function activeQuest(engine){const state=engine?.readState?.();if(!state)return{};const quest=state.quests?.find(item=>item.id===state.preferences?.activeQuestId)||state.quests?.find(item=>item.status!=='archived')||state.quests?.[0];return{state,quest}}
function setText(node,text){if(node&&node.textContent!==text)node.textContent=text}
function taskButtonLabel(task){return task?.review?.state==='ai-validating'?'AI validating…':task?.review?.state==='ai-unavailable'?'Retry AI validation':'Run AI validation'}
function patchCerbanimo(){
  cerbanimoPatchQueued=false;if(!isCerbanimo())return;
  const engine=globalThis.CommonweaveCerbanimoQuestV144,validator=globalThis.CerbanimoAIValidatorV156;if(!engine||!validator)return;
  const {quest}=activeQuest(engine);if(!quest)return;
  document.querySelectorAll('[data-cq-ai-action]').forEach(node=>node.remove());
  document.querySelectorAll('.cq144-task[data-task-id]').forEach(card=>{
    const task=quest.tasks?.find(item=>item.id===card.dataset.taskId),footer=card.querySelector('footer');if(!task||!footer)return;
    footer.querySelectorAll('[data-cq-action="accept-task"],[data-cq-action="revise-task"]').forEach(node=>node.remove());
    let button=footer.querySelector('[data-cw160-ai-task]');
    if(task.status!=='review'){button?.remove();return}
    if(!button){button=document.createElement('button');button.type='button';button.className='cq144-button is-primary';button.dataset.cw160AiTask=task.id;footer.prepend(button)}
    const label=taskButtonLabel(task);setText(button,label);button.disabled=task?.review?.state==='ai-validating';button.dataset.questId=quest.id;
  });
  document.querySelectorAll('[data-cq-action="accept-quest"],[data-cq-action="revise-quest"]').forEach(node=>node.remove());
  const side=[...document.querySelectorAll('.cq144-side-card')].find(node=>/QUEST ACCEPTANCE/i.test(node.textContent||''));
  let final=side?.querySelector('[data-cw160-ai-final]');
  if(quest.status==='review'&&side){if(!final){final=document.createElement('button');final.type='button';final.className='cq144-button is-primary';final.dataset.cw160AiFinal='';side.append(final)}setText(final,'Run final AI validation');final.dataset.questId=quest.id}else final?.remove();
}
function queueCerbanimoPatch(){if(cerbanimoPatchQueued)return;cerbanimoPatchQueued=true;queueMicrotask(patchCerbanimo)}
function installCerbanimoRecovery(){
  if(!isCerbanimo())return;
  document.documentElement.dataset.cerbanimoAiValidator='true';
  document.addEventListener('click',event=>{
    const task=event.target.closest?.('[data-cw160-ai-task]');if(task){event.preventDefault();event.stopImmediatePropagation();task.disabled=true;setText(task,'AI validating…');globalThis.CerbanimoAIValidatorV156?.validateTask?.(task.dataset.questId,task.dataset.cw160AiTask).catch(()=>{}).finally(queueCerbanimoPatch);return}
    const final=event.target.closest?.('[data-cw160-ai-final]');if(final){event.preventDefault();event.stopImmediatePropagation();final.disabled=true;setText(final,'AI final validation…');globalThis.CerbanimoAIValidatorV156?.validateQuest?.(final.dataset.questId).catch(()=>{}).finally(queueCerbanimoPatch);return}
    const manual=event.target.closest?.('[data-cq-action="accept-task"],[data-cq-action="revise-task"],[data-cq-action="accept-quest"],[data-cq-action="revise-quest"]');if(manual){event.preventDefault();event.stopImmediatePropagation();return}
    const submitted=event.target.closest?.('[data-cq-action="submit-task"],[data-cq-action="submit-quest"]');if(submitted)setTimeout(()=>{
      const engine=globalThis.CommonweaveCerbanimoQuestV144,validator=globalThis.CerbanimoAIValidatorV156,{quest}=activeQuest(engine);if(!quest||!validator)return;
      if(submitted.dataset.cqAction==='submit-task'){const taskId=submitted.closest('[data-task-id]')?.dataset.taskId,task=quest.tasks?.find(item=>item.id===taskId);if(task?.status==='review')validator.validateTask(quest.id,taskId).catch(()=>{})}
      if(submitted.dataset.cqAction==='submit-quest'&&quest.status==='review')validator.validateQuest(quest.id).catch(()=>{});
    },120);
  },true);
  const wait=setInterval(()=>{if(globalThis.CommonweaveCerbanimoQuestV144&&globalThis.CerbanimoAIValidatorV156){clearInterval(wait);const root=document.querySelector('#rc-app')||document.documentElement;cerbanimoObserver=new MutationObserver(queueCerbanimoPatch);cerbanimoObserver.observe(root,{childList:true,subtree:true});addEventListener('cerbanimo:quest-engine-changed',queueCerbanimoPatch);queueCerbanimoPatch()}},50);
  setTimeout(()=>clearInterval(wait),20000);
}

restoreSecrets();installLegacyGuideBridge();installCerbanimoRecovery();
addEventListener('commonweave:model-settings-saved',()=>{setTimeout(()=>{persistSecrets();queueSettingsPatch()},0)});
addEventListener('pagehide',persistSecrets);document.addEventListener('visibilitychange',()=>{if(document.hidden)persistSecrets()});
document.addEventListener('submit',event=>{if(event.target.matches?.('[data-unified-model-settings],[data-smol-settings-form]'))setTimeout(()=>{persistSecrets();queueSettingsPatch()},60);retryDirectGuideSubmit(event)},true);
document.addEventListener('click',event=>{if(event.target.closest?.('[data-cw160-forget-key]')){event.preventDefault();forgetSecrets()}},true);
const settingsObserver=new MutationObserver(queueSettingsPatch);settingsObserver.observe(document.documentElement,{childList:true,subtree:true});
document.readyState==='loading'?addEventListener('DOMContentLoaded',queueSettingsPatch,{once:true}):queueSettingsPatch();
globalThis.CommonweaveGuideRuntimeRecoveryV160={version:VERSION,restoreSecrets,persistSecrets,forgetSecrets,hasSavedSecret,ensureGuideRuntime,legacyAsk,patchCerbanimo};
})();
