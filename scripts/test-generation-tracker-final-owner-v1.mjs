import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/app/guide-generation-tracker-v1.js', import.meta.url), 'utf8');

function lifecycleHarness() {
  const handlers=new Map(),history=[];let panel,panelWrites=0;
  const host={querySelector:()=>panel||null,append:node=>{panel=node;}};
  const article={dataset:{messageId:'qa-row'},children:[{},host]},root={dataset:{guide:'fellowfare'},querySelectorAll:()=>[article]};
  const context={document:{
    getElementById:id=>id==='cw-persistent-guide-chat-v215'?root:id==='cw-guide-generation-tracker-v1-style'?{}:null,
    createElement:()=>({dataset:{},set innerHTML(value){panelWrites++;},querySelector:()=>null,remove(){panel=null;}}),
    addEventListener(){},head:{append(){}},
  },localStorage:{getItem:()=>null},queueMicrotask:callback=>callback(),setTimeout(){},clearTimeout(){},
  addEventListener:(name,callback)=>handlers.set(name,callback),
  CivweaveGenerationLifecycleV2:{install(){},history:()=>history,artifactName:()=> 'Generation',mergeArtifacts:(a,b)=>({...a,...b}),normalizeArtifacts:()=>({})}};
  vm.runInNewContext(source,context,{filename:'guide-generation-tracker-v1.js'});
  return{api:context.CivweaveGuideGenerationTrackerV1,history,handlers,root,article,context,writes:()=>panelWrites,detachPanel:()=>{panel=null;},
    row:(id,type,detail)=>({id,at:Date.now(),type,detail})};
}

test('installation metadata and unchanged installations do not redraw a generation panel',()=>{
  const app=lifecycleHarness();
  for(let index=0;index<20;index++)app.history.push(app.row(`install-${index}`,'civweave:weave-pipeline',{phase:'install',state:'ready'}));
  for(let index=0;index<20;index++)app.api.install();
  assert.equal(app.api.state().showPipeline,false,'loading an authority is not an active generation');
  assert.equal(app.writes(),0,'ready-only history must not create or rewrite a panel');
});

test('a completed Rook tracker cannot attach its final response to another guide or saved row',()=>{
  const app=lifecycleHarness(),changed=app.handlers.get('civweave:realm-guide-thread-changed');
  const user={role:'user',text:'Create a Manifest',at:new Date().toISOString()};
  changed({detail:{system:'fellowfare',thread:{messages:[user,{id:'rook-pending',role:'assistant',pending:true}]}}});
  app.article.dataset.messageId='rook-pending';
  app.handlers.get('civweave:generation-lifecycle')({detail:app.row('rook-start','runtime-stage',{stage:'draft',state:'start'})});
  changed({detail:{system:'fellowfare',thread:{messages:[user,{id:'rook-pending',role:'assistant',text:'Rook private result',provider:'ollama'}]}}});
  assert.equal(app.api.state().streams.final,'Rook private result');
  const before=app.writes();app.root.dataset.guide='civweave';app.article.dataset.messageId='old-weaveling-pending';app.detachPanel();
  app.api.ensurePanel();app.api.install();app.handlers.get('civweave:guide-chat-opened')();
  assert.equal(app.writes(),before,'switching guides cannot repaint the previous guide’s generation');
  changed({detail:{system:'civweave',thread:{messages:[{id:'other-final',role:'assistant',text:'Other saved response'}]}}});
  assert.equal(app.api.state().streams.final,'Rook private result','an unrelated final row cannot overwrite the tracked request');
  app.context.CivweaveGuideChatSurfaceV350={state:()=>({busy:false})};
  changed({detail:{system:'civweave',thread:{messages:[{role:'user',text:'Old request',at:'2026-01-01T00:00:00Z'},{id:'old-weaveling-pending',role:'assistant',pending:true}]}}});
  assert.equal(app.api.state().guideSystem,'fellowfare','restoring a stale pending row does not adopt another guide’s lifecycle history');
  app.root.dataset.guide='fellowfare';app.article.dataset.messageId='other-rook-history';app.api.ensurePanel();
  assert.equal(app.writes(),before,'the same guide must still match the exact pending/final row');
});

test('real lifecycle history paints once and consumes newly added tokens once',()=>{
  const app=lifecycleHarness();
  app.history.push(app.row('start','runtime-stage',{stage:'draft',state:'start'}),
    app.row('token-a','runtime-token',{stage:'draft',text:'A'}),app.row('token-b','runtime-token',{stage:'draft',text:'B'}));
  app.api.install();assert.equal(app.api.state().streams.draft,'AB');
  assert.equal(app.writes(),1,'history replay should batch its DOM update');
  const before=app.writes();for(let index=0;index<20;index++)app.api.install();
  assert.equal(app.api.state().streams.draft,'AB','reinstall must not duplicate historical tokens');
  assert.equal(app.writes(),before,'unchanged history and panel state remain idle');
  const next=app.row('token-c','runtime-token',{stage:'draft',text:'C'});app.history.push(next);
  app.handlers.get('civweave:generation-lifecycle')({detail:next});
  const after=app.writes();app.api.install();
  assert.equal(app.api.state().streams.draft,'ABC','live delivery followed by history replay consumes the same row once');
  assert.equal(app.writes(),after);
});

for (const provider of ['ollama', 'native-server', 'downloaded-local', 'local-contract']) {
  test(`tracker completion records ${provider} metadata without replaying the final answer`, () => {
    const handlers = new Map(), writes = [], timers = [], frames = [];
    let text = 'Already streamed answer', panel;
    const bubble = { get textContent() { return text; }, set textContent(value) { writes.push(value); text = value; }, classList: { add() {}, remove() {} } };
    const finalPre = { textContent: '' }, section = { querySelector: () => finalPre };
    const host = { querySelector: () => panel || null, append: node => { panel = node; } };
    const article = { children: [{}, host], querySelector: () => bubble };
    const root = { querySelectorAll: () => [article] };
    const context = {
      console, document: {
        getElementById: id => id === 'cw-persistent-guide-chat-v215' ? root : id === 'cw-guide-generation-tracker-v1-style' ? {} : null,
        createElement: () => ({ dataset: {}, innerHTML: '', querySelector: () => section, remove() {} }),
        addEventListener() {}, head: { append() {} },
      },
      localStorage: { getItem: () => null },
      addEventListener: (name, handler) => handlers.set(name, handler),
      queueMicrotask: callback => callback(),
      setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout() {},
      requestAnimationFrame: callback => { frames.push(callback); return frames.length; }, cancelAnimationFrame() {},
      matchMedia: () => ({ matches: false }),
    };
    vm.runInNewContext(source, context, { filename: 'guide-generation-tracker-v1.js' });
    const changed = handlers.get('civweave:realm-guide-thread-changed');
    changed({ detail: { thread: { updatedAt: '2026-10-24T12:00:00.000Z', messages: [{ role: 'user', text: 'QA', at: '2026-10-24T12:00:00.000Z' }, { role: 'assistant', text: 'Thinking', pending: true }] } } });
    handlers.get('civweave:weave-pipeline')({ detail: { origin: 'native-local-api', phase: 'pipeline', state: 'complete', artifactKey: 'qa-record' } });
    const final = { detail: { thread: { updatedAt: '2026-10-24T12:00:01.000Z', messages: [{ role: 'user', text: 'QA' }, { role: 'assistant', text, provider, model: 'qa-model' }] } } };
    changed(final);
    while (timers.length) timers.shift()();
    assert.deepEqual(writes, [], 'The tracker must never blank or rewrite the canonical answer bubble.');
    assert.equal(frames.length, 0, 'Completion must not schedule synthetic token replay.');
    assert.equal(bubble.textContent, 'Already streamed answer');
    const state = context.CivweaveGuideGenerationTrackerV1.state();
    assert.equal(state.streams.final, 'Already streamed answer');
    assert.equal(state.finalSource, `${provider} · qa-model`);
    assert.equal(state.terminal, 'complete'); assert.equal(state.artifactKey, 'qa-record');
    changed(final);
    assert.deepEqual(writes, [], 'Duplicate completion events must remain inert.');
  });
}
