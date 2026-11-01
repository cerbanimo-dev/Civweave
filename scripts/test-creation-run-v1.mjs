import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {IDBFactory} from 'fake-indexeddb';
import {JSDOM} from 'jsdom';
import {createCreationWorkflow} from '../public/creator-suite/shared/creation-run-v1.mjs';

function fixture({prepareRuntime}={}){
  const context={indexedDB:new IDBFactory(),structuredClone,TextEncoder,crypto:webcrypto};vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../public/creator-suite/shared/session-store-v1.js',import.meta.url),'utf8'),context);
  const store=context.CivweaveCreatorStoreV1;
  let revision=0,calls=0;const applied=[],requests=[];
  const editor={flush:async()=>{},getSession:()=>({id:'session-1'}),getDocumentStatus:()=>({revision}),getDocument:()=>({revision,blocks:[]})};
  const tools={execute:async request=>{applied.push(request);if(request.args.expectedRevision!==revision)throw new Error('Revision conflict');revision++;return{result:{receiptId:`receipt-${revision}`,status:{revision}}}}};
  const draft={type:'edit',edits:[{op:'append',block:{type:'paragraph',text:'An original development example.'}}]};
  const model={readSharedConfig:()=>({provider:'gemini',model:'configured-model',apiKey:'synthetic-session-key',externalConsent:true}),generate:async request=>{calls++;requests.push(request);const body=JSON.stringify(draft);request.onToken(body.slice(0,30),{done:false});request.onToken(body.slice(30),{done:false});return{status:'success',outputText:body,stream:{used:true},actual:{provider:'gemini',model:'configured-model'}}}};
  let seq=0;
  let leased=false;
  const locks={async request(_key,_options,work){if(leased)return work(null);leased=true;try{return await work({name:'synthetic-test-lease'})}finally{leased=false}}};
  const workflow=createCreationWorkflow({store,editor,tools,runtime:()=>model,prepareRuntime,locks,id:()=>`run-${++seq}`,crypto:webcrypto,contract:objective=>({sourceModule:'public/creator-suite/document-agent-v1.js',revision:'test-contract',outputSchema:'civweave.creator-document-tool.v1',messages:[{role:'user',content:objective}]})});
  return{store,workflow,model,editor,applied,requests,calls:()=>calls};
}
test('creation run journals a real streamed checkpoint, document receipt, and independent revision without repeating inference',async()=>{
  const f=fixture(),run=await f.workflow.start({intentionRef:'intention-1',objective:'Write a short original paragraph'});
  const drafted=await f.workflow.draft({runId:run.id,expectedRevision:run.revision,consent:true});
  assert.equal(f.calls(),1);assert.equal(drafted.state,'draft-saved');
  assert.equal(drafted.passes[0].receiptId,'receipt-1');
  const checkpoint=await f.store.getArtifact(drafted.passes[0].checkpointRef);
  assert.match(checkpoint.text,/original development example/);
  const edited=await f.workflow.edit({runId:run.id,expectedRevision:drafted.revision,edits:[{op:'append',block:{type:'paragraph',text:'A concrete editorial correction.'}}],summary:'Added a specific correction',editorId:'editor-agent'});
  assert.equal(edited.state,'edited');assert.equal(edited.passes[1].baseArtifactRevision,1);assert.equal(f.calls(),1);
  await assert.rejects(f.workflow.draft({runId:run.id,expectedRevision:edited.revision,consent:true}),/already|one first/i);
});
test('missing consent, wrong provider and concurrent draft cannot start extra paid requests',async()=>{
  const f=fixture(),run=await f.workflow.start({intentionRef:'intention-2',objective:'Draft'});
  await assert.rejects(f.workflow.draft({runId:run.id,expectedRevision:run.revision,consent:false}),/consent/i);
  f.model.readSharedConfig=()=>({provider:'ollama',model:'local'});
  await assert.rejects(f.workflow.draft({runId:run.id,expectedRevision:run.revision,consent:true}),/Gemini/i);
  assert.equal(f.calls(),0);
});
test('a whole-response imitation is rejected; preserved checkpoint is not a committed draft',async()=>{
  const f=fixture(),run=await f.workflow.start({intentionRef:'intention-3',objective:'Draft'});
  f.model.generate=async()=>({status:'success',outputText:'not streamed',stream:{used:false}});
  await assert.rejects(f.workflow.draft({runId:run.id,expectedRevision:run.revision,consent:true}),/stream/i);
  assert.equal(f.applied.length,0);assert.equal((await f.workflow.get(run.id)).state,'failed');
});
test('cancelled stream keeps partial text, performs no editor action and never claims backend cancellation',async()=>{
  const f=fixture(),run=await f.workflow.start({intentionRef:'intention-4',objective:'Draft'});
  f.model.generate=async request=>{request.onToken('{"type":"edit",',{done:false});return{status:'cancelled',outputText:'{"type":"edit",',stream:{used:true}}};
  await assert.rejects(f.workflow.draft({runId:run.id,expectedRevision:run.revision,consent:true}),/cancel/i);
  const saved=await f.workflow.get(run.id);
  assert.equal(saved.state,'cancelled');assert.equal(saved.execution.backendCancellation,'unconfirmed');
  assert.equal(f.applied.length,0);assert.ok(saved.passes[0].checkpointRef);
});
test('canonical store guards stale run revisions and saves immutable document revisions with tool receipts',async()=>{
  const f=fixture();const run=await f.workflow.start({intentionRef:'intention-5',objective:'Draft'});
  await assert.rejects(f.store.commitCreationRun({run:{...run,revision:2},expectedRevision:9}),/revision/i);
  const session={id:'saved-session'},doc={id:'document:saved-session',sessionId:'saved-session',revision:1,blocks:[]};
  await f.store.commitDocumentChange({session,document:doc,content:'Original',contentDigest:'sha256:original',receipt:{id:'tool-1',action:'document.apply'}});
  await f.store.commitDocumentChange({session,document:{...doc,revision:2},content:'Edited',contentDigest:'sha256:edited',expectedRevision:1,receipt:{id:'tool-2',action:'document.apply'}});
  assert.equal((await f.store.getDocumentRevision('saved-session',1)).content,'Original');
  assert.equal((await f.store.getArtifact('tool-2')).action,'document.apply');
  await assert.rejects(f.store.commitDocumentChange({session,document:{...doc,revision:3},content:'Stale',expectedRevision:1}),/revision/i);
});

test('different runs for one document share the provider lease before a second inference can start',async()=>{
  const f=fixture(),first=await f.workflow.start({intentionRef:'intent-a',objective:'Draft'}),second=await f.workflow.start({intentionRef:'intent-b',objective:'Draft'});
  let release,entered;const started=new Promise(resolve=>{entered=resolve});
  f.model.generate=async()=>{entered();await new Promise(resolve=>{release=resolve});return{status:'cancelled',outputText:'',stream:{used:true}}};
  const running=f.workflow.draft({runId:first.id,expectedRevision:1,consent:true});await started;
  await assert.rejects(f.workflow.draft({runId:second.id,expectedRevision:1,consent:true}),/slot.*busy/i);
  release();await assert.rejects(running,/cancelled/i);
});

test('a transport throw preserves even a short partial checkpoint',async()=>{
  const f=fixture(),run=await f.workflow.start({intentionRef:'intent-failure',objective:'Draft'});
  f.model.generate=async request=>{request.onToken('unfinished but useful',{done:false});throw new Error('Network disconnected')};
  await assert.rejects(f.workflow.draft({runId:run.id,expectedRevision:1,consent:true}),/Network/);
  const saved=await f.workflow.get(run.id),checkpoint=await f.store.getArtifact(saved.passes[0].checkpointRef);
  assert.equal(checkpoint.text,'unfinished but useful');assert.equal(f.applied.length,0);
});
test('editorial edits cannot overwrite newer human document revisions',async()=>{
  const f=fixture(),run=await f.workflow.start({intentionRef:'intent-edit',objective:'Draft'});
  const draft=await f.workflow.draft({runId:run.id,expectedRevision:1,consent:true});
  f.editor.getDocumentStatus=()=>({revision:99});
  await assert.rejects(f.workflow.edit({runId:run.id,expectedRevision:draft.revision,edits:[{op:'replaceAll',blocks:[]}],summary:'Outdated edit'}),/document revision|changed/i);
  assert.equal(f.applied.length,1);
});

test('rights-confirmed source is private, hash-bound, and fully included in the exact captured stage contract',async()=>{
  const f=fixture(),text='x'.repeat(39999)+'🌿'+'  SOURCE-BEGIN\n'+'Original synthetic book content.\n'.repeat(2500)+'SOURCE-END  ';
  const source=await f.workflow.importSource({name:'Synthetic book.md',mediaType:'text/markdown',text,rights:'owned',rightsConfirmed:true});
  const saved=await f.store.getArtifact(source.id);assert.equal(saved.text,text);assert.equal(source.characters,text.length);
  assert.equal(source.text,undefined);assert.match(source.hash,/^sha256:[a-f0-9]{64}$/);
  const run=await f.workflow.start({intentionRef:'book-intent',objective:'Adapt the full source into a 30-second script.',sourceId:source.id});
  assert.deepEqual(run.sourceRef,source);assert.ok(!JSON.stringify(run).includes('Original synthetic book content.'));
  await assert.rejects(f.workflow.draft({runId:run.id,expectedRevision:1,consent:true}),/source.*consent|source.*hash/i);
  const drafted=await f.workflow.draft({runId:run.id,expectedRevision:1,consent:true,consentSourceHash:source.hash});
  assert.equal(f.calls(),1);assert.equal(drafted.state,'draft-saved');
  const messages=f.requests[0].messages;assert.equal(messages[0].content,'Adapt the full source into a 30-second script.');
  const chunks=messages.filter(message=>message.content.includes('BEGIN_UNTRUSTED_SOURCE\n')).map(message=>message.content.split('BEGIN_UNTRUSTED_SOURCE\n')[1].split('\nEND_UNTRUSTED_SOURCE')[0]);
  assert.equal(chunks.join(''),text);assert.ok(chunks.length>1);assert.ok(messages.every(message=>message.content.length<48000));assert.ok(chunks.every(chunk=>!/[\uD800-\uDBFF]$/.test(chunk)&&!/[\uDC00-\uDFFF]/.test(chunk[0])));
  const digest='sha256:'+Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(messages)))).toString('hex');
  assert.equal(run.stageContract.promptDigest,digest);assert.ok(!JSON.stringify(drafted).includes('SOURCE-BEGIN'));
});

test('source import requires declared rights, exact bounds, and saves no silent truncation',async()=>{
  const f=fixture();
  for(const invalid of [{rightsConfirmed:false},{rights:'unknown'},{text:'x'.repeat(250001)},{text:''},{mediaType:'application/pdf'}])
    await assert.rejects(f.workflow.importSource({name:'Synthetic.txt',mediaType:'text/plain',text:'Owned fictional source',rights:'owned',rightsConfirmed:true,...invalid}),/rights|source|plain|limit|250000/i);
  assert.equal(f.calls(),0);
});

test('fresh source hash verification rejects tampering before inference and preserves source references across load',async()=>{
  const f=fixture(),source=await f.workflow.importSource({name:'Test.txt',text:'A synthetic source.',mediaType:'text/plain',rights:'licensed',rightsConfirmed:true});
  const run=await f.workflow.start({intentionRef:'tamper-intent',objective:'Draft',sourceId:source.id});
  assert.deepEqual((await f.workflow.get(run.id)).sourceRef,source);
  const saved=await f.store.getArtifact(source.id);await f.store.putArtifact({...saved,text:'Altered content.'});
  await assert.rejects(f.workflow.draft({runId:run.id,expectedRevision:1,consent:true,consentSourceHash:source.hash}),/source.*hash|source.*changed/i);
  assert.equal(f.calls(),0);assert.equal(f.applied.length,0);
});

test('failed drafts preserve precise provider diagnostics without URL, key or request-body leakage',async()=>{
  const f=fixture(),run=await f.workflow.start({intentionRef:'quota-intent',objective:'Draft'});
  f.model.generate=async()=>({status:'provider-error',outputText:'',stream:{used:false},error:{code:'RESOURCE_EXHAUSTED',status:429,message:'Quota exhausted for configured model. https://provider.invalid/request?key=super-secret-key apiKey=another-secret Bearer private-token "contents":[{"text":"PRIVATE SOURCE BODY"}]'}});
  await assert.rejects(f.workflow.draft({runId:run.id,expectedRevision:1,consent:true}),error=>/RESOURCE_EXHAUSTED.*Quota exhausted/.test(error.message)&&!/(super-secret|another-secret|private-token|PRIVATE SOURCE|provider\.invalid)/.test(error.message));
  const saved=await f.workflow.get(run.id),failure=saved.passes[0];
  assert.equal(failure.errorDetail.code,'RESOURCE_EXHAUSTED');assert.equal(failure.errorDetail.status,429);
  assert.match(failure.error,/Quota exhausted/);assert.ok(!/(super-secret|another-secret|private-token|PRIVATE SOURCE|provider\.invalid)/.test(JSON.stringify(saved)));
});

test('portable creation evidence contains actual revision and tool artifacts with source metadata only',async()=>{
  const f=fixture(),source=await f.workflow.importSource({name:'Private source.txt',text:'UNPUBLISHED SOURCE MUST STAY PRIVATE',mediaType:'text/plain',rights:'owned',rightsConfirmed:true});
  const run=await f.workflow.start({intentionRef:'export-intent',objective:'Draft a synthetic scene.',sourceId:source.id});
  const drafted=await f.workflow.draft({runId:run.id,expectedRevision:1,consent:true,consentSourceHash:source.hash});
  const edited=await f.workflow.edit({runId:run.id,expectedRevision:drafted.revision,edits:[{op:'append',block:{type:'paragraph',text:'A saved editorial correction.'}}],summary:'Clarified the scene'});
  for(const [revision,content] of [[1,'Actual saved first draft'],[2,'Actual saved final revision']]){
    await f.store.putArtifact({id:`document-revision:session-1:${revision}`,schema:'civweave.creator-document-revision.v1',sessionId:'session-1',document:{sessionId:'session-1',revision,blocks:[]},content,contentDigest:`sha256:revision-${revision}`});
    await f.store.putArtifact({id:`receipt-${revision}`,schema:'civweave.creator-edit-receipt.v1',sessionId:'session-1',artifactRevision:revision,edits:[{op:'append',block:{type:'paragraph',text:content}}]});
  }
  const packet=await f.workflow.exportEvidence({runId:edited.id});
  assert.equal(packet.run.id,edited.id);assert.equal(packet.originalRevision,1);assert.equal(packet.finalRevision,2);
  assert.equal(packet.documentRevisions.length,2);assert.equal(packet.toolReceipts.length,2);
  assert.equal(packet.documentRevisions[0].content,'Actual saved first draft');assert.equal(packet.documentRevisions[1].content,'Actual saved final revision');
  assert.equal(packet.sourceBodyIncluded,false);assert.equal(packet.checkpoint,undefined);assert.deepEqual(packet.run.sourceRef,source);
  assert.ok(!JSON.stringify(packet).includes('UNPUBLISHED SOURCE MUST STAY PRIVATE'));
  const withCheckpoint=await f.workflow.exportEvidence({runId:edited.id,includeCheckpoint:true});assert.match(withCheckpoint.checkpoint.text,/original development example/);
});

test('Creator offline cache contains the exact versioned Gemini script requested by the page',()=>{
  const html=readFileSync(new URL('../public/creator-suite/index.html',import.meta.url),'utf8'),sw=readFileSync(new URL('../public/creator-suite/service-worker.js',import.meta.url),'utf8');
  const requested=html.match(/src="([^\"]*civweave-gemini-interactions-v159\.js[^\"]*)"/)?.[1];
  assert.ok(requested);assert.ok(sw.includes("'"+requested+"'"));assert.ok(!sw.includes("const CACHE='civweave-creator-suite-v16-"));
});

test('readiness delegates credential restoration without exposing secrets, invoking inference or granting consent',async()=>{
  let restored=false;const f=fixture({prepareRuntime:()=>{restored=true}});
  f.model.readSharedConfig=()=>({provider:'gemini',model:'configured-model',apiKey:restored?'REMEMBERED-SECRET':'',externalConsent:false});
  const state=await f.workflow.readiness();assert.equal(restored,true);assert.equal(state.credentialReady,true);assert.equal(state.externalConsent,false);assert.equal(state.ready,false);assert.ok(!JSON.stringify(state).includes('REMEMBERED-SECRET'));assert.equal(f.calls(),0);
  const run=await f.workflow.start({intentionRef:'readiness-intent',objective:'Draft'});
  await assert.rejects(f.workflow.draft({runId:run.id,expectedRevision:1,consent:true}),/provider consent|Settings/i);
  assert.equal(f.calls(),0);assert.equal((await f.workflow.get(run.id)).passes.length,0);
});

test('explicit retry journals bind a failed run from the same document and Intention without repeating it',async()=>{
  const f=fixture(),first=await f.workflow.start({intentionRef:'retry-intent',objective:'Draft'});
  f.model.generate=async()=>({status:'provider-error',error:{code:'MISSING_API_KEY',message:'Credential missing'},stream:{used:false}});
  await assert.rejects(f.workflow.draft({runId:first.id,expectedRevision:1,consent:true}),/Credential/);
  const retry=await f.workflow.start({intentionRef:'retry-intent',objective:'Draft',previousRunRef:first.id});
  assert.equal(retry.previousRunRef,first.id);assert.equal(retry.passes.length,0);
  const evidence=await f.workflow.exportEvidence({runId:retry.id,includeCheckpoint:true});assert.equal(evidence.priorRuns[0].id,first.id);assert.equal(evidence.priorRuns[0].state,'failed');
  await assert.rejects(f.workflow.start({intentionRef:'other-intent',objective:'Draft',previousRunRef:first.id}),/same|Intention/i);
  await assert.rejects(f.workflow.start({intentionRef:'retry-intent',objective:'Draft',previousRunRef:retry.id}),/failed|cancelled/i);
});

test('Creator evidence controls prepare exact inspectable JSON before a separate explicit download',async()=>{
  const dom=new JSDOM(readFileSync(new URL('../public/creator-suite/index.html',import.meta.url),'utf8'),{url:'https://civweave.test/creator-suite/index.html',runScripts:'outside-only'}),window=dom.window;
  const saved={id:'creation-run:ui-test',revision:5,state:'edited',artifactRef:'session-ui',artifactRevision:2,intentionRef:'intent-ui',objective:'Synthetic scene',passes:[]},packet={schema:'civweave.creation-evidence.v1',run:saved,documentRevisions:[{content:'Actual first draft'},{content:'Actual revised draft'}],toolReceipts:[{id:'receipt-ui'}],missingArtifacts:[],sourceBodyIncluded:false};
  const requests=[],downloads=[];let blobs=0;
  window.CivweaveCreatorTextV1={getSession:()=>({id:'session-ui'})};
  window.createCreationWorkflow=()=>({get:async()=>saved,exportEvidence:async options=>{requests.push(options);return packet}});
  window.creationErrorDetails=error=>({code:'TEST',message:error.message});
  window.URL.createObjectURL=()=>{blobs++;return'blob:synthetic-evidence'};window.URL.revokeObjectURL=()=>{};
  window.HTMLAnchorElement.prototype.click=function(){downloads.push({name:this.download,url:this.href})};
  try{
    window.eval(readFileSync(new URL('../public/creator-suite/creation-workflow-v1.mjs',import.meta.url),'utf8').replace(/^import[^\n]*\n/,''));
    const node=id=>window.document.getElementById(id);
    node('cs-creation-id').value=saved.id;node('cs-creation-load').click();await new Promise(setImmediate);
    node('cs-creation-export').click();await new Promise(setImmediate);
    assert.equal(requests.length,1);assert.equal(requests[0].runId,saved.id);assert.equal(requests[0].includeCheckpoint,false);
    assert.equal(node('cs-creation-evidence').textContent,JSON.stringify(packet,null,2));assert.equal(blobs,0);assert.equal(downloads.length,0);assert.equal(node('cs-creation-download').disabled,false);
    node('cs-creation-download').click();await new Promise(setImmediate);
    assert.equal(blobs,1);assert.equal(downloads.length,1);assert.equal(downloads[0].name,'creation-run-ui-test-evidence.json');
  }finally{window.close()}
});
