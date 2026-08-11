import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const runtime=fs.readFileSync(new URL('../public/app/realm-session-integrity-v237.js',import.meta.url),'utf8');
const boundary=fs.readFileSync(new URL('../public/app/install-boundary-v146.js',import.meta.url),'utf8');
const workspace=fs.readFileSync(new URL('../public/app/guide-workspace-v242.js',import.meta.url),'utf8');
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const version=fs.readFileSync(new URL('../VERSION',import.meta.url),'utf8').trim();

new Function(runtime);new Function(boundary);new Function(workspace);

const checks=[
  ['realm-local ledgers are data-only and migrate old storage once',()=>{
    assert.match(runtime,/civweave\.guide-thread\.\$\{system\}\.v237/);
    assert.match(runtime,/function migrateThreads\(\)/);
    assert.match(runtime,/localStorage\.removeItem\(legacyThreadKey\(system\)\)/);
    assert.match(runtime,/localStorage\.removeItem\(OLD_SHARED_KEY\)/);
    assert.match(runtime,/dataOnly:true/);
    assert.match(runtime,/canonicalChatOwner:'guide-workspace-v242'/);
    for(const forbidden of ['function mountChat','function openChat','function onSubmit','function onTrigger','data-persistent-form','cwp215-launcher','MutationObserver'])assert.ok(!runtime.includes(forbidden),`realm session still owns retired chat UI: ${forbidden}`);
  }],
  ['handover packets remain data operations only',()=>{
    assert.match(runtime,/role:'handover',sourceSystem:source,targetSystem:target/);
    assert.match(runtime,/What \$\{GUIDE\[source\]\.name\} needs from \$\{GUIDE\[target\]\.name\}/);
    assert.match(runtime,/assistant\.respond\(\{text:prompt,systemId:target/);
    assert.doesNotMatch(runtime,/document\.body\.append\(root,launcher\)/);
  }],
  ['creator-led Cerbanimo planning keeps the agentic model profile',()=>{
    assert.match(runtime,/generateAgentic/);assert.match(runtime,/cerbanimo-project-planning-v237/);assert.match(runtime,/analysis\?\.route==='creator-plan'/);assert.match(runtime,/No coding automation or GitHub job started/);assert.match(runtime,/dependencies/);assert.match(runtime,/dataNeeded/);
  }],
  ['Rook accepts Buttons, unlimited budget, and finalization',()=>{
    assert.match(runtime,/exchangeMethod:'Buttons'/);assert.match(runtime,/budgetPolicy:'Unlimited'/);assert.match(runtime,/Finalize & publish request/);assert.match(runtime,/finalize\[_\\s-\]\*exchange/);
  }],
  ['utility repairs are bounded and event-driven',()=>{
    for(const label of ['GitHub repository','GitHub automation dispatch','AI task validator automation endpoint'])assert.ok(runtime.includes(`'${label}'`),label);
    assert.match(runtime,/cw237-setup-tutorial/);assert.match(runtime,/FOUNDATION_SCHOOLS/);assert.match(runtime,/evaluate-assessment/);assert.match(runtime,/\/app\/logos\/civweave-app-icon\.png/);assert.match(runtime,/--cw-top-safe-height/);
    assert.doesNotMatch(runtime,/setInterval\(/);assert.doesNotMatch(runtime,/new MutationObserver/);
  }],
  ['canonical boundary loads data layer then one v242 chat owner',()=>{
    assert.match(boundary,/REALM_SESSION_INTEGRITY='\/app\/realm-session-integrity-v237\.js'/);assert.match(boundary,/GUIDE_WORKSPACE='\/app\/guide-workspace-v242\.js'/);
    const start=boundary.indexOf('const SYSTEM_EXPERIENCE_SCRIPTS=['),end=boundary.indexOf('];',start),experience=boundary.slice(start,end);
    assert.ok(experience.indexOf('REALM_SESSION_INTEGRITY,')<experience.indexOf('GUIDE_WORKSPACE,'));
    assert.doesNotMatch(boundary,/PERSISTENT_GUIDE_CHAT_SCRIPT|PERSISTENT_GUIDE_VIEWPORT_SCRIPT/);
    assert.match(workspace,/canonicalOwner:true/);
  }],
  ['release metadata agrees and syntax gate includes the data layer',()=>{
    assert.match(version,/^\d+\.\d+\.\d+$/);assert.equal(pkg.version,version);assert.match(pkg.scripts['check:syntax'],/public\/app\/realm-session-integrity-v237\.js/);
  }]
];
for(const [name,run] of checks){run();console.log(`✓ ${name}`)}

const store=new Map(),listeners=new Map();
const document={readyState:'loading',documentElement:{dataset:{},style:{setProperty(){}},addEventListener(){}},body:{dataset:{}},addEventListener(type,fn){listeners.set(type,fn)},querySelector(){return null},querySelectorAll(){return[]},getElementById(){return null},createElement(){return{style:{},dataset:{},querySelector(){return null},addEventListener(){}}},head:{append(){}}};
const localStorage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)};
const sandbox={console,Date,Math,JSON,Promise,URL,URLSearchParams,structuredClone,localStorage,document,location:{pathname:'/app/fellowfare-cabinet-v144.html',search:'',hostname:'example.test'},globalThis:null,addEventListener(){},dispatchEvent(){return true},CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},queueMicrotask,getComputedStyle:()=>({position:'static',display:'block',visibility:'visible'})};
sandbox.globalThis=sandbox;
vm.runInNewContext(runtime,sandbox,{filename:'realm-session-integrity-v237.js'});
const api=sandbox.CivweaveRealmSessionIntegrityV237;
assert.equal(api.dataOnly,true);assert.equal(api.canonicalChatOwner,'guide-workspace-v242');assert.equal(api.foundationSchools.length,11);assert.equal(api.foundationSchools.reduce((sum,row)=>sum+row.articles,0),1001);assert.ok(api.recommendedSchools('beginner meditation and attention').includes('philosophy-and-religion'));
const action={id:'rook-1',system:'fellowfare',state:'clarifying',fields:{needOrOffer:'Need'},missingRequired:['maximum budget or exchange method'],approval:{required:true,label:'Submit request'}};
store.set('civweave.realm-actions.v141',JSON.stringify([action]));api.repairFellowFareAction(action,'maximum budget is unlimited and exchange method is buttons finalize_exchange_parameters');assert.equal(action.fields.exchangeMethod,'Buttons');assert.equal(action.fields.budgetPolicy,'Unlimited');assert.deepEqual(action.missingRequired,[]);assert.equal(action.state,'review');assert.equal(action.approval.label,'Finalize & publish request');

console.log(`Realm session integrity v237 verified data-only: ${checks.length}/${checks.length} static contracts plus behavioral state checks passed.`);