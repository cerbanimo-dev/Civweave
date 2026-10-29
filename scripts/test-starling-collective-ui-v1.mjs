import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const source=await readFile(new URL('../public/app/starling-collective-v1.js',import.meta.url),'utf8').catch(()=> '');
const guildQuestSource=await readFile(new URL('../public/app/guild-quest-client-v1.js',import.meta.url),'utf8');
const key='civweave.starling-collective.v1';
const intention='Create a useful local Guild event checklist using existing skills and tools.';
const plan={title:'Local event checklist',wish:intention,outcome:'A saved and inspected event checklist',assumptions:['Guild capacity is unknown; ask before assigning people.'],paths:[{type:'skilled-labor',realm:'cerbanimo',title:'Write and inspect the checklist',purpose:'Produce the actual checklist',steps:['Write the checklist','Reopen and inspect it'],completionCriteria:'The saved checklist can be reopened and meets the intention.',evidence:['Saved text and reopen observation']}]};
const brief={summary:'Keep the checklist achievable with known capacity.',risks:['Unknown Guild skills need confirmation.'],nextActions:['Write and inspect the local checklist.']};
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));

function fixture({runtime,locks=true,ledger,passport='AC-FIXTURE',transport,storage}={}){
  const dom=new JSDOM('<!doctype html><html><body><main id="mount"></main></body></html>',{url:'https://civweave.test/app/persistent-system-shell-v1.html',runScripts:'outside-only'}),w=dom.window,calls=[];
  w.structuredClone=structuredClone;w.AbortController=AbortController;
  const queues=new Map();
  if(locks)Object.defineProperty(w.navigator,'locks',{value:{request:(name,_options,fn)=>{const queued=queues.get(name)||Promise.resolve(),result=queued.then(fn,fn);queues.set(name,result.catch(()=>{}));return result}}});
  w.CivweavePassportIdentityV1={snapshot:()=>({passportId:passport})};
  w.CivweaveCanonicalRewardsV2=ledger;
  w.CivweaveModelRuntime={readSharedConfig:()=>({provider:'ollama',model:'qwen3.5:4b',stream:true}),generate:async request=>{calls.push(request);return runtime?runtime(request,calls.length):{status:'success',structured:{valid:true},outputJson:request.purpose.endsWith('synthesis')?structuredClone(plan):structuredClone(brief),actual:{provider:'ollama',model:'qwen3.5:4b'},usage:{promptTokens:10,completionTokens:20}}}};
  if(storage)Object.defineProperty(w,'localStorage',{value:storage});
  w.eval(guildQuestSource);w.eval(source);const api=w.CivweaveStarlingCollectiveV1;assert.ok(api,'Starling owner must be installed');
  if(transport)api.configure({guildTransport:transport});
  api.mount({container:w.document.querySelector('#mount')});
  return{w,api,calls,close:()=>w.close()};
}

test('mount is dormant and all four dropdown examples only prefill editable intentions',()=>{
  const f=fixture();try{
    const select=f.w.document.querySelector('[data-starling-example]');assert.equal(select.options.length,5);
    for(const option of [...select.options].slice(1)){select.value=option.value;select.dispatchEvent(new f.w.Event('change',{bubbles:true}));assert.ok(f.w.document.querySelector('[data-starling-intention]').value.length>30)}
    assert.equal(f.calls.length,0);assert.equal(f.api.read().lines.length,0);
    assert.match(f.w.document.body.textContent,/Passport|Hero count|skills/);
  }finally{f.close()}
});

test('three sequential public roles record actual model provenance and leave a proposal awaiting review',async()=>{
  const f=fixture();try{
    const line=await f.api.runLine({intention});assert.equal(f.calls.length,3);
    assert.equal(line.state,'review');assert.equal(line.events.filter(e=>e.kind==='output').length,3);
    assert.deepEqual([...line.events.filter(e=>e.kind==='output').map(e=>e.role)],['Rosa · feasibility','Sana · review','Kami · synthesis']);
    assert.ok(line.events.filter(e=>e.kind==='output').every(e=>e.actual.model==='qwen3.5:4b'&&e.usage.completionTokens===20));
    assert.equal(line.proposal.title,plan.title);assert.equal(line.questId,undefined);
    assert.ok(f.calls.every(r=>r.think===false&&r.maxRepairAttempts===0&&r.signal));
    assert.match(f.w.document.body.textContent,/No Quest is activated|Awaiting your review/);
    assert.equal(JSON.parse(f.w.localStorage.getItem(key)).lines.length,1);
  }finally{f.close()}
});

test('local reservations hard-cap concurrent creation at three before any inference',async()=>{
  let resolve;const gate=new Promise(r=>resolve=r);const f=fixture({runtime:async(_r,n)=>{if(n<=3)await gate;return{status:'success',outputJson:structuredClone(brief),actual:{provider:'ollama',model:'qwen3.5:4b'}}}});
  try{
    const runs=[0,1,2,3].map(n=>f.api.runLine({intention:intention+n,creationMode:'autonomous'}).then(()=>null,e=>e));await flush();await flush();
    assert.equal(f.api.read().lines.length,3);assert.equal(f.calls.length,1);resolve();const results=await Promise.all(runs);
    assert.match(results[3].message,/three|3 active/i);assert.equal(f.api.read().lines.length,3);
  }finally{f.close()}
});

test('abandoning releases a slot but never refunds the six-per-rolling-day creation allowance',async()=>{
  const f=fixture();try{
    for(let n=0;n<6;n++){const line=await f.api.runLine({intention:intention+n,creationMode:'autonomous'});await f.api.abandon(line.id)}
    assert.equal(f.api.read().limits.active,0);assert.equal(f.api.read().limits.createdInWindow,6);
    await assert.rejects(f.api.runLine({intention,creationMode:'autonomous'}),/rolling|24 hours/i);assert.equal(f.calls.length,18);
  }finally{f.close()}
});

test('old creation timestamps expire by rolling age; active slots do not expire',async()=>{
  const f=fixture();try{
    const expired=new Date(Date.now()-25*60*60*1000).toISOString();
    f.w.localStorage.setItem(key,JSON.stringify({schema:'civweave.starling-collective.v1',revision:1,lines:[{id:'old',intention,state:'failed',createdAt:expired,creationMode:'autonomous',events:[]}],creations:[{id:'old',at:expired,creationMode:'autonomous'}]}));
    assert.equal(f.api.read().limits.active,1);assert.equal(f.api.read().limits.createdInWindow,0);
  }finally{f.close()}
});

test('failure and cancellation remain visible and require abandonment before releasing slots',async()=>{
  const f=fixture({runtime:async()=>({status:'provider-error',error:{message:'Fixture offline'},actual:{provider:'ollama',model:'qwen3.5:4b'}})});try{
    await assert.rejects(f.api.runLine({intention}),/Fixture offline/);const line=f.api.read().lines[0];
    assert.equal(line.state,'failed');assert.equal(f.api.read().limits.active,0);assert.match(line.error,/Fixture offline/);
    await f.api.abandon(line.id);assert.equal(f.api.read().limits.active,0);
  }finally{f.close()}
  const c=fixture({runtime:r=>new Promise((_resolve,reject)=>r.signal.addEventListener('abort',()=>reject(new DOMException('Stopped','AbortError')),{once:true}))});try{
    const running=c.api.runLine({intention});await flush();c.api.cancel();await assert.rejects(running,/Stopped|cancel/i);assert.equal(c.api.read().lines[0].state,'cancelled');assert.equal(c.api.read().limits.active,0);
  }finally{c.close()}
});

test('storage failure or missing cross-tab lock prevents inference and cannot mint a phantom line',async()=>{
  const f=fixture({storage:{getItem:()=>null,setItem:()=>{throw new Error('blocked')}}});try{await assert.rejects(f.api.runLine({intention}),/storage|save/i);assert.equal(f.calls.length,0)}finally{f.close()}
  const g=fixture({locks:false});try{await assert.rejects(g.api.runLine({intention}),/lock|browser/i);assert.equal(g.calls.length,0)}finally{g.close()}
});

test('only the current Passport account contributes local skills; Guild roster remains unknown',()=>{
  const seen=[];const f=fixture({ledger:{project:(_unused,{accountId})=>{seen.push(accountId);return{skills:{documentation:{skillId:'documentation',name:'Documentation',xp:40}}}}}});try{
    f.w.document.documentElement.dataset.passportAccountId='account:current';const c=f.api.context();
    assert.equal(c.passport.passportId,'AC-FIXTURE');assert.equal(c.passport.accountId,'account:current');assert.equal(c.passport.skills[0].xp,40);
    assert.equal(c.guild.heroCount,null);assert.match(c.guild.status,/unknown/i);assert.ok(seen.every(id=>id==='passport:local'||id==='account:current'));
  }finally{f.close()}
});

test('configured Guild transport is never touched by local planning or opening the workbench',async()=>{
  const calls=[];const transport={read:async()=>{calls.push('read');return{}},reserve:async()=>{calls.push('reserve');return{}},propose:async()=>calls.push('propose'),confirm:async()=>calls.push('confirm'),abandon:async()=>calls.push('abandon')};const f=fixture({transport});try{
    f.api.open();await f.api.runLine({intention});assert.deepEqual(calls,[]);
  }finally{f.close()}
});

test('Guild mode requires explicit connection and intention-sharing consent',async()=>{
  const seen=[];const f=fixture({transport:{read:async()=>{seen.push('read');return{guildId:'fixture-guild',context:{heroCount:4,source:'authenticated-passport-roster',skills:[]}}},reserve:async p=>{seen.push(p);return{line:{id:'shared-one',revision:1}}}}});try{
    await assert.rejects(f.api.runLine({intention,scope:'guild',shareIntention:true}),/connect/i);assert.equal(seen.length,0);
    await f.api.connectGuild();await assert.rejects(f.api.runLine({intention,scope:'guild'}),/consent|sharing/i);
    const line=await f.api.runLine({intention,scope:'guild',shareIntention:true});assert.equal(line.scope,'guild');assert.equal(seen.length,2);assert.equal(seen[1].intention,intention);
  }finally{f.close()}
});

test('remote substitution, fallback, malformed synthesis and model completion claims cannot complete a line',async()=>{
  for(const runtime of [async()=>({status:'fallback',outputJson:brief,actual:{provider:'deterministic',model:'fixture'}}),async()=>({status:'success',outputJson:brief,actual:{provider:'hosted',model:'other'}})]){
    const f=fixture({runtime});try{await assert.rejects(f.api.runLine({intention}),/selected|fallback|provider/i);assert.equal(f.api.read().lines[0].state,'failed')}finally{f.close()}
  }
  const f=fixture({runtime:async(_r,n)=>({status:'success',outputJson:n===3?{...plan,state:'completed',paths:[]}:brief,actual:{provider:'ollama',model:'qwen3.5:4b'}})});try{await assert.rejects(f.api.runLine({intention}),/path|incomplete|schema/i);assert.equal(f.api.read().lines[0].state,'failed');assert.equal(f.api.complete,undefined)}finally{f.close()}
});

test('reviewed import delegates to canonical Quest owners and never activates or posts',async()=>{
  const f=fixture();try{
    const line=await f.api.runLine({intention}),seen=[];let saved=[];
    f.w.CivweaveWeavelingPlanJsonV190={normalizePlan:(raw,args)=>{seen.push(['normalize',args]);return{...raw,id:'canonical-fixture',schema:'civweave.intention-weave.v1',state:'review',authoring:{aiGenerated:true}}}};
    f.w.CivweaveIntentionPlanner={persist:p=>{seen.push(['persist',p]);saved=[{id:p.id,kind:'weave-plan',state:'review',plan:p}];f.w.localStorage.setItem('civweave.intentions.v127',JSON.stringify(saved));return saved[0]}};
    f.w.CivweaveWeavelingPlanMaterializationV265={materialize:()=>seen.push(['materialize'])};
    const imported=await f.api.importQuest(line.id,{reviewed:true});assert.equal(imported.questId,'canonical-fixture');assert.equal(imported.state,'active');assert.equal(saved[0].state,'review');assert.equal(seen.filter(x=>x[0]==='persist').length,1);
    await f.api.importQuest(line.id,{reviewed:true});assert.equal(seen.filter(x=>x[0]==='persist').length,1);
    assert.equal(f.api.read().limits.active,0);
  }finally{f.close()}
});

test('completion requires a matching canonical persisted Quest and completed proof projection',async()=>{
  const f=fixture();try{
    const line=await f.api.runLine({intention});
    f.w.dispatchEvent(new f.w.CustomEvent('civweave:proof-progress-synced',{detail:{planId:'fake',state:'completed'}}));await flush();assert.equal(f.api.read().lines[0].state,'review');
    await assert.rejects(f.api.importQuest(line.id,{reviewed:false}),/review/i);
  }finally{f.close()}
});

test('shared posting stays behind an exact preview hash and final explicit confirmation',async()=>{
  let posts=0;const f=fixture({transport:{read:async()=>({guildId:'fixture-guild'}),reserve:async()=>({line:{id:'shared-one',revision:1}}),propose:async p=>({line:{id:'shared-one',revision:2,proposalHash:'fixture-hash',proposal:p.quest}}),confirm:async p=>{posts++;assert.equal(p.proposalHash,'fixture-hash');assert.equal(p.confirmed,true);return{publication:{id:'fixture-pub'}}}}});try{
    await f.api.connectGuild();const line=await f.api.runLine({intention,scope:'guild',shareIntention:true});
    f.w.CivweaveWeavelingPlanJsonV190={normalizePlan:raw=>({...raw,id:'canonical-fixture',schema:'civweave.intention-weave.v1',state:'review'})};f.w.CivweaveIntentionPlanner={persist:plan=>{const item={id:plan.id,kind:'weave-plan',state:'review',plan};f.w.localStorage.setItem('civweave.intentions.v127',JSON.stringify([item]));return item}};
    await f.api.importQuest(line.id,{reviewed:true});const preview=await f.api.prepareGuildPost(line.id);assert.equal(posts,0);
    await assert.rejects(f.api.confirmGuildPost(line.id,{proposalHash:'wrong',confirmed:true}),/preview|changed/i);assert.equal(posts,0);
    await assert.rejects(f.api.confirmGuildPost(line.id,{proposalHash:preview.proposalHash}),/confirm/i);assert.equal(posts,0);
    await f.api.confirmGuildPost(line.id,{proposalHash:preview.proposalHash,confirmed:true});assert.equal(posts,1);
  }finally{f.close()}
});

test('Guild capacity includes opt-in Passport skill claims without calling them a verified human roster',async()=>{
 const f=fixture({transport:{read:async()=>({guildId:'fixture-guild',memberUserId:'member:a',context:{heroCount:null,knownMemberCount:3,reportedPassportHeroes:2,skillsCoverage:'consenting-member-claims-only',passports:[{passportId:'AC-ALICE',skillsKnown:true,updatedAt:'2026-10-28T00:00:00Z',skills:[{skillId:'repair',name:'Repair',xp:12}]},{passportId:'AC-BOBBY',skillsKnown:true,updatedAt:'2026-10-28T00:00:00Z',skills:[{skillId:'repair',name:'Repair',xp:22}]}]}})}});
 try{await f.api.connectGuild();const c=f.api.context().guild;assert.equal(c.heroCount,null);assert.equal(c.reportedPassportHeroes,2);assert.equal(c.knownMemberCount,3);assert.equal(c.skills[0].reportedHeroes,2);assert.match(f.w.document.body.textContent,/unverified|Not verified/);}finally{f.close()}
});

test('sharing Passport skills posts only the exact reviewed snapshot and rejects changes after preview',async()=>{
 let xp=12,posts=0;const f=fixture({ledger:{project:()=>({skills:{repair:{skillId:'repair',name:'Repair',xp}}})},transport:{read:async()=>({guildId:'fixture-guild'}),passport:async()=>{posts++;return{ok:true}}}});
 try{await f.api.connectGuild();const preview=f.api.passportSharePreview();xp=25;await assert.rejects(f.api.sharePassport({confirmed:true,preview}),/changed|preview/i);assert.equal(posts,0);await f.api.sharePassport({confirmed:true,preview:f.api.passportSharePreview()});assert.equal(posts,1);}finally{f.close()}
});

test('local completion releases a slot only after corroborated native proof for the same imported Quest',async()=>{
 const f=fixture();try{
  const line=await f.api.runLine({intention});let complete=false;
  f.w.CivweaveWeavelingPlanJsonV190={normalizePlan:raw=>({...raw,id:'canonical-completion',schema:'civweave.intention-weave.v1',state:'review'})};
  f.w.CivweaveIntentionPlanner={persist:plan=>{const item={id:plan.id,kind:'weave-plan',state:'review',plan};f.w.localStorage.setItem('civweave.intentions.v127',JSON.stringify([item]));return item}};
  f.w.CivweaveProofProgressV158={planCompletion:id=>({planId:id,complete})};await f.api.importQuest(line.id,{reviewed:true});
  const rows=JSON.parse(f.w.localStorage.getItem('civweave.intentions.v127'));rows[0].state=rows[0].plan.state='completed';for(const p of rows[0].plan.paths)p.status='completed';f.w.localStorage.setItem('civweave.intentions.v127',JSON.stringify(rows));
  await f.api.syncCompletion();assert.equal(f.api.read().limits.active,1);complete=true;await f.api.syncCompletion();assert.equal(f.api.read().limits.active,0);assert.equal(f.api.read().lines[0].state,'completed');
 }finally{f.close()}
});

test('the selected Settings deadline governs all three local turns',async()=>{
 const f=fixture();try{f.w.CivweaveSettingsV320={readState:()=>({provider:'ollama',model:'qwen3.5:4b',timeoutSeconds:600})};await f.api.runLine({intention});assert.ok(f.calls.every(call=>call.config.timeoutMs===600000));}finally{f.close()}
});

test('Settings metadata retains same-route runtime credentials and maps explicit remote consent without saving secrets',async()=>{
 const f=fixture();try{
  const key='fictional-test-session-key';
  f.w.CivweaveModelRuntime.readSharedConfig=()=>({provider:'ollama',model:'qwen3.5:4b',endpoint:'https://model.example.test/api/chat',apiKey:key,externalConsent:false});
  f.w.CivweaveSettingsV320={readState:()=>({provider:'ollama',route:'ollama',model:'qwen3.5:4b',endpoint:'https://model.example.test/api/chat',apiKey:'',hasKey:true,consent:true,timeoutSeconds:240})};
  await f.api.runLine({intention});
  assert.ok(f.calls.every(call=>call.config.apiKey===key));
  assert.ok(f.calls.every(call=>call.config.externalConsent===true&&call.config.timeoutMs===240000));
  assert.doesNotMatch(f.w.localStorage.getItem('civweave.starling-collective.v1'),/fictional-test-session-key|apiKey/);
  assert.doesNotMatch(f.w.document.body.textContent,/fictional-test-session-key/);
  f.w.CivweaveSettingsV320.readState=()=>({provider:'ollama',model:'qwen3.5:4b',endpoint:'https://other.example.test/api/chat',apiKey:'',consent:false,timeoutSeconds:240});
  await f.api.runLine({intention:intention+' A second scoped draft.'});
  assert.ok(f.calls.slice(3).every(call=>!call.config.apiKey&&call.config.externalConsent===false),'a changed endpoint cannot borrow the previous credential or consent');
 }finally{f.close()}
});

test('planning snapshots summarize a large Guild while the inspected roster remains available in the interface',async()=>{
 const passports=Array.from({length:28},(_,n)=>({passportId:`AC-LARGE-${n}`,skillsKnown:true,skills:Array.from({length:64},(_,i)=>({skillId:`guild-skill-${n}-${i}`,name:`Guild skill ${n}-${i} `+'x'.repeat(100),xp:20+i}))}));
 const intentions=Array.from({length:40},()=>({text:'Unrelated historical proposal '.repeat(130),state:'proposed'}));
 const ledger={project:()=>({skills:Object.fromEntries(Array.from({length:64},(_,i)=>['local-'+i,{skillId:'local-'+i,name:'Local capability '+i,xp:i+1}]))})};
 const f=fixture({ledger,transport:{read:async()=>({guildId:'fixture-guild',context:{heroCount:null,knownMemberCount:28,reportedPassportHeroes:28,passports,intentions,skillsCoverage:'consenting-member-claims-only'}}),reserve:async()=>({line:{id:'fixture-reservation',revision:1}})}});
 try{
  await f.api.connectGuild();const line=await f.api.runLine({intention,scope:'guild',shareIntention:true});
  for(const call of f.calls){
   const capacity=JSON.parse(call.messages.at(-1).content).capacity;
   assert.equal(capacity.guild.knownMemberCount,28);assert.equal(capacity.guild.reportedPassportHeroes,28);assert.equal(capacity.guild.heroCount,null);
   assert.ok(capacity.guild.skills.length<=24&&capacity.passport.skills.length<=16);
   assert.equal(capacity.guild.profiles,undefined);assert.equal(capacity.guild.intentionProposals,undefined);
   assert.ok(capacity.guild.omittedSkillKinds>0);assert.ok(capacity.guild.omittedIntentionProposals>0);
   assert.ok(JSON.stringify(capacity).length<14000,'the bounded capacity snapshot must fit a small local-model prompt');
   assert.doesNotMatch(JSON.stringify(capacity),/AC-LARGE-|Unrelated historical proposal/);
  }
  assert.equal(line.context.guild.profiles,undefined);assert.ok(JSON.stringify(line.context).length<14000);
  assert.equal(f.api.context().guild.profiles.length,28);assert.equal(f.api.context().guild.intentionProposals.length,40);
  assert.match(f.w.document.body.textContent,/AC-LARGE-0/);
 }finally{f.close()}
});


test('unreachable local model prevents new Quest-line reservation or creation',async()=>{
 const f=fixture();
 try{
  f.w.CivweaveModelRuntime.readSharedConfig=()=>({provider:'openai-compatible',model:'qwen35-4b-native',endpoint:'http://127.0.0.1:8080/v1',timeoutMs:90000});
  f.w.CivweaveModelRuntime.endpointLeavesDevice=()=>false;
  f.w.CivweaveModelRuntime.detectCapabilities=async()=>({available:false,probe:'network',notes:['Failed to fetch']});
  await assert.rejects(f.api.runLine({intention}),/unreachable|connect|server|Settings/i);
  assert.equal(f.api.read().lines.length,0);
  assert.equal(f.api.read().limits.createdInWindow,0);
  assert.equal(f.calls.length,0);
 }finally{f.close()}
});

test('responsive local inference receives a longer planning deadline with unchanged authentication and provenance',async()=>{
 const f=fixture();
 try{
  let probes=0;
  f.w.CivweaveModelRuntime.readSharedConfig=()=>({provider:'openai-compatible',model:'qwen35-4b-native',endpoint:'http://127.0.0.1:8080/v1',timeoutMs:90000});
  f.w.CivweaveModelRuntime.endpointLeavesDevice=()=>false;
  f.w.CivweaveModelRuntime.detectCapabilities=async()=>{probes++;return {available:true,probe:'network'}};
  f.w.CivweaveModelRuntime.generate=async request=>{
    f.calls.push(request);
    return{status:'success',structured:{valid:true},outputJson:request.purpose.endsWith('synthesis')?structuredClone(plan):structuredClone(brief),actual:{provider:'openai-compatible',model:'qwen35-4b-native'},usage:{completionTokens:40}};
  };
  const line=await f.api.runLine({intention});
  assert.equal(line.state,'review');
  assert.equal(probes,1);
  assert.equal(f.calls.length,3);
  assert.ok(f.calls.every(request=>request.config.timeoutMs>=900000));
  assert.ok(f.calls.every(request=>request.config.model==='qwen35-4b-native'));
 }finally{f.close()}
});

test('unlimited manual planning is independent of autonomous active slots and rolling allowance',async()=>{
 const f=fixture();try{
  for(let n=0;n<8;n++){const line=await f.api.runLine({intention:intention+' manually requested '+n});assert.equal(line.creationMode,'manual')}
  assert.equal(f.calls.length,24);
  assert.equal(f.api.read().limits.active,0);
  assert.equal(f.api.read().limits.createdInWindow,0);
  assert.equal(f.api.read().limits.manualUnlimited,true);
 }finally{f.close()}
});
