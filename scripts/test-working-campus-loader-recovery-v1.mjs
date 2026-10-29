import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read=path=>readFileSync(new URL('../public/'+path,import.meta.url),'utf8');
const loaderSource=read('app/working-campus-v156.js'),K='civweave.working-campus.v1',I='civweave.intentions.v127';
const variants=[['absent',undefined],['null',null],['excluded',{included:false,title:'',purpose:'',agreements:[],reviewQuestion:''}],['empty',{}]];
async function boot(t,{governance,broken=false}={}){
  const dom=new JSDOM(read('app/working-campus-v440.html'),{url:'https://civweave.test/app/working-campus-v440.html?installed=1',runScripts:'outside-only'}),w=dom.window;t.after(()=>w.close());
  Object.defineProperty(w.document,'readyState',{value:'complete',configurable:true});w.structuredClone=structuredClone;w.requestAnimationFrame=()=>0;w.setTimeout=()=>0;w.clearTimeout=()=>{};w.setInterval=()=>0;w.clearInterval=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){}});
  w.CivweaveSystemRoutesV227={authorize(){},ensurePersistentSystemContext(){}};w.CivweaveWeavelingHubV233={};w.CivweaveProgressiveDisclosureV1={};
  const plan={id:'loader-quest',title:broken?'':'Original Quest',wish:'Keep one Cerbanimo checklist',outcome:'A saved checklist',state:'active',createdAt:'2026-10-29T00:00:00Z',updatedAt:'2026-10-29T00:00:00Z',paths:[{id:'loader-path',realm:'cerbanimo',type:'skilled-labor',title:'Create checklist',purpose:'Save the local note',steps:['Write the checklist'],progress:[],status:'ready'}]};if(governance!==undefined)plan.governance=structuredClone(governance);
  const ledger=[{id:plan.id,kind:'weave-plan',text:'Saved Quest title',state:'active',plan:structuredClone(plan)}];
  w.localStorage.setItem(K,JSON.stringify({stage:'active',view:'quest',wish:plan.wish,plan:structuredClone(plan),conversation:[{role:'guide',text:'Existing private message'}]}));w.localStorage.setItem(I,JSON.stringify(ledger));w.localStorage.setItem('civweave.guide-thread.civweave.v237','PRIVATE MEMORY');
  const beforeLedger=w.localStorage.getItem(I),fetched=[];w.fetch=async input=>{const url=new URL(input,w.location.href);assert.match(url.pathname,/^\/app\/working-campus-v156\.part[1-5]\.txt$/,'Loader startup must not start unrelated network or inference work.');fetched.push(url.pathname);return{ok:true,status:200,text:async()=>read(url.pathname.slice(1))}};
  const ready=new Promise((resolve,reject)=>{w.addEventListener('civweave:working-campus-runtime-ready',resolve,{once:true});w.console.error=(...args)=>reject(new Error(args.map(value=>value?.message||String(value)).join(' ')))});
  w.eval(loaderSource);let timer;try{await Promise.race([ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Actual campus loader did not settle')),3000)})])}finally{clearTimeout(timer)}
  assert.equal(w.document.documentElement.dataset.civweaveCampusRuntime,'ready');assert.equal(fetched.length,5,'Execute the actual loader and all five actual controller parts.');
  return{w,plan,beforeLedger,read:key=>JSON.parse(w.localStorage.getItem(key))};
}
for(const[label,governance]of variants){
  test(`actual loader preserves ${label} governance without creating a layer or rewriting valid saved Quests`,async t=>{
    const f=await boot(t,{governance});for(const plan of[f.read(K).plan,f.read(I)[0].plan]){assert.equal(Object.hasOwn(plan,'governance'),governance!==undefined);assert.deepEqual(plan.governance,governance);assert.equal(plan.updatedAt,'2026-10-29T00:00:00Z')}
    assert.equal(f.w.localStorage.getItem(I),f.beforeLedger);assert.doesNotMatch(f.w.document.getElementById('workspace').textContent,/Recovered passport entry|Review recovered participation|ANARCHADIA · PASSPORT|PASSPORT AND CONSENT/);assert.equal(f.w.localStorage.getItem('civweave.guide-thread.civweave.v237'),'PRIVATE MEMORY');
  });
  test(`genuine loader recovery retains ${label} governance instead of inventing consent metadata`,async t=>{
    const f=await boot(t,{governance,broken:true});for(const plan of[f.read(K).plan,f.read(I)[0].plan]){assert.ok(plan.title);assert.equal(Object.hasOwn(plan,'governance'),governance!==undefined);assert.deepEqual(plan.governance,governance);assert.equal(plan.paths.length,1);assert.equal(plan.paths[0].realm,'cerbanimo')}
  });
}
test('genuine loader recovery preserves every field of an actual enabled governance layer',async t=>{
  const governance={id:'real-agreement',realm:'anarchadia',included:true,title:'Requested access agreement',purpose:'Keep the actual requested consent',agreements:['The participants review the actual boundary.'],reviewQuestion:'Was the actual boundary agreed?',status:'accepted',decision:{id:'real-decision',notes:'Existing consent metadata'}};
  const f=await boot(t,{governance,broken:true});assert.deepEqual(f.read(K).plan.governance,governance);assert.deepEqual(f.read(I)[0].plan.governance,governance);
});
test('an already stored recovery layer is preserved for explicit human revision rather than silently removed',async t=>{
  const governance={realm:'anarchadia',title:'Recovered passport entry',purpose:'Review recovered participation, boundaries, and commitments before activation.',agreements:[]},f=await boot(t,{governance});assert.deepEqual(f.read(K).plan.governance,governance);assert.equal(f.w.localStorage.getItem(I),f.beforeLedger);
});
