import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';

const source=readFileSync(new URL('../public/app/anarchadia-runtime-stability-v159.js',import.meta.url),'utf8');
const read=name=>readFileSync(new URL(`../public/app/${name}`,import.meta.url),'utf8');
const handoffKey='civweave.active-handoff.v1';
function harness({embedded=true,document}={}){
  const storage=new Map(),assignments=[],navigations=[];
  const context={console,URL,URLSearchParams,structuredClone,
    document:document||{readyState:'loading',scripts:[],addEventListener(){}},addEventListener(){},dispatchEvent(){},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail}},
    location:{origin:'https://civweave-staging.pages.dev',href:'https://civweave-staging.pages.dev/app/anarchadia-console-v139.html?embed=1',search:'',assign:url=>assignments.push(url)},
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value))},
    CivweaveFamilyAILoaderV105:{ensure(){},openChat(){}},
  };
  context.parent=embedded?{CivweavePersistentSystemShellV1:{navigate:(system,options)=>{navigations.push({system,options});return true}}}:context;
  vm.createContext(context);vm.runInContext(source,context,{filename:'anarchadia-runtime-stability-v159.js'});
  return{context,storage,assignments,navigations,api:context.AnarchadiaRuntimeStabilityV159};
}
function fixture(realm='cerbanimo'){
  const path={id:'qa-work-path',realm,title:'QA note',purpose:'Write a small digital note',steps:['Write alpha','Add beta','Add gamma'],completionCriteria:'The note contains alpha beta gamma.'};
  return{path,plan:{id:'qa-weave',state:'active',wish:'Write a QA note',paths:[path]}};
}

for(const realm of ['cerbanimo','living-school','fellowfare'])test(`Passport ${realm} path delegates to the existing parent shell`,()=>{
  const app=harness(),{plan,path}=fixture(realm);
  assert.equal(app.api.openQuestPath(plan,path),true);
  assert.equal(app.assignments.length,0,'the child must not navigate itself into another shell');
  assert.equal(app.navigations.length,1);assert.equal(app.navigations[0].system,realm);
  assert.equal(app.navigations[0].options.source,'anarchadia-passport');
  const handoff=JSON.parse(app.storage.get(handoffKey));
  assert.equal(handoff.weaveId,plan.id);assert.equal(handoff.pathId,path.id);assert.equal(handoff.target,realm);
});

test('a direct top-level Passport keeps its realm URL and path context fallback',()=>{
  const app=harness({embedded:false}),{plan,path}=fixture();
  assert.equal(app.api.openQuestPath(plan,path),true);assert.equal(app.navigations.length,0);
  const target=new URL(app.assignments[0],app.context.location.origin);
  assert.equal(target.pathname,'/app/realm-console-v140.html');assert.equal(target.searchParams.get('system'),'cerbanimo');
  assert.equal(target.searchParams.get('weave'),plan.id);assert.equal(target.searchParams.get('path'),path.id);
});

test('the saved handoff reaches the real Cerbanimo engine without explicit iframe query parameters',()=>{
  const app=harness(),{plan,path}=fixture();app.api.openQuestPath(plan,path);
  vm.runInContext(read('cerbanimo-quest-engine-v144.js'),app.context,{filename:'cerbanimo-quest-engine-v144.js'});
  vm.runInContext(read('cerbanimo-quest-path-v266.js'),app.context,{filename:'cerbanimo-quest-path-v266.js'});
  const result=app.context.CivweaveCerbanimoQuestPathV266.materialize();
  assert.equal(result.ok,true);assert.equal(result.quest.sourceActionId,`${plan.id}:${path.id}`);
  const quests=app.context.CivweaveCerbanimoQuestV144.readState().quests;
  assert.equal(quests.length,1);assert.deepEqual(Array.from(quests[0].tasks,task=>task.title),path.steps);
  assert.equal(app.context.CivweaveCerbanimoQuestPathV266.materialize().ok,true);
  assert.equal(app.context.CivweaveCerbanimoQuestV144.readState().quests.length,1,'retry remains idempotent');
});

test('an unapproved plan cannot navigate or create a handoff',()=>{
  const app=harness(),{plan,path}=fixture();plan.state='review';
  assert.equal(app.api.openQuestPath(plan,path),false);assert.equal(app.navigations.length,0);assert.equal(app.assignments.length,0);assert.equal(app.storage.has(handoffKey),false);
});

test('Passport actions follow the displayed Quest and revoke a retained action when review replaces it',()=>{
  const dom=new JSDOM('<div id="ac-passport-paths"><article class="ac-path-card"></article></div>');
  const app=harness({document:dom.window.document}),old=fixture('cerbanimo'),next=fixture('living-school');
  next.plan.id='next-weave';next.path.id='next-learning';
  app.storage.set('civweave.working-campus.v1',JSON.stringify({plan:old.plan}));
  app.storage.set('civweave.intentions.v127',JSON.stringify([{state:'active',plan:old.plan}]));
  app.api.mountQuestPathActions();
  const oldButton=dom.window.document.querySelector('button');assert.equal(oldButton.textContent,'Open in Cerbanimo');
  app.storage.set('civweave.working-campus.v1',JSON.stringify({plan:next.plan}));
  app.api.mountQuestPathActions();
  const button=dom.window.document.querySelector('button');
  assert.equal(button.textContent,'Open in Living School');button.click();
  assert.equal(app.navigations.at(-1).system,'living-school');
  assert.equal(JSON.parse(app.storage.get(handoffKey)).weaveId,next.plan.id);
  next.plan.state='review';app.storage.set('civweave.working-campus.v1',JSON.stringify({plan:next.plan}));
  app.api.mountQuestPathActions();
  assert.equal(dom.window.document.querySelector('button'),null,'Review cannot expose another active Quest’s destination.');
  button.click();oldButton.click();assert.equal(app.navigations.length,1,'Retained stale controls cannot navigate or write handoffs.');
  dom.window.close();
});
