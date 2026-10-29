import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read=file=>readFileSync(new URL(`../public/app/${file}`,import.meta.url),'utf8');
const html=read('anarchadia-console-v139.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');

async function fixture(t,{count=0,legacy=false}={}){
  const dom=new JSDOM(html,{url:'https://civweave.test/app/anarchadia-console-v139.html?cabinet=1&embed=1&persistentShell=1',runScripts:'outside-only'}),{window}=dom;
  const observers=[],Observer=window.MutationObserver,frames=[],queued=[];
  window.MutationObserver=class extends Observer{constructor(callback){super(callback);observers.push(this)}};
  t.after(()=>{for(const observer of observers)observer.disconnect();window.close()});
  Object.defineProperty(window.document,'readyState',{value:'complete',configurable:true});
  window.requestAnimationFrame=callback=>{frames.push(callback);return frames.length};
  window.queueMicrotask=callback=>queued.push(callback);window.scrollTo=()=>{};
  const style=window.document.createElement('style');style.textContent=read('anarchadia-console-v139.css');window.document.head.append(style);
  const proposals=Array.from({length:count},(_,index)=>({id:`request-${index}`,title:`Request ${index}`,status:'review',stage:'intake',pipeline:[],acceptance:[]}));
  window.localStorage.setItem('civweave.anarchadia.citizen-console.v139',JSON.stringify({schema:'civweave.anarchadia-console.v1',passportId:'QA',proposals,ledger:[],settings:{autoRun:false}}));
  const before=window.localStorage.getItem('civweave.anarchadia.citizen-console.v139');
  if(legacy){
    const pulse=window.document.getElementById('ac-civic-flow');pulse.id='legacy-pulse';pulse.classList.remove('ac-civic-flow');pulse.innerHTML=`<h2>Civic pulse</h2><span id="ac-proposal-count">${count}</span>`;
  }
  window.__qaGovernanceStore={loadGovernanceState:async()=>({schema:'civweave.anarchadia-governance.v145',changeSets:[],ballots:[],executionPackets:[],authorizations:[]})};
  window.eval(read('anarchadia-console-v158.js').replace("import('./anarchadia-governance-store-v145.js')",'Promise.resolve(globalThis.__qaGovernanceStore)'));
  window.eval(read('usability-progressive-disclosure-v1.js'));
  const flush=async()=>{for(let pass=0;pass<16;pass++){await Promise.resolve();while(frames.length)frames.shift()(0);while(queued.length)queued.shift()()}};
  await flush();
  return{window,before,flush,flow:()=>window.document.getElementById('ac-civic-flow'),state:()=>window.localStorage.getItem('civweave.anarchadia.citizen-console.v139')};
}

for(const count of [0,3]){
  test(`the primary civic work map stays visible with ${count} saved requests after progressive disclosure and refresh`,async t=>{
    const env=await fixture(t,{count}),flow=env.flow();
    assert.equal(flow.querySelector('[data-civic-stage="requests"] [data-civic-count]').textContent,String(count));
    assert.equal(flow.closest('details'),null,'Primary work and navigation must not be collapsed as legacy Civic pulse.');
    assert.equal(flow.parentElement.classList.contains('ac-display'),true);
    assert.equal(flow.hidden,false);assert.notEqual(env.window.getComputedStyle(flow).display,'none');
    env.window.CivweaveProgressiveDisclosureV1.sync();env.window.AnarchadiaCitizenConsoleV158.render();await env.flush();
    assert.equal(flow.closest('details'),null,'Bounded redraws retain the primary map directly on home.');
    assert.equal(flow.querySelectorAll('[data-civic-stage]').length,6);
    assert.equal(env.state(),env.before,'Visibility and read-only map controls do not rewrite request state.');
  });
}

test('the primary work map follows the existing non-home hide and home return contract',async t=>{
  const env=await fixture(t,{count:1}),flow=env.flow();
  env.window.AnarchadiaCitizenConsoleV158.setScreen('ledger');await env.flush();
  assert.equal(flow.closest('details'),null);assert.equal(flow.hidden,true);assert.equal(env.window.getComputedStyle(flow).display,'none');
  env.window.AnarchadiaCitizenConsoleV158.setScreen('home');await env.flush();
  assert.equal(flow.hidden,false);assert.notEqual(env.window.getComputedStyle(flow).display,'none');
  assert.equal(flow.querySelector('[data-civic-stage="requests"] [data-civic-count]').textContent,'1');assert.equal(env.state(),env.before);
});

for(const count of [0,3]){
  test(`a retained legacy pulse keeps its existing ${count?'expanded':'collapsed'} disclosure policy`,async t=>{
    const env=await fixture(t,{count,legacy:true}),pulse=env.window.document.getElementById('legacy-pulse'),wrapper=pulse.closest('details');
    assert.ok(wrapper);assert.equal(wrapper.dataset.cwPdId,'anarchadia-civic-pulse');assert.equal(wrapper.open,count>0);assert.match(wrapper.querySelector('summary').textContent,/Civic pulse/);
  });
}
