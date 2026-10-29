import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {Worker} from 'node:worker_threads';
const source=readFileSync(new URL('../public/app/shared/quest-pathway-map-v1.js',import.meta.url),'utf8');
const plan=()=>({id:'woven-quest',title:'Build a community repair bench',state:'active',paths:[
  {id:'agreement',realm:'anarchadia',title:'Agree location and access',steps:[{id:'consent',title:'Record the group agreement',status:'accepted'}],status:'completed'},
  {id:'learn',realm:'living-school',title:'Practice safe joints',dependsOn:['agreement'],steps:[{id:'practice',title:'Inspect a practice joint'}]},
  {id:'gather',realm:'fellowfare',title:'Source suitable timber',dependsOn:['agreement'],steps:[{id:'materials',title:'Inspect donated timber'}]},
  {id:'make',realm:'cerbanimo',title:'Build and inspect the bench',dependsOn:['practice','materials'],steps:[{id:'assembly',title:'Assemble and inspect'}]}
]});
function fixture(){const dom=new JSDOM('<!doctype html><main></main>',{runScripts:'outside-only'});dom.window.eval(source);return{w:dom.window,api:dom.window.CivweaveQuestPathwayMapV1,host:dom.window.document.querySelector('main'),close:()=>dom.window.close()}}
test('declared dependencies become colored cross-subsystem threads with exact endpoints and stable bounded layout',()=>{
 const f=fixture();try{const g=f.api.project(plan());assert.equal(g.nodes.length,8);assert.equal(g.edges.filter(e=>e.kind==='dependency').length,4);assert.equal(g.edges.filter(e=>e.kind==='sequence').length,4);assert.ok(g.edges.filter(e=>e.kind==='dependency').every(e=>e.crossSubsystem));const make=g.nodes.find(n=>n.id==='make');assert.ok(make.y>g.nodes.find(n=>n.id==='practice').y);assert.ok(make.y>g.nodes.find(n=>n.id==='materials').y);assert.ok(g.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)&&n.x>=0&&n.y>=0));assert.deepEqual(g,f.api.project(plan()));assert.equal(g.width,760);assert.equal(g.cycles.length,0)}finally{f.close()}
});
test('rendered threads are actual SVG paths, with a legend and semantic interactive nodes alongside complete details',()=>{
 const f=fixture();try{f.host.innerHTML=f.api.render(plan(),{theme:'cerbanimo',actions:['inspect','open-native']});assert.equal(f.host.querySelector('[data-map-theme]').dataset.mapTheme,'cerbanimo');assert.equal(f.host.querySelectorAll('svg.cw-qmap-threads path[data-edge-kind="dependency"]').length,4);assert.equal(f.host.querySelectorAll('[data-quest-map-graph-node]').length,8);assert.match(f.host.textContent,/Declared dependency|Beat order/);assert.ok(f.host.querySelector('details.cw-qmap-details'));assert.equal(f.host.querySelectorAll('[data-quest-map-step]').length,4);const seen=[];f.api.bind(f.host,d=>seen.push(d));f.host.querySelector('[data-quest-map-graph-node="p3"]').click();assert.equal(seen[0].pathId,'make');assert.equal(seen[0].questId,'woven-quest');assert.equal(seen[0].action,'inspect')}finally{f.close()}
});
test('missing and duplicate references never draw invented dependency edges; cycles remain visible and blocked',()=>{
 const f=fixture();try{const p=plan();p.paths[1].dependsOn=['absent'];p.paths[2].steps[0].id='practice';p.paths[3].dependsOn=['practice'];let g=f.api.project(p);assert.equal(g.edges.filter(e=>e.kind==='dependency').length,1);assert.equal(g.unresolved.length,2);p.paths[0].dependsOn=['make'];p.paths[3].dependsOn=['agreement'];g=f.api.project(p);assert.ok(g.cycles.length>0);f.host.innerHTML=f.api.render(p,{actions:['inspect','open-native']});assert.match(f.host.textContent,/Dependency cycle/);assert.equal(f.host.querySelector('[data-quest-map-action="open-native"][data-path-id="make"]').disabled,true)}finally{f.close()}
});
test('theme follows the host subsystem or explicit guide context, keeps canonical thread colors and Lud has direct details',()=>{
 const f=fixture();try{f.w.document.documentElement.dataset.civweaveSystem='living-school';f.host.innerHTML=f.api.render(plan());assert.equal(f.host.querySelector('[data-map-theme]').dataset.mapTheme,'living-school');for(const theme of ['civweave','living-school','cerbanimo','fellowfare','anarchadia']){f.host.innerHTML=f.api.render(plan(),{theme});assert.equal(f.host.querySelector('[data-map-theme]').dataset.mapTheme,theme);assert.match(f.host.innerHTML,/#9acb70/);assert.match(f.host.innerHTML,/#bb79ff/);assert.match(f.host.innerHTML,/#f5b446/);assert.match(f.host.innerHTML,/#ff3d96/)}f.host.innerHTML=f.api.render(plan(),{art:false});assert.equal(f.host.querySelector('.cw-qmap-details').open,true)}finally{f.close()}
});
test('a bounded completed dependency DAG cannot monopolize the browser event loop',async()=>{
 const result=await new Promise((resolve,reject)=>{
  const worker=new Worker(`const{parentPort,workerData}=require('node:worker_threads');const vm=require('node:vm');const scope={document:{documentElement:{dataset:{}}}};vm.createContext(scope);vm.runInContext(workerData,scope);const all=[];const realms=['living-school','cerbanimo','fellowfare','anarchadia'];const paths=realms.map((realm,p)=>({id:'p'+p,realm,status:'completed',steps:Array.from({length:24},(_,s)=>{const id='s'+all.length;const step={id,title:id,status:'completed',dependsOn:all.slice(-2)};all.push(id);return step})}));const graph=scope.CivweaveQuestPathwayMapV1.project({state:'completed',paths});parentPort.postMessage({nodes:graph.nodes.length,locked:graph.nodes.filter(n=>n.locked).length});`,{eval:true,workerData:source});
  const deadline=setTimeout(()=>{void worker.terminate();reject(new Error('Bounded dependency map blocked its worker for over3seconds.'))},3000);
  worker.once('message',value=>{clearTimeout(deadline);resolve(value)});worker.once('error',error=>{clearTimeout(deadline);reject(error)});
 });assert.equal(result.nodes,100);assert.equal(result.locked,0);
});
test('Lud details expose cyclic and transitive locks even when stored beats claim completion',()=>{
 const f=fixture();try{const p=plan();p.paths[1].steps=[{id:'a',title:'A',status:'completed',dependsOn:['b']},{id:'b',title:'B',status:'completed',dependsOn:['a']}];f.host.innerHTML=f.api.render(p,{art:false,actions:['inspect','open-native']});assert.equal(f.host.querySelector('[data-quest-map-step="a"]').dataset.locked,'true');assert.equal(f.host.querySelector('[data-quest-map-step="b"]').dataset.locked,'true');assert.equal(f.api.canOpenPath(p,'learn'),false);const warning=f.host.querySelector('.cw-qmap-cycle-warning');assert.ok(warning);assert.equal(warning.closest('.cw-qmap-weave'),null);assert.match(warning.textContent,/Dependency cycle/)}finally{f.close()}
});
test('canonical dependsOn takes the same precedence as Guild privacy projection',()=>{
 const f=fixture();try{const p=plan();p.paths[1].dependsOn=['missing'];p.paths[1].dependencies=[];assert.equal(f.api.canOpenPath(p,'learn'),false);assert.ok(f.api.project(p).unresolved.some(r=>r.id==='missing'));p.paths[1].dependsOn=[];p.paths[1].dependencies=['missing'];assert.equal(f.api.canOpenPath(p,'learn'),true)}finally{f.close()}
});
test('an empty or explicitly excluded governance value never adds a phantom subsystem node',()=>{
 const f=fixture();try{const p=plan();for(const governance of [null,{}, {included:false,title:'Excluded governance'}]){p.governance=governance;f.host.innerHTML=f.api.render(p);assert.equal(f.api.project(p).nodes.length,8);assert.doesNotMatch(f.host.textContent,/\+ governance/);assert.equal(f.host.querySelector('[data-governance="true"]'),null)}p.governance={title:'An actual agreement',agreements:['Share access']};assert.equal(f.api.project(p).nodes.length,9)}finally{f.close()}
});
