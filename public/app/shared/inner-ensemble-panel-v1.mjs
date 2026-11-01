import {authorTemplate,normalizeAuthorTemplate,createInnerEnsemble,LAYERS,INNER_ENSEMBLE_STORAGE,INNER_ENSEMBLE_SCHEMA} from './inner-ensemble-v1.mjs';
import {nextUtcRollover} from './daily-sleep-cycle-v1.mjs';
const IDS=Object.keys(LAYERS);
const LOCAL_SLEEP_PREF='civweave.inner-ensemble.sleep-opt-in.v1';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=()=>{try{return JSON.parse(localStorage.getItem(INNER_ENSEMBLE_STORAGE)||'null')}catch{return null}};
const persist=engine=>{try{localStorage.setItem(INNER_ENSEMBLE_STORAGE,JSON.stringify(engine.exportState()));return true}catch{return false}};
async function localGenerate(request,fleet){
 const runtime=globalThis.CivweaveModelRuntime,state=fleet?.desktopFleetState?.();
 if(typeof runtime?.generate!=='function'||!state?.enabled)
  throw Error('Activate your Desktop Ollama fleet and its shared model runtime in AI & safety first.');
 const url=new URL(state.endpoint),hostname=url.hostname.replace(/^\[|\]$/g,'').toLowerCase();
 // Author self-inserts can be sensitive. Do not transmit to another computer
 // until a separate endpoint-consent interface is explicitly implemented.
 if(!['localhost','127.0.0.1','::1'].includes(hostname))
  throw Error('Author Lab currently uses localhost only. Open Civweave on the computer hosting Ollama.');
 if(!state.models.some(row=>row.name===request.model))
  throw Error('Missing '+request.model+'. Install with Ollama and refresh Desktop Fleet.');
 const config={provider:'ollama',endpoint:state.endpoint,model:request.model,externalConsent:false,
  timeoutMs:180000,temperature:0.8,maxTokens:request.maxTokens,keepAlive:'2m'};
 if(runtime.endpointLeavesDevice?.(runtime.normalizeConfig?.(config)||config)!==false)
  throw Error('The model endpoint is not proven to be local.');
 const result=await runtime.generate({purpose:'civweave-inner-ensemble-v1',executionProfile:'interactive',
  config,messages:request.messages,maxTokens:request.maxTokens,signal:request.signal,requireExternalConsent:true});
 if(result?.status!=='success'||result.actual?.provider!=='ollama'||result.actual?.model!==request.model)
  throw Error(result?.error?.message||'Local Ollama inference failed its model verification.');
 return {text:result.outputText};
}
async function unloadOwnModels(fleet,models){
 const state=fleet?.desktopFleetState?.();
 if(!state?.enabled)throw Error('The Desktop Ollama fleet is not active.');
 const origin=new URL(state.endpoint);
 if(!['127.0.0.1','localhost','[::1]','::1'].includes(origin.hostname.toLowerCase()))
  throw Error('Only the selected loopback Ollama host may be unloaded.');
 const url=origin.origin+'/api/generate',done=[];
 for(const model of [...new Set(models)]){
  if(!state.models.some(x=>x.name===model))continue;
  const response=await fetch(url,{method:'POST',mode:'cors',credentials:'omit',redirect:'error',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({model,keep_alive:0,stream:false})});
  if(!response.ok)throw Error('Ollama could not unload '+model+' (HTTP '+response.status+').');
  done.push(model);
 }
 return done;
}
function exportJson(name,value){
 const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=name;link.click();
 setTimeout(()=>URL.revokeObjectURL(url),400);
}
function agentPanel(id,agent){
 const layer=LAYERS[id];
 const editable={personality:agent.personality,authoredExperiences:agent.authoredExperiences,challenges:agent.challenges};
 return '<section class="cw-fleet-card" data-inner-agent="'+id+'">'+
  '<h5>'+esc(layer.label)+' · '+esc(layer.model)+'</h5>'+
  '<label><input type="checkbox" data-inner-enabled="'+id+'"'+(agent.enabled?' checked':'')+'> Active agent</label>'+
  '<label>Local model <input data-inner-model="'+id+'" value="'+esc(agent.model)+'" spellcheck="false"></label>'+
  '<label>Editable personality and experience template (JSON) <textarea data-inner-persona="'+id+'" rows="10" spellcheck="false">'+esc(JSON.stringify(editable,null,2))+'</textarea></label>'+
  '<label>Developmental exercise <select data-inner-challenge="'+id+'">'+
  agent.challenges.map((x,i)=>'<option value="'+i+'">'+esc((i+1)+'. '+x.slice(0,65))+'</option>').join('')+
  '</select></label><button type="button" data-inner-run-challenge="'+id+'">Run shared exercise</button>'+
  '<label>Author a fictional memory <input data-inner-experience="'+id+'" placeholder="What happened in this character’s story?"></label>'+
  '<button type="button" data-inner-add-experience="'+id+'">Add memory</button>'+
  '<output data-inner-answer="'+id+'" aria-live="polite">No response yet.</output>'+
  '<p class="cw-fleet-meta">No executable tool, autonomous action, spending, or Guild sharing permissions.</p></section>';
}
export function mountInnerEnsemble(host,{fleet=globalThis.CivweaveAIFleetV1}={}){
 if(!host||host.dataset.innerMounted==='1')return null;
 host.dataset.innerMounted='1';
 const previous=read();
 let template=authorTemplate();
 try{if(previous?.template)template=normalizeAuthorTemplate(previous.template)}catch{}
 const engine=createInnerEnsemble({template,generate:request=>localGenerate(request,fleet),onUpdate:row=>{
  persist(engine);
  const status=host.querySelector('[data-inner-status]');
  if(status)status.textContent=row.type+' · '+(row.agentId||'broadcast')+(row.toAgentId?' → '+row.toAgentId:'');
  const log=host.querySelector('[data-inner-journal]');
  if(log){
   const line=document.createElement('p');line.textContent=row.type+' · '+(row.agentId||'all')+
    (row.toAgentId?' → '+row.toAgentId:'')+(row.text?' · '+row.text.slice(0,240):'')+
    (row.action?' · action: '+row.action.kind+' / '+row.action.description.slice(0,200):'');
   log.append(line);while(log.childElementCount>36)log.firstElementChild.remove();
  }
  if(row.type==='activation-update'||row.type==='front-changed')updateMeters();
  if(row.agentId){
   const output=host.querySelector('[data-inner-answer="'+row.agentId+'"]');
   if(output&&['response','front-integration','upstream-action','error','cancelled'].includes(row.type))
    output.textContent=(row.type==='upstream-action'?'Proposal sent to '+row.toAgentId:row.type)+': '+(row.text||'')+
     (row.action?'\nProposed action ['+row.action.kind+']: '+row.action.description:'');
  }
 }});
 if(previous?.history)try{engine.importHistory(previous.history)}catch{}
 if(previous?.activation)try{engine.importActivation(previous.activation)}catch{}
 const status=message=>{const output=host.querySelector('[data-inner-status]');if(output)output.textContent=message};
 let sleepTimer=null;
 const sleepEnabled=(()=>{try{return localStorage.getItem(LOCAL_SLEEP_PREF)==='on'}catch{return false}})();
 const frontChoices=IDS.map(id=>'<option value="'+id+'"'+(id===template.controls.frontAgentId?' selected':'')+'>'+esc(LAYERS[id].label)+'</option>').join('');
 host.innerHTML='<details><summary><strong>Author Lab · Inner Ensemble (0.8B / 2B / 4B)</strong></summary>'+
  '<p>Self-insert as the author of three independent fictional developmental agents. Their personalities start blank. On each shared event, all three propose what they would do as the executive. Internal action proposals flow to the selected front-facing model.</p>'+
  '<p class="cw-fleet-meta">Desktop Ollama, loopback only. Browser-saved fictional memories, not model fine-tuning. Execution may be serialized by Ollama if hardware cannot host the three models concurrently.</p>'+
  '<div class="cw-fleet-grid"><label>Author identity <input data-inner-author-name value="'+esc(template.author.name)+'" placeholder="Author-controlled identity"></label>'+
  '<label>World <input data-inner-world value="'+esc(template.author.world)+'" placeholder="World / setting"></label>'+
  '<label>Front-facing agent <select data-inner-front>'+frontChoices+'</select></label></div>'+
  '<label>Premise <textarea data-inner-premise rows="2">'+esc(template.author.premise)+'</textarea></label>'+
  '<label><input type="checkbox" data-inner-cross-talk'+(template.controls.crossTalk?' checked':'')+'> Share other layers’ previous responses as context</label>'+
  '<label><input type="checkbox" data-inner-autoremember'+(template.controls.autoRemember?' checked':'')+'> Include earlier simulated experiences in the next event’s context</label>'+
  '<fieldset class="cw-fleet-card"><legend>Trigger meter · fictional executive control</legend>'+
  '<label><input type="checkbox" data-inner-trigger-enabled'+(template.controls.trigger.enabled?' checked':'')+'> Allow temporary internal front takeover</label>'+
  '<div class="cw-fleet-grid"><label>Activation threshold <input data-inner-trigger-threshold type="number" min="55" max="95" value="'+template.controls.trigger.threshold+'"></label>'+
  '<label>Release threshold <input data-inner-trigger-release type="number" min="0" max="54" value="'+template.controls.trigger.releaseThreshold+'"></label></div>'+
  '<p class="cw-fleet-meta">Each model proposes its own activation change. The system clamps changes, decays meters after each turn, limits takeover duration, and applies cooldown. A temporary switch affects the next turn, never tool permissions.</p>'+
  '<div data-inner-meter-group></div><button type="button" data-inner-reset-meter>Reset trigger meters</button></fieldset>'+
  '<div class="cw-fleet-grid">'+IDS.map(id=>agentPanel(id,template.agents[id])).join('')+'</div>'+
  '<div class="cw-fleet-choices"><button type="button" data-inner-save>Save personality templates</button>'+
  '<button type="button" data-inner-export>Export author file and event log</button>'+
  '<label>Import author JSON <input type="file" accept=".json,application/json" data-inner-import></label></div>'+
  '<label>New shared event / experience<textarea data-inner-event rows="4" placeholder="Describe a scene, decision, question, or experience…"></textarea></label>'+
  '<div class="cw-fleet-choices"><button type="button" data-inner-send>Broadcast to all layers</button>'+
  '<button type="button" data-inner-stop>Stop</button>'+
  '<button type="button" data-inner-pause>Pause</button>'+
  '<button type="button" data-inner-resume>Resume</button>'+
  '<button type="button" data-inner-clear>Clear history</button></div>'+
  '<output data-inner-status role="status" aria-live="polite">Ready. Nothing runs until requested.</output>'+ 
  '<section class="cw-fleet-card"><h4>Nightly sleep · local host</h4>'+
  '<label><input type="checkbox" data-inner-sleep-auto'+(sleepEnabled?' checked':'')+'> Unload these Ollama models after the UTC rollover (while this page remains open)</label>'+
  '<p class="cw-fleet-meta">Cloudflare included-neuron accounting resets at 00:00 UTC. This page cannot run Cloudflare jobs, train LoRA, or wake from a closed browser. Server-side scheduling and a local trainer must be connected separately.</p>'+
  '<div class="cw-fleet-choices"><button type="button" data-inner-sleep-now>Sleep and unload these models now</button></div>'+
  '<output data-inner-sleep-status role="status">No automatic training host is configured.</output></section>'+
  '<details><summary>Agent journal and action flow</summary><section data-inner-journal class="cw-fleet-card"></section></details>'+
  '</details>';

 function updateMeters(){
  const activation=engine.getActivation(),holder=host.querySelector('[data-inner-meter-group]');
  if(!holder)return;
  holder.replaceChildren();
  for(const id of IDS){
   const line=document.createElement('div');line.className='cw-fleet-meta';
   const meter=document.createElement('progress');meter.value=activation.activation[id];meter.max=100;
   meter.style.width='100%';
   const label=document.createElement('span');
   label.textContent=LAYERS[id].label+' · '+activation.activation[id]+'/100'+(activation.frontAgentId===id?' · front-facing':'');
   line.append(label,meter);holder.append(line);
  }
 }
 async function goToSleep(){
  engine.stop();
  const output=host.querySelector('[data-inner-sleep-status]');
  if(output)output.textContent='Stopping generations and unloading selected model weights…';
  const models=Object.values(engine.getTemplate().agents).filter(a=>a.enabled).map(a=>a.model);
  try{
   const unloaded=await unloadOwnModels(fleet,models);
   if(output)output.textContent='Sleeping. '+unloaded.length+' model(s) unloaded. No LoRA training attempted.';
  }catch(error){if(output)output.textContent='Sleep paused generation, but model unload was incomplete: '+String(error?.message||error)}
  persist(engine);
 }
 function scheduleSleep(){
  if(sleepTimer!==null){clearTimeout(sleepTimer);sleepTimer=null;}
  const input=host.querySelector('[data-inner-sleep-auto]');
  if(!input?.checked)return;
  const delay=nextUtcRollover(Date.now())-Date.now();
  sleepTimer=setTimeout(()=>{sleepTimer=null;
   if(host.isConnected)void goToSleep();
  },Math.min(delay,2147483647));
 }
 function updateForm(){
  const t=engine.getTemplate();
  host.querySelector('[data-inner-author-name]').value=t.author.name;
  host.querySelector('[data-inner-world]').value=t.author.world;
  host.querySelector('[data-inner-premise]').value=t.author.premise;
  host.querySelector('[data-inner-front]').value=t.controls.frontAgentId;
  host.querySelector('[data-inner-cross-talk]').checked=t.controls.crossTalk;
  host.querySelector('[data-inner-autoremember]').checked=t.controls.autoRemember;
  host.querySelector('[data-inner-trigger-enabled]').checked=t.controls.trigger.enabled;
  host.querySelector('[data-inner-trigger-threshold]').value=t.controls.trigger.threshold;
  host.querySelector('[data-inner-trigger-release]').value=t.controls.trigger.releaseThreshold;
  updateMeters();
  for(const id of IDS){
   const a=t.agents[id];
   host.querySelector('[data-inner-enabled="'+id+'"]').checked=a.enabled;
   host.querySelector('[data-inner-model="'+id+'"]').value=a.model;
   host.querySelector('[data-inner-persona="'+id+'"]').value=JSON.stringify({
    personality:a.personality,authoredExperiences:a.authoredExperiences,challenges:a.challenges
   },null,2);
   host.querySelector('[data-inner-challenge="'+id+'"]').innerHTML=a.challenges.map((c,i)=>
    '<option value="'+i+'">'+esc((i+1)+'. '+c.slice(0,65))+'</option>').join('');
  }
 }
 function save(){
  const t=engine.getTemplate();
  t.author.name=host.querySelector('[data-inner-author-name]').value;
  t.author.world=host.querySelector('[data-inner-world]').value;
  t.author.premise=host.querySelector('[data-inner-premise]').value;
  t.controls.frontAgentId=host.querySelector('[data-inner-front]').value;
  t.controls.crossTalk=host.querySelector('[data-inner-cross-talk]').checked;
  t.controls.autoRemember=host.querySelector('[data-inner-autoremember]').checked;
  t.controls.trigger.enabled=host.querySelector('[data-inner-trigger-enabled]').checked;
  t.controls.trigger.threshold=Number(host.querySelector('[data-inner-trigger-threshold]').value);
  t.controls.trigger.releaseThreshold=Number(host.querySelector('[data-inner-trigger-release]').value);
  for(const id of IDS){
   t.agents[id].enabled=host.querySelector('[data-inner-enabled="'+id+'"]').checked;
   t.agents[id].model=host.querySelector('[data-inner-model="'+id+'"]').value.trim();
   const json=JSON.parse(host.querySelector('[data-inner-persona="'+id+'"]').value);
   if(!json||typeof json!=='object'||Array.isArray(json))throw Error('Invalid JSON object for '+id+'.');
   t.agents[id].personality=json.personality;
   t.agents[id].authoredExperiences=json.authoredExperiences;
   t.agents[id].challenges=json.challenges;
  }
  engine.configure(t);
  if(!persist(engine))throw Error('Browser storage unavailable. Export the author file instead.');
  status('Saved locally. No models were started.');
 }
 async function run(send){
  try{
   save();
   status('Dispatched three independent requests…');
   const result=await send();
   status('Completed event '+result.eventId+' with '+result.upstreamActions.length+' upstream proposals.');
  }catch(error){status(String(error?.message||error))}
  finally{persist(engine)}
 }
 host.addEventListener('click',event=>{
  const b=event.target.closest?.('button');if(!b)return;
  try{
   if(b.matches('[data-inner-save]'))return save();
   if(b.matches('[data-inner-reset-meter]')){engine.resetActivation();persist(engine);updateMeters();return status('Trigger meters reset.')}
   if(b.matches('[data-inner-sleep-now]'))return void goToSleep();
   if(b.matches('[data-inner-export]')){save();return exportJson('civweave-inner-ensemble-author.json',engine.exportState())}
   if(b.matches('[data-inner-stop]')){engine.stop();return status('Active generations cancelled. Resume to continue.')}
   if(b.matches('[data-inner-pause]')){engine.stop();return status('Paused.')}
   if(b.matches('[data-inner-resume]')){engine.resume();return status('Resumed.')}
   if(b.matches('[data-inner-clear]')){
    if(typeof confirm==='function'&&confirm('Permanently clear the local Inner Ensemble event history?')){
     engine.resetHistory();persist(engine);status('History cleared.');
    }return;
   }
   if(b.matches('[data-inner-send]'))return void run(()=>engine.send(host.querySelector('[data-inner-event]').value));
   const id=b.dataset.innerRunChallenge;
   if(id)return void run(()=>engine.challenge(id,Number(host.querySelector('[data-inner-challenge="'+id+'"]').value)));
   const memoryId=b.dataset.innerAddExperience;
   if(memoryId){
    save();
    const input=host.querySelector('[data-inner-experience="'+memoryId+'"]');
    engine.remember(memoryId,input.value);input.value='';persist(engine);status('Author-written experience saved locally.');
   }
  }catch(error){status(String(error?.message||error))}
 });
 host.addEventListener('change',event=>{
  if(event.target.matches('[data-inner-sleep-auto]')){
   try{localStorage.setItem(LOCAL_SLEEP_PREF,event.target.checked?'on':'off');scheduleSleep()}catch{}
   return;
  }
  if(!event.target.matches('[data-inner-import]'))return;
  const file=event.target.files?.[0];if(!file)return;
  void file.text().then(raw=>{
   const data=JSON.parse(raw),t=normalizeAuthorTemplate(data?.template||data);
   engine.configure(t);
   if(data?.schema===INNER_ENSEMBLE_SCHEMA&&Array.isArray(data.history))engine.importHistory(data.history);
   if(data?.activation)engine.importActivation(data.activation);
   updateForm();persist(engine);status('Imported author file and local history. No model started.');
  }).catch(error=>status('Import rejected: '+String(error?.message||error)));
 });
 updateMeters();scheduleSleep();
 return engine;
}
