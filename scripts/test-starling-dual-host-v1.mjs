import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createStarlingHostTransport,validateStarlingJob,validateStarlingSchedule} from '../public/app/shared/starling-execution-transport-v1.mjs';

const job={schema:'civweave.starling-host-job.v1',jobId:'a'.repeat(32),guildId:'guild:test',personaId:'kami',model:'qwen35-4b-native',intention:'Help this Guild establish a community garden.',brief:'Create a sourced work plan.',maxTokens:440};
const token='e'.repeat(64);
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('jobs only permit known models, personas and draft actions',()=>{
  assert.deepEqual(validateStarlingJob(job).action,'draft-only');
  for(const item of [{...job,jobId:'../../etc/passwd'},{...job,model:'remote-api'},{...job,personaId:'owner'}, {...job,maxTokens:100000},{...job,brief:'x'.repeat(2000)}])
    assert.throws(()=>validateStarlingJob(item));
});
test('schedule enforces explicit local bounds and permits disable without credentials',()=>{
  const input={guildId:'g1',enabled:true,intention:job.intention,model:job.model,intervalMinutes:60,dailyLimit:4};
  assert.equal(validateStarlingSchedule(input).action,'draft-only');
  assert.equal(validateStarlingSchedule({guildId:'g1',enabled:false}).enabled,false);
  assert.throws(()=>validateStarlingSchedule({...input,intervalMinutes:1}));
  assert.throws(()=>validateStarlingSchedule({...input,dailyLimit:100}));
});
test('Termux HTTP transport only connects to fixed paired loopback origin',async()=>{
  let observed;
  const fetcher=async(url,request)=>{observed={url,request};return{ok:true,json:async()=>({state:'queued'})}};
  const client=createStarlingHostTransport({kind:'termux',token,fetcher});
  await client.submit(job);
  assert.equal(observed.url,'http://127.0.0.1:8767/v1/starling/jobs');
  assert.equal(observed.request.headers['X-Civweave-Token'],token);
  assert.equal(observed.request.credentials,'omit');
  assert.equal(JSON.parse(observed.request.body).action,'draft-only');
  await assert.rejects(()=>client.request?.('GET','https://attacker.invalid'),TypeError);
  assert.throws(()=>client.job('../secret'));
  assert.throws(()=>createStarlingHostTransport({kind:'termux',token:'invalid'}));
});
test('native port uses same envelope and correlates responses without script injection',async()=>{
  const nativePort={postMessage(value){const request=JSON.parse(value);queueMicrotask(()=>this.onmessage({data:JSON.stringify({id:request.id,ok:true,data:{state:'completed'}})}))}};
  const client=createStarlingHostTransport({kind:'android',nativePort});
  assert.equal((await client.submit(job)).state,'completed');
  assert.equal((await client.status()).state,'completed');
  assert.throws(()=>createStarlingHostTransport({kind:'android',nativePort:{}}));
});
test('termux process persists a host-only review receipt and reuses Companion inference queue',()=>{
  const src=read('public/termux/civweave_starling_host.py');
  for(const required of ['127.0.0.1:8766','127.0.0.1', '8767','pairing-token','client_key','reviewRequired','claimVerified','civweave.starling-host-job.v1','starling-host-v1.json','atomically_save'])
    assert.ok(src.includes(required),required);
  assert.doesNotMatch(src,/shell=True|os\.system\(|eval\(/);
});
test('native Android bridge is origin-scoped and work is durable',()=>{
  const bridge=read('native/android/civweave-starling-v1/src/main/java/cc/civweave/starling/StarlingNativeBridge.kt');
  const worker=read('native/android/civweave-starling-v1/src/main/java/cc/civweave/starling/StarlingNativeWorker.kt');
  for(const term of ['WebViewCompat.addWebMessageListener','isMainFrame','https://civweave-staging.pages.dev','https://civweave.cc','WorkManager','PeriodicWorkRequestBuilder','ExistingWorkPolicy.KEEP'])assert.ok(bridge.includes(term),term);
  assert.doesNotMatch(bridge,/addJavascriptInterface/);
  for(const term of ['getSharedPreferences','commit()','claimVerified','localhost','http://127.0.0.1:8080/v1/chat/completions','StarlingLocalEngine','cancelRequested'])assert.ok(worker.includes(term),term);
});
