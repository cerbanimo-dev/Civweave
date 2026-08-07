import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const runtime=fs.readFileSync(new URL('../public/app/realm-session-integrity-v237.js',import.meta.url),'utf8');
const boundary=fs.readFileSync(new URL('../public/app/install-boundary-v146.js',import.meta.url),'utf8');
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const version=fs.readFileSync(new URL('../VERSION',import.meta.url),'utf8').trim();

new Function(runtime);
new Function(boundary);

const checks=[
  ['realm-local chat ledgers replace one shared memory stream',()=>{
    assert.match(runtime,/civweave\.guide-thread\.\$\{system\}\.v237/);
    assert.match(runtime,/five-realm-local-ledgers-plus-explicit-handover|Cross-realm work arrives only as explicit handover cards/);
    assert.doesNotMatch(runtime,/One thread, five guides\./);
    assert.match(runtime,/migrateThreads\(\)/);
  }],
  ['handover packets keep the source avatar and palette in the target thread',()=>{
    assert.match(runtime,/role:'handover',sourceSystem:source,targetSystem:target/);
    assert.match(runtime,/Handover from \$\{esc\(meta\.name\)\}/);
    assert.match(runtime,/What \$\{GUIDE\[source\]\.name\} needs from \$\{GUIDE\[target\]\.name\}/);
    assert.match(runtime,/assistant\.respond\(\{text:prompt,systemId:target/);
  }],
  ['creator-led Cerbanimo planning uses the agentic model profile',()=>{
    assert.match(runtime,/generateAgentic/);
    assert.match(runtime,/cerbanimo-project-planning-v237/);
    assert.match(runtime,/analysis\?\.route==='creator-plan'/);
    assert.match(runtime,/No coding automation or GitHub job started/);
    assert.match(runtime,/dependencies/);
    assert.match(runtime,/dataNeeded/);
  }],
  ['Rook accepts Buttons, unlimited budget, and finalization',()=>{
    assert.match(runtime,/exchangeMethod:'Buttons'/);
    assert.match(runtime,/budgetPolicy:'Unlimited'/);
    assert.match(runtime,/Finalize & publish request/);
    assert.match(runtime,/finalize\[_\\s-\]\*exchange/);
  }],
  ['automation prerequisites have tutorial surfaces',()=>{
    for(const label of ['GitHub repository','GitHub automation dispatch','AI task validator automation endpoint'])assert.ok(runtime.includes(`'${label}'`),label);
    assert.match(runtime,/cw237-setup-tutorial/);
    assert.match(runtime,/Open AI settings/);
  }],
  ['Living School knows the optional foundation library and assessment remains clickable',()=>{
    assert.match(runtime,/FOUNDATION_SCHOOLS/);
    assert.match(runtime,/1,001 articles/);
    assert.match(runtime,/evaluate-assessment/);
    assert.match(runtime,/button\.disabled=false/);
    assert.match(runtime,/knowledge-school-list/);
  }],
  ['logo and top-bar repairs are direct and bounded',()=>{
    assert.match(runtime,/\/app\/logos\/civweave-app-icon\.png/);
    assert.match(runtime,/--cw-top-safe-height/);
    assert.match(runtime,/style\.position!=='fixed'/);
    assert.match(runtime,/MutationObserver\(records=>/);
    assert.doesNotMatch(runtime,/setInterval\(/);
  }],
  ['canonical boundary loads v237 before shared guide rendering',()=>{
    assert.match(boundary,/REALM_SESSION_INTEGRITY='\/app\/realm-session-integrity-v237\.js'/);
    assert.ok(boundary.indexOf('REALM_SESSION_INTEGRITY,')<boundary.indexOf('THEMED_SYSTEM_NAV,'));
    assert.match(boundary,/realmSessionIntegrityRevision:'v237-realm-local-memory-handover-state-repair'/);
    assert.match(boundary,/persistentGuideChatThreadPolicy:'five-realm-local-ledgers-plus-explicit-handover'/);
  }],
  ['release is v1.0.31 and syntax gate includes runtime',()=>{
    assert.equal(version,'1.0.31');
    assert.equal(pkg.version,'1.0.31');
    assert.match(pkg.scripts['check:syntax'],/public\/app\/realm-session-integrity-v237\.js/);
  }]
];

for(const [name,run] of checks){run();console.log(`✓ ${name}`)}

const store=new Map();
const listeners=new Map();
const document={
  readyState:'loading',
  documentElement:{dataset:{},style:{setProperty(){}},addEventListener(){}},
  body:{dataset:{}},
  addEventListener(type,fn){listeners.set(type,fn)},
  querySelector(){return null},querySelectorAll(){return[]},getElementById(){return null},createElement(){return{}}
};
const localStorage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)};
const sandbox={console,Date,Math,JSON,Promise,URL,URLSearchParams,structuredClone,localStorage,document,location:{pathname:'/app/fellowfare-cabinet-v144.html',search:'',hostname:'example.test'},globalThis:null,addEventListener(){},dispatchEvent(){return true},CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},queueMicrotask,MutationObserver:class{observe(){}disconnect(){}},getComputedStyle:()=>({position:'static',display:'block',visibility:'visible'})};
sandbox.globalThis=sandbox;
vm.runInNewContext(runtime,sandbox,{filename:'realm-session-integrity-v237.js'});
const api=sandbox.CivweaveRealmSessionIntegrityV237;
assert.equal(api.foundationSchools.length,11);
assert.equal(api.foundationSchools.reduce((sum,row)=>sum+row.articles,0),1001);
assert.ok(api.recommendedSchools('beginner meditation and attention').includes('philosophy-and-religion'));

const action={id:'rook-1',system:'fellowfare',state:'clarifying',fields:{needOrOffer:'Need'},missingRequired:['maximum budget or exchange method'],approval:{required:true,label:'Submit request'}};
store.set('civweave.realm-actions.v141',JSON.stringify([action]));
api.repairFellowFareAction(action,'maximum budget is unlimited and exchange method is buttons finalize_exchange_parameters');
assert.equal(action.fields.exchangeMethod,'Buttons');
assert.equal(action.fields.budgetPolicy,'Unlimited');
assert.deepEqual(action.missingRequired,[]);
assert.equal(action.state,'review');
assert.equal(action.approval.label,'Finalize & publish request');

console.log(`Realm session integrity v237 verified: ${checks.length}/${checks.length} static contracts plus behavioral state checks passed.`);
