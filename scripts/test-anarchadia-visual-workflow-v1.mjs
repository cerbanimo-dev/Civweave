import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read=file=>readFileSync(new URL(`../public/app/${file}`,import.meta.url),'utf8');
const key='civweave.anarchadia.citizen-console.v139';
const html=read('anarchadia-console-v139.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
const blankVault=()=>({schema:'civweave.anarchadia-governance.v145',changeSets:[],ballots:[],executionPackets:[],authorizations:[]});
const request=(id,extra={})=>({id,title:`Request ${id}`,status:'review',stage:'intake',approval:{state:'review'},pipeline:[],acceptance:[],...extra});

async function fixture(t,{proposals=[],ledger=[],vault=null,error=false,scene=false,actualScene=false,lud=false}={}){
  const dom=new JSDOM(html,{url:'https://civweave.test/app/anarchadia-console-v139.html?cabinet=1&embed=1&persistentShell=1',runScripts:'outside-only'}),{window}=dom;
  t.after(()=>window.close());
  const frames=[],sceneCalls=[];let loads=0;
  window.requestAnimationFrame=callback=>{frames.push(callback);return frames.length};window.scrollTo=()=>{};
  window.__qaGovernanceStore={loadGovernanceState:async()=>{loads++;if(error)throw new Error('Vault unavailable');return vault}};
  if(actualScene){window.matchMedia=()=>({matches:false});window.eval(read('shared/guide-outcome-scene-v1.js'))}
  if(lud)window.CivweaveLudModeV1={isEnabled:()=>true};
  if(scene)window.CivweaveGuideOutcomeSceneV1={render:spec=>{sceneCalls.push(spec);return '<section data-qa-outcome>Receipt scene</section>'},bind:()=>{},preserve:()=>{}};
  window.localStorage.setItem(key,JSON.stringify({schema:'civweave.anarchadia-console.v1',passportId:'QA',proposals,ledger,settings:{autoRun:false}}));
  const before=window.localStorage.getItem(key);
  // Substitute only the canonical vault read at the module boundary. All DOM,
  // classification, escaping, controls, and receipt selection are real source.
  const source=read('anarchadia-console-v158.js').replace("import('./anarchadia-governance-store-v145.js')",'Promise.resolve(globalThis.__qaGovernanceStore)');
  window.eval(source);
  const flush=async()=>{for(let pass=0;pass<12;pass++){await Promise.resolve();while(frames.length)frames.shift()(0)}};
  await flush();
  return{window,flush,before,loads:()=>loads,sceneCalls,flow:()=>window.document.querySelector('#ac-civic-flow'),stored:()=>window.localStorage.getItem(key)};
}

test('empty civic map uses real zero states, without claiming participation or readiness',async t=>{
  const env=await fixture(t),flow=env.flow();assert.ok(flow,'home exposes its civic work map');
  assert.equal(flow.querySelectorAll('[data-civic-stage]').length,6);
  for(const stage of flow.querySelectorAll('[data-civic-stage]'))assert.equal(stage.querySelector('[data-civic-count]').textContent,'0');
  assert.match(flow.textContent,/No requests yet/);assert.match(flow.textContent,/No ballots/);assert.match(flow.textContent,/Prepared packets/);
  assert.doesNotMatch(flow.textContent,/100%|PARTICIPATION|1 citizen/i);assert.equal(env.stored(),env.before,'rendering never writes authority or request state');assert.equal(env.loads(),1);
});

test('local preview decisions and support cannot become governance outcomes',async t=>{
  const env=await fixture(t,{proposals:[request('draft',{status:'draft'}),request('review'),request('blocked',{status:'blocked'}),request('failed',{status:'failed'}),request('ready',{status:'preview-ready',preview:{srcdoc:'<p>Candidate</p>'}}),request('kept',{status:'preview-accepted',preview:{srcdoc:'<p>Kept</p>'},previewDecision:{state:'accepted',at:'2026-10-27T12:00:00Z'},voteSignal:true})]}),flow=env.flow();
  assert.equal(flow.querySelector('[data-civic-stage="requests"] [data-civic-count]').textContent,'6');
  assert.equal(flow.querySelector('[data-civic-stage="review"] [data-civic-count]').textContent,'4');
  assert.equal(flow.querySelector('[data-civic-stage="previews"] [data-civic-count]').textContent,'2');
  for(const stage of ['ballots','decisions','execution'])assert.equal(flow.querySelector(`[data-civic-stage="${stage}"] [data-civic-count]`).textContent,'0');
  assert.match(flow.textContent,/2 blocked or failed/);assert.match(flow.textContent,/1 kept/);assert.match(flow.textContent,/separate/);
});

test('vault counts distinguish open ballots, recorded decisions, and prepared packets',async t=>{
  const vault={...blankVault(),changeSets:[{id:'c1'},{id:'c2'}],ballots:[{id:'open',status:'open'},{id:'yes',status:'closed',outcome:{outcome:'adopted'}},{id:'no',status:'closed',outcome:{outcome:'not-adopted'}},{id:'quorum',status:'closed',outcome:{outcome:'no-quorum'}}],executionPackets:[{id:'packet'}]};
  const env=await fixture(t,{vault}),flow=env.flow();
  assert.equal(flow.querySelector('[data-civic-stage="ballots"] [data-civic-count]').textContent,'1');assert.equal(flow.querySelector('[data-civic-stage="decisions"] [data-civic-count]').textContent,'3');assert.equal(flow.querySelector('[data-civic-stage="execution"] [data-civic-count]').textContent,'1');
  assert.match(flow.textContent,/1 adopted/);assert.match(flow.textContent,/1 not adopted/);assert.match(flow.textContent,/1 no quorum/);assert.match(flow.textContent,/2 governed changes/);assert.doesNotMatch(flow.textContent,/1 executed|1 published/);
  for(const view of ['changes','ballots','federation','execution'])assert.ok(flow.querySelector(`[data-ag145-view="${view}"]`),`direct ${view} uses the existing native navigation owner`);
});

test('an unreadable governance vault remains unknown and supports an explicit bounded retry',async t=>{
  const env=await fixture(t,{error:true}),flow=env.flow();
  for(const stage of ['ballots','decisions','execution'])assert.equal(flow.querySelector(`[data-civic-stage="${stage}"] [data-civic-count]`).textContent,'—');
  assert.match(flow.textContent,/Governance vault unavailable/);
  flow.querySelector('[data-civic-refresh]').click();await env.flush();assert.equal(env.loads(),2,'one explicit retry makes one vault read');assert.equal(env.stored(),env.before);
});

test('quick controls navigate without approving, generating, voting, or altering requests',async t=>{
  const env=await fixture(t,{proposals:[request('existing')]}),flow=env.flow();
  flow.querySelector('[data-screen-target="proposals"]').click();await env.flush();assert.equal(env.window.document.querySelector('#ac-app').dataset.screen,'proposals');assert.equal(flow.hidden,true);assert.equal(env.stored(),env.before);
  env.window.AnarchadiaCitizenConsoleV158.setScreen('home');await env.flush();assert.equal(flow.hidden,false);assert.equal(env.loads(),1,'ordinary rendering does not poll the vault');
  flow.querySelector('[data-request-kind="feature"]').click();await env.flush();assert.equal(env.window.document.querySelector('#ac-app').dataset.screen,'request');assert.equal(env.stored(),env.before);
});

test('receipt scenes require a matching persisted preview decision and remain local in scope',async t=>{
  const at='2026-10-27T12:00:00Z',env=await fixture(t,{scene:true,proposals:[request('kept',{status:'preview-accepted',previewDecision:{state:'accepted',at}})],ledger:[{id:'receipt-kept',kind:'preview-kept',time:at,proposalId:'kept',detail:'Candidate retained.'}]});
  assert.ok(env.sceneCalls.length>0);for(const spec of env.sceneCalls){assert.equal(spec.guide,'anarchadia');assert.equal(spec.outcome,'accepted');assert.equal(spec.receiptId,'receipt-kept');assert.equal(spec.scope,'Device-local preview decision');assert.equal(spec.fresh,false);assert.match(spec.label,/Preview kept/)}
});

test('stale or unrelated receipt rows cannot manufacture a successful review scene',async t=>{
  const env=await fixture(t,{scene:true,proposals:[request('new-review')],ledger:[{id:'missing',kind:'preview-kept',proposalId:'missing'},{id:'wrong',kind:'preview-kept',proposalId:'new-review'},{id:'rail',kind:'proposal-blocked',proposalId:'new-review'}]});assert.equal(env.sceneCalls.length,0);
});

test('a reverted preview produces revision feedback without implying a failed ballot',async t=>{
  const at='2026-10-27T12:00:00Z',env=await fixture(t,{scene:true,proposals:[request('returned',{previewDecision:{state:'reverted',at}})],ledger:[{id:'receipt-reverted',kind:'preview-reverted',time:at,proposalId:'returned'}]});
  assert.ok(env.sceneCalls.length>0);assert.equal(env.sceneCalls.at(-1).outcome,'revision');assert.match(env.sceneCalls.at(-1).label,/returned for changes/);
  env.window.AnarchadiaCitizenConsoleV158.setScreen('automation');await env.flush();assert.equal(env.window.document.querySelector('#ac-civic-outcome').hidden,false,'feedback remains visible after Keep/Revert closes the preview');
});

for(const action of ['selectPreview','revertPreview']){
  test(`${action} marks a fresh outcome only after its real receipt was persisted`,async t=>{
    const env=await fixture(t,{proposals:[request('candidate',{status:'preview-ready',preview:{srcdoc:'<p>Candidate</p>'}})]}),calls=[];
    env.window.HTMLDialogElement.prototype.close=function(){this.open=false};
    env.window.CivweaveGuideOutcomeSceneV1={markFresh:id=>{const persisted=JSON.parse(env.stored()).ledger.find(row=>row.id===id);assert.ok(persisted,'animation cannot precede persistence');calls.push(persisted)}};
    env.window.eval(read('anarchadia-change-review-v165.js'));
    env.window.AnarchadiaChangeReviewV165[action]('candidate');
    assert.equal(calls.length,1);assert.equal(calls[0].kind,action==='selectPreview'?'preview-kept':'preview-reverted');
    await env.flush();assert.equal(calls.length,1,'rendering or reloading a decision never marks it fresh again');
  });
}

test('actual shared Merlin scene survives vault refresh, and motion controls cannot change the decision',async t=>{
  const env=await fixture(t,{actualScene:true,proposals:[request('candidate',{status:'preview-ready',preview:{srcdoc:'<p>Candidate</p>'}})]});
  env.window.HTMLDialogElement.prototype.close=function(){this.open=false};env.window.eval(read('anarchadia-change-review-v165.js'));
  env.window.AnarchadiaChangeReviewV165.selectPreview('candidate');await env.flush();
  const host=env.window.document.querySelector('#ac-civic-outcome'),scene=host.querySelector('[data-guide-outcome]'),decision=env.stored();
  assert.equal(scene.dataset.playing,'true');assert.match(host.textContent,/Preview kept/);assert.equal(scene.dataset.guide,'anarchadia');
  env.flow().querySelector('[data-civic-refresh]').click();await env.flush();assert.equal(host.querySelector('[data-guide-outcome]'),scene,'vault refresh preserves the exact ongoing scene');
  host.querySelector('[data-guide-scene-action="stop"]').click();assert.equal(scene.dataset.playing,'false');
  env.window.AnarchadiaCitizenConsoleV158.render();await env.flush();assert.equal(host.querySelector('[data-guide-outcome]'),scene);assert.equal(scene.dataset.playing,'false');
  host.querySelector('[data-guide-scene-action="replay"]').click();assert.equal(scene.dataset.playing,'true');assert.equal(env.stored(),decision);
});

test('a saved Merlin receipt is still on reopen, and Lud keeps the outcome without sprite art',async t=>{
  const at='2026-10-27T12:00:00Z',options={actualScene:true,proposals:[request('kept',{previewDecision:{state:'accepted',at}})],ledger:[{id:'saved',kind:'preview-kept',time:at,proposalId:'kept'}]};
  const standard=await fixture(t,options),scene=standard.window.document.querySelector('[data-guide-outcome]');assert.equal(scene.dataset.playing,'false');assert.ok(scene.querySelector('[data-guide-sprite]'));
  const lud=await fixture(t,{...options,lud:true}),plain=lud.window.document.querySelector('[data-guide-outcome]');assert.match(plain.textContent,/Preview kept/);assert.equal(plain.querySelector('[data-guide-sprite],[data-lari-sprite],button'),null);
});

test('civic flow escapes stored titles and never mounts submitted preview markup',async t=>{
  const env=await fixture(t,{proposals:[request('unsafe',{title:'<img src=x onerror="alert(1)">',preview:{srcdoc:'<script>evil()</script>'},status:'preview-ready'})]});assert.equal(env.flow().querySelectorAll('img,script,iframe').length,0);assert.match(env.flow().textContent,/<img src=x/);
});

for(const hash of ['ballots','changes','execution','federation','identity','unknown']){
  test(`Governance initial #${hash} opens only an allowlisted read view`,async t=>{
    const dom=new JSDOM(read('anarchadia-governance-v145.html'),{url:`https://civweave.test/app/anarchadia-governance-v145.html#${hash}`,runScripts:'outside-only'}),{window}=dom;t.after(()=>window.close());
    const empty={...blankVault(),credentials:[],groups:[],consents:[],dissents:[],trustedNodes:[],nodeOutcomes:[]};
    window.loadGovernanceState=async()=>empty;window.normalizeGovernanceState=value=>value;window.newGovernanceState=()=>empty;
    const source=read('anarchadia-governance-v145.js').replace(/^import\s+\{[\s\S]*?\}\s+from\s+['"][^'"]+['"];\s*/gm,'');
    await window.eval(`(async()=>{${source}\n})()`);
    assert.equal(window.document.querySelector('nav .active')?.dataset.view,hash==='unknown'?'overview':hash);
    assert.equal(window.document.querySelectorAll('nav [aria-current="page"]').length,1);
  });
}
