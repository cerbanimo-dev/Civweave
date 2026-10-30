import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const source=await readFile(new URL('../public/app/shared/quest-pathway-map-v1.js',import.meta.url),'utf8');
const css=await readFile(new URL('../public/app/shared/quest-pathway-map-v1.css',import.meta.url),'utf8');
const fixture=()=>({id:'quest-real-id',title:'Repair the shared stool',state:'review',paths:[
  {id:'learn-id',realm:'living-school',title:'Learn the joint',steps:[{id:'inspect-id',title:'Inspect joint',status:'accepted'},'Practice the fit'],progress:[]},
  {id:'build-id',realm:'cerbanimo',title:'Repair it',dependsOn:['inspect-id'],steps:[{id:'fit-id',title:'Fit joint',dependencies:['inspect-id']},{id:'proof-id',title:'Record proof',dependencies:['fit-id']}]}
]});
function browser(plan=fixture(),options={}){const dom=new JSDOM('<!doctype html><html><body><main></main></body></html>',{runScripts:'outside-only'}),win=dom.window;win.eval(source);const api=win.CivweaveQuestPathwayMapV1,host=win.document.querySelector('main');host.innerHTML=api.render(plan,options);return{win,host,api,close:()=>win.close()}}

test('a newly generated Quest immediately shows all four subsystem trails and saved beats',()=>{
  const b=browser();try{
    assert.equal(b.host.querySelector('[data-quest-pathway-map]').dataset.questId,'quest-real-id');
    assert.deepEqual([...b.host.querySelectorAll('[data-quest-map-lane]')].map(node=>node.dataset.questMapLane),['living-school','cerbanimo','fellowfare','anarchadia']);
    assert.equal(b.host.querySelectorAll('[data-quest-map-step]').length,4);
    assert.match(b.host.textContent,/Awaiting activation/);
    assert.equal(b.host.querySelector('[data-quest-map-lane="fellowfare"]').textContent.includes('No path requested'),true);
    assert.match(b.host.textContent,/Beat order · not a lock/);
    assert.equal(b.host.querySelector('[data-quest-map-step="proof-id"]').dataset.locked,'true');
    assert.equal(b.host.querySelector('[data-quest-map-step="fit-id"]').dataset.locked,'false');
  }finally{b.close()}
});

test('only requested actions delegate exact saved identifiers and indexes once',()=>{
  const b=browser(fixture(),{actions:['inspect','edit','open-native','submit-guild','publish']});try{
    const calls=[],callback=detail=>calls.push({...detail});b.api.bind(b.host,callback);b.api.bind(b.host,callback);
    b.host.querySelector('[data-quest-map-action="inspect"][data-step-index="1"]').click();
    b.host.querySelector('[data-quest-map-action="edit"]').click();
    b.host.querySelector('[data-quest-map-action="submit-guild"]').click();
    assert.equal(calls.length,3);
    assert.deepEqual(calls[0],{action:'inspect',questId:'quest-real-id',pathId:'learn-id',pathIndex:0,stepId:'',stepIndex:1,realm:'living-school',governance:false});
    assert.equal(calls[1].action,'edit');assert.equal(calls[2].action,'submit-guild');
    assert.equal(b.host.querySelector('[data-quest-map-action="publish"]'),null);
    const unknown=b.win.document.createElement('button');unknown.dataset.questMapAction='activate';b.host.querySelector('[data-quest-pathway-map]').append(unknown);unknown.click();assert.equal(calls.length,3);
    const dispose=b.api.bind(b.host,callback);dispose();b.host.querySelector('[data-quest-map-action="edit"]').click();assert.equal(calls.length,3);
  }finally{b.close()}
});

test('dependency locks fail closed for unresolved or ambiguous references without inventing completions',()=>{
  const plan=fixture();plan.paths[1].dependsOn=['missing'];plan.paths[1].steps.push({id:'inspect-id',title:'Duplicate identifier',status:'accepted'},{id:'ambiguous',title:'Ambiguous dependent',dependsOn:['inspect-id']});
  const b=browser(plan,{actions:['inspect','open-native']});try{
    assert.match(b.host.textContent,/Unresolved dependency: missing/);
    assert.match(b.host.textContent,/Ambiguous dependency: inspect-id/);
    assert.equal(b.host.querySelector('[data-quest-map-step="ambiguous"]').dataset.locked,'true');
    assert.equal(b.host.querySelector('[data-quest-map-action="open-native"][data-path-id="build-id"]').disabled,true);
    assert.equal(b.host.querySelector('[data-quest-map-action="open-native"][data-path-id="learn-id"]').disabled,true,'review requires activation');
    assert.doesNotMatch(b.host.textContent,/100%|Quest complete/);
  }finally{b.close()}
});

test('reported publication progress is clearly attributed and never treated as proof',()=>{
  const plan=fixture();plan.state='active';plan.paths[0].progress=[0,1];
  const b=browser(plan,{reported:true,scope:'Shared Guild snapshot',actions:['inspect','open-native']});try{
    assert.match(b.host.textContent,/Member-reported snapshot/);assert.match(b.host.textContent,/Reported complete/);assert.match(b.host.textContent,/Proof is not included/);
    assert.equal(b.host.querySelector('[data-quest-map-action="open-native"]'),null);
  }finally{b.close()}
});

test('completed Quests keep native work viewable while stopped Quests have no available work entry',()=>{
  const plan=fixture();plan.state='completed';const b=browser(plan,{actions:['open-native']});try{assert.equal(b.host.querySelector('[data-quest-map-action="open-native"][data-path-id="learn-id"]').disabled,false);plan.state='abandoned';b.host.innerHTML=b.api.render(plan,{actions:['open-native']});assert.ok([...b.host.querySelectorAll('[data-quest-map-action="open-native"]')].every(button=>button.disabled))}finally{b.close()}
});

test('unrecognized paths stay visible and markup is escaped without leaking unrelated fields',()=>{
  const plan=fixture();plan.title='<img src=x onerror=alert(1)>';plan.wish='PRIVATE WISH';plan.profile={secret:'PRIVATE PROFILE'};plan.paths.push({id:'<unsafe>',realm:'unknown-system',title:'<script>unsafe</script>',evidence:['PRIVATE PROOF'],steps:['<b>not markup</b>']});
  const b=browser(plan);try{
    assert.equal(b.host.querySelectorAll('[data-quest-map-lane]').length,5);assert.equal(b.host.querySelectorAll('script,img[onerror]').length,0);
    assert.equal(b.host.querySelectorAll('img').length,4);assert.equal(b.host.querySelectorAll('b').length,4);assert.equal(b.host.querySelectorAll('.cw-qmap-lane-labels img').length,4);
    assert.match(b.host.textContent,/Unassigned subsystem/);assert.match(b.host.textContent,/<script>unsafe<\/script>/);assert.doesNotMatch(b.host.textContent,/PRIVATE/);
    assert.equal(b.host.querySelector('[data-path-id="<unsafe>"]').dataset.pathId,'<unsafe>');
  }finally{b.close()}
});

test('the renderer bounds large plans, reports omitted content, and keeps governance distinct',()=>{
  const plan=fixture();plan.paths=Array.from({length:80},(_,index)=>({id:`p-${index}`,realm:'cerbanimo',title:`Path ${index}`,steps:Array.from({length:200},(_,step)=>({id:`p${index}-s${step}`,title:`Step ${step}`}))}));plan.governance={id:'agreement',title:'Shared agreement'};
  const b=browser(plan);try{
    assert.ok(b.host.querySelectorAll('[data-quest-map-path]').length<=12);assert.ok(b.host.querySelectorAll('[data-quest-map-step]').length<=96);assert.match(b.host.textContent,/preview/i);assert.match(b.host.textContent,/80 paths/);
    const small=fixture();small.governance=plan.governance;b.host.innerHTML=b.api.render(small);assert.match(b.host.querySelector('[data-governance="true"]').textContent,/Shared agreement/);assert.match(b.host.textContent,/Separate governance layer/);
  }finally{b.close()}
});

test('semantic trails support keyboard controls, mobile targets and motion preferences',()=>{
  const b=browser();try{assert.ok(b.host.querySelector('ol'));assert.equal(b.host.querySelectorAll('[role="button"]').length,0);assert.ok(b.host.querySelector('button[type="button"]'));assert.match(css,/min-height:\s*44px/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/data-art="false"/);assert.match(css,/overflow-wrap:\s*anywhere/)}finally{b.close()}
});
