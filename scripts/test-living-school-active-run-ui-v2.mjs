import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync(new URL('../public/app/living-school-active-run-ui-v2.js',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));

function fixture(t){
  const dom=new JSDOM('<main id="living-school-root"><section class="lsc218-panel"><button data-ls-action="generate-curriculum">Generate curriculum</button></section><section id="lsc220-generation-recovery"><details><summary>Generation attempt history</summary>Previous attempt retained.</details></section></main>',{url:'https://civweave.test/app/cabinets/living-school/index.html',runScripts:'outside-only'});
  const {window}=dom,root=window.document.documentElement,button=window.document.querySelector('button'),report=window.document.querySelector('#lsc220-generation-recovery');
  let time=Date.parse('2026-10-26T16:00:00Z'),nextTimer=0;
  const intervals=new Map(),NativeDate=window.Date;
  window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[time]))}static now(){return time}};
  window.setInterval=fn=>{const id=++nextTimer;intervals.set(id,fn);return id};
  window.clearInterval=id=>intervals.delete(id);
  const observers=[],NativeObserver=window.MutationObserver;
  window.MutationObserver=class extends NativeObserver{constructor(callback){super(callback);observers.push(this)}};
  t.after(async()=>{for(const observer of observers)observer.disconnect();intervals.clear();await flush();window.close()});
  Object.defineProperty(window.document,'readyState',{value:'complete',configurable:true});
  window.eval(source);
  const api=window.CivweaveLivingSchoolActiveRunUIV2;
  const stage=value=>window.dispatchEvent(new window.CustomEvent('civweave:living-school-curriculum-stage',{detail:{stage:value}}));
  const model=(requestId,phase,detail={})=>window.dispatchEvent(new window.CustomEvent('civweave:model-event',{detail:{requestId,phase,purpose:'living-school-research-grounded-curriculum-v218.1',provider:'ollama',model:'qwen3.5:4b',at:new window.Date().toISOString(),...detail}}));
  const advance=ms=>{time+=ms;for(const fn of [...intervals.values()])fn()};
  const busy=value=>{button.disabled=value;button.setAttribute('aria-busy',String(value));button.textContent=value?'Generating curriculum…':'Generate curriculum'};
  const clock=()=>window.document.querySelector('.lsc-run-time')?.textContent;
  return{window,api,root,button,report,intervals,stage,model,advance,busy,clock};
}

test('failed shared-chat curriculum freezes the run and request clocks while retaining its recovery history',async t=>{
  const h=fixture(t);
  h.root.dataset.livingSchoolChatAction='generating-curriculum';h.stage('generating');
  h.model('design','connecting');await flush();
  h.advance(600000);h.model('design','failed',{error:{code:'TIMEOUT'}});
  h.report.insertAdjacentHTML('afterbegin','<h2>0/3 structured modules complete</h2><p>Research/design request failed: TIMEOUT.</p>');
  h.root.dataset.livingSchoolGenerationRecovery='failed';h.root.dataset.livingSchoolChatAction='idle';await flush();
  assert.equal(h.api.session.status,'failed');
  assert.match(h.window.document.querySelector('.lsc-run-phase').textContent,/generation failed/i);
  assert.equal(h.clock(),'10:00');assert.equal(h.intervals.size,0);
  assert.equal(h.api.session.runs[0].errorCode,'TIMEOUT');
  const requestStatus=h.window.document.querySelector('.lsc-run-stream-status').textContent;
  assert.match(requestStatus,/Failed.*elapsed 10:00/);
  h.advance(828*60000);await flush();h.api.renderRail();
  assert.equal(h.clock(),'10:00');assert.equal(h.window.document.querySelector('.lsc-run-stream-status').textContent,requestStatus);
  assert.equal(h.report.hidden,false);assert.match(h.report.textContent,/0\/3.*TIMEOUT.*Generation attempt history.*Previous attempt retained/s);
  assert.equal(h.root.dataset.livingSchoolRunRailActive,undefined);
});

test('a failed request does not end an ongoing native retry, but the final failure settles once and stays settled',async t=>{
  const h=fixture(t);h.busy(true);await flush();
  h.model('design-1','connecting');h.advance(1000);h.model('design-1','failed',{errorCode:'TIMEOUT'});await flush();
  assert.equal(h.api.session.status,'running');
  h.model('design-2','connecting');h.advance(2000);h.model('design-2','failed',{errorCode:'TIMEOUT'});
  h.root.dataset.livingSchoolGenerationRecovery='failed';h.busy(false);await flush();
  assert.equal(h.api.session.status,'failed');assert.equal(h.api.session.runs.length,2);assert.equal(h.clock(),'0:03');
  const id=h.api.session.id,endedAt=h.api.session.endedAt;
  h.advance(120000);h.model('design-2','failed',{errorCode:'TIMEOUT'});await flush();
  assert.equal(h.api.session.id,id);assert.equal(h.api.session.endedAt,endedAt);assert.equal(h.clock(),'0:03');assert.equal(h.intervals.size,0);
});

test('background requests are nested only when their parent is an actual recorded call',async t=>{
  const h=fixture(t);h.busy(true);await flush();h.model('design','connecting');
  h.model('background','connecting',{purpose:'shared-safety-check'});
  assert.equal(h.api.session.runs[1].nested,false);assert.equal(h.api.session.runs[1].background,true);
  assert.match(h.window.document.querySelector('.lsc-run-detail').textContent,/background/);
  assert.doesNotMatch(h.window.document.querySelector('.lsc-run-detail').textContent,/nested/);
  h.model('known-child','connecting',{purpose:'shared-safety-check',parentRequestId:'design'});
  assert.equal(h.api.session.runs[2].nested,true);assert.equal(h.api.session.runs[2].background,false);
  h.model('unknown-child','connecting',{purpose:'shared-safety-check',parentRequestId:'unrecorded-call'});
  assert.equal(h.api.session.runs[3].nested,false);assert.equal(h.api.session.runs[3].background,true);
});

for(const [recovery,phase] of [['partial','Partial curriculum generated'],['complete','Curriculum ready']])test(`${recovery} curriculum recovery freezes a shared-chat run without hiding the report`,async t=>{
  const h=fixture(t);h.root.dataset.livingSchoolChatAction='generating-curriculum';h.stage('generating');h.model('design','connecting');await flush();
  h.advance(2000);h.model('design','completed',{status:'success'});h.root.dataset.livingSchoolGenerationRecovery=recovery;h.root.dataset.livingSchoolChatAction='idle';await flush();
  assert.equal(h.api.session.status,recovery);assert.equal(h.api.session.phase,phase);assert.equal(h.clock(),'0:02');assert.equal(h.intervals.size,0);assert.equal(h.report.hidden,false);
});
