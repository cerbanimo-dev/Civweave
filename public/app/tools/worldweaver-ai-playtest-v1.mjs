/**
 * Presentation only: an explicit-gesture Worldweaver staging model smoke test.
 * Canonical settings own keys; canonical model runtime owns network generation;
 * Worldweaver remains the only authority over world state.
 */
import {COMMONS_BETWEEN} from '../shared/worldweaver-universe-v1.mjs';
import {createConfiguredWorldweaverAISession} from '../shared/worldweaver-ai-handoff-v1.mjs';
import {resolvePlaytestPricing,allowedPlaytestHostname} from '../shared/worldweaver-ai-pricing-v1.mjs';

const hostAllowed=allowedPlaytestHostname(location.hostname);
const form=document.querySelector('#ww-ai-playtest-form');
const status=document.querySelector('#ww-ai-budget-status');
const output=document.querySelector('#ww-ai-output');
const connected=document.querySelector('#ww-ai-connection');
const roleInput=form.elements.namedItem('role');
const personaInput=form.elements.namedItem('personaId');
const send=form.querySelector('[data-ww-ai-send]');
const roomInput=form.elements.namedItem('world');
let activeSession=null,sessionMode='',activeRequest=0,busy=false,activeController=null;

for(const room of COMMONS_BETWEEN.rooms){
  const item=document.createElement('option');
  item.value=room.id;item.textContent=room.title;
  roomInput.append(item);
}
function settingsOwner(){return globalThis.CivweaveSettingsV320}
function showStatus(message){status.textContent=message}
function endSession(message='In-memory scene history cleared.'){
  activeController?.abort('Worldweaver playtest ended by user or settings change.');
  activeController=null;
  activeRequest+=1;
  activeSession?.clearMemory();
  activeSession=null;sessionMode='';
  form.elements.namedItem('externalConsent').checked=false;
  output.textContent='No active story proposal.';
  showStatus(message);
}
function showConfiguration(){
  if(!hostAllowed){connected.textContent='Paid AI playtesting is disabled on this host. Visit the dedicated staging origin for opt-in testing.';return}
  const settings=settingsOwner();
  if(!settings){connected.textContent='Shared AI Settings unavailable. Open Civweave from a supported browser route.';return}
  const mode=settings.readWorldMode();
  const providers=settings.worldweaverConnections();
  connected.textContent='Selected mode: '+mode+' · Configured and consented cloud providers: '+(providers.length?providers.join(', '):'none')+'. Only supported, priced models can run this test.';
}
function syncRole(){
  const role=roleInput.value;
  if(role==='lari'){
    personaInput.value='lari';
    personaInput.readOnly=true;
  }else{
    personaInput.readOnly=role==='loom';
    if(role==='loom')personaInput.value='loom';
    if(role==='actors'&&['loom','lari'].includes(personaInput.value))personaInput.value='maggie';
  }
}
async function runtimeForExplicitRequest(){
  if(globalThis.CivweaveModelRuntime?.generate)return globalThis.CivweaveModelRuntime;
  // Loads the canonical provider runtime only following the user's submit.
  await import('/app/shared/civweave-model-runtime.js');
  if(typeof globalThis.CivweaveModelRuntime?.generate!=='function')
    throw new Error('Shared Civweave model runtime did not become available.');
  return globalThis.CivweaveModelRuntime;
}
form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!hostAllowed){showStatus('The paid AI playtest is unavailable on this production or unapproved host.');return}
  if(busy)return;
  const consent=form.elements.namedItem('externalConsent').checked;
  if(!consent){showStatus('Check the explicit external-request consent box before generating.');return}
  const settings=settingsOwner();
  if(!settings){showStatus('Canonical Settings unavailable; no API call made.');return}
  let pricing;
  try{pricing=resolvePlaytestPricing(settings)}catch(error){showStatus(String(error.message||error));return}
  const maxReservedUsd=Number(form.elements.namedItem('maxReservedUsd').value);
  if(!Number.isFinite(maxReservedUsd)||maxReservedUsd<=0||maxReservedUsd>0.05){
    showStatus('Choose a positive estimated USD session budget no larger than $0.05. No call made.');return
  }
  const world=roomInput.value,role=roleInput.value;
  const room=COMMONS_BETWEEN.rooms.find(item=>item.id===world);
  if(!room||!['loom','actors','lari'].includes(role)){showStatus('Choose a valid room and story role.');return}
  const mode=settings.readWorldMode();
  if(activeSession&&mode!==sessionMode){endSession('Mode changed; consent and start a new session.');return}
  const prompt=String(form.elements.namedItem('scenePrompt').value||'').trim();
  if(!prompt){showStatus('A scene prompt is required.');return}
  busy=true;send.disabled=true;
  const requestId=++activeRequest;
  const controller=new AbortController();
  activeController=controller;
  showStatus('Sending one requested story proposal. No Worldweaver action will be committed.');
  try{
    if(!activeSession){
      const runtime=await runtimeForExplicitRequest();
      if(requestId!==activeRequest)return;
      activeSession=createConfiguredWorldweaverAISession({
        settings,runtime,consent:true,
        budget:{maxCalls:2,maxEstimatedInputTokens:4000,maxOutputTokensPerCall:200,maxReservedUsd},
        pricePerMillion:pricing,tested:[]
      });
      sessionMode=mode;
    }
    // This action originates from the actual submit event, never page startup.
    dispatchEvent(new CustomEvent('civweave:worldweaver-playtest-requested',{detail:{userInitiated:true,role,worldId:room.id}}));
    const result=await activeSession.propose({
      role,worldId:'commons-between:'+room.id,
      personaId:role==='loom'?'loom':role==='lari'?'lari':String(personaInput.value||'').trim(),
      actorPrompt:String(form.elements.namedItem('personaPrompt').value||''),
      worldContext:room.description+'\n'+String(form.elements.namedItem('worldContext').value||''),
      scenePrompt:prompt,maxOutputTokens:200,signal:controller.signal
    });
    if(requestId!==activeRequest)return;
    output.textContent=result.text;
    const snapshot=activeSession.status();
    showStatus('Uncommitted '+result.role+' proposal from '+result.provider+' · '+result.model+
      '. Reserved estimated cost: $'+snapshot.reservedUsd.toFixed(5)+
      ' · '+snapshot.spentCalls+'/'+snapshot.maxCalls+' requests. The real provider bill may differ.');
  }catch(error){
    if(requestId===activeRequest){
      showStatus('No approved fiction output: '+String(error?.message||error).slice(0,320));
      output.textContent='No Worldweaver change was made.';
    }
  }finally{if(activeController===controller)activeController=null;busy=false;send.disabled=false}
});
roleInput.addEventListener('change',syncRole);
form.querySelector('[data-ww-ai-end]').addEventListener('click',()=>endSession());
addEventListener('civweave:model-settings-saved',()=>{endSession('Provider settings changed. Review and approve a new session before generation.');showConfiguration()});
addEventListener('civweave:worldweaver-ai-mode-changed',()=>{endSession('World mode changed. Review and approve a new session before generation.');showConfiguration()});
addEventListener('pagehide',()=>activeSession?.clearMemory());
syncRole();showConfiguration();
if(!hostAllowed){send.disabled=true;form.querySelector('[data-ww-ai-consent]').disabled=true;
  document.querySelector('[data-open-unified-ai-settings]')?.setAttribute('disabled','');
  showStatus('No cloud model calls are permitted on this host.');}

