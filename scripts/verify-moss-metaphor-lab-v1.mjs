#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const filename='public/app/cabinets/living-school/moss-metaphor-lab-v1.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=read(filename),controller=read('public/app/cabinets/living-school/living-school-cleanroom-v218.mjs');
const offline=JSON.parse(read('public/app/offline-package-v208.json'));
assert.match(controller,/moss-metaphor-lab-v1\.mjs/);
assert.match(controller,/mountMossMetaphorLab\(\)/);
assert.match(controller,/installMossMetaphorLab\(\)/);
assert.ok(offline.assets.includes('/app/cabinets/living-school/moss-metaphor-lab-v1.mjs'));
assert.doesNotMatch(source,/\beval\s*\(|\bnew\s+Function\s*\(|<iframe/);

const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char]));
const sandbox={state:()=>({school:{id:'course-1',modules:[{id:'module-1'}]}}),activeModule:()=>({id:'module-1'}),
  progressFor:()=>({}),persist:()=>{},escape,clean,console,structuredClone};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(source.replace(/^import[^\n]+\n/m,'').replace(/^export /gm,'')+'\nglobalThis.__specTools={validateMetaphor,detail,schema,scopeFingerprint};',sandbox,{filename});
const {validateMetaphor,detail,schema,scopeFingerprint}=sandbox.__specTools;
const good={
 title:'The <Aqueduct>',world:'A water tower sends water through pipes.',analogy:'Flow represents a constrained resource.',theme:'river',
 mapping:[{image:'Tower',concept:'Reserve capacity',relation:'Water storage represents headroom.'},{image:'Valve',concept:'Control',relation:'Opening the valve changes throughput.'}],
 steps:[
  {kind:'dial',scene:'The water is flowing.',question:'How should you set the valve?',dial:{label:'Valve setting',levels:[
   {label:'Closed',worldState:'There is no flow.',feedback:'This blocks the resource.',correct:false},
   {label:'Balanced',worldState:'Flow meets demand.',feedback:'Supply and capacity are in balance.',correct:true},
   {label:'Wide open',worldState:'The pipe overloads.',feedback:'Too much throughput overwhelms capacity.',correct:false}]}},
  {kind:'choice',scene:'The reservoir is getting low.',question:'How do you respond?',choices:[
   {label:'Reduce demand',feedback:'This preserves the reserve.',correct:true},
   {label:'Ignore the reserve',feedback:'The reserve runs out.',correct:false}]}
 ],
 transferPrompt:'Which part represents a real system bottleneck?',limitation:'Resources are not literally water.'
};
const validated=validateMetaphor({...good,script:'alert(1)',onload:'bad',externalUrl:'https://example.invalid'});
assert.equal(validated.steps[0].kind,'dial');
assert.equal(validated.steps[1].kind,'choice');
assert.equal('script' in validated,false);
assert.equal('onload' in validated,false);
assert.equal('externalUrl' in validated,false);
assert.equal(schema().properties.steps.items.properties.dial.type,'object');
const shown=detail({lab:{spec:validated,step:0,answers:[],provider:'Qwen',model:'4B'}});
assert.match(shown,/type="range"/);
assert.match(shown,/mml-dial-output/);
assert.match(shown,/Where this metaphor breaks down/);
const revealed=detail({lab:{spec:validated,step:1,answers:[{choice:1,correct:true}],provider:'Qwen'}});
assert.match(revealed,/Choose a response/);
assert.doesNotMatch(shown,/<script>|<Aqueduct>/);
assert.notEqual(scopeFingerprint({title:'First',objective:'Objective'}),scopeFingerprint({title:'Second',objective:'Objective'}));
assert.throws(()=>validateMetaphor({...good,steps:[good.steps[0]]}),/scenes/);
assert.throws(()=>validateMetaphor({...good,steps:[{...good.steps[0],dial:{...good.steps[0].dial,levels:[
   {...good.steps[0].dial.levels[0],correct:true},...good.steps[0].dial.levels.slice(1)]}},good.steps[1]]}),/exactly one/);
assert.throws(()=>validateMetaphor({...good,steps:[{...good.steps[0],dial:{...good.steps[0].dial,label:''}},good.steps[1]]}),/dial/);
console.log('PASS: Moss metaphor contracts, safe rendering, dial/choice mechanics, offline asset, and cabinet wiring');
