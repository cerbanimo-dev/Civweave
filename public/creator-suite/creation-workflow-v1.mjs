import {createCreationWorkflow,creationErrorDetails} from './shared/creation-run-v1.mjs';
const $=id=>document.getElementById(id);
let run=null,controller=null,source=null,preparedEvidence=null;
const SOURCE_SELECTION_KEY='civweave.creator.source-selection.v1';
const status=(message,bad=false)=>{const node=$('cs-creation-status');node.textContent=message;node.className='cs-status'+(bad?' cs-bad':'')};
const workflow=createCreationWorkflow({store:globalThis.CivweaveCreatorStoreV1,editor:globalThis.CivweaveCreatorTextV1,tools:globalThis.CivweaveCreatorToolsV1,runtime:()=>globalThis.CivweaveModelRuntime,prepareRuntime:()=>{if(!globalThis.CivweaveSettingsV320?.restoreRememberedCredential)throw new Error('The shared Settings credential owner is unavailable. Reload Creator Suite before continuing.');globalThis.CivweaveSettingsV320.restoreRememberedCredential()},contract:(objective,toolState)=>({sourceModule:'public/creator-suite/document-agent-v1.js',revision:globalThis.CivweaveCreatorDocumentAgentV1.stageContractRevision,outputSchema:'civweave.creator-document-tool.v1',messages:[{role:'user',content:globalThis.CivweaveCreatorDocumentAgentV1.stepPrompt(objective,toolState,3,false)}]})});
function selectSource(next){
  source=next;$('cs-creation-source-id').value=source?.id||'';
  $('cs-creation-source-status').textContent=source?`${source.name} · ${source.characters.toLocaleString()} characters · ${source.rights} · ${source.hash}. Complete source saved privately on this device.`:'No source selected. Importing keeps the complete text on this device and does not send it to Gemini.';
  $('cs-creation-consent').checked=false;
  try{if(source)localStorage.setItem(SOURCE_SELECTION_KEY,source.id);else localStorage.removeItem(SOURCE_SELECTION_KEY)}catch{}
}
function render(){
  $('cs-creation-id').value=run?.id||'';
  $('cs-creation-history').textContent=run?JSON.stringify(run,null,2):'No creation run selected.';
  $('cs-creation-draft').disabled=!run||run.state!=='ready'||Boolean(controller);
  $('cs-creation-edit').disabled=!run||!['draft-saved','edited','failed','cancelled'].includes(run.state)||Boolean(controller);
  $('cs-agent-run').disabled=Boolean(controller);
  $('cs-creation-stop').disabled=!controller;
  $('cs-creation-export').disabled=!run||Boolean(controller);
  const attached=run?.sourceRef;
  $('cs-creation-consent-label').textContent=attached?`Send the complete source “${attached.name}” (${attached.characters.toLocaleString()} characters, ${attached.hash}), this objective, and the document’s status / recent text to my configured Gemini route for one bounded first draft. No source text is silently omitted. Existing provider consent and budget still apply.`:'Send this objective and the document’s status / recent text to my configured Gemini route for one bounded first draft. Existing provider consent and budget still apply.';
}
async function load(){
  const selected=await workflow.get($('cs-creation-id').value.trim()),editor=globalThis.CivweaveCreatorTextV1;
  if(editor.getSession()?.id!==selected.artifactRef){const session=await globalThis.CivweaveCreatorStoreV1.getSession(selected.artifactRef);if(!session)throw new Error('The run’s original document is unavailable.');await editor.openSession(session)}
  run=selected;$('cs-agent-objective').value=run.objective;$('cs-creation-intention').value=run.intentionRef;selectSource(run.sourceRef||null);render();
  const checkpoint=run.passes.find(pass=>pass.kind==='model-draft')?.checkpointRef;
  $('cs-creation-checkpoint').textContent=checkpoint?(await globalThis.CivweaveCreatorStoreV1.getArtifact(checkpoint))?.text||'Checkpoint unavailable.':'No streamed checkpoint yet.';
  status('Loaded saved run. Producer authorization remains pending.');
}
function action(id,work){$(id)?.addEventListener('click',()=>Promise.resolve().then(work).catch(error=>{const detail=creationErrorDetails(error);status(detail.message.startsWith(detail.code+':')?detail.message:`${detail.code}: ${detail.message}`,true)}))}
action('cs-creation-source-import',async()=>{
  const file=$('cs-creation-source-file').files?.[0];if(!file)throw new Error('Choose a plain text or Markdown source file first.');
  if(!/\.(?:txt|md|markdown)$/i.test(file.name)||file.size>1000000)throw new Error('Choose a text or Markdown source file no larger than 1 MB and 250,000 characters. No source was truncated.');
  const imported=await workflow.importSource({name:file.name,text:await file.text(),mediaType:/\.(?:md|markdown)$/i.test(file.name)?'text/markdown':'text/plain',rights:$('cs-creation-source-rights').value,rightsConfirmed:$('cs-creation-source-rights-confirm').checked});
  selectSource(imported);status('Complete source imported privately. Start a new stage journal to attach this exact source before granting Gemini consent.');
});
action('cs-creation-source-load',async()=>{selectSource(await workflow.sourceInfo($('cs-creation-source-id').value.trim()));status('Verified saved source hash. Start a new stage journal to attach it.');});
action('cs-creation-source-clear',()=>{selectSource(null);status('New stage journals will use no source. An existing run keeps its original exact source reference.');});
action('cs-creation-start',async()=>{run=await workflow.start({intentionRef:$('cs-creation-intention').value,objective:$('cs-agent-objective').value,sourceId:source?.id,previousRunRef:['failed','cancelled'].includes(run?.state)?run.id:undefined});$('cs-creation-consent').checked=false;render();status('Run saved with the current document stage contract'+(run.sourceRef?' and complete source hash.':'.')+(run.previousRunRef?' Prior failed run remains linked.':'')+' No inference started.');});

action('cs-creation-check-ready',async()=>{const state=await workflow.readiness();status(state.ready?`Gemini readiness confirmed for ${state.model}: credential available in this tab, external endpoint consent active, and generation lease supported. No provider request was made.`:`Gemini is not ready: provider ${state.provider||'unselected'}, credential ${state.credentialReady?'available':'missing'}, external consent ${state.externalConsent?'active':'missing'}, lease ${state.leaseAvailable?'available':'missing'}. Open AI Settings and save the selected external route consent in this tab. No inference started.`,!state.ready)});
action('cs-creation-load',load);
action('cs-creation-draft',async()=>{
  controller=new AbortController();render();
  try{run=await workflow.draft({runId:run.id,expectedRevision:run.revision,consent:$('cs-creation-consent').checked,consentSourceHash:run.sourceRef?.hash,signal:controller.signal,onProgress:progress=>status('Gemini stream: '+progress.characters+' visible characters received.')});status('First draft saved with its tool receipt. Ready for independent editorial edits.');}
  finally{controller=null;if(run)run=await workflow.get(run.id);render();const ref=run?.passes[0]?.checkpointRef;if(ref)$('cs-creation-checkpoint').textContent=(await globalThis.CivweaveCreatorStoreV1.getArtifact(ref))?.text||'';}
});
action('cs-creation-stop',()=>{controller?.abort(new DOMException('Stopped by user','AbortError'));status('HTTP stream abort requested. Backend cancellation remains unconfirmed.');});
action('cs-creation-inspect',()=>{$('cs-creation-document').textContent=JSON.stringify(globalThis.CivweaveCreatorTextV1.getDocument(),null,2);});
action('cs-creation-edit',async()=>{const edits=JSON.parse($('cs-creation-edits').value),apply=['failed','cancelled'].includes(run?.state)?workflow.repair:workflow.edit;run=await apply({runId:run.id,expectedRevision:run.revision,edits,summary:$('cs-creation-rationale').value});render();status('Authored revision saved with zero inference. Original content, edit operations, rationale, and tool receipt are retained.');});

action('cs-creation-export',async()=>{
  if(!run)throw new Error('Load a saved creation run before exporting evidence.');
  const packet=await workflow.exportEvidence({runId:run.id,includeCheckpoint:$('cs-creation-export-checkpoint').checked});
  preparedEvidence=packet;$('cs-creation-evidence').textContent=JSON.stringify(packet,null,2);$('cs-creation-download').disabled=false;
  status('Exact creation evidence prepared for inspection; manuscript body excluded.'+(packet.missingArtifacts.length?` Warning: ${packet.missingArtifacts.length} referenced artifacts are unavailable and listed in the packet.`:''),packet.missingArtifacts.length>0);
});
action('cs-creation-download',()=>{
  if(!preparedEvidence)throw new Error('Prepare and inspect the evidence first.');
  const packet=preparedEvidence;
  const blob=new Blob([JSON.stringify(packet,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=`${packet.run.id.replace(/[^A-Za-z0-9_-]/g,'-')}-evidence.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  status('Creation evidence exported locally; manuscript body excluded.'+(packet.missingArtifacts.length?` Warning: ${packet.missingArtifacts.length} referenced artifacts are unavailable and listed in the packet.`:''),packet.missingArtifacts.length>0);
});
action('cs-training-preview',async()=>{
  if(!run||run.state!=='edited')throw new Error('Load an editorially revised creation run first.');
  const first=run.passes.find(pass=>pass.kind==='model-draft'),last=run.passes.at(-1),store=globalThis.CivweaveCreatorStoreV1;
  const [original,final]=await Promise.all([store.getDocumentRevision(run.artifactRef,first.artifactRevision),store.getDocumentRevision(run.artifactRef,last.artifactRevision)]);
  if(!original||!final)throw new Error('Saved original and edited document revisions are required.');
  const sample={instruction:run.objective,input:'',output:final.content,editorPatches:[{before:original.content,after:final.content,rationale:last.changeSummary}],toolReceiptRefs:run.passes.map(pass=>pass.receiptId).filter(Boolean)};
  if(sample.output.length>16000||sample.editorPatches.some(patch=>patch.before.length>3000||patch.after.length>3000))throw new Error('This run exceeds the bounded sample size. Create a short section-level run; no text was silently truncated.');
  $('cs-training-sample').value=JSON.stringify(sample,null,2);status('Visible sample prepared locally from saved revisions. Review it and declare rights before delivery.');
});
action('cs-training-send',async()=>{
  if(!$('cs-training-consent').checked)throw new Error('Review the visible sample and explicitly consent to training custody first.');
  const nodeId=$('cs-training-node').value.trim(),purposeRevision=Number($('cs-training-purpose-revision').value),client=globalThis.CivweaveGuildTrainingV1;
  const guild={id:nodeId};await client.list(guild);
  const receipt=await client.contribute(guild,{idempotencyKey:$('cs-training-delivery-key').value.trim(),purposeId:$('cs-training-purpose').value.trim(),purposeRevision,consent:{training:true,rights:$('cs-training-rights').value,rightsRef:$('cs-training-rights-ref').value.trim(),policyRevision:'training-custody-v1',visibleOnly:true,privateDataExcluded:true},sample:JSON.parse($('cs-training-sample').value)});
  $('cs-training-receipt').textContent=JSON.stringify(receipt,null,2);status('Host Guild acknowledged custody. This sample is quarantined; training and settlement have not executed.');
});
action('cs-training-list',async()=>{const receipt=await globalThis.CivweaveGuildTrainingV1.list({id:$('cs-training-node').value.trim()});$('cs-training-receipt').textContent=JSON.stringify(receipt,null,2);status('Loaded your host-Guild contribution metadata.');});
action('cs-training-withdraw',async()=>{const guild={id:$('cs-training-node').value.trim()},client=globalThis.CivweaveGuildTrainingV1;await client.list(guild);const record=await client.get(guild,$('cs-training-withdraw-id').value.trim());const receipt=await client.withdraw(guild,record.contribution);$('cs-training-receipt').textContent=JSON.stringify(receipt,null,2);status('Host custody withdrawal acknowledged. This cannot erase datasets already exported or completed models.');});
render();
try{const saved=localStorage.getItem(SOURCE_SELECTION_KEY);if(saved)workflow.sourceInfo(saved).then(value=>{if(!run&&!source)selectSource(value)}).catch(()=>{$('cs-creation-source-status').textContent='The last selected source is unavailable. Import it again or load a saved source ID.'})}catch{}
